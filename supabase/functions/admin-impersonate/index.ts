// Platform-admin impersonation ("client workspace").
// Verifies the caller is a platform_admin, then mints a one-time sign-in link
// for the target customer and writes every action to public.admin_audit_log.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const ALLOWED_HOSTS = [
  "contractoros.online",
  "www.contractoros.online",
  "fasttract.org",
  "www.fasttract.org",
];

function resolveOrigin(req: Request): string {
  const candidates = [req.headers.get("origin"), req.headers.get("referer")];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const u = new URL(c);
      if (
        (u.protocol === "https:" &&
          (ALLOWED_HOSTS.includes(u.hostname) || u.hostname.endsWith(".lovable.app"))) ||
        u.hostname === "localhost"
      ) {
        return u.origin;
      }
    } catch { /* ignore */ }
  }
  return Deno.env.get("PUBLIC_APP_URL") ?? "https://contractoros.online";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing auth" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "invalid token" }, 401);

  const adminUser = userData.user;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: hasRole } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", adminUser.id)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (!hasRole) return json({ error: "forbidden" }, 403);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const userAgent = req.headers.get("user-agent") ?? null;

  const writeLog = (row: Record<string, unknown>) =>
    admin.from("admin_audit_log").insert({
      admin_user_id: adminUser.id,
      admin_email: adminUser.email,
      user_agent: userAgent,
      ...row,
    });

  try {
    if (body.type === "start") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
      const userId = typeof body.user_id === "string" ? body.user_id : null;
      if (!email && !userId) return json({ error: "email or user_id required" }, 400);

      let targetEmail = email;
      let targetId = userId;

      if (!targetEmail && targetId) {
        const { data: prof } = await admin
          .from("profiles").select("email").eq("id", targetId).maybeSingle();
        targetEmail = (prof?.email as string | null)?.toLowerCase() ?? null;
      }
      if (!targetEmail) return json({ error: "could not resolve target email" }, 400);
      if (!targetId) {
        const { data: prof } = await admin
          .from("profiles").select("id").ilike("email", targetEmail).maybeSingle();
        targetId = (prof?.id as string | null) ?? null;
      }
      if (targetId === adminUser.id) return json({ error: "cannot impersonate yourself" }, 400);

      const sessionId = crypto.randomUUID();
      const origin = resolveOrigin(req);
      const redirectTo = `${origin}/app?impersonation=${sessionId}`;

      const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: { redirectTo },
      });
      if (linkErr) throw linkErr;

      await writeLog({
        session_id: sessionId,
        target_user_id: targetId,
        target_email: targetEmail,
        target_org_id: body.organization_id ?? null,
        action: "impersonation_start",
        details: { reason: body.reason ?? null, redirect_to: redirectTo },
      });

      return json({
        session_id: sessionId,
        action_link: link.properties?.action_link ?? null,
        target_email: targetEmail,
        target_user_id: targetId,
      });
    }

    if (body.type === "log") {
      const action = typeof body.action === "string" ? body.action.slice(0, 120) : null;
      if (!action) return json({ error: "action required" }, 400);
      await writeLog({
        session_id: body.session_id ?? null,
        target_user_id: body.target_user_id ?? null,
        target_email: body.target_email ?? null,
        target_org_id: body.organization_id ?? null,
        action,
        path: typeof body.path === "string" ? body.path.slice(0, 300) : null,
        details: body.details && typeof body.details === "object" ? body.details : {},
      });
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message ?? "failed" }, 500);
  }
});
