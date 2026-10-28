import { describe, expect, it } from "vitest";
import { localDateTimeValue, validatePastTime } from "./manual-time";
const now = new Date(2026,9,28,12).getTime();
describe("past job time", () => {
  it("converts device-local times to UTC and calculates overnight work", () => {
    const result = validatePastTime("2026-10-20T22:00", "2026-10-21T06:00", now);
    expect(result.hours).toBe(8);
    expect(result.clockIn).toBe(new Date(2026,9,20,22).toISOString());
    expect(result.clockOut).toBe(new Date(2026,9,21,6).toISOString());
  });
  it.each([["", "2026-10-21T06:00"], ["invalid", "2026-10-21T06:00"], ["2026-02-30T08:00", "2026-03-03T09:00"]])("rejects invalid input %s", (start,end) => expect(() => validatePastTime(start,end,now)).toThrow());
  it("rejects a zero-length or reversed shift", () => {
    expect(() => validatePastTime("2026-10-20T09:00","2026-10-20T09:00",now)).toThrow(/after/);
    expect(() => validatePastTime("2026-10-20T09:00","2026-10-20T08:00",now)).toThrow(/after/);
  });
  it("rejects future time", () => expect(() => validatePastTime("2026-10-28T09:00","2026-10-28T13:00",now)).toThrow(/past/));
  it("formats the local calendar date without a UTC day shift", () => expect(localDateTimeValue(new Date(2026,9,20,23,45))).toBe("2026-10-20T23:45"));
});
