import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/hooks/useBranding";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { DocumentPreview } from "@/components/DocumentPreview";
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
import { Receipt, MoreHorizontal, Plus, Trash2, Eye, Printer } from "lucide-react";
import { toast } from "sonner";

type LineItem = { id?: string; description: string; quantity: number; unit_price: number };
const STATUSES = ["draft", "sent", "paid", "overdue", "void"] as const;
type InvStatus = (typeof STATUSES)[number];

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function Invoices() {
  const { activeOrg, user } = useAuth();
  const { branding } = useBranding();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [number, setNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<InvStatus>("draft");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
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
    const [{ data: invs, error }, { data: custs }] = await Promise.all([
      supabase.from("invoices").select("*, customers(name,address)").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,address").eq("organization_id", activeOrg.organization_id).order("name"),
    ]);
    if (error) toast.error(error.message);
    setRows(invs ?? []);
    setCustomers(custs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const resetForm = () => {
    setNumber(""); setCustomerId(""); setStatus("draft");
    setIssueDate(new Date().toISOString().slice(0, 10));
    setDueDate(""); setTaxPct(0); setNotes(""); setTerms("");
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
  };
  const openNew = () => {
    setEditing(null);
    resetForm();
    // prefill terms/notes from branding defaults
    const tpl = branding?.document_defaults?.invoice;
    if (tpl?.terms) setTerms(tpl.terms);
    if (tpl?.notes) setNotes(tpl.notes);
    setNumber(`INV-${Date.now().toString().slice(-6)}`);
    setOpen(true);
  };

  const openEdit = async (inv: any) => {
    setEditing(inv);
    setNumber(inv.number ?? "");
    setCustomerId(inv.customer_id ?? "");
    setStatus(inv.status);
    setIssueDate(inv.issue_date);
    setDueDate(inv.due_date ?? "");
    setTaxPct(Number(inv.tax_rate) || 0);
    setNotes(inv.notes ?? "");
    setTerms(inv.terms ?? "");
    const { data: li } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("position");
    setItems((li ?? []).map((r) => ({
      id: r.id, description: r.description ?? "",
      quantity: Number(r.quantity), unit_price: Number(r.unit_price),
    })));
    setOpen(true);
  };

  const save = async () => {
    if (!activeOrg || !user) return;
    if (!customerId) return toast.error("Pick a customer");
    const valid = items.filter((i) => i.description.trim());
    if (valid.length === 0) return toast.error("Add at least one line item");
    setSaving(true);
    const header = {
      number: number || null, customer_id: customerId, status,
      issue_date: issueDate, due_date: dueDate || null,
      subtotal, tax_rate: taxPct, tax_amount: taxAmt, total,
      notes: notes || null, terms: terms || null,
    };
    let invoiceId: string;
    if (editing) {
      const { error } = await supabase.from("invoices").update(header).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      invoiceId = editing.id;
      await supabase.from("invoice_line_items").delete().eq("invoice_id", invoiceId);
    } else {
      const { data, error } = await supabase.from("invoices")
        .insert({ ...header, organization_id: activeOrg.organization_id, created_by: user.id })
        .select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      invoiceId = data.id;
    }
    const payload = valid.map((i, idx) => ({
      invoice_id: invoiceId,
      description: i.description,
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      total: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      position: idx,
    }));
    const { error: liErr } = await supabase.from("invoice_line_items").insert(payload);
    setSaving(false);
    if (liErr) return toast.error(liErr.message);
    toast.success(editing ? "Invoice updated" : "Invoice created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invoice deleted");
    load();
  };

  const openPreview = async (inv: any) => {
    const { data: li } = await supabase.from("invoice_line_items").select("*").eq("invoice_id", inv.id).order("position");
    setPreviewing({ ...inv, line_items: li ?? [] });
  };

  const setItem = (idx: number, patch: Partial<LineItem>) =>
    setItems((s) => s.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Branded invoices with your logo, colors, and terms."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> New invoice</Button>}
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title="No invoices yet" description="Create your first branded invoice."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New invoice</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.number ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.customers?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{inv.issue_date}</TableCell>
                  <TableCell className="text-sm">{inv.due_date ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={inv.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(Number(inv.total))}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openPreview(inv)}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEdit(inv)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(inv.id)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit / create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice number"><Input value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
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
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as InvStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Issue date"><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
              <Field label="Due date"><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
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

            <div className="grid grid-cols-3 gap-3">
              <Field label="Tax %">
                <Input type="number" min={0} step="0.01" value={taxPct}
                  onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)} />
              </Field>
              <div className="col-span-2 ml-auto w-full max-w-xs space-y-1 text-sm">
                <Row label="Subtotal" value={fmt(subtotal)} />
                <Row label={`Tax (${taxPct || 0}%)`} value={fmt(taxAmt)} />
                <div className="border-t border-border pt-1"><Row label="Total" value={fmt(total)} bold /></div>
              </div>
            </div>

            <Field label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <Field label="Terms"><Textarea rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branded preview */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Invoice preview</span>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="max-h-[75vh] overflow-y-auto">
              <DocumentPreview
                branding={branding}
                type="invoice"
                documentNumber={previewing.number ?? undefined}
                customerName={previewing.customers?.name}
                customerAddress={previewing.customers?.address}
                issueDate={previewing.issue_date}
                dueDate={previewing.due_date ?? undefined}
                lineItems={(previewing.line_items ?? []).map((li: any) => ({
                  description: li.description,
                  quantity: Number(li.quantity),
                  unit_price: Number(li.unit_price),
                  total: Number(li.total),
                }))}
                subtotal={Number(previewing.subtotal)}
                taxRate={Number(previewing.tax_rate)}
                taxAmount={Number(previewing.tax_amount)}
                total={Number(previewing.total)}
                template={{
                  header: branding?.document_defaults?.invoice?.header,
                  footer: branding?.document_defaults?.invoice?.footer,
                  notes: previewing.notes ?? branding?.document_defaults?.invoice?.notes,
                  terms: previewing.terms ?? branding?.document_defaults?.invoice?.terms,
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
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
