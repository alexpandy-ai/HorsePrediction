import { addCalendarDays, calendarDate } from "../../src/meetings/time.ts";
import { FORMFAV_COUNTRIES, type FormfavCountry, type FormfavCountryCode } from "../../src/stride/formfav/countries.ts";
import type { FormfavPlan } from "../../src/stride/formfav/catalogue.ts";
import { applyPrediction, applyPrices, meetingsFromResponse, mergeMeetings, raceFromForm } from "../../src/stride/formfav/normalize.ts";
import { cardKey, type FormfavImportStatus, type FormfavMeeting, type FormfavMeetingsFile, type FormfavRacecardsFile, type FormfavRace } from "../../src/stride/formfav/types.ts";
import type { FormfavTransport } from "./client.ts";
import { emptyMeetings, readCards, readMeetings, readStatus, unconfiguredStatus, writePublication } from "./publish.ts";

export interface SyncOptions {
  transport: FormfavTransport | null;
  plan: FormfavPlan | "unknown";
  now?: Date;
  budget?: number;
  maxFormRaces?: number;
  root?: string;
}

export async function syncFormfav(options: SyncOptions): Promise<FormfavImportStatus> {
  const now = options.now ?? new Date();
  const generatedAt = now.toISOString();
  const root = options.root;
  if (!options.transport) {
    const previous = readStatus(root);
    const status = unconfiguredStatus(generatedAt);
    status.lastSuccessAt = previous.lastSuccessAt;
    const meetings = Object.fromEntries(FORMFAV_COUNTRIES.map((country) => [country.code, readMeetings(country.code, root)])) as Record<FormfavCountryCode, FormfavMeetingsFile>;
    writePublication(meetings, readCards(root), status, root);
    return status;
  }

  const budget = options.budget ?? 800;
  const maxFormRaces = options.maxFormRaces ?? 400;
  let used = 0;
  let remaining: number | null = null;
  let lastError: string | null = null;
  const plan = options.plan === "unknown" ? "free" : options.plan;
  let predictionsBlocked = false;
  let pricesBlocked = false;
  const meetings = Object.fromEntries(FORMFAV_COUNTRIES.map((country) => [country.code, readMeetings(country.code, root)])) as Record<FormfavCountryCode, FormfavMeetingsFile>;
  const cards = readCards(root);
  const previous = readStatus(root);
  const status = unconfiguredStatus(generatedAt);
  status.configured = true;
  status.plan = plan;
  status.lastSuccessAt = previous.lastSuccessAt;

  const stop = () => remaining === 0 || used >= budget;
  const seen = new Set<FormfavCountryCode>();

  for (const country of FORMFAV_COUNTRIES) {
    if (stop() || lastError) break;
    seen.add(country.code);
    const venues = await options.transport.get("/v1/form/venues", { country: country.code, raceType: "gallops" });
    used += 1;
    remaining = venues.remaining ?? remaining;
    if (venues.status === 401) {
      lastError = "FormFav rejected the API key.";
      break;
    }
    if (venues.status === 200) {
      const count = venueCount(venues.body);
      status.countries[country.code] = {
        coverage: count > 0 ? "venues-listed" : "no-gallops-venues",
        venueCount: count,
        note: count > 0 ? `FormFav lists ${count} thoroughbred venues for ${country.name}.` : `FormFav lists no thoroughbred venues for ${country.name}.`,
      };
    } else {
      status.countries[country.code] = {
        coverage: "unknown",
        venueCount: null,
        note: `The venue list for ${country.name} returned HTTP ${venues.status}.`,
      };
      if (venues.status === 429) lastError = "FormFav rate limit reached.";
    }
    if (status.countries[country.code].coverage === "no-gallops-venues") {
      meetings[country.code] = emptyMeetings(country.code);
      continue;
    }
    if (lastError) break;

    for (const date of datesFor(country, now)) {
      if (stop()) break;
      const collected: FormfavMeeting[] = [];
      let sawOk = false;
      let dateError: string | null = null;
      for (const timezone of country.requestTimezones) {
        if (stop()) break;
        const response = await options.transport.get("/v1/form/meetings", { date, race_code: "gallops", timezone });
        used += 1;
        remaining = response.remaining ?? remaining;
        if (response.status === 401) {
          lastError = "FormFav rejected the API key.";
          dateError = lastError;
          break;
        }
        if (response.status === 429) {
          lastError = "FormFav rate limit reached.";
          dateError = lastError;
          break;
        }
        if (response.status !== 200) {
          dateError = `Meetings for ${country.name} on ${date} returned HTTP ${response.status}.`;
          continue;
        }
        sawOk = true;
        collected.push(...meetingsFromResponse(response.body, country.code, date));
      }
      if (lastError && (meetings[country.code].dates[date]?.meetings.length ?? 0) > 0) break;
      if (!sawOk) {
        const previousDate = meetings[country.code].dates[date];
        meetings[country.code].dates[date] = {
          confirmed: false,
          fetchedAt: previousDate?.fetchedAt ?? null,
          empty: false,
          error: dateError ?? "Meetings could not be confirmed.",
          meetings: previousDate?.meetings ?? [],
        };
        if (lastError) break;
        continue;
      }
      if (lastError) {
        const merged = mergeMeetings([], collected);
        meetings[country.code].dates[date] = {
          confirmed: false,
          fetchedAt: null,
          empty: false,
          error: dateError,
          meetings: merged,
        };
        break;
      }
      const merged = mergeMeetings([], collected);
      meetings[country.code].dates[date] = {
        confirmed: true,
        fetchedAt: generatedAt,
        empty: merged.length === 0,
        error: null,
        meetings: merged,
      };
      status.lastSuccessAt = generatedAt;
    }
  }

  let formRaces = 0;
  if (!lastError) {
    for (const dateOffset of [0, 1]) {
      for (const country of FORMFAV_COUNTRIES) {
        const date = addCalendarDays(calendarDate(country.calendarTimezone, now), dateOffset);
        const slice = meetings[country.code].dates[date];
        if (!slice?.confirmed) continue;
        for (const meeting of slice.meetings) {
          for (const race of meeting.races) {
            if (formRaces >= maxFormRaces || stop()) break;
            const form = await options.transport.get("/v1/form", {
              date,
              track: meeting.slug,
              race: race.raceNumber,
              race_code: "gallops",
              country: country.code,
              timezone: race.timezone || country.calendarTimezone,
            });
            used += 1;
            formRaces += 1;
            remaining = form.remaining ?? remaining;
            if (form.status === 429) {
              lastError = "FormFav rate limit reached.";
              break;
            }
            if (form.status !== 200) continue;
            let detailed = raceFromForm(form.body, race);
            if ((plan === "pro" || plan === "premium") && country.code === "au" && !predictionsBlocked && !stop()) {
              const prediction = await options.transport.get("/v1/predictions", {
                date,
                track: meeting.slug,
                race: race.raceNumber,
                race_code: "gallops",
                country: "au",
                timezone: race.timezone || country.calendarTimezone,
              });
              used += 1;
              remaining = prediction.remaining ?? remaining;
              if (prediction.status === 200) detailed = applyPrediction(detailed, prediction.body);
              if (prediction.status === 403) {
                predictionsBlocked = true;
                status.planNote = "FormFav returned HTTP 403 for predictions. Further prediction calls were stopped.";
              }
            }
            if (plan === "premium" && !pricesBlocked && !stop()) {
              const prices = await options.transport.get("/v1/prices", {
                date,
                track: meeting.slug,
                race: race.raceNumber,
                race_code: "gallops",
                country: country.code,
                timezone: race.timezone || country.calendarTimezone,
              });
              used += 1;
              remaining = prices.remaining ?? remaining;
              if (prices.status === 200) detailed = applyPrices(detailed, prices.body);
              if (prices.status === 403) {
                pricesBlocked = true;
                status.planNote = "FormFav returned HTTP 403 for live prices. Further price calls were stopped.";
              }
            }
            cards.cards[cardKey(country.code, date, meeting.slug, race.raceNumber)] = {
              ...detailed,
              country: country.code,
              date,
              slug: meeting.slug,
              track: meeting.track,
            };
          }
        }
      }
    }
  }

  if (previous.configured) {
    for (const country of FORMFAV_COUNTRIES) {
      if (!seen.has(country.code)) status.countries[country.code] = previous.countries[country.code];
    }
  }

  status.generatedAt = generatedAt;
  status.requestsUsed = used;
  status.lastError = lastError;
  if (!lastError) status.lastSuccessAt = generatedAt;
  writePublication(meetings, cards, status, root);
  return status;
}

function datesFor(country: FormfavCountry, now: Date): string[] {
  const today = calendarDate(country.calendarTimezone, now);
  return [today, addCalendarDays(today, 1)];
}

function venueCount(body: unknown): number {
  if (body == null || typeof body !== "object") return 0;
  const record = body as { count?: unknown; venues?: unknown };
  if (typeof record.count === "number") return record.count;
  return Array.isArray(record.venues) ? record.venues.length : 0;
}

export function raceForCard(cards: FormfavRacecardsFile, country: FormfavCountryCode, date: string, slug: string, raceNumber: number): FormfavRace | null {
  return cards.cards[cardKey(country, date, slug, raceNumber)] ?? null;
}
