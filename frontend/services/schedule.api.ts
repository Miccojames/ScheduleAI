import { api, ApiError } from "@/services/api";
import type { BulkEntry, Conflict, Entry, EntryPayload, Schedule } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/** Optional academic-term window ("YYYY-MM-DD"; null/absent clears it). */
export interface ScheduleTerm {
  startDate?: string | null;
  endDate?: string | null;
}

export interface EntriesResponse {
  entries: Entry[];
  conflicts: Conflict[];
}

export interface EntryResponse {
  entry: Entry;
  conflicts: Conflict[];
}

export interface BulkEntriesResponse {
  saved: number;
  skipped: number;
  entries: Entry[];
  conflicts: Conflict[];
}

export const scheduleKeys = {
  all: ["schedules"] as const,
  list: () => [...scheduleKeys.all, "list"] as const,
  entries: (scheduleId: string) => [...scheduleKeys.all, "entries", scheduleId] as const,
};

export const scheduleApi = {
  list() {
    return api<{ schedules: Schedule[] }>("/api/schedules");
  },

  create(name: string, term: ScheduleTerm = {}) {
    return api<{ schedule: Schedule }>("/api/schedules", {
      method: "POST",
      body: { name, startDate: term.startDate ?? null, endDate: term.endDate ?? null },
    });
  },

  get(scheduleId: string) {
    return api<{ schedule: Schedule }>(`/api/schedules/${scheduleId}`);
  },

  rename(scheduleId: string, name: string, term: ScheduleTerm = {}) {
    return api<{ schedule: Schedule }>(`/api/schedules/${scheduleId}`, {
      method: "PUT",
      body: { name, startDate: term.startDate ?? null, endDate: term.endDate ?? null },
    });
  },

  /**
   * RFC 5545 export — returns raw `text/calendar` (NOT the JSON envelope),
   * so it bypasses the shared api() helper and fetches with credentials.
   */
  async fetchIcs(scheduleId: string): Promise<string> {
    const response = await fetch(`${BASE}/api/schedules/${scheduleId}/ics`, {
      credentials: "include",
    });
    if (response.status === 401) {
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    if (response.status === 404) {
      throw new ApiError(404, "Schedule not found.");
    }
    if (!response.ok) {
      throw new ApiError(response.status, "We couldn't export this schedule. Please try again.");
    }
    return response.text();
  },

  remove(scheduleId: string) {
    return api<Record<string, never>>(`/api/schedules/${scheduleId}`, { method: "DELETE" });
  },

  entries(scheduleId: string) {
    return api<EntriesResponse>(`/api/schedules/${scheduleId}/entries`);
  },

  createEntry(scheduleId: string, payload: EntryPayload) {
    return api<EntryResponse>(`/api/schedules/${scheduleId}/entries`, {
      method: "POST",
      body: payload,
    });
  },

  updateEntry(scheduleId: string, entryId: string, payload: EntryPayload) {
    return api<EntryResponse>(`/api/schedules/${scheduleId}/entries/${entryId}`, {
      method: "PUT",
      body: payload,
    });
  },

  deleteEntry(scheduleId: string, entryId: string) {
    return api<Record<string, never>>(`/api/schedules/${scheduleId}/entries/${entryId}`, {
      method: "DELETE",
    });
  },

  bulkCreateEntries(scheduleId: string, entries: BulkEntry[]) {
    return api<BulkEntriesResponse>(`/api/schedules/${scheduleId}/entries/bulk`, {
      method: "POST",
      body: { entries },
    });
  },
};