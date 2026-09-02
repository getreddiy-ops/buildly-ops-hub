import { createDecipheriv, createHash } from "node:crypto";

const HIGHLEVEL_BASE_URL = "https://services.leadconnectorhq.com";
const HIGHLEVEL_API_VERSION = "v3";
export const FASTTRACT_PIPELINE_NAME = "FastTract Sales";
export const FASTTRACT_CUSTOMER_TAG = "fasttract-customer";
export const FASTTRACT_LEAD_TAG = "fasttract-lead";

export type HighLevelRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
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

async function getLocationToken(
  agencyToken: string,
  companyId: string,
  locationId: string,
) {
  const body = new URLSearchParams({ companyId, locationId });
  const response = await fetch(`${HIGHLEVEL_BASE_URL}/oauth/location-token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${agencyToken}`,
      Version: HIGHLEVEL_API_VERSION,
    },
    body,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload?.access_token !== "string") {
    throw new Error(
      `Unable to create HighLevel location token (${response.status}): ${JSON.stringify(payload)}`,
    );
  }

  return payload.access_token as string;
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

    const fixedLocationToken =
      process.env.GHL_LOCATION_ID === locationId
        ? process.env.GHL_LOCATION_TOKEN || process.env.GHL_PRIVATE_INTEGRATION_TOKEN
        : undefined;

    if (fixedLocationToken) {
      return {
        locationId,
        companyId: context.companyId,
        userId: context.userId,
        token: fixedLocationToken,
        context,
        mode: "embedded",
      };
    }

    const agencyToken = process.env.GHL_AGENCY_TOKEN || process.env.GHL_AGENCY_ACCESS_TOKEN;
    if (!agencyToken) {
      throw new Error(
        "Missing GHL_AGENCY_TOKEN. FastTract needs an agency-level token to derive the active sub-account token.",
      );
    }

    const token = await getLocationToken(
      agencyToken,
      context.companyId,
      locationId,
    );

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
    const token =
      process.env.GHL_LOCATION_TOKEN ||
      process.env.GHL_PRIVATE_INTEGRATION_TOKEN;

    if (!locationId || !token) {
      throw new Error(
        "Single-location mode requires GHL_LOCATION_ID and GHL_LOCATION_TOKEN or GHL_PRIVATE_INTEGRATION_TOKEN",
      );
    }

    return {
      locationId,
      token,
      mode: "single_location",
    };
  }

  throw new Error(
    "HighLevel user context is required. Open FastTract inside its HighLevel sub-account.",
  );
}

export async function highLevelRequest<T = unknown>(
  path: string,
  options: HighLevelRequestOptions = {},
): Promise<T> {
  if (!options.token) {
    throw new Error("HighLevel request is missing a location-scoped access token");
  }

  const response = await fetch(`${HIGHLEVEL_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
      Version: HIGHLEVEL_API_VERSION,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

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
    const detail =
      typeof payload === "string" ? payload : JSON.stringify(payload ?? {});
    throw new Error(
      `HighLevel ${options.method ?? "GET"} ${path} failed (${response.status}): ${detail}`,
    );
  }

  return payload as T;
}

function unwrapPipeline(value: any): HighLevelPipeline {
  const pipeline = value?.pipeline ?? value;
  if (!pipeline?.id || !Array.isArray(pipeline?.stages)) {
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

  const created = await highLevelRequest<any>("/opportunities/pipelines", {
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
  const stage = pipeline.stages.find(
    (item) => item.name.toLowerCase() === wanted,
  );
  if (!stage) {
    throw new Error(`FastTract pipeline is missing the ${status} stage`);
  }
  return stage;
}

export async function addContactTags(
  contactId: string,
  tags: string[],
  token: string,
) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    body: { tags },
    token,
  });
}

export async function removeContactTags(
  contactId: string,
  tags: string[],
  token: string,
) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "DELETE",
    body: { tags },
    token,
  });
}

export function json(res: any, status: number, body: unknown) {
  res.status(status).json(body);
}

export function requirePost(req: any, res: any): boolean {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed" });
    return false;
  }
  return true;
}
