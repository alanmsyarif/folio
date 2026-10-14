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

test('pageFromHash reads #p=N and clamps it to the book', () => {
  assert.equal(M.pageFromHash('#p=4', 6), 3);
  assert.equal(M.pageFromHash('#p=99', 6), 5);
  assert.equal(M.pageFromHash('#p=0', 6), 0);
  assert.equal(M.pageFromHash('', 6), 0);
  assert.equal(M.pageFromHash('#p=2x', 6), 0);
});

test('usedPaths and parseBookJs carry page thumbnails', () => {
  const b = { version: 1, pages: [{ image: 'pages/1.webp', thumb: 'pages/1-thumb.webp', overlays: [] }] };
  assert.deepEqual([...M.usedPaths(b)].sort(), ['pages/1-thumb.webp', 'pages/1.webp']);
  assert.deepEqual(M.parseBookJs(M.serializeBook(b)), b);
  assert.throws(() => M.parseBookJs('window.BOOK = {"version":1,"pages":[{"image":"pages/1.webp","thumb":"../t.webp","overlays":[]}]};'), /thumbnail/);
});

test('searchPages finds pages ignoring case and accents, with a snippet around the first hit', () => {
  const pages = [
    { text: 'Welcome to the Café of Dreams. The café opens at nine.' },
    { text: 'Nothing here.' },
    {},
    { text: 'CAFE prices' },
  ];
  const r = M.searchPages(pages, 'cafe');
  assert.deepEqual(r.map(x => [x.index, x.count]), [[0, 2], [3, 1]]);
  assert.equal(r[0].match, 'Café');
  assert.equal(r[0].before + r[0].match + r[0].after, 'Welcome to the Café of Dreams. The café opens at nine.');
  assert.equal(r[1].match, 'CAFE');
  assert.deepEqual(M.searchPages(pages, '  CAFÉ   of  '), M.searchPages(pages, 'café of'));
  assert.deepEqual(M.searchPages(pages, 'c'), []); // one letter matches everything; wait for more
  const long = { text: 'x'.repeat(100) + 'needle' + 'y'.repeat(100) };
  const [hit] = M.searchPages([long], 'needle', 10);
  assert.equal(hit.before, '…' + 'x'.repeat(10));
  assert.equal(hit.after, 'y'.repeat(10) + '…');
});

test('searchPages keeps snippets aligned when the text holds combining accents', () => {
  const [hit] = M.searchPages([{ text: 'une café noir' }], 'café');
  assert.equal(hit.match, 'café');
  assert.equal(hit.after, ' noir');
});

test('parseBookJs drops page text that is not a string', () => {
  const b = M.parseBookJs('window.BOOK = {"version":1,"pages":[{"image":"pages/1.webp","text":5,"overlays":[]},{"image":"pages/2.webp","text":"hi","overlays":[]}]};');
  assert.equal(b.pages[0].text, undefined);
  assert.equal(b.pages[1].text, 'hi');
});

test('bookUrl keeps http(s) addresses and points them at the book folder', () => {
  assert.equal(M.bookUrl('https://example.com/books/taste-51'), 'https://example.com/books/taste-51/');
  assert.equal(M.bookUrl(' https://example.com/books/taste-51/index.html?x=1#p=4 '), 'https://example.com/books/taste-51/');
  assert.equal(M.bookUrl('javascript:alert(1)'), null);
  assert.equal(M.bookUrl('books/taste'), null);
  assert.equal(M.bookUrl(''), null);
});

test('previewHead writes title and description always, image and url only with a web address', () => {
  const plain = M.previewHead({ title: 'Asia Dreams 59', description: 'Island escapes' });
  assert.match(plain, /<title>Asia Dreams 59<\/title>/);
  assert.match(plain, /og:description" content="Island escapes"/);
  assert.doesNotMatch(plain, /og:image/);
  const full = M.previewHead({ title: 'T', url: 'https://example.com/b' });
  assert.match(full, /og:image" content="https:\/\/example.com\/b\/cover.jpg"/);
  assert.match(full, /og:url" content="https:\/\/example.com\/b\/"/);
  assert.match(full, /twitter:card/);
  assert.match(M.previewHead({}), /<title>Flipbook<\/title>/);
});

test('previewHead escapes text so a title cannot break out of the tags', () => {
  const h = M.previewHead({ title: '"><script>x</script>', description: "Tom & Jerry's" });
  assert.doesNotMatch(h, /<script>/);
  assert.match(h, /&quot;&gt;&lt;script&gt;/);
  assert.match(h, /Tom &amp; Jerry&#39;s/);
});

test('withPreview swaps the template title and refuses a template without one', () => {
  const out = M.withPreview('<head>\n<title>Flipbook</title>\n</head>', { title: 'A $& B' });
  assert.match(out, /<title>A \$&amp; B<\/title>/); // "$&" is not a replace() pattern here
  assert.throws(() => M.withPreview('<head></head>', {}), /no <title>/);
});

test('embedCode needs the web address and frames a two-page spread', () => {
  assert.equal(M.embedCode({ title: 'T' }), null);
  const code = M.embedCode({ title: 'T', url: 'https://example.com/b', pageWidth: 1000, pageHeight: 1414 });
  assert.match(code, /^<iframe src="https:\/\/example.com\/b\/"/);
  assert.match(code, /aspect-ratio:2000 \/ 1414/);
  assert.match(code, /allowfullscreen/);
});

test('parseContents reads "page title" lines and reports the ones it cannot use', () => {
  const { entries, bad } = M.parseContents("4 Editor's letter\n\n12. Island escapes\n  30 - Dining\nCover story\n99 Too far", 40);
  assert.deepEqual(entries, [{ title: "Editor's letter", page: 4 }, { title: 'Island escapes', page: 12 }, { title: 'Dining', page: 30 }]);
  assert.deepEqual(bad, [5, 6]);
  assert.equal(M.formatContents(entries), "4 Editor's letter\n12 Island escapes\n30 Dining");
  assert.deepEqual(M.parseContents(M.formatContents(entries), 40).entries, entries);
});

test('parseBookJs keeps good contents entries and drops bad optional fields', () => {
  const b = M.parseBookJs('window.BOOK = ' + JSON.stringify({ version: 1, url: 5, description: 'ok',
    pages: [{ image: 'pages/1.webp', overlays: [] }, { image: 'pages/2.webp', overlays: [] }],
    contents: [{ title: 'A', page: 2 }, { title: 'B', page: 3 }, { page: 1 }, null, { title: 'C', page: 1.5 }] }) + ';');
  assert.deepEqual(b.contents, [{ title: 'A', page: 2 }]);
  assert.equal(b.url, undefined);
  assert.equal(b.description, 'ok');
});

test('exportPlan counts cover.jpg among the files Export writes', () => {
  const plan = M.exportPlan({ pages: [] }, { folder: 'x', bookText: null, files: ['cover.jpg'] });
  assert.match(plan.ask, /cover\.jpg/);
});

test('libraryEntry points at the book folder and prefers the issue date', () => {
  const book = { title: ' Asia Dreams 59 ', series: 'Asia Dreams', published: '2026-09-01', description: 'Escapes',
    pageWidth: 1000, pageHeight: 1414, pages: [{ image: 'pages/1.webp', thumb: 'pages/1-thumb.webp' }, { image: 'pages/2.webp' }] };
  assert.deepEqual(M.libraryEntry('ad-59', book, Date.UTC(2026, 9, 14)), {
    folder: 'ad-59', title: 'Asia Dreams 59', series: 'Asia Dreams', date: '2026-09-01', description: 'Escapes', pages: 2,
    cover: 'pages/1-thumb.webp', image: 'pages/1.webp', ratio: 1000 / 1414 });
  const plain = M.libraryEntry('x', { pages: [{ image: 'pages/1.webp' }] }, Date.UTC(2026, 9, 14));
  assert.equal(plain.title, 'x');
  assert.equal(plain.date, '2026-10-14');
  assert.equal(plain.cover, 'pages/1.webp');
});

test('sortLibrary puts the newest first and undated books last; shelves follow the newest issue', () => {
  const e = (title, series, date) => ({ title, series, date });
  const sorted = M.sortLibrary([e('B1', 'Bali', '2025-01-01'), e('Loose', '', ''), e('A2', 'Asia', '2026-06-01'), e('B2', 'Bali', '2026-08-01'), e('A1', 'Asia', '2025-06-01')]);
  assert.deepEqual(sorted.map(x => x.title), ['B2', 'A2', 'A1', 'B1', 'Loose']);
  assert.deepEqual(M.shelves(sorted).map(s => [s.name, s.books.map(b => b.title)]),
    [['Bali', ['B2', 'B1']], ['Asia', ['A2', 'A1']], ['More issues', ['Loose']]]);
});

test('library data round-trips and parseBookJs checks series and issue date', () => {
  const lib = { name: 'Exquisite Media', intro: 'Hi', website: 'https://example.com', books: [] };
  assert.deepEqual(M.parseLibraryJs(M.serializeLibrary(lib)), lib);
  assert.throws(() => M.parseLibraryJs('alert(1)'), /Not a Folio library/);
  const b = M.parseBookJs('window.BOOK = ' + JSON.stringify({ version: 1, series: 3, published: '14/10/2026', pages: [{ image: 'pages/1.webp', overlays: [] }] }) + ';');
  assert.equal(b.series, undefined);
  assert.equal(b.published, undefined);
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
