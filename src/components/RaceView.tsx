import { useEffect, useState } from "react";
import { getCourse, getMeeting, racesForMeeting, runnersForRace } from "../data";
import { analyse, swingLabel, type HandicapResult } from "../engine/handicap";
import { carriedKg, describeHorse, drawLabel, formatDate, formatWeight } from "../format";
import type { Race, RecordSplit, Runner } from "../types";
import { useWeights } from "../weights";
import { DemoNote, FormFigures, SourceTag } from "./bits";
import { ModelPanel } from "./ModelPanel";

export function RaceView({ race, runnerId }: { race: Race; runnerId?: string }) {
  const meeting = getMeeting(race.meetingId);
  const course = meeting ? getCourse(meeting.courseId) : undefined;
  const field = runnersForRace(race.id);
  const card = meeting ? racesForMeeting(meeting.id) : [];
  const { weights, setWeight, reset } = useWeights();
  const analysis = analyse(race, field, weights);
  const selected = field.find((runner) => runner.id === runnerId);
  const [sort, setSort] = useState<"card" | "model">("card");
  const [compare, setCompare] = useState<string[]>([]);
  const showSpeed = field.some((runner) => runner.publishedSpeed != null);
  const scoreOf = new Map(analysis.ranked.map((result) => [result.runner.id, result]));

  useEffect(() => {
    setCompare([]);
    setSort("card");
  }, [race.id]);

  useEffect(() => {
    if (!runnerId) return;
    document.getElementById("runner-detail")?.scrollIntoView({ block: "nearest" });
  }, [runnerId]);

  if (!meeting || !course) return null;

  const rows = [...field].sort((a, b) => {
    if (sort === "card") return a.number - b.number;
    if (a.nonRunner !== b.nonRunner) return a.nonRunner ? 1 : -1;
    return (scoreOf.get(b.id)?.total ?? 0) - (scoreOf.get(a.id)?.total ?? 0);
  });

  function toggleCompare(id: string) {
    setCompare((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length === 3) return [...current.slice(1), id];
      return [...current, id];
    });
  }

  const compared = compare
    .map((id) => analysis.ranked.find((result) => result.runner.id === id))
    .filter((result): result is HandicapResult => Boolean(result));

  return (
    <div className="wrap">
      <p className="kicker">
        <a href={`#/meetings/${course.countryId}`}>{course.shortName}</a>
        {" · "}
        {formatDate(meeting.date)}
      </p>
      <h1>
        Race {race.number} · {race.name}
      </h1>
      <dl className="facts">
        <div>
          <dt>Off time</dt>
          <dd>{race.time} local</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd>
            {race.distanceLabel}
            {course.countryId === "uk" ? ` · ${race.distanceM}m` : ""}
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>
            {race.type} · {race.classLabel}
          </dd>
        </div>
        <div>
          <dt>Prize</dt>
          <dd>{race.prize}</dd>
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
        <SourceTag kind="official" /> These meeting and race fields are the card. The model column is calculated.
      </p>
      <DemoNote />
      <div className="race-switch" role="navigation" aria-label="Races on this card">
        {card.map((item) => (
          <a key={item.id} href={`#/race/${item.id}`} aria-current={item.id === race.id ? "page" : undefined}>
            <span>R{item.number}</span>
            {item.name}
          </a>
        ))}
      </div>
      {analysis.scratched.length > 0 && (
        <p className="warn">
          {analysis.scratched.map((runner) => runner.name).join(", ")}{" "}
          {analysis.scratched.length === 1 ? "is a" : "are"} declared non-runner
          {analysis.scratched.length === 1 ? "" : "s"} and {analysis.scratched.length === 1 ? "is" : "are"} excluded
          from the model.
        </p>
      )}
      <div className="workspace">
        <div>
          <div className="section-head">
            <h2>Runners</h2>
            <div className="sorts">
              <button type="button" className={sort === "card" ? "is-on" : ""} onClick={() => setSort("card")}>
                Card order
              </button>
              <button type="button" className={sort === "model" ? "is-on" : ""} onClick={() => setSort("model")}>
                Model order
              </button>
            </div>
          </div>
          <p className="meta">Form reads latest to oldest, left to right. Compare up to three declared runners.</p>
          <div className="table-scroll">
            <table className="race-table">
              <caption>
                {race.name}, {field.length} declared
              </caption>
              <thead>
                <tr>
                  <th>Cmp</th>
                  <th>#</th>
                  <th>Horse</th>
                  <th>{drawLabel(course.countryId)}</th>
                  <th>{race.weightBasis === "handicap" ? "Hcp" : "Wgt"}</th>
                  <th>OR</th>
                  {showSpeed && <th>Spd</th>}
                  <th>Form</th>
                  <th className="col-days">Days</th>
                  <th className="col-conn">Jockey / trainer</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((runner) => {
                  const result = scoreOf.get(runner.id);
                  return (
                    <tr
                      key={runner.id}
                      className={`${runner.nonRunner ? "is-nr" : ""} ${selected?.id === runner.id ? "is-selected" : ""}`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={compare.includes(runner.id)}
                          disabled={runner.nonRunner}
                          aria-label={`Compare ${runner.name}`}
                          onChange={() => toggleCompare(runner.id)}
                        />
                      </td>
                      <td>{runner.number}</td>
                      <td>
                        <a className="horse-name" href={`#/race/${race.id}/${runner.id}`}>
                          {runner.name}
                        </a>
                        {runner.nonRunner && <span className="scr">SCR</span>}
                        {runner.equipment !== "None" && <small className="gear">{runner.equipment}</small>}
                      </td>
                      <td>{runner.draw}</td>
                      <td>
                        {formatWeight(runner.handicapKg, course.countryId)}
                        {runner.claimKg > 0 && (
                          <small>clm {formatWeight(runner.claimKg, course.countryId, true)}</small>
                        )}
                      </td>
                      <td>{runner.officialRating ?? "—"}</td>
                      {showSpeed && <td>{runner.publishedSpeed ?? "—"}</td>}
                      <td>
                        <FormFigures form={runner.form} />
                      </td>
                      <td className="col-days">{runner.daysSince ?? "—"}</td>
                      <td className="col-conn">
                        <span>
                          {runner.jockey}
                          {runner.claimKg > 0 ? ` (${formatWeight(runner.claimKg, course.countryId, true)})` : ""}
                        </span>
                        <small>{runner.trainer}</small>
                      </td>
                      <td>{runner.nonRunner ? "—" : result?.total.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected && (
            <RunnerDetail
              runner={selected}
              result={scoreOf.get(selected.id)}
              countryId={course.countryId}
              weightBasis={race.weightBasis}
            />
          )}
          {compared.length >= 2 && <CompareTable rows={compared} countryId={course.countryId} />}
        </div>
        <ModelPanel race={race} analysis={analysis} weights={weights} onWeight={setWeight} onReset={reset} />
      </div>
    </div>
  );
}

function RunnerDetail({
  runner,
  result,
  countryId,
  weightBasis,
}: {
  runner: Runner;
  result: HandicapResult | undefined;
  countryId: Race["countryId"];
  weightBasis: Race["weightBasis"];
}) {
  return (
    <section id="runner-detail" className="runner-detail" aria-label={`${runner.name} detail`}>
      <div>
        <div className="section-head">
          <h2>
            {runner.number}. {runner.name}
          </h2>
          <SourceTag kind="official" />
        </div>
        <p>
          {describeHorse(runner)}
          {runner.nonRunner ? " · Non-runner" : ""}
        </p>
        <dl className="detail-grid">
          <div>
            <dt>Trainer</dt>
            <dd>{runner.trainer}</dd>
          </div>
          <div>
            <dt>Jockey</dt>
            <dd>
              {runner.jockey}
              {runner.claimKg > 0 ? `, claim ${formatWeight(runner.claimKg, countryId, true)}` : ""}
            </dd>
          </div>
          <div>
            <dt>{weightBasis === "handicap" ? "Handicap weight" : "Assigned weight"}</dt>
            <dd>
              {formatWeight(runner.handicapKg, countryId)}
              {countryId === "uk" ? ` (${runner.handicapKg.toFixed(1)} kg)` : ""}
            </dd>
          </div>
          <div>
            <dt>Carried weight</dt>
            <dd>{formatWeight(carriedKg(runner), countryId)}</dd>
          </div>
          <div>
            <dt>Official rating</dt>
            <dd>
              {runner.officialRating ?? "Not rated"}
              {runner.lastOfficialRating != null ? `, last start ${runner.lastOfficialRating}` : ""}
            </dd>
          </div>
          <div>
            <dt>Published speed</dt>
            <dd>{runner.publishedSpeed ?? "Not published"}</dd>
          </div>
          <div>
            <dt>Days since run</dt>
            <dd>{runner.daysSince ?? "Debut"}</dd>
          </div>
          <div>
            <dt>Equipment</dt>
            <dd>{runner.equipment}</dd>
          </div>
          <div>
            <dt>Last class</dt>
            <dd>{runner.lastClassLabel ?? "None"}</dd>
          </div>
          <div>
            <dt>Last weight</dt>
            <dd>{runner.lastWeightKg == null ? "—" : formatWeight(runner.lastWeightKg, countryId)}</dd>
          </div>
          <div>
            <dt>Distance record</dt>
            <dd>{recordText(runner.distanceRecord)}</dd>
          </div>
          <div>
            <dt>Course record</dt>
            <dd>{recordText(runner.courseRecord)}</dd>
          </div>
          <div>
            <dt>Going record</dt>
            <dd>{recordText(runner.goingRecord)}</dd>
          </div>
        </dl>
        <p className="meta">Places in these records are second and third, not wins.</p>
      </div>
      <div>
        <div className="section-head">
          <h2>Model breakdown</h2>
          <SourceTag kind="calculated" />
        </div>
        {runner.nonRunner || !result ? (
          <p>Scratched runners are left out of the ranking.</p>
        ) : (
          <>
            <p className="model-total">
              {result.total.toFixed(1)} <small>{swingLabel(result)}</small>
            </p>
            <p className="meta">Running style {runner.paceStyle} is a model classification.</p>
            <ul className="factor-bars">
              {Object.entries(result.factors).map(([key, factor]) => (
                <li key={key}>
                  <span>
                    <strong>{labelFor(key)}</strong>
                    <em>{factor.score}</em>
                  </span>
                  <span className="bar">
                    <span style={{ width: `${factor.score}%` }} />
                  </span>
                  <small>{factor.note}</small>
                </li>
              ))}
            </ul>
          </>
        )}
        <a className="text-link" href={`#/race/${runner.raceId}`}>
          Close
        </a>
      </div>
    </section>
  );
}

function CompareTable({ rows, countryId }: { rows: HandicapResult[]; countryId: Race["countryId"] }) {
  return (
    <section className="compare">
      <h2>Comparison</h2>
      <div className="table-scroll">
        <table className="directory">
          <caption>Selected runners, official fields then calculated scores</caption>
          <thead>
            <tr>
              <th>Field</th>
              {rows.map((row) => (
                <th key={row.runner.id}>{row.runner.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Official rating</th>
              {rows.map((row) => (
                <td key={row.runner.id}>{row.runner.officialRating ?? "—"}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Weight</th>
              {rows.map((row) => (
                <td key={row.runner.id}>{formatWeight(row.runner.handicapKg, countryId)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Form</th>
              {rows.map((row) => (
                <td key={row.runner.id}>{row.runner.form || "Debut"}</td>
              ))}
            </tr>
            {Object.keys(rows[0].factors).map((key) => (
              <tr key={key}>
                <th scope="row">{labelFor(key)}</th>
                {rows.map((row) => (
                  <td key={row.runner.id}>{row.factors[key as keyof typeof row.factors].score}</td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Model total</th>
              {rows.map((row) => (
                <td key={row.runner.id}>{row.total.toFixed(1)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function recordText(record: RecordSplit): string {
  if (record.runs === 0) return "No runs in the sample";
  return `${record.wins} wins, ${record.places} places from ${record.runs}`;
}

function labelFor(key: string): string {
  const labels: Record<string, string> = {
    recentForm: "Recent form",
    speed: "Speed",
    pace: "Pace",
    classChange: "Class change",
    weight: "Weight",
    rating: "Rating movement",
    distance: "Distance",
    course: "Course and going",
  };
  return labels[key] ?? key;
}
