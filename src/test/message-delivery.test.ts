import { describe, expect, it } from "vitest";
import { documentTables, emailDeliveryStatus } from "../../supabase/functions/_shared/message-delivery";

describe("message delivery boundaries", () => {
  it("reads invoices and their items from the active organization tables", () => {
    expect(documentTables("invoice")).toEqual({ table: "org_invoices", items: "org_invoice_line_items", foreignKey: "invoice_id" });
    expect(documentTables("estimate").table).toBe("estimates");
  });
  it("does not mistake queue processing for delivery", () => {
    expect(emailDeliveryStatus()).toBe("queued");
    expect(emailDeliveryStatus("rate_limited")).toBe("queued");
    expect(emailDeliveryStatus("sent")).toBe("submitted");
    for (const status of ["failed", "dlq", "suppressed"]) expect(emailDeliveryStatus(status)).toBe("failed");
  });
});
