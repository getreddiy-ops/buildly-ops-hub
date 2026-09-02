import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { FileText, MoreHorizontal, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AiFormHelper } from "@/components/AiFormHelper";
import {
  highLevel,
  type HighLevelContact,
  type HighLevelEstimate,
} from "@/integrations/highlevel/client";
import { estimateKnowledgeRules, estimateKnowledgeTemplates } from "@/lib/estimateKnowledge";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

const headerSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  customer_id: z.string().trim().min(1, "Pick a customer"),
  tax: z.number().min(0).max(100),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

const fmt = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD" });

function estimateId(estimate: HighLevelEstimate) {
  return estimate._id;
}

function estimateTaxPercent(estimate: HighLevelEstimate) {
  const raw = estimate.meta?.taxPercent;
  return typeof raw === "number" ? raw : Number(raw) || 0;
}

export default function Estimates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<HighLevelEstimate[]>([]);
  const [customers, setCustomers] = useState<HighLevelContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HighLevelEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [taxPct, setTaxPct] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items],
  );
  const taxAmt = subtotal * (Number(taxPct) || 0) / 100;
  const total = subtotal + taxAmt;

  const load = async () => {
    setLoading(true);
    try {
      const [estimateResult, customerResult] = await Promise.all([
        highLevel.listEstimates({ limit: 100, status: "all" }),
        highLevel.listContacts({ limit: 100 }),
      ]);
      setRows(Array.isArray(estimateResult.estimates) ? estimateResult.estimates : []);
      setCustomers(customerResult.contacts ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load HighLevel estimates");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setTitle("");
    setCustomerId("");
    setTaxPct(0);
    setNotes("");
    setItems([{ description: "", quantity: 1, unit_price: 0 }]);
  };

  const openNew = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  const applyTemplate = (templateId: string) => {
    const template = estimateKnowledgeTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.name);
    setNotes(template.notes);
    setItems(template.items.map((item) => ({ ...item })));
    toast.success(`${template.name} starting point loaded`);
  };

  const openEdit = (estimate: HighLevelEstimate) => {
    setEditing(estimate);
    setTitle(estimate.name ?? "");
    setCustomerId(estimate.contactDetails?.id ?? "");
    setTaxPct(estimateTaxPercent(estimate));
    setNotes(estimate.termsNotes ?? "");
    const estimateItems = Array.isArray(estimate.items) ? estimate.items : [];
    setItems(
      estimateItems.length
        ? estimateItems.map((item) => ({
            description: item.description || item.name || "",
            quantity: Number(item.qty) || 1,
            unit_price: Number(item.amount) || 0,
          }))
        : [{ description: "", quantity: 1, unit_price: 0 }],
    );
    setOpen(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !rows.length) return;
    const target = rows.find((row) => estimateId(row) === editId);
    if (target) {
      openEdit(target);
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const save = async () => {
    const parsed = headerSchema.safeParse({
      title,
      customer_id: customerId,
      tax: Number(taxPct),
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const validItems = items.filter((item) => item.description.trim());
    if (!validItems.length) {
      toast.error("Add at least one line item");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: parsed.data.title,
        customer_id: parsed.data.customer_id,
        tax_percent: parsed.data.tax,
        notes: parsed.data.notes || null,
        line_items: validItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
        })),
      };

      if (editing) await highLevel.updateEstimate(estimateId(editing), payload);
      else await highLevel.createEstimate(payload);

      toast.success(editing ? "Estimate updated in HighLevel" : "Estimate created in HighLevel");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save estimate");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this estimate from HighLevel?")) return;
    try {
      await highLevel.deleteEstimate(id);
      toast.success("Estimate deleted from HighLevel");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete estimate");
    }
  };

  const send = async (estimate: HighLevelEstimate, channel: "sms_and_email" | "email" | "sms") => {
    const id = estimateId(estimate);
    setSendingId(id);
    try {
      await highLevel.sendEstimate(id, { channel, name: estimate.name });
      toast.success(channel === "sms_and_email" ? "Estimate sent by SMS and email" : `Estimate sent by ${channel}`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send estimate");
    } finally {
      setSendingId(null);
    }
  };

  const setItem = (index: number, patch: Partial<LineItem>) =>
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  return (
    <div>
      <PageHeader
        title="Estimates"
        description="Native HighLevel estimates—created, sent, viewed and accepted without leaving FastTract."
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
                      { name: "tax_percent", type: "number", description: "Tax percentage from 0 to 100" },
                      { name: "notes" },
                      { name: "line_items", description: "JSON array of {description, quantity, unit_price}" },
                    ]}
                    context={{ customers: customers.map((customer) => ({ id: customer.id, name: customer.name })) }}
                    onFill={(values: any) => {
                      if (values.title) setTitle(String(values.title));
                      if (values.notes) setNotes(String(values.notes));
                      if (values.tax_percent !== undefined) setTaxPct(Number(values.tax_percent) || 0);
                      if (values.customer_name) {
                        const match = customers.find((customer) =>
                          (customer.name ?? "").toLowerCase() === String(values.customer_name).toLowerCase(),
                        );
                        if (match) setCustomerId(match.id);
                      }
                      if (values.line_items) {
                        try {
                          const parsedItems = typeof values.line_items === "string" ? JSON.parse(values.line_items) : values.line_items;
                          if (Array.isArray(parsedItems) && parsedItems.length) {
                            setItems(parsedItems.map((item: any) => ({
                              description: String(item.description ?? ""),
                              quantity: Number(item.quantity) || 1,
                              unit_price: Number(item.unit_price) || 0,
                            })));
                          }
                        } catch { /* keep current rows */ }
                      }
                    }}
                  />
                </div>
              </DialogHeader>

              <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-1">
                {!editing && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <Label className="text-xs text-muted-foreground">Start with the closest job type</Label>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {estimateKnowledgeTemplates.map((template) => (
                        <Button
                          key={template.id}
                          type="button"
                          variant="outline"
                          className="h-auto justify-start py-2 text-left"
                          onClick={() => applyTemplate(template.id)}
                        >
                          <span>
                            <span className="block text-xs font-semibold">{template.name}</span>
                            <span className="block text-[11px] font-normal text-muted-foreground">{template.trade}</span>
                          </span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Title"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
                  <Field label="Customer">
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select HighLevel customer" /></SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>{customer.name || customer.email || customer.phone || "Customer"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field label="Tax %">
                  <Input type="number" min={0} max={100} step="0.01" value={taxPct} onChange={(event) => setTaxPct(parseFloat(event.target.value) || 0)} />
                </Field>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground">Line items</Label>
                    <Button size="sm" variant="outline" onClick={() => setItems((current) => [...current, { description: "", quantity: 1, unit_price: 0 }])}>
                      <Plus className="h-3.5 w-3.5" /> Add row
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2">
                        <Input className="col-span-6" placeholder="Description" value={item.description} onChange={(event) => setItem(index, { description: event.target.value })} />
                        <Input className="col-span-2" type="number" min={0} step="0.01" placeholder="Qty" value={item.quantity} onChange={(event) => setItem(index, { quantity: parseFloat(event.target.value) || 0 })} />
                        <Input className="col-span-3" type="number" min={0} step="0.01" placeholder="Unit price" value={item.unit_price} onChange={(event) => setItem(index, { unit_price: parseFloat(event.target.value) || 0 })} />
                        <Button className="col-span-1" size="icon" variant="ghost" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} aria-label="Remove line item">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-md bg-muted/40 p-3 text-sm">
                    <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Tax ({taxPct || 0}%)</span><span>{fmt(taxAmt)}</span></div>
                    <div className="mt-1 flex justify-between font-semibold"><span>Total</span><span>{fmt(total)}</span></div>
                  </div>
                </div>

                <Field label="Terms / notes"><Textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>

                {estimateKnowledgeRules.length > 0 && (
                  <div className="rounded-md border border-border p-3 text-xs text-muted-foreground">
                    FastTract keeps your estimating rules available to the AI while HighLevel owns the customer-facing estimate record.
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No estimates yet"
          description="Create a HighLevel estimate from FastTract and send it by email or SMS."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New estimate</Button>}
        />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estimate</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((estimate) => {
                const id = estimateId(estimate);
                return (
                  <TableRow key={id}>
                    <TableCell className="font-medium">{estimate.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{estimate.contactDetails?.name || "—"}</TableCell>
                    <TableCell><StatusBadge status={estimate.status || "draft"} /></TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(estimate.total) || 0)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" aria-label="Estimate actions"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(estimate)}>Edit</DropdownMenuItem>
                          {!['accepted', 'declined', 'invoiced'].includes(estimate.status || '') && (
                            <>
                              <DropdownMenuItem disabled={sendingId === id} onClick={() => send(estimate, "sms_and_email")}>
                                <Send className="h-4 w-4" /> Send SMS + email
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled={sendingId === id} onClick={() => send(estimate, "email")}>Send email</DropdownMenuItem>
                              <DropdownMenuItem disabled={sendingId === id} onClick={() => send(estimate, "sms")}>Send SMS</DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(id)}>Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
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
