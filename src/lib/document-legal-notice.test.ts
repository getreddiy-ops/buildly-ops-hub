import { describe, expect, it } from "vitest";
import { GENERIC_DOCUMENT_LEGAL_NOTICE } from "./document-legal-notice";

describe("generic document legal notice", () => {
  it("warns that templates require jurisdiction-specific review", () => {
    expect(GENERIC_DOCUMENT_LEGAL_NOTICE).toContain("not legal advice");
    expect(GENERIC_DOCUMENT_LEGAL_NOTICE).toContain("state and local law");
    expect(GENERIC_DOCUMENT_LEGAL_NOTICE).toContain("contractor licensing board");
  });
});
