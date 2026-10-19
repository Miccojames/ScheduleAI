import { create } from "zustand";
import type { DetectedEntry } from "@/types";
import type { ExtractionProvider } from "@/services/upload.api";

interface ReviewState {
  detected: DetectedEntry[];
  uploadId: string | null;
  provider: ExtractionProvider | null;
  imageUrl: string | null;
  setReview: (payload: {
    detected: DetectedEntry[];
    uploadId: string;
    provider: ExtractionProvider;
    imageUrl?: string | null;
  }) => void;
  clear: () => void;
}

/** Holds the OCR result while the student reviews it on /upload/review. */
export const useReviewStore = create<ReviewState>()((set) => ({
  detected: [],
  uploadId: null,
  provider: null,
  imageUrl: null,
  setReview: ({ detected, uploadId, provider, imageUrl }) =>
    set({ detected, uploadId, provider, imageUrl: imageUrl ?? null }),
  clear: () => set({ detected: [], uploadId: null, provider: null, imageUrl: null }),
}));