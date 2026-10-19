"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";

export function useDeleteEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, entryId }: { scheduleId: string; entryId: string }) =>
      scheduleApi.deleteEntry(scheduleId, entryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Class deleted.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't delete this class."));
    },
  });
}