/** Previous runs are not published on the free plan. These sentences name the documented tools. */
export const PREVIOUS_RUNS_DETAIL = [
  "The free FormFav race card, GET /v1/form (tool get_race_card), includes a form string and career totals for the runners on that card. It does not include a stable runner id, and it does not include previous runs.",
  "The configured plan is free. The Pro tool search_runner, GET /v1/stats/runner/search, refuses a free key with HTTP 403. The profile tool is get_runner_profile, GET /v1/stats/runner/{runner_id}. Those responses are aggregate career, track and distance statistics. They are not a list of past races.",
  "No documented FormFav endpoint supplies previous runs with date, venue, race number, race name, distance, class, track condition, barrier, jockey, carried weight, finishing position, beaten margin, finished time, starting price, and race time. GET /v1/results (tool get_race_results) is Pro. It returns one race, with finishing position, margin, and starting price only when that source publishes them, and it does not include a finished time.",
];

export function australiaHorseHash(date: string, slug: string, raceNumber: number, horseNumber: number | null): string | null {
  if (horseNumber == null || !Number.isInteger(horseNumber) || horseNumber <= 0) return null;
  if (!Number.isInteger(raceNumber) || raceNumber <= 0 || !date || !slug) return null;
  return `#/ff/au/horse/${date}/${encodeURIComponent(slug)}/${raceNumber}/${horseNumber}`;
}

export function australiaRaceHash(date: string, slug: string, raceNumber: number): string {
  return `#/ff/au/race/${date}/${encodeURIComponent(slug)}/${raceNumber}`;
}
