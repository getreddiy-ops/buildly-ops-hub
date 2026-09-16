import { describe, it, expect } from "vitest";
import { previewOrConfirm } from "./_helpers";

describe("previewOrConfirm (MCP write-tool confirmation gate)", () => {
  it("blocks the write and returns a preview when confirm is not true", () => {
    const result = previewOrConfirm(undefined, "create customer \"Acme\"", { name: "Acme" });
    expect(result).not.toBeNull();
    expect(result?.structuredContent).toEqual({ pending: true, preview: { name: "Acme" } });
    expect(result?.content[0].text).toContain("Not yet applied");
    expect(result?.content[0].text).toContain("confirm: true");
  });

  it("blocks the write when confirm is explicitly false", () => {
    const result = previewOrConfirm(false, "delete something", {});
    expect(result).not.toBeNull();
  });

  it("allows the write to proceed only when confirm is exactly true", () => {
    const result = previewOrConfirm(true, "create customer \"Acme\"", { name: "Acme" });
    expect(result).toBeNull();
  });

  it("never returns null for any falsy/non-boolean confirm value", () => {
    for (const value of [undefined, false, 0, "", null] as unknown as (boolean | undefined)[]) {
      expect(previewOrConfirm(value, "do something", {})).not.toBeNull();
    }
  });
});
