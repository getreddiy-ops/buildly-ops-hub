import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function InvoiceSoftware() {
  return (
    <MarketingShell>
      <SEO
        title="Contractor Invoice Software | Send Invoices & Collect Payment — FastTract"
        description="FastTract is contractor invoice software. Convert estimates to invoices, send by email or text, and collect online payments. Tied to every job, customer, and crew hour."
        path="/invoice-software"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Contractor Invoice Software
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Convert approved estimates to invoices in one click. Send by email or text. Collect deposits up front and balances on completion. Track AR per customer.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
      </section>

      <FAQ
        items={[
          { q: "Can I collect deposits?", a: "Yes. Deposit, progress, and final invoices are built in. Send a payment link by email or text." },
          { q: "Do invoices roll up into job costing?", a: "Yes. Invoices, crew hours, and materials roll into a job-cost dashboard so you see margin in real time." },
          { q: "Does it integrate with accounting?", a: "Exports are available, and direct integrations are on the roadmap." },
        ]}
      />
    </MarketingShell>
  );
}
