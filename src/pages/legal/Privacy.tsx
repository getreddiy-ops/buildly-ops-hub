import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-dark text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Logo />
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 prose prose-invert">
        <h1 className="text-4xl font-semibold mb-2">Privacy Notice</h1>
        <p className="text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <p className="mt-6">This Privacy Notice explains how Morgan Marc Lynch ("we", "us", "our"), operating Contractor OS, collects and processes your personal data. We act as the data controller for personal data collected through Contractor OS.</p>

        <h2 className="mt-8 text-2xl font-semibold">1. Data We Collect</h2>
        <ul className="list-disc pl-6">
          <li><strong>Account data:</strong> name, email, login credentials, organization details.</li>
          <li><strong>Business data:</strong> customers, leads, jobs, estimates, invoices, contracts, and related records you input.</li>
          <li><strong>Usage and telemetry:</strong> device identifiers, IP address, browser, pages visited, feature usage.</li>
          <li><strong>Location data:</strong> GPS coordinates submitted by crew during clock-in/clock-out, only when used.</li>
          <li><strong>Support communications:</strong> messages and attachments you send us.</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold">2. Purposes and Legal Bases</h2>
        <ul className="list-disc pl-6">
          <li>Provide and operate the service (performance of contract).</li>
          <li>Authenticate users and secure the platform (legitimate interests, legal obligation).</li>
          <li>Process payments and manage subscriptions (performance of contract — handled by Paddle).</li>
          <li>Customer support and account communications (performance of contract).</li>
          <li>Product improvement and analytics (legitimate interests).</li>
          <li>Marketing communications (consent, where required).</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold">3. Data Sharing</h2>
        <p>We share personal data with:</p>
        <ul className="list-disc pl-6">
          <li><strong>Paddle.com</strong> — our Merchant of Record for sale of subscriptions, billing, tax compliance, and invoicing.</li>
          <li><strong>Service providers / subprocessors</strong> — hosting, database, AI providers (for AI Assistant and Phone Assistant features), telephony providers (Twilio, ElevenLabs) when you enable phone features.</li>
          <li><strong>Professional advisers</strong> — legal and accounting where necessary.</li>
          <li><strong>Authorities</strong> — when required by law.</li>
        </ul>

        <h2 className="mt-8 text-2xl font-semibold">4. Data Retention</h2>
        <p>We retain personal data for as long as your account is active and as needed to provide the service. After account closure, data is deleted or anonymized within a reasonable period, except where retention is required by law.</p>

        <h2 className="mt-8 text-2xl font-semibold">5. Your Rights</h2>
        <p>Subject to applicable law, you may have rights to access, correct, delete, restrict, or export your personal data, and to object to processing or withdraw consent. To exercise these rights, contact us at the address below.</p>

        <h2 className="mt-8 text-2xl font-semibold">6. Security</h2>
        <p>We use appropriate technical and organisational measures including encryption in transit, access controls, and database row-level security to protect your data.</p>

        <h2 className="mt-8 text-2xl font-semibold">7. Cookies</h2>
        <p>We use essential cookies required to operate the service (e.g. authentication). We may use limited analytics cookies to understand usage. You can manage cookies via your browser settings.</p>

        <h2 className="mt-8 text-2xl font-semibold">8. International Transfers</h2>
        <p>Your data may be processed outside your country. Where applicable, we rely on appropriate safeguards such as Standard Contractual Clauses.</p>

        <h2 className="mt-8 text-2xl font-semibold">9. Contact</h2>
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
