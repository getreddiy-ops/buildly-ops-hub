import { Link } from "react-router-dom";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function AIPhoneAgent() {
  return (
    <MarketingShell>
      <SEO
        title="Optional AI Phone Answering for Contractors | FastTract"
        description="AI phone answering is planned as an optional FastTract feature. Start with the core contractor workflows without an AI provider."
        path="/ai-phone-agent"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Planned optional feature</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Phone Answering for Contractors
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          AI phone answering is not available in the current launch plan. FastTract’s customer, estimate, job, scheduling, and crew workflows work without it. Optional AI connections are planned for a later release.
        </p>
        <Button size="lg" className="mt-8" asChild><Link to="/pricing">See the core plan</Link></Button>
      </section>
      <FAQ
        items={[
          { q: "Can I get a FastTract AI phone number today?", a: "No. Phone answering is planned as an optional feature and is not currently available." },
          { q: "Do I need AI to use FastTract?", a: "No. The core contractor workflows are designed to work without an AI provider." },
          { q: "Will I be required to buy an AI service later?", a: "No. Any future AI connections are intended to be optional. Bring-your-own AI connections are planned, but are not available yet." },
        ]}
      />
    </MarketingShell>
  );
}
