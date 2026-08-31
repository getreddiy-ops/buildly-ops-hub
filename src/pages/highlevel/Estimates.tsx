import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  FileText,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { AiFormHelper } from "@/components/AiFormHelper";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  highLevel,
  type HighLevelContact,
  type HighLevelEstimate,
  type HighLevelEstimateStatus,
} from "@/integrations/highlevel/client";
import { estimateKnowledgeRules, estimateKnowledgeTemplates } from "@/lib/estimateKnowledge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type LineItem = {
  description: string;
  quantity: number;
  unit_price: number;
};

type EstimateAiValues = {
  title: string;
  customer_name: string;
  tax_percent: number;
  notes: string;
  line_items: LineItem[] | string;
};

type EstimateFilter = HighLevelEstimateStatus | "all" | "waiting" | "accepted_group";

const statuses: Array<HighLevelEstimateStatus | "all"> = ["all", "draft", "sent", "viewed", "accepted", "declined", "invoiced"];
const emptyItem: LineItem = { description: "", quantity: 1, unit_price: 0 };

const headerSchema = z.object({
  title: z.string().trim().min(1, "Estimate title is required").max(200),
  customer_id: z.string().trim().min(1, "Select a customer"),
  tax_percent: z.number().min(0).max(100),
  notes: z.string().trim().max(5000),
});

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function estimateId(estimate: HighLevelEstimate) {
  return estimate._id;
}

function taxPercent(estimate: HighLevelEstimate) {
  const raw = estimate.meta?.taxPercent;
  return typeof raw === "number" ? raw : Number(raw) || 0;
}

function customerLabel(customer: HighLevelContact) {
  return customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || customer.phone || "Customer";
}

function normalizeAiItems(value: EstimateAiValues["line_items"] | undefined): LineItem[] | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(parsed)) return null;

  const items = parsed
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      description: String(item.description ?? "").trim(),
      quantity: Math.max(0, Number(item.quantity) || 0),
      unit_price: Math.max(0, Number(item.unit_price) || 0),
    }))
    .filter((item) => item.description);
  return items.length ? items : null;
}

export default function HighLevelEstimates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const routedPrompt = searchParams.get("prompt") ?? "";
  const routedCustomerId = searchParams.get("customerId") ?? "";
  const routeHandled = useRef(false);

  const [rows, setRows] = useState<HighLevelEstimate[]>([]);
  const [customers, setCustomers] = useState<HighLevelContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EstimateFilter>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HighLevelEstimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [tax, setTax] = useState(0);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...emptyItem }]);

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
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load estimates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0),
    [items],
  );
  const taxAmount = subtotal * (Number(tax) || 0) / 100;
  const total = subtotal + taxAmount;

  const summary = useMemo(() => ({
    drafts: rows.filter((estimate) => estimate.status === "draft").length,
    waiting: rows.filter((estimate) => ["sent", "viewed"].includes(estimate.status ?? "")).length,
    accepted: rows.filter((estimate) => ["accepted", "invoiced"].includes(estimate.status ?? "")).length,
  }), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((estimate) => {
      const statusMatches = statusFilter === "all"
        || (statusFilter === "waiting" ? ["sent", "viewed"].includes(estimate.status ?? "")
          : statusFilter === "accepted_group" ? ["accepted", "invoiced"].includes(estimate.status ?? "")
            : estimate.status === statusFilter);
      const textMatches = !needle || [
        estimate.name,
        estimate.contactDetails?.name,
        estimate.contactDetails?.email,
      ].some((value) => value?.toLowerCase().includes(needle));
      return statusMatches && textMatches;
    });
  }, [query, rows, statusFilter]);

  const resetForm = () => {
    setEditing(null);
    setTitle("");
    setCustomerId("");
    setTax(0);
    setNotes("");
    setItems([{ ...emptyItem }]);
  };

  const openNew = (requestedCustomerId = "") => {
    resetForm();
    if (requestedCustomerId) setCustomerId(requestedCustomerId);
    setOpen(true);
  };

  const openEdit = (estimate: HighLevelEstimate) => {
    setEditing(estimate);
    setTitle(estimate.name ?? "");
    setCustomerId(estimate.contactDetails?.id ?? "");
    setTax(taxPercent(estimate));
    setNotes(estimate.termsNotes ?? "");
    const estimateItems = Array.isArray(estimate.items) ? estimate.items : [];
    setItems(estimateItems.length
      ? estimateItems.map((item) => ({
          description: item.description || item.name || "",
          quantity: Number(item.qty) || 1,
          unit_price: Number(item.amount) || 0,
        }))
      : [{ ...emptyItem }]);
    setOpen(true);
  };

  useEffect(() => {
    if (routeHandled.current || loading) return;

    const editId = searchParams.get("edit");
    if (editId) {
      const estimate = rows.find((row) => estimateId(row) === editId);
      if (estimate) {
        routeHandled.current = true;
        openEdit(estimate);
        const next = new URLSearchParams(searchParams);
        next.delete("edit");
        setSearchParams(next, { replace: true });
      }
      return;
    }

    if (routedPrompt || routedCustomerId) {
      routeHandled.current = true;
      const verifiedCustomerId = customers.some((customer) => customer.id === routedCustomerId) ? routedCustomerId : "";
      if (routedCustomerId && !verifiedCustomerId) {
        toast.info("Customer needs to be selected", { description: "The requested customer was not found in this HighLevel sub-account." });
      }
      openNew(verifiedCustomerId);
    }
  }, [customers, loading, routedCustomerId, routedPrompt, rows, searchParams, setSearchParams]);

  const applyTemplate = (templateId: string) => {
    const template = estimateKnowledgeTemplates.find((item) => item.id === templateId);
    if (!template) return;
    setTitle(template.name);
    setNotes(template.notes);
    setItems(template.items.map((item) => ({ ...item })));
    toast.success(`${template.name} scope loaded`);
  };

  const applyAiValues = (values: Partial<EstimateAiValues>) => {
    if (values.title) setTitle(String(values.title));
    if (values.notes) setNotes(String(values.notes));
    if (values.tax_percent !== undefined) setTax(Math.max(0, Number(values.tax_percent) || 0));
    if (values.customer_name) {
      const target = String(values.customer_name).trim().toLowerCase();
      const match = customers.find((customer) => customerLabel(customer).toLowerCase() === target);
      if (match) setCustomerId(match.id);
      else toast.info("Customer needs to be selected", { description: `FastTract could not match “${values.customer_name}” to a customer in this sub-account.` });
    }
    const aiItems = normalizeAiItems(values.line_items);
    if (aiItems) setItems(aiItems);
  };

  const setItem = (index: number, patch: Partial<LineItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const save = async () => {
    const parsed = headerSchema.safeParse({ title, customer_id: customerId, tax_percent: Number(tax), notes });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    const validItems = items.filter((item) => item.description.trim() && Number(item.quantity) > 0);
    if (!validItems.length) {
      toast.error("Add at least one line item with a quantity");
      return;
    }
    if (validItems.some((item) => Number(item.unit_price) <= 0)) {
      const proceed = window.confirm("One or more line items have no price. Save this as a draft for later review?");
      if (!proceed) return;
    }

    setSaving(true);
    try {
      const payload = {
        title: parsed.data.title,
        customer_id: parsed.data.customer_id,
        tax_percent: parsed.data.tax_percent,
        notes: parsed.data.notes || null,
        line_items: validItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
        })),
      };
      if (editing) await highLevel.updateEstimate(estimateId(editing), payload);
      else await highLevel.createEstimate(payload);

      toast.success(editing ? "Estimate updated" : "Estimate draft created");
      setOpen(false);
      resetForm();
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save estimate");
    } finally {
      setSaving(false);
    }
  };

  const sendEstimate = async (estimate: HighLevelEstimate, channel: "sms_and_email" | "email" | "sms") => {
    const customer = estimate.contactDetails?.name || "this customer";
    if (!window.confirm(`Send “${estimate.name}” to ${customer} now?`)) return;

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

  const remove = async (estimate: HighLevelEstimate) => {
    if (!window.confirm(`Delete the estimate “${estimate.name}”?`)) return;
    try {
      await highLevel.deleteEstimate(estimateId(estimate));
      toast.success("Estimate deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete estimate");
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Estimates"
        description="Build, review, send, and track native HighLevel estimates without leaving FastTract."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/highlevel/customers"><Users className="h-4 w-4" /> Customers</Link></Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={() => openNew()}><Plus className="h-4 w-4" /> New estimate</Button></DialogTrigger>
              <DialogContent className="max-h-[92dvh] max-w-3xl overflow-hidden p-0">
                <DialogHeader className="border-b border-border px-5 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-3 pr-8">
                    <DialogTitle>{editing ? "Edit estimate" : "New estimate"}</DialogTitle>
                    <AiFormHelper<EstimateAiValues>
                      formName="estimate"
                      fields={[
                        { name: "title", description: "Short customer-facing estimate title" },
                        { name: "customer_name", description: "Exact existing customer name when provided" },
                        { name: "tax_percent", type: "number", description: "Tax percentage only when verified" },
                        { name: "notes", description: "Customer-facing scope, assumptions, exclusions, timeline, payment terms, and change-order language" },
                        { name: "line_items", type: "json", description: "Array of {description, quantity, unit_price}. Use zero for prices that are not provided or verified." },
                      ]}
                      context={{
                        customers: customers.map((customer) => ({ id: customer.id, name: customerLabel(customer) })),
                        rules: estimateKnowledgeRules,
                        instruction: "Never invent a labor rate, material price, tax rate, customer, or critical dimension. Keep project management distributed within the work phases.",
                      }}
                      onFill={applyAiValues}
                      initialPrompt={routedPrompt}
                      autoOpen={Boolean(routedPrompt) && !editing}
                      placeholder="Describe the whole job: dimensions, removal, base, reinforcement, finish, access, labor, equipment, and anything the customer expects."
                    />
                  </div>
                </DialogHeader>

                <div className="max-h-[calc(92dvh-9rem)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                  {!editing && (
                    <section className="rounded-xl border border-border bg-muted/25 p-4">
                      <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><Label className="text-xs text-muted-foreground">Start with a proven job structure</Label></div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {estimateKnowledgeTemplates.map((template) => (
                          <Button key={template.id} type="button" variant="outline" className="h-auto justify-start py-2 text-left" onClick={() => applyTemplate(template.id)}>
                            <span><span className="block text-xs font-semibold">{template.name}</span><span className="block text-[11px] font-normal text-muted-foreground">{template.trade}</span></span>
                          </Button>
                        ))}
                      </div>
                    </section>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Estimate title"><Input value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
                    <Field label="Customer">
                      <Select value={customerId} onValueChange={setCustomerId}>
                        <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                        <SelectContent>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customerLabel(customer)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Tax %"><Input className="max-w-40" type="number" min={0} max={100} step="0.01" value={tax} onChange={(event) => setTax(Number(event.target.value) || 0)} /></Field>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <Label className="text-xs text-muted-foreground">Customer-facing line items</Label>
                      <Button type="button" size="sm" variant="outline" onClick={() => setItems((current) => [...current, { ...emptyItem }])}><Plus className="h-3.5 w-3.5" /> Add line</Button>
                    </div>
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={index} className="grid gap-2 rounded-xl border border-border bg-background/30 p-3 sm:grid-cols-[minmax(0,1fr)_100px_130px_40px] sm:items-center">
                          <Input placeholder="Description" value={item.description} onChange={(event) => setItem(index, { description: event.target.value })} />
                          <div><Label className="mb-1 block text-[10px] text-muted-foreground sm:hidden">Quantity</Label><Input type="number" min={0} step="0.01" value={item.quantity} onChange={(event) => setItem(index, { quantity: Number(event.target.value) || 0 })} /></div>
                          <div><Label className="mb-1 block text-[10px] text-muted-foreground sm:hidden">Unit price</Label><Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(event) => setItem(index, { unit_price: Number(event.target.value) || 0 })} /></div>
                          <Button type="button" size="icon" variant="ghost" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove line item"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 ml-auto max-w-sm rounded-xl border border-border bg-muted/25 p-4 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{money.format(subtotal)}</span></div>
                      <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Tax ({tax || 0}%)</span><span>{money.format(taxAmount)}</span></div>
                      <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-semibold"><span>Total</span><span>{money.format(total)}</span></div>
                    </div>
                  </section>

                  <Field label="Scope, terms, and notes"><Textarea rows={9} value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
                  <p className="rounded-lg border border-border bg-background/40 p-3 text-xs leading-5 text-muted-foreground">
                    FastTract keeps the estimating experience simple. HighLevel stores the approved customer, estimate, delivery status, and customer timeline behind it.
                  </p>
                </div>

                <DialogFooter className="border-t border-border px-5 py-4 sm:px-6">
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save draft"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Summary label="Drafts" value={summary.drafts} active={statusFilter === "draft"} onClick={() => setStatusFilter("draft")} />
        <Summary label="Waiting" value={summary.waiting} active={statusFilter === "waiting"} onClick={() => setStatusFilter("waiting")} />
        <Summary label="Accepted" value={summary.accepted} active={statusFilter === "accepted_group"} onClick={() => setStatusFilter("accepted_group")} />
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search estimates or customers…" />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
          <SelectTrigger className="h-9 w-32 border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All estimates</SelectItem>
            <SelectItem value="waiting">Waiting</SelectItem>
            <SelectItem value="accepted_group">Accepted / invoiced</SelectItem>
            {statuses.filter((status) => status !== "all").map((status) => <SelectItem key={status} value={status} className="capitalize">{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-56 animate-pulse rounded-xl border border-border bg-card/40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <FileText className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">No estimates in this view</h2>
          <p className="mt-2 text-sm text-muted-foreground">Start a customer-facing estimate manually or describe the job to Ava.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Button onClick={() => openNew()}><Plus className="h-4 w-4" /> New estimate</Button>
            <Button variant="outline" asChild><Link to="/highlevel/ai?prompt=Build%20an%20estimate%20for%20"><Sparkles className="h-4 w-4" /> Ask Ava</Link></Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((estimate) => {
            const id = estimateId(estimate);
            return (
              <article key={id} className="min-w-0 rounded-xl border border-border bg-card/50 p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <StatusBadge status={estimate.status ?? "draft"} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Estimate actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(estimate)}>Review / edit</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={sendingId === id} onClick={() => void sendEstimate(estimate, "email")}><Send className="h-4 w-4" /> Send email</DropdownMenuItem>
                      <DropdownMenuItem disabled={sendingId === id} onClick={() => void sendEstimate(estimate, "sms")}><Send className="h-4 w-4" /> Send SMS</DropdownMenuItem>
                      <DropdownMenuItem disabled={sendingId === id} onClick={() => void sendEstimate(estimate, "sms_and_email")}><Send className="h-4 w-4" /> Send both</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => void remove(estimate)}>Delete estimate</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button type="button" className="mt-4 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => openEdit(estimate)}>
                  <h2 className="truncate text-lg font-semibold">{estimate.name || "Untitled estimate"}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{estimate.contactDetails?.name || estimate.contactDetails?.email || "Customer not assigned"}</p>
                </button>
                <p className="mt-6 text-3xl font-semibold tracking-tight">{money.format(Number(estimate.total) || 0)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{estimate.issueDate ? `Issued ${estimate.issueDate}` : "Draft date not available"}</p>
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="outline" onClick={() => openEdit(estimate)}>Review</Button>
                  <Button size="sm" disabled={sendingId === id} onClick={() => void sendEstimate(estimate, "sms_and_email")}>
                    <Send className="h-4 w-4" /> {sendingId === id ? "Sending…" : "Send"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Summary({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "border-primary/40 bg-primary/10" : "border-border bg-card/40 hover:bg-secondary/50",
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </button>
  );
}
