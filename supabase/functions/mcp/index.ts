// FastTract MCP — hand-maintained compact implementation.
// Intentionally avoids @lovable.dev/mcp-js so the Supabase bundle stays small.

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
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) throw new Error("Not authenticated");
  const user = await r.json();
  return { token, userId: user.id as string };
}

async function rest(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(data?.message || data?.error || text || `HTTP ${r.status}`);
  return data;
}

async function orgId(token: string, userId: string) {
  const rows = await rest(token, `organization_members?user_id=eq.${encodeURIComponent(userId)}&select=organization_id&limit=1`);
  const id = rows?.[0]?.organization_id;
  if (!id) throw new Error("No organization found for this user.");
  return id as string;
}

const tools = [
  {
    name: "list_customers",
    title: "List customers",
    description: "List customers visible to the signed-in user's organization.",
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
    description: "Preview, then create a customer in FastTract and sync it to GoHighLevel.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        email: { type: "string" },
        phone: { type: "string" },
        address: { type: "string" },
        confirm: { type: "boolean", description: "Set true only after reviewing the preview." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "create_estimate",
    title: "Create estimate in HighLevel",
    description: "Preview, then create a FastTract estimate and create the matching estimate in GoHighLevel.",
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1 },
        customer_id: { type: "string", format: "uuid" },
        customer_name: { type: "string", description: "Customer name to resolve when customer_id is not supplied." },
        lead_id: { type: "string", format: "uuid" },
        status: { type: "string", enum: ["draft", "sent", "accepted", "declined"], default: "draft" },
        tax: { type: "number", minimum: 0, default: 0 },
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
        confirm: { type: "boolean", description: "Set true only after reviewing the preview." },
      },
      required: ["title", "line_items"],
      additionalProperties: false,
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>, req: Request) {
  const { token, userId } = await getAuth(req);
  const oid = await orgId(token, userId);

  if (name === "list_customers") {
    const limit = Math.min(Math.max(Number(args.limit || 25), 1), 100);
    let path = `customers?organization_id=eq.${encodeURIComponent(oid)}&select=id,name,email,phone,address,created_at&order=created_at.desc&limit=${limit}`;
    const search = typeof args.search === "string" ? args.search.trim() : "";
    if (search) path += `&or=(name.ilike.*${encodeURIComponent(search)}*,email.ilike.*${encodeURIComponent(search)}*)`;
    const rows = await rest(token, path);
    return toolOk(JSON.stringify(rows), { customers: rows });
  }

  if (name === "create_customer") {
    const customer = {
      name: String(args.name || "").trim(),
      email: args.email || null,
      phone: args.phone || null,
      address: args.address || null,
      organization_id: oid,
    };
    if (!customer.name) return toolErr("Customer name is required.");
    if (args.confirm !== true) {
      return toolOk(
        `Not yet applied. This would create customer \"${customer.name}\" and sync it to GoHighLevel. Review the details, then call again with confirm: true.`,
        { pending: true, preview: customer },
      );
    }

    const rows = await rest(token, "customers", {
      method: "POST",
      body: JSON.stringify(customer),
      headers: { Prefer: "return=representation" },
    });
    const created = rows?.[0];
    if (!created?.id) return toolErr("Customer was created but no ID was returned.");

    let ghlSync: unknown = null;
    try {
      const sync = await fetch(`${SUPABASE_URL}/functions/v1/ghl-sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ organizationId: oid, entity: "customer", id: created.id }),
      });
      const text = await sync.text();
      ghlSync = text ? JSON.parse(text) : { ok: sync.ok };
      if (!sync.ok) throw new Error((ghlSync as any)?.error || `GHL sync HTTP ${sync.status}`);
    } catch (e) {
      return toolErr(`Customer ${created.id} was created in FastTract, but GoHighLevel sync failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    return toolOk(`Created customer ${created.id} and synced it to GoHighLevel.`, { customer: created, ghlSync });
  }

  if (name === "create_estimate") {
    const title = String(args.title || "").trim();
    const items = Array.isArray(args.line_items) ? args.line_items as Array<Record<string, unknown>> : [];
    if (!title) return toolErr("Estimate title is required.");
    if (!items.length) return toolErr("At least one estimate line item is required.");

    let customerId = typeof args.customer_id === "string" ? args.customer_id : "";
    const customerName = typeof args.customer_name === "string" ? args.customer_name.trim() : "";
    if (!customerId && customerName) {
      const matches = await rest(
        token,
        `customers?organization_id=eq.${encodeURIComponent(oid)}&name=ilike.${encodeURIComponent(customerName)}&select=id,name,email,phone&limit=5`,
      );
      if (matches.length === 1) customerId = matches[0].id;
      else if (matches.length === 0) return toolErr(`No customer named \"${customerName}\" was found. Create the customer first or provide customer_id.`);
      else return toolErr(`More than one customer matched \"${customerName}\". Provide customer_id to choose the correct one.`, { matches });
    }
    if (!customerId) return toolErr("A customer_id or customer_name is required to create a HighLevel estimate.");

    const normalizedItems = items.map((item) => ({
      description: String(item.description || "").trim(),
      quantity: Number(item.quantity),
      unit_price: Number(item.unit_price),
    }));
    if (normalizedItems.some((item) => !item.description || !(item.quantity > 0) || item.unit_price < 0 || !Number.isFinite(item.unit_price))) {
      return toolErr("Each line item needs a description, quantity greater than zero, and non-negative unit_price.");
    }

    const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const tax = Number(args.tax || 0);
    if (!Number.isFinite(tax) || tax < 0) return toolErr("Tax must be a non-negative number.");
    const total = subtotal + tax;
    const preview = {
      title,
      customer_id: customerId,
      lead_id: args.lead_id || null,
      status: args.status || "draft",
      tax,
      notes: args.notes || null,
      line_items: normalizedItems,
      subtotal,
      total,
      destination: "FastTract + GoHighLevel Estimates",
    };

    if (args.confirm !== true) {
      return toolOk(
        `Not yet applied. This would create estimate \"${title}\" totaling $${total.toFixed(2)} in FastTract and GoHighLevel. Review the details, then call again with confirm: true.`,
        { pending: true, preview },
      );
    }

    const rows = await rest(token, "estimates", {
      method: "POST",
      body: JSON.stringify({
        organization_id: oid,
        title,
        customer_id: customerId,
        lead_id: args.lead_id || null,
        status: args.status || "draft",
        subtotal,
        tax,
        total,
        notes: args.notes || null,
        created_by: userId,
      }),
      headers: { Prefer: "return=representation" },
    });
    const created = rows?.[0];
    if (!created?.id) return toolErr("Estimate was created but no ID was returned.");

    const lineRows = normalizedItems.map((item, position) => ({
      estimate_id: created.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.quantity * item.unit_price,
      position,
    }));
    await rest(token, "estimate_line_items", {
      method: "POST",
      body: JSON.stringify(lineRows),
      headers: { Prefer: "return=representation" },
    });

    const sync = await fetch(`${SUPABASE_URL}/functions/v1/ghl-estimate-create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId: oid, estimateId: created.id }),
    });
    const syncText = await sync.text();
    let ghl: any = null;
    try { ghl = syncText ? JSON.parse(syncText) : null; } catch { ghl = { raw: syncText }; }
    if (!sync.ok) {
      return toolErr(
        `Estimate ${created.id} was created in FastTract, but HighLevel creation failed: ${ghl?.error || `HTTP ${sync.status}`}` +
          (ghl?.hint ? ` ${ghl.hint}` : ""),
        { estimate: created, ghl },
      );
    }

    return toolOk(
      `Created estimate ${created.id} in FastTract and HighLevel${ghl?.ghlEstimateId ? ` (${ghl.ghlEstimateId})` : ""}.`,
      { estimate: created, ghl },
    );
  }

  return toolErr(`Unknown tool: ${name}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method === "GET") return json({ name: "FastTract MCP", version: "0.3.1", status: "ok" });
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
          serverInfo: { name: "fasttract-mcp", version: "0.3.1" },
        });
      case "notifications/initialized":
        return new Response(null, { status: 202, headers: cors });
      case "ping":
        return result(id, {});
      case "tools/list":
        await getAuth(req);
        return result(id, { tools });
      case "tools/call": {
        const toolName = msg.params?.name;
        const args = msg.params?.arguments || {};
        const out = await callTool(toolName, args, req);
        return result(id, out);
      }
      default:
        return rpcError(id, -32601, `Method not found: ${msg.method}`);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message === "Not authenticated") return json({ error: "unauthorized" }, 401);
    return rpcError(id, -32603, message);
  }
});
