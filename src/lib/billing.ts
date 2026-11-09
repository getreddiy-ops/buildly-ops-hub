/** VITE_STRIPE_ENV=sandbox while FastTract runs Stripe in test mode; live otherwise. Must match STRIPE_ENV on the functions. */
export function getBillingEnvironment(): "sandbox" | "live" {
  return import.meta.env.VITE_STRIPE_ENV === "sandbox" ? "sandbox" : "live";
}
