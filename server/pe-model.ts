import { lookupCourse } from "./locations.ts";
import { calendarDate, addCalendarDays, clockTime } from "../src/meetings/time.ts";
import type { PriceQuote, RaceStatus, WireRace, WireRunner } from "../src/meetings/types.ts";

export const SOURCE_NAME = "PuntersEdge";
export const SYDNEY = "Australia/Sydney";
export const RESULTS_LOOKBACK_DAYS = 7;
export const ACCEPTANCES_AHEAD_DAYS = 3;

const COUNTRIES: Record<string, { code: string; name: string; timezone: string | null }> = {
  AU: { code: "AU", name: "Australia", timezone: null },
  NZ: { code: "NZ", name: "New Zealand", timezone: null },
  GB: { code: "GB", name: "United Kingdom", timezone: "Europe/London" },
  IE: { code: "IE", name: "Ireland", timezone: "Europe/Dublin" },
  ZA: { code: "ZA", name: "South Africa", timezone: "Africa/Johannesburg" },
  HK: { code: "HK", name: "Hong Kong", timezone: "Asia/Hong_Kong" },
};

export interface CreditLedger {
  day: string;
  month: string;
  spentToday: number;
  spentMonth: number;
  remaining: number | null;
  limit: number | null;
  resetAt: string | null;
  haltUntil: string | null;
  haltReason: string | null;
}

export function emptyLedger(now = new Date()): CreditLedger {
  return {
    day: calendarDate(SYDNEY, now),
    month: calendarDate(SYDNEY, now).slice(0, 7),
    spentToday: 0,
    spentMonth: 0,
    remaining: null,
    limit: null,
    resetAt: null,
    haltUntil: null,
    haltReason: null,
  };
}

export function rollLedger(ledger: CreditLedger, now = new Date()): CreditLedger {
  const day = calendarDate(SYDNEY, now);
  const month = day.slice(0, 7);
  return {
    ...ledger,
    day,
    month,
    spentToday: ledger.day === day ? ledger.spentToday : 0,
    spentMonth: ledger.month === month ? ledger.spentMonth : 0,
  };
}

export function canSpend(
  ledger: CreditLedger,
  cost: number,
  dailyBudget: number,
  monthlyBudget: number,
  now = new Date(),
): { ok: boolean; reason: string | null } {
  const current = rollLedger(ledger, now);
  if (current.haltUntil && Date.parse(current.haltUntil) > now.getTime()) {
    return { ok: false, reason: current.haltReason ?? "PuntersEdge asked this server to wait." };
  }
  if (current.remaining != null && current.remaining < cost) {
    return { ok: false, reason: "The PuntersEdge credit balance is below this call." };
  }
  if (current.spentToday + cost > dailyBudget) {
    return { ok: false, reason: "The daily credit budget for this server is used." };
  }
  if (current.spentMonth + cost > monthlyBudget) {
    return { ok: false, reason: "The monthly credit budget for this server is used." };
  }
  return { ok: true, reason: null };
}

export function recordSpend(ledger: CreditLedger, cost: number, remaining: number | null, now = new Date()): CreditLedger {
  const current = rollLedger(ledger, now);
  return {
    ...current,
    spentToday: current.spentToday + cost,
    spentMonth: current.spentMonth + cost,
    remaining: remaining ?? current.remaining,
  };
}

export function mapRaceStatus(input: {
  status?: string | null;
  statusNote?: string | null;
  inplay?: boolean | null;
  resultStatus?: string | null;
}): RaceStatus {
  const status = (input.status ?? "").trim().toLowerCase();
  const note = (input.statusNote ?? "").trim().toLowerCase();
  const result = (input.resultStatus ?? "").trim().toLowerCase();
  if (result === "abandoned" || status === "abandoned" || note.includes("abandon")) return "Abandoned";
  if (status.includes("cancel") || note.includes("cancel")) return "Cancelled";
  if (status.includes("postpon") || note.includes("postpon") || note.includes("transfer")) return "Delayed";
  if (result === "final" || result === "interim") return "Finished";
  if (input.inplay === true) return "Live";
  return "Upcoming";
}

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function list(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(record).filter((item): item is Record<string, unknown> => item !== null);
}

function flagEmoji(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return "";
  return [...iso].map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65)).join("");
}

function firstText(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = text(source[key]);
    if (value) return value;
  }
  return null;
}

function quotesFrom(source: Record<string, unknown>): PriceQuote[] {
  return list(source.bookmakers)
    .map((book) => {
      const bookmaker = firstText(book, ["key", "bookmaker_key", "bookmaker"]);
      if (!bookmaker) return null;
      return {
        bookmaker,
        winPrice: numberOrNull(book.win_price),
        placePrice: numberOrNull(book.place_price),
        quotedAt: text(book.last_update) ?? text(book.updated_at),
        ageSeconds: numberOrNull(book.age_seconds),
        stale: boolOrNull(book.stale),
      };
    })
    .filter((quote): quote is PriceQuote => quote !== null);
}

function runnerFrom(source: Record<string, unknown>, index: number): WireRunner | null {
  const name = firstText(source, ["name", "horse", "horse_name"]);
  if (!name) return null;
  const saddle = firstText(source, ["number", "saddlecloth", "saddlecloth_number", "runner_number"]);
  const barrier = firstText(source, ["barrier", "box", "draw"]);
  const weightKg = numberOrNull(source.weight_kg);
  const weight = weightKg != null ? `${weightKg} kg` : firstText(source, ["weight"]);
  const position = numberOrNull(source.position);
  return {
    id: firstText(source, ["horse_ref", "runner_ref"]) ?? `${name}-${index}`,
    number: saddle,
    name,
    draw: barrier,
    age: text(source.age),
    sex: text(source.sex),
    weight,
    officialRating: firstText(source, ["hcp_rating", "rating"]),
    form: firstText(source, ["last10", "form"]),
    daysSince: null,
    jockey: text(source.jockey),
    trainer: text(source.trainer),
    headgear: text(source.gear_changes),
    scratched: source.scratched === true || text(source.status)?.toLowerCase() === "scratched",
    position,
    quotes: quotesFrom(source),
  };
}

export function normalizeRace(source: Record<string, unknown>, providerDate: string | null): WireRace | null {
  const id = text(source.race_id);
  const course = firstText(source, ["venue_canonical", "venue"]);
  const name = firstText(source, ["race_name", "name"]) ?? (course ? `${course} race` : null);
  if (!id || !course || !name) return null;
  const countryRaw = text(source.country)?.toUpperCase() ?? "";
  const known = COUNTRIES[countryRaw];
  const countryCode = known?.code ?? (countryRaw || "UNRESOLVED");
  const countryName = known?.name ?? (countryRaw ? `Unlisted region (${countryRaw})` : "Country unresolved");
  const place = known ? lookupCourse(course, known.code) : undefined;
  const timezone = place?.timezone ?? known?.timezone ?? null;
  const startInstant = parseInstant(text(source.start_time));
  const localDate = timezone && startInstant ? calendarDate(timezone, new Date(startInstant)) : providerDate ?? "";
  const distance = numberOrNull(source.distance_m);
  const runners = list(source.runners).map(runnerFrom).filter((runner): runner is WireRunner => runner !== null);
  const status = mapRaceStatus({
    status: text(source.status),
    statusNote: text(source.status_note),
    inplay: boolOrNull(source.inplay),
    resultStatus: text(source.result_status),
  });
  return {
    id: `pe:${id}`,
    providerId: id,
    provider: "puntersedge",
    name,
    raceNumber: text(source.race_number),
    course,
    courseId: firstText(source, ["venue_id", "venue_site"]) ?? course,
    countryCode,
    countryName,
    flag: flagEmoji(known?.code ?? ""),
    region: place?.region ?? "Region unavailable",
    timezone,
    meetingDate: providerDate ?? localDate,
    localDate: localDate || providerDate || "",
    localDateVerified: Boolean(timezone && startInstant),
    startInstant,
    publishedOffTime: startInstant && timezone ? clockTime(timezone, new Date(startInstant)) : text(source.start_time_local),
    distance: distance != null ? `${distance}m` : null,
    raceClass: text(source.race_class),
    surface: firstText(source, ["surface", "track_type"]),
    going: firstText(source, ["going", "track_condition"]),
    status,
    rawStatus: [text(source.status), text(source.result_status), text(source.status_note)].filter(Boolean).join(" · "),
    source: SOURCE_NAME,
    runners,
    quotes: quotesFrom(source),
    oddsStale: boolOrNull(source.stale),
    oddsAgeSeconds: numberOrNull(source.data_age_seconds),
    freshestAgeSeconds: numberOrNull(source.freshest_age_seconds),
  };
}

function parseInstant(value: string | null): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export function racesFromEvents(body: unknown, providerDate: string | null): WireRace[] {
  const rows = Array.isArray(body) ? body : list(record(body)?.races);
  return rows.map(record).filter((row): row is Record<string, unknown> => row !== null).map((row) => normalizeRace(row, providerDate)).filter((race): race is WireRace => race !== null);
}

export function racesFromAcceptances(body: unknown): WireRace[] {
  const root = record(body);
  if (!root) return [];
  const meetingDate = text(root.date);
  const races: WireRace[] = [];
  for (const meeting of list(root.meetings)) {
    const meetingVenue = firstText(meeting, ["venue_canonical", "venue", "track_name"]);
    const meetingBits = {
      track_condition: meeting.track_condition,
      going: meeting.going,
      weather: meeting.weather,
      track_type: meeting.track_type,
      rail: meeting.rail,
    };
    for (const race of list(meeting.races ?? meeting.events)) {
      const normalized = normalizeRace(
        {
          ...meetingBits,
          ...race,
          venue: race.venue ?? meetingVenue,
          venue_id: race.venue_id ?? meeting.venue_id,
          country: race.country ?? meeting.country ?? "AU",
        },
        meetingDate,
      );
      if (normalized) races.push(normalized);
    }
  }
  return races;
}

export function racesFromResults(body: unknown, providerDate: string | null): WireRace[] {
  const rows = Array.isArray(body) ? body : [];
  return rows
    .map(record)
    .filter((row): row is Record<string, unknown> => row !== null)
    .map((row) => normalizeRace({ ...row, result_status: row.status }, providerDate))
    .filter((race): race is WireRace => race !== null);
}

export function mergeRunners(current: WireRunner[], incoming: WireRunner[]): WireRunner[] {
  const byKey = new Map<string, WireRunner>();
  for (const runner of [...current, ...incoming]) {
    const key = runner.id || `${runner.number ?? ""}|${runner.name}`;
    const previous = byKey.get(key);
    if (!previous) {
      byKey.set(key, runner);
      continue;
    }
    byKey.set(key, {
      ...previous,
      ...Object.fromEntries(Object.entries(runner).filter(([, value]) => value != null && value !== "" && !(Array.isArray(value) && value.length === 0))),
      number: runner.number ?? previous.number,
      draw: runner.draw ?? previous.draw,
      quotes: runner.quotes?.length ? runner.quotes : previous.quotes,
    });
  }
  return [...byKey.values()];
}

export function mergeRace(current: WireRace, incoming: WireRace): WireRace {
  return {
    ...current,
    ...incoming,
    raceNumber: incoming.raceNumber ?? current.raceNumber,
    region: incoming.region !== "Region unavailable" ? incoming.region : current.region,
    timezone: incoming.timezone ?? current.timezone,
    localDateVerified: incoming.localDateVerified || current.localDateVerified,
    distance: incoming.distance ?? current.distance,
    raceClass: incoming.raceClass ?? current.raceClass,
    surface: incoming.surface ?? current.surface,
    going: incoming.going ?? current.going,
    runners: mergeRunners(current.runners, incoming.runners),
    quotes: incoming.quotes?.length ? incoming.quotes : current.quotes,
    oddsStale: incoming.oddsStale ?? current.oddsStale,
    oddsAgeSeconds: incoming.oddsAgeSeconds ?? current.oddsAgeSeconds,
    freshestAgeSeconds: incoming.freshestAgeSeconds ?? current.freshestAgeSeconds,
    status: incoming.status !== "Upcoming" ? incoming.status : current.status,
  };
}

export function dedupeRaces(races: WireRace[]): WireRace[] {
  const byId = new Map<string, WireRace>();
  for (const race of races) {
    const previous = byId.get(race.id);
    byId.set(race.id, previous ? mergeRace(previous, race) : race);
  }
  const merged = [...byId.values()];
  const byMeeting = new Map<string, WireRace>();
  for (const race of merged) {
    const minute = race.startInstant ? race.startInstant.slice(0, 16) : "";
    const key = minute ? `${race.countryCode}|${race.course}|${race.raceNumber ?? race.name}|${minute}` : race.id;
    const previous = byMeeting.get(key);
    byMeeting.set(key, previous ? mergeRace(previous, race) : race);
  }
  return [...byMeeting.values()];
}

export function supportedWindow(now: Date, horizonHours: number | null): { minDate: string; maxDate: string; note: string } {
  const today = calendarDate(SYDNEY, now);
  const horizonDays = Math.max(1, Math.floor((horizonHours ?? 24) / 24));
  const ahead = Math.max(horizonDays, ACCEPTANCES_AHEAD_DAYS);
  return {
    minDate: addCalendarDays(today, -RESULTS_LOOKBACK_DAYS),
    maxDate: addCalendarDays(today, ahead),
    note: `Results cover ${RESULTS_LOOKBACK_DAYS} Sydney days back. Upcoming events reach the plan horizon (${horizonHours ?? 24} hours until the API says otherwise). Australian thoroughbred acceptances reach ${ACCEPTANCES_AHEAD_DAYS} Sydney days ahead. Next-to-go is only the races currently carrying prices.`,
  };
}

export type RefreshJob = "venues" | "events-today" | "events-tomorrow" | "acceptances-today" | "results-today" | "next-to-go";

export function planRefresh(
  now: Date,
  stamps: Partial<Record<RefreshJob, string | null>>,
  ledger: CreditLedger,
  dailyBudget: number,
  monthlyBudget: number,
): RefreshJob[] {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: SYDNEY, hour: "2-digit", hourCycle: "h23" }).format(now));
  const active = hour >= 8 && hour <= 22;
  const age = (job: RefreshJob) => {
    const stamp = stamps[job];
    if (!stamp) return Infinity;
    return now.getTime() - Date.parse(stamp);
  };
  const wanted: Array<{ job: RefreshJob; dueMs: number; cost: number }> = [
    { job: "venues", dueMs: 12 * 60 * 60 * 1000, cost: 1 },
    { job: "events-today", dueMs: active ? 90 * 60 * 1000 : 3 * 60 * 60 * 1000, cost: 1 },
    { job: "results-today", dueMs: active ? 3 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000, cost: 2 },
    { job: "acceptances-today", dueMs: 12 * 60 * 60 * 1000, cost: 2 },
    { job: "events-tomorrow", dueMs: 12 * 60 * 60 * 1000, cost: 1 },
    { job: "next-to-go", dueMs: active ? 2 * 60 * 60 * 1000 : 8 * 60 * 60 * 1000, cost: 2 },
  ];
  const chosen: RefreshJob[] = [];
  let spent = 0;
  for (const item of wanted) {
    if (age(item.job) < item.dueMs) continue;
    const decision = canSpend(ledger, spent + item.cost, dailyBudget, monthlyBudget, now);
    if (!decision.ok) continue;
    chosen.push(item.job);
    spent += item.cost;
  }
  return chosen;
}
