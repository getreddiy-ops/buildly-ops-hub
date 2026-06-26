// Public webhook for ElevenLabs post-call data. Updates phone_calls with
// summary, transcript, and duration once the conversation ends.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET") ?? "";

async function hmacSha256Hex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ElevenLabs signs with header `ElevenLabs-Signature: t=<unix>,v0=<hex hmac>`
// where signed payload is `<unix>.<rawBody>`.
async function verifyElevenLabsSignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false;
  const header = req.headers.get("elevenlabs-signature") ?? req.headers.get("ElevenLabs-Signature") ?? "";
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const ts = parts["t"];
  const sig = parts["v0"];
  if (!ts || !sig) return false;
  // Reject stale (>30 min)
  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > 1800) return false;
  const expected = await hmacSha256Hex(WEBHOOK_SECRET, `${ts}.${rawBody}`);
  return timingSafeEqual(expected, sig);
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const ok = await verifyElevenLabsSignature(req, rawBody);
    if (!ok) {
      console.warn("elevenlabs-postcall: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    const payload = JSON.parse(rawBody);
    const data = payload?.data ?? payload;
    const conversationId: string | undefined = data.conversation_id ?? data.id;
    const agentId: string | undefined = data.agent_id;
    if (!conversationId || !agentId) return new Response("ok");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: assistant } = await admin
      .from("phone_assistants").select("organization_id, twilio_phone_number")
      .eq("elevenlabs_agent_id", agentId).maybeSingle();
    if (!assistant) return new Response("ok");

    const meta = data.metadata ?? {};
    const analysis = data.analysis ?? {};
    const startedAt = meta.start_time_unix_secs ? new Date(meta.start_time_unix_secs * 1000).toISOString() : new Date().toISOString();
    const duration = meta.call_duration_secs ?? null;
    const endedAt = duration && meta.start_time_unix_secs ? new Date((meta.start_time_unix_secs + duration) * 1000).toISOString() : new Date().toISOString();
    const summary = analysis.transcript_summary ?? analysis.summary ?? null;

    const fromNumber = meta.phone_call?.external_number ?? null;
    const transcript = data.transcript ?? null;
    let updatedRow: { id: string } | null = null;
    if (fromNumber) {
      const { data: upd } = await admin
        .from("phone_calls")
        .update({
          ended_at: endedAt,
          duration_seconds: duration,
          status: "completed",
          summary,
          transcript,
          elevenlabs_conversation_id: conversationId,
        })
        .eq("organization_id", assistant.organization_id)
        .eq("status", "in_progress")
        .eq("from_number", fromNumber)
        .order("started_at", { ascending: false })
        .limit(1)
        .select("id")
        .maybeSingle();
      updatedRow = upd;
    }
    if (!updatedRow) {
      await admin.from("phone_calls").insert({
        organization_id: assistant.organization_id,
        from_number: fromNumber,
        to_number: assistant.twilio_phone_number,
        started_at: startedAt,
        ended_at: endedAt,
        duration_seconds: duration,
        status: "completed",
        summary,
        transcript,
        elevenlabs_conversation_id: conversationId,
      });
    }
    return new Response("ok");
  } catch (e) {
    console.error("postcall error", e);
    return new Response("ok");
  }
});
