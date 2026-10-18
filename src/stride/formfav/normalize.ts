import type { FormfavCountryCode } from "./countries";
import type { FormfavMeeting, FormfavRace, FormfavRunner, FormfavStatLine } from "./types";

interface RawRace {
  raceNumber?: unknown;
  raceName?: unknown;
  distance?: unknown;
  condition?: unknown;
  weather?: unknown;
  raceClass?: unknown;
  prizeMoney?: unknown;
  abandoned?: unknown;
  startTime?: unknown;
  timezone?: unknown;
  numberOfRunners?: unknown;
  runners?: unknown;
}

interface RawMeeting {
  track?: unknown;
  slug?: unknown;
  country?: unknown;
  abandoned?: unknown;
  races?: unknown;
}

export function meetingsFromResponse(body: unknown, country: FormfavCountryCode, date: string): FormfavMeeting[] {
  const meetings = asRecord(body)?.meetings;
  if (!Array.isArray(meetings)) return [];
  const result: FormfavMeeting[] = [];
  for (const item of meetings) {
    const meeting = asRecord(item) as RawMeeting | null;
    if (!meeting) continue;
    if (text(meeting.country) !== country) continue;
    const track = text(meeting.track);
    const slug = text(meeting.slug);
    if (!track || !slug) continue;
    const races = Array.isArray(meeting.races) ? meeting.races.map((race) => raceSummary(race)).filter((race) => race.raceNumber > 0) : [];
    races.sort(byStart);
    result.push({
      country,
      track,
      slug,
      date,
      abandoned: meeting.abandoned === true,
      region: "Region unavailable",
      source: "FormFav",
      races,
    });
  }
  result.sort((a, b) => a.track.localeCompare(b.track));
  return result;
}

export function raceFromForm(body: unknown, fallback: FormfavRace): FormfavRace {
  const record = asRecord(body);
  if (!record) return fallback;
  const summary = raceSummary(record);
  const runners = Array.isArray(record.runners) ? record.runners.map((runner) => runnerFromForm(runner)).filter((runner) => runner.horseNumber != null || runner.name) : [];
  return {
    ...summary,
    raceNumber: summary.raceNumber || fallback.raceNumber,
    runners,
    runnersIncluded: true,
  };
}

export function applyPrediction(race: FormfavRace, body: unknown): FormfavRace {
  const predictions = asRecord(body)?.predictions;
  if (!Array.isArray(predictions)) return race;
  const byNumber = new Map<number, { winProb: number; placeProb: number; modelRank: number | null }>();
  for (const item of predictions) {
    const record = asRecord(item);
    const number = integer(record?.number);
    const winProb = numberValue(record?.winProb);
    const placeProb = numberValue(record?.placeProb);
    if (number == null || winProb == null || placeProb == null) continue;
    byNumber.set(number, { winProb, placeProb, modelRank: integer(record?.modelRank) });
  }
  return {
    ...race,
    runners: race.runners.map((runner) => ({
      ...runner,
      prediction: runner.horseNumber != null ? byNumber.get(runner.horseNumber) ?? runner.prediction : runner.prediction,
    })),
  };
}

function raceSummary(value: unknown): FormfavRace {
  const race = (asRecord(value) ?? {}) as RawRace;
  return {
    raceNumber: integer(race.raceNumber) ?? 0,
    raceName: text(race.raceName),
    distance: text(race.distance),
    condition: text(race.condition),
    weather: text(race.weather),
    raceClass: text(race.raceClass),
    prizeMoney: prizeText(race.prizeMoney),
    abandoned: race.abandoned === true,
    startTime: text(race.startTime),
    timezone: text(race.timezone),
    numberOfRunners: integer(race.numberOfRunners),
    runners: [],
    runnersIncluded: false,
  };
}

function runnerFromForm(value: unknown): FormfavRunner {
  const runner = asRecord(value) ?? {};
  const stats = asRecord(runner.stats);
  const speed = asRecord(runner.speedMap);
  const classFit = asRecord(runner.raceClassFit);
  const classProfile = asRecord(runner.classProfile);
  return {
    horseNumber: integer(runner.number),
    name: text(runner.name),
    barrier: integer(runner.barrier),
    jockey: text(runner.jockey),
    trainer: text(runner.trainer),
    weightKg: numberValue(runner.weight),
    claimKg: numberValue(runner.claim),
    age: integer(runner.age),
    sex: text(runner.sex),
    form: text(runner.form),
    last20Starts: text(runner.last20Starts),
    scratched: runner.scratched === true,
    stats: {
      overall: statLine(stats?.overall),
      track: statLine(stats?.track),
      distance: statLine(stats?.distance),
      trackDistance: statLine(stats?.trackDistance),
      condition: statLine(stats?.condition),
      firstUp: statLine(stats?.firstUp),
      secondUp: statLine(stats?.secondUp),
    },
    speedMap: speed
      ? {
          runningStyle: text(speed.runningStyle),
          earlySpeedIndex: numberValue(speed.earlySpeedIndex),
          settlingPosition: integer(speed.settlingPosition),
        }
      : null,
    classRating: integer(classProfile?.currentRating),
    classDifference: integer(classFit?.classDifference),
    decorators: Array.isArray(runner.decorators)
      ? runner.decorators.flatMap((item) => {
          const decorator = asRecord(item);
          const label = text(decorator?.label);
          if (!label) return [];
          return [{ label, detail: text(decorator?.detail) }];
        })
      : [],
    prediction: null,
    fixedWin: null,
  };
}

export function applyPrices(race: FormfavRace, body: unknown): FormfavRace {
  const runners = asRecord(body)?.runners;
  if (!Array.isArray(runners)) return race;
  const wins = new Map<number, number>();
  for (const item of runners) {
    const record = asRecord(item);
    const number = integer(record?.number);
    if (number == null || !Array.isArray(record?.prices)) continue;
    for (const price of record.prices) {
      const line = asRecord(price);
      const win = numberValue(line?.win);
      if (line?.marketType === "fixed" && win != null) {
        wins.set(number, win);
        break;
      }
    }
  }
  return { ...race, runners: race.runners.map((runner) => ({ ...runner, fixedWin: runner.horseNumber != null ? wins.get(runner.horseNumber) ?? runner.fixedWin : runner.fixedWin })) };
}

function statLine(value: unknown): FormfavStatLine | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    starts: integer(record.starts),
    wins: integer(record.wins),
    seconds: integer(record.seconds),
    thirds: integer(record.thirds),
    places: integer(record.places),
    winPercent: numberValue(record.winPercent),
    placePercent: numberValue(record.placePercent),
  };
}

export function mergeMeetings(existing: FormfavMeeting[], incoming: FormfavMeeting[]): FormfavMeeting[] {
  const bySlug = new Map<string, FormfavMeeting>();
  for (const meeting of [...existing, ...incoming]) {
    const previous = bySlug.get(meeting.slug);
    if (!previous) {
      bySlug.set(meeting.slug, meeting);
      continue;
    }
    const races = new Map<number, FormfavRace>();
    for (const race of [...previous.races, ...meeting.races]) races.set(race.raceNumber, race);
    bySlug.set(meeting.slug, {
      ...previous,
      abandoned: previous.abandoned && meeting.abandoned,
      races: [...races.values()].sort(byStart),
    });
  }
  return [...bySlug.values()].sort((a, b) => a.track.localeCompare(b.track));
}

function byStart(a: FormfavRace, b: FormfavRace): number {
  if (a.startTime && b.startTime && a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
  return a.raceNumber - b.raceNumber;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function prizeText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
