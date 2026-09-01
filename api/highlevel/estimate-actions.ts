import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

type SendAction = "sms_and_email" | "email" | "sms" | "send_manually";
const ACTIONS: SendAction[] = ["sms_and_email", "email", "sms", "send_manually"];

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const connection = await resolveHighLevelConnection(req);
    const estimateId = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    if (!estimateId) return json(res, 400, { error: "Missing estimate id" });

    const requested = req.body?.channel as SendAction;
    const action: SendAction = ACTIONS.includes(requested) ? requested : "sms_and_email";
    const userId = connection.userId || process.env.GHL_USER_ID;
    if (!userId) {
      return json(res, 400, {
        error: "HighLevel requires a user id to send estimates. Open FastTract inside HighLevel or set GHL_USER_ID for single-location testing.",
      });
    }

    const result = await highLevelRequest(`/invoices/estimate/${encodeURIComponent(estimateId)}/send`, {
      method: "POST",
      token: connection.token,
      body: {
        altId: connection.locationId,
        altType: "location",
        action,
        liveMode: true,
        userId,
        estimateName: typeof req.body?.name === "string" && req.body.name.trim()
          ? req.body.name.trim().slice(0, 200)
          : "FastTract Estimate",
      },
    });

    return json(res, 200, result);
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not send that estimate.");
  }
}
