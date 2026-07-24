import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
const ELEVENLABS_VOICE_ID = Deno.env.get("ELEVENLABS_VOICE_ID") || "JBFqnCBsd6RMkjVDRZzb";

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    try {
      if (!ELEVENLABS_API_KEY) {
        return Response.json({ error: "ElevenLabs voice is not configured." }, {
          status: 503,
          headers: corsHeaders,
        });
      }

      const { text } = await req.json() as { text?: string };
      const input = (text ?? "").trim().slice(0, 3000);
      if (!input) {
        return Response.json({ error: "text required" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}/stream?output_format=mp3_44100_128&enable_logging=false`,
        {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: input,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.78,
            style: 0.18,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        return Response.json({ error: `ElevenLabs voice failed: ${message}` }, {
          status: response.status === 402 || response.status === 429 ? response.status : 500,
          headers: corsHeaders,
        });
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }

      return Response.json({
        audio: btoa(binary),
        mime: "audio/mpeg",
        provider: "elevenlabs",
        voiceId: ELEVENLABS_VOICE_ID,
      }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "ElevenLabs voice failed.",
      }, { status: 500, headers: corsHeaders });
    }
  }),
};
