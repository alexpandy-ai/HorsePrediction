import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fetchRacingApiDay } from "./provider.ts";
import { readCache, writeCache, type FeedCache } from "./store.ts";
import { dedupeRaces, londonWindow } from "./logic.ts";
import { findPuntersRace, loadFeature, puntersMeetings, refreshPunters } from "./pe-sync.ts";
import { USER_TIMEZONE, calendarDate } from "../src/meetings/time.ts";
import { SYDNEY } from "./pe-model.ts";
import type { MeetingsPayload, WireRace } from "../src/meetings/types.ts";

const PORT = Number(process.env.PORT || 8787);
const REFRESH_MS = 5 * 60 * 1000;
const SOURCE = "The Racing API free racecards";

loadEnv(path.join(process.cwd(), ".env"));

let cache = readCache();
let refreshing = false;

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function credentials(): { username: string; password: string } | null {
  const username = process.env.RACING_API_USERNAME?.trim();
  const password = process.env.RACING_API_PASSWORD?.trim();
  if (!username || !password) return null;
  return { username, password };
}

async function refresh(): Promise<void> {
  if (refreshing) return;
  refreshing = true;
  try {
    const apiKey = process.env.PUNTERSEDGE_API_KEY?.trim() || null;
    cache = { ...cache, punters: await refreshPunters(cache.punters, apiKey) };
    const creds = credentials();
    if (!creds) {
      cache.racingApi = {
        id: "theracingapi",
        name: "The Racing API",
        state: "unconfigured",
        detail: "Optional. UK and Irish racecards are added when RACING_API_USERNAME and RACING_API_PASSWORD are set.",
      };
    } else {
      const next: FeedCache = { ...cache, days: { ...cache.days } };
      const window = londonWindow(new Date());
      for (const day of ["today", "tomorrow"] as const) {
        const key = day === "today" ? window.today : window.tomorrow;
        try {
          const races = await fetchRacingApiDay(day, creds.username, creds.password);
          next.days[key] = { updatedAt: new Date().toISOString(), races, error: null };
        } catch (error) {
          const previous = next.days[key];
          const message = error instanceof Error ? error.message : "The Racing API request failed.";
          next.days[key] = previous
            ? { ...previous, error: message }
            : { updatedAt: new Date().toISOString(), races: [], error: message };
        }
      }
      next.racingApi = {
        id: "theracingapi",
        name: "The Racing API",
        state: Object.values(next.days).some((day) => day.error) ? "failed" : "ok",
        detail: SOURCE,
      };
      cache = next;
    }
    writeCache(cache);
  } finally {
    refreshing = false;
  }
}

export function meetingsFor(requestedDate: string): MeetingsPayload {
  const pe = puntersMeetings(cache.punters, requestedDate);
  const ra = racingMeetings(requestedDate);
  const races = dedupeRaces([...pe.races, ...ra.races]);
  const sources = [...pe.sources, cache.racingApi];
  if (races.length === 0 && pe.mode !== "schedule") return { ...pe, sources };
  return {
    ...pe,
    mode: "schedule",
    races,
    sources,
    stale: pe.stale || ra.stale,
    staleReason: pe.staleReason || ra.staleReason,
    lastUpdated: pe.lastUpdated ?? ra.lastUpdated,
  };
}

function racingMeetings(requestedDate: string): { races: WireRace[]; stale: boolean; staleReason: string | null; lastUpdated: string | null } {
  if (cache.racingApi.state === "unconfigured") return { races: [], stale: false, staleReason: null, lastUpdated: null };
  const races = dedupeRaces(
    Object.values(cache.days).flatMap((day) => day.races.filter((race) => race.localDate === requestedDate || race.meetingDate === requestedDate)),
  );
  const slice = cache.days[requestedDate];
  return {
    races,
    stale: Boolean(slice?.error),
    staleReason: slice?.error ?? null,
    lastUpdated: slice?.updatedAt ?? null,
  };
}

function racingRace(id: string): { race: WireRace; lastUpdated: string | null; stale: boolean; staleReason: string | null } | null {
  for (const day of Object.values(cache.days)) {
    const race = day.races.find((item) => item.id === id);
    if (race) return { race, lastUpdated: day.updatedAt, stale: Boolean(day.error), staleReason: day.error };
  }
  return null;
}

export function raceById(id: string): { race: WireRace; lastUpdated: string | null; stale: boolean; staleReason: string | null } | null {
  return findPuntersRace(cache.punters, id) ?? racingRace(id);
}

function send(res: http.ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "GET" && url.pathname === "/api/health") {
    send(res, 200, { ok: true, userTimezone: USER_TIMEZONE, source: cache.punters.source, budget: cache.punters.credits });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/meetings") {
    const date = url.searchParams.get("date") ?? calendarDate(SYDNEY, new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      send(res, 400, { message: "Use a YYYY-MM-DD date." });
      return;
    }
    send(res, 200, meetingsFor(date));
    return;
  }
  if (req.method === "GET" && url.pathname.startsWith("/api/races/")) {
    const rest = decodeURIComponent(url.pathname.slice("/api/races/".length));
    const slash = rest.indexOf("/");
    const id = slash === -1 ? rest : rest.slice(0, slash);
    const feature = slash === -1 ? "" : rest.slice(slash + 1);
    const found = raceById(id);
    if (!feature) {
      if (!found) {
        send(res, 404, { message: "This race is not in the current feed." });
        return;
      }
      send(res, 200, found);
      return;
    }
    const providerId = found?.race.providerId ?? id.replace(/^pe:/, "");
    const featureQuery: Record<string, { path: string; query: Record<string, string | undefined>; cost: number }> = {
      form: { path: "/racing/form", query: { race_id: providerId, runs: "10" }, cost: 3 },
      "best-odds": { path: "/racing/best-odds", query: { limit: "10", category: "horse", include_unresolved: "true" }, cost: 3 },
      markets: { path: "/racing/markets", query: { race_id: providerId }, cost: 2 },
      consensus: { path: "/racing/consensus", query: { race_id: providerId }, cost: 3 },
      intelligence: { path: "/racing/intelligence", query: { race_id: providerId }, cost: 3 },
      "price-history": { path: "/racing/price-history", query: { race_id: providerId, include_points: "false" }, cost: 5 },
      track: { path: "/racing/track-conditions", query: { date: found?.race.meetingDate }, cost: 1 },
    };
    const selected = featureQuery[feature];
    if (!selected || !found) {
      send(res, 404, { message: "This race detail is not available." });
      return;
    }
    const loaded = await loadFeature(cache.punters, process.env.PUNTERSEDGE_API_KEY?.trim() || null, selected.path, selected.query, selected.cost);
    const planBlocks = loaded.kind === "plan" && loaded.error ? { ...cache.punters.planBlocks, [selected.path]: loaded.error } : cache.punters.planBlocks;
    cache = { ...cache, punters: { ...cache.punters, credits: loaded.credits, planBlocks } };
    writeCache(cache);
    send(res, 200, { available: !loaded.error, message: loaded.error, body: loaded.body, source: "PuntersEdge" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/scan") {
    const loaded = await loadFeature(
      cache.punters,
      process.env.PUNTERSEDGE_API_KEY?.trim() || null,
      "/racing/intelligence/scan",
      { category: "horse", limit: "20" },
      5,
    );
    const planBlocks = loaded.kind === "plan" && loaded.error ? { ...cache.punters.planBlocks, "/racing/intelligence/scan": loaded.error } : cache.punters.planBlocks;
    cache = { ...cache, punters: { ...cache.punters, credits: loaded.credits, planBlocks } };
    writeCache(cache);
    send(res, 200, { available: !loaded.error, message: loaded.error, body: loaded.body, source: "PuntersEdge" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/movers") {
    const loaded = await loadFeature(cache.punters, process.env.PUNTERSEDGE_API_KEY?.trim() || null, "/racing/movers", { category: "horse", limit: "20" }, 3);
    cache = { ...cache, punters: { ...cache.punters, credits: loaded.credits } };
    writeCache(cache);
    send(res, 200, { available: !loaded.error, message: loaded.error, body: loaded.body, source: "PuntersEdge" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/horse") {
    const kind = url.searchParams.get("kind") === "runs" ? "runs" : "form";
    const name = url.searchParams.get("name")?.trim() ?? "";
    if (name.length < 2) {
      send(res, 400, { available: false, message: "Enter at least two characters of the horse name." });
      return;
    }
    const loaded = await loadFeature(
      cache.punters,
      process.env.PUNTERSEDGE_API_KEY?.trim() || null,
      kind === "runs" ? "/racing/horses/runs" : "/racing/horses/form",
      { horse: name },
      3,
    );
    cache = { ...cache, punters: { ...cache.punters, credits: loaded.credits } };
    writeCache(cache);
    send(res, 200, { available: !loaded.error, message: loaded.error, body: loaded.body, source: "PuntersEdge" });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/stats") {
    const role = url.searchParams.get("role") === "trainer" ? "trainer" : "jockey";
    const name = url.searchParams.get("name")?.trim() ?? "";
    if (name.length < 2) {
      send(res, 400, { available: false, message: "Enter at least two characters of the name." });
      return;
    }
    const loaded = await loadFeature(
      cache.punters,
      process.env.PUNTERSEDGE_API_KEY?.trim() || null,
      role === "trainer" ? "/racing/trainers/stats" : "/racing/jockeys/stats",
      { name },
      2,
    );
    cache = { ...cache, punters: { ...cache.punters, credits: loaded.credits } };
    writeCache(cache);
    send(res, 200, { available: !loaded.error, message: loaded.error, body: loaded.body, source: "PuntersEdge" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/refresh") {
    const required = process.env.REFRESH_TOKEN?.trim();
    if (required && req.headers.authorization !== `Bearer ${required}`) {
      send(res, 401, { message: "Refresh token required." });
      return;
    }
    void refresh().then(() => send(res, 200, { ok: true, source: cache.racingApi }));
    return;
  }
  send(res, 404, { message: "Not found." });
});

void refresh().finally(() => {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`Racing feed listening on http://127.0.0.1:${PORT}`);
  });
  setInterval(() => {
    void refresh();
  }, REFRESH_MS);
});
