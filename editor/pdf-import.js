// Renders every PDF page to a WebP blob with pdf.js.
import * as pdfjs from '../vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// Long side of each baked page, px, and WebP quality. Bigger = sharper zoom, heavier export.
const LONG_SIDE = 2000;
const QUALITY = 0.85;

export async function pdfToPages(file, onProgress) {
  // pdf.js 6 has destroy() on the loading task, not the document.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const blobs = [];
    let width = 0, height = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: LONG_SIDE / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      if (n === 1) { width = canvas.width; height = canvas.height; }
      blobs.push(await new Promise((ok, fail) =>
        canvas.toBlob(b => (b ? ok(b) : fail(new Error('WebP encoding failed on page ' + n))), 'image/webp', QUALITY)));
      page.cleanup();
      onProgress(n, pdf.numPages);
    }
    return { blobs, width, height };
  } finally {
    await task.destroy();
  }
}
