import { prisma } from "../config/prisma.js";
import type { DayOfWeek as PrismaDayOfWeek } from "../generated/prisma/client.js";
import { NotFoundError } from "../utils/errors.js";
import { colorForSubject } from "../utils/colors.js";
import { computeConflicts, type Conflict } from "../utils/conflict.js";
import type { EntryBody } from "../validators/entry.js";

// ============================================================================
// SCOPING RULE (very important, applied everywhere below):
// every schedule/entry query is filtered by BOTH the resource id AND the
// requesting user's id. Another user's resource therefore behaves exactly
// like a missing one (404) — no existence leak.
// ============================================================================

export interface ScheduleSummary {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  entryCount: number;
}

export interface Entry {
  id: string;
  scheduleId: string;
  subject: string;
  instructor: string | null;
  room: string | null;
  day: string;
  startTime: string;
  endTime: string;
  color: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const entrySelect = {
  id: true,
  scheduleId: true,
  subject: true,
  instructor: true,
  room: true,
  day: true,
  startTime: true,
  endTime: true,
  color: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Throws 404 unless the schedule exists AND belongs to userId. */
async function assertScheduleOwned(scheduleId: string, userId: string): Promise<void> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: { id: true },
  });
  if (!schedule) throw new NotFoundError("Schedule not found.");
}

export async function listSchedules(userId: string): Promise<ScheduleSummary[]> {
  const schedules = await prisma.schedule.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      // Aggregate entry count in one query (no N+1).
      _count: { select: { entries: true } },
    },
  });
  return schedules.map((s) => ({
    id: s.id,
    name: s.name,
    userId: s.userId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    entryCount: s._count.entries,
  }));
}

export async function createSchedule(userId: string, name: string): Promise<ScheduleSummary> {
  const schedule = await prisma.schedule.create({
    data: { name: name.trim(), userId },
  });
  return { ...schedule, entryCount: 0 };
}

export async function getSchedule(scheduleId: string, userId: string): Promise<ScheduleSummary> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });
  if (!schedule) throw new NotFoundError("Schedule not found.");
  return {
    id: schedule.id,
    name: schedule.name,
    userId: schedule.userId,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    entryCount: schedule._count.entries,
  };
}

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  name: string
): Promise<ScheduleSummary> {
  await assertScheduleOwned(scheduleId, userId);
  const schedule = await prisma.schedule.update({
    where: { id: scheduleId },
    data: { name: name.trim() },
    select: {
      id: true,
      name: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { entries: true } },
    },
  });
  return {
    id: schedule.id,
    name: schedule.name,
    userId: schedule.userId,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    entryCount: schedule._count.entries,
  };
}

export async function deleteSchedule(scheduleId: string, userId: string): Promise<void> {
  // Entries cascade in the DB; uploads keep their image file but scheduleId
  // becomes null (SetNull on the relation).
  await assertScheduleOwned(scheduleId, userId);
  await prisma.schedule.delete({ where: { id: scheduleId } });
}

// ----------------------------------------------------------------------------
// Entries
// ----------------------------------------------------------------------------

export interface EntriesResult {
  entries: Entry[];
  conflicts: Conflict[];
}

async function loadEntries(scheduleId: string): Promise<Entry[]> {
  const entries = await prisma.scheduleEntry.findMany({
    where: { scheduleId },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    select: entrySelect,
  });
  return entries as Entry[];
}

export async function listEntries(scheduleId: string, userId: string): Promise<EntriesResult> {
  await assertScheduleOwned(scheduleId, userId);
  const entries = await loadEntries(scheduleId);
  return { entries, conflicts: computeConflicts(entries) };
}

export async function createEntry(
  scheduleId: string,
  userId: string,
  body: EntryBody
): Promise<{ entry: Entry; conflicts: Conflict[] }> {
  await assertScheduleOwned(scheduleId, userId);
  const entry = await prisma.scheduleEntry.create({
    data: {
      scheduleId,
      subject: body.subject,
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      instructor: body.instructor ?? null,
      room: body.room ?? null,
      notes: body.notes ?? null,
      // Client-provided color wins; otherwise deterministic per subject.
      color: body.color ?? colorForSubject(body.subject),
    },
    select: entrySelect,
  });
  const entries = await loadEntries(scheduleId);
  return { entry: entry as Entry, conflicts: computeConflicts(entries) };
}

export async function updateEntry(
  scheduleId: string,
  entryId: string,
  userId: string,
  body: EntryBody
): Promise<{ entry: Entry; conflicts: Conflict[] }> {
  await assertScheduleOwned(scheduleId, userId);
  // Scope the update by BOTH ids so a foreign entryId 404s.
  const existing = await prisma.scheduleEntry.findFirst({
    where: { id: entryId, scheduleId, schedule: { userId } },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Entry not found.");

  const entry = await prisma.scheduleEntry.update({
    where: { id: entryId },
    data: {
      subject: body.subject,
      day: body.day,
      startTime: body.startTime,
      endTime: body.endTime,
      instructor: body.instructor ?? null,
      room: body.room ?? null,
      notes: body.notes ?? null,
      color: body.color ?? colorForSubject(body.subject),
    },
    select: entrySelect,
  });
  const entries = await loadEntries(scheduleId);
  return { entry: entry as Entry, conflicts: computeConflicts(entries) };
}

export async function deleteEntry(
  scheduleId: string,
  entryId: string,
  userId: string
): Promise<void> {
  await assertScheduleOwned(scheduleId, userId);
  const existing = await prisma.scheduleEntry.findFirst({
    where: { id: entryId, scheduleId, schedule: { userId } },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError("Entry not found.");
  await prisma.scheduleEntry.delete({ where: { id: entryId } });
}

// ----------------------------------------------------------------------------
// Bulk import
// ----------------------------------------------------------------------------

export interface BulkEntry {
  subject: string;
  days: string[];
  startTime: string;
  endTime: string;
  instructor?: string | null;
  room?: string | null;
  notes?: string | null;
  color?: string;
}

export interface BulkResult {
  saved: number;
  skipped: number;
  entries: Entry[];
  conflicts: Conflict[];
}

/** Normalized identity of an entry — used to detect exact duplicates. */
function entryKey(e: {
  subject: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string | null;
}): string {
  return [
    e.subject.trim().toLowerCase().replace(/\s+/g, " "),
    e.day,
    e.startTime,
    e.endTime,
    (e.room ?? "").trim().toLowerCase(),
  ].join("|");
}

/**
 * Expand days[] into one Entry per day inside a SINGLE transaction.
 * Exact duplicates (same normalized subject+day+start+end+room) already in the
 * schedule — or duplicated within the request — are skipped, not error'd.
 */
export async function bulkCreateEntries(
  scheduleId: string,
  userId: string,
  bulkEntries: BulkEntry[]
): Promise<BulkResult> {
  await assertScheduleOwned(scheduleId, userId);

  // Existing keys in this schedule → skip anything that matches.
  const existing = await prisma.scheduleEntry.findMany({
    where: { scheduleId },
    select: { subject: true, day: true, startTime: true, endTime: true, room: true },
  });
  const seen = new Set(existing.map(entryKey));

  interface Candidate {
    subject: string;
    day: PrismaDayOfWeek;
    startTime: string;
    endTime: string;
    instructor: string | null;
    room: string | null;
    notes: string | null;
    color: string;
  }
  const toCreate: Candidate[] = [];
  let skipped = 0;

  for (const item of bulkEntries) {
    for (const day of item.days) {
      const candidate: Candidate = {
        subject: item.subject,
        // Zod already validated day as one of the seven DayOfWeek values.
        day: day as PrismaDayOfWeek,
        startTime: item.startTime,
        endTime: item.endTime,
        instructor: item.instructor ?? null,
        room: item.room ?? null,
        notes: item.notes ?? null,
        color: item.color ?? colorForSubject(item.subject),
      };
      const key = entryKey(candidate);
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key); // also dedupe within the same request
      toCreate.push(candidate);
    }
  }

  if (toCreate.length > 0) {
    await prisma.$transaction(
      toCreate.map((data) => prisma.scheduleEntry.create({ data: { ...data, scheduleId } }))
    );
  }

  const entries = await loadEntries(scheduleId);
  return { saved: toCreate.length, skipped, entries, conflicts: computeConflicts(entries) };
}
