"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { scheduleApi, scheduleKeys } from "@/services/schedule.api";
import type { EntryPayload } from "@/types";

export function useCreateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, payload }: { scheduleId: string; payload: EntryPayload }) =>
      scheduleApi.createEntry(scheduleId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: scheduleKeys.all });
      toast.success("Class added.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't add this class."));
    },
  });
}