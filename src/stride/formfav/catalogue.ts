export type FormfavPlan = "free" | "pro" | "premium";

export interface FormfavEndpoint {
  method: "GET";
  path: string;
  plan: FormfavPlan;
  purpose: string;
  scheduled: boolean;
}

/** Documented FormFav REST endpoints. Auth-key management is omitted because the importer must not create or revoke keys. */
export const FORMFAV_ENDPOINTS: FormfavEndpoint[] = [
  { method: "GET", path: "/v1/form/meetings", plan: "free", purpose: "Meetings and race list for a date", scheduled: true },
  { method: "GET", path: "/v1/form/venues", plan: "free", purpose: "Whether a country has thoroughbred venues", scheduled: true },
  { method: "GET", path: "/v1/form", plan: "free", purpose: "Runners, barriers, weights, form and career statistics", scheduled: true },
  { method: "GET", path: "/v1/predictions", plan: "pro", purpose: "Model win and place probabilities. Documented country coverage is Australia.", scheduled: false },
  { method: "GET", path: "/v1/results", plan: "pro", purpose: "Finishing positions for one race", scheduled: false },
  { method: "GET", path: "/v1/results/meeting", plan: "pro", purpose: "Finishing positions for a meeting", scheduled: false },
  { method: "GET", path: "/v1/stats/runner/search", plan: "pro", purpose: "Search a runner", scheduled: false },
  { method: "GET", path: "/v1/stats/runner/{runner_id}", plan: "pro", purpose: "Extended runner statistics", scheduled: false },
  { method: "GET", path: "/v1/stats/jockey/search", plan: "pro", purpose: "Search a jockey", scheduled: false },
  { method: "GET", path: "/v1/stats/jockey/{jockey_name}", plan: "pro", purpose: "Jockey statistics", scheduled: false },
  { method: "GET", path: "/v1/stats/trainer/search", plan: "pro", purpose: "Search a trainer", scheduled: false },
  { method: "GET", path: "/v1/stats/trainer/{trainer_name}", plan: "pro", purpose: "Trainer statistics", scheduled: false },
  { method: "GET", path: "/v1/stats/track-bias/{track}", plan: "pro", purpose: "Barrier bias at a track", scheduled: false },
  { method: "GET", path: "/v1/prices", plan: "premium", purpose: "Live bookmaker win and place prices", scheduled: false },
];

export const FORMFAV_RATE_LIMITS = {
  freePerDay: 1000,
  proPerDay: 20000,
  premiumPerDay: 100000,
  headerLimit: "X-RateLimit-Limit-Day",
  headerRemaining: "X-RateLimit-Remaining-Day",
  headerRetryAfter: "Retry-After",
};
