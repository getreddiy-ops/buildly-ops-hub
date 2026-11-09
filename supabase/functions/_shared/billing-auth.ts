import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

type OwnerCheck =
  | { ok: false; response: Response }
  | { ok: true; user: { id: string; email?: string }; admin: ReturnType<typeof adminClient> };

/** The signed-in user, and only if they own the organization. Billing is owner-only. */
export async function requireOrgOwner(req: Request, organizationId: string): Promise<OwnerCheck> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { ok: false, response: json(401, { error: "Unauthorized" }) };
  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data } = await userClient.auth.getUser();
  const user = data.user;
  if (!user?.email || user.is_anonymous) return { ok: false, response: json(401, { error: "Unauthorized" }) };

  const admin = adminClient();
  const { data: membership } = await admin
    .from("organization_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!membership || membership.role !== "owner") {
    return { ok: false, response: json(403, { error: "Only the business owner can manage the FastTract subscription" }) };
  }
  return { ok: true, user, admin };
}

export function appUrl(): string {
  return (Deno.env.get("PUBLIC_APP_URL") || "https://fasttract.org").replace(/\/$/, "");
}
