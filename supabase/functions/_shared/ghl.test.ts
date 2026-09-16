// Unit tests for the pure GHL invoice sync/mapping logic. Deno-only (no
// network, no live credentials) -- unlike ai-assistant/index.test.ts, this
// doesn't hit a deployed function. This sandbox doesn't have `deno`
// installed, so these couldn't be executed here; they're written to Deno's
// std test/assert API so they run under `deno test` (Supabase's own Edge
// Function runtime) or in CI.
import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGhlInvoiceItems, buildGhlInvoiceSyncFields } from "./ghl.ts";

Deno.test("buildGhlInvoiceItems maps description/quantity/unit_price to name/qty/amount in cents", () => {
  const items = buildGhlInvoiceItems([
    { description: "Drywall repair", quantity: 2, unit_price: 150.5 },
    { description: "Paint (2 coats)", quantity: 1, unit_price: 75 },
  ]);
  assertEquals(items, [
    { name: "Drywall repair", currency: "USD", amount: 15050, qty: 2 },
    { name: "Paint (2 coats)", currency: "USD", amount: 7500, qty: 1 },
  ]);
});

Deno.test("buildGhlInvoiceItems rounds fractional cents", () => {
  const items = buildGhlInvoiceItems([{ description: "Odd amount", quantity: 1, unit_price: 10.005 }]);
  assertEquals(items[0].amount, 1001);
});

Deno.test("buildGhlInvoiceItems throws on an empty line item list rather than sending a blank invoice", () => {
  assertThrows(() => buildGhlInvoiceItems([]), Error, "At least one line item is required");
});

Deno.test("buildGhlInvoiceSyncFields records the raw status and last-synced time for a non-paid invoice", () => {
  const fields = buildGhlInvoiceSyncFields({ status: "sent" });
  assertEquals(fields.ghl_invoice_status, "sent");
  assertEquals(fields.ghl_paid_at, undefined);
  assertEquals(typeof fields.ghl_last_synced_at, "string");
});

Deno.test("buildGhlInvoiceSyncFields sets ghl_paid_at from GHL's paidAt when the invoice is paid", () => {
  const fields = buildGhlInvoiceSyncFields({ status: "paid", paidAt: "2026-09-16T12:00:00.000Z" });
  assertEquals(fields.ghl_invoice_status, "paid");
  assertEquals(fields.ghl_paid_at, "2026-09-16T12:00:00.000Z");
});

Deno.test("buildGhlInvoiceSyncFields falls back to now() for ghl_paid_at when GHL didn't send paidAt", () => {
  const fields = buildGhlInvoiceSyncFields({ status: "paid" });
  assertEquals(fields.ghl_invoice_status, "paid");
  assertEquals(typeof fields.ghl_paid_at, "string");
});
