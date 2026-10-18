import fs from "node:fs";
import path from "node:path";
import type { FormfavCountryCode } from "../../src/stride/formfav/countries.ts";
import { FORMFAV_COUNTRIES } from "../../src/stride/formfav/countries.ts";
import type { FormfavImportStatus, FormfavMeetingsFile, FormfavRacecardsFile } from "../../src/stride/formfav/types.ts";

export function formfavRoot(cwd = process.cwd()): string {
  return path.join(cwd, "public", "data", "formfav");
}

export function readMeetings(country: FormfavCountryCode, root = formfavRoot()): FormfavMeetingsFile {
  const countryConfig = FORMFAV_COUNTRIES.find((item) => item.code === country);
  const file = path.join(root, countryConfig?.file ?? `meetings-${country}.json`);
  return readJson(file, emptyMeetings(country));
}

export function readCards(root = formfavRoot()): FormfavRacecardsFile {
  return readJson(path.join(root, "racecards.json"), { cards: {} });
}

export function readStatus(root = formfavRoot()): FormfavImportStatus {
  return readJson(path.join(root, "import-status.json"), unconfiguredStatus());
}

export function writePublication(
  meetings: Record<FormfavCountryCode, FormfavMeetingsFile>,
  cards: FormfavRacecardsFile,
  status: FormfavImportStatus,
  root = formfavRoot(),
): void {
  fs.mkdirSync(root, { recursive: true });
  for (const country of FORMFAV_COUNTRIES) writeJson(path.join(root, country.file), meetings[country.code]);
  writeJson(path.join(root, "racecards.json"), cards);
  writeJson(path.join(root, "import-status.json"), status);
}

export function emptyMeetings(country: FormfavCountryCode): FormfavMeetingsFile {
  return { country, source: "FormFav", region: "Region unavailable", dates: {} };
}

export function unconfiguredStatus(generatedAt: string | null = null): FormfavImportStatus {
  const note = "FORMFAV_API_KEY is not configured, so no FormFav request was made.";
  return {
    source: "FormFav",
    sourceUrl: "https://api.formfav.com",
    configured: false,
    plan: "unknown",
    generatedAt,
    lastSuccessAt: null,
    lastError: null,
    requestsUsed: 0,
    countries: {
      au: { coverage: "unknown", venueCount: null, note: `${note} Australia uses country code au.` },
      gb: { coverage: "unknown", venueCount: null, note: `${note} The United Kingdom uses country code gb and Europe/London.` },
      za: {
        coverage: "unknown",
        venueCount: null,
        note: `${note} South Africa uses the documented country code za. Meetings are unconfirmed until an import succeeds.`,
      },
      nz: { coverage: "unknown", venueCount: null, note: `${note} New Zealand uses country code nz and Pacific/Auckland.` },
    },
    planNote: "Free endpoints are meetings, venues and race form, with a documented limit of 1,000 requests a day. Predictions, results, runner, jockey and trainer statistics, and track bias require Pro. Live prices require Premium. Those paid endpoints are not called unless FORMFAV_PLAN is pro or premium.",
  };
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown): void {
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value));
  try {
    fs.renameSync(temporary, file);
  } catch {
    fs.writeFileSync(file, JSON.stringify(value));
    fs.rmSync(temporary, { force: true });
  }
}
