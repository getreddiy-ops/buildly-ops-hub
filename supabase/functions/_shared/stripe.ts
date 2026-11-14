import Stripe from "npm:stripe@22.6.2";
import { type BillingInterval, type InternalTier, PLAN_PRICES, findPlanPrice } from "./plans.ts";

export type BillingEnvironment = "sandbox" | "live";
export type { BillingInterval, InternalTier };

/** STRIPE_ENV=sandbox for test-mode keys; anything else is live. */
export function getBillingEnvironment(): BillingEnvironment {
  return Deno.env.get("STRIPE_ENV") === "sandbox" ? "sandbox" : "live";
}

export function getStripe(): Stripe {
  const secretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(secretKey);
}

/** FastTract's own price id (e.g. contractor_os_pro_monthly) → the Stripe price configured for it. */
export function resolveInternalPlan(internalPriceId: string) {
  const plan = findPlanPrice(internalPriceId);
  if (!plan) throw new Error("Unknown FastTract plan");
  const stripePriceId = Deno.env.get(plan.secretName);
  if (!stripePriceId) throw new Error(`${plan.secretName} is not configured`);
  return { ...plan, stripePriceId };
}

/** A Stripe price id from a webhook → which FastTract plan it is, or null. */
export function resolveStripePlan(stripePriceId: string) {
  const plan = PLAN_PRICES.find((p) => Deno.env.get(p.secretName) === stripePriceId);
  return plan ? { ...plan, stripePriceId } : null;
}
