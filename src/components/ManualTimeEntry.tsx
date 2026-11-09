import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { localDateTimeValue, validatePastTime } from "@/lib/manual-time";
import { toast } from "sonner";
type Worker = { id: string; name: string };
type Job = { id: string; title: string; status: string };
export function ManualTimeEntry({ organizationId, actorId, onSaved }: { organizationId: string; actorId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [workers, setWorkers] = useState<Worker[]>([]), [jobs, setJobs] = useState<Job[]>([]);
  const [workerId, setWorkerId] = useState(actorId), [jobId, setJobId] = useState("");
  const [start, setStart] = useState(""), [end, setEnd] = useState(""), [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const hours = (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true); setError("");
    void (async () => {
      try {
        const [members, jobResult] = await Promise.all([
          supabase.from("organization_members").select("user_id").eq("organization_id", organizationId),
          supabase.from("org_jobs").select("id,title,status").eq("organization_id", organizationId).order("title"),
        ]);
        if (members.error) throw members.error;
        if (jobResult.error) throw jobResult.error;
        const ids = [...new Set((members.data ?? []).map(m => m.user_id).filter((id): id is string => Boolean(id)))];
        const profiles = ids.length ? await supabase.from("profiles").select("id,full_name,email").in("id", ids) : { data: [], error: null };
        if (profiles.error) throw profiles.error;
        if (!active) return;
        setWorkers(ids.map(id => { const p = profiles.data?.find(p => p.id === id); return { id, name: `${p?.full_name || p?.email || "Team member"}${id === actorId ? " (me)" : ""}` }; }));
        setJobs((jobResult.data ?? []) as Job[]);
      } catch { if (active) setError("Could not load your team and jobs. Close this form and try again."); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, organizationId, actorId]);
  function changeOpen(next: boolean) {
    if (busy) return;
    if (next) { setWorkerId(actorId); setJobId(""); setStart(""); setEnd(""); setNote(""); setWorkers([]); setJobs([]); setError(""); setRequestId(crypto.randomUUID()); }
    setOpen(next);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || loading) return;
    setError("");
    try {
      if (!workers.some(w => w.id === workerId) || !jobs.some(j => j.id === jobId)) throw new Error("Choose a current team member and a job from this company.");
      const times = validatePastTime(start, end);
      setBusy(true);
      const { data, error: failure } = await supabase.rpc("record_manual_job_time", { p_entry_id: requestId, p_organization_id: organizationId, p_user_id: workerId, p_job_id: jobId, p_clock_in: times.clockIn, p_clock_out: times.clockOut, p_note: note.trim() || null });
      if (failure) throw failure;
      if (!data) throw new Error("The entry was not saved. Please try again.");
      setOpen(false); toast.success("Past time saved for review"); onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : typeof failure === "object" && failure && "message" in failure ? String(failure.message) : "Could not save the time entry. Please try again."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button>Add past time</Button></DialogTrigger>
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add past job time</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Record work for yourself or a team member. Times use this device’s timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Entries go to Approvals for review.</p>
      <form onSubmit={save} className="space-y-4">
        <div><Label htmlFor="manual-worker">Worker</Label><select id="manual-worker" value={workerId} onChange={e => setWorkerId(e.target.value)} disabled={loading || busy} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
        <div><Label htmlFor="manual-job">Job</Label><select id="manual-job" value={jobId} onChange={e => setJobId(e.target.value)} disabled={loading || busy} required className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Choose a job</option>{jobs.map(j => <option key={j.id} value={j.id}>{j.title}{j.status === "completed" ? " (completed)" : ""}</option>)}</select></div>
        <div><Label htmlFor="manual-start">Start date and time</Label><Input id="manual-start" type="datetime-local" value={start} onChange={e => setStart(e.target.value)} max={localDateTimeValue()} disabled={busy} required /></div>
        <div><Label htmlFor="manual-end">End date and time</Label><Input id="manual-end" type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} max={localDateTimeValue()} disabled={busy} required /></div>
        {Number.isFinite(hours) && hours>0 && <p className="text-sm font-medium">Total: {hours.toFixed(2)} hours</p>}
        <div><Label htmlFor="manual-note">Note (optional)</Label><Textarea id="manual-note" value={note} onChange={e => setNote(e.target.value)} maxLength={2000} disabled={busy} placeholder="For example: forgot to clock in on Monday" /></div>
        {loading && <p role="status" className="text-sm">Loading team and jobs…</p>}
        {!loading && !jobs.length && !error && <p className="text-sm">Add a job before recording time. Completed jobs are included.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={busy}>Cancel</Button><Button type="submit" disabled={loading || busy || !jobs.length || !workers.length}>{busy ? "Saving…" : "Save past time"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
