import { useCallback, useEffect, useState } from "react";
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
import {
  AUTO_JOB_RADIUS_METERS,
  canChooseAnyOrgJob,
  distanceInMeters,
  elapsedTime,
  getCurrentPosition,
} from "@/lib/time-clock";

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

interface AssignedJobRecord extends AssignedJob {
  organization_id: string;
  status: string;
}

interface CrewAssignmentRecord {
  jobs: AssignedJobRecord | null;
}

type PermState = "unknown" | "prompt" | "granted" | "denied";

interface FieldClockProps {
  embedded?: boolean;
  onEntryChanged?: () => void;
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return fallback;
};

export default function FieldClock({ embedded = false, onEntryChanged }: FieldClockProps) {
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
        if (navigator.permissions?.query) {
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

  const load = useCallback(async () => {
    if (!user || !activeOrg) return;
    setLoading(true);
    const { data: entry, error: entryError } = await supabase
        .from("time_entries")
        .select("id, job_id, clock_in, note, jobs(title)")
        .eq("user_id", user.id)
        .eq("organization_id", activeOrg.organization_id)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();

    let list: AssignedJob[] = [];
    if (canChooseAnyOrgJob(activeOrg.role)) {
      const { data: orgJobs, error } = await supabase
        .from("jobs")
        .select("id, title, status, organization_id, latitude, longitude, address")
        .eq("organization_id", activeOrg.organization_id)
        .not("status", "in", "(completed,cancelled)")
        .order("title");
      if (error) toast.error(error.message);
      list = (orgJobs ?? []).map((job) => ({
        id: job.id,
        title: job.title,
        latitude: job.latitude,
        longitude: job.longitude,
        address: job.address,
      }));
    } else {
      const { data: assignments, error } = await supabase
        .from("crew_assignments")
        .select("job_id, jobs!inner(id, title, status, organization_id, latitude, longitude, address)")
        .eq("user_id", user.id);
      if (error) toast.error(error.message);
      list = ((assignments ?? []) as unknown as CrewAssignmentRecord[])
        .map((row) => row.jobs)
        .filter((job) =>
          job &&
          job.organization_id === activeOrg.organization_id &&
          job.status !== "completed" &&
          job.status !== "cancelled",
        )
        .map((job) => ({
          id: job.id,
          title: job.title,
          latitude: job.latitude,
          longitude: job.longitude,
          address: job.address,
        }));
    }

    if (entryError) toast.error(entryError.message);
    setOpenEntry((entry as unknown as OpenEntry | null) ?? null);
    setJobs(list);
    setManualJob((current) =>
      current !== "__none__" && !list.some((job) => job.id === current) ? "__none__" : current,
    );
    setLoading(false);
  }, [activeOrg, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const detectNearestJob = useCallback(async (knownPosition?: GeolocationPosition) => {
    if (jobs.length === 0) return;
    setDetecting(true);
    try {
      const pos = knownPosition ?? await getCurrentPosition();
      setPerm("granted");
      const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      let best: { job: AssignedJob; distance: number } | null = null;
      for (const j of jobs) {
        if (j.latitude == null || j.longitude == null) continue;
        const d = distanceInMeters(here, { lat: Number(j.latitude), lng: Number(j.longitude) });
        if (!best || d < best.distance) best = { job: j, distance: d };
      }
      setDetected(best);
      if (best && best.distance <= AUTO_JOB_RADIUS_METERS) {
        setManualJob(best.job.id);
      }
    } catch (error: unknown) {
      setPerm("denied");
      toast.error(getErrorMessage(error, "Could not read location"));
    } finally {
      setDetecting(false);
    }
  }, [jobs]);

  const requestPermission = async () => {
    try {
      const position = await getCurrentPosition();
      setPerm("granted");
      toast.success("Location enabled");
      await detectNearestJob(position);
    } catch (error: unknown) {
      setPerm("denied");
      toast.error(getErrorMessage(error, "Location permission denied"));
    }
  };

  useEffect(() => {
    if (perm === "granted" && jobs.length > 0 && !openEntry && !detected) {
      void detectNearestJob();
    }
  }, [perm, jobs.length, openEntry, detected, detectNearestJob]);

  const clockIn = async () => {
    if (!user || !activeOrg) return;
    const jobId = manualJob !== "__none__" ? manualJob : null;
    if (!jobId && !activity.trim()) {
      toast.error("Choose a job or describe what you'll be working on.");
      return;
    }
    setWorking(true);
    try {
      let position: GeolocationPosition | null = null;
      try {
        position = await getCurrentPosition();
        setPerm("granted");
      } catch {
        setPerm("denied");
        toast.warning("Location was unavailable. Your time will still be recorded.");
      }
      const { error } = await supabase.from("time_entries").insert({
        organization_id: activeOrg.organization_id,
        user_id: user.id,
        job_id: jobId,
        clock_in: new Date().toISOString(),
        clock_in_lat: position?.coords.latitude ?? null,
        clock_in_lng: position?.coords.longitude ?? null,
        status: "pending",
        note: jobId ? null : activity.trim(),
      });
      if (error) throw error;
      toast.success(jobId ? "Clocked in to the selected job" : "Clocked in — assign the entry later");
      setManualJob("__none__"); setActivity(""); setDetected(null);
      await load();
      onEntryChanged?.();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not clock in"));
    } finally {
      setWorking(false);
    }
  };

  const clockOut = async () => {
    if (!openEntry || !user || !activeOrg) return;
    setWorking(true);
    try {
      let position: GeolocationPosition | null = null;
      try {
        position = await getCurrentPosition();
        setPerm("granted");
      } catch {
        setPerm("denied");
        toast.warning("Location was unavailable. Your clock-out will still be saved.");
      }
      const { error } = await supabase
        .from("time_entries")
        .update({
          clock_out: new Date().toISOString(),
          clock_out_lat: position?.coords.latitude ?? null,
          clock_out_lng: position?.coords.longitude ?? null,
        })
        .eq("id", openEntry.id)
        .eq("user_id", user.id)
        .eq("organization_id", activeOrg.organization_id)
        .is("clock_out", null);
      if (error) throw error;
      toast.success("Clocked out — time entry saved");
      await load();
      onEntryChanged?.();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Could not clock out"));
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return <div className="grid place-items-center py-20 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (openEntry) {
    return (
      <div className={embedded ? "space-y-4 text-center" : "mx-auto max-w-sm space-y-6 pt-6 text-center"}>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-primary/20 text-primary">
            <Clock className="h-7 w-7" />
          </div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Clocked in</p>
          <p className="mt-1 text-xl font-semibold">
            {openEntry.jobs?.title ?? (openEntry.note ? `Unassigned · ${openEntry.note}` : "Unassigned")}
          </p>
          <p className="mt-4 font-mono text-4xl tabular-nums" key={tick}>{elapsedTime(openEntry.clock_in)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Since {new Date(openEntry.clock_in).toLocaleTimeString()}</p>
        </div>
        <Button onClick={clockOut} disabled={working} size="lg" variant="destructive" className="w-full">
          {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving location…</> : <><MapPin className="h-4 w-4" /> Clock out</>}
        </Button>
        <p className="text-xs text-muted-foreground">FastTract requests your current location again at clock-out. If it is unavailable, your hours are still saved.</p>
      </div>
    );
  }

  const hasAuto = detected && detected.distance <= AUTO_JOB_RADIUS_METERS;

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-sm space-y-5 pt-6"}>
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
                FastTract asks for your phone's current location only when you clock in and out. Clock locations can be opened in Google Maps; there is no background tracking.
              </p>
              <Button size="sm" onClick={requestPermission} className="mt-3">Use my phone's location</Button>
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
          <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => detectNearestJob()} disabled={detecting}>
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
                Closest available job is {detected.job.title} ({Math.round(detected.distance)}m away — outside the {AUTO_JOB_RADIUS_METERS}m range).
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No available jobs have saved map coordinates. Pick one below or describe what you're doing.</p>
          )}
        </div>
      )}

      {/* Job selection and manual fallback */}
      <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Job for these hours</Label>
            <Select value={manualJob} onValueChange={setManualJob}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={jobs.length === 0 ? "No active jobs available" : "Select a job"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No job — add a note</SelectItem>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
            {canChooseAnyOrgJob(activeOrg?.role) && jobs.length > 0 && (
              <p className="text-xs text-muted-foreground">As an owner or admin, you can clock your own hours to any active job.</p>
            )}
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
              <p className="text-xs text-muted-foreground">You can assign this entry to a job after clock-out.</p>
            </div>
          )}
      </div>

      <Button
        onClick={clockIn}
        disabled={working || (manualJob === "__none__" && !activity.trim())}
        size="lg"
        className="w-full"
      >
        {working ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving clock-in…</> : <><MapPin className="h-4 w-4" /> Clock in</>}
      </Button>
      <p className="text-center text-xs text-muted-foreground">FastTract will request location when you clock in. If GPS is unavailable, time tracking still works.</p>
    </div>
  );
}
