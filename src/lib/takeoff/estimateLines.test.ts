import { describe, expect, it } from "vitest";
import { normalizeTakeoff } from "../../../supabase/functions/_shared/takeoff-normalize";
import { summarizeTakeoff } from "./quantities";
import { matchMaterial, takeoffEstimateLines } from "./estimateLines";

const src = { sheet: "S1.0", detail: "1/S2.0", note: "#4 @ 18\" O.C. E.W." };

describe("normalizing the AI's takeoff", () => {
  it("keeps valid items, coerces numbers, and never fills a missing value", () => {
    const t = normalizeTakeoff({
      elements: [
        { id: "S1", kind: "slab", label: "Garage slab", lengthFt: "30", widthIn: 240, depthIn: 4, count: 1, formed: true, source: src, confidence: 0.95 },
        { id: "S1", kind: "slab", label: "Duplicate id", lengthFt: 1, source: src, confidence: 0.2 },
        { id: "X", kind: "roof", label: "Not concrete" },
      ],
      rebar: [
        { id: "R1", elementId: "S1", barSize: "#4", role: "grid_each_way", spacingIn: 18, lapIn: null, source: src, confidence: 0.9 },
        { id: "R2", elementId: "S1", barSize: "#99", role: "grid_each_way" },
        { id: "R3", elementId: "NOPE", barSize: "#5", role: "longitudinal", count: 2, source: src, confidence: 0.6 },
      ],
      anchorBolts: [], holdDowns: [], joints: [], constructionJointRule: "", missing: [{ what: "Lap length for #4 bars", elementId: "S1" }],
    });
    expect(t.elements.map((e) => e.id)).toEqual(["S1"]);
    expect(t.elements[0].lengthFt).toBe(30);
    expect(t.rebar.map((r) => r.id)).toEqual(["R1", "R3"]);
    expect(t.rebar[0].lapIn).toBeNull();
    expect(t.constructionJointRule).toBeNull();
    expect(t.missing.map((m) => m.what)).toEqual(["Lap length for #4 bars", 'R3 points at element "NOPE", which wasn\'t found on the plans']);
  });
});

describe("estimate lines", () => {
  const takeoff = normalizeTakeoff({
    elements: [{ id: "S1", kind: "slab", label: "Garage slab", lengthFt: 30, widthIn: 240, depthIn: 4, perimeterFt: 100, count: 1, formed: true, source: src, confidence: 0.9 }],
    rebar: [{ id: "R1", elementId: "S1", barSize: "#4", role: "grid_each_way", spacingIn: 18, coverIn: 3, lapIn: 24, source: src, confidence: 0.9 }],
    anchorBolts: [], holdDowns: [{ id: "HD1", model: "Simpson HDU5", count: 2, location: "corners", source: src, confidence: 0.8 }],
    joints: [], constructionJointRule: null, missing: [],
  });
  const summary = summarizeTakeoff(takeoff);
  const materials = [
    { id: "m1", name: "Ready Mix Concrete 3000 PSI", unit: "yd", unit_cost: 185 },
    { id: "m2", name: "#4 Rebar", unit: "lb", unit_cost: 0.95 },
  ];

  it("prices from the business's own material list and marks everything else as needing a price", () => {
    const lines = takeoffEstimateLines(summary, materials, 5);
    expect(lines[0]).toMatchObject({ quantity: 8, unit: "yd", unit_price: 185, material_id: "m1", price_needed: false });
    const rebar = lines.find((l) => l.description.startsWith("#4 rebar"))!;
    expect(rebar).toMatchObject({ unit: "lb", unit_price: 0.95, price_needed: false });
    const form = lines.find((l) => l.description.startsWith("Formwork"))!;
    expect(form).toMatchObject({ quantity: 100, unit_price: 0, price_needed: true });
    expect(form.description).toMatch(/price needed/);
    expect(lines.find((l) => l.description.includes("HDU5"))).toMatchObject({ quantity: 2, price_needed: true });
  });

  it("matches a material only when the unit matches too", () => {
    expect(matchMaterial([{ id: "a", name: "Concrete", unit: "bag", unit_cost: 6 }], ["concrete"], ["yd"])).toBeNull();
  });
});
