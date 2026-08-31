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

function contextHeaders(context) {
  return {
    "Content-Type": "application/json",
    "X-FastTract-GHL-Context": context,
  };
}

async function request(context, path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: contextHeaders(context),
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

async function expectSuccess(context, path, options = {}, expected = [200, 201]) {
  const result = await request(context, path, options);
  if (!expected.includes(result.status)) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${result.status}: ${safePayload(result.payload)}`);
  }
  return result.payload;
}

async function expectIsolated(context, path, options = {}) {
  const result = await request(context, path, options);
  if (![403, 404].includes(result.status)) {
    throw new Error(
      `Cross-location request ${options.method ?? "GET"} ${path} was not isolated. `
      + `Expected 403/404, received ${result.status}: ${safePayload(result.payload)}`,
    );
  }
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
  if (!value || depth > 4) return null;
  if (typeof value !== "object") return null;
  for (const key of ["_id", "id"]) {
    if (typeof value[key] === "string" && value[key]) return value[key];
  }
  for (const key of ["contact", "lead", "record", "estimate", "invoice", "data"]) {
    const id = findId(value[key], depth + 1);
    if (id) return id;
  }
  return null;
}

function contactIdFromLead(payload) {
  return payload?.lead?.contact_id
    ?? payload?.lead?.contactId
    ?? payload?.contact_id
    ?? null;
}

function includesMarker(items, marker, fields) {
  return items.some((item) => fields.some((field) => {
    const value = field.split(".").reduce((current, key) => current?.[key], item);
    return typeof value === "string" && value.includes(marker);
  }));
}

function excludesMarker(items, marker, fields) {
  return !includesMarker(items, marker, fields);
}

const markerA = `FT-ISO-A-${RUN_ID}`;
const markerB = `FT-ISO-B-${RUN_ID}`;
const emailA = "fasttract-isolation-a@fasttract.test";
const emailB = "fasttract-isolation-b@fasttract.test";

const created = {
  A: { context: CONTEXT_A, contactIds: new Set(), leadId: null, jobId: null, estimateId: null },
  B: { context: CONTEXT_B, contactIds: new Set(), leadId: null, jobId: null, estimateId: null },
};

async function bootstrap(label, context) {
  const payload = await expectSuccess(context, "/api/highlevel/bootstrap", { method: "POST", body: {} });
  if (!payload?.ok) {
    throw new Error(`Location ${label} bootstrap was partial: ${safePayload(payload?.errors)}`);
  }
  assert.ok(payload.locationId, `Location ${label} did not return a signed active location`);
  return payload.locationId;
}

async function createLocationFixtures(label, context, marker, email) {
  const fixture = created[label];
  const contactPayload = await expectSuccess(context, "/api/highlevel/contacts", {
    method: "POST",
    body: {
      name: `${marker} Customer`,
      email,
      address: `${label} Isolation Test Address`,
      notes: `FastTract two-location isolation test ${RUN_ID}`,
    },
  });
  const contactId = findId(contactPayload);
  assert.ok(contactId, `Location ${label} customer did not return a contact id`);
  fixture.contactIds.add(contactId);

  const leadPayload = await expectSuccess(context, "/api/highlevel/leads", {
    method: "POST",
    body: {
      name: `${marker} Lead`,
      email,
      source: "FastTract isolation test",
      status: "new",
      notes: `Isolation lead ${RUN_ID}`,
    },
  });
  fixture.leadId = leadPayload?.lead?.id ?? findId(leadPayload);
  assert.ok(fixture.leadId, `Location ${label} lead did not return an opportunity id`);
  const leadContactId = contactIdFromLead(leadPayload);
  if (leadContactId) fixture.contactIds.add(leadContactId);

  const jobPayload = await expectSuccess(context, "/api/highlevel/records?object=jobs", {
    method: "POST",
    body: {
      properties: {
        job_name: `${marker} Job`,
        status: "scheduled",
        address: `${label} Isolation Test Address`,
        start_date: "2026-09-15",
        notes: `Isolation job ${RUN_ID}`,
        customer_id: contactId,
      },
    },
  });
  fixture.jobId = findId(jobPayload);
  assert.ok(fixture.jobId, `Location ${label} job did not return a record id`);

  const estimatePayload = await expectSuccess(context, "/api/highlevel/estimates", {
    method: "POST",
    body: {
      title: `${marker} Estimate`,
      customer_id: contactId,
      notes: `Isolation estimate ${RUN_ID}`,
      tax_percent: 0,
      line_items: [
        { description: `${marker} Test Line`, quantity: 1, unit_price: 1 },
      ],
    },
  });
  fixture.estimateId = findId(estimatePayload);
  assert.ok(fixture.estimateId, `Location ${label} estimate did not return an estimate id`);

  return { contactId };
}

async function verifyLists(label, context, ownMarker, otherMarker) {
  const contacts = await expectSuccess(context, `/api/highlevel/contacts?q=${encodeURIComponent(RUN_ID)}&limit=100`);
  const contactItems = contacts?.contacts ?? [];
  assert.ok(includesMarker(contactItems, ownMarker, ["name"]), `Location ${label} cannot see its own customer`);
  assert.ok(excludesMarker(contactItems, otherMarker, ["name"]), `Location ${label} can see the other location's customer`);

  const leads = await expectSuccess(context, `/api/highlevel/leads?q=${encodeURIComponent(RUN_ID)}&limit=100`);
  const leadItems = leads?.leads ?? [];
  assert.ok(includesMarker(leadItems, ownMarker, ["name"]), `Location ${label} cannot see its own lead`);
  assert.ok(excludesMarker(leadItems, otherMarker, ["name"]), `Location ${label} can see the other location's lead`);

  const jobs = await expectSuccess(context, `/api/highlevel/records?object=jobs&q=${encodeURIComponent(RUN_ID)}&limit=100`);
  const jobItems = jobs?.records ?? [];
  assert.ok(includesMarker(jobItems, ownMarker, ["properties.job_name", "properties.custom_objects.jobs.job_name"]), `Location ${label} cannot see its own job`);
  assert.ok(excludesMarker(jobItems, otherMarker, ["properties.job_name", "properties.custom_objects.jobs.job_name"]), `Location ${label} can see the other location's job`);

  const estimates = await expectSuccess(context, `/api/highlevel/estimates?q=${encodeURIComponent(RUN_ID)}&limit=100`);
  const estimateItems = estimates?.estimates ?? [];
  assert.ok(includesMarker(estimateItems, ownMarker, ["name", "title"]), `Location ${label} cannot see its own estimate`);
  assert.ok(excludesMarker(estimateItems, otherMarker, ["name", "title"]), `Location ${label} can see the other location's estimate`);
}

async function verifyCrossLocationDenials(fromLabel, fromContext, targetLabel, target, fromContactId, fromMarker) {
  const targetContactId = [...target.contactIds][0];
  assert.ok(targetContactId, `Location ${targetLabel} has no contact id to test`);

  await expectIsolated(fromContext, `/api/highlevel/contacts?id=${encodeURIComponent(targetContactId)}`);
  await expectIsolated(fromContext, `/api/highlevel/contacts?id=${encodeURIComponent(targetContactId)}`, {
    method: "PUT",
    body: { name: `CROSS-WRITE-${fromLabel}-TO-${targetLabel}`, email: `${fromLabel.toLowerCase()}-cross@fasttract.test` },
  });

  await expectIsolated(fromContext, `/api/highlevel/leads?id=${encodeURIComponent(target.leadId)}`);
  await expectIsolated(fromContext, `/api/highlevel/leads?id=${encodeURIComponent(target.leadId)}`, {
    method: "PUT",
    body: { name: `CROSS-LEAD-${fromLabel}-TO-${targetLabel}`, status: "qualified" },
  });

  await expectIsolated(fromContext, `/api/highlevel/records?object=jobs&id=${encodeURIComponent(target.jobId)}`);
  await expectIsolated(fromContext, `/api/highlevel/records?object=jobs&id=${encodeURIComponent(target.jobId)}`, {
    method: "PUT",
    body: { properties: { job_name: `CROSS-JOB-${fromLabel}-TO-${targetLabel}`, status: "active" } },
  });

  await expectIsolated(fromContext, `/api/highlevel/estimates?id=${encodeURIComponent(target.estimateId)}`, {
    method: "PUT",
    body: {
      title: `CROSS-ESTIMATE-${fromLabel}-TO-${targetLabel}`,
      customer_id: fromContactId,
      notes: "This cross-location update must be rejected",
      line_items: [{ description: `${fromMarker} Cross Test`, quantity: 1, unit_price: 1 }],
    },
  });
}

async function cleanupFixture(label, fixture) {
  const errors = [];
  const cleanup = async (description, path, options) => {
    try {
      const result = await request(fixture.context, path, options);
      if (![200, 204, 404].includes(result.status)) {
        throw new Error(`${result.status}: ${safePayload(result.payload)}`);
      }
    } catch (error) {
      errors.push(`${label} ${description}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (fixture.estimateId) {
    await cleanup("estimate cleanup", `/api/highlevel/estimates?id=${encodeURIComponent(fixture.estimateId)}`, { method: "DELETE" });
  }
  if (fixture.jobId) {
    await cleanup("job cleanup", `/api/highlevel/records?object=jobs&id=${encodeURIComponent(fixture.jobId)}`, { method: "DELETE" });
  }
  if (fixture.leadId) {
    await cleanup("lead cleanup", `/api/highlevel/leads?id=${encodeURIComponent(fixture.leadId)}`, { method: "DELETE" });
  }
  for (const contactId of fixture.contactIds) {
    await cleanup("customer cleanup", `/api/highlevel/contacts?id=${encodeURIComponent(contactId)}`, { method: "DELETE" });
  }

  return errors;
}

let failure = null;
try {
  console.log(`Starting FastTract two-location isolation test ${RUN_ID}`);
  const [locationA, locationB] = await Promise.all([
    bootstrap("A", CONTEXT_A),
    bootstrap("B", CONTEXT_B),
  ]);
  assert.notEqual(locationA, locationB, "Both signed contexts resolved to the same HighLevel location");

  const [fixtureA, fixtureB] = await Promise.all([
    createLocationFixtures("A", CONTEXT_A, markerA, emailA),
    createLocationFixtures("B", CONTEXT_B, markerB, emailB),
  ]);

  await Promise.all([
    verifyLists("A", CONTEXT_A, markerA, markerB),
    verifyLists("B", CONTEXT_B, markerB, markerA),
  ]);

  await verifyCrossLocationDenials("A", CONTEXT_A, "B", created.B, fixtureA.contactId, markerA);
  await verifyCrossLocationDenials("B", CONTEXT_B, "A", created.A, fixtureB.contactId, markerB);

  console.log("PASS: location-scoped lists and direct record operations are isolated in both directions");
} catch (error) {
  failure = error;
  console.error(`FAIL: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  const cleanupErrors = [
    ...(await cleanupFixture("A", created.A)),
    ...(await cleanupFixture("B", created.B)),
  ];
  if (cleanupErrors.length > 0) {
    console.error("Cleanup errors:");
    for (const error of cleanupErrors) console.error(`- ${error}`);
    if (!failure) failure = new Error("Isolation checks passed, but one or more test records could not be cleaned up");
  } else {
    console.log("Isolation test cleanup completed");
  }
}

if (failure) process.exit(1);
