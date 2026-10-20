import { api, ApiError } from "@/services/api";
import type { DetectedEntry, Upload, UploadRecord } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

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

  /** The user's upload history, newest first. */
  list() {
    return api<{ uploads: UploadRecord[] }>("/api/schedule-upload");
  },

  remove(uploadId: string) {
    return api<null>(`/api/schedule-upload/${uploadId}`, { method: "DELETE" });
  },

  /**
   * Open the stored image in a new tab. The endpoint requires the auth cookie,
   * which a raw cross-origin <a target="_blank"> may not carry, so we fetch
   * the bytes with credentials and open the resulting blob URL instead.
   */
  async openImageInNewTab(uploadId: string): Promise<void> {
    const response = await fetch(`${BASE}/api/schedule-upload/${uploadId}/image`, {
      credentials: "include",
    });
    if (response.status === 401) {
      throw new ApiError(401, "Your session has expired. Please sign in again.");
    }
    if (!response.ok) {
      throw new ApiError(response.status, "We couldn't load this image.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener");
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new ApiError(0, "Your browser blocked the new tab. Please allow pop-ups.");
    }
    // Give the tab a moment to load the blob before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};
