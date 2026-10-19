// Time helpers. All times in the API are "HH:MM" 24-hour strings, stored as
// text in Postgres so the exact contract format round-trips untouched.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_RE.test(value);
}

/** "HH:MM" → minutes since midnight (for comparisons). Invalid → null. */
export function timeToMinutes(value: string): number | null {
  if (!isValidTime(value)) return null;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Parse many AI-ish time formats into "HH:MM" 24h, or null if unparseable.
 * Handles: "8:00 AM", "08:00", "0800", "8.30", "8h", "13:0", "9-10am", "17h30".
 */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // Detect an AM/PM suffix anywhere in the string before stripping separators.
  const hasAm = /\b(a\.?m\.?)\b/.test(s) || /a\.?m\.?$/.test(s);
  const hasPm = /\b(p\.?m\.?)\b/.test(s) || /p\.?m\.?$/.test(s);
  s = s.replace(/\b[a-z]\.?m\.?\b/g, "").trim();
  s = s.replace(/[h：]/g, ":").replace(/[.\-–—]/g, ":").replace(/\s+/g, "");

  // Patterns like "1730" or "800" (no colon)
  if (/^\d{3,4}$/.test(s)) {
    s = s.padStart(4, "0");
    s = `${s.slice(0, 2)}:${s.slice(2)}`;
  } else if (/^\d{1,2}:?$/.test(s)) {
    // Bare hour like "8" or "8h" (h already replaced with ":")
    s = `${s.replace(":", "").padStart(2, "0")}:00`;
  } else {
    // "H:MM", "HH:MM", or a leftover "H:MM" with missing minutes like "13:0"
    const m = s.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    s = `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
  }

  let hour = Number(s.slice(0, 2));
  const minute = Number(s.slice(3, 5));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hasAm && !hasPm && hour === 12) hour = 0;
  if (hasPm && !hasAm && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}
