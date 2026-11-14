// Bring-your-own AI: calls whichever provider the business connected, with its own key.
// Every AI feature goes through chatForOrg(); nothing here falls back to a FastTract-paid key.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type AiProvider,
  type ChatRequest,
  type ChatResult,
  fromAnthropicResponse,
  fromOpenAiResponse,
  providerEndpoint,
  providerHeaders,
  toAnthropicRequest,
  toOpenAiRequest,
} from "./ai-translate.ts";

export class AiNotConnectedError extends Error {
  code = "ai_not_connected";
  constructor() { super("Connect your AI provider in Settings → AI to use this feature."); }
}

export class AiProviderError extends Error {
  code = "ai_provider_error";
  constructor(public status: number, message: string) { super(message); }
}

export async function callProvider(provider: AiProvider, apiKey: string, model: string, req: ChatRequest, timeoutMs = 60000): Promise<ChatResult> {
  const body = provider === "anthropic" ? toAnthropicRequest(req, model) : toOpenAiRequest(req, model);
  const res = await fetch(providerEndpoint(provider), {
    method: "POST",
    headers: providerHeaders(provider, apiKey),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    const reason = res.status === 401 || res.status === 403
      ? "The AI provider rejected the key. Check it in Settings → AI."
      : res.status === 429
        ? "The AI provider says the account is rate-limited or out of credit."
        : `The AI provider returned an error (${res.status}).`;
    console.error("AI provider error", provider, res.status, text);
    throw new AiProviderError(res.status, reason);
  }
  const data = await res.json();
  return provider === "anthropic" ? fromAnthropicResponse(data, model) : fromOpenAiResponse(data, model);
}

/** Looks up the business's connection (service-role client required) and runs one chat call. */
export async function chatForOrg(admin: SupabaseClient, organizationId: string, req: ChatRequest, timeoutMs?: number): Promise<ChatResult & { provider: AiProvider }> {
  const { data, error } = await admin.rpc("get_org_ai_key", { _org: organizationId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { provider: AiProvider; model: string; api_key: string } | undefined;
  if (!row?.api_key) throw new AiNotConnectedError();
  try {
    const result = await callProvider(row.provider, row.api_key, row.model, req, timeoutMs);
    return { ...result, provider: row.provider };
  } catch (e) {
    if (e instanceof AiProviderError && (e.status === 401 || e.status === 403)) {
      await admin.rpc("mark_org_ai_failing", { _org: organizationId, _error: e.message });
    }
    throw e;
  }
}

/** Maps AI errors to the HTTP answer the app understands. */
export function aiErrorResponse(e: unknown, headers: Record<string, string>): Response | null {
  if (e instanceof AiNotConnectedError) {
    return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: 409, headers: { ...headers, "Content-Type": "application/json" } });
  }
  if (e instanceof AiProviderError) {
    const status = e.status === 429 ? 429 : 502;
    return new Response(JSON.stringify({ error: e.message, code: e.code }), { status, headers: { ...headers, "Content-Type": "application/json" } });
  }
  return null;
}
