import { api } from "@/services/api";
import type { DetectedEntry, Upload } from "@/types";

export type ExtractionProvider = "gemini" | "mock";

export interface ProcessUploadResponse {
  upload: Upload;
  provider: ExtractionProvider;
  entries: DetectedEntry[];
  message?: string;
}

export const uploadApi = {
  /** `file` is sent as a multipart field named `image`. */
  upload(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    return api<{ upload: Upload }>("/api/schedule-upload", {
      method: "POST",
      formData,
    });
  },

  process(uploadId: string) {
    return api<ProcessUploadResponse>(`/api/schedule-upload/${uploadId}/process`, {
      method: "POST",
    });
  },
};