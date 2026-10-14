// Renders every PDF page to a WebP blob with pdf.js.
import * as pdfjs from '../vendor/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;

// Long side of each baked page, px, and WebP quality. Bigger = sharper zoom, heavier export.
const LONG_SIDE = 2000;
const QUALITY = 0.85;
// Long side of each page's thumbnail (viewer page grid, editor sidebar, placeholder while the full page loads).
const THUMB_SIDE = 320;

const webp = (canvas, n) => new Promise((ok, fail) =>
  canvas.toBlob(b => (b ? ok(b) : fail(new Error('WebP encoding failed on page ' + n))), 'image/webp', QUALITY));

export async function pdfToPages(file, onProgress) {
  // pdf.js 6 has destroy() on the loading task, not the document.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    const blobs = [], thumbs = [];
    let width = 0, height = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      if (n === 1) {
        const s = LONG_SIDE / Math.max(base.width, base.height);
        width = Math.round(base.width * s);
        height = Math.round(base.height * s);
      }
      // Every page is baked at page 1's size (others fitted and centred), so the viewer's
      // uniform page boxes and the overlay fractions line up on every page.
      const r = window.FolioModel.fitRect(base.width, base.height, width, height);
      const viewport = page.getViewport({ scale: r.w / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h); // pdf.js doesn't clip to the page box; keep the margins clean
      ctx.clip();
      await page.render({ canvasContext: ctx, viewport, transform: [1, 0, 0, 1, r.x, r.y] }).promise;
      blobs.push(await webp(canvas, n));
      const s = THUMB_SIDE / Math.max(width, height);
      const small = document.createElement('canvas');
      small.width = Math.round(width * s);
      small.height = Math.round(height * s);
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
      thumbs.push(await webp(small, n));
      page.cleanup();
      onProgress(n, pdf.numPages);
    }
    return { blobs, thumbs, width, height };
  } finally {
    await task.destroy();
  }
}
