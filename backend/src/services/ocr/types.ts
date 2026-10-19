// Provider contract for schedule-image analysis. Implementations must NOT
// write to the database — they only return raw rows for the parser to clean up.

export type ProviderName = "gemini" | "mock";

// AI output is untrusted: the model may return any of these loose shapes for
// each field. scheduleParser.service.ts normalizes everything downstream.
export interface RawAiEntry {
  subject?: string | null;
  day?: string | string[] | null;
  start_time?: string | null;
  end_time?: string | null;
  room?: string | null;
  instructor?: string | null;
  notes?: string | null;
}

export interface AnalyzeResult {
  entries: RawAiEntry[];
}

export interface AnalyzeInput {
  filePath: string;
  mimeType: string;
}

export interface ScheduleImageAnalyzer {
  name: ProviderName;
  analyze(input: AnalyzeInput): Promise<AnalyzeResult>;
}

// Thrown by providers on any upstream/network/API failure; the upload service
// maps this to a 502 and marks the upload FAILED.
export class AiProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
  }
}
