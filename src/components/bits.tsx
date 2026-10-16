import { useState } from "react";
import { getCountry, getCourse, getMeeting, getRace, racesForMeeting, runners } from "../data";
import { formatDate } from "../format";
import type { Meeting } from "../types";

export function SourceTag({ kind }: { kind: "official" | "calculated" }) {
  return (
    <span className={kind === "official" ? "tag tag-off" : "tag tag-calc"}>
      {kind === "official" ? "Official" : "Calculated"}
    </span>
  );
}

export function FormFigures({ form }: { form: string }) {
  if (!form) return <span className="muted">Debut</span>;
  return (
    <span className="form" aria-label={`Form ${form}, latest run first`}>
      {form.split("-").map((token, index) => {
        const position = Number(token);
        const tone =
          position === 1 ? "fig-win" : position === 2 || position === 3 ? "fig-place" : position <= 6 ? "fig-mid" : "fig-poor";
        return (
          <span key={`${token}-${index}`} className={`fig ${tone}`}>
            {token}
          </span>
        );
      })}
    </span>
  );
}

export function DemoNote() {
  return (
    <p className="demo-note">
      Demonstration cards for Saturday 17 October 2026. Names, ratings, times, and archive results are illustrative,
      so the model can be reviewed without a live feed. <SourceTag kind="official" /> marks card and record fields.{" "}
      <SourceTag kind="calculated" /> marks figures produced by the handicapping model.
    </p>
  );
}

export function HorseSearch() {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches =
    needle.length < 2 ? [] : runners.filter((runner) => runner.name.toLowerCase().includes(needle)).slice(0, 8);

  return (
    <div className="search">
      <label>
        <span>Find a horse</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type at least two letters" />
      </label>
      {needle.length >= 2 && (
        <ul>
          {matches.length === 0 && <li className="muted">No runner by that name on these cards.</li>}
          {matches.map((runner) => {
            const race = getRace(runner.raceId);
            const meeting = race ? getMeeting(race.meetingId) : undefined;
            const course = meeting ? getCourse(meeting.courseId) : undefined;
            if (!race || !course) return null;
            return (
              <li key={runner.id}>
                <a href={`#/race/${race.id}/${runner.id}`}>
                  <strong>{runner.name}</strong>
                  <span>
                    {course.shortName} · Race {race.number} · {race.name}
                  </span>
                  {runner.nonRunner && <em>SCR</em>}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function MeetingCard({ meeting }: { meeting: Meeting }) {
  const course = getCourse(meeting.courseId);
  if (!course) return null;
  const country = getCountry(course.countryId);
  const card = racesForMeeting(meeting.id);
  const scratched = runners.filter(
    (runner) => runner.nonRunner && card.some((race) => race.id === runner.raceId),
  ).length;

  return (
    <article className="meeting-card" data-country={course.countryId}>
      <p className="kicker">{country.name}</p>
      <h3>
        <a href={`#/course/${course.id}`}>{course.shortName}</a>
      </h3>
      <p className="meeting-place">{course.name}</p>
      <dl className="facts">
        <div>
          <dt>Date</dt>
          <dd>{formatDate(meeting.date)}</dd>
        </div>
        <div>
          <dt>Going</dt>
          <dd>{meeting.going}</dd>
        </div>
        <div>
          <dt>Weather</dt>
          <dd>{meeting.weather}</dd>
        </div>
        <div>
          <dt>Rail</dt>
          <dd>{meeting.rail}</dd>
        </div>
      </dl>
      <p className="meta">
        {card.length} races on this sample card
        {scratched > 0 ? ` · ${scratched} non-runner${scratched === 1 ? "" : "s"}` : ""}
      </p>
      <ul className="race-links">
        {card.map((race) => (
          <li key={race.id}>
            <a href={`#/race/${race.id}`}>
              <span>R{race.number}</span>
              <strong>{race.name}</strong>
              <em>
                {race.time} local · {race.distanceLabel} · {race.classLabel}
              </em>
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function NotFound() {
  return (
    <div className="wrap">
      <h1>That page is not on the card</h1>
      <p>The link does not match a race, course, or country in this demonstration.</p>
      <a className="button" href="#/">
        Back to the form
      </a>
    </div>
  );
}
