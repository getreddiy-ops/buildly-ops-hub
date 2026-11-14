import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PlanTakeoff } from "../../../supabase/functions/_shared/takeoff-schema";
import type { MarkupItem, PlanSheetRow } from "@/lib/takeoff/planSets";
import { boltMarks, polylineLength, pourBreakMarks, scaleFromCalibration, traceDifferencePct, type Pt } from "@/lib/takeoff/markup";
import type { TakeoffSummary } from "@/lib/takeoff/quantities";

export const FORM_COLOR = "#C2410C";
export const BOLT_COLOR = "#1D4ED8";
export const BREAK_COLOR = "#7C2D12";

/** What gets drawn for one traced run: the form line, its bolt marks and proposed pour breaks. */
export function runOverlay(run: Extract<MarkupItem, { type: "run" }>, sheet: PlanSheetRow, takeoff: PlanTakeoff, summary: TakeoffSummary | null) {
  const scale = sheet.scale_px_per_ft ?? 0;
  const el = takeoff.elements.find((e) => e.id === run.elementId) ?? null;
  const bolt = takeoff.anchorBolts.find((b) => b.elementId === run.elementId);
  const bolts = bolt && scale && bolt.spacingIn ? boltMarks(run.points, scale, bolt.spacingIn, bolt.endDistanceIn) : [];
  const brk = summary?.pourBreaks.find((p) => p.elementId === run.elementId);
  const breaks = brk ? pourBreakMarks(run.points, brk.breaks + 1) : [];
  const diff = el && scale ? traceDifferencePct(run.points, scale, el.lengthFt) : null;
  return { el, bolts, breaks, diff, tracedFt: scale ? Math.round((polylineLength(run.points) / scale) * 10) / 10 : null };
}

type Mode = { kind: "view" } | { kind: "calibrate"; points: Pt[] } | { kind: "trace"; elementId: string; points: Pt[] };

/**
 * The marked-up plan sheet. Set the scale by clicking both ends of a dimension, then trace each run;
 * FastTract places bolt marks at the drawn spacing and proposed pour breaks along the trace.
 */
export function SheetMarkup({ sheet, imageUrl, takeoff, summary, onSave }: {
  sheet: PlanSheetRow; imageUrl: string; takeoff: PlanTakeoff; summary: TakeoffSummary | null;
  onSave: (patch: Partial<Pick<PlanSheetRow, "markup" | "scale_px_per_ft">>) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [elementId, setElementId] = useState(takeoff.elements[0]?.id ?? "");
  const runs = useMemo(() => (sheet.markup ?? []).filter((m): m is Extract<MarkupItem, { type: "run" }> => m.type === "run"), [sheet.markup]);
  const W = sheet.width_px, H = sheet.height_px;
  const stroke = Math.max(2, W / 600);

  const click = (e: React.MouseEvent<SVGSVGElement>) => {
    if (mode.kind === "view") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p: Pt = [Math.round(((e.clientX - rect.left) / rect.width) * W), Math.round(((e.clientY - rect.top) / rect.height) * H)];
    if (mode.kind === "calibrate") {
      const points = [...mode.points, p];
      if (points.length < 2) return setMode({ ...mode, points });
      const feet = Number(prompt("Real distance between those two points, in feet (e.g. 24.5)?") ?? "");
      try {
        const scale = scaleFromCalibration(points[0], points[1], feet);
        const markup = [...(sheet.markup ?? []).filter((m) => m.type !== "calibration"), { type: "calibration" as const, a: points[0], b: points[1], feet }];
        void onSave({ scale_px_per_ft: scale, markup });
      } catch (err) { alert((err as Error).message); }
      setMode({ kind: "view" });
    } else {
      setMode({ ...mode, points: [...mode.points, p] });
    }
  };

  const finishTrace = () => {
    if (mode.kind !== "trace" || mode.points.length < 2) return setMode({ kind: "view" });
    const run = { type: "run" as const, id: crypto.randomUUID(), elementId: mode.elementId, points: mode.points };
    void onSave({ markup: [...(sheet.markup ?? []), run] });
    setMode({ kind: "view" });
  };

  const removeRun = (id: string) => void onSave({ markup: (sheet.markup ?? []).filter((m) => !(m.type === "run" && m.id === id)) });

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Button variant={mode.kind === "calibrate" ? "default" : "outline"} onClick={() => setMode({ kind: "calibrate", points: [] })}>Set scale</Button>
      <label className="sr-only" htmlFor={`trace-el-${sheet.id}`}>Element to trace</label>
      <select id={`trace-el-${sheet.id}`} className="h-10 rounded-md border bg-background px-2 text-sm" value={elementId} onChange={(e) => setElementId(e.target.value)}>
        {takeoff.elements.map((el) => <option key={el.id} value={el.id}>{el.id}: {el.label}</option>)}
      </select>
      <Button variant={mode.kind === "trace" ? "default" : "outline"} disabled={!sheet.scale_px_per_ft || !elementId} onClick={() => setMode({ kind: "trace", elementId, points: [] })}>Trace run</Button>
      {mode.kind === "trace" && <Button onClick={finishTrace}>Finish run</Button>}
      {mode.kind !== "view" && <Button variant="ghost" onClick={() => setMode({ kind: "view" })}>Cancel</Button>}
      <span className="text-sm text-muted-foreground" role="status">
        {mode.kind === "calibrate" ? "Click both ends of a dimension you know." : mode.kind === "trace" ? "Click along the run, then Finish run." : sheet.scale_px_per_ft ? `Scale set (${sheet.scale_px_per_ft.toFixed(1)} px/ft).` : "Set the scale first."}
      </span>
    </div>

    <div className="relative overflow-auto rounded-lg border bg-white">
      <div className="relative" style={{ width: "100%", aspectRatio: `${W} / ${H}` }}>
        <img src={imageUrl} alt={`Plan page ${sheet.page_number}`} className="absolute inset-0 h-full w-full select-none" draggable={false} />
        <svg viewBox={`0 0 ${W} ${H}`} className={`absolute inset-0 h-full w-full ${mode.kind !== "view" ? "cursor-crosshair" : ""}`} onClick={click} role="img" aria-label="Markup overlay">
          {runs.map((r) => {
            const o = runOverlay(r, sheet, takeoff, summary);
            return <g key={r.id}>
              <polyline points={r.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={FORM_COLOR} strokeWidth={stroke * 2} strokeOpacity={0.85} />
              {o.bolts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={stroke * 2.2} fill={BOLT_COLOR} />)}
              {o.breaks.map((p, i) => <rect key={i} x={p[0] - stroke * 4} y={p[1] - stroke * 4} width={stroke * 8} height={stroke * 8} fill="none" stroke={BREAK_COLOR} strokeWidth={stroke * 1.5} strokeDasharray={`${stroke * 2}`} />)}
            </g>;
          })}
          {mode.kind !== "view" && mode.points.length > 0 && <polyline points={mode.points.map((p) => p.join(",")).join(" ")} fill="none" stroke={BOLT_COLOR} strokeWidth={stroke * 1.5} strokeDasharray={`${stroke * 3}`} />}
        </svg>
      </div>
    </div>

    {runs.length > 0 && <ul className="space-y-1 text-sm">
      {runs.map((r) => {
        const o = runOverlay(r, sheet, takeoff, summary);
        const off = o.diff != null && Math.abs(o.diff) > 3;
        return <li key={r.id} className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{o.el ? `${o.el.id}: ${o.el.label}` : "Unlinked run"}</span>
          <span className="text-muted-foreground">traced {o.tracedFt ?? "?"} ft{o.el?.lengthFt ? ` vs plans ${o.el.lengthFt} ft` : ""}{o.diff != null ? ` (${o.diff > 0 ? "+" : ""}${o.diff}%)` : ""} · {o.bolts.length} bolt marks{o.breaks.length ? ` · ${o.breaks.length} proposed pour break${o.breaks.length > 1 ? "s" : ""}` : ""}</span>
          {off && <span className="text-orange-800">Trace and plan length differ by more than 3%; check the scale or the dimension.</span>}
          <Button variant="ghost" size="sm" onClick={() => removeRun(r.id)}>Remove</Button>
        </li>;
      })}
    </ul>}
    <p className="text-xs text-muted-foreground">Legend: orange line = form line · blue dots = anchor bolts at the drawn spacing · dashed squares = proposed pour breaks/bulkheads (confirm with the engineer).</p>
  </div>;
}
