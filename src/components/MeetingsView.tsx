import { countries, getCourse, meetings } from "../data";
import type { CountryId } from "../types";
import { DemoNote, HorseSearch, MeetingCard } from "./bits";

export function MeetingsView({ country }: { country?: CountryId }) {
  const visible = meetings.filter((meeting) => {
    if (!country) return true;
    return getCourse(meeting.courseId)?.countryId === country;
  });

  return (
    <div className="wrap">
      <p className="kicker">Race cards</p>
      <h1>Saturday 17 October 2026</h1>
      <p className="lede">
        One sample meeting from each country. Each card shows the race, the runners, and the going. Open a race for
        the full field and the model.
      </p>
      <DemoNote />
      <HorseSearch />
      <div className="chips" role="navigation" aria-label="Filter by country">
        <a href="#/meetings" aria-current={country ? undefined : "page"}>
          All
        </a>
        {countries.map((item) => (
          <a key={item.id} href={`#/meetings/${item.id}`} aria-current={country === item.id ? "page" : undefined}>
            {item.name}
          </a>
        ))}
      </div>
      <div className="meeting-grid">
        {visible.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>
    </div>
  );
}
