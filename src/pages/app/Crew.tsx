import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { HardHat, Plus, Copy } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface MemberRow {
  id: string;
  user_id: string;
  role: AppRole;
  hourly_rate: number | null;
  name: string;
  email: string | null;
}

interface InviteRow {
  id: string;
  email: string;
  role: AppRole;
  status: string;
  created_at: string;
}

const ROLES: AppRole[] = ["owner", "admin", "worker"];

const inviteSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["owner", "admin", "worker"]),
});

export default function Crew() {
  const { activeOrg, user } = useAuth();
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteTokens, setInviteTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invRole, setInvRole] = useState<AppRole>("worker");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: mems, error }, { data: invs }] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, user_id, role, hourly_rate")
        .eq("organization_id", activeOrg.organization_id),
      supabase
        .from("invitations")
        .select("id, email, role, status, created_at")
        .eq("organization_id", activeOrg.organization_id)
        .order("created_at", { ascending: false }),
    ]);
    if (error) toast.error(error.message);
    const userIds = (mems ?? []).map((m: any) => m.user_id);
    let profs: any[] = [];
    if (userIds.length > 0) {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      profs = data ?? [];
    }
    setMembers(((mems ?? []) as any[]).map((m) => {
      const p = profs.find((x) => x.id === m.user_id);
      return {
        id: m.id, user_id: m.user_id, role: m.role, hourly_rate: m.hourly_rate,
        name: p?.full_name || p?.email || m.user_id.slice(0, 8),
        email: p?.email ?? null,
      };
    }));
    setInvites((invs ?? []) as InviteRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const updateMember = async (id: string, patch: Partial<Pick<MemberRow, "role" | "hourly_rate">>) => {
    const { error } = await supabase.from("organization_members").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Updated");
    load();
  };

  const sha256Hex = async (input: string) => {
    const bytes = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const invite = async () => {
    const parsed = inviteSchema.safeParse({ email: invEmail, role: invRole });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!activeOrg || !user) return;
    setSaving(true);
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const token_hash = await sha256Hex(token);
    const { data: inserted, error } = await supabase.from("invitations").insert({
      organization_id: activeOrg.organization_id,
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash,
      invited_by: user.id,
    }).select("id").maybeSingle();
    setSaving(false);
    if (error) return toast.error(error.message);
    if (inserted?.id) {
      setInviteTokens((m) => ({ ...m, [inserted.id]: token }));
      const url = `${window.location.origin}/signup?invite=${token}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      toast.success("Invite link copied — it will not be shown again");
    }
    setInvEmail(""); setInvRole("worker"); setOpen(false);
    load();
  };

  const copyLink = (id: string) => {
    const token = inviteTokens[id];
    if (!token) {
      toast.error("Invite link is only available right after creation. Revoke and re-invite to get a new link.");
      return;
    }
    const url = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Invite link copied");
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this invitation?")) return;
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Crew"
        description="Your team, their roles, and pay rates."
        actions={
          isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4" /> Invite member</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
                <div className="grid gap-3">
                  <Field label="Email"><Input type="email" value={invEmail} onChange={(e) => setInvEmail(e.target.value)} /></Field>
                  <Field label="Role">
                    <Select value={invRole} onValueChange={(v) => setInvRole(v as AppRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={invite} disabled={saving}>{saving ? "Sending…" : "Create invite"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">Members</h2>
            {members.length === 0 ? (
              <EmptyState icon={HardHat} title="No crew members yet" />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Hourly rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{m.email ?? "—"}</TableCell>
                        <TableCell>
                          {isAdmin && m.user_id !== user?.id ? (
                            <Select value={m.role} onValueChange={(v) => updateMember(m.id, { role: v as AppRole })}>
                              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className="capitalize">{m.role}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Input
                              type="number" min={0} step="0.01" className="h-8 w-28"
                              defaultValue={m.hourly_rate ?? ""}
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : Number(e.target.value);
                                if (v !== m.hourly_rate) updateMember(m.id, { hourly_rate: v });
                              }}
                            />
                          ) : (
                            <span className="text-sm text-muted-foreground">{m.hourly_rate ? `$${m.hourly_rate}/hr` : "—"}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          {isAdmin && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pending invitations</h2>
              {invites.filter((i) => i.status === "pending").length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending invitations.</p>
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-32" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.filter((i) => i.status === "pending").map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.email}</TableCell>
                          <TableCell className="capitalize">{i.role}</TableCell>
                          <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => copyLink(i.id)} disabled={!inviteTokens[i.id]}>
                              <Copy className="h-3.5 w-3.5" /> Copy link
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => revoke(i.id)}>Revoke</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
