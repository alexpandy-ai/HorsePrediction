export interface HorseStart {
  date: string | null;
  venue: string | null;
  distance: string | null;
  raceClass: string | null;
  raceNumber: string | null;
  finish: string | null;
  jockey: string | null;
  weight: string | null;
  winningMargin: string | null;
  time: string | null;
  rating: string | null;
}

export interface HorseCareer {
  runs: string | null;
  wins: string | null;
  second: string | null;
  third: string | null;
  fourth: string | null;
  earnings: string | null;
}

export interface HorseCareerLabels {
  runs: string | null;
  wins: string | null;
  second: string | null;
  third: string | null;
  fourth: string | null;
  earnings: string | null;
}

export interface HorseProfile {
  id: string;
  name: string;
  ageColourSex: string | null;
  sire: string | null;
  dam: string | null;
  rating: string | null;
  trainer: string | null;
  bredAt: string | null;
  owner: string | null;
  previousOwner: string | null;
  career: HorseCareer | null;
  careerLabels: HorseCareerLabels | null;
  starts: HorseStart[];
  sourceUrl: string;
  fetchedAt: string;
}

export interface UnavailableHorse {
  id: string;
  name: string;
  unavailable: true;
  sourceUrl: string;
  fetchedAt: string;
}

export type HorseRecord = HorseProfile | UnavailableHorse;

export interface HorseStatisticsFile {
  source: "Indiarace";
  sourceUrl: "https://www.indiarace.com/";
  horses: Record<string, HorseRecord>;
}

export function emptyHorseStatistics(): HorseStatisticsFile {
  return {
    source: "Indiarace",
    sourceUrl: "https://www.indiarace.com/",
    horses: {},
  };
}

export function horseStatisticsUrl(id: string, name: string): string {
  return `https://www.indiarace.com/Home/horseStatistics/${id}/${encodeURIComponent(name)}`;
}

export function indiaHorseHash(id: string | null | undefined, name: string | null | undefined): string | null {
  if (!id || !name || !/^\d+$/.test(id)) return null;
  return `#/horse/${id}/${encodeURIComponent(name)}`;
}

export function isUnavailableHorse(record: HorseRecord): record is UnavailableHorse {
  return record.unavailable === true;
}

export function dash(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const text = String(value).trim();
  return text ? text : "—";
}
