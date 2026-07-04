import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Briefcase, MoreHorizontal, Plus, Users as UsersIcon, X } from "lucide-react";
import { toast } from "sonner";
import { AiFormHelper } from "@/components/AiFormHelper";
import { QuickCreateCustomerButton } from "@/components/QuickCreateCustomerButton";
import type { Database } from "@/integrations/supabase/types";

type Job = Database["public"]["Tables"]["jobs"]["Row"];
type JobStatus = Database["public"]["Enums"]["job_status"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];

const STATUSES: JobStatus[] = ["scheduled", "in_progress", "on_hold", "completed", "cancelled"];

const schema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  customer_id: z.string().uuid("Pick a customer"),
  status: z.enum(["scheduled", "in_progress", "on_hold", "completed", "cancelled"]),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  budget: z.number().min(0).optional(),
  scheduled_start: z.string().optional().or(z.literal("")),
  scheduled_end: z.string().optional().or(z.literal("")),
});

const empty = {
  title: "", customer_id: "", status: "scheduled" as JobStatus,
  address: "", description: "", budget: "" as string | number,
  scheduled_start: "", scheduled_end: "",
};

const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function Jobs() {
  const { activeOrg, user } = useAuth();
  const [rows, setRows] = useState<(Job & { customers?: { name: string } | null })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<{ user_id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const [crewOpen, setCrewOpen] = useState(false);
  const [crewJob, setCrewJob] = useState<Job | null>(null);
  const [crew, setCrew] = useState<{ id: string; user_id: string }[]>([]);
  const [addUserId, setAddUserId] = useState("");

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: jobs, error }, { data: custs }, { data: mems }] = await Promise.all([
      supabase.from("jobs").select("*, customers(name)").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("organization_id", activeOrg.organization_id).order("name"),
      supabase.from("organization_members").select("user_id").eq("organization_id", activeOrg.organization_id),
    ]);
    if (error) toast.error(error.message);
    setRows((jobs ?? []) as any);
    setCustomers(custs ?? []);
    const userIds = (mems ?? []).map((m: any) => m.user_id);
    let profs: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      profs = data ?? [];
    }
    setMembers(userIds.map((uid: string) => {
      const p = profs.find((x) => x.id === uid);
      return { user_id: uid, name: p?.full_name || p?.email || uid.slice(0, 8) };
    }));
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (j: Job) => {
    setEditing(j);
    setForm({
      title: j.title ?? "",
      customer_id: j.customer_id ?? "",
      status: j.status,
      address: j.address ?? "",
      description: j.description ?? "",
      budget: j.budget ?? "",
      scheduled_start: j.scheduled_start ? j.scheduled_start.slice(0, 16) : "",
      scheduled_end: j.scheduled_end ? j.scheduled_end.slice(0, 16) : "",
    });
    setOpen(true);
  };

  const save = async () => {
    const parsed = schema.safeParse({
      ...form,
      budget: form.budget === "" ? undefined : Number(form.budget),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!activeOrg || !user) return;
    setSaving(true);
    const d = parsed.data;
    const payload = {
      title: d.title,
      customer_id: d.customer_id,
      status: d.status,
      address: d.address || null,
      description: d.description || null,
      budget: d.budget ?? null,
      scheduled_start: d.scheduled_start ? new Date(d.scheduled_start).toISOString() : null,
      scheduled_end: d.scheduled_end ? new Date(d.scheduled_end).toISOString() : null,
    };
    const res = editing
      ? await supabase.from("jobs").update(payload).eq("id", editing.id)
      : await supabase.from("jobs").insert({ ...payload, organization_id: activeOrg.organization_id, created_by: user.id });
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Job updated" : "Job created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this job?")) return;
    const { error } = await supabase.from("jobs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Job deleted");
    load();
  };

  const openCrew = async (j: Job) => {
    setCrewJob(j); setAddUserId(""); setCrewOpen(true);
    const { data } = await supabase.from("crew_assignments").select("id, user_id").eq("job_id", j.id);
    setCrew(data ?? []);
  };
  const assignedIds = useMemo(() => new Set(crew.map((c) => c.user_id)), [crew]);
  const addCrew = async () => {
    if (!crewJob || !addUserId) return;
    const { error } = await supabase.from("crew_assignments").insert({ job_id: crewJob.id, user_id: addUserId });
    if (error) return toast.error(error.message);
    setAddUserId("");
    const { data } = await supabase.from("crew_assignments").select("id, user_id").eq("job_id", crewJob.id);
    setCrew(data ?? []);
  };
  const removeCrew = async (id: string) => {
    const { error } = await supabase.from("crew_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setCrew((s) => s.filter((c) => c.id !== id));
  };

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Schedule, assign crew, and track from start to completion."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New job</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>{editing ? "Edit job" : "New job"}</DialogTitle>
                  <AiFormHelper
                    formName="job"
                    fields={[
                      { name: "title", description: "Short job title" },
                      { name: "customer_name", description: "Match to one of the existing customers below by name" },
                      { name: "address" },
                      { name: "description" },
                      { name: "budget", type: "number", description: "Budget in dollars" },
                      { name: "scheduled_start", type: "date" },
                      { name: "scheduled_end", type: "date" },
                      { name: "status", enum: STATUSES as unknown as string[] },
                    ]}
                    context={{ customers: customers.map((c) => ({ id: c.id, name: c.name })) }}
                    onFill={(v: any) => {
                      const matched =
                        v.customer_name && customers.find(
                          (c) => c.name.toLowerCase() === String(v.customer_name).toLowerCase(),
                        );
                      setForm((f) => ({
                        ...f,
                        ...v,
                        customer_id: matched ? matched.id : f.customer_id,
                        budget: v.budget !== undefined ? v.budget : f.budget,
                      } as typeof f));
                    }}
                  />
                </div>
              </DialogHeader>
              <div className="grid gap-3 max-h-[70vh] overflow-y-auto pr-1">
                <Field label="Title"><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Customer">
                    <div className="flex gap-2">
                      <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                        <SelectContent>
                          {customers.length === 0
                            ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No customers yet</div>
                            : customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <QuickCreateCustomerButton
                        label="New"
                        onCreated={async (c) => { await load(); setForm((f) => ({ ...f, customer_id: c.id })); }}
                      />
                    </div>
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as JobStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Scheduled start">
                    <Input type="datetime-local" value={form.scheduled_start}
                      onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })} />
                  </Field>
                  <Field label="Scheduled end">
                    <Input type="datetime-local" value={form.scheduled_end}
                      onChange={(e) => setForm({ ...form, scheduled_end: e.target.value })} />
                  </Field>
                </div>
                <Field label="Budget (USD)">
                  <Input type="number" min={0} step="0.01" value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })} />
                </Field>
                <Field label="Description"><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Briefcase} title="No jobs scheduled" description="Create a job and assign crew to it."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New job</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{j.customers?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={j.status} /></TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmtDate(j.scheduled_start)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Job actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(j)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openCrew(j)}><UsersIcon className="h-4 w-4" /> Assign crew</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(j.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={crewOpen} onOpenChange={setCrewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crew on {crewJob?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger><SelectValue placeholder="Add crew member" /></SelectTrigger>
                <SelectContent>
                  {members.filter((m) => !assignedIds.has(m.user_id)).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addCrew} disabled={!addUserId}>Add</Button>
            </div>
            <div className="space-y-1">
              {crew.length === 0 ? (
                <p className="text-sm text-muted-foreground">No crew assigned yet.</p>
              ) : crew.map((c) => {
                const m = members.find((x) => x.user_id === c.user_id);
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm">{m?.name ?? c.user_id.slice(0, 8)}</span>
                    <Button size="icon" variant="ghost" onClick={() => removeCrew(c.id)}><X className="h-4 w-4" /></Button>
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
