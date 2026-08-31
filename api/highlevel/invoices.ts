import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

type InvoiceAction = "convert_estimate" | "send_invoice";
type DeliveryChannel = "sms_and_email" | "email" | "sms" | "send_manually";

const DELIVERY_CHANNELS: DeliveryChannel[] = [
  "sms_and_email",
  "email",
  "sms",
  "send_manually",
];

export default async function handler(req: any, res: any) {
  try {
    const connection = await resolveHighLevelConnection(req);

    if (req.method === "GET") {
      const params = new URLSearchParams({
        altId: connection.locationId,
        altType: "location",
        limit: String(Math.min(Math.max(Number(req.query?.limit || 100), 1), 100)),
        offset: String(Math.max(Number(req.query?.offset || 0), 0)),
        sortField: "issueDate",
        sortOrder: "descend",
      });

      if (typeof req.query?.q === "string" && req.query.q.trim()) {
        params.set("search", req.query.q.trim().slice(0, 100));
      }
      if (typeof req.query?.status === "string" && req.query.status.trim()) {
        params.set("status", req.query.status.trim());
      }
      if (typeof req.query?.contactId === "string" && req.query.contactId.trim()) {
        params.set("contactId", req.query.contactId.trim());
      }

      const result = await highLevelRequest<{
        invoices?: unknown[];
        total?: number;
      }>(`/invoices/?${params.toString()}`, { token: connection.token });

      return json(res, 200, {
        invoices: Array.isArray(result.invoices) ? result.invoices : [],
        total: Number(result.total) || 0,
      });
    }

    if (req.method === "POST") {
      const action = req.body?.action as InvoiceAction;

      if (action === "convert_estimate") {
        const estimateId = typeof req.body?.estimateId === "string"
          ? req.body.estimateId.trim()
          : "";
        if (!estimateId) return json(res, 400, { error: "Missing estimate id" });

        const result = await highLevelRequest(
          `/invoices/estimate/${encodeURIComponent(estimateId)}/invoice`,
          {
            method: "POST",
            token: connection.token,
            body: {
              altId: connection.locationId,
              altType: "location",
              markAsInvoiced: true,
              version: "v2",
            },
          },
        );
        return json(res, 200, result);
      }

      if (action === "send_invoice") {
        const invoiceId = typeof req.body?.invoiceId === "string"
          ? req.body.invoiceId.trim()
          : "";
        if (!invoiceId) return json(res, 400, { error: "Missing invoice id" });

        const requestedChannel = req.body?.channel as DeliveryChannel;
        const delivery: DeliveryChannel = DELIVERY_CHANNELS.includes(requestedChannel)
          ? requestedChannel
          : "sms_and_email";
        const userId = connection.userId || process.env.GHL_USER_ID;
        if (!userId) {
          return json(res, 400, {
            error: "FastTract needs an authorized HighLevel user before it can send this invoice.",
          });
        }

        const invoice = await highLevelRequest<any>(
          `/invoices/${encodeURIComponent(invoiceId)}?altId=${encodeURIComponent(connection.locationId)}&altType=location`,
          { token: connection.token },
        );
        if (invoice?.altId && invoice.altId !== connection.locationId) {
          return json(res, 403, { error: "Invoice does not belong to this HighLevel sub-account" });
        }

        const result = await highLevelRequest(
          `/invoices/${encodeURIComponent(invoiceId)}/send`,
          {
            method: "POST",
            token: connection.token,
            body: {
              altId: connection.locationId,
              altType: "location",
              userId,
              action: delivery,
              liveMode: true,
            },
          },
        );
        return json(res, 200, result);
      }

      return json(res, 400, { error: "Unsupported invoice action" });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not complete that invoice action.");
  }
}
