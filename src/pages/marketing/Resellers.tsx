import { Link } from "react-router-dom";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";

export default function Resellers() {
  return (
    <MarketingShell>
      <SEO
        title="ContractorOS Reseller Program | Earn Recurring Revenue — GetReddiy"
        description="Resell ContractorOS to contractors and earn recurring revenue. White-glove onboarding, agent portal, and payout tracking included."
        path="/resellers"
      />
      <section className="mx-auto max-w-3xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          ContractorOS Reseller Program
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Bring ContractorOS to contractors in your network and earn recurring revenue on every account. Built-in agent portal tracks your clients, leads, and payouts.
        </p>
        <div className="mt-8"><Button size="lg" asChild><Link to="/contact">Apply now</Link></Button></div>
      </section>
    </MarketingShell>
  );
}
