import type { DayOfWeek, Entry } from "@/types";

// DayOfWeek → Google Calendar RRULE BYDAY abbreviation.
const DAY_TO_BYDAY: Record<DayOfWeek, string> = {
  MONDAY: "MO",
  TUESDAY: "TU",
  WEDNESDAY: "WE",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "SA",
  SUNDAY: "SU",
};

// DayOfWeek → local getDay() index (0 = Sunday).
const DAY_TO_JS: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/** Local Date + "HH:MM" → Google's floating stamp "YYYYMMDDTHHMMSS". */
function toStamp(date: Date, time: string): string {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}T${time.replace(":", "")}00`;
}

/** Next local occurrence of a weekday (today counts, even if time passed). */
function nextOccurrence(day: DayOfWeek): Date {
  const now = new Date();
  const result = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  result.setDate(result.getDate() + ((DAY_TO_JS[day] - now.getDay() + 7) % 7));
  return result;
}

/**
 * One-click "add to Google Calendar" template URL — no API key or OAuth
 * needed. Weekly classes include an RRULE (repeats forever; delete the
 * series when the term ends). Times are floating local, matching how the
 * schedule's "HH:MM" strings are meant to be read.
 */
export function googleCalendarUrl(entry: Entry): string {
  const startDay =
    entry.isOneOff && entry.date
      ? // "YYYY-MM-DD" parsed as LOCAL midnight (no Z suffix by design).
        new Date(`${entry.date}T00:00:00`)
      : nextOccurrence(entry.day);

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: entry.subject,
    dates: `${toStamp(startDay, entry.startTime)}/${toStamp(startDay, entry.endTime)}`,
  });

  if (entry.room?.trim()) params.set("location", entry.room);
  const details = [
    entry.instructor?.trim() ? `Instructor: ${entry.instructor}` : null,
    entry.notes?.trim() || null,
  ].filter((part): part is string => Boolean(part));
  if (details.length > 0) params.set("details", details.join("\n"));

  if (!entry.isOneOff) {
    params.set("recur", `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_BYDAY[entry.day]}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
