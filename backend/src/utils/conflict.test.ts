import { describe, it, expect } from "vitest";
import { computeConflicts, type ConflictInput } from "./conflict.js";

function entry(overrides: Partial<ConflictInput> & { id: string }): ConflictInput {
  return {
    subject: "Subject",
    day: "MONDAY",
    startTime: "09:00",
    endTime: "10:00",
    ...overrides,
  };
}

/** Stable pair keys so assertions don't depend on conflict ordering. */
function pairs(entries: ConflictInput[]): string[] {
  return computeConflicts(entries)
    .map((c) => [c.a.id, c.b.id].sort().join("|"))
    .sort();
}

describe("computeConflicts", () => {
  it("returns no conflicts for an empty list", () => {
    expect(computeConflicts([])).toEqual([]);
  });

  it("returns no conflicts for a single entry", () => {
    expect(computeConflicts([entry({ id: "a" })])).toEqual([]);
  });

  it("detects a full overlap on the same day", () => {
    const conflicts = computeConflicts([
      entry({ id: "a", subject: "Math", startTime: "09:00", endTime: "10:00" }),
      entry({ id: "b", subject: "Physics", startTime: "09:00", endTime: "10:00" }),
    ]);
    expect(conflicts).toHaveLength(1);
    expect([conflicts[0].a.id, conflicts[0].b.id].sort()).toEqual(["a", "b"]);
  });

  it("detects a partial overlap", () => {
    expect(
      pairs([
        entry({ id: "a", startTime: "09:00", endTime: "10:00" }),
        entry({ id: "b", startTime: "09:30", endTime: "10:30" }),
      ])
    ).toEqual(["a|b"]);
  });

  it("detects an entry fully contained in another", () => {
    expect(
      pairs([
        entry({ id: "a", startTime: "09:00", endTime: "12:00" }),
        entry({ id: "b", startTime: "10:00", endTime: "10:30" }),
      ])
    ).toEqual(["a|b"]);
  });

  it("returns no conflicts for non-overlapping times on the same day", () => {
    expect(
      pairs([
        entry({ id: "a", startTime: "09:00", endTime: "10:00" }),
        entry({ id: "b", startTime: "10:01", endTime: "11:00" }),
        entry({ id: "c", startTime: "08:00", endTime: "09:00" }), // touches a → still ok
      ])
    ).toEqual([]);
  });

  it("does NOT treat touching intervals (end == start) as a conflict", () => {
    // 09:00-10:00 vs 10:00-11:00: bStart(600) < aEnd(600) is false.
    expect(
      pairs([
        entry({ id: "a", startTime: "09:00", endTime: "10:00" }),
        entry({ id: "b", startTime: "10:00", endTime: "11:00" }),
      ])
    ).toEqual([]);
    // ...in either order.
    expect(
      pairs([
        entry({ id: "a", startTime: "10:00", endTime: "11:00" }),
        entry({ id: "b", startTime: "09:00", endTime: "10:00" }),
      ])
    ).toEqual([]);
  });

  it("never reports conflicts across different days", () => {
    expect(
      pairs([
        entry({ id: "a", day: "MONDAY", startTime: "09:00", endTime: "11:00" }),
        entry({ id: "b", day: "TUESDAY", startTime: "09:00", endTime: "11:00" }),
        entry({ id: "c", day: "FRIDAY", startTime: "10:00", endTime: "12:00" }),
      ])
    ).toEqual([]);
  });

  it("scopes conflicts to the day they occur on in a multi-day list", () => {
    const conflicts = pairs([
      entry({ id: "a", day: "MONDAY", startTime: "09:00", endTime: "10:00" }),
      entry({ id: "b", day: "MONDAY", startTime: "10:00", endTime: "11:00" }), // touching → ok
      entry({ id: "c", day: "TUESDAY", startTime: "09:00", endTime: "10:00" }),
      entry({ id: "d", day: "TUESDAY", startTime: "09:30", endTime: "10:30" }), // overlaps c
      entry({ id: "e", day: "WEDNESDAY", startTime: "09:00", endTime: "10:00" }),
      entry({ id: "f", day: "WEDNESDAY", startTime: "09:00", endTime: "11:00" }), // overlaps e
    ]);
    expect(conflicts).toEqual(["c|d", "e|f"]);
  });

  it("carries full conflict sides (id, subject, day, times)", () => {
    const conflicts = computeConflicts([
      entry({ id: "a", subject: "Math", day: "MONDAY", startTime: "09:00", endTime: "10:00" }),
      entry({ id: "b", subject: "Art", day: "MONDAY", startTime: "09:30", endTime: "10:30" }),
    ]);
    expect(conflicts).toHaveLength(1);
    const sideIds = [conflicts[0].a.id, conflicts[0].b.id].sort();
    expect(sideIds).toEqual(["a", "b"]);
    const byId = { [conflicts[0].a.id]: conflicts[0].a, [conflicts[0].b.id]: conflicts[0].b };
    expect(byId["a"]).toEqual({
      id: "a",
      subject: "Math",
      day: "MONDAY",
      startTime: "09:00",
      endTime: "10:00",
    });
    expect(byId["b"].subject).toBe("Art");
    expect(byId["b"].startTime).toBe("09:30");
    expect(byId["b"].endTime).toBe("10:30");
  });

  it("does not throw on entries with unparseable times (they are skipped)", () => {
    expect(
      pairs([
        entry({ id: "a", startTime: "banana", endTime: "10:00" }),
        entry({ id: "b", startTime: "09:00", endTime: "10:00" }),
      ])
    ).toEqual([]);
  });

  it("treats a zero-length entry touching another interval as a non-conflict", () => {
    // Ends at 10:00, other starts at 10:00 → strict `<` fails.
    expect(
      pairs([
        entry({ id: "a", startTime: "10:00", endTime: "10:00" }),
        entry({ id: "b", startTime: "09:00", endTime: "10:00" }),
      ])
    ).toEqual([]);
  });

  it("flags a zero-length entry strictly inside another entry (current formula behavior)", () => {
    // aStart(09:00) < bEnd(09:30) && bStart(09:30) < aEnd(10:00) → conflict.
    expect(
      pairs([
        entry({ id: "a", startTime: "09:00", endTime: "10:00" }),
        entry({ id: "b", startTime: "09:30", endTime: "09:30" }),
      ])
    ).toEqual(["a|b"]);
  });
});
