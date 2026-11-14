// Bring-your-own AI: one request shape (OpenAI chat completions with tools) for every provider.
// Pure functions only (no Deno, no fetch) so vitest can prove the translations.

export const AI_PROVIDERS = ["openai", "anthropic", "google"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-2.5-flash",
};

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
};

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolDef = { type: "function"; function: { name: string; description?: string; parameters: Record<string, unknown> } };
export type ToolChoice = "auto" | "none" | "required" | { type: "function"; function: { name: string } };

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDef[];
  tool_choice?: ToolChoice;
  max_tokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  tool_calls: ToolCall[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

export function isProvider(value: unknown): value is AiProvider {
  return typeof value === "string" && (AI_PROVIDERS as readonly string[]).includes(value);
}

/** Last four characters of a key: the only part of it ever shown back to anyone. */
export function keyLast4(key: string): string {
  return key.trim().slice(-4);
}

/** Cheap shape check before we spend a network call validating a key. */
export function looksLikeKey(provider: AiProvider, key: string): boolean {
  const k = key.trim();
  if (k.length < 20 || /\s/.test(k)) return false;
  if (provider === "openai") return k.startsWith("sk-");
  if (provider === "anthropic") return k.startsWith("sk-ant-");
  return k.startsWith("AIza") || k.length >= 30;
}

// ---------- Anthropic Messages API ----------

function dataUrlToImageBlock(url: string) {
  const m = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(url);
  if (m) return { type: "image", source: { type: "base64", media_type: m[1].toLowerCase(), data: m[2] } };
  return { type: "image", source: { type: "url", url } };
}

function userContentToAnthropic(content: string | ContentPart[]) {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return content.map((part) => (part.type === "text" ? { type: "text", text: part.text } : dataUrlToImageBlock(part.image_url.url)));
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text || "{}"); } catch { return {}; }
}

export function toAnthropicRequest(req: ChatRequest, model: string) {
  const system = req.messages.filter((m) => m.role === "system").map((m) => m.content as string).join("\n\n");
  const messages: { role: "user" | "assistant"; content: unknown[] }[] = [];
  const push = (role: "user" | "assistant", blocks: unknown[]) => {
    const last = messages[messages.length - 1];
    // Anthropic requires alternating roles; consecutive same-role turns are merged.
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };
  for (const m of req.messages) {
    if (m.role === "system") continue;
    if (m.role === "user") push("user", userContentToAnthropic(m.content));
    else if (m.role === "assistant") {
      const blocks: unknown[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const tc of m.tool_calls ?? []) blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: safeJson(tc.function.arguments) });
      if (blocks.length) push("assistant", blocks);
    } else if (m.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }]);
    }
  }
  const body: Record<string, unknown> = {
    model,
    max_tokens: req.max_tokens ?? 4096,
    messages,
  };
  if (system) body.system = system;
  if (req.temperature != null) body.temperature = req.temperature;
  if (req.tools?.length && req.tool_choice !== "none") {
    body.tools = req.tools.map((t) => ({ name: t.function.name, description: t.function.description ?? "", input_schema: t.function.parameters }));
    const tc = req.tool_choice;
    if (tc === "required") body.tool_choice = { type: "any" };
    else if (tc && typeof tc === "object") body.tool_choice = { type: "tool", name: tc.function.name };
    else body.tool_choice = { type: "auto" };
  }
  return body;
}

export function fromAnthropicResponse(data: any, model: string): ChatResult {
  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const content = blocks.filter((b) => b.type === "text").map((b) => b.text).join("");
  const tool_calls: ToolCall[] = blocks.filter((b) => b.type === "tool_use").map((b) => ({
    id: String(b.id),
    type: "function",
    function: { name: String(b.name), arguments: JSON.stringify(b.input ?? {}) },
  }));
  const pt = Number(data?.usage?.input_tokens ?? 0);
  const ct = Number(data?.usage?.output_tokens ?? 0);
  return { content, tool_calls, usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: pt + ct }, model: String(data?.model ?? model) };
}

// ---------- OpenAI-compatible (OpenAI itself, and Google's OpenAI endpoint) ----------

export function toOpenAiRequest(req: ChatRequest, model: string) {
  const body: Record<string, unknown> = { model, messages: req.messages };
  if (req.tools?.length) {
    body.tools = req.tools;
    body.tool_choice = req.tool_choice ?? "auto";
  }
  if (req.max_tokens != null) body.max_tokens = req.max_tokens;
  if (req.temperature != null) body.temperature = req.temperature;
  return body;
}

export function fromOpenAiResponse(data: any, model: string): ChatResult {
  const msg = data?.choices?.[0]?.message ?? {};
  const pt = Number(data?.usage?.prompt_tokens ?? 0);
  const ct = Number(data?.usage?.completion_tokens ?? 0);
  return {
    content: typeof msg.content === "string" ? msg.content : "",
    tool_calls: (msg.tool_calls ?? []).map((tc: any) => ({
      id: String(tc.id ?? crypto.randomUUID()),
      type: "function",
      function: { name: String(tc.function?.name ?? ""), arguments: typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments ?? {}) },
    })),
    usage: { prompt_tokens: pt, completion_tokens: ct, total_tokens: Number(data?.usage?.total_tokens ?? pt + ct) },
    model: String(data?.model ?? model),
  };
}

/** Where each provider is called. Google is reached through its OpenAI-compatible endpoint. */
export function providerEndpoint(provider: AiProvider): string {
  if (provider === "anthropic") return "https://api.anthropic.com/v1/messages";
  if (provider === "google") return "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
  return "https://api.openai.com/v1/chat/completions";
}

export function providerHeaders(provider: AiProvider, key: string): Record<string, string> {
  if (provider === "anthropic") return { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" };
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
