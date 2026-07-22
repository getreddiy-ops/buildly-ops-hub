import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Clock, MapPin } from "lucide-react";
import { toast } from "sonner";
import FieldClock from "@/pages/field/FieldClock";

interface Entry {
  id: string;
  user_id: string;
  job_id: string | null;
  clock_in: string;
  clock_out: string | null;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  approved_hours: number | null;
  status: string;
  jobs: { title: string } | null;
}

type TimeScope = "week" | "month" | "all";

const hrs = (e: Entry) => {
  if (e.approved_hours != null) return Number(e.approved_hours);
  if (!e.clock_out) return 0;
  return (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;
};

const fmtHrs = (n: number) => `${n.toFixed(2)}h`;
const fmtDate = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

export default function TimeTracking() {
  const { activeOrg, user } = useAuth();
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [scope, setScope] = useState<TimeScope>("week");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeOrg) return;
    setLoading(true);
    let q = supabase.from("time_entries").select("*, jobs(title)").eq("organization_id", activeOrg.organization_id);
    if (!isAdmin && user) q = q.eq("user_id", user.id);
    if (scope !== "all") {
      const since = new Date();
      since.setDate(since.getDate() - (scope === "week" ? 7 : 30));
      q = q.gte("clock_in", since.toISOString());
    }
    const { data, error } = await q.order("clock_in", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data ?? []) as unknown as Entry[];
    setEntries(list);
    const ids = Array.from(new Set(list.map((e) => e.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((profile) => {
        map[profile.id] = profile.full_name || profile.email || profile.id.slice(0, 8);
      });
      setNames(map);
    }
    setLoading(false);
  }, [activeOrg, isAdmin, scope, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => entries.reduce((s, e) => s + hrs(e), 0), [entries]);

  return (
    <div>
      <PageHeader
        title="Time Tracking"
        description={isAdmin ? "All crew time entries." : "Your time entries."}
        actions={
          <Select value={scope} onValueChange={(value) => setScope(value as TimeScope)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <section className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">My clock</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a job, clock yourself in, and let FastTract capture your phone's location at clock-in and clock-out.
          </p>
        </div>
        <FieldClock embedded onEntryChanged={load} />
      </section>

      <div className="mb-4 flex gap-6 text-sm">
        <Stat label="Entries" value={String(entries.length)} />
        <Stat label="Total hours" value={fmtHrs(total)} />
        <Stat label="Pending" value={String(entries.filter((e) => e.status === "pending" && e.clock_out).length)} />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={Clock} title="No time entries" description="Crew time entries from the field app will show up here." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Locations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{names[e.user_id] ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.jobs?.title ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{fmtDate(e.clock_in)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.clock_out ? fmtDate(e.clock_out) : <span className="text-primary">Active</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.clock_out ? fmtHrs(hrs(e)) : "—"}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3 text-xs">
                      {e.clock_in_lat != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${e.clock_in_lat},${e.clock_in_lng}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                          title="View clock-in location"
                        >
                          <MapPin className="h-4 w-4" />
                          In
                        </a>
                      )}
                      {e.clock_out_lat != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${e.clock_out_lat},${e.clock_out_lng}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary"
                          title="View clock-out location"
                        >
                          <MapPin className="h-4 w-4" />
                          Out
                        </a>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
