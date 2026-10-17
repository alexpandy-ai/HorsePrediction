import type { WireRace } from "./types";

export interface CourseGroup {
  name: string;
  timezone: string | null;
  meetingDate: string;
  localDateVerified: boolean;
  races: WireRace[];
}

export interface RegionGroup {
  name: string;
  courses: CourseGroup[];
}

export interface CountryGroup {
  code: string;
  name: string;
  flag: string;
  regions: RegionGroup[];
}

function byInstant(a: WireRace, b: WireRace): number {
  if (a.startInstant && b.startInstant) return a.startInstant.localeCompare(b.startInstant);
  if (a.startInstant) return -1;
  if (b.startInstant) return 1;
  return a.name.localeCompare(b.name);
}

export function nextRaces(races: WireRace[], limit = 8): WireRace[] {
  return races
    .filter((race) => race.status === "Upcoming" && race.startInstant)
    .slice()
    .sort(byInstant)
    .slice(0, limit);
}

export function groupRaces(races: WireRace[]): CountryGroup[] {
  const countries = new Map<string, CountryGroup>();
  for (const race of races) {
    let country = countries.get(race.countryCode + race.countryName);
    if (!country) {
      country = { code: race.countryCode, name: race.countryName, flag: race.flag, regions: [] };
      countries.set(race.countryCode + race.countryName, country);
    }
    let region = country.regions.find((item) => item.name === race.region);
    if (!region) {
      region = { name: race.region, courses: [] };
      country.regions.push(region);
    }
    let course = region.courses.find((item) => item.name === race.course && item.meetingDate === race.meetingDate);
    if (!course) {
      course = {
        name: race.course,
        timezone: race.timezone,
        meetingDate: race.meetingDate,
        localDateVerified: race.localDateVerified,
        races: [],
      };
      region.courses.push(course);
    }
    course.races.push(race);
  }

  for (const country of countries.values()) {
    country.regions.sort((a, b) => {
      if (a.name === "Region unavailable") return 1;
      if (b.name === "Region unavailable") return -1;
      return a.name.localeCompare(b.name);
    });
    for (const region of country.regions) {
      region.courses.sort((a, b) => a.name.localeCompare(b.name));
      for (const course of region.courses) course.races.sort(byInstant);
    }
  }

  return [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function filterRaces(
  races: WireRace[],
  filters: { country?: string; region?: string; course?: string; status?: string },
): WireRace[] {
  return races.filter((race) => {
    if (filters.country && filters.country !== "all" && race.countryName !== filters.country) return false;
    if (filters.region && filters.region !== "all" && race.region !== filters.region) return false;
    if (filters.course && filters.course !== "all" && race.course !== filters.course) return false;
    if (filters.status && filters.status !== "all" && race.status !== filters.status) return false;
    return true;
  });
}
