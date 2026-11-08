import { describe, it, expect } from "vitest";
import {
  IsoDateTimeStringSchema,
  IsoDateStringSchema,
  DateRangeSchema,
  isValidISODateString,
  isValidISODateOnlyString,
  addDurationToISO
} from "../src/index.js";

describe("Date & Timezone Contracts", () => {
  it("should validate full ISO 8601 UTC datetime strings", () => {
    const valid = "2026-11-08T06:30:00.000Z";
    expect(IsoDateTimeStringSchema.parse(valid)).toBe(valid);
    expect(isValidISODateString(valid)).toBe(true);

    expect(() => IsoDateTimeStringSchema.parse("2026-11-08")).toThrow();
    expect(() => IsoDateTimeStringSchema.parse("invalid-date")).toThrow();
    expect(isValidISODateString("2026-11-08")).toBe(false);
  });

  it("should validate calendar dates in YYYY-MM-DD format", () => {
    const valid = "2026-11-08";
    expect(IsoDateStringSchema.parse(valid)).toBe(valid);
    expect(isValidISODateOnlyString(valid)).toBe(true);

    expect(() => IsoDateStringSchema.parse("08-11-2026")).toThrow();
    expect(() => IsoDateStringSchema.parse("2026/11/08")).toThrow();
    expect(isValidISODateOnlyString("not-a-date")).toBe(false);
  });

  it("should validate date ranges and enforce chronological order", () => {
    const validRange = {
      from: "2026-11-08T10:00:00.000Z",
      to: "2026-11-08T18:00:00.000Z"
    };
    expect(DateRangeSchema.parse(validRange)).toEqual(validRange);

    const sameTimeRange = {
      from: "2026-11-08T10:00:00.000Z",
      to: "2026-11-08T10:00:00.000Z"
    };
    expect(DateRangeSchema.parse(sameTimeRange)).toEqual(sameTimeRange);

    // Inverted range must be rejected
    const invertedRange = {
      from: "2026-11-08T18:00:00.000Z",
      to: "2026-11-08T10:00:00.000Z"
    };
    expect(() => DateRangeSchema.parse(invertedRange)).toThrow(/'from' date must be before or equal to 'to' date/);
  });

  it("should accurately compute duration offsets in ISO format", () => {
    const start = "2026-11-08T00:00:00.000Z";
    expect(addDurationToISO(start, 30, "minutes")).toBe("2026-11-08T00:30:00.000Z");
    expect(addDurationToISO(start, 4, "hours")).toBe("2026-11-08T04:00:00.000Z");
    expect(addDurationToISO(start, 2, "days")).toBe("2026-11-10T00:00:00.000Z");

    expect(() => addDurationToISO("invalid", 1, "days")).toThrow();
  });
});

