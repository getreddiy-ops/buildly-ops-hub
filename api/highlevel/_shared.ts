const HIGHLEVEL_BASE_URL = "https://services.leadconnectorhq.com";
const HIGHLEVEL_API_VERSION = "v3";

export type HighLevelRequestOptions = {
  method?: string;
  body?: unknown;
  token?: string;
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
