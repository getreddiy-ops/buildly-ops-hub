import { getBillingEnvironment } from "@/lib/billing";

/** Shown while Stripe runs in test mode, so nobody mistakes a test checkout for a real charge. */
export function PaymentTestModeBanner() {
  if (getBillingEnvironment() !== "sandbox") return null;
  return (
    <div className="w-full border-b border-orange-300 bg-orange-100 px-4 py-2 text-center text-sm text-orange-900">
      Billing is in test mode. Use Stripe test card 4242 4242 4242 4242; no real charges are made.
    </div>
  );
}
