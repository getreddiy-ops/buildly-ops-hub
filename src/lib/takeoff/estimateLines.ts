// Confirmed takeoff → estimate lines (launch plan Phase 7.6). Quantities come from the takeoff math;
// prices come only from the business's own material list. A line with no matching price is left at
// $0 and marked "price needed" so nobody sends an estimate with a made-up number.
import type { TakeoffSummary } from "./quantities";

export interface MaterialPrice { id: string; name: string; unit: string; unit_cost: number; category?: string | null }

export interface EstimateLine {
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  material_id: string | null;
  price_needed: boolean;
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9#. ]/g, " ").split(/\s+/).filter(Boolean);

/** Picks the material whose name contains every keyword and whose unit matches, if any. */
export function matchMaterial(materials: MaterialPrice[], keywords: string[], units: string[]): MaterialPrice | null {
  const unitSet = new Set(units.map((u) => u.toLowerCase()));
  const hits = materials.filter((m) => {
    const w = new Set(words(m.name));
    return keywords.every((k) => w.has(k.toLowerCase())) && unitSet.has(String(m.unit).toLowerCase().replace(/\.$/, ""));
  });
  return hits.sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}

function priced(description: string, quantity: number, unit: string, m: MaterialPrice | null): EstimateLine {
  return {
    description: m ? description : `${description} (price needed)`,
    quantity,
    unit,
    unit_price: m ? Number(m.unit_cost) : 0,
    material_id: m?.id ?? null,
    price_needed: !m,
  };
}

export function takeoffEstimateLines(s: TakeoffSummary, materials: MaterialPrice[], wastePct: number): EstimateLine[] {
  const lines: EstimateLine[] = [];
  if (s.concreteYardsOrder > 0) {
    lines.push(priced(`Ready-mix concrete, ${s.concreteYardsNeat} yd neat + ${wastePct}% waste`, s.concreteYardsOrder, "yd",
      matchMaterial(materials, ["concrete"], ["yd", "cy", "yard", "cu yd", "yd3"])));
  }
  if (s.formLf > 0) {
    lines.push(priced(`Formwork (${s.formSfca} sq ft contact area)`, s.formLf, "lf", matchMaterial(materials, ["form"], ["lf", "ft", "linear ft"])));
  }
  for (const [size, lb] of Object.entries(s.rebarWeightLbBySize)) {
    if (!lb) continue;
    const pieces = s.bars.filter((b) => b.barSize === size).reduce((a, b) => a + b.pieces, 0);
    const byLb = matchMaterial(materials, [size, "rebar"], ["lb", "lbs"]);
    if (byLb) lines.push(priced(`${size} rebar, ${pieces} pieces per bar schedule`, Math.ceil(lb), "lb", byLb));
    else {
      const lf = s.bars.filter((b) => b.barSize === size).reduce((a, b) => a + b.totalLf, 0);
      lines.push(priced(`${size} rebar, ${pieces} pieces per bar schedule (${Math.ceil(lb)} lb)`, Math.ceil(lf), "lf",
        matchMaterial(materials, [size, "rebar"], ["lf", "ft"])));
    }
  }
  const bolts = s.bolts.reduce((a, b) => a + b.count, 0);
  if (bolts > 0) lines.push(priced("Anchor bolts per plans", bolts, "ea", matchMaterial(materials, ["anchor", "bolt"], ["ea", "each"])));
  for (const h of s.holdDowns) {
    lines.push(priced(`Hold-down ${h.model}`, h.count, "ea", matchMaterial(materials, words(h.model).slice(-1), ["ea", "each"])));
  }
  const bulkheadLf = s.pourBreaks.reduce((a, p) => a + p.bulkheadLf, 0);
  if (bulkheadLf > 0) lines.push(priced("Bulkheads at proposed pour breaks (confirm with engineer)", Math.ceil(bulkheadLf), "lf", matchMaterial(materials, ["bulkhead"], ["lf", "ft"])));
  return lines;
}
