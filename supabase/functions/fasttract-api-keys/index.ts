import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function requireOwner(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  const { data: membership, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!membership || !["owner", "admin"].includes(String(membership.role))) {
    throw new Error("Forbidden");
  }

  return userData.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST", "DELETE"].includes(req.method)) return json(405, { error: "Method not allowed" });

  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const organizationId = String(
      req.headers.get("x-fasttract-organization") ||
      url.searchParams.get("organization_id") ||
      body.organization_id ||
      "",
    ).trim();
    if (!organizationId) return json(400, { error: "organization_id is required" });

    const user = await requireOwner(req, organizationId);

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("fasttract_api_keys")
        .select("id,name,key_prefix,scopes,last_used_at,revoked_at,created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { data: data ?? [] });
    }

    if (req.method === "POST") {
      const name = String(body.name || "API key").trim().slice(0, 80) || "API key";
      const requestedScopes = Array.isArray(body.scopes)
        ? body.scopes.map(String).filter((scope) => ["read", "write"].includes(scope))
        : ["read", "write"];
      const scopes = [...new Set(requestedScopes.length ? requestedScopes : ["read"])] as string[];

      // The plaintext credential is returned exactly once. Only its SHA-256 hash is stored.
      const secret = `ft_live_${randomToken(32)}`;
      const keyHash = await sha256(secret);
      const keyPrefix = `${secret.slice(0, 15)}…`;

      const { data, error } = await admin
        .from("fasttract_api_keys")
        .insert({
          organization_id: organizationId,
          name,
          key_prefix: keyPrefix,
          key_hash: keyHash,
          scopes,
          created_by: user.id,
        })
        .select("id,name,key_prefix,scopes,created_at")
        .single();
      if (error) throw error;

      return json(201, {
        data: {
          ...data,
          api_key: secret,
          warning: "Copy this key now. FastTract stores only its hash and cannot show it again.",
        },
      });
    }

    const keyId = String(body.id || url.searchParams.get("id") || "").trim();
    if (!keyId) return json(400, { error: "id is required" });
    const { data, error } = await admin
      .from("fasttract_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", keyId)
      .is("revoked_at", null)
      .select("id,name,key_prefix,revoked_at")
      .maybeSingle();
    if (error) throw error;
    if (!data) return json(404, { error: "Active API key not found" });
    return json(200, { data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    console.error("fasttract-api-keys error", error);
    return json(status, { error: status === 500 ? "API key operation failed" : message });
  }
});
