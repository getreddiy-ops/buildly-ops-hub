import { Helmet } from "react-helmet-async";

export type FAQItem = { q: string; a: string };

export function FAQ({ items, heading = "Frequently asked questions" }: { items: FAQItem[]; heading?: string }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(schema)}</script>
      </Helmet>
      <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">{heading}</h2>
      <div className="space-y-4">
        {items.map((i) => (
          <details key={i.q} className="group rounded-xl border border-border bg-card/60 p-5">
            <summary className="cursor-pointer list-none text-base font-medium marker:hidden">
              {i.q}
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
