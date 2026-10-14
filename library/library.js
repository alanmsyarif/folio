// Library page: reads window.LIBRARY (library-data.js, written by the editor's Library… button)
// and lists the books in the sub-folders next to it: the newest in a live reader, then one shelf
// per series. All text goes in through textContent.
(function () {
  'use strict';
  const L = window.LIBRARY || { books: [] };
  const $ = id => document.getElementById(id);
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  // Paths inside a book folder; the folder name is escaped ("Taste 52" -> "Taste%2052"). Links name
  // index.html so they also work for a library opened from disk.
  const at = (b, path) => encodeURIComponent(b.folder) + '/' + path;
  const href = b => at(b, 'index.html');
  const when = iso => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00Z');
    return isNaN(d) ? '' : new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
  };

  document.title = L.name || 'Library';
  $('name').textContent = L.name || 'Library';
  $('intro').textContent = L.intro || '';
  $('intro').hidden = !L.intro;
  const site = /^https?:\/\//i.test(L.website || '') ? L.website : '';
  if (site) {
    $('website').href = site;
    $('website').textContent = site.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  } else $('website').remove();
  const n = L.books.length;
  $('count').textContent = n === 1 ? '1 issue' : n + ' issues';

  if (!n) { $('empty').hidden = false; return; }

  // Newest issue, readable in place.
  const latest = L.books[0];
  $('latest').hidden = false;
  $('latest-reader').style.setProperty('--spread', 2 * latest.ratio);
  $('latest-reader').append(el('iframe', { src: href(latest), title: latest.title, allow: 'fullscreen; autoplay; clipboard-write; web-share', allowFullscreen: true }));
  $('latest-title').textContent = latest.title;
  $('latest-date').textContent = [latest.series, when(latest.date)].filter(Boolean).join(', ');
  $('latest-desc').textContent = latest.description;
  $('latest-desc').hidden = !latest.description;
  $('latest-open').href = href(latest);

  const card = (b, eager) => el('li', {}, el('a', { href: href(b), className: 'card' },
    el('img', { src: b.cover ? at(b, b.cover) : '', alt: '', loading: eager ? 'eager' : 'lazy', decoding: 'async', style: `aspect-ratio:${b.ratio}` }),
    el('span', { className: 'title', textContent: b.title }),
    el('span', { className: 'date', textContent: when(b.date) })));

  const next = L.books.slice(1, 4);
  $('also-new').append(...next.map(b => card(b, true)));
  $('also-new').hidden = !next.length;

  // One shelf per series: a scrolling row with arrows, or every cover at once with "Show all".
  const groups = [];
  const bySeries = new Map();
  for (const b of L.books) {
    const key = b.series || '';
    if (!bySeries.has(key)) { bySeries.set(key, []); if (key) groups.push(key); }
    bySeries.get(key).push(b);
  }
  if (bySeries.has('')) groups.push('');
  for (const key of groups) {
    const books = bySeries.get(key);
    const row = el('ul', { className: 'row' }, ...books.map(b => card(b, false)));
    const prev = el('button', { type: 'button', className: 'arrow', textContent: '‹', ariaLabel: 'Scroll back' });
    const fwd = el('button', { type: 'button', className: 'arrow', textContent: '›', ariaLabel: 'Scroll on' });
    const all = el('button', { type: 'button', className: 'all', textContent: 'Show all' });
    const shelf = el('section', { className: 'shelf' },
      el('div', { className: 'shelf-head' },
        el('h2', {}, key || (groups.length > 1 ? 'More issues' : 'Issues'), el('span', { className: 'n', textContent: books.length === 1 ? '1 issue' : books.length + ' issues' })),
        el('div', { className: 'controls' }, prev, fwd, all)),
      row);
    const step = dir => row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    prev.onclick = () => step(-1);
    fwd.onclick = () => step(1);
    all.onclick = () => {
      const open = shelf.classList.toggle('open');
      all.textContent = open ? 'Show fewer' : 'Show all';
      sync();
    };
    // Arrows only when the row overflows; each greys out at its end.
    const sync = () => {
      const overflow = !shelf.classList.contains('open') && row.scrollWidth > row.clientWidth + 2;
      prev.hidden = fwd.hidden = !overflow;
      all.hidden = !overflow && !shelf.classList.contains('open');
      prev.disabled = row.scrollLeft < 4;
      fwd.disabled = row.scrollLeft + row.clientWidth > row.scrollWidth - 4;
    };
    row.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    $('shelves').append(shelf);
    sync();
  }
})();
