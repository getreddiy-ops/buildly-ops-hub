// FastTract MCP — native Supabase implementation.
// FastTract is the system of record. No customer/job/estimate/invoice/time
// action in this server depends on GoHighLevel.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function result(id: unknown, value: unknown) {
  return json({ jsonrpc: "2.0", id, result: value });
}
function rpcError(id: unknown, code: number, message: string, data?: unknown) {
  return json({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });
}
function toolOk(text: string, structured?: unknown) {
  return { content: [{ type: "text", text }], ...(structured === undefined ? {} : { structuredContent: structured }) };
}
function toolErr(text: string, structured?: unknown) {
  return { content: [{ type: "text", text }], ...(structured === undefined ? {} : { structuredContent: structured }), isError: true };
}

async function getAuth(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!auth.toLowerCase().startsWith("bearer ")) throw new Error("Not authenticated");
  const token = auth.slice(7).trim();
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!response.ok) throw new Error("Not authenticated");
  const user = await response.json();
  return { token, userId: String(user.id) };
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const detail = typeof data === "object" && data !== null
      ? String((data as Record<string, unknown>).message || (data as Record<string, unknown>).error || text)
      : String(data || `HTTP ${response.status}`);
    throw new Error(detail);
  }
  return data as any;
}

async function organizationId(token: string, userId: string) {
  const rows = await rest(token, `organization_members?user_id=eq.${encodeURIComponent(userId)}&select=organization_id,role&order=created_at.asc&limit=1`);
  const id = rows?.[0]?.organization_id;
  if (!id) throw new Error("No FastTract organization found for this user. Finish onboarding first.");
  return String(id);
}

async function resolveCustomer(token: string, oid: string, args: Record<string, unknown>) {
  const providedId = typeof args.customer_id === "string" ? args.customer_id.trim() : "";
  if (providedId) {
    const rows = await rest(token, `customers?id=eq.${encodeURIComponent(providedId)}&organization_id=eq.${encodeURIComponent(oid)}&select=id,name,email,phone,address&limit=1`);
    if (!rows?.[0]) throw new Error("Customer not found in this FastTract organization.");
    return rows[0];
  }

  const name = typeof args.customer_name === "string" ? args.customer_name.trim() : "";
  if (!name) throw new Error("Provide customer_id or customer_name.");
  const matches = await rest(token, `customers?organization_id=eq.${encodeURIComponent(oid)}&name=ilike.${encodeURIComponent(name)}&select=id,name,email,phone,address&limit=5`);
  if (matches.length === 0) throw new Error(`No customer named "${name}" was found.`);
  if (matches.length > 1) throw new Error(`More than one customer matched "${name}". Provide customer_id.`);
  return matches[0];
}

async function resolveJob(token: string, oid: string, args: Record<string, unknown>) {
  const providedId = typeof args.job_id === "string" ? args.job_id.trim() : "";
  if (providedId) {
    const rows = await rest(token, `jobs?id=eq.${encodeURIComponent(providedId)}&organization_id=eq.${encodeURIComponent(oid)}&select=id,title,status,customer_id&limit=1`);
    if (!rows?.[0]) throw new Error("Job not found in this FastTract organization.");
    return rows[0];
  }

  const title = typeof args.job_title === "string" ? args.job_title.trim() : "";
  if (!title) throw new Error("Provide job_id or job_title.");
  const matches = await rest(token, `jobs?organization_id=eq.${encodeURIComponent(oid)}&title=ilike.${encodeURIComponent(title)}&select=id,title,status,customer_id&limit=5`);
  if (matches.length === 0) throw new Error(`No job titled "${title}" was found.`);
  if (matches.length > 1) throw new Error(`More than one job matched "${title}". Provide job_id.`);
  return matches[0];
}

function normalizeLineItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("At least one line item is required.");
  const items = raw.map((value) => {
    const item = value as Record<string, unknown>;
    const description = String(item.description || "").trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unit_price);
    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Each line item needs a description, quantity greater than zero, and non-negative unit_price.");
    }
    return { description, quantity, unit_price: unitPrice, total: quantity * unitPrice };
  });
  return items;
}

const confirmProperty = {
  confirm: { type: "boolean", description: "Set true only after reviewing the preview." },
};

const customerSelector = {
  customer_id: { type: "string", format: "uuid" },
  customer_name: { type: "string", description: "Exact customer name when customer_id is not supplied." },
};

const tools = [
  {
    name: "list_customers",
    title: "List customers",
    description: "List customers in the signed-in user's FastTract organization.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_customer",
    title: "Create customer",
    description: "Preview, then create a customer directly in FastTract.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        notes: { type: "string" },
        ...confirmProperty,
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "list_jobs",
    title: "List jobs",
    description: "List FastTract jobs with customer, schedule, status, and budget.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["scheduled", "in_progress", "on_hold", "completed", "cancelled"] },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_job",
    title: "Create job",
    description: "Preview, then create a job directly in FastTract.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        ...customerSelector,
        description: { type: "string" },
        address: { type: "string" },
        status: { type: "string", enum: ["scheduled", "in_progress", "on_hold", "completed", "cancelled"], default: "scheduled" },
        scheduled_start: { type: "string", description: "ISO-8601 date/time." },
        scheduled_end: { type: "string", description: "ISO-8601 date/time." },
        budget: { type: "number", minimum: 0 },
        ...confirmProperty,
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "list_estimates",
    title: "List estimates",
    description: "List FastTract estimates and acceptance/deposit status.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "sent", "approved", "rejected"] },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_estimate",
    title: "Create estimate",
    description: "Preview, then create a customer estimate and line items directly in FastTract.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        ...customerSelector,
        status: { type: "string", enum: ["draft", "sent", "approved", "rejected"], default: "draft" },
        tax: { type: "number", minimum: 0, default: 0, description: "Tax amount in dollars." },
        deposit_required: { type: "number", minimum: 0 },
        notes: { type: "string" },
        line_items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              description: { type: "string", minLength: 1 },
              quantity: { type: "number", exclusiveMinimum: 0 },
              unit_price: { type: "number", minimum: 0 },
            },
            required: ["description", "quantity", "unit_price"],
            additionalProperties: false,
          },
        },
        ...confirmProperty,
      },
      required: ["title", "line_items"],
      additionalProperties: false,
    },
  },
  {
    name: "list_invoices",
    title: "List invoices",
    description: "List FastTract invoices with payment status and balances.",
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "void"] },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "create_invoice",
    title: "Create invoice",
    description: "Preview, then create an invoice and line items directly in FastTract.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        ...customerSelector,
        number: { type: "string" },
        status: { type: "string", enum: ["draft", "sent", "paid", "overdue", "void"], default: "draft" },
        issue_date: { type: "string", description: "YYYY-MM-DD. Defaults to today." },
        due_date: { type: "string", description: "YYYY-MM-DD." },
        tax_rate: { type: "number", minimum: 0, default: 0, description: "Tax percentage, for example 8.5." },
        notes: { type: "string" },
        terms: { type: "string" },
        line_items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              description: { type: "string", minLength: 1 },
              quantity: { type: "number", exclusiveMinimum: 0 },
              unit_price: { type: "number", minimum: 0 },
            },
            required: ["description", "quantity", "unit_price"],
            additionalProperties: false,
          },
        },
        ...confirmProperty,
      },
      required: ["line_items"],
      additionalProperties: false,
    },
  },
  {
    name: "mark_invoice_paid",
    title: "Mark invoice paid",
    description: "Preview, then mark a FastTract invoice paid in full.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        invoice_id: { type: "string", format: "uuid" },
        invoice_number: { type: "string" },
        ...confirmProperty,
      },
      additionalProperties: false,
    },
  },
  {
    name: "clock_in",
    title: "Clock in",
    description: "Preview, then clock the signed-in user into a FastTract job.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", format: "uuid" },
        job_title: { type: "string" },
        note: { type: "string" },
        ...confirmProperty,
      },
      additionalProperties: false,
    },
  },
  {
    name: "clock_out",
    title: "Clock out",
    description: "Preview, then close the signed-in user's open FastTract time entry.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string", format: "uuid" },
        job_title: { type: "string" },
        note: { type: "string" },
        ...confirmProperty,
      },
      additionalProperties: false,
    },
  },
  {
    name: "send_customer_message",
    title: "Send customer message",
    description: "Preview, then send a customer SMS or email through FastTract messaging.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        ...customerSelector,
        channel: { type: "string", enum: ["sms", "email"] },
        message: { type: "string", minLength: 1 },
        ...confirmProperty,
      },
      required: ["channel", "message"],
      additionalProperties: false,
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>, req: Request) {
  const { token, userId } = await getAuth(req);
  const oid = await organizationId(token, userId);

  if (name === "list_customers") {
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    let path = `customers?organization_id=eq.${encodeURIComponent(oid)}&select=id,name,email,phone,address,notes,created_at&order=created_at.desc&limit=${limit}`;
    const search = typeof args.search === "string" ? args.search.trim() : "";
    if (search) path += `&or=(name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*,phone.ilike.*${encodeURIComponent(search)}*)`;
    const rows = await rest(token, path);
    return toolOk(JSON.stringify(rows), { customers: rows });
  }

  if (name === "create_customer") {
    const customer = {
      organization_id: oid,
      name: String(args.name || "").trim(),
      email: typeof args.email === "string" && args.email.trim() ? args.email.trim() : null,
      phone: typeof args.phone === "string" && args.phone.trim() ? args.phone.trim() : null,
      address: typeof args.address === "string" && args.address.trim() ? args.address.trim() : null,
      notes: typeof args.notes === "string" && args.notes.trim() ? args.notes.trim() : null,
    };
    if (!customer.name) return toolErr("Customer name is required.");
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would create customer "${customer.name}" directly in FastTract. Review the details, then call again with confirm: true.`, { pending: true, preview: customer });
    }
    const rows = await rest(token, "customers", { method: "POST", body: JSON.stringify(customer) });
    const created = rows?.[0];
    return created?.id
      ? toolOk(`Created FastTract customer ${customer.name}.`, { customer: created })
      : toolErr("Customer was created but no ID was returned.");
  }

  if (name === "list_jobs") {
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    let path = `jobs?organization_id=eq.${encodeURIComponent(oid)}&select=id,title,status,address,scheduled_start,scheduled_end,budget,customer_id,customers(name)&order=created_at.desc&limit=${limit}`;
    if (typeof args.status === "string" && args.status) path += `&status=eq.${encodeURIComponent(args.status)}`;
    const rows = await rest(token, path);
    return toolOk(JSON.stringify(rows), { jobs: rows });
  }

  if (name === "create_job") {
    const title = String(args.title || "").trim();
    if (!title) return toolErr("Job title is required.");
    let customer: any = null;
    if (args.customer_id || args.customer_name) {
      try { customer = await resolveCustomer(token, oid, args); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    }
    const job = {
      organization_id: oid,
      customer_id: customer?.id ?? null,
      title,
      description: typeof args.description === "string" && args.description.trim() ? args.description.trim() : null,
      status: typeof args.status === "string" ? args.status : "scheduled",
      address: typeof args.address === "string" && args.address.trim() ? args.address.trim() : customer?.address ?? null,
      scheduled_start: typeof args.scheduled_start === "string" && args.scheduled_start ? args.scheduled_start : null,
      scheduled_end: typeof args.scheduled_end === "string" && args.scheduled_end ? args.scheduled_end : null,
      budget: args.budget === undefined ? null : Number(args.budget),
      created_by: userId,
    };
    if (job.budget !== null && (!Number.isFinite(job.budget) || job.budget < 0)) return toolErr("Budget must be a non-negative number.");
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would create job "${title}"${customer ? ` for ${customer.name}` : ""} directly in FastTract. Review the details, then call again with confirm: true.`, { pending: true, preview: job });
    }
    const rows = await rest(token, "jobs", { method: "POST", body: JSON.stringify(job) });
    const created = rows?.[0];
    return created?.id
      ? toolOk(`Created FastTract job ${created.title}.`, { job: created })
      : toolErr("Job was created but no ID was returned.");
  }

  if (name === "list_estimates") {
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    let path = `estimates?organization_id=eq.${encodeURIComponent(oid)}&select=id,title,status,subtotal,tax,total,customer_id,customers(name),accepted_at,accepted_by_name,deposit_required,deposit_collected,deposit_amount_collected,created_at&order=created_at.desc&limit=${limit}`;
    if (typeof args.status === "string" && args.status) path += `&status=eq.${encodeURIComponent(args.status)}`;
    const rows = await rest(token, path);
    return toolOk(JSON.stringify(rows), { estimates: rows });
  }

  if (name === "create_estimate") {
    const title = String(args.title || "").trim();
    if (!title) return toolErr("Estimate title is required.");
    let customer: any;
    try { customer = await resolveCustomer(token, oid, args); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    let items;
    try { items = normalizeLineItems(args.line_items); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const tax = Number(args.tax || 0);
    const depositRequired = args.deposit_required === undefined ? null : Number(args.deposit_required);
    if (!Number.isFinite(tax) || tax < 0) return toolErr("Tax must be a non-negative dollar amount.");
    if (depositRequired !== null && (!Number.isFinite(depositRequired) || depositRequired < 0)) return toolErr("Deposit must be a non-negative dollar amount.");
    const total = subtotal + tax;
    const estimate = {
      organization_id: oid,
      customer_id: customer.id,
      title,
      status: typeof args.status === "string" ? args.status : "draft",
      subtotal,
      tax,
      total,
      notes: typeof args.notes === "string" && args.notes.trim() ? args.notes.trim() : null,
      deposit_required: depositRequired,
      share_token: crypto.randomUUID().replaceAll("-", ""),
      created_by: userId,
    };
    const preview = { ...estimate, customer_name: customer.name, line_items: items };
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would create estimate "${title}" for ${customer.name} totaling $${total.toFixed(2)} directly in FastTract. Review the details, then call again with confirm: true.`, { pending: true, preview });
    }
    const rows = await rest(token, "estimates", { method: "POST", body: JSON.stringify(estimate) });
    const created = rows?.[0];
    if (!created?.id) return toolErr("Estimate was created but no ID was returned.");
    try {
      const lineRows = items.map((item, position) => ({ estimate_id: created.id, ...item, position }));
      await rest(token, "estimate_line_items", { method: "POST", body: JSON.stringify(lineRows) });
    } catch (error) {
      try { await rest(token, `estimates?id=eq.${encodeURIComponent(created.id)}`, { method: "DELETE" }); } catch { /* best effort rollback */ }
      return toolErr(`Estimate line items failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return toolOk(`Created FastTract estimate ${created.id} for ${customer.name} totaling $${total.toFixed(2)}.`, { estimate: created, line_items: items });
  }

  if (name === "list_invoices") {
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    let path = `invoices?organization_id=eq.${encodeURIComponent(oid)}&select=id,number,status,issue_date,due_date,subtotal,tax_rate,tax_amount,total,amount_paid,customer_id,customers(name),created_at&order=created_at.desc&limit=${limit}`;
    if (typeof args.status === "string" && args.status) path += `&status=eq.${encodeURIComponent(args.status)}`;
    const rows = await rest(token, path);
    return toolOk(JSON.stringify(rows), { invoices: rows });
  }

  if (name === "create_invoice") {
    let customer: any;
    try { customer = await resolveCustomer(token, oid, args); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    let items;
    try { items = normalizeLineItems(args.line_items); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = Number(args.tax_rate || 0);
    if (!Number.isFinite(taxRate) || taxRate < 0) return toolErr("Tax rate must be a non-negative percentage.");
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const number = typeof args.number === "string" && args.number.trim() ? args.number.trim() : `INV-${String(Date.now()).slice(-6)}`;
    const invoice = {
      organization_id: oid,
      customer_id: customer.id,
      number,
      status: typeof args.status === "string" ? args.status : "draft",
      issue_date: typeof args.issue_date === "string" && args.issue_date ? args.issue_date : new Date().toISOString().slice(0, 10),
      due_date: typeof args.due_date === "string" && args.due_date ? args.due_date : null,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      amount_paid: typeof args.status === "string" && args.status === "paid" ? total : 0,
      notes: typeof args.notes === "string" && args.notes.trim() ? args.notes.trim() : null,
      terms: typeof args.terms === "string" && args.terms.trim() ? args.terms.trim() : null,
      created_by: userId,
    };
    const preview = { ...invoice, customer_name: customer.name, line_items: items };
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would create invoice ${number} for ${customer.name} totaling $${total.toFixed(2)} directly in FastTract. Review the details, then call again with confirm: true.`, { pending: true, preview });
    }
    const rows = await rest(token, "invoices", { method: "POST", body: JSON.stringify(invoice) });
    const created = rows?.[0];
    if (!created?.id) return toolErr("Invoice was created but no ID was returned.");
    try {
      const lineRows = items.map((item, position) => ({ invoice_id: created.id, ...item, position }));
      await rest(token, "invoice_line_items", { method: "POST", body: JSON.stringify(lineRows) });
    } catch (error) {
      try { await rest(token, `invoices?id=eq.${encodeURIComponent(created.id)}`, { method: "DELETE" }); } catch { /* best effort rollback */ }
      return toolErr(`Invoice line items failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return toolOk(`Created FastTract invoice ${number} for ${customer.name} totaling $${total.toFixed(2)}.`, { invoice: created, line_items: items });
  }

  if (name === "mark_invoice_paid") {
    const invoiceId = typeof args.invoice_id === "string" ? args.invoice_id.trim() : "";
    const invoiceNumber = typeof args.invoice_number === "string" ? args.invoice_number.trim() : "";
    if (!invoiceId && !invoiceNumber) return toolErr("Provide invoice_id or invoice_number.");
    const filter = invoiceId ? `id=eq.${encodeURIComponent(invoiceId)}` : `number=eq.${encodeURIComponent(invoiceNumber)}`;
    const matches = await rest(token, `invoices?organization_id=eq.${encodeURIComponent(oid)}&${filter}&select=id,number,status,total,amount_paid,customers(name)&limit=2`);
    if (matches.length === 0) return toolErr("Invoice not found.");
    if (matches.length > 1) return toolErr("More than one invoice matched. Provide invoice_id.");
    const invoice = matches[0];
    if (invoice.status === "paid" && Number(invoice.amount_paid) >= Number(invoice.total)) return toolOk(`Invoice ${invoice.number || invoice.id} is already paid.`, { invoice });
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would mark invoice ${invoice.number || invoice.id} paid in full for $${Number(invoice.total).toFixed(2)}. Review, then call again with confirm: true.`, { pending: true, preview: invoice });
    }
    const rows = await rest(token, `invoices?id=eq.${encodeURIComponent(invoice.id)}&organization_id=eq.${encodeURIComponent(oid)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paid", amount_paid: Number(invoice.total) }),
    });
    return toolOk(`Marked invoice ${invoice.number || invoice.id} paid.`, { invoice: rows?.[0] ?? invoice });
  }

  if (name === "clock_in") {
    let job: any;
    try { job = await resolveJob(token, oid, args); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    const open = await rest(token, `time_entries?organization_id=eq.${encodeURIComponent(oid)}&user_id=eq.${encodeURIComponent(userId)}&clock_out=is.null&select=id,job_id,clock_in,jobs(title)&order=clock_in.desc&limit=1`);
    if (open?.[0]) return toolErr(`You are already clocked in${open[0].jobs?.title ? ` to ${open[0].jobs.title}` : ""}. Clock out first.`, { openEntry: open[0] });
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would clock you into "${job.title}" now. Review, then call again with confirm: true.`, { pending: true, preview: { job_id: job.id, job_title: job.title } });
    }
    const rows = await rest(token, "time_entries", {
      method: "POST",
      body: JSON.stringify({
        organization_id: oid,
        job_id: job.id,
        user_id: userId,
        clock_in: new Date().toISOString(),
        status: "pending",
        note: typeof args.note === "string" && args.note.trim() ? args.note.trim() : null,
      }),
    });
    return toolOk(`Clocked into ${job.title}.`, { timeEntry: rows?.[0] });
  }

  if (name === "clock_out") {
    let jobId = "";
    let jobTitle = "";
    if (args.job_id || args.job_title) {
      try {
        const job = await resolveJob(token, oid, args);
        jobId = job.id;
        jobTitle = job.title;
      } catch (error) {
        return toolErr(error instanceof Error ? error.message : String(error));
      }
    }
    let path = `time_entries?organization_id=eq.${encodeURIComponent(oid)}&user_id=eq.${encodeURIComponent(userId)}&clock_out=is.null&select=id,job_id,clock_in,note,jobs(title)&order=clock_in.desc&limit=1`;
    if (jobId) path += `&job_id=eq.${encodeURIComponent(jobId)}`;
    const open = await rest(token, path);
    if (!open?.[0]) return toolErr(jobId ? `No open time entry was found for ${jobTitle}.` : "You are not currently clocked in.");
    const entry = open[0];
    const label = entry.jobs?.title || jobTitle || "your current job";
    if (args.confirm !== true) {
      return toolOk(`Not yet applied. This would clock you out of ${label} now. Review, then call again with confirm: true.`, { pending: true, preview: entry });
    }
    const note = typeof args.note === "string" && args.note.trim()
      ? [entry.note, args.note.trim()].filter(Boolean).join("\n")
      : entry.note;
    const rows = await rest(token, `time_entries?id=eq.${encodeURIComponent(entry.id)}&organization_id=eq.${encodeURIComponent(oid)}`, {
      method: "PATCH",
      body: JSON.stringify({ clock_out: new Date().toISOString(), note: note || null }),
    });
    return toolOk(`Clocked out of ${label}.`, { timeEntry: rows?.[0] });
  }

  if (name === "send_customer_message") {
    let customer: any;
    try { customer = await resolveCustomer(token, oid, args); } catch (error) { return toolErr(error instanceof Error ? error.message : String(error)); }
    const channel = args.channel === "email" ? "email" : args.channel === "sms" ? "sms" : "";
    const message = String(args.message || "").trim();
    if (!channel) return toolErr("Channel must be sms or email.");
    if (!message) return toolErr("Message is required.");
    const destination = channel === "email" ? customer.email : customer.phone;
    if (!destination) return toolErr(`${customer.name} does not have a ${channel === "email" ? "email address" : "phone number"} in FastTract.`);
    if (args.confirm !== true) {
      return toolOk(`Not yet sent. This would send a ${channel.toUpperCase()} message to ${customer.name} at ${destination}:\n\n${message}\n\nReview the recipient and message, then call again with confirm: true.`, { pending: true, preview: { customer_id: customer.id, customer_name: customer.name, channel, destination, message } });
    }
    const response = await fetch(`${SUPABASE_URL}/functions/v1/fasttract-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId: oid, customerId: customer.id, channel, message }),
    });
    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
    if (!response.ok || data?.error) return toolErr(String(data?.error || `Message failed with HTTP ${response.status}`));
    return toolOk(String(data?.message || `Message sent to ${customer.name}.`), { delivery: data, customer: { id: customer.id, name: customer.name } });
  }

  return toolErr(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return json({ name: "FastTract MCP", version: "0.4.0", status: "ok", systemOfRecord: "FastTract" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let msg: any;
  try { msg = await req.json(); } catch { return rpcError(null, -32700, "Parse error"); }
  const id = msg.id ?? null;

  try {
    switch (msg.method) {
      case "initialize":
        return result(id, {
          protocolVersion: msg.params?.protocolVersion || "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "fasttract-mcp", version: "0.4.0" },
        });
      case "notifications/initialized":
        return new Response(null, { status: 202, headers: cors });
      case "ping":
        return result(id, {});
      case "tools/list":
        await getAuth(req);
        return result(id, { tools });
      case "tools/call": {
        const toolName = String(msg.params?.name || "");
        const args = (msg.params?.arguments || {}) as Record<string, unknown>;
        const out = await callTool(toolName, args, req);
        return result(id, out);
      }
      default:
        return rpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Not authenticated") return json({ error: "unauthorized" }, 401);
    return rpcError(id, -32603, message);
  }
});
