import { useEffect, useState } from "react";
import { z } from "zod";
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
import { AiFormHelper } from "@/components/AiFormHelper";
import {
  highLevel,
  type FastTractLead,
  type FastTractLeadStatus,
} from "@/integrations/highlevel/client";

type Lead = FastTractLead;
type LeadStatus = FastTractLeadStatus;

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
  const [rows, setRows] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await highLevel.listLeads({ limit: 100 });
      setRows(result.leads ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = async (l: Lead) => {
    setEditing(l);
    setForm({
      name: l.name ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      address: l.address ?? "",
      source: l.source ?? "",
      status: l.status,
      notes: l.notes ?? "",
    });
    setOpen(true);

    try {
      const result = await highLevel.getLead(l.id);
      const detail = result.lead;
      setEditing(detail);
      setForm({
        name: detail.name ?? "",
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        source: detail.source ?? "",
        status: detail.status,
        notes: detail.notes ?? "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load lead details");
    }
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSaving(true);

    try {
      const d = parsed.data;
      const payload = {
        name: d.name,
        status: d.status,
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        source: d.source || null,
        notes: d.notes || null,
        noteId: editing?.note_id || null,
      };

      if (editing) await highLevel.updateLead(editing.id, payload);
      else await highLevel.createLead(payload);

      toast.success(editing ? "Lead updated in HighLevel" : "Lead created in HighLevel");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save lead");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this opportunity from the FastTract HighLevel pipeline?")) return;
    try {
      await highLevel.deleteLead(id);
      toast.success("Lead removed from the FastTract pipeline");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete lead");
    }
  };

  const convertToCustomer = async (l: Lead) => {
    try {
      await highLevel.convertLead(l.id);
      toast.success("Converted to customer in HighLevel");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to convert lead");
    }
  };

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Your FastTract HighLevel sales pipeline."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>{editing ? "Edit lead" : "New lead"}</DialogTitle>
                  <AiFormHelper
                    formName="lead"
                    fields={[
                      { name: "name", description: "Prospect name" },
                      { name: "email", type: "email" },
                      { name: "phone", type: "phone" },
                      { name: "address" },
                      { name: "source", description: "Where the lead came from (referral, web, call)" },
                      { name: "status", enum: STATUSES as unknown as string[] },
                      { name: "notes" },
                    ]}
                    onFill={(v) => setForm((f) => ({ ...f, ...v } as typeof f))}
                  />
                </div>
              </DialogHeader>
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
        <EmptyState icon={Users} title="No leads yet" description="Add your first lead to start the HighLevel pipeline."
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
                        {l.status !== "won" && (
                          <DropdownMenuItem onClick={() => convertToCustomer(l)}>
                            <UserCheck className="h-4 w-4" /> Convert to customer
                          </DropdownMenuItem>
                        )}
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
