import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
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
import { MoreHorizontal, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { AiFormHelper } from "@/components/AiFormHelper";
import type { Database } from "@/integrations/supabase/types";

type Material = Database["public"]["Tables"]["materials"]["Row"];
type Vendor = Database["public"]["Tables"]["vendors"]["Row"];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  sku: z.string().trim().max(80).optional().or(z.literal("")),
  category: z.string().trim().max(80).optional().or(z.literal("")),
  unit: z.string().trim().min(1, "Unit required").max(20),
  unit_cost: z.coerce.number().min(0, "Cost must be 0 or more"),
  vendor_id: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const empty = { name: "", sku: "", category: "", unit: "ea", unit_cost: "0", vendor_id: "", notes: "" };

export default function Materials() {
  const { activeOrg } = useAuth();
  const [rows, setRows] = useState<Material[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [m, v] = await Promise.all([
      supabase.from("materials").select("*").eq("organization_id", activeOrg.organization_id).order("name"),
      supabase.from("vendors").select("*").eq("organization_id", activeOrg.organization_id).order("name"),
    ]);
    if (m.error) toast.error(m.error.message);
    if (v.error) toast.error(v.error.message);
    setRows(m.data ?? []);
    setVendors(v.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      name: m.name ?? "",
      sku: m.sku ?? "",
      category: m.category ?? "",
      unit: m.unit ?? "ea",
      unit_cost: String(m.unit_cost ?? 0),
      vendor_id: m.vendor_id ?? "",
      notes: m.notes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (!activeOrg) return;
    setSaving(true);
    const d = parsed.data;
    const payload = {
      name: d.name,
      sku: d.sku || null,
      category: d.category || null,
      unit: d.unit,
      unit_cost: d.unit_cost,
      vendor_id: d.vendor_id || null,
      notes: d.notes || null,
    };
    const res = editing
      ? await supabase.from("materials").update(payload).eq("id", editing.id)
      : await supabase.from("materials").insert({ ...payload, organization_id: activeOrg.organization_id });
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(editing ? "Material updated" : "Material created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    const { error } = await supabase.from("materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Material deleted");
    load();
  };

  const vendorName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Reusable catalog of materials with unit cost and vendor."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New material</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? "Edit material" : "New material"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
                  <Field label="Category"><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Lumber, Plumbing…" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Unit"><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ea, ft, sq ft, gal…" /></Field>
                  <Field label="Unit cost ($)"><Input type="number" step="0.01" min="0" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></Field>
                </div>
                <Field label="Vendor">
                  <Select value={form.vendor_id || "none"} onValueChange={(val) => setForm({ ...form, vendor_id: val === "none" ? "" : val })}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
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
        <EmptyState icon={Package} title="No materials yet" description="Add materials you frequently use on jobs."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New material</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.sku ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.category ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.unit}</TableCell>
                  <TableCell className="text-right">${Number(m.unit_cost).toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{vendorName(m.vendor_id)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(m)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(m.id)}>Delete</DropdownMenuItem>
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
