import { Link } from "react-router-dom";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";

export default function AIPhotoEstimator() {
  return (
    <MarketingShell>
      <SEO
        title="AI Photo & Voice Estimator for Contractors | Quote From Photos — FastTract"
        description="FastTract turns customer photos and voice descriptions into draft contractor estimates in minutes. AI-assisted measurements, your unit pricing, and your final approval before sending."
        path="/ai-photo-estimator"
      />
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-10 text-center sm:px-6 lg:px-8 lg:pt-24">
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          AI Photo & Voice Estimator for Contractors
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Customers send photos or describe the job by voice. FastTract drafts a rough estimate using AI-assisted measurements and your unit pricing. You review, adjust, and send — no all-day driveway visits.
        </p>
        <CTARow />
      </section>

      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { t: "1. Photos in", d: "Customer or crew uploads phone photos of the site, room, roof, fence, or driveway." },
            { t: "2. AI draft", d: "AI estimates rough dimensions and applies your saved unit pricing and assemblies." },
            { t: "3. You approve", d: "Review, edit, and send a branded proposal. Convert to a job and invoice when signed." },
          ].map((s) => (
            <div key={s.t} className="rounded-xl border border-border bg-card/60 p-6">
              <h3 className="text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-muted-foreground">
          AI-assisted estimates are designed to speed up quoting and help contractors prepare professional drafts. Contractors stay in control and approve estimates before sending. Verify measurements on site before final quotes.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 text-center sm:px-6 lg:px-8">
        <Button size="lg" asChild><Link to="/signup">Try AI Estimate Lab</Link></Button>
      </section>

      <FAQ
        items={[
          { q: "How accurate is the AI estimate?", a: "It’s a draft. AI-assisted measurements and voice descriptions give you a fast starting point. We recommend on-site verification before sending a final quote." },
          { q: "Can I use my own pricing?", a: "Yes. Plug in your unit pricing, assemblies, and markups. The AI uses your numbers — not generic averages." },
          { q: "What kinds of jobs work best?", a: "Concrete driveways and patios, fences, decks, roofs, siding, framing, landscaping, and most exterior work where photos or voice notes capture the scope." },
          { q: "Do customers need an app?", a: "No. They upload photos or leave a voice description via a link you send by text or email." },
        ]}
      />
    </MarketingShell>
  );
}
