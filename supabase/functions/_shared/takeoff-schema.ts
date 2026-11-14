// Plan takeoff (launch plan Phase 7): the shape of what FastTract reads off a concrete plan set.
// Shared by the plan-takeoff function (AI tool schema) and the web app (review, math, estimate).
// Rule: every structural value is READ from the drawings with its sheet/detail. Nothing here is designed.
// A value the drawings don't give is null and listed in `missing`, never filled with a guess.

export const BAR_SIZES = ["#3", "#4", "#5", "#6", "#7", "#8", "#9", "#10", "#11"] as const;
export type BarSize = (typeof BAR_SIZES)[number];

export interface SourceRef {
  sheet: string;          // e.g. "S1.0"
  detail?: string | null; // e.g. "3/S2.1" or "General note 7"
  note?: string | null;   // the callout text as printed, e.g. "#4 @ 12\" O.C. E.W."
}

export type ElementKind = "footing" | "spread_footing" | "stem_wall" | "slab" | "retaining_wall";

export interface ConcreteElement {
  id: string;             // stable id, e.g. "F1", "SW-north"
  kind: ElementKind;
  label: string;          // as named on the plans, e.g. "Typ. continuous footing"
  lengthFt: number | null;     // run length (continuous) or side length (spread)
  widthIn: number | null;      // footing width / wall thickness / spread footing width
  depthIn: number | null;      // footing depth / slab thickness
  heightIn: number | null;     // stem or retaining wall height above footing
  count: number;               // spread footings: how many; otherwise 1
  areaSqFt: number | null;     // slabs: area when not a simple rectangle
  perimeterFt: number | null;  // slabs: edge length to form
  formed: boolean;             // false when the drawings show the footing poured against earth (trenched)
  footingWidthIn?: number | null; // retaining wall: footing (toe + heel) width
  keyWidthIn?: number | null;  // retaining wall shear key
  keyDepthIn?: number | null;
  source: SourceRef;
  confidence: number;          // 0..1, how sure the reader is of this item
}

export type BarRole = "longitudinal" | "transverse" | "vertical" | "horizontal" | "dowel" | "grid_each_way";

export interface RebarCallout {
  id: string;
  elementId: string;
  barSize: BarSize;
  role: BarRole;
  count: number | null;        // "(3) #4 cont." → 3
  spacingIn: number | null;    // "#4 @ 12\" O.C." → 12
  lapIn: number | null;        // from the callout or general notes; null if the drawings don't say
  hookIn: number | null;       // extra length per bar for a hook/bend, if detailed
  embedIn: number | null;      // dowels/verticals: embedment into footing, if detailed
  coverIn: number | null;      // clear cover, if stated
  source: SourceRef;
  confidence: number;
}

export interface AnchorBolt {
  id: string;
  elementId: string;
  diameterIn: number | null;
  lengthIn: number | null;
  spacingIn: number | null;
  endDistanceIn: number | null; // max distance from each end of a run, if stated
  embedIn: number | null;
  source: SourceRef;
  confidence: number;
}

export interface HoldDown {
  id: string;
  model: string;           // as printed, e.g. "Simpson HDU5"
  count: number;
  location: string;
  source: SourceRef;
  confidence: number;
}

export interface Joint {
  id: string;
  elementId: string | null;
  type: "control" | "construction" | "expansion" | "isolation";
  description: string;     // as printed
  spacingFt: number | null;
  source: SourceRef;
  confidence: number;
}

export interface MissingItem {
  what: string;            // e.g. "Lap length for #5 bars"
  elementId: string | null;
}

export interface PlanTakeoff {
  elements: ConcreteElement[];
  rebar: RebarCallout[];
  anchorBolts: AnchorBolt[];
  holdDowns: HoldDown[];
  joints: Joint[];
  /** What the drawings say about construction joints, e.g. "Construction joints only where shown". */
  constructionJointRule: string | null;
  missing: MissingItem[];
}

const src = {
  type: "object",
  properties: {
    sheet: { type: "string" },
    detail: { type: ["string", "null"] },
    note: { type: ["string", "null"], description: "Callout text exactly as printed" },
  },
  required: ["sheet"],
};
const num = { type: ["number", "null"] };
const conf = { type: "number", minimum: 0, maximum: 1 };

/** JSON schema handed to the AI as the single tool it must call. */
export const TAKEOFF_TOOL_PARAMETERS = {
  type: "object",
  properties: {
    elements: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, kind: { type: "string", enum: ["footing", "spread_footing", "stem_wall", "slab", "retaining_wall"] },
      label: { type: "string" }, lengthFt: num, widthIn: num, depthIn: num, heightIn: num, count: { type: "integer", minimum: 1 },
      areaSqFt: num, perimeterFt: num, formed: { type: "boolean" }, footingWidthIn: num, keyWidthIn: num, keyDepthIn: num, source: src, confidence: conf,
    }, required: ["id", "kind", "label", "count", "formed", "source", "confidence"] } },
    rebar: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, elementId: { type: "string" }, barSize: { type: "string", enum: [...BAR_SIZES] },
      role: { type: "string", enum: ["longitudinal", "transverse", "vertical", "horizontal", "dowel", "grid_each_way"] },
      count: { type: ["integer", "null"] }, spacingIn: num, lapIn: num, hookIn: num, embedIn: num, coverIn: num, source: src, confidence: conf,
    }, required: ["id", "elementId", "barSize", "role", "source", "confidence"] } },
    anchorBolts: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, elementId: { type: "string" }, diameterIn: num, lengthIn: num, spacingIn: num, endDistanceIn: num, embedIn: num, source: src, confidence: conf,
    }, required: ["id", "elementId", "source", "confidence"] } },
    holdDowns: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, model: { type: "string" }, count: { type: "integer", minimum: 1 }, location: { type: "string" }, source: src, confidence: conf,
    }, required: ["id", "model", "count", "location", "source", "confidence"] } },
    joints: { type: "array", items: { type: "object", properties: {
      id: { type: "string" }, elementId: { type: ["string", "null"] }, type: { type: "string", enum: ["control", "construction", "expansion", "isolation"] },
      description: { type: "string" }, spacingFt: num, source: src, confidence: conf,
    }, required: ["id", "type", "description", "source", "confidence"] } },
    constructionJointRule: { type: ["string", "null"] },
    missing: { type: "array", items: { type: "object", properties: { what: { type: "string" }, elementId: { type: ["string", "null"] } }, required: ["what"] } },
  },
  required: ["elements", "rebar", "anchorBolts", "holdDowns", "joints", "constructionJointRule", "missing"],
};
