import type { IndiaMeeting } from "../../src/stride/types.ts";
import {
  emptyHorseStatistics,
  horseStatisticsUrl,
  type HorseCareer,
  type HorseCareerLabels,
  type HorseProfile,
  type HorseStart,
  type HorseStatisticsFile,
  type UnavailableHorse,
} from "../../src/stride/horseStatistics.ts";

type CareerKey = keyof HorseCareer;

export function horsesOnMeetings(meetings: IndiaMeeting[]): { id: string; name: string }[] {
  const horses = new Map<string, { id: string; name: string }>();
  for (const meeting of meetings) {
    for (const race of meeting.races) {
      for (const runner of race.runners) {
        if (!runner.sourceHorseId || !runner.sourceHorseName || !/^\d+$/.test(runner.sourceHorseId)) continue;
        if (!horses.has(runner.sourceHorseId)) horses.set(runner.sourceHorseId, { id: runner.sourceHorseId, name: runner.sourceHorseName });
      }
    }
  }
  return [...horses.values()];
}

export function parseHorseStatistics(html: string, id: string, requestedName: string, fetchedAt: string): HorseProfile | null {
  const tableIndex = html.search(/<table\b[^>]*class="horseStatistics-table"/i);
  if (tableIndex < 0) return null;
  const before = html.slice(Math.max(0, tableIndex - 1200), tableIndex);
  const headings = [...before.matchAll(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi)];
  const name = textOf(headings.at(-1)?.[1] ?? "");
  if (!name || !sameName(name, requestedName)) return null;
  const table = html.slice(tableIndex).match(/<table\b[^>]*class="horseStatistics-table"[^>]*>([\s\S]*?)<\/table>/i)?.[1] ?? "";
  const fields = labeledFields(table);
  const careerTable = tableContaining(html, /No\.\s*of\s*Runs/i);
  const career = careerTable ? careerFrom(careerTable) : null;
  return {
    id,
    name,
    ageColourSex: textOrNull(table.match(/<h5\b[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? ""),
    sire: anchorText(table, "allSireDetails"),
    dam: anchorText(table, "allDamDetails"),
    rating: fields.get("rating") ?? null,
    trainer: fields.get("trainer") ?? null,
    bredAt: fields.get("bred at") ?? null,
    owner: fields.get("owner") ?? null,
    previousOwner: fields.get("previous owner") ?? null,
    career: career?.values ?? null,
    careerLabels: career?.labels ?? null,
    starts: startHistory(html),
    sourceUrl: horseStatisticsUrl(id, requestedName),
    fetchedAt,
  };
}

export async function collectHorseStatistics(
  horses: { id: string; name: string }[],
  previous: HorseStatisticsFile,
  fetchPage: (id: string, name: string) => Promise<string>,
  fetchedAt: string,
): Promise<HorseStatisticsFile> {
  const next: HorseStatisticsFile = { ...emptyHorseStatistics(), horses: { ...previous.horses } };
  const seen = new Set<string>();
  for (const horse of horses) {
    if (seen.has(horse.id)) continue;
    seen.add(horse.id);
    const sourceUrl = horseStatisticsUrl(horse.id, horse.name);
    try {
      const html = await fetchPage(horse.id, horse.name);
      next.horses[horse.id] = parseHorseStatistics(html, horse.id, horse.name, fetchedAt) ?? unavailable(horse, sourceUrl, fetchedAt);
    } catch {
      next.horses[horse.id] = unavailable(horse, sourceUrl, fetchedAt);
    }
  }
  return next;
}

function unavailable(horse: { id: string; name: string }, sourceUrl: string, fetchedAt: string): UnavailableHorse {
  return { id: horse.id, name: horse.name, unavailable: true, sourceUrl, fetchedAt };
}

function careerFrom(table: string): { values: HorseCareer; labels: HorseCareerLabels } | null {
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const headerIndex = rows.findIndex((row) => /<th\b/i.test(row[1]) && /No\.\s*of\s*Runs/i.test(row[1]));
  const header = headerIndex >= 0 ? rows[headerIndex] : undefined;
  const data = headerIndex >= 0 ? rows.slice(headerIndex + 1).find((row) => /<td\b/i.test(row[1])) : undefined;
  if (!header || !data) return null;
  const labels = emptyCareer<string | null>();
  const values = emptyCareer<string | null>();
  const heads = cells(header[1], "th");
  const body = cells(data[1], "td");
  heads.forEach((cell, index) => {
    const key = careerKey(cell);
    if (!key || labels[key]) return;
    labels[key] = careerLabel(cell);
    values[key] = textOrNull(body[index] ?? "");
  });
  return { values, labels };
}

function startHistory(html: string): HorseStart[] {
  const table = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => match[1])
    .find((body) => {
      const header = body.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/i)?.[0] ?? "";
      const heads = cells(header, "th").map((cell) => textOf(cell).toLowerCase());
      const venue = heads.indexOf("venue");
      const distance = heads.indexOf("dist");
      return venue >= 0 && distance > venue && heads.includes("dist-win");
    });
  if (!table) return [];
  const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  const header = rows.find((row) => /<th\b/i.test(row[1]));
  if (!header) return [];
  const heads = cells(header[1], "th").map((cell) => textOf(cell).toLowerCase());
  const index = (label: string) => heads.indexOf(label);
  return rows.flatMap((row) => {
    if (!/<td\b/i.test(row[1])) return [];
    const body = cells(row[1], "td").map((cell) => textOrNull(cell));
    const date = at(body, index("date"));
    if (!date || !/^\d{1,2}-\d{1,2}-\d{4}$|^\d{4}-\d{2}-\d{2}$|^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(date)) return [];
    const race = splitRace(at(body, index("race no")));
    return [{
      date,
      venue: at(body, index("venue")),
      distance: at(body, index("dist")),
      raceClass: at(body, index("class")),
      raceNumber: race.raceNumber,
      finish: race.finish,
      jockey: at(body, index("jockey")),
      weight: at(body, index("wt")),
      winningMargin: at(body, index("dist-win")),
      time: at(body, index("time")),
      rating: at(body, index("rtg")),
    }];
  });
}

function splitRace(value: string | null): { raceNumber: string | null; finish: string | null } {
  if (!value) return { raceNumber: null, finish: null };
  const match = value.match(/^(\d+)\s*\((\d+)\)$/);
  if (!match) return { raceNumber: value, finish: null };
  return { raceNumber: match[1], finish: match[2] };
}

function labeledFields(table: string): Map<string, string | null> {
  const fields = new Map<string, string | null>();
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const label = row[1].match(/left-serispan">([\s\S]*?)<\/span>/i);
    if (!label) continue;
    const value = row[1].match(/right-serispan">([\s\S]*?)<\/span>/i);
    fields.set(textOf(label[1]).replace(/:\s*$/, "").toLowerCase(), textOrNull(value?.[1] ?? ""));
  }
  return fields;
}

function tableContaining(html: string, pattern: RegExp): string | null {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].find((match) => pattern.test(match[1]))?.[1] ?? null;
}

function careerKey(cell: string): CareerKey | null {
  if (/fa-rupee-sign|rupee/i.test(cell)) return "earnings";
  const label = textOf(cell).toLowerCase();
  if (label === "no. of runs" || label === "no of runs") return "runs";
  if (label === "wins") return "wins";
  if (label === "place 2") return "second";
  if (label === "place 3") return "third";
  if (label === "place 4") return "fourth";
  return null;
}

function careerLabel(cell: string): string | null {
  if (/fa-rupee-sign|rupee/i.test(cell)) return "₹";
  return textOrNull(cell);
}

function emptyCareer<T>(): Record<CareerKey, T | null> {
  return { runs: null, wins: null, second: null, third: null, fourth: null, earnings: null };
}

function cells(row: string, tag: "td" | "th"): string[] {
  return [...row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi"))].map((match) => match[1]);
}

function at(values: Array<string | null>, index: number): string | null {
  if (index < 0) return null;
  return values[index] ?? null;
}

function anchorText(html: string, hrefPart: string): string | null {
  const match = html.match(new RegExp(`<a\\b[^>]*href="[^"]*${hrefPart}[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`, "i"));
  return textOrNull(match?.[1] ?? "");
}

function sameName(left: string, right: string): boolean {
  return left.replace(/\s+/g, " ").trim().toUpperCase() === right.replace(/\s+/g, " ").trim().toUpperCase();
}

function textOrNull(value: string): string | null {
  const text = textOf(value);
  return text ? text : null;
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
