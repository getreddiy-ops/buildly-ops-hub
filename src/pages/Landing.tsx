import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SEO } from "@/components/SEO";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import {
  ArrowRight, Phone, FileText, FileSignature, Package, Users2, Wrench,
  Receipt, LayoutDashboard, PhoneMissed, Timer, FolderKanban, Bot,
  ClipboardList, Calendar, Truck, DollarSign, CheckCircle2, MapPin,
  Zap, Building2,
} from "lucide-react";

const painPoints = [
  { icon: PhoneMissed, title: "Missed Calls Cost Money", desc: "When a customer calls and nobody answers, they usually call the next contractor. FastTract can help capture the lead before it disappears." },
  { icon: Timer, title: "Estimates Take Too Long", desc: "Create cleaner estimates with labor, materials, markup, misc. supplies, taxes, and trade-specific line items already organized." },
  { icon: FolderKanban, title: "Jobs Get Messy Fast", desc: "Keep customers, job notes, invoices, contracts, photos, schedules, and follow-ups tied to the right project." },
];

const features = [
  { icon: Phone, title: "AI Phone Assistant", desc: "Answer calls 24/7, collect customer details, qualify the job, and book the next step." },
  { icon: FileText, title: "AI Estimating", desc: "Build trade-specific estimates using dimensions, scope, materials, labor, markup, tax, and regional adjustments." },
  { icon: FileSignature, title: "Customer-Facing Contracts", desc: "Turn approved estimates into professional contracts with clear scope, exclusions, payment terms, and state-by-state language placeholders." },
  { icon: Package, title: "Material Lists", desc: "Generate contractor material lists for ordering, pickup, delivery, and crew prep." },
  { icon: Users2, title: "Labor Projections", desc: "Estimate crew size, hours, production rate, and job duration before the work starts." },
  { icon: Receipt, title: "Invoices & Balance Tracking", desc: "Send clean invoices, record payments, track balances, and keep every invoice connected to the job." },
  { icon: Wrench, title: "CRM & Follow-Up", desc: "Track leads, customers, bids, callbacks, appointments, and won/lost jobs." },
  { icon: LayoutDashboard, title: "Job Dashboard", desc: "See every job by status: new lead, estimate sent, approved, scheduled, in progress, invoiced, and paid." },
];

const aiExamples = [
  "Create an estimate for a 20x30 concrete slab.",
  "Add a new customer named John Smith.",
  "Turn this estimate into a customer-facing contract.",
  "Make a material list for this job.",
  "Send a follow-up text for the estimate I sent yesterday.",
  "Create an invoice for the completed driveway job.",
];

const steps = [
  { icon: Phone, title: "Capture the Lead", desc: "AI phone assistant or manual entry collects customer details and job information." },
  { icon: FileText, title: "Build the Estimate", desc: "FastTract helps calculate materials, labor, markup, supplies, and scope." },
  { icon: FileSignature, title: "Send the Proposal", desc: "Send a professional customer-facing estimate or contract." },
  { icon: ClipboardList, title: "Manage the Job", desc: "Track schedule, notes, materials, crew time, photos, and changes." },
  { icon: DollarSign, title: "Invoice and Get Paid", desc: "Generate the final invoice and keep the customer record organized." },
];

const trades = [
  "Concrete", "Framing", "Roofing", "Remodeling", "Excavation", "Landscaping",
  "Painting", "Electrical", "Plumbing", "HVAC", "Handyman", "General Contractors",
];

const estimateLines = [
  { label: "Excavation & Prep", value: "$1,850" },
  { label: "Base Rock", value: "$620" },
  { label: "Forms & Layout", value: "$980" },
  { label: "Rebar / Reinforcement", value: "$540" },
  { label: "Concrete Placement", value: "$3,420" },
  { label: "Finish Work", value: "$1,260" },
  { label: "Saw Cuts / Control Joints", value: "$240" },
  { label: "Cleanup", value: "$180" },
  { label: "Formwork, Consumables & Misc. Job Supplies", value: "$730" },
  { label: "Taxes / Regional Adjustments", value: "$612" },
];

const whyBullets = [
  "Answer more calls",
  "Send estimates faster",
  "Look more professional",
  "Reduce forgotten materials",
  "Track labor better",
  "Create cleaner contracts",
  "Invoice quicker",
  "Keep every job organized",
  "Build repeatable systems",
  "Operate like bigger companies",
];

const pricingTiers = [
  { name: "FastTract", tagline: "For solo contractors getting organized", price: "$69/mo", cta: "Start Free Trial", to: "/pricing", variant: "default" as const },
  { name: "FastTract Plus", tagline: "For contractors managing multiple jobs", price: "$169/mo", cta: "Choose Plus", to: "/pricing", variant: "default" as const, featured: true },
  { name: "FastTract Premium", tagline: "For teams that want AI phone answering 24/7", price: "$269/mo", cta: "Choose Premium", to: "/pricing", variant: "outline" as const },
];

const faqItems = [
  { q: "What is FastTract?", a: "FastTract is an AI-powered operating system for contractors. It handles lead intake, AI phone answering, CRM, estimates, contracts, material lists, labor projections, scheduling, invoices, and payments — all in one contractor dashboard." },
  { q: "Which trades is FastTract built for?", a: "Concrete, framing, roofing, remodeling, excavation, landscaping, painting, electrical, plumbing, HVAC, handyman, and general contractors. Each trade has its own estimating rules and templates." },
  { q: "Does the AI phone assistant really answer calls?", a: "Yes. It answers 24/7, qualifies the job, captures customer details, and books the next step — so you stop losing leads to voicemail." },
  { q: "Can FastTract build estimates and contracts?", a: "Yes. AI drafts trade-specific estimates with materials, labor, markup, supplies, and tax. Approved estimates convert to customer-facing contracts in one click." },
  { q: "Do I need an office manager to use it?", a: "No. FastTract is designed so a solo contractor can run their business without hiring admin help." },
  { q: "Is there a free trial?", a: "Yes. Start a free trial, no long commitment. Upgrade when you're ready." },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FastTract",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, iOS, Android",
  description: "FastTract is the AI-powered contractor operating system — AI phone answering, CRM, AI estimating, contracts, material lists, labor projections, scheduling, invoices, and payments in one contractor dashboard.",
  offers: { "@type": "Offer", price: "69", priceCurrency: "USD" },
  brand: { "@type": "Brand", name: "GetReddiy" },
  url: "https://fasttract.org/",
};

function DashboardMockup() {
  const cards = [
    { icon: Zap, tag: "New Lead", title: "Driveway replacement — Portland, OR", tone: "text-primary" },
    { icon: FileText, tag: "AI Estimate", title: "Ready for review", tone: "text-primary" },
    { icon: FileSignature, tag: "Contract", title: "Generated & sent", tone: "text-primary" },
    { icon: Package, tag: "Material List", title: "Created for pickup", tone: "text-primary" },
    { icon: Receipt, tag: "Invoice", title: "Pending — $8,432", tone: "text-primary" },
    { icon: Calendar, tag: "Job Status", title: "Scheduled — Thu 8:00 AM", tone: "text-primary" },
  ];
  return (
    <div className="relative rounded-2xl border border-border bg-card/80 p-4 shadow-2xl backdrop-blur">
      <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <div className="text-xs font-semibold tracking-wide text-foreground">FastTract Dashboard</div>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> Portland, OR
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => (
          <div key={c.tag} className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <c.icon className={`h-3.5 w-3.5 ${c.tone}`} />
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.tag}</div>
            </div>
            <div className="text-sm font-semibold leading-snug text-foreground">{c.title}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-2 text-foreground">
          <Bot className="h-4 w-4 text-primary" />
          <span>AI Assistant ready</span>
        </div>
        <span className="text-muted-foreground">“Create an invoice for the Smith job”</span>
      </div>
    </div>
  );
}

function PrimaryCTA({ label = "Start Free Trial" }: { label?: string }) {
  return (
    <Button size="lg" asChild>
      <Link to="/signup">{label}</Link>
    </Button>
  );
}
function SecondaryCTA({ label = "Watch Demo", to = "/demo" }: { label?: string; to?: string }) {
  return (
    <Button size="lg" variant="outline" asChild>
      <Link to={to}>{label}</Link>
    </Button>
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
        title="FastTract | Contractor Estimating, CRM, Invoices & AI Phone Answering"
        description="Run your contracting business from first call to final invoice. FastTract uses AI to answer calls, capture leads, build estimates, create contracts, generate material lists, track jobs, and send invoices — all from one contractor dashboard."
        path="/"
        jsonLd={softwareSchema}
      />

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-12 pb-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Built by people who understand the jobsite
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Run Your Contracting Business From{" "}
              <span className="text-gradient-primary">First Call to Final Invoice</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              FastTract uses AI to answer calls, capture leads, build estimates, create contracts, generate material lists, track jobs, and send invoices — all from one clean contractor dashboard.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryCTA />
              <SecondaryCTA />
            </div>
            <p className="mt-5 max-w-xl text-sm text-muted-foreground">
              Built for concrete, remodeling, roofing, landscaping, painting, excavation, electrical, plumbing, HVAC, and general construction trades.
            </p>
          </div>
          <div className="lg:pl-6"><DashboardMockup /></div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="mx-auto max-w-3xl text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Stop Losing Jobs to Missed Calls, Slow Estimates, and Messy Paperwork
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {painPoints.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-primary/15 text-primary">
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything Contractors Need to Go From Lead to Paid
            </h2>
            <p className="mt-4 text-muted-foreground">
              A contractor command center — not just estimating software. Look professional, respond faster, bid cleaner, and stay organized without hiring an office manager.
            </p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-md bg-accent text-accent-foreground">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <PrimaryCTA />
            <SecondaryCTA />
          </div>
        </div>
      </section>

      {/* AI ASSISTANT */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
                <Bot className="h-3.5 w-3.5" /> AI Assistant
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Tell FastTract What You Need. It Builds It.
              </h2>
              <p className="mt-4 text-muted-foreground">
                Use plain language to create customers, estimates, invoices, contracts, job notes, schedules, and follow-ups. Instead of clicking through ten screens, type or say what happened — FastTract organizes the business side.
              </p>
              <div className="mt-8">
                <Button size="lg" asChild><Link to="/signup">Try the AI Assistant</Link></Button>
              </div>
            </div>
            <div className="space-y-3">
              {aiExamples.map((ex, i) => (
                <div
                  key={ex}
                  className={`max-w-md rounded-2xl border border-border px-4 py-3 text-sm shadow-sm ${
                    i % 2 === 0 ? "bg-primary/10 border-primary/30 text-foreground" : "ml-auto bg-card text-muted-foreground"
                  }`}
                >
                  “{ex}”
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              From Phone Call to Paid Invoice in One Flow
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {steps.map((s, i) => (
              <div key={s.title} className="relative rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/15 text-primary">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">STEP {i + 1}</span>
                </div>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for Every Trade</h2>
            <p className="mt-4 text-muted-foreground">
              Each trade can have its own estimating rules, production rates, labor rates, material templates, tax settings, and customer-facing language.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {trades.map((t) => (
              <div key={t} className="rounded-lg border border-border bg-card px-4 py-3 text-center text-sm font-semibold">
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONCRETE EXAMPLE */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Example: Concrete Estimate Built the Right Way
            </h2>
            <p className="mt-4 text-muted-foreground">
              A clean, itemized proposal your customer can actually read. Costs are distributed naturally — no vague “project management” line item.
            </p>
          </div>
          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border bg-background/40 px-6 py-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Estimate #ES-1042</div>
                <div className="text-sm font-semibold">Driveway Replacement — 20' x 40' Slab</div>
              </div>
              <div className="text-xs text-muted-foreground">Portland, OR</div>
            </div>
            <ul className="divide-y divide-border">
              {estimateLines.map((l) => (
                <li key={l.label} className="flex items-center justify-between px-6 py-3 text-sm">
                  <span className="text-foreground">{l.label}</span>
                  <span className="font-mono text-muted-foreground">{l.value}</span>
                </li>
              ))}
              <li className="flex items-center justify-between bg-primary/10 px-6 py-4">
                <span className="text-base font-bold">Total</span>
                <span className="font-mono text-lg font-bold text-primary">$10,432</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* WHY FASTTRACT */}
      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Made for Contractors Who Want to Look Bigger, Move Faster, and Stay Profitable
            </h2>
          </div>
          <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {whyBullets.map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-sm font-medium">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRICING */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple Pricing for Growing Contractors
            </h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {pricingTiers.map((t) => (
              <div
                key={t.name}
                className={`rounded-2xl border p-6 ${
                  t.featured ? "border-primary bg-primary/5 shadow-xl" : "border-border bg-card"
                }`}
              >
                {t.featured && (
                  <div className="mb-3 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <h3 className="text-xl font-bold">{t.name}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{t.tagline}</p>
                <div className="mt-6 text-lg font-semibold text-foreground">{t.price}</div>
                <Button className="mt-6 w-full" size="lg" variant={t.variant} asChild>
                  <Link to={t.to}>{t.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
              See full pricing details <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <Building2 className="mx-auto mb-6 h-10 w-10 text-primary" />
          <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
            Your Next Job Shouldn't Be Buried in Missed Calls and Paperwork
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            FastTract helps contractors capture the lead, build the estimate, manage the job, and send the invoice — without losing control of the business.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryCTA />
            <SecondaryCTA label="Book a Demo" />
          </div>
        </div>
      </section>

      <FAQ items={faqItems} />
    </MarketingShell>
  );
}
