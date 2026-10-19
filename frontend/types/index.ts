/**
 * Domain types — these mirror the backend API contract exactly.
 * Do not rename or reshape fields here without changing the backend too.
 */

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
}

export type UploadStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface Upload {
  id: string;
  status: UploadStatus;
  imageUrl: string;
  fileName: string;
  fileSize: number;
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
}

/** Envelope returned by every backend endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
}