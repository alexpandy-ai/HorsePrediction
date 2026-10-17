import fs from "node:fs";
import path from "node:path";
import { importRacecardFile } from "./sync.ts";

const directory = path.join(process.cwd(), "server", "data", "indiarace-import");
if (!fs.existsSync(directory)) {
  console.log(`Place saved Indiarace racecard HTML in ${directory} as {venueId}_{YYYY-MM-DD}.html`);
  process.exit(0);
}
const files = fs.readdirSync(directory).filter((name) => name.endsWith(".html"));
if (files.length === 0) {
  console.log("No HTML files found. Name each file {venueId}_{YYYY-MM-DD}.html");
  process.exit(0);
}
for (const name of files) {
  const match = name.match(/^(\d+)_(\d{4}-\d{2}-\d{2})\.html$/);
  if (!match) {
    console.log(`Skipped ${name}. Expected {venueId}_{YYYY-MM-DD}.html`);
    continue;
  }
  const index = importRacecardFile(path.join(directory, name), match[1], match[2]);
  const failure = index.failures[`${match[2]}:${match[1]}`];
  console.log(failure ? `${name}: ${failure.error}` : `${name}: stored`);
}
