import type { CountryId } from "./types";
import { isCountry } from "./types";
import { getCourse, getRace } from "./data";

export type Route =
  | { name: "home" }
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
  if (route.name === "home") return "HorsePrediction — International handicapping";
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

export function navCurrent(route: Route): "cards" | "courses" | "engine" | null {
  if (route.name === "meetings" || route.name === "race" || route.name === "live") return "cards";
  if (route.name === "courses" || route.name === "course") return "courses";
  if (route.name === "engine") return "engine";
  return null;
}
