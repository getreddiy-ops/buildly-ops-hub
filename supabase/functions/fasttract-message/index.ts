import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function requireMember(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!member) throw new Error("Forbidden");
  return { admin, user: userData.user };
}

async function twilio(path: string, params: Record<string, string>) {
  const res = await fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const organizationId = String(body.organizationId ?? body.organization_id ?? "").trim();
    const customerId = String(body.customerId ?? body.customer_id ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!organizationId || !customerId || !message) return json({ error: "organizationId, customerId and message are required" }, 400);

    const { admin, user } = await requireMember(req, organizationId);

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id,name,phone")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .single();
    if (customerError) throw customerError;
    if (!customer.phone) return json({ error: "Customer has no phone number" }, 400);

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("name,phone")
      .eq("id", organizationId)
      .single();
    if (orgError) throw orgError;
    if (!org.phone) return json({ error: "Set the business phone number before sending texts" }, 400);

    const sent = await twilio("/Messages.json", { To: customer.phone, From: org.phone, Body: message });

    await admin.from("ft_messages").insert({
      id: sent.sid ?? crypto.randomUUID(),
      business_id: organizationId,
      data: {
        channel: "sms",
        direction: "outbound",
        customer_id: customer.id,
        customer_name: customer.name,
        to: customer.phone,
        from: org.phone,
        body: message,
        provider: "twilio",
        provider_id: sent.sid ?? null,
        sent_by: user.id,
        status: sent.status ?? "queued",
      },
    });

    return json({ message: `Text sent to ${customer.name}.`, providerId: sent.sid ?? null, status: sent.status ?? "queued" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("fasttract-message error", error);
    return json({ error: message }, status);
  }
});
