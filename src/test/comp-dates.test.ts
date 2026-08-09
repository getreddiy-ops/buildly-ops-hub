import { describe, expect, it } from "vitest";
import {
  expirationFromDays,
  extendedExpiration,
  requireWholeDays,
} from "../../supabase/functions/_shared/comp-dates";

describe("complimentary subscription dates", () => {
  const now = new Date("2026-08-09T20:00:00.000Z");

  it("creates a finite expiration from the assignment time", () => {
    expect(expirationFromDays(now, 7, 3650)).toBe("2026-08-16T20:00:00.000Z");
  });

  it("extends an active subscription from its current expiration", () => {
    expect(extendedExpiration(now, "2026-08-20T20:00:00.000Z", 7, 365)).toBe(
      "2026-08-27T20:00:00.000Z",
    );
  });

  it("extends an expired subscription from now instead of an old date", () => {
    expect(extendedExpiration(now, "2026-07-01T20:00:00.000Z", 7, 365)).toBe(
      "2026-08-16T20:00:00.000Z",
    );
  });

  it("rejects fractional, negative, and excessive day counts", () => {
    expect(() => requireWholeDays(1.5, 365)).toThrow("whole number");
    expect(() => requireWholeDays(-1, 365)).toThrow("whole number");
    expect(() => requireWholeDays(366, 365)).toThrow("whole number");
  });
});
