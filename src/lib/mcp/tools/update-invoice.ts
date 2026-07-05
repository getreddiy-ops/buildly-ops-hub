import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, err, ok } from "./_helpers";

export default defineTool({
  name: "update_invoice",
  title: "Update invoice",
  description: "Update fields on an existing invoice. Only provided fields are changed.",
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
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, ...patch }, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (!Object.keys(clean).length) return err("No fields to update.");
    const { data, error } = await sb(ctx).from("invoices").update(clean).eq("id", id).select().single();
    if (error) return err(error.message);
    return ok(`Updated invoice ${id}`, { invoice: data });
  },
});
