import { supabase } from "@/integrations/supabase/client";

const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fasttract-api`;

type ApiOptions = RequestInit & {
  organizationId?: string | null;
};

export async function fasttractApi<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in to FastTract first.");

  const headers = new Headers(options.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");
  if (options.organizationId) headers.set("x-fasttract-organization", options.organizationId);

  const response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `FastTract API request failed (${response.status})`);
  return payload as T;
}

export const FastTractApi = {
  me: (organizationId?: string | null) => fasttractApi("/v1/me", { organizationId }),

  listCustomers: (organizationId?: string | null) => fasttractApi("/v1/customers", { organizationId }),
  createCustomer: (organizationId: string, customer: Record<string, unknown>) => fasttractApi("/v1/customers", {
    method: "POST",
    organizationId,
    body: JSON.stringify(customer),
  }),
  updateCustomer: (organizationId: string, customerId: string, customer: Record<string, unknown>) => fasttractApi(`/v1/customers/${customerId}`, {
    method: "PATCH",
    organizationId,
    body: JSON.stringify(customer),
  }),

  listJobs: (organizationId?: string | null) => fasttractApi("/v1/jobs", { organizationId }),
  createJob: (organizationId: string, job: Record<string, unknown>) => fasttractApi("/v1/jobs", {
    method: "POST",
    organizationId,
    body: JSON.stringify(job),
  }),
  updateJob: (organizationId: string, jobId: string, job: Record<string, unknown>) => fasttractApi(`/v1/jobs/${jobId}`, {
    method: "PATCH",
    organizationId,
    body: JSON.stringify(job),
  }),

  listEstimates: (organizationId?: string | null) => fasttractApi("/v1/estimates", { organizationId }),
  createEstimate: (organizationId: string, estimate: Record<string, unknown>) => fasttractApi("/v1/estimates", {
    method: "POST",
    organizationId,
    body: JSON.stringify(estimate),
  }),

  listInvoices: (organizationId?: string | null) => fasttractApi("/v1/invoices", { organizationId }),
  createInvoice: (organizationId: string, invoice: Record<string, unknown>) => fasttractApi("/v1/invoices", {
    method: "POST",
    organizationId,
    body: JSON.stringify(invoice),
  }),

  clockIn: (organizationId: string, payload: { job_id: string; latitude?: number; longitude?: number; note?: string }) => fasttractApi("/v1/time/clock-in", {
    method: "POST",
    organizationId,
    body: JSON.stringify(payload),
  }),
  clockOut: (organizationId: string, payload: { latitude?: number; longitude?: number; note?: string } = {}) => fasttractApi("/v1/time/clock-out", {
    method: "POST",
    organizationId,
    body: JSON.stringify(payload),
  }),
};
