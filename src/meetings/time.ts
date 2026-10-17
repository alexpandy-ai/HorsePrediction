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

export function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export const USER_TIMEZONE = "Asia/Kolkata";
