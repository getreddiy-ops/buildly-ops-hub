// Plan takeoff math (launch plan Phase 7.4). Pure functions over confirmed takeoff items.
// Inputs are what the drawings say; anything the drawings leave out comes back as a warning,
// never as a silently assumed number.
import type { AnchorBolt, BarSize, ConcreteElement, PlanTakeoff, RebarCallout } from "../../../supabase/functions/_shared/takeoff-schema";

/** ASTM A615 nominal weight, lb per linear foot. */
export const BAR_WEIGHT_LB_PER_FT: Record<BarSize, number> = {
  "#3": 0.376, "#4": 0.668, "#5": 1.043, "#6": 1.502, "#7": 2.044, "#8": 2.670, "#9": 3.400, "#10": 4.303, "#11": 5.313,
};

export interface TakeoffSettings {
  /** Concrete ordered above the neat volume, percent. */
  concreteWastePct: number;
  /** Rebar stock length the supplier ships, feet. */
  stockLengthFt: number;
  /** Clear cover used only when the drawings don't state one, inches. Shown as an assumption. */
  defaultCoverIn: number;
}

export const DEFAULT_SETTINGS: TakeoffSettings = { concreteWastePct: 5, stockLengthFt: 20, defaultCoverIn: 3 };

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ElementQuantity {
  elementId: string;
  label: string;
  cubicYards: number;          // neat, before waste
  formLf: number;              // linear feet of form line (both sides counted for walls)
  formSfca: number;            // square feet of form contact area
  warnings: string[];
}

/** Neat concrete volume and formwork for one element. */
export function elementQuantity(el: ConcreteElement): ElementQuantity {
  const warnings: string[] = [];
  const need = (v: number | null | undefined, what: string) => {
    if (v == null || !(v > 0)) { warnings.push(`${el.label}: ${what} not on plans`); return 0; }
    return v;
  };
  let cuFt = 0, formLf = 0, sfca = 0;
  const n = Math.max(1, el.count || 1);

  switch (el.kind) {
    case "footing": {
      const L = need(el.lengthFt, "length"), W = need(el.widthIn, "width") / 12, D = need(el.depthIn, "depth") / 12;
      cuFt = L * W * D;
      if (el.formed) { formLf = 2 * L; sfca = 2 * L * D; }
      break;
    }
    case "spread_footing": {
      const L = need(el.lengthFt, "size"), W = (el.widthIn ?? (el.lengthFt ?? 0) * 12) / 12, D = need(el.depthIn, "depth") / 12;
      cuFt = L * W * D * n;
      if (el.formed) { formLf = 2 * (L + W) * n; sfca = 2 * (L + W) * D * n; }
      break;
    }
    case "stem_wall": {
      const L = need(el.lengthFt, "length"), T = need(el.widthIn, "thickness") / 12, H = need(el.heightIn, "height") / 12;
      cuFt = L * T * H;
      formLf = 2 * L; sfca = 2 * L * H;
      break;
    }
    case "slab": {
      const D = need(el.depthIn, "thickness") / 12;
      const area = el.areaSqFt ?? (el.lengthFt && el.widthIn ? el.lengthFt * (el.widthIn / 12) : null);
      cuFt = need(area, "area") * D;
      const perim = el.perimeterFt ?? (el.lengthFt && el.widthIn ? 2 * (el.lengthFt + el.widthIn / 12) : null);
      if (perim) { formLf = perim; sfca = perim * D; } else warnings.push(`${el.label}: slab edge length not on plans; forms not counted`);
      break;
    }
    case "retaining_wall": {
      const L = need(el.lengthFt, "length"), T = need(el.widthIn, "stem thickness") / 12, H = need(el.heightIn, "stem height") / 12;
      const FW = need(el.footingWidthIn, "footing width") / 12;
      const FD = need(el.depthIn, "footing depth") / 12;
      const key = el.keyWidthIn && el.keyDepthIn ? (el.keyWidthIn / 12) * (el.keyDepthIn / 12) : 0;
      cuFt = L * (T * H + FW * FD + key);
      formLf = 2 * L + (el.formed ? 2 * L : 0); sfca = 2 * L * H + (el.formed ? 2 * L * FD : 0);
      break;
    }
  }
  return { elementId: el.id, label: el.label, cubicYards: r2(cuFt / 27), formLf: r2(formLf), formSfca: r2(sfca), warnings };
}

export interface BarLine {
  calloutId: string;
  elementId: string;
  mark: string;          // schedule mark, e.g. "F1-L1"
  barSize: BarSize;
  pieces: number;        // bars to cut/bend (after splitting runs longer than stock)
  cutLengthIn: number;   // each piece
  totalLf: number;
  weightLb: number;
  description: string;
  warnings: string[];
}

function runLengthIn(el: ConcreteElement): number | null {
  if (el.kind === "slab") return el.lengthFt ? el.lengthFt * 12 : null;
  return el.lengthFt ? el.lengthFt * 12 : null;
}

/** Splits a continuous run into stock-length pieces with laps. Returns pieces and total inches including laps. */
export function splitRun(runIn: number, stockIn: number, lapIn: number | null): { pieces: number; totalIn: number; lapMissing: boolean } {
  if (runIn <= stockIn) return { pieces: 1, totalIn: runIn, lapMissing: false };
  if (lapIn == null || lapIn <= 0) {
    // Without a lap length from the drawings, count stock pieces end to end and flag it.
    return { pieces: Math.ceil(runIn / stockIn), totalIn: runIn, lapMissing: true };
  }
  if (lapIn >= stockIn) throw new Error("Lap length is longer than the stock bar");
  const pieces = Math.ceil((runIn - lapIn) / (stockIn - lapIn));
  return { pieces, totalIn: runIn + (pieces - 1) * lapIn, lapMissing: false };
}

/** Bar schedule lines for one rebar callout on its element. */
export function rebarLines(c: RebarCallout, el: ConcreteElement, s: TakeoffSettings = DEFAULT_SETTINGS): BarLine[] {
  const warnings: string[] = [];
  const stockIn = s.stockLengthFt * 12;
  const cover = c.coverIn ?? s.defaultCoverIn;
  if (c.coverIn == null) warnings.push(`Cover not on plans; ${s.defaultCoverIn}" used for cut lengths. Confirm.`);
  const hook = c.hookIn ?? 0;
  const L = runLengthIn(el);
  const n = Math.max(1, el.count || 1);
  const out: BarLine[] = [];
  const weight = BAR_WEIGHT_LB_PER_FT[c.barSize];
  const line = (suffix: string, pieces: number, cutIn: number, desc: string, extra: string[] = []): BarLine => {
    const totalLf = r2((pieces * cutIn) / 12);
    return { calloutId: c.id, elementId: el.id, mark: `${el.id}-${suffix}`, barSize: c.barSize, pieces, cutLengthIn: r2(cutIn), totalLf, weightLb: r2(totalLf * weight), description: desc, warnings: [...warnings, ...extra] };
  };
  const countAlong = (lengthIn: number) => {
    if (c.count != null) return c.count;
    if (!c.spacingIn) { warnings.push("Neither bar count nor spacing is on the plans"); return 0; }
    return Math.floor(Math.max(0, lengthIn - 2 * cover) / c.spacingIn) + 1;
  };

  if (!L) return [line("?", 0, 0, `${c.barSize} for ${el.label}`, [`${el.label}: length not on plans`])];

  switch (c.role) {
    case "longitudinal":
    case "horizontal": {
      const bars = c.count ?? (c.spacingIn && el.heightIn ? Math.floor(Math.max(0, el.heightIn - 2 * cover) / c.spacingIn) + 1 : null);
      if (bars == null) return [line("L", 0, 0, `${c.barSize} continuous in ${el.label}`, ["Bar count not on plans"])];
      const runIn = L - 2 * cover;
      const { pieces, totalIn, lapMissing } = splitRun(runIn, stockIn, c.lapIn);
      const extra = lapMissing ? ["Lap length not on plans; laps not included. Confirm in general notes."] : [];
      // A hook at each end of the run; the run is cut into equal pieces so the cut list is practical.
      return [line(c.role === "longitudinal" ? "L" : "H", bars * pieces * n, (totalIn + 2 * hook) / pieces, `(${bars}) ${c.barSize} continuous, ${el.label}`, extra)];
    }
    case "transverse": {
      const width = el.widthIn;
      if (!width) return [line("T", 0, 0, `${c.barSize} transverse, ${el.label}`, ["Element width not on plans"])];
      const bars = countAlong(L) * n;
      return [line("T", bars, width - 2 * cover + 2 * hook, `${c.barSize} @ ${c.spacingIn ?? "?"}" transverse, ${el.label}`)];
    }
    case "vertical":
    case "dowel": {
      const h = el.heightIn;
      if (!h && c.role === "vertical") return [line("V", 0, 0, `${c.barSize} vertical, ${el.label}`, ["Wall height not on plans"])];
      const embed = c.embedIn;
      const extra = embed == null ? [`${c.role === "dowel" ? "Dowel" : "Vertical"} embedment not on plans; not included. Confirm.`] : [];
      const length = (c.role === "vertical" ? (h ?? 0) - cover : 0) + (embed ?? 0) + hook + (c.role === "dowel" ? (c.lapIn ?? 0) : 0);
      const bars = countAlong(L) * n;
      return [line(c.role === "vertical" ? "V" : "D", bars, length, `${c.barSize} @ ${c.spacingIn ?? "?"}" ${c.role}, ${el.label}`, extra)];
    }
    case "grid_each_way": {
      const widthIn = el.widthIn ?? (el.areaSqFt && el.lengthFt ? (el.areaSqFt / el.lengthFt) * 12 : null);
      if (!widthIn) return [line("G", 0, 0, `${c.barSize} each way, ${el.label}`, ["Slab width not on plans"])];
      const a = splitRun(L - 2 * cover, stockIn, c.lapIn);
      const b = splitRun(widthIn - 2 * cover, stockIn, c.lapIn);
      const extra = a.lapMissing || b.lapMissing ? ["Lap length not on plans; laps not included. Confirm."] : [];
      const barsAlongLength = countAlong(widthIn); // bars running the length, spaced across the width
      const barsAlongWidth = countAlong(L);
      return [
        line("G1", barsAlongLength * a.pieces * n, a.totalIn / a.pieces, `${c.barSize} @ ${c.spacingIn ?? "?"}" E.W. (long direction), ${el.label}`, extra),
        line("G2", barsAlongWidth * b.pieces * n, b.totalIn / b.pieces, `${c.barSize} @ ${c.spacingIn ?? "?"}" E.W. (short direction), ${el.label}`, extra),
      ];
    }
  }
}

export interface BoltCount {
  boltId: string;
  elementId: string;
  count: number;
  description: string;
  warnings: string[];
}

/** Anchor bolts along a wall/footing run: one near each end, then at the drawn spacing. */
export function anchorBoltCount(b: AnchorBolt, el: ConcreteElement): BoltCount {
  const warnings: string[] = [];
  const L = el.lengthFt ? el.lengthFt * 12 : null;
  const size = [b.diameterIn ? `${b.diameterIn}"` : null, b.lengthIn ? `x ${b.lengthIn}"` : null].filter(Boolean).join(" ");
  const description = `${size ? size + " " : ""}anchor bolts @ ${b.spacingIn ?? "?"}" O.C., ${el.label}`;
  if (!L || !b.spacingIn) {
    warnings.push(!L ? `${el.label}: length not on plans` : "Bolt spacing not on plans");
    return { boltId: b.id, elementId: el.id, count: 0, description, warnings };
  }
  let count: number;
  if (b.endDistanceIn != null) {
    const inner = Math.max(0, L - 2 * b.endDistanceIn);
    count = Math.ceil(inner / b.spacingIn) + 1;
  } else {
    warnings.push("End distance not on plans; counted at spacing from end to end. Confirm the end-bolt rule in general notes.");
    count = Math.floor(L / b.spacingIn) + 1;
  }
  if (b.diameterIn == null) warnings.push("Bolt diameter not on plans");
  return { boltId: b.id, elementId: el.id, count: count * Math.max(1, el.count || 1), description, warnings };
}

export interface PourBreak {
  elementId: string;
  breaks: number;          // number of bulkheads
  bulkheadLf: number;      // total bulkhead length
  yardsPerPour: number;
  proposed: true;
  note: string;
}

/**
 * PROPOSED pour breaks so no single pour exceeds the contractor's limit. Only offered when the
 * drawings allow construction joints; each break is a bulkhead across the element's width/height.
 */
export function proposePourBreaks(el: ConcreteElement, q: ElementQuantity, maxYardsPerPour: number, constructionJointRule: string | null): PourBreak | null {
  if (!(maxYardsPerPour > 0) || q.cubicYards <= maxYardsPerPour) return null;
  if (!constructionJointRule || /not\s+(be\s+)?(allowed|permitted)|no\s+construction\s+joints/i.test(constructionJointRule)) return null;
  const pours = Math.ceil(q.cubicYards / maxYardsPerPour);
  const crossIn = el.kind === "slab" ? el.widthIn : el.kind === "footing" ? el.widthIn : el.heightIn;
  const crossFt = crossIn ? crossIn / 12 : 0;
  return {
    elementId: el.id,
    breaks: pours - 1,
    bulkheadLf: r2((pours - 1) * crossFt),
    yardsPerPour: r2(q.cubicYards / pours),
    proposed: true,
    note: `Proposed: ${pours} pours of about ${r2(q.cubicYards / pours)} yd. Plans say: "${constructionJointRule}". Confirm locations with the engineer.`,
  };
}

export interface TakeoffSummary {
  elements: ElementQuantity[];
  concreteYardsNeat: number;
  concreteYardsOrder: number;
  formLf: number;
  formSfca: number;
  bars: BarLine[];
  rebarWeightLbBySize: Partial<Record<BarSize, number>>;
  rebarWeightLb: number;
  bolts: BoltCount[];
  holdDowns: { model: string; count: number }[];
  pourBreaks: PourBreak[];
  warnings: string[];
}

export function summarizeTakeoff(t: PlanTakeoff, s: TakeoffSettings = DEFAULT_SETTINGS, maxYardsPerPour = 0): TakeoffSummary {
  const byId = new Map(t.elements.map((e) => [e.id, e]));
  const elements = t.elements.map(elementQuantity);
  const bars = t.rebar.flatMap((c) => {
    const el = byId.get(c.elementId);
    return el ? rebarLines(c, el, s) : [];
  });
  const bolts = t.anchorBolts.flatMap((b) => {
    const el = byId.get(b.elementId);
    return el ? [anchorBoltCount(b, el)] : [];
  });
  const rebarWeightLbBySize: Partial<Record<BarSize, number>> = {};
  for (const b of bars) rebarWeightLbBySize[b.barSize] = r2((rebarWeightLbBySize[b.barSize] ?? 0) + b.weightLb);
  const neat = r2(elements.reduce((a, e) => a + e.cubicYards, 0));
  const pourBreaks = t.elements.flatMap((el, i) => {
    const p = proposePourBreaks(el, elements[i], maxYardsPerPour, t.constructionJointRule);
    return p ? [p] : [];
  });
  const orphanWarnings = [
    ...t.rebar.filter((c) => !byId.has(c.elementId)).map((c) => `Rebar ${c.id} refers to an element that isn't in the takeoff`),
    ...t.anchorBolts.filter((b) => !byId.has(b.elementId)).map((b) => `Anchor bolts ${b.id} refer to an element that isn't in the takeoff`),
  ];
  return {
    elements,
    concreteYardsNeat: neat,
    concreteYardsOrder: Math.ceil(neat * (1 + s.concreteWastePct / 100) * 4) / 4, // order in quarter yards
    formLf: r2(elements.reduce((a, e) => a + e.formLf, 0)),
    formSfca: r2(elements.reduce((a, e) => a + e.formSfca, 0)),
    bars,
    rebarWeightLbBySize,
    rebarWeightLb: r2(bars.reduce((a, b) => a + b.weightLb, 0)),
    bolts,
    holdDowns: t.holdDowns.map((h) => ({ model: h.model, count: h.count })),
    pourBreaks,
    warnings: [
      ...t.missing.map((m) => `Not on plans: ${m.what}${m.elementId ? ` (${m.elementId})` : ""}. Confirm with engineer.`),
      ...elements.flatMap((e) => e.warnings),
      ...bars.flatMap((b) => b.warnings.map((w) => `${b.mark}: ${w}`)),
      ...bolts.flatMap((b) => b.warnings.map((w) => `${b.boltId}: ${w}`)),
      ...orphanWarnings,
    ].filter((w, i, all) => all.indexOf(w) === i),
  };
}
