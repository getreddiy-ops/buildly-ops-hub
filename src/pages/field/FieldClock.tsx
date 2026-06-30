import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, MapPin, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

interface OpenEntry {
  id: string;
  job_id: string | null;
  clock_in: string;
  note: string | null;
  jobs?: { title: string } | null;
}

interface AssignedJob {
  id: string;
  title: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
}

const AUTO_RADIUS_M = 250;

const getPos = (): Promise<GeolocationPosition> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation not available on this device"));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });

// Haversine distance in meters
const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const elapsed = (since: string) => {
  const ms = Date.now() - new Date(since).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

type PermState = "unknown" | "prompt" | "granted" | "denied";

export default function FieldClock() {
  const { user, activeOrg } = useAuth();
  const [openEntry, setOpenEntry] = useState<OpenEntry | null>(null);
  const [jobs, setJobs] = useState<AssignedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tick, setTick] = useState(0);
  const [perm, setPerm] = useState<PermState>("unknown");

  // Manual fallback (when no job within radius)
  const [manualJob, setManualJob] = useState<string>("__none__");
  const [activity, setActivity] = useState("");

  // Auto-detection result
  const [detected, setDetected] = useState<{ job: AssignedJob; distance: number } | null>(null);
  const [detecting, setDetecting] = useState(false);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Query permissions API where available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // @ts-ignore — permissions API may be missing on iOS Safari
        if (navigator.permissions?.query) {
          // @ts-ignore
          const status = await navigator.permissions.query({ name: "geolocation" });
          if (!cancelled) setPerm(status.state as PermState);
          status.onchange = () => !cancelled && setPerm(status.state as PermState);
        } else {
          setPerm("prompt");
        }
      } catch {
        setPerm("prompt");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requestPermission = async () => {
    try {
      await getPos();
      setPerm("granted");
      toast.success("Location enabled");
      detectNearestJob();
    } catch (e: any) {
      setPerm("denied");
      toast.error(e?.message ?? "Location permission denied");
    }
  };

  const load = async () => {
    if (!user || !activeOrg) return;
    setLoading(true);
    const [{ data: entry }, { data: ca }] = await Promise.all([
      supabase
        .from("time_entries")
        .select("id, job_id, clock_in, note, jobs(title)")
        .eq("user_id", user.id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("crew_assignments")
        .select("job_id, jobs!inner(id, title, status, organization_id, latitude, longitude, address)")
        .eq("user_id", user.id),
    ]);
    setOpenEntry((entry as any) ?? null);
    const list = ((ca ?? []) as any[])
      .map((r) => r.jobs)
      .filter((j) => j && j.organization_id === activeOrg.organization_id && j.status !== "completed" && j.status !== "cancelled")
      .map((j) => ({ id: j.id, title: j.title, latitude: j.latitude, longitude: j.longitude, address: j.address }));
    setJobs(list);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, activeOrg?.organization_id]);

  const detectNearestJob = async () => {
    if (jobs.length === 0) return;
    setDetecting(true);
    try {
      const pos = await getPos();
      setPerm("granted");
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let best: { job: AssignedJob; distance: number } | null = null;
      for (const j of jobs) {
        if (j.latitude == null || j.longitude == null) continue;
        const d = distM(here, { lat: Number(j.latitude), lng: Number(j.longitude) });
        if (!best || d < best.distance) best = { job: j, distance: d };
      }
      setDetected(best);
      if (best && best.distance <= AUTO_RADIUS_M) {
        setManualJob(best.job.id);
      }
    } catch (e: any) {
      setPerm("denied");
      toast.error(e?.message ?? "Could not read location");
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (perm === "granted" && jobs.length > 0 && !openEntry && !detected) {
      detectNearestJob();
    }
    // eslint-disable-next-line
  }, [perm, jobs.length, openEntry]);

  const clockIn = async () => {
    if (!user || !activeOrg) return;
    const hasAuto = detected && detected.distance <= AUTO_RADIUS_M;
    const jobId = hasAuto ? detected!.job.id : (manualJob !== "__none__" ? manualJob : null);
    if (!jobId && !activity.trim()) {
      toast.error("Describe what you'll be doing so your boss can attach the hours.");
      return;
    }
    setWorking(true);
    try {
      const pos = await getPos();
      const { error } = await supabase.from("time_entries").insert({
        organization_id: activeOrg.organization_id,
        user_id: user.id,
        job_id: jobId,
        clock_in: new Date().toISOString(),
        clock_in_lat: pos.coords.latitude,
        clock_in_lng: pos.coords.longitude,
        status: "pending",
        note: jobId ? null : activity.trim(),
      });
      if (error) throw error;
      toast.success(jobId ? "Clocked in" : "Clocked in — boss will attach this to a job");
      setManualJob("__none__"); setActivity(""); setDetected(null);
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
          <p className="mt-1 text-xl font-semibold">
            {openEntry.jobs?.title ?? (openEntry.note ? `Unassigned · ${openEntry.note}` : "Unassigned")}
          </p>
          <p className="mt-4 font-mono text-4xl tabular-nums" key={tick}>{elapsed(openEntry.clock_in)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Since {new Date(openEntry.clock_in).toLocaleTimeString()}</p>
        </div>
        <Button onClick={clockOut} disabled={working} size="lg" variant="destructive" className="w-full">
          {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving location…</> : <><MapPin className="h-4 w-4" /> Clock out</>}
        </Button>
        <p className="text-xs text-muted-foreground">Your GPS location is recorded at clock-out so your boss can verify your hours.</p>
      </div>
    );
  }

  const hasAuto = detected && detected.distance <= AUTO_RADIUS_M;

  return (
    <div className="mx-auto max-w-sm space-y-5 pt-6">
      <div className="rounded-2xl border border-border bg-card p-6 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <Clock className="h-7 w-7" />
        </div>
        <p className="text-sm uppercase tracking-wide text-muted-foreground">You're clocked out</p>
        <p className="mt-1 text-lg font-medium">Ready to start your shift</p>
      </div>

      {/* Permission card */}
      {perm !== "granted" && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Location permission needed</p>
              <p className="text-xs text-muted-foreground mt-1">
                We use your phone's GPS only when you clock in and out so your employer can verify your hours and match you to the right job.
              </p>
              <Button size="sm" onClick={requestPermission} className="mt-3">Allow location</Button>
              {perm === "denied" && (
                <p className="text-xs text-destructive mt-2">
                  Permission was blocked. Open your browser settings for this site and enable Location, then reload.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {perm === "granted" && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Location enabled</span>
          <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={detectNearestJob} disabled={detecting}>
            {detecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-check"}
          </Button>
        </div>
      )}

      {/* Detection result */}
      {perm === "granted" && jobs.length > 0 && (
        <div className="rounded-xl border border-border p-4 space-y-2">
          {detecting ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Finding the closest job…</p>
          ) : hasAuto ? (
            <>
              <p className="text-xs uppercase tracking-wide text-emerald-600">Auto-matched job</p>
              <p className="font-semibold">{detected!.job.title}</p>
              <p className="text-xs text-muted-foreground">{Math.round(detected!.distance)}m away · hours will attach automatically</p>
            </>
          ) : detected ? (
            <>
              <p className="text-xs uppercase tracking-wide text-amber-600">No job at your location</p>
              <p className="text-xs text-muted-foreground">
                Closest assigned job is {detected.job.title} ({Math.round(detected.distance)}m away — outside the {AUTO_RADIUS_M}m range).
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No assigned jobs have a saved address. Pick one below or describe what you're doing.</p>
          )}
        </div>
      )}

      {/* Manual fallback */}
      {!hasAuto && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Pick a job (optional)</Label>
            <Select value={manualJob} onValueChange={setManualJob}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={jobs.length === 0 ? "No jobs assigned to you" : "Select a job"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No job — boss will attach later</SelectItem>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {manualJob === "__none__" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">What are you working on?</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Helping at the Reed Ave site, shop cleanup, material run…"
                value={activity}
                onChange={(e) => setActivity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Your boss will assign these hours to a job or invoice after you clock out.</p>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={clockIn}
        disabled={working || perm !== "granted"}
        size="lg"
        className="w-full"
      >
        {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Getting location…</> : <><MapPin className="h-4 w-4" /> Clock in</>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">GPS is captured at clock-in and clock-out only.</p>
    </div>
  );
}
