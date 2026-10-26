import type { IndiaHandicapColumn, IndiaHandicapSheet, IndiaMeeting } from "./types";

export const HANDICAP_NOTICE = "This is the published Indiarace handicap, not a racecard and not a STRIDE prediction.";

export const HANDICAP_COLUMN_LABEL: Record<IndiaHandicapColumn, string> = {
  serial: "S No",
  horse: "Horse",
  description: "Desc",
  pedigree: "Pedigree",
  trainer: "Trainer",
  jockey: "Jockey",
  weight: "Wt",
  rating: "Rt",
};

export function preferRacecard<T extends IndiaMeeting, H extends IndiaHandicapSheet>(
  card: T | null,
  handicap: H | null,
): { kind: "racecard"; card: T } | { kind: "handicap"; sheet: H } | null {
  if (card) return { kind: "racecard", card };
  if (handicap) return { kind: "handicap", sheet: handicap };
  return null;
}
