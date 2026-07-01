// Statutory paid-sick-leave / PTO accrual defaults by US state.
// Source: state paid-sick-leave statutes (rates verified 2024-2025).
// These are DEFAULTS; an org can override via public.pto_policies.
// Notes are intentionally short — call out state law when displaying to users.

export type PtoRule = {
  accrualHoursPerHourWorked: number; // e.g. 1/30 = 0.0333
  annualCapHours: number;            // employer may cap use per year
  carryoverCapHours: number | null;  // null = unlimited
  waitingPeriodDays: number;         // days before use is allowed
  citation: string;                  // short statute name
  summary: string;                   // one-line explainer
};

export const DEFAULT_RULE: PtoRule = {
  accrualHoursPerHourWorked: 1 / 40, // 1hr per 40 worked (common baseline)
  annualCapHours: 40,
  carryoverCapHours: 40,
  waitingPeriodDays: 90,
  citation: "Company default",
  summary: "No state statute detected — using a conservative 1 hour per 40 worked, capped at 40/year.",
};

// Only states with a statewide paid sick / PTO accrual law are listed.
// Everywhere else we fall back to DEFAULT_RULE (or the org's policy override).
export const STATE_RULES: Record<string, PtoRule> = {
  CA: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 80, waitingPeriodDays: 90,
        citation: "CA Labor Code §246 (Healthy Workplaces, Healthy Families Act)",
        summary: "1 hour per 30 worked. Use capped at 40 hrs/year, accrual cap 80 hrs, 90-day waiting period." },
  CO: { accrualHoursPerHourWorked: 1/30, annualCapHours: 48, carryoverCapHours: 48, waitingPeriodDays: 0,
        citation: "CO Healthy Families & Workplaces Act",
        summary: "1 hour per 30 worked, up to 48 hrs/year. Immediate accrual, 48-hr carryover." },
  CT: { accrualHoursPerHourWorked: 1/40, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 120,
        citation: "CT Gen. Stat. §31-57r (as amended 2024)",
        summary: "1 hour per 40 worked, capped at 40 hrs/year, 120-day waiting period." },
  DC: { accrualHoursPerHourWorked: 1/37, annualCapHours: 56, carryoverCapHours: null, waitingPeriodDays: 90,
        citation: "DC Accrued Sick & Safe Leave Act (25+ employees)",
        summary: "1 hour per 37 worked (mid-size employers), 7 days/year, 90-day waiting period." },
  IL: { accrualHoursPerHourWorked: 1/40, annualCapHours: 40, carryoverCapHours: 80, waitingPeriodDays: 90,
        citation: "IL Paid Leave for All Workers Act",
        summary: "1 hour per 40 worked, 40 hrs/year, 90-day waiting period." },
  MA: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "MA Earned Sick Time Law (M.G.L. c.149 §148C)",
        summary: "1 hour per 30 worked, 40 hrs/year, 90-day waiting period." },
  MD: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 106,
        citation: "MD Healthy Working Families Act",
        summary: "1 hour per 30 worked, 40 hrs/year, ~15-week waiting period." },
  ME: { accrualHoursPerHourWorked: 1/40, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 120,
        citation: "ME Earned Paid Leave Act (26 M.R.S. §637)",
        summary: "1 hour per 40 worked, 40 hrs/year, 120-day waiting period. Usable for any reason." },
  MI: { accrualHoursPerHourWorked: 1/30, annualCapHours: 72, carryoverCapHours: null, waitingPeriodDays: 120,
        citation: "MI Earned Sick Time Act (eff. 2025)",
        summary: "1 hour per 30 worked, up to 72 hrs/year, 120-day waiting period." },
  MN: { accrualHoursPerHourWorked: 1/30, annualCapHours: 48, carryoverCapHours: 80, waitingPeriodDays: 0,
        citation: "MN Earned Sick and Safe Time",
        summary: "1 hour per 30 worked, 48 hrs/year, 80-hr carryover." },
  NJ: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 120,
        citation: "NJ Earned Sick Leave Law",
        summary: "1 hour per 30 worked, 40 hrs/year, 120-day waiting period." },
  NM: { accrualHoursPerHourWorked: 1/30, annualCapHours: 64, carryoverCapHours: null, waitingPeriodDays: 0,
        citation: "NM Healthy Workplaces Act",
        summary: "1 hour per 30 worked, up to 64 hrs/year, immediate accrual." },
  NV: { accrualHoursPerHourWorked: 0.01923, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "NV Rev. Stat. §608.0197 (50+ employees)",
        summary: "0.01923 hr per hour worked (~40 hrs/year), 90-day waiting period." },
  NY: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 0,
        citation: "NY Labor Law §196-b",
        summary: "1 hour per 30 worked, 40-56 hrs/year depending on size, immediate accrual." },
  OR: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "OR ORS §653.606",
        summary: "1 hour per 30 worked, 40 hrs/year, 90-day waiting period." },
  RI: { accrualHoursPerHourWorked: 1/35, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "RI Healthy and Safe Families and Workplaces Act",
        summary: "1 hour per 35 worked, 40 hrs/year, 90-day waiting period." },
  VT: { accrualHoursPerHourWorked: 1/52, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 365,
        citation: "VT 21 V.S.A. §481",
        summary: "1 hour per 52 worked, 40 hrs/year, 1-year waiting period." },
  WA: { accrualHoursPerHourWorked: 1/40, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "WA RCW §49.46.210",
        summary: "1 hour per 40 worked, 90-day waiting period, 40-hr carryover." },
  AZ: { accrualHoursPerHourWorked: 1/30, annualCapHours: 40, carryoverCapHours: 40, waitingPeriodDays: 90,
        citation: "AZ Fair Wages and Healthy Families Act",
        summary: "1 hour per 30 worked, 40 hrs/year (24 for small employers), 90-day waiting period." },
};

export function ruleForState(stateCode?: string | null, override?: Partial<PtoRule> | null): PtoRule {
  const base = (stateCode && STATE_RULES[stateCode]) || DEFAULT_RULE;
  return { ...base, ...(override ?? {}) };
}

/** Compute accrued/used/available balance given hours worked and time-off taken. */
export function computeBalance(
  rule: PtoRule,
  hoursWorked: number,
  hoursTaken: number,
) {
  const accrued = Math.min(hoursWorked * rule.accrualHoursPerHourWorked, rule.annualCapHours);
  const available = Math.max(0, accrued - hoursTaken);
  return {
    accruedHours: Math.round(accrued * 100) / 100,
    usedHours: Math.round(hoursTaken * 100) / 100,
    availableHours: Math.round(available * 100) / 100,
  };
}
