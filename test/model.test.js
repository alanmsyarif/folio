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

test('staleFiles lists unreferenced files, but never in a folder that was not a book', () => {
  const names = ['a.png', 'old.mp4', 'notes.txt'];
  assert.deepEqual(M.staleFiles(book(), 'media', names, ['book.js', 'index.html']), ['old.mp4', 'notes.txt']);
  assert.deepEqual(M.staleFiles(book(), 'media', names, ['report.docx']), []);
  assert.deepEqual(M.staleFiles(book(), 'pages', ['1.webp', '2.webp', '3.webp'], ['book.js']), ['3.webp']);
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
