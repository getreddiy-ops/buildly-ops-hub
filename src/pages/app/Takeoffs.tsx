import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { FileUp, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { TAKEOFF_STATUS, createPlanSet, db, type PlanSetRow } from "@/lib/takeoff/planSets";


/** Plan takeoff: upload a concrete plan set, read it, review it, turn it into an estimate. */
export default function Takeoffs() {
  const { activeOrg, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const jobId = params.get("job");
  const orgId = activeOrg?.organization_id;
  const [sets, setSets] = useState<PlanSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    let q = db.from("plan_sets").select("id,title,status,page_count,created_at,job_id,estimate_id").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100);
    if (jobId) q = q.eq("job_id", jobId);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setSets((data as PlanSetRow[]) ?? []);
    setLoading(false);
  }, [orgId, jobId]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !user || !file) return;
    try {
      const id = await createPlanSet({ organizationId: orgId, jobId, title: title.trim() || file.name.replace(/\.pdf$/i, ""), file, userId: user.id, onProgress: setProgress });
      toast.success("Plans uploaded. Pick the sheets to read.");
      navigate(`/app/takeoffs/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setProgress(null);
    }
  };

  return <div className="space-y-6">
    <PageHeader title="Plan takeoff" description="Upload concrete plans. FastTract reads the footings, walls, slabs, rebar and anchor bolts the drawings call for, you check every item, and it builds the quantities, bar schedule and estimate." />

    <Card className="p-6">
      <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end" onSubmit={upload}>
        <div className="space-y-2">
          <Label htmlFor="plan-title">Name</Label>
          <Input id="plan-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Henderson garage foundation" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan-file">Plan PDF</Label>
          <Input id="plan-file" type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
        </div>
        <Button type="submit" disabled={!file || progress !== null} className="min-h-11">
          {progress ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
          {progress ?? "Upload plans"}
        </Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">Up to 40 pages. The foundation plan, foundation sections/details and general notes are what matter.{jobId ? " This plan set will be filed on the job." : ""}</p>
    </Card>

    <section className="space-y-3" aria-label="Plan sets">
      {loading ? <p className="text-sm text-muted-foreground" role="status">Loading…</p>
        : sets.length === 0 ? <p className="text-sm text-muted-foreground">No plan sets yet.</p>
        : sets.map((s) => <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <Link to={`/app/takeoffs/${s.id}`} className="font-semibold underline-offset-4 hover:underline">{s.title}</Link>
            <p className="text-sm text-muted-foreground">{s.page_count} pages · uploaded {new Date(s.created_at).toLocaleDateString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {s.estimate_id && <Link className="text-sm underline" to={`/app/estimates/${s.estimate_id}`}>Estimate</Link>}
            <Badge variant={s.status === "confirmed" ? "default" : s.status === "failed" ? "destructive" : "secondary"}>{TAKEOFF_STATUS[s.status]}</Badge>
          </div>
        </Card>)}
    </section>
  </div>;
}
