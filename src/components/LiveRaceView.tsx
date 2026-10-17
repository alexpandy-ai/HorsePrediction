import { useEffect, useState } from "react";
import { scorePublishedForm } from "../engine/handicap";
import { USER_TIMEZONE, calendarDate, clockTime, timezoneShort } from "../meetings/time";
import type { WireRace, WireRunner } from "../meetings/types";
import { FormFigures, SourceTag } from "./bits";

interface RacePayload {
  race: WireRace;
  lastUpdated: string | null;
  stale: boolean;
  staleReason: string | null;
}

export function LiveRaceView({ raceId }: { raceId: string }) {
  const [payload, setPayload] = useState<RacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const response = await fetch(`/api/races/${encodeURIComponent(raceId)}`);
        if (response.status === 404) throw new Error("This race is not in the current feed.");
        if (!response.ok) throw new Error(`The race card could not be loaded (${response.status}).`);
        const body = (await response.json()) as RacePayload;
        if (!ignore) {
          setPayload(body);
          setError(null);
        }
      } catch (reason) {
        if (!ignore) setError(reason instanceof Error ? reason.message : "The race card could not be loaded.");
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    return () => {
      ignore = true;
      window.clearInterval(timer);
    };
  }, [raceId]);

  if (error && !payload) {
    return (
      <div className="wrap">
        <p className="warn">Race data is unavailable. {error}</p>
        <a href="#/">Back to meetings</a>
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="wrap">
        <p className="callout">Loading the race card…</p>
      </div>
    );
  }

  const { race } = payload;
  const ranked = race.runners
    .map((runner) => ({ runner, form: runner.form ? scorePublishedForm(runner.form, runner.daysSince) : null }))
    .sort((a, b) => (b.form?.score ?? -1) - (a.form?.score ?? -1));

  return (
    <div className="wrap">
      <p className="kicker">
        <a href="#/">Meetings</a>
        {" · "}
        {race.flag} {race.countryName} · {race.region} · {race.course}
      </p>
      <h1>{race.name}</h1>
      <p className="meta">
        Status {race.status}
        {race.rawStatus ? ` · feed status “${race.rawStatus}”` : ""}. Source: {race.source}.
        {payload.lastUpdated
          ? ` Last updated ${calendarDate(USER_TIMEZONE, new Date(payload.lastUpdated))} ${clockTime(USER_TIMEZONE, new Date(payload.lastUpdated))} ${timezoneShort(USER_TIMEZONE, new Date(payload.lastUpdated))}.`
          : ""}
      </p>
      {payload.stale && (
        <p className="warn">
          Showing the last successful card. The latest refresh failed
          {payload.staleReason ? `: ${payload.staleReason}` : ""}.
        </p>
      )}
      <dl className="facts">
        <div>
          <dt>Local start</dt>
          <dd>
            {race.timezone && race.startInstant
              ? `${clockTime(race.timezone, new Date(race.startInstant))} ${timezoneShort(race.timezone, new Date(race.startInstant))}`
              : race.publishedOffTime ?? "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Your time</dt>
          <dd>
            {race.startInstant
              ? `${clockTime(USER_TIMEZONE, new Date(race.startInstant))} ${timezoneShort(USER_TIMEZONE, new Date(race.startInstant))}`
              : "Unavailable"}
          </dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>{race.distance ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Class</dt>
          <dd>{race.raceClass ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Surface</dt>
          <dd>{race.surface ?? "Not published"}</dd>
        </div>
        <div>
          <dt>Going</dt>
          <dd>{race.going ?? "Not published"}</dd>
        </div>
      </dl>
      <p className="meta">
        <SourceTag kind="official" /> Runner details are the published card. <SourceTag kind="calculated" /> The form score uses
        only the published form figures. Pace, speed, class, weight, rating movement, distance, and course are not scored here
        because this feed does not supply them. The full handicapper remains on the sample cards.
      </p>
      <div className="table-scroll">
        <table className="race-table">
          <caption>
            {race.runners.length} published runners. Form score is calculated from the published figures only.
          </caption>
          <thead>
            <tr>
              <th>No</th>
              <th>Barrier</th>
              <th>Horse</th>
              <th>Form</th>
              <th>Form score</th>
              <th>Weight</th>
              <th>OR</th>
              <th>Odds</th>
              <th>Jockey</th>
              <th>Trainer</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ runner, form }) => (
              <RunnerRow key={runner.id} runner={runner} score={form?.score ?? null} note={form?.note ?? null} />
            ))}
          </tbody>
        </table>
      </div>
      {race.runners.length === 0 && <p className="callout">No runners were published for this race.</p>}
      {race.oddsStale ? <p className="warn">The odds on this card are older than the provider's freshness threshold. They are not current prices.</p> : null}
      <FeaturePanel raceId={race.id} />
    </div>
  );
}

function FeaturePanel({ raceId }: { raceId: string }) {
  const [feature, setFeature] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");
  const actions = [
    ["form", "Form"],
    ["best-odds", "Best odds"],
    ["markets", "Markets"],
    ["consensus", "Consensus"],
    ["intelligence", "Intelligence"],
    ["price-history", "Price history"],
    ["track", "Track"],
    ["movers", "Movers"],
    ["scan", "Scan"],
  ] as const;

  async function open(name: string) {
    setFeature(name);
    setResult("Loading…");
    try {
      if (name === "movers" || name === "scan") {
      const response = await fetch(name === "scan" ? "/api/scan" : "/api/movers");
      const body = (await response.json()) as { available?: boolean; message?: string | null; body?: unknown };
      if (!body.available) {
        setResult(body.message || "Movers are not available on the current plan or budget.");
        return;
      }
      setResult(JSON.stringify(body.body, null, 2).slice(0, 4000));
      return;
    }
    const response = await fetch(`/api/races/${encodeURIComponent(raceId)}/${name}`);
      const body = (await response.json()) as { available?: boolean; message?: string | null; body?: unknown };
      if (!body.available) {
        setResult(body.message || "This PuntersEdge feature is not available on the current plan or budget.");
        return;
      }
      setResult(JSON.stringify(body.body, null, 2).slice(0, 4000));
    } catch (reason) {
      setResult(reason instanceof Error ? reason.message : "The request failed.");
    }
  }

  return (
    <section className="callout">
      <h2>Race analysis</h2>
      <p className="meta">
        These calls run only after you open them. Odds, consensus, and market notes are bookmaker information, not a prediction. Missing form stays missing.
      </p>
      <div className="hero-actions">
        {actions.map(([name, label]) => (
          <button key={name} type="button" className="button secondary" onClick={() => void open(name)}>
            {label}
          </button>
        ))}
      </div>
      {feature ? <pre className="meta">{result}</pre> : null}
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const role = String(data.get("role") || "jockey");
          const name = String(data.get("name") || "");
          setFeature(role);
          setResult("Loading…");
          const path =
            role === "horse" || role === "runs"
              ? `/api/horse?kind=${role === "runs" ? "runs" : "form"}&name=${encodeURIComponent(name)}`
              : `/api/stats?role=${encodeURIComponent(role)}&name=${encodeURIComponent(name)}`;
          void fetch(path)
            .then((response) => response.json())
            .then((body: { available?: boolean; message?: string | null; body?: unknown }) => {
              setResult(body.available ? JSON.stringify(body.body, null, 2).slice(0, 4000) : body.message || "Unavailable");
            })
            .catch((reason: unknown) => setResult(reason instanceof Error ? reason.message : "The request failed."));
        }}
      >
        <label>
          Jockey or trainer
          <input name="name" placeholder="Name" />
        </label>
        <div className="hero-actions">
          <button className="button secondary" name="role" value="jockey" type="submit">
            Jockey stats
          </button>
          <button className="button secondary" name="role" value="trainer" type="submit">
            Trainer stats
          </button>
          <button className="button secondary" name="role" value="horse" type="submit">
            Horse form
          </button>
          <button className="button secondary" name="role" value="runs" type="submit">
            Horse runs
          </button>
        </div>
      </form>
    </section>
  );
}

function RunnerRow({ runner, score, note }: { runner: WireRunner; score: number | null; note: string | null }) {
  return (
    <tr>
      <td>{runner.number ?? "—"}</td>
      <td>{runner.draw ?? "—"}</td>
      <td>
        <span className="horse-name">{runner.name}</span>
        <small>
          {[runner.scratched ? "Scratched" : null, runner.position != null ? `Finished ${runner.position}` : null, runner.age ? `${runner.age}yo` : null, runner.sex, runner.headgear]
            .filter(Boolean)
            .join(" · ") || "—"}
        </small>
      </td>
      <td>{runner.form ? <FormFigures form={runner.form} /> : "—"}</td>
      <td>
        {score == null ? "—" : score}
        {note ? <small>{note}</small> : null}
      </td>
      <td>{runner.weight ?? "—"}</td>
      <td>{runner.officialRating ?? "—"}</td>
      <td>
        {runner.quotes?.length
          ? runner.quotes.map((quote) => (
              <small key={quote.bookmaker}>
                {quote.stale ? "Outdated" : "Quoted"} {quote.bookmaker} {quote.winPrice ?? "—"}
                {quote.ageSeconds != null ? ` · ${quote.ageSeconds}s` : ""}
                {quote.quotedAt ? ` · ${quote.quotedAt}` : ""}
              </small>
            ))
          : "—"}
      </td>
      <td>{runner.jockey ?? "—"}</td>
      <td>{runner.trainer ?? "—"}</td>
    </tr>
  );
}
