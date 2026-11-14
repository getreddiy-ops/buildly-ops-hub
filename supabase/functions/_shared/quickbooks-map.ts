// FastTract → QuickBooks Online mapping. Pure (no Deno, no fetch) so vitest can prove it.
// Direction is one-way: FastTract is where invoices are made; QuickBooks gets a copy, plus payments,
// so the books stay current without anyone re-typing invoices.

export interface LocalCustomer { id: string; name: string; email: string | null; phone: string | null; address: string | null }
export interface LocalInvoice {
  id: string; number: string | null; status: string; issue_date: string; due_date: string | null;
  subtotal: number; tax_amount: number; total: number; amount_paid: number; notes: string | null; terms: string | null;
}
export interface LocalLine { description: string; quantity: number; unit_price: number; total: number; category?: string | null; unit?: string | null; position: number }

/** Only invoices that have gone out (or been paid/voided) belong in the books; drafts stay in FastTract. */
export function shouldSync(inv: Pick<LocalInvoice, "status">): boolean {
  return ["sent", "paid", "partial", "overdue", "void"].includes(String(inv.status).toLowerCase());
}

/** QuickBooks DisplayName must be unique and ≤ 500 chars; a FastTract tag keeps it ours when names collide. */
export function customerPayload(c: LocalCustomer, disambiguate = false) {
  const name = (c.name || "Customer").trim().slice(0, 100);
  return {
    DisplayName: disambiguate ? `${name} (FT-${c.id.slice(0, 6)})` : name,
    ...(c.email ? { PrimaryEmailAddr: { Address: c.email.trim() } } : {}),
    ...(c.phone ? { PrimaryPhone: { FreeFormNumber: c.phone.trim().slice(0, 30) } } : {}),
    ...(c.address ? { BillAddr: { Line1: c.address.trim().slice(0, 500) } } : {}),
  };
}

/** QuickBooks DocNumber allows 21 characters. */
export function docNumber(inv: Pick<LocalInvoice, "number" | "id">): string {
  return (inv.number?.trim() || `FT-${inv.id.slice(0, 8)}`).slice(0, 21);
}

const money = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function invoicePayload(inv: LocalInvoice, lines: LocalLine[], customerId: string, itemId: string) {
  const sorted = [...lines].sort((a, b) => a.position - b.position);
  const memo = [inv.terms, inv.notes].filter(Boolean).join("\n\n").slice(0, 1000);
  return {
    DocNumber: docNumber(inv),
    TxnDate: inv.issue_date,
    ...(inv.due_date ? { DueDate: inv.due_date } : {}),
    CustomerRef: { value: customerId },
    ...(memo ? { CustomerMemo: { value: memo } } : {}),
    Line: sorted.map((l, i) => ({
      LineNum: i + 1,
      DetailType: "SalesItemLineDetail",
      Amount: money(Number(l.quantity) * Number(l.unit_price)),
      Description: [l.description, l.unit && l.unit !== "ea" ? `(${l.unit})` : null].filter(Boolean).join(" ").slice(0, 4000),
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: Number(l.quantity), UnitPrice: money(l.unit_price) },
    })),
  };
}

/** What the customer still owes, per FastTract. A "paid" status means nothing is owed even if amount_paid lags. */
export function localBalance(inv: Pick<LocalInvoice, "status" | "total" | "amount_paid">): number {
  if (String(inv.status).toLowerCase() === "paid") return 0;
  return Math.max(0, money(inv.total) - money(inv.amount_paid));
}

/**
 * Payment to record in QuickBooks so its balance matches FastTract's. Comparing balances (not summing
 * past syncs) means re-running the sync never double-posts a payment.
 */
export function paymentToRecord(qboBalance: number, inv: Pick<LocalInvoice, "status" | "total" | "amount_paid">): number {
  const diff = money(Number(qboBalance) - localBalance(inv));
  return diff > 0.004 ? diff : 0;
}

/** Warnings worth showing next to a synced invoice. */
export function syncWarnings(inv: LocalInvoice, lines: LocalLine[]): string[] {
  const w: string[] = [];
  if (money(inv.tax_amount) > 0) w.push(`Sales tax of $${money(inv.tax_amount).toFixed(2)} was not sent; set tax on this invoice in QuickBooks.`);
  const lineSum = money(lines.reduce((a, l) => a + Number(l.quantity) * Number(l.unit_price), 0));
  if (Math.abs(lineSum - money(inv.subtotal)) > 0.01) w.push(`Line items add up to $${lineSum.toFixed(2)} but the invoice subtotal is $${money(inv.subtotal).toFixed(2)}.`);
  return w;
}

// ---------- OAuth state: signed so the callback knows which business started the connection ----------

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data))));
}

export interface ConnectState { org: string; user: string; exp: number }

export async function signState(s: ConnectState, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(s)));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyState(token: string, secret: string, now = Date.now()): Promise<ConnectState | null> {
  const [body, sig] = String(token).split(".");
  if (!body || !sig || (await hmac(secret, body)) !== sig) return null;
  try {
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as ConnectState;
    return s.exp > now ? s : null;
  } catch {
    return null;
  }
}

export function apiBase(env: string): string {
  return env === "sandbox" ? "https://sandbox-quickbooks.api.intuit.com" : "https://quickbooks.api.intuit.com";
}
