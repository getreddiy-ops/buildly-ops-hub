import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SEO } from "@/components/SEO";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { FAQ } from "@/components/marketing/FAQ";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowRight, Bot, CalendarDays, Check, CheckCircle2, ClipboardCheck,
  FileSignature, Phone, Receipt, ShieldCheck, Users2, WalletCards,
} from "lucide-react";

const tourSteps = [
  { label: "New lead", title: "Driveway replacement", detail: "Caller captured, qualified, and ready for follow-up", status: "Qualified", icon: Phone },
  { label: "Estimate", title: "Scope and numbers organized", detail: "Labor, materials, protection, and payment terms ready to review", status: "Draft ready", icon: ClipboardCheck },
  { label: "Get paid", title: "Job complete", detail: "Invoice sent, payment tracked, and review follow-up prepared", status: "On track", icon: WalletCards },
];

const pillars = [
  { icon: Users2, title: "Leads", text: "Every call, form, and conversation lands in one clear follow-up path." },
  { icon: CalendarDays, title: "Jobs", text: "Move from estimate appointment to scheduled work without losing the details." },
  { icon: Receipt, title: "Money", text: "Create estimates and invoices, track what is owed, and know what needs attention." },
  { icon: Bot, title: "AI", text: "Ask FastTract what to do next instead of digging through complicated software." },
];

const faqItems = [
  { q: "What is FastTract?", a: "FastTract is an AI-first business operating system for contractors and home-service companies. It brings leads, customers, estimates, jobs, communication, invoices, payments, and follow-up into one simpler experience." },
  { q: "Do I have to learn another complicated CRM?", a: "No. FastTract is designed around the work contractors actually do: answer the lead, schedule the estimate, win the job, finish the work, get paid, and earn the next referral." },
  { q: "Can FastTract answer my business phone?", a: "AI phone answering is part of the product direction. Availability and usage depend on the setup selected for each business, and nothing is activated without a clear cost review." },
  { q: "Will AI send prices or messages without me?", a: "Important actions stay under your control. FastTract can prepare the next step, while you decide what gets approved and sent." },
];

const softwareSchema = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "FastTract",
  applicationCategory: "BusinessApplication", operatingSystem: "Web",
  description: "An AI-first operating system for contractor leads, estimates, jobs, communication, invoicing, payments, and follow-up.",
  brand: { "@type": "Brand", name: "FastTract" }, url: "https://fasttract.org/",
};

function ProductTour() {
  const [active, setActive] = useState(0);
  const item = tourSteps[active];
  const Icon = item.icon;
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-card/95 p-5 shadow-2xl sm:p-7">
      <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-full bg-[hsl(var(--brand-gold))]/15" />
      <div className="relative mb-6 flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Today in FastTract</p><p className="mt-2 text-sm text-muted-foreground">One straight line from lead to paid.</p></div>
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">Live workflow</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-3" role="tablist" aria-label="FastTract workflow">
        {tourSteps.map((step, index) => (
          <button key={step.label} type="button" role="tab" aria-selected={active === index} onClick={() => setActive(index)}
            className={`rounded-xl border px-3 py-3 text-left text-xs font-medium transition ${active === index ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {index + 1}. {step.label}
          </button>
        ))}
      </div>
      <div className="mt-4 min-h-56 rounded-2xl border border-border bg-background/70 p-6" role="tabpanel">
        <div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-6 w-6" /></div><span className="rounded-full bg-[hsl(var(--brand-gold))]/15 px-3 py-1 text-xs font-semibold text-[hsl(var(--brand-gold))]">{item.status}</span></div>
        <h2 className="mt-7 text-2xl font-semibold">{item.title}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
        <div className="mt-6 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Everything stays connected to the customer record</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && user) navigate("/app", { replace: true }); }, [user, loading, navigate]);
  return (
    <MarketingShell>
      <SEO title="FastTract | The Contractor Business Operating System" description="Turn leads into scheduled, finished, paid work with one simple AI-first contractor operating system." path="/" jsonLd={softwareSchema} />

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.24),transparent_58%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.03fr_.97fr] lg:px-8 lg:pb-24 lg:pt-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary">Built for contractors who would rather build than babysit software</div>
            <h1 className="max-w-3xl text-balance text-5xl font-black leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">From the first call to the <span className="text-primary">final payment.</span></h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">FastTract gives contractors one clear place to capture leads, build estimates, schedule jobs, communicate with customers, send invoices, collect payments, and ask AI what needs attention next.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Button size="lg" asChild><Link to="/contact">Get early access <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><Button size="lg" variant="outline" asChild><Link to="/demo">See how it works</Link></Button></div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">{["No CRM maze", "One connected customer record", "You approve important actions"].map((text) => <span key={text} className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" />{text}</span>)}</div>
          </div>
          <ProductTour />
        </div>
      </section>

      <section id="how-it-works" className="border-y border-border bg-background/45">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">The work, not the software</p><h2 className="mt-4 text-4xl font-bold tracking-tight">FastTract follows the way a good contractor already thinks.</h2></div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[
            ["01", "Win the opportunity", "Capture the lead, respond quickly, qualify the work, and schedule the estimate."],
            ["02", "Run the job", "Keep scope, schedule, customer communication, costs, and job details in one place."],
            ["03", "Close the loop", "Invoice, track payment, request an honest review, and create the next referral opportunity."],
          ].map(([number, title, text]) => <div key={number} className="rounded-2xl border border-border bg-card p-6"><span className="text-sm font-black text-[hsl(var(--brand-gold))]">{number}</span><h3 className="mt-5 text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{text}</p></div>)}</div>
        </div>
      </section>

      <section id="fasttract-system" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Simple on top. Powerful underneath.</p><h2 className="mt-4 text-4xl font-bold tracking-tight">Four places to look. One system doing the work.</h2><p className="mt-4 text-muted-foreground">FastTract keeps the customer experience focused while the CRM, calendars, communication, estimates, invoices, payments, and automations stay connected behind it.</p></div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{pillars.map((item) => <div key={item.title} className="group rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-1 hover:border-primary/50"><item.icon className="h-6 w-6 text-primary" /><h3 className="mt-5 text-lg font-semibold">{item.title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p></div>)}</div>
      </section>

      <section id="built-for-contractors" className="border-y border-border bg-primary/5">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div><p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">Ask FastTract</p><h2 className="mt-4 text-4xl font-bold tracking-tight">Talk to the business instead of clicking through it.</h2><p className="mt-5 text-lg leading-8 text-muted-foreground">“Who needs a follow-up?” “What estimates are still waiting?” “What jobs do I have tomorrow?” FastTract is being built so the answer is clear—and the next action is ready.</p><div className="mt-8 rounded-2xl border border-primary/30 bg-card p-5"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><Bot className="h-5 w-5" /></div><div><p className="text-sm font-semibold">Ask FastTract…</p><p className="text-xs text-muted-foreground">Show me every estimate waiting on a decision.</p></div></div></div></div>
          <div className="space-y-4">{[[ShieldCheck, "You stay in control", "FastTract prepares important work and keeps approval with the owner."], [FileSignature, "Built around real scope", "Estimates keep quantities, protection, exclusions, payment terms, and customer expectations visible."], [Phone, "Never lose the next job", "Lead capture, missed-call follow-up, scheduling, and customer history stay connected."]].map(([Icon, title, text]) => { const I = Icon as typeof ShieldCheck; return <div key={title as string} className="flex gap-4 rounded-2xl border border-border bg-card p-5"><I className="mt-1 h-6 w-6 shrink-0 text-primary" /><div><h3 className="font-semibold">{title as string}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text as string}</p></div></div>; })}</div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-24 text-center sm:px-6 lg:px-8"><h2 className="text-4xl font-bold tracking-tight">A better way to run the company you worked so hard to build.</h2><p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">FastTract is opening carefully to contractors who want a simpler, AI-first business system.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Button size="lg" asChild><Link to="/contact">Get early access</Link></Button><Button size="lg" variant="outline" asChild><Link to="/login">Already have access? Sign in</Link></Button></div></section>
      <FAQ items={faqItems} />
    </MarketingShell>
  );
}
