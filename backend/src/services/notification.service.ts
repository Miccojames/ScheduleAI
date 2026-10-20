// Notification preferences + the reminder sweep (the core background job).
import { prisma } from "../config/prisma.js";
import type { DayOfWeek, ScheduleEntry } from "../generated/prisma/client.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { isValidTime } from "../utils/time.js";
import { isConfigured, sendToSubscription } from "./push.service.js";

// ============================================================================
// Subscription management
// ============================================================================

export interface SubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export interface UpdatePrefsInput {
  reminderLeadMinutes?: number;
  timezone?: string;
  notificationsEnabled?: boolean;
}

export interface NotificationPrefs {
  reminderLeadMinutes: number;
  notificationsEnabled: boolean;
  timezone: string | null;
  vapidConfigured: boolean;
}

/** Every browser this user subscribed (for the test-notification action). */
export async function listSubscriptions(
  userId: string,
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  return prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}

/**
 * Fire a one-off "reminders are working" push. It never touches
 * NotificationLog — a test must not consume one of the user's real reminder
 * slots for the day.
 */
export async function sendTestPush(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<boolean> {
  return sendToSubscription(subscription, {
    title: "ScheduleAI reminders are on",
    body: "This is a test notification — you'll get one before each of your classes.",
    data: { entryId: "test", subject: "Test notification" },
  });
}

/**
 * Upsert on `endpoint` (endpoint is globally unique). If the endpoint already
 * belongs to another user it is re-owned — it is literally the same browser,
 * so whoever is logged in now is the owner.
 */
export async function upsertSubscription(
  userId: string,
  body: SubscribeInput
): Promise<{ id: string; endpoint: string }> {
  const { endpoint, keys, userAgent } = body ?? ({} as SubscribeInput);
  if (!keys?.p256dh?.trim() || !keys?.auth?.trim()) {
    throw new BadRequestError("Subscription keys are required.", {
      keys: ["keys.p256dh and keys.auth are required."],
    });
  }

  const subscription = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      endpoint,
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent?.trim() ? userAgent.trim() : null,
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent?.trim() ? userAgent.trim() : null,
    },
  });

  // Subscribing implies the opt-in — otherwise the sweep would ignore the row.
  await prisma.user.update({
    where: { id: userId },
    data: { notificationsEnabled: true },
  });

  return { id: subscription.id, endpoint: subscription.endpoint };
}

/** Remove one endpoint; turn the opt-in off when no subscriptions remain. */
export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });

  const remaining = await prisma.pushSubscription.count({ where: { userId } });
  if (remaining === 0) {
    await prisma.user.update({ where: { id: userId }, data: { notificationsEnabled: false } });
  }
}

// ============================================================================
// Preferences
// ============================================================================

export async function getPrefs(userId: string): Promise<NotificationPrefs> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { reminderLeadMinutes: true, notificationsEnabled: true, timezone: true },
  });
  if (!user) throw new NotFoundError("User not found.");

  return {
    reminderLeadMinutes: user.reminderLeadMinutes,
    notificationsEnabled: user.notificationsEnabled,
    timezone: user.timezone,
    vapidConfigured: isConfigured(),
  };
}

export async function updatePrefs(
  userId: string,
  input: UpdatePrefsInput
): Promise<NotificationPrefs> {
  const data: { reminderLeadMinutes?: number; timezone?: string | null; notificationsEnabled?: boolean } = {};

  if (input.reminderLeadMinutes !== undefined) {
    // Clamp even though Zod already bounds it — the service is the last line.
    const lead = Math.round(input.reminderLeadMinutes);
    data.reminderLeadMinutes = Math.min(120, Math.max(1, lead));
  }
  if (input.timezone !== undefined) {
    const tz = input.timezone.trim();
    data.timezone = tz.length > 0 ? tz : null;
  }
  if (input.notificationsEnabled !== undefined) {
    data.notificationsEnabled = input.notificationsEnabled;
  }

  await prisma.user.update({ where: { id: userId }, data });
  return getPrefs(userId);
}

// ============================================================================
// Timezone helpers (Intl — no tz database in Node beyond ICU)
// ============================================================================

interface LocalParts {
  year: number;
  month: number;
  day: number;
  /** "MONDAY" .. "SUNDAY" */
  weekday: DayOfWeek;
  /** Local calendar day, "YYYY-MM-DD" */
  isoDate: string;
}

const WEEKDAY_BY_SHORT: Record<string, DayOfWeek> = {
  MON: "MONDAY",
  TUE: "TUESDAY",
  WED: "WEDNESDAY",
  THU: "THURSDAY",
  FRI: "FRIDAY",
  SAT: "SATURDAY",
  SUN: "SUNDAY",
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timeZone);
  if (!fmt) {
    // hourCycle h23 (not hour12:false) — some ICU versions render midnight as 24.
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatterCache.set(timeZone, fmt);
  }
  return fmt;
}

function partsAsObject(date: Date, timeZone: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) {
    if (part.type !== "literal") out[part.type] = part.value;
  }
  return out;
}

/** `date` expressed on the wall clock of `timeZone`. Throws on a bad zone. */
function localParts(date: Date, timeZone: string): LocalParts {
  const p = partsAsObject(date, timeZone);
  const weekday = WEEKDAY_BY_SHORT[p.weekday?.slice(0, 3).toUpperCase() ?? ""];
  if (!weekday) throw new Error(`Unable to determine local weekday for "${timeZone}".`);
  const year = Number(p.year);
  const month = Number(p.month);
  const day = Number(p.day);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    throw new Error(`Unable to determine local date for "${timeZone}".`);
  }
  return {
    year,
    month,
    day,
    weekday,
    isoDate: `${p.year}-${p.month}-${p.day}`,
  };
}

/** UTC instant of `date` rendered in `timeZone` as "YYYY-MM-DD". */
function isoDateInTz(date: Date, timeZone: string): string {
  return localParts(date, timeZone).isoDate;
}

/** Offset (local − UTC) in ms at the given instant. */
function timeZoneOffsetMs(utcDate: Date, timeZone: string): number {
  const p = partsAsObject(utcDate, timeZone);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second)
  );
  return asUtc - Math.floor(utcDate.getTime() / 1000) * 1000;
}

/**
 * Wall-clock time (year..minute) in `timeZone` → the UTC instant it represents.
 * Two passes so DST transitions converge instead of being an hour off.
 */
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const first = target - timeZoneOffsetMs(new Date(target), timeZone);
  const second = target - timeZoneOffsetMs(new Date(first), timeZone);
  return new Date(second);
}

// ============================================================================
// The reminder sweep
// ============================================================================

function loadSweepUsers() {
  return prisma.user.findMany({
    where: {
      notificationsEnabled: true,
      pushSubscriptions: { some: {} },
    },
    include: {
      pushSubscriptions: true,
      schedules: { include: { entries: true } },
    },
  });
}

type SweepUser = Awaited<ReturnType<typeof loadSweepUsers>>[number];

interface ReminderCandidate {
  entry: ScheduleEntry;
  minutesUntil: number;
}

/**
 * One tick of the reminder job. Users are processed independently: a failure
 * (bad timezone, broken rows, …) is logged and never aborts the sweep, and the
 * whole function swallows errors so the interval callback can't crash the
 * process.
 */
export async function runReminderSweep(now: Date = new Date()): Promise<void> {
  if (!isConfigured()) {
    // Don't stamp NotificationLog rows we can't deliver — otherwise enabling
    // push later would skip reminders already "claimed" by silent ticks.
    return;
  }

  let users: SweepUser[];
  try {
    users = await loadSweepUsers();
  } catch (err) {
    console.warn("[reminders] sweep failed to load users:", err);
    return;
  }

  for (const user of users) {
    try {
      await sweepUser(user, now);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[reminders] sweep failed for user ${user.id}: ${message}`);
    }
  }
}

async function sweepUser(user: SweepUser, now: Date): Promise<void> {
  if (!user.timezone) {
    console.log(`[reminders] skipping user ${user.id}: no timezone set.`);
    return;
  }

  // Throws on an invalid IANA zone → caught by the per-user wrapper above.
  const local = localParts(now, user.timezone);

  // All entries of all of the user's schedules (reminders from more than one
  // schedule are fine — candidates are deduped by entry id below).
  const entries = user.schedules.flatMap((schedule) => schedule.entries);
  const seen = new Set<string>();
  const candidates: ReminderCandidate[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);

    if (entry.isOneOff) {
      // One-off (exam/deadline): fires only when its stored date falls on the
      // user's current local calendar day.
      if (!entry.date) continue;
      if (isoDateInTz(entry.date, user.timezone) !== local.isoDate) continue;
    } else {
      // Weekly: today's weekday + no cancellation logged for today.
      if (entry.day !== local.weekday) continue;
      if (entry.exceptionDates.includes(local.isoDate)) continue;
    }

    if (!isValidTime(entry.startTime)) continue;
    const [hour, minute] = entry.startTime.split(":").map(Number);
    const occurrence = localToUtc(local.year, local.month, local.day, hour, minute, user.timezone);

    const minutesUntil = (occurrence.getTime() - now.getTime()) / 60_000;
    if (minutesUntil < 0 || minutesUntil > user.reminderLeadMinutes) continue;

    candidates.push({ entry, minutesUntil });
  }

  for (const { entry, minutesUntil } of candidates) {
    // Claim the (user, entry, local day) slot first so a concurrent/next tick
    // can't double-notify. P2002 → already reminded today.
    try {
      await prisma.notificationLog.create({
        data: { userId: user.id, entryId: entry.id, fireDate: local.isoDate },
      });
    } catch (err) {
      if ((err as { code?: string }).code === "P2002") continue;
      // Unknown failure: skip the send too — retrying next tick would risk a
      // duplicate notification once the log write succeeds.
      console.warn(`[reminders] could not log reminder for entry ${entry.id}:`, err);
      continue;
    }

    const payload = {
      title: `${entry.subject} starts soon`,
      body:
        `Starts in ~${Math.round(minutesUntil)} min` +
        `${entry.room ? ` · ${entry.room}` : ""}` +
        `${entry.instructor ? ` · ${entry.instructor}` : ""}`,
      data: { entryId: entry.id, subject: entry.subject },
    };

    for (const sub of user.pushSubscriptions) {
      await sendToSubscription(sub, payload);
    }
  }
}
