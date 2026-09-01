/* eslint-disable @typescript-eslint/no-explicit-any */
import { createDecipheriv, createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  decryptHighLevelCredential,
  encryptHighLevelCredential,
} from "./_credential-crypto";

const HIGHLEVEL_BASE_URL = "https://services.leadconnectorhq.com";
const HIGHLEVEL_API_VERSION = "v3";
const TOKEN_REFRESH_WINDOW_MS = 60_000;

export const FASTTRACT_PIPELINE_NAME = "FastTract Sales";
export const FASTTRACT_CUSTOMER_TAG = "fasttract-customer";
export const FASTTRACT_LEAD_TAG = "fasttract-lead";
export const FASTTRACT_HIDDEN_TAG = "fasttract-hidden";

export class HighLevelApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HighLevelApiError";
    this.statusCode = statusCode;
  }
}

function highLevelPublicMessage(statusCode: number) {
  if (statusCode === 400) return "HighLevel rejected that request. Review the details and try again.";
  if (statusCode === 401) return "FastTract needs to reconnect this HighLevel sub-account.";
  if (statusCode === 403) return "FastTract does not have permission to complete that action in HighLevel.";
  if (statusCode === 404) return "That HighLevel record could not be found in this sub-account.";
  if (statusCode === 409 || statusCode === 422) return "HighLevel could not save that change. Review the details and try again.";
  if (statusCode === 429) return "HighLevel is temporarily busy. Try again in a moment.";
  if (statusCode >= 500) return "HighLevel is temporarily unavailable. FastTract did not save any changes.";
  return "FastTract could not complete that HighLevel action.";
}

export type HighLevelRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
  apiVersion?: string;
};

export type HighLevelPipelineStage = {
  id: string;
  name: string;
  position?: number;
};

export type HighLevelPipeline = {
  id: string;
  name: string;
  stages: HighLevelPipelineStage[];
};

export type HighLevelUserContext = {
  userId: string;
  companyId: string;
  role?: string;
  type?: string;
  activeLocation?: string;
  userName?: string;
  email?: string;
  isAgencyOwner?: boolean;
  versionId?: string;
  appStatus?: string;
};

export type HighLevelConnection = {
  locationId: string;
  companyId?: string;
  userId?: string;
  token: string;
  context?: HighLevelUserContext;
  mode: "embedded" | "single_location";
};

type StoredHighLevelConnectionRow = {
  id: string;
  organization_id?: string | null;
  connection_key: string;
  company_id?: string | null;
  location_id?: string | null;
  ghl_user_id?: string | null;
  user_type: string;
  access_token: string;
  refresh_token: string;
  refresh_token_id?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_at: string;
  credential_version?: number | null;
  credentials_encrypted_at?: string | null;
  installed_at?: string;
  updated_at?: string;
};

type StoredHighLevelConnection = StoredHighLevelConnectionRow & {
  _storedAccessToken: string;
  _storedRefreshToken: string;
  _needsEncryption: boolean;
};

type HighLevelTokenResponse = {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  token_type?: string;
  tokenType?: string;
  expires_in?: number;
  expiresIn?: number;
  scope?: string;
  user_type?: string;
  userType?: string;
  company_id?: string;
  companyId?: string;
  location_id?: string;
  locationId?: string;
  user_id?: string;
  userId?: string;
  refresh_token_id?: string;
  refreshTokenId?: string;
};

let adminClient: SupabaseClient | null = null;
const connectionByToken = new Map<string, StoredHighLevelConnection>();
const replacementTokenByToken = new Map<string, string>();
const refreshByConnectionId = new Map<string, Promise<StoredHighLevelConnection>>();

function normalizeBase64(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
}

function evpBytesToKey(password: Buffer, salt: Buffer) {
  let material = Buffer.alloc(0);
  let previous = Buffer.alloc(0);

  while (material.length < 48) {
    const hash = createHash("md5");
    hash.update(previous);
    hash.update(password);
    hash.update(salt);
    previous = hash.digest();
    material = Buffer.concat([material, previous]);
  }

  return {
    key: material.subarray(0, 32),
    iv: material.subarray(32, 48),
  };
}

export function decryptHighLevelUserContext(
  encryptedData: string,
  sharedSecret: string,
): HighLevelUserContext {
  const encrypted = Buffer.from(normalizeBase64(encryptedData), "base64");
  const marker = encrypted.subarray(0, 8).toString("utf8");
  if (marker !== "Salted__" || encrypted.length <= 16) {
    throw new Error("Invalid HighLevel user context payload");
  }

  const salt = encrypted.subarray(8, 16);
  const ciphertext = encrypted.subarray(16);
  const { key, iv } = evpBytesToKey(Buffer.from(sharedSecret, "utf8"), salt);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");

  const parsed = JSON.parse(decrypted) as HighLevelUserContext;
  if (!parsed?.userId || !parsed?.companyId) {
    throw new Error("HighLevel user context is missing required identity fields");
  }
  return parsed;
}

function readHeader(req: any, name: string): string | null {
  const direct = req?.headers?.[name.toLowerCase()];
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (Array.isArray(direct) && typeof direct[0] === "string") return direct[0].trim();
  return null;
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function credentialEncryptionKey() {
  return requiredEnvironment("GHL_TOKEN_ENCRYPTION_KEY");
}

function getAdminClient() {
  if (!adminClient) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured");
    adminClient = createClient(
      supabaseUrl,
      requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return adminClient;
}

function expiresAt(expiresIn?: number) {
  return new Date(Date.now() + Math.max(0, expiresIn ?? 86_400) * 1000).toISOString();
}

function tokenValue(payload: HighLevelTokenResponse) {
  return payload.access_token ?? payload.accessToken;
}

function refreshTokenValue(payload: HighLevelTokenResponse) {
  return payload.refresh_token ?? payload.refreshToken;
}

function expirationValue(payload: HighLevelTokenResponse) {
  return payload.expires_in ?? payload.expiresIn;
}

function tokenTypeValue(payload: HighLevelTokenResponse) {
  return payload.token_type ?? payload.tokenType ?? "Bearer";
}

function companyIdValue(payload: HighLevelTokenResponse) {
  return payload.company_id ?? payload.companyId;
}

function locationIdValue(payload: HighLevelTokenResponse) {
  return payload.location_id ?? payload.locationId;
}

function userIdValue(payload: HighLevelTokenResponse) {
  return payload.user_id ?? payload.userId;
}

function refreshTokenIdValue(payload: HighLevelTokenResponse) {
  return payload.refresh_token_id ?? payload.refreshTokenId;
}

function userTypeValue(payload: HighLevelTokenResponse) {
  return payload.user_type ?? payload.userType;
}

function decodeStoredConnection(row: StoredHighLevelConnectionRow): StoredHighLevelConnection {
  const key = credentialEncryptionKey();
  const access = decryptHighLevelCredential(row.access_token, key);
  const refresh = decryptHighLevelCredential(row.refresh_token, key);

  return {
    ...row,
    access_token: access.value,
    refresh_token: refresh.value,
    _storedAccessToken: row.access_token,
    _storedRefreshToken: row.refresh_token,
    _needsEncryption: !access.encrypted || !refresh.encrypted,
  };
}

function encryptedCredentials(accessToken: string, refreshToken: string) {
  const key = credentialEncryptionKey();
  const now = new Date().toISOString();
  return {
    access_token: encryptHighLevelCredential(accessToken, key),
    refresh_token: encryptHighLevelCredential(refreshToken, key),
    credential_version: 1,
    credentials_encrypted_at: now,
  };
}

async function loadConnectionById(id: string) {
  const { data, error } = await getAdminClient()
    .from("ghl_connections")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    throw new Error(`Could not reload HighLevel credentials: ${error?.message ?? "unknown error"}`);
  }
  return decodeStoredConnection(data as StoredHighLevelConnectionRow);
}

async function secureLegacyCredentials(connection: StoredHighLevelConnection) {
  if (!connection._needsEncryption) return connection;

  const now = new Date().toISOString();
  const updates = {
    ...encryptedCredentials(connection.access_token, connection.refresh_token),
    updated_at: now,
  };

  const { data, error } = await getAdminClient()
    .from("ghl_connections")
    .update(updates)
    .eq("id", connection.id)
    .eq("access_token", connection._storedAccessToken)
    .eq("refresh_token", connection._storedRefreshToken)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Could not encrypt stored HighLevel credentials: ${error.message}`);
  }
  if (data) return decodeStoredConnection(data as StoredHighLevelConnectionRow);
  return loadConnectionById(connection.id);
}

function needsRefresh(connection: StoredHighLevelConnection) {
  const expires = Date.parse(connection.expires_at);
  return !Number.isFinite(expires) || expires <= Date.now() + TOKEN_REFRESH_WINDOW_MS;
}

async function performStoredConnectionRefresh(
  connection: StoredHighLevelConnection,
): Promise<StoredHighLevelConnection> {
  const response = await fetch(`${HIGHLEVEL_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Version: HIGHLEVEL_API_VERSION,
    },
    body: new URLSearchParams({
      client_id: requiredEnvironment("GHL_CLIENT_ID"),
      client_secret: requiredEnvironment("GHL_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
      user_type: connection.user_type,
    }),
  });

  const payload = await response.json().catch(() => ({})) as HighLevelTokenResponse;
  const accessToken = tokenValue(payload);
  const nextRefreshToken = refreshTokenValue(payload);

  if (!response.ok || !accessToken || !nextRefreshToken) {
    const current = await loadConnectionById(connection.id).catch(() => null);
    if (
      current
      && current.updated_at !== connection.updated_at
      && !needsRefresh(current)
    ) {
      return current;
    }
    throw new Error(`HighLevel token refresh failed (${response.status})`);
  }

  const now = new Date().toISOString();
  const updates = {
    user_type: userTypeValue(payload) ?? connection.user_type,
    ...encryptedCredentials(accessToken, nextRefreshToken),
    refresh_token_id: refreshTokenIdValue(payload) ?? connection.refresh_token_id ?? null,
    token_type: tokenTypeValue(payload),
    scope: payload.scope ?? connection.scope ?? "",
    company_id: companyIdValue(payload) ?? connection.company_id ?? null,
    location_id: locationIdValue(payload) ?? connection.location_id ?? null,
    ghl_user_id: userIdValue(payload) ?? connection.ghl_user_id ?? null,
    expires_at: expiresAt(expirationValue(payload)),
    updated_at: now,
  };

  let updateQuery = getAdminClient()
    .from("ghl_connections")
    .update(updates)
    .eq("id", connection.id);

  if (connection.updated_at) {
    updateQuery = updateQuery.eq("updated_at", connection.updated_at);
  }

  const { data, error } = await updateQuery.select("*").maybeSingle();
  if (error) {
    throw new Error(`Could not save refreshed HighLevel credentials: ${error.message}`);
  }
  if (data) return decodeStoredConnection(data as StoredHighLevelConnectionRow);
  return loadConnectionById(connection.id);
}

async function refreshStoredConnection(
  connection: StoredHighLevelConnection,
  force = false,
): Promise<StoredHighLevelConnection> {
  const secured = await secureLegacyCredentials(connection);
  if (!force && !needsRefresh(secured)) return secured;

  const existing = refreshByConnectionId.get(secured.id);
  if (existing) return existing;

  const refresh = performStoredConnectionRefresh(secured)
    .finally(() => refreshByConnectionId.delete(secured.id));
  refreshByConnectionId.set(secured.id, refresh);
  return refresh;
}

async function findLocationConnection(locationId: string) {
  const { data, error } = await getAdminClient()
    .from("ghl_connections")
    .select("*")
    .eq("location_id", locationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not read the HighLevel location connection: ${error.message}`);
  if (!data) return null;
  return secureLegacyCredentials(decodeStoredConnection(data as StoredHighLevelConnectionRow));
}

async function findCompanyConnection(companyId: string) {
  const { data, error } = await getAdminClient()
    .from("ghl_connections")
    .select("*")
    .eq("company_id", companyId)
    .in("user_type", ["Company", "company"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Could not read the HighLevel agency connection: ${error.message}`);
  if (!data) return null;
  return secureLegacyCredentials(decodeStoredConnection(data as StoredHighLevelConnectionRow));
}

async function exchangeLocationConnection(
  companyConnection: StoredHighLevelConnection,
  companyId: string,
  locationId: string,
) {
  const response = await fetch(`${HIGHLEVEL_BASE_URL}/oauth/location-token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${companyConnection.access_token}`,
      Version: HIGHLEVEL_API_VERSION,
    },
    body: new URLSearchParams({ companyId, locationId }),
  });

  const payload = await response.json().catch(() => ({})) as HighLevelTokenResponse;
  const accessToken = tokenValue(payload);
  const refreshToken = refreshTokenValue(payload);
  if (!response.ok || !accessToken || !refreshToken) {
    throw new Error(`Unable to create the HighLevel location connection (${response.status})`);
  }

  const now = new Date().toISOString();
  const row = {
    organization_id: companyConnection.organization_id ?? null,
    connection_key: `location:${locationId}`,
    company_id: companyIdValue(payload) ?? companyId,
    location_id: locationIdValue(payload) ?? locationId,
    ghl_user_id: userIdValue(payload) ?? companyConnection.ghl_user_id ?? null,
    user_type: userTypeValue(payload) ?? "Location",
    ...encryptedCredentials(accessToken, refreshToken),
    refresh_token_id: refreshTokenIdValue(payload) ?? null,
    token_type: tokenTypeValue(payload),
    scope: payload.scope ?? companyConnection.scope ?? "",
    expires_at: expiresAt(expirationValue(payload)),
    installed_at: now,
    updated_at: now,
  };

  const { data, error } = await getAdminClient()
    .from("ghl_connections")
    .upsert(row, { onConflict: "connection_key" })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Could not save the HighLevel location connection: ${error?.message ?? "unknown error"}`);
  }
  return decodeStoredConnection(data as StoredHighLevelConnectionRow);
}

function resolveReplacementToken(token: string) {
  let current = token;
  const visited = new Set<string>();
  while (replacementTokenByToken.has(current) && !visited.has(current)) {
    visited.add(current);
    current = replacementTokenByToken.get(current) as string;
  }
  return current;
}

function registerConnection(
  connection: StoredHighLevelConnection,
  aliases: string[] = [],
) {
  connectionByToken.set(connection.access_token, connection);
  for (const alias of aliases) {
    if (!alias || alias === connection.access_token) continue;
    replacementTokenByToken.set(alias, connection.access_token);
    connectionByToken.set(alias, connection);
  }
  return connection.access_token;
}

async function resolveStoredLocationToken(companyId: string, locationId: string) {
  const direct = await findLocationConnection(locationId);
  if (direct) {
    if (direct.company_id && direct.company_id !== companyId) {
      throw new Error("The active HighLevel location does not belong to the authenticated company");
    }
    return registerConnection(await refreshStoredConnection(direct));
  }

  const agency = await findCompanyConnection(companyId);
  if (!agency) {
    throw new Error("FastTract is not installed for this HighLevel sub-account");
  }

  const currentAgency = await refreshStoredConnection(agency);
  return registerConnection(await exchangeLocationConnection(currentAgency, companyId, locationId));
}

export async function resolveHighLevelConnection(req: any): Promise<HighLevelConnection> {
  const encryptedContext = readHeader(req, "x-fasttract-ghl-context");

  if (encryptedContext) {
    const sharedSecret = process.env.GHL_APP_SHARED_SECRET;
    if (!sharedSecret) {
      throw new Error("Missing GHL_APP_SHARED_SECRET for embedded HighLevel access");
    }

    const context = decryptHighLevelUserContext(encryptedContext, sharedSecret);
    const locationId = context.activeLocation;
    if (!locationId) {
      throw new Error("FastTract must be opened from a HighLevel sub-account");
    }

    const token = await resolveStoredLocationToken(context.companyId, locationId);
    return {
      locationId,
      companyId: context.companyId,
      userId: context.userId,
      token,
      context,
      mode: "embedded",
    };
  }

  if (process.env.GHL_SINGLE_LOCATION_MODE === "true") {
    const locationId = process.env.GHL_LOCATION_ID;
    const token = process.env.GHL_LOCATION_TOKEN || process.env.GHL_PRIVATE_INTEGRATION_TOKEN;
    if (!locationId || !token) {
      throw new Error("Single-location mode requires GHL_LOCATION_ID and GHL_LOCATION_TOKEN or GHL_PRIVATE_INTEGRATION_TOKEN");
    }
    return { locationId, token, mode: "single_location" };
  }

  throw new Error("HighLevel user context is required. Open FastTract inside its HighLevel sub-account.");
}

async function performHighLevelRequest(
  path: string,
  options: HighLevelRequestOptions,
  token: string,
) {
  return fetch(`${HIGHLEVEL_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Version: options.apiVersion ?? HIGHLEVEL_API_VERSION,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

export async function highLevelRequest<T = unknown>(
  path: string,
  options: HighLevelRequestOptions = {},
): Promise<T> {
  if (!options.token) {
    throw new Error("HighLevel request is missing a location-scoped access token");
  }

  const requestedToken = options.token;
  let token = resolveReplacementToken(requestedToken);
  let response = await performHighLevelRequest(path, options, token);

  if (response.status === 401) {
    const stored = connectionByToken.get(token) ?? connectionByToken.get(requestedToken);
    if (stored?.refresh_token) {
      const staleToken = token;
      const refreshed = await refreshStoredConnection(stored, true);
      token = registerConnection(refreshed, [requestedToken, staleToken, stored.access_token]);
      response = await performHighLevelRequest(path, options, token);
    }
  }

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const detail = typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    console.error("HighLevel request failed", {
      method: options.method ?? "GET",
      path,
      status: response.status,
      detail: detail.slice(0, 1000),
    });
    throw new HighLevelApiError(response.status, highLevelPublicMessage(response.status));
  }

  return payload as T;
}

function unwrapPipeline(value: unknown): HighLevelPipeline {
  const candidate = value as { pipeline?: unknown } | null;
  const pipeline = (candidate?.pipeline ?? candidate) as Partial<HighLevelPipeline> | null;
  if (!pipeline?.id || !Array.isArray(pipeline.stages)) {
    throw new Error("HighLevel returned an invalid FastTract pipeline response");
  }
  return pipeline as HighLevelPipeline;
}

export async function ensureFastTractPipeline(
  locationId: string,
  token: string,
): Promise<HighLevelPipeline> {
  const existing = await highLevelRequest<{ pipelines?: HighLevelPipeline[] }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
    { token },
  );

  const found = (existing.pipelines ?? []).find(
    (pipeline) => pipeline.name.toLowerCase() === FASTTRACT_PIPELINE_NAME.toLowerCase(),
  );
  if (found) return found;

  const created = await highLevelRequest<unknown>("/opportunities/pipelines", {
    method: "POST",
    token,
    body: {
      name: FASTTRACT_PIPELINE_NAME,
      stages: [
        { name: "New", position: 1, showInFunnel: true },
        { name: "Contacted", position: 2, showInFunnel: true },
        { name: "Qualified", position: 3, showInFunnel: true },
      ],
      showInFunnel: true,
      showInPieChart: true,
      useOpportunityProbability: false,
      locationId,
      colorRenderMode: "dot",
    },
  });

  return unwrapPipeline(created);
}

export function getPipelineStage(
  pipeline: HighLevelPipeline,
  status: "new" | "contacted" | "qualified",
): HighLevelPipelineStage {
  const wanted = status.toLowerCase();
  const stage = pipeline.stages.find((item) => item.name.toLowerCase() === wanted);
  if (!stage) throw new Error(`FastTract pipeline is missing the ${status} stage`);
  return stage;
}

export async function addContactTags(contactId: string, tags: string[], token: string) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    body: { tags },
    token,
  });
}

export async function removeContactTags(contactId: string, tags: string[], token: string) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "DELETE",
    body: { tags },
    token,
  });
}

export function respondHighLevelError(
  res: any,
  error: unknown,
  fallback = "FastTract could not complete that HighLevel action.",
) {
  console.error("FastTract HighLevel handler failed", error);

  if (error instanceof HighLevelApiError) {
    return json(res, error.statusCode, { error: error.message });
  }

  const message = error instanceof Error ? error.message : "";
  if (message.includes("does not belong to the authenticated company")) {
    return json(res, 403, { error: "This HighLevel location is not authorized for the current FastTract installation." });
  }
  if (message.includes("not installed")) {
    return json(res, 401, { error: "FastTract is not connected to this HighLevel sub-account yet." });
  }
  if (message.includes("context is required") || message.includes("activeLocation") || message.includes("opened from a HighLevel sub-account")) {
    return json(res, 401, { error: "Open FastTract from the HighLevel sub-account menu and try again." });
  }
  if (
    message.includes("GHL_APP_SHARED_SECRET")
    || message.includes("GHL_TOKEN_ENCRYPTION_KEY")
    || message.includes("SUPABASE_SERVICE_ROLE_KEY")
    || message.includes("SUPABASE_URL")
  ) {
    return json(res, 503, { error: "FastTract secure connection services are not fully configured." });
  }
  if (message.includes("token refresh") || message.includes("location connection")) {
    return json(res, 401, { error: "FastTract needs to reconnect this HighLevel sub-account." });
  }

  return json(res, 500, { error: fallback });
}

export function json(res: any, status: number, body: unknown) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Vary", "X-FastTract-GHL-Context");
  return res.status(status).json(body);
}

export function requirePost(req: any, res: any): boolean {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}
