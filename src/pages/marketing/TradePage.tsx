import { useParams, Navigate, Link } from "react-router-dom";
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
  const { slug } = useParams();
  const cfg = slug ? tradeBySlug[slug] : undefined;
  if (!cfg) return <Navigate to="/" replace />;

  return (
    <MarketingShell>
      <SEO
        title={cfg.title}
        description={cfg.description}
        path={`/${cfg.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: `ContractorOS for ${cfg.trade} Contractors`,
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, iOS, Android",
          offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
          description: cfg.description,
        }}
      />

      <section className="mx-auto max-w-4xl px-4 pt-16 pb-12 text-center sm:px-6 lg:px-8 lg:pt-24">
        <div className="mb-4 inline-flex rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          ContractorOS for {cfg.trade}
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          {cfg.h1}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">{cfg.intro}</p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-2xl font-semibold tracking-tight">What slows {cfg.trade.toLowerCase()} contractors down</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.painPoints.map((p) => (
            <div key={p} className="rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">• {p}</div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">
          How ContractorOS helps {cfg.trade.toLowerCase()} contractors
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Section title="AI estimating use cases" items={cfg.estimating} />
          <Section title="AI phone agent use cases" items={cfg.phone} />
          <Section title="Job management" items={cfg.jobs} />
          <Section title="Invoices and payments" items={cfg.invoices} />
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold">Ready to run your {cfg.trade.toLowerCase()} business from one app?</h2>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/contact">Book a Demo</Link></Button>
        </div>
      </section>

      <FAQ items={cfg.faq} />
    </MarketingShell>
  );
}
