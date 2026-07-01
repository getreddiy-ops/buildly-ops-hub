import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Mail, Gift, XCircle, Pin, PinOff, Trash2, Save, UserMinus, Crown, RefreshCw, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Org = {
  id: string; name: string; plan: string; created_at: string;
  address: string | null; phone: string | null; email: string | null;
  website: string | null; trade: string | null; state: string | null;
  city: string | null; zip: string | null; owner_id: string | null;
};
type Member = { user_id: string; role: string; profile: { full_name: string | null; email: string | null } | null };
type Subscription = {
  id: string; status: string; price_id: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; environment: string; user_id: string;
};
type Note = { id: string; body: string; pinned: boolean; created_at: string; author_id: string };
type Invoice = { id: string; invoice_number: string | null; total: number; status: string; paid_at: string | null; created_at: string };
type Snapshot = {
  counts: Record<string, number>;
  recent_invoices: Invoice[];
  revenue_paid_recent: number;
};
type Transaction = { id: string; status: string; created_at: string; details?: { totals?: { grand_total?: string; currency_code?: string } } };

const ROLES = ["owner", "admin", "manager", "worker", "agent"] as const;

export default function AdminOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [orgDraft, setOrgDraft] = useState<Partial<Org>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [txEnv, setTxEnv] = useState<"live" | "sandbox">("live");
  const [noteBody, setNoteBody] = useState("");
  const [trialDays, setTrialDays] = useState(7);
  const [compTier, setCompTier] = useState<"base" | "plus" | "premium">("premium");
  const [compDays, setCompDays] = useState<string>("");
  const [compEnv, setCompEnv] = useState<"live" | "sandbox">("live");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const callAdmin = async (action: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", { body: action });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    } finally { setBusy(false); }
  };

  const load = async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const { data: o, error: oe } = await supabase.from("organizations")
        .select("id, name, plan, created_at, address, phone, email, website, trade, state, city, zip, owner_id")
        .eq("id", id).maybeSingle();
      if (oe) throw oe;
      setOrg(o as Org | null);
      setOrgDraft(o ?? {});
    } catch (e) {
      console.error(e); setLoadError((e as Error).message); return;
    }

    try {
      const { data: m, error: me } = await supabase.from("organization_members")
        .select("user_id, role").eq("organization_id", id);
      if (me) throw me;
      const ids = (m ?? []).map((r: any) => r.user_id);
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setMembers(((m ?? []) as any[]).map((r) => ({ ...r, profile: pmap.get(r.user_id) ?? null })));
    } catch (e) { console.error(e); }

    try {
      const { data: s } = await supabase.from("subscriptions")
        .select("id, status, price_id, current_period_end, cancel_at_period_end, environment, user_id")
        .eq("organization_id", id).order("created_at", { ascending: false });
      setSubs((s ?? []) as Subscription[]);
    } catch (e) { console.error(e); }

    try {
      const { data: n } = await supabase.from("support_notes")
        .select("id, body, pinned, created_at, author_id")
        .eq("organization_id", id).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      setNotes((n ?? []) as Note[]);
    } catch (e) { console.error(e); }

    try {
      const snap = await callAdmin({ type: "org_snapshot", organization_id: id });
      setSnapshot({ counts: snap.counts, recent_invoices: snap.recent_invoices, revenue_paid_recent: snap.revenue_paid_recent });
    } catch (e) { console.error(e); }
  };

  const loadTransactions = async () => {
    try {
      const r = await callAdmin({ type: "list_transactions", organization_id: id, environment: txEnv });
      setTxs(r.transactions ?? []);
    } catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveOrg = async () => {
    try {
      await callAdmin({ type: "update_organization", organization_id: id, patch: orgDraft });
      toast.success("Organization updated");
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const changeRole = async (uid: string, role: string) => {
    try { await callAdmin({ type: "change_member_role", organization_id: id, user_id: uid, role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const removeMember = async (uid: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    try { await callAdmin({ type: "remove_member", organization_id: id, user_id: uid }); toast.success("Removed"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const transferOwnership = async (uid: string) => {
    if (!confirm("Transfer ownership to this member? Current owner will become admin.")) return;
    try { await callAdmin({ type: "transfer_ownership", organization_id: id, new_owner_user_id: uid }); toast.success("Ownership transferred"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const sendReset = async (email: string | null) => {
    if (!email) return toast.error("No email on profile");
    try { await callAdmin({ type: "send_password_reset", email }); toast.success(`Reset email sent to ${email}`); }
    catch (e) { toast.error((e as Error).message); }
  };

  const compTrial = async (sid: string) => {
    try { const r = await callAdmin({ type: "comp_trial", subscription_id: sid, days: trialDays });
      toast.success(`Extended to ${new Date(r.current_period_end).toLocaleDateString()}`); load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const cancelSub = async (sid: string, atEnd: boolean) => {
    if (!confirm(atEnd ? "Cancel at period end?" : "Cancel immediately?")) return;
    try { await callAdmin({ type: "cancel_subscription", subscription_id: sid, at_period_end: atEnd }); toast.success("Cancelled"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const markPaid = async (iid: string) => {
    try { await callAdmin({ type: "mark_invoice_paid", invoice_id: iid }); toast.success("Marked paid"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const voidInv = async (iid: string) => {
    if (!confirm("Void this invoice?")) return;
    try { await callAdmin({ type: "void_invoice", invoice_id: iid }); toast.success("Voided"); load(); }
    catch (e) { toast.error((e as Error).message); }
  };

  const refundTx = async (txId: string) => {
    const reason = prompt("Refund reason?", "Admin refund") ?? "Admin refund";
    if (!confirm("Issue a full refund for this transaction?")) return;
    try { await callAdmin({ type: "refund_transaction", transaction_id: txId, environment: txEnv, reason });
      toast.success("Refund submitted"); loadTransactions();
    } catch (e) { toast.error((e as Error).message); }
  };

  const addNote = async () => {
    if (!noteBody.trim() || !id || !user) return;
    const { error } = await supabase.from("support_notes")
      .insert({ organization_id: id, author_id: user.id, body: noteBody.trim() });
    if (error) return toast.error(error.message);
    setNoteBody(""); load();
  };

  const togglePin = async (n: Note) => { await supabase.from("support_notes").update({ pinned: !n.pinned }).eq("id", n.id); load(); };
  const deleteNote = async (n: Note) => { if (!confirm("Delete?")) return; await supabase.from("support_notes").delete().eq("id", n.id); load(); };

  const deleteOrg = async () => {
    const confirmName = prompt(`Type the organization name to permanently delete:\n\n${org?.name}`);
    if (confirmName !== org?.name) return;
    try { await callAdmin({ type: "delete_organization", organization_id: id }); toast.success("Organization deleted"); window.location.href = "/admin/organizations"; }
    catch (e) { toast.error((e as Error).message); }
  };

  if (loadError) return (
    <div className="space-y-3">
      <Link to="/admin/organizations" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-3 w-3" /> All organizations
      </Link>
      <Card className="p-4 border-destructive/40">
        <div className="font-semibold text-destructive">Could not load organization</div>
        <div className="text-sm text-muted-foreground mt-1">{loadError}</div>
      </Card>
    </div>
  );
  if (!org) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <>
      <Link to="/admin/organizations" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
        <ArrowLeft className="h-3 w-3" /> All organizations
      </Link>
      <PageHeader
        title={org.name}
        description={`Joined ${new Date(org.created_at).toLocaleDateString()} · plan: ${org.plan}`}
      />

      {/* Business snapshot */}
      {snapshot && (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-3">Business snapshot</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
            {Object.entries(snapshot.counts).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-2">
                <div className="text-lg font-bold">{v}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.replace("_", " ")}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Revenue paid (last 25 invoices): <span className="font-semibold text-foreground">${snapshot.revenue_paid_recent.toFixed(2)}</span>
          </div>
        </Card>
      )}

      {/* Editable org profile */}
      <Card className="p-4 mb-6">
        <h3 className="font-semibold mb-3">Company profile</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["name","email","phone","website","trade","address","city","state","zip"] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs capitalize">{k}</Label>
              <Input value={(orgDraft as any)[k] ?? ""} onChange={(e) => setOrgDraft({ ...orgDraft, [k]: e.target.value })} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={saveOrg} disabled={busy}><Save className="h-3 w-3 mr-1" /> Save profile</Button>
          <Button variant="destructive" onClick={deleteOrg} disabled={busy}>
            <Trash2 className="h-3 w-3 mr-1" /> Delete organization
          </Button>
        </div>
      </Card>

      {/* Plan / comp */}
      <Card className="p-4 mb-6 border-primary/30">
        <h3 className="font-semibold mb-1">Plan assignment (comp / free)</h3>
        <p className="text-xs text-muted-foreground mb-3">Grants an internal subscription that bypasses Paddle. Blank days = free forever.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div><Label className="text-xs">Tier</Label>
            <select value={compTier} onChange={(e) => setCompTier(e.target.value as any)}
              className="block w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="base">Base — $69</option>
              <option value="plus">Plus — $169</option>
              <option value="premium">Premium — $269</option>
            </select>
          </div>
          <div><Label className="text-xs">Days (blank = ∞)</Label>
            <Input type="number" min={1} max={3650} value={compDays} onChange={(e) => setCompDays(e.target.value)} className="w-full sm:w-32 h-10" placeholder="∞" />
          </div>
          <div><Label className="text-xs">Environment</Label>
            <select value={compEnv} onChange={(e) => setCompEnv(e.target.value as any)}
              className="block w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="live">live</option><option value="sandbox">test</option>
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button className="flex-1 lg:flex-initial h-10" disabled={busy} onClick={async () => {
              try {
                const days = compDays.trim() === "" ? null : Number(compDays);
                await callAdmin({ type: "set_plan", organization_id: id, tier: compTier, days, environment: compEnv });
                toast.success(`Set to ${compTier} in ${compEnv}`); load();
              } catch (e) { toast.error((e as Error).message); }
            }}>Assign plan</Button>
            <Button variant="outline" className="flex-1 lg:flex-initial h-10" disabled={busy} onClick={async () => {
              if (!confirm("Remove comp?")) return;
              try { await callAdmin({ type: "remove_comp", organization_id: id, environment: compEnv }); toast.success("Removed"); load(); }
              catch (e) { toast.error((e as Error).message); }
            }}>Remove comp</Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Members */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Members ({members.length})</h3>
          {members.length === 0 ? <p className="text-sm text-muted-foreground">No members.</p> : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium break-words">
                      {m.profile?.full_name || m.profile?.email || m.user_id}
                      {org.owner_id === m.user_id && <Badge className="ml-2" variant="outline">owner</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground break-all">{m.profile?.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm">
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Button size="sm" variant="outline" className="h-9" disabled={busy || !m.profile?.email} onClick={() => sendReset(m.profile?.email ?? null)} title="Send password reset">
                      <Mail className="h-3 w-3" />
                    </Button>
                    {org.owner_id !== m.user_id && (
                      <>
                        <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => transferOwnership(m.user_id)} title="Make owner">
                          <Crown className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => removeMember(m.user_id)} title="Remove">
                          <UserMinus className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Subscriptions */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Subscriptions ({subs.length})</h3>
          {subs.length === 0 ? <p className="text-sm text-muted-foreground">No subscription on file.</p> : (
            <ul className="space-y-4">
              {subs.map((s) => (
                <li key={s.id} className="border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-all">{s.price_id ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.environment} · {s.current_period_end ? `ends ${new Date(s.current_period_end).toLocaleDateString()}` : "no end"}
                        {s.cancel_at_period_end && " · cancels at period end"}
                      </div>
                    </div>
                    <Badge variant={s.status === "active" || s.status === "trialing" ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input type="number" min={1} max={365} value={trialDays} onChange={(e) => setTrialDays(Number(e.target.value))} className="w-20 h-9" />
                    <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => compTrial(s.id)}><Gift className="h-3 w-3 mr-1" /> Comp days</Button>
                    <Button size="sm" variant="outline" className="h-9" disabled={busy} onClick={() => cancelSub(s.id, true)}>Cancel at period end</Button>
                    <Button size="sm" variant="destructive" className="h-9" disabled={busy} onClick={() => cancelSub(s.id, false)}><XCircle className="h-3 w-3 mr-1" /> Cancel now</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Customer invoices */}
      {snapshot && snapshot.recent_invoices.length > 0 && (
        <Card className="p-4 mt-6">
          <h3 className="font-semibold mb-3">Recent customer invoices ({snapshot.recent_invoices.length})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-2">#</th><th className="py-2 pr-2">Total</th>
                  <th className="py-2 pr-2">Status</th><th className="py-2 pr-2">Created</th><th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recent_invoices.map((i) => (
                  <tr key={i.id} className="border-b border-border/50">
                    <td className="py-2 pr-2 font-mono text-xs">{i.invoice_number ?? i.id.slice(0, 8)}</td>
                    <td className="py-2 pr-2">${Number(i.total).toFixed(2)}</td>
                    <td className="py-2 pr-2"><Badge variant={i.status === "paid" ? "default" : "secondary"}>{i.status}</Badge></td>
                    <td className="py-2 pr-2 text-muted-foreground">{new Date(i.created_at).toLocaleDateString()}</td>
                    <td className="py-2 flex gap-1 justify-end">
                      {i.status !== "paid" && <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => markPaid(i.id)}>Mark paid</Button>}
                      {i.status !== "void" && <Button size="sm" variant="ghost" className="h-8" disabled={busy} onClick={() => voidInv(i.id)}>Void</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Paddle transactions */}
      <Card className="p-4 mt-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h3 className="font-semibold">Paddle transactions</h3>
          <div className="flex items-center gap-2">
            <select value={txEnv} onChange={(e) => setTxEnv(e.target.value as any)} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
              <option value="live">live</option><option value="sandbox">test</option>
            </select>
            <Button size="sm" variant="outline" onClick={loadTransactions} disabled={busy}><RefreshCw className="h-3 w-3 mr-1" /> Load</Button>
          </div>
        </div>
        {txs.length === 0 ? <p className="text-sm text-muted-foreground">No transactions loaded. Click "Load" to fetch from Paddle.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="text-left border-b border-border">
                  <th className="py-2 pr-2">ID</th><th className="py-2 pr-2">Total</th>
                  <th className="py-2 pr-2">Status</th><th className="py-2 pr-2">Date</th><th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => {
                  const total = t.details?.totals?.grand_total ? (Number(t.details.totals.grand_total) / 100).toFixed(2) : "—";
                  const cur = t.details?.totals?.currency_code ?? "";
                  return (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="py-2 pr-2 font-mono text-xs break-all">{t.id}</td>
                      <td className="py-2 pr-2">{total} {cur}</td>
                      <td className="py-2 pr-2"><Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge></td>
                      <td className="py-2 pr-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                      <td className="py-2 text-right">
                        {t.status === "completed" && (
                          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => refundTx(t.id)}>
                            <DollarSign className="h-3 w-3 mr-1" /> Refund
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Notes */}
      <Card className="p-4 mt-6">
        <h3 className="font-semibold mb-3">Internal support notes</h3>
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Note (platform admins only)…" rows={2} className="flex-1" />
          <Button onClick={addNote} disabled={!noteBody.trim()}>Add</Button>
        </div>
        {notes.length === 0 ? <p className="text-sm text-muted-foreground">No notes yet.</p> : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className={`p-3 rounded-md border ${n.pinned ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">{n.body}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => togglePin(n)}>{n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}</Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteNote(n)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
