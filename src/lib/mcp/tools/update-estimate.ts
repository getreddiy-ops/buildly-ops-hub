import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok, previewOrConfirm } from "./_helpers";

export default defineTool({
  name: "update_estimate",
  title: "Update estimate",
  description: "Update fields on an existing estimate. Only provided fields are changed. Call with confirm: true only after previewing.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    customer_id: z.string().uuid().nullable().optional(),
    status: z.enum(["draft", "sent", "accepted", "declined"]).optional(),
    subtotal: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
    notes: z.string().nullable().optional(),
    confirm: z.boolean().optional().describe("Set true to actually apply the update after reviewing the preview."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, confirm, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const client = sb(ctx);
    const org = await resolveOrgId(client, ctx.getUserId()!);
    if (org.error) return err(org.error);
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return err("No fields to update.");

    const preview = previewOrConfirm(confirm, `update estimate ${id}`, { id, ...clean });
    if (preview) return preview;

    const { data, error } = await client
      .from("estimates").update(clean).eq("id", id).eq("organization_id", org.orgId).select().single();
    if (error) return err(error.message);
    return ok(`Updated estimate ${id}`, { estimate: data });
  },
});
