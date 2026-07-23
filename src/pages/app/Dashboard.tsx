import { FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bot, CalendarClock, Car, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleAlert, ExternalLink, FileCheck2, Gift, Link2, LockKeyhole, Mic,
  PhoneCall, Search, Send, ShieldCheck, Sparkles, Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RunItem = {
  id: string;
  title: string;
  detail: string;
  meta?: string;
  state: "automatic" | "approval" | "scheduled" | "decision";
  action?: string;
  icon: typeof PhoneCall;
};

const sections: { title: string; items: RunItem[] }[] = [
  {
    title: "Now",
    items: [{
      id: "call", title: "AI phone agent is handling an inbound call",
      detail: "New customer inquiry · Website redesign", meta: "Live now",
      state: "automatic", icon: PhoneCall,
    }],
  },
  {
    title: "Next",
    items: [
      {
        id: "followup", title: "Lead follow-up drafted and awaiting approval",
        detail: "For: Evergreen Services · Discovery call request", meta: "Draft prepared with next steps",
        state: "approval", action: "Review", icon: FileCheck2,
      },
      {
        id: "meeting", title: "10:30 AM · Team check-in",
        detail: "30 min · Conference room + Zoom", meta: "Starts in 48 minutes",
        state: "scheduled", action: "Join meeting", icon: Users,
      },
    ],
  },
  {
    title: "Later",
    items: [
      {
        id: "seo", title: "SEO broken-link repair ready for review",
        detail: "12 issues found · Fixes prepared and ready to publish", meta: "Review before publishing",
        state: "decision", action: "Review", icon: Search,
      },
      {
        id: "birthday", title: "Jessica’s birthday is tomorrow",
        detail: "Your secretary · Card reminder scheduled", meta: "Tomorrow",
        state: "scheduled", action: "View", icon: Gift,
      },
      {
        id: "oil", title: "Vehicle oil change due",
        detail: "2019 Ford F-150 · Recommended by Aug 4", meta: "In 12 days",
        state: "scheduled", action: "Schedule", icon: Car,
      },
      {
        id: "tax", title: "Oregon quarterly tax materials",
        detail: "Q2 2026 · Gathered for accountant review", meta: "Professional review required",
        state: "decision", action: "Review", icon: FileCheck2,
      },
    ],
  },
];

const stateMeta = {
  automatic: { label: "Handled automatically", className: "text-emerald-400", icon: CheckCircle2 },
  approval: { label: "Drafted for approval", className: "text-amber-400", icon: CircleAlert },
  scheduled: { label: "Scheduled", className: "text-sky-400", icon: CalendarClock },
  decision: { label: "Needs your decision", className: "text-amber-400", icon: CircleAlert },
};

export default function Dashboard() {
  const { user, activeOrg } = useAuth();
  const [agentOpen, setAgentOpen] = useState(true);
  const [command, setCommand] = useState("");
  const [completed, setCompleted] = useState<string[]>([]);
  const firstName = useMemo(() => {
    const full = user?.user_metadata?.full_name as string | undefined;
    return full?.split(" ")[0] || user?.email?.split("@")[0] || "there";
  }, [user]);

  const submitCommand = (event: FormEvent) => {
    event.preventDefault();
    if (!command.trim()) return;
    toast.success("Your agent is on it", { description: `FastTract is preparing: “${command.trim()}”` });
    setCommand("");
  };

  const handleAction = (item: RunItem) => {
    setCompleted((current) => [...current, item.id]);
    toast.success(item.state === "scheduled" ? "Opened schedule" : "Ready for your review", {
      description: item.title,
    });
  };

  return (
    <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[minmax(0,1fr)_324px]">
      <section className="min-w-0 px-4 py-7 sm:px-8 lg:px-10">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{firstName}’s day</h1>
            <p className="mt-1 text-sm text-muted-foreground">Thursday, July 23, 2026</p>
          </div>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setAgentOpen((open) => !open)}>
            <Bot className="mr-2 h-4 w-4" /> Agent
          </Button>
        </div>

        <form onSubmit={submitCommand} className="mb-8 flex items-center gap-2 rounded-xl border border-border bg-card p-2 focus-within:ring-2 focus-within:ring-primary">
          <Sparkles className="ml-3 h-5 w-5 text-primary" />
          <Input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
            placeholder="Ask your agent to handle anything…"
            aria-label="Ask your FastTract agent"
          />
          <Button type="button" size="icon" variant="ghost" aria-label="Talk to your agent" onClick={() => toast.info("Voice agent ready", { description: "Start speaking when the microphone opens." })}>
            <Mic className="h-5 w-5" />
          </Button>
          <Button type="submit" size="icon" aria-label="Send to your agent"><Send className="h-4 w-4" /></Button>
        </form>

        <div className="space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><span className="h-2 w-2 rounded-full bg-primary" />{section.title}</h2>
              <div className="overflow-hidden rounded-xl border border-border bg-card/45">
                {section.items.map((item, index) => {
                  const meta = stateMeta[item.state];
                  const StateIcon = meta.icon;
                  const done = completed.includes(item.id);
                  return (
                    <div key={item.id} className={cn(
                      "flex flex-col gap-4 p-4 sm:flex-row sm:items-center",
                      index > 0 && "border-t border-border",
                      done && "opacity-55",
                    )}>
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><item.icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                        {item.meta && <p className="mt-1 text-xs text-muted-foreground/75">{item.meta}</p>}
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-4 sm:w-48 sm:flex-col sm:items-end">
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium", meta.className)}>
                          {done ? <Check className="h-3.5 w-3.5" /> : <StateIcon className="h-3.5 w-3.5" />}
                          {done ? "Reviewed" : meta.label}
                        </span>
                        {item.action && !done && <Button variant="outline" size="sm" onClick={() => handleAction(item)}>{item.action}</Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </section>

      <aside className={cn(
        "border-l border-border bg-card/25 p-6 lg:block",
        agentOpen ? "block" : "hidden",
      )}>
        <div className="sticky top-6">
          <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 border-b border-border pb-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Agent online 24/7</span>
            <span className="flex items-center gap-2"><PhoneCall className="h-3.5 w-3.5 text-primary" /> Phone active</span>
          </div>
          <button onClick={() => setAgentOpen((open) => !open)} className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <span className="flex items-center gap-2 text-lg font-semibold"><Bot className="h-5 w-5 text-primary" />Agent</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", !agentOpen && "-rotate-90")} />
          </button>
          <div className="mt-7 border-b border-border pb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="mt-4 text-2xl font-semibold">Good morning, {firstName}.</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              I’ve prepared your runbook and I’m handling calls, follow-ups, and reminders so you can focus on what matters most.
            </p>
          </div>
          <div className="border-b border-border py-6">
            <h3 className="text-sm font-semibold">Suggestions</h3>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-lg border border-border">
              {[
                ["Call back the newest lead", "Follow up on their request"],
                ["Review website lead", "Schedule a discovery call"],
                ["Move team check-in", "Resolve a calendar conflict"],
              ].map(([title, detail]) => (
                <button key={title} onClick={() => setCommand(title)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{detail}</span></span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
            <Link to="/app/settings" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">What FastTract knows <ChevronRight className="h-4 w-4" /></Link>
          </div>
          <div className="py-6">
            <h3 className="text-sm font-semibold">Permissions & status</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Calls: Answering</li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" />Messages: Drafting</li>
              <li className="flex items-center gap-2"><Link2 className="h-4 w-4 text-emerald-400" />Business data: Connected</li>
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />State: {activeOrg?.organization?.name ? "Profile-aware" : "Configure profile"}</li>
            </ul>
            <div className="mt-5 flex gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
              <LockKeyhole className="h-4 w-4 shrink-0 text-primary" />
              <span>Sensitive actions, publishing, payments, and compliance work require your approval.</span>
            </div>
            <Button variant="ghost" size="sm" className="mt-3 px-0 text-muted-foreground" asChild><Link to="/app/business-profile">Manage agent context <ExternalLink className="ml-2 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
