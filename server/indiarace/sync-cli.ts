import { indiaraceSyncDates, syncIndiarace } from "./sync.ts";
import { calendarDate } from "../../src/meetings/time.ts";

const date = process.argv[2];
const dates = date ? [date] : indiaraceSyncDates(calendarDate("Asia/Kolkata", new Date()));
const index = await syncIndiarace({ dates, force: true });
if (index.fixturesError) {
  console.error(index.fixturesError);
  process.exitCode = 1;
}
const stored = Object.values(index.cards).filter((card) => dates.includes(card.date));
console.log(
  JSON.stringify(
    {
      fixtures: index.fixtures.filter((fixture) => dates.includes(fixture.date)),
      cards: stored.map((card) => ({ date: card.date, course: card.course, races: card.raceCount, status: card.sourceStatus })),
      handicaps: Object.values(index.handicaps ?? {})
        .filter((sheet) => dates.includes(sheet.date))
        .map((sheet) => ({ date: sheet.date, course: sheet.course, races: sheet.raceCount })),
      error: index.fixturesError,
      failures: index.failures,
      lastSuccessfulSync: index.lastSuccessfulSync,
    },
    null,
    2,
  ),
);
