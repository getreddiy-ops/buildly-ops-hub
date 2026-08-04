import { describe, it, expect } from "vitest";
import {
  PRODUCTION_ORIGIN,
  billingPortalReturnUrl,
  checkoutCancelUrl,
  checkoutSuccessUrl,
  isAllowedOrigin,
  resolveAppOrigin,
} from "../../supabase/functions/_shared/app-origin";

function reqWith(headers: Record<string, string>) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { headers: { get: (n: string) => map.get(n.toLowerCase()) ?? null } };
}

describe("stripe redirect origins", () => {
  it("uses contractoros.online for success and cancel URLs", () => {
    const origin = resolveAppOrigin(reqWith({ origin: "https://contractoros.online" }));
    expect(origin).toBe("https://contractoros.online");
    expect(checkoutSuccessUrl(origin)).toBe(
      "https://contractoros.online/app/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
    );
    expect(checkoutCancelUrl(origin)).toBe(
      "https://contractoros.online/app/billing?checkout=cancelled",
    );
    expect(billingPortalReturnUrl(origin)).toBe("https://contractoros.online/app/billing");
  });

  it("keeps www.contractoros.online", () => {
    expect(resolveAppOrigin(reqWith({ origin: "https://www.contractoros.online/" }))).toBe(
      "https://www.contractoros.online",
    );
  });

  it("falls back to production for non-allowlisted origins", () => {
    expect(resolveAppOrigin(reqWith({ origin: "https://fasttract.org" }))).toBe(PRODUCTION_ORIGIN);
    expect(resolveAppOrigin(reqWith({ origin: "https://evil.example.com" }))).toBe(
      PRODUCTION_ORIGIN,
    );
    expect(resolveAppOrigin(null, "https://fasttract.org")).toBe(PRODUCTION_ORIGIN);
    expect(resolveAppOrigin(null, null)).toBe(PRODUCTION_ORIGIN);
  });

  it("allows the lovable preview origin", () => {
    const preview = "https://id-preview--abc.lovable.app";
    expect(isAllowedOrigin(preview)).toBe(true);
    expect(resolveAppOrigin(reqWith({ origin: preview }))).toBe(preview);
  });

  it("rejects http and malformed origins", () => {
    expect(isAllowedOrigin("http://contractoros.online")).toBe(false);
    expect(isAllowedOrigin("not-a-url")).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });

  it("falls back to referer when origin header is missing", () => {
    expect(
      resolveAppOrigin(reqWith({ referer: "https://contractoros.online/pricing" })),
    ).toBe("https://contractoros.online");
  });
});
