import type { CountryId } from "./types";
import { isCountry } from "./types";
import { getRace } from "./data";
import { isFormfavCountry, type FormfavCountryCode } from "./stride/formfav/countries";

export type Route =
  | { name: "home" }
  | { name: "ff-home"; country: FormfavCountryCode }
  | { name: "ff-meeting"; country: FormfavCountryCode; date: string; slug: string }
  | { name: "ff-race"; country: FormfavCountryCode; date: string; slug: string; raceNumber: number }
  | { name: "ff-handicap"; country: FormfavCountryCode; date: string; slug: string; raceNumber: number }
  | { name: "ff-horse"; country: "au"; date: string; slug: string; raceNumber: number; horseNumber: number }
  | { name: "sample" }
  | { name: "meeting"; date: string; venueId: string }
  | { name: "race-card"; date: string; venueId: string; raceNumber: number }
  | { name: "handicap"; date: string; venueId: string; raceNumber: number }
  | { name: "meetings"; country?: CountryId }
  | { name: "race"; raceId: string; runnerId?: string }
  | { name: "engine"; raceId?: string }
  | { name: "live"; raceId: string }
  | { name: "horse"; id: string; horseName: string }
  | { name: "missing" };

export function parseRoute(hash: string): Route {
  const parts = (hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  const head = parts[0];
  if (!head) return { name: "home" };
  if (head === "ff" && parts[1] && isFormfavCountry(parts[1])) {
    const country = parts[1];
    if (!parts[2]) return { name: "ff-home", country };
    const date = parts[3];
    const slug = parts[4] ? decodeURIComponent(parts[4]) : "";
    if (parts[2] === "meeting" && date && slug) return { name: "ff-meeting", country, date, slug };
    if (parts[2] === "horse") {
      if (country !== "au" || !date || !slug || !parts[5] || !parts[6]) return { name: "missing" };
      const raceNumber = Number(parts[5]);
      const horseNumber = Number(parts[6]);
      if (!Number.isInteger(raceNumber) || raceNumber <= 0 || !Number.isInteger(horseNumber) || horseNumber <= 0) return { name: "missing" };
      return { name: "ff-horse", country: "au", date, slug, raceNumber, horseNumber };
    }
    if ((parts[2] === "race" || parts[2] === "handicap") && date && slug && parts[5]) {
      const raceNumber = Number(parts[5]);
      if (!Number.isInteger(raceNumber)) return { name: "missing" };
      return { name: parts[2] === "race" ? "ff-race" : "ff-handicap", country, date, slug, raceNumber };
    }
    return { name: "missing" };
  }
  if (head === "sample") return { name: "sample" };
  if (head === "meeting" && parts[1] && parts[2]) return { name: "meeting", date: parts[1], venueId: parts[2] };
  if ((head === "race-card" || head === "handicap") && parts[1] && parts[2] && parts[3]) {
    const raceNumber = Number(parts[3]);
    if (!Number.isInteger(raceNumber)) return { name: "missing" };
    return { name: head, date: parts[1], venueId: parts[2], raceNumber };
  }
  if (head === "meetings") {
    if (!parts[1]) return { name: "meetings" };
    return isCountry(parts[1]) ? { name: "meetings", country: parts[1] } : { name: "missing" };
  }
  if (head === "race" && parts[1]) return { name: "race", raceId: parts[1], runnerId: parts[2] };
  if (head === "engine") return { name: "engine", raceId: parts[1] };
  if (head === "live" && parts[1]) return { name: "live", raceId: decodeURIComponent(parts.slice(1).join("/")) };
  if (head === "horse" && parts[1] && /^\d+$/.test(parts[1]) && parts[2]) {
    const horseName = decodeHash(parts.slice(2).join("/"));
    if (!horseName) return { name: "missing" };
    return { name: "horse", id: parts[1], horseName };
  }
  return { name: "missing" };
}

function decodeHash(value: string): string {
  try {
    return decodeURIComponent(value).replace(/\s+/g, " ").trim();
  } catch {
    return value.replace(/\s+/g, " ").trim();
  }
}

export function documentTitle(route: Route): string {
  if (route.name === "home" || route.name === "ff-home") return "STRIDE — Horse racing";
  if (route.name === "ff-meeting") return "Meeting — STRIDE";
  if (route.name === "ff-race") return "Race card — STRIDE";
  if (route.name === "ff-handicap") return "Handicapping — STRIDE";
  if (route.name === "ff-horse") return "Horse — STRIDE";
  if (route.name === "sample") return "Sample cards — STRIDE";
  if (route.name === "meeting") return "Meeting — STRIDE";
  if (route.name === "race-card") return "Race card — STRIDE";
  if (route.name === "horse") return `${route.horseName} — STRIDE`;
  if (route.name === "handicap") return "Handicapping — STRIDE";
  if (route.name === "meetings") return "Race cards — HorsePrediction";
  if (route.name === "engine") return "Handicapper — HorsePrediction";
  if (route.name === "live") return "Race card — HorsePrediction";
  if (route.name === "race") {
    const race = getRace(route.raceId);
    return race ? `${race.name} — HorsePrediction` : "Race card — HorsePrediction";
  }
  return "HorsePrediction";
}

export function navCurrent(route: Route): "meetings" | "sample" | "engine" | null {
  if (route.name === "home" || route.name === "meeting" || route.name === "race-card" || route.name === "handicap" || route.name === "horse" || route.name === "ff-home" || route.name === "ff-meeting" || route.name === "ff-race" || route.name === "ff-handicap" || route.name === "ff-horse") return "meetings";
  if (route.name === "sample" || route.name === "meetings" || route.name === "race" || route.name === "live") return "sample";
  if (route.name === "engine") return "engine";
  return null;
}
