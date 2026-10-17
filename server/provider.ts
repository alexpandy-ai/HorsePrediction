import { dedupeRaces, normalizeRacecard, type RawRacecard } from "./logic.ts";
import type { WireRace } from "../src/meetings/types.ts";

const SOURCE = "The Racing API";
const MIN_GAP_MS = 1100;

let lastCall = 0;

async function limitedFetch(url: string, username: string, password: string): Promise<Response> {
  const wait = MIN_GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastCall = Date.now();
  const token = Buffer.from(`${username}:${password}`).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Authorization: `Basic ${token}`, Accept: "application/json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRacingApiDay(day: "today" | "tomorrow", username: string, password: string): Promise<WireRace[]> {
  const races: WireRace[] = [];
  let skip = 0;
  let total = Infinity;
  while (skip < total && skip <= 500) {
    const url = `https://api.theracingapi.com/v1/racecards/free?day=${day}&limit=500&skip=${skip}`;
    const response = await limitedFetch(url, username, password);
    if (!response.ok) {
      throw new Error(`The Racing API returned HTTP ${response.status} for ${day}.`);
    }
    const body = (await response.json()) as { racecards?: RawRacecard[]; total?: number; limit?: number };
    const page = body.racecards ?? [];
    total = typeof body.total === "number" ? body.total : page.length;
    for (const card of page) {
      const race = normalizeRacecard(card, SOURCE);
      if (race) races.push(race);
    }
    if (page.length === 0) break;
    skip += page.length;
  }
  return dedupeRaces(races);
}
