// Text-to-speech via Lovable AI Gateway (OpenAI-compatible).
// Accepts JSON { text, voice? }; returns { audio: base64 mp3 }.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuthedUser } from "../_shared/require-user.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const auth = requireAuthedUser(req);
  if (!auth.ok) return auth.response;

  try {
    const { text, voice } = await req.json() as { text?: string; voice?: string };
    const input = (text ?? "").trim();
    if (!input) {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Hard cap to keep responses fast; client should chunk longer text.
    const capped = input.length > 3000 ? input.slice(0, 3000) : input;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: capped,
        voice: voice || "alloy",
        response_format: "mp3",
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `TTS failed: ${txt}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    // base64 encode
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);

    // Track per-org AI usage
    try {
      const {
        logAiUsage, estimateTtsCostUsd, getServiceClient,
        getUserIdFromAuth, resolvePrimaryOrgId,
      } = await import("../_shared/ai-usage.ts");
      const admin = getServiceClient();
      const uid = await getUserIdFromAuth(req.headers.get("Authorization"));
      const orgId = uid ? await resolvePrimaryOrgId(admin, uid) : null;
      await logAiUsage(admin, {
        organizationId: orgId,
        userId: uid,
        functionName: "voice-speak",
        model: "openai/gpt-4o-mini-tts",
        estimatedCostUsd: estimateTtsCostUsd(capped.length),
        metadata: { chars: capped.length, voice: voice || "alloy" },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ audio: b64, mime: "audio/mpeg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
