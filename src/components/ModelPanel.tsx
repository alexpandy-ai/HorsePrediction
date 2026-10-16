import { Fragment, useState } from "react";
import { FACTOR_KEYS, FACTORS, swingLabel, type Analysis, type FactorKey, type Weights } from "../engine/handicap";
import type { Race } from "../types";

export function ModelPanel({
  race,
  analysis,
  weights,
  onWeight,
  onReset,
  detailed = false,
}: {
  race: Race;
  analysis: Analysis;
  weights: Weights;
  onWeight: (key: FactorKey, value: number) => void;
  onReset: () => void;
  detailed?: boolean;
}) {
  const weightSum = FACTOR_KEYS.reduce((sum, key) => sum + weights[key], 0);

  return (
    <section className={detailed ? "model-panel model-panel-full" : "model-panel"} aria-label="Handicapping model">
      <header className="panel-head">
        <div>
          <p className="kicker">Calculated</p>
          <h2>Handicapping model</h2>
        </div>
        <button type="button" className="button secondary" onClick={onReset}>
          Reset weights
        </button>
      </header>
      <p className="pace">{analysis.pace.detail}</p>
      {analysis.fieldAverageRating != null && (
        <p className="meta">
          Average official rating of declared runners: {analysis.fieldAverageRating}. That average describes the
          strength of the field. It is not added again inside a runner's score.
        </p>
      )}
      {weightSum === 0 && <p className="warn">Set at least one factor above zero to rank the field.</p>}
      <div className="sliders">
        {FACTORS.map((factor) => {
          const share = weightSum === 0 ? 0 : Math.round((weights[factor.key] / weightSum) * 100);
          return (
            <label key={factor.key} className="slider">
              <span className="slider-top">
                <span>{factor.label}</span>
                <span>{share}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={weights[factor.key]}
                aria-valuetext={`${share} percent of the model`}
                onChange={(event) => onWeight(factor.key, Number(event.target.value))}
              />
              {detailed && <span className="slider-help">{factor.blurb}</span>}
            </label>
          );
        })}
      </div>
      <p className="meta">Weights apply to every race and stay in this browser.</p>
      {detailed ? (
        <FactorTable analysis={analysis} />
      ) : (
        <>
          <ol className="rank-list">
            {analysis.ranked.map((result) => {
              const swing = result.officialRank == null ? 0 : result.officialRank - result.modelRank;
              return (
                <li key={result.runner.id}>
                  <span className="rank">{result.modelRank}</span>
                  <span>
                    <a href={`#/race/${race.id}/${result.runner.id}`}>{result.runner.name}</a>
                    <small className={swing > 0 ? "up" : swing < 0 ? "down" : ""}>{swingLabel(result)}</small>
                  </span>
                  <strong>{result.total.toFixed(1)}</strong>
                </li>
              );
            })}
          </ol>
          {analysis.scratched.length > 0 && (
            <p className="meta">
              Excluded: {analysis.scratched.map((runner) => runner.name).join(", ")} (non-runner).
            </p>
          )}
          <a className="text-link" href={`#/engine/${race.id}`}>
            Open the full handicapper
          </a>
        </>
      )}
    </section>
  );
}

function FactorTable({ analysis }: { analysis: Analysis }) {
  const [openId, setOpenId] = useState<string | null>(analysis.ranked[0]?.runner.id ?? null);
  return (
    <div className="table-scroll">
      <table className="factor-table">
        <caption>Model ranking with each factor score</caption>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Horse</th>
            <th>Model</th>
            <th>OR rank</th>
            <th>Versus OR</th>
            {FACTORS.map((factor) => (
              <th key={factor.key} title={factor.label}>
                {shortFactor(factor.key)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {analysis.ranked.map((result) => {
            const swing = result.officialRank == null ? null : result.officialRank - result.modelRank;
            const open = openId === result.runner.id;
            return (
              <Fragment key={result.runner.id}>
                <tr className={open ? "is-selected" : undefined}>
                  <td>{result.modelRank}</td>
                  <td>
                    <button type="button" className="linkish" onClick={() => setOpenId(open ? null : result.runner.id)}>
                      {result.runner.name}
                    </button>
                  </td>
                  <td>{result.total.toFixed(1)}</td>
                  <td>{result.officialRank ?? "—"}</td>
                  <td className={swing != null && swing > 0 ? "up" : swing != null && swing < 0 ? "down" : undefined}>
                    {swing == null ? "—" : swing > 0 ? `+${swing}` : swing}
                  </td>
                  {FACTORS.map((factor) => (
                    <td key={factor.key}>{result.factors[factor.key].score}</td>
                  ))}
                </tr>
                {open && (
                  <tr className="factor-notes">
                    <td colSpan={5 + FACTORS.length}>
                      <ul>
                        {FACTORS.map((factor) => (
                          <li key={factor.key}>
                            <strong>{factor.label}.</strong> {result.factors[factor.key].note}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function shortFactor(key: FactorKey): string {
  const labels: Record<FactorKey, string> = {
    recentForm: "Form",
    speed: "Spd",
    pace: "Pace",
    classChange: "Class",
    weight: "Wgt",
    rating: "Move",
    distance: "Dist",
    course: "Crse",
  };
  return labels[key];
}
