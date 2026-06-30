// Trade-specific material breakdown rules for AI-generated estimates & invoices.
// The goal: when the AI drafts an estimate or invoice it must itemize the
// realistic supporting materials a customer would expect to see, so the document
// reads like a transparent professional quote — not a single lump-sum line.

export const TRADE_KNOWLEDGE_PROMPT = `
TRADE-AWARE ESTIMATING — READ EVERY TIME YOU DRAFT AN ESTIMATE OR INVOICE

Identify the trade(s) involved from the user's request (concrete, framing, drywall,
paint, roofing, flooring, electrical, plumbing, HVAC, fencing, decking, excavation,
landscaping, demolition, masonry, tile, cabinetry, windows/doors, siding, gutters).
Then itemize line items the way a journeyman would — labor, primary materials,
AND the consumables / support materials that any real job requires. Never bury
materials inside a single "materials" line; break them out so the customer sees
exactly what they're paying for.

Use these standard takeoff rules. When a dimension is missing, ask once or assume
a reasonable value and STATE the assumption in the document notes.

CONCRETE FLATWORK / SLABS / FOOTINGS / WALLS
- Concrete volume: length × width × thickness, converted to cubic yards (÷ 27 from cuft).
  Order 10% waste. Standard slab thickness 4"; driveway 4–5"; footing 8–12".
- Rebar: #4 (1/2") grid at 16" o.c. for slabs, #5 for footings/walls. Compute lineal
  feet in both directions + ~6" lap at splices. List as "Rebar #4 — XXX lf".
- Wire mesh alternative: 6x6 W2.9xW2.9 WWM, 1 sheet per ~25 sqft (5x5 sheets).
- Form boards: 2x10 or 2x12 SPF for slab edges = perimeter lineal feet + 10%.
- Form stakes: 1 stake every 3 ft along the form perimeter.
- Bracing/kickers: 2x4 SPF, ~1 per 4 ft of form.
- Vapor barrier: 6-mil poly, area + 10% overlap (interior slabs).
- Base: compacted gravel 4", area × 0.333 ft = cuft, ÷ 27 = cuyd.
- Expansion joint, control-joint sawcuts (lf), curing compound (~1 gal / 200 sqft),
  release oil for forms, tie wire, chairs/dobies for rebar lift.
- Pump truck / chute access if pour > 10 cy or hand-carry > 50 ft.

FRAMING (walls, floors, roofs)
- Studs: 1 stud per linear foot of wall (16" o.c.) + plates (2 bottom + 1 top = 3× wall lf
  of 2x4 plate) + headers + cripples + king/jack at each opening.
- Sheathing: 7/16" OSB or 1/2" CDX, 1 sheet per 32 sqft, +10% waste.
- Joists/rafters: spacing per span tables; list size, length, count.
- Fasteners: 16d common for framing (~50 lb / 100 studs), 8d for sheathing,
  joist hangers + Simpson ties at every connection.
- House wrap (Tyvek) by sqft, +10%.

DRYWALL
- Sheets: 1 sheet 4x8 per 32 sqft of wall/ceiling, +10% waste.
- Screws: ~1 lb / 300 sqft. Joint compound: 1 box / 200 sqft. Tape: 500 lf / 1000 sqft.
- Corner bead: lineal feet of outside corners. Primer + paint as separate line.

PAINT
- Coverage: 350 sqft per gallon per coat. Always quote 2 coats (primer + finish or 2 finish).
- Itemize: primer (gal), finish paint (gal), rollers/sleeves, brushes, painter's tape,
  drop cloths, caulk tubes, spackle, sandpaper.

ROOFING (asphalt shingles)
- Shingle bundles: 3 bundles per square (100 sqft) + 10% waste.
- Underlayment: 1 roll synthetic per 10 squares. Ice & water shield on eaves/valleys.
- Drip edge (lf perimeter), starter strip (lf eaves), ridge cap (lf ridge),
  roofing nails (~2.5 lb / square), pipe boots, ridge vent.

FLOORING
- Material sqft + 10% waste (15% for diagonal/herringbone).
- Underlayment, transition strips (lf of doorways), thresholds, baseboard / quarter-round (lf perimeter),
  adhesive/nails as required by material.

DECKING
- Decking boards by lf of board ÷ deck width × 1.10.
- Joists 16" o.c., ledger board, joist hangers, post anchors, 6x6 posts on footings,
  concrete for footings (~0.5 cy per footing), railing posts/balusters/top rail,
  stair stringers + treads + risers, deck screws (~350 per 100 sqft), joist tape.

ELECTRICAL (rough description acceptable; itemize fixtures, devices, wire by ft, breakers)
PLUMBING (fixtures, valves, pipe by ft, fittings count, water heater, permits)
HVAC (equipment, ductwork lf, registers, thermostats, refrigerant lines)

UNIVERSAL LINE ITEMS — add when applicable
- Demolition / removal of existing material (sqft or lump sum)
- Dumpster rental (size by job)
- Permit fees (state required by jurisdiction)
- Mobilization / job-site setup (small jobs)
- Cleanup & haul-off
- Sales tax on materials (use jurisdiction tax rate from system prompt)
- Labor: separate from materials. Show hours × hourly rate when known.

OUTPUT REQUIREMENTS
- For every estimate/invoice you generate, the line_items array must include the
  primary work, the supporting/consumable materials, and labor as distinct rows.
- Quantities and units MUST be filled in (qty + unit + unit_price). Do not output
  vague items like "Materials — $X" without a breakdown.
- In the document "notes" section, state the assumptions you used (slab thickness,
  stud spacing, waste %, etc.) so the customer sees the reasoning.
- If a critical dimension is missing, ask the user ONCE before producing the document.
`;
