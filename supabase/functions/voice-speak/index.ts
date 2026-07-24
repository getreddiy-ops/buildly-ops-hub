import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "jsr:@supabase/server@^1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    try {
      if (!LOVABLE_API_KEY) {
        return Response.json({ error: "Neural voice is not configured." }, {
          status: 503,
          headers: corsHeaders,
        });
      }

      const { text, voice } = await req.json() as { text?: string; voice?: string };
      const input = (text ?? "").trim().slice(0, 3000);
      if (!input) {
        return Response.json({ error: "text required" }, {
          status: 400,
          headers: corsHeaders,
        });
      }

      const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input,
          voice: voice || "coral",
          instructions: "Speak as Ava, a warm, confident business specialist. Sound natural, calm, friendly, and conversational. Avoid exaggerated enthusiasm, announcer delivery, and robotic pacing.",
          response_format: "mp3",
        }),
      });

      if (!response.ok) {
        const message = await response.text().catch(() => "");
        return Response.json({ error: `Neural voice failed: ${message}` }, {
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
        voice: voice || "coral",
      }, { headers: corsHeaders });
    } catch (error) {
      return Response.json({
        error: error instanceof Error ? error.message : "Neural voice failed.",
      }, { status: 500, headers: corsHeaders });
    }
  }),
};
