"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { uploadApi } from "@/services/upload.api";

/** Step 2 of the AI flow: run extraction and receive the detected classes. */
export function useProcessUpload() {
  return useMutation({
    mutationFn: (uploadId: string) => uploadApi.process(uploadId),
    onError: (error) => {
      toast.error(
        apiErrorMessage(error, "Sorry, we couldn't read this schedule clearly. Try uploading a clearer image."),
      );
    },
  });
}