import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
} from "./_shared";

type EstimateLineInput = {
  description: string;
  quantity: number;
  unit_price: number;
};

type EstimateInput = {
  title?: string;
  customer_id?: string;
  contactId?: string;
  notes?: string | null;
  tax_percent?: number;
  taxPercent?: number;
  line_items?: EstimateLineInput[];
  items?: EstimateLineInput[];
};

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeLineItems(body: EstimateInput) {
  const source = body.line_items ?? body.items ?? [];
  const taxPercent = Math.max(0, Number(body.taxPercent ?? body.tax_percent ?? 0) || 0);
  const taxes = taxPercent > 0
    ? [{ name: "Tax", rate: taxPercent, calculation: "exclusive", description: "FastTract estimate tax" }]
    : [];

  return source
    .filter((item) => item && typeof item.description === "string" && item.description.trim())
    .map((item) => ({
      name: item.description.trim().slice(0, 200),
      description: item.description.trim(),
      currency: "USD",
      amount: Number(item.unit_price) || 0,
      qty: Number(item.quantity) || 0,
      taxes,
      type: "one_time",
      taxInclusive: false,
    }));
}

async function getEstimateParties(locationId: string, contactId: string, token: string) {
  const [locationResult, contactResult] = await Promise.all([
    highLevelRequest<{ location: any }>(`/locations/${encodeURIComponent(locationId)}`, { token }),
    highLevelRequest<{ contact: any }>(`/contacts/${encodeURIComponent(contactId)}`, { token }),
  ]);

  const location = locationResult.location ?? {};
  const contact = contactResult.contact ?? {};
  if (contact.locationId && contact.locationId !== locationId) {
    throw new Error("Estimate contact does not belong to this HighLevel sub-account");
  }

  return {
    businessDetails: {
      logoUrl: location.logoUrl || undefined,
      name: location.name || "FastTract Contractor",
      phoneNo: location.phone || undefined,
      website: location.website || undefined,
      address: {
        addressLine1: location.address || "",
        city: location.city || "",
        state: location.state || "",
        countryCode: location.country || "US",
        postalCode: location.postalCode || "",
      },
      customValues: [],
    },
    contactDetails: {
      id: contact.id,
      name: contact.name || [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "Customer",
      phoneNo: contact.phone || undefined,
      email: contact.email || undefined,
      additionalEmails: [],
      companyName: contact.companyName || undefined,
      address: {
        addressLine1: contact.address1 || "",
        addressLine2: contact.address2 || "",
        city: contact.city || "",
        state: contact.state || "",
        countryCode: contact.country || "US",
        postalCode: contact.postalCode || "",
      },
      customFields: [],
    },
  };
}

async function buildEstimatePayload(body: EstimateInput, locationId: string, token: string) {
  const contactId = body.contactId ?? body.customer_id;
  if (!contactId) throw new Error("Estimate requires a HighLevel customer/contact id");
  if (!body.title?.trim()) throw new Error("Estimate title is required");

  const items = normalizeLineItems(body);
  if (items.length === 0) throw new Error("Estimate requires at least one line item");

  const parties = await getEstimateParties(locationId, contactId, token);
  const issueDate = new Date();
  const expiryDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
  const taxPercent = Math.max(0, Number(body.taxPercent ?? body.tax_percent ?? 0) || 0);

  return {
    altId: locationId,
    altType: "location",
    name: body.title.trim(),
    title: "ESTIMATE",
    ...parties,
    currency: "USD",
    items,
    liveMode: true,
    discount: { value: 0, type: "percentage" },
    termsNotes: body.notes || "",
    issueDate: dateOnly(issueDate),
    expiryDate: dateOnly(expiryDate),
    automaticTaxesEnabled: false,
    meta: { source: "FastTract", taxPercent },
    frequencySettings: { enabled: false },
    estimateNumberPrefix: "EST-",
    autoInvoice: { enabled: false, directPayments: false },
  };
}

export default async function handler(req: any, res: any) {
  try {
    const { locationId, token } = await resolveHighLevelConnection(req);
    const estimateId = typeof req.query?.id === "string" ? req.query.id : null;

    if (req.method === "GET") {
      const params = new URLSearchParams({
        altId: locationId,
        altType: "location",
        limit: String(Math.min(Number(req.query?.limit || 100), 100)),
        offset: String(Math.max(Number(req.query?.offset || 0), 0)),
      });
      if (typeof req.query?.q === "string" && req.query.q.trim()) params.set("search", req.query.q.trim());
      if (typeof req.query?.status === "string" && req.query.status.trim()) params.set("status", req.query.status.trim());
      if (typeof req.query?.contactId === "string" && req.query.contactId.trim()) params.set("contactId", req.query.contactId.trim());
      const result = await highLevelRequest(`/invoices/estimate/list?${params.toString()}`, { token });
      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const body: EstimateInput = req.body && typeof req.body === "object" ? req.body : {};
      const payload = await buildEstimatePayload(body, locationId, token);
      const result = await highLevelRequest("/invoices/estimate", { method: "POST", token, body: payload });
      return json(res, 201, result);
    }

    if (req.method === "PUT") {
      if (!estimateId) return json(res, 400, { error: "Missing estimate id" });
      const body: EstimateInput = req.body && typeof req.body === "object" ? req.body : {};
      const payload = await buildEstimatePayload(body, locationId, token);
      const result = await highLevelRequest(`/invoices/estimate/${encodeURIComponent(estimateId)}`, { method: "PUT", token, body: payload });
      return json(res, 200, result);
    }

    if (req.method === "DELETE") {
      if (!estimateId) return json(res, 400, { error: "Missing estimate id" });
      const result = await highLevelRequest(`/invoices/estimate/${encodeURIComponent(estimateId)}`, {
        method: "DELETE",
        token,
        body: { altId: locationId, altType: "location" },
      });
      return json(res, 200, result);
    }

    res.setHeader("Allow", "GET, POST, PUT, DELETE");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HighLevel estimate error";
    const status = message.includes("context is required") || message.includes("GHL_APP_SHARED_SECRET") ? 401 : 500;
    return json(res, status, { error: message });
  }
}
