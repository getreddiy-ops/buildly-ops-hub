import { useEffect, useMemo, useState } from "react";
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

interface Entry {
  id: string;
  user_id: string;
  job_id: string;
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
  const [scope, setScope] = useState<"week" | "month" | "all">("week");
  const [loading, setLoading] = useState(true);

  const load = async () => {
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
    const list = (data ?? []) as any as Entry[];
    setEntries(list);
    const ids = Array.from(new Set(list.map((e) => e.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id.slice(0, 8); });
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id, scope, isAdmin]);

  const total = useMemo(() => entries.reduce((s, e) => s + hrs(e), 0), [entries]);

  return (
    <div>
      <PageHeader
        title="Time Tracking"
        description={isAdmin ? "All crew time entries." : "Your time entries."}
        actions={
          <Select value={scope} onValueChange={(v) => setScope(v as any)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        }
      />

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
                <TableHead className="w-10" />
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
                    {e.clock_in_lat != null && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${e.clock_in_lat},${e.clock_in_lng}`}
                        target="_blank" rel="noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        title="View clock-in location"
                      >
                        <MapPin className="h-4 w-4" />
                      </a>
                    )}
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
