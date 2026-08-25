export type FastTractHighLevelObject =
  | "jobs"
  | "time_entries"
  | "materials";

export type HighLevelRecord<T = Record<string, unknown>> = {
  id: string;
  properties?: T;
  locationId?: string;
  objectKey?: string;
  createdAt?: string;
  updatedAt?: string;
  dateAdded?: string;
  dateUpdated?: string;
};

export type HighLevelRecordSearchResponse<T = Record<string, unknown>> = {
  records: HighLevelRecord<T>[];
  total: number;
};

export type HighLevelContact = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address1?: string | null;
  source?: string | null;
  locationId?: string;
  tags?: string[];
  dateAdded?: string;
};

export type HighLevelOpportunity = {
  id: string;
  name?: string;
  contactId?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  status?: "open" | "won" | "lost" | "abandoned";
  monetaryValue?: number;
};

export type FastTractLeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "won"
  | "lost";

export type FastTractLead = {
  id: string;
  contact_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  source?: string | null;
  status: FastTractLeadStatus;
  notes?: string | null;
  note_id?: string | null;
  pipeline_id?: string;
  pipeline_stage_id?: string;
};

const CONTEXT_STORAGE_KEY = "fasttract:ghl-context";
let contextPromise: Promise<string | null> | null = null;

function storedContext() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(CONTEXT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function rememberContext(value: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CONTEXT_STORAGE_KEY, value);
  } catch {
    // Storage can be blocked in some iframe privacy modes; the in-memory request still works.
  }
}

async function requestHighLevelParentContext(): Promise<string | null> {
  const existing = storedContext();
  if (existing) return existing;
  if (typeof window === "undefined" || window.parent === window) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      if (value) rememberContext(value);
      resolve(value);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.data?.message !== "REQUEST_USER_DATA_RESPONSE") return;
      finish(typeof event.data?.payload === "string" ? event.data.payload : null);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
    window.setTimeout(() => finish(null), 2000);
  });
}

async function getHighLevelContext() {
  if (!contextPromise) contextPromise = requestHighLevelParentContext();
  return contextPromise;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const encryptedContext = await getHighLevelContext();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (encryptedContext) headers["X-FastTract-GHL-Context"] = encryptedContext;

  if (init?.headers) {
    const extra = new Headers(init.headers);
    extra.forEach((value, key) => { headers[key] = value; });
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `FastTract HighLevel request failed (${response.status})`;
    throw new Error(message);
  }

  return payload as T;
}

export const highLevel = {
  resetEmbeddedContext() {
    contextPromise = null;
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(CONTEXT_STORAGE_KEY); } catch { /* noop */ }
    }
  },

  bootstrap() {
    return request<{
      ok: boolean;
      created: string[];
      skipped: string[];
      locationId: string;
      pipeline?: { id: string; name: string; stages: unknown[] } | null;
      errors?: string[];
    }>("/api/highlevel/bootstrap", { method: "POST" });
  },

  listContacts(options: { query?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    return request<{ contacts: HighLevelContact[]; total?: number; count?: number }>(`/api/highlevel/contacts?${params.toString()}`);
  },

  getContact(id: string) {
    return request<{
      contact: HighLevelContact;
      notes?: Array<{ id: string; body?: string }>;
      latestNote?: { id: string; body?: string } | null;
    }>(`/api/highlevel/contacts?id=${encodeURIComponent(id)}`);
  },

  upsertContact(data: Record<string, unknown>) {
    return request<{ contact: HighLevelContact }>("/api/highlevel/contacts", { method: "POST", body: JSON.stringify(data) });
  },

  updateContact(id: string, data: Record<string, unknown>) {
    return request<{ contact: HighLevelContact }>(`/api/highlevel/contacts?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) });
  },

  deleteContact(id: string) {
    return request<{ succeeded?: boolean }>(`/api/highlevel/contacts?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listLeads(options: { query?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    return request<{ leads: FastTractLead[]; meta?: unknown }>(`/api/highlevel/leads?${params.toString()}`);
  },

  getLead(id: string) {
    return request<{ lead: FastTractLead }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`);
  },

  createLead(data: Record<string, unknown>) {
    return request<{ lead: FastTractLead }>("/api/highlevel/leads", { method: "POST", body: JSON.stringify(data) });
  },

  updateLead(id: string, data: Record<string, unknown>) {
    return request<{ lead: FastTractLead }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(data) });
  },

  convertLead(id: string) {
    return request<{ success: boolean; status: FastTractLeadStatus }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status: "won" }) });
  },

  deleteLead(id: string) {
    return request<{ success?: boolean }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listOpportunities(options: { query?: string; page?: number; limit?: number; pipelineId?: string; pipelineStageId?: string; contactId?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.pipelineId) params.set("pipelineId", options.pipelineId);
    if (options.pipelineStageId) params.set("pipelineStageId", options.pipelineStageId);
    if (options.contactId) params.set("contactId", options.contactId);
    if (options.status) params.set("status", options.status);
    return request<{ opportunities: HighLevelOpportunity[]; meta?: unknown }>(`/api/highlevel/opportunities?${params.toString()}`);
  },

  createOpportunity(data: Record<string, unknown>) {
    return request<{ opportunity: HighLevelOpportunity }>("/api/highlevel/opportunities", { method: "POST", body: JSON.stringify(data) });
  },

  listRecords<T = Record<string, unknown>>(object: FastTractHighLevelObject, options: { query?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams({ object });
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    return request<HighLevelRecordSearchResponse<T>>(`/api/highlevel/records?${params.toString()}`);
  },

  createRecord<T = Record<string, unknown>>(object: FastTractHighLevelObject, data: Record<string, unknown>) {
    return request<{ record: HighLevelRecord<T> }>(`/api/highlevel/records?object=${encodeURIComponent(object)}`, { method: "POST", body: JSON.stringify(data) });
  },
};
