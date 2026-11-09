import { describe, expect, it } from "vitest";
import {
  customerPayload, docNumber, invoicePayload, localBalance, paymentToRecord, shouldSync, signState, syncWarnings, verifyState,
} from "../../supabase/functions/_shared/quickbooks-map";

const inv = { id: "0f3c9b1e-aaaa-bbbb-cccc-000000000001", number: "BFC-1042", status: "sent", issue_date: "2026-11-09", due_date: "2026-11-23", subtotal: 4200, tax_amount: 0, total: 4200, amount_paid: 0, notes: "Thank you", terms: "50% deposit due on acceptance, balance on completion." };
const lines = [
  { description: "Driveway pour, 4\" 3000 PSI", quantity: 12, unit_price: 300, total: 3600, unit: "yd", position: 1 },
  { description: "Forming and finishing", quantity: 1, unit_price: 600, total: 600, unit: "ea", position: 0 },
];

describe("what gets synced", () => {
  it("skips drafts, syncs invoices that went out", () => {
    expect([shouldSync({ status: "draft" }), shouldSync({ status: "sent" }), shouldSync({ status: "Paid" }), shouldSync({ status: "void" })]).toEqual([false, true, true, true]);
  });
});

describe("QuickBooks payloads", () => {
  it("maps a customer without sending empty fields", () => {
    expect(customerPayload({ id: "c1", name: " Henderson ", email: "h@x.co", phone: null, address: "12 SE Main St" })).toEqual({
      DisplayName: "Henderson", PrimaryEmailAddr: { Address: "h@x.co" }, BillAddr: { Line1: "12 SE Main St" },
    });
    expect(customerPayload({ id: "abcdef123", name: "Park", email: null, phone: null, address: null }, true).DisplayName).toBe("Park (FT-abcdef)");
  });

  it("maps an invoice in line order with BFC's terms in the customer memo", () => {
    const p = invoicePayload(inv, lines, "58", "1");
    expect(p).toMatchObject({ DocNumber: "BFC-1042", TxnDate: "2026-11-09", DueDate: "2026-11-23", CustomerRef: { value: "58" } });
    expect(p.CustomerMemo.value).toBe("50% deposit due on acceptance, balance on completion.\n\nThank you");
    expect(p.Line.map((l) => [l.LineNum, l.Description, l.Amount, l.SalesItemLineDetail.Qty, l.SalesItemLineDetail.UnitPrice])).toEqual([
      [1, "Forming and finishing", 600, 1, 600],
      [2, "Driveway pour, 4\" 3000 PSI (yd)", 3600, 12, 300],
    ]);
  });

  it("keeps DocNumber within QuickBooks' 21 characters and falls back to an FT number", () => {
    expect(docNumber({ id: inv.id, number: "A-VERY-LONG-INVOICE-NUMBER-123" })).toHaveLength(21);
    expect(docNumber({ id: inv.id, number: null })).toBe("FT-0f3c9b1e");
  });
});

describe("payments", () => {
  it("records the difference between QuickBooks' balance and FastTract's, never twice", () => {
    expect(paymentToRecord(4200, { ...inv, amount_paid: 2100 })).toBe(2100); // deposit paid in FastTract
    expect(paymentToRecord(2100, { ...inv, amount_paid: 2100 })).toBe(0);    // already recorded: re-run is a no-op
    expect(paymentToRecord(2100, { ...inv, status: "paid", amount_paid: 2100 })).toBe(2100); // marked paid
    expect(localBalance({ ...inv, amount_paid: 5000 })).toBe(0);
  });
});

describe("warnings", () => {
  it("flags tax (not sent) and a subtotal that doesn't match the lines", () => {
    expect(syncWarnings({ ...inv, tax_amount: 33.6 }, lines)[0]).toMatch(/Sales tax of \$33.60 was not sent/);
    expect(syncWarnings({ ...inv, subtotal: 4000 }, lines)[0]).toMatch(/add up to \$4200.00/);
    expect(syncWarnings(inv, lines)).toEqual([]);
  });
});

describe("OAuth state", () => {
  it("round-trips a signed state and rejects tampering or expiry", async () => {
    const t = await signState({ org: "o1", user: "u1", exp: 2_000 }, "secret");
    expect(await verifyState(t, "secret", 1_000)).toEqual({ org: "o1", user: "u1", exp: 2_000 });
    expect(await verifyState(t, "other", 1_000)).toBeNull();
    expect(await verifyState(t, "secret", 3_000)).toBeNull();
    expect(await verifyState(t.replace(/^./, "x"), "secret", 1_000)).toBeNull();
  });
});
