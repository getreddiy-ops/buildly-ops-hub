import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://services.leadconnectorhq.com";
const TOKEN = Deno.env.get("GHL_API_TOKEN") ?? Deno.env.get("GHL_API_TOKEn");
const LOCATION_ID = Deno.env.get("GHL_LOCATION_ID") ?? Deno.env.get("ghl_location_id");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

if (!TOKEN) throw new Error("GHL_API_TOKEN is required");
if (!LOCATION_ID) throw new Error("GHL_LOCATION_ID is required");

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const str = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;
const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

async function ghl(path: string, init: RequestInit = {}, version = "v3") {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: version,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data?.message || data?.error || `GHL request failed (${r.status})`);
  return data;
}

async function requireMember(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) throw new Error("Unauthorized");
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member } = await admin.from("organization_members")
    .select("role").eq("organization_id", organizationId).eq("user_id", userData.user.id).maybeSingle();
  if (!member) throw new Error("Forbidden");
  return userData.user;
}

async function findContact(name: string) {
  const u = new URL(`${API}/contacts/`);
  u.searchParams.set("locationId", LOCATION_ID!);
  u.searchParams.set("query", name);
  u.searchParams.set("limit", "20");
  const p = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}`, Version: "v3", Accept: "application/json" } }).then(async r => {
    const d = await r.json(); if (!r.ok) throw new Error(d?.message || `Contact search failed (${r.status})`); return d;
  });
  const list = Array.isArray(p.contacts) ? p.contacts : [];
  const exact = list.find((c: any) => String(c.name || `${c.firstName || ""} ${c.lastName || ""}`).trim().toLowerCase() === name.toLowerCase());
  const c = exact ?? list[0];
  if (!c?.id) throw new Error(`Customer \"${name}\" not found in GHL`);
  return c;
}

async function findJob(query: string) {
  const u = new URL(`${API}/opportunities/search`);
  u.searchParams.set("locationId", LOCATION_ID!);
  u.searchParams.set("q", query);
  u.searchParams.set("limit", "20");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}`, Version: "v3", Accept: "application/json" } });
  const p = await r.json();
  if (!r.ok) throw new Error(p?.message || `Job search failed (${r.status})`);
  const list = p.opportunities ?? [];
  const exact = list.find((o: any) => String(o.name || "").trim().toLowerCase() === query.toLowerCase());
  const o = exact ?? list[0];
  if (!o?.id) throw new Error(`Job \"${query}\" not found in GHL`);
  return o;
}

async function locationDetails() {
  const p = await ghl(`/locations/${encodeURIComponent(LOCATION_ID!)}`);
  return rec(p) && rec(p.location) ? p.location : p;
}

async function senderUserId() {
  const loc: any = await locationDetails();
  const companyId = str(loc?.companyId);
  if (!companyId) throw new Error("GHL companyId unavailable");
  const u = new URL(`${API}/users/search`);
  u.searchParams.set("companyId", companyId);
  u.searchParams.set("locationId", LOCATION_ID!);
  u.searchParams.set("limit", "1");
  const r = await fetch(u, { headers: { Authorization: `Bearer ${TOKEN}`, Version: "v3", Accept: "application/json" } });
  const p = await r.json();
  const id = p?.users?.[0]?.id;
  if (!r.ok || !id) throw new Error("No GHL user found for sending");
  return id;
}

function businessDetails(loc: any) {
  return {
    name: str(loc?.name) ?? "Business",
    logoUrl: str(loc?.logoUrl) ?? undefined,
    phoneNo: str(loc?.phone) ?? undefined,
    website: str(loc?.website) ?? undefined,
    address: {
      addressLine1: str(loc?.address) ?? "",
      city: str(loc?.city) ?? "",
      state: str(loc?.state) ?? "",
      countryCode: str(loc?.country) ?? "US",
      postalCode: str(loc?.postalCode) ?? "",
    },
  };
}

function contactDetails(c: any) {
  const fallbackName = [str(c.firstName), str(c.lastName)].filter(Boolean).join(" ") || "Customer";
  return {
    id: c.id,
    name: str(c.name) ?? fallbackName,
    phoneNo: str(c.phone) ?? undefined,
    email: str(c.email) ?? undefined,
    companyName: str(c.companyName) ?? undefined,
    address: {
      addressLine1: str(c.address1) ?? "",
      city: str(c.city) ?? "",
      state: str(c.state) ?? "",
      countryCode: str(c.country) ?? "US",
      postalCode: str(c.postalCode) ?? "",
    },
  };
}

async function addNote(contactId: string, body: string, title: string) {
  return ghl(`/contacts/${encodeURIComponent(contactId)}/notes`, {
    method: "POST",
    body: JSON.stringify({ userId: await senderUserId(), body, title, pinned: false }),
  });
}

async function runCommand(commandRaw: string) {
  const command = commandRaw.trim();
  let m: RegExpMatchArray | null;

  m = command.match(/^create\s+(?:a\s+)?customer(?:\s+named)?\s+(.+)$/i);
  if (m) {
    const name = m[1].trim();
    const result = await ghl("/contacts/", { method: "POST", body: JSON.stringify({ locationId: LOCATION_ID, name, source: "FastTract Command Center" }) });
    return { action: "create_customer", message: `Created customer ${name} in GHL.`, result };
  }

  m = command.match(/^clock\s+(?:me|(.+?))\s+in(?:to)?\s+(.+)$/i);
  if (m) {
    const employee = (m[1] || "Morgan").trim();
    const job = await findJob(m[2].trim());
    if (!job.contactId) throw new Error("That GHL job has no contact attached");
    const now = new Date().toISOString();
    await addNote(job.contactId, ["GHL_TIME_CLOCK", "IN", employee, job.id, now, job.name || "Job"].join("|"), `Clock in — ${employee}`);
    return { action: "clock_in", message: `${employee} clocked into ${job.name || m[2]} at ${now}.`, result: { jobId: job.id, employee, clockedInAt: now } };
  }

  m = command.match(/^clock\s+(?:me|(.+?))\s+out(?:\s+of)?\s+(.+)$/i);
  if (m) {
    const employee = (m[1] || "Morgan").trim();
    const job = await findJob(m[2].trim());
    if (!job.contactId) throw new Error("That GHL job has no contact attached");
    const notes = await ghl(`/contacts/${encodeURIComponent(job.contactId)}/notes`);
    const rows = Array.isArray(notes?.notes) ? notes.notes : [];
    const parts = rows.map((n: any) => String(n.body || "").split("|")).filter((p: string[]) => p[0] === "GHL_TIME_CLOCK" && p[2] === employee && p[3] === job.id);
    const closed = new Set(parts.filter((p: string[]) => p[1] === "OUT").map((p: string[]) => p[4]));
    const open = parts.filter((p: string[]) => p[1] === "IN" && !closed.has(p[4])).sort((a: string[], b: string[]) => String(b[4]).localeCompare(String(a[4])))[0];
    if (!open) throw new Error(`No open clock-in found for ${employee} on ${job.name || m[2]}`);
    const end = new Date().toISOString();
    const mins = Math.max(0, Math.round((Date.parse(end) - Date.parse(open[4])) / 60000));
    await addNote(job.contactId, ["GHL_TIME_CLOCK", "OUT", employee, job.id, open[4], end, String(mins), job.name || "Job"].join("|"), `Clock out — ${employee}`);
    return { action: "clock_out", message: `${employee} clocked out of ${job.name || m[2]} — ${(mins / 60).toFixed(2)} hours.`, result: { minutes: mins, hours: mins / 60 } };
  }

  m = command.match(/^create\s+(?:an?\s+)?(estimate|invoice)\s+for\s+(.+?)\s+for\s+\$?([\d,]+(?:\.\d{1,2})?)(?:\s+(.+))?$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const customerName = m[2].trim();
    const amount = Number(m[3].replace(/,/g, ""));
    const description = (m[4] || (kind === "estimate" ? "Estimate" : "Invoice")).trim();
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Invalid amount");
    const [c, loc] = await Promise.all([findContact(customerName), locationDetails()]);
    const cd = contactDetails(c);
    const bd = businessDetails(loc);
    const now = new Date();
    const base: any = {
      altId: LOCATION_ID,
      altType: "location",
      name: description,
      businessDetails: bd,
      currency: "USD",
      items: [{ name: description, description, currency: "USD", amount, qty: 1, taxes: [], type: "one_time", taxInclusive: false }],
      liveMode: true,
      discount: { type: "percentage", value: 0 },
      termsNotes: "Created by FastTract Command Center",
      title: kind === "estimate" ? "ESTIMATE" : "INVOICE",
      contactDetails: cd,
      issueDate: now.toISOString().slice(0, 10),
      sentTo: { email: cd.email ? [cd.email] : [], phoneNo: cd.phoneNo ? [cd.phoneNo] : [] },
      automaticTaxesEnabled: false,
    };
    let result;
    if (kind === "estimate") {
      base.expiryDate = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      base.frequencySettings = { enabled: false };
      base.estimateNumberPrefix = "EST-";
      base.autoInvoice = { enabled: false, directPayments: false };
      result = await ghl("/invoices/estimate", { method: "POST", body: JSON.stringify(base) });
    } else {
      base.dueDate = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
      base.invoiceNumberPrefix = "INV-";
      result = await ghl("/invoices/", { method: "POST", body: JSON.stringify(base) });
    }
    return { action: `create_${kind}`, message: `Created ${kind} for ${customerName} for $${amount.toFixed(2)} in GHL.`, result };
  }

  m = command.match(/^send\s+(estimate|invoice)\s+([A-Za-z0-9_-]+)(?:\s+by\s+(email|sms|both))?$/i);
  if (m) {
    const kind = m[1].toLowerCase();
    const id = m[2];
    const by = (m[3] || "both").toLowerCase();
    const action = by === "email" ? "email" : by === "sms" ? "sms" : "sms_and_email";
    const path = kind === "estimate" ? `/invoices/estimate/${encodeURIComponent(id)}/send` : `/invoices/${encodeURIComponent(id)}/send`;
    const body: any = { altId: LOCATION_ID, altType: "location", action, liveMode: true, userId: await senderUserId() };
    if (kind === "estimate") body.estimateName = "Estimate";
    const result = await ghl(path, { method: "POST", body: JSON.stringify(body) });
    return { action: `send_${kind}`, message: `Sent ${kind} ${id} via ${action}.`, result };
  }

  m = command.match(/^(text|email)\s+(.+?):\s*(.+)$/i);
  if (m) {
    const type = m[1].toLowerCase() === "email" ? "Email" : "SMS";
    const c = await findContact(m[2].trim());
    const message = m[3].trim();
    const body: any = { type, contactId: c.id, message };
    if (type === "Email") body.html = message;
    const result = await ghl("/conversations/messages", { method: "POST", body: JSON.stringify(body) });
    return { action: "send_message", message: `${type} sent to ${m[2].trim()}.`, result };
  }

  throw new Error("Command not recognized. Try: create customer named Jane Doe; clock me into Smith driveway; create invoice for Jane Doe for $1200 concrete repair; send invoice INVOICE_ID; text Jane Doe: On my way.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = await req.json();
    const organizationId = str(body.organizationId);
    const command = str(body.command);
    if (!organizationId || !command) return json(400, { error: "organizationId and command are required" });
    await requireMember(req, organizationId);
    const result = await runCommand(command);
    return json(200, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("ghl-command error", e);
    return json(status, { error: message });
  }
});
