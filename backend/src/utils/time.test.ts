import { describe, it, expect } from "vitest";
import {
  isValidTime,
  timeToMinutes,
  normalizeTime,
  isoDateToUtc,
  formatIsoDate,
  weekdayOfIsoDate,
} from "./time.js";

describe("isValidTime", () => {
  it("accepts zero-padded 24-hour HH:MM strings", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("08:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });

  it("rejects malformed or out-of-range times", () => {
    expect(isValidTime("8:30")).toBe(false); // not zero-padded
    expect(isValidTime("24:00")).toBe(false); // hour out of range
    expect(isValidTime("12:60")).toBe(false); // minute out of range
    expect(isValidTime("08:30:00")).toBe(false); // seconds not allowed
    expect(isValidTime("")).toBe(false);
    expect(isValidTime("banana")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidTime(1230)).toBe(false);
    expect(isValidTime(null)).toBe(false);
    expect(isValidTime(undefined)).toBe(false);
    expect(isValidTime({ hour: 8 })).toBe(false);
  });
});

describe("timeToMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(timeToMinutes("00:00")).toBe(0);
    expect(timeToMinutes("00:01")).toBe(1);
    expect(timeToMinutes("09:00")).toBe(540);
    expect(timeToMinutes("12:34")).toBe(754);
    expect(timeToMinutes("23:59")).toBe(1439);
  });

  it("returns null for invalid times", () => {
    expect(timeToMinutes("24:00")).toBeNull();
    expect(timeToMinutes("8:30")).toBeNull();
    expect(timeToMinutes("not a time")).toBeNull();
    expect(timeToMinutes("")).toBeNull();
  });
});

describe("normalizeTime", () => {
  it("passes through canonical HH:MM strings", () => {
    expect(normalizeTime("08:00")).toBe("08:00");
    expect(normalizeTime("23:59")).toBe("23:59");
  });

  it("parses the AI-ish formats documented in the source", () => {
    expect(normalizeTime("8:00 AM")).toBe("08:00");
    expect(normalizeTime("0800")).toBe("08:00");
    expect(normalizeTime("8.30")).toBe("08:30");
    expect(normalizeTime("8h")).toBe("08:00");
    expect(normalizeTime("13:0")).toBe("13:00");
    expect(normalizeTime("17h30")).toBe("17:30");
  });

  it("handles AM/PM including the 12 o'clock rollover", () => {
    expect(normalizeTime("12:00 AM")).toBe("00:00");
    expect(normalizeTime("12:00 PM")).toBe("12:00");
    expect(normalizeTime("1:00 PM")).toBe("13:00");
    expect(normalizeTime("8.00 am")).toBe("08:00");
  });

  it("pads bare hours and digit-only times", () => {
    expect(normalizeTime("9")).toBe("09:00");
    expect(normalizeTime("1234")).toBe("12:34");
  });

  it("returns null for unparseable input", () => {
    expect(normalizeTime(null)).toBeNull();
    expect(normalizeTime(undefined)).toBeNull();
    expect(normalizeTime("")).toBeNull();
    expect(normalizeTime("   ")).toBeNull();
    expect(normalizeTime("banana")).toBeNull();
    expect(normalizeTime("24:00")).toBeNull(); // hour out of range
    expect(normalizeTime("10:70")).toBeNull(); // minute out of range
  });
});

describe("iso date helpers", () => {
  it("converts YYYY-MM-DD to midnight UTC", () => {
    const d = isoDateToUtc("2026-10-19");
    expect(d.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
  });

  it("formats a Date to its UTC calendar day", () => {
    expect(formatIsoDate(new Date("2026-03-05T13:45:00Z"))).toBe("2026-03-05");
    expect(formatIsoDate(isoDateToUtc("2026-10-19"))).toBe("2026-10-19");
  });

  it("round-trips through isoDateToUtc → formatIsoDate", () => {
    for (const iso of ["2026-01-01", "2024-02-29", "2026-12-31"]) {
      expect(formatIsoDate(isoDateToUtc(iso))).toBe(iso);
    }
  });
});

describe("weekdayOfIsoDate", () => {
  it("maps ISO dates to their UTC weekday name", () => {
    expect(weekdayOfIsoDate("2026-10-19")).toBe("MONDAY");
    expect(weekdayOfIsoDate("2026-10-24")).toBe("SATURDAY");
    expect(weekdayOfIsoDate("2026-10-25")).toBe("SUNDAY");
    expect(weekdayOfIsoDate("2026-01-01")).toBe("THURSDAY");
    expect(weekdayOfIsoDate("2024-02-29")).toBe("THURSDAY");
  });

  it("returns a valid weekday name for a full week", () => {
    const names = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ];
    // 2026-10-19 is a Monday; walk forward seven days.
    for (let i = 0; i < 7; i++) {
      const day = 19 + i;
      const iso = `2026-10-${String(day).padStart(2, "0")}`;
      expect(weekdayOfIsoDate(iso)).toBe(names[(1 + i) % 7]);
    }
  });
});
