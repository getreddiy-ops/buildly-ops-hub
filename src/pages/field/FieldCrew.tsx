import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/EmptyState";
import { Users, Loader2, MapPin, Circle } from "lucide-react";

interface CrewMember {
  user_id: string;
  full_name: string | null;
  clocked_in: boolean;
  job_title: string | null;
  job_address: string | null;
  lat: number | null;
  lng: number | null;
  since: string | null;
}

export default function FieldCrew() {
  const { activeOrg } = useAuth();
  const [members, setMembers] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrg) return;
    let cancelled = false;
    const load = async () => {
      // teammates
      const { data: roster } = await supabase
        .from("organization_members")
        .select("user_id, profiles:user_id(full_name)")
        .eq("organization_id", activeOrg.organization_id);

      // open time entries
      const { data: open } = await supabase
        .from("time_entries")
        .select("user_id, clock_in, clock_in_lat, clock_in_lng, jobs:job_id(title, address)")
        .eq("organization_id", activeOrg.organization_id)
        .is("clock_out", null);

      const byUser = new Map<string, any>();
      (open ?? []).forEach((e: any) => byUser.set(e.user_id, e));

      const list: CrewMember[] = (roster ?? []).map((r: any) => {
        const e = byUser.get(r.user_id);
        return {
          user_id: r.user_id,
          full_name: r.profiles?.full_name ?? null,
          clocked_in: !!e,
          job_title: e?.jobs?.title ?? null,
          job_address: e?.jobs?.address ?? null,
          lat: e?.clock_in_lat ?? null,
          lng: e?.clock_in_lng ?? null,
          since: e?.clock_in ?? null,
        };
      });
      list.sort((a, b) => Number(b.clocked_in) - Number(a.clocked_in));
      if (!cancelled) {
        setMembers(list);
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activeOrg?.organization_id]);

  if (loading) return <div className="grid place-items-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (members.length === 0) return <EmptyState icon={Users} title="No crew yet" description="Invite teammates from the office app." />;

  const onShift = members.filter(m => m.clocked_in).length;

  return (
    <div className="space-y-3">
      <div className="mb-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Crew</h1>
        <span className="text-xs text-muted-foreground">{onShift} on shift</span>
      </div>
      {members.map((m) => {
        const q = m.lat && m.lng ? `${m.lat},${m.lng}` : m.job_address;
        const Wrap: any = q ? "a" : "div";
        const wrapProps = q ? {
          href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
          target: "_blank",
          rel: "noreferrer",
        } : {};
        return (
          <Wrap
            key={m.user_id}
            {...wrapProps}
            className={`flex items-start gap-3 rounded-xl border border-border bg-card p-4 ${q ? "transition hover:border-primary/50" : ""}`}
          >
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${m.clocked_in ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">{m.full_name ?? "Teammate"}</p>
                <span className={`inline-flex items-center gap-1 text-xs ${m.clocked_in ? "text-primary" : "text-muted-foreground"}`}>
                  <Circle className={`h-2 w-2 ${m.clocked_in ? "fill-primary" : "fill-muted-foreground"}`} />
                  {m.clocked_in ? "On shift" : "Off"}
                </span>
              </div>
              {m.clocked_in ? (
                <>
                  <p className="truncate text-sm text-muted-foreground">
                    {m.job_title ?? "No job"}{m.job_address ? ` — ${m.job_address}` : ""}
                  </p>
                  {q && <p className="mt-1 inline-flex items-center gap-1 text-xs text-primary"><MapPin className="h-3 w-3" /> Open in Maps →</p>}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Not clocked in</p>
              )}
            </div>
          </Wrap>
        );
      })}
    </div>
  );
}
