import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

type InvoiceAction = "convert_estimate" | "send_invoice" | "record_payment";
type DeliveryChannel = "sms_and_email" | "email" | "sms" | "send_manually";
type PaymentMode = "cash" | "card" | "cheque" | "bank_transfer" | "other";

const DELIVERY_CHANNELS: DeliveryChannel[] = [
  "sms_and_email",
  "email",
  "sms",
  "send_manually",
];

const PAYMENT_MODES: PaymentMode[] = [
  "cash",
  "card",
  "cheque",
  "bank_transfer",
  "other",
];

function invoiceRecord(value: any) {
  return value?.invoice ?? value?.data?.invoice ?? value?.data ?? value;
}

function invoiceAmountDue(invoice: any) {
  const explicit = Number(invoice?.amountDue);
  if (Number.isFinite(explicit)) return Math.max(explicit, 0);
  const total = Math.max(Number(invoice?.total) || 0, 0);
  const paid = Math.max(Number(invoice?.amountPaid) || 0, 0);
  return Math.max(total - paid, 0);
}

async function getInvoice(
  invoiceId: string,
  locationId: string,
  token: string,
) {
  const result = await highLevelRequest<any>(
    `/invoices/${encodeURIComponent(invoiceId)}?altId=${encodeURIComponent(locationId)}&altType=location`,
    { token },
  );
  const invoice = invoiceRecord(result);
  if (invoice?.altId && invoice.altId !== locationId) {
    throw new Error("Invoice does not belong to this HighLevel sub-account");
  }
  return invoice;
}

function paymentPayload(body: any, invoice: any, locationId: string) {
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Payment amount must be greater than zero");
  }

  const amountDue = invoiceAmountDue(invoice);
  if (amountDue <= 0) throw new Error("This invoice does not have an open balance");
  if (amount > amountDue + 0.009) {
    throw new Error(`Payment cannot exceed the open balance of ${amountDue.toFixed(2)}`);
  }

  const requestedMode = typeof body?.mode === "string" ? body.mode : "";
  if (!PAYMENT_MODES.includes(requestedMode as PaymentMode)) {
    throw new Error("Choose a valid payment method");
  }
  const mode = requestedMode as PaymentMode;

  const fulfilledAt = body?.fulfilledAt ? new Date(body.fulfilledAt) : new Date();
  if (Number.isNaN(fulfilledAt.getTime())) throw new Error("Payment date is invalid");
  if (fulfilledAt.getTime() > Date.now() + 5 * 60_000) {
    throw new Error("Payment date cannot be in the future");
  }

  const payload: Record<string, unknown> = {
    altId: locationId,
    altType: "location",
    mode,
    notes: typeof body?.notes === "string" && body.notes.trim()
      ? body.notes.trim().slice(0, 1000)
      : "Payment recorded in FastTract",
    amount: Math.round(amount * 100) / 100,
    meta: { source: "FastTract" },
    fulfilledAt: fulfilledAt.toISOString(),
  };

  if (mode === "card") {
    const last4 = typeof body?.cardLast4 === "string" ? body.cardLast4.replace(/\D/g, "") : "";
    if (last4.length !== 4) throw new Error("Enter the last four digits of the card");
    payload.card = {
      brand: typeof body?.cardBrand === "string" && body.cardBrand.trim()
        ? body.cardBrand.trim().slice(0, 40)
        : "card",
      last4,
    };
  }

  if (mode === "cheque") {
    const number = typeof body?.chequeNumber === "string" ? body.chequeNumber.trim() : "";
    if (!number) throw new Error("Enter the cheque number");
    payload.cheque = { number: number.slice(0, 80) };
  }

  const scheduleIds = Array.isArray(body?.paymentScheduleIds)
    ? body.paymentScheduleIds.filter((value: unknown): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  if (scheduleIds.length > 0) payload.paymentScheduleIds = scheduleIds;

  return payload;
}

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

      const result = await highLevelRequest<any>(
        `/invoices/?${params.toString()}`,
        { token: connection.token },
      );
      const invoices = Array.isArray(result?.invoices)
        ? result.invoices
        : Array.isArray(result?.data)
          ? result.data
          : [];

      return json(res, 200, {
        ...result,
        invoices,
        total: Number(result?.total ?? result?.meta?.total ?? invoices.length) || 0,
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

        await getInvoice(invoiceId, connection.locationId, connection.token);
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

      if (action === "record_payment") {
        const invoiceId = typeof req.body?.invoiceId === "string"
          ? req.body.invoiceId.trim()
          : "";
        if (!invoiceId) return json(res, 400, { error: "Missing invoice id" });

        const invoice = await getInvoice(invoiceId, connection.locationId, connection.token);
        const payload = paymentPayload(req.body, invoice, connection.locationId);
        const result = await highLevelRequest<any>(
          `/invoices/${encodeURIComponent(invoiceId)}/record-payment`,
          {
            method: "POST",
            token: connection.token,
            body: payload,
          },
        );
        return json(res, 200, {
          ...result,
          invoice: invoiceRecord(result),
        });
      }

      return json(res, 400, { error: "Unsupported invoice action" });
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    if (
      error instanceof Error
      && error.message.includes("does not belong to this HighLevel sub-account")
    ) {
      return json(res, 403, { error: "Invoice is outside the active HighLevel sub-account." });
    }
    return respondHighLevelError(res, error, "FastTract could not complete that invoice action.");
  }
}
