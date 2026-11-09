import { describe, expect, it } from "vitest";
import { formatAddress, parseAddress } from "./AddressFields";

describe("address parts", () => {
  it("round trips apartment lines, full state names and ZIP+4", () => {
    const parts = { address: "123 Main St\nApt 2", addressCity: "Portland", addressState: "Oregon", addressZip: "97201-1234" };
    expect(parseAddress(formatAddress(parts))).toEqual(parts);
  });
  it("preserves unfamiliar legacy addresses without guessing", () => {
    const legacy = "Business Park, Building C, overseas";
    expect(formatAddress(parseAddress(legacy))).toBe(legacy);
  });
});
