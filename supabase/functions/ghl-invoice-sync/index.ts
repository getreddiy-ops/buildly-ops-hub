// Links a FastTract invoice or estimate to an existing GHL invoice (created
// by the contractor in GHL's own UI -- FastTract still can't create GHL
// invoices itself, see the comment above GhlInvoice in _shared/ghl.ts),
// pushes FastTract's current header/line items into an already-linked GHL
// invoice via Update Invoice, and/or re-syncs status/payment state via Get
// Invoice.
//
// Tenant isolation: the caller's organizationId is only ever used to look
// up (a) that organization's own membership row for the authenticated user
// and (b) that organization's own ghl_connections row. The GHL location an
// invoice is fetched from or updated against always comes from that stored
// connection's location_id -- never from anything the client sends -- so a
// ghlInvoiceId belonging to a different HighLevel location simply fails to
// fetch/update (GHL itself scopes the lookup by altId/altType) rather than
// ever being trusted at face value.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  buildGhlInvoiceItems,
  buildGhlInvoiceSyncFields,
  ensureFreshConnection,
  getConnectionForOrg,
  getGhlInvoice,
  requiredSecret,
  updateGhlInvoice,
  type GhlBusinessDetails,
  type GhlContactDetails,
} from "../_shared/ghl.ts";

type Kind = "invoice" | "estimate";
type Action = "link" | "sync" | "update";
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

    const { organizationId, action, kind, id, ghlInvoiceId, confirm } = (await req.json()) as {
      organizationId?: string;
      action?: Action;
      kind?: Kind;
      id?: string;
      ghlInvoiceId?: string;
      confirm?: boolean;
    };
    if (!organizationId || !action || !kind || !id || !KIND_TABLE[kind]) {
      return json(400, { error: "organizationId, action, kind, and id are required" });
    }
    if (action === "link" && !ghlInvoiceId) {
      return json(400, { error: "ghlInvoiceId is required to link" });
    }
    if (action === "update" && kind !== "invoice") {
      return json(400, { error: "Pushing updates to HighLevel is only supported for invoices right now" });
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

    if (action === "update") {
      const { data: invoice, error: invoiceError } = await admin
        .from("invoices")
        .select("id, ghl_invoice_id, number, issue_date, due_date, customer_id, terms")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (invoiceError || !invoice) return json(404, { error: "invoice not found" });
      if (!invoice.ghl_invoice_id) {
        return json(400, { error: "Link this invoice to a HighLevel invoice before updating it" });
      }
      if (!invoice.due_date) {
        return json(400, { error: "Set a due date before syncing to HighLevel (Update Invoice requires one)" });
      }

      const { data: lineItems } = await admin
        .from("invoice_line_items")
        .select("description, quantity, unit_price")
        .eq("invoice_id", id)
        .order("position");

      let items;
      try {
        items = buildGhlInvoiceItems(
          (lineItems ?? []).map((li) => ({
            description: li.description,
            quantity: Number(li.quantity),
            unit_price: Number(li.unit_price),
          })),
        );
      } catch (itemsError) {
        return json(400, { error: `Could not build HighLevel line items: ${(itemsError as Error).message}` });
      }

      let contactDetails: GhlContactDetails | undefined;
      if (invoice.customer_id) {
        const { data: customer } = await admin
          .from("customers")
          .select("name, email, phone, ghl_contact_id")
          .eq("id", invoice.customer_id)
          .maybeSingle();
        if (customer?.ghl_contact_id && customer.name && customer.phone && customer.email) {
          contactDetails = {
            id: customer.ghl_contact_id,
            name: customer.name,
            phoneNo: customer.phone,
            email: customer.email,
          };
        }
      }

      const { data: org } = await admin
        .from("organizations")
        .select("name, legal_name, phone, website")
        .eq("id", organizationId)
        .maybeSingle();
      const businessDetails: GhlBusinessDetails | undefined = org
        ? {
            name: org.legal_name ?? org.name,
            ...(org.phone ? { phoneNo: org.phone } : {}),
            ...(org.website ? { website: org.website } : {}),
          }
        : undefined;

      const input = {
        name: invoice.number ?? `Invoice ${id.slice(0, 8)}`,
        currency: "USD",
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        items,
        ...(contactDetails ? { contactDetails } : {}),
        ...(businessDetails ? { businessDetails } : {}),
        ...(invoice.terms ? { termsNotes: invoice.terms } : {}),
      };

      if (!confirm) {
        return json(200, {
          pending: true,
          preview: { ghlInvoiceId: invoice.ghl_invoice_id, ...input },
          message: "Not yet applied. Review the details, then call again with confirm: true to push this to HighLevel.",
        });
      }

      let updated;
      try {
        updated = await updateGhlInvoice(connection, invoice.ghl_invoice_id, input);
      } catch (updateGhlError) {
        return json(502, { error: `Could not update HighLevel invoice: ${(updateGhlError as Error).message}` });
      }

      const sync = buildGhlInvoiceSyncFields({ status: updated.status, paidAt: updated.paidAt });
      const patch: Record<string, unknown> = {
        ...sync,
        ...(updated.status === "paid" ? { status: "paid" } : {}),
      };
      const { data: savedRow, error: saveError } = await admin
        .from("invoices")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (saveError) return json(500, { error: saveError.message });

      return json(200, { updated: true, ghlInvoice: updated, record: savedRow });
    }

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

    const { data: updatedRecord, error: updateError } = await admin
      .from(table)
      .update(patch)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single();
    if (updateError) return json(500, { error: updateError.message });

    return json(200, { synced: true, ghlInvoice: invoice, record: updatedRecord });
  } catch (error) {
    console.error("ghl-invoice-sync error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
