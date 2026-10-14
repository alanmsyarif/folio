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
      // Controls show while pointed at or focused, and while a click-to-play video waits paused;
      // otherwise they hide, so a playing video is clean. Autoplay boxes are never bare-paused-with-
      // controls, so the turn animation doesn't flash a play button.
      let near = false;
      const sync = () => { el.controls = near || (el.paused && !o.autoplay); };
      for (const [type, value] of [['mouseenter', true], ['focus', true], ['mouseleave', false], ['blur', false]]) {
        el.addEventListener(type, () => { near = value; sync(); });
      }
      el.addEventListener('play', sync);
      el.addEventListener('pause', sync);
      el.tabIndex = 0; // reachable by keyboard even while its controls are hidden
      sync();
      el.playsInline = true;
      el.preload = 'metadata';
      if (o.autoplay) {
        // Browsers only autoplay muted media; the reader can unmute from the controls.
        el.muted = true;
        el.setAttribute('muted', ''); // survives page-flip's cloneNode during the turn animation
        el.loop = true;
        el.dataset.autoplay = '';
      }
    } else if (o.type === 'embed') {
      el = document.createElement('iframe');
      if (o.autoplay) {
        // Loaded only while on screen (see setActive), so hidden players never run.
        el.dataset.src = M.toEmbedUrl(o.url, { autoplay: true }) || 'about:blank';
        el.dataset.autoplay = '';
        el.src = 'about:blank';
      } else {
        el.src = M.toEmbedUrl(o.url) || 'about:blank';
      }
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

  // Call when a page (or the editor preview) comes on screen (on = true) or leaves it.
  // On: autoplay videos start, autoplay embeds load. Off: videos pause, autoplay embeds unload,
  // other embeds reload so their player stops.
  function setActive(container, on) {
    for (const v of container.querySelectorAll('video.fo-overlay')) {
      if (!on) v.pause();
      else if ('autoplay' in v.dataset) v.play().catch(() => { v.controls = true; }); // blocked: let the reader press play
    }
    for (const f of container.querySelectorAll('iframe.fo-overlay')) {
      if ('autoplay' in f.dataset) f.src = on ? f.dataset.src : 'about:blank';
      else if (!on) f.src = f.src;
    }
  }

  root.FolioOverlays = { renderOverlay, renderPageOverlays, setActive };
})(globalThis);
