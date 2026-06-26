// Mint a short-lived conversation token so the browser can talk to the org's
// ElevenLabs agent for the in-app test console.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const { organization_id } = (await req.json()) as { organization_id: string };
    if (!organization_id) return json({ error: "organization_id required" }, 400);

    const { data: member } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (!member) return json({ error: "forbidden" }, 403);

    const { data: assistant } = await admin
      .from("phone_assistants")
      .select("elevenlabs_agent_id")
      .eq("organization_id", organization_id)
      .maybeSingle();
    if (!assistant?.elevenlabs_agent_id) {
      return json({ error: "no agent configured" }, 400);
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${assistant.elevenlabs_agent_id}`,
      { headers: { "xi-api-key": Deno.env.get("ELEVENLABS_API_KEY")! } },
    );
    const text = await res.text();
    if (!res.ok) return json({ error: `elevenlabs ${res.status}: ${text}` }, 500);
    const data = JSON.parse(text);
    return json({ token: data.token, agent_id: assistant.elevenlabs_agent_id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
