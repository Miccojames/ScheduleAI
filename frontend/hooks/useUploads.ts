"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { uploadApi } from "@/services/upload.api";
import type { UploadRecord } from "@/types";

export const uploadKeys = {
  all: ["uploads"] as const,
  list: () => [...uploadKeys.all, "list"] as const,
};

/** The current user's upload history, newest first. */
export function useUploads() {
  return useQuery({
    queryKey: uploadKeys.list(),
    queryFn: async () => (await uploadApi.list()).uploads,
    staleTime: 30 * 1000,
  });
}

export function useDeleteUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (uploadId: string) => uploadApi.remove(uploadId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: uploadKeys.all });
      toast.success("Upload deleted.");
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't delete this upload."));
    },
  });
}

/**
 * Re-run AI extraction on a previously uploaded image. On success the caller
 * receives the process response so it can hand off to /upload/review.
 */
export function useReprocessUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uploadId: string) => {
      const result = await uploadApi.process(uploadId);
      await queryClient.invalidateQueries({ queryKey: uploadKeys.all });
      return result;
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't re-run the AI extraction."));
    },
  });
}

export type { UploadRecord };
