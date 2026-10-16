import { countries, courses, getCountry } from "../data";
import type { CountryId } from "../types";

export function CoursesView({ country }: { country?: CountryId }) {
  const list = courses.filter((course) => (country ? course.countryId === country : true));

  return (
    <div className="wrap">
      <p className="kicker">Racecourses</p>
      <h1>{country ? getCountry(country).name : "Four racing nations"}</h1>
      <p className="lede">
        The directory covers the principal courses in India, Australia, South Africa, and the United Kingdom, plus a
        few recognised tracks around them.
      </p>
      <div className="chips" role="navigation" aria-label="Filter by country">
        <a href="#/courses" aria-current={country ? undefined : "page"}>
          All
        </a>
        {countries.map((item) => (
          <a key={item.id} href={`#/courses/${item.id}`} aria-current={country === item.id ? "page" : undefined}>
            {item.name}
          </a>
        ))}
      </div>
      <div className="table-scroll">
        <table className="directory">
          <caption>{list.length} racecourses</caption>
          <thead>
            <tr>
              <th>Course</th>
              <th>City</th>
              <th>Surface</th>
              <th>Circuit</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {list.map((course) => (
              <tr key={course.id} data-country={course.countryId}>
                <td>
                  <a href={`#/course/${course.id}`}>{course.shortName}</a>
                  <small>{course.name}</small>
                </td>
                <td>{course.city}</td>
                <td>{course.surface}</td>
                <td>{course.circuit}</td>
                <td>{course.discipline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
