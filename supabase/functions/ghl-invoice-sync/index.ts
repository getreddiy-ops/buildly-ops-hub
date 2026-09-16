// Links a FastTract invoice or estimate to an existing GHL invoice (created
// by the contractor in GHL's own UI -- FastTract can't create GHL invoices
// itself yet, see the comment above GhlInvoice in _shared/ghl.ts) and/or
// re-syncs its status/payment state via Get Invoice.
//
// Tenant isolation: the caller's organizationId is only ever used to look
// up (a) that organization's own membership row for the authenticated user
// and (b) that organization's own ghl_connections row. The GHL location the
// invoice is fetched from always comes from that stored connection's
// location_id -- never from anything the client sends -- so a ghlInvoiceId
// belonging to a different HighLevel location simply fails to fetch (GHL
// itself scopes the lookup by altId/altType) rather than ever being
// trusted at face value.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  buildGhlInvoiceSyncFields,
  ensureFreshConnection,
  getConnectionForOrg,
  getGhlInvoice,
  requiredSecret,
} from "../_shared/ghl.ts";

type Kind = "invoice" | "estimate";
type Action = "link" | "sync";
const KIND_TABLE: Record<Kind, string> = { invoice: "invoices", estimate: "estimates" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const { organizationId, action, kind, id, ghlInvoiceId } = (await req.json()) as {
      organizationId?: string;
      action?: Action;
      kind?: Kind;
      id?: string;
      ghlInvoiceId?: string;
    };
    if (!organizationId || !action || !kind || !id || !KIND_TABLE[kind]) {
      return json(400, { error: "organizationId, action, kind, and id are required" });
    }
    if (action === "link" && !ghlInvoiceId) {
      return json(400, { error: "ghlInvoiceId is required to link" });
    }

    const userClient = createClient(
      requiredSecret("SUPABASE_URL"),
      requiredSecret("SUPABASE_ANON_KEY"),
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return json(401, { error: "Unauthorized" });

    const admin = adminClient();
    const { data: membership } = await admin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership) return json(403, { error: "Not a member of this organization" });

    let connection = await getConnectionForOrg(admin, organizationId);
    if (!connection) return json(400, { error: "No HighLevel connection for this organization" });
    connection = await ensureFreshConnection(admin, connection);

    const table = KIND_TABLE[kind];
    const { data: record, error: recordError } = await admin
      .from(table)
      .select("id, ghl_invoice_id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (recordError || !record) return json(404, { error: `${kind} not found` });

    const invoiceId = action === "link" ? ghlInvoiceId! : record.ghl_invoice_id;
    if (!invoiceId) return json(400, { error: `This ${kind} has no linked HighLevel invoice yet` });

    let invoice;
    try {
      invoice = await getGhlInvoice(connection, invoiceId);
    } catch (fetchError) {
      return json(502, { error: `Could not fetch HighLevel invoice: ${(fetchError as Error).message}` });
    }

    const sync = buildGhlInvoiceSyncFields({ status: invoice.status, paidAt: invoice.paidAt });
    const patch: Record<string, unknown> =
      kind === "invoice"
        ? {
            ...sync,
            ...(invoice.status === "paid" ? { status: "paid" } : {}),
            ...(Number.isFinite(invoice.amountPaid) ? { amount_paid: invoice.amountPaid / 100 } : {}),
          }
        : {
            ...sync,
            ...(invoice.status === "paid"
              ? { deposit_collected: true, deposit_collected_at: invoice.paidAt ?? sync.ghl_paid_at }
              : {}),
          };
    if (action === "link") patch.ghl_invoice_id = invoiceId;

    const { data: updated, error: updateError } = await admin
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (updateError) return json(500, { error: updateError.message });

    return json(200, { synced: true, ghlInvoice: invoice, record: updated });
  } catch (error) {
    console.error("ghl-invoice-sync error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
