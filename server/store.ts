import fs from "node:fs";
import path from "node:path";
import { emptyLedger, type CreditLedger } from "./pe-model.ts";
import type { SourceReport, WireRace } from "../src/meetings/types.ts";

export interface DaySlice {
  updatedAt: string;
  races: WireRace[];
  error: string | null;
}

export interface CardSlice {
  updatedAt: string;
  races: WireRace[];
  error: string | null;
  complete: boolean;
}

export interface PuntersCache {
  source: SourceReport;
  horizonHours: number | null;
  venuesUpdatedAt: string | null;
  slices: Record<string, CardSlice>;
  nextToGo: CardSlice | null;
  changesSince: string | null;
  credits: CreditLedger;
  planBlocks: Record<string, string>;
  forms: Record<string, { updatedAt: string; body: unknown; error: string | null }>;
}

export interface FeedCache {
  days: Record<string, DaySlice>;
  racingApi: SourceReport;
  punters: PuntersCache;
}

const filePath = path.join(process.cwd(), "server", "data", "cache.json");

export function emptyPunters(): PuntersCache {
  return {
    source: {
      id: "puntersedge",
      name: "PuntersEdge",
      state: "unconfigured",
      detail: "Set PUNTERSEDGE_API_KEY. No racing calls are made until then.",
    },
    horizonHours: null,
    venuesUpdatedAt: null,
    slices: {},
    nextToGo: null,
    changesSince: null,
    credits: emptyLedger(),
    planBlocks: {},
    forms: {},
  };
}

export function emptyCache(): FeedCache {
  return {
    days: {},
    racingApi: {
      id: "theracingapi",
      name: "The Racing API",
      state: "unconfigured",
      detail: "Optional. Set RACING_API_USERNAME and RACING_API_PASSWORD to add UK and Irish racecards.",
    },
    punters: emptyPunters(),
  };
}

export function readCache(): FeedCache {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<FeedCache>;
    if (!parsed || typeof parsed !== "object") return emptyCache();
    return {
      days: parsed.days ?? {},
      racingApi: parsed.racingApi ?? emptyCache().racingApi,
      punters: { ...emptyPunters(), ...(parsed.punters ?? {}) },
    };
  } catch {
    return emptyCache();
  }
}

export function writeCache(cache: FeedCache): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(cache));
  fs.renameSync(temporary, filePath);
}
