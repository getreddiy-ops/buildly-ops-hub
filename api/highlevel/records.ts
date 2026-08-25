import {
  getHighLevelLocationId,
  highLevelRequest,
  json,
} from "./_shared";

const OBJECT_KEYS: Record<string, string> = {
  jobs: "custom_objects.jobs",
  time_entries: "custom_objects.time_entries",
  materials: "custom_objects.materials",
};

function resolveObjectKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return OBJECT_KEYS[value] ?? null;
}

export default async function handler(req: any, res: any) {
  const objectKey = resolveObjectKey(req.query?.object);
  if (!objectKey) {
    return json(res, 400, {
      error: "Invalid object. Use jobs, time_entries, or materials.",
    });
  }

  try {
    const locationId = getHighLevelLocationId();

    if (req.method === "GET") {
      const query = typeof req.query?.q === "string" ? req.query.q : "";
      const page = Number(req.query?.page || 1);
      const pageLimit = Math.min(Number(req.query?.limit || 25), 100);

      const result = await highLevelRequest(
        `/objects/${encodeURIComponent(objectKey)}/records/search`,
        {
          method: "POST",
          body: {
            locationId,
            page,
            pageLimit,
            query,
            searchAfter: [],
          },
        },
      );

      return json(res, 200, result);
    }

    if (req.method === "POST") {
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const result = await highLevelRequest(
        `/objects/${encodeURIComponent(objectKey)}/records`,
        {
          method: "POST",
          body: {
            ...body,
            locationId,
          },
        },
      );

      return json(res, 201, result);
    }

    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Method not allowed" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Unknown HighLevel error",
    });
  }
}
