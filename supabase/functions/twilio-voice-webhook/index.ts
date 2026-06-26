// Public Twilio Voice webhook. Returns TwiML that bridges the incoming call to
// the org's ElevenLabs Conversational AI agent via a signed Media Stream URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  try {
    const form = await req.formData();
    const to = String(form.get("To") ?? "");
    const from = String(form.get("From") ?? "");
    const callSid = String(form.get("CallSid") ?? "");

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
