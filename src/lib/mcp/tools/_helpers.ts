import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function resolveOrgId(client: ReturnType<typeof sb>, userId: string) {
  const { data, error } = await client
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1);
  if (error) return { error: error.message };
  const orgId = data?.[0]?.organization_id as string | undefined;
  if (!orgId) return { error: "No organization found for this user." };
  return { orgId };
}

export function err(text: string) {
  return { content: [{ type: "text" as const, text }], isError: true };
}

export function ok(text: string, structured?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], structuredContent: structured };
}
