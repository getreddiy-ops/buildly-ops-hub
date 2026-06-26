import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Briefcase, MapPin, Loader2, Calendar } from "lucide-react";

interface Job {
  id: string;
  title: string;
  status: string;
  address: string | null;
  scheduled_start: string | null;
  customers: { name: string } | null;
}

export default function FieldJobs() {
  const { user, activeOrg } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activeOrg) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("crew_assignments")
        .select("jobs!inner(id, title, status, address, scheduled_start, organization_id, customers(name))")
        .eq("user_id", user.id);
      const list = ((data ?? []) as any[])
        .map((r) => r.jobs)
        .filter((j) => j && j.organization_id === activeOrg.organization_id)
        .sort((a, b) => (a.scheduled_start ?? "").localeCompare(b.scheduled_start ?? ""));
      setJobs(list);
      setLoading(false);
    })();
  }, [user?.id, activeOrg?.organization_id]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (jobs.length === 0) return <EmptyState icon={Briefcase} title="No jobs assigned" description="Your boss will assign jobs that show up here." />;

  return (
    <div className="space-y-3">
      <h1 className="mb-2 text-lg font-semibold">My jobs</h1>
      {jobs.map((j) => (
        <div key={j.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{j.title}</p>
              <p className="text-sm text-muted-foreground">{j.customers?.name ?? "—"}</p>
            </div>
            <StatusBadge status={j.status} />
          </div>
          {j.scheduled_start && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(j.scheduled_start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
          {j.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(j.address)}`}
              target="_blank" rel="noreferrer"
              className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <MapPin className="h-3.5 w-3.5" />
              {j.address}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
