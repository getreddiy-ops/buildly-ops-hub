import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok, previewOrConfirm } from "./_helpers";

export default defineTool({
  name: "create_estimate",
  title: "Create estimate",
  description: "Create a new estimate for the signed-in user's organization, with optional line items. Call with confirm: true only after previewing.",
  inputSchema: {
    title: z.string().min(1),
    customer_id: z.string().uuid().optional(),
    lead_id: z.string().uuid().optional(),
    status: z.enum(["draft", "sent", "accepted", "declined"]).default("draft"),
    tax: z.number().nonnegative().default(0),
    notes: z.string().optional(),
    line_items: z
      .array(
        z.object({
          description: z.string().min(1),
          quantity: z.number().positive(),
          unit_price: z.number().nonnegative(),
        }),
      )
      .optional(),
    confirm: z.boolean().optional().describe("Set true to actually create the estimate after reviewing the preview."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ confirm, ...input }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const client = sb(ctx);
    const org = await resolveOrgId(client, ctx.getUserId()!);
    if (org.error) return err(org.error);

    const items = input.line_items ?? [];
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const total = subtotal + (input.tax ?? 0);

    const preview = previewOrConfirm(confirm, `create estimate "${input.title}" totaling $${total.toFixed(2)}`, { ...input, subtotal, total });
    if (preview) return preview;

    const { data: est, error } = await client
      .from("estimates")
      .insert({
        organization_id: org.orgId,
        title: input.title,
        customer_id: input.customer_id ?? null,
        lead_id: input.lead_id ?? null,
        status: input.status,
        subtotal,
        tax: input.tax,
        total,
        notes: input.notes ?? null,
        created_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) return err(error.message);

    if (items.length) {
      const rows = items.map((i, idx) => ({
        estimate_id: est.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        position: idx,
      }));
      const { error: liErr } = await client.from("estimate_line_items").insert(rows);
      if (liErr) return err(`Estimate created but line items failed: ${liErr.message}`);
    }
    return ok(`Created estimate ${est.id}`, { estimate: est });
  },
});
