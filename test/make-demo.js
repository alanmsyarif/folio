// Builds demo/: a 6-page book with SVG pages and one overlay of each kind, for checking the viewer by hand.
// Usage: npm run demo, then open demo/index.html (file://) or http://127.0.0.1:8080/demo/ via npm start.
const fs = require('fs');
const path = require('path');
const { serializeBook, VIEWER_FILES } = require('../shared/model.js');

const root = path.join(__dirname, '..');
const out = path.join(root, 'demo');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'pages'), { recursive: true });

const W = 700, H = 990;
const pages = [];
// Search text for each page (the demo SVGs don't carry real text). Page 6 has none, like a scanned page.
const DEMO_TEXT = [
  'Page 1. A short guide to the harbour town and its lighthouse.',
  'Page 2. Getting there: ferries leave the harbour every hour. Café Nord sits by the pier.',
  'Page 3. Walks along the cliffs, and a video of the lighthouse at dusk.',
  'Page 4. Where to eat: the cafe on the square, the bakery, the fish market.',
  'Page 5. Evening: the lighthouse lamp turns on at sunset. Lighthouse tours run on Fridays.',
  '',
];
for (let i = 1; i <= 6; i++) {
  fs.writeFileSync(path.join(out, 'pages', i + '.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="100%" height="100%" fill="hsl(${i * 50},40%,92%)"/>` +
    `<text x="50%" y="12%" font-size="64" text-anchor="middle" font-family="sans-serif">Page ${i}</text></svg>`);
  // Thumbnail drawn differently (dark) so a check can tell it from the full page.
  fs.writeFileSync(path.join(out, 'pages', i + '-thumb.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 5}" height="${H / 5}">` +
    `<rect width="100%" height="100%" fill="#555"/>` +
    `<text x="50%" y="50%" font-size="24" fill="#fff" text-anchor="middle" font-family="sans-serif">${i}</text></svg>`);
  pages.push({ image: `pages/${i}.svg`, thumb: `pages/${i}-thumb.svg`, overlays: [], text: DEMO_TEXT[i - 1] });
}
pages[1].overlays.push(
  { id: 'd1', type: 'link', x: 0.1, y: 0.3, w: 0.8, h: 0.1, page: 5 },
  { id: 'd2', type: 'link', x: 0.1, y: 0.5, w: 0.8, h: 0.1, href: 'https://example.com/' },
);
pages[2].overlays.push(
  { id: 'd3', type: 'embed', x: 0.05, y: 0.25, w: 0.9, h: 0.3, url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  { id: 'd4', type: 'video', x: 0.05, y: 0.6, w: 0.9, h: 0.3, src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' },
);
pages[3].overlays.push(
  { id: 'd5', type: 'image', x: 0.25, y: 0.3, w: 0.5, h: 0.4, src: 'pages/1.svg' },
);
pages[4].overlays.push(
  { id: 'd6', type: 'video', x: 0.05, y: 0.3, w: 0.9, h: 0.4, src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm', autoplay: true },
);
pages[5].overlays.push(
  { id: 'd7', type: 'embed', x: 0.05, y: 0.3, w: 0.9, h: 0.3, url: 'https://youtu.be/aqz-KE-bpKQ', autoplay: true },
);

for (const [from, to] of VIEWER_FILES) fs.copyFileSync(path.join(root, from), path.join(out, to));
fs.writeFileSync(path.join(out, 'book.js'),
  serializeBook({ version: 1, title: 'Folio demo', pageWidth: W, pageHeight: H, pages }));
console.log('Wrote ' + out);
