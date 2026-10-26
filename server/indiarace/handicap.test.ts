import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { preferRacecard } from "../../src/stride/indiaDocument.ts";
import type { IndiaHandicapSheet, IndiaMeeting } from "../../src/stride/types.ts";
import { validateHandicap } from "./handicapParser.ts";
import { shouldReadHandicap } from "./sync.ts";

const html = `
<h3>Handicaps - HYDERABAD - 30 Oct 2026</h3>
<div class="race_day_div"><p>25</p></div>
<div class="handicap_div_ind">
  <div class="tit_cont">
    <h1>The Telangana Race Horse Owners Association Trophy</h1>
    <h4>A Handicap For Horses 3 Year Olds And Upward, Rated 80 And Above.</h4>
  </div>
  <div class="collapse_handicap"><h4>1600 M</h4></div>
  <table class="handi_table">
    <thead><tr><th>S No</th><th>Horse Name</th><th>Desc</th><th>Pedigree</th><th>Trainer</th><th>Wt</th><th>Rt</th></tr></thead>
    <tbody>
      <tr>
        <td>1</td>
        <td><a href="https://www.indiarace.com/Home/horseStatistics/62685/STAR OF NIGHT">STAR OF NIGHT</a></td>
        <td>5y b m</td>
        <td><a href="https://www.indiarace.com/Home/allSireDetails/1907">Excellent Art(GB)</a> - <a href="https://www.indiarace.com/Home/allDamDetails/18533">Romantic Star</a></td>
        <td><a href="https://www.indiarace.com/Home/trainerStatisticsdata/703/R H Sequeira">R H Sequeira</a></td>
        <td>60</td>
        <td>103</td>
      </tr>
      <tr>
        <td>2</td>
        <td><a href="https://www.indiarace.com/Home/horseStatistics/62958/GOLDEN THUNDER">GOLDEN THUNDER</a></td>
        <td></td>
        <td></td>
        <td>Karthik Ganapathy</td>
        <td></td>
        <td></td>
      </tr>
    </tbody>
  </table>
</div>`;

test("reads only the columns printed on an Indiarace handicap sheet", () => {
  const result = validateHandicap(html, "11", "2026-10-30", "https://www.indiarace.com/example", "2026-10-26T09:00:00.000Z");
  assert.equal(result.error, null);
  const sheet = result.sheet;
  assert.ok(sheet);
  assert.equal(sheet.kind, "handicap");
  assert.equal(sheet.course, "Hyderabad");
  assert.equal(sheet.state, "Telangana");
  assert.equal(sheet.date, "2026-10-30");
  assert.equal(sheet.raceDay, "25");
  assert.equal(sheet.raceCount, 1);
  const race = sheet.races[0];
  assert.deepEqual(race.columns, ["serial", "horse", "description", "pedigree", "trainer", "weight", "rating"]);
  assert.equal(race.columns.includes("jockey"), false);
  assert.equal(race.name, "The Telangana Race Horse Owners Association Trophy");
  assert.equal(race.distanceLabel, "1600 M");
  assert.equal(race.distanceM, 1600);
  const first = race.runners[0];
  assert.equal(first.serial, 1);
  assert.equal(first.horse, "STAR OF NIGHT");
  assert.equal(first.sourceHorseId, "62685");
  assert.equal(first.trainer, "R H Sequeira");
  assert.equal(first.weight, "60");
  assert.equal(first.weightKg, 60);
  assert.equal(first.rating, 103);
  assert.equal(first.jockey, null);
  assert.equal("draw" in first, false);
  const blank = race.runners[1];
  assert.equal(blank.description, null);
  assert.equal(blank.pedigree, null);
  assert.equal(blank.weight, null);
  assert.equal(blank.weightKg, null);
  assert.equal(blank.rating, null);
  assert.equal(JSON.stringify(sheet).includes("selection"), false);
});

test("rejects a handicap sheet whose printed date differs from the request", () => {
  const result = validateHandicap(html, "11", "2026-10-31", "https://www.indiarace.com/example", "2026-10-26T09:00:00.000Z");
  assert.equal(result.sheet, null);
  assert.match(result.error ?? "", /2026-10-30/);
});

test("does not invent a handicap sheet when the page has no handicap heading", () => {
  const result = validateHandicap("<h3>Race Card - HYDERABAD - 30 Oct 2026</h3>", "11", "2026-10-30", "https://www.indiarace.com/example", "2026-10-26T09:00:00.000Z");
  assert.equal(result.sheet, null);
  assert.match(result.error ?? "", /heading/);
});

test("a stored racecard blocks the handicap fallback", () => {
  assert.equal(shouldReadHandicap(true, "The racecard page did not include a meeting heading."), false);
  assert.equal(shouldReadHandicap(false, "The racecard page did not include a meeting heading."), true);
  assert.equal(shouldReadHandicap(false, "The racecard page did not include any races."), true);
  assert.equal(shouldReadHandicap(false, "Indiarace returned 2026-10-17 for a 2026-10-30 request."), false);
  assert.equal(shouldReadHandicap(false, null), false);
  const card = { id: "card" } as IndiaMeeting;
  const sheet = { kind: "handicap", id: "sheet" } as IndiaHandicapSheet;
  assert.equal(preferRacecard(card, sheet)?.kind, "racecard");
  assert.equal(preferRacecard(null, sheet)?.kind, "handicap");
  assert.equal(preferRacecard(null, null), null);
});

test("reads the saved Hyderabad handicaps page when it is available locally", () => {
  const file = path.join(os.tmpdir(), "stride-hyderabad-2026-10-30-handicaps.html");
  if (!fs.existsSync(file)) return;
  const result = validateHandicap(
    fs.readFileSync(file, "utf8"),
    "11",
    "2026-10-30",
    "https://www.indiarace.com/Home/racingCenterEvent?venueId=11&event_date=2026-10-30&race_type=HANDICAPS",
    "2026-10-26T09:00:00.000Z",
  );
  assert.equal(result.error, null);
  const sheet = result.sheet;
  assert.ok(sheet);
  assert.equal(sheet.course, "Hyderabad");
  assert.equal(sheet.pageDate, "2026-10-30");
  assert.equal(sheet.raceDay, "25");
  assert.equal(sheet.raceCount, 6);
  const race = sheet.races[0];
  assert.deepEqual(race.columns, ["serial", "horse", "description", "pedigree", "trainer", "weight", "rating"]);
  assert.equal(sheet.races.some((item) => item.columns.includes("jockey")), false);
  assert.equal(race.name, "The Telangana Race Horse Owners Association Trophy");
  assert.equal(race.distanceM, 1600);
  assert.equal(race.runners[0].horse, "STAR OF NIGHT");
  assert.equal(race.runners[0].description, "5y b m");
  assert.equal(race.runners[0].pedigree, "Excellent Art(GB) - Romantic Star");
  assert.equal(race.runners[0].trainer, "R H Sequeira");
  assert.equal(race.runners[0].weight, "60");
  assert.equal(race.runners[0].rating, 103);
  assert.equal(race.runners[0].sourceHorseId, "62685");
  assert.equal(race.runners[1].weight, "59.5");
  assert.equal(race.runners[1].rating, 102);
});
