import type { FormfavCountryCode } from "./countries";
import type { FormfavPlan } from "./catalogue";

export interface FormfavStatLine {
  starts: number | null;
  wins: number | null;
  seconds: number | null;
  thirds: number | null;
  places: number | null;
  winPercent: number | null;
  placePercent: number | null;
}

export interface FormfavRunner {
  horseNumber: number | null;
  name: string | null;
  barrier: number | null;
  jockey: string | null;
  trainer: string | null;
  weightKg: number | null;
  claimKg: number | null;
  age: number | null;
  sex: string | null;
  form: string | null;
  last20Starts: string | null;
  scratched: boolean;
  stats: {
    overall: FormfavStatLine | null;
    track: FormfavStatLine | null;
    distance: FormfavStatLine | null;
    trackDistance: FormfavStatLine | null;
    condition: FormfavStatLine | null;
    firstUp: FormfavStatLine | null;
    secondUp: FormfavStatLine | null;
  };
  speedMap: { runningStyle: string | null; earlySpeedIndex: number | null; settlingPosition: number | null } | null;
  classRating: number | null;
  classDifference: number | null;
  decorators: { label: string; detail: string | null }[];
  prediction: { winProb: number; placeProb: number; modelRank: number | null } | null;
  fixedWin: number | null;
}

export interface FormfavRace {
  raceNumber: number;
  raceName: string | null;
  distance: string | null;
  condition: string | null;
  weather: string | null;
  raceClass: string | null;
  prizeMoney: string | null;
  abandoned: boolean;
  startTime: string | null;
  timezone: string | null;
  numberOfRunners: number | null;
  runners: FormfavRunner[];
  runnersIncluded: boolean;
}

export interface FormfavMeeting {
  country: FormfavCountryCode;
  track: string;
  slug: string;
  date: string;
  abandoned: boolean;
  region: "Region unavailable";
  source: "FormFav";
  races: FormfavRace[];
}

export interface FormfavDateSlice {
  confirmed: boolean;
  fetchedAt: string | null;
  empty: boolean;
  error: string | null;
  meetings: FormfavMeeting[];
}

export interface FormfavMeetingsFile {
  country: FormfavCountryCode;
  source: "FormFav";
  region: "Region unavailable";
  dates: Record<string, FormfavDateSlice>;
}

export interface FormfavRacecardsFile {
  cards: Record<string, FormfavRace & { country: FormfavCountryCode; date: string; slug: string; track: string }>;
}

export interface FormfavCountryStatus {
  coverage: "unknown" | "venues-listed" | "no-gallops-venues";
  venueCount: number | null;
  note: string;
}

export interface FormfavImportStatus {
  source: "FormFav";
  sourceUrl: "https://api.formfav.com";
  configured: boolean;
  plan: FormfavPlan | "unknown";
  generatedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  requestsUsed: number;
  countries: Record<FormfavCountryCode, FormfavCountryStatus>;
  planNote: string;
}

export function cardKey(country: FormfavCountryCode, date: string, slug: string, raceNumber: number): string {
  return `${country}:${date}:${slug}:${raceNumber}`;
}
