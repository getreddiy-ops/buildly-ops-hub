// Speech-to-text via ElevenLabs Scribe v2.
// Accepts multipart/form-data with `file` audio; returns an editable transcript.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuthedUser } from "../_shared/require-user.ts";

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const MODEL_ID = "scribe_v2";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = requireAuthedUser(req);
  if (!auth.ok) return auth.response;
  if (!ELEVENLABS_API_KEY) return json(503, { error: "ElevenLabs voice is not configured." });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return json(400, { error: "audio file required" });
    }
    if (file.size > MAX_AUDIO_BYTES) {
      return json(413, { error: "Recording is too large. Keep voice notes under 25 MB." });
    }

    const upstream = new FormData();
    upstream.append("model_id", MODEL_ID);
    upstream.append("file", file, file.name || "recording.webm");
    upstream.append("tag_audio_events", "false");
    upstream.append("diarize", "false");

    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
      body: upstream,
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 800);
      const status = res.status === 401 || res.status === 403
        ? 503
        : res.status === 402 || res.status === 429
          ? res.status
          : 502;
      console.error("ElevenLabs transcription failed", res.status, detail);
      return json(status, {
        error: res.status === 429
          ? "Voice transcription is busy. Try again in a moment."
          : "Voice transcription failed. You can keep typing while we retry voice.",
      });
    }

    const data = await res.json() as {
      text?: string;
      language_code?: string;
      language_probability?: number;
    };
    const text = (data.text ?? "").trim();

    // Track per-org AI usage. Logging is best effort and never blocks the transcript.
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
        model: MODEL_ID,
        estimatedCostUsd: estimateTranscribeCostUsd(file.size),
        metadata: {
          audioBytes: file.size,
          provider: "elevenlabs",
          languageCode: data.language_code ?? null,
          languageProbability: data.language_probability ?? null,
        },
      });
    } catch (_) { /* ignore usage logging failures */ }

    return json(200, {
      text,
      provider: "elevenlabs",
      model: MODEL_ID,
      languageCode: data.language_code ?? null,
    });
  } catch (error) {
    console.error("voice-transcribe error", error);
    return json(500, {
      error: error instanceof Error ? error.message : "Voice transcription failed.",
    });
  }
});
