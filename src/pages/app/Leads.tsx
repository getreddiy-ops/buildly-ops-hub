import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Users, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type LeadStatus = Database["public"]["Enums"]["lead_status"];

const STATUSES: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  source: z.string().trim().max(80).optional().or(z.literal("")),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const empty = { name: "", email: "", phone: "", address: "", source: "", status: "new" as LeadStatus, notes: "" };

export default function Leads() {
  const { activeOrg, user } = useAuth();
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("organization_id", activeOrg.organization_id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name ?? "", email: l.email ?? "", phone: l.phone ?? "",
      address: l.address ?? "", source: l.source ?? "",
      status: l.status, notes: l.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!activeOrg || !user) return;
    setSaving(true);
    const d = parsed.data;
    const payload = {
      name: d.name,
      status: d.status,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      source: d.source || null,
      notes: d.notes || null,
    };
    const res = editing
      ? await supabase.from("leads").update(payload).eq("id", editing.id)
      : await supabase.from("leads").insert({ ...payload, organization_id: activeOrg.organization_id, created_by: user.id });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Lead updated" : "Lead created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this lead?")) return;
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Lead deleted");
    load();
  };

  const convertToCustomer = async (l: Lead) => {
    if (!activeOrg) return;
    const { error: cErr } = await supabase.from("customers").insert({
      organization_id: activeOrg.organization_id,
      name: l.name, email: l.email, phone: l.phone, address: l.address,
    });
    if (cErr) return toast.error(cErr.message);
    await supabase.from("leads").update({ status: "won" }).eq("id", l.id);
    toast.success("Converted to customer");
    load();
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Track prospects from first contact to signed estimate."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit lead" : "New lead"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                  <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
                </div>
                <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Source"><Input placeholder="Referral, web…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></Field>
                  <Field label="Status">
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Notes"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No leads yet" description="Add your first lead to start tracking prospects."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New lead</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {l.email ?? "—"}{l.phone ? ` · ${l.phone}` : ""}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{l.source ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Lead actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(l)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => convertToCustomer(l)}>
                          <UserCheck className="h-4 w-4" /> Convert to customer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(l.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
