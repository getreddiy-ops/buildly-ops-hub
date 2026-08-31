import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  BriefcaseBusiness,
  CalendarDays,
  Clock3,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
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
import {
  jobName,
  jobPropertyKeys,
  jobStatus,
  materialPropertyKeys,
  readRecordNumber,
  readRecordString,
  recordBelongsToJob,
  sortJobs,
  statusLabel,
  summarizeJobCosts,
  timePropertyKeys,
  type FastTractJobStatus,
} from "@/lib/highlevelJobWorkspace";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type RecordProperties = Record<string, unknown>;

type JobForm = {
  job_name: string;
  status: FastTractJobStatus;
  address: string;
  start_date: string;
  notes: string;
};

type TimeForm = {
  worker_name: string;
  work_date: string;
  hours: string;
  labor_rate: string;
  notes: string;
};

type MaterialForm = {
  material_name: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  supplier: string;
  notes: string;
};

const jobStatuses: FastTractJobStatus[] = ["lead", "scheduled", "active", "on_hold", "complete"];
const emptyJob: JobForm = { job_name: "", status: "scheduled", address: "", start_date: "", notes: "" };
const emptyMaterial: MaterialForm = { material_name: "", quantity: "", unit: "", unit_cost: "", supplier: "", notes: "" };

function localDateValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function emptyTime(): TimeForm {
  return { worker_name: "", work_date: localDateValue(), hours: "", labor_rate: "", notes: "" };
}

const jobSchema = z.object({
  job_name: z.string().trim().min(1, "Job name is required").max(160),
  status: z.enum(["lead", "scheduled", "active", "complete", "on_hold"]),
  address: z.string().trim().max(300),
  start_date: z.string().trim().max(40),
  notes: z.string().trim().max(3000),
});

const timeSchema = z.object({
  worker_name: z.string().trim().min(1, "Worker name is required").max(120),
  work_date: z.string().trim().min(1, "Work date is required"),
  hours: z.coerce.number().positive("Hours must be greater than zero").max(24, "Hours cannot exceed 24 in one entry"),
  labor_rate: z.coerce.number().min(0, "Labor rate cannot be negative"),
  notes: z.string().trim().max(2000),
});

const materialSchema = z.object({
  material_name: z.string().trim().min(1, "Material name is required").max(160),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: z.string().trim().min(1, "Unit is required").max(40),
  unit_cost: z.coerce.number().min(0, "Unit cost cannot be negative"),
  supplier: z.string().trim().max(120),
  notes: z.string().trim().max(2000),
});

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatDate(value: string) {
  if (!value) return "No date set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function jobFormFromRecord(record: HighLevelRecord): JobForm {
  return {
    job_name: jobName(record),
    status: jobStatus(record),
    address: readRecordString(record, jobPropertyKeys.address),
    start_date: readRecordString(record, jobPropertyKeys.startDate),
    notes: readRecordString(record, jobPropertyKeys.notes),
  };
}

function jobPayload(form: Partial<JobForm>, existing?: HighLevelRecord | null) {
  return {
    properties: {
      job_name: form.job_name ?? "",
      status: form.status ?? "scheduled",
      address: form.address || null,
      start_date: form.start_date || null,
      notes: form.notes || null,
      customer_id: existing ? readRecordString(existing, jobPropertyKeys.customerId) || null : null,
      estimate_id: existing ? readRecordString(existing, jobPropertyKeys.estimateId) || null : null,
    },
  };
}

function statusClass(status: FastTractJobStatus) {
  if (status === "active") return "border-primary/35 bg-primary/10 text-primary";
  if (status === "on_hold") return "border-amber-400/30 bg-amber-400/10 text-amber-400";
  if (status === "complete") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-400";
  return "border-border bg-background/60 text-muted-foreground";
}

export default function HighLevelJobs() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<HighLevelRecord<RecordProperties>[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FastTractJobStatus | "open" | "all">("open");
  const [setupRequired, setSetupRequired] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<HighLevelRecord<RecordProperties> | null>(null);
  const [savingJob, setSavingJob] = useState(false);
  const [jobForm, setJobForm] = useState<JobForm>(emptyJob);
  const [selected, setSelected] = useState<HighLevelRecord<RecordProperties> | null>(null);
  const [timeEntries, setTimeEntries] = useState<HighLevelRecord<RecordProperties>[]>([]);
  const [materials, setMaterials] = useState<HighLevelRecord<RecordProperties>[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [relatedWarnings, setRelatedWarnings] = useState<string[]>([]);
  const [timeOpen, setTimeOpen] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [timeForm, setTimeForm] = useState<TimeForm>(emptyTime());
  const [materialForm, setMaterialForm] = useState<MaterialForm>(emptyMaterial);
  const [savingTime, setSavingTime] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await highLevel.listRecords<RecordProperties>("jobs", { limit: 100 });
      setJobs(sortJobs(result.records ?? []) as HighLevelRecord<RecordProperties>[]);
      setSetupRequired(false);
    } catch (error) {
      setJobs([]);
      setSetupRequired(true);
      toast.error(error instanceof Error ? error.message : "Unable to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRelated = useCallback(async (jobId: string) => {
    setRelatedLoading(true);
    const [timeResult, materialResult] = await Promise.allSettled([
      highLevel.listRecords<RecordProperties>("time_entries", { query: jobId, limit: 100 }),
      highLevel.listRecords<RecordProperties>("materials", { query: jobId, limit: 100 }),
    ]);

    const warnings: string[] = [];
    if (timeResult.status === "fulfilled") {
      setTimeEntries((timeResult.value.records ?? []).filter((record) => recordBelongsToJob(record, jobId, timePropertyKeys.jobId)));
    } else {
      setTimeEntries([]);
      warnings.push("Labor entries are temporarily unavailable.");
    }

    if (materialResult.status === "fulfilled") {
      setMaterials((materialResult.value.records ?? []).filter((record) => recordBelongsToJob(record, jobId, materialPropertyKeys.jobId)));
    } else {
      setMaterials([]);
      warnings.push("Material entries are temporarily unavailable.");
    }

    setRelatedWarnings(warnings);
    setRelatedLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected?.id) {
      setTimeEntries([]);
      setMaterials([]);
      setRelatedWarnings([]);
      return;
    }
    void loadRelated(selected.id);
  }, [loadRelated, selected?.id]);

  useEffect(() => {
    const jobId = searchParams.get("open");
    if (loading || selected || !jobId) return;
    const jobToOpen = jobs.find((job) => job.id === jobId);
    if (!jobToOpen) return;

    setSelected(jobToOpen);
    const next = new URLSearchParams(searchParams);
    next.delete("open");
    setSearchParams(next, { replace: true });
  }, [jobs, loading, searchParams, selected, setSearchParams]);

  const counts = useMemo(() => ({
    active: jobs.filter((job) => jobStatus(job) === "active").length,
    scheduled: jobs.filter((job) => jobStatus(job) === "scheduled").length,
    onHold: jobs.filter((job) => jobStatus(job) === "on_hold").length,
    complete: jobs.filter((job) => jobStatus(job) === "complete").length,
  }), [jobs]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return jobs.filter((job) => {
      const status = jobStatus(job);
      const statusMatches = filter === "all"
        || (filter === "open" ? status !== "complete" : status === filter);
      const textMatches = !needle || [
        jobName(job),
        readRecordString(job, jobPropertyKeys.address),
        readRecordString(job, jobPropertyKeys.notes),
      ].some((value) => value.toLowerCase().includes(needle));
      return statusMatches && textMatches;
    });
  }, [filter, jobs, query]);

  const costSummary = useMemo(() => summarizeJobCosts(timeEntries, materials), [materials, timeEntries]);

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

  const openNewJob = () => {
    setEditingJob(null);
    setJobForm(emptyJob);
    setJobFormOpen(true);
  };

  const openEditJob = (job: HighLevelRecord<RecordProperties>) => {
    setEditingJob(job);
    setJobForm(jobFormFromRecord(job));
    setJobFormOpen(true);
  };

  const saveJob = async () => {
    const parsed = jobSchema.safeParse(jobForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSavingJob(true);
    try {
      if (editingJob) {
        const result = await highLevel.updateRecord<RecordProperties>("jobs", editingJob.id, jobPayload(parsed.data, editingJob));
        setSelected((current) => current?.id === editingJob.id ? result.record : current);
        toast.success("Job updated in HighLevel");
      } else {
        await highLevel.createRecord<RecordProperties>("jobs", jobPayload(parsed.data));
        toast.success("Job created in HighLevel");
      }
      setJobFormOpen(false);
      setJobForm(emptyJob);
      setEditingJob(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save job");
    } finally {
      setSavingJob(false);
    }
  };

  const updateStatus = async (status: FastTractJobStatus) => {
    if (!selected || status === jobStatus(selected)) return;
    setWorkingId(`job:${selected.id}`);
    try {
      const form = { ...jobFormFromRecord(selected), status };
      const result = await highLevel.updateRecord<RecordProperties>("jobs", selected.id, jobPayload(form, selected));
      setSelected(result.record);
      setJobs((current) => sortJobs(current.map((job) => job.id === selected.id ? result.record : job)) as HighLevelRecord<RecordProperties>[]);
      toast.success(`${jobName(result.record)} is now ${statusLabel(status)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update job status");
    } finally {
      setWorkingId(null);
    }
  };

  const addTime = async () => {
    if (!selected) return;
    const parsed = timeSchema.safeParse(timeForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSavingTime(true);
    try {
      const value = parsed.data;
      await highLevel.createRecord<RecordProperties>("time_entries", {
        properties: {
          description: `${value.worker_name} · ${value.work_date}`,
          job_id: selected.id,
          worker_name: value.worker_name,
          work_date: value.work_date,
          hours: value.hours,
          labor_rate: value.labor_rate,
          labor_cost: value.hours * value.labor_rate,
          notes: value.notes || null,
        },
      });
      toast.success("Labor entry added");
      setTimeOpen(false);
      setTimeForm(emptyTime());
      await loadRelated(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add labor entry");
    } finally {
      setSavingTime(false);
    }
  };

  const addMaterial = async () => {
    if (!selected) return;
    const parsed = materialSchema.safeParse(materialForm);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSavingMaterial(true);
    try {
      const value = parsed.data;
      await highLevel.createRecord<RecordProperties>("materials", {
        properties: {
          material_name: value.material_name,
          job_id: selected.id,
          quantity: value.quantity,
          unit: value.unit,
          unit_cost: value.unit_cost,
          supplier: value.supplier || null,
          notes: value.notes || null,
        },
      });
      toast.success("Material added");
      setMaterialOpen(false);
      setMaterialForm(emptyMaterial);
      await loadRelated(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add material");
    } finally {
      setSavingMaterial(false);
    }
  };

  const removeRelated = async (object: "time_entries" | "materials", record: HighLevelRecord) => {
    if (!selected) return;
    const noun = object === "time_entries" ? "labor entry" : "material";
    if (!window.confirm(`Remove this ${noun} from the job?`)) return;
    setWorkingId(`${object}:${record.id}`);
    try {
      await highLevel.deleteRecord(object, record.id);
      toast.success(`${statusLabel(noun)} removed`);
      await loadRelated(selected.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Unable to remove ${noun}`);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Jobs"
        description="Plan the work, track labor and materials, and close every job without leaving FastTract."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Dialog open={jobFormOpen} onOpenChange={setJobFormOpen}>
              <DialogTrigger asChild><Button onClick={openNewJob} disabled={setupRequired}><Plus className="h-4 w-4" /> New job</Button></DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>{editingJob ? "Edit job" : "New job"}</DialogTitle>
                    <AiFormHelper<JobForm>
                      formName="job"
                      fields={[
                        { name: "job_name", description: "Short customer-facing job name" },
                        { name: "status", enum: jobStatuses },
                        { name: "address" },
                        { name: "start_date", type: "date" },
                        { name: "notes", description: "Scope and important job notes" },
                      ]}
                      onFill={(values) => setJobForm((current) => ({ ...current, ...values }))}
                      placeholder="e.g. Fletcher stamped patio at 123 Oak St, starts September 14, remove existing slab"
                    />
                  </div>
                </DialogHeader>
                <div className="grid gap-4">
                  <Field label="Job name"><Input value={jobForm.job_name} onChange={(event) => setJobForm({ ...jobForm, job_name: event.target.value })} /></Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Status">
                      <Select value={jobForm.status} onValueChange={(value) => setJobForm({ ...jobForm, status: value as FastTractJobStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{jobStatuses.map((value) => <SelectItem key={value} value={value}>{statusLabel(value)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label="Start date"><Input type="date" value={jobForm.start_date} onChange={(event) => setJobForm({ ...jobForm, start_date: event.target.value })} /></Field>
                  </div>
                  <Field label="Address"><Input value={jobForm.address} onChange={(event) => setJobForm({ ...jobForm, address: event.target.value })} /></Field>
                  <Field label="Scope / notes"><Textarea rows={5} value={jobForm.notes} onChange={(event) => setJobForm({ ...jobForm, notes: event.target.value })} /></Field>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setJobFormOpen(false)}>Cancel</Button>
                  <Button onClick={() => void saveJob()} disabled={savingJob}>{savingJob ? "Saving…" : editingJob ? "Save changes" : "Create job"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Active" value={counts.active} active={filter === "active"} onClick={() => setFilter("active")} />
        <Summary label="Scheduled" value={counts.scheduled} active={filter === "scheduled"} onClick={() => setFilter("scheduled")} />
        <Summary label="On hold" value={counts.onHold} active={filter === "on_hold"} onClick={() => setFilter("on_hold")} />
        <Summary label="Complete" value={counts.complete} active={filter === "complete"} onClick={() => setFilter("complete")} />
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search jobs…" />
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="h-9 w-36 border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open jobs</SelectItem>
            <SelectItem value="all">All jobs</SelectItem>
            {jobStatuses.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {setupRequired ? (
        <div className="rounded-2xl border border-primary/25 bg-card p-6 shadow-card sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><Wrench className="h-5 w-5" /></div>
          <h2 className="mt-5 text-xl font-semibold">Initialize the FastTract job workspace</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            FastTract will create Jobs, Time Entries, and Materials for this signed HighLevel sub-account.
          </p>
          <Button className="mt-5" onClick={() => void initialize()} disabled={settingUp}>
            <Sparkles className="h-4 w-4" /> {settingUp ? "Setting up…" : "Set up Jobs"}
          </Button>
        </div>
      ) : loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl border border-border bg-card/40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <BriefcaseBusiness className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">No jobs in this view</h2>
          <p className="mt-2 text-sm text-muted-foreground">Create the first job or change the status filter.</p>
          <Button className="mt-5" onClick={openNewJob}><Plus className="h-4 w-4" /> New job</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((job) => {
            const status = jobStatus(job);
            const address = readRecordString(job, jobPropertyKeys.address);
            const startDate = readRecordString(job, jobPropertyKeys.startDate);
            const notes = readRecordString(job, jobPropertyKeys.notes);
            return (
              <button type="button" key={job.id} onClick={() => setSelected(job)} className="min-w-0 rounded-xl border border-border bg-card/50 p-5 text-left shadow-card transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BriefcaseBusiness className="h-5 w-5" /></div>
                  <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", statusClass(status))}>{statusLabel(status)}</span>
                </div>
                <h2 className="mt-4 truncate text-lg font-semibold">{jobName(job)}</h2>
                {address && <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{address}</span></p>}
                {startDate && <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="h-4 w-4 shrink-0" />{formatDate(startDate)}</p>}
                {notes && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">{notes}</p>}
                <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs font-medium text-primary">Open job workspace <ArrowRightIcon /></p>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(next) => { if (!next) setSelected(null); }}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Job workspace</p>
                <DialogTitle className="mt-1 truncate text-2xl">{selected ? jobName(selected) : "Job"}</DialogTitle>
              </div>
              {selected && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEditJob(selected)}><Pencil className="h-4 w-4" /> Edit</Button>
                  <Select value={jobStatus(selected)} onValueChange={(value) => void updateStatus(value as FastTractJobStatus)} disabled={workingId === `job:${selected.id}`}>
                    <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{jobStatuses.map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DialogHeader>

          {selected && (
            <div className="space-y-7">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailCard icon={MapPin} label="Job address" value={readRecordString(selected, jobPropertyKeys.address) || "No address added"} />
                <DetailCard icon={CalendarDays} label="Start date" value={formatDate(readRecordString(selected, jobPropertyKeys.startDate))} />
              </div>

              <div className="rounded-xl border border-border bg-card/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Scope and notes</p>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/highlevel/ai?prompt=${encodeURIComponent(`Help me plan the next step for ${jobName(selected)}`)}`}><Sparkles className="h-4 w-4 text-primary" /> Ask Ava</Link>
                  </Button>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{readRecordString(selected, jobPropertyKeys.notes) || "No scope notes have been added yet."}</p>
                {readRecordString(selected, jobPropertyKeys.estimateId) && (
                  <Button className="mt-4" size="sm" variant="outline" asChild>
                    <Link to={`/highlevel/estimates?edit=${encodeURIComponent(readRecordString(selected, jobPropertyKeys.estimateId))}`}><FileText className="h-4 w-4" /> Open linked estimate</Link>
                  </Button>
                )}
              </div>

              <section>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">Job cost pulse</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Recorded labor and materials—not the customer-facing selling price.</p>
                  </div>
                  {relatedLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <CostCard label="Labor hours" value={costSummary.laborHours.toFixed(2)} icon={Clock3} />
                  <CostCard label="Labor cost" value={money.format(costSummary.laborCost)} icon={DollarSign} />
                  <CostCard label="Materials" value={money.format(costSummary.materialCost)} icon={Package} />
                  <CostCard label="Recorded cost" value={money.format(costSummary.totalCost)} icon={BriefcaseBusiness} />
                </div>
              </section>

              {relatedWarnings.length > 0 && (
                <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm text-muted-foreground">{relatedWarnings.join(" ")}</div>
              )}

              <section className="overflow-hidden rounded-xl border border-border bg-card/40">
                <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="font-semibold">Labor</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Crew time and labor cost recorded against this job.</p>
                  </div>
                  <Button size="sm" onClick={() => { setTimeForm(emptyTime()); setTimeOpen(true); }}><Plus className="h-4 w-4" /> Add time</Button>
                </div>
                {relatedLoading ? (
                  <div className="h-24 animate-pulse bg-muted/20" />
                ) : timeEntries.length === 0 ? (
                  <EmptyRelated icon={Clock3} text="No labor entries yet." />
                ) : (
                  <div className="divide-y divide-border">
                    {timeEntries.map((entry) => {
                      const hours = readRecordNumber(entry, timePropertyKeys.hours);
                      const rate = readRecordNumber(entry, timePropertyKeys.laborRate);
                      const cost = readRecordNumber(entry, timePropertyKeys.laborCost) || hours * rate;
                      return (
                        <div key={entry.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate font-medium">{readRecordString(entry, timePropertyKeys.workerName) || readRecordString(entry, timePropertyKeys.description) || "Crew member"}</h4>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDate(readRecordString(entry, timePropertyKeys.workDate))} · {hours.toFixed(2)} hours at {money.format(rate)}/hr</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className="font-semibold">{money.format(cost)}</span>
                            <Button size="icon" variant="ghost" aria-label="Remove labor entry" onClick={() => void removeRelated("time_entries", entry)} disabled={workingId === `time_entries:${entry.id}`}>
                              {workingId === `time_entries:${entry.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-xl border border-border bg-card/40">
                <div className="flex items-center justify-between gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="font-semibold">Materials</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Actual quantities and costs assigned to this job.</p>
                  </div>
                  <Button size="sm" onClick={() => { setMaterialForm(emptyMaterial); setMaterialOpen(true); }}><Plus className="h-4 w-4" /> Add material</Button>
                </div>
                {relatedLoading ? (
                  <div className="h-24 animate-pulse bg-muted/20" />
                ) : materials.length === 0 ? (
                  <EmptyRelated icon={Package} text="No materials recorded yet." />
                ) : (
                  <div className="divide-y divide-border">
                    {materials.map((material) => {
                      const quantity = readRecordNumber(material, materialPropertyKeys.quantity);
                      const unitCost = readRecordNumber(material, materialPropertyKeys.unitCost);
                      const unit = readRecordString(material, materialPropertyKeys.unit) || "unit";
                      const supplier = readRecordString(material, materialPropertyKeys.supplier);
                      return (
                        <div key={material.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate font-medium">{readRecordString(material, materialPropertyKeys.name) || "Material"}</h4>
                            <p className="mt-1 text-xs text-muted-foreground">{quantity} {unit} at {money.format(unitCost)} each{supplier ? ` · ${supplier}` : ""}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3 sm:justify-end">
                            <span className="font-semibold">{money.format(quantity * unitCost)}</span>
                            <Button size="icon" variant="ghost" aria-label="Remove material" onClick={() => void removeRelated("materials", material)} disabled={workingId === `materials:${material.id}`}>
                              {workingId === `materials:${material.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={timeOpen} onOpenChange={setTimeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add labor to {selected ? jobName(selected) : "job"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Worker / crew member"><Input value={timeForm.worker_name} onChange={(event) => setTimeForm({ ...timeForm, worker_name: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Work date"><Input type="date" value={timeForm.work_date} onChange={(event) => setTimeForm({ ...timeForm, work_date: event.target.value })} /></Field>
              <Field label="Hours"><Input inputMode="decimal" value={timeForm.hours} onChange={(event) => setTimeForm({ ...timeForm, hours: event.target.value })} /></Field>
              <Field label="Hourly cost"><Input inputMode="decimal" value={timeForm.labor_rate} onChange={(event) => setTimeForm({ ...timeForm, labor_rate: event.target.value })} /></Field>
            </div>
            <Field label="Notes"><Textarea rows={3} value={timeForm.notes} onChange={(event) => setTimeForm({ ...timeForm, notes: event.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTimeOpen(false)}>Cancel</Button>
            <Button onClick={() => void addTime()} disabled={savingTime}>{savingTime ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}{savingTime ? "Adding…" : "Add labor"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={materialOpen} onOpenChange={setMaterialOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add material to {selected ? jobName(selected) : "job"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <Field label="Material"><Input value={materialForm.material_name} onChange={(event) => setMaterialForm({ ...materialForm, material_name: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Quantity"><Input inputMode="decimal" value={materialForm.quantity} onChange={(event) => setMaterialForm({ ...materialForm, quantity: event.target.value })} /></Field>
              <Field label="Unit"><Input value={materialForm.unit} onChange={(event) => setMaterialForm({ ...materialForm, unit: event.target.value })} placeholder="yards, sheets…" /></Field>
              <Field label="Unit cost"><Input inputMode="decimal" value={materialForm.unit_cost} onChange={(event) => setMaterialForm({ ...materialForm, unit_cost: event.target.value })} /></Field>
            </div>
            <Field label="Supplier"><Input value={materialForm.supplier} onChange={(event) => setMaterialForm({ ...materialForm, supplier: event.target.value })} /></Field>
            <Field label="Notes"><Textarea rows={3} value={materialForm.notes} onChange={(event) => setMaterialForm({ ...materialForm, notes: event.target.value })} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMaterialOpen(false)}>Cancel</Button>
            <Button onClick={() => void addMaterial()} disabled={savingMaterial}>{savingMaterial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}{savingMaterial ? "Adding…" : "Add material"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArrowRightIcon() {
  return <span aria-hidden="true">→</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Summary({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-secondary/50",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </button>
  );
}

function DetailCard({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/40 p-4">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</p>
      <p className="mt-3 text-sm leading-6">{value}</p>
    </div>
  );
}

function CostCard({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{label}</p><Icon className="h-4 w-4 shrink-0 text-primary" /></div>
      <p className="mt-2 truncate text-lg font-semibold">{value}</p>
    </div>
  );
}

function EmptyRelated({ icon: Icon, text }: { icon: typeof Clock3; text: string }) {
  return (
    <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/40"><Icon className="h-4 w-4" /></div>
      <span>{text}</span>
    </div>
  );
}
