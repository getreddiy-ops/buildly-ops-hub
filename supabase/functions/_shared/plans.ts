// FastTract plan catalog shared by edge functions and the web app (src/lib/tiers.ts re-exports it).
// No Deno or npm imports, so vitest can import it too.
// Internal ids stay stable across payment providers; each maps to a Stripe price set as a function secret.

export type InternalTier = "base" | "plus" | "premium";
export type BillingInterval = "month" | "year";

export interface PlanPrice {
  tier: InternalTier;
  interval: BillingInterval;
  /** FastTract's id, stored on subscription rows. */
  priceId: string;
  productId: string;
  /** Edge-function secret holding the Stripe price id. */
  secretName: string;
  /** Whole US dollars. */
  amount: number;
}

export const PLAN_NAMES: Record<InternalTier, string> = {
  base: "FastTract Basic",
  plus: "FastTract Pro",
  premium: "FastTract Enterprise",
};

export const PLAN_PRICES: PlanPrice[] = [
  { tier: "base", interval: "month", priceId: "contractor_os_pro_monthly", productId: "contractor_os_pro", secretName: "STRIPE_PRICE_BASIC_MONTHLY", amount: 197 },
  { tier: "base", interval: "year", priceId: "contractor_os_pro_yearly", productId: "contractor_os_pro", secretName: "STRIPE_PRICE_BASIC_YEARLY", amount: 1970 },
  { tier: "plus", interval: "month", priceId: "contractor_os_plus_monthly", productId: "contractor_os_plus", secretName: "STRIPE_PRICE_PRO_MONTHLY", amount: 297 },
  { tier: "plus", interval: "year", priceId: "contractor_os_plus_yearly", productId: "contractor_os_plus", secretName: "STRIPE_PRICE_PRO_YEARLY", amount: 2970 },
  { tier: "premium", interval: "month", priceId: "contractor_os_premium_monthly", productId: "contractor_os_premium", secretName: "STRIPE_PRICE_ENTERPRISE_MONTHLY", amount: 397 },
  { tier: "premium", interval: "year", priceId: "contractor_os_premium_yearly", productId: "contractor_os_premium", secretName: "STRIPE_PRICE_ENTERPRISE_YEARLY", amount: 3970 },
];

export const TRIAL_DAYS = 7;

/** Matches a FastTract price id or product id (older rows stored the product id). */
export function findPlanPrice(id: string | null | undefined): PlanPrice | null {
  if (!id) return null;
  return PLAN_PRICES.find((p) => p.priceId === id) ?? PLAN_PRICES.find((p) => p.productId === id && p.interval === "month") ?? null;
}

export function planPrice(tier: InternalTier, interval: BillingInterval): PlanPrice {
  return PLAN_PRICES.find((p) => p.tier === tier && p.interval === interval)!;
}
