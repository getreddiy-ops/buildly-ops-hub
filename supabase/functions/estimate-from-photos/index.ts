// Vision AI draft estimator: a contractor uploads job-site photos, the model
// spots objects with well-known real-world sizes (interior doors, outlet/
// switch plates, standard lumber, etc.), uses them to scale the photo, and
// proposes measurements + a line-item draft. Mirrors ai-assistant's
// confirm-before-write philosophy: this never writes to the database, it
// only returns a draft for the contractor to review, edit, and save.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

import { aiErrorResponse, chatForOrg } from "../_shared/ai-provider.ts";
import type { ToolDef } from "../_shared/ai-translate.ts";

const MAX_IMAGES = 6;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

const SYSTEM_PROMPT = `You help contractors turn job-site photos into a rough, editable draft estimate. You are careful and honest about uncertainty — a bad guess dressed up as a fact can cost a contractor money on a real bid.

MEASURING FROM PHOTOS
Photos have no built-in scale. To estimate real-world dimensions, first look for one or more objects with a well-known, standardized real-world size, in this rough order of trustworthiness:
- Electrical outlet or switch cover plate: single-gang plate is ~4.5in x 2.75in.
- Interior door: standard height is 80in; width is usually 28-36in (state your assumption).
- Framing lumber (2x4, visible stud): actual dressed size 1.5in x 3.5in.
- Concrete masonry unit (cinder block): nominal 8in x 16in face.
- Asphalt shingle courses: ~5in exposure per course.
- A light fixture, TV, or similar consumer object: sizes vary a lot, so only use these as a last resort and mark confidence "low".
Use the most trustworthy reference object(s) actually visible, state which one(s) you used and your confidence, then estimate the target area's real-world dimensions from that scale. If you cannot find any usable reference object in a photo, say so plainly in that measurement's confidence rather than guessing blind.

PRICING — NEVER INVENT A PRICE
You will be given the contractor's own material price list (name, unit, unit cost). When a needed material clearly matches an entry on that list, use its id and price. When nothing on the list matches, set price_required to true and leave unit_price null — do not make up a price or pull one from general knowledge of retail prices.

OUTPUT
Call propose_estimate_from_photos exactly once with your full result. Every measurement and line item is a rough draft the contractor must verify on-site before quoting — say so in "caveats".`;

const tools = [
  {
    type: "function",
    function: {
      name: "propose_estimate_from_photos",
      description: "Return a structured, best-effort draft estimate derived from job-site photos.",
      parameters: {
        type: "object",
        properties: {
          reference_objects: {
            type: "array",
            description: "Objects with known real-world sizes used to establish scale.",
            items: {
              type: "object",
              properties: {
                object: { type: "string", description: "e.g. 'single-gang light switch plate'" },
                assumed_real_world_size: { type: "string", description: "e.g. '4.5in x 2.75in'" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["object", "assumed_real_world_size", "confidence"],
              additionalProperties: false,
            },
          },
          measurements: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area_description: { type: "string", description: "e.g. 'north living-room wall'" },
                estimated_dimensions: { type: "string", description: "e.g. '12ft x 9ft (~108 sq ft)'" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
              required: ["area_description", "estimated_dimensions", "confidence"],
              additionalProperties: false,
            },
          },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number", exclusiveMinimum: 0 },
                unit: { type: "string", description: "e.g. 'sq ft', 'linear ft', 'each'" },
                matched_material_id: {
                  anyOf: [{ type: "string" }, { type: "null" }],
                  description: "id from the provided material list, or null if unmatched",
                },
                unit_price: {
                  anyOf: [{ type: "number", minimum: 0 }, { type: "null" }],
                  description: "Only set when matched_material_id is set. Otherwise null.",
                },
                price_required: {
                  type: "boolean",
                  description: "True when this item has no matching material and needs a manual price.",
                },
              },
              required: ["description", "quantity", "unit", "matched_material_id", "unit_price", "price_required"],
              additionalProperties: false,
            },
          },
          caveats: {
            type: "string",
            description: "Plain-language summary of assumptions and what the contractor must verify on-site.",
          },
        },
        required: ["reference_objects", "measurements", "line_items", "caveats"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { organizationId, environment, images, jobTitle, notes } = (await req.json()) as {
      organizationId?: string;
      environment?: "sandbox" | "live";
      images?: string[];
      jobTitle?: string;
      notes?: string;
    };

    if (!organizationId || !environment || !["sandbox", "live"].includes(environment)) {
      return json(400, { error: "organizationId and environment required" });
    }
    if (!Array.isArray(images) || images.length === 0) {
      return json(400, { error: "At least one photo is required" });
    }
    if (images.length > MAX_IMAGES) {
      return json(400, { error: `Send at most ${MAX_IMAGES} photos at a time` });
    }
    if (!images.every((src) => typeof src === "string" && src.startsWith("data:image/"))) {
      return json(400, { error: "images must be data URLs" });
    }

    // --- Authn + subscription gate (same policy as ai-assistant) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json(401, { error: "Unauthorized" });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const [{ data: membership }, { data: platformRole }] = await Promise.all([
      admin
        .from("organization_members")
        .select("user_id")
        .eq("user_id", userData.user.id)
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id)
        .eq("role", "platform_admin")
        .maybeSingle(),
    ]);
    const isPlatformAdmin = !!platformRole;
    if (!membership && !isPlatformAdmin) return json(403, { error: "Forbidden" });

    const { data: subRow } = await admin
      .from("subscriptions")
      .select("price_id,status,current_period_end")
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ASSISTANT_PRICE_IDS = new Set(["contractor_os_plus_monthly", "contractor_os_premium_monthly"]);
    const periodEnd = subRow?.current_period_end ? new Date(subRow.current_period_end).getTime() : null;
    const activeStatus =
      subRow && ["active", "trialing", "past_due"].includes(subRow.status) && (!periodEnd || periodEnd > Date.now());
    if (!isPlatformAdmin && (!subRow || !activeStatus || !ASSISTANT_PRICE_IDS.has(subRow.price_id))) {
      return json(402, { error: "Plus or Premium subscription required", code: "subscription_required" });
    }
    // --- End gate ---

    const [{ data: materials }, { data: orgRow }] = await Promise.all([
      admin
        .from("materials")
        .select("id, name, unit, unit_cost, category")
        .eq("organization_id", organizationId)
        .order("name")
        .limit(300),
      admin.from("organizations").select("business_profile").eq("id", organizationId).maybeSingle(),
    ]);

    const bp = (orgRow?.business_profile ?? {}) as Record<string, unknown>;
    const overagePct = Number(bp.material_overage_pct ?? 10);
    const laborRate = Number(bp.default_labor_rate ?? 100);
    const estimatingDefaultsText = `\n\nThis contractor's estimating defaults: apply a ${overagePct}% material overage to quantities you calculate from measurements (round up), and use $${laborRate}/hr as the default labor rate when a line item is for labor rather than materials.`;

    const materialsText = materials?.length
      ? `\n\nThis contractor's material price list (id, name, unit, unit cost) — match line items against these when reasonable:\n${
          materials.map((m) => `- ${m.id} | ${m.name} | ${m.unit} | $${Number(m.unit_cost).toFixed(2)}${m.category ? ` | ${m.category}` : ""}`).join("\n")
        }`
      : "\n\nThis contractor has no material price list configured yet. Set price_required=true and unit_price=null for every line item.";

    const contextText = [jobTitle ? `Job title: ${jobTitle}` : null, notes ? `Contractor notes: ${notes}` : null]
      .filter(Boolean)
      .join("\n");

    const userContent: ContentPart[] = [
      { type: "text", text: `${contextText || "No additional job context given."}${estimatingDefaultsText}${materialsText}` },
      ...images.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
    ];

    // Bring-your-own AI: the business's own provider and key (Settings → AI).
    let result;
    try {
      result = await chatForOrg(admin, organizationId, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: tools as ToolDef[],
        tool_choice: { type: "function", function: { name: "propose_estimate_from_photos" } },
        max_tokens: 8000,
      }, 90000);
    } catch (e) {
      const handled = aiErrorResponse(e, corsHeaders);
      if (handled) return handled;
      throw e;
    }
    const model = result.model;
    const call = result.tool_calls[0];
    if (!call) return json(502, { error: "AI did not return a structured estimate" });

    let draft: unknown;
    try {
      draft = JSON.parse(call.function.arguments || "{}");
    } catch {
      return json(502, { error: "AI returned an unparsable estimate" });
    }

    try {
      const { logAiUsage, estimateChatCostUsd } = await import("../_shared/ai-usage.ts");
      const pt = result.usage.prompt_tokens;
      const ct = result.usage.completion_tokens;
      await logAiUsage(admin, {
        organizationId,
        userId: userData.user.id,
        functionName: "estimate-from-photos",
        model,
        promptTokens: pt,
        completionTokens: ct,
        totalTokens: result.usage.total_tokens,
        estimatedCostUsd: estimateChatCostUsd(model, pt, ct),
      });
    } catch (_) { /* never break the response on logging */ }

    return json(200, { draft });
  } catch (error) {
    console.error("estimate-from-photos error:", error);
    return json(500, { error: String((error as Error).message) });
  }
});
