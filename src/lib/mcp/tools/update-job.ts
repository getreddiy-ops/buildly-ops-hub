import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, err, ok } from "./_helpers";

export default defineTool({
  name: "update_job",
  title: "Update job",
  description: "Update fields on an existing job. Only provided fields are changed.",
  inputSchema: {
    id: z.string().uuid(),
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    status: z.string().optional(),
    address: z.string().nullable().optional(),
    scheduled_start: z.string().nullable().optional(),
    scheduled_end: z.string().nullable().optional(),
    budget: z.number().nonnegative().nullable().optional(),
    customer_id: z.string().uuid().nullable().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return err("No fields to update.");
    const { data, error } = await sb(ctx).from("jobs").update(clean).eq("id", id).select().single();
    if (error) return err(error.message);
    return ok(`Updated job ${id}`, { job: data });
  },
});
