import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiError } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";
import {
  TOOL_DECLARATIONS,
  buildSystemPrompt,
  demoReply,
  entryArgsToBody,
  historyToContents,
  mergeEntryUpdate,
  responseText,
  shouldRetryProviderError,
  todayLabel,
  translateProviderError,
  zodIssuesMessage,
  type ExistingEntryRow,
  type PromptSchedule,
} from "./assistant.service.js";
import { ZodError } from "zod";

// Real Gemini error payloads observed in production-style diagnosis (same
// fixtures family as geminiVision.test.ts).

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

function apiError(status: number, message: string): ApiError {
  return new ApiError({ status, message });
}

const existingRow: ExistingEntryRow = {
  scheduleId: "sch_1",
  subject: "Database Systems",
  day: "MONDAY",
  startTime: "09:00",
  endTime: "10:15",
  instructor: "Prof. Santos",
  room: "Room 402",
  notes: "Bring calculator",
  kind: "class",
  color: "#6366F1",
  isOneOff: false,
  date: null,
  exceptionDates: ["2026-12-25"],
};

const schedules: PromptSchedule[] = [
  {
    id: "sch_abc",
    name: "First Semester",
    entries: [
      {
        id: "evt_1",
        day: "MONDAY",
        startTime: "09:00",
        endTime: "10:15",
        subject: "Database Systems",
        room: "Room 402",
        instructor: "Prof. Santos",
        kind: "class",
        isOneOff: false,
        date: null,
      },
    ],
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt({
    firstName: "Maria",
    todayLabel: "2026-10-25 (Sunday)",
    schedules,
  });

  it("includes the user's name and today's date", () => {
    expect(prompt).toContain("Maria");
    expect(prompt).toContain("2026-10-25 (Sunday)");
  });

  it("embeds schedule id, event details and the event id for update/delete", () => {
    expect(prompt).toContain("First Semester");
    expect(prompt).toContain("sch_abc");
    expect(prompt).toContain("MONDAY 09:00-10:15");
    expect(prompt).toContain("Database Systems");
    expect(prompt).toContain("Room 402");
    expect(prompt).toContain("[event id: evt_1]");
  });

  it("states the ground rules (no invented events, tool usage, short replies)", () => {
    expect(prompt).toContain("never invent events");
    expect(prompt).toContain("MONDAY..SUNDAY");
    expect(prompt).toContain("one short clarifying question");
  });

  it("tells the model to offer schedule creation when the account is empty", () => {
    const empty = buildSystemPrompt({
      firstName: "Maria",
      todayLabel: "2026-10-25 (Sunday)",
      schedules: [],
    });
    expect(empty).toContain("No schedules yet");
    expect(empty).toContain("create_schedule");
  });
});

describe("historyToContents", () => {
  it("maps roles to user/model and keeps plain text", () => {
    const contents = historyToContents([
      { role: "user", content: "What's on Monday?" },
      { role: "assistant", content: "Database Systems 09:00-10:15." },
    ]);
    expect(contents).toEqual([
      { role: "user", parts: [{ text: "What's on Monday?" }] },
      { role: "model", parts: [{ text: "Database Systems 09:00-10:15." }] },
    ]);
  });

  it("drops blank content and unknown roles", () => {
    const contents = historyToContents([
      { role: "user", content: "   " },
      { role: "system", content: "instrusions" },
      { role: "user", content: "keep me" },
    ]);
    expect(contents).toHaveLength(1);
    expect(contents[0].parts?.[0]?.text).toBe("keep me");
  });

  it("replays only the newest 16 messages (HISTORY_LIMIT)", () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `message-${i}`,
    }));
    const contents = historyToContents(rows);
    expect(contents).toHaveLength(16);
    expect(contents[0].parts?.[0]?.text).toBe("message-4");
    expect(contents[15].parts?.[0]?.text).toBe("message-19");
  });
});

describe("mergeEntryUpdate", () => {
  it("keeps stored values when args only change the subject", () => {
    const merged = mergeEntryUpdate(existingRow, { subject: "Algorithms" });
    expect(merged.subject).toBe("Algorithms");
    expect(merged.day).toBe("MONDAY");
    expect(merged.startTime).toBe("09:00");
    expect(merged.endTime).toBe("10:15");
    expect(merged.room).toBe("Room 402");
    expect(merged.instructor).toBe("Prof. Santos");
    expect(merged.notes).toBe("Bring calculator");
    expect(merged.color).toBe("#6366F1");
    expect(merged.exceptionDates).toEqual(["2026-12-25"]);
  });

  it("ignores unknown args such as a stray scheduleId", () => {
    const merged = mergeEntryUpdate(existingRow, {
      scheduleId: "sch_hacker",
      bogus: true,
    });
    expect(merged).not.toHaveProperty("scheduleId");
    expect(merged).not.toHaveProperty("bogus");
    expect(merged.scheduleId).toBeUndefined();
  });

  it("keeps the existing value when the model sends null", () => {
    const merged = mergeEntryUpdate(existingRow, { room: null });
    expect(merged.room).toBe("Room 402");
  });

  it("converts a stored one-off Date to YYYY-MM-DD", () => {
    const merged = mergeEntryUpdate(
      { ...existingRow, isOneOff: true, date: new Date("2026-11-03T00:00:00.000Z") },
      {},
    );
    expect(merged.date).toBe("2026-11-03");
    expect(merged.isOneOff).toBe(true);
  });

  it("drops a stored color that isn't hex so validation can re-derive one", () => {
    const merged = mergeEntryUpdate({ ...existingRow, color: "indigo" }, {});
    expect(merged).not.toHaveProperty("color");
  });

  it("always yields a payload entryArgsToBody/entryBodySchema accept", () => {
    const merged = mergeEntryUpdate(existingRow, { subject: "Algorithms" });
    expect(() => entryArgsToBody(merged)).not.toThrow();
  });

  it("normalizes an unknown stored kind to class", () => {
    const merged = mergeEntryUpdate({ ...existingRow, kind: "weird" }, {});
    expect(merged.kind).toBe("class");
  });
});

describe("entryArgsToBody", () => {
  it("picks known fields and defaults kind to class", () => {
    const body = entryArgsToBody({
      subject: "Gym",
      day: "TUESDAY",
      startTime: "18:00",
      endTime: "19:00",
      scheduleId: "ignored",
    });
    expect(body.subject).toBe("Gym");
    expect(body.kind).toBe("class");
    expect(body).not.toHaveProperty("scheduleId");
  });

  it("throws a readable ZodError when day is missing", () => {
    try {
      entryArgsToBody({ subject: "Gym", startTime: "18:00", endTime: "19:00" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      expect(zodIssuesMessage(err as ZodError)).toContain("day");
    }
  });

  it("enforces end > start with the contract message", () => {
    try {
      entryArgsToBody({
        subject: "Gym",
        day: "TUESDAY",
        startTime: "19:00",
        endTime: "18:00",
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(zodIssuesMessage(err as ZodError)).toContain(
        "End time must be after start time.",
      );
    }
  });

  it("requires a date for one-off events", () => {
    expect(() =>
      entryArgsToBody({
        subject: "Exam",
        day: "FRIDAY",
        startTime: "08:00",
        endTime: "10:00",
        isOneOff: true,
      }),
    ).toThrow(ZodError);
  });
});

describe("translateProviderError", () => {
  it("maps 429 quota to a 429 AppError with a safe message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = translateProviderError(apiError(429, QUOTA_MESSAGE));
    expect(err.status).toBe(429);
    expect(err.code).toBe("assistant_quota");
    expect(err.message).toMatch(/limit|busy/i);
    // Raw upstream detail must never reach the client.
    expect(err.message).not.toContain("generativelanguage");
  });

  it("maps 503 demand spikes to 503", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = translateProviderError(apiError(503, BUSY_MESSAGE));
    expect(err.status).toBe(503);
    expect(err.code).toBe("assistant_busy");
  });

  it("maps timeouts to 503", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = translateProviderError(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
    expect(err.status).toBe(503);
    expect(err.code).toBe("assistant_timeout");
  });

  it("maps anything else to 502", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = translateProviderError(new Error("weird downstream failure"));
    expect(err.status).toBe(502);
    expect(err.code).toBe("assistant_provider");
  });
});

describe("shouldRetryProviderError", () => {
  it("retries transient 503/504 failures", () => {
    expect(shouldRetryProviderError(apiError(503, BUSY_MESSAGE))).toBe(true);
    expect(
      shouldRetryProviderError(apiError(504, "DEADLINE_EXCEEDED: Deadline expired.")),
    ).toBe(true);
    expect(
      shouldRetryProviderError(new DOMException("aborted", "AbortError")),
    ).toBe(true);
  });

  it("never retries quota 429 — the wait window makes it pointless", () => {
    expect(shouldRetryProviderError(apiError(429, QUOTA_MESSAGE))).toBe(false);
  });

  it("never retries client/format errors", () => {
    expect(shouldRetryProviderError(apiError(400, "Invalid argument"))).toBe(false);
    expect(shouldRetryProviderError(new Error("weird downstream failure"))).toBe(false);
  });
});

describe("demoReply / todayLabel / responseText", () => {
  it("demoReply names the user and admits demo mode", () => {
    const reply = demoReply("Maria");
    expect(reply).toContain("Maria");
    expect(reply).toContain("demo mode");
    expect(reply).toContain("GEMINI_API_KEY");
  });

  it("todayLabel renders YYYY-MM-DD (Weekday) for a valid timezone", () => {
    expect(todayLabel("Asia/Manila")).toMatch(/^\d{4}-\d{2}-\d{2} \([A-Za-z]+\)$/);
  });

  it("todayLabel falls back to UTC for a garbage timezone", () => {
    expect(todayLabel("Not/AZone")).toMatch(/^\d{4}-\d{2}-\d{2} \(UTC\)$/);
    expect(todayLabel(null)).toMatch(/^\d{4}-\d{2}-\d{2} \(/);
  });

  it("responseText trims and survives a throwing text getter", () => {
    const ok = { text: "  hello  " } as GenerateContentResponse;
    expect(responseText(ok)).toBe("hello");
    const broken = {
      get text(): string {
        throw new Error("blocked");
      },
    } as GenerateContentResponse;
    expect(responseText(broken)).toBe("");
  });
});

describe("TOOL_DECLARATIONS", () => {
  it("exposes exactly the six schedule tools", () => {
    expect(TOOL_DECLARATIONS.map((tool) => tool.name)).toEqual([
      "list_schedules",
      "list_events",
      "create_schedule",
      "create_event",
      "update_event",
      "delete_event",
    ]);
  });

  it("create_event requires subject, day, start and end", () => {
    const create = TOOL_DECLARATIONS.find((tool) => tool.name === "create_event");
    expect(create?.parameters?.required).toEqual([
      "subject",
      "day",
      "startTime",
      "endTime",
    ]);
  });

  it("update/delete require entryId", () => {
    for (const name of ["update_event", "delete_event"]) {
      const tool = TOOL_DECLARATIONS.find((decl) => decl.name === name);
      expect(tool?.parameters?.required).toContain("entryId");
    }
  });
});
