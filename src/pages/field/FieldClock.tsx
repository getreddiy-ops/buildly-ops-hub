import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Clock, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface OpenEntry {
  id: string;
  job_id: string;
  clock_in: string;
  jobs?: { title: string } | null;
}

interface AssignedJob {
  id: string;
  title: string;
}

const getPos = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not available"));
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
  });

const elapsed = (since: string) => {
  const ms = Date.now() - new Date(since).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

export default function FieldClock() {
  const { user, activeOrg } = useAuth();
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const load = async () => {
    if (!user || !activeOrg) return;
    setLoading(true);
    const [{ data: entry }, { data: ca }] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, job_id, clock_in, jobs(title)")
        .eq("user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("crew_assignments")
        .select("job_id, jobs!inner(id, title, status, organization_id)")
        .eq("user_id", user.id),
    ]);
    setOpenEntry((entry as any) ?? null);
    const list = ((ca ?? []) as any[])
      .map((r) => r.jobs)
      .filter((j) => j && j.organization_id === activeOrg.organization_id && j.status !== "completed" && j.status !== "cancelled")
      .map((j) => ({ id: j.id, title: j.title }));
    setJobs(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id, activeOrg?.organization_id]);

  const clockIn = async () => {
    if (!user || !activeOrg || !selectedJob) return;
    setWorking(true);
    try {
      const pos = await getPos();
      const { error } = await supabase.from("time_entries").insert({
        organization_id: activeOrg.organization_id,
        user_id: user.id,
        job_id: selectedJob,
        clock_in: new Date().toISOString(),
        clock_in_lat: pos.coords.latitude,
        clock_in_lng: pos.coords.longitude,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Clocked in");
      setSelectedJob("");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not clock in");
    } finally {
      setWorking(false);
    }
  };

  const clockOut = async () => {
    if (!openEntry) return;
    setWorking(true);
    try {
      const pos = await getPos();
      const { error } = await supabase
        .from("time_entries")
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: pos.coords.latitude,
          clock_out_lng: pos.coords.longitude,
        })
        .eq("id", openEntry.id);
      if (error) throw error;
      toast.success("Clocked out — awaiting approval");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not clock out");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (openEntry) {
    return (
      <div className="mx-auto max-w-sm space-y-6 pt-6 text-center">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/20 text-primary">
            <Clock className="h-7 w-7" />
          </div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Clocked in</p>
          <p className="mt-1 text-xl font-semibold">{openEntry.jobs?.title ?? "Job"}</p>
          <p className="mt-4 font-mono text-4xl tabular-nums" key={tick}>{elapsed(openEntry.clock_in)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Since {new Date(openEntry.clock_in).toLocaleTimeString()}</p>
        </div>
        <Button onClick={clockOut} disabled={working} size="lg" variant="destructive" className="w-full">
          {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving location…</> : <><MapPin className="h-4 w-4" /> Clock out</>}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-6">
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock className="h-7 w-7" />
        </div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">You're clocked out</p>
        <p className="mt-1 text-lg font-medium">Pick a job to start</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Job</Label>
        <Select value={selectedJob} onValueChange={setSelectedJob}>
          <SelectTrigger className="h-12"><SelectValue placeholder={jobs.length === 0 ? "No jobs assigned" : "Select a job"} /></SelectTrigger>
          <SelectContent>
            {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={clockIn} disabled={working || !selectedJob} size="lg" className="w-full">
        {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting location…</> : <><MapPin className="h-4 w-4" /> Clock in</>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">Your GPS location is recorded with each clock event.</p>
    </div>
  );
}
