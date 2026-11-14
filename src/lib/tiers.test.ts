import { describe, expect, it } from "vitest";
import { PLAN_PRICES, findPlanPrice, tierFromPriceId, hasAssistant, hasPhoneAssistant } from "./tiers";

describe("FastTract plan catalog", () => {
  it("has a monthly and a yearly price per tier at launch prices, each with its own Stripe secret", () => {
    expect(PLAN_PRICES.map((p) => `${p.tier}/${p.interval}=${p.amount}`)).toEqual([
      "base/month=197", "base/year=1970", "plus/month=297", "plus/year=2970", "premium/month=397", "premium/year=3970",
    ]);
    expect(new Set(PLAN_PRICES.map((p) => p.secretName)).size).toBe(6);
    expect(new Set(PLAN_PRICES.map((p) => p.priceId)).size).toBe(6);
  });
  it("maps yearly, monthly and legacy product ids to the right tier", () => {
    expect(tierFromPriceId("contractor_os_plus_yearly")).toBe("plus");
    expect(tierFromPriceId("contractor_os_premium_monthly")).toBe("premium");
    expect(tierFromPriceId("contractor_os_pro")).toBe("base");
    expect(findPlanPrice("pri_unknown")).toBeNull();
  });
  it("keeps the feature gates: assistant from Pro, phone assistant on Enterprise", () => {
    expect([hasAssistant("base"), hasAssistant("plus"), hasPhoneAssistant("plus"), hasPhoneAssistant("premium")]).toEqual([false, true, false, true]);
  });
});
