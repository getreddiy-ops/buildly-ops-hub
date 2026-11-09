import { InvoiceLineEditor, blankInvoiceLine, type InvoiceLine, type SavedInvoiceItem } from "@/components/InvoiceLineEditor";
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
import { Receipt, MoreHorizontal, Plus, Eye, Printer, Send } from "lucide-react";
import { toast } from "sonner";
import { SendDocumentDialog } from "@/components/SendDocumentDialog";
import { QuickCreateCustomerButton } from "@/components/QuickCreateCustomerButton";
import { toLocalDateInputValue } from "@/lib/local-date";

type LineItem = InvoiceLine;
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
  const [sending, setSendingDoc] = useState<any | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [number, setNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<InvStatus>("draft");
  const [issueDate, setIssueDate] = useState(() => toLocalDateInputValue());
  const [dueDate, setDueDate] = useState("");
  const [taxPct, setTaxPct] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [items, setItems] = useState<LineItem[]>([blankInvoiceLine()]);

  const [catalog, setCatalog] = useState<SavedInvoiceItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setCatalog([]);
    if (!activeOrg) return;
    setCatalogLoading(true);
    supabase.from("invoice_item_catalog").select("*").eq("organization_id", activeOrg.organization_id).order("category").order("description").then(({ data, error }) => {
      if (cancelled) return;
      setCatalogLoading(false);
      if (error) toast.error("Could not load saved invoice items: " + error.message);
      else setCatalog(data ?? []);
    });
    return () => { cancelled = true; };
  }, [activeOrg?.organization_id]);

  const saveCatalogItem = async (item: LineItem) => {
    if (!activeOrg || savingItem) return;
    if (!item.description.trim() || !item.category.trim() || !item.unit.trim()) return toast.error("Enter a description, category and unit before saving an item");
    if (![item.quantity, item.unit_price].every(n => Number.isFinite(n) && n >= 0)) return toast.error("Quantity and price must be valid, nonnegative numbers");
    setSavingItem(true);
    const { data, error } = await supabase.from("invoice_item_catalog").upsert({
      organization_id: activeOrg.organization_id, description: item.description.trim(), category: item.category.trim(), unit: item.unit.trim(), quantity: item.quantity, unit_price: item.unit_price,
    }, { onConflict: "organization_id,category,description,unit" }).select("*").single();
    setSavingItem(false);
    if (error) return toast.error("Could not save item: " + error.message);
    setCatalog(current => [...current.filter(entry => entry.id !== data.id), data].sort((a, b) => a.category.localeCompare(b.category) || a.description.localeCompare(b.description)));
    toast.success("Item saved to your company library");
  };

  const subtotal = useMemo(
    () => items.filter(i => i.description.trim()).reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0),
    [items],
  );
  const taxAmt = subtotal * (Number(taxPct) || 0) / 100;
  const total = subtotal + taxAmt;

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: invs, error }, { data: custs }] = await Promise.all([
      supabase.from("org_invoices").select("*, customers(name,address,email,phone)").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
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
    setIssueDate(toLocalDateInputValue());
    setDueDate(""); setTaxPct(0); setNotes(""); setTerms("");
    setItems([blankInvoiceLine()]);
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
    const { data: li, error } = await supabase.from("org_invoice_line_items").select("*").eq("invoice_id", inv.id).order("position");
    if (error) return toast.error("Could not load invoice items: " + error.message);
    setItems((li ?? []).map((r) => ({
      id: r.id, description: r.description ?? "", category: r.category ?? "Other", unit: r.unit ?? "ea",
      quantity: Number(r.quantity), unit_price: Number(r.unit_price),
    })));
    setOpen(true);
  };

  const save = async () => {
    if (!activeOrg || !user) return;
    if (!customerId) return toast.error("Pick a customer");
    const valid = items.filter((i) => i.description.trim());
    if (valid.length === 0) return toast.error("Add at least one line item");
    if (valid.some(i => ![i.quantity, i.unit_price].every(n => Number.isFinite(n) && n >= 0)) || !Number.isFinite(taxPct) || taxPct < 0) return toast.error("Quantities, prices and tax must be valid, nonnegative numbers");
    setSaving(true);
    const header = {
      number: number || null, customer_id: customerId, status,
      issue_date: issueDate, due_date: dueDate || null,
      subtotal, tax_rate: taxPct, tax_amount: taxAmt, total,
      notes: notes || null, terms: terms || null,
    };
    let invoiceId: string;
    if (editing) {
      const { error } = await supabase.from("org_invoices").update(header).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
      invoiceId = editing.id;
      const { error: deleteError } = await supabase.from("org_invoice_line_items").delete().eq("invoice_id", invoiceId);
      if (deleteError) { setSaving(false); return toast.error(deleteError.message); }
    } else {
      const { data, error } = await supabase.from("org_invoices")
        .insert({ ...header, organization_id: activeOrg.organization_id, created_by: user.id })
        .select("id").single();
      if (error || !data) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
      invoiceId = data.id;
    }
    const payload = valid.map((i, idx) => ({
      invoice_id: invoiceId,
      description: i.description.trim(),
      category: i.category.trim() || "Other", unit: i.unit.trim() || "ea",
      quantity: Number(i.quantity) || 0,
      unit_price: Number(i.unit_price) || 0,
      total: (Number(i.quantity) || 0) * (Number(i.unit_price) || 0),
      position: idx,
    }));
    const { error: liErr } = await supabase.from("org_invoice_line_items").insert(payload);
    setSaving(false);
    if (liErr) return toast.error(liErr.message);
    toast.success(editing ? "Invoice updated" : "Invoice created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("org_invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invoice deleted");
    load();
  };

  const openPreview = async (inv: any) => {
    const { data: li } = await supabase.from("org_invoice_line_items").select("*").eq("invoice_id", inv.id).order("position");
    setPreviewing({ ...inv, line_items: li ?? [] });
  };


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
                        <DropdownMenuItem onClick={() => setSendingDoc(inv)}><Send className="mr-2 h-4 w-4" /> Send</DropdownMenuItem>
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
        <DialogContent className="flex h-[94dvh] w-[96vw] max-w-[1500px] flex-col gap-3 p-4 sm:p-6">
          <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          <div className="grid min-h-0 flex-1 grid-rows-[minmax(160px,32%)_1fr] gap-4 lg:grid-cols-[minmax(380px,0.9fr)_minmax(0,1.1fr)] lg:grid-rows-1">
          <div className="order-2 min-h-0 overflow-y-auto pr-2 lg:order-1">
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Invoice number"><Input aria-label="Invoice number" value={number} onChange={(e) => setNumber(e.target.value)} /></Field>
              <Field label="Customer">
                <div className="flex gap-2">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger aria-label="Customer" className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>
                      {customers.length === 0
                        ? <div className="px-2 py-1.5 text-sm text-muted-foreground">No customers yet</div>
                        : customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <QuickCreateCustomerButton
                    label="New"
                    onCreated={async (c) => { await load(); setCustomerId(c.id); }}
                  />
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as InvStatus)}>
                  <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Issue date"><Input aria-label="Issue date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></Field>
              <Field label="Due date"><Input aria-label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
            </div>

            <InvoiceLineEditor items={items} onChange={setItems} catalog={catalog} onSaveItem={saveCatalogItem} savingItem={savingItem} catalogLoading={catalogLoading} />
 <div className="grid grid-cols-3 gap-3">
              <Field label="Tax %">
                <Input aria-label="Tax percent" type="number" min={0} step="0.01" value={taxPct}
                  onChange={(e) => setTaxPct(parseFloat(e.target.value) || 0)} />
              </Field>
              <div data-wizard-label="Totals" className="col-span-2 ml-auto w-full max-w-xs space-y-1 text-sm">
                <Row label="Subtotal" value={fmt(subtotal)} />
                <Row label={`Tax (${taxPct || 0}%)`} value={fmt(taxAmt)} />
                <div className="border-t border-border pt-1"><Row label="Total" value={fmt(total)} bold /></div>
              </div>
            </div>

            <Field label="Notes"><Textarea aria-label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
            <Field label="Terms"><Textarea aria-label="Terms" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
          </div>

          </div>
          <section aria-label="Live invoice preview" className="order-1 min-h-0 overflow-auto rounded-lg border bg-muted/40 p-2 lg:order-2 lg:p-4">
            <p className="mb-2 text-sm font-medium">Live invoice preview</p>
            <DocumentPreview branding={branding} type="invoice" documentNumber={number}
              customerName={customers.find(c => c.id === customerId)?.name}
              customerAddress={customers.find(c => c.id === customerId)?.address ?? undefined}
              issueDate={issueDate} dueDate={dueDate || undefined}
              lineItems={items.filter(item => item.description.trim()).map(item => ({ ...item, total: item.quantity * item.unit_price }))}
              subtotal={subtotal} taxRate={taxPct} taxAmount={taxAmt} total={total}
              template={{ ...branding?.document_defaults?.invoice, notes, terms }} />
          </section>
          </div>
          <DialogFooter className="border-t pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save invoice"}</Button>
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
                  description: li.description, category: li.category, unit: li.unit,
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

      <SendDocumentDialog
        open={!!sending}
        onOpenChange={(o) => !o && setSendingDoc(null)}
        docType="invoice"
        docId={sending?.id ?? ""}
        defaultEmail={sending?.customers?.email}
        defaultPhone={sending?.customers?.phone}
        customerName={sending?.customers?.name}
        onSent={() => { setSendingDoc(null); load(); }}
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
