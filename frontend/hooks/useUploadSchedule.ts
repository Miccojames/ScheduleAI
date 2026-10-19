"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiErrorMessage } from "@/services/api";
import { uploadApi } from "@/services/upload.api";

/** Step 1 of the AI flow: send the image, get an upload id back. */
export function useUploadSchedule() {
  return useMutation({
    mutationFn: (file: File) => uploadApi.upload(file),
    onError: (error) => {
      toast.error(
        apiErrorMessage(error, "Sorry, we couldn't read this schedule clearly. Try uploading a clearer image."),
      );
    },
  });
}