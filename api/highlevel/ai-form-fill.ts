import {
  json,
  requirePost,
  respondHighLevelError,
  resolveHighLevelConnection,
} from "./_shared";

type Field = {
  name: string;
  type?: "string" | "number" | "boolean" | "date" | "email" | "phone" | "json";
  description?: string;
  enum?: string[];
};

type RequestBody = {
  prompt?: string;
  formName?: string;
  fields?: Field[];
  context?: Record<string, unknown>;
};

const TRADE_KNOWLEDGE = `
FastTract is an AI-first contractor business assistant. Use plain contractor language.
For estimates, identify the trade and organize work into customer-facing phases. Never show Project Management as a separate charge. Carry supervision, scheduling, administration, and coordination inside the work phases.
Never invent customer names, measurements, dates, labor rates, material prices, or taxes. When a price is not supplied by the prompt or context, use 0 and explain that the contractor must review the rate.
Concrete: volume is length x width x thickness, convert cubic feet to cubic yards by dividing by 27, and show a 10% order buffer only when the company context requests it. Include preparation, base, forms, reinforcement, placement, finish, joints, cleanup, and equipment when applicable.
Framing: include layout, demolition where stated, studs/plates, sheathing, hardware, labor, connected-trade exclusions, cleanup, and verified dimensions.
Decking: include structure, footings, posts, joists, decking, railing, stairs, hardware, labor, demolition, and cleanup when applicable.
For all trades, separate labor, primary materials, equipment, and support materials where the user provided enough information. Put assumptions and missing information in notes or warnings. The user must review every draft before it is saved or sent.
`;

function fieldSchema(field: Field) {
  if (field.name === "line_items") {
    return {
      type: ["array", "null"],
      description: field.description,
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          unit: { type: ["string", "null"] },
          unit_price: { type: "number" },
        },
        required: ["description", "quantity", "unit_price"],
        additionalProperties: false,
      },
    };
  }

  if (field.type === "json") {
    return {
      type: ["object", "array", "string", "null"],
      description: field.description,
    };
  }

  const schema: Record<string, unknown> = field.type === "number"
    ? { type: ["number", "null"] }
    : field.type === "boolean"
      ? { type: ["boolean", "null"] }
      : { type: ["string", "null"] };

  if (field.description) schema.description = field.description;
  if (field.enum?.length) schema.enum = [...field.enum, null];
  return schema;
}

function aiConfiguration() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    return {
      key: lovableKey,
      url: process.env.FASTTRACT_AI_GATEWAY_URL ?? "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: process.env.FASTTRACT_AI_MODEL ?? "google/gemini-2.5-flash",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return {
      key: openAiKey,
      url: process.env.FASTTRACT_AI_GATEWAY_URL ?? "https://api.openai.com/v1/chat/completions",
      model: process.env.FASTTRACT_AI_MODEL ?? "gpt-4.1-mini",
    };
  }

  throw new Error("FastTract AI is not configured. Add LOVABLE_API_KEY or OPENAI_API_KEY on the server.");
}

function parseToolValues(payload: any) {
  const call = payload?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call?.function?.arguments) return {};
  try {
    return JSON.parse(call.function.arguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function cleanValues(values: Record<string, unknown>) {
  const cleaned: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(values)) {
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;

    if (key === "line_items" && typeof rawValue === "string") {
      try {
        const parsed = JSON.parse(rawValue);
        if (Array.isArray(parsed)) cleaned[key] = parsed;
      } catch {
        // Ignore malformed AI JSON instead of putting it into a business record.
      }
      continue;
    }

    cleaned[key] = rawValue;
  }
  return cleaned;
}

function estimateWarnings(formName: string, values: Record<string, unknown>) {
  if (!formName.toLowerCase().includes("estimate")) return [];
  const warnings: string[] = [];
  const lineItems = values.line_items;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    warnings.push("No estimate line items were generated. Add verified scope and pricing before saving.");
    return warnings;
  }

  const zeroPriced = lineItems.filter((item) => {
    if (!item || typeof item !== "object") return false;
    return Number((item as Record<string, unknown>).unit_price) <= 0;
  }).length;
  if (zeroPriced > 0) {
    warnings.push(`${zeroPriced} line item${zeroPriced === 1 ? " has" : "s have"} no verified price. Review the company rate book before saving.`);
  }
  return warnings;
}

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const connection = await resolveHighLevelConnection(req);
    const body: RequestBody = req.body && typeof req.body === "object" ? req.body : {};
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const formName = typeof body.formName === "string" ? body.formName.trim().slice(0, 120) : "form";
    const fields = Array.isArray(body.fields) ? body.fields.slice(0, 30) : [];

    if (!prompt || !fields.length) {
      return json(res, 400, { error: "Prompt and fields are required" });
    }
    if (prompt.length > 12_000) {
      return json(res, 400, { error: "That request is too long. Keep the job description under 12,000 characters." });
    }

    const properties: Record<string, unknown> = {};
    for (const field of fields) {
      if (!field?.name || typeof field.name !== "string") continue;
      properties[field.name] = fieldSchema(field);
    }

    const fieldNames = Object.keys(properties);
    if (!fieldNames.length) return json(res, 400, { error: "No valid fields were supplied" });

    const tool = {
      type: "function",
      function: {
        name: "fill_fasttract_form",
        description: "Return only the structured FastTract values that are supported by the user's request.",
        parameters: {
          type: "object",
          properties,
          required: fieldNames,
          additionalProperties: false,
        },
      },
    };

    const system = `You extract structured business values for the ${formName} screen inside FastTract.\nRules:\n- Return null for anything you cannot confidently determine.\n- Never claim that data was saved, sent, scheduled, or changed.\n- Dates must use YYYY-MM-DD when a date is known.\n- Keep summaries direct and easy for a contractor to understand.\n${TRADE_KNOWLEDGE}`;

    const user = `Authenticated HighLevel location: ${connection.locationId}\nForm context: ${JSON.stringify(body.context ?? {})}\nUser request: ${prompt}\n\nReturn values for:\n${fields.map((field) => `- ${field.name}: ${field.description ?? field.type ?? "string"}${field.enum ? `; allowed: ${field.enum.join(", ")}` : ""}`).join("\n")}`;

    const ai = aiConfiguration();
    const response = await fetch(ai.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ai.key}`,
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "fill_fasttract_form" } },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429) return json(res, 429, { error: "Ava is receiving too many requests. Try again in a moment." });
      if (response.status === 402) return json(res, 402, { error: "FastTract AI credits need attention." });
      return json(res, 502, { error: "Ava could not process the request through the AI provider." });
    }

    const values = cleanValues(parseToolValues(payload));
    return json(res, 200, {
      values,
      warnings: estimateWarnings(formName, values),
      locationId: connection.locationId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown FastTract AI error";
    if (
      message.includes("context is required") ||
      message.includes("not installed") ||
      message.includes("GHL_APP_SHARED_SECRET")
    ) {
      return respondHighLevelError(res, error, "Ava could not verify this HighLevel workspace.");
    }
    console.error("FastTract embedded AI failed", error);
    if (message.includes("not configured")) {
      return json(res, 503, { error: "FastTract AI is not fully configured yet." });
    }
    return json(res, 500, { error: "Ava could not process that request." });
  }
}
