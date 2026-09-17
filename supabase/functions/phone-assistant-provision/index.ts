// Phone number lifecycle for the org's assistant.
// Actions: search | purchase | release | byo. Org admin required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const TWILIO_GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const PROJECT_ID = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/([^.]+)\./)?.[1];
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook`;

async function twilio(path: string, method: string, params?: Record<string, string>) {
  const query = params && method === "GET" ? `?${new URLSearchParams(params)}` : "";
  const body = params && method !== "GET" && method !== "DELETE" ? new URLSearchParams(params) : undefined;

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}${path}${query}`,
      {
        method,
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        },
        body,
      },
    );
    const text = await response.text();
    if (!response.ok) throw new Error(`Twilio ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  // Temporary compatibility path for existing installs until direct Twilio
  // credentials are moved into FastTract's Supabase secrets.
  if (LOVABLE_API_KEY && TWILIO_API_KEY) {
    const response = await fetch(`${TWILIO_GATEWAY}${path}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
      body,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Twilio ${response.status}: ${text}`);
    return text ? JSON.parse(text) : {};
  }

  throw new Error("Twilio is not configured for FastTract yet");
}

type Action = "search" | "purchase" | "release" | "byo";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const body = (await req.json()) as {
      action?: Action;
      organization_id: string;
      area_code?: string;
      country?: string;
      number_type?: "local" | "toll_free";
      phone_number?: string;
    };
    const {
      organization_id, area_code, country = "US",
      number_type = "local", phone_number,
    } = body;
    const action: Action = body.action ?? "purchase";

    const { data: member } = await admin
      .from("organization_members").select("role")
      .eq("organization_id", organization_id).eq("user_id", userData.user.id).maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) return json({ error: "forbidden" }, 403);

    const { data: existing } = await admin
      .from("phone_assistants").select("elevenlabs_agent_id, twilio_phone_sid, twilio_phone_number")
      .eq("organization_id", organization_id).maybeSingle();
    if (!existing?.elevenlabs_agent_id) return json({ error: "Configure assistant first" }, 400);

    if (action === "search") {
      const kind = number_type === "toll_free" ? "TollFree" : "Local";
      const params: Record<string, string> = { VoiceEnabled: "true", SmsEnabled: "true", PageSize: "10" };
      if (area_code && number_type === "local") params.AreaCode = area_code;
      const search = await twilio(`/AvailablePhoneNumbers/${country}/${kind}.json`, "GET", params);
      const numbers = (search.available_phone_numbers ?? []).map((number: Record<string, unknown>) => ({
        phone_number: number.phone_number,
        friendly_name: number.friendly_name,
        locality: number.locality,
        region: number.region,
      }));
      return json({ numbers });
    }

    if (action === "purchase") {
      if (existing.twilio_phone_sid) return json({ error: "A phone number is already connected. Release it first." }, 400);

      let toBuy = phone_number;
      if (!toBuy) {
        const kind = number_type === "toll_free" ? "TollFree" : "Local";
        const params: Record<string, string> = { VoiceEnabled: "true" };
        if (area_code && number_type === "local") params.AreaCode = area_code;
        const search = await twilio(`/AvailablePhoneNumbers/${country}/${kind}.json`, "GET", params);
        toBuy = search.available_phone_numbers?.[0]?.phone_number;
        if (!toBuy) return json({ error: `No numbers available${area_code ? ` in area code ${area_code}` : ""}` }, 400);
      }

      const bought = await twilio(`/IncomingPhoneNumbers.json`, "POST", {
        PhoneNumber: toBuy,
        VoiceUrl: WEBHOOK_URL,
        VoiceMethod: "POST",
      });

      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({ twilio_phone_sid: bought.sid, twilio_phone_number: bought.phone_number })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved });
    }

    if (action === "release") {
      if (existing.twilio_phone_sid) {
        try {
          await twilio(`/IncomingPhoneNumbers/${existing.twilio_phone_sid}.json`, "DELETE");
        } catch (error) {
          console.error("twilio release failed", error);
        }
      }
      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({ twilio_phone_sid: null, twilio_phone_number: null })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved });
    }

    if (action === "byo") {
      if (!phone_number) return json({ error: "phone_number required" }, 400);
      if (existing.twilio_phone_sid) return json({ error: "Release the connected Twilio number first" }, 400);
      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({ twilio_phone_number: phone_number, twilio_phone_sid: null })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved, forwarding_target: WEBHOOK_URL });
    }

    return json({ error: "unknown action" }, 400);
  } catch (error) {
    console.error("provision error", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
