import { describe, expect, it } from "vitest";
import type { ConcreteElement, PlanTakeoff, RebarCallout } from "../../../supabase/functions/_shared/takeoff-schema";
import { anchorBoltCount, elementQuantity, proposePourBreaks, rebarLines, splitRun, summarizeTakeoff } from "./quantities";

const src = { sheet: "S1.0" };
const base = { count: 1, areaSqFt: null, perimeterFt: null, heightIn: null, formed: true, source: src, confidence: 0.9 };
const footing: ConcreteElement = { ...base, id: "F1", kind: "footing", label: "Continuous footing", lengthFt: 100, widthIn: 16, depthIn: 10, formed: false };
const stem: ConcreteElement = { ...base, id: "SW1", kind: "stem_wall", label: "Stem wall", lengthFt: 100, widthIn: 8, depthIn: null, heightIn: 24 };
const slab: ConcreteElement = { ...base, id: "S1", kind: "slab", label: "Garage slab", lengthFt: 30, widthIn: 240, depthIn: 4 };
const bar = (o: Partial<RebarCallout>): RebarCallout => ({ id: "R", elementId: "F1", barSize: "#4", role: "longitudinal", count: null, spacingIn: null, lapIn: null, hookIn: null, embedIn: null, coverIn: null, source: src, confidence: 0.9, ...o });

// Expected values below were worked by hand, not copied from the code's output.
describe("concrete and forms", () => {
  it("continuous footing 100' x 16\" x 10\", trenched: 111.11 cu ft = 4.12 yd, no forms", () => {
    expect(elementQuantity(footing)).toMatchObject({ cubicYards: 4.12, formLf: 0, formSfca: 0, warnings: [] });
  });
  it("stem wall 100' x 8\" x 24\": 133.33 cu ft = 4.94 yd; both faces formed: 200 LF, 400 SFCA", () => {
    expect(elementQuantity(stem)).toMatchObject({ cubicYards: 4.94, formLf: 200, formSfca: 400 });
  });
  it("slab 20' x 30' x 4\": 200 cu ft = 7.41 yd; 100 LF edge form", () => {
    expect(elementQuantity(slab)).toMatchObject({ cubicYards: 7.41, formLf: 100, formSfca: 33.33 });
  });
  it("flags a dimension the plans don't give instead of guessing it", () => {
    const q = elementQuantity({ ...footing, depthIn: null });
    expect(q.cubicYards).toBe(0);
    expect(q.warnings).toEqual(["Continuous footing: depth not on plans"]);
  });
});

describe("rebar", () => {
  it("splits a run into stock lengths with laps: 1194\" run, 20' stock, 24\" lap → 6 pieces, 1314\" total", () => {
    expect(splitRun(1194, 240, 24)).toEqual({ pieces: 6, totalIn: 1314, lapMissing: false });
    expect(splitRun(200, 240, null)).toEqual({ pieces: 1, totalIn: 200, lapMissing: false });
  });
  it("(2) #4 continuous in 100' footing, 3\" cover, 24\" lap: 12 pieces @ 219\" = 219 LF = 146.29 lb", () => {
    const [l] = rebarLines(bar({ count: 2, lapIn: 24, coverIn: 3 }), footing);
    expect(l).toMatchObject({ mark: "F1-L", pieces: 12, cutLengthIn: 219, totalLf: 219, weightLb: 146.29, warnings: [] });
  });
  it("does not invent a lap length: counts stock bars end to end and says so", () => {
    const [l] = rebarLines(bar({ count: 2, coverIn: 3 }), footing);
    expect(l.pieces).toBe(10); // 1194" / 240" → 5 pieces per bar, no laps
    expect(l.warnings.join(" ")).toMatch(/Lap length not on plans/);
  });
  it("#4 verticals @ 24\" in a 24\" stem wall, 1.5\" cover, 7\" embed: 50 bars @ 29.5\" = 122.92 LF = 82.11 lb", () => {
    const [l] = rebarLines(bar({ elementId: "SW1", role: "vertical", spacingIn: 24, coverIn: 1.5, embedIn: 7 }), stem);
    expect(l).toMatchObject({ pieces: 50, cutLengthIn: 29.5, totalLf: 122.92, weightLb: 82.11 });
  });
  it("#4 @ 18\" each way in a 20' x 30' slab: 28 pcs @ 177\" long way, 20 pcs @ 234\" short way; default cover is flagged", () => {
    const [g1, g2] = rebarLines(bar({ elementId: "S1", role: "grid_each_way", spacingIn: 18 }), slab);
    expect([g1.pieces, g1.cutLengthIn, g1.totalLf]).toEqual([28, 177, 413]);
    expect([g2.pieces, g2.cutLengthIn, g2.totalLf]).toEqual([20, 234, 390]);
    expect(g1.warnings.join(" ")).toMatch(/Cover not on plans/);
    expect(g1.warnings.join(" ")).toMatch(/Lap length not on plans/);
  });
});

describe("anchor bolts", () => {
  const ab = { id: "AB1", elementId: "SW1", diameterIn: 0.625, lengthIn: 10, spacingIn: 72, embedIn: 7, source: src, confidence: 0.9 };
  it("100' wall, 72\" O.C., 12\" from each end: 1176\" between end bolts → 17 spaces → 18 bolts", () => {
    expect(anchorBoltCount({ ...ab, endDistanceIn: 12 }, stem)).toMatchObject({ count: 18, warnings: [] });
  });
  it("without an end distance on the plans: 17 bolts and a warning", () => {
    const c = anchorBoltCount({ ...ab, endDistanceIn: null }, stem);
    expect(c.count).toBe(17);
    expect(c.warnings[0]).toMatch(/End distance not on plans/);
  });
});

describe("pour breaks", () => {
  it("proposes 2 bulkheads (40 LF) to keep a 7.41 yd slab under 3 yd per pour, only when plans allow joints", () => {
    const q = elementQuantity(slab);
    expect(proposePourBreaks(slab, q, 3, "Construction joints permitted where shown or approved")).toMatchObject({ breaks: 2, bulkheadLf: 40, yardsPerPour: 2.47, proposed: true });
    expect(proposePourBreaks(slab, q, 3, "Construction joints are not permitted")).toBeNull();
    expect(proposePourBreaks(slab, q, 3, null)).toBeNull();
    expect(proposePourBreaks(slab, q, 10, "Permitted")).toBeNull();
  });
});

describe("summary", () => {
  it("orders concrete in quarter yards with waste and rolls up rebar by size and plan gaps", () => {
    const t: PlanTakeoff = {
      elements: [slab], rebar: [bar({ elementId: "S1", role: "grid_each_way", spacingIn: 18, coverIn: 3, lapIn: 24 })],
      anchorBolts: [], holdDowns: [{ id: "HD1", model: "Simpson HDU5", count: 4, location: "Garage corners", source: src, confidence: 0.8 }],
      joints: [], constructionJointRule: null, missing: [{ what: "Slab vapor barrier spec", elementId: "S1" }],
    };
    const s = summarizeTakeoff(t);
    expect(s.concreteYardsNeat).toBe(7.41);
    expect(s.concreteYardsOrder).toBe(8); // 7.41 x 1.05 = 7.78 → 8.00
    expect(Object.keys(s.rebarWeightLbBySize)).toEqual(["#4"]);
    expect(s.holdDowns).toEqual([{ model: "Simpson HDU5", count: 4 }]);
    expect(s.warnings[0]).toBe("Not on plans: Slab vapor barrier spec (S1). Confirm with engineer.");
  });
});
