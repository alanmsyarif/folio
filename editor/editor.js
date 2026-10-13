// Folio editor: import a PDF as page images, draw overlay boxes, export a static flipbook folder.
import { pdfToPages } from './pdf-import.js';

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

// Filled in by Task 4.
function renderLayer() {}
function renderProps() {
  props.innerHTML = '';
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = state.book ? 'Drag on the page to draw a box, or click a box to edit it.' : 'Open a PDF to start.';
  props.append(hint);
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

renderProps();
