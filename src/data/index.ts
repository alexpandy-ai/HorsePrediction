import { courses } from "./courses";
import { history } from "./history";
import { meetings, races, runners } from "./races";
import type { Course, Meeting, Race, Runner } from "../types";

export { countries, courses, getCountry } from "./courses";
export { history } from "./history";
export { meetings, races, runners } from "./races";

function assertCards(): void {
  if (new Set(races.map((race) => race.id)).size !== races.length) {
    throw new Error("Duplicate race id");
  }
  for (const race of races) {
    if (!meetings.some((meeting) => meeting.id === race.meetingId)) {
      throw new Error(`Missing meeting for ${race.id}`);
    }
    const field = runners.filter((runner) => runner.raceId === race.id);
    const draws = field.map((runner) => runner.draw);
    const jockeys = field.map((runner) => runner.jockey);
    const numbers = field.map((runner) => runner.number);
    const drawOk = new Set(draws).size === draws.length && draws.every((draw) => draw >= 1 && draw <= field.length);
    const jockeyOk = new Set(jockeys).size === jockeys.length;
    const numberOk = new Set(numbers).size === numbers.length;
    if (!drawOk || !jockeyOk || !numberOk) {
      throw new Error(`Card check failed for ${race.id}`);
    }
  }
  for (const meeting of meetings) {
    if (!courses.some((course) => course.id === meeting.courseId)) {
      throw new Error(`Missing course for ${meeting.id}`);
    }
  }
  for (const course of courses) {
    if (!history.some((result) => result.courseId === course.id)) {
      throw new Error(`No history for ${course.id}`);
    }
  }
}

assertCards();

export function getCourse(id: string): Course | undefined {
  return courses.find((course) => course.id === id);
}

export function getMeeting(id: string): Meeting | undefined {
  return meetings.find((meeting) => meeting.id === id);
}

export function getRace(id: string): Race | undefined {
  return races.find((race) => race.id === id);
}

export function racesForMeeting(meetingId: string): Race[] {
  return races.filter((race) => race.meetingId === meetingId).sort((a, b) => a.number - b.number);
}

export function runnersForRace(raceId: string): Runner[] {
  return runners.filter((runner) => runner.raceId === raceId).sort((a, b) => a.number - b.number);
}

export function historyForCourse(courseId: string) {
  return history.filter((result) => result.courseId === courseId);
}

export function meetingForCourse(courseId: string): Meeting | undefined {
  return meetings.find((meeting) => meeting.courseId === courseId);
}
