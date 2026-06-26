// Buy a Twilio phone number for the org and wire its Voice webhook to our
// twilio-voice-webhook function. Org admin + Premium required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY")!;
const PROJECT_ID = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/([^.]+)\./)?.[1];
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook`;

async function twilio(path: string, method: string, params?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (params && method !== "GET") init.body = new URLSearchParams(params);
  const url = `${GATEWAY}${path}` + (method === "GET" && params ? `?${new URLSearchParams(params)}` : "");
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${text}`);
  return JSON.parse(text);
}

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

    const { organization_id, area_code, country = "US" } = (await req.json()) as {
      organization_id: string; area_code?: string; country?: string;
    };

    const { data: member } = await admin
      .from("organization_members").select("role")
      .eq("organization_id", organization_id).eq("user_id", userData.user.id).maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) return json({ error: "forbidden" }, 403);

    const { data: existing } = await admin
      .from("phone_assistants").select("elevenlabs_agent_id, twilio_phone_sid")
      .eq("organization_id", organization_id).maybeSingle();
    if (!existing?.elevenlabs_agent_id) return json({ error: "Configure assistant first" }, 400);
    if (existing.twilio_phone_sid) return json({ error: "A phone number is already connected" }, 400);

    // Search available local numbers
    const search = await twilio(
      `/AvailablePhoneNumbers/${country}/Local.json`,
      "GET",
      area_code ? { AreaCode: area_code, SmsEnabled: "true", VoiceEnabled: "true" } : { VoiceEnabled: "true" },
    );
    const available = search.available_phone_numbers?.[0];
    if (!available) return json({ error: `No numbers available${area_code ? ` in area code ${area_code}` : ""}` }, 400);

    // Purchase + set Voice webhook
    const bought = await twilio(`/IncomingPhoneNumbers.json`, "POST", {
      PhoneNumber: available.phone_number,
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
  } catch (e) {
    console.error("provision error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
