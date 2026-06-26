import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 prose prose-invert">
        <h1 className="text-4xl font-semibold mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <h2 className="mt-8 text-2xl font-semibold">1. Who We Are</h2>
        <p>Contractor OS is provided by Morgan Marc Lynch ("we", "us", "our"). By creating an account or using the service, you are entering into an agreement with Morgan Marc Lynch.</p>

        <h2 className="mt-8 text-2xl font-semibold">2. Acceptance</h2>
        <p>By accessing or using Contractor OS, you agree to be bound by these Terms. If you do not agree, do not use the service. You confirm you are of legal age and, if signing up on behalf of an organization, that you have authority to bind it.</p>

        <h2 className="mt-8 text-2xl font-semibold">3. The Service</h2>
        <p>Contractor OS is a business operating system for contractors providing CRM, estimates, jobs, time tracking, job costing, and optional AI assistant and phone answering features. Specific features depend on your subscription tier.</p>

        <h2 className="mt-8 text-2xl font-semibold">4. Acceptable Use</h2>
        <p>You must not misuse the service. Prohibited activity includes: unlawful use, fraud or spam, infringing intellectual property, distributing malware, probing or scraping the service, attempting to bypass security or technical limits, reselling or redistributing the service, or reverse engineering it.</p>

        <h2 className="mt-8 text-2xl font-semibold">5. AI Features</h2>
        <p>The AI Assistant and Phone Assistant may produce inaccurate or incomplete outputs. You are responsible for your prompts, for verifying outputs before acting on them, for ensuring you have rights to any content you submit, and for compliance with applicable laws when using these features. AI outputs are not legal, financial, or other regulated professional advice. We may filter, moderate, or restrict outputs and content as needed.</p>

        <h2 className="mt-8 text-2xl font-semibold">6. Your Account and Content</h2>
        <p>You are responsible for maintaining the confidentiality of your credentials and for activity under your account. You retain ownership of your content; you grant us a limited license to host and process it solely to provide the service.</p>

        <h2 className="mt-8 text-2xl font-semibold">7. Intellectual Property</h2>
        <p>We retain all rights to the service, including software, documentation, and branding. We grant you a limited, non-exclusive, non-transferable right to use the service within your subscribed plan.</p>

        <h2 className="mt-8 text-2xl font-semibold">8. Payments, Subscriptions, and Taxes</h2>
        <p>Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.</p>
        <p>Subscription fees, billing cycles, renewals, cancellations, taxes, and refunds are governed by Paddle's <a href="https://www.paddle.com/legal/checkout-buyer-terms" className="text-primary" target="_blank" rel="noreferrer">Buyer Terms</a>. Cancelling a subscription stops future renewals; you retain access until the end of the current paid period. Upgrades and downgrades take effect immediately.</p>

        <h2 className="mt-8 text-2xl font-semibold">9. Service Levels</h2>
        <p>We work to keep Contractor OS available but do not guarantee uninterrupted or error-free performance.</p>

        <h2 className="mt-8 text-2xl font-semibold">10. Suspension and Termination</h2>
        <p>We may suspend or terminate access for material breach, non-payment, security or fraud risk, or repeated or serious policy violations. On termination, your right to use the service ends; you may request a reasonable export of your data before deletion.</p>

        <h2 className="mt-8 text-2xl font-semibold">11. Warranties and Liability</h2>
        <p>To the fullest extent permitted by law, the service is provided "as is" without implied warranties of merchantability or fitness for a particular purpose. Our aggregate liability is capped at the fees you paid in the 12 months preceding the claim. We are not liable for indirect, consequential, or special damages, including loss of profits, data, or goodwill. Nothing limits liability for fraud, death, or personal injury where prohibited by law.</p>

        <h2 className="mt-8 text-2xl font-semibold">12. Indemnity</h2>
        <p>You will indemnify us against claims arising from your content, unlawful use, or breach of these Terms.</p>

        <h2 className="mt-8 text-2xl font-semibold">13. Governing Law</h2>
        <p>These Terms are governed by the laws of the jurisdiction in which Morgan Marc Lynch resides, without regard to conflict of laws principles. Disputes will be resolved in the courts of that jurisdiction.</p>

        <h2 className="mt-8 text-2xl font-semibold">14. Changes</h2>
        <p>We may update these Terms; continued use after changes constitutes acceptance.</p>

        <h2 className="mt-8 text-2xl font-semibold">15. Contact</h2>
        <p>Morgan Marc Lynch — <a href="mailto:getreddiy@gmail.com" className="text-primary">getreddiy@gmail.com</a></p>
      </main>
      <footer className="border-t border-border mt-12">
        <div className="mx-auto max-w-7xl px-4 py-8 text-sm text-muted-foreground sm:px-6 lg:px-8 flex flex-col sm:flex-row gap-4 justify-between">
          <div>© {new Date().getFullYear()} Morgan Marc Lynch</div>
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
