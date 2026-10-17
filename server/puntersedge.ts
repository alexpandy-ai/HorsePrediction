const BASE = "https://api.puntersedge.online/v1";

export type PeFailure = "auth" | "credits" | "plan" | "rate" | "validation" | "server";

export class PeError extends Error {
  status: number;
  retryAfter: number | null;
  kind: PeFailure;

  constructor(message: string, status: number, kind: PeFailure, retryAfter: number | null) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.retryAfter = retryAfter;
  }
}

export interface PeResult {
  body: unknown;
  cost: number;
  remaining: number | null;
  horizonHours: number | null;
}

function headerNumber(headers: Headers, name: string): number | null {
  const value = headers.get(name);
  if (!value || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

function safeDetail(body: unknown): string {
  if (!body || typeof body !== "object") return "PuntersEdge refused the request.";
  const record = body as Record<string, unknown>;
  const detail = typeof record.detail === "string" ? record.detail : typeof record.title === "string" ? record.title : "";
  return detail.replace(/[A-Za-z0-9_\-]{24,}/g, "[redacted]").slice(0, 280) || "PuntersEdge refused the request.";
}

function kindFor(status: number): PeFailure {
  if (status === 401) return "auth";
  if (status === 402) return "credits";
  if (status === 403) return "plan";
  if (status === 422) return "validation";
  if (status === 429) return "rate";
  return "server";
}

export async function peGet(
  path: string,
  query: Record<string, string | undefined>,
  apiKey: string,
  assumedCost: number,
  previousRemaining: number | null = null,
): Promise<PeResult> {
  const url = new URL(`${BASE}${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value) url.searchParams.set(key, value);
  }
  let attempt = 0;
  while (attempt < 2) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "X-API-Key": apiKey, Accept: "application/json" },
      });
      const remaining = headerNumber(response.headers, "X-Credits-Remaining");
      const horizonHours = headerNumber(response.headers, "X-Horizon-Hours");
      let cost = response.ok ? assumedCost : 0;
      if (previousRemaining != null && remaining != null) cost = Math.max(0, previousRemaining - remaining);
      if (response.ok) {
        return { body: await response.json(), cost, remaining, horizonHours };
      }
      const retryAfter = headerNumber(response.headers, "Retry-After");
      const detail = safeDetail(await response.json().catch(() => null));
      const kind = kindFor(response.status);
      if (kind === "rate" && retryAfter != null && retryAfter <= 30 && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
        continue;
      }
      if (kind === "server" && attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        continue;
      }
      throw new PeError(detail, response.status, kind, retryAfter);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new PeError("PuntersEdge did not answer.", 599, "server", null);
}
