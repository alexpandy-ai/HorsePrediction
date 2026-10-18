import type { FormfavRace, FormfavRunner, FormfavStatLine } from "./types";

export interface FormfavWeights {
  recentForm: number;
  career: number;
  track: number;
  distance: number;
  trackDistance: number;
  weight: number;
  barrier: number;
  classFit: number;
  pace: number;
}

export const DEFAULT_FORMFAV_WEIGHTS: FormfavWeights = {
  recentForm: 20,
  career: 12,
  track: 10,
  distance: 10,
  trackDistance: 12,
  weight: 10,
  barrier: 8,
  classFit: 8,
  pace: 10,
};

export interface FormfavFactor {
  key: keyof FormfavWeights | "jockey" | "trainer" | "bias";
  label: string;
  status: "used" | "unavailable";
  score: number | null;
  detail: string;
}

export interface FormfavRank {
  horseNumber: number | null;
  name: string | null;
  scratched: boolean;
  score: number | null;
  factors: FormfavFactor[];
  prediction: FormfavRunner["prediction"];
}

export interface FormfavHandicap {
  rows: FormfavRank[];
  top3: FormfavRank[];
  note: string;
}

const BARRIER_RULE = "Inside barriers score higher: 1–4 scores 70, 5–8 scores 55, and 9 or wider scores 40. A missing barrier is not scored.";

export function rankFormfavRace(race: FormfavRace, weights: FormfavWeights): FormfavHandicap {
  const active = race.runners.filter((runner) => !runner.scratched);
  const carried = active.map(carriedWeight).filter((value): value is number => value != null);
  const average = carried.length ? carried.reduce((sum, value) => sum + value, 0) / carried.length : null;
  const rows = race.runners.map((runner) => rankRunner(runner, weights, average));
  const eligible = rows
    .filter((row) => !row.scratched)
    .sort((a, b) => {
      if (a.score == null && b.score == null) return (a.horseNumber ?? 999) - (b.horseNumber ?? 999);
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score || (a.horseNumber ?? 999) - (b.horseNumber ?? 999);
    });
  return {
    rows: [...eligible, ...rows.filter((row) => row.scratched)],
    top3: eligible.filter((row) => row.score != null).slice(0, 3),
    note: `FormFav predictions are shown separately and are not STRIDE scores. Jockey statistics, trainer statistics and track bias are not in this snapshot. ${BARRIER_RULE}`,
  };
}

function rankRunner(runner: FormfavRunner, weights: FormfavWeights, averageWeight: number | null): FormfavRank {
  const factors: FormfavFactor[] = [
    formFactor(runner),
    percentFactor("career", "Career", runner.stats.overall),
    percentFactor("track", "Track", runner.stats.track),
    percentFactor("distance", "Distance", runner.stats.distance),
    percentFactor("trackDistance", "Track and distance", runner.stats.trackDistance),
    weightFactor(runner, averageWeight),
    barrierFactor(runner),
    classFactor(runner),
    paceFactor(runner),
    { key: "jockey", label: "Jockey", status: "unavailable", score: null, detail: "Jockey statistics were not requested for this runner." },
    { key: "trainer", label: "Trainer", status: "unavailable", score: null, detail: "Trainer statistics were not requested for this runner." },
    { key: "bias", label: "Track bias", status: "unavailable", score: null, detail: "Track bias was not included in this snapshot." },
  ];
  if (runner.scratched) {
    return { horseNumber: runner.horseNumber, name: runner.name, scratched: true, score: null, factors, prediction: runner.prediction };
  }
  const used = factors.filter((factor): factor is FormfavFactor & { key: keyof FormfavWeights; score: number } => {
    return factor.status === "used" && factor.score != null && factor.key in weights && weights[factor.key as keyof FormfavWeights] > 0;
  });
  const weightSum = used.reduce((sum, factor) => sum + weights[factor.key], 0);
  const score = weightSum > 0 ? Math.round(used.reduce((sum, factor) => sum + factor.score * weights[factor.key], 0) / weightSum) : null;
  return { horseNumber: runner.horseNumber, name: runner.name, scratched: false, score, factors, prediction: runner.prediction };
}

function formFactor(runner: FormfavRunner): FormfavFactor {
  const positions = formfavPositions(runner.form);
  if (positions.length === 0) {
    return { key: "recentForm", label: "Recent form", status: "unavailable", score: null, detail: "No FormFav finishing figures were supplied." };
  }
  const latestFirst = positions.slice(-5).reverse();
  const weights = [0.34, 0.26, 0.18, 0.12, 0.1].slice(0, latestFirst.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const score = latestFirst.reduce((sum, position, index) => sum + positionScore(position) * weights[index], 0) / weightSum;
  return { key: "recentForm", label: "Recent form", status: "used", score: Math.round(score), detail: `Latest figures ${latestFirst.slice(0, 3).join("-")}.` };
}

export function formfavPositions(form: string | null): number[] {
  if (!form) return [];
  const positions: number[] = [];
  for (const char of form.trim()) {
    if (char === "x" || char === "X") continue;
    if (char >= "1" && char <= "9") positions.push(Number(char));
    else if (char === "0") positions.push(10);
  }
  return positions;
}

function percentFactor(key: keyof FormfavWeights, label: string, line: FormfavStatLine | null): FormfavFactor {
  if (line?.winPercent == null || line.starts === 0) {
    return { key, label, status: "unavailable", score: null, detail: line?.starts === 0 ? "No starts in this split." : "This split was not supplied." };
  }
  return { key, label, status: "used", score: clamp(line.winPercent), detail: `${line.winPercent}% wins from ${line.starts ?? "—"} starts.` };
}

function weightFactor(runner: FormfavRunner, average: number | null): FormfavFactor {
  const carried = carriedWeight(runner);
  if (carried == null || average == null) {
    return { key: "weight", label: "Weight", status: "unavailable", score: null, detail: "Allocated weight was not supplied." };
  }
  const claim = runner.claimKg != null ? ` Claim ${runner.claimKg} kg is subtracted for the weight carried.` : "";
  return {
    key: "weight",
    label: "Weight",
    status: "used",
    score: clamp(50 + (average - carried) * 2),
    detail: `${carried} kg carried against a field average of ${average.toFixed(1)} kg.${claim}`,
  };
}

function barrierFactor(runner: FormfavRunner): FormfavFactor {
  if (runner.barrier == null) {
    return { key: "barrier", label: "Barrier", status: "unavailable", score: null, detail: "Barrier was not supplied and is not treated as neutral." };
  }
  const score = runner.barrier <= 4 ? 70 : runner.barrier <= 8 ? 55 : 40;
  return { key: "barrier", label: "Barrier", status: "used", score, detail: `Barrier ${runner.barrier}. ${BARRIER_RULE}` };
}

function classFactor(runner: FormfavRunner): FormfavFactor {
  if (runner.classDifference != null) {
    return { key: "classFit", label: "Class", status: "used", score: clamp(50 - runner.classDifference), detail: "Positive class difference means the runner is stepping up." };
  }
  if (runner.classRating != null) {
    return { key: "classFit", label: "Class", status: "used", score: clamp(runner.classRating), detail: "FormFav current class rating, 0 to 100." };
  }
  return { key: "classFit", label: "Class", status: "unavailable", score: null, detail: "Class profile was not supplied. It is a Pro field on the race form." };
}

function paceFactor(runner: FormfavRunner): FormfavFactor {
  const pace = runner.speedMap;
  if (pace?.earlySpeedIndex != null) {
    return { key: "pace", label: "Pace", status: "used", score: clamp(pace.earlySpeedIndex * 10), detail: `Early speed index ${pace.earlySpeedIndex} on a 0–10 scale.` };
  }
  const style = pace?.runningStyle;
  const mapped = style === "L" ? 80 : style === "P" ? 65 : style === "M" ? 50 : style === "B" ? 35 : null;
  if (mapped == null) return { key: "pace", label: "Pace", status: "unavailable", score: null, detail: "Speed map was not supplied. It is a Pro field on the race form." };
  return { key: "pace", label: "Pace", status: "used", score: mapped, detail: `Running style ${style}.` };
}

function carriedWeight(runner: FormfavRunner): number | null {
  if (runner.weightKg == null) return null;
  return runner.claimKg != null ? runner.weightKg - runner.claimKg : runner.weightKg;
}

function positionScore(position: number): number {
  if (position <= 1) return 100;
  if (position === 2) return 80;
  if (position === 3) return 64;
  if (position === 4) return 50;
  if (position === 5) return 38;
  if (position === 6) return 28;
  if (position === 7) return 20;
  if (position === 8) return 14;
  return 8;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
