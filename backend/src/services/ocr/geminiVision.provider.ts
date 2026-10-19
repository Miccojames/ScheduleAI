import fs from "node:fs/promises";
import { ApiError, GoogleGenAI, Type, type Schema } from "@google/genai";
import { env } from "../../config/env.js";
import {
  AiProviderError,
  type AnalyzeInput,
  type AnalyzeResult,
  type RawAiEntry,
  type ScheduleImageAnalyzer,
} from "./types.js";

const TIMEOUT_MS = 45_000;

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
        ],
        properties: {
          subject: { type: Type.STRING, nullable: true },
          day: { type: Type.ARRAY, items: { type: Type.STRING } },
          start_time: { type: Type.STRING, nullable: true },
          end_time: { type: Type.STRING, nullable: true },
          room: { type: Type.STRING, nullable: true },
          instructor: { type: Type.STRING, nullable: true },
          notes: { type: Type.STRING, nullable: true },
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
- Recognize compact grid formats: "MWF" means Monday/Wednesday/Friday; "TTh" means Tuesday/Thursday; ranges like "Mon-Wed-Fri"; time ranges like "8:00 AM - 9:30 AM".
- Ignore headers, footers, page numbers, semester labels, and titles — only the class rows matter.
- If the image contains no class schedule at all, return an empty entries array.`;

/** Human-readable error summary for server-side logs (model + SDK status). */
function describeError(err: unknown): string {
  if (err instanceof ApiError) return `ApiError status=${err.status} message=${err.message}`;
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
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
      // 45s ceiling per HTTP attempt (the abort signal below bounds the whole
      // call including retries).
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

    let text: string | undefined;
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
          maxOutputTokens: 2048,
          // 45s hard timeout, wired through the SDK's own abort plumbing.
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      text = response.text;
    } catch (err) {
      // Map every SDK/network/abort error to our provider error — never leak
      // SDK details to the client, but log them for server-side debugging.
      console.error(`[gemini] analyze failed model=${this.model}: ${describeError(err)}`);
      throw new AiProviderError("The AI provider request failed.", { cause: err });
    }

    if (!text) {
      console.error(`[gemini] empty response model=${this.model} (blocked or no candidates)`);
      throw new AiProviderError("The AI provider returned an empty response.");
    }

    try {
      const parsed = JSON.parse(text) as { entries?: Array<RawAiEntry & { days?: RawAiEntry["day"] }> };
      const entries: RawAiEntry[] = (Array.isArray(parsed.entries) ? parsed.entries : []).map(
        (entry) => {
          const row = entry ?? {};
          // Defensive: tolerate a `days` key if the model ignores the schema
          // name — the parser only reads `day`.
          const { days, ...rest } = row;
          return days !== undefined && rest.day == null ? { ...rest, day: days } : rest;
        }
      );
      return { entries };
    } catch (err) {
      console.error(`[gemini] malformed JSON model=${this.model}: ${describeError(err)}`);
      throw new AiProviderError("The AI provider returned malformed JSON.", { cause: err });
    }
  }
}
