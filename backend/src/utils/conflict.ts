import { timeToMinutes } from "./time.js";

// Conflict detection is a PURE function so it can be reused on any entry list
// (single fetch, after create/update, after bulk import) without touching the DB.
// Two entries conflict when they are on the same day and their time ranges
// overlap: aStart < bEnd && bStart < aEnd. Zero-length entries never conflict.

export interface ConflictSide {
  id: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface Conflict {
  a: ConflictSide;
  b: ConflictSide;
}

export interface ConflictInput {
  id: string;
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
}

function toSide(e: ConflictInput): ConflictSide {
  return {
    id: e.id,
    subject: e.subject,
    day: e.day,
    startTime: e.startTime,
    endTime: e.endTime,
  };
}

export function computeConflicts(entries: ConflictInput[]): Conflict[] {
  const conflicts: Conflict[] = [];
  // Group by day to avoid cross-day comparisons.
  const byDay = new Map<string, ConflictInput[]>();
  for (const e of entries) {
    const list = byDay.get(e.day) ?? [];
    list.push(e);
    byDay.set(e.day, list);
  }

  for (const list of byDay.values()) {
    // Sort by start so we can break early once starts pass the previous end.
    const sorted = [...list].sort((x, y) => {
      const xs = timeToMinutes(x.startTime) ?? -1;
      const ys = timeToMinutes(y.startTime) ?? -1;
      return xs - ys || x.id.localeCompare(y.id);
    });
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i];
        const b = sorted[j];
        const aStart = timeToMinutes(a.startTime);
        const aEnd = timeToMinutes(a.endTime);
        const bStart = timeToMinutes(b.startTime);
        const bEnd = timeToMinutes(b.endTime);
        if (aStart == null || aEnd == null || bStart == null || bEnd == null) continue;
        if (aStart < bEnd && bStart < aEnd) {
          conflicts.push({ a: toSide(a), b: toSide(b) });
        }
      }
    }
  }
  return conflicts;
}
