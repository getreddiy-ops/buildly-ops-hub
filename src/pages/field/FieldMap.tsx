import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { MapPin, Loader2 } from "lucide-react";

interface Job {
  id: string;
  title: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export default function FieldMap() {
  const { user, activeOrg } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activeOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crew_assignments")
        .select("jobs!inner(id, title, address, latitude, longitude, organization_id, status)")
        .eq("user_id", user.id);
      const list = ((data ?? []) as any[])
        .map((r) => r.jobs)
        .filter((j) => j && j.organization_id === activeOrg.organization_id && j.status !== "completed" && j.status !== "cancelled" && (j.address || (j.latitude && j.longitude)));
      setJobs(list);
      setLoading(false);
    })();
  }, [user?.id, activeOrg?.organization_id]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (jobs.length === 0) return <EmptyState icon={MapPin} title="No job locations" description="Active jobs with an address will show up here." />;

  return (
    <div className="space-y-3">
      <h1 className="mb-2 text-lg font-semibold">Job map</h1>
      {jobs.map((j) => {
        const q = j.latitude && j.longitude ? `${j.latitude},${j.longitude}` : j.address!;
        return (
          <a
            key={j.id}
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`}
            target="_blank" rel="noreferrer"
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/50"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{j.title}</p>
              <p className="truncate text-sm text-muted-foreground">{j.address ?? `${j.latitude}, ${j.longitude}`}</p>
              <p className="mt-1 text-xs text-primary">Open in Maps →</p>
            </div>
          </a>
        );
      })}
    </div>
  );
}
