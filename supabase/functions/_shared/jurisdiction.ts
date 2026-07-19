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

export type ComplianceCitation = {
  title: string;
  url: string;
};

export type ComplianceSnapshot = {
  state_code: string;
  state_name: string;
  document_type: "estimate" | "invoice" | "contract";
  job_site_address: string;
  rule_id: string;
  rule_version: number;
  required_text: string;
  source_citations: ComplianceCitation[];
  effective_on: string;
  reviewed_at: string;
  verified_at: string;
};

/** Best-effort detect a US state from a free-form address string. */
export function inferUsState(address?: string | null): Jurisdiction {
  if (!address) return { stateCode: null, stateName: null };
  const raw = String(address);
  const upper = raw.toUpperCase();

  // 1) Match ZIP-anchored code, e.g. ", CA 94016" or " CA 94016-1234"
  const zipMatch = upper.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/);
  if (zipMatch && US_STATES[zipMatch[1]]) {
    return { stateCode: zipMatch[1], stateName: US_STATES[zipMatch[1]] };
  }

  // 2) Match comma-separated two-letter state code, e.g. ", CA,"
  const codeMatch = upper.match(/,\s*([A-Z]{2})(?:[\s,]|$)/);
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

/** Safety instructions for AI drafting. Exact legal text is never sourced from
 * model memory; the server appends an approved, versioned compliance snapshot. */
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
    lines.push("- No US state was verified from the address. Ask for the complete job-site address before producing a final estimate, contract, or invoice.");
  }
  lines.push(
    "- Do not rely on model memory for statutes, required notices, deposit caps, cancellation periods, lien wording, licensing rules, or tax treatment.",
    "- Do not invent or paraphrase state-required legal language. FastTract appends exact text only from an approved, versioned compliance rule after the job-site state is verified.",
    "- Keep the document in draft and explain what is missing when the job-site state cannot be verified or its rule has not been reviewed.",
    "- Never choose a sales-tax rate from general knowledge. Use a contractor-entered, verified rate or ask for it.",
    "- Disclose the business's license number on any contract, estimate, invoice, or advertisement when the state requires it. If the license number is missing from the business profile, ask for it instead of inventing one.",
    "- Never give legal advice or guarantee that a document is legally sufficient. Recommend review by a lawyer licensed in the job-site state for unusual or high-value work.",
  );
  return lines.join("\n");
}

export function normalizeComplianceDocumentType(value?: string | null): ComplianceSnapshot["document_type"] | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("estimate") || normalized.includes("quote") || normalized.includes("proposal")) return "estimate";
  if (normalized.includes("invoice") || normalized.includes("receipt")) return "invoice";
  if (normalized.includes("contract") || normalized.includes("agreement") || normalized.includes("change_order")) return "contract";
  return null;
}
