import { normalizeConfidence, type AnalyzeResult, type RawAiEntry } from "./ocr/types.js";
import { normalizeTime } from "../utils/time.js";

// Converts untrusted AI output (AnalyzeResult) into clean DetectedEntry[] for
// the client. NEVER writes to the database — this is a pure transformation.

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type UncertainField = "subject" | "days" | "startTime" | "endTime" | "room" | "instructor";

export interface DetectedEntry {
  subject: string;
  instructor: string | null;
  room: string | null;
  days: DayOfWeek[];
  startTime: string | null; // "HH:MM"
  endTime: string | null; // "HH:MM"
  notes: string | null;
  uncertainFields: UncertainField[];
  // Per-field confidence 0..1 (subject | day | startTime | endTime |
  // instructor | room) passed through from the provider — absent when the
  // provider/model returned none. The review UI highlights values < 0.75.
  confidence?: Record<string, number>;
}

const DAY_ORDER: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const DAY_INDEX: Record<DayOfWeek, number> = {
  MONDAY: 0,
  TUESDAY: 1,
  WEDNESDAY: 2,
  THURSDAY: 3,
  FRIDAY: 4,
  SATURDAY: 5,
  SUNDAY: 6,
};

// Full names + 1-3 letter abbreviations, matched at word boundaries.
const DAY_TOKENS: Array<[RegExp, DayOfWeek]> = [
  [/\bmondays?\b|\bmon\b/i, "MONDAY"],
  [/\btuesdays?\b|\btues\b|\btue\b|\btue\b/i, "TUESDAY"],
  [/\bwednesdays?\b|\bweds\b|\bwed\b/i, "WEDNESDAY"],
  [/\bthursdays?\b|\bthurs\b|\bthur\b|\bthu\b/i, "THURSDAY"],
  [/\bfridays?\b|\bfri\b/i, "FRIDAY"],
  [/\bsaturdays?\b|\bsat\b/i, "SATURDAY"],
  [/\bsundays?\b|\bsun\b/i, "SUNDAY"],
];

// Common single-letter day codes used in compact grids: M T W Th F S Su
const LETTER_CODES: Array<[RegExp, DayOfWeek]> = [
  [/\bmon\b|\bmo\b/i, "MONDAY"],
  [/\btue\b|\bti\b/i, "TUESDAY"],
  [/\bwed\b|\bwe\b/i, "WEDNESDAY"],
  [/\bthu\b|\bth\b/i, "THURSDAY"],
  [/\bfri\b|\bfr\b/i, "FRIDAY"],
  [/\bsat\b|\bsa\b/i, "SATURDAY"],
  [/\bsun\b|\bsu\b/i, "SUNDAY"],
];

function addDay(set: Set<DayOfWeek>, day: DayOfWeek): void {
  set.add(day);
}

/** Expand common combined abbreviations like "MWF", "TTh", "MW", "TF". */
function expandAbbreviation(token: string, set: Set<DayOfWeek>): boolean {
  const t = token.toUpperCase().replace(/[^A-Z]/g, "");
  if (!t || t.length > 6) return false;
  // Try to greedily consume letters using known abbreviations (longest first).
  const parts: Array<[string, DayOfWeek]> = [
    ["MON", "MONDAY"],
    ["MO", "MONDAY"],
    ["M", "MONDAY"],
    ["TUE", "TUESDAY"],
    ["TUES", "TUESDAY"],
    ["TU", "TUESDAY"],
    ["T", "TUESDAY"],
    ["WED", "WEDNESDAY"],
    ["WE", "WEDNESDAY"],
    ["W", "WEDNESDAY"],
    ["THU", "THURSDAY"],
    ["THUR", "THURSDAY"],
    ["THURS", "THURSDAY"],
    ["TH", "THURSDAY"],
    ["H", "THURSDAY"],
    ["FRI", "FRIDAY"],
    ["FR", "FRIDAY"],
    ["F", "FRIDAY"],
    ["SAT", "SATURDAY"],
    ["SA", "SATURDAY"],
    ["S", "SATURDAY"],
    ["SUN", "SUNDAY"],
    ["SU", "SUNDAY"],
  ];
  // Prefer longer matches; try all orderings via simple backtracking.
  parts.sort((a, b) => b[0].length - a[0].length);

  const before = set.size;
  function backtrack(remaining: string): boolean {
    if (remaining.length === 0) return true;
    for (const [abbr, day] of parts) {
      if (remaining.startsWith(abbr)) {
        addDay(set, day);
        if (backtrack(remaining.slice(abbr.length))) return true;
        set.delete(day);
      }
    }
    return false;
  }
  if (!backtrack(t)) {
    // Undo any partial adds on failure.
    if (set.size === before) return false;
    // If backtrack failed we already cleaned up via set.delete in the loop.
    return set.size > before;
  }
  return true;
}

/**
 * Parse a day string (or array of strings) into DayOfWeek[].
 * Accepts: "Monday", "Mon", "MWF", "TTh", "Tue,Thu", "Mon-Fri" (expands
 * weekday ranges), "Monday Wednesday". Unknown content is skipped; the caller
 * flags the entry uncertain when nothing was recognized.
 */
export function parseDays(raw: string | string[] | null | undefined): DayOfWeek[] {
  if (raw == null) return [];
  const parts = Array.isArray(raw) ? raw : [raw];
  const set = new Set<DayOfWeek>();

  for (const part of parts) {
    if (typeof part !== "string") continue;
    const text = part.trim();
    if (!text) continue;

    // Hyphenated sequences like "Mon-Fri" (range) or "Mon-Wed-Fri" (list).
    const hySegments = text.split(/\s*[-–—]\s*/i).filter(Boolean);
    if (hySegments.length >= 2 && hySegments.every((seg) => /^\w{1,9}$/.test(seg))) {
      const segDays = hySegments.map((seg) => lookupSingleDay(seg));
      if (segDays.every((d): d is DayOfWeek => d !== null)) {
        if (hySegments.length === 2) {
          // Exactly two endpoints → inclusive range ("Mon-Fri" → Mon..Fri).
          const s = DAY_INDEX[segDays[0]!];
          const e = DAY_INDEX[segDays[1]!];
          const [lo, hi] = s <= e ? [s, e] : [e, s];
          for (let i = lo; i <= hi; i++) addDay(set, DAY_ORDER[i]);
        } else {
          // 3+ named segments ("Mon-Wed-Fri") → union, not a range.
          for (const d of segDays) addDay(set, d);
        }
        continue;
      }
    }

    // Split on commas / slashes / "and" / whitespace, then classify each token.
    const tokens = text.split(/\s*(?:,|\/|&|\band\b)\s*|\s+/i).filter(Boolean);
    for (const token of tokens) {
      // Exact full/abbrev name first.
      let matched = false;
      for (const [re, day] of DAY_TOKENS) {
        if (re.test(token)) {
          addDay(set, day);
          matched = true;
          break;
        }
      }
      if (!matched) {
        for (const [re, day] of LETTER_CODES) {
          if (re.test(token)) {
            addDay(set, day);
            matched = true;
            break;
          }
        }
      }
      // Compact codes like "MWF", "TTh".
      if (!matched && /^[A-Za-z]{2,6}$/.test(token)) {
        expandAbbreviation(token, set);
      }
    }
  }

  return DAY_ORDER.filter((d) => set.has(d));
}

function lookupSingleDay(token: string): DayOfWeek | null {
  const days = parseDays(token);
  if (days.length === 1) return days[0];
  // Single letters (only used inside hyphen segments like "M-F").
  const single = token.toUpperCase();
  const map: Record<string, DayOfWeek> = {
    M: "MONDAY",
    T: "TUESDAY",
    W: "WEDNESDAY",
    R: "THURSDAY",
    F: "FRIDAY",
    S: "SATURDAY",
    U: "SUNDAY",
  };
  return days.length === 0 ? (map[single] ?? null) : null;
}

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

/** Convert one raw AI row into a DetectedEntry, or null when the subject is empty. */
export function parseRawEntry(raw: RawAiEntry): DetectedEntry | null {
  const subject = cleanText(raw.subject);
  // Contract: subject empty/whitespace → drop the row entirely.
  if (!subject) return null;

  const uncertainFields: UncertainField[] = [];

  const days = parseDays(raw.day);
  if (days.length === 0) uncertainFields.push("days");

  const startTime = normalizeTime(raw.start_time);
  if (startTime === null) uncertainFields.push("startTime");

  const endTime = normalizeTime(raw.end_time);
  if (endTime === null) uncertainFields.push("endTime");

  // Overnight / reversed ranges: keep values but flag both so the user
  // decides on review — never silently modify.
  if (startTime !== null && endTime !== null && endTime <= startTime) {
    if (!uncertainFields.includes("startTime")) uncertainFields.push("startTime");
    if (!uncertainFields.includes("endTime")) uncertainFields.push("endTime");
  }

  const instructor = cleanText(raw.instructor);
  // instructor/room are never invented — only pass through what the AI saw.
  const room = cleanText(raw.room);
  const notes = cleanText(raw.notes);

  // Heuristic: models often mark a shaky reading with a trailing "?".
  // Strip it and flag the field so the user double-checks on review.
  let roomValue = room;
  if (roomValue && roomValue.endsWith("?")) {
    roomValue = roomValue.slice(0, -1).trim() || null;
    uncertainFields.push("room");
  }
  let instructorValue = instructor;
  if (instructorValue && instructorValue.endsWith("?")) {
    instructorValue = instructorValue.slice(0, -1).trim() || null;
    uncertainFields.push("instructor");
  }

  // Per-field confidence flows through unchanged for valid values
  // (normalizeConfidence is idempotent — providers already clamp); missing or
  // unusable input leaves the field absent rather than failing the parse.
  const confidence = normalizeConfidence(raw.confidence);

  return {
    subject,
    instructor: instructorValue,
    room: roomValue,
    days,
    startTime,
    endTime,
    notes,
    uncertainFields,
    ...(confidence ? { confidence } : {}),
  };
}

/** Full pipeline: AnalyzeResult → sorted DetectedEntry[] (first day, then startTime). */
export function parseAnalyzeResult(result: AnalyzeResult): DetectedEntry[] {
  const entries: DetectedEntry[] = [];
  for (const raw of result.entries ?? []) {
    const parsed = parseRawEntry(raw);
    if (parsed) entries.push(parsed);
  }

  entries.sort((a, b) => {
    const ad = a.days.length > 0 ? DAY_INDEX[a.days[0]] : 99;
    const bd = b.days.length > 0 ? DAY_INDEX[b.days[0]] : 99;
    if (ad !== bd) return ad - bd;
    const at = a.startTime ?? "99:99";
    const bt = b.startTime ?? "99:99";
    return at.localeCompare(bt);
  });

  return entries;
}
