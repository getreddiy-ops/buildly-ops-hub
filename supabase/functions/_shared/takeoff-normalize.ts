// Cleans an AI-returned takeoff into the PlanTakeoff shape: drops malformed entries, coerces numbers,
// and never invents a value. Pure, so it is unit-tested alongside the math.
import { BAR_SIZES, type PlanTakeoff } from "./takeoff-schema.ts";

const KINDS = new Set(["footing", "spread_footing", "stem_wall", "slab", "retaining_wall"]);
const ROLES = new Set(["longitudinal", "transverse", "vertical", "horizontal", "dowel", "grid_each_way"]);
const JOINTS = new Set(["control", "construction", "expansion", "isolation"]);

const n = (v: unknown): number | null => {
  const x = typeof v === "string" ? Number(v) : v;
  return typeof x === "number" && Number.isFinite(x) && x > 0 ? x : null;
};
const s = (v: unknown, fallback = ""): string => (typeof v === "string" ? v.trim().slice(0, 300) : fallback);
const conf = (v: unknown) => Math.min(1, Math.max(0, typeof v === "number" && Number.isFinite(v) ? v : 0.5));
const source = (v: any) => ({ sheet: s(v?.sheet, "?") || "?", detail: s(v?.detail) || null, note: s(v?.note) || null });
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

export function normalizeTakeoff(raw: any): PlanTakeoff {
  const elements = arr(raw?.elements).filter((e) => KINDS.has(e?.kind) && s(e?.id)).map((e) => ({
    id: s(e.id), kind: e.kind, label: s(e.label, e.kind) || e.kind,
    lengthFt: n(e.lengthFt), widthIn: n(e.widthIn), depthIn: n(e.depthIn), heightIn: n(e.heightIn),
    count: Math.max(1, Math.round(n(e.count) ?? 1)), areaSqFt: n(e.areaSqFt), perimeterFt: n(e.perimeterFt),
    formed: e.formed !== false, footingWidthIn: n(e.footingWidthIn), keyWidthIn: n(e.keyWidthIn), keyDepthIn: n(e.keyDepthIn),
    source: source(e.source), confidence: conf(e.confidence),
  }));
  const ids = new Set(elements.map((e) => e.id));
  // Element ids must be unique; later duplicates are dropped rather than silently merged.
  const seen = new Set<string>();
  const uniqueElements = elements.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));

  const rebar = arr(raw?.rebar).filter((r) => (BAR_SIZES as readonly string[]).includes(r?.barSize) && ROLES.has(r?.role) && s(r?.elementId)).map((r, i) => ({
    id: s(r.id) || `R${i + 1}`, elementId: s(r.elementId), barSize: r.barSize, role: r.role,
    count: n(r.count) != null ? Math.round(n(r.count)!) : null, spacingIn: n(r.spacingIn), lapIn: n(r.lapIn), hookIn: n(r.hookIn),
    embedIn: n(r.embedIn), coverIn: n(r.coverIn), source: source(r.source), confidence: conf(r.confidence),
  }));
  const anchorBolts = arr(raw?.anchorBolts).filter((b) => s(b?.elementId)).map((b, i) => ({
    id: s(b.id) || `AB${i + 1}`, elementId: s(b.elementId), diameterIn: n(b.diameterIn), lengthIn: n(b.lengthIn), spacingIn: n(b.spacingIn),
    endDistanceIn: n(b.endDistanceIn), embedIn: n(b.embedIn), source: source(b.source), confidence: conf(b.confidence),
  }));
  const holdDowns = arr(raw?.holdDowns).filter((h) => s(h?.model)).map((h, i) => ({
    id: s(h.id) || `HD${i + 1}`, model: s(h.model), count: Math.max(1, Math.round(n(h.count) ?? 1)), location: s(h.location), source: source(h.source), confidence: conf(h.confidence),
  }));
  const joints = arr(raw?.joints).filter((j) => JOINTS.has(j?.type)).map((j, i) => ({
    id: s(j.id) || `J${i + 1}`, elementId: s(j.elementId) || null, type: j.type, description: s(j.description), spacingFt: n(j.spacingFt), source: source(j.source), confidence: conf(j.confidence),
  }));
  const missing = arr(raw?.missing).filter((m) => s(m?.what)).map((m) => ({ what: s(m.what), elementId: s(m.elementId) || null }));
  for (const r of [...rebar, ...anchorBolts]) {
    if (!ids.has(r.elementId)) missing.push({ what: `${r.id} points at element "${r.elementId}", which wasn't found on the plans`, elementId: null });
  }
  return { elements: uniqueElements, rebar, anchorBolts, holdDowns, joints, constructionJointRule: s(raw?.constructionJointRule) || null, missing };
}
