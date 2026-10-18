import { useEffect, useState } from "react";
import { formfavCountry, type FormfavCountryCode } from "./countries";
import { loadFormfavMeetings, loadFormfavRace } from "./load";
import { dash, localClock } from "./present";
import type { FormfavRace } from "./types";

export function FormfavRacePage({ country, date, slug, raceNumber }: { country: FormfavCountryCode; date: string; slug: string; raceNumber: number }) {
  const [race, setRace] = useState<FormfavRace | null>(null);
  const [track, setTrack] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    void Promise.all([loadFormfavRace(country, date, slug, raceNumber), loadFormfavMeetings(country)]).then(([card, meetings]) => {
      if (ignore) return;
      const summary = meetings?.dates[date]?.meetings.find((item) => item.slug === slug);
      setTrack(summary?.track ?? card?.track ?? null);
      setRace(card ?? summary?.races.find((item) => item.raceNumber === raceNumber) ?? null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [country, date, slug, raceNumber]);

  if (!ready) return <div className="wrap"><p className="callout">Loading the race…</p></div>;
  if (!race) {
    return (
      <div className="wrap">
        <h1>Race unavailable</h1>
        <p className="warn">This race is not in the published FormFav snapshot.</p>
        <p><a href={`#/ff/${country}`}>Back to {formfavCountry(country).name}</a></p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <p className="kicker">{track ?? slug} · FormFav</p>
      <h1>{race.raceName ?? `Race ${race.raceNumber}`}</h1>
      <p className="meta">{localClock(race.startTime, race.timezone)} · {dash(race.distance)} · {dash(race.raceClass)} · {dash(race.condition)} · {dash(race.weather)} · {race.prizeMoney ? race.prizeMoney : "Prize —"}</p>
      <p><a className="button" href={`#/ff/${country}/handicap/${date}/${encodeURIComponent(slug)}/${race.raceNumber}`}>Handicapping</a></p>
      {!race.runnersIncluded ? <p className="callout">Runner form was not included in this publication. The race details above come from the meeting list.</p> : null}
      {race.runnersIncluded ? (
        <div className="stride-table-wrap">
          <table className="stride-table">
            <thead>
              <tr>
                <th>No</th><th>Draw</th><th>Horse</th><th>Jockey</th><th>Trainer</th><th>Wt</th><th>Claim</th><th>Age</th><th>Sex</th><th>Form</th><th>Career</th><th>Barrier</th>
              </tr>
            </thead>
            <tbody>
              {race.runners.map((runner, index) => (
                <tr key={`${runner.horseNumber ?? "x"}-${index}`} className={runner.scratched ? "is-withdrawn" : undefined}>
                  <td>{dash(runner.horseNumber)}</td>
                  <td>{dash(runner.barrier)}</td>
                  <td>{dash(runner.name)}{runner.scratched ? " · Scratched" : ""}{runner.decorators.length ? <small>{runner.decorators.map((item) => item.label).join(", ")}</small> : null}</td>
                  <td>{dash(runner.jockey)}</td>
                  <td>{dash(runner.trainer)}</td>
                  <td>{dash(runner.weightKg)}</td>
                  <td>{dash(runner.claimKg)}</td>
                  <td>{dash(runner.age)}</td>
                  <td>{dash(runner.sex)}</td>
                  <td>{dash(runner.form)}</td>
                  <td>{runner.stats.overall?.winPercent != null ? `${runner.stats.overall.winPercent}%` : "—"}</td>
                  <td>{runner.speedMap?.runningStyle ? runner.speedMap.runningStyle : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {race.runners.some((runner) => runner.prediction || runner.fixedWin != null) ? (
        <section className="stride-top3">
          <h2>FormFav source figures</h2>
          <p>These are FormFav predictions and prices, not STRIDE rankings.</p>
          <ul>
            {race.runners.filter((runner) => runner.prediction || runner.fixedWin != null).map((runner) => (
              <li key={runner.horseNumber ?? runner.name}>
                {dash(runner.horseNumber)} {dash(runner.name)}
                {runner.prediction ? ` · win ${(runner.prediction.winProb * 100).toFixed(1)}% · place ${(runner.prediction.placeProb * 100).toFixed(1)}%` : ""}
                {runner.fixedWin != null ? ` · fixed win ${runner.fixedWin}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="meta">Predictions require Pro and are documented for Australia. Live prices require Premium. Neither is copied into the STRIDE score.</p>
      )}
    </div>
  );
}
