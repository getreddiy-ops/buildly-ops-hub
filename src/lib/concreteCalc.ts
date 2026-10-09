/**
 * Deterministic concrete quantity helpers for flatwork / slabs.
 * Quantities only — never invents prices. Contractor fills unit prices.
 */

export type ConcreteJobType = "slab" | "footing" | "wall";

export type ConcreteCalcInput = {
  lengthFt: number;
  widthFt: number;
  thicknessIn: number;
  /** Optional: for walls, treat width as height */
  jobType?: ConcreteJobType;
  /** Waste / overage percent, e.g. 10 => order 10% extra */
  overagePct?: number;
  /** Rebar spacing in inches on center; omit to skip rebar calc */
  rebarSpacingIn?: number;
  /** Include formwork linear feet around perimeter */
  includeFormwork?: boolean;
};

export type ConcreteCalcLine = {
  description: string;
  quantity: number;
  unit: string;
  /** Always 0 — prices come from the contractor's rate book / materials */
  unit_price: number;
};

export type ConcreteCalcResult = {
  areaSqFt: number;
  volumeCuFt: number;
  yardsRaw: number;
  yardsOrder: number;
  perimeterFt: number;
  rebarLf: number | null;
  formworkLf: number | null;
  lines: ConcreteCalcLine[];
  notes: string;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const ceil2 = (n: number) => Math.ceil(n * 100) / 100;

/** Cubic yards from L×W×thickness (inches). */
export function concreteYards(
  lengthFt: number,
  widthFt: number,
  thicknessIn: number,
  overagePct = 0,
): { areaSqFt: number; volumeCuFt: number; yardsRaw: number; yardsOrder: number } {
  const areaSqFt = lengthFt * widthFt;
  const volumeCuFt = areaSqFt * (thicknessIn / 12);
  const yardsRaw = volumeCuFt / 27;
  const yardsOrder = ceil2(yardsRaw * (1 + overagePct / 100));
  return { areaSqFt: round2(areaSqFt), volumeCuFt: round2(volumeCuFt), yardsRaw: round2(yardsRaw), yardsOrder };
}

/**
 * Approximate rebar linear feet for a rectangular mat at given spacing.
 * Simple grid: bars in both directions, no hooks/laps (contractor adjusts).
 */
export function rebarLinearFeet(
  lengthFt: number,
  widthFt: number,
  spacingIn: number,
): number {
  if (spacingIn <= 0) return 0;
  const spacingFt = spacingIn / 12;
  const barsAlongLength = Math.floor(widthFt / spacingFt) + 1;
  const barsAlongWidth = Math.floor(lengthFt / spacingFt) + 1;
  const lf = barsAlongLength * lengthFt + barsAlongWidth * widthFt;
  return round2(lf);
}

/** Perimeter in feet (formwork for a simple rectangle). */
export function perimeterFeet(lengthFt: number, widthFt: number): number {
  return round2(2 * (lengthFt + widthFt));
}

export function calculateConcrete(input: ConcreteCalcInput): ConcreteCalcResult {
  const {
    lengthFt,
    widthFt,
    thicknessIn,
    overagePct = 10,
    rebarSpacingIn,
    includeFormwork = true,
    jobType = "slab",
  } = input;

  if (lengthFt <= 0 || widthFt <= 0 || thicknessIn <= 0) {
    throw new Error("Length, width, and thickness must be greater than zero");
  }

  const { areaSqFt, volumeCuFt, yardsRaw, yardsOrder } = concreteYards(
    lengthFt,
    widthFt,
    thicknessIn,
    overagePct,
  );
  const perimeterFt = perimeterFeet(lengthFt, widthFt);
  const rebarLf =
    rebarSpacingIn != null && rebarSpacingIn > 0
      ? rebarLinearFeet(lengthFt, widthFt, rebarSpacingIn)
      : null;
  const formworkLf = includeFormwork ? perimeterFt : null;

  const typeLabel =
    jobType === "footing" ? "footing" : jobType === "wall" ? "wall" : "slab";

  const lines: ConcreteCalcLine[] = [
    {
      description: `Ready-mix concrete — ${lengthFt}' × ${widthFt}' × ${thicknessIn}" ${typeLabel} (${yardsOrder} cy incl. ${overagePct}% overage; net ${yardsRaw} cy)`,
      quantity: yardsOrder,
      unit: "cy",
      unit_price: 0,
    },
  ];

  if (rebarLf != null) {
    lines.push({
      description: `Rebar — #4 mat @ ${rebarSpacingIn}" o.c. each way (approx ${rebarLf} LF; no lap/hook allowance)`,
      quantity: rebarLf,
      unit: "lf",
      unit_price: 0,
    });
  }

  if (formworkLf != null) {
    lines.push({
      description: `Formwork — perimeter forms (${formworkLf} LF)`,
      quantity: formworkLf,
      unit: "lf",
      unit_price: 0,
    });
  }

  lines.push(
    {
      description: "Labor — place, finish, control joints",
      quantity: 1,
      unit: "ls",
      unit_price: 0,
    },
    {
      description: "Site prep / base / cleanup",
      quantity: 1,
      unit: "ls",
      unit_price: 0,
    },
  );

  const notes = [
    `CONCRETE QUANTITY WORKSHEET (verify on-site)`,
    `Dimensions: ${lengthFt}' L × ${widthFt}' W × ${thicknessIn}" thick (${typeLabel})`,
    `Area: ${areaSqFt} sq ft · Volume: ${volumeCuFt} cu ft · Net: ${yardsRaw} cy · Order: ${yardsOrder} cy (${overagePct}% overage)`,
    rebarLf != null
      ? `Rebar: ~${rebarLf} LF at ${rebarSpacingIn}" o.c. each way (add laps/hooks as required)`
      : null,
    formworkLf != null ? `Formwork perimeter: ${formworkLf} LF` : null,
    `Unit prices left at $0 — fill from your rate book / materials before sending.`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    areaSqFt,
    volumeCuFt,
    yardsRaw,
    yardsOrder,
    perimeterFt,
    rebarLf,
    formworkLf,
    lines,
    notes,
  };
}
