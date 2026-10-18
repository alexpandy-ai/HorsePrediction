import fs from "node:fs";
import path from "node:path";
import { createFormfavTransport } from "./client.ts";
import { syncFormfav } from "./sync.ts";

loadEnv(path.join(process.cwd(), ".env"));

const key = process.env.FORMFAV_API_KEY?.trim() ?? "";
const planRaw = process.env.FORMFAV_PLAN?.trim().toLowerCase();
const plan = planRaw === "free" || planRaw === "pro" || planRaw === "premium" ? planRaw : "unknown";
const status = await syncFormfav({
  transport: key ? createFormfavTransport(key) : null,
  plan,
});
console.log(
  JSON.stringify(
    {
      configured: status.configured,
      plan: status.plan,
      requestsUsed: status.requestsUsed,
      lastError: status.lastError,
      countries: status.countries,
    },
    null,
    2,
  ),
);

function loadEnv(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const name = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (name && process.env[name] === undefined) process.env[name] = value;
  }
}
