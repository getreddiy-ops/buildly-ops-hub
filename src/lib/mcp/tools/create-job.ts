import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok, previewOrConfirm } from "./_helpers";

export default defineTool({
  name: "create_job",
  title: "Create job",
  description: "Create a new job for the signed-in user's organization. Call with confirm: true only after previewing.",
  inputSchema: {
    title: z.string().min(1),
    customer_id: z.string().uuid().optional(),
    estimate_id: z.string().uuid().optional(),
    description: z.string().optional(),
    status: z.string().default("scheduled"),
    address: z.string().optional(),
    scheduled_start: z.string().optional().describe("ISO timestamp"),
    scheduled_end: z.string().optional().describe("ISO timestamp"),
    budget: z.number().nonnegative().optional(),
    confirm: z.boolean().optional().describe("Set true to actually create the job after reviewing the preview."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ confirm, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const client = sb(ctx);
    const org = await resolveOrgId(client, ctx.getUserId()!);
    if (org.error) return err(org.error);

    const preview = previewOrConfirm(confirm, `create job "${input.title}"`, { ...input, organization_id: org.orgId });
    if (preview) return preview;

    const { data, error } = await client
      .from("jobs")
      .insert({
        organization_id: org.orgId,
        title: input.title,
        customer_id: input.customer_id ?? null,
        estimate_id: input.estimate_id ?? null,
        description: input.description ?? null,
        status: input.status,
        address: input.address ?? null,
        scheduled_start: input.scheduled_start ?? null,
        scheduled_end: input.scheduled_end ?? null,
        budget: input.budget ?? null,
      })
      .select()
      .single();
    if (error) return err(error.message);
    return ok(`Created job ${data.id}`, { job: data });
  },
});
