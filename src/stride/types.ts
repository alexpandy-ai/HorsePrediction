export type RunnerStatus = "Runner" | "Withdrawn";
export type SourceStatus = "verified" | "review";

export interface IndiaRunner {
  id: string;
  horseNumber: number | null;
  horse: string | null;
  sourceHorseId: string | null;
  sourceHorseName: string | null;
  horseProfileUrl: string | null;
  draw: number | null;
  drawText: string | null;
  ageSex: string | null;
  pedigree: string | null;
  trainer: string | null;
  jockey: string | null;
  weight: string | null;
  weightKg: number | null;
  allowance: string | null;
  rating: number | null;
  ratingAside: number | null;
  shoes: string | null;
  equipment: string | null;
  recentForm: string | null;
  status: RunnerStatus;
  review: string[];
}

export interface IndiaRace {
  id: string;
  meetingId: string;
  sourceRaceId: string | null;
  raceNumber: number;
  serial: string | null;
  name: string | null;
  time: string | null;
  timeMinutes: number | null;
  distanceM: number | null;
  distanceLabel: string | null;
  classLabel: string | null;
  conditions: string | null;
  ratingEligibility: string | null;
  runners: IndiaRunner[];
  runnerCount: number;
  sourceSelections: string[];
  drawFlags: string[];
}

export interface IndiaMeeting {
  id: string;
  date: string;
  venueId: string;
  course: string;
  state: string | null;
  sourceUrl: string;
  sourceStatus: SourceStatus;
  fetchedAt: string;
  pageDate: string;
  firstRaceTime: string | null;
  lastRaceTime: string | null;
  firstRaceMinutes: number | null;
  lastRaceMinutes: number | null;
  raceCount: number;
  races: IndiaRace[];
  validationNotes: string[];
}

export interface IndiaFixture {
  date: string;
  venueId: string;
  course: string;
  state: string | null;
}

export interface CardSummary {
  date: string;
  venueId: string;
  course: string;
  state: string | null;
  fetchedAt: string;
  raceCount: number;
  firstRaceTime: string | null;
  lastRaceTime: string | null;
  firstRaceMinutes: number | null;
  sourceStatus: SourceStatus;
  stale: boolean;
  validationNotes: string[];
}

export interface IndiaIndex {
  source: "Indiarace";
  sourceUrl: "https://www.indiarace.com/";
  timezone: "Asia/Kolkata";
  fixturesUpdatedAt: string | null;
  fixturesError: string | null;
  lastSuccessfulSync: string | null;
  stale: boolean;
  staleReason: string | null;
  note: string;
  fixtures: IndiaFixture[];
  cards: Record<string, CardSummary>;
  failures: Record<string, { at: string; error: string }>;
}

export function cardKey(date: string, venueId: string): string {
  return `${date}:${venueId}`;
}

export function emptyIndex(): IndiaIndex {
  return {
    source: "Indiarace",
    sourceUrl: "https://www.indiarace.com/",
    timezone: "Asia/Kolkata",
    fixturesUpdatedAt: null,
    fixturesError: null,
    lastSuccessfulSync: null,
    stale: false,
    staleReason: null,
    note: "No Indiarace snapshot has been published yet.",
    fixtures: [],
    cards: {},
    failures: {},
  };
}
