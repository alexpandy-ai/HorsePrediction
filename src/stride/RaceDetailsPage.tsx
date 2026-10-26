import { useEffect, useState } from "react";
import { indiaHorseHash } from "./horseStatistics";
import { HANDICAP_COLUMN_LABEL, HANDICAP_NOTICE, preferRacecard } from "./indiaDocument";
import { loadCard, loadHandicap } from "./load";
import type { IndiaHandicapColumn, IndiaHandicapRace, IndiaHandicapRunner, IndiaHandicapSheet, IndiaMeeting, IndiaRace, IndiaRunner } from "./types";

function shown(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function horseCell(runner: IndiaRunner) {
  const label = shown(runner.horse ?? runner.sourceHorseName);
  const href = indiaHorseHash(runner.sourceHorseId, runner.sourceHorseName);
  if (!href) return label;
  return <a href={href}>{label}</a>;
}

function equipment(runner: IndiaRunner): string {
  const parts = [runner.shoes ? `Shoes ${runner.shoes}` : "", runner.equipment ?? ""].filter(Boolean);
  return parts.join(" · ");
}

type RaceView =
  | { kind: "racecard"; meeting: IndiaMeeting; race: IndiaRace }
  | { kind: "handicap"; sheet: IndiaHandicapSheet; race: IndiaHandicapRace }
  | { kind: "missing" };

export function RaceDetailsPage({ date, venueId, raceNumber }: { date: string; venueId: string; raceNumber: number }) {
  const [view, setView] = useState<RaceView | null>(null);

  useEffect(() => {
    let ignore = false;
    void Promise.all([loadCard(date, venueId), loadHandicap(date, venueId)]).then(([card, handicap]) => {
      if (ignore) return;
      const choice = preferRacecard(card, handicap);
      if (choice?.kind === "racecard") {
        const race = choice.card.races.find((item) => item.raceNumber === raceNumber) ?? null;
        setView(race ? { kind: "racecard", meeting: choice.card, race } : { kind: "missing" });
      } else if (choice?.kind === "handicap") {
        const race = choice.sheet.races.find((item) => item.order === raceNumber) ?? null;
        setView(race ? { kind: "handicap", sheet: choice.sheet, race } : { kind: "missing" });
      } else {
        setView({ kind: "missing" });
      }
    });
    return () => {
      ignore = true;
    };
  }, [date, venueId, raceNumber]);

  useEffect(() => {
    const name = view?.kind === "racecard" ? view.race.name : view?.kind === "handicap" ? view.race.name : null;
    if (name) document.title = `${name} — STRIDE`;
  }, [view]);

  if (!view) return <div className="wrap"><p className="callout">Loading the race…</p></div>;
  if (view.kind === "missing") {
    return (
      <div className="wrap">
        <h1>Race unavailable</h1>
        <p className="warn">This race is not in the published Indiarace snapshot.</p>
        <p><a href="#/">Back to meetings</a></p>
      </div>
    );
  }
  if (view.kind === "handicap") return <HandicapRace date={date} venueId={venueId} sheet={view.sheet} race={view.race} />;
  return <RacecardRace date={date} venueId={venueId} meeting={view.meeting} race={view.race} />;
}

function RacecardRace({ date, venueId, meeting, race }: { date: string; venueId: string; meeting: IndiaMeeting; race: IndiaRace }) {
  return (
    <div className="wrap stride-page">
      <p className="kicker">{meeting.course} · {meeting.state ?? "State unavailable"}</p>
      <h1>Race {race.raceNumber}{race.name ? ` · ${race.name}` : ""}</h1>
      <dl className="stride-facts">
        <div><dt>Time</dt><dd>{race.time ? `${race.time} IST` : "—"}</dd></div>
        <div><dt>Distance</dt><dd>{race.distanceM != null ? `${race.distanceM} m` : "—"}</dd></div>
        <div><dt>Class</dt><dd>{shown(race.classLabel)}</dd></div>
        <div><dt>Rating eligibility</dt><dd>{shown(race.ratingEligibility)}</dd></div>
        <div><dt>Runners</dt><dd>{race.runnerCount}</dd></div>
      </dl>
      {race.conditions ? <p className="meta">{race.conditions}</p> : null}
      {race.drawFlags.length > 0 ? (
        <div className="warn">
          <p>Draw review</p>
          <ul>{race.drawFlags.map((flag) => <li key={flag}>{flag}</li>)}</ul>
        </div>
      ) : null}
      <div className="stride-actions">
        <a className="button" href={`#/handicap/${date}/${venueId}/${race.raceNumber}`}>Handicapping</a>
        <a className="button secondary" href={`#/meeting/${date}/${venueId}`}>Meeting</a>
      </div>
      <div className="stride-table-wrap">
        <table className="stride-table">
          <thead>
            <tr>
              <th>Horse No.</th>
              <th>Horse</th>
              <th>Draw</th>
              <th>Age/Sex</th>
              <th>Pedigree</th>
              <th>Trainer</th>
              <th>Jockey</th>
              <th>Weight</th>
              <th>Allowance</th>
              <th>Rating</th>
              <th>Equipment</th>
              <th>Recent Form</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {race.runners.map((runner) => (
              <tr key={runner.id} className={runner.status === "Withdrawn" ? "is-withdrawn" : undefined}>
                <td>{shown(runner.horseNumber)}</td>
                <td>{horseCell(runner)}</td>
                <td>{runner.draw == null ? "—" : runner.draw}{runner.review.length > 0 ? " · review" : ""}</td>
                <td>{shown(runner.ageSex)}</td>
                <td>{shown(runner.pedigree)}</td>
                <td>{shown(runner.trainer)}</td>
                <td>{shown(runner.jockey)}</td>
                <td>{shown(runner.weight)}</td>
                <td>{shown(runner.allowance)}</td>
                <td>
                  {shown(runner.rating)}
                  {runner.ratingAside != null ? <small> Smaller figure {runner.ratingAside}</small> : null}
                </td>
                <td>{equipment(runner) || "—"}</td>
                <td>{shown(runner.recentForm)}</td>
                <td>{runner.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function HandicapRace({ date, venueId, sheet, race }: { date: string; venueId: string; sheet: IndiaHandicapSheet; race: IndiaHandicapRace }) {
  return (
    <div className="wrap stride-page">
      <p className="kicker">Published Indiarace handicap · {sheet.course}</p>
      <h1>{race.name ?? "—"}</h1>
      <p className="callout">{HANDICAP_NOTICE}</p>
      <dl className="stride-facts">
        <div><dt>Distance</dt><dd>{race.distanceM != null ? `${race.distanceM} m` : shown(race.distanceLabel)}</dd></div>
        <div><dt>Conditions</dt><dd>{shown(race.conditions)}</dd></div>
        <div><dt>Horses</dt><dd>{race.runnerCount}</dd></div>
      </dl>
      <div className="stride-actions">
        <a className="button secondary" href={`#/meeting/${date}/${venueId}`}>Meeting</a>
      </div>
      <div className="stride-table-wrap">
        <table className="stride-table handicap-sheet">
          <thead>
            <tr>
              {race.columns.map((column) => <th key={column}>{HANDICAP_COLUMN_LABEL[column]}</th>)}
            </tr>
          </thead>
          <tbody>
            {race.runners.map((runner) => (
              <tr key={runner.id}>
                {race.columns.map((column) => (
                  <td key={column}>{column === "horse" ? handicapHorse(runner) : shown(handicapValue(runner, column))}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function handicapHorse(runner: IndiaHandicapRunner) {
  const label = shown(runner.horse);
  const href = indiaHorseHash(runner.sourceHorseId, runner.sourceHorseName);
  if (!href) return label;
  return <a href={href}>{label}</a>;
}

function handicapValue(runner: IndiaHandicapRunner, column: IndiaHandicapColumn): string | number | null {
  switch (column) {
    case "serial":
      return runner.serial;
    case "horse":
      return runner.horse;
    case "description":
      return runner.description;
    case "pedigree":
      return runner.pedigree;
    case "trainer":
      return runner.trainer;
    case "jockey":
      return runner.jockey;
    case "weight":
      return runner.weight;
    case "rating":
      return runner.rating;
  }
}
