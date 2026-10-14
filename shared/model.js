// Folio book model: pure helpers shared by the editor, the exported viewer and node tests.
// Classic script: sets globalThis.FolioModel; under node also module.exports.
(function (root) {
  'use strict';

  const TYPES = ['image', 'video', 'embed', 'link'];
  const MIN_SIZE = 0.02; // smallest box side, as a fraction of the page, so boxes stay clickable

  // Template files copied into every export: [path in repo, name in export folder].
  const VIEWER_FILES = [
    ['viewer/index.html', 'index.html'],
    ['viewer/viewer.css', 'viewer.css'],
    ['viewer/viewer.js', 'viewer.js'],
    ['shared/model.js', 'model.js'],
    ['shared/overlays.js', 'overlays.js'],
    ['shared/overlays.css', 'overlays.css'],
    ['vendor/page-flip.browser.js', 'page-flip.browser.js'],
    ['vendor/bodoni-moda-latin-400.woff2', 'bodoni-moda-latin-400.woff2'], // reader serif, OFL-1.1
  ];

  // opts.autoplay: muted autoplay + loop (browsers only autoplay muted; YouTube loops via playlist=ID).
  function toEmbedUrl(url, opts = {}) {
    let u;
    try { u = new URL(url); } catch { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^(www|m)\./, '');
    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
      const id = host === 'youtu.be'
        ? (u.pathname.match(/^\/([\w-]+)/) || [])[1]
        : u.pathname === '/watch'
          ? u.searchParams.get('v')
          : (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/) || [])[1];
      if (!id || !/^[\w-]{11}$/.test(id)) return null;
      return 'https://www.youtube-nocookie.com/embed/' + id +
        (opts.autoplay ? `?autoplay=1&mute=1&loop=1&playlist=${id}&playsinline=1` : '');
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const m = u.pathname.match(/^\/(?:video\/)?(\d+)(?:\/([\da-f]+))?\/?$/);
      if (!m) return null;
      const hash = m[2] || u.searchParams.get('h');
      const params = [];
      if (hash && /^[\da-f]+$/.test(hash)) params.push('h=' + hash);
      if (opts.autoplay) params.push('autoplay=1', 'muted=1', 'loop=1');
      return 'https://player.vimeo.com/video/' + m[1] + (params.length ? '?' + params.join('&') : '');
    }
    return null;
  }

  function isSafeHref(href) {
    try { return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol); } catch { return false; }
  }

  function clampRect(r) {
    const w = Math.min(1, Math.max(MIN_SIZE, r.w));
    const h = Math.min(1, Math.max(MIN_SIZE, r.h));
    return {
      x: Math.min(1 - w, Math.max(0, r.x)),
      y: Math.min(1 - h, Math.max(0, r.y)),
      w, h,
    };
  }

  function validateOverlay(o, pageCount) {
    if (!TYPES.includes(o.type)) return 'Choose a type';
    if (o.type === 'image' || o.type === 'video') return o.src ? null : 'Pick a file';
    if (o.type === 'embed') return toEmbedUrl(o.url || '') ? null : 'Not a YouTube or Vimeo link';
    const hasHref = typeof o.href === 'string' && o.href !== '';
    const hasPage = o.page !== undefined && o.page !== null;
    if (hasHref === hasPage) return 'Set a web address or a page number';
    if (hasHref) return isSafeHref(o.href) ? null : 'Address must start with http://, https:// or mailto:';
    return Number.isInteger(o.page) && o.page >= 1 && o.page <= pageCount ? null : 'Page must be 1–' + pageCount;
  }

  function firstInvalid(book) {
    for (let page = 0; page < book.pages.length; page++) {
      for (const o of book.pages[page].overlays) {
        const error = validateOverlay(o, book.pages.length);
        if (error) return { page, id: o.id, error };
      }
    }
    return null;
  }

  function newId() {
    return 'o' + Math.random().toString(36).slice(2).padEnd(8, '0').slice(0, 8);
  }

  function mediaName(id, fileName) {
    const ext = (fileName.match(/\.([a-z0-9]{1,5})$/i) || [null, 'bin'])[1].toLowerCase();
    return 'media/' + id + '.' + ext;
  }

  function isLocalPath(p) {
    return typeof p === 'string' && /^(pages|media)\/[^/\\]+$/.test(p) && !p.includes('..');
  }

  function usedPaths(book) {
    const used = new Set();
    for (const page of book.pages) {
      if (isLocalPath(page.image)) used.add(page.image);
      if (isLocalPath(page.thumb)) used.add(page.thumb);
      for (const o of page.overlays) if (isLocalPath(o.src)) used.add(o.src);
    }
    return used;
  }

  // Decides what Export may do in a picked folder. existing.files lists the folder's root files
  // plus pages/<name> and media/<name>. Returns the question to ask first (or null) and the
  // pages/media files to delete. Only a folder holding a parsable Folio book.js ever loses files;
  // a different book (other id) or a foreign folder is never touched without asking.
  function exportPlan(book, existing) {
    const { folder, bookText, files } = existing;
    let old = null;
    if (bookText != null) { try { old = parseBookJs(bookText); } catch { old = null; } }
    if (old) {
      const used = usedPaths(book);
      const remove = files.filter(f => /^(pages|media)\//.test(f) && !used.has(f));
      const ask = old.id && old.id === book.id ? null
        : `Replace the book "${old.title || 'Untitled'}" in "${folder}"? Its pages and media files that this book doesn't use will be deleted.`;
      return { ask, remove };
    }
    if (!files.length) return { ask: null, remove: [] };
    const writes = new Set([...VIEWER_FILES.map(f => f[1]), 'book.js', COVER.file, ...usedPaths(book)]);
    const clash = files.filter(f => writes.has(f));
    const ask = clash.length
      ? `"${folder}" isn't a Folio book. These files in it will be replaced: ${clash.join(', ')}. Other files are kept.`
      : `"${folder}" already has files and isn't a Folio book. Write the book into it? Existing files are kept.`;
    return { ask, remove: [] };
  }

  // Page indexes on screen for page-flip with showCover: the cover and an even last page show
  // alone, other spreads are [i, i + 1]; portrait shows one page.
  function visiblePages(index, pageCount, portrait) {
    if (portrait || index === 0) return [index];
    return [index, index + 1].filter(n => n < pageCount);
  }

  // Page index from a viewer address hash such as "#p=12" (1-based); anything else means the cover.
  function pageFromHash(hash, pageCount) {
    const m = /^#p=(\d+)$/.exec(hash);
    return m ? Math.min(pageCount, Math.max(1, Number(m[1]))) - 1 : 0;
  }

  // The book's public address, as given in the editor: http(s) only, always ending in "/" so
  // "cover.jpg" resolves inside it. Anything else means "not set".
  function bookUrl(u) {
    if (typeof u !== 'string' || !u.trim()) return null;
    let url;
    try { url = new URL(u.trim()); } catch { return null; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    url.search = '';
    if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.href;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // <title> and link-preview tags for the exported index.html. Sites that build previews
  // (Facebook, WhatsApp, LinkedIn, X) need absolute addresses, so image and url tags are only
  // written when the book's web address is known; the title and description always are.
  const COVER = { file: 'cover.jpg', width: 1200, height: 630 };
  function previewHead(book) {
    const title = (book.title || '').trim() || 'Flipbook';
    const desc = (book.description || '').trim();
    const base = bookUrl(book.url);
    const tags = [`<title>${esc(title)}</title>`, '<meta property="og:type" content="website">', `<meta property="og:title" content="${esc(title)}">`];
    if (desc) tags.push(`<meta name="description" content="${esc(desc)}">`, `<meta property="og:description" content="${esc(desc)}">`);
    if (base) {
      tags.push(
        `<meta property="og:url" content="${esc(base)}">`,
        `<meta property="og:image" content="${esc(base + COVER.file)}">`,
        `<meta property="og:image:width" content="${COVER.width}">`,
        `<meta property="og:image:height" content="${COVER.height}">`,
        '<meta name="twitter:card" content="summary_large_image">',
      );
    }
    return tags.join('\n');
  }

  // The viewer template with its placeholder <title> swapped for previewHead(book).
  function withPreview(html, book) {
    if (!html.includes('<title>Flipbook</title>')) throw new Error('Viewer template has no <title>Flipbook</title>');
    return html.replace('<title>Flipbook</title>', () => previewHead(book));
  }

  // iframe code for putting the book on another site, or null until its web address is set.
  function embedCode(book) {
    const base = bookUrl(book.url);
    if (!base) return null;
    const ratio = `${2 * (book.pageWidth || 3)} / ${book.pageHeight || 4}`; // a two-page spread
    return `<iframe src="${esc(base)}" title="${esc((book.title || '').trim() || 'Flipbook')}" style="width:100%;aspect-ratio:${ratio};min-height:480px;border:0" allow="fullscreen; autoplay; clipboard-write; web-share" allowfullscreen loading="lazy"></iframe>`;
  }

  // Contents, edited as text: one entry per line, page number first ("4 Editor's letter").
  function parseContents(text, pageCount) {
    const entries = [], bad = [];
    String(text).split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return;
      const m = /^\s*(\d+)[\s.:)-]+(\S.*?)\s*$/.exec(line);
      const page = m && Number(m[1]);
      if (!m || page < 1 || page > pageCount) bad.push(i + 1);
      else entries.push({ title: m[2], page });
    });
    return { entries, bad };
  }

  const formatContents = entries => (entries || []).map(e => e.page + ' ' + e.title).join('\n');

  // Lower-cases and strips accents, remembering where each folded character came from in s,
  // so a match found in the folded text can be cut out of the original.
  function fold(s) {
    let out = '';
    const from = [];
    let i = 0;
    for (const ch of s) {
      for (const c of ch.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()) { out += c; from.push(i); }
      i += ch.length;
    }
    return { out, from };
  }

  // Pages whose text contains query (case and accents ignored), in page order, each with its
  // match count and a short snippet around the first match split into before / match / after.
  function searchPages(pages, query, context = 40) {
    const q = fold(query.trim().replace(/\s+/g, ' ')).out;
    if (q.length < 2) return [];
    const results = [];
    pages.forEach((p, index) => {
      const text = typeof p.text === 'string' ? p.text : '';
      const { out, from } = fold(text);
      let at = out.indexOf(q), count = 0, first = at;
      while (at !== -1) { count++; at = out.indexOf(q, at + q.length); }
      if (!count) return;
      // End where the next kept character starts, so accent marks trailing the match stay in it.
      const start = from[first], end = from[first + q.length] ?? text.length;
      const a = Math.max(0, start - context), b = Math.min(text.length, end + context);
      results.push({
        index, count,
        before: (a > 0 ? '…' : '') + text.slice(a, start),
        match: text.slice(start, end),
        after: text.slice(end, b) + (b < text.length ? '…' : ''),
      });
    });
    return results;
  }

  // Where a page of size srcW×srcH goes, scaled to fit and centred, inside a boxW×boxH page.
  function fitRect(srcW, srcH, boxW, boxH) {
    const scale = Math.min(boxW / srcW, boxH / srcH);
    const w = Math.round(srcW * scale), h = Math.round(srcH * scale);
    return { x: Math.round((boxW - w) / 2), y: Math.round((boxH - h) / 2), w, h };
  }

  function serializeBook(book) {
    return 'window.BOOK = ' + JSON.stringify(book, null, 1) + ';\n';
  }

  function parseBookJs(text) {
    const m = text.match(/^\s*window\.BOOK\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!m) throw new Error('Not a Folio book.js');
    let book;
    try { book = JSON.parse(m[1]); } catch { throw new Error('Not a Folio book.js'); }
    if (!book || book.version !== 1 || !Array.isArray(book.pages)) throw new Error('Unsupported book.js version');
    for (const p of book.pages) {
      if (!/^pages\/[^/\\]+$/.test(p.image || '') || p.image.includes('..')) throw new Error('Bad page image path: ' + p.image);
      if (p.thumb !== undefined && (!/^pages\/[^/\\]+$/.test(p.thumb) || p.thumb.includes('..'))) throw new Error('Bad page thumbnail path: ' + p.thumb);
      if (!Array.isArray(p.overlays)) p.overlays = [];
      if (p.text !== undefined && typeof p.text !== 'string') delete p.text; // search text is optional
    }
    // Optional book fields: keep the well-formed parts, drop the rest.
    for (const k of ['description', 'url', 'series']) if (book[k] !== undefined && typeof book[k] !== 'string') delete book[k];
    if (book.published !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(book.published)) delete book.published;
    if (book.contents !== undefined) {
      book.contents = Array.isArray(book.contents)
        ? book.contents.filter(e => e && typeof e.title === 'string' && Number.isInteger(e.page) && e.page >= 1 && e.page <= book.pages.length)
          .map(e => ({ title: e.title, page: e.page }))
        : [];
    }
    return book;
  }

  // Library: one page listing the books exported into sub-folders of one folder.
  const LIBRARY_FILES = [
    ['library/index.html', 'index.html'],
    ['library/library.css', 'library.css'],
    ['library/library.js', 'library.js'],
    ['vendor/bodoni-moda-latin-400.woff2', 'bodoni-moda-latin-400.woff2'],
  ];
  const LIBRARY_DATA = 'library-data.js';

  // What the library needs from one book folder. modified = when its book.js was written (ms), the
  // fallback order for books without an issue date.
  function libraryEntry(folder, book, modified) {
    const first = book.pages[0] || {};
    const iso = book.published || (modified ? new Date(modified).toISOString().slice(0, 10) : '');
    return {
      folder,
      title: (book.title || '').trim() || folder,
      series: (book.series || '').trim(),
      date: iso,
      description: (book.description || '').trim(),
      pages: book.pages.length,
      cover: first.thumb || first.image || '', // relative to the book folder
      image: first.image || '',
      ratio: book.pageWidth && book.pageHeight ? book.pageWidth / book.pageHeight : 0.7,
    };
  }

  // Newest first; books without a date go last, by title.
  function sortLibrary(entries) {
    return [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.title.localeCompare(b.title));
  }

  // Shelves by series, in order of each series' newest issue; books with no series share a last shelf.
  function shelves(sorted, otherName = 'More issues') {
    const map = new Map();
    for (const e of sorted) {
      const key = e.series || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    const out = [...map].filter(([k]) => k).map(([name, books]) => ({ name, books }));
    if (map.has('')) out.push({ name: otherName, books: map.get('') });
    return out;
  }

  function serializeLibrary(lib) {
    return 'window.LIBRARY = ' + JSON.stringify(lib, null, 1) + ';\n';
  }

  function parseLibraryJs(text) {
    const m = String(text).match(/^\s*window\.LIBRARY\s*=\s*([\s\S]*?)\s*;?\s*$/);
    if (!m) throw new Error('Not a Folio library');
    let lib;
    try { lib = JSON.parse(m[1]); } catch { throw new Error('Not a Folio library'); }
    if (!lib || !Array.isArray(lib.books)) throw new Error('Not a Folio library');
    return lib;
  }

  const api = {
    VIEWER_FILES, toEmbedUrl, isSafeHref, clampRect, validateOverlay, firstInvalid,
    newId, mediaName, isLocalPath, usedPaths, exportPlan, visiblePages, pageFromHash, searchPages, fitRect, bookUrl, previewHead, withPreview, embedCode,
    parseContents, formatContents, COVER, serializeBook, parseBookJs,
    LIBRARY_FILES, LIBRARY_DATA, libraryEntry, sortLibrary, shelves, serializeLibrary, parseLibraryJs,
  };
  root.FolioModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
