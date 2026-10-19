import type { Conflict, DayOfWeek } from "@/types";
import { toMinutes } from "@/lib/time";

export interface ConflictInput {
  id: string;
  subject: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

/**
 * Pure client-side mirror of backend/src/utils/conflict.ts.
 * Two classes conflict when they share a day and overlap:
 * aStart < bEnd && bStart < aEnd.
 * Used for the live preview on the review screen and in class forms —
 * the server stays authoritative when saving.
 */
export function findConflicts(entries: ConflictInput[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const a = entries[i];
      const b = entries[j];
      if (a.day !== b.day) continue;

      const aStart = toMinutes(a.startTime);
      const aEnd = toMinutes(a.endTime);
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);

      if (aStart < bEnd && bStart < aEnd) {
        conflicts.push({ a, b });
      }
    }
  }

  return conflicts;
}

/**
 * Review rows hold a list of days; each row is expanded into one entry per day
 * so a weekly class can be checked for clashes.
 */
export function expandDaysForConflicts(
  rows: {
    id: string;
    subject: string;
    days: DayOfWeek[];
    startTime: string;
    endTime: string;
  }[],
): ConflictInput[] {
  return rows.flatMap((row) =>
    row.days.map((day) => ({
      id: row.id,
      subject: row.subject,
      day,
      startTime: row.startTime,
      endTime: row.endTime,
    })),
  );
}