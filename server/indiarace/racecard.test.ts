import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { indiaHorseHash } from "../../src/stride/horseStatistics.ts";
import { rankRace } from "../../src/stride/handicappingEngine.ts";
import { parseRoute } from "../../src/router.ts";
import { groupByState, stateForCourse } from "../../src/stride/stateMeetingMapper.ts";
import { extractHorseProfileLink } from "./racecardParser.ts";
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
  assert.equal(equine?.sourceHorseId, "1");
  assert.equal(equine?.sourceHorseName, "EQUINE POWER");
  assert.equal(equine?.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/1/EQUINE POWER");
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

const copiedAnchors = [
  {
    html: '<h5> <a href="https://www.indiarace.com/Home/horseStatistics/63810/EQUINE POWER">EQUINE POWER </a> </h5>',
    horseId: "63810",
    horseName: "EQUINE POWER",
    horseProfileUrl: "https://www.indiarace.com/Home/horseStatistics/63810/EQUINE POWER",
    horseNumber: "1",
    draw: "9",
  },
  {
    html: '<h5> <a href="https://www.indiarace.com/Home/horseStatistics/129/MY HONEY">MY HONEY </a> </h5>',
    horseId: "129",
    horseName: "MY HONEY",
    horseProfileUrl: "https://www.indiarace.com/Home/horseStatistics/129/MY HONEY",
    horseNumber: "4",
    draw: "1",
  },
  {
    html: '<h5> <a href="https://www.indiarace.com/Home/horseStatistics/63668/LION\'S GATE">LION\'S GATE </a> </h5>',
    horseId: "63668",
    horseName: "LION'S GATE",
    horseProfileUrl: "https://www.indiarace.com/Home/horseStatistics/63668/LION'S GATE",
    horseNumber: "9",
    draw: "3",
  },
  {
    html: '<h5> <a href="https://www.indiarace.com/Home/horseStatistics/60249/COSMICO">COSMICO </a> </h5>',
    horseId: "60249",
    horseName: "COSMICO",
    horseProfileUrl: "https://www.indiarace.com/Home/horseStatistics/60249/COSMICO",
    horseNumber: "2",
    draw: "5",
  },
];

test("extracts Indiarace horse ids from the horse-name link", () => {
  for (const anchor of copiedAnchors) {
    const link = extractHorseProfileLink(`${anchor.horseNumber}<span>(${anchor.draw})</span>${anchor.html}`);
    assert.ok(link);
    assert.equal(link.horseId, anchor.horseId);
    assert.equal(link.horseName, anchor.horseName);
    assert.equal(link.horseProfileUrl, anchor.horseProfileUrl);
    assert.notEqual(link.horseId, anchor.horseNumber);
    assert.notEqual(link.horseId, anchor.draw);
    assert.notEqual(link.horseId, anchor.horseName);
  }
  const encoded = extractHorseProfileLink('<a href="https://www.indiarace.com/Home/horseStatistics/168/GOLDEN%20SABRE">GOLDEN SABRE</a>');
  assert.ok(encoded);
  assert.equal(encoded.horseId, "168");
  assert.equal(encoded.horseName, "GOLDEN SABRE");
  assert.equal(encoded.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/168/GOLDEN%20SABRE");
  assert.equal(extractHorseProfileLink("<h5>UNLINKED HORSE</h5>"), null);
  assert.equal(extractHorseProfileLink('<td>1<br><span style="color:red;">(9)</span></td>'), null);
});

test("stores the profile link on each runner and leaves a missing link as plain text", () => {
  const rows = copiedAnchors.map((anchor) => `
    <tr class="dividend_tr">
      <td>${anchor.horseNumber}<br><span style="color:red;">(${anchor.draw})</span></td><td></td>
      <td>${anchor.html}</td>
      <td>4y b g</td><td>Owner</td><td>Trainer</td><td>Jockey</td><td>60</td><td></td><td>A</td><td></td><td>45</td>
    </tr>`).join("");
  const card = `
    <h3>Race Card - HYDERABAD - 17 Oct 2026</h3>
    <div id="race-1">
      <h1>1</h1><h5>(145)</h5>
      <div class="center_heading"><h2>The Plate</h2><h3>Class 4 / A Handicap For Horses Rated 20 To 45</h3></div>
      <div class="archive_time"><h4>1200 M</h4><h4>01:35 PM</h4></div>
      <table>
        ${rows}
        <tr class="dividend_tr">
          <td>7<br><span style="color:red;">(2)</span></td><td></td>
          <td><h5>UNLINKED HORSE</h5></td>
          <td>4y b g</td><td>Owner</td><td>Trainer</td><td>Jockey</td><td>55</td><td></td><td></td><td></td><td></td>
        </tr>
      </table>
    </div>`;
  const result = validateRacecard(card, "11", "2026-10-17", "https://www.indiarace.com/example", "2026-10-17T18:00:00.000Z");
  assert.equal(result.error, null);
  const runners = result.meeting?.races[0]?.runners ?? [];
  for (const anchor of copiedAnchors) {
    const runner = runners.find((item) => item.horse === anchor.horseName);
    assert.ok(runner);
    assert.equal(runner.sourceHorseId, anchor.horseId);
    assert.equal(runner.sourceHorseName, anchor.horseName);
    assert.equal(runner.horseProfileUrl, anchor.horseProfileUrl);
    assert.equal(runner.horseNumber, Number(anchor.horseNumber));
    assert.equal(runner.draw, Number(anchor.draw));
    assert.notEqual(runner.sourceHorseId, String(runner.horseNumber));
    assert.notEqual(runner.sourceHorseId, String(runner.draw));
    const href = indiaHorseHash(runner.sourceHorseId, runner.sourceHorseName);
    assert.equal(href, `#/horse/${anchor.horseId}/${encodeURIComponent(anchor.horseName)}`);
    const route = href ? parseRoute(href) : null;
    assert.equal(route?.name, "horse");
    if (route?.name === "horse") {
      assert.equal(route.id, anchor.horseId);
      assert.equal(route.horseName, anchor.horseName);
    }
  }
  const unlinked = runners.find((item) => item.horse === "UNLINKED HORSE");
  assert.ok(unlinked);
  assert.equal(unlinked.sourceHorseId, null);
  assert.equal(unlinked.sourceHorseName, null);
  assert.equal(unlinked.horseProfileUrl, null);
  assert.equal(unlinked.horseNumber, 7);
  assert.equal(indiaHorseHash(unlinked.sourceHorseId, unlinked.horse), null);
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
  assert.equal(equine?.sourceHorseId, "63810");
  assert.equal(equine?.sourceHorseName, "EQUINE POWER");
  assert.equal(equine?.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/63810/EQUINE POWER");
  assert.equal(equine?.draw, 9);
  assertSavedProfileLinks(fs.readFileSync(file, "utf8"), meeting.races.flatMap((race) => race.runners));
  assert.notEqual(equine?.draw, equine?.horseNumber);
  assert.equal(withdrawn?.status, "Withdrawn");
  assert.equal(withdrawn?.draw, 3);
  assert.equal(withdrawn?.horseNumber, 4);
  assert.equal(withdrawn?.sourceHorseId, "63889");
  assert.equal(withdrawn?.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/63889/DECEMBER CASPIAN");
  const honey = meeting.races.flatMap((race) => race.runners).find((runner) => runner.horse === "MY HONEY");
  const lions = meeting.races.flatMap((race) => race.runners).find((runner) => runner.horse === "LION'S GATE");
  assert.ok(honey);
  assert.ok(lions);
  assert.equal(honey.sourceHorseId, "129");
  assert.equal(honey.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/129/MY HONEY");
  assert.notEqual(honey.sourceHorseId, String(honey.horseNumber));
  assert.notEqual(honey.sourceHorseId, String(honey.draw));
  assert.equal(lions.sourceHorseId, "63668");
  assert.equal(lions.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/63668/LION'S GATE");
});

test("reads the saved Pune racecard when it is available locally", () => {
  const file = path.join(os.tmpdir(), "indiarace-research", "pune-2026-10-18.html");
  if (!fs.existsSync(file)) return;
  const html = fs.readFileSync(file, "utf8");
  const result = validateRacecard(html, "10", "2026-10-18", "https://www.indiarace.com/Home/racingCenterEvent?event_date=2026-10-18&race_type=RACECARD&venueId=10", "2026-10-18T18:00:00.000Z");
  assert.equal(result.error, null);
  const meeting = result.meeting;
  assert.ok(meeting);
  assert.equal(meeting.course, "Pune");
  const runners = meeting.races.flatMap((race) => race.runners);
  assertSavedProfileLinks(html, runners);
  const beyond = runners.find((runner) => runner.horse === "BEYOND STARS");
  assert.ok(beyond);
  assert.equal(beyond.sourceHorseId, "62796");
  assert.equal(beyond.horseProfileUrl, "https://www.indiarace.com/Home/horseStatistics/62796/BEYOND STARS");
  assert.notEqual(beyond.sourceHorseId, String(beyond.horseNumber));
});

function assertSavedProfileLinks(html: string, runners: { horse: string | null; horseNumber: number | null; sourceHorseId: string | null; sourceHorseName: string | null; horseProfileUrl: string | null }[]): void {
  const rows = [...html.matchAll(/<tr class="dividend_tr"[^>]*>([\s\S]*?)<\/tr>/gi)];
  assert.equal(runners.length, rows.length);
  rows.forEach((row, index) => {
    const runner = runners[index];
    const href = row[1].match(/<a\b[^>]*href="(https:\/\/www\.indiarace\.com\/Home\/horseStatistics\/(\d+)\/([^"]*))"/i);
    assert.ok(runner);
    if (!href) {
      assert.equal(runner.sourceHorseId, null);
      assert.equal(runner.sourceHorseName, null);
      assert.equal(runner.horseProfileUrl, null);
      return;
    }
    assert.equal(runner.sourceHorseId, href[2]);
    assert.equal(runner.horseProfileUrl, href[1]);
    assert.equal(runner.sourceHorseName, decodeURIComponent(href[3]));
    assert.notEqual(runner.sourceHorseId, String(runner.horseNumber));
    assert.notEqual(runner.sourceHorseId, runner.horse);
  });
}
