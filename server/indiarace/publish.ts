import fs from "node:fs";
import path from "node:path";
import type { CardSummary, IndiaFixture, IndiaMeeting } from "../../src/stride/types.ts";
import { readHorseStore } from "./horseStatisticsStore.ts";
import { readCard, readIndex } from "./racecardStore.ts";

const dataRoot = path.join(process.cwd(), "public", "data");

export interface MeetingsFile {
  timezone: "Asia/Kolkata";
  fixturesComplete: boolean;
  fixtures: IndiaFixture[];
  cards: Record<string, CardSummary>;
}

export interface RacecardsFile {
  cards: Record<string, IndiaMeeting>;
}

export interface LastUpdatedFile {
  publishedAt: string | null;
  source: "Indiarace";
  sourceUrl: "https://www.indiarace.com/";
  automaticPublishing: boolean;
  note: string;
}

export function publishSnapshot(publishedAt = new Date().toISOString()): LastUpdatedFile {
  const index = readIndex();
  const cards: Record<string, IndiaMeeting> = {};
  for (const [key, summary] of Object.entries(index.cards)) {
    const card = readCard(summary.date, summary.venueId);
    if (card) cards[key] = card;
  }
  const meetings: MeetingsFile = {
    timezone: "Asia/Kolkata",
    fixturesComplete: Boolean(index.fixturesUpdatedAt) && !index.fixturesError,
    fixtures: index.fixtures,
    cards: index.cards,
  };
  const lastUpdated: LastUpdatedFile = {
    publishedAt: Object.keys(cards).length > 0 || meetings.fixturesComplete ? publishedAt : index.lastSuccessfulSync,
    source: "Indiarace",
    sourceUrl: "https://www.indiarace.com/",
    automaticPublishing: true,
    note: "Opening the site loads this published snapshot. A daily publish adds a racecard when Indiarace has one. The page does not contact Indiarace.",
  };
  fs.mkdirSync(dataRoot, { recursive: true });
  write(path.join(dataRoot, "meetings.json"), meetings);
  write(path.join(dataRoot, "racecards.json"), { cards } satisfies RacecardsFile);
  write(path.join(dataRoot, "horse-statistics.json"), readHorseStore());
  write(path.join(dataRoot, "last-updated.json"), lastUpdated);
  return lastUpdated;
}

function write(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value));
}
