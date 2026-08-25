export type FastTractHighLevelObject =
  | "jobs"
  | "estimates"
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

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
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

    return request<{ contacts: HighLevelContact[]; total?: number; count?: number }>(
      `/api/highlevel/contacts?${params.toString()}`,
    );
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
    return request<{ contact: HighLevelContact }>(
      `/api/highlevel/contacts?id=${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  deleteContact(id: string) {
    return request<{ succeeded?: boolean }>(
      `/api/highlevel/contacts?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  listLeads(options: { query?: string; page?: number; limit?: number } = {}) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    return request<{ leads: FastTractLead[]; meta?: unknown }>(
      `/api/highlevel/leads?${params.toString()}`,
    );
  },

  getLead(id: string) {
    return request<{ lead: FastTractLead }>(
      `/api/highlevel/leads?id=${encodeURIComponent(id)}`,
    );
  },

  createLead(data: Record<string, unknown>) {
    return request<{ lead: FastTractLead }>("/api/highlevel/leads", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateLead(id: string, data: Record<string, unknown>) {
    return request<{ lead: FastTractLead }>(
      `/api/highlevel/leads?id=${encodeURIComponent(id)}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
    );
  },

  deleteLead(id: string) {
    return request<{ success?: boolean }>(
      `/api/highlevel/leads?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },

  listOpportunities(
    options: {
      query?: string;
      page?: number;
      limit?: number;
      pipelineId?: string;
      pipelineStageId?: string;
      contactId?: string;
      status?: string;
    } = {},
  ) {
    const params = new URLSearchParams();
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));
    if (options.pipelineId) params.set("pipelineId", options.pipelineId);
    if (options.pipelineStageId) params.set("pipelineStageId", options.pipelineStageId);
    if (options.contactId) params.set("contactId", options.contactId);
    if (options.status) params.set("status", options.status);

    return request<{ opportunities: HighLevelOpportunity[]; meta?: unknown }>(
      `/api/highlevel/opportunities?${params.toString()}`,
    );
  },

  createOpportunity(data: Record<string, unknown>) {
    return request<{ opportunity: HighLevelOpportunity }>(
      "/api/highlevel/opportunities",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  listRecords<T = Record<string, unknown>>(
    object: FastTractHighLevelObject,
    options: { query?: string; page?: number; limit?: number } = {},
  ) {
    const params = new URLSearchParams({ object });
    if (options.query) params.set("q", options.query);
    if (options.page) params.set("page", String(options.page));
    if (options.limit) params.set("limit", String(options.limit));

    return request<HighLevelRecordSearchResponse<T>>(
      `/api/highlevel/records?${params.toString()}`,
    );
  },

  createRecord<T = Record<string, unknown>>(
    object: FastTractHighLevelObject,
    data: Record<string, unknown>,
  ) {
    return request<{ record: HighLevelRecord<T> }>(
      `/api/highlevel/records?object=${encodeURIComponent(object)}`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },
};
