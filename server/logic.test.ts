import assert from "node:assert/strict";
import test from "node:test";
import { groupRaces, nextRaces } from "../src/meetings/board.ts";
import { calendarDate, clockTime } from "../src/meetings/time.ts";
import { dedupeRaces, mapStatus, normalizeRacecard, type RawRacecard } from "./logic.ts";

function card(overrides: Partial<RawRacecard> = {}): RawRacecard {
  return {
    race_id: "rac_1",
    course: "Ascot",
    course_id: "crs_ascot",
    date: "2026-10-16",
    off_time: "14:30",
    off_dt: "2026-10-16T14:30:00+01:00",
    race_name: "Test Stakes",
    distance: "1m",
    region: "GB",
    race_class: "Class 3",
    going: "Good",
    surface: "Turf",
    race_status: "",
    runners: [],
    ...overrides,
  };
}

test("maps explicit statuses and does not treat a blank status as live", () => {
  assert.equal(mapStatus(""), "Upcoming");
  assert.equal(mapStatus(null), "Upcoming");
  assert.equal(mapStatus("Live"), "Live");
  assert.equal(mapStatus("Off"), "Live");
  assert.equal(mapStatus("Delayed"), "Delayed");
  assert.equal(mapStatus("Cancelled"), "Cancelled");
  assert.equal(mapStatus("Meeting abandoned"), "Abandoned");
  assert.equal(mapStatus("", true), "Abandoned");
  assert.equal(mapStatus("Weighed In"), "Finished");
  const past = normalizeRacecard(card({ off_dt: "2020-01-01T12:00:00Z", race_status: "" }), "test");
  assert.equal(past?.status, "Upcoming");
});

test("keeps same-named courses in their own country and does not guess a region", () => {
  const ascot = normalizeRacecard(card(), "test");
  assert.equal(ascot?.region, "Berkshire");
  assert.equal(ascot?.timezone, "Europe/London");
  assert.equal(ascot?.countryName, "United Kingdom");
  const unknown = normalizeRacecard(card({ race_id: "rac_2", course: "Mystery Downs" }), "test");
  assert.equal(unknown?.region, "Region unavailable");
  assert.equal(unknown?.timezone, "Europe/London");
  const western = normalizeRacecard(
    card({ race_id: "rac_wa", course: "Ascot", region: "AUS", date: "2026-10-17", off_dt: "2026-10-17T06:00:00+08:00" }),
    "test",
  );
  assert.equal(western?.region, "Western Australia");
  assert.equal(western?.timezone, "Australia/Perth");
  assert.equal(western?.countryCode, "AU");
  const santa = normalizeRacecard(card({ race_id: "rac_sa", course: "Santa Anita", region: "USA" }), "test");
  assert.equal(santa?.region, "Region unavailable");
  assert.equal(santa?.timezone, null);
  assert.equal(santa?.localDateVerified, false);
});

test("converts a London off time to the course date and to Asia/Kolkata", () => {
  const instant = new Date("2026-10-16T23:30:00+01:00");
  assert.equal(calendarDate("Europe/London", instant), "2026-10-16");
  assert.equal(calendarDate("Asia/Kolkata", instant), "2026-10-17");
  assert.equal(clockTime("Asia/Kolkata", new Date("2026-06-20T13:50:00+01:00")), "18:20");
  assert.equal(clockTime("Europe/London", new Date("2026-01-16T12:00:00Z")), "12:00");
  assert.equal(clockTime("Europe/London", new Date("2026-06-20T12:00:00Z")), "13:00");
  assert.equal(clockTime("Asia/Kolkata", new Date("2026-01-16T18:30:00Z")), "00:00");
  assert.equal(calendarDate("Asia/Kolkata", new Date("2026-01-16T18:30:00Z")), "2026-01-17");
  const race = normalizeRacecard(card({ off_dt: "2026-10-16T23:30:00+01:00", date: "2026-10-16" }), "test");
  assert.equal(race?.localDate, "2026-10-16");
  assert.equal(race?.localDateVerified, true);
});

test("deduplicates provider race ids and keeps the later record", () => {
  const first = normalizeRacecard(card({ race_name: "First" }), "test");
  const second = normalizeRacecard(card({ race_name: "Second", race_status: "Cancelled" }), "test");
  const races = dedupeRaces([first!, second!]);
  assert.equal(races.length, 1);
  assert.equal(races[0].name, "Second");
  assert.equal(races[0].status, "Cancelled");
});

test("groups by country, region, and course, and sorts upcoming races by instant", () => {
  const ascot = normalizeRacecard(card({ race_id: "rac_a", off_dt: "2026-10-16T15:00:00+01:00" }), "test")!;
  const york = normalizeRacecard(
    card({ race_id: "rac_y", course: "York", off_dt: "2026-10-16T13:00:00+01:00", race_name: "York opener" }),
    "test",
  )!;
  const leopardstown = normalizeRacecard(
    card({
      race_id: "rac_l",
      course: "Leopardstown",
      region: "IRE",
      off_dt: "2026-10-16T14:00:00+01:00",
      race_name: "Dublin",
    }),
    "test",
  )!;
  const cancelled = normalizeRacecard(card({ race_id: "rac_c", race_status: "Cancelled", off_dt: "2026-10-16T12:00:00+01:00" }), "test")!;
  const groups = groupRaces([ascot, york, leopardstown]);
  assert.deepEqual(
    groups.map((country) => country.name),
    ["Ireland", "United Kingdom"],
  );
  const uk = groups.find((country) => country.name === "United Kingdom")!;
  assert.deepEqual(
    uk.regions.map((region) => region.name),
    ["Berkshire", "North Yorkshire"],
  );
  const upcoming = nextRaces([cancelled, ascot, york]);
  assert.deepEqual(
    upcoming.map((race) => race.id),
    ["rac_y", "rac_a"],
  );
});
