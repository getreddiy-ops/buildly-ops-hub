import Stripe from "npm:stripe@17";

export type Tier = "base" | "plus" | "premium";

export const TIER_PRICE_ENV: Record<Tier, string> = {
  base: "STRIPE_PRICE_BASE",
  plus: "STRIPE_PRICE_PLUS",
  premium: "STRIPE_PRICE_PREMIUM",
};

/** Logical price identifiers stored in subscriptions.price_id (shared with the frontend tier map). */
export const TIER_LOGICAL_PRICE: Record<Tier, string> = {
  base: "contractor_os_pro_monthly",
  plus: "contractor_os_plus_monthly",
  premium: "contractor_os_premium_monthly",
};

export const TIER_LOGICAL_PRODUCT: Record<Tier, string> = {
  base: "contractor_os_pro",
  plus: "contractor_os_plus",
  premium: "contractor_os_premium",
};

let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = Deno.env.get("STRIPE_SECRET_KEY");
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" as any });
  }
  return _stripe;
}

export function stripeEnvironment(): "live" | "sandbox" {
  const env = (Deno.env.get("STRIPE_ENV") ?? "live").toLowerCase();
  return env === "test" || env === "sandbox" ? "sandbox" : "live";
}

/** Server-side validation: resolve a plan key to its configured Stripe Price ID. */
export function priceIdForTier(tier: string): { tier: Tier; priceId: string } {
  if (tier !== "base" && tier !== "plus" && tier !== "premium") {
    throw new Error(`Unknown plan "${tier}"`);
  }
  const priceId = Deno.env.get(TIER_PRICE_ENV[tier]);
  if (!priceId) throw new Error(`${TIER_PRICE_ENV[tier]} is not configured`);
  return { tier, priceId };
}

export function tierFromStripePrice(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  for (const tier of ["base", "plus", "premium"] as Tier[]) {
    if (Deno.env.get(TIER_PRICE_ENV[tier]) === priceId) return tier;
  }
  return null;
}

export function appUrl(): string {
  const url = Deno.env.get("PUBLIC_APP_URL");
  if (!url) throw new Error("PUBLIC_APP_URL is not configured");
  return url.replace(/\/+$/, "");
}
