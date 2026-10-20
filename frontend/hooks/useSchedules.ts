"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys, type ScheduleTerm } from "@/services/schedule.api";
import { useActiveScheduleStore } from "@/stores/activeScheduleStore";
import type { Schedule } from "@/types";

export function useSchedules() {
  return useQuery({
    queryKey: scheduleKeys.list(),
    queryFn: async () => (await scheduleApi.list()).schedules,
    staleTime: 30 * 1000,
  });
}

/** The active schedule, falling back to the first available one. */
export function useActiveSchedule() {
  const { data: schedules = [], isLoading, isError, refetch } = useSchedules();
  const activeScheduleId = useActiveScheduleStore((s) => s.activeScheduleId);

  const active: Schedule | null =
    schedules.find((schedule) => schedule.id === activeScheduleId) ?? schedules[0] ?? null;

  return { schedules, active, isLoading, isError, refetch };
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  const setActiveScheduleId = useActiveScheduleStore((s) => s.setActiveScheduleId);

  return useMutation({
    mutationFn: ({ name, startDate, endDate }: { name: string } & ScheduleTerm) =>
      scheduleApi.create(name, { startDate, endDate }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.list() });
      setActiveScheduleId(data.schedule.id);
      toast.success(`“${data.schedule.name}” created.`);
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't create this schedule."));
    },
  });
}

export function useRenameSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, startDate, endDate }: { id: string; name: string } & ScheduleTerm) =>
      scheduleApi.rename(id, name, { startDate, endDate }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.list() });
      toast.success("Schedule updated.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't save your changes."));
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scheduleId: string) => scheduleApi.remove(scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Schedule deleted.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't delete this schedule."));
    },
  });
}