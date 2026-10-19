import { DAYS_OF_WEEK, type DayOfWeek } from "@/types";

/**
 * Class-block palette — kept byte-identical to the backend palette so the
 * colors the API assigns match the frontend defaults.
 */
export const CLASS_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#06B6D4",
  "#3B82F6",
  "#EF4444",
] as const;

export function colorForIndex(index: number): string {
  return CLASS_COLORS[((index % CLASS_COLORS.length) + CLASS_COLORS.length) % CLASS_COLORS.length];
}

/** Monday-first ordering used everywhere the week is laid out. */
export const DAY_ORDER: DayOfWeek[] = [...DAYS_OF_WEEK];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

export const DAY_SHORT_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

export function dayLabel(day: DayOfWeek): string {
  return DAY_LABELS[day];
}

export function shortLabel(day: DayOfWeek): string {
  return DAY_SHORT_LABELS[day];
}

export function dayOrder(day: DayOfWeek): number {
  return DAY_ORDER.indexOf(day);
}

/** Sunday-first map, so it can be used directly with Date#getDay. */
const DATE_INDEX_TO_DAY: Record<number, DayOfWeek> = {
  0: "SUNDAY",
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export function dayOfWeekForDate(date: Date): DayOfWeek {
  return DATE_INDEX_TO_DAY[date.getDay()];
}

export function todayDayOfWeek(now: Date = new Date()): DayOfWeek {
  return dayOfWeekForDate(now);
}

/** "08:00" → 480 */
export function toMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** 480 → "08:00" */
export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "08:00" → "8:00 AM" */
export function formatTime(time: string): string {
  const [rawHours = "0", rawMinutes = "00"] = time.split(":");
  const hours = Number(rawHours);
  if (Number.isNaN(hours)) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hours12}:${rawMinutes} ${period}`;
}

/** "08:00" – "09:30" → "8:00 AM – 9:30 AM" */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`;
}

/** "Mon, Mar 3" style label for a date. */
export function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...options,
  }).format(date);
}

/**
 * Minutes from `now` until the given "HH:MM" wall-clock time on the same day.
 * Negative when the time has already passed.
 */
export function minutesUntil(now: Date, time: string): number {
  const target = new Date(now);
  target.setHours(0, 0, 0, 0);
  target.setMinutes(toMinutes(time));
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

/** A Date for the next occurrence of a weekday + time (used for countdowns). */
export function nextOccurrence(day: DayOfWeek, time: string, from: Date = new Date()): Date {
  const target = new Date(from);
  target.setHours(0, 0, 0, 0);
  const daysAhead = (dayOrder(day) - from.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysAhead);
  target.setMinutes(toMinutes(time));
  return target;
}

/** Human friendly countdown, e.g. "in 34 min" / "now". */
export function formatCountdown(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return remainder === 0 ? `in ${hours} hr` : `in ${hours} hr ${remainder} min`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

/** Time-of-day greeting, e.g. "Good morning, Juan 👋". */
export function greeting(firstName: string, now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return `Good morning, ${firstName} 👋`;
  if (hour < 18) return `Good afternoon, ${firstName} 👋`;
  return `Good evening, ${firstName} 👋`;
}

/** "Sat, Mar 3" — used as the heading of upcoming-class groups. */
export function formatDayHeading(day: DayOfWeek, from: Date = new Date()): string {
  const daysAhead = (dayOrder(day) - from.getDay() + 7) % 7;
  const date = new Date(from);
  date.setDate(date.getDate() + daysAhead);
  const prefix = daysAhead === 0 ? "Today" : daysAhead === 1 ? "Tomorrow" : DAY_LABELS[day];
  return `${prefix} · ${formatDate(date)}`;
}