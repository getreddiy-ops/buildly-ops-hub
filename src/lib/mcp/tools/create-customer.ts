import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok, previewOrConfirm } from "./_helpers";

export default defineTool({
  name: "create_customer",
  title: "Create customer",
  description: "Create a new customer record in the signed-in user's active organization and sync it to the connected HighLevel location. Call with confirm: true only after previewing.",
  inputSchema: {
    name: z.string().trim().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    confirm: z.boolean().optional().describe("Set true to actually create the customer after reviewing the preview."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ confirm, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const client = sb(ctx);
    const org = await resolveOrgId(client, ctx.getUserId()!);
    if (org.error) return err(org.error);

    const preview = previewOrConfirm(confirm, `create customer \"${input.name}\" and sync it to HighLevel`, {
      ...input,
      organization_id: org.orgId,
      highlevel_sync: true,
    });
    if (preview) return preview;

    const { data, error } = await client.from("customers").insert({ ...input, organization_id: org.orgId }).select().single();
    if (error) return err(error.message);

    const { data: syncData, error: syncError } = await client.functions.invoke("ghl-sync", {
      body: { organizationId: org.orgId, entity: "customer", id: data.id },
    });

    if (syncError) {
      return ok(`Created customer ${data.id}, but HighLevel sync failed: ${syncError.message}`, {
        customer: data,
        highlevel: { synced: false, error: syncError.message },
      });
    }

    const synced = syncData?.synced === true;
    const skipped = syncData?.skipped === true;
    return ok(
      synced
        ? `Created customer ${data.id} and synced it to HighLevel.`
        : skipped
          ? `Created customer ${data.id}; HighLevel sync was skipped (${syncData?.reason ?? "unknown reason"}).`
          : `Created customer ${data.id}; HighLevel sync returned without confirmation.`,
      { customer: data, highlevel: syncData ?? { synced: false } },
    );
  },
});
