import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Org = { id: string; name: string; plan: string; created_at: string; agent_id: string | null };

export default function AdminOrgs() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerFullName, setOwnerFullName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("organizations")
      .select("id, name, plan, created_at, agent_id")
      .order("created_at", { ascending: false });
    setOrgs((data ?? []) as Org[]);
  };

  useEffect(() => { load(); }, []);

  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()));

  const createOrg = async () => {
    if (!name.trim() || !ownerEmail.trim()) return;
    if (ownerPassword && ownerPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", {
        body: {
          type: "create_organization",
          name: name.trim(),
          owner_email: ownerEmail.trim(),
          owner_full_name: ownerFullName.trim() || undefined,
          owner_password: ownerPassword || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(ownerPassword ? "Organization created with owner login." : "Organization created. Owner will receive an invite email.");
      setOpen(false); setName(""); setOwnerEmail(""); setOwnerFullName(""); setOwnerPassword(""); load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const deleteOrg = async (o: Org) => {
    if (!confirm(`Permanently delete "${o.name}" and all related data? This cannot be undone.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", {
        body: { type: "delete_organization", organization_id: o.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Organization deleted");
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <PageHeader title="Organizations" description="Every contractor on the platform." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> New organization</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create organization</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Company name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Concrete" />
              </div>
              <div>
                <Label>Owner full name (optional)</Label>
                <Input value={ownerFullName} onChange={(e) => setOwnerFullName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <Label>Owner email</Label>
                <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com" />
              </div>
              <div>
                <Label>Owner password (optional)</Label>
                <Input type="password" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Leave blank to send invite email" autoComplete="new-password" />
                <p className="text-xs text-muted-foreground mt-1">
                  Set a password (min 8 chars) to create the owner immediately with login credentials. Leave blank to send a magic-link invite instead.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={createOrg} disabled={busy || !name.trim() || !ownerEmail.trim()}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />


      <Input placeholder="Search organizations…" value={q} onChange={(e) => setQ(e.target.value)}
        className="max-w-sm mb-4" />

      {filtered.length === 0 ? (
        <EmptyState icon={Building2} title="No organizations" />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((o) => (
            <div key={o.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <Link to={`/admin/organizations/${o.id}`} className="flex-1 min-w-0 hover:opacity-80 py-1">
                <div className="font-medium break-words">{o.name}</div>
                <div className="text-xs text-muted-foreground break-words">
                  Joined {new Date(o.created_at).toLocaleDateString()}
                  {o.agent_id && " · has agent"}
                </div>
              </Link>
              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                <Badge variant="outline">{o.plan}</Badge>
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => deleteOrg(o)} title="Delete organization">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
