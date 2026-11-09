// Crew PDF for a confirmed takeoff (launch plan Phase 7.5): cover page with quantities, the bar
// schedule, bolts and plan gaps, then every marked-up sheet with form lines, bolt marks and proposed
// pour breaks drawn on it.
import { jsPDF } from "jspdf";
import type { PlanTakeoff } from "../../../supabase/functions/_shared/takeoff-schema";
import type { MarkupItem, PlanSheetRow } from "./planSets";
import type { TakeoffSummary } from "./quantities";
import { BOLT_COLOR, BREAK_COLOR, FORM_COLOR, runOverlay } from "@/components/takeoff/SheetMarkup";

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load a plan page for the PDF"));
    img.src = url;
  });
}

async function markedSheetJpeg(sheet: PlanSheetRow, url: string, takeoff: PlanTakeoff, summary: TakeoffSummary): Promise<string> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = sheet.width_px;
  canvas.height = sheet.height_px;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const stroke = Math.max(2, canvas.width / 600);
  for (const run of (sheet.markup ?? []).filter((m): m is Extract<MarkupItem, { type: "run" }> => m.type === "run")) {
    const o = runOverlay(run, sheet, takeoff, summary);
    ctx.strokeStyle = FORM_COLOR; ctx.lineWidth = stroke * 2; ctx.globalAlpha = 0.85;
    ctx.beginPath(); run.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = BOLT_COLOR;
    for (const [x, y] of o.bolts) { ctx.beginPath(); ctx.arc(x, y, stroke * 2.2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = BREAK_COLOR; ctx.lineWidth = stroke * 1.5; ctx.setLineDash([stroke * 2]);
    for (const [x, y] of o.breaks) ctx.strokeRect(x - stroke * 4, y - stroke * 4, stroke * 8, stroke * 8);
    ctx.setLineDash([]);
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}

export async function buildCrewPdf(args: { title: string; businessName: string; takeoff: PlanTakeoff; summary: TakeoffSummary; sheets: { sheet: PlanSheetRow; url: string }[] }): Promise<Blob> {
  const { title, businessName, takeoff, summary, sheets } = args;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 40;
  let y = M;
  const line = (text: string, size = 10, bold = false, gap = 4) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const part of doc.splitTextToSize(text, W - 2 * M) as string[]) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(part, M, y); y += size + gap;
    }
  };
  const table = (head: string[], rows: string[][], widths: number[]) => {
    const row = (cells: string[], bold: boolean) => {
      if (y > H - M - 14) { doc.addPage(); y = M; }
      doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(9);
      let x = M;
      cells.forEach((c, i) => { doc.text(String(c), x, y, { maxWidth: widths[i] - 4 }); x += widths[i]; });
      y += 13;
    };
    row(head, true); rows.forEach((r) => row(r, false)); y += 6;
  };

  line(`${businessName}: ${title}`, 16, true, 8);
  line(`Concrete takeoff for the crew · ${new Date().toLocaleDateString()}`, 10, false, 10);
  line("Read from the drawings. Items marked \"not on plans\" and proposed pour breaks must be confirmed with the engineer before pouring.", 9, false, 12);

  line("Quantities", 12, true);
  table(["Item", "Quantity"], [
    ["Concrete (neat)", `${summary.concreteYardsNeat} yd`],
    ["Concrete to order", `${summary.concreteYardsOrder} yd`],
    ["Form line", `${summary.formLf} LF (${summary.formSfca} SFCA)`],
    ["Rebar", `${summary.rebarWeightLb} lb`],
    ["Anchor bolts", String(summary.bolts.reduce((a, b) => a + b.count, 0))],
    ...summary.holdDowns.map((h) => [`Hold-down ${h.model}`, String(h.count)]),
  ], [300, 232]);

  line("Bar schedule", 12, true);
  table(["Mark", "Size", "Pcs", "Cut length", "Total LF", "Lb", "Description"],
    summary.bars.map((b) => [b.mark, b.barSize, String(b.pieces), `${Math.floor(b.cutLengthIn / 12)}'-${Math.round(b.cutLengthIn % 12)}"`, String(b.totalLf), String(b.weightLb), b.description]),
    [52, 34, 34, 62, 52, 44, 254]);

  if (summary.bolts.length) {
    line("Anchor bolts", 12, true);
    table(["Run", "Count", "Spec"], summary.bolts.map((b) => [b.elementId, String(b.count), b.description]), [80, 50, 402]);
  }
  if (summary.pourBreaks.length) {
    line("Proposed pour breaks (confirm with engineer)", 12, true);
    for (const p of summary.pourBreaks) line(`${p.elementId}: ${p.note} Bulkheads: ${p.bulkheadLf} LF.`, 9);
  }
  if (summary.warnings.length) {
    line("Check before pouring", 12, true);
    for (const w of summary.warnings) line(`• ${w}`, 9, false, 3);
  }
  if (takeoff.constructionJointRule) line(`Construction joints per plans: "${takeoff.constructionJointRule}"`, 9);

  for (const { sheet, url } of sheets) {
    if (!(sheet.markup ?? []).some((m) => m.type === "run")) continue;
    const data = await markedSheetJpeg(sheet, url, takeoff, summary);
    const landscape = sheet.width_px > sheet.height_px;
    doc.addPage("letter", landscape ? "landscape" : "portrait");
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const s = Math.min((pw - 2 * M) / sheet.width_px, (ph - 2 * M - 20) / sheet.height_px);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`Page ${sheet.page_number}${sheet.sheet_label ? ` · Sheet ${sheet.sheet_label}` : ""}: orange = forms, blue = anchor bolts, dashed = proposed pour breaks`, M, M);
    doc.addImage(data, "JPEG", M, M + 12, sheet.width_px * s, sheet.height_px * s);
  }
  return doc.output("blob");
}
