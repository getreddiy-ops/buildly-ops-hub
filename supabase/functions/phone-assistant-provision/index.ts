// Phone number lifecycle for the org's assistant.
// Actions: search | purchase | list_owned | connect_existing | status | release | save_setup
// Requires: authenticated active-org owner/admin + Premium (platform admins bypass).
import {
  configurationMissing,
  corsHeaders,
  isE164,
  json,
  missingSecrets,
  requirePhoneAccess,
} from "../_shared/phone-access.ts";

const GATEWAY = "https://connector-gateway.lovable.dev/twilio";
const PROJECT_ID = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/([^.]+)\./)?.[1];
const WEBHOOK_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/twilio-voice-webhook`;

async function twilio(path: string, method: string, params?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": `${Deno.env.get("TWILIO_API_KEY")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  };
  if (params && method !== "GET") init.body = new URLSearchParams(params);
  const url = `${GATEWAY}${path}` + (method === "GET" && params ? `?${new URLSearchParams(params)}` : "");
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    console.error(`Twilio request failed [${res.status}]: ${text}`);
    throw new Error(`Twilio ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

type Action =
  | "search" | "purchase" | "list_owned" | "connect_existing"
  | "status" | "release" | "save_setup";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = (await req.json()) as {
      action?: Action;
      organization_id: string;
      environment?: "sandbox" | "live";
      area_code?: string;
      country?: string;
      number_type?: "local" | "toll_free";
      phone_number?: string;
      confirm_number?: string;
      setup_state?: Record<string, unknown>;
      number_source?: string;
    };
    const {
      organization_id, area_code, country = "US",
      number_type = "local", phone_number,
    } = body;
    const environment = body.environment === "live" ? "live" : "sandbox";
    const action: Action = body.action ?? "status";

    const access = await requirePhoneAccess(req, organization_id, environment);
    if (!access.ok) return access.response;
    const { admin } = access;

    const { data: existing } = await admin
      .from("phone_assistants")
      .select("elevenlabs_agent_id, twilio_phone_sid, twilio_phone_number, number_source, setup_state")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Persisting wizard progress needs no Twilio credentials.
    if (action === "save_setup") {
      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({
          setup_state: { ...(existing?.setup_state ?? {}), ...(body.setup_state ?? {}) },
          ...(body.number_source ? { number_source: body.number_source } : {}),
        })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved });
    }

    const missing = missingSecrets(["LOVABLE_API_KEY", "TWILIO_API_KEY"]);
    if (missing.length) return configurationMissing(missing);

    if (!existing?.elevenlabs_agent_id) {
      return json({ error: "Create your voice assistant before setting up a phone number." }, 400);
    }

    // STATUS / HEALTH ---------------------------------------------------
    if (action === "status") {
      let voice_url: string | null = null;
      let voice_url_ok = false;
      let twilio_reachable = false;
      try {
        if (existing.twilio_phone_sid) {
          const n = await twilio(`/IncomingPhoneNumbers/${existing.twilio_phone_sid}.json`, "GET");
          voice_url = n.voice_url ?? null;
          voice_url_ok = n.voice_url === WEBHOOK_URL;
        } else {
          await twilio(`/IncomingPhoneNumbers.json`, "GET", { PageSize: "1" });
        }
        twilio_reachable = true;
      } catch (e) {
        console.error("status check failed", (e as Error).message);
      }
      return json({
        connected: !!existing.twilio_phone_number,
        phone_number: existing.twilio_phone_number,
        number_source: existing.number_source,
        managed_by_fasttract: !!existing.twilio_phone_sid,
        twilio_reachable,
        expected_webhook_url: WEBHOOK_URL,
        voice_url,
        voice_url_ok,
        setup_state: existing.setup_state ?? {},
      });
    }

    // SEARCH: list available numbers only. Never purchases.
    if (action === "search") {
      const kind = number_type === "toll_free" ? "TollFree" : "Local";
      const params: Record<string, string> = { VoiceEnabled: "true", PageSize: "15" };
      if (area_code && number_type === "local") {
        if (!/^\d{3}$/.test(area_code)) return json({ error: "Area code must be 3 digits." }, 400);
        params.AreaCode = area_code;
      }
      const search = await twilio(`/AvailablePhoneNumbers/${country}/${kind}.json`, "GET", params);
      const numbers = (search.available_phone_numbers ?? []).map((n: any) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        locality: n.locality,
        region: n.region,
        // Twilio's pricing API is not reachable through this integration, so we
        // never invent a price. The UI discloses that carrier fees apply.
        monthly_price: null,
        price_unit: null,
      }));
      return json({ numbers, number_type, pricing_available: false });
    }

    // LIST_OWNED: numbers that already belong to the connected Twilio account.
    if (action === "list_owned") {
      const owned = await twilio(`/IncomingPhoneNumbers.json`, "GET", { PageSize: "50" });
      const numbers = (owned.incoming_phone_numbers ?? []).map((n: any) => ({
        phone_number: n.phone_number,
        friendly_name: n.friendly_name,
        sid: n.sid,
        voice_url: n.voice_url,
        already_routed: n.voice_url === WEBHOOK_URL,
      }));
      return json({ numbers, expected_webhook_url: WEBHOOK_URL });
    }

    // PURCHASE: an explicitly selected number only. No first-result fallback.
    if (action === "purchase") {
      if (existing.twilio_phone_number) {
        // Idempotent: a refresh or retry cannot buy a second number.
        return json({
          assistant: existing,
          already_connected: true,
          message: "A number is already connected. Release it before buying another.",
        });
      }
      if (!phone_number || !isE164(phone_number)) {
        return json({ error: "Select a number first. Expected E.164 format, e.g. +15035550123." }, 400);
      }
      if (body.confirm_number !== phone_number) {
        return json({ error: "Purchase not confirmed for the selected number." }, 400);
      }

      const bought = await twilio(`/IncomingPhoneNumbers.json`, "POST", {
        PhoneNumber: phone_number,
        VoiceUrl: WEBHOOK_URL,
        VoiceMethod: "POST",
      });

      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({
          twilio_phone_sid: bought.sid,
          twilio_phone_number: bought.phone_number,
          number_source: "purchased",
        })
        .eq("organization_id", organization_id)
        .is("twilio_phone_number", null)
        .select().maybeSingle();
      if (error) throw error;
      if (!saved) {
        const { data: current } = await admin
          .from("phone_assistants").select("*").eq("organization_id", organization_id).maybeSingle();
        return json({ assistant: current, already_connected: true });
      }
      return json({ assistant: saved });
    }

    // CONNECT_EXISTING: verify the number belongs to the connected Twilio
    // account, then point its VoiceUrl at our webhook.
    if (action === "connect_existing") {
      if (existing.twilio_phone_number) {
        return json({ error: "Release the connected number first." }, 400);
      }
      if (!phone_number || !isE164(phone_number)) {
        return json({ error: "Enter the number in E.164 format, e.g. +15035550123." }, 400);
      }
      const owned = await twilio(`/IncomingPhoneNumbers.json`, "GET", { PhoneNumber: phone_number });
      const match = (owned.incoming_phone_numbers ?? [])[0];
      if (!match) {
        return json({
          error:
            "That number is not in the connected Twilio account. Only numbers you already own in Twilio can be connected this way — use call forwarding or start a port instead.",
        }, 400);
      }
      await twilio(`/IncomingPhoneNumbers/${match.sid}.json`, "POST", {
        VoiceUrl: WEBHOOK_URL,
        VoiceMethod: "POST",
      });
      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({
          twilio_phone_sid: match.sid,
          twilio_phone_number: match.phone_number,
          number_source: "existing_twilio",
        })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved });
    }

    // RELEASE: explicit typed confirmation of the exact number.
    if (action === "release") {
      if (!existing.twilio_phone_number) return json({ error: "No number is connected." }, 400);
      if (body.confirm_number?.trim() !== existing.twilio_phone_number) {
        return json({ error: "Type the exact phone number to confirm release." }, 400);
      }
      if (existing.twilio_phone_sid) {
        try {
          await twilio(`/IncomingPhoneNumbers/${existing.twilio_phone_sid}.json`, "DELETE");
        } catch (e) {
          console.error("twilio release failed", (e as Error).message);
          return json({ error: "Twilio could not release this number. Nothing was changed." }, 502);
        }
      }
      const { data: saved, error } = await admin
        .from("phone_assistants")
        .update({ twilio_phone_sid: null, twilio_phone_number: null, number_source: null })
        .eq("organization_id", organization_id)
        .select().single();
      if (error) throw error;
      return json({ assistant: saved });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    console.error("provision error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
