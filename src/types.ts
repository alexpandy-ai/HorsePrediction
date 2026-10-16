export const COUNTRY_IDS = ["india", "australia", "south-africa", "uk"] as const;

export type CountryId = (typeof COUNTRY_IDS)[number];

export function isCountry(value: string): value is CountryId {
  return (COUNTRY_IDS as readonly string[]).includes(value);
}

export type Sex = "C" | "H" | "G" | "F" | "M";
export type PaceStyle = "Leader" | "Prominent" | "Midfield" | "Closer";
export type Discipline = "Flat" | "Jumps" | "Mixed";

export interface RecordSplit {
  runs: number;
  wins: number;
  places: number;
}

export interface Country {
  id: CountryId;
  name: string;
}

export interface Course {
  id: string;
  countryId: CountryId;
  shortName: string;
  name: string;
  city: string;
  surface: string;
  circuit: string;
  discipline: Discipline;
  about: string;
  note?: string;
}

export interface Meeting {
  id: string;
  courseId: string;
  date: string;
  going: string;
  weather: string;
  rail: string;
}

export interface Race {
  id: string;
  meetingId: string;
  countryId: CountryId;
  number: number;
  name: string;
  time: string;
  distanceM: number;
  distanceLabel: string;
  type: string;
  classLabel: string;
  classLevel: number;
  prize: string;
  weightBasis: "handicap" | "set";
  feature: boolean;
}

export interface Runner {
  id: string;
  raceId: string;
  number: number;
  name: string;
  draw: number;
  handicapKg: number;
  age: number;
  sex: Sex;
  trainer: string;
  jockey: string;
  claimKg: number;
  officialRating: number | null;
  form: string;
  daysSince: number | null;
  equipment: string;
  nonRunner: boolean;
  paceStyle: PaceStyle;
  lastClassLabel: string | null;
  lastClassLevel: number | null;
  lastWeightKg: number | null;
  lastOfficialRating: number | null;
  distanceRecord: RecordSplit;
  courseRecord: RecordSplit;
  goingRecord: RecordSplit;
  recentSpeed: number[];
  publishedSpeed: number | null;
}

export interface PastResult {
  courseId: string;
  date: string;
  raceName: string;
  distanceLabel: string;
  going: string;
  winner: string;
  field: number;
  time: string;
}
