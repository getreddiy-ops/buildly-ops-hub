// Manage the org's phone assistant: load/save settings, create/update the
// ElevenLabs Conversational AI agent. Requires Premium tier (platform admins bypass).
import { jurisdictionPromptBlock } from "../_shared/jurisdiction.ts";
import {
  configurationMissing,
  corsHeaders,
  json,
  missingSecrets,
  requirePhoneAccess,
} from "../_shared/phone-access.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";

const DEFAULT_GREETING =
  "Hi, you have reached our office. I can help schedule an estimate, take a message, or transfer you to a team member.";
const DEFAULT_VOICE = "EXAVITQu4vr4xnSDxMaL";
const DEFAULT_CAPABILITIES = {
  book_estimates: true,
  capture_leads: true,
  transfer: true,
  voicemail: true,
  sms_followup: false,
  faq: true,
};

type SettingsBody = {
  organization_id: string;
  environment?: "sandbox" | "live";
  enabled?: boolean;
  voice_id?: string;
  greeting?: string;
  transfer_number?: string | null;
  capabilities?: Record<string, boolean>;
  setup_state?: Record<string, unknown>;
};

function buildSystemPrompt(
  orgName: string,
  greeting: string,
  capabilities: Record<string, boolean>,
  transfer: string | null,
  bp: Record<string, any>,
  orgAddress: string | null,
) {
  const caps: string[] = [];
  if (capabilities.book_estimates) caps.push("schedule estimate appointments");
  if (capabilities.capture_leads) caps.push("capture new lead details (name, address, phone, project scope)");
  if (capabilities.transfer && transfer) caps.push(`transfer the caller to a teammate at ${transfer}`);
  if (capabilities.voicemail) caps.push("take a detailed voicemail message");
  if (capabilities.sms_followup) caps.push("offer to send an SMS follow-up");
  if (capabilities.faq) caps.push("answer common questions about services, areas served, and pricing ranges");

  const bpLines: string[] = [];
  const add = (label: string, val: any) => {
    if (val == null) return;
    if (Array.isArray(val) && val.length === 0) return;
    if (typeof val === "string" && !val.trim()) return;
    bpLines.push(`- ${label}: ${Array.isArray(val) ? val.join(", ") : val}`);
  };
  add("Industry", bp.industry);
  add("Sub-trades", bp.sub_trades);
  add("Services offered", bp.services);
  add("Jobs we do NOT take", bp.out_of_scope);
  add("Service area", bp.service_area);
  add("Years in business", bp.years_in_business);
  add("Crew size", bp.crew_size);
  add("License", bp.license_info);
  add("Insurance", bp.insurance_info);
  add("Business hours", bp.business_hours);
  add("After-hours / emergency", bp.emergency_hours);
  add("Pricing model", bp.pricing_model);
  add("Typical price ranges", bp.typical_price_range);
  if (bp.free_estimates) bpLines.push("- Free estimates: yes");
  add("Payment terms", bp.payment_terms);
  add("Warranty", bp.warranty);
  add("Brand voice", bp.brand_voice);
  add("Never say / never promise", bp.do_not_say);
  add("Unique selling points", bp.unique_selling_points);
  add("Competitors", bp.competitors);
  add("Lead qualification questions", bp.lead_qualification);
  add("Booking policy", bp.booking_policy);
  add("Cancellation policy", bp.cancellation_policy);
  add("Escalation contact", bp.escalation_contact);
  add("FAQs", bp.faqs);
  add("Additional notes", bp.notes);
  const bpBlock = bpLines.length
    ? `\n\nBusiness profile (authoritative — use these facts, do not invent others):\n${bpLines.join("\n")}`
    : "";

  return [
    `You are the friendly virtual receptionist for ${orgName}, a contracting business.`,
    `Greeting: "${greeting}"`,
    `Your goals, in order: ${caps.join("; ")}.`,
    `Always speak naturally, keep replies short, and confirm details by repeating them back.`,
    `If the caller wants to book an estimate, collect: full name, phone, address, type of work, preferred day & time window. Also confirm the state where the work will be performed so the office can apply the correct licensing, contract, and sales-tax rules.`,
    `Never invent prices, license numbers, or legal/tax requirements. If unsure, offer to have someone follow up.`,
    `Do not give legal advice. If a caller asks about cancellation rights, lien notices, warranty, or contract terms, summarize that the written contract will follow the laws of the state where the work is performed and offer to have a teammate confirm specifics.`,
    transfer ? `If they ask for a human, offer to transfer to ${transfer}.` : `If they ask for a human, take a message.`,
  ].join("\n") + bpBlock + jurisdictionPromptBlock(orgAddress, bp?.service_area ?? null);
}

async function upsertAgent(opts: {
  agentId: string | null;
  name: string;
  prompt: string;
  greeting: string;
  voiceId: string;
}): Promise<string> {
  const body = {
    name: opts.name,
    conversation_config: {
      agent: {
        first_message: opts.greeting,
        language: "en",
        prompt: { prompt: opts.prompt },
      },
      tts: { voice_id: opts.voiceId },
    },
  };
  const url = opts.agentId
    ? `https://api.elevenlabs.io/v1/convai/agents/${opts.agentId}`
    : `https://api.elevenlabs.io/v1/convai/agents/create`;
  const method = opts.agentId ? "PATCH" : "POST";
  const res = await fetch(url, {
    method,
    headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${text}`);
  const data = JSON.parse(text);
  return opts.agentId ?? data.agent_id;
}

// Best-effort: register the post-call webhook at the workspace level. Idempotent.
async function ensurePostCallWebhook() {
  const url = `${SUPABASE_URL}/functions/v1/elevenlabs-postcall`;
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/convai/settings", {
      method: "PATCH",
      headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_initiation_client_data_webhook: { url, request_headers: {} },
        webhooks: { post_call_webhook_url: url },
      }),
    });
    if (!res.ok) console.warn("post-call webhook register failed", res.status);
  } catch (e) {
    console.warn("post-call webhook register error", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as SettingsBody;
    const orgId = body.organization_id;
    const environment = body.environment === "live" ? "live" : "sandbox";

    const access = await requirePhoneAccess(req, orgId, environment);
    if (!access.ok) return access.response;
    const { admin } = access;

    const missing = missingSecrets(["ELEVENLABS_API_KEY"]);
    if (missing.length) return configurationMissing(missing);

    const { data: org } = await admin
      .from("organizations")
      .select("name, address, business_profile")
      .eq("id", orgId)
      .single();

    // Idempotency guard: claim the row first so two concurrent "create" clicks
    // cannot both create an ElevenLabs agent.
    const { data: existingBefore } = await admin
      .from("phone_assistants")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    let existing = existingBefore;
    if (!existing) {
      const { data: claimed } = await admin
        .from("phone_assistants")
        .insert({
          organization_id: orgId,
          enabled: body.enabled ?? true,
          voice_id: body.voice_id ?? DEFAULT_VOICE,
          greeting: body.greeting ?? DEFAULT_GREETING,
          transfer_number: body.transfer_number || null,
          capabilities: body.capabilities ?? DEFAULT_CAPABILITIES,
        })
        .select()
        .maybeSingle();
      if (claimed) {
        existing = claimed;
      } else {
        // Lost the race — another request created it. Re-read.
        const { data: reread } = await admin
          .from("phone_assistants").select("*").eq("organization_id", orgId).maybeSingle();
        existing = reread;
      }
    }

    const merged = {
      enabled: body.enabled ?? existing?.enabled ?? true,
      voice_id: body.voice_id ?? existing?.voice_id ?? DEFAULT_VOICE,
      greeting: body.greeting ?? existing?.greeting ?? DEFAULT_GREETING,
      transfer_number: body.transfer_number ?? existing?.transfer_number ?? null,
      capabilities: body.capabilities ?? existing?.capabilities ?? DEFAULT_CAPABILITIES,
      setup_state: body.setup_state
        ? { ...(existing?.setup_state ?? {}), ...body.setup_state }
        : (existing?.setup_state ?? {}),
    };

    const prompt = buildSystemPrompt(
      org?.name ?? "the business",
      merged.greeting,
      merged.capabilities,
      merged.transfer_number,
      (org?.business_profile as Record<string, any>) ?? {},
      (org?.address as string | null) ?? null,
    );

    const agentId = await upsertAgent({
      agentId: existing?.elevenlabs_agent_id ?? null,
      name: `${org?.name ?? "Contractor"} Receptionist`,
      prompt,
      greeting: merged.greeting,
      voiceId: merged.voice_id,
    });

    const { data: saved, error } = await admin
      .from("phone_assistants")
      .upsert(
        { organization_id: orgId, ...merged, elevenlabs_agent_id: agentId },
        { onConflict: "organization_id" },
      )
      .select()
      .single();
    if (error) throw error;

    await ensurePostCallWebhook();

    return json({ assistant: saved });
  } catch (e) {
    console.error("phone-assistant error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
