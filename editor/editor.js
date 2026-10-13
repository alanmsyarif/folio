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
}

function load(book, blobs) {
  for (const u of state.urls.values()) URL.revokeObjectURL(u);
  Object.assign(state, { book, blobs, urls: new Map(), current: 0, selected: null, dirty: false });
  $('title').value = book.title || '';
  for (const id of ['title', 'preview', 'export']) $(id).disabled = false;
  $('page').hidden = false;
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
    img.src = urlFor(p.image);
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
    const { blobs, width, height } = await pdfToPages(file, (n, total) => status(`Rendering page ${n} of ${total}…`));
    const map = new Map(blobs.map((b, i) => [`pages/${i + 1}.webp`, b]));
    load({
      version: 1,
      title: file.name.replace(/\.pdf$/i, ''),
      pageWidth: width,
      pageHeight: height,
      pages: blobs.map((_, i) => ({ image: `pages/${i + 1}.webp`, overlays: [] })),
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
  };
  layer.addEventListener('pointermove', onMove);
  layer.addEventListener('pointerup', onUp);
  layer.addEventListener('pointercancel', onUp);
});

document.addEventListener('keydown', e => {
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
};

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
