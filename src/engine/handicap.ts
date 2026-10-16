import { carriedKg } from "../format";
import type { PaceStyle, Race, Runner } from "../types";

export const FACTOR_KEYS = [
  "recentForm",
  "speed",
  "pace",
  "classChange",
  "weight",
  "rating",
  "distance",
  "course",
] as const;

export type FactorKey = (typeof FACTOR_KEYS)[number];

export interface FactorDef {
  key: FactorKey;
  label: string;
  blurb: string;
}

export const FACTORS: FactorDef[] = [
  {
    key: "recentForm",
    label: "Recent form",
    blurb: "Finishing positions, weighted to the latest runs, with a small adjustment for a long break or a very quick return.",
  },
  {
    key: "speed",
    label: "Speed figures",
    blurb: "Average of the last three calculated speed figures, ranked against this field.",
  },
  {
    key: "pace",
    label: "Pace",
    blurb: "Running style set against how much early speed is declared in the race.",
  },
  {
    key: "classChange",
    label: "Class change",
    blurb: "Whether the horse drops, rises, or repeats the class of its previous start.",
  },
  {
    key: "weight",
    label: "Weight",
    blurb: "Change from the weight carried last start, and how today's weight sits against the field.",
  },
  {
    key: "rating",
    label: "Rating movement",
    blurb: "Change in the official handicap mark since the previous start. The mark itself stays in the official column.",
  },
  {
    key: "distance",
    label: "Distance",
    blurb: "Wins and places at today's distance. Thin samples are pulled back toward average.",
  },
  {
    key: "course",
    label: "Course and going",
    blurb: "Record at this racecourse and on today's going. Thin samples are pulled back toward average.",
  },
];

export type Weights = Record<FactorKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  recentForm: 20,
  speed: 16,
  pace: 10,
  classChange: 14,
  weight: 10,
  rating: 10,
  distance: 10,
  course: 10,
};

export interface FactorScore {
  score: number;
  note: string;
}

export type PaceLabel = "Strong" | "Even" | "Soft";

export interface PaceRead {
  label: PaceLabel;
  forward: number;
  detail: string;
}

export interface HandicapResult {
  runner: Runner;
  total: number;
  factors: Record<FactorKey, FactorScore>;
  modelRank: number;
  officialRank: number | null;
}

export interface Analysis {
  pace: PaceRead;
  ranked: HandicapResult[];
  scratched: Runner[];
  fieldAverageRating: number | null;
}

const PACE_SCORE: Record<PaceLabel, Record<PaceStyle, number>> = {
  Strong: { Leader: 40, Prominent: 56, Midfield: 72, Closer: 86 },
  Even: { Leader: 66, Prominent: 70, Midfield: 68, Closer: 62 },
  Soft: { Leader: 84, Prominent: 76, Midfield: 58, Closer: 46 },
};

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function recordScore(runs: number, wins: number, places: number): { score: number; detail: string } {
  if (runs <= 0) return { score: 50, detail: "no runs" };
  const winRate = wins / runs;
  const placeRate = (wins + places) / runs;
  const raw = (winRate * 0.65 + placeRate * 0.35) * 100;
  const score = clamp((raw * runs + 50 * 3) / (runs + 3));
  const winWord = wins === 1 ? "win" : "wins";
  const placeWord = places === 1 ? "place" : "places";
  return { score, detail: `${wins} ${winWord} and ${places} ${placeWord} from ${runs}` };
}

function formFactor(runner: Runner): FactorScore {
  const positions = runner.form
    .split("-")
    .map((token) => Number(token))
    .filter((position) => Number.isFinite(position) && position > 0);
  if (positions.length === 0) {
    return { score: 50, note: "No finishing record on the card." };
  }
  const weights = [0.34, 0.26, 0.18, 0.12, 0.1].slice(0, positions.length);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  let score = positions.reduce((sum, position, index) => sum + positionScore(position) * weights[index], 0) / weightSum;
  const notes = [`Latest figures ${positions.slice(0, 3).join("-")}.`];
  if (runner.daysSince != null && runner.daysSince > 49) {
    score -= 6;
    notes.push("Long break since the last run.");
  } else if (runner.daysSince != null && runner.daysSince > 35) {
    score -= 3;
    notes.push("A little while between runs.");
  } else if (runner.daysSince != null && runner.daysSince < 8) {
    score -= 3;
    notes.push("Very quick return.");
  }
  return { score: Math.round(clamp(score)), note: notes.join(" ") };
}

function classFactor(runner: Runner, race: Race): FactorScore {
  if (runner.lastClassLevel == null || runner.lastClassLabel == null) {
    return { score: 50, note: "No previous class to compare." };
  }
  const delta = runner.lastClassLevel - race.classLevel;
  const score = Math.round(clamp(50 + delta * 1.5));
  if (Math.abs(delta) < 5) {
    return { score, note: `Similar class to last start (${runner.lastClassLabel}).` };
  }
  if (delta > 0) {
    return { score, note: `Drops from ${runner.lastClassLabel} to ${race.classLabel}.` };
  }
  return { score, note: `Rises from ${runner.lastClassLabel} to ${race.classLabel}.` };
}

function weightFactor(runner: Runner, fieldAverage: number): FactorScore {
  const carried = carriedKg(runner);
  const versusField = fieldAverage - carried;
  let score = 50 + versusField * 2.2;
  const notes: string[] = [];
  if (runner.lastWeightKg == null) {
    notes.push("No previous weight.");
  } else {
    const delta = runner.lastWeightKg - carried;
    score += delta * 6;
    if (Math.abs(delta) < 0.2) notes.push("Same weight as last start.");
    else if (delta > 0) notes.push(`${delta.toFixed(1)} kg less than last start.`);
    else notes.push(`${Math.abs(delta).toFixed(1)} kg more than last start.`);
  }
  if (Math.abs(versusField) >= 1) {
    notes.push(
      versusField > 0
        ? `${versusField.toFixed(1)} kg below the field average.`
        : `${Math.abs(versusField).toFixed(1)} kg above the field average.`,
    );
  }
  if (runner.claimKg > 0) notes.push("Carried weight includes the jockey's claim.");
  return { score: Math.round(clamp(score)), note: notes.join(" ") };
}

function ratingFactor(runner: Runner): FactorScore {
  if (runner.officialRating == null) {
    return { score: 50, note: "No official rating." };
  }
  if (runner.lastOfficialRating == null) {
    return { score: 50, note: `Official rating ${runner.officialRating}, with no previous mark.` };
  }
  const move = runner.officialRating - runner.lastOfficialRating;
  const score = Math.round(clamp(50 + move * 4));
  if (move === 0) return { score, note: `Official rating unchanged at ${runner.officialRating}.` };
  if (move > 0) return { score, note: `Official rating ${runner.officialRating}, up ${move}.` };
  return { score, note: `Official rating ${runner.officialRating}, down ${Math.abs(move)}.` };
}

export function analyse(race: Race, field: Runner[], weights: Weights): Analysis {
  const runners = field.filter((runner) => runner.raceId === race.id);
  const active = runners.filter((runner) => !runner.nonRunner);
  const scratched = runners.filter((runner) => runner.nonRunner);
  const forwardRunners = active.filter(
    (runner) => runner.paceStyle === "Leader" || runner.paceStyle === "Prominent",
  );
  const label: PaceLabel = forwardRunners.length >= 4 ? "Strong" : forwardRunners.length <= 2 ? "Soft" : "Even";
  const names = forwardRunners.map((runner) => runner.name).join(", ");
  const pace: PaceRead = {
    label,
    forward: forwardRunners.length,
    detail:
      label === "Strong"
        ? `Strong pace expected. ${forwardRunners.length} runners want to be on the speed: ${names}. Closers are upgraded.`
        : label === "Soft"
          ? forwardRunners.length === 0
            ? "Soft pace expected. No runner wants the lead. Front-runners are upgraded."
            : `Soft pace expected. ${names} ${forwardRunners.length === 1 ? "wants" : "want"} to lead or sit prominent. Front-runners are upgraded.`
          : `Even pace expected. Forward horses: ${names}.`,
  };

  const speedAverage = new Map<string, number>();
  for (const runner of active) {
    if (runner.recentSpeed.length > 0) {
      speedAverage.set(runner.id, mean(runner.recentSpeed.slice(0, 3)));
    }
  }
  const speedValues = [...speedAverage.values()];
  const speedMin = speedValues.length ? Math.min(...speedValues) : 0;
  const speedMax = speedValues.length ? Math.max(...speedValues) : 0;
  const fieldAverage = active.length ? mean(active.map((runner) => carriedKg(runner))) : 0;
  const rated = active.filter((runner) => runner.officialRating != null);
  const fieldAverageRating = rated.length
    ? Math.round(mean(rated.map((runner) => runner.officialRating as number)) * 10) / 10
    : null;

  const weightSum = FACTOR_KEYS.reduce((sum, key) => sum + weights[key], 0);
  const scored = active.map((runner) => {
    const averageSpeed = speedAverage.get(runner.id);
    const speed: FactorScore =
      averageSpeed == null
        ? { score: 50, note: "No calculated speed figures." }
        : {
            score:
              speedMax === speedMin
                ? 70
                : Math.round(20 + ((averageSpeed - speedMin) / (speedMax - speedMin)) * 80),
            note: `Calculated speed ${averageSpeed.toFixed(0)} from the last ${Math.min(3, runner.recentSpeed.length)} runs.`,
          };
    const distance = recordScore(
      runner.distanceRecord.runs,
      runner.distanceRecord.wins,
      runner.distanceRecord.places,
    );
    const course = recordScore(runner.courseRecord.runs, runner.courseRecord.wins, runner.courseRecord.places);
    const going = recordScore(runner.goingRecord.runs, runner.goingRecord.wins, runner.goingRecord.places);
    const factors: Record<FactorKey, FactorScore> = {
      recentForm: formFactor(runner),
      speed,
      pace: {
        score: PACE_SCORE[label][runner.paceStyle],
        note: `${runner.paceStyle} in ${label === "Even" ? "an" : "a"} ${label.toLowerCase()} pace.`,
      },
      classChange: classFactor(runner, race),
      weight: weightFactor(runner, fieldAverage),
      rating: ratingFactor(runner),
      distance: {
        score: Math.round(distance.score),
        note: `${distance.detail} at ${race.distanceLabel}. Places are second and third.`,
      },
      course: {
        score: Math.round(clamp(course.score * 0.7 + going.score * 0.3)),
        note: `Course: ${course.detail}. Today's going: ${going.detail}.`,
      },
    };
    const total =
      weightSum === 0
        ? 0
        : Math.round(
            (FACTOR_KEYS.reduce((sum, key) => sum + factors[key].score * weights[key], 0) / weightSum) * 10,
          ) / 10;
    return { runner, total, factors, modelRank: 0, officialRank: null as number | null };
  });

  scored.sort((a, b) => b.total - a.total || a.runner.number - b.runner.number);
  scored.forEach((result, index) => {
    result.modelRank = index + 1;
  });

  const byOfficial = [...active]
    .filter((runner) => runner.officialRating != null)
    .sort(
      (a, b) =>
        (b.officialRating as number) - (a.officialRating as number) || carriedKg(a) - carriedKg(b),
    );
  const officialRank = new Map(byOfficial.map((runner, index) => [runner.id, index + 1]));
  for (const result of scored) {
    result.officialRank = officialRank.get(result.runner.id) ?? null;
  }

  return { pace, ranked: scored, scratched, fieldAverageRating };
}

export function swingLabel(result: HandicapResult): string {
  if (result.officialRank == null) return "No official rating";
  const swing = result.officialRank - result.modelRank;
  if (swing === 0) return "Same place as the official order";
  if (swing > 0) return `${swing} ${swing === 1 ? "place" : "places"} above the official order`;
  const gap = Math.abs(swing);
  return `${gap} ${gap === 1 ? "place" : "places"} below the official order`;
}
