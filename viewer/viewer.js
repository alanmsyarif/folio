// Flipbook viewer: reads window.BOOK (book.js) and builds one flippable page per entry.
(function () {
  'use strict';
  const B = window.BOOK;
  document.title = B.title || 'Flipbook';
  const bookEl = document.getElementById('book');
  const num = document.getElementById('num');
  const seek = document.getElementById('seek');
  const n = B.pages.length;
  seek.max = n;
  document.getElementById('total').textContent = '/ ' + n;

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

  const startPage = FolioModel.pageFromHash(location.hash, n); // "#p=12" links open on that page
  const flip = new St.PageFlip(bookEl, {
    width: B.pageWidth,
    height: B.pageHeight,
    size: 'stretch',
    minWidth: 300, // below 2 × this the book switches to single-page portrait
    maxWidth: B.pageWidth,
    minHeight: 300,
    maxHeight: B.pageHeight,
    showCover: true,
    startPage,
    maxShadowOpacity: 0.5,
    mobileScrollSupport: false,
  });
  flip.loadFromHTML(pageEls);
  // page-flip makes the cover and a lone last page "hard" (a stiff board turn); curl them like the rest.
  for (let i = 0; i < n; i++) flip.getPage(i).setDensity('soft');

  // A cover or lone back page fills only half the spread. Slide the book by half a page so it sits
  // centred; the CSS transition makes the slide run alongside the turn.
  function centre() {
    let x = 0;
    if (flip.getOrientation() === 'landscape' && visible.length === 1) {
      x = (visible[0] === 0 ? -1 : 1) * flip.getBoundsRect().pageWidth / 2;
    }
    bookEl.style.transform = x ? 'translateX(' + x + 'px)' : '';
  }
  // 'flipping' = the turn animation has started (button, key, or a released drag): un-centre now so
  // the slide and the turn happen together instead of one after the other.
  flip.on('changeState', e => { if (e.data === 'flipping') bookEl.style.transform = ''; });
  addEventListener('resize', () => centre());

  let visible = [];
  function onPageChange() {
    const i = flip.getCurrentPageIndex();
    seek.value = i + 1;
    history.replaceState(null, '', '#p=' + (i + 1)); // replace, so turning pages doesn't fill Back history
    // Pages leaving the screen stop their media; pages arriving start their autoplay media.
    const now = FolioModel.visiblePages(i, B.pages.length, flip.getOrientation() === 'portrait');
    for (const idx of visible) if (!now.includes(idx) && pageEls[idx]) FolioOverlays.setActive(pageEls[idx], false);
    for (const idx of now) if (!visible.includes(idx) && pageEls[idx]) FolioOverlays.setActive(pageEls[idx], true);
    visible = now;
    if (document.activeElement !== num) num.value = now.map(x => x + 1).join('-'); // "2-3" on a spread
    centre();
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

  // Jumps skip the turn animation: page-flip only animates to a neighbouring spread.
  function goTo(page) {
    const i = Math.min(n, Math.max(1, Math.round(page) || 1)) - 1;
    flip.turnToPage(i);
    onPageChange();
  }

  document.getElementById('first').onclick = () => goTo(1);
  document.getElementById('last').onclick = () => goTo(n);
  document.getElementById('prev').onclick = () => flip.flipPrev();
  document.getElementById('next').onclick = () => flip.flipNext();
  num.onchange = () => goTo(parseInt(num.value, 10));
  num.onblur = () => onPageChange(); // put back the "2-3" label after typing
  addEventListener('hashchange', () => goTo(FolioModel.pageFromHash(location.hash, n) + 1));

  // A link to a book opened from disk is useless to anyone else, so Share appears only on a web host.
  const share = document.getElementById('share');
  share.hidden = location.protocol === 'file:' || !(navigator.share || navigator.clipboard);
  share.onclick = async () => {
    const url = location.href;
    if (navigator.share) return navigator.share({ title: document.title, url }).catch(() => {}); // cancel = AbortError
    await navigator.clipboard.writeText(url);
    share.textContent = 'Link copied';
    setTimeout(() => { share.textContent = 'Share'; }, 2000);
  };
  seek.oninput = () => goTo(seek.valueAsNumber);

  // ponytail: thumbnails reuse the full page images (lazy-loaded); bake small copies on export if big books load slowly.
  const thumbs = document.getElementById('thumbs');
  const list = document.getElementById('thumb-list');
  list.style.setProperty('--ratio', B.pageWidth + ' / ' + B.pageHeight);
  B.pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<img loading="lazy" alt=""><span></span>';
    b.firstChild.src = p.image;
    b.lastChild.textContent = i + 1;
    b.onclick = () => { thumbs.close(); goTo(i + 1); };
    list.append(b);
  });
  document.getElementById('grid').onclick = () => thumbs.showModal();
  const full = document.getElementById('full');
  if (!document.fullscreenEnabled) full.hidden = true;
  full.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || thumbs.open) return; // arrows belong to the number box and slider
    if (e.key === 'Home') goTo(1);
    if (e.key === 'End') goTo(n);
    if (e.key === 'ArrowLeft') flip.flipPrev();
    if (e.key === 'ArrowRight') flip.flipNext();
  });
})();
