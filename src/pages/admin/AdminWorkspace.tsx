import { useEffect, useMemo, useState } from "react";
import { LogIn, Search, Users, Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { startImpersonation } from "@/lib/impersonation";
import { toast } from "sonner";

type Member = { user_id: string; role: string; email: string | null; full_name: string | null };
type Org = { id: string; name: string; plan: string; owner_id: string; members: Member[] };

export default function AdminWorkspace() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [directEmail, setDirectEmail] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: orgRows }, { data: memberRows }, { data: profileRows }] = await Promise.all([
        supabase.from("organizations").select("id, name, plan, owner_id").order("name"),
        supabase.from("organization_members").select("organization_id, user_id, role"),
        supabase.from("profiles").select("id, email, full_name"),
      ]);
      const profiles = new Map((profileRows ?? []).map((p: any) => [p.id, p]));
      const byOrg = new Map<string, Member[]>();
      for (const m of (memberRows ?? []) as any[]) {
        const p = profiles.get(m.user_id);
        const list = byOrg.get(m.organization_id) ?? [];
        list.push({
          user_id: m.user_id,
          role: m.role,
          email: p?.email ?? null,
          full_name: p?.full_name ?? null,
        });
        byOrg.set(m.organization_id, list);
      }
      setOrgs(
        ((orgRows ?? []) as any[]).map((o) => ({ ...o, members: byOrg.get(o.id) ?? [] })),
      );
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(term) ||
        o.members.some(
          (m) =>
            (m.email ?? "").toLowerCase().includes(term) ||
            (m.full_name ?? "").toLowerCase().includes(term),
        ),
    );
  }, [orgs, q]);

  const enter = async (key: string, args: Parameters<typeof startImpersonation>[0]) => {
    setBusy(key);
    try {
      toast.info("Opening the client's account…");
      await startImpersonation(args);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not enter that account");
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Client Workspace"
        description="Sign in to any client account with full access to fix or edit anything. Every session and action is recorded in the audit log."
      />

      <Card className="mb-6 p-4">
        <div className="mb-2 text-sm font-medium">Enter by email</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="customer@example.com"
            value={directEmail}
            onChange={(e) => setDirectEmail(e.target.value)}
          />
          <Button
            disabled={!directEmail.includes("@") || busy === "direct"}
            onClick={() => enter("direct", { email: directEmail.trim() })}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {busy === "direct" ? "Opening…" : "Enter account"}
          </Button>
        </div>
      </Card>

      <div className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search organizations, names or emails…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading clients…</div>
      ) : (
        <div className="space-y-4">
          {filtered.map((org) => (
            <Card key={org.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate font-medium">{org.name}</span>
                  <Badge variant="outline">{org.plan}</Badge>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> {org.members.length}
                </div>
              </div>
              <div className="divide-y divide-border">
                {org.members.length === 0 && (
                  <div className="px-4 py-3 text-sm text-muted-foreground">No members.</div>
                )}
                {org.members.map((m) => (
                  <div
                    key={m.user_id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {m.full_name || m.email || m.user_id}
                        {org.owner_id === m.user_id && (
                          <Badge className="ml-2" variant="secondary">
                            owner
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.email ?? "no email"} · {m.role}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!m.email || busy === m.user_id}
                      onClick={() =>
                        enter(m.user_id, {
                          user_id: m.user_id,
                          email: m.email,
                          organization_id: org.id,
                          organization_name: org.name,
                        })
                      }
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      {busy === m.user_id ? "Opening…" : "Enter account"}
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No clients match that search.
            </div>
          )}
        </div>
      )}
    </>
  );
}
