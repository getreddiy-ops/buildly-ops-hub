import { describe, expect, it } from "vitest";
import { getSettingsGroup } from "./AppShell";

describe("Settings navigation", () => {
  it("excludes Developer from the shared customer desktop and mobile navigation", () => {
    expect(getSettingsGroup(false).map((item) => item.to)).not.toContain("/app/developer");
  });

  it("includes Developer for platform administrators", () => {
    expect(getSettingsGroup(true).map((item) => item.to)).toContain("/app/developer");
  });
});
