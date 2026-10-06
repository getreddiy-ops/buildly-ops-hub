// Existing HighLevel checkout, verified October 6, 2026.
// HighLevel and its Stripe connection remain the subscription system of record.
export const FASTTRACT_CHECKOUT_URL = "https://api.fasttract.org/payment-link/6a98d6f9f9c8c807930bb9ab";
export const SALES_PLANS = [
  { name: "FastTract Basic", monthly: 197, yearly: 1970, description: "Contractor website and core operations." },
  { name: "FastTract Pro", monthly: 297, yearly: 2970, description: "Everything in Basic, with advanced follow-up and automation." },
  { name: "FastTract Enterprise", monthly: 397, yearly: 3970, description: "Everything in Pro, with team management, reporting, and premium onboarding." },
] as const;
