/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
  type HighLevelConnection,
} from "./_shared";

const OBJECT_KEYS: Record<string, string> = {
  jobs: "custom_objects.jobs",
  time_entries: "custom_objects.time_entries",
  materials: "custom_objects.materials",
  change_orders: "custom_objects.change_orders",
  ava_actions: "custom_objects.ava_actions",
};

const LINKED_JOB_OBJECT_KEYS = new Set([
  OBJECT_KEYS.time_entries,
  OBJECT_KEYS.materials,
  OBJECT_KEYS.change_orders,
]);

const JOB_ID_KEYS = [
  "custom_objects.time_entries.job_id",
  "custom_object.time_entries.job_id",
  "custom_objects.materials.job_id",
  "custom_object.materials.job_id",
  "custom_objects.change_orders.job_id",
  "custom_object.change_orders.job_id",
  "job_id",
];

const AVA_ACTION_TYPES = [
  "create_estimate",
  "send_estimate",
  "create_job",
  "create_lead",
  "create_customer",
  "create_change_order",
  "review_leads",
  "review_jobs",
  "review_money",
  "find_customer",
  "add_time",
  "add_material",
  "update_job",
  "convert_estimate",
  "send_invoice",
  "record_payment",
  "follow_up_invoice",
  "other",
] as const;

const AVA_STATUSES = ["draft", "approved", "completed", "dismissed"] as const;
const AVA_RISKS = ["review", "record_change", "customer_communication", "financial"] as const;

type AvaActionType = (typeof AVA_ACTION_TYPES)[number];
type AvaStatus = (typeof AVA_STATUSES)[number];
type AvaRisk = (typeof AVA_RISKS)[number];

const AVA_CLIENT_WRITABLE_PROPERTIES = new Set([
  "action_title",
  "action_type",
  "status",
  "risk_level",
  "source_prompt",
  "summary",
  "next_step",
  "draft_content",
  "target_label",
  "proposed_changes",
  "missing_information",
  "requires_approval",
]);

const AVA_PROPOSAL_PROPERTIES = [
  "action_title",
  "action_type",
  "risk_level",
  "source_prompt",
  "summary",
  "next_step",
  "draft_content",
  "target_label",
  "proposed_changes",
  "missing_information",
  "requires_approval",
] as const;

const AVA_RISK_RANK: Record<AvaRisk, number> = {
  review: 0,
  record_change: 1,
  customer_communication: 2,
  financial: 3,
};

const AVA_TRANSITIONS: Record<AvaStatus, AvaStatus[]> = {
  draft: ["approved", "dismissed"],
  approved: ["completed", "dismissed"],
  completed: [],
  dismissed: [],
};

class AvaApprovalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvaApprovalValidationError";
  }
}

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

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function requiredText(properties: Record<string, unknown>, key: string, max: number) {
  const value = textValue(properties[key]);
  if (!value) throw new AvaApprovalValidationError(`${key.replace(/_/g, " ")} is required`);
  if (value.length > max) throw new AvaApprovalValidationError(`${key.replace(/_/g, " ")} is too long`);
  properties[key] = value;
  return value;
}

function optionalText(properties: Record<string, unknown>, key: string, max: number) {
  const value = textValue(properties[key]);
  if (value.length > max) throw new AvaApprovalValidationError(`${key.replace(/_/g, " ")} is too long`);
  properties[key] = value || null;
  return value;
}

function parseJsonArray(value: unknown, label: string) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new AvaApprovalValidationError(`${label} must be valid JSON`);
    }
  }
  if (!Array.isArray(parsed)) throw new AvaApprovalValidationError(`${label} must be an array`);
  return parsed;
}

function canonicalProposedChanges(value: unknown) {
  const parsed = parseJsonArray(value ?? [], "proposed changes");
  if (parsed.length > 10) throw new AvaApprovalValidationError("proposed changes cannot contain more than 10 items");
  const forbidden = /\b(access token|refresh token|secret|password|route|url|record id|location id|company id|user id)\b/i;
  const result: Array<{ label: string; value: string }> = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new AvaApprovalValidationError("each proposed change must contain a label and value");
    }
    const source = item as Record<string, unknown>;
    const label = textValue(source.label).slice(0, 120);
    const proposedValue = textValue(source.value).slice(0, 500);
    if (!label || !proposedValue) {
      throw new AvaApprovalValidationError("each proposed change must contain a label and value");
    }
    if (forbidden.test(label)) {
      throw new AvaApprovalValidationError("proposed changes cannot contain executable routes, credentials, or internal record identifiers");
    }
    result.push({ label, value: proposedValue });
  }

  return result;
}

function canonicalMissingInformation(value: unknown) {
  const parsed = parseJsonArray(value ?? [], "missing information");
  if (parsed.length > 8) throw new AvaApprovalValidationError("missing information cannot contain more than 8 items");
  return parsed.map((item) => {
    const text = textValue(item).slice(0, 240);
    if (!text) throw new AvaApprovalValidationError("missing information must contain text values");
    return text;
  });
}

function booleanText(value: unknown) {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "";
}

function isDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`));
}

function requestHeader(req: any, name: string) {
  const value = req?.headers?.[name.toLowerCase()];
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return "";
}

function actorLabel(connection: HighLevelConnection) {
  return connection.context?.userName
    || connection.context?.email
    || connection.userId
    || "HighLevel user";
}

function auditDate() {
  return new Date().toISOString().slice(0, 10);
}

function riskForAction(actionType: AvaActionType): AvaRisk {
  if (["create_estimate", "create_change_order", "convert_estimate", "record_payment"].includes(actionType)) return "financial";
  if (["send_estimate", "send_invoice", "follow_up_invoice"].includes(actionType)) return "customer_communication";
  if (["create_job", "create_lead", "create_customer", "add_time", "add_material", "update_job"].includes(actionType)) return "record_change";
  return "review";
}

function sameProperty(a: Record<string, unknown>, b: Record<string, unknown>, key: string) {
  return JSON.stringify(a[key] ?? null) === JSON.stringify(b[key] ?? null);
}

function prepareAvaActionBody(
  body: ReturnType<typeof normalizeRecordBody>,
  incomingProperties: Record<string, unknown>,
  connection: HighLevelConnection,
  existingRecord?: any,
) {
  for (const key of Object.keys(body)) {
    if (key !== "properties") {
      throw new AvaApprovalValidationError(`unsupported Ava approval field: ${key}`);
    }
  }
  for (const key of Object.keys(incomingProperties)) {
    if (!AVA_CLIENT_WRITABLE_PROPERTIES.has(key)) {
      throw new AvaApprovalValidationError(`unsupported Ava approval property: ${key}`);
    }
  }

  const properties = propertyRecord(body.properties);
  const existing = existingRecord ? normalizeProperties(existingRecord.properties) : null;
  const actor = actorLabel(connection).slice(0, 255);
  const today = auditDate();

  const requestedStatus = textValue(properties.status) || "draft";
  if (!AVA_STATUSES.includes(requestedStatus as AvaStatus)) {
    throw new AvaApprovalValidationError("Ava approval status is invalid");
  }
  const nextStatus = requestedStatus as AvaStatus;
  const previousStatus = existing ? (textValue(existing.status) || "draft") as AvaStatus : null;

  if (!existing) {
    if (nextStatus !== "draft") {
      throw new AvaApprovalValidationError("new Ava approvals must begin as drafts");
    }
    properties.status = "draft";
    properties.requested_by = actor;
    properties.requested_date = today;
    properties.approved_by = null;
    properties.approved_date = null;
    properties.completed_by = null;
    properties.completed_date = null;
    properties.dismissed_by = null;
    properties.dismissed_date = null;
  } else {
    if (!AVA_STATUSES.includes(previousStatus as AvaStatus)) {
      throw new AvaApprovalValidationError("stored Ava approval status is invalid");
    }
    const currentStatus = previousStatus as AvaStatus;
    if (currentStatus === "completed" || currentStatus === "dismissed") {
      throw new AvaApprovalValidationError("completed and dismissed Ava approvals are immutable");
    }

    const changedStatus = nextStatus !== currentStatus;
    if (changedStatus && !AVA_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new AvaApprovalValidationError(`Ava approval cannot move from ${currentStatus} to ${nextStatus}`);
    }

    if (currentStatus !== "draft" || changedStatus) {
      for (const key of AVA_PROPOSAL_PROPERTIES) {
        if (!sameProperty(properties, existing, key)) {
          throw new AvaApprovalValidationError("the approved proposal cannot be rewritten during a status change");
        }
      }
    }

    properties.requested_by = textValue(existing.requested_by) || actor;
    properties.requested_date = textValue(existing.requested_date) || today;
    properties.approved_by = existing.approved_by ?? null;
    properties.approved_date = existing.approved_date ?? null;
    properties.completed_by = existing.completed_by ?? null;
    properties.completed_date = existing.completed_date ?? null;
    properties.dismissed_by = existing.dismissed_by ?? null;
    properties.dismissed_date = existing.dismissed_date ?? null;

    if (changedStatus && nextStatus === "approved") {
      properties.approved_by = actor;
      properties.approved_date = today;
    }
    if (changedStatus && nextStatus === "completed") {
      properties.completed_by = actor;
      properties.completed_date = today;
    }
    if (changedStatus && nextStatus === "dismissed") {
      properties.dismissed_by = actor;
      properties.dismissed_date = today;
    }
  }

  const actionTitle = requiredText(properties, "action_title", 180);
  const actionTypeValue = requiredText(properties, "action_type", 80);
  if (!AVA_ACTION_TYPES.includes(actionTypeValue as AvaActionType)) {
    throw new AvaApprovalValidationError("Ava approval action type is invalid");
  }
  const actionType = actionTypeValue as AvaActionType;
  const riskValue = requiredText(properties, "risk_level", 80);
  if (!AVA_RISKS.includes(riskValue as AvaRisk)) {
    throw new AvaApprovalValidationError("Ava approval risk level is invalid");
  }
  const risk = riskValue as AvaRisk;
  const minimumRisk = riskForAction(actionType);
  if (AVA_RISK_RANK[risk] < AVA_RISK_RANK[minimumRisk]) {
    throw new AvaApprovalValidationError(`Ava approval risk cannot be lower than ${minimumRisk}`);
  }

  properties.action_title = actionTitle;
  properties.action_type = actionType;
  properties.status = nextStatus;
  properties.risk_level = risk;
  requiredText(properties, "source_prompt", 12_000);
  requiredText(properties, "summary", 1_200);
  requiredText(properties, "next_step", 1_200);
  optionalText(properties, "draft_content", 5_000);
  optionalText(properties, "target_label", 180);

  const proposedChanges = canonicalProposedChanges(properties.proposed_changes ?? []);
  const missingInformation = canonicalMissingInformation(properties.missing_information ?? []);
  properties.proposed_changes = JSON.stringify(proposedChanges);
  properties.missing_information = JSON.stringify(missingInformation);

  const requiresApproval = booleanText(properties.requires_approval);
  if (requiresApproval !== "true") {
    throw new AvaApprovalValidationError("Ava approval records must require explicit human approval");
  }
  properties.requires_approval = "true";

  for (const key of ["requested_by", "approved_by", "completed_by", "dismissed_by"] as const) {
    optionalText(properties, key, 255);
  }
  for (const key of ["requested_date", "approved_date", "completed_date", "dismissed_date"] as const) {
    const value = optionalText(properties, key, 20);
    if (value && !isDate(value)) throw new AvaApprovalValidationError(`${key.replace(/_/g, " ")} is invalid`);
  }

  if (nextStatus === "approved" && missingInformation.length > 0) {
    throw new AvaApprovalValidationError("resolve the missing information before approving this Ava action");
  }
  if (nextStatus === "approved" && (!properties.approved_by || !properties.approved_date)) {
    throw new AvaApprovalValidationError("approved Ava actions require a server-recorded approver and date");
  }
  if (nextStatus === "completed" && (!properties.completed_by || !properties.completed_date)) {
    throw new AvaApprovalValidationError("completed Ava actions require a server-recorded actor and date");
  }
  if (nextStatus === "dismissed" && (!properties.dismissed_by || !properties.dismissed_date)) {
    throw new AvaApprovalValidationError("dismissed Ava actions require a server-recorded actor and date");
  }

  return { ...body, properties };
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
  if (!LINKED_JOB_OBJECT_KEYS.has(objectKey)) return;

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
      error: "Invalid object. Use jobs, time_entries, materials, change_orders, or ava_actions.",
    });
  }

  try {
    const connection = await resolveHighLevelConnection(req);
    const { locationId, token } = connection;
    const recordId = typeof req.query?.id === "string" ? req.query.id.trim() : "";

    if (req.method === "GET" && recordId) {
      const record = await getRecord(objectKey, recordId, token, locationId);
      return json(res, 200, { record });
    }

    if (req.method === "GET") {
      const query = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 120) : "";
      const page = Math.max(1, Number(req.query?.page || 1));
      const pageLimit = Math.min(Math.max(1, Number(req.query?.limit || 25)), 100);

      if (query && LINKED_JOB_OBJECT_KEYS.has(objectKey)) {
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
      const normalized = normalizeRecordBody(req.body);
      let body = normalized;
      if (objectKey === OBJECT_KEYS.ava_actions) {
        body = prepareAvaActionBody(normalized, propertyRecord(normalized.properties), connection);
      }
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
      const normalized = normalizeRecordBody(req.body);
      let body = mergeRecordBody(existingRecord, normalized);
      if (objectKey === OBJECT_KEYS.ava_actions) {
        body = prepareAvaActionBody(body, propertyRecord(normalized.properties), connection, existingRecord);
      }
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
      const existingRecord = await getRecord(objectKey, recordId, token, locationId);
      if (objectKey === OBJECT_KEYS.ava_actions) {
        const cleanupMarker = requestHeader(req, "x-fasttract-isolation-cleanup").slice(0, 120);
        const properties = normalizeProperties(existingRecord?.properties);
        const title = textValue(properties.action_title);
        const sourcePrompt = textValue(properties.source_prompt);
        const approvedForCleanup = Boolean(
          cleanupMarker
          && cleanupMarker.startsWith("FT-AVA-ISO-")
          && title.includes(cleanupMarker)
          && sourcePrompt.includes(cleanupMarker),
        );
        if (!approvedForCleanup) {
          return json(res, 405, {
            error: "Ava approval history cannot be deleted. Dismiss the proposal instead.",
          });
        }
      }
      const result = await highLevelRequest<any>(
        `/objects/${encodeURIComponent(objectKey)}/records/${encodeURIComponent(recordId)}`,
        { method: "DELETE", token },
      );
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    if (error instanceof AvaApprovalValidationError) {
      return json(res, 400, { error: error.message });
    }
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
