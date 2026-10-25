/**
 * Domain types — these mirror the backend API contract exactly.
 * Do not rename or reshape fields here without changing the backend too.
 */

import type { EntryKind } from "@/lib/kind";

export const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  createdAt: string;
}

export interface Schedule {
  id: string;
  name: string;
  userId: string;
  /** Academic-term window, "YYYY-MM-DD", or null when open-ended. */
  startDate: string | null;
  /** Academic-term window, "YYYY-MM-DD", or null when open-ended. */
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  entryCount: number;
}

export interface Entry {
  id: string;
  scheduleId: string;
  subject: string;
  instructor: string | null;
  room: string | null;
  day: DayOfWeek;
  /** 24h clock, "HH:MM" */
  startTime: string;
  /** 24h clock, "HH:MM" */
  endTime: string;
  /** hex color, matches the backend class-block palette */
  color: string;
  notes: string | null;
  /** ISO dates ("YYYY-MM-DD") this recurring class does NOT meet. */
  exceptionDates: string[];
  /** One-off events (exams, deadlines) happen once on `date`, not weekly. */
  isOneOff: boolean;
  /** The single calendar day for one-off events; null for weekly classes. */
  date: string | null;
  /** What kind of event this is; absent in older responses → treat as "class". */
  kind?: EntryKind;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictSide {
  id: string;
  subject: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Conflict {
  a: ConflictSide;
  b: ConflictSide;
}

export const UNCERTAIN_FIELDS = [
  "subject",
  "days",
  "startTime",
  "endTime",
  "room",
  "instructor",
] as const;

export type UncertainField = (typeof UNCERTAIN_FIELDS)[number];

export interface DetectedEntry {
  subject: string;
  instructor: string | null;
  room: string | null;
  days: DayOfWeek[];
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  uncertainFields: UncertainField[];
  /**
   * Optional per-field AI confidence (0..1). Keys: subject, day, startTime,
   * endTime, instructor, room. Values below 0.75 are treated as uncertain.
   */
  confidence?: Record<string, number>;
}

export type UploadStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Upload {
  id: string;
  status: UploadStatus;
  imageUrl: string;
  fileName: string;
  fileSize: number;
}

/** A row from the upload history list (GET /api/schedule-upload). */
export interface UploadRecord {
  id: string;
  fileName: string;
  fileSize: number;
  processingStatus: UploadStatus;
  error: string | null;
  scheduleId: string | null;
  createdAt: string;
}

export interface BulkEntry {
  subject: string;
  days: DayOfWeek[];
  startTime: string;
  endTime: string;
  instructor?: string;
  room?: string;
  notes?: string;
  color?: string;
  exceptionDates?: string[];
  isOneOff?: boolean;
  date?: string;
  kind?: EntryKind;
}

export interface EntryPayload {
  subject: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  instructor?: string;
  room?: string;
  notes?: string;
  color?: string;
  exceptionDates?: string[];
  isOneOff?: boolean;
  date?: string;
  kind?: EntryKind;
}

/** Envelope returned by every backend endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
  /** Machine-readable error discriminator (e.g. "email_not_verified"). */
  code?: string;
}