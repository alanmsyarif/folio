const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../shared/model.js');

const YT = 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ';

test('toEmbedUrl accepts YouTube URL forms', () => {
  for (const u of [
    'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtube.com/watch?v=aqz-KE-bpKQ&t=30s&list=PL123',
    'https://m.youtube.com/watch?v=aqz-KE-bpKQ',
    'https://youtu.be/aqz-KE-bpKQ?si=abc123',
    'https://www.youtube.com/shorts/aqz-KE-bpKQ',
    'https://www.youtube.com/embed/aqz-KE-bpKQ',
  ]) assert.equal(M.toEmbedUrl(u), YT, u);
});

test('toEmbedUrl accepts Vimeo URL forms, keeping the unlisted hash', () => {
  assert.equal(M.toEmbedUrl('https://vimeo.com/76979871'), 'https://player.vimeo.com/video/76979871');
  assert.equal(M.toEmbedUrl('https://vimeo.com/76979871/8272103f6e'), 'https://player.vimeo.com/video/76979871?h=8272103f6e');
  assert.equal(M.toEmbedUrl('https://player.vimeo.com/video/76979871?h=8272103f6e'), 'https://player.vimeo.com/video/76979871?h=8272103f6e');
  // A non-hex h parameter is dropped, never copied into the player URL.
  assert.equal(M.toEmbedUrl('https://vimeo.com/76979871?h=<script>'), 'https://player.vimeo.com/video/76979871');
});

test('toEmbedUrl with autoplay adds muted autoplay and loop parameters', () => {
  const auto = { autoplay: true };
  assert.equal(M.toEmbedUrl('https://youtu.be/aqz-KE-bpKQ', auto),
    'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?autoplay=1&mute=1&loop=1&playlist=aqz-KE-bpKQ&playsinline=1');
  assert.equal(M.toEmbedUrl('https://vimeo.com/76979871', auto),
    'https://player.vimeo.com/video/76979871?autoplay=1&muted=1&loop=1');
  assert.equal(M.toEmbedUrl('https://vimeo.com/76979871/8272103f6e', auto),
    'https://player.vimeo.com/video/76979871?h=8272103f6e&autoplay=1&muted=1&loop=1');
  assert.equal(M.toEmbedUrl('https://example.com/x', auto), null);
});

test('toEmbedUrl rejects everything else', () => {
  for (const u of [
    '', 'not a url', 'javascript:alert(1)',
    'https://example.com/watch?v=aqz-KE-bpKQ',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch',
    'https://vimeo.com/channels/staffpicks',
  ]) assert.equal(M.toEmbedUrl(u), null, u);
});

test('isSafeHref allows only http, https, mailto', () => {
  assert.ok(M.isSafeHref('https://example.com/'));
  assert.ok(M.isSafeHref('http://example.com/'));
  assert.ok(M.isSafeHref('mailto:a@b.c'));
  assert.ok(!M.isSafeHref('javascript:alert(1)'));
  assert.ok(!M.isSafeHref('data:text/html,hi'));
  assert.ok(!M.isSafeHref('example.com'));
  assert.ok(!M.isSafeHref(undefined));
});

test('clampRect keeps the box on the page with a minimum size', () => {
  assert.deepEqual(M.clampRect({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }), { x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  assert.deepEqual(M.clampRect({ x: -0.2, y: -1, w: 0.3, h: 0.3 }), { x: 0, y: 0, w: 0.3, h: 0.3 });
  assert.deepEqual(M.clampRect({ x: 0.1, y: 0.1, w: 0, h: -1 }), { x: 0.1, y: 0.1, w: 0.02, h: 0.02 });
  assert.deepEqual(M.clampRect({ x: 0, y: 0, w: 3, h: 3 }), { x: 0, y: 0, w: 1, h: 1 });
});

test('validateOverlay', () => {
  const box = { id: 'a', x: 0, y: 0, w: 0.1, h: 0.1 };
  assert.equal(M.validateOverlay({ ...box, type: '' }, 5), 'Choose a type');
  assert.equal(M.validateOverlay({ ...box, type: 'image' }, 5), 'Pick a file');
  assert.equal(M.validateOverlay({ ...box, type: 'image', src: 'media/a.png' }, 5), null);
  assert.equal(M.validateOverlay({ ...box, type: 'video', src: 'media/a.mp4' }, 5), null);
  assert.equal(M.validateOverlay({ ...box, type: 'embed', url: 'https://example.com' }, 5), 'Not a YouTube or Vimeo link');
  assert.equal(M.validateOverlay({ ...box, type: 'embed', url: 'https://youtu.be/aqz-KE-bpKQ' }, 5), null);
  assert.equal(M.validateOverlay({ ...box, type: 'link' }, 5), 'Set a web address or a page number');
  assert.equal(M.validateOverlay({ ...box, type: 'link', href: 'https://a.b', page: 2 }, 5), 'Set a web address or a page number');
  assert.equal(M.validateOverlay({ ...box, type: 'link', href: 'javascript:x' }, 5), 'Address must start with http://, https:// or mailto:');
  assert.equal(M.validateOverlay({ ...box, type: 'link', href: 'https://a.b' }, 5), null);
  assert.equal(M.validateOverlay({ ...box, type: 'link', page: 6 }, 5), 'Page must be 1–5');
  assert.equal(M.validateOverlay({ ...box, type: 'link', page: 0 }, 5), 'Page must be 1–5');
  assert.equal(M.validateOverlay({ ...box, type: 'link', page: 5 }, 5), null);
});

const book = () => ({
  version: 1, title: 'T', pageWidth: 100, pageHeight: 140,
  pages: [
    { image: 'pages/1.webp', overlays: [{ id: 'a', type: 'image', x: 0, y: 0, w: 0.1, h: 0.1, src: 'media/a.png' }] },
    { image: 'pages/2.webp', overlays: [
      { id: 'b', type: 'video', x: 0, y: 0, w: 0.1, h: 0.1, src: 'https://cdn.example/v.mp4' },
      { id: 'c', type: 'image', x: 0, y: 0, w: 0.1, h: 0.1, src: '../../secret.txt' },
      { id: 'd', type: 'link', x: 0, y: 0, w: 0.1, h: 0.1, page: 9 },
    ] },
  ],
});

test('firstInvalid finds the first bad overlay with its page', () => {
  assert.deepEqual(M.firstInvalid(book()), { page: 1, id: 'd', error: 'Page must be 1–2' });
  const ok = book(); ok.pages[1].overlays.pop();
  assert.equal(M.firstInvalid(ok), null);
});

test('usedPaths lists local page and media files only', () => {
  assert.deepEqual([...M.usedPaths(book())].sort(), ['media/a.png', 'pages/1.webp', 'pages/2.webp']);
});

test('exportPlan: empty folder writes without asking', () => {
  assert.deepEqual(M.exportPlan({ ...book(), id: 'b1' }, { folder: 'new', bookText: null, files: [] }), { ask: null, remove: [] });
});

test('exportPlan: re-exporting the same book removes only its unused pages and media', () => {
  const b = { ...book(), id: 'b1' };
  const files = ['book.js', 'index.html', 'notes.txt', 'pages/1.webp', 'pages/2.webp', 'pages/3.webp', 'media/a.png', 'media/old.mp4'];
  assert.deepEqual(M.exportPlan(b, { folder: 'A', bookText: M.serializeBook(b), files }), { ask: null, remove: ['pages/3.webp', 'media/old.mp4'] });
});

test('exportPlan: a different Folio book in the folder is replaced only after asking', () => {
  const old = { ...book(), id: 'b0', title: 'Old book' };
  const plan = M.exportPlan({ ...book(), id: 'b1' }, { folder: 'A', bookText: M.serializeBook(old), files: ['book.js', 'pages/1.webp', 'media/zzz.png'] });
  assert.equal(plan.ask, 'Replace the book "Old book" in "A"? Its pages and media files that this book doesn\'t use will be deleted.');
  assert.deepEqual(plan.remove, ['media/zzz.png']);
});

test('exportPlan: a foreign folder names the files it would replace and removes nothing', () => {
  const plan = M.exportPlan({ ...book(), id: 'b1' }, { folder: 'site', bookText: null, files: ['index.html', 'about.html', 'pages/1.webp', 'media/notes.txt'] });
  assert.equal(plan.ask, '"site" isn\'t a Folio book. These files in it will be replaced: index.html, pages/1.webp. Other files are kept.');
  assert.deepEqual(plan.remove, []);
});

test('exportPlan: a foreign folder with no name clashes still asks', () => {
  const plan = M.exportPlan({ ...book(), id: 'b1' }, { folder: 'docs', bookText: null, files: ['report.docx'] });
  assert.equal(plan.ask, '"docs" already has files and isn\'t a Folio book. Write the book into it? Existing files are kept.');
  assert.deepEqual(plan.remove, []);
});

test('exportPlan: a book.js that is not a Folio book counts as foreign', () => {
  const plan = M.exportPlan({ ...book(), id: 'b1' }, { folder: 'js', bookText: 'var x = 1;', files: ['book.js', 'media/x.png'] });
  assert.equal(plan.ask, '"js" isn\'t a Folio book. These files in it will be replaced: book.js. Other files are kept.');
  assert.deepEqual(plan.remove, []);
});

test('visiblePages follows page-flip spreads (cover alone, then pairs)', () => {
  assert.deepEqual(M.visiblePages(0, 6, false), [0]);
  assert.deepEqual(M.visiblePages(1, 6, false), [1, 2]);
  assert.deepEqual(M.visiblePages(3, 6, false), [3, 4]);
  assert.deepEqual(M.visiblePages(5, 6, false), [5]);
  assert.deepEqual(M.visiblePages(3, 6, true), [3]);
});

test('fitRect centres a page of another shape inside the book page size', () => {
  assert.deepEqual(M.fitRect(2000, 1000, 1000, 1414), { x: 0, y: 457, w: 1000, h: 500 });
  assert.deepEqual(M.fitRect(500, 1000, 1000, 1414), { x: 147, y: 0, w: 707, h: 1414 });
  assert.deepEqual(M.fitRect(1000, 1414, 1000, 1414), { x: 0, y: 0, w: 1000, h: 1414 });
});

test('mediaName and newId', () => {
  assert.equal(M.mediaName('o1', 'Holiday Clip.MP4'), 'media/o1.mp4');
  assert.equal(M.mediaName('o1', 'noext'), 'media/o1.bin');
  assert.match(M.newId(), /^o[a-z0-9]{8}$/);
  assert.notEqual(M.newId(), M.newId());
});

test('serializeBook / parseBookJs round-trip', () => {
  const b = book();
  b.title = 'Quotes "x" ; and \u2028 line sep </script>';
  assert.deepEqual(M.parseBookJs(M.serializeBook(b)), b);
});

test('parseBookJs refuses things that are not a Folio book', () => {
  assert.throws(() => M.parseBookJs('alert(1)'), /Not a Folio book/);
  assert.throws(() => M.parseBookJs('window.BOOK = {"version":2,"pages":[]};'), /Unsupported/);
  assert.throws(() => M.parseBookJs('window.BOOK = {"version":1,"pages":[{"image":"../x.webp","overlays":[]}]};'), /page image/);
});
