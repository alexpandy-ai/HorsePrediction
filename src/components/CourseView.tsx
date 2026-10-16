import { getCountry, getCourse, historyForCourse, meetingForCourse } from "../data";
import { formatDate } from "../format";
import { MeetingCard, NotFound, SourceTag } from "./bits";

export function CourseView({ courseId }: { courseId: string }) {
  const course = getCourse(courseId);
  if (!course) return <NotFound />;
  const country = getCountry(course.countryId);
  const results = historyForCourse(course.id);
  const meeting = meetingForCourse(course.id);

  return (
    <div className="wrap">
      <p className="kicker">
        <a href={`#/courses/${course.countryId}`}>{country.name}</a>
      </p>
      <h1>{course.shortName}</h1>
      <p className="lede">{course.name}</p>
      <dl className="facts">
        <div>
          <dt>City</dt>
          <dd>{course.city}</dd>
        </div>
        <div>
          <dt>Surface</dt>
          <dd>{course.surface}</dd>
        </div>
        <div>
          <dt>Circuit</dt>
          <dd>{course.circuit}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd>{course.discipline}</dd>
        </div>
      </dl>
      <p>{course.about}</p>
      {course.note && (
        <aside className="callout">
          <p className="kicker">Course note</p>
          <p>{course.note}</p>
        </aside>
      )}
      {meeting && (
        <section>
          <h2>Sample meeting</h2>
          <MeetingCard meeting={meeting} />
        </section>
      )}
      <section>
        <div className="section-head">
          <h2>Past meetings</h2>
          <SourceTag kind="official" />
        </div>
        <p className="meta">A sample archive for this course, not a complete record.</p>
        <div className="table-scroll">
          <table className="directory">
            <caption>Sample results at {course.shortName}</caption>
            <thead>
              <tr>
                <th>Date</th>
                <th>Race</th>
                <th>Distance</th>
                <th>Going</th>
                <th>Winner</th>
                <th>Field</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr key={`${result.date}-${result.raceName}`}>
                  <td>{formatDate(result.date)}</td>
                  <td>{result.raceName}</td>
                  <td>{result.distanceLabel}</td>
                  <td>{result.going}</td>
                  <td>{result.winner}</td>
                  <td>{result.field}</td>
                  <td>{result.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
