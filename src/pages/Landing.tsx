import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { MarketingShell, CTARow } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import {
  ArrowRight, Phone, Camera, Users, FileText, Receipt, Calendar, Clock, Bot,
} from "lucide-react";

const sections = [
  { icon: Phone, title: "AI Phone Answering for Contractors", to: "/ai-phone-agent", desc: "Never miss another lead. AI answers every call, books appointments, and writes to your CRM 24/7." },
  { icon: Camera, title: "AI Photo Estimating", to: "/ai-photo-estimator", desc: "Customers send photos. AI drafts a rough estimate using your unit pricing. You approve before sending." },
  { icon: Users, title: "Contractor CRM", to: "/contractor-crm", desc: "Every lead, customer, call, and job history in one record." },
  { icon: FileText, title: "Estimates and Proposals", to: "/estimate-software", desc: "Branded proposals with e-signature. Convert signed estimates into jobs in one click." },
  { icon: Receipt, title: "Invoices and Payments", to: "/invoice-software", desc: "Deposit, progress, and final invoices. Online payment links by email or text." },
  { icon: Calendar, title: "Job Scheduling", to: "/features", desc: "Schedule crews and subs across every active job. Everyone knows where to be." },
  { icon: Clock, title: "Crew Time Tracking", to: "/features", desc: "GPS clock-in, boss-approved hours, and payroll-ready exports." },
  { icon: Bot, title: "AI Command Chat", to: "/features", desc: "Run the whole business by typing or talking — AI fills out forms, drafts estimates, and creates jobs while you’re between sites." },
];

const trades = [
  { label: "Concrete", to: "/concrete-contractor-software" },
  { label: "Framing", to: "/framing-contractor-software" },
  { label: "Fencing", to: "/fencing-contractor-software" },
  { label: "Roofing", to: "/roofing-contractor-software" },
  { label: "Siding", to: "/siding-contractor-software" },
  { label: "Decks", to: "/deck-builder-software" },
  { label: "Landscaping", to: "/landscaping-contractor-software" },
  { label: "General Contractor", to: "/general-contractor-software" },
];

const faqItems = [
  { q: "What is ContractorOS?", a: "ContractorOS is an AI-powered operating system for contractors. It combines a CRM, AI estimating from photos, AI phone answering, job scheduling, crew time tracking, invoices, and an AI command chat in one app." },
  { q: "Does ContractorOS create estimates?", a: "Yes. ContractorOS drafts estimates using AI from photos and your unit pricing. You review and approve every estimate before it’s sent. AI-assisted estimates are drafts — contractors verify before final quote." },
  { q: "Can ContractorOS answer phone calls for contractors?", a: "Yes. The AI Phone Agent answers every call 24/7, captures lead details, books appointments, and writes the conversation into your CRM." },
  { q: "Can customers upload photos for estimates?", a: "Yes. Send a customer a link by text or email and they upload photos. The AI Photo Estimator drafts an estimate from those photos." },
  { q: "Does ContractorOS replace site visits?", a: "No. AI-assisted estimates are designed to speed up quoting. We recommend verifying measurements on site before sending a final quote." },
  { q: "Can ContractorOS create invoices?", a: "Yes. Convert approved estimates into invoices, send by email or text, and collect payments online." },
  { q: "Does ContractorOS track crew time?", a: "Yes. Crews clock in on-site with GPS verification. Managers approve hours before they flow to payroll and job costing." },
  { q: "Is ContractorOS built for concrete contractors?", a: "Yes. ContractorOS is built for concrete contractors and other trade-based businesses. There’s a dedicated concrete page with use cases and an AI estimator tuned for driveways, patios, and slabs." },
  { q: "Can I use ContractorOS for fencing, roofing, siding, decks, or landscaping?", a: "Yes. ContractorOS supports fencing, roofing, siding, deck builders, landscapers, framers, and general contractors. Each trade has a dedicated landing page and workflow." },
  { q: "Does ContractorOS have an AI assistant inside the app?", a: "Yes. The AI Command Chat lets you run the business by typing or talking — create leads, draft estimates, schedule jobs, and send invoices." },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ContractorOS",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description: "ContractorOS is the AI-powered operating system for contractors. AI phone answering, AI photo estimating, voice-driven AI form filling, contractor CRM, job scheduling, crew time tracking, invoices, and an AI command chat."
  offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
  brand: { "@type": "Brand", name: "GetReddiy" },
  url: "https://contractoros.online/",
};

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  return (
    <MarketingShell>
      <SEO
        title="ContractorOS | AI Contractor Estimating, CRM, Invoices & Job Management"
        description="ContractorOS helps contractors answer calls, capture leads, create AI-assisted estimates from photos, manage jobs, send invoices, track crew time, and run their business from one simple app."
        path="/"
        jsonLd={softwareSchema}
      />

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-16 pb-16 text-center sm:px-6 lg:px-8 lg:pt-24">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          ContractorOS by GetReddiy
        </div>
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          AI-Powered Contractor Software That Runs Your{" "}
          <span className="text-gradient-primary">Office, Estimates, Jobs, and Invoices</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-balance text-lg text-muted-foreground">
          ContractorOS combines AI phone answering, photo-based estimating, voice-driven AI form filling, customer management, job scheduling, invoicing, crew time tracking, and an AI command chat so contractors can run the whole business from one dashboard.
        </p>
        <CTARow />
        <p className="mx-auto mt-6 max-w-2xl text-sm text-muted-foreground">
          Stop missing calls. Stop typing estimates from scratch. Stop chasing notes across texts, photos, and paper. Just talk to the AI — it fills out forms, drafts estimates, and builds jobs while you drive between sites.
        </p>
      </section>

      {/* Workflow */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-semibold tracking-tight">From missed call to paid invoice</h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            One workflow. One app. No more lost leads between five different tools.
          </p>
          <ol className="grid gap-4 text-sm md:grid-cols-4 lg:grid-cols-8">
            {[
              "Customer calls",
              "AI answers",
              "Lead created",
              "Photos uploaded",
              "AI drafts estimate",
              "You approve & send",
              "Job scheduled, crew logs time",
              "Invoice sent & paid",
            ].map((step, i) => (
              <li key={step} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="text-xs text-primary">Step {i + 1}</div>
                <div className="mt-1 font-medium">{step}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-semibold tracking-tight">Everything contractors need in one app</h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            ContractorOS replaces the CRM, the estimator, the scheduler, the time tracker, the invoicing tool, and the phone receptionist.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sections.map((f) => (
              <Link key={f.title} to={f.to} className="group rounded-xl border border-border bg-card p-6 transition hover:border-primary">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold group-hover:text-primary">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
                  Learn more <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trades */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="mb-3 text-center text-3xl font-semibold tracking-tight">
            Built for Concrete, Framing, Fencing, Roofing, Siding, Decks, and Landscaping
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-muted-foreground">
            Pick your trade — see how ContractorOS fits your workflow.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {trades.map((t) => (
              <Link key={t.to} to={t.to} className="rounded-lg border border-border bg-card/60 px-4 py-3 text-center text-sm font-medium transition hover:border-primary">
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <p className="text-sm text-muted-foreground">
            AI-assisted estimates are designed to speed up quoting and help contractors prepare professional drafts. Contractors stay in control and approve estimates before sending. Verify measurements on site before final quotes.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold tracking-tight">Run your contracting business from one app.</h2>
          <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
            Start free. Add the AI Phone Agent when you’re ready.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild><Link to="/signup">Start Free</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/contact">Book a Demo</Link></Button>
          </div>
        </div>
      </section>

      <FAQ items={faqItems} />
    </MarketingShell>
  );
}
