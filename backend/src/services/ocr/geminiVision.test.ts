import { describe, it, expect } from "vitest";
import { ApiError } from "@google/genai";
import {
  isRetryable,
  classifyFailure,
  parseModelResponse,
  salvageTruncatedJson,
} from "./geminiVision.provider.js";

// Error payloads below mirror REAL responses observed from the Gemini API
// during live diagnosis (quota exhaustion, demand spikes, deadline expiry).

const QUOTA_MESSAGE = JSON.stringify({
  error: {
    code: 429,
    message:
      "Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.8-flash; Please retry in 14m54s",
    status: "RESOURCE_EXHAUSTED",
  },
});

const BUSY_MESSAGE = JSON.stringify({
  error: {
    code: 503,
    message:
      "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
    status: "UNAVAILABLE",
  },
});

const DEADLINE_MESSAGE =
  "DEADLINE_EXCEEDED: Deadline expired before operation could complete.";

function apiError(status: number, message: string): ApiError {
  return new ApiError({ status, message });
}

describe("isRetryable", () => {
  it("retries HTTP 429 (quota)", () => {
    expect(isRetryable(apiError(429, QUOTA_MESSAGE))).toBe(true);
  });

  it("retries HTTP 503 UNAVAILABLE (demand spike)", () => {
    expect(isRetryable(apiError(503, BUSY_MESSAGE))).toBe(true);
  });

  it("retries HTTP 504 / DEADLINE_EXCEEDED", () => {
    expect(isRetryable(apiError(504, DEADLINE_MESSAGE))).toBe(true);
  });

  it("retries abort/timeout errors (AbortSignal.timeout → TimeoutError)", () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    expect(isRetryable(timeout)).toBe(true);
  });

  it("retries network-level fetch failures without a status", () => {
    expect(isRetryable(new TypeError("fetch failed"))).toBe(true);
  });

  it("does NOT retry client-side 4xx config errors", () => {
    expect(isRetryable(apiError(400, "INVALID_ARGUMENT: bad request"))).toBe(false);
    expect(isRetryable(apiError(403, "PERMISSION_DENIED: key invalid"))).toBe(false);
    expect(
      isRetryable(
        apiError(
          404,
          "NOT_FOUND: This model models/gemini-2.0-flash is no longer available.",
        ),
      ),
    ).toBe(false);
  });

  it("does NOT retry unrelated generic errors", () => {
    expect(isRetryable(new Error("something else entirely"))).toBe(false);
  });
});

describe("classifyFailure", () => {
  it("classifies 429 quota errors with the busy-limit user message", () => {
    const result = classifyFailure(apiError(429, QUOTA_MESSAGE));
    expect(result.code).toBe("quota");
    expect(result.userMessage).toContain("daily limit");
    expect(result.message).toContain("ApiError status=429");
  });

  it("classifies 503 UNAVAILABLE errors as busy with its own user message", () => {
    const result = classifyFailure(apiError(503, BUSY_MESSAGE));
    expect(result.code).toBe("busy");
    expect(result.userMessage).toContain("high demand");
    expect(result.message).toContain("ApiError status=503");
  });

  it("classifies 504 DEADLINE_EXCEEDED as timeout", () => {
    const result = classifyFailure(apiError(504, DEADLINE_MESSAGE));
    expect(result.code).toBe("timeout");
    expect(result.userMessage).toContain("took too long");
  });

  it("classifies abort timeouts as timeout", () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    expect(classifyFailure(timeout).code).toBe("timeout");
  });

  it("classifies non-transient 4xx as generic provider errors", () => {
    expect(classifyFailure(apiError(400, "INVALID_ARGUMENT")).code).toBe("provider");
    expect(classifyFailure(apiError(404, "NOT_FOUND: model gone")).code).toBe("provider");
  });
});

// ---------------------------------------------------------------------------
// parseModelResponse / salvageTruncatedJson — the malformed-JSON pipeline.
// The truncation fixtures mirror the LIVE failure observed from
// gemini-3.8-flash: output cut mid-string by a starved token budget
// ("Unterminated string in JSON at position 1905").
// ---------------------------------------------------------------------------

const VALID_RESPONSE = JSON.stringify({
  entries: [
    {
      subject: "GE 12 – Rizal",
      day: ["Saturday"],
      start_time: "08:00",
      end_time: "09:30",
      room: "Rm 402",
      instructor: null,
      notes: null,
      confidence: { subject: 0.95 },
    },
    {
      subject: 'Capstone 2 "Thesis"',
      day: ["Wednesday"],
      start_time: "13:00",
      end_time: "15:00",
      room: "Lab 1",
      instructor: "Dr. Cruz",
      notes: null,
    },
  ],
});

describe("parseModelResponse", () => {
  it("parses well-formed JSON into mapped entries", () => {
    const entries = parseModelResponse(VALID_RESPONSE);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.subject).toBe("GE 12 – Rizal");
    // Confidence is normalized and kept when usable.
    expect(entries[0]!.confidence?.subject).toBeCloseTo(0.95);
    // Missing confidence on entry 2 is simply absent (never an error).
    expect(entries[1]!.confidence).toBeUndefined();
  });

  it("tolerates a `days` key (model ignoring the schema name)", () => {
    const text = JSON.stringify({
      entries: [{ subject: "IT Elective 4", days: ["Thursday"], room: "Rm 302" }],
    });
    const entries = parseModelResponse(text);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.day).toEqual(["Thursday"]);
  });

  it("strips markdown code fences some models emit anyway", () => {
    const fenced = "```json\n" + VALID_RESPONSE + "\n```";
    expect(parseModelResponse(fenced)).toHaveLength(2);
  });

  it("throws on truncated JSON (caller routes to retry/salvage)", () => {
    const truncated = VALID_RESPONSE.slice(0, VALID_RESPONSE.indexOf('"Capstone'));
    expect(() => parseModelResponse(truncated)).toThrow();
  });
});

describe("salvageTruncatedJson", () => {
  it("recovers every complete entry from well-formed output", () => {
    expect(salvageTruncatedJson(VALID_RESPONSE)).toHaveLength(2);
  });

  it("skips the final unterminated object when the output is cut mid-entry", () => {
    // Cut inside entry 2's subject string — the live failure shape.
    const truncated = VALID_RESPONSE.slice(
      0,
      VALID_RESPONSE.indexOf('"Capstone 2') + '"Capstone'.length,
    );
    const salvaged = salvageTruncatedJson(truncated);
    expect(salvaged).toHaveLength(1);
    expect(salvaged![0]!.subject).toBe("GE 12 – Rizal");
  });

  it("handles braces and escaped quotes inside string values", () => {
    const withNastyStrings = JSON.stringify({
      entries: [
        { subject: 'Weird {brace} "name"', day: ["Mon"], room: "A{B}" },
        { subject: "Second", day: ["Tue"], room: "C" },
      ],
    });
    const cut = withNastyStrings.slice(0, withNastyStrings.indexOf('"Second"') + 4);
    const salvaged = salvageTruncatedJson(cut);
    expect(salvaged).toHaveLength(1);
    expect(salvaged![0]!.subject).toBe('Weird {brace} "name"');
  });

  it("returns null when nothing salvageable exists", () => {
    expect(salvageTruncatedJson("total garbage")).toBeNull();
    expect(salvageTruncatedJson('{"foo": [1, 2')).toBeNull();
    expect(salvageTruncatedJson('{"entries": [')).toBeNull();
    expect(salvageTruncatedJson('{"entries": [{ "subject": "unfinished')).toBeNull();
  });
});
