import Stripe from "npm:stripe@^22";

export type BillingEnvironment = "sandbox" | "live";
export type InternalTier = "base" | "plus" | "premium";

export const INTERNAL_PLANS: Record<InternalTier, { priceId: string; productId: string; secretName: string }> = {
  base: {
    priceId: "contractor_os_pro_monthly",
    productId: "contractor_os_pro",
    secretName: "STRIPE_PRICE_BASE",
  },
  plus: {
    priceId: "contractor_os_plus_monthly",
    productId: "contractor_os_plus",
    secretName: "STRIPE_PRICE_PLUS",
  },
  premium: {
    priceId: "contractor_os_premium_monthly",
    productId: "contractor_os_premium",
    secretName: "STRIPE_PRICE_PREMIUM",
  },
};

export function getBillingEnvironment(): BillingEnvironment {
  return Deno.env.get("STRIPE_ENV") === "sandbox" ? "sandbox" : "live";
}

export function getStripe(): Stripe {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey);
}

export function resolveInternalPlan(internalPriceId: string) {
  const entry = Object.entries(INTERNAL_PLANS).find(([, plan]) =>
    plan.priceId === internalPriceId || plan.productId === internalPriceId
  );
  if (!entry) throw new Error("Unknown FastTract plan");
  const [tier, plan] = entry as [InternalTier, (typeof INTERNAL_PLANS)[InternalTier]];
  const stripePriceId = Deno.env.get(plan.secretName);
  if (!stripePriceId) throw new Error(`${plan.secretName} is not configured`);
  return { tier, ...plan, stripePriceId };
}

export function resolveStripePlan(stripePriceId: string) {
  for (const [tier, plan] of Object.entries(INTERNAL_PLANS) as Array<
    [InternalTier, (typeof INTERNAL_PLANS)[InternalTier]]
  >) {
    if (Deno.env.get(plan.secretName) === stripePriceId) {
      return { tier, ...plan, stripePriceId };
    }
  }
  return null;
}
