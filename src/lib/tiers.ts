// Single source of truth for FastTract plans, shared with the edge functions.
import {
  PLAN_NAMES,
  PLAN_PRICES,
  TRIAL_DAYS,
  findPlanPrice,
  planPrice,
  type BillingInterval,
  type InternalTier,
  type PlanPrice,
} from "../../supabase/functions/_shared/plans";

export type Tier = InternalTier;
export type { BillingInterval, PlanPrice };
export { PLAN_NAMES, PLAN_PRICES, TRIAL_DAYS, findPlanPrice, planPrice };

export const TIER_ORDER: Tier[] = ["base", "plus", "premium"];

export const TIER_DESCRIPTIONS: Record<Tier, string> = {
  base: "Customers, estimates, jobs, time tracking and invoicing for one business.",
  plus: "Everything in Basic, plus the FastTract assistant and AI estimating with your own AI provider.",
  premium: "Everything in Pro, plus the AI phone assistant, team management and premium onboarding.",
};

export function tierFromPriceId(priceId: string | null | undefined): Tier | null {
  return findPlanPrice(priceId)?.tier ?? null;
}

// Feature gates.
export function hasAssistant(tier: Tier | null): boolean {
  return tier === "plus" || tier === "premium";
}
export function hasPhoneAssistant(tier: Tier | null): boolean {
  return tier === "premium";
}
