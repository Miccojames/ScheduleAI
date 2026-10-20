"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage, ApiError } from "@/services/api";
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

// Background extraction: the 202 kick returns instantly, then the client
// polls GET /:id every 2s until the server flips the status to COMPLETED or
// FAILED. The scan itself keeps running server-side even if this tab closes.
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000; // server budget is ~8 min worst case

/** Poll an upload until its background extraction finishes (or time out). */
export async function waitForUpload(uploadId: string) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const status = await uploadApi.get(uploadId);
    if (status.upload.status === "COMPLETED" || status.upload.status === "FAILED") {
      return status;
    }
    if (Date.now() > deadline) {
      throw new ApiError(
        0,
        "The scan is taking unusually long. Check the Uploads page in a few minutes.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/**
 * Re-run AI extraction on a previously uploaded image: kicks the background
 * scan, waits for it to finish, and resolves with the final result so the
 * caller can hand off to /upload/review (same shape as the old sync API).
 */
export function useReprocessUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (uploadId: string) => {
      await uploadApi.process(uploadId);
      const status = await waitForUpload(uploadId);
      await queryClient.invalidateQueries({ queryKey: uploadKeys.all });
      if (status.upload.status === "FAILED") {
        throw new ApiError(
          502,
          status.upload.error ?? "The AI scan failed. Please try again.",
        );
      }
      return {
        upload: status.upload,
        // COMPLETED rows always carry a provider; default "mock" so the
        // review page shows its honesty banner rather than assuming real AI.
        provider: status.provider ?? "mock" as const,
        entries: status.entries,
        fallback: status.fallback,
        message: status.message,
      };
    },
    onError: (error) => {
      toast.error(apiErrorMessage(error, "We couldn't re-run the AI extraction."));
    },
  });
}

export type { UploadRecord };
