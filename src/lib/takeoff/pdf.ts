// Turns an uploaded plan PDF into page images in the browser, sized for a vision model to read.
// Loaded on demand so pdf.js never weighs down the rest of the app.
export interface RenderedPage { page: number; blob: Blob; width: number; height: number }

export const MAX_PLAN_PAGES = 40;

export async function renderPdfPages(file: File, opts: { maxWidth?: number; quality?: number; onPage?: (n: number, total: number) => void } = {}): Promise<RenderedPage[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  if (doc.numPages > MAX_PLAN_PAGES) throw new Error(`This PDF has ${doc.numPages} pages. Upload the foundation sheets only (up to ${MAX_PLAN_PAGES}).`);
  const maxWidth = opts.maxWidth ?? 2400;
  const out: RenderedPage[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    // Plans are drawn small; render near 150 dpi but cap the width so uploads stay reasonable.
    const scale = Math.min(150 / 72, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't render PDF pages");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode page image"))), "image/jpeg", opts.quality ?? 0.85));
    out.push({ page: n, blob, width: canvas.width, height: canvas.height });
    opts.onPage?.(n, doc.numPages);
    page.cleanup();
  }
  await doc.destroy();
  return out;
}
