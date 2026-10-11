import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("iOS privacy configuration", () => {
  const source = readFileSync(resolve(process.cwd(), "ios/App/App/Info.plist"), "utf8");
  const plist = new DOMParser().parseFromString(source, "application/xml");

  it("is valid XML", () => {
    expect(plist.querySelector("parsererror")).toBeNull();
    expect(plist.documentElement.tagName).toBe("plist");
  });

  it.each([
    "NSCameraUsageDescription",
    "NSMicrophoneUsageDescription",
    "NSLocationWhenInUseUsageDescription",
  ])("provides a nonempty purpose string for %s", (permission) => {
    const keys = Array.from(plist.querySelectorAll("plist > dict > key"));
    const matches = keys.filter((key) => key.textContent === permission);
    expect(matches).toHaveLength(1);
    const value = matches[0]?.nextElementSibling;
    expect(value?.tagName).toBe("string");
    expect(value?.textContent?.trim().length).toBeGreaterThan(0);
  });
});
