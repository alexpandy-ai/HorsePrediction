import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { indiaHorseHash, isUnavailableHorse } from "../../src/stride/horseStatistics.ts";
import { parseRoute } from "../../src/router.ts";
import { collectHorseStatistics, parseHorseStatistics } from "./horseStatistics.ts";

const html = `
<h4>Career Statistics</h4>
<h4>FIXTURE HORSE</h4>
<table class="horseStatistics-table">
  <tr>
    <td><h5>3Y, b g</h5></td>
    <td><h6><a href="/Home/allSireDetails/1">Sire Name</a> / <a href="/Home/allDamDetails/2">Dam Name</a></h6></td>
  </tr>
  <tr><td><span class="left-serispan">Rating</span></td><td><span class="right-serispan">32</span></td></tr>
  <tr><td><span class="left-serispan">Trainer:</span></td><td><span class="right-serispan">A Trainer</span></td></tr>
  <tr><td><span class="left-serispan">Bred at:</span></td><td><span class="right-serispan"></span></td></tr>
  <tr><td><span class="left-serispan">Owner:</span></td><td><span class="right-serispan">An Owner</span></td></tr>
  <tr><td><span class="left-serispan">Previous Owner:</span></td><td><span class="right-serispan">   </span></td></tr>
</table>
<table>
  <tr><th>No. of Runs</th><th>Wins</th><th>Place 2</th><th>Place 3</th><th>Place 4</th><th><i class="fas fa-rupee-sign"></i></th></tr>
  <tr><td>7</td><td></td><td>1</td><td>1</td><td>0</td><td>802250.00</td></tr>
</table>
<table>
  <tr><th>S.No</th><th>Date</th><th>Venue</th><th>Dist</th><th>Class</th><th>Race No</th><th>Jockey</th><th>Wt</th><th>Dist-Win</th><th>Time</th><th>Rtg</th><th></th><th>Videos</th></tr>
  <tr>
    <td>1</td><td>19-10-2026</td><td>HYD</td><td>1200</td><td>Class 4</td><td><a href="/result"><span>152 (1)</span></a></td>
    <td>H M Akshay</td><td>56</td><td>0</td><td></td><td>32</td><td>292500</td><td></td>
  </tr>
</table>
<table>
  <tr><th>S.No</th><th>Date</th><th>Dist</th><th>Class</th><th>Race No</th><th>Venue</th><th>Jockey</th><th>Wt</th><th>Dist-Win</th><th>Time</th><th>Rtg</th></tr>
  <tr><td>1</td><td>02-02-2020</td><td>1100</td><td>Maiden</td><td>9 (1)</td><td>OTHER</td><td>Someone</td><td>55</td><td>1</td><td>1:10.00</td><td>20</td></tr>
</table>`;

test("reads a horse statistics page without turning a blank into zero", () => {
  const horse = parseHorseStatistics(html, "99", "FIXTURE HORSE", "2026-10-19T00:00:00.000Z");
  assert.ok(horse);
  assert.equal(horse.name, "FIXTURE HORSE");
  assert.equal(horse.ageColourSex, "3Y, b g");
  assert.equal(horse.sire, "Sire Name");
  assert.equal(horse.dam, "Dam Name");
  assert.equal(horse.rating, "32");
  assert.equal(horse.trainer, "A Trainer");
  assert.equal(horse.bredAt, null);
  assert.equal(horse.owner, "An Owner");
  assert.equal(horse.previousOwner, null);
  assert.equal(horse.career?.runs, "7");
  assert.equal(horse.career?.wins, null);
  assert.equal(horse.career?.fourth, "0");
  assert.equal(horse.career?.earnings, "802250.00");
  assert.equal(horse.careerLabels?.runs, "No. of Runs");
  assert.equal(horse.careerLabels?.earnings, "₹");
  assert.equal(horse.starts.length, 1);
  assert.equal(horse.starts[0]?.date, "19-10-2026");
  assert.equal(horse.starts[0]?.venue, "HYD");
  assert.equal(horse.starts[0]?.raceNumber, "152");
  assert.equal(horse.starts[0]?.finish, "1");
  assert.equal(horse.starts[0]?.winningMargin, "0");
  assert.equal(horse.starts[0]?.time, null);
  assert.equal(parseHorseStatistics(html, "99", "OTHER HORSE", "2026-10-19T00:00:00.000Z"), null);
});

test("a failed horse fetch stays unavailable and keeps the other horses", async () => {
  const previous = {
    source: "Indiarace" as const,
    sourceUrl: "https://www.indiarace.com/" as const,
    horses: {
      "5": {
        id: "5",
        name: "KEPT",
        unavailable: true as const,
        sourceUrl: "https://www.indiarace.com/Home/horseStatistics/5/KEPT",
        fetchedAt: "2026-10-01T00:00:00.000Z",
      },
    },
  };
  const next = await collectHorseStatistics(
    [
      { id: "99", name: "FIXTURE HORSE" },
      { id: "100", name: "MISSING" },
    ],
    previous,
    async (id) => {
      if (id === "100") throw new Error("Indiarace returned 404.");
      return html;
    },
    "2026-10-19T00:00:00.000Z",
  );
  assert.equal(next.horses["5"]?.name, "KEPT");
  assert.equal(isUnavailableHorse(next.horses["99"]), false);
  assert.equal(isUnavailableHorse(next.horses["100"]), true);
  assert.equal(indiaHorseHash("63810", "EQUINE POWER"), "#/horse/63810/EQUINE%20POWER");
  assert.equal(indiaHorseHash(null, "EQUINE POWER"), null);
  const route = parseRoute("#/horse/63810/EQUINE%20POWER");
  assert.equal(route.name, "horse");
  if (route.name === "horse") assert.equal(route.horseName, "EQUINE POWER");
  assert.equal(parseRoute("#/ff/za/race/2026-10-18/kenilworth/1").name, "ff-race");
});

test("reads the saved Rajendra statistics page when it is available locally", () => {
  const file = path.join(os.tmpdir(), "indiarace-research", "horse-2287-RAJENDRA.html");
  if (!fs.existsSync(file)) return;
  const horse = parseHorseStatistics(fs.readFileSync(file, "utf8"), "2287", "RAJENDRA", "2026-10-19T00:00:00.000Z");
  assert.ok(horse);
  assert.equal(horse.name, "RAJENDRA");
  assert.equal(horse.ageColourSex, "3Y, b g");
  assert.equal(horse.sire, "Sporting Chance(GB)");
  assert.equal(horse.dam, "Rotterdam");
  assert.equal(horse.rating, "32");
  assert.equal(horse.trainer, "S Sreekant");
  assert.equal(horse.bredAt, "Badal");
  assert.equal(horse.owner, "Mr Meka Nitish Reddy");
  assert.equal(horse.previousOwner, null);
  assert.equal(horse.careerLabels?.runs, "No. of Runs");
  assert.equal(horse.careerLabels?.second, "Place 2");
  assert.equal(horse.careerLabels?.earnings, "₹");
  assert.equal(horse.career?.runs, "7");
  assert.equal(horse.career?.wins, "1");
  assert.equal(horse.career?.second, "1");
  assert.equal(horse.career?.third, "1");
  assert.equal(horse.career?.fourth, "0");
  assert.equal(horse.career?.earnings, "802250.00");
  assert.equal(horse.starts[0]?.date, "19-10-2026");
  assert.equal(horse.starts[0]?.venue, "HYD");
  assert.equal(horse.starts[0]?.distance, "1200");
  assert.equal(horse.starts[0]?.raceClass, "Class 4");
  assert.equal(horse.starts[0]?.raceNumber, "152");
  assert.equal(horse.starts[0]?.finish, "1");
  assert.equal(horse.starts[0]?.jockey, "H M Akshay");
  assert.equal(horse.starts[0]?.weight, "56");
  assert.equal(horse.starts[0]?.winningMargin, "0");
  assert.equal(horse.starts[0]?.time, "1:14.62");
  assert.equal(horse.starts[0]?.rating, "32");
});
