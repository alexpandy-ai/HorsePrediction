import { useEffect, useState } from "react";
import { formfavCountry, type FormfavCountryCode } from "./countries";
import { loadFormfavMeetings } from "./load";
import { dash, formatDay, localClock } from "./present";
import type { FormfavMeeting } from "./types";

export function FormfavMeetingPage({ country, date, slug }: { country: FormfavCountryCode; date: string; slug: string }) {
  const [meeting, setMeeting] = useState<FormfavMeeting | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    void loadFormfavMeetings(country).then((file) => {
      if (ignore) return;
      const slice = file?.dates[date];
      setConfirmed(Boolean(slice?.confirmed));
      setMeeting(slice?.meetings.find((item) => item.slug === slug) ?? null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [country, date, slug]);

  if (!ready) return <div className="wrap"><p className="callout">Loading the racecard…</p></div>;
  if (!meeting) {
    return (
      <div className="wrap">
        <h1>Racecard unavailable</h1>
        <p className="warn">This meeting is not in the published FormFav snapshot.</p>
        <p><a href={`#/ff/${country}`}>Back to {formfavCountry(country).name}</a></p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <p className="kicker">{formfavCountry(country).name} · FormFav · Region unavailable</p>
      <h1>{meeting.track}</h1>
      <p className="meta">{formatDay(date)} · {meeting.races.length} races · {confirmed ? "Schedule confirmed" : "Schedule not newly confirmed"}{meeting.abandoned ? " · Abandoned" : ""}</p>
      <ol className="stride-races">
        {meeting.races.map((race) => (
          <li key={race.raceNumber}>
            <a href={`#/ff/${country}/race/${date}/${encodeURIComponent(slug)}/${race.raceNumber}`}>
              <strong>Race {race.raceNumber}</strong>
              <span>{localClock(race.startTime, race.timezone)}</span>
              <span>{race.raceName ?? "—"}</span>
              <small>{dash(race.distance)} · {dash(race.raceClass)} · {race.numberOfRunners ?? "—"} runners{race.condition ? ` · ${race.condition}` : ""}{race.weather ? ` · ${race.weather}` : ""}{race.prizeMoney ? ` · ${race.prizeMoney}` : ""}{race.abandoned ? " · Abandoned" : ""}</small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
