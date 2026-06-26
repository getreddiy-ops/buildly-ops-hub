import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Check, ImagePlus, Loader2, Mic, Send, Sparkles, Square, Volume2, VolumeX, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecorder, useVoiceSpeaker } from "@/hooks/useVoice";
import { toast } from "sonner";


type ToolCall = { id: string; name: string; args: any; needsApproval: boolean };
type ProposalStatus = "pending" | "approved" | "rejected" | "executing" | "error";
type Proposal = ToolCall & { status: ProposalStatus; error?: string };

type Msg =
  | { role: "user"; content: string; images?: string[] }
  | { role: "assistant"; content: string; proposals?: Proposal[] };

const SUGGESTIONS = [
  "Add a new lead: Sarah Lee, 555-0142, kitchen remodel referral",
  "Draft a $12,000 estimate for John Doe — demo, framing, drywall",
  "Attach a photo of a wall and ask me to estimate the paint job",
  "Summarize what I should focus on today",
];

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB per image

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function Assistant({ compact = false }: { compact?: boolean } = {}) {
  const { activeOrg, user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { speak, stop: stopSpeak, speakingId, loadingId: speakLoadingId } = useVoiceSpeaker();
  const { recording, transcribing, start: startRec, stop: stopRec } = useVoiceRecorder((text) => {
    setInput((cur) => (cur ? `${cur} ${text}` : text));
    setTimeout(() => inputRef.current?.focus(), 0);
  });


  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setLoading(true);
    try {
      const apiMessages = next.map((m) => ({ role: m.role, content: m.content }));
      const { getPaddleEnvironment } = await import("@/lib/paddle");
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: apiMessages,
          orgName: activeOrg?.organization.name,
          organizationId: activeOrg?.organization_id,
          environment: getPaddleEnvironment(),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const proposals: Proposal[] = (data.tool_calls ?? [])
        .filter((t: ToolCall) => t.needsApproval)
        .map((t: ToolCall) => ({ ...t, status: "pending" as ProposalStatus }));
      const assistantText =
        data.content?.trim() ||
        (proposals.length ? `I drafted ${proposals.length} action${proposals.length > 1 ? "s" : ""} for your approval below.` : "Done.");
      setMessages((m) => [...m, { role: "assistant", content: assistantText, proposals }]);
      setTimeout(() => inputRef.current?.focus(), 50);
    } catch (e: any) {
      toast.error(e?.message ?? "Assistant failed");
      setMessages((m) => [...m, { role: "assistant", content: "Sorry — I ran into an error reaching the AI gateway." }]);
    } finally {
      setLoading(false);
    }
  };

  const updateProposal = (msgIdx: number, propId: string, patch: Partial<Proposal>) => {
    setMessages((all) =>
      all.map((m, i) => {
        if (i !== msgIdx || m.role !== "assistant" || !m.proposals) return m;
        return { ...m, proposals: m.proposals.map((p) => (p.id === propId ? { ...p, ...patch } : p)) };
      }),
    );
  };

  const executeProposal = async (msgIdx: number, p: Proposal) => {
    if (!activeOrg || !user) return toast.error("No active organization");
    updateProposal(msgIdx, p.id, { status: "executing" });
    try {
      const org_id = activeOrg.organization_id;
      let resultLabel = "Done";

      if (p.name === "create_lead") {
        const { error } = await supabase.from("leads").insert({
          organization_id: org_id,
          name: p.args.name,
          email: p.args.email ?? null,
          phone: p.args.phone ?? null,
          source: p.args.source ?? null,
          notes: p.args.notes ?? null,
          status: "new",
        });
        if (error) throw error;
        resultLabel = `Lead "${p.args.name}" created`;
      } else if (p.name === "create_customer") {
        const { error } = await supabase.from("customers").insert({
          organization_id: org_id,
          name: p.args.name,
          email: p.args.email ?? null,
          phone: p.args.phone ?? null,
          address: p.args.address ?? null,
          notes: p.args.notes ?? null,
        });
        if (error) throw error;
        resultLabel = `Customer "${p.args.name}" created`;
      } else if (p.name === "schedule_job") {
        const { data: cust, error: cErr } = await supabase
          .from("customers").select("id").eq("organization_id", org_id)
          .ilike("name", `%${p.args.customer_name}%`).limit(1).maybeSingle();
        if (cErr) throw cErr;
        if (!cust) throw new Error(`Customer "${p.args.customer_name}" not found. Create them first.`);
        const { error } = await supabase.from("jobs").insert({
          organization_id: org_id,
          customer_id: cust.id,
          title: p.args.title,
          description: p.args.description ?? null,
          scheduled_start: p.args.scheduled_start ?? null,
          scheduled_end: p.args.scheduled_end ?? null,
          address: p.args.address ?? null,
          status: "scheduled",
        });
        if (error) throw error;
        resultLabel = `Job "${p.args.title}" scheduled`;
      } else if (p.name === "draft_estimate_for_customer") {
        const { data: cust, error: cErr } = await supabase
          .from("customers").select("id").eq("organization_id", org_id)
          .ilike("name", `%${p.args.customer_name}%`).limit(1).maybeSingle();
        if (cErr) throw cErr;
        if (!cust) throw new Error(`Customer "${p.args.customer_name}" not found.`);
        const items = (p.args.line_items ?? []) as Array<{ description: string; quantity: number; unit_price: number }>;
        const subtotal = items.reduce((s, li) => s + (Number(li.quantity) || 0) * (Number(li.unit_price) || 0), 0);
        const tax_rate = Number(p.args.tax_rate ?? 0);
        const tax = subtotal * (tax_rate / 100);
        const total = subtotal + tax;
        const { data: est, error } = await supabase.from("estimates").insert({
          organization_id: org_id,
          customer_id: cust.id,
          title: p.args.title,
          notes: p.args.notes ?? null,
          subtotal, tax, total,
          status: "draft",
        }).select("id").single();
        if (error) throw error;
        if (items.length) {
          const rows = items.map((li) => ({
            estimate_id: est.id,
            description: li.description,
            quantity: li.quantity,
            unit_price: li.unit_price,
            total: (Number(li.quantity) || 0) * (Number(li.unit_price) || 0),
          }));
          const { error: liErr } = await supabase.from("estimate_line_items").insert(rows);
          if (liErr) throw liErr;
        }
        resultLabel = `Estimate "${p.args.title}" drafted ($${total.toFixed(2)})`;
      } else {
        throw new Error(`Unknown action: ${p.name}`);
      }

      await supabase.from("ai_actions").insert({
        organization_id: org_id,
        user_id: user.id,
        action_type: p.name,
        payload: p.args,
        status: "executed",
        executed_at: new Date().toISOString(),
        result: { label: resultLabel },
      });

      updateProposal(msgIdx, p.id, { status: "approved" });
      toast.success(resultLabel);
    } catch (e: any) {
      updateProposal(msgIdx, p.id, { status: "error", error: e?.message ?? "Failed" });
      toast.error(e?.message ?? "Failed to execute");
    }
  };

  const rejectProposal = async (msgIdx: number, p: Proposal) => {
    updateProposal(msgIdx, p.id, { status: "rejected" });
    if (activeOrg && user) {
      await supabase.from("ai_actions").insert({
        organization_id: activeOrg.organization_id,
        user_id: user.id,
        action_type: p.name,
        payload: p.args,
        status: "rejected",
      });
    }
  };

  return (
    <div className={compact ? "flex h-full min-h-0 flex-col" : "flex flex-col h-[calc(100vh-8rem)]"}>
      {!compact && (
        <PageHeader title="AI Assistant" description="Draft leads, estimates, jobs, and more. You approve every write." />
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-semibold">Try asking</h3>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-sm p-3 rounded-md border border-border hover:border-primary hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </Card>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[85%] space-y-3 ${m.role === "user" ? "" : "flex-1"}`}>
              <div className={`rounded-lg px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
              {m.role === "assistant" && m.content && (
                <button
                  type="button"
                  onClick={() => (speakingId === `m${i}` ? stopSpeak() : speak(`m${i}`, m.content))}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {speakLoadingId === `m${i}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : speakingId === `m${i}` ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {speakingId === `m${i}` ? "Stop" : "Listen"}
                </button>
              )}
              {m.role === "assistant" && m.proposals?.map((p) => (
                <ProposalCard
                  key={p.id}
                  proposal={p}
                  onApprove={() => executeProposal(i, p)}
                  onReject={() => rejectProposal(i, p)}
                />
              ))}
            </div>

          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg px-4 py-3 bg-muted flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="mt-4 flex gap-2 items-end"
      >
        <Textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={recording ? "Listening…" : transcribing ? "Transcribing…" : "Ask the assistant…"}
          rows={2}
          className="resize-none"
          disabled={loading || recording || transcribing}
        />
        <Button
          type="button"
          size="lg"
          variant={recording ? "destructive" : "outline"}
          onClick={() => (recording ? stopRec() : startRec())}
          disabled={loading || transcribing}
          title={recording ? "Stop recording" : "Voice input"}
        >
          {transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button type="submit" disabled={loading || !input.trim() || recording || transcribing} size="lg">
          <Send className="h-4 w-4" />
        </Button>
      </form>

    </div>
  );
}

const TITLES: Record<string, string> = {
  create_lead: "Create lead",
  create_customer: "Create customer",
  schedule_job: "Schedule job",
  draft_estimate_for_customer: "Draft estimate",
};

function ProposalCard({ proposal, onApprove, onReject }: { proposal: Proposal; onApprove: () => void; onReject: () => void }) {
  const statusBadge = {
    pending: <Badge variant="outline">Awaiting approval</Badge>,
    approved: <Badge className="bg-green-600 hover:bg-green-600">Approved & applied</Badge>,
    rejected: <Badge variant="secondary">Rejected</Badge>,
    executing: <Badge variant="outline">Applying…</Badge>,
    error: <Badge variant="destructive">Failed</Badge>,
  }[proposal.status];

  return (
    <Card className="p-4 border-primary/40">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {TITLES[proposal.name] ?? proposal.name}
        </div>
        {statusBadge}
      </div>
      <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(proposal.args, null, 2)}
      </pre>
      {proposal.error && <p className="text-xs text-destructive mt-2">{proposal.error}</p>}
      {proposal.status === "pending" && (
        <div className="flex gap-2 mt-3">
          <Button size="sm" onClick={onApprove}>
            <Check className="h-4 w-4 mr-1" /> Approve & apply
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X className="h-4 w-4 mr-1" /> Reject
          </Button>
        </div>
      )}
      {proposal.status === "executing" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
          <Loader2 className="h-3 w-3 animate-spin" /> Applying…
        </div>
      )}
    </Card>
  );
}
