import {
  highLevelRequest,
  json,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

export default async function handler(req: any, res: any) {
  try {
    const { locationId, token } = await resolveHighLevelConnection(req);

    if (req.method === "GET") {
      const params = new URLSearchParams({
        locationId,
        page: String(Math.max(1, Number(req.query?.page || 1))),
        limit: String(Math.min(Math.max(1, Number(req.query?.limit || 25)), 100)),
      });

      if (typeof req.query?.q === "string" && req.query.q.trim()) params.set("q", req.query.q.trim().slice(0, 75));
      if (typeof req.query?.pipelineId === "string") params.set("pipelineId", req.query.pipelineId);
      if (typeof req.query?.pipelineStageId === "string") params.set("pipelineStageId", req.query.pipelineStageId);
      if (typeof req.query?.contactId === "string") params.set("contactId", req.query.contactId);
      if (typeof req.query?.status === "string") params.set("status", req.query.status);

      const result = await highLevelRequest(`/opportunities/search?${params.toString()}`, { token });
      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const result = await highLevelRequest("/opportunities/", {
        method: "POST",
        token,
        body: { ...body, locationId },
      });
      return json(res, 201, result);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not complete that opportunity action.");
  }
}
