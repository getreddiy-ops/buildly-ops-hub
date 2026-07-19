export function getBillingEnvironment(): "sandbox" | "live" {
  return import.meta.env.VITE_STRIPE_ENV === "sandbox" ? "sandbox" : "live";
}
