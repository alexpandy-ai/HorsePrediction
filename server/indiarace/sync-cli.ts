import { syncIndiarace } from "./sync.ts";
import { calendarDate } from "../../src/meetings/time.ts";

const date = process.argv[2];
const dates = date ? [date] : [calendarDate("Asia/Kolkata", new Date()), shift(calendarDate("Asia/Kolkata", new Date()), 1)];
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
      error: index.fixturesError,
      failures: index.failures,
      lastSuccessfulSync: index.lastSuccessfulSync,
    },
    null,
    2,
  ),
);

function shift(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
