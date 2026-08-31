import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

const OBJECT_KEYS: Record<string, string> = {
  jobs: "custom_objects.jobs",
  time_entries: "custom_objects.time_entries",
  materials: "custom_objects.materials",
};

function resolveObjectKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return OBJECT_KEYS[value] ?? null;
}

function recordLocation(record: any) {
  return record?.locationId ?? record?.location_id ?? record?.properties?.locationId ?? null;
}

function ensureRecordLocation(record: any, locationId: string) {
  const actual = recordLocation(record);
  if (actual && actual !== locationId) {
    throw new Error("Contractor record does not belong to this HighLevel sub-account");
  }
}

function normalizeProperties(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const normalized: Record<string, unknown> = {};
  for (const [key, propertyValue] of Object.entries(value as Record<string, unknown>)) {
    const bareKey = key
      .replace(/^custom_objects\.[^.]+\./, "")
      .replace(/^custom_object\.[^.]+\./, "");
    normalized[bareKey] = propertyValue;
  }
  return normalized;
}

function normalizeRecordBody(value: unknown) {
  const body = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    ...body,
    properties: normalizeProperties(body.properties),
  };
}

async function getRecord(objectKey: string, recordId: string, token: string, locationId: string) {
  const result = await highLevelRequest<any>(
    `/objects/${encodeURIComponent(objectKey)}/records/${encodeURIComponent(recordId)}`,
    { token },
  );
  const record = result?.record ?? result;
  ensureRecordLocation(record, locationId);
  return record;
}

export default async function handler(req: any, res: any) {
  const objectKey = resolveObjectKey(req.query?.object);
  if (!objectKey) {
    return json(res, 400, { error: "Invalid object. Use jobs, time_entries, or materials." });
  }

  try {
    const { locationId, token } = await resolveHighLevelConnection(req);
    const recordId = typeof req.query?.id === "string" ? req.query.id.trim() : "";

    if (req.method === "GET" && recordId) {
      const record = await getRecord(objectKey, recordId, token, locationId);
      return json(res, 200, { record });
    }

    if (req.method === "GET") {
      const query = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 120) : "";
      const page = Math.max(1, Number(req.query?.page || 1));
      const pageLimit = Math.min(Math.max(1, Number(req.query?.limit || 25)), 100);

      const result = await highLevelRequest<any>(
        `/objects/${encodeURIComponent(objectKey)}/records/search`,
        {
          method: "POST",
          token,
          body: { locationId, page, pageLimit, query, searchAfter: [] },
        },
      );

      const records = Array.isArray(result?.records)
        ? result.records
        : Array.isArray(result?.data)
          ? result.data
          : [];
      for (const record of records) ensureRecordLocation(record, locationId);
      const total = Number(result?.total ?? result?.meta?.total ?? records.length) || 0;
      return json(res, 200, { ...result, records, total });
    }

    if (req.method === "POST") {
      const body = normalizeRecordBody(req.body);
      const result = await highLevelRequest<any>(
        `/objects/${encodeURIComponent(objectKey)}/records`,
        {
          method: "POST",
          token,
          body: { ...body, locationId },
        },
      );
      const record = result?.record ?? result;
      ensureRecordLocation(record, locationId);
      return json(res, 201, { record });
    }

    if (req.method === "PUT") {
      if (!recordId) return json(res, 400, { error: "Missing record id" });
      await getRecord(objectKey, recordId, token, locationId);
      const body = normalizeRecordBody(req.body);
      const result = await highLevelRequest<any>(
        `/objects/${encodeURIComponent(objectKey)}/records/${encodeURIComponent(recordId)}?locationId=${encodeURIComponent(locationId)}`,
        {
          method: "PUT",
          token,
          body,
        },
      );
      const record = result?.record ?? result;
      ensureRecordLocation(record, locationId);
      return json(res, 200, { record });
    }

    if (req.method === "DELETE") {
      if (!recordId) return json(res, 400, { error: "Missing record id" });
      await getRecord(objectKey, recordId, token, locationId);
      const result = await highLevelRequest<any>(
        `/objects/${encodeURIComponent(objectKey)}/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE", token },
      );
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not load or save that contractor record.");
  }
}
