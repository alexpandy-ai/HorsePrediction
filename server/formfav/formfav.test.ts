import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRoute } from "../../src/router.ts";
import { australiaHorseHash, PREVIOUS_RUNS_DETAIL } from "../../src/stride/formfav/horse.ts";
import { formfavRate, localClock } from "../../src/stride/formfav/present.ts";
import { meetingsFromResponse, raceFromForm } from "../../src/stride/formfav/normalize.ts";
import { rankFormfavRace } from "../../src/stride/formfav/handicap.ts";
import type { FormfavRace } from "../../src/stride/formfav/types.ts";
import { DEFAULT_FORMFAV_WEIGHTS } from "../../src/stride/formfav/handicap.ts";
import type { FormfavTransport } from "./client.ts";
import { syncFormfav } from "./sync.ts";

test("keeps only the requested country and does not copy the horse number into the barrier", () => {
  const meetings = meetingsFromResponse(
    {
      date: "2026-10-19",
      raceType: "gallops",
      meetings: [
        { track: "Flemington", slug: "flemington", country: "au", races: [{ raceNumber: 1, raceName: "Plate", startTime: "2026-10-19T03:00:00Z", timezone: "Australia/Melbourne" }] },
        { track: "Kenilworth", slug: "kenilworth", country: "za", races: [{ raceNumber: 1 }] },
      ],
    },
    "au",
    "2026-10-19",
  );
  assert.equal(meetings.length, 1);
  assert.equal(meetings[0].region, "Region unavailable");
  assert.equal(meetings[0].track, "Flemington");
  const race = raceFromForm(
    { raceNumber: 1, runners: [{ number: 8, name: "Ocean", barrier: null, scratched: false }] },
    meetings[0].races[0],
  );
  assert.equal(race.runners[0].horseNumber, 8);
  assert.equal(race.runners[0].barrier, null);
});

test("a missing barrier is not scored and a FormFav prediction is not the STRIDE score", () => {
  const race: FormfavRace = {
    raceNumber: 1,
    raceName: "Plate",
    distance: "1200m",
    condition: null,
    weather: null,
    raceClass: null,
    prizeMoney: null,
    abandoned: false,
    startTime: "2026-10-19T03:00:00Z",
    timezone: "Australia/Melbourne",
    numberOfRunners: 2,
    runnersIncluded: true,
    runners: [
      runner({ horseNumber: 1, name: "Wide", barrier: null, form: "1", prediction: { winProb: 0.4, placeProb: 0.7, modelRank: 1 } }),
      runner({ horseNumber: 2, name: "Scratched", barrier: 1, scratched: true, form: "1" }),
    ],
  };
  const result = rankFormfavRace(race, DEFAULT_FORMFAV_WEIGHTS);
  const wide = result.rows.find((row) => row.name === "Wide");
  assert.equal(wide?.factors.find((factor) => factor.key === "barrier")?.status, "unavailable");
  assert.notEqual(wide?.score, 40);
  assert.equal(result.top3.some((row) => row.name === "Scratched"), false);
  assert.equal(result.rows.find((row) => row.name === "Scratched")?.score, null);
  assert.equal(wide?.prediction?.modelRank, 1);
});

test("recent FormFav figures read the last character as the latest run", () => {
  const race: FormfavRace = {
    raceNumber: 1,
    raceName: null,
    distance: null,
    condition: null,
    weather: null,
    raceClass: null,
    prizeMoney: null,
    abandoned: false,
    startTime: null,
    timezone: null,
    numberOfRunners: 1,
    runnersIncluded: true,
    runners: [runner({ horseNumber: 4, name: "Recent", form: "91" })],
  };
  const result = rankFormfavRace(race, { ...DEFAULT_FORMFAV_WEIGHTS, recentForm: 100, career: 0, track: 0, distance: 0, trackDistance: 0, weight: 0, barrier: 0, classFit: 0, pace: 0 });
  assert.equal(result.rows[0].factors.find((factor) => factor.key === "recentForm")?.detail?.startsWith("Latest figures 1"), true);
});

test("a failed meeting request keeps the previous card but does not confirm today", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-"));
  const calls: string[] = [];
  const transport: FormfavTransport = {
    async get(requestPath) {
      calls.push(requestPath);
      if (requestPath === "/v1/form/venues") return { status: 200, body: { count: 2, venues: [] }, remaining: 900, retryAfter: null };
      return { status: 503, body: null, remaining: 899, retryAfter: null };
    },
  };
  const status = await syncFormfav({ transport, plan: "free", now: new Date("2026-10-18T12:00:00Z"), root, budget: 20, maxFormRaces: 0 });
  assert.equal(status.countries.za.coverage, "venues-listed");
  const stored = JSON.parse(fs.readFileSync(path.join(root, "meetings-za.json"), "utf8")) as { dates: Record<string, { confirmed: boolean; meetings: unknown[] }> };
  const today = Object.values(stored.dates)[0];
  assert.equal(today.confirmed, false);
  assert.equal(calls.includes("/v1/predictions"), false);
  assert.equal(parseRoute("#/meeting/2026-10-18/10").name, "meeting");
  assert.equal(parseRoute("#/ff/za").name, "ff-home");
});

test("an Australia horse link uses the saddle number and other countries stay plain routes", () => {
  assert.equal(australiaHorseHash("2026-10-19", "echuca", 1, 1), "#/ff/au/horse/2026-10-19/echuca/1/1");
  assert.equal(australiaHorseHash("2026-10-19", "royal randwick", 3, 8), "#/ff/au/horse/2026-10-19/royal%20randwick/3/8");
  assert.equal(australiaHorseHash("2026-10-19", "echuca", 1, null), null);
  const route = parseRoute("#/ff/au/horse/2026-10-19/royal%20randwick/3/8");
  assert.equal(route.name, "ff-horse");
  if (route.name === "ff-horse") {
    assert.equal(route.country, "au");
    assert.equal(route.slug, "royal randwick");
    assert.equal(route.horseNumber, 8);
  }
  assert.equal(parseRoute("#/ff/gb/horse/2026-10-19/newbury/1/1").name, "missing");
  assert.equal(parseRoute("#/ff/za/horse/2026-10-19/kenilworth/1/1").name, "missing");
  assert.equal(parseRoute("#/ff/nz/horse/2026-10-19/ellerslie/1/1").name, "missing");
  assert.equal(parseRoute("#/ff/au/horse/2026-10-19/echuca/1/Challenging").name, "missing");
  assert.equal(parseRoute("#/horse/63810/EQUINE%20POWER").name, "horse");
  const note = PREVIOUS_RUNS_DETAIL.join(" ");
  assert.match(note, /search_runner/);
  assert.match(note, /get_runner_profile/);
  assert.match(note, /GET \/v1\/stats\/runner\/search/);
  assert.match(note, /GET \/v1\/stats\/runner\/\{runner_id\}/);
  assert.match(note, /get_race_card/);
  assert.equal(formfavRate(null), "—");
  assert.equal(formfavRate(0), "0%");
  assert.equal(formfavRate(0.4), "40%");
});

test("international start times keep the course clock and add the device clock", () => {
  assert.equal(localClock("2026-10-19T02:30:00Z", "Australia/Melbourne", "Asia/Kolkata"), "13:30 AEDT · Your time 08:00 IST");
  assert.equal(localClock("2026-10-19T02:30:00Z", "Australia/Melbourne", "Asia/Calcutta"), "13:30 AEDT · Your time 08:00 IST");
  assert.equal(localClock("2026-10-18T12:50:00Z", "Europe/London", "Asia/Kolkata"), "13:50 BST · Your time 18:20 IST");
  assert.equal(localClock("2026-10-19T02:30:00Z", null, "Asia/Kolkata"), "02:30 UTC · Your time 08:00 IST");
  assert.equal(localClock(null, "Australia/Melbourne", "Asia/Kolkata"), "—");
  assert.equal(localClock("not-a-time", "Australia/Melbourne", "Asia/Kolkata"), "—");
});

test("no thoroughbred venues clears that country instead of leaving a schedule", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-empty-"));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "meetings-za.json"),
    JSON.stringify({ country: "za", source: "FormFav", region: "Region unavailable", dates: { "2026-10-18": { confirmed: true, fetchedAt: "2026-10-18T00:00:00Z", empty: false, error: null, meetings: [{ track: "Old" }] } } }),
  );
  const transport: FormfavTransport = {
    async get() {
      return { status: 200, body: { count: 0, venues: [] }, remaining: 10, retryAfter: null };
    },
  };
  const status = await syncFormfav({ transport, plan: "free", now: new Date("2026-10-18T12:00:00Z"), root, budget: 10, maxFormRaces: 0 });
  assert.equal(status.countries.za.coverage, "no-gallops-venues");
  const stored = JSON.parse(fs.readFileSync(path.join(root, "meetings-za.json"), "utf8")) as { dates: Record<string, unknown> };
  assert.deepEqual(stored.dates, {});
});

function runner(overrides: Partial<FormfavRace["runners"][number]>): FormfavRace["runners"][number] {
  return {
    horseNumber: 1,
    name: "Horse",
    barrier: null,
    jockey: null,
    trainer: null,
    weightKg: null,
    claimKg: null,
    age: null,
    sex: null,
    form: null,
    last20Starts: null,
    scratched: false,
    stats: { overall: null, track: null, distance: null, trackDistance: null, condition: null, firstUp: null, secondUp: null },
    speedMap: null,
    classRating: null,
    classDifference: null,
    decorators: [],
    prediction: null,
    fixedWin: null,
    ...overrides,
  };
}
