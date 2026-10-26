import { emptyHorseStatistics, type HorseStatisticsFile } from "./horseStatistics";
import { cardKey, type CardSummary, type HandicapSummary, type IndiaFixture, type IndiaHandicapSheet, type IndiaMeeting } from "./types";

export interface MeetingsFile {
  timezone: "Asia/Kolkata";
  fixturesComplete: boolean;
  fixtures: IndiaFixture[];
  cards: Record<string, CardSummary>;
  handicaps: Record<string, HandicapSummary>;
}

export interface RacecardsFile {
  cards: Record<string, IndiaMeeting>;
  handicaps: Record<string, IndiaHandicapSheet>;
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
  handicaps: {},
};

interface PublishedIndia {
  cards: Record<string, IndiaMeeting>;
  handicaps: Record<string, IndiaHandicapSheet>;
}

let publishedIndia: Promise<PublishedIndia> | null = null;
let racecardBust = "";

export async function loadMeetings(cacheBust = ""): Promise<{ meetings: MeetingsFile; error: string | null }> {
  try {
    const response = await fetch(fresh("/data/meetings.json", cacheBust), { cache: "no-store" });
    if (!response.ok) throw new Error(`The meetings file could not be loaded (${response.status}).`);
    const meetings = (await response.json()) as MeetingsFile;
    return {
      meetings: {
        ...emptyMeetings,
        ...meetings,
        fixtures: meetings.fixtures ?? [],
        cards: meetings.cards ?? {},
        handicaps: meetings.handicaps ?? {},
      },
      error: null,
    };
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

async function loadPublishedIndia(cacheBust = ""): Promise<PublishedIndia> {
  if (!publishedIndia || racecardBust !== cacheBust) {
    racecardBust = cacheBust;
    publishedIndia = fetch(fresh("/data/racecards.json", cacheBust), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`The racecard file could not be loaded (${response.status}).`);
        const body = (await response.json()) as RacecardsFile;
        return { cards: body.cards ?? {}, handicaps: body.handicaps ?? {} };
      })
      .catch(() => ({ cards: {}, handicaps: {} }));
  }
  return publishedIndia;
}

export async function loadCard(date: string, venueId: string, cacheBust = ""): Promise<IndiaMeeting | null> {
  const published = await loadPublishedIndia(cacheBust);
  return published.cards[cardKey(date, venueId)] ?? null;
}

export async function loadHandicap(date: string, venueId: string, cacheBust = ""): Promise<IndiaHandicapSheet | null> {
  const published = await loadPublishedIndia(cacheBust);
  const sheet = published.handicaps[cardKey(date, venueId)] ?? null;
  if (!sheet || sheet.kind !== "handicap") return null;
  return sheet;
}

export async function loadHorseStatistics(): Promise<HorseStatisticsFile | null> {
  try {
    const response = await fetch(fresh("/data/horse-statistics.json", ""), { cache: "no-store" });
    if (!response.ok) return null;
    const body = (await response.json()) as HorseStatisticsFile;
    return { ...emptyHorseStatistics(), ...body, horses: body.horses ?? {} };
  } catch {
    return null;
  }
}
