import { stateForCourse } from "../../src/stride/stateMeetingMapper.ts";
import type {
  IndiaHandicapColumn,
  IndiaHandicapRace,
  IndiaHandicapRunner,
  IndiaHandicapSheet,
} from "../../src/stride/types.ts";
import { extractHorseProfileLink, parseHeadingDate } from "./racecardParser.ts";

const HEADERS: Record<string, IndiaHandicapColumn> = {
  "s no": "serial",
  sno: "serial",
  "horse name": "horse",
  horse: "horse",
  desc: "description",
  pedigree: "pedigree",
  trainer: "trainer",
  jockey: "jockey",
  wt: "weight",
  weight: "weight",
  rt: "rating",
  rating: "rating",
};

export interface HandicapValidation {
  sheet: IndiaHandicapSheet | null;
  error: string | null;
}

export function validateHandicap(
  html: string,
  venueId: string,
  requestedDate: string,
  sourceUrl: string,
  fetchedAt: string,
): HandicapValidation {
  const heading = headingOf(html);
  if (!heading) return { sheet: null, error: "The handicaps page did not include a meeting heading." };
  if (heading.pageDate !== requestedDate) {
    return { sheet: null, error: `Indiarace returned handicaps for ${heading.pageDate} for a ${requestedDate} request.` };
  }
  const races = racesOf(html, venueId, heading.pageDate);
  if (races.length === 0) return { sheet: null, error: "The handicaps page did not include any races." };
  const notes = races.flatMap((race) =>
    race.runners.flatMap((runner, index) =>
      runner.horse ? [] : [`Handicap ${race.order}, entry ${runner.serial ?? index + 1}: horse name was not printed.`],
    ),
  );
  return {
    sheet: {
      kind: "handicap",
      id: `ir-${venueId}-${heading.pageDate}-handicap`,
      date: heading.pageDate,
      venueId,
      course: heading.course,
      state: stateForCourse(heading.course),
      sourceUrl,
      fetchedAt,
      pageDate: heading.pageDate,
      raceDay: raceDayOf(html),
      raceCount: races.length,
      races,
      notes,
    },
    error: null,
  };
}

function headingOf(html: string): { course: string; pageDate: string } | null {
  const headings = html.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/gi) ?? [];
  for (const heading of headings) {
    const text = textOf(heading.replace(/<!--[\s\S]*?-->/g, " "));
    const match = text.match(/Handicaps\s*-\s*(.+?)\s*-\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
    if (!match) continue;
    const pageDate = parseHeadingDate(match[2]);
    const course = titleCase(match[1]);
    if (!pageDate || !course) continue;
    return { course, pageDate };
  }
  return null;
}

function raceDayOf(html: string): string | null {
  const block = html.match(/class="race_day_div"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
  return textOf(block) || null;
}

function racesOf(html: string, venueId: string, date: string): IndiaHandicapRace[] {
  const blocks = [...html.matchAll(/<div class="handicap_div_ind">([\s\S]*?)(?=<div class="handicap_div_ind">|$)/gi)];
  const races: IndiaHandicapRace[] = [];
  for (const block of blocks) {
    const source = block[1];
    const name = textOf(source.match(/<div class="tit_cont">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)?.[1] ?? "") || null;
    const conditions = textOf(source.match(/<div class="tit_cont">[\s\S]*?<h4>([\s\S]*?)<\/h4>/i)?.[1] ?? "") || null;
    const distanceLabel = textOf(source.match(/<div class="collapse_handicap">[\s\S]*?<h4>([\s\S]*?)<\/h4>/i)?.[1] ?? "") || null;
    const columns = columnsOf(source);
    const runners = columns.length ? runnersOf(source, columns, venueId, date, races.length + 1) : [];
    if (!name && !distanceLabel && runners.length === 0) continue;
    const order = races.length + 1;
    const id = `ir-${venueId}-${date}-handicap-${order}`;
    races.push({
      id,
      order,
      name,
      conditions,
      distanceLabel,
      distanceM: distanceMetres(distanceLabel),
      columns,
      runners: runners.map((runner, index) => ({ ...runner, id: `${id}-s${runner.serial ?? index + 1}` })),
      runnerCount: runners.length,
    });
  }
  return races;
}

function columnsOf(block: string): IndiaHandicapColumn[] {
  const head = block.match(/<thead[\s\S]*?<\/thead>/i)?.[0] ?? "";
  const labels = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((cell) => textOf(cell[1]).toLowerCase());
  const columns: IndiaHandicapColumn[] = [];
  for (const label of labels) {
    const column = HEADERS[label];
    if (column && !columns.includes(column)) columns.push(column);
  }
  return columns;
}

function runnersOf(block: string, columns: IndiaHandicapColumn[], venueId: string, date: string, order: number): IndiaHandicapRunner[] {
  const body = block.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] ?? "";
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const runners: IndiaHandicapRunner[] = [];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length === 0) continue;
    const read = (column: IndiaHandicapColumn) => {
      const index = columns.indexOf(column);
      if (index < 0) return null;
      return textOf(cells[index] ?? "") || null;
    };
    const horseCell = columns.includes("horse") ? cells[columns.indexOf("horse")] ?? "" : "";
    const profile = horseCell ? extractHorseProfileLink(horseCell) : null;
    const serial = wholeNumber(read("serial"));
    const horse = read("horse") || profile?.horseName || null;
    const description = read("description");
    const pedigree = read("pedigree");
    const trainer = read("trainer");
    const jockey = read("jockey");
    const weight = read("weight");
    const rating = decimal(read("rating"));
    if (serial == null && !horse && !description && !pedigree && !trainer && !jockey && !weight && rating == null) continue;
    runners.push({
      id: `ir-${venueId}-${date}-handicap-${order}-row${runners.length + 1}`,
      serial,
      horse,
      sourceHorseId: profile?.horseId ?? null,
      sourceHorseName: profile?.horseName ?? null,
      horseProfileUrl: profile?.horseProfileUrl ?? null,
      description,
      pedigree,
      trainer,
      jockey,
      weight,
      weightKg: decimal(weight),
      rating,
    });
  }
  return runners;
}

function distanceMetres(label: string | null): number | null {
  const match = label?.match(/(\d+(?:\.\d+)?)\s*m\b/i);
  return match ? Number(match[1]) : null;
}

function wholeNumber(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function decimal(value: string | null): number | null {
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  return Number(value);
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
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
