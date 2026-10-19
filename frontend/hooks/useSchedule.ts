"use client";

import { useQuery } from "@tanstack/react-query";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";

/** A single schedule by id. */
export function useSchedule(scheduleId: string | null | undefined) {
  return useQuery({
    queryKey: [...scheduleKeys.all, "detail", scheduleId ?? "none"],
    queryFn: async () => (await scheduleApi.get(scheduleId as string)).schedule,
    enabled: Boolean(scheduleId),
    staleTime: 30 * 1000,
  });
}