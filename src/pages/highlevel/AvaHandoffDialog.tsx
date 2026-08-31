import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  BriefcaseBusiness,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { highLevel, type FastTractLeadStatus } from "@/integrations/highlevel/client";
import { toast } from "sonner";

type HandoffKind = "lead" | "customer" | "job";
type JobStatus = "lead" | "scheduled" | "active" | "complete" | "on_hold";

type HandoffDraft = {
  name: string;
  email: string;
  phone: string;
  address: string;
  source: string;
  lead_status: FastTractLeadStatus;
  job_name: string;
  job_status: JobStatus;
  start_date: string;
  notes: string;
};

const leadStatuses: FastTractLeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
const jobStatuses: JobStatus[] = ["lead", "scheduled", "active", "on_hold", "complete"];

const emptyDraft: HandoffDraft = {
  name: "",
  email: "",
  phone: "",
  address: "",
  source: "",
  lead_status: "new",
  job_name: "",
  job_status: "scheduled",
  start_date: "",
  notes: "",
};

const contactSchema = z.object({
  name: z.string().trim().min(1, "A name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(3000),
});

const jobSchema = z.object({
  job_name: z.string().trim().min(1, "A job name is required").max(160),
  job_status: z.enum(["lead", "scheduled", "active", "complete", "on_hold"]),
  address: z.string().trim().max(300),
  start_date: z.string().trim().max(40),
  notes: z.string().trim().max(3000),
});

const kindConfig: Record<HandoffKind, {
  title: string;
  noun: string;
  icon: LucideIcon;
  saveLabel: string;
}> = {
  lead: { title: "Ava prepared a new lead", noun: "lead", icon: UserPlus, saveLabel: "Save lead" },
  customer: { title: "Ava prepared a new customer", noun: "customer", icon: Users, saveLabel: "Save customer" },
  job: { title: "Ava prepared a new job", noun: "job", icon: BriefcaseBusiness, saveLabel: "Save job" },
};

function handoffKind(pathname: string, requested: boolean): HandoffKind | null {
  if (!requested) return null;
  if (pathname === "/highlevel/leads") return "lead";
  if (pathname === "/highlevel/customers") return "customer";
  if (pathname === "/highlevel/jobs") return "job";
  return null;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizedDraft(values: Partial<HandoffDraft>): Partial<HandoffDraft> {
  const next = { ...values };
  if (next.lead_status && !leadStatuses.includes(next.lead_status)) delete next.lead_status;
  if (next.job_status && !jobStatuses.includes(next.job_status)) delete next.job_status;
  return next;
}

export function AvaHandoffDialog() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const kind = handoffKind(location.pathname, searchParams.get("new") === "1");
  const prompt = searchParams.get("prompt") ?? "";
  const [open, setOpen] = useState(Boolean(kind));
  const [draft, setDraft] = useState<HandoffDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const loadedKey = useRef("");

  const close = useCallback(() => {
    setOpen(false);
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("prompt");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const prepareDraft = useCallback(async (activeKind: HandoffKind, text: string) => {
    setDraft(emptyDraft);
    setWarnings([]);
    setOpen(true);
    if (!text.trim()) return;

    setLoading(true);
    try {
      if (activeKind === "job") {
        const response = await highLevel.aiFormFill<HandoffDraft>({
          prompt: text,
          formName: "Ava new job handoff",
          fields: [
            { name: "job_name", description: "Short contractor-friendly job name" },
            { name: "job_status", enum: jobStatuses, description: "Use scheduled unless the user clearly states another status" },
            { name: "address", description: "Job-site address only when provided" },
            { name: "start_date", type: "date", description: "Start date only when explicitly stated" },
            { name: "notes", description: "Scope, access, schedule, crew, and important job notes from the request" },
          ],
          context: {
            instruction: "Prepare a draft only. Never invent a customer, address, start date, measurement, price, or completed action.",
          },
        });
        setDraft((current) => ({ ...current, ...normalizedDraft(response.values) }));
        setWarnings(response.warnings ?? []);
      } else {
        const response = await highLevel.aiFormFill<HandoffDraft>({
          prompt: text,
          formName: activeKind === "lead" ? "Ava new lead handoff" : "Ava new customer handoff",
          fields: [
            { name: "name", description: "Exact person or company name only when provided" },
            { name: "email", type: "email" },
            { name: "phone", type: "phone" },
            { name: "address", description: "Customer or job-site address only when provided" },
            ...(activeKind === "lead" ? [
              { name: "source", description: "Referral, website, call, social, or other source only when stated" },
              { name: "lead_status", enum: leadStatuses, description: "Use new unless the user clearly states another stage" },
            ] : []),
            { name: "notes", description: "What the person needs and any important follow-up details" },
          ],
          context: {
            instruction: "Prepare a draft only. Never invent a name, email, phone, address, source, or completed action.",
          },
        });
        setDraft((current) => ({ ...current, ...normalizedDraft(response.values) }));
        setWarnings(response.warnings ?? []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Ava could not prepare the ${activeKind}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!kind) {
      setOpen(false);
      return;
    }
    const key = `${kind}:${prompt}`;
    if (loadedKey.current === key) {
      setOpen(true);
      return;
    }
    loadedKey.current = key;
    void prepareDraft(kind, prompt);
  }, [kind, prepareDraft, prompt]);

  const save = async () => {
    if (!kind) return;
    setSaving(true);
    try {
      if (kind === "job") {
        const parsed = jobSchema.safeParse(draft);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        await highLevel.createRecord("jobs", {
          properties: {
            job_name: parsed.data.job_name,
            status: parsed.data.job_status,
            address: parsed.data.address || null,
            start_date: parsed.data.start_date || null,
            notes: parsed.data.notes || null,
          },
        });
      } else {
        const parsed = contactSchema.safeParse(draft);
        if (!parsed.success) throw new Error(parsed.error.issues[0].message);
        const payload = {
          name: parsed.data.name,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          address: parsed.data.address || null,
          notes: parsed.data.notes || null,
        };
        if (kind === "lead") {
          await highLevel.createLead({
            ...payload,
            source: draft.source || null,
            status: draft.lead_status,
          });
        } else {
          await highLevel.upsertContact(payload);
        }
      }

      toast.success(`${titleCase(kindConfig[kind].noun)} saved in HighLevel`);
      window.location.assign(location.pathname);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to save the ${kind}`);
    } finally {
      setSaving(false);
    }
  };

  if (!kind) return null;
  const config = kindConfig[kind];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) close(); else setOpen(true); }}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4 pr-7">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Prepared—not saved</p>
              <DialogTitle className="mt-1 text-xl">{config.title}</DialogTitle>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Review every field below. Nothing reaches HighLevel until you press {config.saveLabel}.</p>
            </div>
          </div>
        </DialogHeader>

        {prompt && (
          <div className="rounded-xl border border-border bg-background/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Your request</p>
            <p className="mt-2 text-sm leading-6">{prompt}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-5">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div><p className="font-medium">Ava is preparing the draft</p><p className="mt-1 text-sm text-muted-foreground">Only details found in your request will be filled.</p></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {kind === "job" ? (
              <>
                <Field label="Job name"><Input value={draft.job_name} onChange={(event) => setDraft({ ...draft, job_name: event.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Status">
                    <Select value={draft.job_status} onValueChange={(value) => setDraft({ ...draft, job_status: value as JobStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{jobStatuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Start date"><Input type="date" value={draft.start_date} onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} /></Field>
                </div>
                <Field label="Job address"><Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
                <Field label="Scope and notes"><Textarea rows={6} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
              </>
            ) : (
              <>
                <Field label={kind === "lead" ? "Lead name" : "Customer name"}><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Email"><Input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></Field>
                  <Field label="Phone"><Input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} /></Field>
                </div>
                <Field label="Address"><Input value={draft.address} onChange={(event) => setDraft({ ...draft, address: event.target.value })} /></Field>
                {kind === "lead" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Source"><Input value={draft.source} onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></Field>
                    <Field label="Pipeline stage">
                      <Select value={draft.lead_status} onValueChange={(value) => setDraft({ ...draft, lead_status: value as FastTractLeadStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{leadStatuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                )}
                <Field label="Notes"><Textarea rows={5} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></Field>
              </>
            )}
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-warning">Ava needs your review</p>
            <p className="mt-1 leading-6">{warnings.join(" ")}</p>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg border border-border bg-background/50 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          FastTract never treats an AI draft as approval. Confirm the identity, dates, scope, and contact details before saving.
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={close}>Cancel</Button>
          {prompt && (
            <Button variant="outline" onClick={() => void prepareDraft(kind, prompt)} disabled={loading || saving}>
              <RefreshCw className="h-4 w-4" /> Fill again
            </Button>
          )}
          <Button onClick={() => void save()} disabled={loading || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : config.saveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
