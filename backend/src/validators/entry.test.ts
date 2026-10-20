import { describe, it, expect } from "vitest";
import { entryBodySchema, bulkEntrySchema } from "./entry.js";

// Core required-field + obvious-invalid cases only. Optional/additive fields
// (exceptionDates, isOneOff, date, ...) are intentionally NOT asserted here so
// concurrent schema extensions cannot break this suite. Exception: `kind`,
// whose contract (values + "class" default) is asserted below.

const validEntry = {
  subject: "Mathematics",
  day: "MONDAY",
  startTime: "09:00",
  endTime: "10:00",
} as const;

describe("entryBodySchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = entryBodySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("accepts a payload with all common optional fields", () => {
    const result = entryBodySchema.safeParse({
      ...validEntry,
      instructor: "Dr. Smith",
      room: "Room 101",
      notes: "Bring calculator",
      color: "#6366F1",
    });
    expect(result.success).toBe(true);
  });

  it("trims the subject", () => {
    const result = entryBodySchema.safeParse({ ...validEntry, subject: "  Mathematics  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.subject).toBe("Mathematics");
  });

  it("rejects a missing subject", () => {
    const { subject: _omitted, ...withoutSubject } = validEntry;
    expect(entryBodySchema.safeParse(withoutSubject).success).toBe(false);
  });

  it("rejects an empty or whitespace-only subject", () => {
    expect(entryBodySchema.safeParse({ ...validEntry, subject: "" }).success).toBe(false);
    expect(entryBodySchema.safeParse({ ...validEntry, subject: "   " }).success).toBe(false);
  });

  it("rejects a subject longer than 120 characters", () => {
    expect(entryBodySchema.safeParse({ ...validEntry, subject: "x".repeat(121) }).success).toBe(false);
  });

  it("rejects an invalid day enum value", () => {
    const result = entryBodySchema.safeParse({ ...validEntry, day: "FUNDAY" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "day")).toBe(true);
    }
  });

  it("rejects a missing day", () => {
    const { day: _omitted, ...withoutDay } = validEntry;
    expect(entryBodySchema.safeParse(withoutDay).success).toBe(false);
  });

  it("rejects bad time strings", () => {
    expect(entryBodySchema.safeParse({ ...validEntry, startTime: "9am" }).success).toBe(false);
    expect(entryBodySchema.safeParse({ ...validEntry, startTime: "25:00" }).success).toBe(false);
    expect(entryBodySchema.safeParse({ ...validEntry, endTime: "10:60" }).success).toBe(false);
    expect(entryBodySchema.safeParse({ ...validEntry, startTime: "" }).success).toBe(false);
  });

  it("rejects endTime that is not after startTime", () => {
    const earlier = entryBodySchema.safeParse({ ...validEntry, endTime: "08:00" });
    expect(earlier.success).toBe(false);
    if (!earlier.success) {
      expect(earlier.error.issues.some((i) => i.path.join(".") === "endTime")).toBe(true);
    }
    // Equal times are also rejected (strict `<`).
    expect(entryBodySchema.safeParse({ ...validEntry, endTime: "09:00" }).success).toBe(false);
  });

  it("rejects an invalid hex color", () => {
    expect(entryBodySchema.safeParse({ ...validEntry, color: "red" }).success).toBe(false);
    expect(entryBodySchema.safeParse({ ...validEntry, color: "#FFF" }).success).toBe(false);
  });

  it("accepts every valid kind and preserves it", () => {
    for (const kind of ["class", "work", "personal", "other"] as const) {
      const result = entryBodySchema.safeParse({ ...validEntry, kind });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.kind).toBe(kind);
    }
  });

  it("defaults kind to 'class' when missing", () => {
    const result = entryBodySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.kind).toBe("class");
  });

  it("rejects an invalid kind value", () => {
    const result = entryBodySchema.safeParse({ ...validEntry, kind: "party" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "kind")).toBe(true);
    }
    expect(entryBodySchema.safeParse({ ...validEntry, kind: "CLASS" }).success).toBe(false);
  });
});

describe("bulkEntrySchema", () => {
  // Bulk entries use `days` (array) instead of `day`.
  const { day: _day, ...baseEntry } = validEntry;
  const bulkEntry = { ...baseEntry, days: ["MONDAY", "WEDNESDAY"] };

  it("accepts a valid bulk payload", () => {
    const result = bulkEntrySchema.safeParse({ entries: [bulkEntry] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty entries array", () => {
    expect(bulkEntrySchema.safeParse({ entries: [] }).success).toBe(false);
  });

  it("rejects an entry with an invalid day", () => {
    const result = bulkEntrySchema.safeParse({
      entries: [{ ...bulkEntry, days: ["FUNDAY"] }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry with a missing subject", () => {
    const { subject: _subject, ...withoutSubject } = bulkEntry;
    expect(
      bulkEntrySchema.safeParse({ entries: [{ ...withoutSubject, days: ["MONDAY"] }] }).success
    ).toBe(false);
  });

  it("rejects bad times in bulk entries", () => {
    expect(
      bulkEntrySchema.safeParse({
        entries: [{ ...bulkEntry, startTime: "not-a-time" }],
      }).success
    ).toBe(false);
  });

  it("carries kind through bulk entries (explicit and defaulted)", () => {
    const result = bulkEntrySchema.safeParse({
      entries: [{ ...bulkEntry, kind: "work" }, bulkEntry],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.entries[0]!.kind).toBe("work");
      expect(result.data.entries[1]!.kind).toBe("class");
    }
  });

  it("rejects an invalid kind in a bulk entry", () => {
    const result = bulkEntrySchema.safeParse({
      entries: [{ ...bulkEntry, kind: "meeting" }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (i) => i.path.join(".") === "entries.0.kind"
        )
      ).toBe(true);
    }
  });
});
