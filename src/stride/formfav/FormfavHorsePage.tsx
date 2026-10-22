import { useEffect, useState } from "react";
import { cardKey, type FormfavRunner, type FormfavStatLine } from "./types";
import { australiaRaceHash, PREVIOUS_RUNS_DETAIL } from "./horse";
import { loadFormfavRacecards } from "./load";
import { dash, formfavRate } from "./present";
import "../horseStatistics.css";

const STAT_ROWS: { key: keyof FormfavRunner["stats"]; label: string }[] = [
  { key: "overall", label: "Career" },
  { key: "track", label: "This track" },
  { key: "distance", label: "This distance" },
  { key: "trackDistance", label: "Track and distance" },
  { key: "condition", label: "Track condition" },
  { key: "firstUp", label: "First-up" },
  { key: "secondUp", label: "Second-up" },
];

export function FormfavHorsePage({ date, slug, raceNumber, horseNumber }: { date: string; slug: string; raceNumber: number; horseNumber: number }) {
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [runner, setRunner] = useState<FormfavRunner | null>(null);
  const [track, setTrack] = useState<string | null>(null);
  const [raceName, setRaceName] = useState<string | null>(null);
  const [runnersIncluded, setRunnersIncluded] = useState(false);
  const [cardFound, setCardFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    setPhase("loading");
    void loadFormfavRacecards().then((file) => {
      if (ignore) return;
      if (!file) {
        setRunner(null);
        setPhase("error");
        return;
      }
      const card = file.cards[cardKey("au", date, slug, raceNumber)] ?? null;
      setCardFound(card != null);
      setTrack(card?.track ?? null);
      setRaceName(card?.raceName ?? null);
      setRunnersIncluded(Boolean(card?.runnersIncluded));
      setRunner(card?.runners.find((item) => item.horseNumber === horseNumber) ?? null);
      setPhase("ready");
    });
    return () => {
      ignore = true;
    };
  }, [date, slug, raceNumber, horseNumber]);

  const back = australiaRaceHash(date, slug, raceNumber);
  const title = runner?.name ?? "Horse";

  return (
    <div className="wrap stride-page">
      <p className="kicker">Australia · FormFav</p>
      <h1>{phase === "ready" && runner ? title : "Horse"}</h1>
      <p><a href={back}>Back to the racecard</a></p>
      {phase === "loading" ? <p className="callout">Loading the published racecard…</p> : null}
      {phase === "error" ? <p className="warn">The published racecard could not be loaded.</p> : null}
      {phase === "ready" && !cardFound ? <p className="warn">This race is not in the published Australia snapshot.</p> : null}
      {phase === "ready" && cardFound && !runnersIncluded ? <p className="callout">Runner form was not included in this publication.</p> : null}
      {phase === "ready" && cardFound && runnersIncluded && !runner ? <p className="warn">This saddle number is not on the published racecard.</p> : null}
      {runner ? (
        <>
          <p className="meta">{track ?? slug} · {date} · Race {raceNumber}{raceName ? ` · ${raceName}` : ""} · Saddle {horseNumber}{runner.scratched ? " · Scratched" : ""}</p>
          <dl className="stride-facts">
            <div><dt>Runner id</dt><dd>—</dd></div>
            <div><dt>Jockey</dt><dd>{dash(runner.jockey)}</dd></div>
            <div><dt>Trainer</dt><dd>{dash(runner.trainer)}</dd></div>
            <div><dt>Barrier</dt><dd>{dash(runner.barrier)}</dd></div>
            <div><dt>Weight</dt><dd>{dash(runner.weightKg)}</dd></div>
          </dl>
          <p>FormFav does not provide a stable runner id on this racecard. The horse name is not an identifier. This page is saddle {horseNumber} on the published race.</p>
          <h2>Form figures</h2>
          <p>These are FormFav form strings, newest figure last. They are not a list of runs, and a missing figure is left as an em dash.</p>
          <dl className="stride-facts">
            <div><dt>Last five</dt><dd>{dash(runner.form)}</dd></div>
            <div><dt>Last 20</dt><dd>{dash(runner.last20Starts)}</dd></div>
          </dl>
          <h2>Career summary</h2>
          <p>Totals published with this racecard. A blank section was not supplied.</p>
          <StatTable runner={runner} />
        </>
      ) : null}
      {phase !== "loading" ? (
        <>
          <h2>Previous runs</h2>
          <p className="warn">Previous runs are not available for this horse.</p>
          {PREVIOUS_RUNS_DETAIL.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </>
      ) : null}
    </div>
  );
}

function StatTable({ runner }: { runner: FormfavRunner }) {
  return (
    <div className="horse-table-wrap">
      <table className="horse-table">
        <thead>
          <tr>
            <th>Record</th>
            <th>Starts</th>
            <th>Wins</th>
            <th>Seconds</th>
            <th>Thirds</th>
            <th>Places</th>
            <th>Win rate</th>
            <th>Place rate</th>
          </tr>
        </thead>
        <tbody>
          {STAT_ROWS.map((row) => {
            const line = runner.stats[row.key];
            return (
              <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td>{count(line, "starts")}</td>
                <td>{count(line, "wins")}</td>
                <td>{count(line, "seconds")}</td>
                <td>{count(line, "thirds")}</td>
                <td>{count(line, "places")}</td>
                <td>{formfavRate(line?.winPercent)}</td>
                <td>{formfavRate(line?.placePercent)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function count(line: FormfavStatLine | null, key: "starts" | "wins" | "seconds" | "thirds" | "places"): string {
  return dash(line?.[key]);
}
