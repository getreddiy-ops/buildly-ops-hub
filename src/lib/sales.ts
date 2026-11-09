import { PLAN_NAMES, TIER_DESCRIPTIONS, TIER_ORDER, planPrice } from "./tiers";

export const FASTTRACT_SALES_EMAIL = "getreddiy@gmail.com";
export const FASTTRACT_SALES_MAILTO = `mailto:${FASTTRACT_SALES_EMAIL}?subject=${encodeURIComponent("FastTract plan question")}`;
export const FASTTRACT_BILLING_MAILTO = `mailto:${FASTTRACT_SALES_EMAIL}?subject=${encodeURIComponent("FastTract subscription and app access")}`;

export const SALES_PLANS = TIER_ORDER.map((tier) => ({
  tier,
  name: PLAN_NAMES[tier],
  monthly: planPrice(tier, "month").amount,
  yearly: planPrice(tier, "year").amount,
  description: TIER_DESCRIPTIONS[tier],
}));
