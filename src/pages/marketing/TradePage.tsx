import { useLocation, Navigate, Link } from "react-router-dom";
import { tradeBySlug } from "./trades";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-6">
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i} className="flex gap-2"><span className="text-primary">›</span><span>{i}</span></li>
        ))}
      </ul>
    </div>
  );
}

export default function TradePage() {
  const slug = useLocation().pathname.replace(/^\//, "");
  const cfg = tradeBySlug[slug];
  if (!cfg) return <Navigate to="/" replace />;
  const launch = {
    ...cfg,
    title: `${cfg.trade} Contractor Software | CRM, Estimates & Scheduling — FastTract`,
    description: `Manage ${cfg.trade.toLowerCase()} work with FastTract's core customer, estimate, job, scheduling, and crew workflows. Optional AI features are not part of the current launch plan.`,
    h1: `${cfg.trade} Contractor Software for Connected Field Operations`,
    intro: `Keep ${cfg.trade.toLowerCase()} customer records, estimates, jobs, crew schedules, and time tracking together in one workspace. FastTract's core workflows do not require an AI provider.`,
    estimating: ["Create estimates and proposals for customer work", "Keep customer details and work history together", "Review estimate details before sending"],
    phone: ["AI phone answering is planned as an optional feature and is not currently available", "Core customer and job workflows work without an AI provider"],
    faq: [
      { q: `Is FastTract built for ${cfg.trade.toLowerCase()} companies?`, a: "FastTract provides contractor customer, estimate, job, scheduling, and crew workflows in one workspace." },
      { q: "Can I use FastTract without AI?", a: "Yes. AI is not required for the core launch workflows. Optional AI connections are planned for a later release." },
      { q: "Can FastTract answer calls for my business?", a: "AI phone answering is planned as an optional feature and is not currently available." },
      { q: "Can I send invoices and collect payment?", a: "FastTract supports invoices and online payments, subject to your account's payment setup." },
    ],
  };

  return (
    <MarketingShell>
      <SEO
        title={launch.title}
        description={launch.description}
        path={`/${launch.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `FastTract for ${launch.trade} Contractors`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
          description: launch.description,
        }}
      />

      <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 lg:px-8 lg:pt-24">
        <div className="mb-4 inline-flex rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          FastTract for {launch.trade}
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {launch.h1}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{launch.intro}</p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">What slows {launch.trade.toLowerCase()} contractors down</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {launch.painPoints.map((p) => (
            <div key={p} className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">• {p}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">
          How FastTract helps {launch.trade.toLowerCase()} contractors
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Section title="Estimates and proposals" items={launch.estimating} />
          <Section title="Optional AI roadmap" items={launch.phone} />
          <Section title="Job management" items={launch.jobs} />
          <Section title="Invoices and payments" items={launch.invoices} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold">Ready to run your {launch.trade.toLowerCase()} business from one app?</h2>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/contact">Book a Demo</Link></Button>
        </div>
      </section>

      <FAQ items={launch.faq} />
    </MarketingShell>
  );
}
