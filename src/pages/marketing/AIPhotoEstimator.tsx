import { Link } from "react-router-dom";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function AIPhotoEstimator() {
  return (
    <MarketingShell>
      <SEO
        title="Optional AI Photo Estimator for Contractors | FastTract"
        description="AI photo estimating is planned as an optional FastTract feature. Create and manage contractor estimates with the core plan without AI."
        path="/ai-photo-estimator"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Planned optional feature</p>
        <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Photo Estimating for Contractors
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          AI photo estimating is not available in the current launch plan. You can still create and manage contractor estimates with FastTract Core, without an AI provider.
        </p>
        <Button size="lg" className="mt-8" asChild><Link to="/pricing">See the core plan</Link></Button>
      </section>
      <FAQ
        items={[
          { q: "Can FastTract estimate a job from photos today?", a: "No. AI photo estimating is planned as an optional feature and is not currently available." },
          { q: "Can I create estimates without AI?", a: "Yes. Estimate creation and customer workflows are part of FastTract Core." },
          { q: "Can I bring my own AI provider?", a: "Bring-your-own AI connections are planned for a later release and are not available yet." },
        ]}
      />
    </MarketingShell>
  );
}
