// QuickBooks Online for a FastTract business: connect, status, disconnect, and sync.
// Sync is one-way, FastTract → QuickBooks: customers, invoices that have gone out, payments, voids.
// Owners and admins only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type LocalCustomer, type LocalInvoice, type LocalLine,
  customerPayload, invoicePayload, paymentToRecord, shouldSync, signState, syncWarnings,
} from "../_shared/quickbooks-map.ts";
import {
  type QbConnection, QbError, ensureItem, escapeQuery, getConnection, logSync, mappedId, qb, qbConfig, qbQuery, revokeToken,
} from "../_shared/quickbooks.ts";

const MAX_PER_RUN = 50;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function syncCustomer(admin: SupabaseClient, conn: QbConnection, orgId: string, c: LocalCustomer): Promise<string> {
  const existing = await mappedId(admin, orgId, "customer", c.id);
  if (existing) return existing;
  // Reuse a QuickBooks customer with the same name rather than creating a duplicate.
  const byName = await qbQuery(conn, `select Id from Customer where DisplayName = '${escapeQuery(customerPayload(c).DisplayName)}'`);
  let id: string | undefined = byName.Customer?.[0]?.Id;
  if (!id) id = (await qb(conn, "POST", "customer", customerPayload(c))).Customer.Id;
  await logSync(admin, { organization_id: orgId, entity_type: "customer", local_id: c.id, quickbooks_id: id, status: "success" });
  return id!;
}

async function syncInvoice(admin: SupabaseClient, conn: QbConnection, orgId: string, inv: LocalInvoice & { customer_id: string | null }, itemId: string) {
  const qbId = await mappedId(admin, orgId, "invoice", inv.id);
  const status = String(inv.status).toLowerCase();

  if (status === "void") {
    if (!qbId) return { id: inv.id, result: "skipped", note: "Void and never sent to QuickBooks" };
    const cur = (await qb(conn, "GET", `invoice/${qbId}`)).Invoice;
    if (Number(cur.TotalAmt) !== 0) { // a voided QuickBooks invoice has a zero total
      await qb(conn, "POST", "invoice", { Id: qbId, SyncToken: cur.SyncToken }, { operation: "void" });
    }
    await logSync(admin, { organization_id: orgId, entity_type: "invoice", local_id: inv.id, quickbooks_id: qbId, status: "success", error: "voided" });
    return { id: inv.id, result: "voided" };
  }

  if (!inv.customer_id) throw new Error("Invoice has no customer");
  const { data: customer } = await admin.from("customers").select("id, name, email, phone, address").eq("id", inv.customer_id).single();
  const customerId = await syncCustomer(admin, conn, orgId, customer as LocalCustomer);
  const { data: lines } = await admin.from("org_invoice_line_items").select("description, quantity, unit_price, total, category, unit, position").eq("invoice_id", inv.id);
  const payload = invoicePayload(inv, (lines ?? []) as LocalLine[], customerId, itemId);
  const warnings = syncWarnings(inv, (lines ?? []) as LocalLine[]);

  let saved;
  if (qbId) {
    const cur = (await qb(conn, "GET", `invoice/${qbId}`)).Invoice;
    saved = (await qb(conn, "POST", "invoice", { ...payload, Id: qbId, SyncToken: cur.SyncToken, sparse: true })).Invoice;
  } else {
    saved = (await qb(conn, "POST", "invoice", payload)).Invoice;
  }

  // Bring QuickBooks' balance in line with FastTract's by recording the difference as a payment.
  const pay = paymentToRecord(Number(saved.Balance), inv);
  if (pay > 0) {
    const p = await qb(conn, "POST", "payment", {
      CustomerRef: { value: customerId }, TotalAmt: pay, TxnDate: new Date().toISOString().slice(0, 10),
      PrivateNote: `Recorded from FastTract invoice ${payload.DocNumber}`,
      Line: [{ Amount: pay, LinkedTxn: [{ TxnId: saved.Id, TxnType: "Invoice" }] }],
    });
    await logSync(admin, { organization_id: orgId, entity_type: "payment", local_id: inv.id, quickbooks_id: p.Payment.Id, status: "success", error: `$${pay.toFixed(2)}` });
  }
  await logSync(admin, { organization_id: orgId, entity_type: "invoice", local_id: inv.id, quickbooks_id: saved.Id, status: "success", error: warnings.join(" ") || null });
  return { id: inv.id, result: qbId ? "updated" : "created", payment: pay || undefined, warnings };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user || user.is_anonymous) return json(401, { error: "Unauthorized" });

  let body: { action?: string; organizationId?: string; invoiceIds?: string[] };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const orgId = String(body.organizationId ?? "");
  if (!orgId) return json(400, { error: "organizationId is required" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await admin.rpc("is_org_admin", { _user_id: user.id, _org_id: orgId });
  if (!isAdmin) return json(403, { error: "Only the business owner or an admin can manage QuickBooks" });

  try {
    if (body.action === "status") {
      const { data } = await admin.from("quickbooks_connections").select("environment, created_at, updated_at").eq("organization_id", orgId).maybeSingle();
      const { data: recent } = await admin.from("quickbooks_sync_log").select("entity_type, status, error, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(10);
      let companyName: string | null = null;
      if (data) {
        try {
          const conn = await getConnection(admin, orgId);
          if (conn) companyName = (await qb(conn, "GET", `companyinfo/${conn.realm_id}`)).CompanyInfo?.CompanyName ?? null;
        } catch (e) { return json(200, { connected: true, healthy: false, error: (e as Error).message, recent }); }
      }
      return json(200, { connected: !!data, healthy: !!data, companyName, environment: data?.environment ?? null, recent: recent ?? [] });
    }

    if (body.action === "start") {
      const { clientId, clientSecret, redirectUri } = qbConfig();
      const state = await signState({ org: orgId, user: user.id, exp: Date.now() + 15 * 60_000 }, clientSecret);
      const url = new URL("https://appcenter.intuit.com/connect/oauth2");
      url.search = new URLSearchParams({ client_id: clientId, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: redirectUri, state }).toString();
      return json(200, { url: url.toString() });
    }

    if (body.action === "disconnect") {
      const { data } = await admin.from("quickbooks_connections").select("refresh_token").eq("organization_id", orgId).maybeSingle();
      if (data?.refresh_token) await revokeToken(data.refresh_token);
      await admin.from("quickbooks_connections").delete().eq("organization_id", orgId);
      return json(200, { disconnected: true });
    }

    // Default: sync. Either the invoices named, or everything changed since the last sync.
    const conn = await getConnection(admin, orgId);
    if (!conn) return json(409, { error: "Connect QuickBooks first", code: "quickbooks_not_connected" });

    let q = admin.from("org_invoices").select("id, number, status, issue_date, due_date, subtotal, tax_amount, total, amount_paid, notes, terms, customer_id, updated_at").eq("organization_id", orgId);
    if (body.invoiceIds?.length) q = q.in("id", body.invoiceIds.slice(0, MAX_PER_RUN));
    else {
      const { data: last } = await admin.from("quickbooks_sync_log").select("created_at").eq("organization_id", orgId).eq("entity_type", "run").eq("status", "success").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last?.created_at) q = q.gt("updated_at", last.created_at);
    }
    const { data: invoices, error } = await q.order("updated_at").limit(MAX_PER_RUN);
    if (error) throw error;

    const itemId = await ensureItem(conn);
    const results = [];
    for (const inv of (invoices ?? []) as (LocalInvoice & { customer_id: string | null })[]) {
      if (!shouldSync(inv)) { results.push({ id: inv.id, result: "skipped", note: "Draft" }); continue; }
      try {
        results.push(await syncInvoice(admin, conn, orgId, inv, itemId));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await logSync(admin, { organization_id: orgId, entity_type: "invoice", local_id: inv.id, status: "error", error: message.slice(0, 500) });
        results.push({ id: inv.id, result: "error", error: message });
      }
    }
    const failed = results.filter((r) => r.result === "error").length;
    if (!body.invoiceIds?.length && !failed) await logSync(admin, { organization_id: orgId, entity_type: "run", local_id: null, status: "success", error: `${results.length} invoice(s)` });
    return json(200, { synced: results.length - failed, failed, more: (invoices ?? []).length === MAX_PER_RUN, results });
  } catch (e) {
    console.error("quickbooks error", e);
    if (e instanceof QbError && e.status === 401) return json(409, { error: "QuickBooks needs to be reconnected", code: "quickbooks_reconnect" });
    return json(500, { error: e instanceof Error ? e.message : "QuickBooks request failed" });
  }
});
