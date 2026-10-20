import { describe, it, expect } from "vitest";
import { colorForSubject, PALETTE } from "./colors.js";

describe("PALETTE", () => {
  it("has 8 unique entries", () => {
    expect(PALETTE).toHaveLength(8);
    expect(new Set(PALETTE).size).toBe(8);
  });

  it("contains only #RRGGBB hex colors", () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe("colorForSubject", () => {
  it("always returns a color from the palette", () => {
    for (const subject of ["Math", "physics", "History", "Art", "", "A very long subject name"]) {
      expect(PALETTE).toContain(colorForSubject(subject));
    }
  });

  it("is deterministic — same subject always gets the same color", () => {
    expect(colorForSubject("Mathematics")).toBe(colorForSubject("Mathematics"));
    expect(colorForSubject("Art")).toBe(colorForSubject("Art"));
  });

  it("normalizes case and surrounding whitespace before hashing", () => {
    expect(colorForSubject("math")).toBe(colorForSubject("Math"));
    expect(colorForSubject("Math")).toBe(colorForSubject("  Math  "));
    expect(colorForSubject("BIOLOGY")).toBe(colorForSubject("biology"));
  });

  it("pins an exact assignment (stable hash + palette order)", () => {
    // Actual behavior: djb2 hash of "math" mod 8 → index 7.
    expect(colorForSubject("Math")).toBe("#EF4444");
  });

  it("spreads distinct subjects across multiple distinct colors", () => {
    const assigned = ["Math", "PHYSICS", "Art", "Chem", "CS"].map(colorForSubject);
    expect(new Set(assigned).size).toBeGreaterThanOrEqual(3);
  });
});
