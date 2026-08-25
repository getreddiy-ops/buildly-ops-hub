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

export function getHighLevelLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID;
  if (!locationId) {
    throw new Error("Missing GHL_LOCATION_ID");
  }
  return locationId;
}

export function getHighLevelToken(): string {
  const token =
    process.env.GHL_LOCATION_TOKEN ||
    process.env.GHL_PRIVATE_INTEGRATION_TOKEN;

  if (!token) {
    throw new Error(
      "Missing GHL_LOCATION_TOKEN or GHL_PRIVATE_INTEGRATION_TOKEN",
    );
  }

  return token;
}

export async function highLevelRequest<T = unknown>(
  path: string,
  options: HighLevelRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${HIGHLEVEL_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token ?? getHighLevelToken()}`,
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

export async function ensureFastTractPipeline(): Promise<HighLevelPipeline> {
  const locationId = getHighLevelLocationId();
  const existing = await highLevelRequest<{ pipelines?: HighLevelPipeline[] }>(
    `/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
  );

  const found = (existing.pipelines ?? []).find(
    (pipeline) => pipeline.name.toLowerCase() === FASTTRACT_PIPELINE_NAME.toLowerCase(),
  );
  if (found) return found;

  const created = await highLevelRequest<any>("/opportunities/pipelines", {
    method: "POST",
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

export async function addContactTags(contactId: string, tags: string[]) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "POST",
    body: { tags },
  });
}

export async function removeContactTags(contactId: string, tags: string[]) {
  if (tags.length === 0) return;
  await highLevelRequest(`/contacts/${encodeURIComponent(contactId)}/tags`, {
    method: "DELETE",
    body: { tags },
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
