import type { IndiaFixture } from "./types";

const STATES: Record<string, string> = {
  bangalore: "Karnataka",
  bengaluru: "Karnataka",
  mysore: "Karnataka",
  mysuru: "Karnataka",
  mumbai: "Maharashtra",
  pune: "Maharashtra",
  hyderabad: "Telangana",
  kolkata: "West Bengal",
  calcutta: "West Bengal",
  delhi: "Delhi",
};

export const STATE_ORDER = ["Karnataka", "Maharashtra", "Telangana", "West Bengal", "Delhi", "State unavailable"];

export function stateForCourse(course: string): string | null {
  const key = course.toLowerCase().replace(/[^a-z]/g, "");
  return STATES[key] ?? null;
}

export function groupByState<T extends { state: string | null; course: string; firstRaceMinutes?: number | null }>(
  items: T[],
): Array<{ state: string; meetings: T[] }> {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const state = item.state ?? "State unavailable";
    const list = buckets.get(state) ?? [];
    list.push(item);
    buckets.set(state, list);
  }
  return STATE_ORDER.filter((state) => buckets.has(state)).map((state) => ({
    state,
    meetings: (buckets.get(state) ?? []).slice().sort((a, b) => {
      const aTime = a.firstRaceMinutes ?? Number.POSITIVE_INFINITY;
      const bTime = b.firstRaceMinutes ?? Number.POSITIVE_INFINITY;
      if (aTime !== bTime) return aTime - bTime;
      return a.course.localeCompare(b.course);
    }),
  }));
}

export function fixturesOnDate(fixtures: IndiaFixture[], date: string): IndiaFixture[] {
  return fixtures.filter((fixture) => fixture.date === date);
}
