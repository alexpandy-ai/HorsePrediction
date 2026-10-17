import { stateForCourse } from "../../src/stride/stateMeetingMapper.ts";
import type { IndiaMeeting, IndiaRace, IndiaRunner, RunnerStatus } from "../../src/stride/types.ts";

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

export interface ParsedCard {
  course: string;
  pageDate: string;
  races: IndiaRace[];
}

export function parseRacecard(html: string, venueId: string, sourceUrl: string, fetchedAt: string): ParsedCard | null {
  const heading = html.match(/Race Card\s*-\s*([A-Za-z][A-Za-z .'-]*?)\s*-\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (!heading) return null;
  const course = titleCase(heading[1].trim());
  const pageDate = parseHeadingDate(heading[2]);
  if (!pageDate) return null;
  const meetingId = `ir-${venueId}-${pageDate}`;
  const races: IndiaRace[] = [];
  const blocks = html.matchAll(/<div id="race-(\d+)">([\s\S]*?)(?=<div id="race-\d+">|$)/gi);
  for (const block of blocks) {
    const raceNumber = Number(block[1]);
    if (!Number.isInteger(raceNumber)) continue;
    races.push(parseRace(block[2], meetingId, venueId, pageDate, raceNumber));
  }
  return { course, pageDate, races };
}

export function meetingFromParsed(parsed: ParsedCard, venueId: string, sourceUrl: string, fetchedAt: string): IndiaMeeting {
  const races = parsed.races.slice().sort((a, b) => {
    const aTime = a.timeMinutes ?? Number.POSITIVE_INFINITY;
    const bTime = b.timeMinutes ?? Number.POSITIVE_INFINITY;
    if (aTime !== bTime) return aTime - bTime;
    return a.raceNumber - b.raceNumber;
  });
  const timed = races.filter((race) => race.time && race.timeMinutes != null);
  const notes = races.flatMap((race) => race.drawFlags);
  return {
    id: `ir-${venueId}-${parsed.pageDate}`,
    date: parsed.pageDate,
    venueId,
    course: parsed.course,
    state: stateForCourse(parsed.course),
    sourceUrl,
    sourceStatus: notes.length > 0 ? "review" : "verified",
    fetchedAt,
    pageDate: parsed.pageDate,
    firstRaceTime: timed[0]?.time ?? null,
    lastRaceTime: timed[timed.length - 1]?.time ?? null,
    firstRaceMinutes: timed[0]?.timeMinutes ?? null,
    lastRaceMinutes: timed[timed.length - 1]?.timeMinutes ?? null,
    raceCount: races.length,
    races,
    validationNotes: notes,
  };
}

function parseRace(block: string, meetingId: string, venueId: string, date: string, raceNumber: number): IndiaRace {
  const name = textOf(block.match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? "");
  const conditions = textOf(block.match(/<div class="center_heading">[\s\S]*?<h3>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
  const serial = textOf(block.match(/<h5>\s*\(?\s*([^<)]+?)\s*\)?\s*<\/h5>/i)?.[1] ?? "");
  const clocks = [...block.matchAll(/<div class="archive_time">([\s\S]*?)<\/div>/gi)].flatMap((match) =>
    [...match[1].matchAll(/<h4>([\s\S]*?)<\/h4>/gi)].map((item) => textOf(item[1])),
  );
  const distanceLabel = clocks.find((item) => /\d/.test(item) && /m/i.test(item)) ?? null;
  const time = clocks.find((item) => /\b(AM|PM)\b/i.test(item)) ?? null;
  const distanceMatch = distanceLabel?.match(/(\d+(?:\.\d+)?)/);
  const sourceRaceId = block.match(/previousRunsWithTrack\/(\d+)/i)?.[1] ?? null;
  const classMatch = conditions.match(/class\s+[0-9]+/i);
  const ratedMatch = conditions.match(/horses rated\s+(.+)$/i);
  const runners = [...block.matchAll(/<tr class="dividend_tr"([^>]*)>([\s\S]*?)<\/tr>/gi)].map((row, index) =>
    parseRunner(row[1], row[2], `ir-${venueId}-${date}-${raceNumber}`, index),
  );
  const drawFlags = drawReviews(runners, raceNumber);
  return {
    id: `ir-${venueId}-${date}-${raceNumber}`,
    meetingId,
    sourceRaceId,
    raceNumber,
    serial: serial || null,
    name: name || null,
    time,
    timeMinutes: time ? clockToMinutes(time) : null,
    distanceM: distanceMatch ? Number(distanceMatch[1]) : null,
    distanceLabel,
    classLabel: classMatch ? titleCase(classMatch[0]) : null,
    conditions: conditions || null,
    ratingEligibility: ratedMatch ? `Horses rated ${ratedMatch[1]}` : null,
    runners,
    runnerCount: runners.length,
    sourceSelections: selections(block),
    drawFlags,
  };
}

function parseRunner(trAttrs: string, row: string, raceId: string, index: number): IndiaRunner {
  const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
  const numberCell = cells[0] ?? "";
  const drawMatch = numberCell.match(/<span[^>]*>\s*\(([^)]*)\)\s*<\/span>/i);
  const horseNumberText = textOf(numberCell.replace(/<span[\s\S]*?<\/span>/gi, " "));
  const horseNumber = integer(horseNumberText);
  const drawText = drawMatch ? textOf(drawMatch[1]) : null;
  const draw = drawText != null && /^\d+$/.test(drawText) ? Number(drawText) : null;
  const horseCell = cells[2] ?? "";
  const horse = anchor(horseCell, "horseStatistics");
  const sire = anchor(horseCell, "allSireDetails");
  const dam = anchor(horseCell, "allDamDetails");
  const formRaw = textOf(horseCell.match(/last-five-runs-lable">([\s\S]*?)<\/span>/i)?.[1] ?? "");
  const jockey = anchor(cells[6] ?? "", "jokeyStatisticsdata") ?? textOf(cells[6] ?? "");
  const trainer = anchor(cells[5] ?? "", "trainerStatisticsdata") ?? textOf(cells[5] ?? "");
  const withdrawn = /ffb6c1/i.test(trAttrs) || /^withdrawn$/i.test(jockey);
  const ratingCell = cells[11] ?? "";
  const asideMatch = ratingCell.match(/<sup>\s*<small>\s*([\d.]+)\s*<\/small>\s*<\/sup>/i);
  const ratingText = textOf(ratingCell.replace(/<sup>[\s\S]*?<\/sup>/gi, " "));
  const review: string[] = [];
  if (drawText == null) review.push("Draw was not printed.");
  else if (drawText === "") review.push("Draw was printed blank.");
  else if (draw == null) review.push(`Draw text could not be read (${drawText}).`);
  else if (draw < 1) review.push(`Draw ${draw} is outside the printed stall numbers.`);
  if (horseNumber == null) review.push("Horse number was not printed.");
  const status: RunnerStatus = withdrawn ? "Withdrawn" : "Runner";
  return {
    id: `${raceId}-h${horseNumber ?? `x${index + 1}`}`,
    horseNumber,
    horse: horse || null,
    draw,
    drawText,
    ageSex: textOf(cells[3] ?? "") || null,
    pedigree: sire || dam ? [sire, dam].filter(Boolean).join(" - ") : null,
    trainer: trainer || null,
    jockey: jockey || null,
    weight: textOf(cells[7] ?? "") || null,
    weightKg: numberOrNull(textOf(cells[7] ?? "")),
    allowance: textOf(cells[8] ?? "") || null,
    rating: numberOrNull(ratingText),
    ratingAside: asideMatch ? Number(asideMatch[1]) : null,
    shoes: textOf(cells[9] ?? "") || null,
    equipment: textOf(cells[10] ?? "") || null,
    recentForm: formRaw.replace(/\.$/, "").trim() || null,
    status,
    review,
  };
}

function drawReviews(runners: IndiaRunner[], raceNumber: number): string[] {
  const flags = runners.flatMap((runner) =>
    runner.review.map((note) => `Race ${raceNumber}, horse ${runner.horseNumber ?? "—"} ${runner.horse ?? ""}: ${note}`.replace(/\s+/g, " ").trim()),
  );
  const seen = new Map<number, string[]>();
  for (const runner of runners) {
    if (runner.draw == null) continue;
    const names = seen.get(runner.draw) ?? [];
    names.push(runner.horse ?? `horse ${runner.horseNumber ?? "—"}`);
    seen.set(runner.draw, names);
  }
  for (const [draw, names] of seen) {
    if (names.length > 1) flags.push(`Race ${raceNumber} draw ${draw} is printed for ${names.join(" and ")}.`);
  }
  return flags;
}

function selections(block: string): string[] {
  const box = block.match(/INDIARACE SELECTIONS\s*:([\s\S]*?)<\/p>/i)?.[1] ?? "";
  return [...box.matchAll(/<span>([\s\S]*?)<\/span>/gi)].map((match) => textOf(match[1])).filter(Boolean);
}

export function clockToMinutes(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = match[3].toUpperCase();
  if (minute > 59 || hour < 1 || hour > 12) return null;
  if (suffix === "PM" && hour !== 12) hour += 12;
  if (suffix === "AM" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function parseHeadingDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2].toLowerCase()];
  const day = Number(match[1]);
  const year = Number(match[3]);
  if (!month || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function textOf(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function anchor(html: string, hrefPart: string): string | null {
  const match = html.match(new RegExp(`<a\\b[^>]*href="[^"]*${hrefPart}[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`, "i"));
  const text = match ? textOf(match[1]) : "";
  return text || null;
}

function integer(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function numberOrNull(value: string): number | null {
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
