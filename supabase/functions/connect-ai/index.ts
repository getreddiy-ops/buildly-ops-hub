// Connect, test or remove a business's own AI provider key. Owners and admins only.
// The key is checked with a tiny real call before it is stored, and is never returned.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DEFAULT_MODELS, isProvider, keyLast4, looksLikeKey } from "../_shared/ai-translate.ts";
import { AiProviderError, callProvider } from "../_shared/ai-provider.ts";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData.user;
  if (!user || user.is_anonymous) return json(401, { error: "Unauthorized" });

  let body: { action?: string; organizationId?: string; provider?: string; model?: string; apiKey?: string };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }
  const organizationId = String(body.organizationId ?? "");
  if (!organizationId) return json(400, { error: "organizationId is required" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await admin.rpc("is_org_admin", { _user_id: user.id, _org_id: organizationId });
  if (!isAdmin) return json(403, { error: "Only the business owner or an admin can manage the AI connection" });

  try {
    if (body.action === "disconnect") {
      const { error } = await admin.rpc("delete_org_ai_key", { _org: organizationId });
      if (error) throw error;
      return json(200, { disconnected: true });
    }

    if (body.action === "test") {
      const { data } = await admin.rpc("get_org_ai_key", { _org: organizationId });
      const row = (Array.isArray(data) ? data[0] : data) as { provider: string; model: string; api_key: string } | undefined;
      if (!row || !isProvider(row.provider)) return json(404, { error: "No AI provider is connected" });
      await callProvider(row.provider, row.api_key, row.model, { messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 5 }, 20000);
      return json(200, { ok: true });
    }

    // Default action: connect (or replace) the key.
    const provider = body.provider;
    if (!isProvider(provider)) return json(400, { error: "Choose OpenAI, Anthropic or Google" });
    const apiKey = String(body.apiKey ?? "").trim();
    if (!looksLikeKey(provider, apiKey)) return json(400, { error: "That doesn't look like an API key for this provider" });
    const model = String(body.model ?? "").trim() || DEFAULT_MODELS[provider];
    if (model.length > 100) return json(400, { error: "Model name is too long" });

    await callProvider(provider, apiKey, model, { messages: [{ role: "user", content: "Reply with the word ok." }], max_tokens: 5 }, 20000);

    const { error } = await admin.rpc("set_org_ai_key", { _org: organizationId, _provider: provider, _model: model, _key: apiKey, _user: user.id });
    if (error) throw error;
    return json(200, { connected: true, provider, model, key_last4: keyLast4(apiKey) });
  } catch (e) {
    if (e instanceof AiProviderError) return json(e.status === 429 ? 429 : 400, { error: e.message, code: e.code });
    console.error("connect-ai error", e);
    return json(500, { error: "Could not update the AI connection" });
  }
});
