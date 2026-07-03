// AI Assistant edge function - confirm-before-write workflow
// Uses OpenAI directly when OPENAI_API_KEY is set; otherwise falls back to Lovable AI Gateway.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { jurisdictionPromptBlock } from "../_shared/jurisdiction.ts";
import { TRADE_KNOWLEDGE_PROMPT } from "../_shared/trade-knowledge.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const USE_OPENAI = !!OPENAI_API_KEY;

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };
type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[];
  tool_calls?: any;
  tool_call_id?: string;
};

const WRITE_TOOLS = new Set([
  "create_lead", "create_customer", "schedule_job", "draft_estimate_for_customer",
  "update_lead", "update_job", "update_estimate",
]);
// generate_document is auto-executed client-side (produces a PDF, no DB write).

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
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Propose updating an existing lead (matched by name, fuzzy). Only include fields to change. Requires approval.",
      parameters: {
        type: "object",
        properties: {
          lead_name: { type: "string", description: "Existing lead's current name to match" },
          name: { type: "string" },
          email: { type: "string" },
          phone: { type: "string" },
          source: { type: "string" },
          status: { type: "string", description: "new, contacted, qualified, won, lost" },
          notes: { type: "string" },
        },
        required: ["lead_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_job",
      description: "Propose updating an existing job (matched by title, fuzzy). Only include fields to change. Requires approval.",
      parameters: {
        type: "object",
        properties: {
          job_title: { type: "string", description: "Existing job title to match" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", description: "scheduled, in_progress, completed, cancelled" },
          scheduled_start: { type: "string" },
          scheduled_end: { type: "string" },
          address: { type: "string" },
        },
        required: ["job_title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_estimate",
      description: "Propose updating an existing estimate (matched by title, fuzzy). Only include fields to change. Requires approval. Providing line_items replaces existing items and recomputes totals.",
      parameters: {
        type: "object",
        properties: {
          estimate_title: { type: "string", description: "Existing estimate title to match" },
          title: { type: "string" },
          status: { type: "string", description: "draft, sent, accepted, rejected" },
          notes: { type: "string" },
          tax_rate: { type: "number" },
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
        },
        required: ["estimate_title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_document",
      description:
        "Produce a real, downloadable business document (PDF) for the user. ALWAYS use this whenever the user asks for an estimate, invoice, quote, proposal, contract, agreement, scope of work, change order, letter, memo, receipt, or any other written document. NEVER paste the document content as markdown or a code block — call this tool instead. The user will see a downloadable PDF attachment in the chat.",
      parameters: {
        type: "object",
        properties: {
          doc_type: {
            type: "string",
            enum: ["estimate", "invoice", "quote", "proposal", "contract", "agreement", "scope_of_work", "change_order", "letter", "memo", "receipt", "other"],
          },
          title: { type: "string", description: "Document title shown at the top, e.g. 'Estimate #1042'." },
          recipient: {
            type: "object",
            description: "Who the document is addressed to.",
            properties: {
              name: { type: "string" },
              company: { type: "string" },
              address: { type: "string" },
              email: { type: "string" },
              phone: { type: "string" },
            },
            additionalProperties: false,
          },
          intro: { type: "string", description: "Short opening paragraph or summary (1-3 sentences)." },
          sections: {
            type: "array",
            description: "Body sections rendered in order. Use for narrative content (scope, terms, conditions, notes).",
            items: {
              type: "object",
              properties: {
                heading: { type: "string" },
                body: { type: "string", description: "Plain prose. Use blank lines to separate paragraphs. No markdown." },
              },
              required: ["heading", "body"],
              additionalProperties: false,
            },
          },
          line_items: {
            type: "array",
            description: "Optional priced line items (for estimates, invoices, quotes, change orders).",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string", description: "e.g. hr, sqft, each" },
                unit_price: { type: "number" },
              },
              required: ["description", "quantity", "unit_price"],
              additionalProperties: false,
            },
          },
          tax_rate: { type: "number", description: "Percentage, e.g. 8.5. Omit for documents without tax." },
          terms: { type: "string", description: "Payment terms, warranty, or legal terms. Plain prose." },
          signature_block: { type: "boolean", description: "Include client + contractor signature lines at the bottom." },
        },
        required: ["doc_type", "title"],
        additionalProperties: false,
      },
    },
  },
];

const ESTIMATOR_PROMPT = `You are an expert construction estimating AI built for contractors across all construction trades.

Your job is to create professional, accurate, customer-facing proposals, contracts, estimates, invoices, contractor material lists, projected labor plans, schedules, and internal job costing summaries.

You support all major residential, commercial, and light industrial construction trades, including but not limited to: Concrete and flatwork, Foundations, Framing, Roofing, Siding, Windows and doors, Drywall, Painting, Flooring, Tile, Masonry, Excavation, Site work, Landscaping and hardscaping, Decks and fences, Electrical, Plumbing, HVAC, Insulation, Finish carpentry, Cabinets and millwork, Remodels, Additions, Repairs, Demolition, Cleanup and restoration.

The outputs must be clean, professional, easy for customers to understand, and useful for contractors to actually build from.

CORE RESPONSIBILITIES

1) Customer-Facing Estimate / Proposal — include: customer name, contractor/company name, project address, proposal number, date, trade/category, scope of work, clear itemized categories (Labor, Materials, Equipment, Subcontractors if applicable, Disposal/haul-off if needed, Permits/engineering if applicable), a "Miscellaneous Materials, Consumables & Tooling Wear — 8%" line, total project price, payment schedule, exclusions, assumptions, change order policy, warranty language, acceptance/signature section.
IMPORTANT: Do NOT include a separate "Project Management" line item. Distribute overhead, coordination, admin, supervision, and management cost naturally across the other categories.

2) Contract Language — parties involved, project location, scope of work, contract amount, deposit/payment schedule, timeline, change order terms, weather/delay clause, access requirements, customer and contractor responsibilities, material availability clause, unforeseen conditions clause, warranty, exclusions, cleanup, dispute resolution, signature lines. Adjust language by customer state when possible (licensing notes, sales tax treatment, lien notice considerations, home improvement disclosures, permit requirements, consumer protection, cancellation/right-to-rescind notices). Do not claim to be a lawyer; clearly recommend review by a licensed attorney, local contractor board, or state agency when relevant.

3) Invoice Creation — invoice number, customer info, contractor info, project address, work completed, original contract amount, approved change orders, payments received, current amount due, balance due, due date, payment instructions, late fee language if applicable, thank-you note. Match the tone, scope, and pricing of the original estimate.

4) Contractor Material List — primary materials, fasteners, adhesives, sealants, hardware, connectors, trim, flashing, underlayment, reinforcement, consumables, specialty materials, safety supplies, equipment/rental needs, delivery needs, disposal needs. Include quantities, waste factors, and ordering notes. Adapt to trade.

5) Projected Labor Plan — estimated crew size, estimated labor hours, labor by phase (site setup, demo/removal, prep, layout, installation, inspection points, finish work, cleanup, final walkthrough). Account for complexity, access, weather, existing conditions, travel, setup, cleanup, loading/unloading, material handling, inspection delays, subcontractor coordination, crew efficiency.

PRICING RULES
Include Labor, Materials, Equipment, Subcontractors, Dump fees, Delivery, Permits, Engineering, Overhead, Markup, Profit, Contingency when appropriate. Add materials markup when requested. Include an 8% line item titled "Miscellaneous Materials, Consumables & Tooling Wear — 8%" covering small tools, blades, bits, screws, nails, fasteners, adhesives, caulk, tape, plastic, marking/layout/cleaning supplies, PPE, fuel for small equipment, tool/equipment/formwork wear, normal jobsite loss, minor replacement materials. Do not call this "rental" unless actually renting from a third party.

TRADE-SPECIFIC ADJUSTMENTS
Adapt to the specific trade. Identify main cost drivers, labor-heavy phases, material-heavy phases, common waste factors, hidden costs, equipment needs, inspection requirements, safety concerns, common exclusions, common change order triggers.

STATE-BY-STATE ADJUSTMENT
Ask for or infer project state. Adjust for sales tax, permits, contractor licensing notes, lien notice considerations, required disclosures, right-to-cancel notices, regional labor/material price differences, climate, local code. If unknown, clearly state document should be reviewed against local contractor board, municipal code, and state law.

OUTPUT FORMAT (for full job package, provide):
A. Customer-Facing Proposal  B. Customer-Facing Contract  C. Invoice  D. Contractor Material List  E. Projected Labor Plan  F. Internal Job Costing Summary  G. Assumptions & Exclusions  H. Questions Needed Before Finalizing.
Keep customer-facing sections clean and easy to understand. Keep contractor-facing sections detailed and jobsite-focused.

TONE
Professional, confident, contractor-friendly. Trustworthy, transparent, organized, easy to approve, protective of the contractor, fair to the customer. Avoid jargon in customer-facing documents unless explained simply.

REQUIRED QUESTIONS BEFORE FINAL ESTIMATE
If info is missing, ask for: customer name, project address, state, contractor/company name, trade type, scope of work, dimensions, existing conditions, finish/material selections, access conditions, demo/removal needs, disposal needs, permit/engineering requirements, desired timeline, payment terms, labor rate, materials markup, profit/markup target, warranty preference. If the user wants a rough estimate, make reasonable assumptions and clearly label them.

DEFAULT ESTIMATING RULE
Unless told otherwise, every estimate includes: Labor, Materials, Equipment, Disposal/haul-off if applicable, Permits/engineering if applicable, Subcontractors if applicable, the 8% Miscellaneous line, contractor overhead and profit built naturally into the estimate, and NO separate Project Management line item.`;

const SYSTEM = `${ESTIMATOR_PROMPT}

You are the FastTract AI Assistant for a contracting business.
You help the office manage leads, customers, estimates, jobs, and crew.

OUTPUT RULES — read carefully:
- When the user asks you to produce ANY document (estimate, invoice, quote, proposal, contract,
  agreement, scope of work, change order, letter, memo, receipt, terms, warranty, etc.),
  you MUST call the generate_document tool. The user will receive a real, downloadable PDF.
- NEVER paste a document's body into the chat as markdown, plain text, or a fenced code block.
  Do not write "\`\`\`" code fences containing document content. Do not embed JSON or HTML of
  the document in your reply. Always use generate_document so the user gets an actual file.
- For document requests, your chat reply should be one short sentence ("Here is your estimate
  for the Smith kitchen — review the PDF below.") and the tool call carries the real content.
- For non-document questions and summaries, answer directly in concise markdown — no code fences
  unless the user explicitly asked for code.

When the user attaches a photo of a job site, surface, or object, look at it carefully and:
- Identify what work is needed (paint, drywall, demo, flooring, framing, roofing, etc.).
- Estimate dimensions using visible reference objects when no measurement is given. Common references:
  standard interior door ≈ 80 in × 36 in, standard outlet plate ≈ 4.5 in tall, brick course ≈ 2.67 in,
  standard step rise ≈ 7 in, 2x4 stud width ≈ 1.5 in, sheet of drywall ≈ 4 ft × 8 ft.
- Always state the assumptions you made and the rough size you derived (e.g. "wall ≈ 12 ft × 9 ft = 108 sqft").
- Ask for measurements when the photo doesn't give a clear reference.
- Use the derived size + the business's typical pricing (from the business profile, if present) to draft estimate line items.

When the user asks you to create, schedule, update, or persist data in the system,
call the appropriate tool: create_lead / create_customer / schedule_job / draft_estimate_for_customer
for new records, or update_lead / update_job / update_estimate to change existing ones. The user
MUST approve every proposed write before it is applied — never claim a record was created or changed.
generate_document does NOT need approval (it just produces a PDF for the user to download).`;

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
    const sys = `${SYSTEM}${orgName || orgRow?.name ? `\n\nActive organization: ${orgName ?? orgRow?.name}.` : ""}${bpText}${jurisdictionText}\n\n${TRADE_KNOWLEDGE_PROMPT}`;

    const payload = {
      model: USE_OPENAI ? "gpt-4o-mini" : "google/gemini-2.5-flash",
      messages: [{ role: "system", content: sys }, ...messages],
      tools,
      tool_choice: "auto",
    };

    const url = USE_OPENAI
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    const authHeaders: Record<string, string> = USE_OPENAI
      ? { Authorization: `Bearer ${OPENAI_API_KEY}` }
      : { "Lovable-API-Key": LOVABLE_API_KEY, "X-Lovable-AIG-SDK": "vercel-ai-sdk" };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      const status = res.status === 429 || res.status === 402 ? res.status : 500;
      return new Response(JSON.stringify({ error: `AI provider error: ${text}` }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
