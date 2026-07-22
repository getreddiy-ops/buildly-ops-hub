import { useEffect, useState } from "react";
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
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
import { FileSignature, MoreHorizontal, Plus, Eye, Printer } from "lucide-react";
import { toast } from "sonner";
import { QuickCreateCustomerButton } from "@/components/QuickCreateCustomerButton";

const STATUSES = ["draft", "sent", "signed", "void"] as const;
type ContractStatus = (typeof STATUSES)[number];

const DEFAULT_BODY = `This Service Agreement ("Agreement") is entered into by and between {{company}} ("Contractor") and {{customer}} ("Client").

1. SCOPE OF WORK
Contractor agrees to perform the work described in the attached scope and estimate.

2. PAYMENT
Client agrees to pay the total price set out in the estimate, on the schedule agreed in writing.

3. WARRANTY
Any workmanship warranty must be stated in writing and is subject to applicable state and local law.

4. SIGNATURES
By signing below, both parties agree to the terms of this Agreement.`;

export default function Contracts() {
  const { activeOrg, user } = useAuth();
  const { branding } = useBranding();
  const [rows, setRows] = useState<any[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; address: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [previewing, setPreviewing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [body, setBody] = useState("");
  const [signedName, setSignedName] = useState("");

  const load = async () => {
    if (!activeOrg) return;
    setLoading(true);
    const [{ data: cs, error }, { data: custs }] = await Promise.all([
      supabase.from("contracts").select("*, customers(name,address)").eq("organization_id", activeOrg.organization_id).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,address").eq("organization_id", activeOrg.organization_id).order("name"),
    ]);
    if (error) toast.error(error.message);
    setRows(cs ?? []);
    setCustomers(custs ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [activeOrg?.organization_id]);

  const openNew = () => {
    setEditing(null);
    setTitle(""); setCustomerId(""); setStatus("draft"); setSignedName("");
    const intro = branding?.document_defaults?.contract?.header;
    setBody(intro ? intro + "\n\n" + DEFAULT_BODY : DEFAULT_BODY);
    setOpen(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setTitle(c.title); setCustomerId(c.customer_id ?? "");
    setStatus(c.status); setBody(c.body ?? "");
    setSignedName(c.signed_name ?? "");
    setOpen(true);
  };

  const save = async () => {
    if (!activeOrg || !user) return;
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    const payload = {
      title: title.trim(),
      customer_id: customerId || null,
      status,
      body: body || null,
      signed_name: signedName || null,
      signed_at: status === "signed" && !editing?.signed_at ? new Date().toISOString() : editing?.signed_at ?? null,
      sent_at: status !== "draft" && !editing?.sent_at ? new Date().toISOString() : editing?.sent_at ?? null,
    };
    if (editing) {
      const { error } = await supabase.from("contracts").update(payload).eq("id", editing.id);
      if (error) { setSaving(false); return toast.error(error.message); }
    } else {
      const { error } = await supabase.from("contracts")
        .insert({ ...payload, organization_id: activeOrg.organization_id, created_by: user.id });
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success(editing ? "Contract updated" : "Contract created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contract?")) return;
    const { error } = await supabase.from("contracts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Contract deleted");
    load();
  };

  const renderBody = (raw: string, customerName?: string) =>
    (raw ?? "")
      .split("{{company}}").join(branding?.name ?? "Company")
      .split("{{customer}}").join(customerName ?? "Customer");


  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Branded service agreements. Use {{company}} and {{customer}} as merge fields."
        actions={<Button onClick={openNew}><Plus className="h-4 w-4" /> New contract</Button>}
      />

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileSignature} title="No contracts yet" description="Draft your first branded contract."
          action={<Button onClick={openNew}><Plus className="h-4 w-4" /> New contract</Button>} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Signed</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.customers?.name ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell className="text-sm">{c.signed_at ? new Date(c.signed_at).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPreviewing(c)}><Eye className="mr-2 h-4 w-4" /> Preview</DropdownMenuItem>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit contract" : "New contract"}</DialogTitle></DialogHeader>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Customer">
                <div className="flex gap-2">
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
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
              <Field label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as ContractStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Body">
              <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-xs" />
            </Field>
            {status === "signed" && (
              <Field label="Signed by (typed name)">
                <Input value={signedName} onChange={(e) => setSignedName(e.target.value)} />
              </Field>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Contract preview</span>
              <Button size="sm" variant="outline" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="max-h-[75vh] overflow-y-auto">
              <DocumentPreview
                branding={branding}
                type="contract"
                documentNumber={previewing.title}
                customerName={previewing.customers?.name}
                customerAddress={previewing.customers?.address}
                issueDate={new Date(previewing.created_at).toLocaleDateString()}
                body={renderBody(previewing.body ?? "", previewing.customers?.name)}
                template={{
                  header: undefined,
                  footer: branding?.document_defaults?.contract?.footer,
                  notes: previewing.signed_name
                    ? `Signed by ${previewing.signed_name} on ${new Date(previewing.signed_at).toLocaleDateString()}`
                    : branding?.document_defaults?.contract?.notes,
                  terms: branding?.document_defaults?.contract?.terms,
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
