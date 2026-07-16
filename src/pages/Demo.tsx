import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import {
  Bot, Phone, FileText, FileSignature, Package, Receipt,
  Calendar, MapPin, Send, Play, Pause, CheckCircle2, ArrowRight, Sparkles,
  Volume2,
} from "lucide-react";

type Line = { label: string; value: string };
type Step = {
  key: string;
  tag: string;
  icon: typeof Bot;
  duration: number; // ms
  user: string;
  ai: string;
  card: { title: string; lines: Line[]; total?: string };
};

const steps: Step[] = [
  {
    key: "lead",
    tag: "Lead Capture",
    icon: Phone,
    duration: 5200,
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
    duration: 6800,
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
    duration: 5600,
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
    duration: 6200,
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
    duration: 5200,
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
    duration: 6000,
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

const TOTAL_MS = steps.reduce((s, x) => s + x.duration, 0);

function useTypewriter(text: string, speed = 18, active = true) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!active) { setOut(text); return; }
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed, active]);
  return out;
}

export default function Demo() {
  const [elapsed, setElapsed] = useState(0); // ms into full timeline
  const [playing, setPlaying] = useState(true);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) { lastTs.current = null; return; }
    const tick = (ts: number) => {
      if (lastTs.current == null) lastTs.current = ts;
      const dt = ts - lastTs.current;
      lastTs.current = ts;
      setElapsed((e) => (e + dt >= TOTAL_MS ? 0 : e + dt));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  // Compute current step + progress within step
  const { i, stepElapsed } = useMemo(() => {
    let acc = 0;
    for (let idx = 0; idx < steps.length; idx++) {
      if (elapsed < acc + steps[idx].duration) {
        return { i: idx, stepElapsed: elapsed - acc };
      }
      acc += steps[idx].duration;
    }
    return { i: steps.length - 1, stepElapsed: steps[steps.length - 1].duration };
  }, [elapsed]);

  const step = steps[i];
  const progress = elapsed / TOTAL_MS;

  // Phases inside a step: user typing (0-25%), thinking (25-40%), AI typing (40-80%), card reveal (60-100%)
  const p = stepElapsed / step.duration;
  const userDone = p > 0.28;
  const thinking = p > 0.25 && p < 0.42;
  const aiActive = p > 0.42;
  const cardActive = p > 0.58;
  const cardProgress = Math.min(1, Math.max(0, (p - 0.58) / 0.35));
  const visibleLines = Math.ceil(cardProgress * step.card.lines.length);
  const showTotal = p > 0.9 && !!step.card.total;

  const userText = useTypewriter(step.user, 22, p < 0.28);
  const aiText = useTypewriter(step.ai, 14, aiActive && p < 0.85);

  // Timeline of past turns for scroll feel
  const history = steps.slice(0, i);

  // Auto-scroll chat
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [i, visibleLines, aiText.length, userText.length]);

  const jumpTo = (idx: number) => {
    let acc = 0;
    for (let k = 0; k < idx; k++) acc += steps[k].duration;
    setElapsed(acc + 10);
  };

  return (
    <MarketingShell>
      <SEO
        title="FastTract Live Demo — See the AI Contractor Operating System in Action"
        description="Watch FastTract turn a phone call into a lead, AI estimate, contract, material list, schedule, and invoice — all in one continuous flow."
        path="/demo"
      />

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 lg:px-8 lg:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Live Interactive Demo
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            Watch a real job go from <span className="text-gradient-primary">first call to paid</span>
          </h1>
          <p className="mt-4 text-muted-foreground">
            One continuous take — no signup required.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* Player frame */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Video-style top chrome */}
          <div className="flex items-center justify-between border-b border-border/60 bg-background/60 px-4 py-2.5 backdrop-blur">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
              </div>
              <div className="ml-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                FastTract · Recorded Session
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                LIVE
              </span>
              <span>·</span>
              <span>{Math.floor(elapsed / 1000).toString().padStart(2, "0")}s / {Math.floor(TOTAL_MS / 1000)}s</span>
            </div>
          </div>

          {/* Stage */}
          <div className="relative grid gap-0 md:grid-cols-2 bg-gradient-to-br from-background/40 via-background to-background/60">
            {/* Ambient grid */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--foreground))_1px,transparent_1px)] [background-size:32px_32px]" />

            {/* Chat panel */}
            <div className="relative flex flex-col p-5 md:border-r border-border/60 min-h-[480px]">
              <div className="mb-3 flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <div className="text-xs font-semibold tracking-wide">FastTract Assistant</div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Portland, OR
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-hidden pr-1">
                {history.map((s) => (
                  <div key={s.key} className="space-y-2 opacity-60 transition-opacity">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 px-3 py-2 text-sm">
                      {s.user}
                    </div>
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background/60 border border-border px-3 py-2 text-sm text-muted-foreground">
                      {s.ai}
                    </div>
                  </div>
                ))}

                {/* Active turn */}
                <div key={step.key} className="space-y-2 animate-fade-in">
                  <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary/15 border border-primary/30 px-3 py-2 text-sm">
                    {userText}
                    {!userDone && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary animate-pulse" />}
                  </div>

                  {(thinking || aiActive) && (
                    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-background/60 border border-border px-3 py-2 text-sm text-muted-foreground">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        <Bot className="h-3 w-3" /> Assistant
                      </div>
                      {thinking && !aiActive ? (
                        <div className="flex gap-1 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.2s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:-0.1s]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" />
                        </div>
                      ) : (
                        <>
                          {aiText}
                          {aiActive && aiText.length < step.ai.length && (
                            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-primary/70 animate-pulse" />
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                <Send className="h-3.5 w-3.5" />
                <span className="flex-1 truncate">Type or speak the next step…</span>
                <Volume2 className="h-3.5 w-3.5 text-primary/70" />
              </div>
            </div>

            {/* Result card */}
            <div className="relative flex flex-col p-5 min-h-[480px]">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <step.icon className="h-4 w-4 text-primary" />
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{step.tag}</div>
                </div>
                <div className="text-xs font-medium text-foreground">{step.card.title}</div>
              </div>

              <div className="relative mt-4 flex-1 rounded-xl border border-border bg-background/40 overflow-hidden">
                {!cardActive ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      Generating {step.tag.toLowerCase()}…
                    </div>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {step.card.lines.slice(0, visibleLines).map((l, idx) => (
                      <li
                        key={l.label}
                        className="flex items-center justify-between px-4 py-2.5 text-sm animate-fade-in"
                        style={{ animationDelay: `${idx * 40}ms` }}
                      >
                        <span className="text-foreground">{l.label}</span>
                        <span className="font-mono text-muted-foreground">{l.value}</span>
                      </li>
                    ))}
                    {showTotal && step.card.total && (
                      <li className="flex items-center justify-between bg-primary/10 px-4 py-3 animate-fade-in">
                        <span className="text-base font-bold">Total</span>
                        <span className="font-mono text-lg font-bold text-primary">{step.card.total}</span>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {cardProgress > 0.9 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground animate-fade-in">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  Auto-saved to Sarah Miller's job record
                </div>
              )}
            </div>
          </div>

          {/* Scrubber / timeline */}
          <div className="border-t border-border/60 bg-background/70 px-4 py-3 backdrop-blur">
            <div className="mb-2 flex items-center gap-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
              </button>
              <div className="relative flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/80 to-primary"
                  style={{ width: `${progress * 100}%` }}
                />
                {steps.map((_, idx) => {
                  const acc = steps.slice(0, idx).reduce((s, x) => s + x.duration, 0);
                  return (
                    <span
                      key={idx}
                      className="absolute top-1/2 h-2 w-[2px] -translate-y-1/2 bg-background/80"
                      style={{ left: `${(acc / TOTAL_MS) * 100}%` }}
                    />
                  );
                })}
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {Math.floor(elapsed / 1000).toString().padStart(2, "0")}:
                {Math.floor((elapsed % 1000) / 10).toString().padStart(2, "0")}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((s, idx) => (
                <button
                  key={s.key}
                  onClick={() => jumpTo(idx)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    idx === i
                      ? "border-primary bg-primary text-primary-foreground"
                      : idx < i
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <s.icon className="h-3 w-3" />
                  {s.tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild><Link to="/signup">Start Free Trial</Link></Button>
          <Button size="lg" variant="outline" asChild><Link to="/contact">Book a Live Walkthrough</Link></Button>
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
