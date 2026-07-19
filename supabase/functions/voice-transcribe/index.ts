// Speech-to-text via Lovable AI Gateway (OpenAI-compatible).
// Accepts multipart/form-data with `file` audio; returns { text }.
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
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return new Response(JSON.stringify({ error: "audio file required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const upstream = new FormData();
    upstream.append("model", "openai/gpt-4o-mini-transcribe");
    upstream.append("file", file, file.name || "recording.webm");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `Transcription failed: ${txt}` }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();

    // Track per-org AI usage
    try {
      const {
        logAiUsage, estimateTranscribeCostUsd, getServiceClient,
        getUserIdFromAuth, resolvePrimaryOrgId,
      } = await import("../_shared/ai-usage.ts");
      const admin = getServiceClient();
      const uid = await getUserIdFromAuth(req.headers.get("Authorization"));
      const orgId = uid ? await resolvePrimaryOrgId(admin, uid) : null;
      await logAiUsage(admin, {
        organizationId: orgId,
        userId: uid,
        functionName: "voice-transcribe",
        model: "openai/gpt-4o-mini-transcribe",
        estimatedCostUsd: estimateTranscribeCostUsd(file.size),
        metadata: { audioBytes: file.size },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ text: data.text ?? "" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
