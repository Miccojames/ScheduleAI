import { describe, it, expect } from "vitest";
import { createScheduleSchema, updateScheduleSchema } from "./schedule.js";

// Core required-field + obvious-invalid cases only. Optional/additive fields
// are intentionally NOT asserted here so concurrent schema extensions cannot
// break this suite.

const validSchedule = { name: "Spring 2026" } as const;

describe("createScheduleSchema", () => {
  it("accepts a minimal valid payload (name only)", () => {
    const result = createScheduleSchema.safeParse(validSchedule);
    expect(result.success).toBe(true);
  });

  it("accepts a payload with a valid term window", () => {
    const result = createScheduleSchema.safeParse({
      name: "Spring 2026",
      startDate: "2026-01-12",
      endDate: "2026-05-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null term dates (clear) and equal start/end dates", () => {
    expect(
      createScheduleSchema.safeParse({ name: "S", startDate: null, endDate: null }).success
    ).toBe(true);
    expect(
      createScheduleSchema.safeParse({ name: "S", startDate: "2026-01-12", endDate: "2026-01-12" })
        .success
    ).toBe(true);
  });

  it("trims the name and rejects an empty one", () => {
    const trimmed = createScheduleSchema.safeParse({ name: "  Spring 2026  " });
    expect(trimmed.success).toBe(true);
    if (trimmed.success) expect(trimmed.data.name).toBe("Spring 2026");

    expect(createScheduleSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createScheduleSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(createScheduleSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a name longer than 80 characters", () => {
    expect(createScheduleSchema.safeParse({ name: "x".repeat(81) }).success).toBe(false);
  });

  it("rejects malformed term dates", () => {
    expect(
      createScheduleSchema.safeParse({ name: "S", startDate: "01/12/2026" }).success
    ).toBe(false);
    expect(
      createScheduleSchema.safeParse({ name: "S", endDate: "not-a-date" }).success
    ).toBe(false);
    // Impossible calendar dates are rejected too (z.iso.date).
    expect(
      createScheduleSchema.safeParse({ name: "S", endDate: "2026-02-31" }).success
    ).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const result = createScheduleSchema.safeParse({
      name: "S",
      startDate: "2026-05-01",
      endDate: "2026-01-12",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "endDate")).toBe(true);
    }
  });
});

describe("updateScheduleSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(updateScheduleSchema.safeParse(validSchedule).success).toBe(true);
  });

  it("accepts a payload with a valid term window", () => {
    expect(
      updateScheduleSchema.safeParse({
        name: "Fall 2026",
        startDate: "2026-09-01",
        endDate: "2026-12-18",
      }).success
    ).toBe(true);
  });

  it("rejects a missing or empty name", () => {
    expect(updateScheduleSchema.safeParse({}).success).toBe(false);
    expect(updateScheduleSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const result = updateScheduleSchema.safeParse({
      name: "S",
      startDate: "2026-05-01",
      endDate: "2026-01-12",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "endDate")).toBe(true);
    }
  });
});
