// Admin support actions — only callable by platform admins.
// Verifies JWT manually + checks user has the platform_admin role
// before using the service-role key for privileged operations.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Tier = "base" | "plus" | "premium";

type Action =
  | { type: "send_password_reset"; email: string }
  | { type: "comp_trial"; subscription_id: string; days: number }
  | { type: "cancel_subscription"; subscription_id: string; at_period_end?: boolean }
  | { type: "create_organization"; name: string; owner_email: string; owner_password?: string; owner_full_name?: string; plan?: string }
  | { type: "create_user"; email: string; password: string; full_name?: string }
  | { type: "set_user_password"; user_id?: string; email?: string; password: string }
  | { type: "delete_organization"; organization_id: string }
  | { type: "set_plan"; organization_id: string; tier: Tier; days?: number | null; environment?: "sandbox" | "live" }
  | { type: "remove_comp"; organization_id: string; environment?: "sandbox" | "live" };

const TIER_PRICE: Record<Tier, { price_id: string; product_id: string }> = {
  base:    { price_id: "contractor_os_pro_monthly",     product_id: "contractor_os_pro" },
  plus:    { price_id: "contractor_os_plus_monthly",    product_id: "contractor_os_plus" },
  premium: { price_id: "contractor_os_premium_monthly", product_id: "contractor_os_premium" },
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "missing auth" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate the caller and check role using their JWT
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: "invalid token" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const callerId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: hasRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .eq("role", "platform_admin")
    .maybeSingle();

  if (!hasRole) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Action;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "bad json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (body.type === "send_password_reset") {
      if (!body.email) throw new Error("email required");
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: body.email,
        options: { redirectTo: `${req.headers.get("origin") ?? ""}/login` },
      });
      if (error) throw error;
      return ok({ action_link: data.properties?.action_link ?? null });
    }

    if (body.type === "comp_trial") {
      if (!body.subscription_id || !body.days) throw new Error("subscription_id + days required");
      const { data: sub } = await admin
        .from("subscriptions").select("current_period_end")
        .eq("id", body.subscription_id).maybeSingle();
      const base = sub?.current_period_end ? new Date(sub.current_period_end) : new Date();
      const newEnd = new Date(base.getTime() + body.days * 86400_000);
      const { error } = await admin.from("subscriptions").update({
        status: "trialing",
        current_period_end: newEnd.toISOString(),
        cancel_at_period_end: false,
      }).eq("id", body.subscription_id);
      if (error) throw error;
      return ok({ current_period_end: newEnd.toISOString() });
    }

    if (body.type === "cancel_subscription") {
      const patch = body.at_period_end
        ? { cancel_at_period_end: true }
        : { status: "canceled", cancel_at_period_end: true };
      const { error } = await admin.from("subscriptions").update(patch).eq("id", body.subscription_id);
      if (error) throw error;
      return ok({ canceled: true });
    }

    if (body.type === "create_user") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      if (!email || !password) throw new Error("email + password required");
      if (password.length < 8) throw new Error("password must be at least 8 characters");
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: body.full_name ? { full_name: body.full_name } : undefined,
      });
      if (error) throw error;
      return ok({ user_id: data.user?.id });
    }

    if (body.type === "set_user_password") {
      if (!body.password || body.password.length < 8) throw new Error("password must be at least 8 characters");
      let userId = body.user_id ?? null;
      if (!userId && body.email) {
        const { data: prof } = await admin.from("profiles").select("id").eq("email", body.email.trim().toLowerCase()).maybeSingle();
        userId = prof?.id ?? null;
      }
      if (!userId) throw new Error("user not found");
      const { error } = await admin.auth.admin.updateUserById(userId, { password: body.password });
      if (error) throw error;
      return ok({ updated: true });
    }

    if (body.type === "create_organization") {
      const name = body.name?.trim();
      const email = body.owner_email?.trim().toLowerCase();
      if (!name || !email) throw new Error("name + owner_email required");

      // Find existing user; if missing, either create with password or invite by email.
      let ownerId: string | null = null;
      const { data: prof } = await admin
        .from("profiles").select("id").eq("email", email).maybeSingle();
      if (prof?.id) ownerId = prof.id;

      if (!ownerId) {
        if (body.owner_password && body.owner_password.length >= 8) {
          const { data: created, error: cErr } = await admin.auth.admin.createUser({
            email,
            password: body.owner_password,
            email_confirm: true,
            user_metadata: body.owner_full_name ? { full_name: body.owner_full_name } : undefined,
          });
          if (cErr) throw cErr;
          ownerId = created.user?.id ?? null;
        } else {
          const { data: invite, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
            redirectTo: `${req.headers.get("origin") ?? ""}/login`,
          });
          if (inviteErr) throw inviteErr;
          ownerId = invite.user?.id ?? null;
        }
      } else if (body.owner_password && body.owner_password.length >= 8) {
        // Existing user: update password if provided
        await admin.auth.admin.updateUserById(ownerId, { password: body.owner_password });
      }
      if (!ownerId) throw new Error("could not resolve owner user");

      const { data: org, error: orgErr } = await admin
        .from("organizations")
        .insert({ name, plan: body.plan ?? "base", owner_id: ownerId })
        .select("id")
        .single();
      if (orgErr) throw orgErr;

      const { error: memErr } = await admin.from("organization_members").insert({
        organization_id: org.id, user_id: ownerId, role: "owner",
      });
      if (memErr) throw memErr;

      return ok({ organization_id: org.id, owner_id: ownerId });
    }

    if (body.type === "delete_organization") {
      if (!body.organization_id) throw new Error("organization_id required");
      const { error } = await admin.from("organizations").delete().eq("id", body.organization_id);
      if (error) throw error;
      return ok({ deleted: true });
    }

    if (body.type === "set_plan") {
      if (!body.organization_id || !body.tier) throw new Error("organization_id + tier required");
      const t = TIER_PRICE[body.tier];
      if (!t) throw new Error("invalid tier");
      const env = body.environment ?? "live";

      // Owner of the org acts as the user_id anchor.
      const { data: owner } = await admin.from("organization_members")
        .select("user_id").eq("organization_id", body.organization_id).eq("role", "owner").maybeSingle();
      if (!owner?.user_id) throw new Error("org has no owner");

      const compId = `comp_${body.organization_id}_${env}`;
      const now = new Date();
      const endIso = body.days == null
        ? new Date(now.getTime() + 100 * 365 * 86400_000).toISOString()  // ~forever = free
        : new Date(now.getTime() + Number(body.days) * 86400_000).toISOString();

      // Upsert by paddle_subscription_id so re-comping the same org overwrites.
      const { error } = await admin.from("subscriptions").upsert({
        paddle_subscription_id: compId,
        paddle_customer_id: `comp_customer_${body.organization_id}`,
        user_id: owner.user_id,
        organization_id: body.organization_id,
        product_id: t.product_id,
        price_id: t.price_id,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: endIso,
        cancel_at_period_end: false,
        environment: env,
      }, { onConflict: "paddle_subscription_id" });
      if (error) throw error;

      await admin.from("organizations").update({ plan: body.tier }).eq("id", body.organization_id);
      return ok({ tier: body.tier, current_period_end: endIso, environment: env });
    }

    if (body.type === "remove_comp") {
      if (!body.organization_id) throw new Error("organization_id required");
      const env = body.environment ?? "live";
      const compId = `comp_${body.organization_id}_${env}`;
      const { error } = await admin.from("subscriptions").delete().eq("paddle_subscription_id", compId);
      if (error) throw error;
      return ok({ removed: true });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(data: unknown) {
  return new Response(JSON.stringify({ ok: true, ...((data as object) ?? {}) }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
