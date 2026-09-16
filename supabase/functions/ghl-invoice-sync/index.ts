// Creates, links, updates, and sends GHL invoices for a FastTract invoice
// (or links/syncs one for an estimate's deposit), and re-syncs status/
// payment state via Get Invoice.
//
// Tenant isolation: the caller's organizationId is only ever used to look
// up (a) that organization's own membership row for the authenticated user
// and (b) that organization's own ghl_connections row. The GHL location an
// invoice is created/fetched/updated/sent against always comes from that
// stored connection's location_id -- never from anything the client sends
// -- so a ghlInvoiceId belonging to a different HighLevel location simply
// fails to fetch/update (GHL itself scopes the lookup by altId/altType)
// rather than ever being trusted at face value.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  buildGhlInvoiceItems,
  buildGhlInvoiceSyncFields,
  createGhlInvoice,
  ensureFreshConnection,
  getConnectionForOrg,
  getGhlInvoice,
  requiredSecret,
  sendGhlInvoice,
  updateGhlInvoice,
  type GhlBusinessDetails,
  type GhlContactDetails,
  type GhlSendInvoiceAction,
} from "../_shared/ghl.ts";

type Kind = "invoice" | "estimate";
type Action = "link" | "sync" | "update" | "create" | "send";
const KIND_TABLE: Record<Kind, string> = { invoice: "invoices", estimate: "estimates" };
const SEND_ACTIONS = new Set<GhlSendInvoiceAction>(["email", "sms", "sms_and_email", "send_manually"]);

type InvoiceRow = {
  id: string;
  ghl_invoice_id: string | null;
  number: string | null;
  issue_date: string;
  due_date: string | null;
  customer_id: string | null;
  terms: string | null;
  status: string;
};

type Customer = { name: string | null; email: string | null; phone: string | null; ghl_contact_id: string | null };

// Shared by "create" and "update": line items + whatever contact/business
// details FastTract can build without guessing. `requireContact` makes a
// missing/incomplete customer a hard error instead of an omitted field --
// Create Invoice's contactDetails and sentTo.email are both required by
// the API, Update Invoice's contactDetails is optional.
async function loadInvoiceContext(
  admin: ReturnType<typeof adminClient>,
  invoice: InvoiceRow,
  organizationId: string,
  requireContact: boolean,
): Promise<
  | { ok: true; items: ReturnType<typeof buildGhlInvoiceItems>; contactDetails?: GhlContactDetails; customerEmail?: string; businessDetails?: GhlBusinessDetails }
  | { ok: false; error: string }
> {
  const { data: lineItems } = await admin
    .from("invoice_line_items")
    .select("description, quantity, unit_price")
    .eq("invoice_id", invoice.id)
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
    return { ok: false, error: `Could not build HighLevel line items: ${(itemsError as Error).message}` };
  }

  let customer: Customer | null = null;
  if (invoice.customer_id) {
    const { data } = await admin
      .from("customers")
      .select("name, email, phone, ghl_contact_id")
      .eq("id", invoice.customer_id)
      .maybeSingle();
    customer = data;
  }

  let contactDetails: GhlContactDetails | undefined;
  if (customer?.ghl_contact_id && customer.name && customer.phone && customer.email) {
    contactDetails = { id: customer.ghl_contact_id, name: customer.name, phoneNo: customer.phone, email: customer.email };
  }
  if (requireContact && !contactDetails) {
    return {
      ok: false,
      error:
        "This invoice's customer needs a name, phone, email, and a synced HighLevel contact before creating a HighLevel invoice.",
    };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("name, legal_name, phone, website")
    .eq("id", organizationId)
    .maybeSingle();
  const businessDetails: GhlBusinessDetails | undefined = org
    ? { name: org.legal_name ?? org.name, ...(org.phone ? { phoneNo: org.phone } : {}), ...(org.website ? { website: org.website } : {}) }
    : undefined;

  return { ok: true, items, contactDetails, customerEmail: customer?.email ?? undefined, businessDetails };
}

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

    const { organizationId, action, kind, id, ghlInvoiceId, confirm, channel } = (await req.json()) as {
      organizationId?: string;
      action?: Action;
      kind?: Kind;
      id?: string;
      ghlInvoiceId?: string;
      confirm?: boolean;
      channel?: GhlSendInvoiceAction;
    };
    if (!organizationId || !action || !kind || !id || !KIND_TABLE[kind]) {
      return json(400, { error: "organizationId, action, kind, and id are required" });
    }
    if (action === "link" && !ghlInvoiceId) {
      return json(400, { error: "ghlInvoiceId is required to link" });
    }
    if ((action === "update" || action === "create" || action === "send") && kind !== "invoice") {
      return json(400, { error: `${action} is only supported for invoices right now` });
    }
    if (action === "send" && (!channel || !SEND_ACTIONS.has(channel))) {
      return json(400, { error: `channel must be one of ${[...SEND_ACTIONS].join(", ")}` });
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

    if (action === "create") {
      const { data: invoice, error: invoiceError } = await admin
        .from("invoices")
        .select("id, ghl_invoice_id, number, issue_date, due_date, customer_id, terms, status")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (invoiceError || !invoice) return json(404, { error: "invoice not found" });
      if (invoice.ghl_invoice_id) {
        return json(400, { error: "This invoice is already linked to a HighLevel invoice -- use update, not create" });
      }

      const ctx = await loadInvoiceContext(admin, invoice, organizationId, true);
      if (!ctx.ok) return json(400, { error: ctx.error });
      if (!ctx.customerEmail) {
        return json(400, { error: "This invoice's customer needs an email address (HighLevel requires one to create an invoice)" });
      }

      const input = {
        name: invoice.number ?? `Invoice ${id.slice(0, 8)}`,
        currency: "USD",
        issueDate: invoice.issue_date,
        ...(invoice.due_date ? { dueDate: invoice.due_date } : {}),
        items: ctx.items,
        contactDetails: ctx.contactDetails!,
        businessDetails: ctx.businessDetails ?? {},
        sentTo: { email: [ctx.customerEmail] },
        ...(invoice.terms ? { termsNotes: invoice.terms } : {}),
      };

      if (!confirm) {
        return json(200, {
          pending: true,
          preview: input,
          message: "Not yet applied. Review the details, then call again with confirm: true to create this invoice in HighLevel.",
        });
      }

      let created;
      try {
        created = await createGhlInvoice(connection, input);
      } catch (createGhlError) {
        return json(502, { error: `Could not create HighLevel invoice: ${(createGhlError as Error).message}` });
      }
      if (!created.id) return json(502, { error: "HighLevel create invoice response is missing an id" });

      const sync = buildGhlInvoiceSyncFields({ status: created.status, paidAt: created.paidAt });
      const patch: Record<string, unknown> = { ...sync, ghl_invoice_id: created.id };
      const { data: savedRow, error: saveError } = await admin
        .from("invoices")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .is("ghl_invoice_id", null)
        .select()
        .single();
      if (saveError) {
        return json(500, {
          error:
            `Created HighLevel invoice ${created.id} but could not save the link (${saveError.message}). ` +
            "This invoice may now need to be linked manually to avoid creating a duplicate.",
        });
      }

      return json(200, { created: true, ghlInvoice: created, record: savedRow });
    }

    if (action === "send") {
      const { data: invoice, error: invoiceError } = await admin
        .from("invoices")
        .select("id, ghl_invoice_id, customer_id, status")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (invoiceError || !invoice) return json(404, { error: "invoice not found" });
      if (!invoice.ghl_invoice_id) {
        return json(400, { error: "Create or link this invoice's HighLevel invoice before sending it" });
      }
      if (!connection.default_sender_user_id) {
        return json(400, {
          error: "Pick a default HighLevel sender for this organization first (Preferences -> GoHighLevel)",
        });
      }

      let customer: Customer | null = null;
      if (invoice.customer_id) {
        const { data } = await admin.from("customers").select("name, email, phone, ghl_contact_id").eq("id", invoice.customer_id).maybeSingle();
        customer = data;
      }
      const needsEmail = channel === "email" || channel === "sms_and_email";
      const needsPhone = channel === "sms" || channel === "sms_and_email";
      if (needsEmail && !customer?.email) {
        return json(400, { error: "This invoice's customer has no email on file -- cannot send by email" });
      }
      if (needsPhone && !customer?.phone) {
        return json(400, { error: "This invoice's customer has no phone on file -- cannot send by SMS" });
      }

      if (!confirm) {
        return json(200, {
          pending: true,
          preview: { ghlInvoiceId: invoice.ghl_invoice_id, channel, to: { email: customer?.email ?? null, phone: customer?.phone ?? null } },
          message: "Not yet applied. Review the recipient, then call again with confirm: true to send this invoice via HighLevel.",
        });
      }

      let sent;
      try {
        sent = await sendGhlInvoice(connection, invoice.ghl_invoice_id, channel!, connection.default_sender_user_id);
      } catch (sendGhlError) {
        return json(502, { error: `Could not send HighLevel invoice: ${(sendGhlError as Error).message}` });
      }

      const sync = buildGhlInvoiceSyncFields({ status: sent.status, paidAt: sent.paidAt });
      const patch: Record<string, unknown> = {
        ...sync,
        // Locally stamped: GHL's response doesn't confirm a "sent at" time
        // and its non-paid status vocabulary isn't documented (see the
        // comment on buildGhlInvoiceSyncFields), but a successful Send
        // Invoice call is itself proof FastTract can rely on.
        ghl_sent_at: new Date().toISOString(),
        ...(invoice.status !== "paid" ? { status: "sent" } : {}),
      };
      const { data: savedRow, error: saveError } = await admin
        .from("invoices")
        .update(patch)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single();
      if (saveError) return json(500, { error: saveError.message });

      return json(200, { sent: true, ghlInvoice: sent, record: savedRow });
    }

    if (action === "update") {
      const { data: invoice, error: invoiceError } = await admin
        .from("invoices")
        .select("id, ghl_invoice_id, number, issue_date, due_date, customer_id, terms, status")
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

      const ctx = await loadInvoiceContext(admin, invoice, organizationId, false);
      if (!ctx.ok) return json(400, { error: ctx.error });

      const input = {
        name: invoice.number ?? `Invoice ${id.slice(0, 8)}`,
        currency: "USD",
        issueDate: invoice.issue_date,
        dueDate: invoice.due_date,
        items: ctx.items,
        ...(ctx.contactDetails ? { contactDetails: ctx.contactDetails } : {}),
        ...(ctx.businessDetails ? { businessDetails: ctx.businessDetails } : {}),
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

    // link / sync
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
