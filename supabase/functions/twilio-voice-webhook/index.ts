// Public Twilio Voice webhook. Returns TwiML that bridges the incoming call to
// the org's ElevenLabs Conversational AI agent via a signed Media Stream URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

async function hmacSha1Base64(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifyTwilioSignature(req: Request, params: Record<string, string>): Promise<boolean> {
  if (!TWILIO_AUTH_TOKEN) return false;
  const signature = req.headers.get("x-twilio-signature") ?? "";
  if (!signature) return false;
  // Twilio signs: full URL + sorted concatenation of param name + value
  const url = req.url;
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map((k) => k + params[k]).join("");
  const expected = await hmacSha1Base64(TWILIO_AUTH_TOKEN, data);
  return timingSafeEqual(expected, signature);
}

Deno.serve(async (req) => {
  try {
    const form = await req.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = String(v);

    const ok = await verifyTwilioSignature(req, params);
    if (!ok) {
      console.warn("twilio-voice-webhook: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    const to = params.To ?? "";
    const from = params.From ?? "";
    const callSid = params.CallSid ?? "";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: assistant } = await admin
      .from("phone_assistants")
      .select("organization_id, elevenlabs_agent_id, enabled")
      .eq("twilio_phone_number", to)
      .maybeSingle();

    if (!assistant?.elevenlabs_agent_id || !assistant.enabled) {
      return twiml(`<Response><Say>Sorry, this line is not currently configured. Goodbye.</Say><Hangup/></Response>`);
    }

    // Log the call (in_progress)
    await admin.from("phone_calls").insert({
      organization_id: assistant.organization_id,
      from_number: from,
      to_number: to,
      status: "in_progress",
    });

    // Mint a signed WSS URL for the agent
    const signed = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${assistant.elevenlabs_agent_id}`,
      { headers: { "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")! } },
    );
    if (!signed.ok) {
      console.error("signed-url failed", signed.status, await signed.text());
      return twiml(`<Response><Say>Sorry, our assistant is unavailable. Please try again later.</Say><Hangup/></Response>`);
    }
    const { signed_url } = await signed.json();
    const safeUrl = signed_url.replace(/&/g, "&amp;");

    return twiml(
      `<Response><Connect><Stream url="${safeUrl}"><Parameter name="call_sid" value="${callSid}"/></Stream></Connect></Response>`,
    );
  } catch (e) {
    console.error("twilio-voice-webhook error", e);
    return twiml(`<Response><Say>Sorry, an error occurred.</Say><Hangup/></Response>`);
  }
});

function twiml(xml: string) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    headers: { "Content-Type": "text/xml" },
  });
}
