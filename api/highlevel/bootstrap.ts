import {
  ensureFastTractPipeline,
  highLevelRequest,
  json,
  requirePost,
  resolveHighLevelConnection,
} from "./_shared";

type HighLevelObject = {
  key: string;
};

type ObjectListResponse = {
  objects?: HighLevelObject[];
};

const FASTTRACT_OBJECTS = [
  {
    key: "custom_objects.jobs",
    labels: { singular: "Job", plural: "Jobs" },
    description: "FastTract contractor jobs and project records",
    primaryDisplayPropertyDetails: {
      key: "custom_objects.jobs.job_name",
      name: "Job Name",
      dataType: "TEXT",
    },
  },
  {
    key: "custom_objects.time_entries",
    labels: { singular: "Time Entry", plural: "Time Entries" },
    description: "FastTract employee and crew time records",
    primaryDisplayPropertyDetails: {
      key: "custom_objects.time_entries.description",
      name: "Description",
      dataType: "TEXT",
    },
  },
  {
    key: "custom_objects.materials",
    labels: { singular: "Material", plural: "Materials" },
    description: "FastTract job material and cost records",
    primaryDisplayPropertyDetails: {
      key: "custom_objects.materials.material_name",
      name: "Material Name",
      dataType: "TEXT",
    },
  },
] as const;

export default async function handler(req: any, res: any) {
  if (!requirePost(req, res)) return;

  try {
    const { locationId, token, mode } = await resolveHighLevelConnection(req);
    const errors: string[] = [];
    let pipeline: { id: string; name: string; stages: unknown[] } | null = null;

    try {
      pipeline = await ensureFastTractPipeline(locationId, token);
    } catch (error) {
      errors.push(`Sales pipeline: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const created: string[] = [];
    const skipped: string[] = [];

    try {
      const current = await highLevelRequest<ObjectListResponse>(
        `/objects/?locationId=${encodeURIComponent(locationId)}`,
        { token },
      );
      const existing = new Set((current.objects ?? []).map((item) => item.key));

      for (const definition of FASTTRACT_OBJECTS) {
        if (existing.has(definition.key)) {
          skipped.push(definition.key);
          continue;
        }

        try {
          await highLevelRequest("/objects/", {
            method: "POST",
            token,
            body: { ...definition, locationId },
          });
          created.push(definition.key);
        } catch (error) {
          errors.push(`${definition.key}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    } catch (error) {
      errors.push(`Custom objects: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    json(res, 200, {
      ok: errors.length === 0,
      locationId,
      mode,
      pipeline,
      created,
      skipped,
      errors,
      nativeRecords: ["contacts", "opportunities", "estimates", "invoices", "calendars", "conversations"],
      message: "FastTract is configured to use the active HighLevel sub-account as its primary business-data backend.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HighLevel error";
    const status = message.includes("context is required") || message.includes("GHL_APP_SHARED_SECRET") ? 401 : 500;
    json(res, status, { ok: false, error: message });
  }
}
