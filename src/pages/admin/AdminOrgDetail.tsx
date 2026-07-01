import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Mail, Gift, XCircle, Pin, PinOff, Trash2 } from "lucide-react";
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

type Org = { id: string; name: string; plan: string; created_at: string; address: string | null };
type Member = { user_id: string; role: string; profile: { full_name: string | null; email: string | null } | null };
type Subscription = {
  id: string; status: string; price_id: string | null; current_period_end: string | null;
  cancel_at_period_end: boolean; environment: string; user_id: string;
};
type Note = { id: string; body: string; pinned: boolean; created_at: string; author_id: string };

export default function AdminOrgDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteBody, setNoteBody] = useState("");
  const [trialDays, setTrialDays] = useState(7);
  const [compTier, setCompTier] = useState<"base" | "plus" | "premium">("premium");
  const [compDays, setCompDays] = useState<string>(""); // blank = forever/free
  const [compEnv, setCompEnv] = useState<"live" | "sandbox">("live");
  const [busy, setBusy] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const { data: o, error: oe } = await supabase.from("organizations")
        .select("id, name, plan, created_at, address").eq("id", id).maybeSingle();
      if (oe) throw oe;
      setOrg(o as Org | null);
    } catch (e) {
      console.error("[AdminOrgDetail] org load failed", e);
      setLoadError((e as Error).message || "Failed to load organization");
      return;
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
    } catch (e) { console.error("[AdminOrgDetail] members load failed", e); }

    try {
      const { data: s, error: se } = await supabase.from("subscriptions")
        .select("id, status, price_id, current_period_end, cancel_at_period_end, environment, user_id")
        .eq("organization_id", id).order("created_at", { ascending: false });
      if (se) throw se;
      setSubs((s ?? []) as Subscription[]);
    } catch (e) { console.error("[AdminOrgDetail] subs load failed", e); }

    try {
      const { data: n, error: ne } = await supabase.from("support_notes")
        .select("id, body, pinned, created_at, author_id")
        .eq("organization_id", id).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (ne) throw ne;
      setNotes((n ?? []) as Note[]);
    } catch (e) { console.error("[AdminOrgDetail] notes load failed", e); }
  };

  useEffect(() => { load(); }, [id]);

  const callAdmin = async (action: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-support", { body: action });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    } finally { setBusy(false); }
  };

  const sendReset = async (email: string | null) => {
    if (!email) return toast.error("No email on profile");
    try {
      await callAdmin({ type: "send_password_reset", email });
      toast.success(`Password reset email sent to ${email}`);
    } catch (e) { toast.error((e as Error).message); }
  };

  const compTrial = async (subscription_id: string) => {
    try {
      const r = await callAdmin({ type: "comp_trial", subscription_id, days: trialDays });
      toast.success(`Trial extended to ${new Date(r.current_period_end).toLocaleDateString()}`);
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const cancelSub = async (subscription_id: string, at_period_end: boolean) => {
    if (!confirm(at_period_end ? "Cancel at period end?" : "Cancel immediately?")) return;
    try {
      await callAdmin({ type: "cancel_subscription", subscription_id, at_period_end });
      toast.success("Subscription cancelled");
      load();
    } catch (e) { toast.error((e as Error).message); }
  };

  const addNote = async () => {
    if (!noteBody.trim() || !id || !user) return;
    const { error } = await supabase.from("support_notes")
      .insert({ organization_id: id, author_id: user.id, body: noteBody.trim() });
    if (error) return toast.error(error.message);
    setNoteBody(""); load();
  };

  const togglePin = async (n: Note) => {
    await supabase.from("support_notes").update({ pinned: !n.pinned }).eq("id", n.id);
    load();
  };

  const deleteNote = async (n: Note) => {
    if (!confirm("Delete note?")) return;
    await supabase.from("support_notes").delete().eq("id", n.id);
    load();
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
      <PageHeader title={org.name} description={`Joined ${new Date(org.created_at).toLocaleDateString()} · ${org.address ?? "no address"} · plan: ${org.plan}`} />

      <Card className="p-4 mb-6 border-primary/30">
        <h3 className="font-semibold mb-1">Plan assignment (comp / free)</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Grants this org an internal subscription that bypasses Paddle. Leave "Days" blank to make it free indefinitely.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
          <div className="min-w-0">
            <Label className="text-xs">Tier</Label>
            <select value={compTier} onChange={(e) => setCompTier(e.target.value as any)}
              className="block w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="base">Base — $69</option>
              <option value="plus">Plus — $169 (AI Assistant)</option>
              <option value="premium">Premium — $269 (Phone Assistant)</option>
            </select>
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Days (blank = free forever)</Label>
            <Input type="number" min={1} max={3650} value={compDays}
              onChange={(e) => setCompDays(e.target.value)} className="w-full sm:w-32 h-10" placeholder="∞" />
          </div>
          <div className="min-w-0">
            <Label className="text-xs">Environment</Label>
            <select value={compEnv} onChange={(e) => setCompEnv(e.target.value as any)}
              className="block w-full h-10 rounded-md border border-input bg-background px-2 text-sm">
              <option value="live">live</option>
              <option value="sandbox">test</option>
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button className="flex-1 lg:flex-initial h-10" disabled={busy} onClick={async () => {
              try {
                const days = compDays.trim() === "" ? null : Number(compDays);
                await callAdmin({ type: "set_plan", organization_id: id, tier: compTier, days, environment: compEnv });
                toast.success(`Set to ${compTier} (${days ?? "forever"} days) in ${compEnv}`);
                load();
              } catch (e) { toast.error((e as Error).message); }
            }}>Assign plan</Button>
            <Button variant="outline" className="flex-1 lg:flex-initial h-10" disabled={busy} onClick={async () => {
              if (!confirm("Remove the comped subscription for this org?")) return;
              try {
                await callAdmin({ type: "remove_comp", organization_id: id, environment: compEnv });
                toast.success("Comp removed");
                load();
              } catch (e) { toast.error((e as Error).message); }
            }}>Remove comp</Button>
          </div>
        </div>
      </Card>


      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Members ({members.length})</h3>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.user_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium break-words">{m.profile?.full_name || m.profile?.email || m.user_id}</div>
                    <div className="text-xs text-muted-foreground break-all">{m.profile?.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{m.role}</Badge>
                    <Button size="sm" variant="outline" className="h-10" disabled={busy || !m.profile?.email}
                      onClick={() => sendReset(m.profile?.email ?? null)}>
                      <Mail className="h-3 w-3 mr-1" /> Reset
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Subscriptions ({subs.length})</h3>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscription on file.</p>
          ) : (
            <ul className="space-y-4">
              {subs.map((s) => (
                <li key={s.id} className="border border-border rounded-md p-3">
                  <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium break-all">{s.price_id ?? "—"}</div>
                      <div className="text-xs text-muted-foreground break-words">
                        {s.environment} · {s.current_period_end ? `ends ${new Date(s.current_period_end).toLocaleDateString()}` : "no end"}
                        {s.cancel_at_period_end && " · cancels at period end"}
                      </div>
                    </div>
                    <Badge className="shrink-0" variant={s.status === "active" || s.status === "trialing" ? "default" : "secondary"}>{s.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input type="number" min={1} max={365} value={trialDays}
                      onChange={(e) => setTrialDays(Number(e.target.value))} className="w-20 h-10" />
                    <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={() => compTrial(s.id)}>
                      <Gift className="h-3 w-3 mr-1" /> Comp days
                    </Button>
                    <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={() => cancelSub(s.id, true)}>
                      Cancel at period end
                    </Button>
                    <Button size="sm" variant="destructive" className="h-10" disabled={busy} onClick={() => cancelSub(s.id, false)}>
                      <XCircle className="h-3 w-3 mr-1" /> Cancel now
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-4 mt-6">
        <h3 className="font-semibold mb-3">Internal support notes</h3>
        <div className="flex gap-2 mb-4">
          <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Note about this customer (visible to platform admins only)…" rows={2} />
          <Button onClick={addNote} disabled={!noteBody.trim()}>Add</Button>
        </div>
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className={`p-3 rounded-md border ${n.pinned ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">{n.body}</p>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => togglePin(n)} title={n.pinned ? "Unpin" : "Pin"}>
                      {n.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteNote(n)} title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </Button>
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
