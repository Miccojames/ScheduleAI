"use client";

import { useQuery } from "@tanstack/react-query";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import type { Entry } from "@/types";

/** Entries + conflicts of a single schedule. Disabled while no id is given. */
export function useEntries(scheduleId: string | null | undefined) {
  return useQuery({
    queryKey: scheduleKeys.entries(scheduleId ?? "none"),
    queryFn: () => scheduleApi.entries(scheduleId as string),
    enabled: Boolean(scheduleId),
    staleTime: 30 * 1000,
  });
}

/** Same query, with the data already unwrapped for components. */
export function useScheduleEntries(scheduleId: string | null | undefined) {
  const query = useEntries(scheduleId);
  return {
    ...query,
    entries: query.data?.entries ?? ([] as Entry[]),
    conflicts: query.data?.conflicts ?? [],
  };
}