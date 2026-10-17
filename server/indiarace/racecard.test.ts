import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { rankRace } from "../../src/stride/handicappingEngine.ts";
import { groupByState, stateForCourse } from "../../src/stride/stateMeetingMapper.ts";
import { validateRacecard } from "./racecardValidator.ts";

const html = `
<h3>Race Card - HYDERABAD - 17 Oct 2026</h3>
<div id="race-1">
  <h1>1</h1><h5>(145)</h5>
  <div class="center_heading"><h2>The Plate</h2><h3>Class 4 / A Handicap For Horses Rated 20 To 45</h3></div>
  <div class="archive_time"><h4>1200 M</h4><h4>01:35 PM</h4></div>
  <a href="/Home/previousRunsWithTrack/168596/racecard">runs</a>
  <table>
    <tr class="dividend_tr">
      <td>1<br><span style="color:red;">(9)</span></td><td></td>
      <td><a href="/Home/horseStatistics/1/EQUINE POWER">EQUINE POWER</a><a href="/Home/allSireDetails/1">Sire</a>-<a href="/Home/allDamDetails/1">Dam</a><span class="last-five-runs-lable">5 - 2 - 1.</span></td>
      <td>4y b g</td><td>Owner</td>
      <td><a href="/Home/trainerStatisticsdata/1/Trainer A">Trainer A</a></td>
      <td><a href="/Home/jokeyStatisticsdata/1/Jockey A">Jockey A</a></td>
      <td>60</td><td></td><td>A</td><td>TS</td><td><sup><small>32</small></sup>45</td>
    </tr>
    <tr class="dividend_tr" style="background-color:#ffb6c1">
      <td>4<br><span style="color:red;">(3)</span></td><td></td>
      <td><a href="/Home/horseStatistics/2/DECEMBER CASPIAN">DECEMBER CASPIAN</a></td>
      <td>4y gr f</td><td>Owner</td>
      <td><a href="/Home/trainerStatisticsdata/2/Trainer B">Trainer B</a></td>
      <td><a href="/Home/jokeyStatisticsdata/339/WITHDRAWN">Withdrawn</a></td>
      <td>56</td><td></td><td>A</td><td>HOOD</td><td><sup><small>24</small></sup>33</td>
    </tr>
    <tr class="dividend_tr">
      <td>5<br><span style="color:red;">(9)</span></td><td></td>
      <td><a href="/Home/horseStatistics/3/SECOND DRAW">SECOND DRAW</a><span class="last-five-runs-lable">1.</span></td>
      <td>3y b c</td><td>Owner</td>
      <td><a href="/Home/trainerStatisticsdata/3/Trainer C">Trainer C</a></td>
      <td><a href="/Home/jokeyStatisticsdata/3/Jockey C">Jockey C</a></td>
      <td>54</td><td>-2</td><td></td><td></td><td>20</td>
    </tr>
    <tr class="dividend_tr">
      <td>6</td><td></td>
      <td><a href="/Home/horseStatistics/4/NO DRAW">NO DRAW</a></td>
      <td>3y b f</td><td>Owner</td>
      <td><a href="/Home/trainerStatisticsdata/4/Trainer D">Trainer D</a></td>
      <td><a href="/Home/jokeyStatisticsdata/4/Jockey D">Jockey D</a></td>
      <td></td><td></td><td></td><td></td><td></td>
    </tr>
  </table>
  <p class="race_btm_cont">INDIARACE SELECTIONS : <span>1. EQUINE POWER (1)</span></p>
</div>`;

test("maps only the verified Indian courses", () => {
  assert.equal(stateForCourse("Bangalore"), "Karnataka");
  assert.equal(stateForCourse("Mysore"), "Karnataka");
  assert.equal(stateForCourse("Mumbai"), "Maharashtra");
  assert.equal(stateForCourse("Pune"), "Maharashtra");
  assert.equal(stateForCourse("Hyderabad"), "Telangana");
  assert.equal(stateForCourse("Kolkata"), "West Bengal");
  assert.equal(stateForCourse("Delhi"), "Delhi");
  assert.equal(stateForCourse("Ooty"), null);
});

test("keeps horse number, draw and withdrawal distinct", () => {
  const result = validateRacecard(html, "11", "2026-10-17", "https://www.indiarace.com/example", "2026-10-17T12:00:00.000Z");
  assert.equal(result.error, null);
  const meeting = result.meeting;
  assert.ok(meeting);
  assert.equal(meeting.course, "Hyderabad");
  assert.equal(meeting.state, "Telangana");
  assert.equal(meeting.date, "2026-10-17");
  const race = meeting.races[0];
  const equine = race.runners.find((runner) => runner.horse === "EQUINE POWER");
  const withdrawn = race.runners.find((runner) => runner.horse === "DECEMBER CASPIAN");
  const missing = race.runners.find((runner) => runner.horse === "NO DRAW");
  assert.equal(equine?.horseNumber, 1);
  assert.equal(equine?.draw, 9);
  assert.equal(equine?.rating, 45);
  assert.equal(equine?.ratingAside, 32);
  assert.equal(withdrawn?.status, "Withdrawn");
  assert.equal(withdrawn?.horseNumber, 4);
  assert.equal(withdrawn?.draw, 3);
  assert.equal(missing?.draw, null);
  assert.match(race.drawFlags.join(" "), /draw 9 is printed/);
  assert.match(race.drawFlags.join(" "), /Draw was not printed/);
  assert.equal(race.sourceSelections[0], "1. EQUINE POWER (1)");
  const before = JSON.stringify(race.runners);
  const ranked = rankRace(race, { recentForm: 70, weight: 30 });
  assert.equal(JSON.stringify(race.runners), before);
  assert.equal(ranked.top3.some((row) => row.horse === "DECEMBER CASPIAN"), false);
  const undrawn = ranked.rows.find((row) => row.horse === "NO DRAW");
  assert.equal(undrawn?.score, null);
  assert.equal(undrawn?.factors.find((factor) => factor.key === "recentForm")?.status, "unavailable");
});

test("rejects a card whose printed date differs from the request", () => {
  const result = validateRacecard(html, "11", "2026-10-18", "https://www.indiarace.com/example", "2026-10-17T12:00:00.000Z");
  assert.equal(result.meeting, null);
  assert.match(result.error ?? "", /2026-10-17/);
});

test("groups only states that have a meeting", () => {
  const groups = groupByState([
    { course: "Pune", state: "Maharashtra", firstRaceMinutes: 800 },
    { course: "Mysore", state: "Karnataka", firstRaceMinutes: 700 },
  ]);
  assert.deepEqual(groups.map((group) => group.state), ["Karnataka", "Maharashtra"]);
});

test("reads the saved Hyderabad racecard when it is available locally", () => {
  const file = path.join(os.tmpdir(), "indiarace-research", "hyd-2026-10-17.html");
  if (!fs.existsSync(file)) return;
  const result = validateRacecard(fs.readFileSync(file, "utf8"), "11", "2026-10-17", "https://www.indiarace.com/Home/racingCenterEvent?event_date=2026-10-17&race_type=RACECARD&venueId=11", "2026-10-17T18:00:00.000Z");
  assert.equal(result.error, null);
  const meeting = result.meeting;
  assert.ok(meeting);
  assert.equal(meeting.raceCount, 7);
  assert.equal(meeting.state, "Telangana");
  const equine = meeting.races.flatMap((race) => race.runners).find((runner) => runner.horse === "EQUINE POWER");
  const withdrawn = meeting.races.flatMap((race) => race.runners).find((runner) => runner.horse === "DECEMBER CASPIAN");
  assert.equal(equine?.horseNumber, 1);
  assert.equal(equine?.draw, 9);
  assert.notEqual(equine?.draw, equine?.horseNumber);
  assert.equal(withdrawn?.status, "Withdrawn");
  assert.equal(withdrawn?.draw, 3);
  assert.equal(withdrawn?.horseNumber, 4);
});
