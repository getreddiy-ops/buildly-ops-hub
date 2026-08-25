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
    }>("/api/highlevel/bootstrap", { method: "POST" });
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
