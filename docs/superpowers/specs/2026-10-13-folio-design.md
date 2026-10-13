# Folio — flipbook editor + static viewer

Date: 2026-10-13
Status: draft, awaiting review

## Goal

Turn a PDF into a page-flipping book with images, videos and links placed on
any page. Author it in a visual editor in a Chromium browser (Opera GX); export a
self-contained static folder that works when uploaded to any static host or
opened straight from disk.

Success: open a PDF, draw a box on page 3, make it a YouTube video, draw
another box and make it a link to page 5, export, open the exported
`index.html` — pages flip with a curl, the video plays, the link jumps to page 5.

## Decisions (agreed)

- Distribution: exported static folder. No server, no accounts.
- Authoring: visual editor (draw / drag / resize boxes).
- Video: local files (copied into export) and YouTube/Vimeo links.
- Rendering: pages baked to WebP at import time (approach A). Viewer ships
  images only, no pdf.js. Trade-off accepted: no text select/search, zoom
  limited by bake resolution.
- Export writes via `showDirectoryPicker` (Chromium only). Readers can use any
  modern browser; only the editor needs Chromium.

## Layout

```
folio/
  serve.js                 node stdlib static server for the editor (pdf.js worker
                           needs http://, not file://)
  editor/index.html  editor.js  editor.css
  viewer/index.html  viewer.js  viewer.css   template copied into every export
  shared/model.js          pure functions, no DOM: book shape, validation,
                           embed URL parsing, export file list
  shared/overlays.js       builds overlay DOM for one page; used by editor
                           preview and viewer so both render identically
  vendor/                  pdf.min.mjs, pdf.worker.min.mjs (pdfjs-dist),
                           page-flip.browser.js (page-flip, MIT); committed,
                           no build step
  test/model.test.js       node --test
```

No bundler, no framework. The two `shared/` files are classic scripts that set
a global (`FolioModel`, `FolioOverlays`) and also `module.exports` when present,
so the same file loads in the editor, the exported viewer (copied verbatim) and
`node --test`. The editor's own code is an ES module (it imports pdf.js); the
viewer is classic scripts only (see file:// below).

## Book data

Exported as `book.js` containing `window.BOOK = {...}` — not `book.json`,
because `fetch()` of a local file fails under `file://` while a classic
`<script>` tag works. Same reason the viewer uses classic scripts, not modules.

```js
{
  version: 1,
  title: "My book",
  pageWidth: 1400, pageHeight: 1980,      // baked image size, px
  pages: [
    { image: "pages/1.webp",
      overlays: [
        { id: "o1", type: "image", x: 0.1, y: 0.2, w: 0.3, h: 0.2, src: "media/o1.png" },
        { id: "o2", type: "video", ..., src: "media/o2.mp4" },
        { id: "o3", type: "embed", ..., url: "https://www.youtube.com/watch?v=..." },
        { id: "o4", type: "link",  ..., href: "https://example.com" },
        { id: "o5", type: "link",  ..., page: 5 }
      ] }
  ]
}
```

- `x y w h` are fractions of the page (0–1), so overlays survive any display
  size. Clamped to the page on save.
- `embed` stores the original URL; `model.js` converts to the player URL at
  render time: YouTube (`watch?v=`, `youtu.be/`, `shorts/`) to
  `youtube-nocookie.com/embed/ID`, Vimeo to `player.vimeo.com/video/ID`.
  Unrecognised URL is rejected in the editor with a message.
- `link` has exactly one of `href` (http/https/mailto only; opens a new tab,
  `rel="noopener"`) or `page` (1-based, flips there).
- Media files are named by overlay id plus original extension.

## Editor

1. **Open PDF** (file input). pdf.js renders every page to a WebP blob, long side
   2000 px, quality 0.85 (constants, with a comment). Progress shown per page.
   From here on the editor works only on page images, the same as after
   re-opening an export, so there is one code path.
2. **Open exported folder** (`showDirectoryPicker`) loads `book.js`, `pages/`,
   `media/` back in. This is how you save and resume work; there is no
   IndexedDB or autosave.
3. Screen: page list on the left (thumbnails from the blobs), current page in
   the middle with the overlay layer, properties panel on the right.
4. **Draw**: drag a rectangle on the page, then pick a type in the properties
   panel: Image (file picker), Video file (file picker, mp4/webm), Video link
   (URL), Link (URL or page number). Boxes are drawn in pointer events on a
   positioned layer over the page image.
5. **Edit**: click to select; drag to move; corner handles resize; Delete key
   removes; the properties panel edits fields.
6. **Preview** toggles the overlay layer to viewer rendering (via
   `shared/overlays.js`) so videos and embeds can be checked in place.
7. **Export** to a picked folder writes `index.html`, `viewer.js`,
   `viewer.css`, `model.js`, `overlays.js`, `page-flip.browser.js`, `book.js`,
   `pages/N.webp`, `media/*`. Files in `media/` that the book no longer references are deleted,
   so re-exporting to the same folder leaves no orphans. If the browser denies
   write permission, show the error and write nothing.

## Viewer

- `index.html` loads `page-flip.browser.js`, `book.js`, `model.js`,
  `overlays.js`, `viewer.js`.
- Builds one `div.page` per page (`<img>` plus overlay layer from
  `FolioOverlays`), then
  `PageFlip.loadFromHTML`. Two-page spread on wide screens, single page in
  portrait (`usePortrait`). Fits the window and re-fits on resize.
- Controls: prev/next buttons, "n / N" counter, fullscreen (native
  `requestFullscreen`), arrow keys.
- On every flip, pause all `<video>` elements and reset iframes not on the
  visible pages (reassign `src`) so audio stops.
- Internal links call `pageFlip.flip(page - 1)`.

## Known risk to settle first

StPageFlip listens for mouse/touch on pages to start a flip. Clicking video
controls, dragging the video scrubber, or using an iframe player could flip the
page instead. Plan: overlays stop `mousedown`/`touchstart` propagation, and
links handle their own click. **Verify this in the first implementation task
with a throwaway page before building the editor.** If StPageFlip can't be
tamed, fall back to playing video in a modal opened by clicking the overlay.

YouTube embeds may refuse to play from `file://` (no referrer). Expected
behaviour: works when hosted over http(s). The viewer shows the iframe anyway;
the README says to use a local video file for offline books.

## Testing

- `node --test test/` on `shared/model.js`: embed URL parsing (each YouTube
  form, Vimeo, rejects others), link validation (exactly one target, scheme
  allow-list), clamping, export file list including orphan detection,
  `book.js` serialisation round-trip.
- Manual check in Opera GX against the success scenario above, both from
  `file://` and through `node serve.js`; record the result in the README.

## Out of scope (v1)

Text search and selection, deep zoom, thumbnails strip in the viewer, audio
overlays, password or analytics, undo/redo, editing on mobile, Firefox and Safari
editor support (the viewer works in them), zip export.
