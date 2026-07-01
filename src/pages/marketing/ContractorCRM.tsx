import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function ContractorCRMPage() {
  return (
    <MarketingShell>
      <SEO
        title="Contractor CRM | Lead & Customer Management for Contractors — FastTract"
        description="FastTract is a contractor CRM built around field work. Capture every lead, centralize customer communication, and tie every estimate, job, and invoice to the right customer."
        path="/contractor-crm"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          The CRM Built for Contractors
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Every call, text, photo, estimate, job, and invoice on one customer record. FastTract replaces the generic sales CRM with one built for the field.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
      </section>

      <FAQ
        items={[
          { q: "How is this different from HubSpot or Salesforce?", a: "Generic CRMs are built for inside sales. FastTract is built for contractors — with estimates, jobs, GPS-verified crew time, invoices, and an AI phone agent tied to the same customer." },
          { q: "Can I import my existing customers?", a: "Yes. Import a CSV of customers and leads to get started." },
          { q: "Does the AI Phone Agent write into the CRM?", a: "Yes. Every answered call creates or updates a customer record with the conversation summary attached." },
        ]}
      />
    </MarketingShell>
  );
}
