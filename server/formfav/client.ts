export interface FormfavResponse {
  status: number;
  body: unknown;
  remaining: number | null;
  retryAfter: number | null;
}

export interface FormfavTransport {
  get(path: string, query: Record<string, string | number>): Promise<FormfavResponse>;
}

const BASE = "https://api.formfav.com";

export function createFormfavTransport(apiKey: string, fetchImpl: typeof fetch = fetch): FormfavTransport {
  return {
    async get(path, query) {
      const url = new URL(path, BASE);
      for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
      let response = await fetchImpl(url, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
      if (response.status === 429 || response.status >= 500) {
        const wait = Math.min(retrySeconds(response.headers.get("Retry-After")), 30);
        await delay(wait * 1000);
        response = await fetchImpl(url, { headers: { "X-API-Key": apiKey, Accept: "application/json" } });
      }
      const text = await response.text();
      return {
        status: response.status,
        body: parseJson(text),
        remaining: headerNumber(response.headers.get("X-RateLimit-Remaining-Day")),
        retryAfter: headerNumber(response.headers.get("Retry-After")),
      };
    },
  };
}

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 180) };
  }
}

function headerNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function retrySeconds(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
