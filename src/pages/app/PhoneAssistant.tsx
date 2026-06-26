import { useEffect, useMemo, useState, useCallback } from "react";
import { Phone, PhoneIncoming, PhoneOff, Voicemail, Clock, Sparkles, Plus, Mic, MicOff, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { PaywallGate } from "@/components/PaywallGate";
import { getPaddleEnvironment } from "@/lib/paddle";

type Assistant = {
  id: string;
  organization_id: string;
  enabled: boolean;
  voice_id: string;
  greeting: string;
  transfer_number: string | null;
  capabilities: Record<string, boolean>;
  elevenlabs_agent_id: string | null;
  twilio_phone_number: string | null;
  twilio_phone_sid: string | null;
};

type CallRow = {
  id: string;
  from_number: string | null;
  to_number: string | null;
  started_at: string;
  duration_seconds: number | null;
  status: string;
  outcome: string | null;
  summary: string | null;
};

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
];

const CAPS: Array<[keyof Assistant["capabilities"], string]> = [
  ["book_estimates", "Book estimates on calendar"],
  ["capture_leads", "Capture lead details"],
  ["sms_followup", "Send SMS follow-up"],
  ["transfer", "Transfer to a teammate"],
  ["voicemail", "Take voicemail"],
  ["faq", "Answer FAQ"],
];

export default function PhoneAssistantPage() {
  return (
    <PaywallGate feature="Phone Assistant" requires="premium">
      <PhoneAssistant />
    </PaywallGate>
  );
}

function PhoneAssistant() {
  const { activeOrg } = useAuth();
  const { isOwner } = useSubscription();
  const orgId = activeOrg?.organization_id ?? null;
  const canEdit = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [areaCode, setAreaCode] = useState("");
  const [numberType, setNumberType] = useState<"local" | "toll_free">("local");
  const [byoNumber, setByoNumber] = useState("");
  const [available, setAvailable] = useState<Array<{ phone_number: string; friendly_name: string; locality?: string; region?: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    const [a, c] = await Promise.all([
      supabase.from("phone_assistants").select("*").eq("organization_id", orgId).maybeSingle(),
      supabase.from("phone_calls").select("*").eq("organization_id", orgId).order("started_at", { ascending: false }).limit(25),
    ]);
    setAssistant((a.data as Assistant | null) ?? null);
    setCalls((c.data as CallRow[] | null) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const [draft, setDraft] = useState<Partial<Assistant>>({});
  useEffect(() => { setDraft({}); }, [assistant?.id]);
  const merged = useMemo<Assistant | null>(() => assistant ? { ...assistant, ...draft } : null, [assistant, draft]);

  // Defaults when no assistant yet
  const editing: Partial<Assistant> = merged ?? {
    enabled: true,
    voice_id: "EXAVITQu4vr4xnSDxMaL",
    greeting: "Hi, you have reached our office. I can help schedule an estimate, take a message, or transfer you to a team member.",
    transfer_number: "",
    capabilities: { book_estimates: true, capture_leads: true, transfer: true, voicemail: true, sms_followup: false, faq: true },
    ...draft,
  };

  const save = async () => {
    if (!orgId) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("phone-assistant", {
      body: {
        organization_id: orgId,
        environment: getPaddleEnvironment(),
        enabled: editing.enabled,
        voice_id: editing.voice_id,
        greeting: editing.greeting,
        transfer_number: editing.transfer_number || null,
        capabilities: editing.capabilities,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Failed to save");
      return;
    }
    toast.success("Assistant saved");
    setDraft({});
    load();
  };

  const callProvision = async (payload: Record<string, unknown>) => {
    if (!orgId) return null;
    const { data, error } = await supabase.functions.invoke("phone-assistant-provision", {
      body: { organization_id: orgId, ...payload },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Request failed");
      return null;
    }
    return data as any;
  };

  const searchNumbers = async () => {
    setSearching(true);
    setAvailable([]);
    const data = await callProvision({
      action: "search",
      number_type: numberType,
      area_code: numberType === "local" ? (areaCode || undefined) : undefined,
    });
    setSearching(false);
    if (data?.numbers) setAvailable(data.numbers);
    if (data?.numbers?.length === 0) toast.message("No numbers found — try a different area code.");
  };

  const purchase = async (phone_number?: string) => {
    setProvisioning(true);
    const data = await callProvision({
      action: "purchase",
      number_type: numberType,
      area_code: numberType === "local" ? (areaCode || undefined) : undefined,
      phone_number,
    });
    setProvisioning(false);
    if (!data) return;
    toast.success(`Number connected: ${data.assistant.twilio_phone_number}`);
    setProvisionOpen(false);
    setAreaCode(""); setAvailable([]); setByoNumber("");
    load();
  };

  const bringYourOwn = async () => {
    if (!byoNumber.trim()) return toast.error("Enter a phone number");
    setProvisioning(true);
    const data = await callProvision({ action: "byo", phone_number: byoNumber.trim() });
    setProvisioning(false);
    if (!data) return;
    toast.success("Number saved. Forward your line to the assistant to take live calls.");
    setProvisionOpen(false);
    setByoNumber("");
    load();
  };

  const release = async () => {
    if (!confirm("Release this number? Incoming calls will stop reaching your assistant.")) return;
    setReleasing(true);
    const data = await callProvision({ action: "release" });
    setReleasing(false);
    if (!data) return;
    toast.success("Number released");
    load();
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const hasNumber = !!assistant?.twilio_phone_number;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Phone className="h-7 w-7 text-primary" />
            Phone Assistant
          </h1>
          <p className="mt-1 text-muted-foreground">
            24/7 AI receptionist powered by ElevenLabs. Answers calls, books estimates, and logs every conversation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasNumber && canEdit && (
            <Button variant="outline" onClick={release} disabled={releasing}>
              {releasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Release number
            </Button>
          )}
          <Dialog open={provisionOpen} onOpenChange={setProvisionOpen}>
            <DialogTrigger asChild>
              <Button disabled={!canEdit || !assistant?.elevenlabs_agent_id || hasNumber}>
                <Plus className="mr-2 h-4 w-4" />
                {hasNumber ? "Number connected" : "Get a phone number"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Get a phone number for your assistant</DialogTitle>
              </DialogHeader>
              <Tabs defaultValue="local" onValueChange={(v) => { setNumberType(v === "tollfree" ? "toll_free" : "local"); setAvailable([]); }}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="local">Local</TabsTrigger>
                  <TabsTrigger value="tollfree">Toll-free</TabsTrigger>
                  <TabsTrigger value="byo">Bring your own</TabsTrigger>
                </TabsList>

                <TabsContent value="local" className="space-y-3 pt-3">
                  <Label>Area code (optional)</Label>
                  <div className="flex gap-2">
                    <Input placeholder="e.g. 415" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
                    <Button variant="outline" onClick={searchNumbers} disabled={searching}>
                      {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                    </Button>
                  </div>
                  <NumberList numbers={available} onPick={purchase} provisioning={provisioning} />
                  <p className="text-xs text-muted-foreground">
                    Included with your Premium plan. We'll buy a local number and route calls to your assistant.
                  </p>
                </TabsContent>

                <TabsContent value="tollfree" className="space-y-3 pt-3">
                  <Button variant="outline" onClick={searchNumbers} disabled={searching} className="w-full">
                    {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Search toll-free numbers
                  </Button>
                  <NumberList numbers={available} onPick={purchase} provisioning={provisioning} />
                  <p className="text-xs text-muted-foreground">
                    800/888/877-style numbers. Included with your Premium plan.
                  </p>
                </TabsContent>

                <TabsContent value="byo" className="space-y-3 pt-3">
                  <Label>Your existing business number</Label>
                  <Input placeholder="+1 555 000 0000" value={byoNumber} onChange={(e) => setByoNumber(e.target.value)} />
                  <p className="text-xs text-muted-foreground">
                    Save your number here, then forward it (carrier call-forwarding or SIP) to the assistant. To port the number to us instead, contact support.
                  </p>
                  <DialogFooter>
                    <Button onClick={bringYourOwn} disabled={provisioning}>
                      {provisioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save number
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <StatCards calls={calls} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assistant configuration</h2>
              <p className="text-sm text-muted-foreground">
                Saving will create or update your ElevenLabs agent.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!editing.enabled}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, enabled: v }))}
                disabled={!canEdit}
                id="enabled"
              />
              <Label htmlFor="enabled" className="text-sm">{editing.enabled ? "Active" : "Paused"}</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Voice</Label>
              <select
                value={editing.voice_id}
                onChange={(e) => setDraft((d) => ({ ...d, voice_id: e.target.value }))}
                disabled={!canEdit}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Transfer-to number</Label>
              <Input
                placeholder="+1 555 000 0000"
                value={editing.transfer_number ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, transfer_number: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Greeting script</Label>
            <Textarea
              rows={4}
              value={editing.greeting ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, greeting: e.target.value }))}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-2">
            <Label>Capabilities</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {CAPS.map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={!!editing.capabilities?.[key]}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        capabilities: { ...(editing.capabilities ?? {}), [key]: e.target.checked },
                      }))
                    }
                    disabled={!canEdit}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {assistant?.elevenlabs_agent_id ? `Agent ID: ${assistant.elevenlabs_agent_id}` : "No agent yet — saving will create one."}
            </span>
            <Button onClick={save} disabled={!canEdit || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {assistant?.elevenlabs_agent_id ? "Save changes" : "Create assistant"}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div>
              <h2 className="text-lg font-semibold">Routing</h2>
              <p className="text-sm text-muted-foreground">How calls reach your assistant.</p>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Assistant number</div>
                <div className="font-mono">{assistant?.twilio_phone_number ?? "Not connected"}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Transfer to</div>
                <div className="font-mono">{editing.transfer_number || "Not set"}</div>
              </div>
              <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Forward your business line to the assistant number so missed and after-hours calls land here.
              </div>
            </div>
          </Card>

          <TestConsole agentReady={!!assistant?.elevenlabs_agent_id} orgId={orgId} />
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Recent calls</h2>
            <p className="text-sm text-muted-foreground">Every conversation is transcribed and summarized.</p>
          </div>
        </div>
        {calls.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No calls yet. Connect a phone number and test it by calling.
          </div>
        ) : (
          <div className="divide-y">
            {calls.map((c) => <CallRowItem key={c.id} call={c} />)}
          </div>
        )}
      </Card>
    </div>
  );
}

function TestConsole(props: { agentReady: boolean; orgId: string | null }) {
  return (
    <ConversationProvider
      onError={(e: unknown) => toast.error(typeof e === "string" ? e : (e as Error)?.message ?? "Voice error")}
    >
      <TestConsoleInner {...props} />
    </ConversationProvider>
  );
}

function TestConsoleInner({ agentReady, orgId }: { agentReady: boolean; orgId: string | null }) {
  const [connecting, setConnecting] = useState(false);
  const conversation = useConversation();

  const start = async () => {
    if (!orgId) return;
    setConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error } = await supabase.functions.invoke("phone-assistant-token", {
        body: { organization_id: orgId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message);
      await conversation.startSession({
        conversationToken: (data as any).token,
        connectionType: "webrtc",
      });
    } catch (e) {
      toast.error((e as Error).message ?? "Failed to start");
    } finally {
      setConnecting(false);
    }
  };

  const stop = async () => { await conversation.endSession(); };
  const connected = conversation.status === "connected";

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Test in browser</h2>
        <p className="text-sm text-muted-foreground">Talk to your assistant live before going on a real call.</p>
      </div>
      {!agentReady ? (
        <p className="text-sm text-muted-foreground">Save the configuration to create your agent first.</p>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            onClick={connected ? stop : start}
            disabled={connecting}
            className={`flex h-20 w-20 items-center justify-center rounded-full transition ${
              connected ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary text-primary-foreground hover:opacity-90"
            }`}
          >
            {connecting ? <Loader2 className="h-7 w-7 animate-spin" /> : connected ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
          </button>
          <div className="text-xs text-muted-foreground">
            {connected ? (conversation.isSpeaking ? "Assistant is speaking…" : "Listening…") : "Tap to start a test call"}
          </div>
        </div>
      )}
    </Card>
  );
}

function StatCards({ calls }: { calls: CallRow[] }) {
  const sevenDayAgo = Date.now() - 7 * 24 * 3600 * 1000;
  const recent = calls.filter((c) => new Date(c.started_at).getTime() >= sevenDayAgo);
  const answered = recent.length;
  const booked = recent.filter((c) => /book|schedul|estimate/i.test(c.summary ?? "")).length;
  const durations = recent.map((c) => c.duration_seconds ?? 0).filter((n) => n > 0);
  const avg = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
  const vm = recent.filter((c) => (c.outcome ?? "").toLowerCase().includes("voicemail")).length;
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <StatCard icon={PhoneIncoming} label="Calls answered (7d)" value={String(answered)} />
      <StatCard icon={Sparkles} label="Estimates mentioned" value={String(booked)} />
      <StatCard icon={Clock} label="Avg handle time" value={fmtDuration(avg)} />
      <StatCard icon={Voicemail} label="Voicemails" value={String(vm)} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function CallRowItem({ call }: { call: CallRow }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-12">
      <div className="sm:col-span-3">
        <div className="font-medium">{call.from_number ?? "Unknown"}</div>
        <div className="text-xs text-muted-foreground">→ {call.to_number}</div>
      </div>
      <div className="text-xs text-muted-foreground sm:col-span-2">
        <div>{new Date(call.started_at).toLocaleString()}</div>
        <div>{fmtDuration(call.duration_seconds ?? 0)}</div>
      </div>
      <div className="sm:col-span-2">
        <Badge variant="secondary" className="gap-1">
          {call.status === "in_progress" ? <Phone className="h-3 w-3" /> : <PhoneOff className="h-3 w-3" />}
          {call.status}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground sm:col-span-5">
        {call.summary ?? "—"}
      </div>
    </div>
  );
}

function fmtDuration(s: number) {
  if (!s) return "0m 0s";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
}

function NumberList({
  numbers, onPick, provisioning,
}: {
  numbers: Array<{ phone_number: string; friendly_name: string; locality?: string; region?: string }>;
  onPick: (n: string) => void;
  provisioning: boolean;
}) {
  if (numbers.length === 0) return null;
  return (
    <div className="max-h-64 space-y-2 overflow-y-auto">
      {numbers.map((n) => (
        <div key={n.phone_number} className="flex items-center justify-between rounded-md border p-2">
          <div>
            <div className="font-mono text-sm">{n.friendly_name || n.phone_number}</div>
            {(n.locality || n.region) && (
              <div className="text-xs text-muted-foreground">{[n.locality, n.region].filter(Boolean).join(", ")}</div>
            )}
          </div>
          <Button size="sm" onClick={() => onPick(n.phone_number)} disabled={provisioning}>
            {provisioning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Use"}
          </Button>
        </div>
      ))}
    </div>
  );
}
