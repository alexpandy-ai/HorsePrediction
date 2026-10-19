const UNAVAILABLE_PLACE = /^(region|state)\s+unavailable$/i;

/** A real state or region name, or null when the place is missing or marked unavailable. */
export function knownRegion(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  if (!text || UNAVAILABLE_PLACE.test(text)) return null;
  return text;
}
