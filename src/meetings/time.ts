export function calendarDate(timeZone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function clockTime(timeZone: string, date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function timezoneShort(timeZone: string, date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "short",
  }).formatToParts(date);
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}

export function deviceTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone || "UTC";
}

/** A civil abbreviation such as IST or AEDT when a locale knows one, otherwise the offset Intl prints. */
export function zoneAbbreviation(timeZone: string, date: Date): string {
  const names: string[] = [];
  for (const locale of ["en-GB", "en-AU", "en-NZ", "en-ZA", "en-IN", "en-US"]) {
    const name = shortZoneName(locale, timeZone, date);
    if (name) names.push(name);
  }
  const civil = names.find((name) => !/^(?:GMT|UTC)[+-]/i.test(name));
  return civil ?? names[0] ?? timeZone;
}

function shortZoneName(locale: string, timeZone: string, date: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export const USER_TIMEZONE = "Asia/Kolkata";
