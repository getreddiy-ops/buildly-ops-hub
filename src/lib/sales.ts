// Online checkout is paused until Stripe subscription billing is live.
// New and existing customers reach FastTract directly to sign up or manage billing.
export const FASTTRACT_SALES_EMAIL = "getreddiy@gmail.com";
export const FASTTRACT_SALES_MAILTO = `mailto:${FASTTRACT_SALES_EMAIL}?subject=${encodeURIComponent("FastTract plan signup")}`;
export const FASTTRACT_BILLING_MAILTO = `mailto:${FASTTRACT_SALES_EMAIL}?subject=${encodeURIComponent("FastTract subscription and app access")}`;
export const SALES_PLANS = [
  { name: "FastTract Basic", monthly: 197, yearly: 1970, description: "Contractor website and core operations." },
  { name: "FastTract Pro", monthly: 297, yearly: 2970, description: "Everything in Basic, with advanced follow-up and automation." },
  { name: "FastTract Enterprise", monthly: 397, yearly: 3970, description: "Everything in Pro, with team management, reporting, and premium onboarding." },
] as const;
