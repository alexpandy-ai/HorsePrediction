import { clockTime, timezoneShort } from "../../meetings/time";
import type { FormfavRace } from "./types";

export function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function localClock(startTime: string | null, timezone: string | null): string {
  if (!startTime) return "—";
  const date = new Date(startTime);
  if (Number.isNaN(date.getTime())) return "—";
  if (!timezone) return `${clockTime("UTC", date)} UTC`;
  return `${clockTime(timezone, date)} ${timezoneShort(timezone, date)}`;
}

export function raceSpan(races: FormfavRace[]): { first: string; last: string } {
  const timed = races.filter((race) => race.startTime);
  if (timed.length === 0) return { first: "—", last: "—" };
  const ordered = timed.slice().sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  return {
    first: localClock(ordered[0].startTime, ordered[0].timezone),
    last: localClock(ordered[ordered.length - 1].startTime, ordered[ordered.length - 1].timezone),
  };
}

export function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}
