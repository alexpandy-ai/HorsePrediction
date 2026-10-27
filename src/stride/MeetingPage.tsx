import { useEffect, useState } from "react";
import { HANDICAP_NOTICE, preferRacecard } from "./indiaDocument";
import { loadCard, loadHandicap } from "./load";
import type { IndiaHandicapSheet, IndiaMeeting } from "./types";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

type MeetingView =
  | { kind: "racecard"; meeting: IndiaMeeting }
  | { kind: "handicap"; sheet: IndiaHandicapSheet }
  | { kind: "missing" };

export function MeetingPage({ date, venueId }: { date: string; venueId: string }) {
  const [view, setView] = useState<MeetingView | null>(null);

  useEffect(() => {
    let ignore = false;
    void Promise.all([loadCard(date, venueId), loadHandicap(date, venueId)]).then(([card, handicap]) => {
      if (ignore) return;
      const choice = preferRacecard(card, handicap);
      if (choice?.kind === "racecard") setView({ kind: "racecard", meeting: choice.card });
      else if (choice?.kind === "handicap") setView({ kind: "handicap", sheet: choice.sheet });
      else setView({ kind: "missing" });
    });
    return () => {
      ignore = true;
    };
  }, [date, venueId]);

  if (!view) return <div className="wrap"><p className="callout">Loading the racecard…</p></div>;
  if (view.kind === "missing") {
    return (
      <div className="wrap">
        <p className="kicker">Meeting</p>
        <h1>Racecard unavailable</h1>
        <p className="warn">This racecard is not in the published snapshot.</p>
        <p><a href="#/">Back to meetings</a></p>
      </div>
    );
  }
  if (view.kind === "handicap") return <HandicapMeeting sheet={view.sheet} />;
  return <RacecardMeeting meeting={view.meeting} />;
}

function RacecardMeeting({ meeting }: { meeting: IndiaMeeting }) {
  return (
    <div className="wrap stride-page">
      <p className="kicker">{meeting.state ?? "State unavailable"}</p>
      <h1>{meeting.course} Racecourse</h1>
      <p className="meta">
        {formatDay(meeting.date)} · {meeting.raceCount} races · Source {meeting.sourceStatus}
        {meeting.fetchedAt ? ` · Read ${formatDay(meeting.fetchedAt.slice(0, 10))}` : ""}
      </p>
      <p><a href={meeting.sourceUrl}>Indiarace racecard</a></p>
      {meeting.validationNotes.length > 0 ? (
        <div className="warn">
          <p>Review before using draws or missing fields.</p>
          <ul>{meeting.validationNotes.slice(0, 8).map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}
      <ol className="stride-races">
        {meeting.races.map((race) => (
          <li key={race.id}>
            <a href={`#/race-card/${meeting.date}/${meeting.venueId}/${race.raceNumber}`}>
              <span className="stride-race-line">
                <strong>{race.raceNumber}</strong>
                <em>{race.name ?? "—"}</em>
                <span>{race.time ? `${race.time} IST` : "—"}</span>
              </span>
              <small>
                {race.distanceM != null ? `${race.distanceM} m` : "Distance —"} · {race.classLabel ?? "Class —"} · {race.runnerCount} runners
              </small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function HandicapMeeting({ sheet }: { sheet: IndiaHandicapSheet }) {
  return (
    <div className="wrap stride-page">
      <p className="kicker">Published Indiarace handicap · {sheet.state ?? "State unavailable"}</p>
      <h1>{sheet.course} Racecourse</h1>
      <p className="callout">{HANDICAP_NOTICE}</p>
      <p className="meta">
        {formatDay(sheet.date)} · {sheet.raceCount} handicaps
        {sheet.raceDay ? ` · Race day ${sheet.raceDay}` : ""}
        {sheet.fetchedAt ? ` · Read ${formatDay(sheet.fetchedAt.slice(0, 10))}` : ""}
      </p>
      <p><a href={sheet.sourceUrl}>Indiarace handicap</a></p>
      {sheet.notes.length > 0 ? (
        <div className="warn">
          <ul>{sheet.notes.slice(0, 8).map((note) => <li key={note}>{note}</li>)}</ul>
        </div>
      ) : null}
      <ol className="stride-races">
        {sheet.races.map((race) => (
          <li key={race.id}>
            <a href={`#/race-card/${sheet.date}/${sheet.venueId}/${race.order}`}>
              <span className="stride-race-line">
                <strong>{race.order}</strong>
                <em>{race.name ?? "—"}</em>
                <span>—</span>
              </span>
              <small>{race.distanceLabel ?? "—"} · {race.conditions ?? "—"} · {race.runnerCount} horses</small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
