import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import {
  ArrowRight,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
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
  type FastTractLead,
  type FastTractLeadStatus,
} from "@/integrations/highlevel/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  source: string;
  status: FastTractLeadStatus;
  notes: string;
};

const statuses: FastTractLeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];
const empty: LeadForm = { name: "", email: "", phone: "", address: "", source: "", status: "new", notes: "" };

const schema = z.object({
  name: z.string().trim().min(1, "Lead name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
  source: z.string().trim().max(80),
  status: z.enum(["new", "contacted", "qualified", "won", "lost"]),
  notes: z.string().trim().max(2000),
});

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function HighLevelLeads() {
  const [rows, setRows] = useState<FastTractLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FastTractLeadStatus | "open" | "all">("open");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FastTractLead | null>(null);
  const [form, setForm] = useState<LeadForm>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await highLevel.listLeads({ limit: 100 });
      setRows(result.leads ?? []);
    } catch (error) {
      setRows([]);
      toast.error(error instanceof Error ? error.message : "Unable to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const counts = useMemo(() => ({
    open: rows.filter((lead) => !["won", "lost"].includes(lead.status)).length,
    new: rows.filter((lead) => lead.status === "new").length,
    qualified: rows.filter((lead) => lead.status === "qualified").length,
    won: rows.filter((lead) => lead.status === "won").length,
  }), [rows]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((lead) => {
      const statusMatches = filter === "all"
        || (filter === "open" ? !["won", "lost"].includes(lead.status) : lead.status === filter);
      const textMatches = !needle || [lead.name, lead.email, lead.phone, lead.address, lead.source]
        .some((value) => value?.toLowerCase().includes(needle));
      return statusMatches && textMatches;
    });
  }, [filter, query, rows]);

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  };

  const openEdit = async (lead: FastTractLead) => {
    setEditing(lead);
    setForm({
      name: lead.name,
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      address: lead.address ?? "",
      source: lead.source ?? "",
      status: lead.status,
      notes: lead.notes ?? "",
    });
    setOpen(true);

    try {
      const result = await highLevel.getLead(lead.id);
      const detail = result.lead;
      setEditing(detail);
      setForm({
        name: detail.name,
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
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...parsed.data,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        source: parsed.data.source || null,
        notes: parsed.data.notes || null,
        noteId: editing?.note_id || null,
      };
      if (editing) await highLevel.updateLead(editing.id, payload);
      else await highLevel.createLead(payload);

      toast.success(editing ? "Lead updated" : "Lead created");
      setOpen(false);
      setForm(empty);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save lead");
    } finally {
      setSaving(false);
    }
  };

  const convert = async (lead: FastTractLead) => {
    try {
      await highLevel.convertLead(lead.id);
      toast.success(`${lead.name} is now a customer`);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to convert lead");
    }
  };

  const remove = async (lead: FastTractLead) => {
    if (!window.confirm(`Remove ${lead.name} from the FastTract sales pipeline?`)) return;
    try {
      await highLevel.deleteLead(lead.id);
      toast.success("Lead removed");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove lead");
    }
  };

  return (
    <div className="min-w-0 px-4 py-7 sm:px-7 lg:px-9">
      <PageHeader
        title="Leads"
        description="New inquiries, callbacks, site visits, and opportunities moving toward a signed job."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild><Link to="/highlevel/customers"><Users className="h-4 w-4" /> Customers</Link></Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4" /> New lead</Button></DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <div className="flex items-center justify-between gap-3">
                    <DialogTitle>{editing ? "Edit lead" : "New lead"}</DialogTitle>
                    <AiFormHelper<LeadForm>
                      formName="lead"
                      fields={[
                        { name: "name", description: "Prospect full name" },
                        { name: "email", type: "email" },
                        { name: "phone", type: "phone" },
                        { name: "address", description: "Customer or job-site address" },
                        { name: "source", description: "Referral, website, call, social, or other source" },
                        { name: "status", enum: statuses },
                        { name: "notes", description: "Requested work and follow-up details" },
                      ]}
                      onFill={(values) => setForm((current) => ({ ...current, ...values }))}
                      placeholder="e.g. Mike Jones called about replacing a driveway at 12 Oak St, referral from Brandon, needs a site visit"
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
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Source"><Input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Referral, web, call…" /></Field>
                    <Field label="Status">
                      <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as FastTractLeadStatus })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{statuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Notes"><Textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save lead"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Summary label="Open" value={counts.open} active={filter === "open"} onClick={() => setFilter("open")} />
        <Summary label="New" value={counts.new} active={filter === "new"} onClick={() => setFilter("new")} />
        <Summary label="Qualified" value={counts.qualified} active={filter === "qualified"} onClick={() => setFilter("qualified")} />
        <Summary label="Won" value={counts.won} active={filter === "won"} onClick={() => setFilter("won")} />
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-border bg-card/40 px-3">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder="Search leads…" />
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className="h-9 w-32 border-0 bg-transparent shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leads</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            {statuses.map((status) => <SelectItem key={status} value={status}>{titleCase(status)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="h-60 animate-pulse rounded-xl border border-border bg-card/40" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/30 p-8 text-center">
          <Users className="mx-auto h-9 w-9 text-primary" />
          <h2 className="mt-4 text-lg font-semibold">No leads in this view</h2>
          <p className="mt-2 text-sm text-muted-foreground">Add a new inquiry or change the search and status filter.</p>
          <Button className="mt-5" onClick={openNew}><Plus className="h-4 w-4" /> New lead</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((lead) => (
            <article key={lead.id} className="min-w-0 rounded-xl border border-border bg-card/50 p-5 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <StatusBadge status={lead.status} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Lead actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void openEdit(lead)}>Edit lead</DropdownMenuItem>
                    {lead.status !== "won" && <DropdownMenuItem onClick={() => void convert(lead)}><UserCheck className="h-4 w-4" /> Convert to customer</DropdownMenuItem>}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => void remove(lead)}>Remove lead</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <button type="button" className="mt-4 block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" onClick={() => void openEdit(lead)}>
                <h2 className="truncate text-lg font-semibold">{lead.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{lead.source || "Source not recorded"}</p>
              </button>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                {lead.phone && <a className="flex items-center gap-2 hover:text-foreground" href={`tel:${lead.phone}`}><Phone className="h-4 w-4 shrink-0" /><span className="truncate">{lead.phone}</span></a>}
                {lead.email && <a className="flex items-center gap-2 hover:text-foreground" href={`mailto:${lead.email}`}><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{lead.email}</span></a>}
                {lead.address && <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span>{lead.address}</span></p>}
              </div>
              {lead.notes && <p className="mt-4 line-clamp-3 border-t border-border pt-4 text-sm leading-6 text-muted-foreground">{lead.notes}</p>}
              <div className="mt-5 flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" onClick={() => void openEdit(lead)}>Open</Button>
                {lead.status !== "won" ? (
                  <Button size="sm" onClick={() => void convert(lead)}>Convert <ArrowRight className="h-4 w-4" /></Button>
                ) : (
                  <Button size="sm" asChild><Link to="/highlevel/customers">Open customers <ArrowRight className="h-4 w-4" /></Link></Button>
                )}
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
