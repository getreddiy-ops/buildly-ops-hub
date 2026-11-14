// Reads a concrete plan set with the business's own vision AI and stores the result as a DRAFT
// takeoff for a person to review (launch plan Phase 7.2). It never writes an estimate.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { aiErrorResponse, chatForOrg } from "../_shared/ai-provider.ts";
import type { ContentPart, ToolDef } from "../_shared/ai-translate.ts";
import { TAKEOFF_TOOL_PARAMETERS } from "../_shared/takeoff-schema.ts";
import { normalizeTakeoff } from "../_shared/takeoff-normalize.ts";

const MAX_SHEETS_PER_READ = 8;

const SYSTEM = `You do concrete quantity takeoffs from construction drawings for a contractor. You READ the drawings; you never design.

Scope: footings (continuous and spread), stem/foundation walls, slabs and flatwork, retaining walls. Ignore framing, roofing, MEP and anything above the foundation.

Rules:
- Record only what the drawings state, with the sheet and detail where you read it and the callout text as printed (source.note).
- Dimensions: footing/slab lengths in feet; widths, depths, thicknesses, heights, spacing, laps, embedment and cover in inches. Convert 1'-4" to 16 inches.
- Rebar, anchor bolts, hold-downs and joints come only from callouts, schedules, sections or general notes. If a value (lap length, bolt end distance, embedment, cover, spacing, count) is not on the drawings, set it to null and add an entry to "missing" (e.g. "Lap length for #5 bars"). Never fill a structural value from code minimums or typical practice.
- Use plan dimensions, not measurements from the image. If a run's length is not dimensioned, set lengthFt to null and list it in "missing".
- Typical details apply to every run they cover; give each run its own element (e.g. one per wall line) and point each rebar/bolt entry at its element id.
- "formed": false only when a section shows the footing poured against earth.
- constructionJointRule: quote what the drawings say about construction/cold joints, or null if they say nothing.
- confidence: 0.9+ when read directly from a dimension or callout, 0.5–0.8 when inferred from a typical detail, lower when unsure.
Call record_takeoff exactly once.`;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user || userData.user.is_anonymous) return json(401, { error: "Unauthorized" });

  let planSetId = "";
  try { planSetId = String((await req.json()).planSetId ?? ""); } catch { /* handled below */ }
  if (!planSetId) return json(400, { error: "planSetId is required" });

  // Read through the user's own client first: RLS proves they belong to the business.
  const { data: set } = await userClient.from("plan_sets").select("id, organization_id, title").eq("id", planSetId).maybeSingle();
  if (!set) return json(404, { error: "Plan set not found" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: sheets } = await admin.from("plan_sheets")
    .select("page_number, storage_path, sheet_label, kind")
    .eq("plan_set_id", planSetId).eq("include_in_reading", true)
    .order("page_number").limit(MAX_SHEETS_PER_READ + 1);
  if (!sheets?.length) return json(400, { error: "Choose at least one sheet to read" });
  if (sheets.length > MAX_SHEETS_PER_READ) return json(400, { error: `Choose up to ${MAX_SHEETS_PER_READ} sheets: the foundation plan, sections/details and general notes.` });

  await admin.from("plan_sets").update({ status: "reading", last_error: null, updated_at: new Date().toISOString() }).eq("id", planSetId);

  try {
    const content: ContentPart[] = [{ type: "text", text: `Plan set: ${set.title}. ${sheets.length} sheet image(s) follow, in page order.` }];
    for (const s of sheets) {
      const file = await admin.storage.from("plan-sets").download(s.storage_path);
      if (file.error || !file.data) throw new Error(`Could not load page ${s.page_number}`);
      content.push({ type: "text", text: `Page ${s.page_number}${s.sheet_label ? ` (sheet ${s.sheet_label})` : ""}${s.kind !== "unsorted" ? `, marked as ${s.kind}` : ""}:` });
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${encodeBase64(new Uint8Array(await file.data.arrayBuffer()))}` } });
    }

    const tool: ToolDef = { type: "function", function: { name: "record_takeoff", description: "Record the concrete takeoff read from the drawings.", parameters: TAKEOFF_TOOL_PARAMETERS } };
    const result = await chatForOrg(admin, set.organization_id, {
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content }],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "record_takeoff" } },
      max_tokens: 16000,
    }, 150000);

    const call = result.tool_calls[0];
    if (!call) throw new Error("The AI did not return a takeoff. Try again or check the selected sheets.");
    const takeoff = normalizeTakeoff(JSON.parse(call.function.arguments || "{}"));

    await admin.from("plan_sets").update({ status: "review", takeoff_draft: takeoff, updated_at: new Date().toISOString() }).eq("id", planSetId);

    try {
      const { logAiUsage, estimateChatCostUsd } = await import("../_shared/ai-usage.ts");
      await logAiUsage(admin, {
        organizationId: set.organization_id, userId: userData.user.id, functionName: "plan-takeoff", model: result.model,
        promptTokens: result.usage.prompt_tokens, completionTokens: result.usage.completion_tokens,
        estimatedCostUsd: estimateChatCostUsd(result.model, result.usage.prompt_tokens, result.usage.completion_tokens),
        metadata: { planSetId, sheets: sheets.length, provider: result.provider },
      });
    } catch (_) { /* logging never breaks the read */ }

    return json(200, { status: "review", counts: { elements: takeoff.elements.length, rebar: takeoff.rebar.length, missing: takeoff.missing.length } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Reading the plans failed";
    await admin.from("plan_sets").update({ status: "failed", last_error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq("id", planSetId);
    const handled = aiErrorResponse(e, corsHeaders);
    if (handled) return handled;
    console.error("plan-takeoff error", e);
    return json(500, { error: message });
  }
});
