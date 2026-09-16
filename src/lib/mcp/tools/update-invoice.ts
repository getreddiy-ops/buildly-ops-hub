import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok, previewOrConfirm } from "./_helpers";

export default defineTool({
  name: "update_invoice",
  title: "Update invoice",
  description: "Update fields on an existing invoice. Only provided fields are changed. Call with confirm: true only after previewing.",
  inputSchema: {
    id: z.string().uuid(),
    status: z.string().optional(),
    number: z.string().nullable().optional(),
    issue_date: z.string().optional(),
    due_date: z.string().nullable().optional(),
    subtotal: z.number().nonnegative().optional(),
    tax_rate: z.number().nonnegative().optional(),
    tax_amount: z.number().nonnegative().optional(),
    total: z.number().nonnegative().optional(),
    amount_paid: z.number().nonnegative().optional(),
    notes: z.string().nullable().optional(),
    terms: z.string().nullable().optional(),
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

    const preview = previewOrConfirm(confirm, `update invoice ${id}`, { id, ...clean });
    if (preview) return preview;

    const { data, error } = await client
      .from("invoices").update(clean).eq("id", id).eq("organization_id", org.orgId).select().single();
    if (error) return err(error.message);
    return ok(`Updated invoice ${id}`, { invoice: data });
  },
});
