import { clockTime, deviceTimeZone, zoneAbbreviation } from "../../meetings/time";

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function localClock(startTime: string | null, timezone: string | null, deviceZone = deviceTimeZone()): string {
  if (!startTime) return "—";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "—";
  const course = courseClock(date, timezone);
  const yours = deviceClock(date, deviceZone);
  if (!yours) return course;
  return `${course} · Your time ${yours}`;
}

/** Device-local clock only, in the browser timezone. A missing start instant is an em dash. */
export function deviceLocalClock(startTime: string | null, deviceZone = deviceTimeZone()): string {
  if (!startTime) return "—";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "—";
  return deviceClock(date, deviceZone) ?? "—";
}

function courseClock(date: Date, timezone: string | null): string {
  const named = timezone?.trim() ?? "";
  if (!named) return `${clockTime("UTC", date)} UTC`;
  const clock = safeClock(named, date);
  if (!clock) return `${clockTime("UTC", date)} UTC`;
  return `${clock} ${zoneAbbreviation(named, date)}`;
}

function deviceClock(date: Date, deviceZone: string): string | null {
  const zone = deviceZone.trim() || "UTC";
  const clock = safeClock(zone, date);
  if (!clock) return null;
  return `${clock} ${zoneAbbreviation(zone, date)}`;
}

function safeClock(timeZone: string, date: Date): string | null {
  try {
    return clockTime(timeZone, date);
  } catch {
    return null;
  }
}

export function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

/** FormFav documents win and place rates as fractions from 0 to 1. A missing rate stays an em dash. */
export function formfavRate(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const percent = Math.round(value * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}
