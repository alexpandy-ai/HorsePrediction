import { scorePublishedForm } from "../engine/handicap";
import type { IndiaRace, IndiaRunner } from "./types";

export interface StrideWeights {
  recentForm: number;
  weight: number;
}

export const DEFAULT_STRIDE_WEIGHTS: StrideWeights = {
  recentForm: 70,
  weight: 30,
};

export interface UsedFactor {
  key: "recentForm" | "weight";
  label: string;
  status: "used" | "unavailable";
  score: number | null;
  detail: string;
}

export interface RankedRunner {
  runnerId: string;
  horseNumber: number | null;
  horse: string | null;
  status: IndiaRunner["status"];
  score: number | null;
  factors: UsedFactor[];
  excludedReason: string | null;
}

export interface HandicapResult {
  rows: RankedRunner[];
  top3: RankedRunner[];
  unavailableNote: string;
}

export function rankRace(race: IndiaRace, weights: StrideWeights): HandicapResult {
  const active = race.runners.filter((runner) => runner.status === "Runner");
  const weightsPresent = active.map((runner) => runner.weightKg).filter((value): value is number => value != null);
  const average = weightsPresent.length ? weightsPresent.reduce((sum, value) => sum + value, 0) / weightsPresent.length : null;
  const rows = race.runners.map((runner) => rankRunner(runner, weights, average));
  const eligible = rows
    .filter((row) => row.status === "Runner")
    .slice()
    .sort((a, b) => {
      if (a.score == null && b.score == null) return (a.horseNumber ?? 999) - (b.horseNumber ?? 999);
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      if (b.score !== a.score) return b.score - a.score;
      return (a.horseNumber ?? 999) - (b.horseNumber ?? 999);
    });
  const withdrawn = rows.filter((row) => row.status === "Withdrawn");
  return {
    rows: [...eligible, ...withdrawn],
    top3: eligible.filter((row) => row.score != null).slice(0, 3),
    unavailableNote: "Speed, pace, class change, distance and course records are not on this racecard, so they are not scored.",
  };
}

function rankRunner(runner: IndiaRunner, weights: StrideWeights, averageWeight: number | null): RankedRunner {
  const factors: UsedFactor[] = [formFactor(runner), weightFactor(runner, averageWeight)];
  if (runner.status === "Withdrawn") {
    return {
      runnerId: runner.id,
      horseNumber: runner.horseNumber,
      horse: runner.horse,
      status: runner.status,
      score: null,
      factors,
      excludedReason: "Withdrawn on the racecard.",
    };
  }
  const used = factors.filter((factor) => factor.status === "used" && factor.score != null && weights[factor.key] > 0);
  const weightSum = used.reduce((sum, factor) => sum + weights[factor.key], 0);
  const score =
    weightSum > 0 ? Math.round(used.reduce((sum, factor) => sum + (factor.score ?? 0) * weights[factor.key], 0) / weightSum) : null;
  return {
    runnerId: runner.id,
    horseNumber: runner.horseNumber,
    horse: runner.horse,
    status: runner.status,
    score,
    factors,
    excludedReason: score == null ? "No scored factor was available." : null,
  };
}

function formFactor(runner: IndiaRunner): UsedFactor {
  if (!runner.recentForm) {
    return { key: "recentForm", label: "Recent form", status: "unavailable", score: null, detail: "Recent form was not on the card." };
  }
  const scored = scorePublishedForm(runner.recentForm.replace(/\s+/g, ""), null);
  if (!scored) {
    return { key: "recentForm", label: "Recent form", status: "unavailable", score: null, detail: "Recent form did not contain finishing positions." };
  }
  return { key: "recentForm", label: "Recent form", status: "used", score: scored.score, detail: scored.note };
}

function weightFactor(runner: IndiaRunner, averageWeight: number | null): UsedFactor {
  if (runner.weightKg == null || averageWeight == null) {
    return { key: "weight", label: "Carried weight", status: "unavailable", score: null, detail: "Carried weight was not on the card." };
  }
  const score = Math.round(clamp(50 + (averageWeight - runner.weightKg) * 2));
  const comparison =
    averageWeight === runner.weightKg
      ? "It matches the only compared weight."
      : `The active field average is ${averageWeight.toFixed(1)} kg.`;
  return {
    key: "weight",
    label: "Carried weight",
    status: "used",
    score,
    detail: `Carries ${runner.weightKg} kg. ${comparison} Allowance stays on the card and is not added into the score.`,
  };
}

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}
