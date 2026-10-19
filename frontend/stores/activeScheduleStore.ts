import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ActiveScheduleState {
  activeScheduleId: string | null;
  setActiveScheduleId: (id: string | null) => void;
}

/** Which schedule the app is currently showing. Persisted in localStorage. */
export const useActiveScheduleStore = create<ActiveScheduleState>()(
  persist(
    (set) => ({
      activeScheduleId: null,
      setActiveScheduleId: (id) => set({ activeScheduleId: id }),
    }),
    { name: "scheduleai.active-schedule" },
  ),
);