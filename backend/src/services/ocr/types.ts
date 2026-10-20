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
  // Optional per-field confidence, 0..1 (0 = guess, 1 = certain), keyed by
  // field name: subject | day | startTime | endTime | instructor | room.
  // Providers sanitize before returning; when the model omits it the field
  // simply stays absent — never an error.
  confidence?: Record<string, number> | null;
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

// ---------------------------------------------------------------------------
// Per-field confidence (0..1) — keys are camelCase field names.
// ---------------------------------------------------------------------------

export const CONFIDENCE_FIELDS = [
  "subject",
  "day",
  "startTime",
  "endTime",
  "instructor",
  "room",
] as const;

/**
 * Defensive confidence normalization — accepts ANY value (AI output is
 * untrusted) and returns a new map holding only known fields whose value is a
 * finite number (or coercible to one), clamped to 0..1. Returns undefined when
 * nothing usable is present so the field stays absent — never throws.
 */
export function normalizeConfidence(raw: unknown): Record<string, number> | undefined {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const source = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const field of CONFIDENCE_FIELDS) {
    // Tolerate snake_case aliases the model may use (start_time / end_time).
    const alias =
      field === "startTime" ? "start_time" : field === "endTime" ? "end_time" : field;
    const candidate = source[field] ?? source[alias];
    const value =
      typeof candidate === "number"
        ? candidate
        : typeof candidate === "string"
          ? Number(candidate)
          : NaN;
    if (!Number.isFinite(value)) continue;
    out[field] = Math.min(1, Math.max(0, value));
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Thrown by providers on any upstream/network/API failure; the upload service
// maps this to a 502 and marks the upload FAILED — unless the code is
// fallback-eligible, which triggers a per-request mock fallback (see
// upload.controller.ts).
//
// `message` is INTERNAL (safe for server logs / the DB `error` column);
// `userMessage` is the safe client-facing text actually shown to the user.
// Fallback-eligible transient codes: "quota" (429), "busy" (503 UNAVAILABLE
// demand spike), "timeout" (model too slow) and "malformed" (model output
// unreadable/empty even after a retry + salvage) let the controller serve a
// per-request mock fallback; "provider" = genuine config/other errors and
// surfaces as an honest 502.
export type AiProviderErrorCode =
  | "quota"
  | "busy"
  | "timeout"
  | "malformed"
  | "provider";

export class AiProviderError extends Error {
  /** Failure class; defaults to "provider" (generic upstream failure). */
  readonly code: AiProviderErrorCode;
  /** Optional safe client-facing text (distinct from the internal message). */
  readonly userMessage?: string;

  constructor(
    message: string,
    options?: { cause?: unknown; code?: AiProviderErrorCode; userMessage?: string },
  ) {
    super(message, options);
    this.name = "AiProviderError";
    this.code = options?.code ?? "provider";
    this.userMessage = options?.userMessage;
  }
}
