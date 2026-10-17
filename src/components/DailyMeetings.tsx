import { useEffect, useMemo, useState } from "react";
import { filterRaces, groupRaces, nextRaces } from "../meetings/board";
import { USER_TIMEZONE, calendarDate, clockTime, timezoneShort } from "../meetings/time";
import type { MeetingsPayload, RaceStatus, WireRace } from "../meetings/types";

const MEETING_TIMEZONE = "Australia/Sydney";
const STATUSES: Array<RaceStatus | "all"> = ["all", "Upcoming", "Delayed", "Live", "Finished", "Abandoned", "Cancelled"];

function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatStamp(iso: string): string {
  const date = new Date(iso);
  return `${formatDay(calendarDate(USER_TIMEZONE, date))} ${clockTime(USER_TIMEZONE, date)} ${timezoneShort(USER_TIMEZONE, date)}`;
}

function localClock(race: WireRace): string {
  if (race.timezone && race.startInstant) {
    const date = new Date(race.startInstant);
    return `${clockTime(race.timezone, date)} ${timezoneShort(race.timezone, date)}`;
  }
  return race.publishedOffTime ? `${race.publishedOffTime} published` : "Time unavailable";
}

function userClock(race: WireRace): string {
  if (!race.startInstant) return "Conversion unavailable";
  const date = new Date(race.startInstant);
  return `${clockTime(USER_TIMEZONE, date)} ${timezoneShort(USER_TIMEZONE, date)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function DailyMeetings() {
  const [followToday, setFollowToday] = useState(true);
  const [date, setDate] = useState(() => calendarDate(MEETING_TIMEZONE, new Date()));
  const [payload, setPayload] = useState<MeetingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState("all");
  const [region, setRegion] = useState("all");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    if (!followToday) return;
    const sync = () => setDate(calendarDate(MEETING_TIMEZONE, new Date()));
    sync();
    const timer = window.setInterval(sync, 30000);
    return () => window.clearInterval(timer);
  }, [followToday]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/meetings?date=${date}`);
        if (!response.ok) throw new Error(`The schedule request failed (${response.status}).`);
        const body = (await response.json()) as MeetingsPayload;
        if (!ignore) {
          setPayload(body);
          setError(null);
        }
      } catch (reason) {
        if (!ignore) setError(reason instanceof Error ? reason.message : "The schedule request failed.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [date]);

  const current = payload?.requestedDate === date ? payload : null;
  const races = current?.races ?? [];
  const countries = unique(races.map((race) => race.countryName));
  const regions = unique(races.filter((race) => country === "all" || race.countryName === country).map((race) => race.region));
  const courses = unique(
    races
      .filter((race) => (country === "all" || race.countryName === country) && (region === "all" || race.region === region))
      .map((race) => race.course),
  );
  const filtered = useMemo(
    () => filterRaces(races, { country, region, course, status }),
    [races, country, region, course, status],
  );
  const upcoming = (current?.nextToGo?.length ? current.nextToGo : nextRaces(filtered)).filter((race) => status === "all" || race.status === status);
  const groups = groupRaces(filtered);

  function chooseDate(value: string) {
    setFollowToday(false);
    setDate(value);
  }

  return (
    <section id="meetings" className="daily-board">
      <div className="section-head">
        <div>
          <p className="kicker">Published meetings</p>
          <h2>Race meetings</h2>
        </div>
        <div className="date-controls">
          <label>
            Sydney meeting date
            <input
              type="date"
              value={date}
              min={current?.window?.minDate}
              max={current?.window?.maxDate}
              onChange={(event) => chooseDate(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              setFollowToday(true);
              setDate(calendarDate(MEETING_TIMEZONE, new Date()));
            }}
          >
            Today
          </button>
        </div>
      </div>
      <p className="meta">
        The meeting calendar is {MEETING_TIMEZONE}. Each race also shows its racecourse-local date when that timezone is verified, and the start time in {USER_TIMEZONE}.
        {followToday ? " Today moves forward at midnight in Australia/Sydney." : " A specific Sydney date is selected."}
      </p>
      {current?.window?.note ? <p className="meta">{current.window.note}</p> : null}
      {current?.budgetNote ? <p className="warn">{current.budgetNote}</p> : null}

      {current && (
        <p className="meta">
          {current.lastUpdated ? `Last updated ${formatStamp(current.lastUpdated)}` : "No successful update yet"}. Source:{" "}
          {current.sources.map((source) => source.name).join(", ") || "none"}.
        </p>
      )}
      {current?.stale && (
        <p className="warn">
          This is the last successful schedule. The latest refresh failed
          {current.staleReason ? `: ${current.staleReason}` : ""}.
        </p>
      )}
      {error && current && <p className="warn">The latest refresh could not be loaded. Showing the previous response. {error}</p>}

      <div className="filters">
        <label>
          Country
          <select
            value={countries.includes(country) || country === "all" ? country : "all"}
            onChange={(event) => {
              setCountry(event.target.value);
              setRegion("all");
              setCourse("all");
            }}
          >
            <option value="all">All countries</option>
            {countries.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          State / region
          <select
            value={regions.includes(region) || region === "all" ? region : "all"}
            onChange={(event) => {
              setRegion(event.target.value);
              setCourse("all");
            }}
          >
            <option value="all">All regions</option>
            {regions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Racecourse
          <select value={courses.includes(course) || course === "all" ? course : "all"} onChange={(event) => setCourse(event.target.value)}>
            <option value="all">All racecourses</option>
            {courses.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Race status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!current && !error && <p className="callout">Loading race meetings…</p>}
      {error && !current && <p className="warn">Race data is unavailable. {error}</p>}
      {current?.mode === "unavailable" && <p className="warn">Race data is unavailable. {current.message}</p>}
      {current?.mode === "outside-window" && <p className="callout">{current.message}</p>}
      {current?.mode === "schedule" && current.message ? <p className="callout">{current.message}</p> : null}
      {current?.mode === "schedule" && !current.message && filtered.length === 0 && races.length === 0 && (
        <p className="callout">No race meetings scheduled.</p>
      )}
      {current?.mode === "schedule" && races.length > 0 && filtered.length === 0 && (
        <p className="callout">No races match these filters.</p>
      )}

      {upcoming.length > 0 && (
        <section className="next-races">
          <h3>{current?.nextToGo?.length ? "Next races with prices" : "Next races"}</h3>
          <p className="meta">
            {current?.nextToGo?.length
              ? "From /racing/next-to-go. This is the priced board, not the full-day card."
              : "Upcoming races on the loaded card, earliest start first. A blank status stays Upcoming."}
          </p>
          <ul className="race-list">
            {upcoming.map((race) => (
              <RaceRow key={race.id} race={race} />
            ))}
          </ul>
        </section>
      )}

      {groups.map((countryGroup) => (
        <section key={countryGroup.code + countryGroup.name} className="country-meetings">
          <h3>
            {countryGroup.flag ? <span aria-hidden="true">{countryGroup.flag} </span> : null}
            {countryGroup.name}
          </h3>
          {countryGroup.regions.map((regionGroup) => (
            <div key={regionGroup.name} className="region-block">
              <h4>{regionGroup.name}</h4>
              {regionGroup.courses.map((courseGroup) => (
                <article key={`${courseGroup.name}-${courseGroup.meetingDate}`} className="course-meeting">
                  <header>
                    <h5>{courseGroup.name}</h5>
                    <p className="meta">
                      {courseGroup.localDateVerified
                        ? `Meeting date ${formatDay(courseGroup.meetingDate)}`
                        : `Provider date ${formatDay(courseGroup.meetingDate)}. Local meeting date is not verified.`}
                      {courseGroup.timezone ? ` · ${courseGroup.timezone}` : " · Timezone unavailable"}
                    </p>
                  </header>
                  <ul className="race-list">
                    {courseGroup.races.map((race, index) => (
                      <RaceRow key={race.id} race={race} order={index + 1} />
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          ))}
        </section>
      ))}

      {current && current.coverage.length > 0 && (
        <section className="coverage">
          <h3>Coverage</h3>
          <ul>
            {current.coverage.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong> · {item.state}. {item.detail}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function RaceRow({ race, order }: { race: WireRace; order?: number }) {
  const label = race.raceNumber ? `Race ${race.raceNumber}` : order ? `Off-time order ${order}` : "Race";
  return (
    <li className="race-row">
      <div>
        <p className="race-title">
          <span className={`status status-${race.status.toLowerCase()}`}>{race.status}</span>
          <strong>
            {label} · {race.name}
          </strong>
        </p>
        {!race.raceNumber && order ? <p className="meta">The feed did not publish an official race number.</p> : null}
        {race.rawStatus && race.status === "Upcoming" ? <p className="meta">Feed status: {race.rawStatus}</p> : null}
        <p className="meta">
          {race.flag} {race.countryName} · {race.region} · {race.course}
        </p>
        <p className="meta">
          Local {localClock(race)}
          {race.timezone ? "" : " · timezone unavailable"} · Your time {userClock(race)}
        </p>
        <p className="meta">
          {[race.distance, race.raceClass, race.surface, race.going].filter(Boolean).join(" · ") || "Distance, class, surface, and going were not published."}
        </p>
        {race.quotes?.length ? (
          <p className="meta">
            {race.oddsStale ? "Outdated odds" : "Quoted odds"}:{" "}
            {race.quotes.map((quote) => `${quote.bookmaker} ${quote.winPrice ?? "—"}`).join(", ")}
            {race.oddsAgeSeconds != null ? ` · oldest quote ${race.oddsAgeSeconds}s` : ""}
          </p>
        ) : null}
      </div>
      <a className="button" href={`#/live/${encodeURIComponent(race.id)}`}>
        Race card
      </a>
    </li>
  );
}
