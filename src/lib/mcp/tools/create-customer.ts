import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "create_customer",
  title: "Create customer",
  description: "Create a new customer record in the signed-in user's active organization.",
  inputSchema: {
    name: z.string().trim().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const client = sb(ctx);
    // Resolve active org for the user
    const { data: memberships, error: mErr } = await client
      .from("organization_members").select("organization_id").eq("user_id", ctx.getUserId()).limit(1);
    if (mErr) return { content: [{ type: "text", text: mErr.message }], isError: true };
    const orgId = memberships?.[0]?.organization_id;
    if (!orgId) return { content: [{ type: "text", text: "No organization found for this user." }], isError: true };
    const { data, error } = await client.from("customers").insert({ ...input, organization_id: orgId }).select().single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: `Created customer ${data.id}` }], structuredContent: { customer: data } };
  },
});
