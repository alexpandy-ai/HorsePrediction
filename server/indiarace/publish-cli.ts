import { publishSnapshot } from "./publish.ts";

const published = publishSnapshot();
console.log(
  JSON.stringify(
    {
      meetings: "public/data/meetings.json",
      racecards: "public/data/racecards.json",
      lastUpdated: published,
    },
    null,
    2,
  ),
);
