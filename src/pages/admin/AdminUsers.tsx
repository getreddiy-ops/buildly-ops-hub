import { useEffect, useState } from "react";
import { Users, ShieldCheck, ShieldOff, Plus, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AppRole = "platform_admin" | "agent" | "owner" | "admin" | "worker";
type Profile = { id: string; full_name: string | null; email: string | null; created_at: string };

export default function AdminUsers() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole[]>>({});
  const [q, setQ] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwUser, setPwUser] = useState<Profile | null>(null);
  const [pwValue, setPwValue] = useState("");

  const load = async () => {
    const { data: ps } = await supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false });
    setUsers((ps ?? []) as Profile[]);
    const { data: rs } = await supabase.from("user_roles").select("user_id, role");
    const map: Record<string, AppRole[]> = {};
    (rs ?? []).forEach((r: any) => { (map[r.user_id] ??= []).push(r.role); });
    setRoles(map);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (uid: string, role: AppRole) => {
    const has = roles[uid]?.includes(role);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) return toast.error(error.message);
    }
    toast.success("Role updated");
    load();
  };

  const filtered = users.filter((u) =>
    (u.email ?? "").toLowerCase().includes(q.toLowerCase()) ||
    (u.full_name ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const createUser = async () => {
    if (!newEmail.trim() || newPassword.length < 8) {
      toast.error("Email and password (min 8 chars) required");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", {
        body: { type: "create_user", email: newEmail.trim(), password: newPassword, full_name: newName.trim() || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("User created");
      setOpenCreate(false); setNewEmail(""); setNewName(""); setNewPassword(""); load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const savePassword = async () => {
    if (!pwUser || pwValue.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", {
        body: { type: "set_user_password", user_id: pwUser.id, password: pwValue },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Password updated");
      setPwUser(null); setPwValue("");
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Users" description="Every user on the platform, with global role management." actions={
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New user</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create user</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name (optional)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jane Doe" /></div>
              <div><Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" /></div>
              <div><Label>Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenCreate(false)}>Cancel</Button>
              <Button onClick={createUser} disabled={busy || !newEmail.trim() || newPassword.length < 8}>
                {busy ? "Creating…" : "Create user"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <Input placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm mb-4" />

      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setPwValue(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set password for {pwUser?.email}</DialogTitle></DialogHeader>
          <div><Label>New password</Label>
            <Input type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Min 8 characters" autoComplete="new-password" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwUser(null); setPwValue(""); }}>Cancel</Button>
            <Button onClick={savePassword} disabled={busy || pwValue.length < 8}>Save password</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No users yet" />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((u) => {
            const userRoles = roles[u.id] ?? [];
            return (
              <div key={u.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium break-words">{u.full_name || u.email || u.id}</div>
                  <div className="text-xs text-muted-foreground break-all">{u.email}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {userRoles.length === 0
                      ? <span className="text-xs text-muted-foreground">No platform roles</span>
                      : userRoles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button size="sm" className="h-10 flex-1 sm:flex-initial" variant="outline"
                    onClick={() => { setPwUser(u); setPwValue(""); }}>
                    <KeyRound className="h-3 w-3 mr-1" /> Password
                  </Button>
                  <Button size="sm" className="h-10 flex-1 sm:flex-initial" variant={userRoles.includes("agent") ? "default" : "outline"}
                    onClick={() => toggle(u.id, "agent")}>
                    {userRoles.includes("agent") ? <ShieldOff className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                    Agent
                  </Button>
                  <Button size="sm" className="h-10 flex-1 sm:flex-initial" variant={userRoles.includes("platform_admin") ? "default" : "outline"}
                    onClick={() => toggle(u.id, "platform_admin")}>
                    {userRoles.includes("platform_admin") ? <ShieldOff className="h-3 w-3 mr-1" /> : <ShieldCheck className="h-3 w-3 mr-1" />}
                    Admin
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </>
  );
}
