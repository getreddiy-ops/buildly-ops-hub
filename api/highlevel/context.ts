import { json, resolveHighLevelConnection } from "./_shared";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  try {
    const connection = await resolveHighLevelConnection(req);
    return json(res, 200, {
      connected: true,
      mode: connection.mode,
      locationId: connection.locationId,
      companyId: connection.companyId ?? null,
      user: connection.context
        ? {
            id: connection.context.userId,
            name: connection.context.userName ?? null,
            email: connection.context.email ?? null,
            role: connection.context.role ?? null,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HighLevel error";
    return json(res, 401, { connected: false, error: message });
  }
}
