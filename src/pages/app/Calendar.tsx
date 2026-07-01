import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CalendarDays, ChevronLeft, ChevronRight, Check, X, Loader2, Plus, Info } from "lucide-react";
import { toast } from "sonner";
import { ruleForState, computeBalance, STATE_RULES } from "@/lib/pto-accrual";
import { inferUsState } from "@/lib/utils"; // will add below
import { cn } from "@/lib/utils";

type Req = {
  id: string;
  organization_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  hours: number;
  type: string;
  status: "pending" | "approved" | "denied" | "cancelled";
  note: string | null;
  reviewer_note: string | null;
  created_at: string;
};

type Member = { user_id: string; email: string | null; full_name: string | null };

const TYPE_LABEL: Record<string, string> = {
  vacation: "Vacation", sick: "Sick", personal: "Personal", unpaid: "Unpaid", holiday: "Holiday",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  denied: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export default function CalendarPage() {
  const { user, activeOrg } = useAuth();
  const orgId = activeOrg?.organization_id;
  const isAdmin = activeOrg?.role === "owner" || activeOrg?.role === "admin";

  const [requests, setRequests] = useState<Req[]>([]);
  const [members, setMembers] = useState<Record<string, Member>>({});
  const [orgAddress, setOrgAddress] = useState<string | null>(null);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [hoursWorkedYtd, setHoursWorkedYtd] = useState(0);

  const state = inferUsState(orgAddress ?? undefined).stateCode;
  const rule = ruleForState(state);

  const load = async () => {
    if (!orgId || !user) return;
    setLoading(true);
    const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const [rq, org, mems, entries] = await Promise.all([
      supabase.from("time_off_requests").select("*").eq("organization_id", orgId).order("start_date", { ascending: true }),
      supabase.from("organizations").select("address").eq("id", orgId).maybeSingle(),
      supabase.from("organization_members")
        .select("user_id, profiles:user_id(email, full_name)")
        .eq("organization_id", orgId),
      supabase.from("time_entries")
        .select("clock_in, clock_out")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .gte("clock_in", yearStart)
        .not("clock_out", "is", null),
    ]);
    setRequests(((rq.data ?? []) as Req[]));
    setOrgAddress((org.data as any)?.address ?? null);
    const map: Record<string, Member> = {};
    ((mems.data ?? []) as any[]).forEach((m) => {
      const p = m.profiles || {};
      map[m.user_id] = { user_id: m.user_id, email: p.email ?? null, full_name: p.full_name ?? null };
    });
    setMembers(map);
    const worked = ((entries.data ?? []) as any[]).reduce((s, e) => {
      const ms = new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime();
      return s + ms / 3600000;
    }, 0);
    setHoursWorkedYtd(worked);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId, user?.id]);

  const myRequests = requests.filter((r) => r.user_id === user?.id);
  const usedThisYear = myRequests
    .filter((r) => r.status === "approved" && new Date(r.start_date).getFullYear() === new Date().getFullYear() && r.type !== "unpaid")
    .reduce((s, r) => s + Number(r.hours), 0);
  const balance = computeBalance(rule, hoursWorkedYtd, usedThisYear);

  const monthDays = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor]);
  const monthLabel = monthAnchor.toLocaleString(undefined, { month: "long", year: "numeric" });

  const dayRequests = (day: Date) => {
    const dstr = day.toISOString().slice(0, 10);
    return requests.filter((r) => r.start_date <= dstr && r.end_date >= dstr && r.status !== "cancelled" && r.status !== "denied");
  };

  const memberName = (uid: string) => members[uid]?.full_name || members[uid]?.email || "Employee";

  const decide = async (r: Req, status: "approved" | "denied", note?: string) => {
    const { error } = await supabase
      .from("time_off_requests")
      .update({ status, reviewer_id: user?.id, reviewed_at: new Date().toISOString(), reviewer_note: note ?? null })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Approved" : "Denied");
    load();
  };

  const cancel = async (r: Req) => {
    const { error } = await supabase.from("time_off_requests").update({ status: "cancelled" }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Request cancelled");
    load();
  };

  const pending = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CalendarDays}
        title="Team calendar & time off"
        description={isAdmin ? "Approve requests and see who's out." : "See who's out and request time off."}
        actions={
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-1 h-4 w-4" /> Request time off</Button>
            </DialogTrigger>
            <NewRequestDialog
              orgId={orgId!}
              userId={user!.id}
              onDone={() => { setOpenNew(false); load(); }}
              availableHours={balance.availableHours}
            />
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">PTO available</div>
          <div className="mt-1 text-2xl font-semibold">{balance.availableHours} hrs</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Accrued {balance.accruedHours} · Used {balance.usedHours}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Accrual rate</div>
          <div className="mt-1 text-2xl font-semibold">
            {(rule.accrualHoursPerHourWorked * 40).toFixed(2)} hrs / 40 worked
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Cap {rule.annualCapHours} hrs/year
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium text-foreground">{state ? `${state} statute` : "Company default"}</div>
              <div className="mt-1">{rule.summary}</div>
              <div className="mt-1 opacity-70">{rule.citation}</div>
            </div>
          </div>
        </Card>
      </div>

      {isAdmin && pending.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Pending approvals ({pending.length})</h2>
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{memberName(r.user_id)}</div>
                  <div className="text-xs text-muted-foreground">
                    {TYPE_LABEL[r.type]} · {fmtRange(r.start_date, r.end_date)} · {r.hours} hrs
                  </div>
                  {r.note && <div className="mt-1 text-xs text-muted-foreground">"{r.note}"</div>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(r, "denied")}>
                    <X className="mr-1 h-4 w-4" /> Deny
                  </Button>
                  <Button size="sm" onClick={() => decide(r, "approved")}>
                    <Check className="mr-1 h-4 w-4" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-sm font-semibold">{monthLabel}</div>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setMonthAnchor(shiftMonth(monthAnchor, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setMonthAnchor(d); }}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setMonthAnchor(shiftMonth(monthAnchor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded border bg-border text-xs">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
            <div key={d} className="bg-muted p-1.5 text-center font-medium text-muted-foreground">{d}</div>
          ))}
          {monthDays.map((d, i) => {
            const inMonth = d.getMonth() === monthAnchor.getMonth();
            const isToday = d.toDateString() === new Date().toDateString();
            const items = dayRequests(d);
            return (
              <div key={i} className={cn("min-h-[70px] bg-card p-1 sm:min-h-[92px]", !inMonth && "opacity-40")}>
                <div className={cn("mb-1 text-[10px] font-medium", isToday && "text-primary")}>{d.getDate()}</div>
                <div className="space-y-0.5">
                  {items.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className={cn("truncate rounded px-1 py-0.5 text-[10px] leading-tight border", STATUS_COLOR[r.status])}
                      title={`${memberName(r.user_id)} — ${TYPE_LABEL[r.type]}`}
                    >
                      {memberName(r.user_id).split(" ")[0]} · {TYPE_LABEL[r.type]}
                    </div>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-muted-foreground">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold">{isAdmin ? "All requests" : "My requests"}</h2>
        {loading ? (
          <div className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></div>
        ) : (
          <div className="space-y-2">
            {(isAdmin ? requests : myRequests).length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No requests yet.</div>
            )}
            {(isAdmin ? requests : myRequests).map((r) => (
              <div key={r.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{isAdmin ? memberName(r.user_id) : TYPE_LABEL[r.type]}</span>
                    <Badge variant="outline" className={cn("text-[10px]", STATUS_COLOR[r.status])}>{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {isAdmin && `${TYPE_LABEL[r.type]} · `}{fmtRange(r.start_date, r.end_date)} · {r.hours} hrs
                  </div>
                  {r.note && <div className="mt-1 text-xs text-muted-foreground">"{r.note}"</div>}
                  {r.reviewer_note && <div className="mt-1 text-xs text-muted-foreground">Reviewer: {r.reviewer_note}</div>}
                </div>
                <div className="flex gap-2">
                  {isAdmin && r.status === "pending" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => decide(r, "denied")}>Deny</Button>
                      <Button size="sm" onClick={() => decide(r, "approved")}>Approve</Button>
                    </>
                  )}
                  {r.user_id === user?.id && (r.status === "pending" || r.status === "approved") && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(r)}>Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NewRequestDialog({
  orgId, userId, onDone, availableHours,
}: { orgId: string; userId: string; onDone: () => void; availableHours: number }) {
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [type, setType] = useState("vacation");
  const [hours, setHours] = useState("8");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!startDate || !endDate) return toast.error("Pick start and end dates");
    if (endDate < startDate) return toast.error("End date is before start");
    const h = Number(hours);
    if (!h || h < 0) return toast.error("Enter valid hours");
    setSaving(true);
    const { error } = await supabase.from("time_off_requests").insert({
      organization_id: orgId,
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      hours: h,
      type: type as any,
      note: note || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted");
    onDone();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Request time off</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
          <div><Label>End</Label><Input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Hours</Label>
            <Input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} />
            <div className="mt-1 text-[10px] text-muted-foreground">{availableHours} hrs available</div>
          </div>
        </div>
        <div>
          <Label>Note (optional)</Label>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Family trip, doctor visit…" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Submit request
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function buildMonthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}
function shiftMonth(d: Date, delta: number) {
  const n = new Date(d);
  n.setMonth(n.getMonth() + delta);
  return n;
}
function fmtRange(a: string, b: string) {
  if (a === b) return new Date(a).toLocaleDateString();
  return `${new Date(a).toLocaleDateString()} – ${new Date(b).toLocaleDateString()}`;
}
