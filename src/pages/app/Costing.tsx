import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { DollarSign, Plus, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface JobLite { id: string; title: string; budget: number | null; status: string; }
interface CostRow {
  id: string; job_id: string; category: string; description: string | null;
  amount: number; incurred_on: string;
}
interface TimeRow {
  id: string; job_id: string; user_id: string;
  approved_hours: number | null; status: string;
}

const CATEGORIES = ["materials", "subcontractor", "equipment", "permits", "other"] as const;

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

const costSchema = z.object({
  category: z.enum(CATEGORIES),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  amount: z.number().min(0.01, "Amount required"),
  incurred_on: z.string().min(1, "Date required"),
});

export default function Costing() {
  const { activeOrg, user } = useAuth();
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [jobs, setJobs] = useState<JobLite[]>([]);
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [times, setTimes] = useState<TimeRow[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("materials");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: js }, { data: cs }, { data: ts }, { data: mems }] = await Promise.all([
      supabase.from("jobs").select("id, title, budget, status").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
      supabase.from("job_costs").select("*").order("incurred_on", { ascending: false }),
      supabase.from("time_entries").select("id, job_id, user_id, approved_hours, status").eq("organization_id", activeOrg.organization_id).eq("status", "approved"),
      supabase.rpc("get_org_hourly_rates", { _org_id: activeOrg.organization_id }),
    ]);
    setJobs((js ?? []) as JobLite[]);
    setCosts((cs ?? []) as CostRow[]);
    setTimes((ts ?? []) as TimeRow[]);
    const r: Record<string, number> = {};
    (mems ?? []).forEach((m: any) => { r[m.user_id] = Number(m.hourly_rate ?? 0); });
    setRates(r);
    if (!selectedJob && js && js.length > 0) setSelectedJob(js[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const rollup = useMemo(() => {
    const map = new Map<string, { labor: number; materials: number; laborHrs: number }>();
    jobs.forEach((j) => map.set(j.id, { labor: 0, materials: 0, laborHrs: 0 }));
    times.forEach((t) => {
      const r = map.get(t.job_id); if (!r) return;
      const h = Number(t.approved_hours ?? 0);
      r.laborHrs += h;
      r.labor += h * (rates[t.user_id] ?? 0);
    });
    costs.forEach((c) => {
      const r = map.get(c.job_id); if (!r) return;
      r.materials += Number(c.amount);
    });
    return map;
  }, [jobs, times, costs, rates]);

  const selected = jobs.find((j) => j.id === selectedJob) ?? null;
  const selectedCosts = costs.filter((c) => c.job_id === selectedJob);
  const selectedTimes = times.filter((t) => t.job_id === selectedJob);
  const selR = selectedJob ? rollup.get(selectedJob) : null;
  const totalCost = selR ? selR.labor + selR.materials : 0;
  const budget = Number(selected?.budget ?? 0);
  const margin = budget - totalCost;
  const marginPct = budget > 0 ? (margin / budget) * 100 : 0;

  const saveCost = async () => {
    const parsed = costSchema.safeParse({
      category, description, amount: Number(amount), incurred_on: incurredOn,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!selectedJob || !user) return;
    setSaving(true);
    const { error } = await supabase.from("job_costs").insert({
      job_id: selectedJob,
      category: parsed.data.category,
      description: parsed.data.description || null,
      amount: parsed.data.amount,
      incurred_on: parsed.data.incurred_on,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Cost added");
    setOpen(false);
    setDescription(""); setAmount("");
    load();
  };

  const removeCost = async (id: string) => {
    if (!confirm("Delete this cost?")) return;
    const { error } = await supabase.from("job_costs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <PageHeader title="Job Costing" description="Labor, materials, and margin per job." />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : jobs.length === 0 ? (
        <EmptyState icon={DollarSign} title="No jobs yet" description="Create a job first, then costs will roll up here." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-1">
            <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Jobs</p>
            {jobs.map((j) => {
              const r = rollup.get(j.id)!;
              const cost = r.labor + r.materials;
              const b = Number(j.budget ?? 0);
              const m = b - cost;
              return (
                <button
                  key={j.id}
                  onClick={() => setSelectedJob(j.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left transition ${
                    selectedJob === j.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{j.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {fmt(cost)} {b > 0 && <span className={m >= 0 ? "text-emerald-400" : "text-rose-400"}> · {m >= 0 ? "+" : ""}{fmt(m)}</span>}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>

          {selected && selR && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label="Labor" value={fmt(selR.labor)} sub={`${selR.laborHrs.toFixed(2)}h`} />
                <Stat label="Materials" value={fmt(selR.materials)} />
                <Stat label="Total cost" value={fmt(totalCost)} />
                <Stat
                  label="Margin"
                  value={fmt(margin)}
                  sub={budget > 0 ? `${marginPct.toFixed(1)}% of ${fmt(budget)}` : "No budget set"}
                  tone={budget > 0 ? (margin >= 0 ? "positive" : "negative") : undefined}
                />
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Material & other costs</h3>
                  {isAdmin && (
                    <Dialog open={open} onOpenChange={setOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm"><Plus className="h-4 w-4" /> Add cost</Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle>Add cost to {selected.title}</DialogTitle></DialogHeader>
                        <div className="grid gap-3">
                          <Field label="Category">
                            <Select value={category} onValueChange={(v) => setCategory(v as any)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </Field>
                          <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Amount (USD)">
                              <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                            </Field>
                            <Field label="Date">
                              <Input type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} />
                            </Field>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                          <Button onClick={saveCost} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                {selectedCosts.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
                    No costs logged yet.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedCosts.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-muted-foreground text-sm">{c.incurred_on}</TableCell>
                            <TableCell className="capitalize">{c.category}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{c.description ?? "—"}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmt(Number(c.amount))}</TableCell>
                            <TableCell>
                              {isAdmin && (
                                <Button size="icon" variant="ghost" onClick={() => removeCost(c.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-medium">Approved labor</h3>
                {selectedTimes.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
                    No approved time entries on this job yet.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {selectedTimes.length} approved entries totaling {selR.laborHrs.toFixed(2)}h ({fmt(selR.labor)}).
                  </p>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "positive" | "negative" }) {
  const toneCls = tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-rose-400" : "";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
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
