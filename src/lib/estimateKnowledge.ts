export type EstimateKnowledgeTemplate = {
  id: string;
  name: string;
  trade: string;
  notes: string;
  items: Array<{ description: string; quantity: number; unit_price: number }>;
};

export const estimateKnowledgeRules = [
  "Write for the customer, not like an internal cost sheet.",
  "Break the work into recognizable phases from preparation through cleanup.",
  "Never show Project Management as a separate customer-facing charge.",
  "Carry supervision, scheduling, admin, and coordination inside the work phases.",
  "State the scope, exclusions, timeline, payment terms, and change-order rule.",
  "Never invent measurements, quantities, materials, dates, or prices.",
];

const protections = `TIMELINE\nScheduling begins after approval and deposit. Exact dates depend on weather, inspections, access, crew scheduling, and material availability.\n\nPAYMENT TERMS\nDeposit due at approval. Balance due upon completion unless otherwise agreed in writing.\n\nEXCLUSIONS & CHANGES\nPermits, engineering, surveys, testing, hidden conditions, unsuitable soils, rock excavation, utility relocation, and work outside this scope are excluded. Added or changed work requires a written change order before proceeding.`;

export const estimateKnowledgeTemplates: EstimateKnowledgeTemplate[] = [
  {
    id: "general", name: "General Project", trade: "General Contracting",
    notes: `SCOPE OF WORK\nProvide labor, materials, equipment, supervision, and coordination to complete the listed work, including preparation, installation, cleanup, and final walkthrough. Replace this paragraph with the job's exact dimensions, materials, access, finish, removal, and customer expectations.\n\n${protections}`,
    items: [
      { description: "Site Preparation & Mobilization — job setup, protection, access planning, and preparation", quantity: 1, unit_price: 0 },
      { description: "Labor, Materials & Installation — complete the work described in the approved scope", quantity: 1, unit_price: 0 },
      { description: "Cleanup & Closeout — work-area cleanup, debris handling, and final walkthrough", quantity: 1, unit_price: 0 },
    ],
  },
  {
    id: "foundation", name: "Concrete Foundation", trade: "Concrete",
    notes: `SCOPE OF WORK\nLay out, form, reinforce, place, and finish the concrete foundation described in the project notes, including normal preparation, concrete handling, stripping, cleanup, and coordination. Add the verified dimensions, wall/footing sizes, reinforcement, embeds, access, and finish before sending.\n\n${protections}`,
    items: [
      { description: "Layout, Excavation & Preparation", quantity: 1, unit_price: 0 },
      { description: "Forming & Reinforcement", quantity: 1, unit_price: 0 },
      { description: "Concrete Placement & Finishing", quantity: 1, unit_price: 0 },
      { description: "Strip, Cleanup & Closeout", quantity: 1, unit_price: 0 },
    ],
  },
  {
    id: "flatwork", name: "Slab / Patio / Driveway", trade: "Concrete",
    notes: `SCOPE OF WORK\nPrepare and place the concrete flatwork described in the project notes, including layout, base preparation, forming, reinforcement, concrete placement, finishing, joints, cleanup, and coordination. Add verified dimensions, thickness, reinforcement, base, finish, access, removal, and cure requirements before sending.\n\n${protections}`,
    items: [
      { description: "Removal, Grading & Base Preparation", quantity: 1, unit_price: 0 },
      { description: "Forms & Reinforcement", quantity: 1, unit_price: 0 },
      { description: "Concrete Placement, Finish & Control Joints", quantity: 1, unit_price: 0 },
      { description: "Cleanup & Final Walkthrough", quantity: 1, unit_price: 0 },
    ],
  },
  {
    id: "repair", name: "Concrete / Structural Repair", trade: "Repair",
    notes: `SCOPE OF WORK\nComplete the listed repair using conditions visible at the time of estimate, including safe access, selective removal, preparation, repair installation, cleanup, and coordination. Add the repair location, verified extent, materials, access, and finish before sending. Concealed damage beyond the visible repair area is excluded.\n\n${protections}`,
    items: [
      { description: "Access, Protection & Selective Removal", quantity: 1, unit_price: 0 },
      { description: "Repair Preparation", quantity: 1, unit_price: 0 },
      { description: "Repair Labor & Materials", quantity: 1, unit_price: 0 },
      { description: "Cleanup & Closeout", quantity: 1, unit_price: 0 },
    ],
  },
  {
    id: "framing", name: "Framing / Remodel", trade: "Carpentry",
    notes: `SCOPE OF WORK\nComplete the listed framing or remodeling work, including protection, selective demolition where stated, layout, materials, installation, coordination, cleanup, and final walkthrough. Add verified dimensions, lumber, hardware, access, demolition, and connected trade work before sending.\n\n${protections}\nFinish painting, electrical, plumbing, HVAC, and concealed damage are excluded unless specifically listed.`,
    items: [
      { description: "Protection, Access & Selective Demolition", quantity: 1, unit_price: 0 },
      { description: "Framing Labor, Materials & Hardware", quantity: 1, unit_price: 0 },
      { description: "Field Adjustments & Trade Coordination", quantity: 1, unit_price: 0 },
      { description: "Cleanup & Closeout", quantity: 1, unit_price: 0 },
    ],
  },
];
