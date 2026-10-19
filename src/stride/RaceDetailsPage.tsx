import { useEffect, useState } from "react";
import { indiaHorseHash } from "./horseStatistics";
import { loadCard } from "./load";
import type { IndiaMeeting, IndiaRace, IndiaRunner } from "./types";

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

export function RaceDetailsPage({ date, venueId, raceNumber }: { date: string; venueId: string; raceNumber: number }) {
  const [race, setRace] = useState<IndiaRace | null>(null);
  const [meeting, setMeeting] = useState<IndiaMeeting | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    void loadCard(date, venueId).then((card) => {
      if (ignore) return;
      setMeeting(card);
      setRace(card?.races.find((item) => item.raceNumber === raceNumber) ?? null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [date, venueId, raceNumber]);

  useEffect(() => {
    if (race?.name) document.title = `${race.name} — STRIDE`;
  }, [race]);

  if (!ready) return <div className="wrap"><p className="callout">Loading the race…</p></div>;
  if (!meeting || !race) {
    return (
      <div className="wrap">
        <h1>Race unavailable</h1>
        <p className="warn">This race is not in the published Indiarace snapshot.</p>
        <p><a href="#/">Back to meetings</a></p>
      </div>
    );
  }

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
