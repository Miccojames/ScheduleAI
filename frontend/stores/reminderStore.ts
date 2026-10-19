import { create } from "zustand";
import { persist } from "zustand/middleware";

export const REMINDER_OPTIONS = [15, 30, 60] as const;
export type ReminderLeadMinutes = (typeof REMINDER_OPTIONS)[number];

interface ReminderState {
  reminderLeadMinutes: number;
  setReminderLeadMinutes: (minutes: number) => void;
}

/** How early the dashboard starts warning about an upcoming class. */
export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      reminderLeadMinutes: 30,
      setReminderLeadMinutes: (minutes) => set({ reminderLeadMinutes: minutes }),
    }),
    { name: "scheduleai.reminder-lead" },
  ),
);