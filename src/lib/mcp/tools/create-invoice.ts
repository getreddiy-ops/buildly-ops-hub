import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { sb, resolveOrgId, err, ok } from "./_helpers";

export default defineTool({
  name: "create_invoice",
  title: "Create invoice",
  description: "Create a new invoice for the signed-in user's organization, with optional line items.",
  inputSchema: {
    customer_id: z.string().uuid().optional(),
    job_id: z.string().uuid().optional(),
    estimate_id: z.string().uuid().optional(),
    number: z.string().optional(),
    status: z.string().default("draft"),
    issue_date: z.string().describe("ISO date (YYYY-MM-DD)."),
    due_date: z.string().optional(),
    tax_rate: z.number().nonnegative().default(0),
    notes: z.string().optional(),
    terms: z.string().optional(),
    line_items: z
      .array(
        z.object({
          description: z.string().min(1),
          quantity: z.number().positive(),
          unit_price: z.number().nonnegative(),
        }),
      )
      .optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return err("Not authenticated");
    const client = sb(ctx);
    const org = await resolveOrgId(client, ctx.getUserId()!);
    if (org.error) return err(org.error);

    const items = input.line_items ?? [];
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const tax_amount = subtotal * (input.tax_rate ?? 0);
    const total = subtotal + tax_amount;

    const { data: inv, error } = await client
      .from("invoices")
      .insert({
        organization_id: org.orgId,
        customer_id: input.customer_id ?? null,
        job_id: input.job_id ?? null,
        estimate_id: input.estimate_id ?? null,
        number: input.number ?? null,
        status: input.status,
        issue_date: input.issue_date,
        due_date: input.due_date ?? null,
        subtotal,
        tax_rate: input.tax_rate,
        tax_amount,
        total,
        amount_paid: 0,
        notes: input.notes ?? null,
        terms: input.terms ?? null,
        created_by: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) return err(error.message);

    if (items.length) {
      const rows = items.map((i, idx) => ({
        invoice_id: inv.id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total: i.quantity * i.unit_price,
        position: idx,
      }));
      const { error: liErr } = await client.from("invoice_line_items").insert(rows);
      if (liErr) return err(`Invoice created but line items failed: ${liErr.message}`);
    }
    return ok(`Created invoice ${inv.id}`, { invoice: inv });
  },
});
