import { api } from "@/services/api";
import type { BulkEntry, Conflict, Entry, EntryPayload, Schedule } from "@/types";

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

  create(name: string) {
    return api<{ schedule: Schedule }>("/api/schedules", { method: "POST", body: { name } });
  },

  get(scheduleId: string) {
    return api<{ schedule: Schedule }>(`/api/schedules/${scheduleId}`);
  },

  rename(scheduleId: string, name: string) {
    return api<{ schedule: Schedule }>(`/api/schedules/${scheduleId}`, {
      method: "PUT",
      body: { name },
    });
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