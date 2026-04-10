import { formatDistanceToNow, isValid } from "date-fns";

function parseToDate(value: Date | number | string): Date | null {
  if (value instanceof Date) {
    return isValid(value) ? value : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // Accept unix seconds and milliseconds.
    const normalized = value < 1_000_000_000_000 ? value * 1000 : value;
    const parsed = new Date(normalized);
    return isValid(parsed) ? parsed : null;
  }

  const raw = value.trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return null;
    const normalized = asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber;
    const parsed = new Date(normalized);
    return isValid(parsed) ? parsed : null;
  }

  const parsed = new Date(raw);
  return isValid(parsed) ? parsed : null;
}

export function formatDistanceToNowSafe(
  value: Date | number | string | null | undefined,
  fallback = "Unknown"
): string {
  if (value === null || value === undefined) return fallback;
  const parsed = parseToDate(value);
  if (!parsed) return fallback;
  return formatDistanceToNow(parsed, { addSuffix: true });
}