export type RaceStatus = "Upcoming" | "Delayed" | "Live" | "Finished" | "Abandoned" | "Cancelled";

export type SourceState = "ok" | "failed" | "unconfigured" | "unsupported";

export interface SourceReport {
  id: string;
  name: string;
  state: SourceState;
  detail: string;
}

export interface PriceQuote {
  bookmaker: string;
  winPrice: number | null;
  placePrice: number | null;
  quotedAt: string | null;
  ageSeconds: number | null;
  stale: boolean | null;
}

export interface WireRunner {
  id: string;
  number: string | null;
  name: string;
  draw: string | null;
  age: string | null;
  sex: string | null;
  weight: string | null;
  officialRating: string | null;
  form: string | null;
  daysSince: number | null;
  jockey: string | null;
  trainer: string | null;
  headgear: string | null;
  scratched?: boolean;
  position?: number | null;
  quotes?: PriceQuote[];
}

export interface WireRace {
  id: string;
  name: string;
  raceNumber: string | null;
  course: string;
  courseId: string;
  countryCode: string;
  countryName: string;
  flag: string;
  region: string;
  timezone: string | null;
  meetingDate: string;
  localDate: string;
  localDateVerified: boolean;
  startInstant: string | null;
  publishedOffTime: string | null;
  distance: string | null;
  raceClass: string | null;
  surface: string | null;
  going: string | null;
  status: RaceStatus;
  rawStatus: string;
  source: string;
  runners: WireRunner[];
  providerId?: string;
  provider?: string;
  quotes?: PriceQuote[];
  oddsStale?: boolean | null;
  oddsAgeSeconds?: number | null;
  freshestAgeSeconds?: number | null;
}

export interface MeetingsPayload {
  requestedDate: string;
  mode: "schedule" | "outside-window" | "unavailable";
  message: string | null;
  lastUpdated: string | null;
  stale: boolean;
  staleReason: string | null;
  sources: SourceReport[];
  coverage: SourceReport[];
  races: WireRace[];
  window?: { minDate: string; maxDate: string; note: string };
  nextToGo?: WireRace[];
  budgetNote?: string | null;
}
