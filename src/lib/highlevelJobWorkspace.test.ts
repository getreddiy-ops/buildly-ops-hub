import { describe, expect, it } from "vitest";
import type { HighLevelRecord } from "@/integrations/highlevel/client";
import {
  jobName,
  jobStatus,
  materialPropertyKeys,
  recordBelongsToJob,
  sortJobs,
  summarizeJobCosts,
  timePropertyKeys,
} from "./highlevelJobWorkspace";

function record(id: string, properties: Record<string, unknown>): HighLevelRecord {
  return { id, properties };
}

describe("highlevelJobWorkspace", () => {
  it("reads legacy and current property-key shapes", () => {
    const job = record("job-1", {
      "custom_objects.jobs.job_name": "Fletcher driveway",
      "custom_object.jobs.status": "on_hold",
    });

    expect(jobName(job)).toBe("Fletcher driveway");
    expect(jobStatus(job)).toBe("on_hold");
  });

  it("calculates labor, material, and total recorded cost", () => {
    const timeEntries = [
      record("time-1", { hours: 8, labor_rate: 100, labor_cost: 800 }),
      record("time-2", { hours: 2.5, labor_rate: 80 }),
    ];
    const materials = [
      record("material-1", { quantity: 3, unit_cost: 150 }),
      record("material-2", { quantity: 12, unit_cost: 4.5 }),
    ];

    expect(summarizeJobCosts(timeEntries, materials)).toEqual({
      laborHours: 10.5,
      laborCost: 1000,
      materialCost: 504,
      totalCost: 1504,
    });
  });

  it("keeps active and on-hold work ahead of scheduled and complete jobs", () => {
    const jobs = [
      record("complete", { job_name: "Complete", status: "complete" }),
      record("scheduled-later", { job_name: "Later", status: "scheduled", start_date: "2026-09-20" }),
      record("active", { job_name: "Active", status: "active" }),
      record("on-hold", { job_name: "Hold", status: "on_hold" }),
      record("scheduled-sooner", { job_name: "Sooner", status: "scheduled", start_date: "2026-09-05" }),
    ];

    expect(sortJobs(jobs).map((job) => job.id)).toEqual([
      "active",
      "on-hold",
      "scheduled-sooner",
      "scheduled-later",
      "complete",
    ]);
  });

  it("links labor and material records to the correct job id", () => {
    expect(recordBelongsToJob(record("time", { job_id: "job-a" }), "job-a", timePropertyKeys.jobId)).toBe(true);
    expect(recordBelongsToJob(record("material", { "custom_object.materials.job_id": "job-b" }), "job-b", materialPropertyKeys.jobId)).toBe(true);
    expect(recordBelongsToJob(record("other", { job_id: "job-c" }), "job-a", timePropertyKeys.jobId)).toBe(false);
  });
});
