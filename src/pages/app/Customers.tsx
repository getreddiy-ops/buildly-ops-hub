import { useEffect, useState } from "react";
import { z } from "zod";
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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { AiFormHelper } from "@/components/AiFormHelper";
import { highLevel, type HighLevelContact } from "@/integrations/highlevel/client";

type Customer = HighLevelContact;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

const empty = { name: "", email: "", phone: "", address: "", notes: "" };

export default function Customers() {
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await highLevel.listContacts({ limit: 100 });
      setRows(result.contacts ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load customers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = async (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      address: c.address1 ?? "",
      notes: "",
    });
    setOpen(true);

    try {
      const detail = await highLevel.getContact(c.id);
      setForm({
        name: detail.contact.name ?? c.name ?? "",
        email: detail.contact.email ?? c.email ?? "",
        phone: detail.contact.phone ?? c.phone ?? "",
        address: detail.contact.address1 ?? c.address1 ?? "",
        notes: "",
      });
    } catch {
      // The list record is enough to edit core contact details if notes fail to load.
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
        email: d.email || null,
        phone: d.phone || null,
        address: d.address || null,
        notes: d.notes || null,
      };

      if (editing) await highLevel.updateContact(editing.id, payload);
      else await highLevel.upsertContact(payload);

      toast.success(editing ? "Customer updated in HighLevel" : "Customer created in HighLevel");
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save customer");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this customer from HighLevel?")) return;
    try {
      await highLevel.deleteContact(id);
      toast.success("Customer deleted from HighLevel");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete customer");
    }
  };

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Your HighLevel customer contacts."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4" /> New customer</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
                  <AiFormHelper
                    formName="customer"
                    fields={[
                      { name: "name", description: "Full name of the customer" },
                      { name: "email", type: "email" },
                      { name: "phone", type: "phone" },
                      { name: "address", description: "Street address" },
                      { name: "notes", description: "Anything else noteworthy" },
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
                <Field label={editing ? "Add note" : "Notes"}><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={editing ? "Add a new HighLevel contact note…" : undefined} /></Field>
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
        <EmptyState icon={Users} title="No customers yet" description="Add a customer manually, or convert a won lead."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New customer</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name || "Unnamed contact"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm truncate max-w-[280px]">{c.address1 ?? "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Customer actions"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(c)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => remove(c.id)}>Delete</DropdownMenuItem>
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
