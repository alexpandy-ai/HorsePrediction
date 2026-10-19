import { useEffect, useState } from "react";
import { addCalendarDays, calendarDate } from "../../meetings/time";
import { formfavCountry, type FormfavCountryCode } from "./countries";
import { CountryTabs } from "./CountryTabs";
import { loadFormfavMeetings, loadFormfavStatus } from "./load";
import { dash, formatDay, raceSpan } from "./present";
import type { FormfavImportStatus, FormfavMeeting, FormfavMeetingsFile } from "./types";

export function InternationalHome({ country }: { country: FormfavCountryCode }) {
  const config = formfavCountry(country);
  const [follow, setFollow] = useState<"today" | "tomorrow" | "date">("today");
  const [date, setDate] = useState(() => calendarDate(config.calendarTimezone, new Date()));
  const [meetings, setMeetings] = useState<FormfavMeetingsFile | null>(null);
  const [status, setStatus] = useState<FormfavImportStatus | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (follow === "date") return;
    const sync = () => setDate(addCalendarDays(calendarDate(config.calendarTimezone, new Date()), follow === "tomorrow" ? 1 : 0));
    sync();
    const timer = window.setInterval(sync, 30000);
    return () => window.clearInterval(timer);
  }, [follow, config.calendarTimezone]);

  useEffect(() => {
    let ignore = false;
    setReady(false);
    void Promise.all([loadFormfavMeetings(country), loadFormfavStatus()]).then(([file, imported]) => {
      if (ignore) return;
      setMeetings(file);
      setStatus(imported);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [country]);

  const slice = meetings?.dates[date];
  const countryStatus = status?.countries[country];
  const unsupported = countryStatus?.coverage === "no-gallops-venues";

  return (
    <div className="stride">
      <section className="stride-hero">
        <div className="wrap stride-hero-inner">
          <CountryTabs current={country} />
          <div className="stride-toolbar">
            <button type="button" className={follow === "today" ? "is-on" : ""} onClick={() => setFollow("today")}>Today</button>
            <button type="button" className={follow === "tomorrow" ? "is-on" : ""} onClick={() => setFollow("tomorrow")}>Tomorrow</button>
            <label>
              Date
              <input type="date" value={date} onChange={(event) => { setFollow("date"); setDate(event.target.value); }} />
            </label>
          </div>
        </div>
      </section>
      <div className="wrap">
        {!ready ? <p className="callout">Loading the published snapshot…</p> : null}
        {ready && !status ? <p className="warn">The FormFav snapshot is not in this publication.</p> : null}
        {ready && status && !status.configured ? <p className="callout">{countryStatus?.note}</p> : null}
        {ready && unsupported ? <p className="warn">{countryStatus?.note} No meeting cards are shown.</p> : null}
        {ready && status?.configured && !unsupported && !slice ? <p className="callout">This date has not been confirmed by a FormFav import.</p> : null}
        {ready && slice && !slice.confirmed ? <p className="warn">This is not a newly confirmed schedule. {slice.error ?? "The latest import failed."} {slice.fetchedAt ? `Last successful update ${slice.fetchedAt}.` : ""}</p> : null}
        {ready && slice?.confirmed && slice.empty ? <p className="callout">No races scheduled for this date.</p> : null}
        {slice && slice.meetings.length > 0 ? (
          <section className="stride-state">
            <h2>Region unavailable</h2>
            <div className="stride-meetings">
              {slice.meetings.map((meeting) => (
                <MeetingCard key={meeting.slug} meeting={meeting} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function MeetingCard({ meeting }: { meeting: FormfavMeeting }) {
  const span = raceSpan(meeting.races);
  return (
    <a className="stride-meeting" href={`#/ff/${meeting.country}/meeting/${meeting.date}/${encodeURIComponent(meeting.slug)}`}>
      <h3>{meeting.track}{meeting.abandoned ? " — abandoned" : ""} — {meeting.races.length} races</h3>
      <p>{formatDay(meeting.date)}</p>
      <p>First {span.first} · Last {span.last}</p>
      <p className="meta">Source FormFav · {dash(meeting.region)}</p>
    </a>
  );
}
