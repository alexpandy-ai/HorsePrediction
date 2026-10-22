import { useEffect, useState } from "react";
import { dash, horseStatisticsUrl, isUnavailableHorse, type HorseCareer, type HorseCareerLabels, type HorseProfile, type HorseRecord } from "./horseStatistics";
import { loadHorseStatistics } from "./load";
import "./horseStatistics.css";

export function HorsePage({ id, horseName }: { id: string; horseName: string }) {
  const [record, setRecord] = useState<HorseRecord | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let ignore = false;
    setReady(false);
    void loadHorseStatistics().then((file) => {
      if (ignore) return;
      setFailed(file == null);
      setRecord(file?.horses[id] ?? null);
      setReady(true);
    });
    return () => {
      ignore = true;
    };
  }, [id]);

  const profile = record && !isUnavailableHorse(record) ? record : null;
  const title = profile?.name || record?.name || horseName;
  const sourceHref = record?.sourceUrl || horseStatisticsUrl(id, title);

  useEffect(() => {
    document.title = `${title} — STRIDE`;
  }, [title]);

  if (!ready) return <div className="wrap"><p className="callout">Loading horse statistics…</p></div>;

  return (
    <div className="wrap stride-page">
      <p className="kicker">Indiarace horse statistics</p>
      <h1>{title}</h1>
      {failed ? <Unavailable message="The published horse statistics could not be loaded." /> : null}
      {!failed && (!record || isUnavailableHorse(record)) ? (
        <Unavailable message="Statistics for this horse are not in the published snapshot." />
      ) : null}
      {profile ? <Profile horse={profile} /> : null}
      <p className="meta">
        <a href={sourceHref}>Indiarace source page</a>
        {" · "}These figures are the published Indiarace statistics, not a STRIDE prediction.
      </p>
      <p><a href="#/">Back to meetings</a></p>
    </div>
  );
}

function Profile({ horse }: { horse: HorseProfile }) {
  const career = careerColumns(horse.career, horse.careerLabels);
  return (
    <>
      <p className="meta">{dash(horse.ageColourSex)}</p>
      <dl className="stride-facts">
        <div><dt>Sire</dt><dd>{dash(horse.sire)}</dd></div>
        <div><dt>Dam</dt><dd>{dash(horse.dam)}</dd></div>
        <div><dt>Rating</dt><dd>{dash(horse.rating)}</dd></div>
        <div><dt>Trainer</dt><dd>{dash(horse.trainer)}</dd></div>
        <div><dt>Bred at</dt><dd>{dash(horse.bredAt)}</dd></div>
        <div><dt>Owner</dt><dd>{dash(horse.owner)}</dd></div>
      </dl>
      {horse.previousOwner ? <p>Previous owner {horse.previousOwner}</p> : null}
      <h2>Career</h2>
      {career.length === 0 ? <p>—</p> : (
        <div className="horse-table-wrap">
          <table className="horse-table">
            <thead>
              <tr>{career.map((column) => <th key={column.label}>{column.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{career.map((column) => <td key={column.label}>{dash(column.value)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      <h2>Starts</h2>
      {horse.starts.length === 0 ? <p>—</p> : (
        <div className="horse-table-wrap">
          <table className="horse-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Venue</th>
                <th>Dist</th>
                <th>Class</th>
                <th>Race No</th>
                <th>Finish</th>
                <th>Jockey</th>
                <th>Wt</th>
                <th>Dist-Win</th>
                <th>Time</th>
                <th>Rtg</th>
              </tr>
            </thead>
            <tbody>
              {horse.starts.map((start, index) => (
                <tr key={`${start.date ?? "date"}-${start.raceNumber ?? index}`}>
                  <td>{dash(start.date)}</td>
                  <td>{dash(start.venue)}</td>
                  <td>{dash(start.distance)}</td>
                  <td>{dash(start.raceClass)}</td>
                  <td>{dash(start.raceNumber)}</td>
                  <td>{dash(start.finish)}</td>
                  <td>{dash(start.jockey)}</td>
                  <td>{dash(start.weight)}</td>
                  <td>{dash(start.winningMargin)}</td>
                  <td>{dash(start.time)}</td>
                  <td>{dash(start.rating)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function careerColumns(career: HorseCareer | null, labels: HorseCareerLabels | null): { label: string; value: string | null }[] {
  if (!career || !labels) return [];
  const columns: Array<[keyof HorseCareer, string | null]> = [
    ["runs", labels.runs],
    ["wins", labels.wins],
    ["second", labels.second],
    ["third", labels.third],
    ["fourth", labels.fourth],
    ["earnings", labels.earnings],
  ];
  return columns.flatMap(([key, label]) => (label ? [{ label, value: career[key] }] : []));
}

function Unavailable({ message }: { message: string }) {
  return <p className="warn">{message}</p>;
}
