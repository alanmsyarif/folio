// Folio editor: import a PDF as page images, draw overlay boxes, export a static flipbook folder.
import { pdfToPages } from './pdf-import.js';
import { exportBook, openBook } from './folder.js';

const M = window.FolioModel;
const $ = id => document.getElementById(id);
const layer = $('layer');
const props = $('props');

const state = {
  book: null,       // { version, title, pageWidth, pageHeight, pages: [{ image, overlays }] }
  blobs: new Map(), // 'pages/1.webp' | 'media/<id>.<ext>' -> Blob
  urls: new Map(),  // same keys -> object URL, created on first use
  current: 0,
  selected: null,   // overlay id
  preview: false,
  dirty: false,
};

const page = () => state.book.pages[state.current];

// Local paths resolve to blob URLs; anything else (e.g. a remote video in a hand-made book) passes through.
function urlFor(path) {
  if (!state.blobs.has(path)) return path;
  if (!state.urls.has(path)) state.urls.set(path, URL.createObjectURL(state.blobs.get(path)));
  return state.urls.get(path);
}

function setBlob(path, blob) {
  if (state.urls.has(path)) {
    URL.revokeObjectURL(state.urls.get(path));
    state.urls.delete(path);
  }
  state.blobs.set(path, blob);
}

function status(text, isError = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', isError);
}

function changed() {
  state.dirty = true;
  renderLayer();
  renderProps();
  commit();
}

// Undo history: a snapshot of every page's boxes after each finished edit. Media files stay in
// state.blobs when a box goes, so an undone box finds its image or video again.
// ponytail: snapshots copy all boxes and keep the last 100; diff-based history if books get huge.
// ponytail: replacing a box's file with another of the same name overwrites it, so undo can't bring the old file back.
const history = { done: [], undone: [] };
const snap = () => JSON.stringify(state.book.pages.map(p => p.overlays));

function commit() {
  const s = snap();
  if (s === history.done.at(-1)) return; // nothing really changed (e.g. a click without a drag)
  history.done.push(s);
  if (history.done.length > 101) history.done.shift();
  history.undone = [];
  updateUndoButtons();
}

function restore(s) {
  const all = JSON.parse(s);
  // Show the page the step changed, so undo is never invisible.
  const changedPage = all.findIndex((ovs, i) => JSON.stringify(ovs) !== JSON.stringify(state.book.pages[i].overlays));
  state.book.pages.forEach((p, i) => { p.overlays = all[i]; });
  if (changedPage !== -1) state.current = changedPage;
  if (!page().overlays.some(o => o.id === state.selected)) state.selected = null;
  state.dirty = true;
  render();
  updateUndoButtons();
}

function undo() {
  if (state.preview || history.done.length < 2) return;
  history.undone.push(history.done.pop());
  restore(history.done.at(-1));
}

function redo() {
  if (state.preview || !history.undone.length) return;
  const s = history.undone.pop();
  history.done.push(s);
  restore(s);
}

function updateUndoButtons() {
  $('undo').disabled = state.preview || history.done.length < 2;
  $('redo').disabled = state.preview || !history.undone.length;
}

function load(book, blobs) {
  for (const u of state.urls.values()) URL.revokeObjectURL(u);
  // Export compares ids to tell "same book again" from "another book in this folder".
  if (!book.id) book.id = M.newId();
  Object.assign(state, { book, blobs, urls: new Map(), current: 0, selected: null, dirty: false });
  $('title').value = book.title || '';
  for (const id of ['title', 'preview', 'export']) $(id).disabled = false;
  $('page').hidden = false;
  history.done = [snap()];
  history.undone = [];
  updateUndoButtons();
  render();
}

function render() {
  renderThumbs();
  $('page-img').src = urlFor(page().image);
  renderLayer();
  renderProps();
}

function renderThumbs() {
  $('thumbs').replaceChildren(...state.book.pages.map((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', 'Page ' + (i + 1));
    if (i === state.current) b.setAttribute('aria-current', 'page');
    const img = document.createElement('img');
    img.src = urlFor(p.thumb || p.image);
    img.alt = '';
    b.append(img, String(i + 1));
    b.onclick = () => { state.current = i; state.selected = null; render(); };
    return b;
  }));
}

const selected = () => page().overlays.find(o => o.id === state.selected);

function label(o) {
  if (o.type === 'link') return o.page ? 'Go to page ' + o.page : o.href || 'Link';
  return { image: o.src ? '' : 'Image', video: 'Video', embed: 'Video link' }[o.type] ?? 'Choose a type';
}

function renderLayer() {
  const p = page();
  layer.classList.toggle('preview', state.preview);
  if (state.preview) {
    FolioOverlays.renderPageOverlays(layer, p, urlFor);
    FolioOverlays.setActive(layer, true);
    return;
  }
  layer.replaceChildren(...p.overlays.map(o => {
    const el = document.createElement('div');
    el.className = 'box';
    if (o.id === state.selected) el.classList.add('selected');
    if (M.validateOverlay(o, state.book.pages.length)) el.classList.add('invalid');
    el.dataset.id = o.id;
    el.style.left = o.x * 100 + '%';
    el.style.top = o.y * 100 + '%';
    el.style.width = o.w * 100 + '%';
    el.style.height = o.h * 100 + '%';
    if (o.type === 'image' && o.src) el.style.backgroundImage = `url("${urlFor(o.src)}")`;
    el.textContent = label(o);
    if (o.id === state.selected) {
      for (const h of ['nw', 'ne', 'sw', 'se']) {
        const d = document.createElement('span');
        d.className = 'handle ' + h;
        d.dataset.h = h;
        el.append(d);
      }
    }
    return el;
  }));
}

function field(labelText, input) {
  const l = document.createElement('label');
  l.textContent = labelText;
  l.htmlFor = input.id;
  return [l, input];
}

function input(id, type, attrs = {}) {
  return Object.assign(document.createElement('input'), { id, type, ...attrs });
}

function renderProps() {
  props.replaceChildren();
  const o = state.book && !state.preview && selected();
  if (!o) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = !state.book ? 'Open a PDF to start.'
      : state.preview ? 'Preview: overlays work as in the exported book.'
      : 'Drag on the page to draw a box, or click a box to edit it.';
    props.append(hint);
    if (state.book && !state.preview) renderBookSettings();
    return;
  }

  const type = document.createElement('select');
  type.id = 'p-type';
  for (const [value, text] of [['', 'Choose…'], ['image', 'Image'], ['video', 'Video file'], ['embed', 'YouTube / Vimeo link'], ['link', 'Link']]) {
    type.append(new Option(text, value));
  }
  type.value = o.type;
  type.onchange = () => {
    for (const k of Object.keys(o)) if (!['id', 'x', 'y', 'w', 'h'].includes(k)) delete o[k];
    o.type = type.value;
    changed();
  };
  props.append(...field('Type', type));

  if (o.type === 'image' || o.type === 'video') {
    const file = input('p-file', 'file', { accept: o.type === 'image' ? 'image/*' : 'video/mp4,video/webm' });
    file.onchange = async () => {
      const f = file.files[0];
      if (!f) return;
      const path = M.mediaName(o.id, f.name);
      // Copy into memory so the box survives the source file being moved or rewritten.
      setBlob(path, new Blob([await f.arrayBuffer()], { type: f.type }));
      o.src = path;
      changed();
    };
    props.append(...field(o.type === 'image' ? 'Image file' : 'Video file (MP4 or WebM)', file));
    if (o.src) {
      const cur = document.createElement('p');
      cur.className = 'hint';
      cur.textContent = 'Current: ' + o.src;
      props.append(cur);
    }
  } else if (o.type === 'embed') {
    const url = input('p-url', 'url', { placeholder: 'https://www.youtube.com/watch?v=…', value: o.url || '' });
    url.onchange = () => { o.url = url.value.trim(); changed(); };
    props.append(...field('Video address', url));
  } else if (o.type === 'link') {
    const href = input('p-href', 'url', { placeholder: 'https://…', value: o.href || '' });
    href.onchange = () => {
      const v = href.value.trim();
      if (v) { o.href = v; delete o.page; } else delete o.href;
      changed();
    };
    const pg = input('p-page', 'number', { min: 1, max: state.book.pages.length, value: o.page ?? '' });
    pg.onchange = () => {
      const n = parseInt(pg.value, 10);
      if (Number.isNaN(n)) delete o.page; else { o.page = n; delete o.href; }
      changed();
    };
    props.append(...field('Web address', href), ...field('…or go to page', pg));
  }

  if (o.type === 'video' || o.type === 'embed') {
    const auto = input('p-autoplay', 'checkbox', { checked: !!o.autoplay });
    auto.onchange = () => {
      if (auto.checked) o.autoplay = true; else delete o.autoplay;
      changed();
    };
    const l = document.createElement('label');
    l.className = 'check';
    l.append(auto, ' Autoplay and loop (starts muted)');
    props.append(l);
  }

  const error = M.validateOverlay(o, state.book.pages.length);
  if (error) {
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = error;
    props.append(p);
  }

  const del = document.createElement('button');
  del.type = 'button';
  del.textContent = 'Delete box';
  del.onclick = deleteSelected;
  props.append(del);
}

// Book-wide settings, shown while no box is selected: what link previews and the reader's
// Contents list use. Saved into book.js on export.
function renderBookSettings() {
  const b = state.book;
  const head = document.createElement('h2');
  head.textContent = 'Book';
  const set = (key, value) => { if (value) b[key] = value; else delete b[key]; state.dirty = true; };

  const desc = Object.assign(document.createElement('textarea'), { id: 'b-desc', rows: 3, value: b.description || '' });
  desc.placeholder = 'One or two sentences shown when the link is shared';
  desc.onchange = () => set('description', desc.value.trim());

  const url = input('b-url', 'url', { placeholder: 'https://…/books/taste-51/', value: b.url || '' });
  const urlNote = document.createElement('p');
  urlNote.className = 'hint';
  const embed = Object.assign(document.createElement('textarea'), { id: 'b-embed', rows: 4, readOnly: true });
  const copy = Object.assign(document.createElement('button'), { id: 'b-copy', type: 'button', textContent: 'Copy embed code' });
  const showUrl = () => {
    const code = M.embedCode(b);
    urlNote.textContent = !b.url ? 'Where the exported folder will be online. Shared links then show the cover.'
      : M.bookUrl(b.url) ? 'Shared links show the cover from ' + M.bookUrl(b.url) + 'cover.jpg'
      : 'Use a full address starting with https://';
    urlNote.classList.toggle('error', !!b.url && !M.bookUrl(b.url));
    embed.value = code || '';
    embed.hidden = copy.hidden = !code;
  };
  url.onchange = () => { set('url', url.value.trim()); showUrl(); };
  copy.onclick = async () => {
    await navigator.clipboard.writeText(embed.value);
    copy.textContent = 'Copied';
    setTimeout(() => { copy.textContent = 'Copy embed code'; }, 2000);
  };
  showUrl();

  const toc = Object.assign(document.createElement('textarea'), { id: 'b-contents', rows: 8, value: M.formatContents(b.contents) });
  toc.placeholder = "4 Editor's letter\n12 Island escapes";
  const tocNote = document.createElement('p');
  tocNote.className = 'hint';
  const showToc = bad => {
    tocNote.textContent = bad.length
      ? `Line ${bad.join(', ')}: start with a page number from 1 to ${b.pages.length}, then the title.`
      : 'One entry per line: page number, then title. Readers see these under Contents.';
    tocNote.classList.toggle('error', bad.length > 0);
  };
  toc.onchange = () => {
    const { entries, bad } = M.parseContents(toc.value, b.pages.length);
    set('contents', entries.length ? entries : null);
    showToc(bad);
  };
  showToc([]);

  props.append(head,
    ...field('Description', desc),
    ...field('Web address', url), urlNote,
    ...field('Embed on a website', embed), copy,
    ...field('Contents', toc), tocNote);
}

function deleteSelected() {
  page().overlays = page().overlays.filter(o => o.id !== state.selected);
  state.selected = null;
  changed();
}

$('pdf-input').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (state.dirty && !confirm('Replace the current book? Unsaved boxes will be lost.')) return;
  try {
    const { blobs, thumbs, texts, contents, width, height } = await pdfToPages(file, (n, total) => status(`Rendering page ${n} of ${total}…`));
    const map = new Map(blobs.map((b, i) => [`pages/${i + 1}.webp`, b]));
    thumbs.forEach((b, i) => map.set(`pages/${i + 1}-thumb.webp`, b));
    load({
      version: 1,
      title: file.name.replace(/\.pdf$/i, ''),
      pageWidth: width,
      pageHeight: height,
      ...(contents.length ? { contents } : {}), // from the PDF's bookmarks
      pages: blobs.map((_, i) => ({
        image: `pages/${i + 1}.webp`, thumb: `pages/${i + 1}-thumb.webp`, overlays: [],
        ...(texts[i] ? { text: texts[i] } : {}), // scanned pages have none
      })),
    }, map);
    state.dirty = true;
    status(`${blobs.length} pages ready`);
  } catch (err) {
    status('Could not open PDF: ' + err.message, true);
  }
};

$('title').oninput = e => { state.book.title = e.target.value; state.dirty = true; };
addEventListener('beforeunload', e => { if (state.dirty) e.preventDefault(); });

layer.addEventListener('pointerdown', e => {
  if (!state.book || state.preview || e.button !== 0) return;
  e.preventDefault();
  const rect = layer.getBoundingClientRect();
  const at = ev => ({ x: (ev.clientX - rect.left) / rect.width, y: (ev.clientY - rect.top) / rect.height });
  const start = at(e);
  const boxEl = e.target.closest('.box');
  const handle = e.target.dataset.h;
  let o, mode;
  if (boxEl) {
    o = page().overlays.find(x => x.id === boxEl.dataset.id);
    mode = handle ? 'resize' : 'move';
  } else {
    o = { id: M.newId(), type: '', x: start.x, y: start.y, w: 0, h: 0 };
    page().overlays.push(o);
    mode = 'draw';
  }
  state.selected = o.id;
  const orig = { x: o.x, y: o.y, w: o.w, h: o.h };
  layer.setPointerCapture(e.pointerId);
  renderLayer();

  const onMove = ev => {
    const p = at(ev), dx = p.x - start.x, dy = p.y - start.y;
    let r;
    if (mode === 'move') r = { ...orig, x: orig.x + dx, y: orig.y + dy };
    else if (mode === 'draw') r = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(dx), h: Math.abs(dy) };
    else {
      r = { ...orig };
      if (handle.includes('w')) { r.x += dx; r.w -= dx; } else r.w += dx;
      if (handle.includes('n')) { r.y += dy; r.h -= dy; } else r.h += dy;
    }
    Object.assign(o, M.clampRect(r));
    state.dirty = true;
    renderLayer();
  };
  const onUp = ev => {
    layer.removeEventListener('pointermove', onMove);
    layer.removeEventListener('pointerup', onUp);
    layer.removeEventListener('pointercancel', onUp);
    const p = at(ev);
    // A click on the bare page (no real drag) deselects instead of leaving a tiny box.
    if (mode === 'draw' && Math.abs(p.x - start.x) < 0.01 && Math.abs(p.y - start.y) < 0.01) {
      page().overlays.pop();
      state.selected = null;
    }
    renderLayer();
    renderProps();
    commit();
  };
  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerup', onUp);
  layer.addEventListener('pointercancel', onUp);
});

document.addEventListener('keydown', e => {
  // In text fields Ctrl+Z is the field's own text undo.
  if ((e.ctrlKey || e.metaKey) && state.book && !e.target.closest('input, select, textarea')) {
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.book && state.selected && !e.target.closest('input, select, textarea')) {
    e.preventDefault();
    deleteSelected();
  }
});

$('preview').onclick = () => {
  state.preview = !state.preview;
  $('preview').setAttribute('aria-pressed', String(state.preview));
  state.selected = null;
  renderLayer();
  renderProps();
  updateUndoButtons();
};

$('undo').onclick = undo;
$('redo').onclick = redo;

if (!('showDirectoryPicker' in window)) {
  for (const id of ['open-folder', 'export']) $(id).title = 'Needs Chrome, Edge or Opera';
  $('open-folder').disabled = true;
  status('Export and Open folder need a Chromium browser (Chrome, Edge, Opera).', true);
}

$('export').onclick = async () => {
  const bad = M.firstInvalid(state.book);
  if (bad) {
    Object.assign(state, { current: bad.page, selected: bad.id, preview: false });
    $('preview').setAttribute('aria-pressed', 'false');
    render();
    status(`Page ${bad.page + 1}: ${bad.error}`, true);
    return;
  }
  try {
    status('Exporting…');
    const name = await exportBook(state.book, state.blobs);
    if (name === null) { status('Export cancelled'); return; }
    state.dirty = false;
    status(`Exported to "${name}". Open index.html in that folder.`);
  } catch (err) {
    status(err.name === 'AbortError' ? 'Export cancelled' : 'Export failed: ' + err.message, err.name !== 'AbortError');
  }
};

$('open-folder').onclick = async () => {
  if (state.dirty && !confirm('Discard unsaved changes?')) return;
  try {
    const { book, blobs } = await openBook();
    load(book, blobs);
    status(`Opened "${book.title}"`);
  } catch (err) {
    if (err.name !== 'AbortError') status(err.message, true);
  }
};

renderProps();
