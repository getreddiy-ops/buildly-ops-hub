// AI Assistant edge function - confirm-before-write workflow
// Uses Lovable AI Gateway (OpenAI-compatible).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jurisdictionPromptBlock } from "../_shared/jurisdiction.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: any;
  tool_call_id?: string;
};

const WRITE_TOOLS = new Set(["create_lead", "create_customer", "schedule_job", "draft_estimate_for_customer"]);

const tools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Propose creating a new sales lead. Requires user approval before writing.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Contact name" },
          email: { type: "string" },
          phone: { type: "string" },
          source: { type: "string", description: "e.g. referral, website, call" },
          notes: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_customer",
      description: "Propose creating a customer record. Requires approval.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "schedule_job",
      description: "Propose scheduling a job for a customer. Requires approval.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string", description: "Existing customer name (matched fuzzy)" },
          title: { type: "string" },
          description: { type: "string" },
          scheduled_start: { type: "string", description: "ISO timestamp" },
          scheduled_end: { type: "string", description: "ISO timestamp" },
          address: { type: "string" },
        },
        required: ["customer_name", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_estimate_for_customer",
      description: "Propose drafting an estimate with line items for a customer. Requires approval.",
      parameters: {
        type: "object",
        properties: {
          customer_name: { type: "string" },
          title: { type: "string" },
          line_items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "number" },
              },
              required: ["description", "quantity", "unit_price"],
              additionalProperties: false,
            },
          },
          tax_rate: { type: "number", description: "Percentage, e.g. 8.5" },
          notes: { type: "string" },
        },
        required: ["customer_name", "title", "line_items"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM = `You are the Contractor OS AI Assistant for a contracting business.
You help the office manage leads, customers, estimates, jobs, and crew.

When the user attaches a photo of a job site, surface, or object, look at it carefully and:
- Identify what work is needed (paint, drywall, demo, flooring, framing, roofing, etc.).
- Estimate dimensions using visible reference objects when no measurement is given. Common references:
  standard interior door ≈ 80 in × 36 in, standard outlet plate ≈ 4.5 in tall, brick course ≈ 2.67 in,
  standard step rise ≈ 7 in, 2x4 stud width ≈ 1.5 in, sheet of drywall ≈ 4 ft × 8 ft.
- Always state the assumptions you made and the rough size you derived (e.g. "wall ≈ 12 ft × 9 ft = 108 sqft").
- Ask for measurements when the photo doesn't give a clear reference.
- Use the derived size + the business's typical pricing (from the business profile, if present) to draft estimate line items.
- When the user wants to save an estimate, call draft_estimate_for_customer with realistic quantities and unit prices.

When the user asks you to create, schedule, or draft anything that changes data,
call the appropriate tool. The user MUST approve every proposed write before it is applied —
never claim a record was created. After proposing actions, briefly explain what you proposed and the assumptions.
For questions and summaries, answer directly in concise markdown.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, orgName, organizationId, environment } = await req.json() as {
      messages: ChatMsg[];
      orgName?: string;
      organizationId?: string;
      environment?: "sandbox" | "live";
    };
    if (!Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- Authn + subscription gate ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!organizationId || !environment || !["sandbox", "live"].includes(environment)) {
      return new Response(JSON.stringify({ error: "organizationId and environment required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Ensure caller is a member of the org they claim
    const { data: membership } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("user_id", userData.user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    // Check org has an active subscription in this environment, on Plus or Premium tier
    const { data: subRow } = await admin
      .from("subscriptions")
      .select("price_id,status,current_period_end")
      .eq("organization_id", organizationId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ASSISTANT_PRICE_IDS = new Set([
      "contractor_os_plus_monthly",
      "contractor_os_premium_monthly",
    ]);
    const now = Date.now();
    const periodEnd = subRow?.current_period_end ? new Date(subRow.current_period_end).getTime() : null;
    const activeStatus =
      subRow &&
      ((["active", "trialing", "past_due"].includes(subRow.status) && (!periodEnd || periodEnd > now)) ||
        (subRow.status === "canceled" && !!periodEnd && periodEnd > now));
    if (!subRow || !activeStatus || !ASSISTANT_PRICE_IDS.has(subRow.price_id)) {
      return new Response(
        JSON.stringify({ error: "Plus or Premium subscription required", code: "subscription_required" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // --- End gate ---

    // Fetch business profile for context
    const { data: orgRow } = await admin
      .from("organizations")
      .select("name, address, business_profile")
      .eq("id", organizationId)
      .maybeSingle();
    const bp = (orgRow?.business_profile ?? {}) as Record<string, unknown>;
    const bpText = Object.keys(bp).length
      ? `\n\nBusiness profile (treat as authoritative facts about this business):\n${JSON.stringify(bp, null, 2)}`
      : "";
    const jurisdictionText = jurisdictionPromptBlock(
      (orgRow?.address as string | null) ?? null,
      (bp.service_area as string | null) ?? null,
    );
    const sys = `${SYSTEM}${orgName || orgRow?.name ? `\n\nActive organization: ${orgName ?? orgRow?.name}.` : ""}${bpText}${jurisdictionText}`;

    const payload = {
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, ...messages],
      tools,
      tool_choice: "auto",
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const choice = data.choices?.[0]?.message ?? {};
    const toolCalls = (choice.tool_calls ?? []).map((tc: any) => {
      let args: any = {};
      try { args = JSON.parse(tc.function?.arguments ?? "{}"); } catch { /* */ }
      return {
        id: tc.id,
        name: tc.function?.name,
        args,
        needsApproval: WRITE_TOOLS.has(tc.function?.name),
      };
    });

    return new Response(
      JSON.stringify({ content: choice.content ?? "", tool_calls: toolCalls }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
