// Builds the DOM for one page's overlays. Shared by the editor preview and the exported viewer.
// srcFor maps a stored path ("media/o1.png") to a URL: the viewer passes paths through,
// the editor returns blob URLs.
(function (root) {
  'use strict';
  const M = root.FolioModel;

  function renderOverlay(o, srcFor) {
    let el;
    if (o.type === 'image') {
      el = document.createElement('img');
      el.src = srcFor(o.src);
      el.alt = '';
      el.draggable = false;
    } else if (o.type === 'video') {
      el = document.createElement('video');
      el.src = srcFor(o.src);
      el.controls = true;
      el.playsInline = true;
      el.preload = 'metadata';
    } else if (o.type === 'embed') {
      el = document.createElement('iframe');
      el.src = M.toEmbedUrl(o.url) || 'about:blank';
      el.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      el.allowFullscreen = true;
      el.referrerPolicy = 'strict-origin-when-cross-origin';
      el.title = 'Video';
    } else {
      el = document.createElement('a');
      if (o.page) {
        el.href = '#page=' + o.page;
        el.dataset.page = o.page;
        el.setAttribute('aria-label', 'Go to page ' + o.page);
      } else if (M.isSafeHref(o.href)) {
        el.href = o.href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
        el.setAttribute('aria-label', o.href);
      }
    }
    el.classList.add('fo-overlay', 'fo-' + o.type);
    el.dataset.id = o.id;
    el.style.left = o.x * 100 + '%';
    el.style.top = o.y * 100 + '%';
    el.style.width = o.w * 100 + '%';
    el.style.height = o.h * 100 + '%';
    return el;
  }

  function renderPageOverlays(layer, page, srcFor) {
    layer.replaceChildren(...page.overlays.map(o => renderOverlay(o, srcFor)));
  }

  root.FolioOverlays = { renderOverlay, renderPageOverlays };
})(globalThis);
