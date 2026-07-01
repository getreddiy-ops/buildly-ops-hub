import { Link } from "react-router-dom";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { posts } from "./posts";

export default function BlogIndex() {
  return (
    <MarketingShell>
      <SEO
        title="FastTract Blog | Contractor Software, AI Estimating & Phone Answering"
        description="Articles for contractors on AI estimating, CRM, phone answering, job management, and running a profitable construction business."
        path="/blog"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-4xl font-semibold tracking-tight">FastTract Blog</h1>
        <p className="mt-4 text-lg text-muted-foreground">Practical guides for contractors on AI, estimating, and running the business.</p>
      </section>
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        <ul className="space-y-4">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link to={`/blog/${p.slug}`} className="block rounded-xl border border-border bg-card/60 p-6 transition hover:border-primary">
                <div className="text-xs text-muted-foreground">{p.date}</div>
                <h2 className="mt-1 text-xl font-semibold">{p.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </MarketingShell>
  );
}
