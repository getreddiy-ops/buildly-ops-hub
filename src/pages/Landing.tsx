import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight, Bot, Calculator, Check, CheckCircle2, ClipboardCheck,
  FileSignature, FileText, Phone, Receipt, ShieldCheck, Sparkles, Users2,
} from "lucide-react";

const tourSteps = [
  {
    label: "1. Capture the lead",
    title: "Driveway replacement",
    detail: "Sarah Miller · Portland, OR · 20′ × 40′",
    status: "Qualified",
    icon: Phone,
  },
  {
    label: "2. Build the estimate",
    title: "AI draft ready to review",
    detail: "Labor, materials, markup, tax, and scope organized",
    status: "$10,432",
    icon: Calculator,
  },
  {
    label: "3. Send and track",
    title: "Professional proposal sent",
    detail: "Customer opened it 8 minutes ago",
    status: "Viewed",
    icon: FileSignature,
  },
];

const estimateLines = [
  ["Excavation & prep", "$1,850"],
  ["Base rock", "$620"],
  ["Forms & reinforcement", "$1,520"],
  ["Concrete placement", "$3,420"],
  ["Finish work & control joints", "$1,500"],
  ["Supplies, cleanup & adjustments", "$1,522"],
];

const capabilities = [
  { icon: Bot, title: "Home", text: "Ask Ava what needs attention and get a clear, personalized business overview." },
  { icon: Users2, title: "Work", text: "Keep leads, customers, follow-ups, scheduling, jobs, and invoices moving." },
  { icon: Receipt, title: "Money", text: "Understand income, expenses, payments, reports, and tax reserves in plain English." },
  { icon: ClipboardCheck, title: "Business", text: "Organize your company profile, team, documents, integrations, and settings." },
];

const faqItems = [
  { q: "What is FastTract?", a: "FastTract is an AI-powered operating system for small businesses. Your personal assistant, Ava, helps organize customers, work, money, follow-up, documents, scheduling, and everyday business details." },
  { q: "What kinds of businesses can use it?", a: "FastTract adapts to the company it meets during onboarding. Contractors have purpose-built estimating and job tools, while the same Home, Work, Money, and Business foundation supports service, retail, professional, and local businesses." },
  { q: "Can Ava take actions for me?", a: "Yes, but important actions remain under your control. Ava prepares the work and asks for approval before sending, filing, paying, or changing anything important." },
  { q: "What does the trial include?", a: "You can start a 7-day trial on any plan. A card is required, but you are not charged until the trial ends. Cancel anytime." },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FastTract",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "A personal AI business assistant for customers, work, money, follow-up, scheduling, documents, and daily operations.",
  offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
  brand: { "@type": "Brand", name: "FastTract" },
  url: "https://fasttract.org/",
};

function TrialNote() {
  return <p className="mt-3 text-xs text-muted-foreground">7-day trial · Card required · No charge until the trial ends · Cancel anytime</p>;
}

function ProductTour() {
  const [active, setActive] = useState(0);
  const item = tourSteps[active];
  const Icon = item.icon;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FastTract product tour</p>
          <p className="mt-1 text-sm text-muted-foreground">From new lead to sent estimate</p>
        </div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">Live workflow</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="Product workflow">
        {tourSteps.map((step, index) => (
          <button
            key={step.label}
            type="button"
            role="tab"
            aria-selected={active === index}
            onClick={() => setActive(index)}
            className={`rounded-lg border p-3 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              active === index ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>
      <div className="mt-4 min-h-48 rounded-xl border border-border bg-background/70 p-5" role="tabpanel">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">{item.status}</span>
        </div>
        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
        <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Saved to the customer record
        </div>
      </div>
      <Button variant="outline" className="mt-4 w-full" asChild>
        <Link to="/demo">See the complete product tour <ArrowRight className="ml-2 h-4 w-4" /></Link>
      </Button>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate("/app", { replace: true });
  }, [user, loading, navigate]);

  return (
    <MarketingShell>
      <SEO
        title="FastTract | Your Personal AI Business Assistant"
        description="Meet Ava, the personal AI assistant that learns your business and helps manage customers, work, money, follow-up, scheduling, documents, and everyday operations."
        path="/"
        jsonLd={softwareSchema}
      />

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-20 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> One personal AI assistant for your whole business
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Run your business. <span className="text-gradient-primary">Let Ava handle the busywork.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            FastTract gives every business a personal AI assistant that learns how you work, keeps customers and money organized, answers questions, follows up, and helps get everyday work done.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link to="/signup">Start 7-day free trial</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/demo">Watch product tour</Link></Button>
          </div>
          <TrialNote />
        </div>
        <ProductTour />
      </section>

      <section className="border-y border-border bg-background/40">
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            [ShieldCheck, "Ava prepares it. You approve it.", "Important work is never sent, filed, paid, or changed without your approval."],
            [Users2, "One connected business", "Keep customers, conversations, files, work, money, and follow-up together."],
            [Bot, "Learns how you work", "Ava starts with five onboarding answers and builds approved knowledge over time."],
          ].map(([Icon, title, text]) => {
            const TrustIcon = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="flex gap-3 rounded-xl border border-border bg-card p-4">
                <TrustIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div><h2 className="text-sm font-semibold">{title as string}</h2><p className="mt-1 text-xs text-muted-foreground">{text as string}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">From a conversation to finished work</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Tell Ava what you need. Review the result.</h2>
            <p className="mt-4 text-muted-foreground">
              Ava uses your approved business knowledge to prepare the next useful action. For a contractor, that may be a complete estimate. For another business, it may be customer follow-up, scheduling, an invoice, or a money summary.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {["Use your private labor and material rates", "Review quantities, exclusions, and payment terms", "Convert an approved estimate into the next job step"].map((text) => (
                <li key={text} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" />{text}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-7">
            <div className="flex items-start justify-between border-b border-border pb-5">
              <div><p className="text-xs uppercase tracking-wide text-muted-foreground">Estimate ES-1042</p><h3 className="mt-1 text-lg font-semibold">Driveway replacement · 20′ × 40′</h3><p className="mt-1 text-xs text-muted-foreground">Portland, Oregon</p></div>
              <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-400">Draft</span>
            </div>
            <div className="divide-y divide-border">
              {estimateLines.map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><span>{label}</span><span className="font-medium">{value}</span></div>)}
            </div>
            <div className="flex justify-between border-t border-border pt-4 text-lg font-bold"><span>Total</span><span>$10,432</span></div>
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> AI-assisted draft—contractor review required before sending.</div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Four simple areas. Everything else fits underneath.</h2>
            <p className="mt-4 text-muted-foreground">The dashboard stays approachable while Ava works across the whole company with you.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-card p-5">
                <item.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Simple monthly pricing</p>
            <h2 className="mt-3 text-3xl font-bold">Start with the plan that fits your office.</h2>
            <p className="mt-4 text-muted-foreground">Every plan starts with a 7-day trial. A card is required; billing begins only after the trial ends.</p>
            <Button className="mt-6" asChild><Link to="/pricing">Compare all plan features <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[["FastTract", "$69", "Core operations"], ["Plus", "$169", "AI admin assistant"], ["Premium", "$269", "AI phone answering"]].map(([name, price, detail]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{name}</h3><p className="mt-4 text-3xl font-bold">{price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p><p className="mt-2 text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold">You do not have to run the business alone.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Meet Ava, answer five quick questions, and start with a workspace that already understands the basics of your company.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><Link to="/signup">Start 7-day free trial</Link></Button>
            <Button size="lg" variant="outline" asChild><Link to="/demo">See FastTract in action</Link></Button>
          </div>
          <TrialNote />
        </div>
      </section>

      <FAQ items={faqItems} />
    </MarketingShell>
  );
}
