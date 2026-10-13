// Flipbook viewer: reads window.BOOK (book.js) and builds one flippable page per entry.
(function () {
  'use strict';
  const B = window.BOOK;
  document.title = B.title || 'Flipbook';
  const bookEl = document.getElementById('book');
  const count = document.getElementById('count');

  const pageEls = B.pages.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'page';
    const img = document.createElement('img');
    img.className = 'fo-page';
    img.src = p.image;
    img.alt = 'Page ' + (i + 1);
    img.draggable = false;
    const layer = document.createElement('div');
    layer.className = 'fo-layer';
    FolioOverlays.renderPageOverlays(layer, p, path => path);
    el.append(img, layer);
    // page-flip starts a turn on mousedown/touchstart at the book root. Stop presses on
    // overlays (video controls, players, links) here, on their way up.
    for (const type of ['mousedown', 'touchstart']) {
      el.addEventListener(type, e => { if (e.target.closest('.fo-overlay')) e.stopPropagation(); });
    }
    bookEl.append(el);
    return el;
  });

  const flip = new St.PageFlip(bookEl, {
    width: B.pageWidth,
    height: B.pageHeight,
    size: 'stretch',
    minWidth: 300, // below 2 × this the book switches to single-page portrait
    maxWidth: B.pageWidth,
    minHeight: 300,
    maxHeight: B.pageHeight,
    showCover: true,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
  });
  flip.loadFromHTML(pageEls);

  let visible = [];
  function onPageChange() {
    const i = flip.getCurrentPageIndex();
    count.textContent = (i + 1) + ' / ' + B.pages.length;
    for (const v of document.querySelectorAll('video')) v.pause();
    // Stop embedded players on pages that just left the view by reloading them.
    const now = FolioModel.visiblePages(i, B.pages.length, flip.getOrientation() === 'portrait');
    for (const idx of visible) {
      if (!now.includes(idx) && pageEls[idx]) {
        for (const f of pageEls[idx].querySelectorAll('iframe')) f.src = f.src;
      }
    }
    visible = now;
  }
  flip.on('flip', onPageChange);
  flip.on('changeOrientation', onPageChange); // spread ↔ single page changes what is on screen
  onPageChange();

  bookEl.addEventListener('click', e => {
    const a = e.target.closest('a.fo-link[data-page]');
    if (!a) return;
    e.preventDefault();
    flip.flip(Number(a.dataset.page) - 1);
  });

  document.getElementById('prev').onclick = () => flip.flipPrev();
  document.getElementById('next').onclick = () => flip.flipNext();
  const full = document.getElementById('full');
  if (!document.fullscreenEnabled) full.hidden = true;
  full.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') flip.flipPrev();
    if (e.key === 'ArrowRight') flip.flipNext();
  });
})();
