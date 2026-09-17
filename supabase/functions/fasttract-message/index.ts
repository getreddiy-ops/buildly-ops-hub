import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "sms" | "email";

type AdminClient = ReturnType<typeof createClient>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function requireMember(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
  const encoded = new URLSearchParams(params);

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}${path}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: encoded,
      },
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`Twilio ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  // Compatibility path until the existing Twilio credentials have been moved
  // fully into FastTract's Supabase secrets.
  if (LOVABLE_API_KEY && TWILIO_API_KEY) {
    const response = await fetch(`${TWILIO_GATEWAY}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: encoded,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Twilio ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  throw new Error("Twilio is not configured for FastTract yet");
}

async function queueEmail(args: {
  recipientEmail: string;
  companyName: string;
  customerName: string;
  message: string;
}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      templateName: "customer-message",
      recipientEmail: args.recipientEmail,
      idempotencyKey: `customer-message:${crypto.randomUUID()}`,
      templateData: {
        companyName: args.companyName,
        customerName: args.customerName,
        subject: `Message from ${args.companyName}`,
        message: args.message,
      },
    }),
  });

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  if (!response.ok || data.success === false || data.error) {
    throw new Error(String(data.error ?? data.reason ?? `Email queue failed (${response.status})`));
  }
  return data;
}

async function logMessage(admin: AdminClient, record: {
  organization_id: string;
  customer_id: string;
  sent_by: string;
  channel: Channel;
  recipient: string;
  sender: string | null;
  body: string;
  provider: string;
  provider_id: string | null;
  status: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await admin.from("communication_messages").insert({
    ...record,
    direction: "outbound",
    metadata: record.metadata ?? {},
  });
  if (error) {
    console.error("FastTract message sent but history logging failed", error);
    return error.message;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const organizationId = String(body.organizationId ?? body.organization_id ?? "").trim();
    const customerId = String(body.customerId ?? body.customer_id ?? "").trim();
    const message = String(body.message ?? "").trim();
    const requestedChannel = String(body.channel ?? "sms").toLowerCase();
    const channel: Channel = requestedChannel === "email" ? "email" : "sms";

    if (!organizationId || !customerId || !message) {
      return json({ error: "organizationId, customerId and message are required" }, 400);
    }

    const { admin, user } = await requireMember(req, organizationId);

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id,name,phone,email")
      .eq("organization_id", organizationId)
      .eq("id", customerId)
      .single();
    if (customerError) throw customerError;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .select("name,phone,email")
      .eq("id", organizationId)
      .single();
    if (orgError) throw orgError;

    if (channel === "email") {
      if (!customer.email) return json({ error: "Customer has no email address" }, 400);

      const queued = await queueEmail({
        recipientEmail: customer.email,
        companyName: org.name,
        customerName: customer.name,
        message,
      });

      const logWarning = await logMessage(admin, {
        organization_id: organizationId,
        customer_id: customer.id,
        sent_by: user.id,
        channel: "email",
        recipient: customer.email,
        sender: org.email ?? null,
        body: message,
        provider: "fasttract-transactional-email",
        provider_id: typeof queued.messageId === "string" ? queued.messageId : null,
        status: queued.queued === true ? "queued" : "accepted",
      });

      return json({
        message: `Email queued for ${customer.name}.`,
        status: "queued",
        logWarning,
      });
    }

    if (!customer.phone) return json({ error: "Customer has no phone number" }, 400);

    const { data: phoneAssistant } = await admin
      .from("phone_assistants")
      .select("twilio_phone_number")
      .eq("organization_id", organizationId)
      .eq("enabled", true)
      .not("twilio_phone_number", "is", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const senderNumber = phoneAssistant?.twilio_phone_number || org.phone;
    if (!senderNumber) {
      return json({ error: "Configure a FastTract phone number before sending texts" }, 400);
    }

    const sent = await twilio("/Messages.json", {
      To: customer.phone,
      From: senderNumber,
      Body: message,
    });

    const providerId = typeof sent.sid === "string" ? sent.sid : null;
    const status = typeof sent.status === "string" ? sent.status : "queued";
    const logWarning = await logMessage(admin, {
      organization_id: organizationId,
      customer_id: customer.id,
      sent_by: user.id,
      channel: "sms",
      recipient: customer.phone,
      sender: senderNumber,
      body: message,
      provider: "twilio",
      provider_id: providerId,
      status,
    });

    return json({
      message: `Text sent to ${customer.name}.`,
      providerId,
      status,
      logWarning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("fasttract-message error", error);
    return json({ error: message }, status);
  }
});
