import { useEffect, useState } from "react";
import { formfavCountry, type FormfavCountryCode } from "./countries";
import { DEFAULT_FORMFAV_WEIGHTS, rankFormfavRace, type FormfavWeights } from "./handicap";
import { loadFormfavRace } from "./load";
import { dash } from "./present";
import type { FormfavRace } from "./types";

const STORAGE_KEY = "stride-ff-weights";

function readWeights(): FormfavWeights {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as Partial<FormfavWeights>;
    return {
      recentForm: numberOr(stored.recentForm, DEFAULT_FORMFAV_WEIGHTS.recentForm),
      career: numberOr(stored.career, DEFAULT_FORMFAV_WEIGHTS.career),
      track: numberOr(stored.track, DEFAULT_FORMFAV_WEIGHTS.track),
      distance: numberOr(stored.distance, DEFAULT_FORMFAV_WEIGHTS.distance),
      trackDistance: numberOr(stored.trackDistance, DEFAULT_FORMFAV_WEIGHTS.trackDistance),
      weight: numberOr(stored.weight, DEFAULT_FORMFAV_WEIGHTS.weight),
      barrier: numberOr(stored.barrier, DEFAULT_FORMFAV_WEIGHTS.barrier),
      classFit: numberOr(stored.classFit, DEFAULT_FORMFAV_WEIGHTS.classFit),
      pace: numberOr(stored.pace, DEFAULT_FORMFAV_WEIGHTS.pace),
    };
  } catch {
    return DEFAULT_FORMFAV_WEIGHTS;
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function FormfavHandicapPage({ country, date, slug, raceNumber }: { country: FormfavCountryCode; date: string; slug: string; raceNumber: number }) {
  const [race, setRace] = useState<FormfavRace | null>(null);
  const [ready, setReady] = useState(false);
  const [weights, setWeights] = useState<FormfavWeights>(readWeights);

  useEffect(() => {
    let ignore = false;
    void loadFormfavRace(country, date, slug, raceNumber).then((card) => {
      if (ignore) return;
      setRace(card?.runnersIncluded ? card : null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [country, date, slug, raceNumber]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  }, [weights]);

  if (!ready) return <div className="wrap"><p className="callout">Loading handicapping…</p></div>;
  if (!race) {
    return (
      <div className="wrap">
        <h1>Handicapping unavailable</h1>
        <p className="warn">This race has no published runner form, so STRIDE has nothing to rank.</p>
        <p><a href={`#/ff/${country}`}>Back to {formfavCountry(country).name}</a></p>
      </div>
    );
  }

  const result = rankFormfavRace(race, weights);
  return (
    <div className="wrap">
      <p className="kicker">STRIDE handicapping · separate from FormFav</p>
      <h1>{race.raceName ?? `Race ${race.raceNumber}`}</h1>
      <p className="meta">{result.note}</p>
      <section className="stride-top3">
        <h2>Top 3</h2>
        {result.top3.length === 0 ? <p>No runner has a score.</p> : (
          <ol>
            {result.top3.map((row) => <li key={row.horseNumber ?? row.name}>{dash(row.horseNumber)} {dash(row.name)} · {row.score}</li>)}
          </ol>
        )}
      </section>
      <div className="stride-weights">
        {(Object.keys(DEFAULT_FORMFAV_WEIGHTS) as (keyof FormfavWeights)[]).map((key) => (
          <label key={key}>
            {key} · {weights[key]}
            <input type="range" min={0} max={100} value={weights[key]} onChange={(event) => setWeights({ ...weights, [key]: Number(event.target.value) })} />
          </label>
        ))}
      </div>
      <div className="stride-table-wrap">
        <table className="stride-table">
          <thead>
            <tr><th>No</th><th>Horse</th><th>STRIDE</th><th>FormFav prediction</th><th>Factors</th></tr>
          </thead>
          <tbody>
            {result.rows.map((row, index) => (
              <tr key={`${row.horseNumber ?? "x"}-${index}`} className={row.scratched ? "is-withdrawn" : undefined}>
                <td>{dash(row.horseNumber)}</td>
                <td>{dash(row.name)}{row.scratched ? " · Scratched" : ""}</td>
                <td>{row.score ?? "—"}</td>
                <td>{row.prediction ? `${(row.prediction.winProb * 100).toFixed(1)}%` : "—"}</td>
                <td>{row.factors.map((factor) => <small key={factor.key} className="stride-factor">{factor.label}: {factor.status === "used" ? factor.score : "unavailable"}</small>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
