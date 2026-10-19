import { env } from "../config/env.js";
import { MockProvider } from "./ocr/mock.provider.js";
import { GeminiVisionProvider } from "./ocr/geminiVision.provider.js";
import type { ProviderName, ScheduleImageAnalyzer } from "./ocr/types.js";

// Factory: pick the OCR provider at runtime. With GEMINI_API_KEY set we use the
// real Gemini vision model; otherwise the deterministic mock (dev/demo mode).
// Instantiated lazily on first use so a missing key never crashes boot.

let instance: ScheduleImageAnalyzer | null = null;

export function getAnalyzer(): ScheduleImageAnalyzer {
  if (!instance) {
    instance = env.GEMINI_API_KEY ? new GeminiVisionProvider() : new MockProvider();
  }
  return instance;
}

export function providerName(): ProviderName {
  return getAnalyzer().name;
}

// Re-exported for the upload service.
export { AiProviderError } from "./ocr/types.js";
