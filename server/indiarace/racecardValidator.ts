import { meetingFromParsed, parseRacecard } from "./racecardParser.ts";
import type { IndiaMeeting } from "../../src/stride/types.ts";

export interface ValidationResult {
  meeting: IndiaMeeting | null;
  error: string | null;
}

export function validateRacecard(html: string, venueId: string, requestedDate: string, sourceUrl: string, fetchedAt: string): ValidationResult {
  const parsed = parseRacecard(html, venueId, sourceUrl, fetchedAt);
  if (!parsed) return { meeting: null, error: "The racecard page did not include a meeting heading." };
  if (parsed.pageDate !== requestedDate) {
    return { meeting: null, error: `Indiarace returned ${parsed.pageDate} for a ${requestedDate} request.` };
  }
  if (parsed.races.length === 0) return { meeting: null, error: "The racecard page did not include any races." };
  const meeting = meetingFromParsed(parsed, venueId, sourceUrl, fetchedAt);
  const notes = [...meeting.validationNotes];
  for (const race of meeting.races) {
    if (!race.name) notes.push(`Race ${race.raceNumber} has no race name.`);
    if (!race.time) notes.push(`Race ${race.raceNumber} has no scheduled time.`);
    if (race.distanceM == null) notes.push(`Race ${race.raceNumber} has no distance.`);
    const numbers = race.runners.map((runner) => runner.horseNumber).filter((number): number is number => number != null);
    const unique = new Set(numbers);
    if (unique.size !== numbers.length) notes.push(`Race ${race.raceNumber} repeats a horse number.`);
  }
  return {
    meeting: { ...meeting, validationNotes: notes, sourceStatus: notes.length > 0 ? "review" : "verified" },
    error: null,
  };
}
