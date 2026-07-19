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

export function asComplianceSnapshot(value: unknown): ComplianceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<ComplianceSnapshot>;
  if (
    !candidate.state_code ||
    !candidate.state_name ||
    !candidate.document_type ||
    !candidate.rule_version ||
    !candidate.required_text
  ) return null;
  return {
    ...candidate,
    source_citations: Array.isArray(candidate.source_citations) ? candidate.source_citations : [],
  } as ComplianceSnapshot;
}

