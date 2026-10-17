import { countries, courses, getCountry, meetings, races, runners } from "../data";
import { analyse } from "../engine/handicap";
import { useWeights } from "../weights";
import { DailyMeetings } from "./DailyMeetings";
import { DemoNote, MeetingCard } from "./bits";

export function HomeView() {
  const { weights } = useWeights();
  const feature = races.find((race) => race.id === "mum-h1") ?? races[0];
  const featureAnalysis = analyse(
    feature,
    runners.filter((runner) => runner.raceId === feature.id),
    weights,
  );

  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <p className="kicker">Published meetings · sample handicapper</p>
            <h1>Today’s meetings, then the card you can handicap.</h1>
            <p className="lede">
              The board lists meetings returned by the configured feed, grouped by country and region. Sample cards stay
              available for the full handicapping model and are not live entries.
            </p>
            <div className="hero-actions">
              <a className="button" href="#meetings">
                Today’s meetings
              </a>
              <a className="button secondary" href="#/meetings">
                Sample cards
              </a>
            </div>
          </div>
          <aside className="stub">
            <p className="kicker">Model, current weights</p>
            <h2>{feature.name}</h2>
            <ol className="rank-list">
              {featureAnalysis.ranked.slice(0, 4).map((result) => (
                <li key={result.runner.id}>
                  <span className="rank">{result.modelRank}</span>
                  <span>
                    <a href={`#/race/${feature.id}/${result.runner.id}`}>{result.runner.name}</a>
                    <small>Official rating {result.runner.officialRating ?? "—"}</small>
                  </span>
                  <strong>{result.total.toFixed(1)}</strong>
                </li>
              ))}
            </ol>
            <a className="text-link" href={`#/race/${feature.id}`}>
              Open the race card
            </a>
          </aside>
        </div>
      </section>
      <div className="wrap">
        <DailyMeetings />
        <DemoNote />
        <section className="split-intro">
          <h2>Where the model splits from the rating</h2>
          <div className="split-grid">
            {races
              .filter((race) => race.feature)
              .map((race) => {
                const analysis = analyse(
                  race,
                  runners.filter((runner) => runner.raceId === race.id),
                  weights,
                );
                const topModel = analysis.ranked[0];
                const topOfficial = analysis.ranked.find((result) => result.officialRank === 1);
                return (
                  <a key={race.id} className="split-card" href={`#/race/${race.id}`} data-country={race.countryId}>
                    <p className="kicker">{getCountry(race.countryId).name}</p>
                    <h3>{race.name}</h3>
                    {topModel && topOfficial && topModel.runner.id === topOfficial.runner.id ? (
                      <p>
                        The model agrees with the top of the official ratings: <strong>{topModel.runner.name}</strong>.
                      </p>
                    ) : (
                      <p>
                        <strong>{topModel?.runner.name}</strong> leads the model.
                        {topOfficial ? ` ${topOfficial.runner.name} has the highest official rating.` : ""}
                      </p>
                    )}
                  </a>
                );
              })}
          </div>
        </section>
        <section>
          <h2>Countries and racecourses</h2>
          <div className="country-grid">
            {countries.map((country) => (
              <section key={country.id} className="country-block" data-country={country.id}>
                <header>
                  <h3>{country.name}</h3>
                  <a href={`#/courses/${country.id}`}>All courses</a>
                </header>
                <ul className="course-pills">
                  {courses
                    .filter((course) => course.countryId === country.id)
                    .map((course) => (
                      <li key={course.id}>
                        <a href={`#/course/${course.id}`}>{course.shortName}</a>
                      </li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </section>
        <section>
          <div className="section-head">
            <h2>Sample meetings</h2>
            <a href="#/meetings">All cards</a>
          </div>
          <div className="meeting-grid">
            {meetings.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
