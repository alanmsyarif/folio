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
  document.getElementById('total').textContent = 'of ' + n;

  const pageEls = B.pages.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'page';
    const img = document.createElement('img');
    img.className = 'fo-page';
    // Start on the small thumbnail; loadNear() swaps in the full page once the reader is close
    // and back again once they're far away.
    img.src = p.thumb || p.image;
    if (p.thumb) Object.assign(img.dataset, { full: p.image, thumb: p.thumb });
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

  // Full pages for the spread and its neighbours; pages well away drop back to their thumbnail so a
  // long read doesn't keep every full page in memory. The gap between the two ranges stops pages
  // flipping between the two while the reader goes back and forth.
  function loadNear(i) {
    pageEls.forEach((el, k) => {
      const img = el.querySelector('img.fo-page');
      if (!img.dataset.full) return; // no thumbnail: always the full page
      const want = k >= i - 2 && k <= i + 3 ? img.dataset.full : k < i - 8 || k > i + 9 ? img.dataset.thumb : null;
      if (want && img.getAttribute('src') !== want) img.src = want;
    });
  }

  let visible = [];
  function onPageChange() {
    const i = flip.getCurrentPageIndex();
    loadNear(i);
    seek.value = i + 1;
    seek.style.setProperty('--read', (n > 1 ? i / (n - 1) * 100 : 100) + '%'); // gold page edges up to here
    history.replaceState(null, '', '#p=' + (i + 1)); // replace, so turning pages doesn't fill Back history
    // Pages leaving the screen stop their media; pages arriving start their autoplay media.
    const now = FolioModel.visiblePages(i, B.pages.length, flip.getOrientation() === 'portrait');
    for (const idx of visible) if (!now.includes(idx) && pageEls[idx]) FolioOverlays.setActive(pageEls[idx], false);
    for (const idx of now) if (!visible.includes(idx) && pageEls[idx]) FolioOverlays.setActive(pageEls[idx], true);
    visible = now;
    if (document.activeElement !== num) num.value = now.map(x => x + 1).join('–'); // "2–3" on a spread
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

  const thumbs = document.getElementById('thumbs');
  const list = document.getElementById('thumb-list');
  list.style.setProperty('--ratio', B.pageWidth + ' / ' + B.pageHeight);
  B.pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = '<img loading="lazy" alt=""><span></span>';
    b.firstChild.src = p.thumb || p.image;
    b.lastChild.textContent = i + 1;
    b.onclick = () => { thumbs.close(); goTo(i + 1); };
    list.append(b);
  });
  document.getElementById('grid').onclick = () => thumbs.showModal();

  // Search over the text baked at PDF import. Books without any (scans, older exports) get no button.
  // ponytail: results jump to the page but don't highlight the words on it; that needs word positions from import.
  const finder = document.getElementById('finder');
  const fq = document.getElementById('fq');
  const fstatus = document.getElementById('fstatus');
  const fresults = document.getElementById('fresults');
  const findBtn = document.getElementById('find');
  findBtn.hidden = !B.pages.some(p => p.text);
  findBtn.onclick = () => { finder.showModal(); fq.select(); };
  fq.oninput = () => {
    const hits = FolioModel.searchPages(B.pages, fq.value);
    fstatus.textContent = fq.value.trim().length < 2 ? '' : hits.length ? hits.length + (hits.length === 1 ? ' page' : ' pages') : 'No matches';
    fresults.replaceChildren(...hits.map(h => {
      const b = document.createElement('button');
      b.type = 'button';
      const head = document.createElement('strong');
      head.textContent = 'Page ' + (h.index + 1) + (h.count > 1 ? ', ' + h.count + ' matches' : '');
      const snip = document.createElement('span');
      const mark = document.createElement('mark');
      mark.textContent = h.match;
      snip.append(h.before, mark, h.after); // text nodes: page text is never parsed as HTML
      b.append(head, snip);
      b.onclick = () => { finder.close(); goTo(h.index + 1); };
      const li = document.createElement('li');
      li.append(b);
      return li;
    }));
  };
  fq.onkeydown = e => { if (e.key === 'Enter') fresults.querySelector('button')?.click(); }; // Enter = first result

  // Zoom: the pages on screen, full resolution, in a scrollable full-window view. Images only:
  // ponytail: links and videos aren't clickable while zoomed; render overlays here if readers need them.
  const zoomer = document.getElementById('zoomer');
  const zview = document.getElementById('zview');
  const zpages = document.getElementById('zpages');
  const zin = document.getElementById('zin'), zout = document.getElementById('zout');
  const MIN = 1, MAX = 4;
  let scale = 1;
  function setScale(s) {
    // Keep the point at the centre of the view where it is.
    const cx = (zview.scrollLeft + zview.clientWidth / 2) / zview.scrollWidth;
    const cy = (zview.scrollTop + zview.clientHeight / 2) / zview.scrollHeight;
    scale = Math.min(MAX, Math.max(MIN, s));
    const count = zpages.children.length;
    const fit = Math.min(zview.clientWidth, zview.clientHeight * count * B.pageWidth / B.pageHeight); // whole spread fits at 1×
    zpages.style.width = fit * scale + 'px';
    zview.scrollLeft = cx * zview.scrollWidth - zview.clientWidth / 2;
    zview.scrollTop = cy * zview.scrollHeight - zview.clientHeight / 2;
    zin.disabled = scale >= MAX;
    zout.disabled = scale <= MIN;
  }
  document.getElementById('zoom').onclick = () => {
    zpages.replaceChildren(...visible.map(i => Object.assign(new Image(), { src: B.pages[i].image, alt: 'Page ' + (i + 1), draggable: false })));
    zoomer.showModal();
    setScale(2);
    zview.scrollLeft = (zview.scrollWidth - zview.clientWidth) / 2; // open on the middle of the spread
    zview.scrollTop = (zview.scrollHeight - zview.clientHeight) / 2;
  };
  zin.onclick = () => setScale(scale * 1.5);
  zout.onclick = () => setScale(scale / 1.5);
  // Mouse drag pans (touch and trackpads already scroll natively).
  zview.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    zview.setPointerCapture(e.pointerId);
    const move = ev => { zview.scrollLeft -= ev.movementX; zview.scrollTop -= ev.movementY; };
    zview.addEventListener('pointermove', move);
    zview.addEventListener('pointerup', () => zview.removeEventListener('pointermove', move), { once: true });
  });
  const full = document.getElementById('full');
  if (!document.fullscreenEnabled) full.hidden = true;
  full.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen());
  // A choice in the ⋯ menu closes it (Pages, Search and Zoom also close it by opening their dialog).
  const tools = document.getElementById('tools');
  tools.addEventListener('click', e => { if (e.target.closest('button') && tools.matches(':popover-open')) tools.hidePopover(); });
  // The popover's own tap-outside-to-close misses taps on the book (page-flip takes the touch), so close it here.
  document.addEventListener('pointerdown', e => {
    if (tools.matches(':popover-open') && !e.target.closest('#tools, #more')) tools.hidePopover();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || thumbs.open || zoomer.open || finder.open) return; // arrows belong to the number box and slider
    if (e.key === 'Home') goTo(1);
    if (e.key === 'End') goTo(n);
    if (e.key === 'ArrowLeft') flip.flipPrev();
    if (e.key === 'ArrowRight') flip.flipNext();
  });
})();
