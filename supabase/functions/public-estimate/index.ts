// Customer-facing estimate view/accept — no FastTract login required.
// Access is entirely by an unguessable share_token; this function never
// returns anything beyond what a customer needs to review and accept their
// own estimate (no other customers, no other org data, no internal ids
// beyond what's needed to render the page).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const { token, action, name, signature } = (await req.json()) as {
      token?: string;
      action?: "view" | "accept" | "decline";
      name?: string;
      signature?: string;
    };
    if (!token) return json(400, { error: "token is required" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: estimate, error } = await admin
      .from("estimates")
      .select(
        "id, title, status, subtotal, tax, total, notes, accepted_at, accepted_by_name, deposit_required, deposit_collected, " +
        "customers(name), organizations:organization_id(name, phone, email, logo_url, brand_color)",
      )
      .eq("share_token", token)
      .maybeSingle();
    if (error || !estimate) return json(404, { error: "Estimate not found" });

    if (action === "accept") {
      if (estimate.status === "approved") return json(409, { error: "This estimate was already accepted." });
      if (estimate.status === "rejected") return json(409, { error: "This estimate was declined and can no longer be accepted." });
      if (!name || !name.trim()) return json(400, { error: "Your name is required to sign." });

      const { error: updateError } = await admin
        .from("estimates")
        .update({
          status: "approved",
          accepted_at: new Date().toISOString(),
          accepted_by_name: name.trim(),
          signature_text: (signature || name).trim(),
        })
        .eq("id", estimate.id);
      if (updateError) return json(500, { error: updateError.message });
    }

    if (action === "decline") {
      if (estimate.status === "approved") return json(409, { error: "This estimate was already accepted and can no longer be declined." });
      const { error: updateError } = await admin.from("estimates").update({ status: "rejected" }).eq("id", estimate.id);
      if (updateError) return json(500, { error: updateError.message });
    }

    const { data: items } = await admin
      .from("estimate_line_items")
      .select("description, quantity, unit_price, total")
      .eq("estimate_id", estimate.id)
      .order("position");

    const org = (estimate as unknown as { organizations: Record<string, unknown> }).organizations || {};
    const customer = (estimate as unknown as { customers: { name: string } | null }).customers;

    return json(200, {
      id: estimate.id,
      title: estimate.title,
      status: action === "accept" ? "approved" : action === "decline" ? "rejected" : estimate.status,
      customerName: customer?.name ?? null,
      companyName: org.name ?? null,
      companyPhone: org.phone ?? null,
      companyEmail: org.email ?? null,
      brandColor: org.brand_color ?? null,
      lineItems: items ?? [],
      subtotal: Number(estimate.subtotal),
      tax: Number(estimate.tax),
      total: Number(estimate.total),
      notes: estimate.notes,
      acceptedAt: action === "accept" ? new Date().toISOString() : estimate.accepted_at,
      acceptedByName: action === "accept" ? name : estimate.accepted_by_name,
      depositRequired: estimate.deposit_required !== null ? Number(estimate.deposit_required) : null,
      depositCollected: estimate.deposit_collected,
    });
  } catch (error) {
    console.error("public-estimate error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
