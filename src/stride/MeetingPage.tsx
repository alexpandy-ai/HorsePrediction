import { useEffect, useState } from "react";
import { loadCard } from "./load";
import type { IndiaMeeting } from "./types";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function MeetingPage({ date, venueId }: { date: string; venueId: string }) {
  const [meeting, setMeeting] = useState<IndiaMeeting | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    void loadCard(date, venueId).then((card) => {
      if (ignore) return;
      setMeeting(card);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [date, venueId]);

  if (!ready) return <div className="wrap"><p className="callout">Loading the racecard…</p></div>;
  if (!meeting) {
    return (
      <div className="wrap">
        <p className="kicker">Meeting</p>
        <h1>Racecard unavailable</h1>
        <p className="warn">This racecard is not in the published snapshot.</p>
        <p><a href="#/">Back to meetings</a></p>
      </div>
    );
  }

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
              <span>Race {race.raceNumber}</span>
              <strong>{race.time ? `${race.time} IST` : "Time —"}</strong>
              <em>{race.name ?? "—"}</em>
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
