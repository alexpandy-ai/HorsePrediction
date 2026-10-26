import { FORMFAV_COUNTRIES, type FormfavCountryCode } from "../../src/stride/formfav/countries.ts";
import type { FormfavImportStatus, FormfavMeetingsFile, FormfavRacecardsFile } from "../../src/stride/formfav/types.ts";
import { formfavRoot, readStatus, writePublication } from "./publish.ts";

export type AdoptResult = "adopted" | "kept-local";

/** Copy the last published FormFav files when they are newer than the checkout. A later rate limit then republishes those cards instead of an older snapshot. */
export async function adoptPublishedSnapshot(base: string, root = formfavRoot(), fetchImpl: typeof fetch = fetch): Promise<AdoptResult> {
  const statusResponse = await fetchImpl(publishedFileUrl(base, "import-status.json"), { cache: "no-store" });
  if (!statusResponse.ok) throw new Error(`Published FormFav status returned HTTP ${statusResponse.status}.`);
  const remoteStatus = asStatus(await statusResponse.json());
  if (!remoteStatus.configured || typeof remoteStatus.generatedAt !== "string") return "kept-local";
  const local = readStatus(root);
  if (local.generatedAt && local.generatedAt >= remoteStatus.generatedAt) return "kept-local";

  const meetings = {} as Record<FormfavCountryCode, FormfavMeetingsFile>;
  for (const country of FORMFAV_COUNTRIES) {
    const response = await fetchImpl(publishedFileUrl(base, country.file), { cache: "no-store" });
    if (!response.ok) throw new Error(`Published ${country.file} returned HTTP ${response.status}.`);
    meetings[country.code] = asMeetings(await response.json(), country.code);
  }
  const cardsResponse = await fetchImpl(publishedFileUrl(base, "racecards.json"), { cache: "no-store" });
  if (!cardsResponse.ok) throw new Error("Published racecards.json returned HTTP " + cardsResponse.status + ".");
  const cards = asCards(await cardsResponse.json());
  writePublication(meetings, cards, remoteStatus, root);
  return "adopted";
}

function publishedFileUrl(base: string, file: string): string {
  const url = new URL(base);
  if (url.protocol !== "https:") throw new Error("The published FormFav snapshot must use https.");
  url.pathname = `/data/formfav/${file}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function asStatus(value: unknown): FormfavImportStatus {
  const record = asRecord(value);
  if (!record || record.source !== "FormFav" || typeof record.configured !== "boolean" || !record.countries || typeof record.countries !== "object") {
    throw new Error("Published FormFav status was not a FormFav snapshot.");
  }
  return record as unknown as FormfavImportStatus;
}

function asMeetings(value: unknown, country: FormfavCountryCode): FormfavMeetingsFile {
  const record = asRecord(value);
  if (!record || record.country !== country || record.source !== "FormFav" || !record.dates || typeof record.dates !== "object" || Array.isArray(record.dates)) {
    throw new Error(`Published meetings for ${country} were not a FormFav meetings file.`);
  }
  return record as unknown as FormfavMeetingsFile;
}

function asCards(value: unknown): FormfavRacecardsFile {
  const record = asRecord(value);
  if (!record || !record.cards || typeof record.cards !== "object" || Array.isArray(record.cards)) {
    throw new Error("Published racecards were not a FormFav racecard file.");
  }
  return record as unknown as FormfavRacecardsFile;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
