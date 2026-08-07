// Shared plan-entitlement guard for AI features.
// Resolves the caller's organization (explicit or via membership) and verifies
// the org holds an active Plus/Premium subscription (or is comped).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PLUS_PRICE_IDS = new Set([
  "contractor_os_plus_monthly",
  "contractor_os_premium_monthly",
]);
const PREMIUM_PRICE_IDS = new Set(["contractor_os_premium_monthly"]);

export type EntitlementResult =
  | { ok: true; userId: string; organizationId: string | null }
  | { ok: false; response: Response };

function deny(status: number, error: string, code?: string): EntitlementResult {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error, code }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}

/**
 * @param minTier "plus" (Plus or Premium) or "premium".
 * @param organizationId optional explicit org; otherwise resolved from memberships.
 */
export async function requirePlanTier(
  req: Request,
  minTier: "plus" | "premium" = "plus",
  organizationId?: string | null,
): Promise<EntitlementResult> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return deny(401, "Unauthorized");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return deny(401, "Unauthorized");

  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: adminRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (adminRole) return { ok: true, userId: user.id, organizationId: organizationId ?? null };

  let orgId = organizationId ?? null;
  if (orgId) {
    const { data: membership } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (!membership) return deny(403, "Forbidden");
  } else {
    const { data: memberships } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id);
    if (!memberships?.length) return deny(403, "No organization");
    orgId = memberships[0].organization_id as string;

    // Prefer an org that actually carries the entitlement.
    for (const m of memberships) {
      const entitled = await orgHasTier(admin, m.organization_id as string, minTier);
      if (entitled) return { ok: true, userId: user.id, organizationId: m.organization_id as string };
    }
    return deny(402, tierMessage(minTier), "subscription_required");
  }

  const entitled = await orgHasTier(admin, orgId, minTier);
  if (!entitled) return deny(402, tierMessage(minTier), "subscription_required");
  return { ok: true, userId: user.id, organizationId: orgId };
}

function tierMessage(minTier: "plus" | "premium") {
  return minTier === "premium"
    ? "Premium subscription required"
    : "Plus or Premium subscription required";
}

async function orgHasTier(
  admin: ReturnType<typeof createClient>,
  orgId: string,
  minTier: "plus" | "premium",
): Promise<boolean> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("price_id,status,current_period_end,comped")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return false;

  const allowed = minTier === "premium" ? PREMIUM_PRICE_IDS : PLUS_PRICE_IDS;
  if (!allowed.has(sub.price_id as string)) return false;
  if (sub.comped) return true;

  const now = Date.now();
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end as string).getTime() : null;
  const status = sub.status as string;
  return (
    (["active", "trialing", "past_due"].includes(status) && (!periodEnd || periodEnd > now)) ||
    (status === "canceled" && !!periodEnd && periodEnd > now)
  );
}
