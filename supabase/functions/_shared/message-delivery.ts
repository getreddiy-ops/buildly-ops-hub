// A queue worker returning HTTP 200 does not prove any particular email was sent.
export function emailDeliveryStatus(logStatus?: string | null) {
  if (logStatus === "sent") return "submitted";
  if (["failed", "dlq", "suppressed"].includes(logStatus ?? "")) return "failed";
  return "queued";
}

export function documentTables(type: "estimate" | "invoice") {
  return type === "estimate"
    ? { table: "estimates", items: "estimate_line_items", foreignKey: "estimate_id" }
    : { table: "org_invoices", items: "org_invoice_line_items", foreignKey: "invoice_id" };
}
