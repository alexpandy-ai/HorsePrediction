import { calendarDate, addCalendarDays } from "../src/meetings/time.ts";
import type { MeetingsPayload, SourceReport, WireRace } from "../src/meetings/types.ts";
import {
  ACCEPTANCES_AHEAD_DAYS,
  dedupeRaces,
  planRefresh,
  racesFromAcceptances,
  racesFromEvents,
  racesFromResults,
  canSpend,
  recordSpend,
  RESULTS_LOOKBACK_DAYS,
  rollLedger,
  SOURCE_NAME,
  supportedWindow,
  SYDNEY,
  type CreditLedger,
  type RefreshJob,
} from "./pe-model.ts";
import { PeError, peGet } from "./puntersedge.ts";
import type { CardSlice, PuntersCache } from "./store.ts";
import { emptyPunters } from "./store.ts";

function budgets(): { daily: number; monthly: number } {
  const daily = Number(process.env.PUNTERSEDGE_DAILY_CREDIT_BUDGET || 40);
  const monthly = Number(process.env.PUNTERSEDGE_MONTHLY_CREDIT_BUDGET || 400);
  return {
    daily: Number.isFinite(daily) && daily > 0 ? daily : 40,
    monthly: Number.isFinite(monthly) && monthly > 0 ? monthly : 400,
  };
}

function sliceTime(slice: CardSlice | null | undefined): string | null {
  return slice?.updatedAt ?? null;
}

function keep(previous: CardSlice | undefined, error: string): CardSlice {
  if (previous && previous.races.length > 0) return { ...previous, error };
  return { updatedAt: new Date().toISOString(), races: [], error, complete: false };
}

async function loadEvents(date: string, key: string, horizon: number | null, previousRemaining: number | null): Promise<{ slice: CardSlice; cost: number; remaining: number | null; horizonHours: number | null }> {
  try {
    const result = await peGet("/racing/events", { date, category: "horse", include_unresolved: "true" }, key, 1, previousRemaining);
    const races = racesFromEvents(result.body, date).filter((race) => race.localDate === date || race.meetingDate === date);
    return {
      slice: { updatedAt: new Date().toISOString(), races, error: null, complete: true },
      cost: result.cost,
      remaining: result.remaining,
      horizonHours: result.horizonHours,
    };
  } catch (error) {
    if (!(error instanceof PeError) || (error.kind !== "plan" && error.kind !== "validation")) throw error;
    const hours = String(Math.min(horizon ?? 24, 24));
    const result = await peGet("/racing/events", { hours_ahead: hours, category: "horse", include_unresolved: "true" }, key, 1, previousRemaining);
    const races = racesFromEvents(result.body, null).filter((race) => {
      const sydneyDate = race.startInstant ? calendarDate(SYDNEY, new Date(race.startInstant)) : race.meetingDate;
      return sydneyDate === date || race.localDate === date;
    });
    return {
      slice: {
        updatedAt: new Date().toISOString(),
        races,
        error: null,
        complete: false,
      },
      cost: result.cost,
      remaining: result.remaining,
      horizonHours: result.horizonHours,
    };
  }
}

export async function refreshPunters(current: PuntersCache, apiKey: string | null, now = new Date()): Promise<PuntersCache> {
  if (!apiKey) return { ...emptyPunters(), forms: current.forms };
  const { daily, monthly } = budgets();
  const next: PuntersCache = { ...current, credits: rollLedger(current.credits, now), slices: { ...current.slices }, planBlocks: { ...current.planBlocks } };
  try {
    const usage = await peGet("/usage", {}, apiKey, 0, next.credits.remaining);
    const body = usage.body && typeof usage.body === "object" ? (usage.body as Record<string, unknown>) : {};
    if (typeof body.credits_remaining === "number") next.credits.remaining = body.credits_remaining;
    if (typeof body.credits_limit === "number") next.credits.limit = body.credits_limit;
    if (typeof body.reset_at === "string") next.credits.resetAt = body.reset_at;
    if (typeof body.credits_limit === "number" && typeof body.credits_remaining === "number") {
      const periodUsed = body.credits_limit - body.credits_remaining;
      if (periodUsed >= 0 && periodUsed < next.credits.spentToday) {
        next.credits = { ...next.credits, spentToday: periodUsed, spentMonth: Math.max(next.credits.spentMonth, periodUsed) };
      }
    }
  } catch {
    // A free usage read should not block the card refresh.
  }
  const today = calendarDate(SYDNEY, now);
  const tomorrow = addCalendarDays(today, 1);
  const stamps: Partial<Record<RefreshJob, string | null>> = {
    venues: next.venuesUpdatedAt,
    "events-today": sliceTime(next.slices[`events:${today}`]),
    "events-tomorrow": sliceTime(next.slices[`events:${tomorrow}`]),
    "acceptances-today": sliceTime(next.slices[`acceptances:${today}`]),
    "results-today": sliceTime(next.slices[`results:${today}`]),
    "next-to-go": sliceTime(next.nextToGo),
  };
  const jobs = planRefresh(now, stamps, next.credits, daily, monthly);
  let failed = false;
  for (const job of jobs) {
    try {
      if (job === "venues") {
        const result = await peGet("/racing/venues", {}, apiKey, 1, next.credits.remaining);
        next.venuesUpdatedAt = new Date().toISOString();
        next.credits = recordSpend(next.credits, result.cost, result.remaining, now);
        if (result.horizonHours) next.horizonHours = result.horizonHours;
      } else if (job === "events-today" || job === "events-tomorrow") {
        const date = job === "events-today" ? today : tomorrow;
        const loaded = await loadEvents(date, apiKey, next.horizonHours, next.credits.remaining);
        next.slices[`events:${date}`] = loaded.slice;
        next.credits = recordSpend(next.credits, loaded.cost, loaded.remaining, now);
        if (loaded.horizonHours) next.horizonHours = loaded.horizonHours;
      } else if (job === "acceptances-today") {
        const result = await peGet("/racing/acceptances", { date: today }, apiKey, 2, next.credits.remaining);
        next.slices[`acceptances:${today}`] = {
          updatedAt: new Date().toISOString(),
          races: racesFromAcceptances(result.body),
          error: null,
          complete: true,
        };
        next.credits = recordSpend(next.credits, result.cost, result.remaining, now);
      } else if (job === "results-today") {
        const result = await peGet("/racing/results", { date: today, category: "horse", limit: "200", offset: "0" }, apiKey, 2, next.credits.remaining);
        const races = racesFromResults(result.body, today);
        next.slices[`results:${today}`] = {
          updatedAt: new Date().toISOString(),
          races,
          error: null,
          complete: races.length < 200,
        };
        next.credits = recordSpend(next.credits, result.cost, result.remaining, now);
      } else if (job === "next-to-go") {
        const result = await peGet("/racing/next-to-go", { category: "horse", limit: "10", include_unresolved: "true" }, apiKey, 2, next.credits.remaining);
        next.nextToGo = { updatedAt: new Date().toISOString(), races: racesFromEvents(result.body, null), error: null, complete: false };
        next.credits = recordSpend(next.credits, result.cost, result.remaining, now);
      }
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : "PuntersEdge request failed.";
      if (error instanceof PeError && (error.kind === "auth" || error.kind === "credits")) {
        next.credits = {
          ...next.credits,
          haltUntil: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
          haltReason: message,
        };
        break;
      }
      if (error instanceof PeError && error.kind === "plan") {
        next.planBlocks[job] = message;
      }
      const date = job === "events-tomorrow" ? tomorrow : today;
      const key = job.startsWith("events") ? `events:${date}` : job.startsWith("acceptances") ? `acceptances:${date}` : job.startsWith("results") ? `results:${date}` : "";
      if (key) next.slices[key] = keep(next.slices[key], message);
      if (job === "next-to-go" && next.nextToGo) next.nextToGo = { ...next.nextToGo, error: message };
    }
  }
  if (process.env.PUNTERSEDGE_ENABLE_CHANGES === "1" && next.changesSince) {
    const age = now.getTime() - Date.parse(next.changesSince);
    const decision = canSpend(next.credits, 2, daily, monthly, now);
    if (age >= 0 && age < 25 * 60 * 1000 && decision.ok) {
      try {
        const result = await peGet(
          "/racing/changes",
          { since: next.changesSince, category: "horse", include_unresolved: "true" },
          apiKey,
          2,
          next.credits.remaining,
        );
        const root = result.body && typeof result.body === "object" ? (result.body as Record<string, unknown>) : {};
        const serverTime = typeof root.server_time === "string" ? root.server_time : null;
        const changed = racesFromEvents(root.races ?? root.changed_races ?? [], today);
        if (changed.length > 0) {
          const key = `events:${today}`;
          const previous = next.slices[key];
          next.slices[key] = {
            updatedAt: new Date().toISOString(),
            races: dedupeRaces([...(previous?.races ?? []), ...changed]),
            error: previous?.error ?? null,
            complete: previous?.complete ?? false,
          };
        }
        if (serverTime) next.changesSince = serverTime;
        next.credits = recordSpend(next.credits, result.cost, result.remaining, now);
      } catch (error) {
        failed = true;
        if (error instanceof PeError && (error.kind === "auth" || error.kind === "credits")) {
          next.credits = { ...next.credits, haltUntil: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(), haltReason: error.message };
        }
      }
    }
  } else if (!next.changesSince) {
    next.changesSince = new Date(now.getTime() - 60 * 1000).toISOString();
  }
  const detail = `Horse meetings for Australia, New Zealand, Britain, Ireland, and South Africa where PuntersEdge publishes them. Harness and greyhound cards are not requested. Daily budget ${daily}, monthly budget ${monthly}. Spent today ${next.credits.spentToday}.`;
  next.source = {
    id: "puntersedge",
    name: SOURCE_NAME,
    state: failed ? "failed" : "ok",
    detail,
  };
  return next;
}

function dated(slice: CardSlice | undefined, date: string): WireRace[] {
  if (!slice) return [];
  return slice.races.filter((race) => race.meetingDate === date || race.localDate === date);
}

export function puntersMeetings(punters: PuntersCache, requestedDate: string, now = new Date()): MeetingsPayload {
  const window = supportedWindow(now, punters.horizonHours);
  const today = calendarDate(SYDNEY, now);
  const coverage = coverageReports(punters);
  const budgetNote = punters.credits.haltReason;
  if (punters.source.state === "unconfigured") {
    return {
      requestedDate,
      mode: "unavailable",
      message: "PuntersEdge is not configured. Set PUNTERSEDGE_API_KEY on the data server. No meetings have been requested.",
      lastUpdated: null,
      stale: false,
      staleReason: null,
      sources: [punters.source],
      coverage,
      races: [],
      window,
      nextToGo: [],
      budgetNote,
    };
  }
  if (requestedDate < window.minDate || requestedDate > window.maxDate) {
    return {
      requestedDate,
      mode: "outside-window",
      message: `PuntersEdge can supply ${window.minDate} to ${window.maxDate} on the Australia/Sydney meeting calendar. ${requestedDate} is outside that window. ${window.note}`,
      lastUpdated: latest(punters),
      stale: false,
      staleReason: null,
      sources: [punters.source],
      coverage,
      races: [],
      window,
      nextToGo: [],
      budgetNote,
    };
  }
  const events = punters.slices[`events:${requestedDate}`];
  const results = punters.slices[`results:${requestedDate}`];
  const acceptances = punters.slices[`acceptances:${requestedDate}`];
  const past = requestedDate < today;
  const races = dedupeRaces([...dated(results, requestedDate), ...dated(events, requestedDate), ...dated(acceptances, requestedDate)]);
  const relevant = past ? [results] : [events, results, acceptances].filter(Boolean);
  const stale = relevant.some((slice) => slice?.error);
  const confirmedEmpty = races.length === 0 && (past ? results?.error == null && results?.complete === true : events?.error == null && events?.complete === true && (results == null || results.error == null));
  if (races.length === 0 && !confirmedEmpty) {
    const reason = events?.error || results?.error || acceptances?.error || "This Sydney meeting date has not been loaded yet.";
    return {
      requestedDate,
      mode: "unavailable",
      message: reason,
      lastUpdated: latest(punters),
      stale: false,
      staleReason: null,
      sources: [punters.source],
      coverage,
      races: [],
      window,
      nextToGo: (punters.nextToGo?.races ?? []).filter((race) => race.meetingDate === requestedDate || race.localDate === requestedDate),
      budgetNote,
    };
  }
  return {
    requestedDate,
    mode: "schedule",
    message: events && !events.complete ? "The plan horizon does not cover this whole Sydney day, so this card can be incomplete." : null,
    lastUpdated: events?.updatedAt ?? results?.updatedAt ?? acceptances?.updatedAt ?? latest(punters),
    stale,
    staleReason: events?.error || results?.error || acceptances?.error || null,
    sources: [punters.source],
    coverage,
    races: races.map(summarise),
    window,
    nextToGo: (punters.nextToGo?.races ?? []).filter((race) => !past).map(summarise),
    budgetNote,
  };
}

function summarise(race: WireRace): WireRace {
  return {
    ...race,
    runners: race.runners.map((runner) => ({ ...runner, quotes: runner.quotes?.slice(0, 1) })),
    quotes: race.quotes?.slice(0, 3),
  };
}

function latest(punters: PuntersCache): string | null {
  const times = [punters.venuesUpdatedAt, punters.nextToGo?.updatedAt, ...Object.values(punters.slices).map((slice) => slice.updatedAt)].filter((value): value is string => Boolean(value));
  return times.sort().at(-1) ?? null;
}

function coverageReports(punters: PuntersCache): SourceReport[] {
  const state = punters.source.state;
  return [
    { id: "au", name: "Australia", state: state === "unconfigured" ? "unconfigured" : "ok", detail: "Horse meetings from events and results. Thoroughbred acceptances add the Racing Australia card. Harness and greyhound are not loaded. State is shown only from the verified course list." },
    { id: "nz", name: "New Zealand", state: state === "unconfigured" ? "unconfigured" : "ok", detail: "Thoroughbred meetings when the feed includes them. No New Zealand greyhound coverage is published." },
    { id: "gb-ie", name: "Great Britain and Ireland", state: state === "unconfigured" ? "unconfigured" : "ok", detail: "Thoroughbred prices and results where the British and Irish books publish them. Race numbers on British cards can be a running order rather than an official number." },
    { id: "za", name: "South Africa", state: state === "unconfigured" ? "unconfigured" : "ok", detail: "Thoroughbred only, on a smaller bookmaker panel. Distance and going appear only when a bookmaker publishes them." },
    { id: "india", name: "India", state: "unsupported", detail: "No IndiaRace feed is configured, and PuntersEdge does not publish Indian meetings." },
    { id: "partial", name: "Other countries", state: "unsupported", detail: "A meeting is shown only when PuntersEdge returns it. This board is not a worldwide racecard." },
  ];
}

export function findPuntersRace(punters: PuntersCache, id: string): { race: WireRace; updatedAt: string | null; stale: boolean; staleReason: string | null } | null {
  const slices = [...Object.values(punters.slices), punters.nextToGo].filter((slice): slice is CardSlice => Boolean(slice));
  for (const slice of slices) {
    const race = slice.races.find((item) => item.id === id || item.providerId === id);
    if (race) return { race, updatedAt: slice.updatedAt, stale: Boolean(slice.error), staleReason: slice.error };
  }
  return null;
}

export async function loadFeature(
  punters: PuntersCache,
  apiKey: string | null,
  path: string,
  query: Record<string, string | undefined>,
  cost: number,
  now = new Date(),
): Promise<{ body: unknown; error: string | null; blocked: boolean; kind: string | null; credits: CreditLedger }> {
  if (!apiKey) return { body: null, error: "Set PUNTERSEDGE_API_KEY before loading this.", blocked: true, kind: "auth", credits: punters.credits };
  const { daily, monthly } = budgets();
  const ledger = rollLedger(punters.credits, now);
  const decision = canSpend(ledger, cost, daily, monthly, now);
  if (!decision.ok) return { body: null, error: decision.reason, blocked: true, kind: "credits", credits: ledger };
  if (punters.planBlocks[path]) return { body: null, error: punters.planBlocks[path], blocked: true, kind: "plan", credits: ledger };
  try {
    const result = await peGet(path, query, apiKey, cost, ledger.remaining);
    return { body: result.body, error: null, blocked: false, kind: null, credits: recordSpend(ledger, result.cost, result.remaining, now) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PuntersEdge request failed.";
    const kind = error instanceof PeError ? error.kind : "server";
    const blocked = kind === "plan" || kind === "auth" || kind === "credits";
    return { body: null, error: message, blocked, kind, credits: ledger };
  }
}

export { RESULTS_LOOKBACK_DAYS, ACCEPTANCES_AHEAD_DAYS };
