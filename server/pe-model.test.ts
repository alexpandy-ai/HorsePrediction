import assert from "node:assert/strict";
import test from "node:test";
import { canSpend, dedupeRaces, emptyLedger, mapRaceStatus, normalizeRace, planRefresh, racesFromAcceptances, racesFromResults, recordSpend } from "./pe-model.ts";

test("maps provider status without treating an open race or a past start as live", () => {
  assert.equal(mapRaceStatus({ status: "open" }), "Upcoming");
  assert.equal(mapRaceStatus({ status: "open", inplay: null }), "Upcoming");
  assert.equal(mapRaceStatus({ status: "open", inplay: false }), "Upcoming");
  assert.equal(mapRaceStatus({ inplay: true }), "Live");
  assert.equal(mapRaceStatus({ status: "abandoned" }), "Abandoned");
  assert.equal(mapRaceStatus({ statusNote: "postponed" }), "Delayed");
  assert.equal(mapRaceStatus({ resultStatus: "final" }), "Finished");
  assert.equal(mapRaceStatus({ resultStatus: "interim" }), "Finished");
  assert.equal(mapRaceStatus({ resultStatus: "abandoned" }), "Abandoned");
});

test("keeps saddlecloth and barrier apart and does not invent a region", () => {
  const race = normalizeRace(
    {
      race_id: "abc",
      venue: "Mystery Park",
      country: "AU",
      race_name: "Plate",
      race_number: 4,
      start_time: "2026-10-16T04:00:00Z",
      distance_m: 1400,
      runners: [{ name: "Red Silk", number: 3, barrier: 7, weight_kg: 56.5 }],
    },
    "2026-10-16",
  );
  assert.equal(race?.region, "Region unavailable");
  assert.equal(race?.runners[0].number, "3");
  assert.equal(race?.runners[0].draw, "7");
  assert.equal(race?.runners[0].weight, "56.5 kg");
  assert.equal(race?.distance, "1400m");
  const flemington = normalizeRace(
    { race_id: "fl", venue: "Flemington", country: "AU", race_name: "Cup", start_time: "2026-10-16T04:00:00Z" },
    "2026-10-16",
  );
  assert.equal(flemington?.region, "Victoria");
  assert.equal(flemington?.timezone, "Australia/Melbourne");
});

test("converts a start instant into the course date and can differ from Sydney", () => {
  const race = normalizeRace(
    {
      race_id: "ascot",
      venue: "Ascot",
      country: "GB",
      race_name: "Mile",
      start_time: "2026-10-16T23:30:00+01:00",
    },
    "2026-10-17",
  );
  assert.equal(race?.localDate, "2026-10-16");
  assert.equal(race?.localDateVerified, true);
  assert.equal(race?.timezone, "Europe/London");
  assert.equal(race?.publishedOffTime, "23:30");
});

test("dedupes a provider id and merges acceptance runners onto the priced race", () => {
  const priced = normalizeRace(
    {
      race_id: "same",
      venue: "Randwick",
      country: "AU",
      race_name: "Handicap",
      race_number: 6,
      start_time: "2026-10-16T04:00:00Z",
      runners: [{ name: "Harbour", number: 1, bookmakers: [{ key: "tab", win_price: 3.4, age_seconds: 20 }] }],
    },
    "2026-10-16",
  )!;
  const card = racesFromAcceptances({
    date: "2026-10-16",
    meetings: [
      {
        venue: "Randwick",
        country: "AU",
        track_condition: "Good",
        races: [{ race_id: "same", race_number: 6, race_name: "Handicap", runners: [{ name: "Harbour", number: 1, barrier: 4, jockey: "A Rider", scratched: true }] }],
      },
    ],
  })[0];
  const [merged] = dedupeRaces([priced, card]);
  assert.equal(merged.runners.length, 1);
  assert.equal(merged.runners[0].number, "1");
  assert.equal(merged.runners[0].draw, "4");
  assert.equal(merged.runners[0].jockey, "A Rider");
  assert.equal(merged.runners[0].scratched, true);
  assert.equal(merged.runners[0].quotes?.[0].bookmaker, "tab");
  assert.equal(merged.going, "Good");
});

test("reads a settled result without copying the box into the saddlecloth", () => {
  const [race] = racesFromResults(
    [{ race_id: "res", venue: "Greyville", country: "ZA", race_name: "Sprint", status: "final", runners: [{ name: "Cape", number: 2, box: 5, position: 1 }] }],
    "2026-10-16",
  );
  assert.equal(race.status, "Finished");
  assert.equal(race.region, "KwaZulu-Natal");
  assert.equal(race.runners[0].number, "2");
  assert.equal(race.runners[0].draw, "5");
  assert.equal(race.runners[0].position, 1);
});

test("stops scheduled calls when the daily budget is spent", () => {
  const ledger = recordSpend(emptyLedger(new Date("2026-10-16T02:00:00Z")), 39, 100, new Date("2026-10-16T02:00:00Z"));
  assert.equal(canSpend(ledger, 2, 40, 400, new Date("2026-10-16T02:00:00Z")).ok, false);
  assert.equal(canSpend(ledger, 1, 40, 400, new Date("2026-10-16T02:00:00Z")).ok, true);
  const jobs = planRefresh(new Date("2026-10-16T02:00:00Z"), {}, ledger, 40, 400);
  assert.deepEqual(jobs, ["venues"]);
});
