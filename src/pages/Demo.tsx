import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import {
  Bot, Phone, FileText, FileSignature, Package, Receipt,
  Calendar, MapPin, Send, Play, CheckCircle2, ArrowRight, Sparkles,
} from "lucide-react";

type Step = {
  key: string;
  tag: string;
  icon: typeof Bot;
  user: string;
  ai: string;
  card: { title: string; lines: { label: string; value: string }[]; total?: string };
};

const steps: Step[] = [
  {
    key: "lead",
    tag: "Lead Capture",
    icon: Phone,
    user: "New call: Sarah Miller wants a 20x40 concrete driveway in Portland, OR.",
    ai: "Got it — created a new lead for Sarah Miller with a driveway replacement job in Portland, OR. Marked source as Phone.",
    card: {
      title: "Lead — Sarah Miller",
      lines: [
        { label: "Job Type", value: "Driveway Replacement" },
        { label: "Location", value: "Portland, OR" },
        { label: "Source", value: "Inbound Call" },
        { label: "Status", value: "New" },
      ],
    },
  },
  {
    key: "estimate",
    tag: "AI Estimate",
    icon: FileText,
    user: "Build an estimate for a 20x40 concrete slab, 4 inch thickness with rebar.",
    ai: "Drafted an itemized estimate — 800 sq ft slab, includes excavation, base rock, forms, #4 rebar 18\" O.C., placement, finish, saw cuts, cleanup, plus 8% misc supplies.",
    card: {
      title: "Estimate #ES-1042",
      lines: [
        { label: "Excavation & Prep", value: "$1,850" },
        { label: "Base Rock", value: "$620" },
        { label: "Forms & Layout", value: "$980" },
        { label: "Rebar / Reinforcement", value: "$540" },
        { label: "Concrete Placement", value: "$3,420" },
        { label: "Finish Work", value: "$1,260" },
        { label: "Misc. Supplies & Tax", value: "$1,762" },
      ],
      total: "$10,432",
    },
  },
  {
    key: "contract",
    tag: "Contract",
    icon: FileSignature,
    user: "Turn it into a contract and send it to Sarah.",
    ai: "Generated a customer-facing contract with scope, exclusions, payment terms (30% deposit / 70% on completion), and Oregon lien language. Emailed to sarah@example.com.",
    card: {
      title: "Contract sent — awaiting signature",
      lines: [
        { label: "Deposit", value: "$3,130 (30%)" },
        { label: "Balance on Completion", value: "$7,302" },
        { label: "Start Window", value: "2 weeks" },
        { label: "Warranty", value: "1 year workmanship" },
      ],
    },
  },
  {
    key: "materials",
    tag: "Material List",
    icon: Package,
    user: "Make me a material list I can hand to the yard.",
    ai: "Built a pickup-ready list. Quantities include a 10% waste factor on rebar and forms.",
    card: {
      title: "Material List — Driveway",
      lines: [
        { label: "Concrete (4\" @ 800 sf)", value: "9.9 cy" },
        { label: "3/4\" Base Rock", value: "6 tons" },
        { label: "#4 Rebar (20 ft)", value: "42 sticks" },
        { label: "Rebar Tie Wire", value: "1 roll" },
        { label: "2x4 Form Boards", value: "22 pcs" },
        { label: "Form Stakes", value: "60 pcs" },
        { label: "Curing Compound", value: "2 gal" },
      ],
    },
  },
  {
    key: "schedule",
    tag: "Schedule",
    icon: Calendar,
    user: "Schedule the crew for next Thursday at 8am.",
    ai: "Booked the job on the calendar and notified the crew. Weather looks clear.",
    card: {
      title: "Scheduled — Thu 8:00 AM",
      lines: [
        { label: "Crew", value: "Miguel, Diego, Tyler" },
        { label: "Estimated Duration", value: "1.5 days" },
        { label: "Weather", value: "Clear, 68°F" },
        { label: "Site", value: "Portland, OR" },
      ],
    },
  },
  {
    key: "invoice",
    tag: "Invoice",
    icon: Receipt,
    user: "The job is finished. Send the final invoice.",
    ai: "Generated invoice INV-2081 for $10,432 with deposit credit applied. Sent to Sarah with a pay-online link.",
    card: {
      title: "Invoice INV-2081",
      lines: [
        { label: "Subtotal", value: "$10,432" },
        { label: "Deposit Applied", value: "-$3,130" },
        { label: "Balance Due", value: "$7,302" },
        { label: "Status", value: "Sent" },
      ],
      total: "$7,302",
    },
  },
];

export default function Demo() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setI((x) => (x + 1) % steps.length), 4200);
    return () => clearInterval(t);
  }, [playing]);

  const step = steps[i];
  const visible = useMemo(() => steps.slice(0, i + 1), [i]);

  return (
    <MarketingShell>
      <SEO
        title="FastTract Live Demo — See the AI Contractor OS in Action"
        description="Watch FastTract turn a phone call into a lead, AI estimate, contract, material list, schedule, and invoice — all in one flow."
        path="/demo"
      />

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Live Interactive Demo
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Watch a real job go from <span className="text-gradient-primary">first call to paid</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            No signup required. Follow along as FastTract's AI turns one phone call into a lead,
            estimate, contract, material list, schedule, and invoice.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild><Link to="/signup">Start Free Trial</Link></Button>
            <Button size="lg" variant="outline" onClick={() => setPlaying((p) => !p)}>
              <Play className="mr-2 h-4 w-4" /> {playing ? "Pause Demo" : "Play Demo"}
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Step pills */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {steps.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => { setI(idx); setPlaying(false); }}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                idx === i
                  ? "border-primary bg-primary text-primary-foreground"
                  : idx < i
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.tag}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chat panel */}
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold tracking-wide">FastTract Assistant</div>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="h-3 w-3" /> Portland, OR
              </div>
            </div>
            <div className="space-y-3 min-h-[420px]">
              {visible.map((s) => (
                <div key={s.key} className="space-y-2">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/30 px-3 py-2 text-sm">
                    “{s.user}”
                  </div>
                  <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background/60 border border-border px-3 py-2 text-sm text-muted-foreground">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <Bot className="h-3 w-3" /> Assistant
                    </div>
                    {s.ai}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
              <Send className="h-3.5 w-3.5" />
              <span>Type or speak the next step…</span>
            </div>
          </div>

          {/* Result card */}
          <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-background/40 px-5 py-4">
              <div className="flex items-center gap-2">
                <step.icon className="h-4 w-4 text-primary" />
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{step.tag}</div>
              </div>
              <div className="text-xs font-medium text-foreground">{step.card.title}</div>
            </div>
            <ul className="divide-y divide-border">
              {step.card.lines.map((l) => (
                <li key={l.label} className="flex items-center justify-between px-5 py-3 text-sm">
                  <span className="text-foreground">{l.label}</span>
                  <span className="font-mono text-muted-foreground">{l.value}</span>
                </li>
              ))}
              {step.card.total && (
                <li className="flex items-center justify-between bg-primary/10 px-5 py-4">
                  <span className="text-base font-bold">Total</span>
                  <span className="font-mono text-lg font-bold text-primary">{step.card.total}</span>
                </li>
              )}
            </ul>
            <div className="border-t border-border bg-background/40 px-5 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              Auto-saved to Sarah Miller's job record
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background/40">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to run your business this way?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
            Start a free trial — no credit card required for the first 7 days. Cancel anytime.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button size="lg" asChild>
              <Link to="/signup">Start Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/contact">Book a Live Walkthrough</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
