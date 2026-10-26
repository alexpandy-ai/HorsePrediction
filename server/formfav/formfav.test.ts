import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseRoute } from "../../src/router.ts";
import { australiaHorseHash, PREVIOUS_RUNS_DETAIL } from "../../src/stride/formfav/horse.ts";
import { deviceLocalClock, formfavRate, localClock } from "../../src/stride/formfav/present.ts";
import { meetingsFromResponse, raceFromForm } from "../../src/stride/formfav/normalize.ts";
import { rankFormfavRace } from "../../src/stride/formfav/handicap.ts";
import type { FormfavRace } from "../../src/stride/formfav/types.ts";
import { DEFAULT_FORMFAV_WEIGHTS } from "../../src/stride/formfav/handicap.ts";
import { adoptPublishedSnapshot } from "./adopt.ts";
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

test("meeting race clocks show only the device zone", () => {
  assert.equal(deviceLocalClock("2026-10-19T02:30:00Z", "Asia/Kolkata"), "08:00 IST");
  assert.equal(deviceLocalClock("2026-10-19T02:30:00Z", "Asia/Calcutta"), "08:00 IST");
  assert.equal(deviceLocalClock("2026-10-18T12:50:00Z", "Asia/Kolkata"), "18:20 IST");
  assert.equal(deviceLocalClock(null, "Asia/Kolkata"), "—");
  assert.equal(deviceLocalClock("not-a-time", "Asia/Kolkata"), "—");
  assert.equal(deviceLocalClock("2026-10-19T02:30:00Z", "Not/AZone"), "—");
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

test("a venue rate limit keeps the stored Australia card and the other country notes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-limit-"));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "meetings-au.json"), JSON.stringify(storedAustralia("2026-10-26", "Stored Track")));
  fs.writeFileSync(path.join(root, "racecards.json"), JSON.stringify({ cards: { "au:2026-10-26:stored-track:1": { track: "Stored Track" } } }));
  fs.writeFileSync(path.join(root, "import-status.json"), JSON.stringify(storedStatus()));
  const calls: string[] = [];
  const transport: FormfavTransport = {
    async get(requestPath) {
      calls.push(requestPath);
      return { status: 429, body: null, remaining: null, retryAfter: 30 };
    },
  };
  const status = await syncFormfav({ transport, plan: "free", now: new Date("2026-10-26T02:00:00Z"), root, budget: 20, maxFormRaces: 0 });
  assert.equal(status.lastError, "FormFav rate limit reached.");
  assert.equal(status.requestsUsed, 1);
  assert.equal(status.lastSuccessAt, "2026-10-26T10:23:00.000Z");
  assert.match(status.countries.au.note, /HTTP 429/);
  assert.equal(status.countries.gb.note, "FormFav lists 63 thoroughbred venues for United Kingdom.");
  assert.deepEqual(calls, ["/v1/form/venues"]);
  const stored = JSON.parse(fs.readFileSync(path.join(root, "meetings-au.json"), "utf8")) as { dates: Record<string, { confirmed: boolean; meetings: Array<{ track: string }> }> };
  assert.equal(stored.dates["2026-10-26"].confirmed, true);
  assert.deepEqual(stored.dates["2026-10-26"].meetings.map((meeting) => meeting.track), ["Stored Track"]);
  const cards = JSON.parse(fs.readFileSync(path.join(root, "racecards.json"), "utf8")) as { cards: Record<string, { track: string }> };
  assert.equal(cards.cards["au:2026-10-26:stored-track:1"].track, "Stored Track");
});

test("a meeting rate limit does not replace a stored Australia card with a partial timezone", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-partial-"));
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "meetings-au.json"), JSON.stringify(storedAustralia("2026-10-26", "Stored Track")));
  const transport: FormfavTransport = {
    async get(requestPath, query) {
      if (requestPath === "/v1/form/venues") return { status: 200, body: { count: 1, venues: [{}] }, remaining: 50, retryAfter: null };
      if (query.timezone === "Australia/Sydney") {
        return {
          status: 200,
          body: { meetings: [{ track: "Partial", slug: "partial", country: "au", races: [{ raceNumber: 1 }] }] },
          remaining: 49,
          retryAfter: null,
        };
      }
      return { status: 429, body: null, remaining: 0, retryAfter: 30 };
    },
  };
  const status = await syncFormfav({ transport, plan: "free", now: new Date("2026-10-26T02:00:00Z"), root, budget: 20, maxFormRaces: 0 });
  assert.equal(status.lastError, "FormFav rate limit reached.");
  const stored = JSON.parse(fs.readFileSync(path.join(root, "meetings-au.json"), "utf8")) as { dates: Record<string, { confirmed: boolean; meetings: Array<{ track: string }> }> };
  assert.equal(stored.dates["2026-10-26"].confirmed, true);
  assert.deepEqual(stored.dates["2026-10-26"].meetings.map((meeting) => meeting.track), ["Stored Track"]);
});

test("a newer published snapshot replaces the checkout and an older one does not", async () => {
  const older = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-older-"));
  fs.mkdirSync(older, { recursive: true });
  fs.writeFileSync(path.join(older, "meetings-au.json"), JSON.stringify(storedAustralia("2026-10-19", "Checkout Track")));
  fs.writeFileSync(path.join(older, "import-status.json"), JSON.stringify({ ...storedStatus(), generatedAt: "2026-10-18T18:28:59.193Z" }));
  const calls: string[] = [];
  const adopted = await adoptPublishedSnapshot("https://horsepredictor.example", older, async (url) => {
    calls.push(String(url));
    const file = String(url).split("/").pop();
    if (file === "import-status.json") return jsonResponse({ ...storedStatus(), generatedAt: "2026-10-26T10:23:00.000Z" });
    if (file === "meetings-au.json") return jsonResponse(storedAustralia("2026-10-26", "Published Track"));
    if (file === "racecards.json") return jsonResponse({ cards: { "au:2026-10-26:published-track:1": { track: "Published Track" } } });
    const country = file === "meetings-uk.json" ? "gb" : file === "meetings-za.json" ? "za" : "nz";
    return jsonResponse({ country, source: "FormFav", region: "Region unavailable", dates: {} });
  });
  assert.equal(adopted, "adopted");
  assert.equal(calls.length, 6);
  const stored = JSON.parse(fs.readFileSync(path.join(older, "meetings-au.json"), "utf8")) as { dates: Record<string, { meetings: Array<{ track: string }> }> };
  assert.deepEqual(stored.dates["2026-10-26"].meetings.map((meeting) => meeting.track), ["Published Track"]);

  const newer = fs.mkdtempSync(path.join(os.tmpdir(), "formfav-newer-"));
  fs.mkdirSync(newer, { recursive: true });
  fs.writeFileSync(path.join(newer, "meetings-au.json"), JSON.stringify(storedAustralia("2026-10-26", "Local Track")));
  fs.writeFileSync(path.join(newer, "import-status.json"), JSON.stringify(storedStatus()));
  let statusReads = 0;
  const kept = await adoptPublishedSnapshot("https://horsepredictor.example", newer, async (url) => {
    statusReads += 1;
    assert.match(String(url), /import-status\.json$/);
    return jsonResponse({ ...storedStatus(), generatedAt: "2026-10-26T09:00:00.000Z" });
  });
  assert.equal(kept, "kept-local");
  assert.equal(statusReads, 1);
  const local = JSON.parse(fs.readFileSync(path.join(newer, "meetings-au.json"), "utf8")) as { dates: Record<string, { meetings: Array<{ track: string }> }> };
  assert.deepEqual(local.dates["2026-10-26"].meetings.map((meeting) => meeting.track), ["Local Track"]);
});

function storedAustralia(date: string, track: string) {
  return {
    country: "au",
    source: "FormFav",
    region: "Region unavailable",
    dates: {
      [date]: {
        confirmed: true,
        fetchedAt: "2026-10-26T10:23:00.000Z",
        empty: false,
        error: null,
        meetings: [
          {
            country: "au",
            track,
            slug: "stored-track",
            date,
            abandoned: false,
            region: "Region unavailable",
            source: "FormFav",
            races: [],
          },
        ],
      },
    },
  };
}

function storedStatus() {
  return {
    source: "FormFav",
    sourceUrl: "https://api.formfav.com",
    configured: true,
    plan: "free",
    generatedAt: "2026-10-26T10:23:00.000Z",
    lastSuccessAt: "2026-10-26T10:23:00.000Z",
    lastError: null,
    requestsUsed: 144,
    countries: {
      au: { coverage: "venues-listed", venueCount: 330, note: "FormFav lists 330 thoroughbred venues for Australia." },
      gb: { coverage: "venues-listed", venueCount: 63, note: "FormFav lists 63 thoroughbred venues for United Kingdom." },
      za: { coverage: "venues-listed", venueCount: 7, note: "FormFav lists 7 thoroughbred venues for South Africa." },
      nz: { coverage: "venues-listed", venueCount: 39, note: "FormFav lists 39 thoroughbred venues for New Zealand." },
    },
    planNote: "test",
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

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
