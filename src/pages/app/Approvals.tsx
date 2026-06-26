import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckSquare, Check, X, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Entry {
  id: string;
  user_id: string;
  job_id: string;
  clock_in: string;
  clock_out: string;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  jobs: { title: string } | null;
}

const rawHours = (e: Entry) =>
  (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 3600000;

const fmtDate = (s: string) => new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });

export default function Approvals() {
  const { activeOrg, user } = useAuth();
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [entries, setEntries] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("time_entries")
      .select("id, user_id, job_id, clock_in, clock_out, clock_in_lat, clock_in_lng, jobs(title)")
      .eq("organization_id", activeOrg.organization_id)
      .eq("status", "pending")
      .not("clock_out", "is", null)
      .order("clock_in", { ascending: false });
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

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const decide = async (e: Entry, status: "approved" | "rejected") => {
    if (!user) return;
    setWorking(e.id);
    const override = overrides[e.id];
    const hours = status === "approved"
      ? (override !== undefined && override !== "" ? Number(override) : rawHours(e))
      : 0;
    const { error } = await supabase
      .from("time_entries")
      .update({
        status,
        approved_hours: status === "approved" ? hours : 0,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", e.id);
    setWorking(null);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Rejected");
    setEntries((s) => s.filter((x) => x.id !== e.id));
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Approvals" description="Review and approve crew hours." />
        <EmptyState icon={CheckSquare} title="Admins only" description="Only owners and admins can approve time entries." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Approvals" description="Review and approve crew hours before payroll." />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <EmptyState icon={CheckSquare} title="Nothing waiting" description="All caught up. New pending entries will appear here." />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead className="text-right">Tracked</TableHead>
                <TableHead className="w-28">Approve hrs</TableHead>
                <TableHead className="w-10" />
                <TableHead className="w-44 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => {
                const raw = rawHours(e);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{names[e.user_id] ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{e.jobs?.title ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{fmtDate(e.clock_in)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{fmtDate(e.clock_out)}</TableCell>
                    <TableCell className="text-right tabular-nums">{raw.toFixed(2)}h</TableCell>
                    <TableCell>
                      <Input
                        type="number" min={0} step="0.25" className="h-8"
                        placeholder={raw.toFixed(2)}
                        value={overrides[e.id] ?? ""}
                        onChange={(ev) => setOverrides((s) => ({ ...s, [e.id]: ev.target.value }))}
                      />
                    </TableCell>
                    <TableCell>
                      {e.clock_in_lat != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${e.clock_in_lat},${e.clock_in_lng}`}
                          target="_blank" rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          title="Clock-in location"
                        >
                          <MapPin className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button size="sm" variant="outline" onClick={() => decide(e, "rejected")} disabled={working === e.id}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => decide(e, "approved")} disabled={working === e.id}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
