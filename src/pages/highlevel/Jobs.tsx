import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import {
  BriefcaseBusiness,
  CalendarDays,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { AiFormHelper } from "@/components/AiFormHelper";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { highLevel, type HighLevelRecord } from "@/integrations/highlevel/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type JobProperties = Record<string, unknown>;

type JobForm = {
  job_name: string;
  status: "lead" | "scheduled" | "active" | "complete" | "on_hold";
  address: string;
  start_date: string;
  notes: string;
};

const empty: JobForm = {
  job_name: "",
  status: "scheduled",
  address: "",
  start_date: "",
  notes: "",
};

const schema = z.object({
  job_name: z.string().trim().min(1, "Job name is required").max(160),
  status: z.enum(["lead", "scheduled", "active", "complete", "on_hold"]),
  address: z.string().trim().max(300),
  start_date: z.string().trim().max(40),
  notes: z.string().trim().max(3000),
});

const propertyKeys = {
  job_name: ["custom_objects.jobs.job_name", "custom_object.jobs.job_name", "job_name", "name"],
  status: ["custom_objects.jobs.status", "custom_object.jobs.status", "status"],
  address: ["custom_objects.jobs.address", "custom_object.jobs.address", "address"],
  start_date: ["custom_objects.jobs.start_date", "custom_object.jobs.start_date", "start_date"],
  notes: ["custom_objects.jobs.notes", "custom_object.jobs.notes", "notes"],
} as const;

function readProperty(record: HighLevelRecord<JobProperties>, keys: readonly string[]) {
  const properties = record.properties ?? {};
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function HighLevelJobs() {
  const [jobs, setJobs] = useState<HighLevelRecord<JobProperties>[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<JobForm>(empty);
  const [selected, setSelected] = useState<HighLevelRecord<JobProperties> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await highLevel.listRecords<JobProperties>("jobs", { limit: 100 });
      setJobs(result.records ?? []);
      setSetupRequired(false);
    } catch (error) {
      setJobs([]);
      setSetupRequired(true);
      toast.error(error instanceof Error ? error.message : "Unable to load jobs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    active: jobs.filter((job) => readProperty(job, propertyKeys.status) === "active").length,
    scheduled: jobs.filter((job) => readProperty(job, propertyKeys.status) === "scheduled").length,
    complete: jobs.filter((job) => readProperty(job, propertyKeys.status) === "complete").length,
  }), [jobs]);

  const initialize = async () => {
    setSettingUp(true);
    try {
      const result = await highLevel.bootstrap();
      if (!result.ok && result.errors?.length) throw new Error(result.errors.join(" "));
      toast.success("FastTract Jobs is ready in this HighLevel sub-account");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to initialize FastTract Jobs");
    } finally {
      setSettingUp(false);
    }
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const value = parsed.data;
      await highLevel.createRecord<JobProperties>("jobs", {
        properties: {
          "custom_objects.jobs.job_name": value.job_name,
          "custom_object.jobs.status": value.status,
          "custom_object.jobs.address": value.address || null,
          "custom_object.jobs.start_date": value.start_date || null,
          "custom_object.jobs.notes": value.notes || null,
        },
      });
      toast.success("Job created in HighLevel");
      setForm(empty);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create job");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Jobs"
        description="The work your crew is planning, building, and closing out."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setForm(empty)} disabled={setupRequired}><Plus className="h-4 w-4" /> New job</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>New job</DialogTitle>
                    <AiFormHelper<JobForm>
                      formName="job"
                      fields={[
                        { name: "job_name", description: "Short customer-facing job name" },
                        { name: "status", enum: ["lead", "scheduled", "active", "complete", "on_hold"] },
                        { name: "address" },
                        { name: "start_date", type: "date" },
                        { name: "notes", description: "Scope and important job notes" },
                      ]}
                      onFill={(values) => setForm((current) => ({ ...current, ...values }))}
                      placeholder="e.g. Fletcher stamped patio at 123 Oak St, starts September 14, remove existing slab"
                    />
                  </div>
                </DialogHeader>
                <div className="grid gap-4">
                  <Field label="Job name"><Input value={form.job_name} onChange={(event) => setForm({ ...form, job_name: event.target.value })} /></Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Status">
                      <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as JobForm["status"] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["lead", "scheduled", "active", "complete", "on_hold"] as const).map((value) => (
                            <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Start date"><Input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></Field>
                  </div>
                  <Field label="Address"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
                  <Field label="Scope / notes"><Textarea rows={5} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void save()} disabled={saving}>{saving ? "Creating…" : "Create job"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-3">
        <Summary label="Active" value={counts.active} />
        <Summary label="Scheduled" value={counts.scheduled} />
        <Summary label="Complete" value={counts.complete} />
      </div>

      {setupRequired ? (
        <div className="rounded-2xl border border-primary/25 bg-card p-6 shadow-card sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Wrench className="h-5 w-5" /></div>
          <h2 className="mt-5 text-xl font-semibold">Initialize the FastTract job workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            FastTract will create the job records this sub-account needs while keeping every job isolated to this HighLevel location.
          </p>
          <Button className="mt-5" onClick={() => void initialize()} disabled={settingUp}>
            <Sparkles className="h-4 w-4" /> {settingUp ? "Setting up…" : "Set up Jobs"}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border border-border bg-card/40" />)}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <BriefcaseBusiness className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">No jobs yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create the first job manually or let Ava fill it from your notes.</p>
          <Button className="mt-5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New job</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {jobs.map((job) => {
            const status = readProperty(job, propertyKeys.status) || "scheduled";
            const address = readProperty(job, propertyKeys.address);
            const startDate = readProperty(job, propertyKeys.start_date);
            const notes = readProperty(job, propertyKeys.notes);
            return (
              <button type="button" key={job.id} onClick={() => setSelected(job)} className="min-w-0 rounded-xl border border-border bg-card/50 p-5 text-left shadow-card transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
                  <span className="rounded-full border border-border bg-background/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{statusLabel(status)}</span>
                </div>
                <h2 className="mt-4 truncate text-lg font-semibold">{readProperty(job, propertyKeys.job_name) || "Untitled job"}</h2>
                {address && <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{address}</span></p>}
                {startDate && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" />{startDate}</p>}
                {notes && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{notes}</p>}
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(next) => { if (!next) setSelected(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{selected ? readProperty(selected, propertyKeys.job_name) || "Untitled job" : "Job"}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                  {statusLabel(readProperty(selected, propertyKeys.status) || "scheduled")}
                </span>
                {readProperty(selected, propertyKeys.start_date) && (
                  <span className="flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> {readProperty(selected, propertyKeys.start_date)}
                  </span>
                )}
              </div>
              {readProperty(selected, propertyKeys.address) && (
                <div className="rounded-xl border border-border bg-card/40 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Job address</p>
                  <p className="mt-2 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{readProperty(selected, propertyKeys.address)}</p>
                </div>
              )}
              <div className="rounded-xl border border-border bg-card/40 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Scope and notes</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{readProperty(selected, propertyKeys.notes) || "No scope notes have been added yet."}</p>
              </div>
            </div>
          )}
          <DialogFooter><Button onClick={() => setSelected(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-border bg-card/40 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>;
}
