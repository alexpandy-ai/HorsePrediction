import { formfavCountry, type FormfavCountryCode } from "./countries";
import type { FormfavImportStatus, FormfavMeetingsFile, FormfavRacecardsFile } from "./types";
import { cardKey } from "./types";

const visit = `?v=${Date.now()}`;

function fresh(path: string): string {
  return `${path}${visit}`;
}

export async function loadFormfavStatus(): Promise<FormfavImportStatus | null> {
  return readJson<FormfavImportStatus>(fresh("/data/formfav/import-status.json"));
}

export async function loadFormfavMeetings(country: FormfavCountryCode): Promise<FormfavMeetingsFile | null> {
  return readJson<FormfavMeetingsFile>(fresh(`/data/formfav/${formfavCountry(country).file}`));
}

export async function loadFormfavRacecards(): Promise<FormfavRacecardsFile | null> {
  return readJson<FormfavRacecardsFile>(fresh("/data/formfav/racecards.json"));
}

export async function loadFormfavRace(country: FormfavCountryCode, date: string, slug: string, raceNumber: number) {
  const file = await loadFormfavRacecards();
  return file?.cards[cardKey(country, date, slug, raceNumber)] ?? null;
}

async function readJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
