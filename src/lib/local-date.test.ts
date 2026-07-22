import { describe, expect, it } from "vitest";
import { toLocalDateInputValue } from "./local-date";

describe("toLocalDateInputValue", () => {
  it("uses the user's local calendar day instead of the UTC day", () => {
    const lateLocalEvening = new Date(2026, 6, 21, 23, 30);

    expect(toLocalDateInputValue(lateLocalEvening)).toBe("2026-07-21");
  });

  it("pads single-digit months and days", () => {
    expect(toLocalDateInputValue(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
  });
});
