import fs from "node:fs";
import path from "node:path";
import { emptyHorseStatistics, type HorseStatisticsFile } from "../../src/stride/horseStatistics.ts";

const file = path.join(process.cwd(), "public", "data", "indiarace", "horses.json");

export function readHorseStore(): HorseStatisticsFile {
  if (!fs.existsSync(file)) return emptyHorseStatistics();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as HorseStatisticsFile;
    return { ...emptyHorseStatistics(), ...parsed, horses: parsed.horses ?? {} };
  } catch {
    return emptyHorseStatistics();
  }
}

export function writeHorseStore(statistics: HorseStatisticsFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload = JSON.stringify(statistics, null, 2);
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, payload);
  try {
    fs.renameSync(temporary, file);
  } catch {
    fs.writeFileSync(file, payload);
    fs.rmSync(temporary, { force: true });
  }
}
