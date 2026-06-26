import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function EstimateSoftware() {
  return (
    <MarketingShell>
      <SEO
        title="Construction Estimate Software | AI Contractor Estimating — ContractorOS"
        description="ContractorOS is AI contractor estimating software. Draft construction estimates from photos, apply your unit pricing, send branded proposals, and convert to jobs."
        path="/estimate-software"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Construction Estimate Software With AI
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          ContractorOS drafts estimates from photos and your unit pricing. You approve, send a branded proposal, capture an e-signature, and convert it to a scheduled job — all in one app.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
      </section>

      <FAQ
        items={[
          { q: "Can I save unit pricing and assemblies?", a: "Yes. Save your materials, labor rates, and pre-built assemblies so estimates draft in seconds." },
          { q: "Does it handle change orders?", a: "Yes. Change orders flow into the live estimate and onto the final invoice automatically." },
          { q: "Do customers e-sign estimates?", a: "Yes. Send a branded proposal with an e-signature link. Signed estimates convert to jobs in one click." },
        ]}
      />
    </MarketingShell>
  );
}
