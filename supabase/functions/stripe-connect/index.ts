import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_V2_VERSION = "2026-08-26.preview";
const APP_URL = Deno.env.get("FASTTRACT_APP_URL") || "https://fasttract-app.vercel.app";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function stripeV2(path: string, body: Record<string, unknown>) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe payments are not configured yet");
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Stripe-Version": STRIPE_V2_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error?.message ?? `Stripe request failed (${response.status})`);
  return data;
}

async function stripeAccount(accountId: string) {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe payments are not configured yet");
  const response = await fetch(`https://api.stripe.com/v1/accounts/${encodeURIComponent(accountId)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data?.error?.message ?? `Stripe request failed (${response.status})`);
  return data;
}

async function requireAdmin(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: membership, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!membership || !["owner", "admin"].includes(membership.role)) throw new Error("Forbidden");
  return { admin, user: userData.user };
}

async function syncStatus(admin: ReturnType<typeof createClient>, organizationId: string, accountId: string) {
  const account = await stripeAccount(accountId);
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;
  const status = chargesEnabled ? "ready" : detailsSubmitted ? "pending" : "onboarding";

  const { error } = await admin
    .from("organizations")
    .update({
      stripe_connect_status: status,
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: detailsSubmitted,
    })
    .eq("id", organizationId);
  if (error) throw error;

  return {
    connected: true,
    accountId,
    status,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const organizationId = String(body.organizationId ?? body.organization_id ?? "").trim();
    const action = String(body.action ?? "status").trim().toLowerCase();
    if (!organizationId) return json({ error: "organizationId is required" }, 400);

    const { admin, user } = await requireAdmin(req, organizationId);
    const { data: organization, error: orgError } = await admin
      .from("organizations")
      .select("id,name,email,website,stripe_connected_account_id")
      .eq("id", organizationId)
      .single();
    if (orgError) throw orgError;

    if (action === "status") {
      if (!organization.stripe_connected_account_id) {
        return json({ connected: false, status: "not_connected", chargesEnabled: false, payoutsEnabled: false });
      }
      return json(await syncStatus(admin, organizationId, organization.stripe_connected_account_id));
    }

    if (action !== "onboard") return json({ error: "Unsupported action" }, 400);

    let accountId = organization.stripe_connected_account_id as string | null;
    if (!accountId) {
      const account = await stripeV2("/v2/core/accounts", {
        display_name: organization.name,
        contact_email: organization.email || user.email,
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "stripe",
            losses_collector: "stripe",
          },
          profile: organization.website ? { business_url: organization.website } : undefined,
          currency: "usd",
          locales: ["en-US"],
        },
        identity: {
          country: "US",
          entity_type: "company",
        },
        configuration: {
          merchant: {
            capabilities: {
              card_payments: { requested: true },
            },
          },
        },
      });
      accountId = String(account.id);
      const { error: saveError } = await admin
        .from("organizations")
        .update({
          stripe_connected_account_id: accountId,
          stripe_connect_status: "onboarding",
        })
        .eq("id", organizationId);
      if (saveError) throw saveError;
    }

    const accountLink = await stripeV2("/v2/core/account_links", {
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["merchant"],
          refresh_url: `${APP_URL}/app/settings?stripe=refresh`,
          return_url: `${APP_URL}/app/settings?stripe=connected`,
        },
      },
    });

    return json({ url: accountLink.url, accountId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("stripe-connect error", error);
    return json({ error: message }, status);
  }
});
