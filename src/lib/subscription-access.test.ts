import { describe, expect, it } from "vitest";
import { hasSubscriptionAccess } from "./subscription-access";

const NOW = new Date("2026-07-20T12:00:00Z").getTime();
const FUTURE = "2026-08-20T12:00:00Z";

describe("hasSubscriptionAccess", () => {
  it.each(["active", "trialing", "past_due"])(
    "grants current %s subscriptions",
    (status) => {
      expect(hasSubscriptionAccess({ status, current_period_end: FUTURE }, NOW)).toBe(true);
    },
  );

  it("keeps access during a scheduled cancellation because Paddle still reports active", () => {
    expect(hasSubscriptionAccess({ status: "active", current_period_end: FUTURE }, NOW)).toBe(true);
  });

  it("denies access immediately once Paddle reports canceled", () => {
    expect(hasSubscriptionAccess({ status: "canceled", current_period_end: FUTURE }, NOW)).toBe(false);
  });

  it("denies access after the paid period expires", () => {
    expect(
      hasSubscriptionAccess(
        { status: "active", current_period_end: "2026-07-19T12:00:00Z" },
        NOW,
      ),
    ).toBe(false);
  });
});
