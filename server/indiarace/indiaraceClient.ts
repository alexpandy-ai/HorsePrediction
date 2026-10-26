import { horseStatisticsUrl } from "../../src/stride/horseStatistics.ts";

const BASE = "https://www.indiarace.com";
const DELAY_MS = 3000;
const USER_AGENT = "STRIDE/0.1 (public racecard reader; respects Indiarace crawl-delay)";

let lastRequest = 0;

export interface RawFixture {
  venueId: string;
  course: string;
  date: string;
}

export function racecardUrl(venueId: string, date: string): string {
  const query = new URLSearchParams({ event_date: date, race_type: "RACECARD", venueId });
  return `${BASE}/Home/racingCenterEvent?${query.toString()}`;
}

export function handicapsUrl(venueId: string, date: string): string {
  const query = new URLSearchParams({ event_date: date, race_type: "HANDICAPS", venueId });
  return `${BASE}/Home/racingCenterEvent?${query.toString()}`;
}

export async function fetchFixtures(): Promise<RawFixture[]> {
  const body = await getText(`${BASE}/Home/allRaceFixturesData`);
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("Indiarace fixture list was not JSON.");
  }
  if (!Array.isArray(payload)) throw new Error("Indiarace fixture list was not a list.");
  const fixtures: RawFixture[] = [];
  for (const item of payload) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const date = String(record.event_date ?? "");
    const venueId = String(record.venue_id ?? "");
    const course = String(record.event_name ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !venueId || !course) continue;
    fixtures.push({ date, venueId, course });
  }
  return fixtures;
}

export async function fetchRacecard(venueId: string, date: string): Promise<{ url: string; html: string }> {
  const url = racecardUrl(venueId, date);
  return { url, html: await getText(url) };
}

export async function fetchHandicaps(venueId: string, date: string): Promise<{ url: string; html: string }> {
  const url = handicapsUrl(venueId, date);
  return { url, html: await getText(url) };
}

export async function fetchHorseStatistics(id: string, name: string): Promise<string> {
  if (!/^\d+$/.test(id) || !name.trim()) throw new Error("Horse statistics need the source id and name.");
  return getText(horseStatisticsUrl(id, name));
}

async function getText(url: string): Promise<string> {
  const wait = DELAY_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequest = Date.now();
  const response = await fetch(url, {
    headers: { Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Indiarace returned ${response.status}.`);
  return response.text();
}
