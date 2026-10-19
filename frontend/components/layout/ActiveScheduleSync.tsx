"use client";

import { useEffect } from "react";
import { useActiveSchedule } from "@/hooks/useSchedules";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";

/**
 * Keeps the persisted "active schedule" pointer in step with what the API
 * returns, so a deleted or newly created schedule never leaves the app
 * pointing at a schedule that no longer exists.
 */
export function ActiveScheduleSync() {
  const { active } = useActiveSchedule();
  const activeScheduleId = useActiveScheduleStore((state) => state.activeScheduleId);
  const setActiveScheduleId = useActiveScheduleStore((state) => state.setActiveScheduleId);

  useEffect(() => {
    if (active && active.id !== activeScheduleId) setActiveScheduleId(active.id);
  }, [active, activeScheduleId, setActiveScheduleId]);

  return null;
}