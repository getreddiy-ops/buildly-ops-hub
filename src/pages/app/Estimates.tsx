import { useEffect, useMemo, useState } from "react";
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
import { FileText, MoreHorizontal, Plus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { AiFormHelper } from "@/components/AiFormHelper";
import { SendDocumentDialog } from "@/components/SendDocumentDialog";
import { QuickCreateCustomerButton } from "@/components/QuickCreateCustomerButton";
import type { Database } from "@/integrations/supabase/types";

type Estimate = Database["public"]["Tables"]["estimates"]["Row"];
type EstStatus = Database["public"]["Enums"]["estimate_status"];
type Customer = Database["public"]["Tables"]["customers"]["Row"];
type LineItem = {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
};

const STATUSES: EstStatus[] = ["draft", "sent", "approved", "rejected"];

const headerSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  customer_id: z.string().uuid("Pick a customer"),
  status: z.enum(["draft", "sent", "approved", "rejected"]),
  tax: z.number().min(0).max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function Estimates() {
  const { activeOrg, user } = useAuth();
  const [rows, setRows] = useState<(Estimate & { customers?: { name: string } | null })[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<any | null>(null);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<EstStatus>("draft");
  const [taxPct, setTaxPct] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [items],
  );
  const taxAmt = subtotal * (Number(taxPct) || 0) / 100;
  const total = subtotal + taxAmt;

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: ests, error }, { data: custs }] = await Promise.all([
      supabase.from("estimates").select("*, customers(name,email,phone)").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("organization_id", activeOrg.organization_id).order("name"),
    ]);
    if (error) toast.error(error.message);
    setRows((ests ?? []) as any);
    setCustomers(custs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const resetForm = () => {
    setTitle(""); setCustomerId(""); setStatus("draft"); setTaxPct(0); setNotes("");
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
  };
  const openNew = () => { setEditing(null); resetForm(); setOpen(true); };

  const openEdit = async (e: Estimate) => {
    setEditing(e);
    setTitle(e.title); setCustomerId(e.customer_id ?? ""); setStatus(e.status);
    const sub = Number(e.subtotal) || 0;
    setTaxPct(sub > 0 ? Math.round((Number(e.tax) / sub) * 10000) / 100 : 0);
    setNotes(e.notes ?? "");
    const { data: li } = await supabase
      .from("estimate_line_items").select("*").eq("estimate_id", e.id).order("position");
    setItems((li ?? []).map((r) => ({
      id: r.id, description: r.description ?? "",
      quantity: Number(r.quantity), unit_price: Number(r.unit_price),
    })));
    setOpen(true);
  };

  const save = async () => {
    const parsed = headerSchema.safeParse({ title, customer_id: customerId, status, tax: Number(taxPct), notes });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const valid = items.filter((i) => i.description.trim());
    if (valid.length === 0) { toast.error("Add at least one line item"); return; }
    if (!activeOrg || !user) return;
    setSaving(true);

    const header = {
      title: parsed.data.title,
      customer_id: parsed.data.customer_id,
      status: parsed.data.status,
      subtotal, tax: taxAmt, total,
      notes: parsed.data.notes || null,
    };

    let estimateId: string;
    if (editing) {
      const { error } = await supabase.from("estimates").update(header).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      estimateId = editing.id;
      await supabase.from("estimate_line_items").delete().eq("estimate_id", estimateId);
    } else {
      const { data, error } = await supabase.from("estimates")
        .insert({ ...header, organization_id: activeOrg.organization_id, created_by: user.id })
        .select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      estimateId = data.id;
    }

    const liPayload = valid.map((i, idx) => ({
      estimate_id: estimateId,
      description: i.description,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      total: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      position: idx,
    }));
    const { error: liErr } = await supabase.from("estimate_line_items").insert(liPayload);
    setSaving(false);
    if (liErr) return toast.error(liErr.message);

    toast.success(editing ? "Estimate updated" : "Estimate created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this estimate?")) return;
    const { error } = await supabase.from("estimates").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estimate deleted");
    load();
  };

  const setItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div>
      <PageHeader
        title="Estimates"
        description="Drafts, sent, approved, rejected."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New estimate</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>{editing ? "Edit estimate" : "New estimate"}</DialogTitle>
                  <AiFormHelper
                    formName="estimate"
                    fields={[
                      { name: "title", description: "Short estimate title" },
                      { name: "customer_name", description: "Match an existing customer by name" },
                      { name: "tax_percent", type: "number", description: "Tax percentage (0-100)" },
                      { name: "notes" },
                      { name: "line_items", description: "JSON array of {description, quantity, unit_price} for each item" },
                    ]}
                    context={{ customers: customers.map((c) => ({ id: c.id, name: c.name })) }}
                    onFill={(v: any) => {
                      if (v.title) setTitle(String(v.title));
                      if (v.notes) setNotes(String(v.notes));
                      if (v.tax_percent !== undefined) setTaxPct(Number(v.tax_percent) || 0);
                      if (v.customer_name) {
                        const m = customers.find(
                          (c) => c.name.toLowerCase() === String(v.customer_name).toLowerCase(),
                        );
                        if (m) setCustomerId(m.id);
                      }
                      if (v.line_items) {
                        try {
                          const arr = typeof v.line_items === "string" ? JSON.parse(v.line_items) : v.line_items;
                          if (Array.isArray(arr) && arr.length) {
                            setItems(
                              arr.map((it: any) => ({
                                description: String(it.description ?? ""),
                                quantity: Number(it.quantity) || 1,
                                unit_price: Number(it.unit_price) || 0,
                              })),
                            );
                          }
                        } catch { /* ignore */ }
                      }
                    }}
                  />
                </div>
              </DialogHeader>
              <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
                  <Field label="Customer">
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.length === 0
                          ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No customers yet</div>
                          : customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status">
                    <Select value={status} onValueChange={(v) => setStatus(v as EstStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Tax %">
                    <Input type="number" min={0} step="0.01" value={taxPct}
                      onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)} />
                  </Field>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Line items</Label>
                    <Button size="sm" variant="outline"
                      onClick={() => setItems((s) => [...s, { description: "", quantity: 1, unit_price: 0 }])}>
                      <Plus className="h-3.5 w-3.5" /> Add row
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((it, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-6" placeholder="Description"
                          value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                        <Input className="col-span-2" type="number" min={0} step="0.01" placeholder="Qty"
                          value={it.quantity} onChange={(e) => setItem(idx, { quantity: parseFloat(e.target.value) || 0 })} />
                        <Input className="col-span-3" type="number" min={0} step="0.01" placeholder="Unit price"
                          value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                        <Button className="col-span-1" size="icon" variant="ghost"
                          onClick={() => setItems((s) => s.filter((_, i) => i !== idx))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="ml-auto w-64 space-y-1 text-sm">
                  <Row label="Subtotal" value={fmt(subtotal)} />
                  <Row label={`Tax (${taxPct || 0}%)`} value={fmt(taxAmt)} />
                  <div className="border-t border-border pt-1"><Row label="Total" value={fmt(total)} bold /></div>
                </div>

                <Field label="Notes"><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
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
        <EmptyState icon={FileText} title="No estimates yet" description="Build your first estimate to send to a customer."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New estimate</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{e.customers?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Number(e.total))}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Estimate actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSending(e)}><Send className="mr-2 h-4 w-4" /> Send</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(e)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(e.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SendDocumentDialog
        open={!!sending}
        onOpenChange={(o) => !o && setSending(null)}
        docType="estimate"
        docId={sending?.id ?? ""}
        defaultEmail={sending?.customers?.email}
        defaultPhone={sending?.customers?.phone}
        customerName={sending?.customers?.name}
        onSent={() => { setSending(null); load(); }}
      />
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

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span><span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
