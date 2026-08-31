import {
  ensureFastTractPipeline,
  highLevelRequest,
  json,
  requirePost,
  resolveHighLevelConnection,
  respondHighLevelError,
} from "./_shared";

type HighLevelObject = { key: string };
type ObjectListResponse = { objects?: HighLevelObject[] };
type CustomField = { id?: string; fieldKey?: string; key?: string };
type CustomFieldList = { fields?: CustomField[]; customFields?: CustomField[]; folders?: Array<{ id?: string; name?: string }> };

type FieldDefinition = {
  key: string;
  name: string;
  dataType: "TEXT" | "LARGE_TEXT" | "NUMERICAL" | "MONETORY" | "DATE" | "PHONE";
  description: string;
};

type ObjectDefinition = {
  key: string;
  labels: { singular: string; plural: string };
  description: string;
  primaryDisplayPropertyDetails: { key: string; name: string; dataType: "TEXT" };
  folderName: string;
  fields: FieldDefinition[];
};

const FASTTRACT_OBJECTS: ObjectDefinition[] = [
  {
    key: "custom_objects.jobs",
    labels: { singular: "Job", plural: "Jobs" },
    description: "FastTract contractor jobs and project records",
    primaryDisplayPropertyDetails: {
      key: "custom_objects.jobs.job_name",
      name: "Job Name",
      dataType: "TEXT",
    },
    folderName: "FastTract Job Details",
    fields: [
      { key: "status", name: "Status", dataType: "TEXT", description: "FastTract job status" },
      { key: "address", name: "Job Address", dataType: "TEXT", description: "Job-site address" },
      { key: "start_date", name: "Start Date", dataType: "DATE", description: "Planned job start date" },
      { key: "notes", name: "Scope and Notes", dataType: "LARGE_TEXT", description: "Job scope, access, and crew notes" },
      { key: "customer_id", name: "Customer ID", dataType: "TEXT", description: "Associated HighLevel contact id" },
      { key: "estimate_id", name: "Estimate ID", dataType: "TEXT", description: "Associated HighLevel estimate id" },
    ],
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
    folderName: "FastTract Time Details",
    fields: [
      { key: "job_id", name: "Job ID", dataType: "TEXT", description: "Associated FastTract job id" },
      { key: "worker_name", name: "Worker Name", dataType: "TEXT", description: "Crew member or worker" },
      { key: "work_date", name: "Work Date", dataType: "DATE", description: "Date the work was performed" },
      { key: "hours", name: "Hours", dataType: "NUMERICAL", description: "Approved labor hours" },
      { key: "labor_rate", name: "Labor Rate", dataType: "MONETORY", description: "Labor rate per hour" },
      { key: "labor_cost", name: "Labor Cost", dataType: "MONETORY", description: "Calculated labor cost" },
      { key: "notes", name: "Notes", dataType: "LARGE_TEXT", description: "Time-entry notes" },
    ],
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
    folderName: "FastTract Material Details",
    fields: [
      { key: "job_id", name: "Job ID", dataType: "TEXT", description: "Associated FastTract job id" },
      { key: "quantity", name: "Quantity", dataType: "NUMERICAL", description: "Material quantity" },
      { key: "unit", name: "Unit", dataType: "TEXT", description: "Unit of measure" },
      { key: "unit_cost", name: "Unit Cost", dataType: "MONETORY", description: "Material cost per unit" },
      { key: "supplier", name: "Supplier", dataType: "TEXT", description: "Material supplier" },
      { key: "notes", name: "Notes", dataType: "LARGE_TEXT", description: "Material notes" },
    ],
  },
];

function customFieldObjectKey(schemaKey: string) {
  return schemaKey.replace(/^custom_objects\./, "custom_object.");
}

async function ensureObjectFields(
  definition: ObjectDefinition,
  locationId: string,
  token: string,
) {
  const current = await highLevelRequest<CustomFieldList>(
    `/custom-fields/object-key/${encodeURIComponent(definition.key)}?locationId=${encodeURIComponent(locationId)}`,
    { token },
  );

  const listedFields = current.fields ?? current.customFields ?? [];
  const existing = new Set(listedFields.map((field) => field.fieldKey ?? field.key).filter(Boolean));
  let folderId = current.folders?.find((folder) => folder.name === definition.folderName)?.id;

  if (!folderId) {
    const createdFolder = await highLevelRequest<any>("/custom-fields/folder", {
      method: "POST",
      token,
      body: {
        objectKey: customFieldObjectKey(definition.key),
        name: definition.folderName,
        locationId,
      },
    });
    folderId = createdFolder?.id ?? createdFolder?.folder?.id;
  }

  if (!folderId) throw new Error(`HighLevel did not return a custom-field folder for ${definition.key}`);

  const created: string[] = [];
  const skipped: string[] = [];
  for (const field of definition.fields) {
    const fieldKey = `${customFieldObjectKey(definition.key)}.${field.key}`;
    if (existing.has(fieldKey)) {
      skipped.push(fieldKey);
      continue;
    }

    await highLevelRequest("/custom-fields/", {
      method: "POST",
      token,
      body: {
        locationId,
        name: field.name,
        description: field.description,
        placeholder: field.name,
        showInForms: true,
        dataType: field.dataType,
        fieldKey,
        objectKey: customFieldObjectKey(definition.key),
        parentId: folderId,
      },
    });
    created.push(fieldKey);
  }

  return { created, skipped };
}

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
        try {
          if (!existing.has(definition.key)) {
            await highLevelRequest("/objects/", {
              method: "POST",
              token,
              body: { ...definition, fields: undefined, folderName: undefined, locationId },
            });
            created.push(definition.key);
          } else {
            skipped.push(definition.key);
          }

          const fields = await ensureObjectFields(definition, locationId, token);
          created.push(...fields.created);
          skipped.push(...fields.skipped);
        } catch (error) {
          errors.push(`${definition.key}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    } catch (error) {
      errors.push(`Custom objects: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    return json(res, 200, {
      ok: errors.length === 0,
      locationId,
      mode,
      pipeline,
      created,
      skipped,
      errors,
      nativeRecords: ["contacts", "opportunities", "estimates", "invoices", "calendars", "conversations"],
      message: "FastTract is configured for this HighLevel sub-account.",
    });
  } catch (error) {
    return respondHighLevelError(res, error, "FastTract could not initialize this HighLevel sub-account.");
  }
}
