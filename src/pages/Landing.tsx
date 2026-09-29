import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight, Calculator, Check, CheckCircle2, ClipboardCheck,
  FileSignature, FileText, Phone, Receipt, ShieldCheck, Users2,
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
    title: "Estimate ready to review",
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
  { icon: CheckCircle2, title: "Home", text: "Start with a clear view of the work, follow-ups, and money that need attention." },
  { icon: Users2, title: "Work", text: "Keep leads, customers, follow-ups, scheduling, jobs, and invoices moving." },
  { icon: Receipt, title: "Money", text: "Understand income, expenses, payments, reports, and tax reserves in plain English." },
  { icon: ClipboardCheck, title: "Business", text: "Organize your company profile, team, documents, integrations, and settings." },
];

const faqItems = [
  { q: "What is FastTract?", a: "FastTract is a Contractor OS that connects leads, customers, estimates, jobs, schedules, crews, invoices, and job costs in one workspace." },
  { q: "Do I need an AI provider?", a: "No. FastTract's core contractor workflows work without AI. Bring-your-own AI connections are planned for a later release and are not available yet." },
  { q: "Who is FastTract for?", a: "FastTract is built for contractors who need the office and field team working from the same customer, estimate, job, and time records." },
  { q: "What does the trial include?", a: "The 7-day trial includes the FastTract core plan. A card is required, but you are not charged until the trial ends. Cancel anytime." },
];

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FastTract",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: "A Contractor OS for leads, estimates, jobs, scheduling, teams, time tracking, invoices, and job costing.",
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
        title="FastTract | Contractor OS for Office and Field Work"
        description="Run leads, estimates, jobs, schedules, crews, time tracking, invoices, and job costs from one Contractor OS. AI is optional and not required."
        path="/"
        jsonLd={softwareSchema}
      />

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pb-20 lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Contractor operations in one workspace
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Run every job. <span className="text-gradient-primary">Keep the business in sync.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            FastTract connects leads, estimates, jobs, schedules, crews, invoices, and job costs from the first inquiry through final payment. Core workflows work without an AI provider.
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
            [ShieldCheck, "You stay in control", "Review estimates, hours, and important changes before they are finalized."],
            [Users2, "One connected job record", "Keep the customer, estimate, schedule, crew time, and invoice together."],
            [ClipboardCheck, "Built for field work", "Give the office and crew a shared view from the first call to closeout."],
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">From estimate to finished work</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Keep every step tied to the same job.</h2>
            <p className="mt-4 text-muted-foreground">
              Build a clear estimate, track customer approval, schedule the job, record crew hours, and follow costs through invoicing—all in one place.
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
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Estimate saved as a draft for contractor review.</div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-background/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Four simple areas. Everything else fits underneath.</h2>
            <p className="mt-4 text-muted-foreground">The dashboard keeps customers, field work, company finances, and team operations connected.</p>
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
            <h2 className="mt-3 text-3xl font-bold">One core plan for the work contractors run every day.</h2>
            <p className="mt-4 text-muted-foreground">FastTract is $69 per company each month after a 7-day trial. No AI provider is required. Optional AI connections are planned for later.</p>
            <Button className="mt-6" asChild><Link to="/pricing">See the FastTract plan <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
          <div className="grid gap-4">
            {[["FastTract", "$69", "Core Contractor OS"]].map(([name, price, detail]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold">{name}</h3><p className="mt-4 text-3xl font-bold">{price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p><p className="mt-2 text-xs text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-primary/5">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold">Bring your office and field work together.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Set up your company, invite your crew, and start tracking customers, estimates, jobs, time, and costs. AI is optional.</p>
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
