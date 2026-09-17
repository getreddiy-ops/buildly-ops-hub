import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const clean = (v: unknown) => typeof v === "string" ? v.trim() : "";

async function requireMember(req: Request, organizationId: string) {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) throw new Error("Unauthorized");

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Unauthorized");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: member, error } = await admin
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!member) throw new Error("Forbidden");

  return { admin, user: userData.user, role: member.role as string };
}

async function findCustomer(admin: any, organizationId: string, name: string) {
  const { data, error } = await admin
    .from("customers")
    .select("id,name,email,phone,address")
    .eq("organization_id", organizationId)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: fuzzy, error: fuzzyError } = await admin
    .from("customers")
    .select("id,name,email,phone,address")
    .eq("organization_id", organizationId)
    .ilike("name", `%${name}%`)
    .limit(1)
    .maybeSingle();
  if (fuzzyError) throw fuzzyError;
  if (!fuzzy) throw new Error(`Customer \"${name}\" was not found in FastTract`);
  return fuzzy;
}

async function findJob(admin: any, organizationId: string, title: string) {
  const { data, error } = await admin
    .from("jobs")
    .select("id,title,status,customer_id")
    .eq("organization_id", organizationId)
    .ilike("title", title)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: fuzzy, error: fuzzyError } = await admin
    .from("jobs")
    .select("id,title,status,customer_id")
    .eq("organization_id", organizationId)
    .ilike("title", `%${title}%`)
    .limit(1)
    .maybeSingle();
  if (fuzzyError) throw fuzzyError;
  if (!fuzzy) throw new Error(`Job \"${title}\" was not found in FastTract`);
  return fuzzy;
}

async function createCustomer(admin: any, organizationId: string, name: string) {
  const { data, error } = await admin
    .from("customers")
    .insert({ organization_id: organizationId, name })
    .select("id,name")
    .single();
  if (error) throw error;
  return { action: "create_customer", message: `Created customer ${data.name}.`, result: data };
}

async function createJob(admin: any, organizationId: string, userId: string, title: string, customerName: string) {
  const customer = await findCustomer(admin, organizationId, customerName);
  const { data, error } = await admin
    .from("jobs")
    .insert({
      organization_id: organizationId,
      customer_id: customer.id,
      title,
      status: "scheduled",
      created_by: userId,
    })
    .select("id,title,status")
    .single();
  if (error) throw error;
  return { action: "create_job", message: `Created job ${data.title} for ${customer.name}.`, result: data };
}

async function clockIn(admin: any, organizationId: string, userId: string, jobTitle: string) {
  const job = await findJob(admin, organizationId, jobTitle);
  const { data: open, error: openError } = await admin
    .from("time_entries")
    .select("id,job_id,clock_in")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("clock_out", null)
    .maybeSingle();
  if (openError) throw openError;
  if (open) throw new Error("You are already clocked in. Clock out before starting another job.");

  const { data, error } = await admin
    .from("time_entries")
    .insert({
      organization_id: organizationId,
      job_id: job.id,
      user_id: userId,
      clock_in: new Date().toISOString(),
      status: "pending",
    })
    .select("id,clock_in")
    .single();
  if (error) throw error;
  return { action: "clock_in", message: `Clocked into ${job.title}.`, result: data };
}

async function clockOut(admin: any, organizationId: string, userId: string, jobTitle?: string) {
  let query = admin
    .from("time_entries")
    .select("id,job_id,clock_in,jobs(title)")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);

  const { data: entries, error } = await query;
  if (error) throw error;
  const entry = entries?.[0];
  if (!entry) throw new Error("No open clock-in was found.");

  if (jobTitle) {
    const currentTitle = String(entry.jobs?.title ?? "");
    if (currentTitle && !currentTitle.toLowerCase().includes(jobTitle.toLowerCase())) {
      throw new Error(`You are currently clocked into ${currentTitle}, not ${jobTitle}.`);
    }
  }

  const clockOutAt = new Date();
  const minutes = Math.max(0, Math.round((clockOutAt.getTime() - Date.parse(entry.clock_in)) / 60000));
  const { error: updateError } = await admin
    .from("time_entries")
    .update({ clock_out: clockOutAt.toISOString() })
    .eq("id", entry.id);
  if (updateError) throw updateError;

  return {
    action: "clock_out",
    message: `Clocked out${entry.jobs?.title ? ` of ${entry.jobs.title}` : ""} — ${(minutes / 60).toFixed(2)} hours.`,
    result: { id: entry.id, minutes, hours: minutes / 60 },
  };
}

async function createEstimate(admin: any, organizationId: string, userId: string, customerName: string, amount: number, description: string) {
  const customer = await findCustomer(admin, organizationId, customerName);
  const { data: estimate, error } = await admin
    .from("estimates")
    .insert({
      organization_id: organizationId,
      customer_id: customer.id,
      title: description,
      status: "draft",
      subtotal: amount,
      tax: 0,
      total: amount,
      created_by: userId,
    })
    .select("id,title,total")
    .single();
  if (error) throw error;

  const { error: itemError } = await admin.from("estimate_line_items").insert({
    estimate_id: estimate.id,
    description,
    quantity: 1,
    unit_price: amount,
    total: amount,
    position: 0,
  });
  if (itemError) {
    await admin.from("estimates").delete().eq("id", estimate.id);
    throw itemError;
  }

  return {
    action: "create_estimate",
    message: `Created a $${amount.toFixed(2)} draft estimate for ${customer.name}.`,
    result: estimate,
  };
}

async function createInvoice(admin: any, organizationId: string, userId: string, customerName: string, amount: number, description: string) {
  const customer = await findCustomer(admin, organizationId, customerName);
  const now = new Date();
  const issueDate = now.toISOString().slice(0, 10);
  const due = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const number = `INV-${now.getTime().toString().slice(-8)}`;

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      organization_id: organizationId,
      customer_id: customer.id,
      number,
      status: "draft",
      issue_date: issueDate,
      due_date: due,
      subtotal: amount,
      tax_rate: 0,
      tax_amount: 0,
      total: amount,
      amount_paid: 0,
      created_by: userId,
    })
    .select("id,number,total")
    .single();
  if (error) throw error;

  const { error: itemError } = await admin.from("invoice_line_items").insert({
    invoice_id: invoice.id,
    description,
    quantity: 1,
    unit_price: amount,
    total: amount,
    position: 0,
  });
  if (itemError) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    throw itemError;
  }

  return {
    action: "create_invoice",
    message: `Created invoice ${number} for ${customer.name} for $${amount.toFixed(2)}.`,
    result: invoice,
  };
}

async function markInvoicePaid(admin: any, organizationId: string, number: string) {
  const { data: invoice, error } = await admin
    .from("invoices")
    .select("id,number,total")
    .eq("organization_id", organizationId)
    .ilike("number", number)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!invoice) throw new Error(`Invoice ${number} was not found.`);

  const { error: updateError } = await admin
    .from("invoices")
    .update({ status: "paid", amount_paid: invoice.total })
    .eq("id", invoice.id);
  if (updateError) throw updateError;
  return { action: "mark_invoice_paid", message: `Marked invoice ${invoice.number} paid.`, result: invoice };
}

async function runCommand(admin: any, organizationId: string, userId: string, raw: string) {
  const command = raw.trim();
  let match: RegExpMatchArray | null;

  match = command.match(/^create\s+(?:a\s+)?customer(?:\s+named)?\s+(.+)$/i);
  if (match) return createCustomer(admin, organizationId, match[1].trim());

  match = command.match(/^create\s+(?:a\s+)?job\s+(.+?)\s+for\s+(.+)$/i);
  if (match) return createJob(admin, organizationId, userId, match[1].trim(), match[2].trim());

  match = command.match(/^clock\s+me\s+in(?:to)?\s+(.+)$/i);
  if (match) return clockIn(admin, organizationId, userId, match[1].trim());

  match = command.match(/^clock\s+me\s+out(?:\s+of\s+(.+))?$/i);
  if (match) return clockOut(admin, organizationId, userId, match[1]?.trim());

  match = command.match(/^create\s+(?:an?\s+)?estimate\s+for\s+(.+?)\s+for\s+\$?([\d,]+(?:\.\d{1,2})?)(?:\s+(.+))?$/i);
  if (match) {
    const amount = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Estimate amount must be greater than zero.");
    return createEstimate(admin, organizationId, userId, match[1].trim(), amount, clean(match[3]) || "Estimate");
  }

  match = command.match(/^create\s+(?:an?\s+)?invoice\s+for\s+(.+?)\s+for\s+\$?([\d,]+(?:\.\d{1,2})?)(?:\s+(.+))?$/i);
  if (match) {
    const amount = Number(match[2].replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invoice amount must be greater than zero.");
    return createInvoice(admin, organizationId, userId, match[1].trim(), amount, clean(match[3]) || "Invoice");
  }

  match = command.match(/^mark\s+invoice\s+([A-Za-z0-9_-]+)\s+paid$/i);
  if (match) return markInvoicePaid(admin, organizationId, match[1]);

  throw new Error(
    "Command not recognized. Try: create customer named Jane Doe; create job Smith driveway for Jane Doe; clock me into Smith driveway; create estimate for Jane Doe for $8200 concrete sidewalk; create invoice for Jane Doe for $1200 repair; mark invoice INV-123 paid.",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const body = await req.json();
    const organizationId = clean(body.organizationId ?? body.organization_id);
    const command = clean(body.command);
    if (!organizationId || !command) return json(400, { error: "organizationId and command are required" });

    const { admin, user } = await requireMember(req, organizationId);
    const result = await runCommand(admin, organizationId, user.id, command);
    return json(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    console.error("fasttract-command error", error);
    return json(status, { error: message });
  }
});
