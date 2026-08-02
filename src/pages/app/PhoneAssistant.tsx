import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Phone, PhoneIncoming, PhoneOff, Voicemail, Clock, Sparkles, Mic, MicOff,
  Loader2, CheckCircle2, AlertCircle, Copy, ArrowRight, ArrowLeft, ShieldCheck,
  Search, Wand2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useConversation, ConversationProvider } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PaywallGate } from "@/components/PaywallGate";
import { getBillingEnvironment } from "@/lib/billing";

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
  number_source?: string | null;
  setup_state?: Record<string, unknown> | null;
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

type AvailableNumber = {
  phone_number: string;
  friendly_name: string;
  locality?: string;
  region?: string;
  monthly_price?: string | null;
  price_unit?: string | null;
};

type OwnedNumber = {
  phone_number: string;
  friendly_name: string;
  sid: string;
  voice_url: string | null;
  already_routed: boolean;
};

type HealthStatus = {
  connected: boolean;
  phone_number: string | null;
  number_source: string | null;
  managed_by_fasttract: boolean;
  twilio_reachable: boolean;
  expected_webhook_url: string;
  voice_url: string | null;
  voice_url_ok: boolean;
};

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "9BWtsMINqrJLrRacOk9x", name: "Aria" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
];

const CAPS: Array<[string, string]> = [
  ["book_estimates", "Book estimates on calendar"],
  ["capture_leads", "Capture lead details"],
  ["sms_followup", "Send SMS follow-up"],
  ["transfer", "Transfer to a teammate"],
  ["voicemail", "Take voicemail"],
  ["faq", "Answer FAQ"],
];

const DEFAULTS = {
  enabled: true,
  voice_id: "EXAVITQu4vr4xnSDxMaL",
  greeting:
    "Hi, you have reached our office. I can help schedule an estimate, take a message, or transfer you to a team member.",
  transfer_number: "",
  capabilities: {
    book_estimates: true, capture_leads: true, transfer: true,
    voicemail: true, sms_followup: false, faq: true,
  } as Record<string, boolean>,
};

export default function PhoneAssistantPage() {
  return (
    <PaywallGate feature="Phone Assistant" requires="premium">
      <PhoneAssistant />
    </PaywallGate>
  );
}

export function PhoneAssistant() {
  const { activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id ?? null;
  const canEdit = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const draftRevision = useRef(0);

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
  const draftKey = orgId ? `fasttract:phone-assistant-draft:${orgId}` : null;

  useEffect(() => {
    setDraft({});
    setSaveState("saved");
    draftRevision.current = 0;
    if (!draftKey) return;
    try {
      const stored = sessionStorage.getItem(draftKey);
      if (!stored) return;
      const recovered = JSON.parse(stored) as Partial<Assistant>;
      if (recovered && typeof recovered === "object") {
        setDraft(recovered);
        setSaveState("unsaved");
      }
    } catch {
      sessionStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  const updateDraft = useCallback((patch: Partial<Assistant>) => {
    draftRevision.current += 1;
    setSaveState("unsaved");
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (draftKey) sessionStorage.setItem(draftKey, JSON.stringify(next));
      return next;
    });
  }, [draftKey]);

  const merged = useMemo<Assistant | null>(
    () => (assistant ? { ...assistant, ...draft } : null),
    [assistant, draft],
  );

  const editing: Partial<Assistant> = merged ?? { ...DEFAULTS, ...draft };

  const applyFunctionError = (data: any, error: any): string => {
    if (data?.error === "configuration_missing") {
      const names = (data.missing ?? []).join(", ");
      const message = `Phone assistant is not configured on the server${names ? ` (missing: ${names})` : ""}. No changes were made.`;
      setConfigError(message);
      return message;
    }
    return data?.error ?? error?.message ?? "Request failed";
  };

  const persist = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!orgId) return null;
    const revision = draftRevision.current;
    setSaving(true);
    setSaveState("saving");
    const { data, error } = await supabase.functions.invoke("phone-assistant", {
      body: {
        organization_id: orgId,
        environment: getBillingEnvironment(),
        enabled: editing.enabled,
        voice_id: editing.voice_id,
        greeting: editing.greeting,
        transfer_number: editing.transfer_number || null,
        capabilities: editing.capabilities,
      },
    });
    setSaving(false);
    if (error || (data as any)?.error) {
      const message = applyFunctionError(data, error);
      if (!opts.silent) toast.error(message);
      setSaveState("error");
      return null;
    }
    setConfigError(null);
    const savedAssistant = (data as any)?.assistant as Assistant | undefined;
    if (savedAssistant) setAssistant(savedAssistant);
    if (revision === draftRevision.current) {
      setDraft({});
      if (draftKey) sessionStorage.removeItem(draftKey);
      setSaveState("saved");
    } else {
      setSaveState("unsaved");
    }
    return savedAssistant ?? null;
  }, [draftKey, editing.capabilities, editing.enabled, editing.greeting, editing.transfer_number, editing.voice_id, orgId]);

  const save = persist;

  const createAssistant = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    const saved = await persist();
    setCreating(false);
    if (saved?.elevenlabs_agent_id) {
      toast.success("Your phone assistant is ready.");
      void load();
    }
  }, [creating, load, persist]);

  useEffect(() => {
    if (loading || !canEdit || !assistant || Object.keys(draft).length === 0) return;
    const timer = window.setTimeout(() => { void save(); }, 900);
    return () => window.clearTimeout(timer);
  }, [assistant, canEdit, draft, loading, save]);

  const callProvision = useCallback(async (payload: Record<string, unknown>) => {
    if (!orgId) return null;
    const { data, error } = await supabase.functions.invoke("phone-assistant-provision", {
      body: { organization_id: orgId, environment: getBillingEnvironment(), ...payload },
    });
    if (error || (data as any)?.error) {
      toast.error(applyFunctionError(data, error));
      return null;
    }
    return data as any;
  }, [orgId]);

  const agentReady = !!assistant?.elevenlabs_agent_id;
  const hasNumber = !!assistant?.twilio_phone_number;

  const refreshHealth = useCallback(async () => {
    if (!agentReady) return;
    const data = await callProvision({ action: "status" });
    if (data && typeof data.connected === "boolean") setHealth(data as HealthStatus);
  }, [agentReady, callProvision]);

  useEffect(() => { void refreshHealth(); }, [refreshHealth]);

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Phone className="h-6 w-6 shrink-0 text-primary sm:h-7 sm:w-7" />
          <span className="truncate">Phone Assistant</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          24/7 AI receptionist. Answers calls, books estimates, and logs every conversation.
        </p>
      </div>

      {configError && (
        <Card className="border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <div className="font-medium text-destructive">Server configuration missing</div>
              <p className="text-muted-foreground">{configError}</p>
            </div>
          </div>
        </Card>
      )}

      <SetupWizard
        agentReady={agentReady}
        hasNumber={hasNumber}
        callsCount={calls.length}
        canEdit={canEdit}
        creating={creating || saving}
        onCreate={createAssistant}
      />

      {agentReady && <StatCards calls={calls} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="space-y-5 p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Assistant configuration</h2>
              <p className="text-sm text-muted-foreground">
                {agentReady
                  ? "Changes save automatically and update your voice agent."
                  : "Review the defaults below, then create your assistant."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!editing.enabled}
                onCheckedChange={(v) => updateDraft({ enabled: v })}
                disabled={!canEdit}
                id="enabled"
              />
              <Label htmlFor="enabled" className="text-sm">{editing.enabled ? "Active" : "Paused"}</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="assistant-voice">Voice</Label>
              <select
                id="assistant-voice"
                value={editing.voice_id}
                onChange={(e) => updateDraft({ voice_id: e.target.value })}
                disabled={!canEdit}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assistant-transfer-number">Transfer-to number</Label>
              <Input
                id="assistant-transfer-number"
                placeholder="+1 555 000 0000"
                value={editing.transfer_number ?? ""}
                onChange={(e) => updateDraft({ transfer_number: e.target.value })}
                onBlur={() => { if (assistant && Object.keys(draft).length > 0) void save(); }}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assistant-greeting">Greeting script</Label>
            <Textarea
              id="assistant-greeting"
              rows={4}
              value={editing.greeting ?? ""}
              onChange={(e) => updateDraft({ greeting: e.target.value })}
              onBlur={() => { if (assistant && Object.keys(draft).length > 0) void save(); }}
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
                    onChange={(e) => updateDraft({
                      capabilities: { ...(editing.capabilities ?? {}), [key]: e.target.checked },
                    })}
                    disabled={!canEdit}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <SaveStatus state={saveState} agentReady={agentReady} />
              <div className="text-xs text-muted-foreground">
                {assistant?.elevenlabs_agent_id
                  ? `Agent ID: ${assistant.elevenlabs_agent_id}`
                  : "No assistant created yet."}
              </div>
            </div>
            {agentReady ? (
              <Button onClick={() => void save()} disabled={!canEdit || saving || Object.keys(draft).length === 0}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save now
              </Button>
            ) : (
              <Button onClick={() => void createAssistant()} disabled={!canEdit || creating || saving}>
                {(creating || saving) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Wand2 className="mr-2 h-4 w-4" />
                Create my phone assistant
              </Button>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <RoutingCard assistant={assistant} health={health} transferNumber={editing.transfer_number ?? ""} />
          <TestConsole agentReady={agentReady} orgId={orgId} />
        </div>
      </div>

      {agentReady && (
        <NumberSetup
          assistant={assistant!}
          health={health}
          canEdit={canEdit}
          callProvision={callProvision}
          reload={async () => { await load(); await refreshHealth(); }}
        />
      )}

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Recent calls</h2>
          <p className="text-sm text-muted-foreground">Every conversation is transcribed and summarized.</p>
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

/* ------------------------------------------------------------------ */
/* Setup wizard                                                        */
/* ------------------------------------------------------------------ */

function SetupWizard({
  agentReady, hasNumber, callsCount, canEdit, creating, onCreate,
}: {
  agentReady: boolean; hasNumber: boolean; callsCount: number;
  canEdit: boolean; creating: boolean; onCreate: () => void;
}) {
  if (agentReady && hasNumber && callsCount > 0) return null;
  const steps = [
    { label: "Business profile", done: true, hint: "Used to brief your assistant" },
    { label: "Create voice assistant", done: agentReady, hint: "Builds your AI receptionist" },
    { label: "Connect a number", done: hasNumber, hint: "Buy one or use your current line" },
    { label: "Test the assistant", done: callsCount > 0, hint: "Call it or test in the browser" },
  ];
  return (
    <Card className="space-y-4 p-6" aria-labelledby="setup-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="setup-heading" className="text-lg font-semibold">Set up your phone assistant</h2>
          <p className="text-sm text-muted-foreground">Four steps to go live.</p>
        </div>
        {!agentReady && (
          <Button onClick={onCreate} disabled={!canEdit || creating}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            Create my phone assistant
          </Button>
        )}
        {agentReady && (
          <Badge variant="secondary" className="gap-1 text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Assistant ready
          </Badge>
        )}
      </div>
      <ol className="grid gap-3 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s.label} className="rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              {s.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                : <span className="flex h-4 w-4 items-center justify-center rounded-full border text-[10px]">{i + 1}</span>}
              {s.label}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </li>
        ))}
      </ol>
      {!canEdit && (
        <p className="text-xs text-muted-foreground">Only an organization owner or admin can complete setup.</p>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Number setup                                                        */
/* ------------------------------------------------------------------ */

function NumberSetup({
  assistant, health, canEdit, callProvision, reload,
}: {
  assistant: Assistant;
  health: HealthStatus | null;
  canEdit: boolean;
  callProvision: (payload: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
}) {
  if (assistant.twilio_phone_number) {
    return (
      <ConnectedNumberCard
        assistant={assistant}
        health={health}
        canEdit={canEdit}
        callProvision={callProvision}
        reload={reload}
      />
    );
  }
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Connect a phone number</h2>
        <p className="text-sm text-muted-foreground">
          Buy a new number inside FastTract, or keep using your current business line.
        </p>
      </div>
      <Tabs defaultValue="buy">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="buy">Get a new number</TabsTrigger>
          <TabsTrigger value="existing">Use my current business number</TabsTrigger>
        </TabsList>
        <TabsContent value="buy" className="pt-4">
          <NumberMarketplace canEdit={canEdit} callProvision={callProvision} reload={reload} />
        </TabsContent>
        <TabsContent value="existing" className="pt-4">
          <ExistingNumberGuide
            canEdit={canEdit}
            assistantNumber={assistant.twilio_phone_number}
            callProvision={callProvision}
            reload={reload}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function NumberMarketplace({
  canEdit, callProvision, reload,
}: {
  canEdit: boolean;
  callProvision: (payload: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
}) {
  const [numberType, setNumberType] = useState<"local" | "toll_free">("local");
  const [areaCode, setAreaCode] = useState("");
  const [results, setResults] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<AvailableNumber | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [buying, setBuying] = useState(false);

  const search = async () => {
    setSearching(true);
    setResults([]);
    setSelected(null);
    const data = await callProvision({
      action: "search",
      number_type: numberType,
      area_code: numberType === "local" ? (areaCode || undefined) : undefined,
    });
    setSearching(false);
    setSearched(true);
    if (data?.numbers) setResults(data.numbers as AvailableNumber[]);
  };

  const purchase = async () => {
    if (!selected) return;
    setBuying(true);
    const data = await callProvision({
      action: "purchase",
      phone_number: selected.phone_number,
      confirm_number: selected.phone_number,
    });
    setBuying(false);
    if (!data) return;
    setConfirmOpen(false);
    setSelected(null);
    setResults([]);
    toast.success(
      data.already_connected
        ? "A number is already connected to this assistant."
        : `Number connected: ${data.assistant?.twilio_phone_number}`,
    );
    await reload();
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={numberType === "toll_free" ? "tollfree" : "local"}
        onValueChange={(v) => {
          setNumberType(v === "tollfree" ? "toll_free" : "local");
          setResults([]); setSelected(null); setSearched(false);
        }}
      >
        <TabsList>
          <TabsTrigger value="local">Local</TabsTrigger>
          <TabsTrigger value="tollfree">Toll-free</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-2">
        {numberType === "local" && (
          <div className="space-y-1">
            <Label htmlFor="area-code">Area code (optional)</Label>
            <Input
              id="area-code"
              className="w-32"
              placeholder="415"
              inputMode="numeric"
              value={areaCode}
              onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            />
          </div>
        )}
        <Button variant="outline" onClick={search} disabled={searching || !canEdit}>
          {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Search available numbers
        </Button>
      </div>

      {searched && results.length === 0 && !searching && (
        <p className="text-sm text-muted-foreground">No numbers found. Try a different area code or toll-free.</p>
      )}

      {results.length > 0 && (
        <div className="max-h-72 space-y-2 overflow-y-auto" role="radiogroup" aria-label="Available numbers">
          {results.map((n) => {
            const isSelected = selected?.phone_number === n.phone_number;
            return (
              <button
                key={n.phone_number}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(n)}
                className={`flex w-full items-center justify-between rounded-md border p-3 text-left transition ${
                  isSelected ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
                }`}
              >
                <div>
                  <div className="font-mono text-sm">{n.friendly_name || n.phone_number}</div>
                  {(n.locality || n.region) && (
                    <div className="text-xs text-muted-foreground">
                      {[n.locality, n.region].filter(Boolean).join(", ")}
                    </div>
                  )}
                </div>
                {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="rounded-md border bg-muted/40 p-4">
          <div className="text-xs text-muted-foreground">Selected number</div>
          <div className="font-mono text-lg">{selected.phone_number}</div>
          <div className="text-xs text-muted-foreground">
            {numberType === "toll_free" ? "Toll-free" : "Local"}
            {selected.locality ? ` · ${selected.locality}` : ""}
          </div>
          <Button className="mt-3" onClick={() => setConfirmOpen(true)} disabled={!canEdit}>
            Review and connect this number
          </Button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Premium unlocks the phone assistant. Telephony charges for the number itself are billed by the
        carrier and are not included in your FastTract plan.
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm this phone number</DialogTitle>
            <DialogDescription>Nothing is purchased until you confirm.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Number</div>
              <div className="font-mono text-lg">{selected?.phone_number}</div>
              <div className="mt-2 text-xs text-muted-foreground">Type</div>
              <div>{numberType === "toll_free" ? "Toll-free" : "Local"}</div>
              <div className="mt-2 text-xs text-muted-foreground">Monthly price</div>
              <div>Not published by the telephony provider through this integration.</div>
            </div>
            <p className="text-muted-foreground">
              Carrier and telephony charges (monthly number rental, per-minute and per-message usage) may
              apply and are billed separately from your FastTract subscription.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={purchase} disabled={buying}>
              {buying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm and connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Existing number: Forward / Connect Twilio / Port                    */
/* ------------------------------------------------------------------ */

function ExistingNumberGuide({
  canEdit, assistantNumber, callProvision, reload,
}: {
  canEdit: boolean;
  assistantNumber: string | null;
  callProvision: (payload: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
}) {
  const [path, setPath] = useState<"forward" | "twilio" | "port" | null>(null);

  if (!path) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <PathCard
          title="Forward calls"
          body="Keep your carrier line and forward calls to a FastTract assistant number."
          onSelect={() => setPath("forward")}
        />
        <PathCard
          title="Connect an existing Twilio number"
          body="Already own the number in the connected Twilio account? Route it to your assistant."
          onSelect={() => setPath("twilio")}
        />
        <PathCard
          title="Port an existing number"
          body="Move your number to the assistant permanently. Takes days, not minutes."
          onSelect={() => setPath("port")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setPath(null)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to options
      </Button>
      {path === "forward" && <ForwardGuide assistantNumber={assistantNumber} />}
      {path === "twilio" && (
        <ConnectTwilioGuide canEdit={canEdit} callProvision={callProvision} reload={reload} />
      )}
      {path === "port" && <PortGuide callProvision={callProvision} />}
    </div>
  );
}

function PathCard({ title, body, onSelect }: { title: string; body: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="rounded-md border p-4 text-left transition hover:border-primary hover:bg-muted/50"
    >
      <div className="flex items-center justify-between font-medium">
        {title}
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </button>
  );
}

function ForwardGuide({ assistantNumber }: { assistantNumber: string | null }) {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold">Forward your carrier line to the assistant</h3>
      {!assistantNumber ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <div className="font-medium">Connect an assistant number first</div>
          <p className="text-muted-foreground">
            Call forwarding needs a real destination phone number. Use the “Get a new number” tab to
            connect an assistant number, then come back here — that number becomes your forwarding
            destination.
          </p>
        </div>
      ) : (
        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">Forward your business line to</div>
          <div className="font-mono text-lg">{assistantNumber}</div>
        </div>
      )}
      <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
        <li>Keep your existing carrier line active — forwarding stops working if the line is cancelled.</li>
        <li>
          Open your carrier's account portal or call their support and ask to set up call forwarding to
          the assistant number above. Activation and deactivation codes differ by carrier, so follow your
          carrier's official instructions rather than a generic code.
        </li>
        <li>
          Choose the forwarding mode you want: <strong>unconditional</strong> (all calls go to the
          assistant), or — where your carrier supports it — <strong>busy</strong>,{" "}
          <strong>no-answer</strong>, or <strong>after-hours</strong> forwarding so the assistant only
          picks up overflow.
        </li>
        <li>Test from a different phone: call your business number and confirm the assistant answers.</li>
        <li>
          To undo it, use your carrier's cancel-forwarding option in the same portal or support channel.
        </li>
      </ol>
      <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
        Troubleshooting: if the call still rings your old line, forwarding was likely saved for a
        different mode (for example no-answer instead of unconditional). If the caller hears a carrier
        error, confirm the destination is entered in full E.164 form including the country code.
      </div>
    </div>
  );
}

function ConnectTwilioGuide({
  canEdit, callProvision, reload,
}: {
  canEdit: boolean;
  callProvision: (payload: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
}) {
  const [owned, setOwned] = useState<OwnedNumber[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const list = async () => {
    setLoading(true);
    const data = await callProvision({ action: "list_owned" });
    setLoading(false);
    if (data?.numbers) setOwned(data.numbers as OwnedNumber[]);
  };

  const connect = async () => {
    if (!selected) return;
    setConnecting(true);
    const data = await callProvision({ action: "connect_existing", phone_number: selected });
    setConnecting(false);
    if (!data) return;
    toast.success(`Connected ${data.assistant?.twilio_phone_number}`);
    await reload();
  };

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold">Connect a number you already own in Twilio</h3>
      <p className="text-muted-foreground">
        We verify the number belongs to the connected Twilio account before routing it. Numbers that
        aren't in that account can't be connected this way — use forwarding or start a port instead.
      </p>
      <Button variant="outline" onClick={list} disabled={loading || !canEdit}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
        Load my Twilio numbers
      </Button>
      {owned?.length === 0 && (
        <p className="text-muted-foreground">No numbers found in the connected Twilio account.</p>
      )}
      {!!owned?.length && (
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {owned.map((n) => (
            <button
              key={n.sid}
              type="button"
              onClick={() => setSelected(n.phone_number)}
              aria-pressed={selected === n.phone_number}
              className={`flex w-full items-center justify-between rounded-md border p-3 text-left ${
                selected === n.phone_number ? "border-primary ring-1 ring-primary" : "hover:bg-muted/50"
              }`}
            >
              <span className="font-mono">{n.phone_number}</span>
              {n.already_routed && <Badge variant="secondary">Already routed</Badge>}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <Button onClick={connect} disabled={connecting || !canEdit}>
          {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue — route {selected} to my assistant
        </Button>
      )}
    </div>
  );
}

const PORT_STEPS = [
  "Confirm you are the authorized account holder on the losing carrier's account.",
  "Gather a recent bill, the customer service record (CSR), and the account number and PIN.",
  "Sign a Letter of Authorization (LOA) with the service address exactly as the carrier has it.",
  "Submit the porting request and wait for the losing carrier to approve it.",
  "Keep the old line active and paid until the port completes — cancelling early can fail the port.",
  "Once the port completes, the number routes to your assistant and you can close the old account.",
];

function PortGuide({ callProvision }: { callProvision: (payload: Record<string, unknown>) => Promise<any> }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);

  const saveProgress = async () => {
    setSaving(true);
    await callProvision({ action: "save_setup", number_source: "porting", setup_state: { port_checklist: done } });
    setSaving(false);
    toast.success("Porting progress saved");
  };

  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-base font-semibold">Port your existing number</h3>
      <p className="text-muted-foreground">
        Porting moves the number permanently. It is not instant — carriers typically take several
        business days, and some take longer. Do not disconnect your old carrier before the port completes.
      </p>
      <ul className="space-y-2">
        {PORT_STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-2 rounded-md border p-2">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={!!done[i]}
              onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))}
              aria-label={step}
            />
            <span className="text-muted-foreground">{step}</span>
          </li>
        ))}
      </ul>
      <Button variant="outline" onClick={saveProgress} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save porting progress
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connected number                                                    */
/* ------------------------------------------------------------------ */

function ConnectedNumberCard({
  assistant, health, canEdit, callProvision, reload,
}: {
  assistant: Assistant;
  health: HealthStatus | null;
  canEdit: boolean;
  callProvision: (payload: Record<string, unknown>) => Promise<any>;
  reload: () => Promise<void>;
}) {
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [releasing, setReleasing] = useState(false);
  const number = assistant.twilio_phone_number!;

  const release = async () => {
    setReleasing(true);
    const data = await callProvision({ action: "release", confirm_number: typed.trim() });
    setReleasing(false);
    if (!data) return;
    setReleaseOpen(false);
    setTyped("");
    toast.success("Number released");
    await reload();
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Connected
          </h2>
          <p className="text-sm text-muted-foreground">Your assistant is reachable at this number.</p>
        </div>
        {canEdit && (
          <Button variant="outline" onClick={() => setReleaseOpen(true)}>Release number</Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xl">{number}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => { void navigator.clipboard?.writeText(number); toast.success("Copied"); }}
          aria-label="Copy phone number"
        >
          <Copy className="h-4 w-4" />
        </Button>
        {assistant.number_source && <Badge variant="secondary">{assistant.number_source.replace("_", " ")}</Badge>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-1 font-medium">Test the call routing</div>
          <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
            <li>Use a different phone than the transfer number.</li>
            <li>Dial {number} and wait for the greeting.</li>
            <li>Ask for an estimate — the call appears under Recent calls within a minute.</li>
          </ol>
        </div>
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4" /> Provisioning health
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>Telephony account reachable: {health ? (health.twilio_reachable ? "yes" : "no") : "checking…"}</li>
            <li>
              Call routing configured:{" "}
              {health ? (health.voice_url_ok ? "yes" : health.managed_by_fasttract ? "needs attention" : "managed outside FastTract") : "checking…"}
            </li>
          </ul>
        </div>
      </div>

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release {number}?</DialogTitle>
            <DialogDescription>
              Incoming calls will stop reaching your assistant immediately. Once released, this number
              returns to the carrier pool and may not be recoverable — you may not be able to get it back.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="release-confirm">Type {number} to confirm</Label>
            <Input
              id="release-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={number}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={release}
              disabled={releasing || typed.trim() !== number}
            >
              {releasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Release number
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function RoutingCard({
  assistant, health, transferNumber,
}: {
  assistant: Assistant | null;
  health: HealthStatus | null;
  transferNumber: string;
}) {
  return (
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
          <div className="font-mono">{transferNumber || "Not set"}</div>
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
          {assistant?.twilio_phone_number
            ? "Forward your existing business line to the assistant number so missed and after-hours calls land here."
            : "Connect an assistant number first — call forwarding needs a real phone number as its destination."}
          {health && !health.twilio_reachable && (
            <div className="mt-2 text-destructive">Telephony account is not reachable right now.</div>
          )}
        </div>
      </div>
    </Card>
  );
}

function SaveStatus({ state, agentReady }: { state: "saved" | "unsaved" | "saving" | "error"; agentReady: boolean }) {
  if (state === "saving") {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</span>;
  }
  if (state === "error") {
    return <span className="flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3.5 w-3.5" />Not saved — your draft is kept in this tab</span>;
  }
  if (state === "unsaved") {
    return <span className="flex items-center gap-1 text-xs text-amber-600"><Clock className="h-3.5 w-3.5" />Change detected</span>;
  }
  if (!agentReady) {
    return <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />Not created yet</span>;
  }
  return <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />All changes saved</span>;
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
        <p className="text-sm text-muted-foreground">Create your assistant to unlock browser voice testing.</p>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2">
          <button
            onClick={connected ? stop : start}
            disabled={connecting}
            aria-label={connected ? "End test call" : "Start test call"}
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
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
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
