import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  FileText,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { AiFormHelper } from "@/components/AiFormHelper";
import { PageHeader } from "@/components/PageHeader";
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
import { Textarea } from "@/components/ui/textarea";
import { highLevel, type HighLevelContact } from "@/integrations/highlevel/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type CustomerForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

const empty: CustomerForm = { name: "", email: "", phone: "", address: "", notes: "" };

const schema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  notes: z.string().trim().max(2000),
});

function customerName(customer: HighLevelContact) {
  return customer.name || [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Unnamed customer";
}

export default function HighLevelCustomers() {
  const [rows, setRows] = useState<HighLevelContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HighLevelContact | null>(null);
  const [form, setForm] = useState<CustomerForm>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await highLevel.listContacts({ limit: 100 });
      setRows(result.contacts ?? []);
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((customer) => [
      customerName(customer),
      customer.email,
      customer.phone,
      customer.address1,
    ].some((value) => value?.toLowerCase().includes(needle)));
  }, [query, rows]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = async (customer: HighLevelContact) => {
    setEditing(customer);
    setForm({
      name: customerName(customer),
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address1 ?? "",
      notes: "",
    });
    setOpen(true);

    try {
      const detail = await highLevel.getContact(customer.id);
      setForm((current) => ({
        ...current,
        name: customerName(detail.contact),
        email: detail.contact.email ?? "",
        phone: detail.contact.phone ?? "",
        address: detail.contact.address1 ?? "",
      }));
    } catch {
      // The list data is enough for editing even if notes are temporarily unavailable.
    }
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: parsed.data.name,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      };
      if (editing) await highLevel.updateContact(editing.id, payload);
      else await highLevel.upsertContact(payload);

      toast.success(editing ? "Customer updated" : "Customer created");
      setOpen(false);
      setForm(empty);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (customer: HighLevelContact) => {
    if (!window.confirm(`Remove ${customerName(customer)} from the FastTract customer list? Their HighLevel contact and conversation history will be preserved.`)) return;
    try {
      await highLevel.deleteContact(customer.id);
      toast.success("Customer removed from FastTract");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove customer");
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Customers"
        description="The people connected to your FastTract jobs, estimates, and follow-up."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> New customer</Button></DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
                    <AiFormHelper<CustomerForm>
                      formName="customer"
                      fields={[
                        { name: "name", description: "Customer full name" },
                        { name: "email", type: "email" },
                        { name: "phone", type: "phone" },
                        { name: "address", description: "Customer or job-site address" },
                        { name: "notes", description: "What the customer called about and important details" },
                      ]}
                      onFill={(values) => setForm((current) => ({ ...current, ...values }))}
                      placeholder="e.g. Sarah Lee, 503-555-0142, sarah@example.com, 12 Oak St, wants a stamped patio estimate"
                    />
                  </div>
                </DialogHeader>
                <div className="grid gap-4">
                  <Field label="Name"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
                    <Field label="Phone"><Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></Field>
                  </div>
                  <Field label="Address"><Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field>
                  <Field label={editing ? "Add a note" : "Notes"}>
                    <Textarea
                      rows={4}
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      placeholder={editing ? "This adds a new note to the HighLevel contact timeline." : undefined}
                    />
                  </Field>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save customer"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0"
          placeholder="Search customers…"
          aria-label="Search customers"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-48 animate-pulse rounded-xl border border-border bg-card/40" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <Users className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">{query ? "No matching customers" : "No customers yet"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {query ? "Try another name, phone number, email, or address." : "Create the first customer or convert a won lead."}
          </p>
          {!query && <Button className="mt-5" onClick={openNew}><Plus className="h-4 w-4" /> New customer</Button>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((customer) => (
            <article key={customer.id} className="min-w-0 rounded-xl border border-border bg-card/50 p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {customerName(customer).charAt(0).toUpperCase()}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Customer actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void openEdit(customer)}>Edit customer</DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={`/highlevel/estimates?customerId=${encodeURIComponent(customer.id)}`}><FileText className="h-4 w-4" /> New estimate</Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => void remove(customer)}>Remove from FastTract</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <h2 className="mt-4 truncate text-lg font-semibold">{customerName(customer)}</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {customer.phone && <a className="flex items-center gap-2 hover:text-foreground" href={`tel:${customer.phone}`}><Phone className="h-4 w-4 shrink-0" /><span className="truncate">{customer.phone}</span></a>}
                {customer.email && <a className="flex items-center gap-2 hover:text-foreground" href={`mailto:${customer.email}`}><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{customer.email}</span></a>}
                {customer.address1 && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{customer.address1}</span></p>}
                {!customer.phone && !customer.email && !customer.address1 && <p>No contact details added yet.</p>}
              </div>
              <div className="mt-5 flex gap-2 border-t border-border pt-4">
                <Button size="sm" variant="outline" onClick={() => void openEdit(customer)}>Open</Button>
                <Button size="sm" asChild><Link to={`/highlevel/estimates?customerId=${encodeURIComponent(customer.id)}`}><FileText className="h-4 w-4" /> Estimate</Link></Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
