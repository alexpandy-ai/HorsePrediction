import { cardKey, type CardSummary, type IndiaFixture, type IndiaMeeting } from "./types";

export interface MeetingsFile {
  timezone: "Asia/Kolkata";
  fixturesComplete: boolean;
  fixtures: IndiaFixture[];
  cards: Record<string, CardSummary>;
}

export interface RacecardsFile {
  cards: Record<string, IndiaMeeting>;
}

export interface LastUpdatedFile {
  publishedAt: string | null;
  source: "Indiarace";
  sourceUrl: "https://www.indiarace.com/";
  automaticPublishing: boolean;
  note: string;
}

const visit = `?v=${Date.now()}`;

function fresh(path: string, cacheBust: string): string {
  return `${path}${cacheBust || visit}`;
}

const emptyMeetings: MeetingsFile = {
  timezone: "Asia/Kolkata",
  fixturesComplete: false,
  fixtures: [],
  cards: {},
};

let racecards: Promise<Record<string, IndiaMeeting>> | null = null;
let racecardBust = "";

export async function loadMeetings(cacheBust = ""): Promise<{ meetings: MeetingsFile; error: string | null }> {
  try {
    const response = await fetch(fresh("/data/meetings.json", cacheBust), { cache: "no-store" });
    if (!response.ok) throw new Error(`The meetings file could not be loaded (${response.status}).`);
    const meetings = (await response.json()) as MeetingsFile;
    return { meetings: { ...emptyMeetings, ...meetings, fixtures: meetings.fixtures ?? [], cards: meetings.cards ?? {} }, error: null };
  } catch (reason) {
    return { meetings: emptyMeetings, error: reason instanceof Error ? reason.message : "The meetings file could not be loaded." };
  }
}

export async function loadLastUpdated(cacheBust = ""): Promise<LastUpdatedFile | null> {
  try {
    const response = await fetch(fresh("/data/last-updated.json", cacheBust), { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as LastUpdatedFile;
  } catch {
    return null;
  }
}

export async function loadCard(date: string, venueId: string, cacheBust = ""): Promise<IndiaMeeting | null> {
  if (!racecards || racecardBust !== cacheBust) {
    racecardBust = cacheBust;
    racecards = fetch(fresh("/data/racecards.json", cacheBust), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The racecard file could not be loaded (${response.status}).`);
        const body = (await response.json()) as RacecardsFile;
        return body.cards ?? {};
      })
      .catch(() => ({}));
  }
  const cards = await racecards;
  return cards[cardKey(date, venueId)] ?? null;
}
