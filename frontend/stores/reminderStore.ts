import { create } from "zustand";
import { persist } from "zustand/middleware";

export const REMINDER_OPTIONS = [15, 30, 60] as const;
export type ReminderLeadMinutes = (typeof REMINDER_OPTIONS)[number];

interface ReminderState {
  reminderLeadMinutes: number;
  setReminderLeadMinutes: (minutes: number) => void;
}

/**
 * Local cache of the reminder lead time. The source of truth is
 * GET/PUT /api/notifications/prefs — the settings page hydrates this store
 * when the server prefs arrive, and the dashboard keeps reading the same
 * `reminderLeadMinutes` selector in the meantime.
 */
export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      reminderLeadMinutes: 30,
      setReminderLeadMinutes: (minutes) => set({ reminderLeadMinutes: minutes }),
    }),
    { name: "scheduleai.reminder-lead" },
  ),
);
