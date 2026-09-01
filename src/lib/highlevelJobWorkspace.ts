import type { HighLevelRecord } from "@/integrations/highlevel/client";

export type FastTractJobStatus = "lead" | "scheduled" | "active" | "complete" | "on_hold";

export const jobPropertyKeys = {
  name: ["custom_objects.jobs.job_name", "custom_object.jobs.job_name", "job_name", "name", "title"],
  status: ["custom_objects.jobs.status", "custom_object.jobs.status", "status"],
  address: ["custom_objects.jobs.address", "custom_object.jobs.address", "address"],
  startDate: ["custom_objects.jobs.start_date", "custom_object.jobs.start_date", "start_date"],
  notes: ["custom_objects.jobs.notes", "custom_object.jobs.notes", "notes"],
  customerId: ["custom_objects.jobs.customer_id", "custom_object.jobs.customer_id", "customer_id"],
  estimateId: ["custom_objects.jobs.estimate_id", "custom_object.jobs.estimate_id", "estimate_id"],
  invoiceId: ["custom_objects.jobs.invoice_id", "custom_object.jobs.invoice_id", "invoice_id"],
} as const;

export const timePropertyKeys = {
  description: ["custom_objects.time_entries.description", "custom_object.time_entries.description", "description", "name"],
  jobId: ["custom_objects.time_entries.job_id", "custom_object.time_entries.job_id", "job_id"],
  workerName: ["custom_objects.time_entries.worker_name", "custom_object.time_entries.worker_name", "worker_name"],
  workDate: ["custom_objects.time_entries.work_date", "custom_object.time_entries.work_date", "work_date"],
  hours: ["custom_objects.time_entries.hours", "custom_object.time_entries.hours", "hours"],
  laborRate: ["custom_objects.time_entries.labor_rate", "custom_object.time_entries.labor_rate", "labor_rate"],
  laborCost: ["custom_objects.time_entries.labor_cost", "custom_object.time_entries.labor_cost", "labor_cost"],
  notes: ["custom_objects.time_entries.notes", "custom_object.time_entries.notes", "notes"],
} as const;

export const materialPropertyKeys = {
  name: ["custom_objects.materials.material_name", "custom_object.materials.material_name", "material_name", "name"],
  jobId: ["custom_objects.materials.job_id", "custom_object.materials.job_id", "job_id"],
  quantity: ["custom_objects.materials.quantity", "custom_object.materials.quantity", "quantity"],
  unit: ["custom_objects.materials.unit", "custom_object.materials.unit", "unit"],
  unitCost: ["custom_objects.materials.unit_cost", "custom_object.materials.unit_cost", "unit_cost"],
  supplier: ["custom_objects.materials.supplier", "custom_object.materials.supplier", "supplier"],
  notes: ["custom_objects.materials.notes", "custom_object.materials.notes", "notes"],
} as const;

export function readRecordString(record: HighLevelRecord, keys: readonly string[]) {
  const properties = record.properties ?? {};
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

export function readRecordNumber(record: HighLevelRecord, keys: readonly string[]) {
  const raw = readRecordString(record, keys);
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function jobStatus(record: HighLevelRecord): FastTractJobStatus {
  const value = readRecordString(record, jobPropertyKeys.status).toLowerCase();
  if (value === "lead" || value === "scheduled" || value === "active" || value === "complete" || value === "on_hold") return value;
  if (value === "completed") return "complete";
  if (value === "on hold") return "on_hold";
  return "scheduled";
}

export function jobName(record: HighLevelRecord) {
  return readRecordString(record, jobPropertyKeys.name) || "Untitled job";
}

export function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function recordBelongsToJob(record: HighLevelRecord, jobId: string, keys: readonly string[]) {
  return readRecordString(record, keys) === jobId;
}

export function summarizeJobCosts(timeEntries: HighLevelRecord[], materials: HighLevelRecord[]) {
  const laborHours = timeEntries.reduce((sum, entry) => sum + readRecordNumber(entry, timePropertyKeys.hours), 0);
  const laborCost = timeEntries.reduce((sum, entry) => {
    const explicit = readRecordNumber(entry, timePropertyKeys.laborCost);
    if (explicit > 0) return sum + explicit;
    return sum
      + readRecordNumber(entry, timePropertyKeys.hours)
      * readRecordNumber(entry, timePropertyKeys.laborRate);
  }, 0);
  const materialCost = materials.reduce((sum, material) => (
    sum
    + readRecordNumber(material, materialPropertyKeys.quantity)
    * readRecordNumber(material, materialPropertyKeys.unitCost)
  ), 0);

  return {
    laborHours,
    laborCost,
    materialCost,
    totalCost: laborCost + materialCost,
  };
}

export function sortJobs(records: HighLevelRecord[]) {
  const rank: Record<FastTractJobStatus, number> = {
    active: 0,
    on_hold: 1,
    scheduled: 2,
    lead: 3,
    complete: 4,
  };

  return [...records].sort((a, b) => {
    const statusDifference = rank[jobStatus(a)] - rank[jobStatus(b)];
    if (statusDifference !== 0) return statusDifference;
    const aStart = Date.parse(readRecordString(a, jobPropertyKeys.startDate));
    const bStart = Date.parse(readRecordString(b, jobPropertyKeys.startDate));
    const aValue = Number.isFinite(aStart) ? aStart : Number.MAX_SAFE_INTEGER;
    const bValue = Number.isFinite(bStart) ? bStart : Number.MAX_SAFE_INTEGER;
    if (aValue !== bValue) return aValue - bValue;
    return jobName(a).localeCompare(jobName(b));
  });
}
