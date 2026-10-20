import { prisma } from "../config/prisma.js";
import type { DayOfWeek as PrismaDayOfWeek } from "../generated/prisma/client.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { colorForSubject } from "../utils/colors.js";
import { computeConflicts, type Conflict } from "../utils/conflict.js";
import { formatIsoDate, isoDateToUtc, weekdayOfIsoDate } from "../utils/time.js";
import type { EntryBody, BulkEntryBody } from "../validators/entry.js";
import type { CreateScheduleInput, UpdateScheduleInput } from "../validators/schedule.js";

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
  // Academic-term window as "YYYY-MM-DD" (or null when open-ended).
  startDate: string | null;
  endDate: string | null;
  createdAt: Date;
  updatedAt: Date;
  entryCount: number;
}

// Event kind — class | work | personal | other. Anything unknown in the DB
// (legacy rows, hand-edited data) is coerced to "class" before it reaches a
// client so old consumers never see garbage.
export type EntryKind = "class" | "work" | "personal" | "other";

const ENTRY_KINDS: readonly string[] = ["class", "work", "personal", "other"];

function coerceKind(value: unknown): EntryKind {
  return typeof value === "string" && ENTRY_KINDS.includes(value)
    ? (value as EntryKind)
    : "class";
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
  // Event kind: class | work | personal | other (always present in responses).
  kind: EntryKind;
  // Recurring-class exceptions ("YYYY-MM-DD" days the class does NOT meet).
  exceptionDates: string[];
  // One-off events: `date` is the single calendar day ("YYYY-MM-DD") when
  // isOneOff is true, otherwise null (weekly recurrence via `day`).
  isOneOff: boolean;
  date: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const scheduleSelect = {
  id: true,
  name: true,
  userId: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { entries: true } },
} as const;

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
  kind: true,
  exceptionDates: true,
  isOneOff: true,
  date: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Prisma rows carry Date for `date`/`createdAt`/`updatedAt`; the public Entry
// keeps createdAt/updatedAt as Dates (JSON-serialized) but exposes the
// calendar day as "YYYY-MM-DD".
type ScheduleRow = Omit<ScheduleSummary, "startDate" | "endDate" | "entryCount"> & {
  startDate: Date | null;
  endDate: Date | null;
  _count: { entries: number };
};
// Prisma returns `kind` as a plain string — serializeEntry coerces it into the
// EntryKind union (unknown → "class").
type EntryRow = Omit<Entry, "date" | "kind"> & { date: Date | null; kind: string };

function serializeSchedule(row: ScheduleRow): ScheduleSummary {
  return {
    id: row.id,
    name: row.name,
    userId: row.userId,
    startDate: row.startDate ? formatIsoDate(row.startDate) : null,
    endDate: row.endDate ? formatIsoDate(row.endDate) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    entryCount: row._count.entries,
  };
}

function serializeEntry(row: EntryRow): Entry {
  return {
    ...row,
    // Defensive: unknown/null kind → "class" so clients never see garbage.
    kind: coerceKind(row.kind),
    date: row.date ? formatIsoDate(row.date) : null,
  };
}

/** Throws 404 unless the schedule exists AND belongs to userId. */
async function assertScheduleOwned(
  scheduleId: string,
  userId: string
): Promise<{ id: string; startDate: Date | null; endDate: Date | null }> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!schedule) throw new NotFoundError("Schedule not found.");
  return schedule;
}

export async function listSchedules(userId: string): Promise<ScheduleSummary[]> {
  const schedules = await prisma.schedule.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: scheduleSelect,
  });
  return schedules.map(serializeSchedule);
}

export async function createSchedule(
  userId: string,
  input: CreateScheduleInput
): Promise<ScheduleSummary> {
  const schedule = await prisma.schedule.create({
    data: {
      name: input.name.trim(),
      userId,
      // Absent → null (open-ended term).
      startDate: input.startDate ? isoDateToUtc(input.startDate) : null,
      endDate: input.endDate ? isoDateToUtc(input.endDate) : null,
    },
    select: scheduleSelect,
  });
  return serializeSchedule(schedule);
}

export async function getSchedule(scheduleId: string, userId: string): Promise<ScheduleSummary> {
  const schedule = await prisma.schedule.findFirst({
    where: { id: scheduleId, userId },
    select: scheduleSelect,
  });
  if (!schedule) throw new NotFoundError("Schedule not found.");
  return serializeSchedule(schedule);
}

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  input: UpdateScheduleInput
): Promise<ScheduleSummary> {
  const existing = await assertScheduleOwned(scheduleId, userId);

  // Absent field = keep current value; null = clear. Validate the MERGED
  // window so changing only one side can't leave endDate < startDate.
  const currentStart = existing.startDate ? formatIsoDate(existing.startDate) : null;
  const currentEnd = existing.endDate ? formatIsoDate(existing.endDate) : null;
  const nextStart = input.startDate !== undefined ? input.startDate : currentStart;
  const nextEnd = input.endDate !== undefined ? input.endDate : currentEnd;
  if (nextStart && nextEnd && nextEnd < nextStart) {
    throw new BadRequestError("End date must be on or after the start date.");
  }

  const schedule = await prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      name: input.name.trim(),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate === null ? null : isoDateToUtc(input.startDate) }
        : {}),
      ...(input.endDate !== undefined
        ? { endDate: input.endDate === null ? null : isoDateToUtc(input.endDate) }
        : {}),
    },
    select: scheduleSelect,
  });
  return serializeSchedule(schedule);
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
  return entries.map(serializeEntry);
}

export async function listEntries(scheduleId: string, userId: string): Promise<EntriesResult> {
  await assertScheduleOwned(scheduleId, userId);
  const entries = await loadEntries(scheduleId);
  return { entries, conflicts: computeConflicts(entries) };
}

/**
 * Prisma `data` for one entry row, shared by create/update/bulk. `day` is
 * passed in explicitly: for one-offs the caller derives it from `date` (UTC
 * weekday) so the calendar places the event correctly regardless of the
 * client-sent day.
 */
function entryDataFromBody(body: EntryBody | BulkEntryRow, day: PrismaDayOfWeek) {
  const isOneOff = body.isOneOff === true;
  return {
    subject: body.subject,
    day,
    startTime: body.startTime,
    endTime: body.endTime,
    instructor: body.instructor ?? null,
    room: body.room ?? null,
    notes: body.notes ?? null,
    // Client-provided color wins; otherwise deterministic per subject.
    color: body.color ?? colorForSubject(body.subject),
    // Missing kind → "class" (schema default; DB default matches).
    kind: body.kind ?? "class",
    exceptionDates: body.exceptionDates ?? [],
    isOneOff,
    // One-offs store their single calendar day; weekly entries store null.
    date: isOneOff && body.date ? isoDateToUtc(body.date) : null,
  };
}

/** The weekday an entry should occupy: `date`'s UTC weekday for one-offs. */
function dayForBody(body: EntryBody | BulkEntryRow): PrismaDayOfWeek {
  if (body.isOneOff === true && body.date) return weekdayOfIsoDate(body.date) as PrismaDayOfWeek;
  return ("day" in body ? body.day : body.days[0]) as PrismaDayOfWeek;
}

export async function createEntry(
  scheduleId: string,
  userId: string,
  body: EntryBody
): Promise<{ entry: Entry; conflicts: Conflict[] }> {
  await assertScheduleOwned(scheduleId, userId);
  const entry = await prisma.scheduleEntry.create({
    data: { scheduleId, ...entryDataFromBody(body, dayForBody(body)) },
    select: entrySelect,
  });
  const entries = await loadEntries(scheduleId);
  return { entry: serializeEntry(entry as EntryRow), conflicts: computeConflicts(entries) };
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
    data: entryDataFromBody(body, dayForBody(body)),
    select: entrySelect,
  });
  const entries = await loadEntries(scheduleId);
  return { entry: serializeEntry(entry as EntryRow), conflicts: computeConflicts(entries) };
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

type BulkEntryRow = BulkEntryBody["entries"][number];

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
 * One-off items collapse to a single entry on the weekday of their `date`.
 */
export async function bulkCreateEntries(
  scheduleId: string,
  userId: string,
  bulkEntries: BulkEntryBody["entries"]
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
    kind: string;
    exceptionDates: string[];
    isOneOff: boolean;
    date: Date | null;
  }
  const toCreate: Candidate[] = [];
  let skipped = 0;

  for (const item of bulkEntries) {
    // One-offs ignore the client's days[] — a single event on their `date`.
    const days = item.isOneOff && item.date ? [weekdayOfIsoDate(item.date)] : [...item.days];
    for (const day of days) {
      const data = entryDataFromBody(item, day as PrismaDayOfWeek);
      const candidate: Candidate = { ...data };
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
