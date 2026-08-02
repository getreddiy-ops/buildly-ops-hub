import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { SEO } from "@/components/SEO";
import { cn } from "@/lib/utils";
import {
  Bot, Phone, FileText, Package, Receipt, Calendar, MapPin, Play, Pause,
  CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, Users, Camera, Mic,
  ShieldCheck, TrendingUp, Clock, Home, Sparkles, PhoneIncoming, CircleDollarSign,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────
   All data below is fictional sample data for demonstration only.
   ──────────────────────────────────────────────────────────────── */

type Chapter = {
  key: string;
  label: string;
  title: string;
  caption: string;
  badge?: "Premium" | "Plus";
  icon: typeof Bot;
  duration: number;
  screen: (p: { progress: number; reduced: boolean }) => JSX.Element;
};

/* ── small shared UI primitives (simulated FastTract mobile UI) ── */

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 pt-2 text-[10px] font-medium text-foreground/70">
      <span>9:41</span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-3 rounded-[2px] bg-foreground/40" />
        <span className="inline-block h-2 w-4 rounded-[2px] border border-foreground/40" />
      </span>
    </div>
  );
}

function AppBar({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border-b border-border/70 px-4 pb-3 pt-2">
      <div className="text-[15px] font-semibold leading-tight">{title}</div>
      {sub ? <div className="text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function TabBar({ active }: { active: string }) {
  const tabs = [
    { key: "home", icon: Home, label: "Today" },
    { key: "jobs", icon: Calendar, label: "Jobs" },
    { key: "docs", icon: FileText, label: "Docs" },
    { key: "ai", icon: Bot, label: "Ava" },
  ];
  return (
    <div className="mt-auto grid grid-cols-4 border-t border-border/70 bg-card/80 px-2 pb-4 pt-2">
      {tabs.map((t) => (
        <div key={t.key} className="flex flex-col items-center gap-1">
          <t.icon className={cn("h-4 w-4", active === t.key ? "text-primary" : "text-muted-foreground")} />
          <span className={cn("text-[9px]", active === t.key ? "text-primary" : "text-muted-foreground")}>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "primary" | "success" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
        tone === "primary" && "bg-primary/15 text-primary",
        tone === "success" && "bg-success/15 text-success",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

function ReviewNote() {
  return (
    <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-border/70 bg-muted/50 p-2">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
      <p className="text-[10px] leading-snug text-muted-foreground">
        You review and approve before anything is sent.
      </p>
    </div>
  );
}

function countUp(target: number, progress: number, reduced: boolean) {
  if (reduced) return target;
  const eased = Math.min(1, progress / 0.6);
  return Math.round(target * eased);
}

function Waveform({ reduced }: { reduced: boolean }) {
  return (
    <div className="flex h-8 items-end justify-center gap-1" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span
          key={i}
          className={cn("w-1 rounded-full bg-primary", !reduced && "ft-wave-bar")}
          style={{ height: `${12 + ((i * 7) % 20)}px`, animationDelay: `${i * 70}ms` }}
        />
      ))}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "primary" }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-[11px] font-semibold",
          tone === "success" && "text-success",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Screen({ children, active = "home" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      {children}
      <TabBar active={active} />
    </div>
  );
}

function Stagger({ i, reduced, children }: { i: number; reduced: boolean; children: React.ReactNode }) {
  return (
    <div className={reduced ? undefined : "ft-rise"} style={reduced ? undefined : { animationDelay: `${i * 110}ms` }}>
      {children}
    </div>
  );
}

/* ── chapters ── */

const chapters: Chapter[] = [
  {
    key: "today",
    label: "Today",
    title: "Your day at a glance",
    caption: "The Today dashboard opens with new leads, active jobs, estimates awaiting your review, and invoices outstanding.",
    icon: Home,
    duration: 6000,
    screen: ({ progress, reduced }) => (
      <Screen active="home">
        <AppBar title="Today" sub="Rivera Concrete & Flatwork" />
        <div className="space-y-3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "New leads", value: 4, icon: Users },
              { label: "Active jobs", value: 6, icon: Calendar },
              { label: "Estimates out", value: 3, icon: FileText },
              { label: "Invoices due", value: 2, icon: Receipt },
            ].map((s, i) => (
              <Stagger key={s.label} i={i} reduced={reduced}>
                <div className="rounded-xl border border-border/70 bg-card p-3">
                  <s.icon className="mb-1.5 h-3.5 w-3.5 text-primary" />
                  <div className="text-xl font-bold tabular-nums">{countUp(s.value, progress, reduced)}</div>
                  <div className="text-[10px] text-muted-foreground">{s.label}</div>
                </div>
              </Stagger>
            ))}
          </div>
          <Stagger i={4} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 text-[11px] font-semibold">Next up</div>
              <Row label="8:00 AM · Maple St. driveway pour" value="Crew A" />
              <Row label="11:30 AM · Site visit, Oak Ridge" value="You" />
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "phone",
    label: "AI Phone",
    title: "AI answers the calls you miss",
    badge: "Premium",
    caption: "An incoming call is answered, captured as a lead, and summarized with the appointment the caller requested — nothing is booked until you confirm.",
    icon: PhoneIncoming,
    duration: 7000,
    screen: ({ reduced }) => (
      <Screen active="home">
        <AppBar title="AI Phone Agent" sub="Premium" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <div className="flex items-center gap-2">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-full bg-primary/20", !reduced && "ft-float")}>
                  <Phone className="h-4 w-4 text-primary" />
                </span>
                <div>
                  <div className="text-[12px] font-semibold">Incoming call answered</div>
                  <div className="text-[10px] text-muted-foreground">Duration 1:24 · Sample call</div>
                </div>
              </div>
              <div className="mt-2"><Waveform reduced={reduced} /></div>
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold">Call summary</span>
                <Pill tone="primary">New lead</Pill>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">
                "Dana Whitfield" asked about replacing a cracked 20 × 40 driveway. Wants a quote this week and mentioned a spring budget.
              </p>
              <div className="mt-2">
                <Row label="Requested visit" value="Thu 9:00 AM" />
                <Row label="Trade" value="Concrete flatwork" />
                <Row label="Status" value="Awaiting your confirm" tone="primary" />
              </div>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "leads",
    label: "Leads & CRM",
    title: "Every lead becomes a real record",
    caption: "Leads move through your pipeline with contact details, notes, and a follow-up you can set in one tap.",
    icon: Users,
    duration: 6500,
    screen: ({ reduced }) => (
      <Screen active="home">
        <AppBar title="Leads" sub="Pipeline · 4 new" />
        <div className="space-y-2 px-4 py-3">
          {[
            { name: "Dana Whitfield", stage: "New", note: "Driveway replacement" },
            { name: "Marcus Bell", stage: "Contacted", note: "Patio + steps" },
            { name: "Priya Raman", stage: "Quoted", note: "Shop slab, 900 sf" },
          ].map((l, i) => (
            <Stagger key={l.name} i={i} reduced={reduced}>
              <div className={cn("rounded-xl border bg-card p-3", i === 0 ? "border-primary/50" : "border-border/70")}>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">{l.name}</span>
                  <Pill tone={i === 0 ? "primary" : "muted"}>{l.stage}</Pill>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{l.note}</div>
              </div>
            </Stagger>
          ))}
          <Stagger i={3} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-1 text-[11px] font-semibold">Notes & follow-up</div>
              <p className="text-[10px] text-muted-foreground">Left voicemail. Reminder set for Wed 4:00 PM.</p>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "estimator",
    label: "AI Estimator",
    title: "Speak it or shoot it",
    caption: "Describe the job out loud or add a site photo. Ava prepares a draft using your own pricing — it is a draft, not a quote.",
    icon: Camera,
    duration: 7000,
    screen: ({ reduced }) => (
      <Screen active="ai">
        <AppBar title="AI Estimator" sub="Draft mode" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold">Listening…</span>
              </div>
              <Waveform reduced={reduced} />
              <p className="mt-2 rounded-lg bg-muted/60 p-2 text-[11px] leading-snug">
                "Price a 20 by 40 driveway, four inch slab with rebar, tear-out included."
              </p>
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold">Site photo attached</span>
                <Pill>1 image</Pill>
              </div>
              <div className="h-16 rounded-lg bg-gradient-to-br from-muted to-muted/40" aria-hidden="true" />
            </div>
          </Stagger>
          <Stagger i={2} reduced={reduced}>
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-semibold">Ava is preparing a draft estimate</span>
              </div>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "review",
    label: "Review",
    title: "You approve every number",
    caption: "Line items, materials and labor, and your margin are laid out. Nothing reaches the customer until you tap approve.",
    icon: FileText,
    duration: 7500,
    screen: ({ progress, reduced }) => (
      <Screen active="docs">
        <AppBar title="Estimate ES-1042" sub="Draft · Dana Whitfield" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <Row label="Tear-out & haul off" value="$1,850" />
              <Row label="Base rock & compaction" value="$620" />
              <Row label="Forms, rebar, labor" value="$4,940" />
              <Row label="Concrete placement & finish" value="$1,260" />
              <Row label="Misc. supplies & tax" value="$1,762" />
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-[11px] font-semibold">Total</span>
                <span className="text-[15px] font-bold tabular-nums text-primary">
                  ${countUp(10432, progress, reduced).toLocaleString()}
                </span>
              </div>
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="grid grid-cols-3 gap-2">
              {[
                { k: "Materials", v: "$4,180" },
                { k: "Labor", v: "$3,900" },
                { k: "Margin", v: "22%" },
              ].map((m) => (
                <div key={m.k} className="rounded-lg border border-border/70 bg-card p-2 text-center">
                  <div className="text-[11px] font-bold">{m.v}</div>
                  <div className="text-[9px] text-muted-foreground">{m.k}</div>
                </div>
              ))}
            </div>
          </Stagger>
          <Stagger i={2} reduced={reduced}>
            <div className="flex gap-2">
              <div className="flex-1 rounded-lg border border-border/70 py-2 text-center text-[11px] font-semibold text-muted-foreground">Edit</div>
              <div className={cn("relative flex-1 rounded-lg bg-primary py-2 text-center text-[11px] font-semibold text-primary-foreground", !reduced && "ft-float")}>
                Approve & send
              </div>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "accepted",
    label: "Accepted",
    title: "Accepted estimate becomes a job",
    caption: "When the customer accepts your approved estimate, FastTract creates the scheduled job for you.",
    icon: CheckCircle2,
    duration: 6000,
    screen: ({ reduced }) => (
      <Screen active="docs">
        <AppBar title="ES-1042" sub="Accepted by customer" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-success/40 bg-success/10 p-3 text-center">
              <CheckCircle2 className="mx-auto mb-1 h-6 w-6 text-success" />
              <div className="text-[12px] font-semibold">Estimate accepted</div>
              <div className="text-[10px] text-muted-foreground">Signed Mar 12 · $10,432</div>
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold">Job JB-2210 created</span>
                <Pill tone="success">Scheduled</Pill>
              </div>
              <Row label="Start" value="Thu 8:00 AM" />
              <Row label="Duration" value="1.5 days" />
              <Row label="Deposit due" value="$3,130" />
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "jobs",
    label: "Jobs & Crew",
    title: "Schedule, assign, and follow the work",
    caption: "Assign crews, watch status change, and see field updates come in from the jobsite.",
    icon: Calendar,
    duration: 6500,
    screen: ({ reduced }) => (
      <Screen active="jobs">
        <AppBar title="Jobs" sub="This week" />
        <div className="space-y-2 px-4 py-3">
          {[
            { id: "JB-2210", name: "Maple St. driveway", crew: "Crew A · 3", status: "In progress", tone: "primary" as const },
            { id: "JB-2207", name: "Oak Ridge patio", crew: "Crew B · 2", status: "Scheduled", tone: "muted" as const },
            { id: "JB-2199", name: "Shop slab pour", crew: "Crew A · 3", status: "Complete", tone: "success" as const },
          ].map((j, i) => (
            <Stagger key={j.id} i={i} reduced={reduced}>
              <div className="rounded-xl border border-border/70 bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-semibold">{j.name}</span>
                  <Pill tone={j.tone}>{j.status}</Pill>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{j.id} · {j.crew}</div>
              </div>
            </Stagger>
          ))}
          <Stagger i={3} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-1 text-[11px] font-semibold">Field update</div>
              <p className="text-[10px] text-muted-foreground">Crew A: "Forms set, pour on schedule." · 2 photos added</p>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "time",
    label: "Time & GPS",
    title: "GPS-verified hours you approve",
    caption: "Crews clock in on site with location verification. Hours land in your approval queue — you sign off before payroll.",
    icon: MapPin,
    duration: 7000,
    screen: ({ reduced }) => (
      <Screen active="jobs">
        <AppBar title="Time approvals" sub="3 entries pending" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-success/40 bg-success/10 p-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-success" />
                <div>
                  <div className="text-[12px] font-semibold">Clock-in verified on site</div>
                  <div className="text-[10px] text-muted-foreground">Maple St. jobsite · within 40 ft</div>
                </div>
              </div>
            </div>
          </Stagger>
          {[
            { n: "Miguel R.", h: "8.25 hrs" },
            { n: "Tyler B.", h: "7.75 hrs" },
            { n: "Devon K.", h: "8.00 hrs" },
          ].map((c, i) => (
            <Stagger key={c.n} i={i + 1} reduced={reduced}>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3">
                <div>
                  <div className="text-[12px] font-semibold">{c.n}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{c.h} · JB-2210</div>
                </div>
                <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">Approve</span>
              </div>
            </Stagger>
          ))}
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "costing",
    label: "Job costs",
    title: "Materials, costs, and real profit",
    caption: "Material purchases and approved labor roll into a live profit snapshot for each job.",
    icon: Package,
    duration: 6500,
    screen: ({ progress, reduced }) => (
      <Screen active="jobs">
        <AppBar title="JB-2210 costs" sub="Maple St. driveway" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold"><Package className="h-3.5 w-3.5 text-primary" />Materials</div>
              <Row label="Concrete · 9.9 cy" value="$1,940" />
              <Row label="Base rock · 6 tons" value="$610" />
              <Row label="Rebar & forms" value="$1,630" />
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <Row label="Approved labor" value="$3,760" />
              <Row label="Total cost" value="$7,940" />
              <Row label="Contract value" value="$10,432" />
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="flex items-center gap-1 text-[11px] font-semibold"><TrendingUp className="h-3.5 w-3.5 text-success" />Profit</span>
                <span className="text-[15px] font-bold tabular-nums text-success">
                  ${countUp(2492, progress, reduced).toLocaleString()}
                </span>
              </div>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "invoices",
    label: "Invoices",
    title: "Invoice and track what's paid",
    caption: "Send the invoice you approved, then watch deposits, balances, and payment status update.",
    icon: Receipt,
    duration: 6500,
    screen: ({ reduced }) => (
      <Screen active="docs">
        <AppBar title="Invoices" sub="2 outstanding" />
        <div className="space-y-2 px-4 py-3">
          {[
            { id: "IN-3081", who: "Dana W. · Deposit", amt: "$3,130", st: "Paid", tone: "success" as const },
            { id: "IN-3082", who: "Dana W. · Balance", amt: "$7,302", st: "Sent", tone: "primary" as const },
            { id: "IN-3077", who: "Priya R. · Shop slab", amt: "$4,120", st: "Overdue", tone: "muted" as const },
          ].map((iv, i) => (
            <Stagger key={iv.id} i={i} reduced={reduced}>
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card p-3">
                <div>
                  <div className="text-[12px] font-semibold">{iv.id}</div>
                  <div className="text-[10px] text-muted-foreground">{iv.who}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-bold tabular-nums">{iv.amt}</div>
                  <Pill tone={iv.tone}>{iv.st}</Pill>
                </div>
              </div>
            </Stagger>
          ))}
          <Stagger i={3} reduced={reduced}>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-3">
              <CircleDollarSign className="h-4 w-4 text-success" />
              <span className="text-[10px] text-muted-foreground">Payment received · deposit cleared</span>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "assistant",
    label: "AI Assistant",
    title: "Voice-to-form admin help",
    badge: "Plus",
    caption: "Tell Ava what you need. Every action arrives as a draft with a confirm step — Ava never sends or charges on its own.",
    icon: Bot,
    duration: 7000,
    screen: ({ reduced }) => (
      <Screen active="ai">
        <AppBar title="Ava" sub="AI admin assistant · Plus" />
        <div className="space-y-3 px-4 py-3">
          <Stagger i={0} reduced={reduced}>
            <div className="ml-8 rounded-2xl rounded-br-sm bg-primary/15 p-2.5 text-[11px]">
              "Add Dana's second driveway apron to the job and draft a change order."
            </div>
          </Stagger>
          <Stagger i={1} reduced={reduced}>
            <div className="mr-8 rounded-2xl rounded-bl-sm border border-border/70 bg-card p-2.5 text-[11px] text-muted-foreground">
              I drafted a change order for a 10 × 12 apron. Review the numbers and confirm to apply.
            </div>
          </Stagger>
          <Stagger i={2} reduced={reduced}>
            <div className="rounded-xl border border-primary/40 bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold">Draft change order</span>
                <Pill tone="primary">Needs confirm</Pill>
              </div>
              <Row label="Apron 10 × 12" value="$1,480" />
              <Row label="New contract total" value="$11,912" />
              <div className="mt-2 flex gap-2">
                <div className="flex-1 rounded-lg border border-border/70 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">Discard</div>
                <div className="flex-1 rounded-lg bg-primary py-1.5 text-center text-[10px] font-semibold text-primary-foreground">Confirm</div>
              </div>
            </div>
          </Stagger>
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
  {
    key: "recap",
    label: "Recap",
    title: "First call to final invoice",
    caption: "That's the whole loop — captured, estimated, approved, scheduled, tracked, costed, and paid. You stay in control at every step.",
    icon: Sparkles,
    duration: 9000,
    screen: ({ reduced }) => (
      <Screen active="home">
        <AppBar title="The full loop" sub="FastTract" />
        <div className="space-y-1.5 px-4 py-3">
          {[
            "Call answered, lead captured",
            "Estimate drafted from voice or photo",
            "You reviewed and approved it",
            "Accepted estimate became a job",
            "Crew scheduled, GPS hours approved",
            "Costs tracked, profit visible",
            "Invoice sent, payment received",
          ].map((t, i) => (
            <Stagger key={t} i={i} reduced={reduced}>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-2.5 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-success" />
                <span className="text-[11px]">{t}</span>
              </div>
            </Stagger>
          ))}
        </div>
        <ReviewNote />
      </Screen>
    ),
  },
];

/* ── page ── */

export default function Demo() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>();
  const touchRef = useRef<number | null>(null);

  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const chapter = chapters[index];

  const goto = useCallback((i: number, keepPlaying = false) => {
    setIndex(((i % chapters.length) + chapters.length) % chapters.length);
    setProgress(0);
    startRef.current = performance.now();
    if (!keepPlaying) setPlaying(false);
  }, []);

  // auto-advance loop
  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now() - progress * chapter.duration;
    const tick = (now: number) => {
      const p = (now - startRef.current) / chapter.duration;
      if (p >= 1) {
        setProgress(0);
        setIndex((i) => (i + 1) % chapters.length);
        startRef.current = now;
      } else {
        setProgress(p);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, chapter.duration]);

  // pause when tab hidden
  useEffect(() => {
    const onVis = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // arrow keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") { e.preventDefault(); goto(index + 1); }
      if (e.key === "ArrowLeft") { e.preventDefault(); goto(index - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goto, index]);

  const Screenshot = chapter.screen;

  return (
    <MarketingShell>
      <SEO
        title="FastTract Phone Demo | See the Contractor App in Action"
        description="Take a guided 60-second tour of the FastTract contractor app on a phone: AI phone answering, leads, AI estimating, approvals, scheduling, GPS time tracking, job costs, and invoices."
        path="/demo"
      />

      <section className="mx-auto max-w-6xl px-4 pt-12 pb-6 text-center sm:px-6 lg:px-8">
        <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          The FastTract phone demo
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          A guided walkthrough of a real contractor workday — from the first missed call to the paid invoice. Sample data only. You review and approve before anything is sent.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start">
          {/* PHONE */}
          <div className="mx-auto w-full max-w-[330px] sm:max-w-[360px]">
            <div
              className="relative mx-auto aspect-[390/844] w-full rounded-[2.6rem] border-[10px] border-[hsl(220_28%_14%)] bg-background shadow-elevated"
              onTouchStart={(e) => { touchRef.current = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                if (touchRef.current == null) return;
                const dx = e.changedTouches[0].clientX - touchRef.current;
                if (Math.abs(dx) > 45) goto(index + (dx < 0 ? 1 : -1));
                touchRef.current = null;
              }}
            >
              <div className="absolute left-1/2 top-0 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-[hsl(220_28%_14%)]" aria-hidden="true" />
              <div className="h-full w-full overflow-hidden rounded-[1.9rem] bg-background">
                <div key={chapter.key} className="h-full">
                  <Screenshot progress={progress} reduced={reduced} />
                </div>
              </div>
            </div>

            {/* CONTROLS */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Previous chapter" onClick={() => goto(index - 1)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                size="lg"
                className="h-11 min-w-[7.5rem]"
                aria-label={playing ? "Pause demo" : "Play demo"}
                onClick={() => { startRef.current = performance.now() - progress * chapter.duration; setPlaying((p) => !p); }}
              >
                {playing ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {playing ? "Pause" : "Play"}
              </Button>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Next chapter" onClick={() => goto(index + 1)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11"
                aria-label="Restart demo from the beginning"
                onClick={() => { goto(0, true); setPlaying(true); }}
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* CAPTION + CHAPTERS */}
          <div>
            <div aria-live="polite" className="rounded-2xl border border-border bg-card/70 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                  <chapter.icon className="h-3.5 w-3.5" />
                  Chapter {index + 1} of {chapters.length}
                </span>
                {chapter.badge ? (
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    {chapter.badge}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 text-xl font-semibold sm:text-2xl">{chapter.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground sm:text-base">{chapter.caption}</p>
              <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                FastTract drafts the work. You review and approve before anything is sent, scheduled, or billed.
              </p>
            </div>

            {/* progress rail */}
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-semibold">Chapters</h3>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {chapters.map((c, i) => {
                  const done = i < index;
                  const active = i === index;
                  return (
                    <button
                      key={c.key}
                      onClick={() => goto(i)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "group flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                    >
                      <c.icon className={cn("h-3.5 w-3.5 flex-shrink-0", active ? "text-primary" : done ? "text-success" : "")} />
                      <span className="flex-1 truncate font-medium">{c.label}</span>
                      {c.badge ? <span className="text-[10px] uppercase tracking-wide">{c.badge}</span> : null}
                      <span className="h-1 w-8 overflow-hidden rounded-full bg-border">
                        <span
                          className="block h-full rounded-full bg-primary"
                          style={{ width: active ? `${Math.round(progress * 100)}%` : done ? "100%" : "0%" }}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-border bg-card/70 p-5">
              <h3 className="text-lg font-semibold">Ready to run your jobs this way?</h3>
              <p className="mt-1 text-sm text-muted-foreground">7-day free trial · Plans $69, $169, and $269 per month · Cancel anytime.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button size="lg" className="ft-cta" asChild><Link to="/signup">Start Your 7-Day Free Trial</Link></Button>
                <Button size="lg" variant="outline" className="ft-cta" asChild><Link to="/pricing">View Pricing</Link></Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
