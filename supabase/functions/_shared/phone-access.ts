// Shared access guard for the Phone Assistant feature.
// Requires: authenticated user + active-org owner/admin + Premium subscription,
// with a bypass for platform admins. Never leaks secret values.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const PREMIUM_PRICE_IDS = new Set([
  "contractor_os_premium_monthly",
  "contractor_os_premium",
]);

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Reports which server integrations are configured, without revealing values. */
export function missingSecrets(names: string[]): string[] {
  return names.filter((n) => !Deno.env.get(n));
}

export function configurationMissing(names: string[]) {
  return json({
    error: "configuration_missing",
    message:
      "This workspace is missing a server integration required for the phone assistant. Contact support with the names below.",
    missing: names,
  }, 503);
}

/** E.164: leading +, country digit 1-9, up to 15 digits total. */
export function isE164(value: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(value.trim());
}

export type Access =
  | { ok: true; admin: SupabaseClient; userId: string; isPlatformAdmin: boolean }
  | { ok: false; response: Response };

export async function requirePhoneAccess(
  req: Request,
  orgId: string | undefined,
  environment: "sandbox" | "live",
): Promise<Access> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { ok: false, response: json({ error: "unauthorized" }, 401) };
  if (!orgId) return { ok: false, response: json({ error: "organization_id required" }, 400) };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return { ok: false, response: json({ error: "unauthorized" }, 401) };

  const { data: platformRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .maybeSingle();
  const isPlatformAdmin = !!platformRole;

  if (!isPlatformAdmin) {
    const { data: member } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return { ok: false, response: json({ error: "forbidden: org admin required" }, 403) };
    }

    const { data: sub } = await admin
      .from("subscriptions")
      .select("price_id, stripe_price_id, status, current_period_end")
      .eq("organization_id", orgId)
      .eq("environment", environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const active = !!sub &&
      ["active", "trialing", "past_due", "canceled"].includes(sub.status) &&
      (!sub.current_period_end || new Date(sub.current_period_end).getTime() > Date.now());
    const premiumEnv = Deno.env.get("STRIPE_PRICE_PREMIUM");
    const isPremium = !!sub && (
      PREMIUM_PRICE_IDS.has(sub.price_id ?? "") ||
      (!!premiumEnv && (sub.stripe_price_id === premiumEnv || sub.price_id === premiumEnv))
    );
    if (!active || !isPremium) {
      return { ok: false, response: json({ error: "Premium subscription required" }, 402) };
    }
  }

  return { ok: true, admin, userId: user.id, isPlatformAdmin };
}
