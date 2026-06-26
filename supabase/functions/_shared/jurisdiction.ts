// Shared helpers for inferring a US state from a free-form address and
// producing jurisdiction / compliance guidance for AI prompts (assistant + phone).

const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]),
);

export type Jurisdiction = {
  stateCode: string | null;
  stateName: string | null;
};

/** Best-effort detect a US state from a free-form address string. */
export function inferUsState(address?: string | null): Jurisdiction {
  if (!address) return { stateCode: null, stateName: null };
  const raw = String(address);

  // 1) Match ZIP-anchored code, e.g. ", CA 94016" or " CA 94016-1234"
  const zipMatch = raw.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipMatch && US_STATES[zipMatch[1]]) {
    return { stateCode: zipMatch[1], stateName: US_STATES[zipMatch[1]] };
  }

  // 2) Match comma-separated two-letter state code, e.g. ", CA,"
  const codeMatch = raw.match(/,\s*([A-Z]{2})(?:[\s,]|$)/);
  if (codeMatch && US_STATES[codeMatch[1]]) {
    return { stateCode: codeMatch[1], stateName: US_STATES[codeMatch[1]] };
  }

  // 3) Match full state name (case-insensitive, longest first to prefer "New York" over "York").
  const lower = raw.toLowerCase();
  const names = Object.keys(NAME_TO_CODE).sort((a, b) => b.length - a.length);
  for (const name of names) {
    const re = new RegExp(`\\b${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (re.test(lower)) {
      const code = NAME_TO_CODE[name];
      return { stateCode: code, stateName: US_STATES[code] };
    }
  }

  return { stateCode: null, stateName: null };
}

/**
 * Compliance guidance block injected into AI prompts. Intentionally generic
 * (the model already knows state-specific rules); we tell it which state to
 * apply and which contractor-business topics to cover.
 */
export function jurisdictionPromptBlock(orgAddress?: string | null, customerAddress?: string | null): string {
  const orgJ = inferUsState(orgAddress);
  const custJ = inferUsState(customerAddress);

  const lines: string[] = ["", "Jurisdiction & legal compliance:"];
  if (orgJ.stateName) lines.push(`- Business is based in ${orgJ.stateName} (${orgJ.stateCode}).`);
  if (custJ.stateName && custJ.stateCode !== orgJ.stateCode) {
    lines.push(`- Job/customer is located in ${custJ.stateName} (${custJ.stateCode}). Apply the JOB SITE state's rules for the contract, lien notices, and right-to-cancel; apply the BUSINESS state's rules for licensing disclosures.`);
  } else if (custJ.stateName) {
    lines.push(`- Job/customer is also in ${custJ.stateName}.`);
  }
  if (!orgJ.stateName && !custJ.stateName) {
    lines.push("- No US state detected from the address. Before drafting a contract, estimate, or invoice, ask which state the work will be performed in and apply that state's rules.");
  }
  lines.push(
    "- When drafting CONTRACTS, include clauses required by the applicable state's home-improvement / contractor laws, such as: contractor license number and classification, written scope of work, total price and payment schedule (and any statutory cap on deposits), start/substantial-completion dates, change-order procedure, mechanic's/construction lien notice in the wording the state requires, statutory right of rescission (e.g. 3-day notice of cancellation for home-solicitation sales), warranty language, dispute-resolution and governing-law clauses set to the job-site state, and any required consumer-protection or recovery-fund notices.",
    "- When drafting ESTIMATES and INVOICES, apply the correct state and local sales-tax treatment for the type of work (labor vs. materials, real-property improvements vs. repairs, exempt customers). If the tax treatment is unclear, ask before assuming a rate.",
    "- Disclose the business's license number on any contract, estimate, invoice, or advertisement when the state requires it. If the license number is missing from the business profile, ask for it instead of inventing one.",
    "- Never give the customer legal advice and never guarantee that a document is legally sufficient. Recommend a licensed attorney review of contracts before signing for large or unusual jobs.",
    "- Do not invent statutes, license numbers, bond amounts, or tax rates. If a required fact is missing, ask.",
  );
  return lines.join("\n");
}
