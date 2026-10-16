import type { CountryId, PastResult } from "../types";
import { courses } from "./courses";

const MANUAL: PastResult[] = [
  { courseId: "mumbai", date: "2026-02-08", raceName: "Mahalaxmi Cup", distanceLabel: "2400m", going: "Good", winner: "Monsoon Reel", field: 16, time: "2:31.1" },
  { courseId: "mumbai", date: "2026-01-18", raceName: "Colaba Handicap", distanceLabel: "1600m", going: "Good", winner: "Blue Concan", field: 12, time: "1:37.4" },
  { courseId: "mumbai", date: "2025-12-07", raceName: "Harbour Plate", distanceLabel: "1200m", going: "Good to Firm", winner: "Gateway", field: 11, time: "1:11.8" },
  { courseId: "flemington", date: "2026-03-07", raceName: "Flemington Cup", distanceLabel: "3200m", going: "Good", winner: "Straight Six", field: 18, time: "3:22.4" },
  { courseId: "flemington", date: "2025-11-04", raceName: "Oaks Day Plate", distanceLabel: "1600m", going: "Good 4", winner: "Cup Week", field: 14, time: "1:36.2" },
  { courseId: "flemington", date: "2025-09-13", raceName: "Straight Handicap", distanceLabel: "1200m", going: "Soft 5", winner: "Kensington", field: 12, time: "1:11.9" },
  { courseId: "turffontein", date: "2026-03-28", raceName: "Highveld Stakes", distanceLabel: "1600m", going: "Good", winner: "Reef Gold", field: 14, time: "1:38.6" },
  { courseId: "turffontein", date: "2026-01-24", raceName: "Stand Side Sprint", distanceLabel: "1200m", going: "Good", winner: "Peninsula", field: 13, time: "1:10.8" },
  { courseId: "turffontein", date: "2025-11-29", raceName: "Summer Handicap", distanceLabel: "1800m", going: "Soft", winner: "July Road", field: 11, time: "1:52.4" },
  { courseId: "ascot", date: "2026-06-20", raceName: "Royal Week Handicap", distanceLabel: "1m", going: "Good to Soft", winner: "Straight Mile", field: 16, time: "1:40.2" },
  { courseId: "ascot", date: "2026-07-25", raceName: "High Street Handicap", distanceLabel: "1m 4f", going: "Good to Firm", winner: "Festival", field: 14, time: "2:32.6" },
  { courseId: "ascot", date: "2025-10-11", raceName: "Old Mile Conditions", distanceLabel: "1m", going: "Soft", winner: "Derby Lane", field: 9, time: "1:44.8" },
];

const WINNERS: Record<CountryId, string[]> = {
  india: ["Monsoon Reel", "Blue Concan", "Gateway", "Charminar", "Hooghly", "Cubbon", "Nilgiri Mail"],
  australia: ["Straight Six", "Cup Week", "Kensington", "Oakleigh", "Brisbane Road", "Adelaidean"],
  "south-africa": ["Reef Gold", "Peninsula", "July Road", "Midlands", "Cape Winter", "Algoa"],
  uk: ["Straight Mile", "Festival", "Derby Lane", "Knavesmire Lad", "Downland", "Town Moor", "Esher"],
};

const featured = new Set(MANUAL.map((result) => result.courseId));

function generated(): PastResult[] {
  return courses
    .filter((course) => !featured.has(course.id))
    .flatMap((course, index) => {
      const pool = WINNERS[course.countryId];
      return [0, 1].map((slot) => {
        const jumps = course.discipline === "Jumps" || (course.discipline === "Mixed" && slot === 1);
        const flatSprint = course.countryId === "uk" ? "6f" : "1200m";
        const flatMile = course.countryId === "uk" ? "1m" : "1600m";
        const day = String(4 + ((index + slot * 3) % 20)).padStart(2, "0");
        return {
          courseId: course.id,
          date: slot === 0 ? `2026-08-${day}` : `2026-05-${day}`,
          raceName: jumps
            ? slot === 0
              ? `${course.shortName} Novices' Chase`
              : `${course.shortName} Handicap Hurdle`
            : slot === 0
              ? `${course.shortName} Handicap`
              : `${course.shortName} Stakes`,
          distanceLabel: jumps ? (slot === 0 ? "2m 4f" : "3m") : slot === 0 ? flatMile : flatSprint,
          going: slot === 0 ? "Good" : course.countryId === "australia" ? "Soft 6" : "Good to Soft",
          winner: pool[(index + slot) % pool.length],
          field: 9 + ((index + slot) % 6),
          time: jumps ? (slot === 0 ? "5:02.4" : "6:08.7") : slot === 0 ? "1:37.1" : "1:12.0",
        };
      });
    });
}

export const history: PastResult[] = [...MANUAL, ...generated()].sort((a, b) =>
  a.date < b.date ? 1 : -1,
);
