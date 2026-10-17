import { useEffect, useState } from "react";
import { addCalendarDays, calendarDate } from "../meetings/time";
import { fixturesOnDate, groupByState } from "./stateMeetingMapper";
import { loadLastUpdated, loadMeetings, type LastUpdatedFile, type MeetingsFile } from "./load";
import { cardKey, type CardSummary, type IndiaFixture } from "./types";

const IST = "Asia/Kolkata";

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: IST,
  }).format(new Date(iso));
}

export function HomePage() {
  const [follow, setFollow] = useState<"today" | "tomorrow" | "date">("today");
  const [date, setDate] = useState(() => calendarDate(IST, new Date()));
  const [meetingsFile, setMeetingsFile] = useState<MeetingsFile | null>(null);
  const [published, setPublished] = useState<LastUpdatedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [bust, setBust] = useState("");

  useEffect(() => {
    if (follow === "date") return;
    const sync = () => setDate(addCalendarDays(calendarDate(IST, new Date()), follow === "tomorrow" ? 1 : 0));
    sync();
    const timer = window.setInterval(sync, 30000);
    return () => window.clearInterval(timer);
  }, [follow]);

  useEffect(() => {
    let ignore = false;
    void Promise.all([loadMeetings(bust), loadLastUpdated(bust)]).then(([meetings, updated]) => {
      if (ignore) return;
      setMeetingsFile(meetings.meetings);
      setPublished(updated);
      setError(meetings.error);
    });
    return () => {
      ignore = true;
    };
  }, [bust]);

  const fixtures = meetingsFile ? fixturesOnDate(meetingsFile.fixtures, date) : [];
  const rows = fixtures.map((fixture) => {
    const card = meetingsFile?.cards[cardKey(fixture.date, fixture.venueId)] ?? null;
    return { ...fixture, card, firstRaceMinutes: card?.firstRaceMinutes ?? null };
  });
  const groups = groupByState(rows);
  const synchronized = rows.filter((row) => row.card);
  const raceTotal = synchronized.reduce((sum, row) => sum + (row.card?.raceCount ?? 0), 0);
  const partial = rows.length > 0 && synchronized.length !== rows.length;
  const fixturesReady = Boolean(meetingsFile?.fixturesComplete);
  const noMeetings = Boolean(meetingsFile && fixturesReady && fixtures.length === 0 && !error);

  function refresh() {
    setRefreshing(true);
    setNotice("Reloaded the published files. This page does not contact Indiarace.");
    setBust(`?v=${Date.now()}`);
    setRefreshing(false);
  }

  return (
    <div className="stride">
      <section className="stride-hero">
        <div className="wrap stride-hero-inner">
          <p className="kicker">India · Indiarace</p>
          <h1>STRIDE Horse Racing</h1>
          <p className="lede">Meetings for the selected Indian date, grouped by state. These racecards are the last published Indiarace snapshot.</p>
          <div className="stride-toolbar">
            <button type="button" className={follow === "today" ? "is-on" : ""} onClick={() => setFollow("today")}>
              Today
            </button>
            <button type="button" className={follow === "tomorrow" ? "is-on" : ""} onClick={() => setFollow("tomorrow")}>
              Tomorrow
            </button>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setFollow("date");
                  setDate(event.target.value);
                }}
              />
            </label>
            <button type="button" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Checking…" : "Refresh"}
            </button>
          </div>
        </div>
      </section>
      <div className="wrap">
        <div className="stride-stats">
          <article>
            <span>Meetings</span>
            <strong>{meetingsFile && fixturesReady ? fixtures.length : "—"}</strong>
          </article>
          <article>
            <span>Scheduled races</span>
            <strong>{synchronized.length > 0 ? raceTotal : "—"}</strong>
          </article>
          <article>
            <span>Last published</span>
            <strong>{published?.publishedAt ? `${formatStamp(published.publishedAt)} IST` : "—"}</strong>
          </article>
        </div>
        <p className="meta">
          Showing {formatDay(date)}. The calendar is Asia/Kolkata. {partial ? "Race totals include published racecards only." : "Source: Indiarace."}{" "}
          {published?.note}
        </p>
        {notice ? <p className="callout">{notice}</p> : null}
        {error ? <p className="warn">The published meetings could not be loaded. {error}</p> : null}
        {!meetingsFile && !error ? <p className="callout">Loading the published snapshot…</p> : null}
        {noMeetings ? <p className="callout">No races scheduled for this date.</p> : null}
        {meetingsFile && !fixturesReady && !error ? <p className="warn">The published snapshot does not include a complete meeting list.</p> : null}

        {groups.map((group) => (
          <section key={group.state} className="stride-state">
            <h2>{group.state}</h2>
            <div className="stride-meetings">
              {group.meetings.map((meeting) => (
                <MeetingTile key={`${meeting.date}-${meeting.venueId}`} meeting={meeting} card={meeting.card} />
              ))}
            </div>
          </section>
        ))}
        <p className="meta">
          <a href="#/sample">Sample cards</a> stay separate from these meetings.
        </p>
      </div>
    </div>
  );
}

function MeetingTile({ meeting, card }: { meeting: IndiaFixture; card: CardSummary | null }) {
  return (
    <a className="stride-meeting" href={`#/meeting/${meeting.date}/${meeting.venueId}`}>
      <h3>
        {meeting.course} Racecourse{card ? ` — ${card.raceCount} races` : ""}
      </h3>
      <p>{formatDay(meeting.date)}</p>
      <p>{card?.firstRaceTime ? `First ${card.firstRaceTime} IST` : "First race time —"} · {card?.lastRaceTime ? `Last ${card.lastRaceTime} IST` : "Last race time —"}</p>
      <p className="meta">{card ? `Source ${card.sourceStatus}${card.stale ? ", outdated" : ""}` : "Racecard not in this publication"}</p>
    </a>
  );
}
