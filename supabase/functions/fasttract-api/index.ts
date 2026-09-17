import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-fasttract-api-key, x-fasttract-organization, idempotency-key",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const clean = (value: unknown) => typeof value === "string" ? value.trim() : "";
const numberOr = (value: unknown, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Actor = {
  organizationId: string;
  userId: string | null;
  role: string;
  authType: "jwt" | "api_key";
  scopes: string[];
};

async function resolveActor(req: Request, url: URL, body: any): Promise<Actor> {
  const authHeader = req.headers.get("Authorization") || "";
  const explicitApiKey = req.headers.get("x-fasttract-api-key") || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const apiKey = explicitApiKey || (bearer.startsWith("ft_") ? bearer : "");

  if (apiKey) {
    const keyHash = await sha256(apiKey);
    const { data: keyRow, error } = await admin
      .from("fasttract_api_keys")
      .select("id,organization_id,created_by,scopes,revoked_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!keyRow) throw new Error("Unauthorized");
    await admin.from("fasttract_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
    return {
      organizationId: keyRow.organization_id,
      userId: keyRow.created_by ?? null,
      role: "integration",
      authType: "api_key",
      scopes: Array.isArray(keyRow.scopes) ? keyRow.scopes : [],
    };
  }

  if (!bearer) throw new Error("Unauthorized");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  let organizationId = clean(req.headers.get("x-fasttract-organization")) || clean(url.searchParams.get("organization_id")) || clean(body?.organization_id) || clean(body?.organizationId);
  if (!organizationId) {
    const { data: firstMembership, error } = await admin
      .from("organization_members")
      .select("organization_id,role")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!firstMembership?.organization_id) throw new Error("Forbidden");
    organizationId = firstMembership.organization_id;
    return { organizationId, userId: userData.user.id, role: firstMembership.role, authType: "jwt", scopes: ["read", "write"] };
  }

  const { data: membership, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!membership) throw new Error("Forbidden");
  return { organizationId, userId: userData.user.id, role: membership.role, authType: "jwt", scopes: ["read", "write"] };
}

function requireScope(actor: Actor, scope: "read" | "write") {
  if (actor.authType === "api_key" && !actor.scopes.includes(scope)) throw new Error("Forbidden");
}

async function effectiveUserId(actor: Actor) {
  if (actor.userId) return actor.userId;
  const { data } = await admin.from("organizations").select("owner_id,created_by").eq("id", actor.organizationId).single();
  return data?.owner_id ?? data?.created_by ?? null;
}

function normalizePath(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  const fnIndex = parts.lastIndexOf("fasttract-api");
  const tail = fnIndex >= 0 ? parts.slice(fnIndex + 1) : parts;
  return "/" + tail.join("/");
}

const openApi = {
  openapi: "3.1.0",
  info: { title: "FastTract API", version: "1.0.0", description: "Organization-scoped API for FastTract customers, jobs, estimates, invoices and time tracking." },
  servers: [{ url: `${SUPABASE_URL}/functions/v1/fasttract-api` }],
  components: {
    securitySchemes: {
      fasttractApiKey: { type: "apiKey", in: "header", name: "x-fasttract-api-key" },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
  paths: {
    "/v1/health": { get: { summary: "Health check" } },
    "/v1/me": { get: { summary: "Current FastTract actor and organization", security: [{ bearerAuth: [] }, { fasttractApiKey: [] }] } },
    "/v1/customers": { get: { summary: "List customers" }, post: { summary: "Create customer" } },
    "/v1/jobs": { get: { summary: "List jobs" }, post: { summary: "Create job" } },
    "/v1/estimates": { get: { summary: "List estimates" }, post: { summary: "Create estimate" } },
    "/v1/invoices": { get: { summary: "List invoices" }, post: { summary: "Create invoice" } },
    "/v1/time/clock-in": { post: { summary: "Clock current user into a job" } },
    "/v1/time/clock-out": { post: { summary: "Clock current user out" } },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const path = normalizePath(url);

  if (req.method === "GET" && (path === "/v1/health" || path === "/health")) {
    return json({ ok: true, service: "FastTract API", version: "v1" });
  }
  if (req.method === "GET" && (path === "/openapi.json" || path === "/v1/openapi.json")) return json(openApi);

  let body: any = {};
  if (!["GET", "HEAD"].includes(req.method)) {
    try { body = await req.json(); } catch { body = {}; }
  }

  try {
    const actor = await resolveActor(req, url, body);

    if (req.method === "GET" && path === "/v1/me") {
      requireScope(actor, "read");
      const [{ data: organization }, { data: profile }] = await Promise.all([
        admin.from("organizations").select("id,name,legal_name,phone,email,website,plan,brand_color,logo_url").eq("id", actor.organizationId).single(),
        actor.userId ? admin.from("profiles").select("id,email,full_name,phone").eq("id", actor.userId).maybeSingle() : Promise.resolve({ data: null } as any),
      ]);
      return json({ actor: { authType: actor.authType, role: actor.role, userId: actor.userId }, organization, profile });
    }

    if (path === "/v1/customers") {
      if (req.method === "GET") {
        requireScope(actor, "read");
        const q = clean(url.searchParams.get("q"));
        let query = admin.from("customers").select("id,name,email,phone,address,notes,created_at,updated_at").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(200);
        if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
        const { data, error } = await query;
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        requireScope(actor, "write");
        const name = clean(body.name);
        if (!name) return json({ error: "name is required" }, 400);
        const { data, error } = await admin.from("customers").insert({
          organization_id: actor.organizationId,
          name,
          email: clean(body.email) || null,
          phone: clean(body.phone) || null,
          address: clean(body.address) || null,
          notes: clean(body.notes) || null,
        }).select("id,name,email,phone,address,notes,created_at").single();
        if (error) throw error;
        return json({ data }, 201);
      }
    }

    if (path.startsWith("/v1/customers/") && req.method === "PATCH") {
      requireScope(actor, "write");
      const id = path.split("/").pop()!;
      const patch: Record<string, unknown> = {};
      for (const field of ["name", "email", "phone", "address", "notes"]) if (field in body) patch[field] = clean(body[field]) || null;
      if (!Object.keys(patch).length) return json({ error: "No supported fields supplied" }, 400);
      const { data, error } = await admin.from("customers").update(patch).eq("organization_id", actor.organizationId).eq("id", id).select("id,name,email,phone,address,notes,updated_at").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Customer not found" }, 404);
      return json({ data });
    }

    if (path === "/v1/jobs") {
      if (req.method === "GET") {
        requireScope(actor, "read");
        const { data, error } = await admin.from("jobs").select("id,customer_id,estimate_id,title,description,status,address,scheduled_start,scheduled_end,budget,created_at,updated_at,customers(name)").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        requireScope(actor, "write");
        const title = clean(body.title);
        if (!title) return json({ error: "title is required" }, 400);
        const createdBy = await effectiveUserId(actor);
        const { data, error } = await admin.from("jobs").insert({
          organization_id: actor.organizationId,
          customer_id: clean(body.customer_id) || null,
          estimate_id: clean(body.estimate_id) || null,
          title,
          description: clean(body.description) || null,
          status: clean(body.status) || "scheduled",
          address: clean(body.address) || null,
          scheduled_start: clean(body.scheduled_start) || null,
          scheduled_end: clean(body.scheduled_end) || null,
          budget: body.budget == null ? null : numberOr(body.budget),
          created_by: createdBy,
        }).select("*").single();
        if (error) throw error;
        return json({ data }, 201);
      }
    }

    if (path.startsWith("/v1/jobs/") && req.method === "PATCH") {
      requireScope(actor, "write");
      const id = path.split("/").pop()!;
      const allowed = ["customer_id","estimate_id","title","description","status","address","scheduled_start","scheduled_end","budget"];
      const patch: Record<string, unknown> = {};
      for (const field of allowed) if (field in body) patch[field] = body[field] === "" ? null : body[field];
      const { data, error } = await admin.from("jobs").update(patch).eq("organization_id", actor.organizationId).eq("id", id).select("*").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Job not found" }, 404);
      return json({ data });
    }

    if (path === "/v1/estimates") {
      if (req.method === "GET") {
        requireScope(actor, "read");
        const { data, error } = await admin.from("estimates").select("id,customer_id,title,status,subtotal,tax,total,notes,share_token,accepted_at,deposit_required,deposit_collected,created_at,updated_at,customers(name,email,phone)").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        requireScope(actor, "write");
        const title = clean(body.title) || "Estimate";
        const items = Array.isArray(body.items) ? body.items : [];
        if (!clean(body.customer_id)) return json({ error: "customer_id is required" }, 400);
        if (!items.length) return json({ error: "items[] is required" }, 400);
        const normalized = items.map((item: any) => ({ description: clean(item.description), quantity: Math.max(0, numberOr(item.quantity, 1)), unit_price: Math.max(0, numberOr(item.unit_price, 0)) })).filter((item: any) => item.description);
        if (!normalized.length) return json({ error: "At least one valid item is required" }, 400);
        const subtotal = normalized.reduce((sum: number, item: any) => sum + item.quantity * item.unit_price, 0);
        const tax = Math.max(0, numberOr(body.tax, 0));
        const total = subtotal + tax;
        const createdBy = await effectiveUserId(actor);
        const { data: estimate, error } = await admin.from("estimates").insert({
          organization_id: actor.organizationId,
          customer_id: clean(body.customer_id),
          title,
          status: clean(body.status) || "draft",
          subtotal,
          tax,
          total,
          notes: clean(body.notes) || null,
          deposit_required: body.deposit_required == null ? null : Math.max(0, numberOr(body.deposit_required)),
          created_by: createdBy,
        }).select("*").single();
        if (error) throw error;
        const payload = normalized.map((item: any, position: number) => ({ estimate_id: estimate.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, total: item.quantity * item.unit_price, position }));
        const { error: itemError } = await admin.from("estimate_line_items").insert(payload);
        if (itemError) { await admin.from("estimates").delete().eq("id", estimate.id); throw itemError; }
        return json({ data: { ...estimate, items: payload } }, 201);
      }
    }

    if (path === "/v1/invoices") {
      if (req.method === "GET") {
        requireScope(actor, "read");
        const { data, error } = await admin.from("invoices").select("id,customer_id,estimate_id,job_id,number,status,issue_date,due_date,subtotal,tax_rate,tax_amount,total,amount_paid,notes,terms,created_at,updated_at,customers(name,email,phone)").eq("organization_id", actor.organizationId).order("created_at", { ascending: false }).limit(200);
        if (error) throw error;
        return json({ data });
      }
      if (req.method === "POST") {
        requireScope(actor, "write");
        const items = Array.isArray(body.items) ? body.items : [];
        if (!clean(body.customer_id)) return json({ error: "customer_id is required" }, 400);
        if (!items.length) return json({ error: "items[] is required" }, 400);
        const normalized = items.map((item: any) => ({ description: clean(item.description), quantity: Math.max(0, numberOr(item.quantity, 1)), unit_price: Math.max(0, numberOr(item.unit_price, 0)) })).filter((item: any) => item.description);
        const subtotal = normalized.reduce((sum: number, item: any) => sum + item.quantity * item.unit_price, 0);
        const taxRate = Math.max(0, numberOr(body.tax_rate, 0));
        const taxAmount = subtotal * taxRate / 100;
        const total = subtotal + taxAmount;
        const createdBy = await effectiveUserId(actor);
        const now = new Date();
        const number = clean(body.number) || `INV-${now.getTime().toString().slice(-8)}`;
        const { data: invoice, error } = await admin.from("invoices").insert({
          organization_id: actor.organizationId,
          customer_id: clean(body.customer_id),
          estimate_id: clean(body.estimate_id) || null,
          job_id: clean(body.job_id) || null,
          number,
          status: clean(body.status) || "draft",
          issue_date: clean(body.issue_date) || now.toISOString().slice(0,10),
          due_date: clean(body.due_date) || null,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          amount_paid: Math.max(0, numberOr(body.amount_paid, 0)),
          notes: clean(body.notes) || null,
          terms: clean(body.terms) || null,
          created_by: createdBy,
        }).select("*").single();
        if (error) throw error;
        const payload = normalized.map((item: any, position: number) => ({ invoice_id: invoice.id, description: item.description, quantity: item.quantity, unit_price: item.unit_price, total: item.quantity * item.unit_price, position }));
        const { error: itemError } = await admin.from("invoice_line_items").insert(payload);
        if (itemError) { await admin.from("invoices").delete().eq("id", invoice.id); throw itemError; }
        return json({ data: { ...invoice, items: payload } }, 201);
      }
    }

    if (path === "/v1/time/clock-in" && req.method === "POST") {
      requireScope(actor, "write");
      if (!actor.userId) return json({ error: "Clock-in requires a signed-in user" }, 400);
      const jobId = clean(body.job_id);
      if (!jobId) return json({ error: "job_id is required" }, 400);
      const { data: openEntries, error: openError } = await admin.from("time_entries").select("id,job_id,clock_in").eq("organization_id", actor.organizationId).eq("user_id", actor.userId).is("clock_out", null).limit(1);
      if (openError) throw openError;
      if (openEntries?.length) return json({ error: "Already clocked in" }, 409);
      const { data, error } = await admin.from("time_entries").insert({
        organization_id: actor.organizationId,
        job_id: jobId,
        user_id: actor.userId,
        clock_in: new Date().toISOString(),
        clock_in_lat: body.latitude == null ? null : numberOr(body.latitude),
        clock_in_lng: body.longitude == null ? null : numberOr(body.longitude),
        note: clean(body.note) || null,
        status: "pending",
      }).select("*").single();
      if (error) throw error;
      return json({ data }, 201);
    }

    if (path === "/v1/time/clock-out" && req.method === "POST") {
      requireScope(actor, "write");
      if (!actor.userId) return json({ error: "Clock-out requires a signed-in user" }, 400);
      const { data: entries, error: lookupError } = await admin.from("time_entries").select("id,job_id,clock_in").eq("organization_id", actor.organizationId).eq("user_id", actor.userId).is("clock_out", null).order("clock_in", { ascending: false }).limit(1);
      if (lookupError) throw lookupError;
      const entry = entries?.[0];
      if (!entry) return json({ error: "No open clock-in found" }, 404);
      const { data, error } = await admin.from("time_entries").update({
        clock_out: new Date().toISOString(),
        clock_out_lat: body.latitude == null ? null : numberOr(body.latitude),
        clock_out_lng: body.longitude == null ? null : numberOr(body.longitude),
        note: clean(body.note) || null,
      }).eq("id", entry.id).select("*").single();
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Not found" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("fasttract-api error", error);
    return json({ error: message }, status);
  }
});
