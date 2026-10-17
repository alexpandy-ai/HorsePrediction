import { lookupCourse } from "./locations.ts";
import { calendarDate } from "../src/meetings/time.ts";
import type { RaceStatus, SourceReport, WireRace, WireRunner } from "../src/meetings/types.ts";

export interface RawRunner {
  horse?: string;
  horse_id?: string;
  age?: string;
  sex?: string | null;
  sex_code?: string | null;
  number?: string;
  draw?: string;
  lbs?: string;
  ofr?: string;
  jockey?: string;
  trainer?: string;
  last_run?: string;
  form?: string | null;
  headgear?: string | null;
}

export interface RawRacecard {
  race_id?: string;
  course?: string;
  course_id?: string;
  date?: string;
  off_time?: string;
  off_dt?: string | null;
  race_name?: string;
  distance?: string;
  distance_f?: string;
  region?: string;
  race_class?: string;
  going?: string;
  surface?: string | null;
  race_status?: string | null;
  is_abandoned?: boolean | null;
  runners?: RawRunner[];
}

interface CountryInfo {
  code: string;
  name: string;
  timezone: string | null;
}

const COUNTRIES: Record<string, CountryInfo> = {
  GB: { code: "GB", name: "United Kingdom", timezone: "Europe/London" },
  IRE: { code: "IE", name: "Ireland", timezone: "Europe/Dublin" },
  IE: { code: "IE", name: "Ireland", timezone: "Europe/Dublin" },
  HK: { code: "HK", name: "Hong Kong", timezone: "Asia/Hong_Kong" },
  FR: { code: "FR", name: "France", timezone: "Europe/Paris" },
  UAE: { code: "AE", name: "United Arab Emirates", timezone: "Asia/Dubai" },
  AE: { code: "AE", name: "United Arab Emirates", timezone: "Asia/Dubai" },
  BHR: { code: "BH", name: "Bahrain", timezone: "Asia/Bahrain" },
  USA: { code: "US", name: "United States", timezone: null },
  US: { code: "US", name: "United States", timezone: null },
  AUS: { code: "AU", name: "Australia", timezone: null },
  AU: { code: "AU", name: "Australia", timezone: null },
  SAF: { code: "ZA", name: "South Africa", timezone: "Africa/Johannesburg" },
  ZA: { code: "ZA", name: "South Africa", timezone: "Africa/Johannesburg" },
  IND: { code: "IN", name: "India", timezone: "Asia/Kolkata" },
  IN: { code: "IN", name: "India", timezone: "Asia/Kolkata" },
};

export function flagEmoji(iso: string): string {
  if (!/^[A-Z]{2}$/.test(iso)) return "";
  return [...iso].map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65)).join("");
}

export function mapStatus(rawStatus: string | null | undefined, abandoned?: boolean | null): RaceStatus {
  if (abandoned === true) return "Abandoned";
  const text = (rawStatus ?? "").trim().toLowerCase();
  if (!text) return "Upcoming";
  if (text.includes("abandon")) return "Abandoned";
  if (text.includes("cancel")) return "Cancelled";
  if (text.includes("delay") || text.includes("postpon")) return "Delayed";
  if (text === "off" || text === "live" || text === "running" || text === "started" || text.includes("in progress")) {
    return "Live";
  }
  if (text.includes("result") || text.includes("finish") || text.includes("weighed") || text.includes("complete")) {
    return "Finished";
  }
  return "Upcoming";
}

function blankToNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function weightLabel(lbs: string | undefined): string | null {
  const pounds = Number(lbs);
  if (!Number.isFinite(pounds) || pounds <= 0) return null;
  const stone = Math.floor(pounds / 14);
  const remainder = Math.round(pounds % 14);
  const kg = (pounds * 0.45359237).toFixed(1);
  return `${stone}st ${remainder}lb (${kg} kg)`;
}

function daysSince(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return Number(value);
}

function mapRunner(runner: RawRunner, index: number): WireRunner | null {
  const name = blankToNull(runner.horse);
  if (!name) return null;
  return {
    id: blankToNull(runner.horse_id) ?? `${name}-${index}`,
    number: blankToNull(runner.number),
    name,
    draw: blankToNull(runner.draw),
    age: blankToNull(runner.age),
    sex: blankToNull(runner.sex_code) ?? blankToNull(runner.sex),
    weight: weightLabel(runner.lbs),
    officialRating: blankToNull(runner.ofr),
    form: blankToNull(runner.form),
    daysSince: daysSince(runner.last_run),
    jockey: blankToNull(runner.jockey),
    trainer: blankToNull(runner.trainer),
    headgear: blankToNull(runner.headgear),
  };
}

export function normalizeRacecard(card: RawRacecard, source: string): WireRace | null {
  const id = blankToNull(card.race_id);
  const course = blankToNull(card.course);
  const meetingDate = blankToNull(card.date);
  const name = blankToNull(card.race_name);
  if (!id || !course || !meetingDate || !name) return null;

  const regionCode = (card.region ?? "").trim().toUpperCase();
  const known = COUNTRIES[regionCode];
  const countryCode = known?.code ?? (regionCode || "UNLISTED");
  const countryName = known?.name ?? (regionCode ? `Unlisted region (${regionCode})` : "Unlisted region");
  const place = known ? lookupCourse(course, known.code) : undefined;
  const timezone = place?.timezone ?? known?.timezone ?? null;
  const startInstant = parseInstant(card.off_dt);
  const localDate = timezone && startInstant ? calendarDate(timezone, new Date(startInstant)) : meetingDate;

  return {
    id,
    name,
    raceNumber: null,
    course,
    courseId: blankToNull(card.course_id) ?? course,
    countryCode,
    countryName,
    flag: flagEmoji(known?.code ?? ""),
    region: place?.region ?? "Region unavailable",
    timezone,
    meetingDate,
    localDate,
    localDateVerified: Boolean(timezone && startInstant),
    startInstant,
    publishedOffTime: blankToNull(card.off_time),
    distance: blankToNull(card.distance) ?? (blankToNull(card.distance_f) ? `${card.distance_f}f` : null),
    raceClass: blankToNull(card.race_class),
    surface: blankToNull(card.surface),
    going: blankToNull(card.going),
    status: mapStatus(card.race_status, card.is_abandoned),
    rawStatus: (card.race_status ?? "").trim(),
    source,
    runners: (card.runners ?? []).map(mapRunner).filter((runner): runner is WireRunner => runner !== null),
  };
}

function parseInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export function dedupeRaces(races: WireRace[]): WireRace[] {
  const byId = new Map<string, WireRace>();
  for (const race of races) byId.set(race.id, race);
  return [...byId.values()];
}

export function staticCoverage(): SourceReport[] {
  return [
    {
      id: "india",
      name: "India",
      state: "unsupported",
      detail: "No IndiaRace feed is configured in this project. Sample Indian cards are not live meetings.",
    },
    {
      id: "australia",
      name: "Australia",
      state: "unsupported",
      detail: "No Australia add-on is configured. A meeting is shown only when the active feed includes that race.",
    },
    {
      id: "south-africa",
      name: "South Africa",
      state: "unsupported",
      detail: "No permitted South African feed is configured.",
    },
  ];
}

export function londonWindow(now: Date): { today: string; tomorrow: string } {
  const today = calendarDate("Europe/London", now);
  const [year, month, day] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { today, tomorrow };
}
