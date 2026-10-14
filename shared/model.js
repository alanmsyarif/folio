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
    const writes = new Set([...VIEWER_FILES.map(f => f[1]), 'book.js', ...usedPaths(book)]);
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
    }
    return book;
  }

  const api = {
    VIEWER_FILES, toEmbedUrl, isSafeHref, clampRect, validateOverlay, firstInvalid,
    newId, mediaName, isLocalPath, usedPaths, exportPlan, visiblePages, pageFromHash, fitRect, serializeBook, parseBookJs,
  };
  root.FolioModel = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
