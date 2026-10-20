import fs from "node:fs/promises";
import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "../../config/env.js";
import {
  AiProviderError,
  normalizeConfidence,
  type AiProviderErrorCode,
  type AnalyzeInput,
  type AnalyzeResult,
  type RawAiEntry,
  type ScheduleImageAnalyzer,
} from "./types.js";

const TIMEOUT_MS = 120_000;

// Retry policy: 2 attempts total with a ~3s pause. ONLY transient failures
// are retried — 429 (quota), 503 (UNAVAILABLE demand spike),
// 504/DEADLINE_EXCEEDED, and network/abort timeouts. Other 4xx are never
// retried.
// Per-attempt timeout is 120s because real schedule photos consistently need
// >90s on this free-tier model (even a 1x1 PNG measured ~58s). Two 120s
// attempts + backoff ≈ 243s worst case, safely under Node's default 300s
// requestTimeout. The controller falls back to the mock provider when the
// final failure is a timeout, so the user still gets a reviewable result.
const MAX_ATTEMPTS = 2;
const RETRY_DELAYS_MS = [3_000]; // after attempt 1

// Whole-process budget: the initial call + a malformed-JSON retry call must
// all finish inside Node's default 300s server requestTimeout, so every
// attempt's abort deadline is clipped to what remains of this budget.
const PROCESS_BUDGET_MS = 280_000;
/** Never START a malformed-retry fresh call with less time than this left. */
const MIN_FRESH_CALL_MS = 20_000;
/** Never start a call attempt with less time than this left. */
const MIN_CALL_MS = 5_000;

// gemini-3.8-flash is a THINKING model: its internal reasoning tokens are
// drawn from maxOutputTokens, so the old 2048 ceiling left too little room
// for the visible JSON on real schedules — output was cut off mid-string
// (observed live: "Unterminated string in JSON at position 1905").
// Disable thinking entirely (faster + no reasoning stealing the budget) and
// keep a generous ceiling as a second line of defense for long schedules.
const MAX_OUTPUT_TOKENS = 8192;

// Strict JSON schema so the model's output is machine-parseable. The parser
// still treats every field as untrusted (see scheduleParser.service.ts).
// Property names match RawAiEntry (the parser reads `day`, the mock emits `day`).
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        propertyOrdering: [
          "subject",
          "day",
          "start_time",
          "end_time",
          "room",
          "instructor",
          "notes",
          "confidence",
        ],
        properties: {
          subject: { type: Type.STRING, nullable: true },
          day: { type: Type.ARRAY, items: { type: Type.STRING } },
          start_time: { type: Type.STRING, nullable: true },
          end_time: { type: Type.STRING, nullable: true },
          room: { type: Type.STRING, nullable: true },
          instructor: { type: Type.STRING, nullable: true },
          notes: { type: Type.STRING, nullable: true },
          // Optional per-field confidence 0..1 — NOT required, so a model that
          // skips it simply yields entries without confidences (never an error).
          confidence: {
            type: Type.OBJECT,
            nullable: true,
            properties: {
              subject: { type: Type.NUMBER, nullable: true },
              day: { type: Type.NUMBER, nullable: true },
              startTime: { type: Type.NUMBER, nullable: true },
              endTime: { type: Type.NUMBER, nullable: true },
              instructor: { type: Type.NUMBER, nullable: true },
              room: { type: Type.NUMBER, nullable: true },
            },
          },
        },
        required: [
          "subject",
          "day",
          "start_time",
          "end_time",
          "room",
          "instructor",
          "notes",
        ],
      },
    },
  },
  required: ["entries"],
  propertyOrdering: ["entries"],
};

const SYSTEM_PROMPT = `You extract class schedules from images.

Rules:
- Extract ONLY the class schedule rows visible in the image. NEVER invent or guess values.
- If a field is not visible or unreadable, use null.
- For each entry: subject (course name/code), day (array of full weekday names like "Monday", or common abbreviations like "Mon", "MWF", "TTh", "Tue,Thu"), start_time and end_time as "HH:MM" 24-hour strings (convert AM/PM if needed), room, instructor, notes.
- Also return a confidence object per entry with a number from 0 (pure guess) to 1 (clearly legible/certain) for each field: subject, day, startTime, endTime, instructor, room. Use null when you cannot estimate a field's confidence.
- Recognize compact grid formats: "MWF" means Monday/Wednesday/Friday; "TTh" means Tuesday/Thursday; ranges like "Mon-Wed-Fri"; time ranges like "8:00 AM - 9:30 AM".
- Ignore headers, footers, page numbers, semester labels, and titles — only the class rows matter.
- If the image contains no class schedule at all, return an empty entries array.`;

/** Human-readable error summary for server-side logs (model + SDK status). */
function describeError(err: unknown): string {
  if (err instanceof ApiError) return `ApiError status=${err.status} message=${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Flattened message across the error + its `cause` chain (SDK wraps fetch errors). */
function errorText(err: unknown): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; current !== undefined && depth < 5; depth++) {
    if (current instanceof ApiError) {
      parts.push(`status=${current.status} ${current.message}`);
      current = current.cause;
      continue;
    }
    if (current instanceof Error) {
      parts.push(`${current.name} ${current.message}`);
      current = (current as { cause?: unknown }).cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" | ");
}

/**
 * Transient failures worth retrying: HTTP 429 (quota), 503 (UNAVAILABLE —
 * the model is "experiencing high demand", explicitly temporary), 504 /
 * DEADLINE_EXCEEDED, and network/abort timeouts. Everything else (any other
 * 4xx, auth errors, bad requests) fails fast — never retried.
 * (Exported for the classification unit tests in geminiVision.test.ts.)
 */
export function isRetryable(err: unknown): boolean {
  if (err instanceof ApiError) {
    if (err.status === 429 || err.status === 503 || err.status === 504) return true;
    if (err.status !== undefined && err.status >= 400 && err.status < 500) return false;
  }
  const text = errorText(err);
  if (/DEADLINE_EXCEEDED|deadline expired|\b504\b|\b503\b|\b429\b|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|rate[ _-]?limit|quota/i.test(text)) {
    return true;
  }
  // AbortSignal.timeout → DOMException named "TimeoutError"; fetch aborts → "AbortError".
  if (/AbortError|TimeoutError|ETIMEDOUT|ESOCKETTIMEDOUT|UND_ERR_(CONNECT_)?TIMEOUT|fetch failed|network|ECONNRESET|ECONNREFUSED|EPIPE|EAI_AGAIN|socket hang up/i.test(text)) {
    return true;
  }
  return false;
}

export interface ClassifiedFailure {
  code: AiProviderErrorCode;
  userMessage: string;
  message: string;
}

/**
 * Map the FINAL failure to a stable `code` + a safe client-facing message.
 * Checked in order: quota → busy (503) → timeout → generic provider outage.
 * (Exported for the classification unit tests in geminiVision.test.ts.)
 */
export function classifyFailure(err: unknown): ClassifiedFailure {
  const message = describeError(err);
  const status = err instanceof ApiError ? err.status : undefined;
  const text = errorText(err);
  if (status === 429 || /quota|rate[ _-]?limit|RESOURCE_EXHAUSTED/i.test(text)) {
    return {
      code: "quota",
      userMessage:
        "The AI service is busy right now — its daily limit may have been reached. Please try again in a few minutes.",
      message,
    };
  }
  if (status === 503 || /UNAVAILABLE|high demand/i.test(text)) {
    return {
      code: "busy",
      userMessage:
        "The AI service is experiencing high demand right now. Please try again in a minute or two.",
      message,
    };
  }
  if (status === 504 || /DEADLINE_EXCEEDED|deadline expired|\b504\b|timeout|timed out|abort/i.test(text)) {
    return {
      code: "timeout",
      userMessage: "The AI service took too long to respond. Please try again in a moment.",
      message,
    };
  }
  return {
    code: "provider",
    userMessage: "We couldn't reach the AI service right now. Please try again shortly.",
    message,
  };
}

/**
 * Map one raw model row into a RawAiEntry: tolerates a `days` key if the
 * model ignores the schema name (the parser only reads `day`) and coerces +
 * clamps per-field confidence to 0..1, dropping it entirely when
 * missing/unusable — the parse never fails over confidence.
 */
function mapRawEntry(
  entry: (RawAiEntry & { days?: RawAiEntry["day"] }) | undefined | null,
): RawAiEntry {
  const row = entry ?? {};
  const { days, confidence, ...rest } = row;
  const merged =
    days !== undefined && rest.day == null ? { ...rest, day: days } : rest;
  const normalized = normalizeConfidence(confidence);
  return normalized ? { ...merged, confidence: normalized } : merged;
}

/**
 * Parse the model's JSON response into mapped raw entries. Strips markdown
 * code fences some models still emit despite `responseMimeType`, and throws
 * on unparseable JSON (the caller decides whether to retry/salvage).
 * (Exported for the parse/salvage unit tests in geminiVision.test.ts.)
 */
export function parseModelResponse(text: string): RawAiEntry[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[A-Za-z]*\s*/, "").replace(/\s*```$/, "");
  }
  const parsed = JSON.parse(cleaned) as {
    entries?: Array<RawAiEntry & { days?: RawAiEntry["day"] }>;
  };
  return (Array.isArray(parsed.entries) ? parsed.entries : []).map(mapRawEntry);
}

/**
 * Best-effort repair of TRUNCATED model output (the observed failure mode:
 * token-starved JSON cut off mid-string) — walks the `entries` array and
 * returns every object that is COMPLETE before the cut; the final
 * unterminated object is skipped. String-aware, so braces/quotes inside
 * values can't confuse the depth counting. Returns null when nothing can
 * be recovered.
 * (Exported for the salvage unit tests in geminiVision.test.ts.)
 */
export function salvageTruncatedJson(text: string): RawAiEntry[] | null {
  const keyIdx = text.indexOf('"entries"');
  if (keyIdx === -1) return null;
  const arrayStart = text.indexOf("[", keyIdx);
  if (arrayStart === -1) return null;

  const entries: RawAiEntry[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;
  for (let i = arrayStart + 1; i < text.length; i++) {
    const ch = text.charAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && objStart !== -1) {
        try {
          entries.push(JSON.parse(text.slice(objStart, i + 1)) as RawAiEntry);
        } catch {
          // Unbalanced fragment — skip it and keep scanning.
        }
        objStart = -1;
      }
    }
  }
  return entries.length > 0 ? entries : null;
}

/**
 * GeminiVisionProvider — sends the image to Gemini as inline base64 data and
 * asks for strict JSON matching our schedule schema (responseMimeType +
 * responseSchema on the installed @google/genai SDK).
 *
 * Never touches the database — it only returns raw rows for the parser.
 */
export class GeminiVisionProvider implements ScheduleImageAnalyzer {
  readonly name = "gemini" as const;
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    this.model = env.GEMINI_MODEL;
    this.client = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      // 120s ceiling per HTTP attempt (the per-attempt abort signal below
      // bounds each call including its own timeout).
      httpOptions: { timeout: TIMEOUT_MS },
    });
    console.log(
      `[gemini] vision provider ready model=${this.model} timeout=${TIMEOUT_MS}ms`
    );
  }

  async analyze(input: AnalyzeInput): Promise<AnalyzeResult> {
    let base64: string;
    try {
      const buffer = await fs.readFile(input.filePath);
      base64 = buffer.toString("base64");
    } catch (err) {
      throw new AiProviderError("Could not read the uploaded image file.", { cause: err });
    }

    const deadline = Date.now() + PROCESS_BUDGET_MS;
    const text = await this.generateText(input, base64, deadline, MAX_ATTEMPTS);

    // Parse the response. Truncated/unparseable output (see the
    // MAX_OUTPUT_TOKENS note above) is retried ONCE with a fresh call, then
    // repaired via salvage — only an unusable response from every path
    // becomes a "malformed" provider error (fallback-eligible in dev).
    let entries: RawAiEntry[] | null = null;
    let parseErr: unknown;
    try {
      entries = parseModelResponse(text);
    } catch (err) {
      parseErr = err;
      console.error(`[gemini] malformed JSON model=${this.model}: ${describeError(err)}`);
    }

    if (entries === null) {
      let bestText = text;
      let freshCallErr: unknown;
      if (deadline - Date.now() >= MIN_FRESH_CALL_MS) {
        console.error(
          `[gemini] retrying unparseable output with a fresh call model=${this.model}`,
        );
        try {
          const freshText = await this.generateText(input, base64, deadline, 1);
          bestText = freshText;
          entries = parseModelResponse(freshText);
        } catch (err) {
          if (err instanceof AiProviderError) {
            // The call itself failed (quota/timeout/…) — a truthful
            // classified error beats a misleading parse error below.
            freshCallErr = err;
            console.error(
              `[gemini] fresh-call retry failed model=${this.model}: ${err.message}`,
            );
          } else {
            parseErr = err;
            console.error(
              `[gemini] malformed JSON on fresh retry model=${this.model}: ${describeError(err)}`,
            );
          }
        }
      } else {
        console.error(
          `[gemini] not enough time budget for a fresh call (${deadline - Date.now()}ms left) model=${this.model}`,
        );
      }

      if (entries === null) {
        const salvaged = salvageTruncatedJson(bestText);
        if (salvaged) {
          console.warn(
            `[gemini] salvaged ${salvaged.length} complete entr${salvaged.length === 1 ? "y" : "ies"} from truncated JSON model=${this.model}`,
          );
          entries = salvaged.map(mapRawEntry);
        }
      }

      if (entries === null) {
        if (freshCallErr !== undefined) throw freshCallErr;
        console.error(
          `[gemini] malformed JSON after retry + salvage model=${this.model}: ${describeError(parseErr)}`,
        );
        throw new AiProviderError("The AI provider returned malformed JSON.", {
          cause: parseErr,
          code: "malformed",
          userMessage: "The AI service returned an unreadable response. Please try again.",
        });
      }
    }

    return { entries };
  }

  /**
   * Call generateContent under the retry policy (maxAttempts total, ~3s
   * backoff, retry ONLY on 429/503/504/timeouts) with each attempt aborted at
   * min(TIMEOUT_MS, remaining process budget). Returns the non-empty response
   * text or throws a classified AiProviderError (code + userMessage).
   */
  private async generateText(
    input: AnalyzeInput,
    base64: string,
    deadline: number,
    maxAttempts: number,
  ): Promise<string> {
    let text: string | undefined;
    let lastErr: unknown;
    let attemptsRun = 0;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attemptsRun = attempt;
      const remainingMs = deadline - Date.now();
      if (remainingMs < MIN_CALL_MS) {
        lastErr = new Error(
          `timed out before attempt ${attempt}: request time budget exhausted (${remainingMs}ms left)`,
        );
        break;
      }
      try {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents: [
            {
              role: "user",
              parts: [
                { text: "Extract every class entry from this schedule image." },
                {
                  inlineData: { mimeType: input.mimeType, data: base64 },
                },
              ],
            },
          ],
          config: {
            systemInstruction: SYSTEM_PROMPT,
            // JSON response mode: schema-constrained JSON (supported by this SDK).
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Thinking disabled (budget 0 = DISABLED per ThinkingConfig): its
            // reasoning tokens count against maxOutputTokens and were starving
            // the visible JSON mid-string. Also much faster without it.
            thinkingConfig: { thinkingBudget: 0 },
            // Per-attempt hard timeout, clipped to the remaining process budget.
            abortSignal: AbortSignal.timeout(Math.min(TIMEOUT_MS, remainingMs)),
          },
        });
        text = response.text;
        break;
      } catch (err) {
        lastErr = err;
        const summary = describeError(err);
        const willRetry = attempt < maxAttempts && isRetryable(err);
        console.error(
          `[gemini] analyze attempt ${attempt}/${maxAttempts} failed model=${this.model}: ${summary}` +
            (willRetry ? "" : " (not retryable)"),
        );
        if (!willRetry) break;
        const delayMs = RETRY_DELAYS_MS[attempt - 1];
        console.error(
          `[gemini] retrying attempt ${attempt + 1}/${maxAttempts} in ${delayMs}ms model=${this.model}`,
        );
        await sleep(delayMs);
      }
    }

    if (lastErr !== undefined && text === undefined) {
      // Final failure — classify (quota | busy | timeout | provider) and expose a
      // safe client-facing message; the internal detail stays in the logs.
      const { code, userMessage, message } = classifyFailure(lastErr);
      console.error(
        `[gemini] analyze failed after ${attemptsRun}/${maxAttempts} attempt(s) model=${this.model} code=${code}: ${message}`,
      );
      throw new AiProviderError(message, { cause: lastErr, code, userMessage });
    }

    if (!text) {
      console.error(`[gemini] empty response model=${this.model} (blocked or no candidates)`);
      // Empty output is as unusable as truncated output — same bucket,
      // fallback-eligible so a stray empty reply never dead-ends a dev run.
      throw new AiProviderError("The AI provider returned an empty response.", {
        code: "malformed",
        userMessage: "The AI service returned an empty response. Please try again.",
      });
    }

    return text;
  }
}
