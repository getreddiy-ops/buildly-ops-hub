// Single source of truth for Contractor OS subscription tiers.
// price_id values come from Paddle (created via create_product).

export type Tier = "base" | "plus" | "premium";

export const TIERS: Record<Tier, { name: string; price: number; priceId: string; productId: string }> = {
  base: {
    name: "Contractor OS",
    price: 69,
    priceId: "contractor_os_pro_monthly",
    productId: "contractor_os_pro",
  },
  plus: {
    name: "Contractor OS Plus",
    price: 169,
    priceId: "contractor_os_plus_monthly",
    productId: "contractor_os_plus",
  },
  premium: {
    name: "Contractor OS Premium",
    price: 269,
    priceId: "contractor_os_premium_monthly",
    productId: "contractor_os_premium",
  },
};

export function tierFromPriceId(priceId: string | null | undefined): Tier | null {
  if (!priceId) return null;
  if (priceId === TIERS.premium.priceId || priceId === TIERS.premium.productId) return "premium";
  if (priceId === TIERS.plus.priceId || priceId === TIERS.plus.productId) return "plus";
  if (priceId === TIERS.base.priceId || priceId === TIERS.base.productId) return "base";
  return null;
}

// Feature gates.
export function hasAssistant(tier: Tier | null): boolean {
  return tier === "plus" || tier === "premium";
}
export function hasPhoneAssistant(tier: Tier | null): boolean {
  return tier === "premium";
}
