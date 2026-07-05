import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, err, ok } from "./_helpers";

export default defineTool({
  name: "update_estimate",
  title: "Update estimate",
  description: "Update fields on an existing estimate. Only provided fields are changed.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    customer_id: z.string().uuid().nullable().optional(),
    status: z.enum(["draft", "sent", "accepted", "declined"]).optional(),
    subtotal: z.number().nonnegative().optional(),
    tax: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
    notes: z.string().nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return err("No fields to update.");
    const { data, error } = await sb(ctx).from("estimates").update(clean).eq("id", id).select().single();
    if (error) return err(error.message);
    return ok(`Updated estimate ${id}`, { estimate: data });
  },
});
