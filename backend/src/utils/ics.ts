// RFC 5545 (iCalendar) export for a schedule.
//
// Design notes:
// - CRLF line endings everywhere; text values are escaped per RFC 5545
//   (backslash, semicolon, comma; newlines become \n).
// - Floating local times (no TZID / no Z): DTSTART:YYYYMMDDTHHMMSS. The
//   schedule's "HH:MM" strings are wall-clock class times, so consumers keep
//   them as-is — acceptable for this project.
// - Weekly entries get RRULE:FREQ=WEEKLY;BYDAY=<day> (+ EXDATE for each
//   exception date, + UNTIL from the schedule's endDate). One-off entries are
//   single VEVENTs with no RRULE.
// - Pure functions only: no DB access, no clock reads except the injectable
//   `now` used for DTSTAMP/anchoring (defaults to the current time).

export interface IcsSchedule {
  id: string;
  name: string;
  startDate: string | null; // "YYYY-MM-DD" (term start) or null
  endDate: string | null; // "YYYY-MM-DD" (term end) or null
}

export interface IcsEntry {
  id: string;
  subject: string;
  day: string; // "MONDAY" .. "SUNDAY"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  instructor?: string | null;
  room?: string | null;
  notes?: string | null;
  exceptionDates: string[]; // "YYYY-MM-DD" days the class does NOT meet
  isOneOff: boolean;
  date: string | null; // "YYYY-MM-DD" for one-offs, else null
}

export interface IcsOptions {
  /** Injection point for deterministic DTSTAMP/anchoring (tests). */
  now?: Date;
}

// DayOfWeek → RRULE BYDAY abbreviation.
const DAY_ABBREV: Record<string, string> = {
  MONDAY: "MO",
  TUESDAY: "TU",
  WEDNESDAY: "WE",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "SA",
  SUNDAY: "SU",
};

// DayOfWeek → getUTCDay() index (0 = Sunday).
const DAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const MS_PER_DAY = 86_400_000;

/** RFC 5545 TEXT escaping: backslash first, then ; and ,; newlines → \n. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** "YYYY-MM-DD" → "YYYYMMDD". */
function dateStamp(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

/** "YYYY-MM-DD" + "HH:MM" → "YYYYMMDDTHHMMSS" (floating local time). */
function dateTimeStamp(isoDate: string, time: string): string {
  return `${dateStamp(isoDate)}T${time.replace(":", "")}00`;
}

/** Date at midnight (UTC calendar day) → "YYYY-MM-DD". */
function isoDateOf(date: Date): string {
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Now → DTSTAMP form "YYYYMMDDTHHMMSSZ" (DTSTAMP must be UTC per RFC). */
function dtstamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/**
 * First DTSTART day for a weekly entry when the schedule has no term start:
 * today if today is the class weekday (its time may have just passed — most
 * recent past occurrence — or still be ahead — next occurrence); otherwise the
 * most recent past occurrence of that weekday (within the last 7 days).
 */
function anchorDate(entry: IcsEntry, now: Date): string {
  const target = DAY_INDEX[entry.day];
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  if (target === undefined) return isoDateOf(today);
  if (today.getUTCDay() === target) return isoDateOf(today);
  for (let back = 1; back <= 7; back++) {
    const candidate = new Date(today.getTime() - back * MS_PER_DAY);
    if (candidate.getUTCDay() === target) return isoDateOf(candidate);
  }
  return isoDateOf(today); // unreachable for valid DayOfWeek values
}

/** One VEVENT (recurring or one-off), lines separated by CRLF. */
function buildEvent(schedule: IcsSchedule, entry: IcsEntry, now: Date): string {
  const stamp = dtstamp(now);
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${entry.id}-${schedule.id}@scheduleai`,
    `DTSTAMP:${stamp}`,
  ];

  if (entry.isOneOff && entry.date) {
    // Single occurrence — no RRULE, no EXDATE.
    lines.push(`DTSTART:${dateTimeStamp(entry.date, entry.startTime)}`);
    lines.push(`DTEND:${dateTimeStamp(entry.date, entry.endTime)}`);
  } else {
    const startDate = schedule.startDate ?? anchorDate(entry, now);
    lines.push(`DTSTART:${dateTimeStamp(startDate, entry.startTime)}`);
    lines.push(`DTEND:${dateTimeStamp(startDate, entry.endTime)}`);
  }

  lines.push(`SUMMARY:${escapeText(entry.subject)}`);
  if (entry.room) lines.push(`LOCATION:${escapeText(entry.room)}`);

  const descriptionParts: string[] = [];
  if (entry.instructor) descriptionParts.push(`Instructor: ${entry.instructor}`);
  if (entry.notes) descriptionParts.push(entry.notes);
  if (descriptionParts.length > 0) {
    lines.push(`DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`);
  }

  if (!entry.isOneOff) {
    const abbrev = DAY_ABBREV[entry.day] ?? DAY_ABBREV.MONDAY;
    let rrule = `RRULE:FREQ=WEEKLY;BYDAY=${abbrev}`;
    if (schedule.endDate) {
      // Inclusive end of the term's last day, as a floating local UNTIL
      // (matches the floating DTSTART). Built directly — dateTimeStamp is for
      // "HH:MM" times and would mangle seconds.
      rrule += `;UNTIL=${dateStamp(schedule.endDate)}T235959`;
    }
    lines.push(rrule);
    // EXDATE must repeat the occurrence's full datetime (a date-only EXDATE
    // never matches a floating DTSTART with a time component).
    for (const exceptionDate of entry.exceptionDates) {
      lines.push(`EXDATE:${dateTimeStamp(exceptionDate, entry.startTime)}`);
    }
  }

  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

/** Build the full RFC 5545 calendar for a schedule. */
export function buildIcs(
  schedule: IcsSchedule,
  entries: IcsEntry[],
  opts: IcsOptions = {}
): string {
  const now = opts.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ScheduleAI//EN",
    `X-WR-CALNAME:${escapeText(schedule.name)}`,
  ];
  for (const entry of entries) {
    lines.push(buildEvent(schedule, entry, now));
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * Filesystem-safe basename for the download: keeps [A-Za-z0-9._-], collapses
 * everything else to single dashes, trims edges, caps length.
 */
export function icsFilename(scheduleName: string): string {
  const slug = scheduleName
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-._]+/, "")
    .replace(/[-._]+$/, "")
    .slice(0, 64)
    .replace(/[-._]+$/, "");
  return slug || "schedule";
}
