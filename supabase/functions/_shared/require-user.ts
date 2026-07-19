// Shared auth guard: rejects unauthenticated (anon-key-only) callers.
// Gateway verify_jwt accepts the public anon key, so functions that cost money
// or send email must additionally require an authenticated user JWT.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

export type AuthResult =
  | { ok: true; userId: string | null; role: string }
  | { ok: false; response: Response };

export function requireAuthedUser(req: Request): AuthResult {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let role = "";
  let sub = "";
  const parts = token.split(".");
  if (parts.length >= 2) {
    try {
      const payload = parts[1]
        .replaceAll("-", "+")
        .replaceAll("_", "/")
        .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
      const claims = JSON.parse(atob(payload)) as Record<string, unknown>;
      role = (claims.role as string) || "";
      sub = (claims.sub as string) || "";
    } catch { /* ignore */ }
  }
  const ok = role === "service_role" || (role === "authenticated" && !!sub);
  if (!ok) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }
  return { ok: true, userId: sub || null, role };
}
