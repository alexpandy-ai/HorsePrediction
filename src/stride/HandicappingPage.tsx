import { useEffect, useState } from "react";
import { DEFAULT_STRIDE_WEIGHTS, rankRace, type StrideWeights } from "./handicappingEngine";
import { loadCard } from "./load";
import type { IndiaRace } from "./types";

const STORAGE_KEY = "stride-weights";

function readWeights(): StrideWeights {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "") as Partial<StrideWeights>;
    return {
      recentForm: numberOr(stored.recentForm, DEFAULT_STRIDE_WEIGHTS.recentForm),
      weight: numberOr(stored.weight, DEFAULT_STRIDE_WEIGHTS.weight),
    };
  } catch {
    return DEFAULT_STRIDE_WEIGHTS;
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function HandicappingPage({ date, venueId, raceNumber }: { date: string; venueId: string; raceNumber: number }) {
  const [race, setRace] = useState<IndiaRace | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [weights, setWeights] = useState<StrideWeights>(readWeights);

  useEffect(() => {
    let ignore = false;
    void loadCard(date, venueId).then((card) => {
      if (ignore) return;
      setCourse(card?.course ?? null);
      setRace(card?.races.find((item) => item.raceNumber === raceNumber) ?? null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [date, venueId, raceNumber]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  }, [weights]);

  if (!ready) return <div className="wrap"><p className="callout">Loading handicapping…</p></div>;
  if (!race) {
    return (
      <div className="wrap">
        <h1>Handicapping unavailable</h1>
        <p className="warn">This race is not in the published snapshot, so there is nothing to rank.</p>
        <p><a href="#/">Back to meetings</a></p>
      </div>
    );
  }

  const result = rankRace(race, weights);
  const eligible = result.rows.filter((row) => row.status === "Runner");

  return (
    <div className="wrap stride-page">
      <p className="kicker">Calculated · separate from the racecard</p>
      <h1>Handicapping{race.name ? ` · ${race.name}` : ""}</h1>
      <p className="meta">{course ?? "Racecourse"} · Race {race.raceNumber}. Rankings use the stored runner list and do not change it.</p>
      <p className="meta">{result.unavailableNote} The official rating stays on the racecard and is not converted into a score.</p>
      <div className="stride-actions">
        <a className="button secondary" href={`#/race-card/${date}/${venueId}/${race.raceNumber}`}>Racecard</a>
      </div>
      <section className="stride-top3">
        <h2>Top 3</h2>
        {result.top3.length === 0 ? <p>No runner has a calculated score.</p> : (
          <ol>
            {result.top3.map((row, index) => (
              <li key={row.runnerId}>
                <strong>{index + 1}. {row.horse ?? "—"}</strong>
                <span>No. {row.horseNumber ?? "—"} · {row.score}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="stride-weights">
        <h2>Factors</h2>
        <label>
          Recent form {weights.recentForm}%
          <input type="range" min={0} max={100} value={weights.recentForm} onChange={(event) => setWeights({ ...weights, recentForm: Number(event.target.value) })} />
        </label>
        <label>
          Carried weight {weights.weight}%
          <input type="range" min={0} max={100} value={weights.weight} onChange={(event) => setWeights({ ...weights, weight: Number(event.target.value) })} />
        </label>
        <button type="button" className="button secondary" onClick={() => setWeights(DEFAULT_STRIDE_WEIGHTS)}>Reset weights</button>
      </section>
      <div className="stride-table-wrap">
        <table className="stride-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Horse No.</th>
              <th>Horse</th>
              <th>Score</th>
              <th>Factors used</th>
            </tr>
          </thead>
          <tbody>
            {eligible.map((row, index) => (
              <tr key={row.runnerId}>
                <td>{index + 1}</td>
                <td>{row.horseNumber ?? "—"}</td>
                <td>{row.horse ?? "—"}</td>
                <td>{row.score ?? "—"}</td>
                <td>
                  {row.factors.map((factor) => (
                    <span key={factor.key} className="stride-factor">
                      {factor.label}: {factor.status === "used" ? factor.score : "unavailable"}. {factor.detail}
                    </span>
                  ))}
                  {row.excludedReason ? <span className="stride-factor">{row.excludedReason}</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.rows.some((row) => row.status === "Withdrawn") ? (
        <p className="meta">Withdrawn and excluded: {result.rows.filter((row) => row.status === "Withdrawn").map((row) => row.horse ?? "—").join(", ")}.</p>
      ) : null}
      {race.sourceSelections.length > 0 ? (
        <aside className="callout">
          <h2>Indiarace selections</h2>
          <p>These are the source site’s published selections, not STRIDE rankings.</p>
          <p>{race.sourceSelections.join(" · ")}</p>
        </aside>
      ) : null}
    </div>
  );
}
