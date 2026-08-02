import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { SEO } from "@/components/SEO";

export default function Refunds() {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <SEO title="Refund Policy — FastTract" description="FastTract offers a 30-day money-back guarantee. Learn how to request a refund." path="/legal/refunds" />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 prose prose-invert">
        <h1 className="text-4xl font-semibold mb-2">Refund Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mt-6">FastTract is operated by Lynchmarc LLC. We want you to be satisfied with your subscription.</p>

        <h2 className="mt-8 text-2xl font-semibold">30-Day Money-Back Guarantee</h2>
        <p>If you are not satisfied with your purchase, you may request a full refund within <strong>30 days</strong> of the order date.</p>

        <h2 className="mt-8 text-2xl font-semibold">How to Request a Refund</h2>
        <p>Payments are processed by Stripe on behalf of Lynchmarc LLC. To request a refund:</p>
        <ul className="list-disc pl-6">
          <li>Open Billing in the app and use “Manage subscription” to review your invoices, or</li>
          <li>Email us at <a href="mailto:getreddiy@gmail.com" className="text-primary">getreddiy@gmail.com</a> and we will help you initiate the refund.</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold">Additional Information</h2>
        <p>Approved refunds are returned to the original payment method via Stripe, typically within 5–10 business days. Cancelling your subscription stops future renewal charges; you will retain access to paid features until the end of the current billing period.</p>

        <h2 className="mt-8 text-2xl font-semibold">Contact</h2>
        <p>Lynchmarc LLC — <a href="mailto:getreddiy@gmail.com" className="text-primary">getreddiy@gmail.com</a> — <a href="tel:+15037527402" className="text-primary">503-752-7402</a></p>
      </main>
      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-4 justify-between">
          <div>© {new Date().getFullYear()} Lynchmarc LLC</div>
          <div className="flex gap-4">
            <Link to="/legal/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/legal/refunds" className="hover:text-foreground">Refunds</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
