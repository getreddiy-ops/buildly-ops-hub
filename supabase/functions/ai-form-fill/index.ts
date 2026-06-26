// AI Form Fill — converts free-text prompts into structured form values.
// Returns a JSON object keyed by the requested field names.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
- Do not invent details, prices, or names that aren't given.`;

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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "fill_form" } },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway: ${txt}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
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

    return new Response(JSON.stringify({ values: cleaned }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
