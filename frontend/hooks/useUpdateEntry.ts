"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import type { EntryPayload } from "@/types";

export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      scheduleId,
      entryId,
      payload,
    }: {
      scheduleId: string;
      entryId: string;
      payload: EntryPayload;
    }) => scheduleApi.updateEntry(scheduleId, entryId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Changes saved.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't save your changes."));
    },
  });
}