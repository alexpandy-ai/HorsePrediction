import fs from "node:fs";
import path from "node:path";
import { cardKey, emptyIndex, type CardSummary, type HandicapSummary, type IndiaHandicapSheet, type IndiaIndex, type IndiaMeeting } from "../../src/stride/types.ts";

const root = path.join(process.cwd(), "public", "data", "indiarace");

export function indexPath(): string {
  return path.join(root, "index.json");
}

export function cardPath(date: string, venueId: string): string {
  return path.join(root, "cards", `${date}-${venueId}.json`);
}

export function handicapPath(date: string, venueId: string): string {
  return path.join(root, "handicaps", `${date}-${venueId}.json`);
}

export function readIndex(): IndiaIndex {
  const file = indexPath();
  if (!fs.existsSync(file)) return emptyIndex();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as IndiaIndex;
    return {
      ...emptyIndex(),
      ...parsed,
      cards: parsed.cards ?? {},
      handicaps: parsed.handicaps ?? {},
      failures: parsed.failures ?? {},
      fixtures: parsed.fixtures ?? [],
    };
  } catch {
    return emptyIndex();
  }
}

export function readCard(date: string, venueId: string): IndiaMeeting | null {
  const file = cardPath(date, venueId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as IndiaMeeting;
  } catch {
    return null;
  }
}

export function writeIndex(index: IndiaIndex): void {
  writeJson(indexPath(), index);
}

export function writeCard(meeting: IndiaMeeting): void {
  writeJson(cardPath(meeting.date, meeting.venueId), meeting);
}

export function readHandicap(date: string, venueId: string): IndiaHandicapSheet | null {
  const file = handicapPath(date, venueId);
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as IndiaHandicapSheet;
    if (!parsed || parsed.kind !== "handicap" || !Array.isArray(parsed.races)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeHandicap(sheet: IndiaHandicapSheet): void {
  writeJson(handicapPath(sheet.date, sheet.venueId), sheet);
}

export function removeHandicap(date: string, venueId: string): void {
  fs.rmSync(handicapPath(date, venueId), { force: true });
}

export function summaryFromHandicap(sheet: IndiaHandicapSheet): HandicapSummary {
  return {
    date: sheet.date,
    venueId: sheet.venueId,
    course: sheet.course,
    state: sheet.state,
    fetchedAt: sheet.fetchedAt,
    raceCount: sheet.raceCount,
    sourceUrl: sheet.sourceUrl,
  };
}

export function summaryFromMeeting(meeting: IndiaMeeting, stale: boolean): CardSummary {
  return {
    date: meeting.date,
    venueId: meeting.venueId,
    course: meeting.course,
    state: meeting.state,
    fetchedAt: meeting.fetchedAt,
    raceCount: meeting.raceCount,
    firstRaceTime: meeting.firstRaceTime,
    lastRaceTime: meeting.lastRaceTime,
    firstRaceMinutes: meeting.firstRaceMinutes,
    sourceStatus: meeting.sourceStatus,
    stale,
    validationNotes: meeting.validationNotes,
  };
}

export function rememberFailure(index: IndiaIndex, date: string, venueId: string, error: string, at: string): IndiaIndex {
  const key = cardKey(date, venueId);
  const previous = index.cards[key];
  return {
    ...index,
    stale: true,
    staleReason: error,
    failures: { ...index.failures, [key]: { at, error } },
    cards: previous ? { ...index.cards, [key]: { ...previous, stale: true } } : index.cards,
  };
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(value, null, 2);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, payload);
  try {
    fs.renameSync(temporary, file);
  } catch {
    fs.writeFileSync(file, payload);
    fs.rmSync(temporary, { force: true });
  }
}
