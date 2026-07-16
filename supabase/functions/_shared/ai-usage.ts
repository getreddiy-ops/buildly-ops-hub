// AI usage logger — writes one row per AI call to public.ai_usage
// so admins can see per-organization spend on model usage.
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

// Price per 1M tokens (input, output) in USD. Best-effort estimates.
// Sources: OpenAI + Google published list prices as of 2025-Q4.
const CHAT_PRICING: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash": { in: 0.30, out: 2.50 },
  "google/gemini-3-flash-preview": { in: 0.30, out: 2.50 },
  "gpt-4o-mini": { in: 0.15, out: 0.60 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.60 },
};

// Audio pricing — $/1M audio-input-tokens or per-char output for TTS.
const AUDIO_PRICING = {
  // gpt-4o-mini-transcribe: $0.003/min ≈ we approximate by input bytes.
  transcribeUsdPerMbAudio: 0.02, // rough: covers typical webm bitrates
  ttsUsdPerMillionChars: 0.60,
};

export function estimateChatCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const key = model.replace(/^openai\//, "openai/").toLowerCase();
  const p = CHAT_PRICING[model] ?? CHAT_PRICING[key] ?? { in: 0.30, out: 1.00 };
  return (promptTokens / 1_000_000) * p.in + (completionTokens / 1_000_000) * p.out;
}

export function estimateTranscribeCostUsd(bytes: number): number {
  return (bytes / (1024 * 1024)) * AUDIO_PRICING.transcribeUsdPerMbAudio;
}

export function estimateTtsCostUsd(chars: number): number {
  return (chars / 1_000_000) * AUDIO_PRICING.ttsUsdPerMillionChars;
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Resolve the caller's user id from an Authorization: Bearer <jwt> header. */
export async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await anon.auth.getUser();
  return data.user?.id ?? null;
}

/** Pick the user's primary org (first membership) when the caller didn't send one. */
export async function resolvePrimaryOrgId(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.organization_id ?? null;
}

export type LogAiUsage = {
  organizationId: string | null;
  userId: string | null;
  functionName: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  status?: "ok" | "error";
  metadata?: Record<string, unknown>;
};

/** Fire-and-forget usage log. Never throws — logging must not break the call. */
export async function logAiUsage(admin: SupabaseClient, u: LogAiUsage): Promise<void> {
  try {
    const pt = u.promptTokens ?? 0;
    const ct = u.completionTokens ?? 0;
    await admin.from("ai_usage").insert({
      organization_id: u.organizationId,
      user_id: u.userId,
      function_name: u.functionName,
      model: u.model ?? null,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: u.totalTokens ?? (pt + ct),
      estimated_cost_usd: u.estimatedCostUsd ?? 0,
      status: u.status ?? "ok",
      metadata: u.metadata ?? null,
    });
  } catch (e) {
    console.error("logAiUsage failed:", e);
  }
}
