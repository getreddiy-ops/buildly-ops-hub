// AI Form Fill — converts free-text prompts into structured form values.
// Returns a JSON object keyed by the requested field names.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { TRADE_KNOWLEDGE_PROMPT } from "../_shared/trade-knowledge.ts";
import { requireAuthedUser } from "../_shared/require-user.ts";

import { aiErrorResponse, chatForOrg } from "../_shared/ai-provider.ts";
import { getServiceClient, getUserIdFromAuth, resolvePrimaryOrgId } from "../_shared/ai-usage.ts";

type Field = {
  name: string;
  type?: "string" | "number" | "boolean" | "date" | "email" | "phone";
  description?: string;
  enum?: string[];
};

type Body = {
  prompt: string;
  formName?: string;
  fields: Field[];
  context?: Record<string, unknown>;
  /** Which business to use; defaults to the caller's first business. */
  organizationId?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = requireAuthedUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json()) as Body;
    if (!body?.prompt || !Array.isArray(body.fields) || body.fields.length === 0) {
      return new Response(JSON.stringify({ error: "prompt and fields are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build JSON schema for structured output
    const properties: Record<string, unknown> = {};
    for (const f of body.fields) {
      const t = f.type ?? "string";
      const base: Record<string, unknown> =
        t === "number" ? { type: ["number", "null"] } :
        t === "boolean" ? { type: ["boolean", "null"] } :
        { type: ["string", "null"] };
      if (f.description) base.description = f.description;
      if (f.enum && f.enum.length) base.enum = [...f.enum, null];
      properties[f.name] = base;
    }

    const system = `You extract structured form values from a user's free-text request for a "${body.formName ?? "form"}" in a contractor business app.
Rules:
- Output only values that are clearly present or strongly implied.
- For any field you cannot confidently fill, return null.
- Dates must be ISO 8601 (YYYY-MM-DD or full RFC3339).
- Phone numbers may be left in the user's format.
- Do not invent details, prices, or names that aren't given.
- When the form is an estimate, invoice, or line-item builder, apply the trade
  knowledge below to derive realistic quantities (rebar lf, form boards, 2x4s,
  sheets of drywall, bundles of shingles, gallons of paint, etc.) from the
  dimensions and trade implied by the user. Itemize support materials, never
  collapse them into a single "materials" line.

${TRADE_KNOWLEDGE_PROMPT}`;

    const userMsg = `Form context: ${JSON.stringify(body.context ?? {})}
User request: """${body.prompt}"""

Fill the following fields:
${body.fields.map((f) => `- ${f.name} (${f.type ?? "string"}): ${f.description ?? ""}${f.enum ? ` | one of: ${f.enum.join(", ")}` : ""}`).join("\n")}`;

    const tool = {
      type: "function",
      function: {
        name: "fill_form",
        description: "Return extracted form values.",
        parameters: {
          type: "object",
          properties,
          required: body.fields.map((f) => f.name),
          additionalProperties: false,
        },
      },
    };

    // Bring-your-own AI: resolve the business, check membership, call its own provider.
    const admin = getServiceClient();
    const uid = await getUserIdFromAuth(req.headers.get("Authorization"));
    if (!uid) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    let orgId = body.organizationId ?? null;
    if (orgId) {
      const { data: member } = await admin.rpc("is_org_member", { _user_id: uid, _org_id: orgId });
      if (!member) return new Response(JSON.stringify({ error: "Not a member of that business" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      orgId = await resolvePrimaryOrgId(admin, uid);
    }
    if (!orgId) return new Response(JSON.stringify({ error: "No business found for this account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let result;
    try {
      result = await chatForOrg(admin, orgId, {
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [tool as never],
        tool_choice: { type: "function", function: { name: "fill_form" } },
        max_tokens: 2000,
      }, 45000);
    } catch (e) {
      const handled = aiErrorResponse(e, corsHeaders);
      if (handled) return handled;
      throw e;
    }

    const call = result.tool_calls[0];
    let values: Record<string, unknown> = {};
    try {
      values = call?.function?.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      values = {};
    }

    // Strip nulls so the caller can spread without clobbering placeholders
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v !== null && v !== undefined && v !== "") cleaned[k] = v;
    }

    // Track per-org AI usage (the business pays its provider; this is for its own visibility)
    try {
      const { logAiUsage, estimateChatCostUsd } = await import("../_shared/ai-usage.ts");
      await logAiUsage(admin, {
        organizationId: orgId,
        userId: uid,
        functionName: "ai-form-fill",
        model: result.model,
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        estimatedCostUsd: estimateChatCostUsd(result.model, result.usage.prompt_tokens, result.usage.completion_tokens),
        metadata: { formName: body.formName ?? null, provider: result.provider },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ values: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
