import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  adminClient,
  ensureFreshConnection,
  getConnectionForOrg,
  ghlFetch,
  requiredSecret,
  upsertGhlContact,
} from "../_shared/ghl.ts";

const ESTIMATE_API_VERSION = "2023-02-21";

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

    const { organizationId, estimateId } = (await req.json()) as {
      organizationId?: string;
      estimateId?: string;
    };
    if (!organizationId || !estimateId) {
      return json(400, { error: "organizationId and estimateId are required" });
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
    if (!connection) return json(409, { error: "HighLevel is not connected for this organization" });
    connection = await ensureFreshConnection(admin, connection);
    if (!connection.location_id) return json(409, { error: "HighLevel connection has no location ID" });

    const { data: estimate, error: estimateError } = await admin
      .from("estimates")
      .select("id,title,notes,customer_id,subtotal,tax,total")
      .eq("id", estimateId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (estimateError || !estimate) return json(404, { error: "Estimate not found" });
    if (!estimate.customer_id) return json(400, { error: "Estimate must have a customer before creating it in HighLevel" });

    const [{ data: customer }, { data: org }, { data: items, error: itemsError }] = await Promise.all([
      admin.from("customers").select("id,name,email,phone,address,ghl_contact_id").eq("id", estimate.customer_id).eq("organization_id", organizationId).maybeSingle(),
      admin.from("organizations").select("name,email,phone,address,logo_url").eq("id", organizationId).maybeSingle(),
      admin.from("estimate_line_items").select("description,quantity,unit_price,position").eq("estimate_id", estimateId).order("position"),
    ]);
    if (!customer) return json(400, { error: "Estimate customer was not found" });
    if (!org) return json(400, { error: "Organization was not found" });
    if (itemsError) return json(500, { error: itemsError.message });
    if (!items?.length) return json(400, { error: "Estimate must have at least one line item" });

    let contactId = customer.ghl_contact_id as string | null;
    if (!contactId) {
      contactId = await upsertGhlContact(connection, {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
      });
      await admin.from("customers").update({ ghl_contact_id: contactId }).eq("id", customer.id);
    }

    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);

    const body = {
      altId: connection.location_id,
      altType: "location",
      name: estimate.title,
      title: estimate.title,
      businessDetails: {
        name: org.name,
        phoneNo: org.phone || undefined,
        address: org.address || undefined,
        logoUrl: org.logo_url || undefined,
      },
      currency: "USD",
      items: items.map((item: { description: string; quantity: number; unit_price: number }) => ({
        name: item.description,
        description: item.description,
        currency: "USD",
        amount: Number(item.unit_price),
        qty: Number(item.quantity),
        type: "one_time",
        taxes: [],
        taxInclusive: false,
      })),
      liveMode: true,
      discount: { type: "percentage", value: 0 },
      termsNotes: estimate.notes || undefined,
      contactDetails: {
        id: contactId,
        name: customer.name,
        phoneNo: customer.phone || "",
        email: customer.email || "",
      },
      issueDate: ymd(now),
      expiryDate: ymd(expiry),
      sentTo: {
        email: customer.email ? [customer.email] : [],
        phoneNo: customer.phone ? [customer.phone] : [],
      },
      automaticTaxesEnabled: false,
      frequencySettings: { enabled: false },
      estimateNumberPrefix: "EST-",
    };

    const response = await ghlFetch(connection.access_token, "/invoices/estimate", {
      method: "POST",
      headers: { Version: ESTIMATE_API_VERSION },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
    if (!response.ok) {
      return json(response.status, {
        error: `HighLevel estimate create failed (${response.status})`,
        details: data,
        hint: response.status === 401 || response.status === 403
          ? "Reconnect HighLevel so the invoices/estimate.write scope is granted."
          : undefined,
      });
    }

    const ghlEstimateId = data?._id ?? data?.id ?? null;
    return json(201, {
      created: true,
      estimateId,
      ghlEstimateId,
      ghlEstimate: data,
    });
  } catch (error) {
    console.error("ghl-estimate-create error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
