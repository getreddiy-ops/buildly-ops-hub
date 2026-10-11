import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { JobFolderView, type JobFolderData } from "@/components/workspace/JobFolderView";
import { Button } from "@/components/ui/button";
export default function JobFolder() {
  const { id } = useParams();
  const { activeOrg } = useAuth();
  const navigate = useNavigate();
  const orgId = activeOrg?.organization_id;
  const [state, setState] = useState<{ key: string; data?: JobFolderData; error?: string }>();
  const [retry, setRetry] = useState(0);
  const key = `${orgId}:${id}`;
  useEffect(() => {
    if (!id || !orgId) return;
    let cancelled = false;
    setState(undefined);
    async function load() {
      try {
        const jobResult = await supabase.from("org_jobs").select("*, customers(name)").eq("organization_id", orgId!).eq("id", id!).single();
        if (jobResult.error) throw jobResult.error;
        const job = jobResult.data;
        const [estimates, invoices, time, crew] = await Promise.all([
          job.estimate_id ? supabase.from("estimates").select("id,title,total,status").eq("organization_id", orgId!).eq("id", job.estimate_id) : Promise.resolve({ data: [], error: null }),
          supabase.from("org_invoices").select("id,number,status,total,amount_paid").eq("organization_id", orgId!).eq("job_id", id!).order("created_at", { ascending: false }),
          supabase.from("contractor_time_entries").select("id,clock_in,clock_out,status,note").eq("organization_id", orgId!).eq("job_id", id!).order("clock_in", { ascending: false }),
          supabase.from("org_crew_assignments").select("user_id,org_jobs!inner(organization_id)").eq("job_id", id!).eq("org_jobs.organization_id", orgId!),
        ]);
        for (const result of [estimates, invoices, time, crew]) if (result.error) throw result.error;
        const ids = (crew.data ?? []).map(row => row.user_id);
        const profiles = ids.length ? await supabase.from("profiles").select("id,full_name").in("id", ids) : { data: [], error: null };
        if (profiles.error) throw profiles.error;
        if (!cancelled) setState({ key, data: { job,
          estimates: (estimates.data ?? []).map(e => ({ id: e.id, title: e.title, detail: e.status, amount: e.total, to: `/app/estimates/${e.id}` })),
          invoices: (invoices.data ?? []).map(i => ({ id: i.id, title: `Invoice ${i.number || i.id.slice(0,8)}`, detail: `${i.status} · Paid $${Number(i.amount_paid).toFixed(2)}`, amount: i.total })),
          time: (time.data ?? []).map(t => ({ id: t.id, title: new Date(t.clock_in).toLocaleString(), detail: `${t.clock_out ? `${Math.max(0, (Date.parse(t.clock_out) - Date.parse(t.clock_in)) / 3600000).toFixed(1)} hours` : "Clocked in"} · ${t.status}${t.note ? ` · ${t.note}` : ""}` })),
          crew: ids.map(uid => profiles.data?.find(p => p.id === uid)?.full_name || "Crew member"),
        } });
      } catch (error) {
        if (!cancelled) setState({ key, error: error instanceof Error ? error.message : "Could not open this job folder. Check your connection or access." });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [orgId, id, key, retry]);
  if (!state || state.key !== key) return <p role="status" className="text-sm text-muted-foreground">Opening job folder…</p>;
  if (state.error || !state.data) return <div role="alert" className="space-y-4"><h1 className="text-xl font-semibold">Folder unavailable</h1><p>{state.error}</p><Button onClick={() => setRetry(n => n + 1)}>Try again</Button><Button variant="ghost" onClick={() => navigate("/app/jobs")}>All job folders</Button></div>;
  return <JobFolderView key={key} data={state.data} onBack={() => navigate("/app/jobs")} onNavigate={navigate} onManage={() => navigate(`/app/jobs?edit=${id}`)} />;
}
