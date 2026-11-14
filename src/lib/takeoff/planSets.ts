import { supabase } from "@/integrations/supabase/client";
import { renderPdfPages } from "./pdf";

// Plan tables are new in the takeoff migration; typed loosely until Supabase types are regenerated.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export interface PlanSheetRow {
  id: string; plan_set_id: string; organization_id: string; page_number: number; storage_path: string;
  width_px: number; height_px: number; kind: "unsorted" | "foundation" | "details" | "notes" | "other";
  sheet_label: string | null; include_in_reading: boolean; scale_px_per_ft: number | null; markup: MarkupItem[];
}

export type MarkupItem =
  | { type: "run"; id: string; elementId: string | null; points: [number, number][] }
  | { type: "calibration"; a: [number, number]; b: [number, number]; feet: number };

export interface PlanSetRow {
  id: string; organization_id: string; job_id: string | null; title: string;
  status: "uploaded" | "reading" | "review" | "confirmed" | "failed"; page_count: number;
  takeoff_draft: unknown; takeoff_confirmed: unknown; settings: Record<string, number>; last_error: string | null;
  estimate_id: string | null; created_at: string;
}

/** Creates a plan set from a PDF: renders each page, uploads the images, records the sheets. */
export async function createPlanSet(args: { organizationId: string; jobId?: string | null; title: string; file: File; userId: string; onProgress?: (msg: string) => void }) {
  const { organizationId, jobId, title, file, userId, onProgress } = args;
  if (file.type && file.type !== "application/pdf") throw new Error("Upload the plans as a PDF");
  onProgress?.("Reading the PDF…");
  const pages = await renderPdfPages(file, { onPage: (n, total) => onProgress?.(`Preparing page ${n} of ${total}…`) });

  const { data: set, error } = await db.from("plan_sets")
    .insert({ organization_id: organizationId, job_id: jobId ?? null, title, page_count: pages.length, created_by: userId })
    .select("id").single();
  if (error) throw error;

  const rows = [];
  for (const p of pages) {
    onProgress?.(`Uploading page ${p.page} of ${pages.length}…`);
    const path = `${organizationId}/${set.id}/page-${p.page}.jpg`;
    const up = await supabase.storage.from("plan-sets").upload(path, p.blob, { contentType: "image/jpeg", upsert: true });
    if (up.error) throw up.error;
    rows.push({ plan_set_id: set.id, organization_id: organizationId, page_number: p.page, storage_path: path, width_px: p.width, height_px: p.height });
  }
  const { error: sheetError } = await db.from("plan_sheets").insert(rows);
  if (sheetError) throw sheetError;
  return set.id as string;
}

export async function sheetImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("plan-sets").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export const TAKEOFF_STATUS: Record<PlanSetRow["status"], string> = {
  uploaded: "Ready to read",
  reading: "Reading plans…",
  review: "Needs review",
  confirmed: "Confirmed",
  failed: "Reading failed",
};
