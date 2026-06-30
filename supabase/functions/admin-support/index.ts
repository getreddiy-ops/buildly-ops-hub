// Admin support actions — only callable by platform admins.
// Verifies JWT manually + checks user has the platform_admin role
// before using the service-role key for privileged operations.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Action =
  | { type: "send_password_reset"; email: string }
  | { type: "comp_trial"; subscription_id: string; days: number }
  | { type: "cancel_subscription"; subscription_id: string; at_period_end?: boolean }
  | { type: "create_organization"; name: string; owner_email: string; plan?: string }
  | { type: "delete_organization"; organization_id: string };

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
