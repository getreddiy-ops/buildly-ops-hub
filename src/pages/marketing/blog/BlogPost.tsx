import { useParams, Navigate, Link } from "react-router-dom";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { postBySlug } from "./posts";

export default function BlogPost() {
  const { slug } = useParams();
  const post = slug ? postBySlug[slug] : undefined;
  if (!post) return <Navigate to="/blog" replace />;

  return (
    <MarketingShell>
      <SEO
        title={`${post.title} | ContractorOS`}
        description={post.description}
        path={`/blog/${post.slug}`}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          datePublished: post.date,
          author: { "@type": "Organization", name: "ContractorOS" },
          publisher: { "@type": "Organization", name: "GetReddiy" },
        }}
      />
      <article className="mx-auto max-w-3xl px-4 pt-16 pb-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="text-xs text-muted-foreground">{post.date}</div>
        <h1 className="mt-2 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">{post.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{post.description}</p>
        <div className="prose prose-invert mt-8 max-w-none">
          {post.body.map((p, i) => (
            <p key={i} className="mb-4 leading-relaxed text-foreground/90">{p}</p>
          ))}
        </div>
        <div className="mt-10 flex gap-3">
          <Button asChild><Link to="/signup">Start Free</Link></Button>
          <Button variant="outline" asChild><Link to="/blog">More articles</Link></Button>
        </div>
      </article>
    </MarketingShell>
  );
}
