import { jsPDF } from "jspdf";

export type DocArgs = {
  doc_type: string;
  title: string;
  recipient?: { name?: string; company?: string; address?: string; email?: string; phone?: string };
  intro?: string;
  sections?: Array<{ heading: string; body: string }>;
  line_items?: Array<{ description: string; quantity: number; unit?: string; unit_price: number }>;
  tax_rate?: number;
  terms?: string;
  signature_block?: boolean;
};

export type OrgHeader = {
  name?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
};

const PAGE_W = 612; // pt (Letter)
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

export function generateDocumentPdf(args: DocArgs, org: OrgHeader = {}): { blob: Blob; filename: string } {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const writeWrapped = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gapAfter?: number } = {}) => {
    const size = opts.size ?? 10.5;
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...(opts.color ?? [30, 30, 30]));
    const lines = doc.splitTextToSize(text, CONTENT_W);
    const lineH = size * 1.35;
    for (const ln of lines) {
      ensureSpace(lineH);
      doc.text(ln, MARGIN, y);
      y += lineH;
    }
    y += opts.gapAfter ?? 0;
  };

  // ---- Header: org block (left) + doc type (right) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  if (org.name) doc.text(org.name, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  let orgY = y + 14;
  for (const line of [org.address, org.phone, org.email, org.website].filter(Boolean) as string[]) {
    doc.text(line, MARGIN, orgY);
    orgY += 12;
  }

  // Doc type badge on the right
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(217, 83, 30); // ember accent
  const typeLabel = args.doc_type.replace(/_/g, " ").toUpperCase();
  doc.text(typeLabel, PAGE_W - MARGIN, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(new Date().toLocaleDateString(), PAGE_W - MARGIN, y + 22, { align: "right" });

  y = Math.max(orgY, y + 40) + 10;

  // Divider
  doc.setDrawColor(220, 200, 180);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 18;

  // Title
  writeWrapped(args.title, { size: 16, bold: true, color: [25, 25, 25], gapAfter: 6 });

  // Recipient
  if (args.recipient && Object.values(args.recipient).some(Boolean)) {
    writeWrapped("Prepared for", { size: 9, color: [130, 130, 130], gapAfter: 2 });
    const r = args.recipient;
    const recipLines = [
      [r.name, r.company].filter(Boolean).join(" — "),
      r.address,
      [r.phone, r.email].filter(Boolean).join("  •  "),
    ].filter(Boolean) as string[];
    for (const ln of recipLines) writeWrapped(ln, { size: 10.5 });
    y += 8;
  }

  // Intro
  if (args.intro) {
    writeWrapped(args.intro, { size: 10.5, gapAfter: 10 });
  }

  // Sections
  if (args.sections?.length) {
    for (const s of args.sections) {
      writeWrapped(s.heading, { size: 12, bold: true, color: [25, 25, 25], gapAfter: 2 });
      for (const para of s.body.split(/\n\s*\n/)) {
        writeWrapped(para.trim(), { size: 10.5, gapAfter: 6 });
      }
      y += 4;
    }
  }

  // Line items
  if (args.line_items?.length) {
    ensureSpace(60);
    writeWrapped("Line items", { size: 12, bold: true, gapAfter: 4 });
    // Header row
    const cols = { desc: MARGIN, qty: MARGIN + 320, unit: MARGIN + 380, price: MARGIN + 430, total: PAGE_W - MARGIN };
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", cols.desc, y);
    doc.text("QTY", cols.qty, y, { align: "right" });
    doc.text("UNIT", cols.unit, y, { align: "right" });
    doc.text("PRICE", cols.price, y, { align: "right" });
    doc.text("TOTAL", cols.total, y, { align: "right" });
    y += 6;
    doc.setDrawColor(220, 200, 180);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(10);

    let subtotal = 0;
    for (const li of args.line_items) {
      const qty = Number(li.quantity) || 0;
      const price = Number(li.unit_price) || 0;
      const total = qty * price;
      subtotal += total;
      const descLines = doc.splitTextToSize(li.description, 300);
      const rowH = Math.max(descLines.length * 13, 14);
      ensureSpace(rowH + 4);
      doc.text(descLines, cols.desc, y);
      doc.text(qty.toString(), cols.qty, y, { align: "right" });
      if (li.unit) doc.text(li.unit, cols.unit, y, { align: "right" });
      doc.text(`$${price.toFixed(2)}`, cols.price, y, { align: "right" });
      doc.text(`$${total.toFixed(2)}`, cols.total, y, { align: "right" });
      y += rowH + 4;
    }

    // Totals
    y += 6;
    doc.setDrawColor(220, 200, 180);
    doc.line(cols.price - 80, y, PAGE_W - MARGIN, y);
    y += 14;
    const taxRate = Number(args.tax_rate ?? 0);
    const tax = subtotal * (taxRate / 100);
    const total = subtotal + tax;
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text("Subtotal", cols.price, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    doc.text(`$${subtotal.toFixed(2)}`, cols.total, y, { align: "right" });
    y += 14;
    if (taxRate > 0) {
      doc.setTextColor(80, 80, 80);
      doc.text(`Tax (${taxRate}%)`, cols.price, y, { align: "right" });
      doc.setTextColor(30, 30, 30);
      doc.text(`$${tax.toFixed(2)}`, cols.total, y, { align: "right" });
      y += 14;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(217, 83, 30);
    doc.text("Total", cols.price, y, { align: "right" });
    doc.text(`$${total.toFixed(2)}`, cols.total, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    y += 18;
  }

  // Terms
  if (args.terms) {
    y += 6;
    writeWrapped("Terms", { size: 11, bold: true, gapAfter: 2 });
    for (const para of args.terms.split(/\n\s*\n/)) {
      writeWrapped(para.trim(), { size: 9.5, color: [80, 80, 80], gapAfter: 4 });
    }
  }

  // Signature block
  if (args.signature_block) {
    ensureSpace(80);
    y += 20;
    const colW = (CONTENT_W - 30) / 2;
    doc.setDrawColor(120, 120, 120);
    doc.line(MARGIN, y + 24, MARGIN + colW, y + 24);
    doc.line(MARGIN + colW + 30, y + 24, MARGIN + colW + 30 + colW, y + 24);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("Client signature & date", MARGIN, y + 36);
    doc.text("Contractor signature & date", MARGIN + colW + 30, y + 36);
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${i} / ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 24, { align: "right" });
    if (org.name) doc.text(org.name, MARGIN, PAGE_H - 24);
  }

  const blob = doc.output("blob");
  const safeTitle = args.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || args.doc_type;
  return { blob, filename: `${safeTitle}.pdf` };
}
