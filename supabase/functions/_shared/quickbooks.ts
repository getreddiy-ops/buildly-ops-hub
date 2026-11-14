// QuickBooks Online client for FastTract: OAuth tokens (refreshed as needed), API calls, and the
// find-or-create helpers the sync uses. Matches between FastTract and QuickBooks records live in
// quickbooks_sync_log (entity_type, local_id → quickbooks_id), which the live database already has.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { apiBase } from "./quickbooks-map.ts";

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const MINOR_VERSION = "75";

export function qbConfig() {
  const clientId = Deno.env.get("QUICKBOOKS_CLIENT_ID");
  const clientSecret = Deno.env.get("QUICKBOOKS_CLIENT_SECRET");
  const redirectUri = Deno.env.get("QUICKBOOKS_REDIRECT_URI")
    ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/quickbooks-callback`;
  const env = Deno.env.get("QUICKBOOKS_ENV") === "sandbox" ? "sandbox" : "production";
  if (!clientId || !clientSecret) throw new Error("QuickBooks is not set up for FastTract yet (QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET)");
  return { clientId, clientSecret, redirectUri, env };
}

const basic = (id: string, secret: string) => `Basic ${btoa(`${id}:${secret}`)}`;

export async function exchangeToken(params: Record<string, string>) {
  const { clientId, clientSecret } = qbConfig();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`QuickBooks sign-in failed (${res.status}): ${data.error_description ?? data.error ?? "unknown error"}`);
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

export async function revokeToken(token: string) {
  const { clientId, clientSecret } = qbConfig();
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { Authorization: basic(clientId, clientSecret), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token }),
  }).catch(() => undefined);
}

export interface QbConnection { organization_id: string; realm_id: string; access_token: string; refresh_token: string; token_expires_at: string; environment: string }

/** The business's connection with a fresh access token (refreshing and saving the rotated refresh token). */
export async function getConnection(admin: SupabaseClient, organizationId: string): Promise<QbConnection | null> {
  const { data } = await admin.from("quickbooks_connections").select("organization_id, realm_id, access_token, refresh_token, token_expires_at, environment").eq("organization_id", organizationId).maybeSingle();
  if (!data) return null;
  const conn = data as QbConnection;
  if (new Date(conn.token_expires_at).getTime() - Date.now() > 5 * 60_000) return conn;
  const t = await exchangeToken({ grant_type: "refresh_token", refresh_token: conn.refresh_token });
  const updated = { access_token: t.access_token, refresh_token: t.refresh_token, token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() };
  const { error } = await admin.from("quickbooks_connections").update(updated).eq("organization_id", organizationId);
  if (error) throw error;
  return { ...conn, ...updated };
}

export class QbError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function qb(conn: QbConnection, method: "GET" | "POST", path: string, body?: unknown, query: Record<string, string> = {}) {
  const url = new URL(`${apiBase(conn.environment)}/v3/company/${conn.realm_id}/${path}`);
  url.searchParams.set("minorversion", MINOR_VERSION);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${conn.access_token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fault = data?.Fault?.Error?.[0];
    throw new QbError(res.status, fault ? `${fault.Message}${fault.Detail ? `: ${fault.Detail}` : ""}` : `QuickBooks error ${res.status}`);
  }
  return data;
}

export async function qbQuery(conn: QbConnection, sql: string): Promise<any> {
  return (await qb(conn, "GET", "query", undefined, { query: sql })).QueryResponse ?? {};
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** Last QuickBooks id recorded for a FastTract record, if any. */
export async function mappedId(admin: SupabaseClient, organizationId: string, entity: string, localId: string): Promise<string | null> {
  const { data } = await admin.from("quickbooks_sync_log").select("quickbooks_id")
    .eq("organization_id", organizationId).eq("entity_type", entity).eq("local_id", localId)
    .eq("status", "success").not("quickbooks_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { quickbooks_id: string } | null)?.quickbooks_id ?? null;
}

export async function logSync(admin: SupabaseClient, row: { organization_id: string; entity_type: string; local_id: string | null; quickbooks_id?: string | null; status: "success" | "error" | "skipped"; error?: string | null }) {
  await admin.from("quickbooks_sync_log").insert({ direction: "push", quickbooks_id: null, error: null, ...row });
}

/** The service item every FastTract line is booked to. Uses an existing "FastTract Services" item or creates one. */
export async function ensureItem(conn: QbConnection): Promise<string> {
  const found = await qbQuery(conn, "select Id from Item where Name = 'FastTract Services'");
  if (found.Item?.[0]?.Id) return found.Item[0].Id;
  const income = await qbQuery(conn, "select Id, Name from Account where AccountType = 'Income' and Active = true");
  const account = (income.Account ?? []).find((a: any) => /service|sales/i.test(a.Name)) ?? income.Account?.[0];
  if (!account) throw new Error("QuickBooks has no active Income account to book FastTract invoices to");
  const created = await qb(conn, "POST", "item", { Name: "FastTract Services", Type: "Service", IncomeAccountRef: { value: account.Id } });
  return created.Item.Id;
}

export { esc as escapeQuery };
