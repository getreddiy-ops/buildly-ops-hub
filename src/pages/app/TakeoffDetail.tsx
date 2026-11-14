import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TakeoffReview } from "@/components/takeoff/TakeoffReview";
import { SheetMarkup } from "@/components/takeoff/SheetMarkup";
import { AI_CONNECT_PATH, AI_NOT_CONNECTED, readFunctionError } from "@/lib/function-error";
import { TAKEOFF_STATUS, db, sheetImageUrl, type PlanSetRow, type PlanSheetRow } from "@/lib/takeoff/planSets";
import { DEFAULT_SETTINGS, summarizeTakeoff } from "@/lib/takeoff/quantities";
import { takeoffEstimateLines, type MaterialPrice } from "@/lib/takeoff/estimateLines";
import type { PlanTakeoff } from "../../../supabase/functions/_shared/takeoff-schema";

const MAX_SHEETS_PER_READ = 8;
const KINDS: PlanSheetRow["kind"][] = ["unsorted", "foundation", "details", "notes", "other"];

export default function TakeoffDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeOrg } = useAuth();
  const [set, setSet] = useState<PlanSetRow | null>(null);
  const [sheets, setSheets] = useState<PlanSheetRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [working, setWorking] = useState<PlanTakeoff | null>(null);
  const [busy, setBusy] = useState<null | "read" | "confirm" | "estimate" | "pdf">(null);
  const [tab, setTab] = useState("sheets");

  const load = useCallback(async () => {
    if (!id) return;
    const [{ data: s, error }, { data: sh }] = await Promise.all([
      db.from("plan_sets").select("*").eq("id", id).maybeSingle(),
      db.from("plan_sheets").select("*").eq("plan_set_id", id).order("page_number"),
    ]);
    if (error || !s) { toast.error(error?.message ?? "Plan set not found"); return; }
    setSet(s as PlanSetRow);
    setSheets((sh as PlanSheetRow[]) ?? []);
    setWorking(((s.takeoff_confirmed ?? s.takeoff_draft) as PlanTakeoff | null) ?? null);
    if (s.status === "review" || s.status === "confirmed") setTab((t) => (t === "sheets" ? "review" : t));
    const entries = await Promise.all(((sh as PlanSheetRow[]) ?? []).map(async (x) => [x.id, await sheetImageUrl(x.storage_path)] as const));
    setUrls(Object.fromEntries(entries));
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const settings = { ...DEFAULT_SETTINGS, maxYardsPerPour: 0, ...(set?.settings ?? {}) } as typeof DEFAULT_SETTINGS & { maxYardsPerPour: number };
  const summary = useMemo(() => (working ? summarizeTakeoff(working, settings, settings.maxYardsPerPour) : null), [working, set?.settings]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateSheet = async (sheetId: string, patch: Partial<PlanSheetRow>) => {
    setSheets((all) => all.map((s) => (s.id === sheetId ? { ...s, ...patch } : s)));
    const { error } = await db.from("plan_sheets").update(patch).eq("id", sheetId);
    if (error) toast.error(error.message);
  };
  const saveSettings = async (patch: Record<string, number>) => {
    if (!set) return;
    const next = { ...set.settings, ...patch };
    setSet({ ...set, settings: next });
    await db.from("plan_sets").update({ settings: next }).eq("id", set.id);
  };

  const readPlans = async () => {
    if (!set) return;
    setBusy("read");
    setSet({ ...set, status: "reading" });
    try {
      const { error } = await supabase.functions.invoke("plan-takeoff", { body: { planSetId: set.id } });
      if (error) throw error;
      toast.success("Plans read. Review every item before using the quantities.");
      setTab("review");
    } catch (e) {
      const { message, code } = await readFunctionError(e, "Reading the plans failed");
      if (code === AI_NOT_CONNECTED) toast.error("Connect your AI provider first.", { action: { label: "Open Settings", onClick: () => navigate(AI_CONNECT_PATH) } });
      else toast.error(message);
    } finally {
      setBusy(null);
      await load();
    }
  };

  const confirmTakeoff = async () => {
    if (!set || !working) return;
    setBusy("confirm");
    const { error } = await db.from("plan_sets").update({ takeoff_confirmed: working, status: "confirmed", updated_at: new Date().toISOString() }).eq("id", set.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Takeoff confirmed.");
    setSet({ ...set, status: "confirmed", takeoff_confirmed: working });
    setTab("quantities");
  };

  const createEstimate = async () => {
    if (!set || !summary || !activeOrg) return;
    setBusy("estimate");
    try {
      const { data: mats } = await supabase.from("materials").select("id,name,unit,unit_cost,category").eq("organization_id", activeOrg.organization_id);
      const lines = takeoffEstimateLines(summary, (mats as MaterialPrice[]) ?? [], settings.concreteWastePct);
      let customerId: string | null = null;
      if (set.job_id) {
        const { data: job } = await supabase.from("org_jobs").select("customer_id").eq("id", set.job_id).maybeSingle();
        customerId = (job as { customer_id?: string } | null)?.customer_id ?? null;
      }
      const subtotal = lines.reduce((a, l) => a + l.quantity * l.unit_price, 0);
      const notes = [
        `From plan takeoff "${set.title}". Quantities read from the drawings and confirmed in FastTract.`,
        lines.some((l) => l.price_needed) ? "Some lines need a price: they are at $0 until you add one." : null,
        summary.warnings.length ? `Check before sending:\n- ${summary.warnings.join("\n- ")}` : null,
      ].filter(Boolean).join("\n\n");
      const { data: est, error } = await supabase.from("estimates").insert({
        organization_id: activeOrg.organization_id, customer_id: customerId, title: set.title, notes, subtotal, tax: 0, total: subtotal, status: "draft",
      }).select("id").single();
      if (error) throw error;
      const { error: liErr } = await supabase.from("estimate_line_items").insert(lines.map((l, i) => ({
        estimate_id: est.id, description: `${l.description} (${l.unit})`, quantity: l.quantity, unit_price: l.unit_price, total: l.quantity * l.unit_price, position: i,
      })));
      if (liErr) throw liErr;
      await db.from("plan_sets").update({ estimate_id: est.id }).eq("id", set.id);
      toast.success("Draft estimate created.");
      navigate(`/app/estimates/${est.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    if (!set || !working || !summary) return;
    setBusy("pdf");
    try {
      const { buildCrewPdf } = await import("@/lib/takeoff/crewPdf");
      const blob = await buildCrewPdf({ title: set.title, businessName: activeOrg?.organization?.name ?? "FastTract", takeoff: working, summary, sheets: sheets.map((s) => ({ sheet: s, url: urls[s.id] })).filter((x) => x.url) });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${set.title.replace(/[^\w\- ]+/g, "")} - crew takeoff.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (!set) return <p role="status" className="text-sm text-muted-foreground">Opening plan set…</p>;
  const selected = sheets.filter((s) => s.include_in_reading).length;
  const confirmed = set.status === "confirmed";

  return <div className="space-y-6">
    <PageHeader title={set.title} description={`${set.page_count} pages · ${TAKEOFF_STATUS[set.status]}`} actions={<Link to="/app/takeoffs" className="text-sm underline">All plan sets</Link>} />
    {set.status === "failed" && set.last_error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{set.last_error}</p>}

    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="flex-wrap">
        <TabsTrigger value="sheets">1. Sheets</TabsTrigger>
        <TabsTrigger value="review" disabled={!working}>2. Review</TabsTrigger>
        <TabsTrigger value="quantities" disabled={!working}>3. Quantities & estimate</TabsTrigger>
        <TabsTrigger value="markup" disabled={!working}>4. Marked-up sheets</TabsTrigger>
      </TabsList>

      <TabsContent value="sheets" className="space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm">Pick up to {MAX_SHEETS_PER_READ} sheets: the foundation plan, foundation sections/details and general notes. <strong>{selected}</strong> selected.</p>
          <Button onClick={readPlans} disabled={busy !== null || selected === 0 || selected > MAX_SHEETS_PER_READ || set.status === "reading"} className="min-h-11">
            {(busy === "read" || set.status === "reading") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {set.status === "reading" ? "Reading plans… (a minute or two)" : working ? "Read again" : "Read plans"}
          </Button>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => <Card key={s.id} className="space-y-3 p-3">
            {urls[s.id] ? <img src={urls[s.id]} alt={`Page ${s.page_number}`} className="aspect-[4/3] w-full rounded border object-contain bg-white" loading="lazy" /> : <div className="aspect-[4/3] w-full animate-pulse rounded bg-muted" />}
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="h-5 w-5" checked={s.include_in_reading} onChange={(e) => updateSheet(s.id, { include_in_reading: e.target.checked })} />
                Page {s.page_number}
              </label>
              <select aria-label={`Page ${s.page_number} type`} className="h-9 rounded-md border bg-background px-2 text-sm" value={s.kind} onChange={(e) => updateSheet(s.id, { kind: e.target.value as PlanSheetRow["kind"] })}>
                {KINDS.map((k) => <option key={k} value={k}>{k === "unsorted" ? "Type…" : k}</option>)}
              </select>
            </div>
            <Input aria-label={`Page ${s.page_number} sheet number`} placeholder="Sheet number, e.g. S1.0" defaultValue={s.sheet_label ?? ""} onBlur={(e) => updateSheet(s.id, { sheet_label: e.target.value.trim() || null })} />
          </Card>)}
        </div>
      </TabsContent>

      <TabsContent value="review" className="space-y-4">
        {working && <>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">{confirmed ? "Confirmed. Edits here change the quantities; confirm again to save them." : "Check every row against the drawings. Fix anything wrong, fill blanks only from the plans, remove what doesn't belong. Highlighted rows are ones the reader was unsure of."}</p>
            <Button onClick={confirmTakeoff} disabled={busy !== null} className="min-h-11">{busy === "confirm" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm takeoff</Button>
          </Card>
          <TakeoffReview takeoff={working} onChange={setWorking} />
        </>}
      </TabsContent>

      <TabsContent value="quantities" className="space-y-6">
        {summary && <>
          <Card className="grid gap-4 p-4 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="waste">Concrete waste %</Label><Input id="waste" type="number" min={0} max={30} defaultValue={settings.concreteWastePct} onBlur={(e) => saveSettings({ concreteWastePct: Number(e.target.value) || 0 })} /></div>
            <div className="space-y-1"><Label htmlFor="stock">Rebar stock length (ft)</Label><Input id="stock" type="number" min={10} max={60} defaultValue={settings.stockLengthFt} onBlur={(e) => saveSettings({ stockLengthFt: Number(e.target.value) || 20 })} /></div>
            <div className="space-y-1"><Label htmlFor="pour">Max yards per pour (0 = no breaks)</Label><Input id="pour" type="number" min={0} defaultValue={settings.maxYardsPerPour} onBlur={(e) => saveSettings({ maxYardsPerPour: Number(e.target.value) || 0 })} /></div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[["Concrete to order", `${summary.concreteYardsOrder} yd`, `${summary.concreteYardsNeat} yd neat`], ["Form line", `${summary.formLf} LF`, `${summary.formSfca} sq ft contact`],
              ["Rebar", `${summary.rebarWeightLb} lb`, Object.entries(summary.rebarWeightLbBySize).map(([k, v]) => `${k}: ${v} lb`).join(" · ")],
              ["Anchor bolts", String(summary.bolts.reduce((a, b) => a + b.count, 0)), summary.holdDowns.length ? `${summary.holdDowns.reduce((a, h) => a + h.count, 0)} hold-downs` : ""]].map(([t, v, sub]) =>
              <Card key={t} className="p-4"><p className="text-sm text-muted-foreground">{t}</p><p className="font-display text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{sub}</p></Card>)}
          </div>

          {summary.warnings.length > 0 && <section className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-orange-950">
            <h3 className="font-semibold">Check before you price or pour ({summary.warnings.length})</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{summary.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
          </section>}

          <section className="space-y-2">
            <h3 className="text-lg font-semibold">Bar schedule</h3>
            <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr>{["Mark", "Size", "Pieces", "Cut length", "Total LF", "Weight (lb)", "Description"].map((h) => <th key={h} scope="col" className="px-2 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{summary.bars.map((b) => <tr key={b.mark + b.calloutId} className="border-t">
                <td className="px-2 py-1">{b.mark}</td><td className="px-2 py-1">{b.barSize}</td><td className="px-2 py-1">{b.pieces}</td>
                <td className="px-2 py-1">{Math.floor(b.cutLengthIn / 12)}'-{Math.round(b.cutLengthIn % 12)}"</td><td className="px-2 py-1">{b.totalLf}</td><td className="px-2 py-1">{b.weightLb}</td><td className="px-2 py-1">{b.description}</td>
              </tr>)}</tbody>
            </table></div>
          </section>

          {summary.pourBreaks.length > 0 && <section className="space-y-1 text-sm"><h3 className="text-lg font-semibold">Proposed pour breaks</h3>{summary.pourBreaks.map((p) => <p key={p.elementId}>{p.elementId}: {p.note} Bulkheads {p.bulkheadLf} LF.</p>)}</section>}

          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm">{confirmed ? "Prices come from your Materials list; anything without a match is added at $0 and marked \"price needed\"." : "Confirm the takeoff on the Review tab before building an estimate."}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={downloadPdf} disabled={busy !== null || !confirmed}>{busy === "pdf" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crew PDF</Button>
              {set.estimate_id ? <Button asChild variant="outline"><Link to={`/app/estimates/${set.estimate_id}`}>Open estimate</Link></Button> : null}
              <Button onClick={createEstimate} disabled={busy !== null || !confirmed}>{busy === "estimate" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{set.estimate_id ? "Create another estimate" : "Create estimate"}</Button>
            </div>
          </Card>
        </>}
      </TabsContent>

      <TabsContent value="markup" className="space-y-8">
        {working && sheets.filter((s) => s.include_in_reading).map((s) => <section key={s.id} className="space-y-2">
          <h3 className="text-lg font-semibold">Page {s.page_number}{s.sheet_label ? ` · ${s.sheet_label}` : ""} <Badge variant="secondary" className="ml-2">{s.kind}</Badge></h3>
          {urls[s.id] && <SheetMarkup sheet={s} imageUrl={urls[s.id]} takeoff={working} summary={summary} onSave={(patch) => updateSheet(s.id, patch)} />}
        </section>)}
      </TabsContent>
    </Tabs>
  </div>;
}
