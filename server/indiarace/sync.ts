import fs from "node:fs";
import path from "node:path";
import { calendarDate } from "../../src/meetings/time.ts";
import { stateForCourse } from "../../src/stride/stateMeetingMapper.ts";
import { cardKey, type IndiaFixture, type IndiaIndex, type IndiaMeeting } from "../../src/stride/types.ts";
import { collectHorseStatistics, horsesOnMeetings } from "./horseStatistics.ts";
import { readHorseStore, writeHorseStore } from "./horseStatisticsStore.ts";
import { validateHandicap } from "./handicapParser.ts";
import { fetchFixtures, fetchHandicaps, fetchHorseStatistics, fetchRacecard } from "./indiaraceClient.ts";
import { validateRacecard } from "./racecardValidator.ts";
import { publishSnapshot } from "./publish.ts";
import { readIndex, rememberFailure, removeHandicap, summaryFromHandicap, summaryFromMeeting, writeCard, writeHandicap, writeIndex } from "./racecardStore.ts";

const IST = "Asia/Kolkata";
/** Indiarace publishes a racecard before that day is "tomorrow". Today plus the next three calendar days. */
const RACECARD_LOOKAHEAD_DAYS = 3;
let running = false;

export function indiaraceSyncDates(today: string): string[] {
  return Array.from({ length: RACECARD_LOOKAHEAD_DAYS + 1 }, (_, offset) => shiftDate(today, offset));
}

/** A stored racecard always wins. A handicap sheet is read only when that date has no racecard page. */
export function shouldReadHandicap(hasStoredRacecard: boolean, racecardError: string | null): boolean {
  if (hasStoredRacecard || !racecardError) return false;
  return racecardError.includes("did not include a meeting heading") || racecardError.includes("did not include any races");
}

export async function syncIndiarace(options: { dates?: string[]; force?: boolean } = {}): Promise<IndiaIndex> {
  if (running) return readIndex();
  running = true;
  try {
    return await runSync(options);
  } finally {
    running = false;
  }
}

export async function syncIndiaraceIfDue(now = new Date()): Promise<void> {
  const index = readIndex();
  const fixturesAge = age(index.fixturesUpdatedAt, now);
  const hour = istHour(now);
  const cardLimit = hour >= 10 && hour < 20 ? 2 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
  const dates = indiaraceSyncDates(calendarDate(IST, now));
  const cardsDue = dates.some((date) => {
    const cards = Object.values(index.cards).filter((card) => card.date === date);
    return cards.length === 0 || cards.some((card) => age(card.fetchedAt, now) > cardLimit);
  });
  if (fixturesAge > 30 * 60 * 1000 || cardsDue) await syncIndiarace({ dates });
}

export function importRacecardFile(file: string, venueId: string, date: string): IndiaIndex {
  const html = fs.readFileSync(file, "utf8");
  const fetchedAt = new Date().toISOString();
  const validated = validateRacecard(html, venueId, date, `file://${path.resolve(file)}`, fetchedAt);
  let index = readIndex();
  if (!validated.meeting) return rememberFailure(index, date, venueId, validated.error ?? "The saved racecard could not be validated.", fetchedAt);
  writeCard(validated.meeting);
  removeHandicap(date, venueId);
  const key = cardKey(date, venueId);
  const failures = { ...index.failures };
  delete failures[key];
  const handicaps = { ...(index.handicaps ?? {}) };
  delete handicaps[key];
  index = {
    ...index,
    lastSuccessfulSync: fetchedAt,
    stale: false,
    staleReason: null,
    note: "Imported from a saved Indiarace racecard file.",
    failures,
    handicaps,
    cards: { ...index.cards, [key]: summaryFromMeeting(validated.meeting, false) },
    fixtures: upsertFixture(index.fixtures, {
      date,
      venueId,
      course: validated.meeting.course,
      state: validated.meeting.state,
    }),
  };
  writeIndex(index);
  publishSnapshot(fetchedAt);
  return index;
}

async function runSync(options: { dates?: string[]; force?: boolean }): Promise<IndiaIndex> {
  const now = new Date();
  const fetchedAt = now.toISOString();
  let index = readIndex();
  const today = calendarDate(IST, now);
  const dates = options.dates?.length ? options.dates : indiaraceSyncDates(today);
  try {
    const fixtures = await fetchFixtures();
    index = {
      ...index,
      fixturesUpdatedAt: fetchedAt,
      fixturesError: null,
      fixtures: fixtures.map((fixture) => ({
        date: fixture.date,
        venueId: fixture.venueId,
        course: titleCase(fixture.course),
        state: stateForCourse(fixture.course),
      })),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Indiarace fixtures could not be loaded.";
    index = { ...index, stale: true, staleReason: message, fixturesError: message };
    writeIndex(index);
    return index;
  }

  const wanted = index.fixtures.filter((fixture) => dates.includes(fixture.date));
  const refreshed: IndiaMeeting[] = [];
  for (const fixture of wanted) {
    const key = cardKey(fixture.date, fixture.venueId);
    const previous = index.cards[key];
    if (!options.force && previous && !previous.stale && age(previous.fetchedAt, now) < 30 * 60 * 1000) continue;
    try {
      const card = await fetchRacecard(fixture.venueId, fixture.date);
      const validated = validateRacecard(card.html, fixture.venueId, fixture.date, card.url, fetchedAt);
      if (validated.meeting) {
        writeCard(validated.meeting);
        removeHandicap(fixture.date, fixture.venueId);
        refreshed.push(validated.meeting);
        const failures = { ...index.failures };
        delete failures[key];
        const handicaps = { ...(index.handicaps ?? {}) };
        delete handicaps[key];
        index = {
          ...index,
          failures,
          handicaps,
          note: "Racecards were read from the public Indiarace pages.",
          cards: { ...index.cards, [key]: summaryFromMeeting(validated.meeting, false) },
        };
        continue;
      }
      const racecardError = validated.error ?? "The racecard could not be validated.";
      if (!shouldReadHandicap(Boolean(previous), racecardError)) {
        index = rememberFailure(index, fixture.date, fixture.venueId, racecardError, fetchedAt);
        continue;
      }
      index = await readHandicapFallback(index, fixture, fetchedAt, racecardError);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The racecard request failed.";
      index = rememberFailure(index, fixture.date, fixture.venueId, message, fetchedAt);
    }
  }
  const dateFailures = Object.entries(index.failures).filter(([key]) => dates.some((date) => key.startsWith(`${date}:`)));
  index = {
    ...index,
    lastSuccessfulSync: fetchedAt,
    stale: dateFailures.length > 0,
    staleReason: dateFailures[0]?.[1].error ?? null,
    note: index.note || "The fixture list was read from Indiarace.",
  };
  writeIndex(index);
  publishSnapshot(fetchedAt);
  try {
    const horses = horsesOnMeetings(refreshed);
    if (horses.length > 0) {
      writeHorseStore(await collectHorseStatistics(horses, readHorseStore(), fetchHorseStatistics, fetchedAt));
      publishSnapshot(fetchedAt);
    }
  } catch {
    // A horse-statistics failure must not drop the racecards already published above.
  }
  return index;
}

async function readHandicapFallback(index: IndiaIndex, fixture: IndiaFixture, fetchedAt: string, racecardError: string): Promise<IndiaIndex> {
  const key = cardKey(fixture.date, fixture.venueId);
  try {
    const page = await fetchHandicaps(fixture.venueId, fixture.date);
    const validated = validateHandicap(page.html, fixture.venueId, fixture.date, page.url, fetchedAt);
    if (!validated.sheet) return rememberFailure(index, fixture.date, fixture.venueId, racecardError, fetchedAt);
    writeHandicap(validated.sheet);
    const failures = { ...index.failures };
    delete failures[key];
    return {
      ...index,
      failures,
      handicaps: { ...(index.handicaps ?? {}), [key]: summaryFromHandicap(validated.sheet) },
      note: "Where Indiarace has not published a racecard, the handicap sheet is shown until the racecard arrives.",
    };
  } catch {
    return rememberFailure(index, fixture.date, fixture.venueId, racecardError, fetchedAt);
  }
}

function upsertFixture(fixtures: IndiaFixture[], fixture: IndiaFixture): IndiaFixture[] {
  const rest = fixtures.filter((item) => !(item.date === fixture.date && item.venueId === fixture.venueId));
  return [...rest, fixture];
}

function age(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return now.getTime() - new Date(iso).getTime();
}

function istHour(now: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
}

function shiftDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
