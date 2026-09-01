/* eslint-disable @typescript-eslint/no-explicit-any */
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
  change_orders: "custom_objects.change_orders",
};

const JOB_ID_KEYS = [
  "custom_objects.time_entries.job_id",
  "custom_object.time_entries.job_id",
  "custom_objects.materials.job_id",
  "custom_object.materials.job_id",
  "custom_objects.change_orders.job_id",
  "custom_object.change_orders.job_id",
  "job_id",
];

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

function propertyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeProperties(value: unknown) {
  const source = propertyRecord(value);
  const normalized: Record<string, unknown> = {};
  for (const [key, propertyValue] of Object.entries(source)) {
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

function mergeRecordBody(existingRecord: any, body: ReturnType<typeof normalizeRecordBody>) {
  return {
    ...body,
    properties: {
      ...normalizeProperties(existingRecord?.properties),
      ...propertyRecord(body.properties),
    },
  };
}

function recordProperty(record: any, keys: string[]) {
  const properties = propertyRecord(record?.properties);
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
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

async function validateLinkedJob(
  objectKey: string,
  body: ReturnType<typeof normalizeRecordBody>,
  token: string,
  locationId: string,
  existingRecord?: any,
) {
  if (objectKey === OBJECT_KEYS.jobs) return;

  const requestedJobId = recordProperty({ properties: body.properties }, JOB_ID_KEYS);
  const existingJobId = existingRecord ? recordProperty(existingRecord, JOB_ID_KEYS) : "";
  const jobId = requestedJobId || existingJobId;

  if (!jobId) {
    throw new Error("FastTract labor, material, and change-order records require a linked job");
  }

  await getRecord(OBJECT_KEYS.jobs, jobId, token, locationId);
}

async function searchRecordPage(
  objectKey: string,
  locationId: string,
  token: string,
  page: number,
  pageLimit: number,
  query: string,
) {
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
  return { result, records, total };
}

async function searchLinkedJobRecords(
  objectKey: string,
  jobId: string,
  locationId: string,
  token: string,
) {
  await getRecord(OBJECT_KEYS.jobs, jobId, token, locationId);

  const all: any[] = [];
  let total = 0;
  let page = 1;
  const pageLimit = 100;

  do {
    const current = await searchRecordPage(objectKey, locationId, token, page, pageLimit, "");
    total = current.total;
    all.push(...current.records);
    if (current.records.length === 0) break;
    page += 1;
  } while (all.length < total && page <= 50);

  const records = all.filter((record) => recordProperty(record, JOB_ID_KEYS) === jobId);
  return { records, total: records.length };
}

export default async function handler(req: any, res: any) {
  const objectKey = resolveObjectKey(req.query?.object);
  if (!objectKey) {
    return json(res, 400, {
      error: "Invalid object. Use jobs, time_entries, materials, or change_orders.",
    });
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

      if (query && objectKey !== OBJECT_KEYS.jobs) {
        const linked = await searchLinkedJobRecords(objectKey, query, locationId, token);
        return json(res, 200, linked);
      }

      const searched = await searchRecordPage(objectKey, locationId, token, page, pageLimit, query);
      return json(res, 200, {
        ...searched.result,
        records: searched.records,
        total: searched.total,
      });
    }

    if (req.method === "POST") {
      const body = normalizeRecordBody(req.body);
      await validateLinkedJob(objectKey, body, token, locationId);

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
      const existingRecord = await getRecord(objectKey, recordId, token, locationId);
      const body = mergeRecordBody(existingRecord, normalizeRecordBody(req.body));
      await validateLinkedJob(objectKey, body, token, locationId, existingRecord);

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
    if (
      error instanceof Error
      && error.message.includes("does not belong to this HighLevel sub-account")
    ) {
      return json(res, 403, {
        error: "That contractor record is outside the active HighLevel sub-account.",
      });
    }
    return respondHighLevelError(res, error, "FastTract could not load or save that contractor record.");
  }
}
