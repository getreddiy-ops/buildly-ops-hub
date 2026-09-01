import assert from "node:assert/strict";

const BASE_URL = required("FASTTRACT_BASE_URL").replace(/\/+$/, "");
const CONTEXT_A = required("GHL_TEST_CONTEXT_A");
const CONTEXT_B = required("GHL_TEST_CONTEXT_B");
const RUN_ID = process.env.FASTTRACT_ISOLATION_RUN_ID
  ?? new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const REQUEST_TIMEOUT_MS = Number(process.env.FASTTRACT_TEST_TIMEOUT_MS ?? 30_000);

if (!BASE_URL.startsWith("https://") && process.env.FASTTRACT_ALLOW_INSECURE_TEST_URL !== "true") {
  throw new Error("FASTTRACT_BASE_URL must use HTTPS");
}
if (CONTEXT_A === CONTEXT_B) {
  throw new Error("GHL_TEST_CONTEXT_A and GHL_TEST_CONTEXT_B must come from different HighLevel sub-accounts");
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function headers(context, extra = {}) {
  return {
    "Content-Type": "application/json",
    "X-FastTract-GHL-Context": context,
    ...extra,
  };
}

async function request(context, path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: headers(context, options.headers),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  return { status: response.status, payload };
}

async function expectStatus(context, path, options, expected) {
  const accepted = Array.isArray(expected) ? expected : [expected];
  const result = await request(context, path, options);
  if (!accepted.includes(result.status)) {
    throw new Error(
      `${options?.method ?? "GET"} ${path} returned ${result.status}; expected ${accepted.join("/")}: ${safePayload(result.payload)}`,
    );
  }
  return result.payload;
}

function safePayload(payload) {
  if (typeof payload === "string") return payload.slice(0, 400);
  try {
    return JSON.stringify(payload ?? {}).slice(0, 400);
  } catch {
    return "unreadable response";
  }
}

function findId(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 4) return null;
  for (const key of ["id", "_id"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  for (const key of ["record", "data", "result"]) {
    const id = findId(value[key], depth + 1);
    if (id) return id;
  }
  return null;
}

function recordFrom(payload) {
  return payload?.record ?? payload?.data?.record ?? payload?.data ?? payload;
}

function recordProperty(record, key) {
  const properties = record?.properties ?? {};
  for (const candidate of [
    `custom_objects.ava_actions.${key}`,
    `custom_object.ava_actions.${key}`,
    key,
  ]) {
    const value = properties[candidate];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function includesMarker(records, marker) {
  return records.some((record) => [
    recordProperty(record, "action_title"),
    recordProperty(record, "source_prompt"),
    recordProperty(record, "summary"),
  ].some((value) => value.includes(marker)));
}

function actionBody(marker, missingInformation = []) {
  return {
    properties: {
      action_title: `${marker} Create reviewed job`,
      action_type: "create_job",
      status: "draft",
      risk_level: "record_change",
      source_prompt: `${marker} create a job after human approval`,
      summary: `${marker} Ava approval isolation proposal`,
      next_step: "Open Jobs and verify every field before saving.",
      draft_content: null,
      target_label: `${marker} test target`,
      proposed_changes: JSON.stringify([
        { label: "Job name", value: `${marker} test job` },
      ]),
      missing_information: JSON.stringify(missingInformation),
      requires_approval: "true",
    },
  };
}

async function bootstrap(label, context) {
  const payload = await expectStatus(context, "/api/highlevel/bootstrap", {
    method: "POST",
    body: {},
  }, 200);
  if (!payload?.ok) throw new Error(`Location ${label} bootstrap was partial: ${safePayload(payload?.errors)}`);
  assert.ok(payload.locationId, `Location ${label} did not return a signed active location`);
  return payload.locationId;
}

async function createAction(label, context, marker, missingInformation = []) {
  const payload = await expectStatus(context, "/api/highlevel/records?object=ava_actions", {
    method: "POST",
    body: actionBody(marker, missingInformation),
  }, 201);
  const id = findId(payload);
  assert.ok(id, `Location ${label} Ava action did not return a record id`);
  const record = recordFrom(payload);
  assert.equal(recordProperty(record, "status"), "draft", `Location ${label} action did not begin as a draft`);
  assert.ok(recordProperty(record, "requested_by"), `Location ${label} action is missing its signed requester audit value`);
  assert.match(recordProperty(record, "requested_date"), /^\d{4}-\d{2}-\d{2}$/, `Location ${label} action is missing its server date`);
  return id;
}

async function verifyLists(label, context, ownMarker, otherMarker) {
  const payload = await expectStatus(
    context,
    `/api/highlevel/records?object=ava_actions&q=${encodeURIComponent(RUN_ID)}&limit=100`,
    {},
    200,
  );
  const records = payload?.records ?? [];
  assert.ok(includesMarker(records, ownMarker), `Location ${label} cannot see its own Ava approval`);
  assert.ok(!includesMarker(records, otherMarker), `Location ${label} can see the other location's Ava approval`);
}

async function cleanup(context, id, marker) {
  if (!id) return null;
  const result = await request(context, `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { "X-FastTract-Isolation-Cleanup": marker },
  });
  if (![200, 204, 404].includes(result.status)) {
    return `${result.status}: ${safePayload(result.payload)}`;
  }
  return null;
}

const markerA = `FT-AVA-ISO-A-${RUN_ID}`;
const markerB = `FT-AVA-ISO-B-${RUN_ID}`;
let actionA = null;
let actionB = null;
let failure = null;

try {
  console.log(`Starting FastTract Ava approval isolation test ${RUN_ID}`);
  const [locationA, locationB] = await Promise.all([
    bootstrap("A", CONTEXT_A),
    bootstrap("B", CONTEXT_B),
  ]);
  assert.notEqual(locationA, locationB, "Both signed contexts resolved to the same HighLevel location");

  const riskMarker = `FT-AVA-ISO-RISK-${RUN_ID}`;
  const lowRiskBody = actionBody(riskMarker);
  lowRiskBody.properties.risk_level = "review";
  await expectStatus(CONTEXT_A, "/api/highlevel/records?object=ava_actions", {
    method: "POST",
    body: lowRiskBody,
  }, 400);

  [actionA, actionB] = await Promise.all([
    createAction("A", CONTEXT_A, markerA),
    createAction("B", CONTEXT_B, markerB, ["Select the real customer record"]),
  ]);

  await Promise.all([
    verifyLists("A", CONTEXT_A, markerA, markerB),
    verifyLists("B", CONTEXT_B, markerB, markerA),
  ]);

  await expectStatus(
    CONTEXT_A,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionB)}`,
    {},
    [403, 404],
  );
  await expectStatus(
    CONTEXT_B,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionA)}`,
    { method: "PUT", body: { properties: { status: "approved" } } },
    [403, 404],
  );

  const approvedPayload = await expectStatus(
    CONTEXT_A,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionA)}`,
    { method: "PUT", body: { properties: { status: "approved" } } },
    200,
  );
  const approvedRecord = recordFrom(approvedPayload);
  assert.equal(recordProperty(approvedRecord, "status"), "approved", "Location A action was not approved");
  assert.ok(recordProperty(approvedRecord, "approved_by"), "Location A action is missing the signed approver");
  assert.match(recordProperty(approvedRecord, "approved_date"), /^\d{4}-\d{2}-\d{2}$/, "Location A action is missing approval date");

  await expectStatus(
    CONTEXT_A,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionA)}`,
    { method: "PUT", body: { properties: { status: "approved", summary: "Rewritten after approval" } } },
    400,
  );
  await expectStatus(
    CONTEXT_B,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionB)}`,
    { method: "PUT", body: { properties: { status: "approved" } } },
    400,
  );
  await expectStatus(
    CONTEXT_B,
    `/api/highlevel/records?object=ava_actions&id=${encodeURIComponent(actionB)}`,
    { method: "PUT", body: { properties: { status: "completed" } } },
    400,
  );

  console.log("PASS: Ava approvals are location-isolated, risk-gated, immutable after approval, and blocked by missing information");
} catch (error) {
  failure = error;
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const cleanupErrors = [];
  const cleanupA = await cleanup(CONTEXT_A, actionA, markerA);
  if (cleanupA) cleanupErrors.push(`A: ${cleanupA}`);
  const cleanupB = await cleanup(CONTEXT_B, actionB, markerB);
  if (cleanupB) cleanupErrors.push(`B: ${cleanupB}`);

  if (cleanupErrors.length) {
    for (const error of cleanupErrors) console.error(`Cleanup error ${error}`);
    if (!failure) failure = new Error("Ava approval checks passed, but temporary records could not be cleaned up");
  } else {
    console.log("Ava approval isolation cleanup completed");
  }
}

if (failure) process.exit(1);
