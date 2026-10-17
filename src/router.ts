import type { CountryId } from "./types";
import { isCountry } from "./types";
import { getCourse, getRace } from "./data";

export type Route =
  | { name: "home" }
  | { name: "sample" }
  | { name: "meeting"; date: string; venueId: string }
  | { name: "race-card"; date: string; venueId: string; raceNumber: number }
  | { name: "handicap"; date: string; venueId: string; raceNumber: number }
  | { name: "meetings"; country?: CountryId }
  | { name: "race"; raceId: string; runnerId?: string }
  | { name: "courses"; country?: CountryId }
  | { name: "course"; courseId: string }
  | { name: "engine"; raceId?: string }
  | { name: "live"; raceId: string }
  | { name: "missing" };

export function parseRoute(hash: string): Route {
  const parts = (hash.replace(/^#/, "") || "/").split("/").filter(Boolean);
  const head = parts[0];
  if (!head) return { name: "home" };
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
  if (head === "courses") {
    if (!parts[1]) return { name: "courses" };
    return isCountry(parts[1]) ? { name: "courses", country: parts[1] } : { name: "missing" };
  }
  if (head === "course" && parts[1]) return { name: "course", courseId: parts[1] };
  if (head === "engine") return { name: "engine", raceId: parts[1] };
  if (head === "live" && parts[1]) return { name: "live", raceId: decodeURIComponent(parts.slice(1).join("/")) };
  return { name: "missing" };
}

export function documentTitle(route: Route): string {
  if (route.name === "home") return "STRIDE — Horse racing";
  if (route.name === "sample") return "Sample cards — STRIDE";
  if (route.name === "meeting") return "Meeting — STRIDE";
  if (route.name === "race-card") return "Race card — STRIDE";
  if (route.name === "handicap") return "Handicapping — STRIDE";
  if (route.name === "meetings") return "Race cards — HorsePrediction";
  if (route.name === "courses") return "Racecourses — HorsePrediction";
  if (route.name === "engine") return "Handicapper — HorsePrediction";
  if (route.name === "live") return "Race card — HorsePrediction";
  if (route.name === "race") {
    const race = getRace(route.raceId);
    return race ? `${race.name} — HorsePrediction` : "Race card — HorsePrediction";
  }
  if (route.name === "course") {
    const course = getCourse(route.courseId);
    return course ? `${course.shortName} — HorsePrediction` : "Racecourse — HorsePrediction";
  }
  return "HorsePrediction";
}

export function navCurrent(route: Route): "meetings" | "sample" | "courses" | "engine" | null {
  if (route.name === "home" || route.name === "meeting" || route.name === "race-card" || route.name === "handicap") return "meetings";
  if (route.name === "sample" || route.name === "meetings" || route.name === "race" || route.name === "live") return "sample";
  if (route.name === "courses" || route.name === "course") return "courses";
  if (route.name === "engine") return "engine";
  return null;
}
