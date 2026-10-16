import type { CountryId, Runner } from "./types";

const SEX: Record<Runner["sex"], string> = {
  C: "colt",
  H: "horse",
  G: "gelding",
  F: "filly",
  M: "mare",
};

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatWeight(kg: number, country: CountryId, claim = false): string {
  if (country !== "uk") return `${kg.toFixed(1)} kg`;
  const totalLb = Math.round(kg * 2.2046226218);
  if (claim || totalLb < 14) return `${totalLb}lb`;
  const stone = Math.floor(totalLb / 14);
  const pounds = totalLb % 14;
  return pounds === 0 ? `${stone}st` : `${stone}st ${pounds}lb`;
}

export function drawLabel(country: CountryId): string {
  return country === "australia" ? "Barrier" : "Draw";
}

export function describeHorse(runner: Runner): string {
  return `${runner.age}yo ${SEX[runner.sex]}`;
}

export function carriedKg(runner: Runner): number {
  return runner.handicapKg - runner.claimKg;
}
