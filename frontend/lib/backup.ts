import { z } from "zod";
import { ENTRY_KINDS } from "@/lib/kind";
import { DAYS_OF_WEEK } from "@/types";
import type { Entry, Schedule } from "@/types";
import type { EntryKind } from "@/lib/kind";

/**
 * JSON backup: a portable snapshot of every schedule + its entries.
 * The import side validates with zod and reports per-item failures —
 * nothing is skipped silently.
 */

export interface BackupEntry {
  subject: string;
  day: (typeof DAYS_OF_WEEK)[number];
  startTime: string;
  endTime: string;
  instructor?: string | null;
  room?: string | null;
  notes?: string | null;
  color?: string;
  exceptionDates?: string[];
  isOneOff?: boolean;
  date?: string | null;
  /** Optional so backups from before event kinds stay importable. */
  kind?: EntryKind;
}

export interface BackupSchedule {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  entries: BackupEntry[];
}

export interface BackupFile {
  exportedAt: string;
  app: "ScheduleAI";
  schedules: BackupSchedule[];
}

const backupEntrySchema = z.object({
  subject: z.string().min(1),
  day: z.enum(DAYS_OF_WEEK),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  instructor: z.string().nullish(),
  room: z.string().nullish(),
  notes: z.string().nullish(),
  color: z.string().optional(),
  exceptionDates: z.array(z.iso.date()).optional(),
  isOneOff: z.boolean().optional(),
  date: z.iso.date().nullish(),
  // Optional: absent in backups written before event kinds existed.
  kind: z.enum(ENTRY_KINDS).optional(),
});

const backupScheduleSchema = z.object({
  name: z.string().min(1),
  startDate: z.iso.date().nullish(),
  endDate: z.iso.date().nullish(),
  entries: z.array(backupEntrySchema),
});

const backupFileSchema = z.object({
  exportedAt: z.string(),
  app: z.literal("ScheduleAI"),
  schedules: z.array(backupScheduleSchema),
});

/** Snapshot of the given schedules + their entries. */
export function buildBackup(schedules: Schedule[], entriesByScheduleId: Record<string, Entry[]>): BackupFile {
  return {
    exportedAt: new Date().toISOString(),
    app: "ScheduleAI",
    schedules: schedules.map((schedule) => ({
      name: schedule.name,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      entries: (entriesByScheduleId[schedule.id] ?? []).map((entry) => ({
        subject: entry.subject,
        day: entry.day,
        startTime: entry.startTime,
        endTime: entry.endTime,
        instructor: entry.instructor,
        room: entry.room,
        notes: entry.notes,
        color: entry.color,
        exceptionDates: entry.exceptionDates,
        isOneOff: entry.isOneOff,
        date: entry.date,
        // Undefined kinds are dropped by JSON.stringify — matching the
        // "missing → class" default on the import side.
        kind: entry.kind,
      })),
    })),
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Parse + validate a backup file. Throws an Error with a friendly message. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Choose a ScheduleAI backup file.");
  }
  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    throw new Error("That file doesn't look like a ScheduleAI backup. Nothing was imported.");
  }
  return result.data as BackupFile;
}

/** Trigger a browser download of the given JSON contents. */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** "scheduleai-backup-2026-10-19.json" */
export function backupFilename(now: Date = new Date()): string {
  const iso = now.toISOString().slice(0, 10);
  return `scheduleai-backup-${iso}.json`;
}
