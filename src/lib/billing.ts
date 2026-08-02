/**
 * Billing environment for the active payment provider (Stripe).
 * The server-side STRIPE_ENV secret is the source of truth; the browser only
 * needs to know which subscription rows to read, which are written as "live"
 * for the production Stripe account.
 */
export function getBillingEnvironment(): "live" | "sandbox" {
  const env = (import.meta.env.VITE_BILLING_ENV as string | undefined)?.toLowerCase();
  return env === "sandbox" || env === "test" ? "sandbox" : "live";
}
