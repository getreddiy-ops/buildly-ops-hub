import { useEffect, useState } from "react";
import { Users, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Org = { id: string; name: string };
type Lead = { id: string; name: string; email: string | null; phone: string | null; status: string; created_at: string; organization_id: string; organizations: { name: string } | null };

export default function AgentLeads() {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ organization_id: "", name: "", email: "", phone: "", notes: "" });

  const load = async () => {
    if (!user) return;
    const { data: o } = await supabase.from("organizations").select("id, name").eq("agent_id", user.id);
    setOrgs((o ?? []) as Org[]);
    const ids = (o ?? []).map((x) => x.id);
    if (ids.length) {
      const { data: l } = await supabase
        .from("leads")
        .select("id, name, email, phone, status, created_at, organization_id, organizations(name)")
        .in("organization_id", ids)
        .order("created_at", { ascending: false });
      setLeads((l ?? []) as any);
    }
  };

  useEffect(() => { load(); }, [user]);

  const share = async () => {
    if (!form.organization_id || !form.name) return toast.error("Pick an org and add a name");
    const { error } = await supabase.from("leads").insert({
      organization_id: form.organization_id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
      source: "agent_referral",
      status: "new",
    });
    if (error) return toast.error(error.message);
    toast.success("Lead shared");
    setOpen(false);
    setForm({ organization_id: "", name: "", email: "", phone: "", notes: "" });
    load();
  };

  return (
    <>
      <PageHeader title="Lead Sharing" description="Pass new opportunities to your contractor clients."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Send className="h-4 w-4" /> Share lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Share a lead with a client</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Client organization</Label>
                  <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Pick a client" /></SelectTrigger>
                    <SelectContent>
                      {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={share}>Share</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {leads.length === 0 ? (
        <EmptyState icon={Users} title="No shared leads yet" description="Share an opportunity with one of your client contractors to get started." />
      ) : (
        <Card className="divide-y divide-border">
          {leads.map((l) => (
            <div key={l.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground">
                  Shared with {l.organizations?.name ?? "—"} · {new Date(l.created_at).toLocaleDateString()}
                  {l.email && ` · ${l.email}`}{l.phone && ` · ${l.phone}`}
                </div>
              </div>
              <StatusBadge status={l.status} />
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
