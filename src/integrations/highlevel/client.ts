export type FastTractHighLevelObject = "jobs" | "time_entries" | "materials";

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

export type FastTractLeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";

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

export type HighLevelEstimateStatus = "draft" | "sent" | "accepted" | "declined" | "invoiced" | "viewed";

export type HighLevelEstimateItem = {
  _id?: string;
  name?: string;
  description?: string;
  amount?: number;
  qty?: number;
  currency?: string;
};

export type HighLevelEstimate = {
  _id: string;
  name: string;
  status?: HighLevelEstimateStatus;
  total?: number;
  currency?: string;
  termsNotes?: string;
  createdAt?: string;
  updatedAt?: string;
  issueDate?: string;
  expiryDate?: string;
  items?: HighLevelEstimateItem[];
  contactDetails?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNo?: string;
  };
  meta?: Record<string, unknown>;
};

export type HighLevelInvoiceStatus =
  | "draft"
  | "sent"
  | "payment_processing"
  | "paid"
  | "void"
  | "partially_paid";

export type HighLevelInvoiceItem = {
  _id?: string;
  name?: string;
  description?: string;
  amount?: number;
  qty?: number;
  currency?: string;
};

export type HighLevelInvoice = {
  _id: string;
  status: HighLevelInvoiceStatus;
  name: string;
  invoiceNumber?: string | number;
  currency?: string;
  total?: number;
  amountDue?: number;
  amountPaid?: number;
  issueDate?: string;
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  invoiceItems?: HighLevelInvoiceItem[];
  contactDetails?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNo?: string;
  };
};

export type HighLevelConnectionContext = {
  connected: boolean;
  mode: "embedded" | "single_location";
  locationId: string;
  companyId?: string | null;
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
};

export type HighLevelAiField = {
  name: string;
  type?: "string" | "number" | "boolean" | "date" | "email" | "phone" | "json";
  description?: string;
  enum?: string[];
};

let contextPromise: Promise<string | null> | null = null;

export function isEmbeddedHighLevel() {
  return typeof window !== "undefined" && window.location.pathname.startsWith("/highlevel");
}

async function requestHighLevelParentContext(): Promise<string | null> {
  if (typeof window === "undefined" || window.parent === window) return null;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(value);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent) return;
      if (event.data?.message !== "REQUEST_USER_DATA_RESPONSE") return;
      finish(typeof event.data?.payload === "string" ? event.data.payload : null);
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
    window.setTimeout(() => finish(null), 3000);
  });
}

async function getHighLevelContext() {
  if (!contextPromise) contextPromise = requestHighLevelParentContext();
  return contextPromise;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const encryptedContext = await getHighLevelContext();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (encryptedContext) headers.set("X-FastTract-GHL-Context", encryptedContext);

  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.error === "string"
      ? payload.error
      : `FastTract could not complete that HighLevel request (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

export const highLevel = {
  resetEmbeddedContext() {
    contextPromise = null;
  },

  context() {
    return request<HighLevelConnectionContext>("/api/highlevel/context");
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

  aiFormFill<T extends object>(data: {
    prompt: string;
    formName: string;
    fields: HighLevelAiField[];
    context?: Record<string, unknown>;
  }) {
    return request<{ values: Partial<T>; warnings?: string[] }>("/api/highlevel/ai-form-fill", {
      method: "POST",
      body: JSON.stringify(data),
    });
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
    return request<{ contact: HighLevelContact }>("/api/highlevel/contacts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateContact(id: string, data: Record<string, unknown>) {
    return request<{ contact: HighLevelContact }>(`/api/highlevel/contacts?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
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
    return request<{ lead: FastTractLead }>("/api/highlevel/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateLead(id: string, data: Record<string, unknown>) {
    return request<{ lead: FastTractLead }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  convertLead(id: string) {
    return request<{ success: boolean; status: FastTractLeadStatus }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "won" }),
    });
  },

  deleteLead(id: string) {
    return request<{ success?: boolean }>(`/api/highlevel/leads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  listEstimates(options: {
    query?: string;
    status?: HighLevelEstimateStatus | "all";
    contactId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.status) params.set("status", options.status);
    if (options.contactId) params.set("contactId", options.contactId);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    return request<{ estimates: HighLevelEstimate[]; total: number; traceId?: string }>(`/api/highlevel/estimates?${params.toString()}`);
  },

  createEstimate(data: Record<string, unknown>) {
    return request<HighLevelEstimate>("/api/highlevel/estimates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateEstimate(id: string, data: Record<string, unknown>) {
    return request<HighLevelEstimate>(`/api/highlevel/estimates?id=${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteEstimate(id: string) {
    return request<HighLevelEstimate>(`/api/highlevel/estimates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  sendEstimate(id: string, options: {
    channel?: "sms_and_email" | "email" | "sms" | "send_manually";
    name?: string;
  } = {}) {
    return request<unknown>("/api/highlevel/estimate-actions", {
      method: "POST",
      body: JSON.stringify({ id, channel: options.channel ?? "sms_and_email", name: options.name }),
    });
  },

  listInvoices(options: {
    query?: string;
    status?: HighLevelInvoiceStatus | "all";
    contactId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.status && options.status !== "all") params.set("status", options.status);
    if (options.contactId) params.set("contactId", options.contactId);
    if (options.limit) params.set("limit", String(options.limit));
    if (options.offset) params.set("offset", String(options.offset));
    return request<{ invoices: HighLevelInvoice[]; total: number }>(`/api/highlevel/invoices?${params.toString()}`);
  },

  convertEstimateToInvoice(estimateId: string) {
    return request<{ estimate?: HighLevelEstimate; invoice: HighLevelInvoice }>("/api/highlevel/invoices", {
      method: "POST",
      body: JSON.stringify({ action: "convert_estimate", estimateId }),
    });
  },

  sendInvoice(invoiceId: string, options: {
    channel?: "sms_and_email" | "email" | "sms" | "send_manually";
  } = {}) {
    return request<{ invoice?: HighLevelInvoice }>("/api/highlevel/invoices", {
      method: "POST",
      body: JSON.stringify({
        action: "send_invoice",
        invoiceId,
        channel: options.channel ?? "sms_and_email",
      }),
    });
  },

  listOpportunities(options: {
    query?: string;
    page?: number;
    limit?: number;
    pipelineId?: string;
    pipelineStageId?: string;
    contactId?: string;
    status?: string;
  } = {}) {
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
    return request<{ opportunity: HighLevelOpportunity }>("/api/highlevel/opportunities", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  listRecords<T = Record<string, unknown>>(
    object: FastTractHighLevelObject,
    options: { query?: string; page?: number; limit?: number } = {},
  ) {
    const params = new URLSearchParams({ object });
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    return request<HighLevelRecordSearchResponse<T>>(`/api/highlevel/records?${params.toString()}`);
  },

  createRecord<T = Record<string, unknown>>(
    object: FastTractHighLevelObject,
    data: Record<string, unknown>,
  ) {
    return request<{ record: HighLevelRecord<T> }>(`/api/highlevel/records?object=${encodeURIComponent(object)}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
