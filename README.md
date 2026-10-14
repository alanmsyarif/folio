# Folio

Turn a PDF into a page-flipping book with images, videos and links on any page, and export it as a
static folder you can upload anywhere or open from disk.

## Edit

    npm start

Open http://127.0.0.1:8080/editor/ in Chrome, Edge or Opera (export needs the File System Access API).

1. **Open PDF.** Every page is rendered to an image, plus a small thumbnail and its text for search.
2. Drag on a page to draw a box. Choose its type in the right panel:
   - **Image**: PNG, JPEG, WebP or GIF from disk.
   - **Video file**: MP4 or WebM from disk, copied into the book.
   - **YouTube / Vimeo link**: paste the normal page address.
   - **Link**: a web address, or a page number to jump to.

   Video boxes have an **Autoplay and loop** checkbox. The video starts when its page turns into
   view and loops; browsers only allow this muted, so readers unmute it from the player controls.
   Player controls stay hidden while a video plays and appear when the reader points at it.
3. Drag a box to move it, drag its corners to resize, and press Delete to remove it.
   **Preview** shows the boxes working.
4. **Export…** and pick a folder. To keep editing later, use **Open book folder** on that same folder,
   then export again.

## Read

The exported book opens on its cover, centred. Turn pages by dragging a corner, clicking ‹ ›, or the
arrow keys. The bar also has:

- **« »** (or Home / End): first and last page.
- **Page box**: shows the spread on screen ("2-3"); type a number and press Enter to jump.
- **Slider**: scrub through the book.
- **Pages**: a grid of every page; click one to go there.
- **Zoom**: the pages on screen at full size. **+** / **−** zoom from 1× to 4×, drag (or scroll) to
  move around, Esc to close. Links and videos can't be clicked while zoomed.
- **Search**: finds words in the book, ignoring case and accents; click a result to go to its page.
  Hidden for books with no text (scanned PDFs, or books exported before search existed; import the
  PDF again to add it).
- **Share**: the system share sheet, or copies the link. Hidden when the book is opened from disk.
- **Fullscreen**.

On narrow screens (phones) the slider gets its own row, « » are dropped (the slider reaches the ends),
and Pages, Zoom, Search, Share and Fullscreen move into a **⋯** menu.

The address follows the page (`index.html#p=12`), so a reload or a shared link opens that page.
Each page loads as a thumbnail first; the full page loads when the reader gets near it and drops
back to the thumbnail once they're far away, so long books stay light on memory.

## Share

Upload the exported folder to any static host (GitHub Pages, Netlify, your own server) or open its
`index.html` from disk.

YouTube embeds usually refuse to play from a file opened on disk. They work once the folder is hosted
over http(s). For offline books, use a video file instead.

## Develop

    npm test       # model unit tests
    npm run demo   # writes demo/, a 6-page sample book for checking the viewer

Vendored: pdf.js 6.4.299, page-flip 2.0.7 (see vendor/LICENSES.md).

## Tested

2026-10-13, headless Chromium 151.0.7922.34 (Playwright), Windows 11. Generated 3-page PDF.

| Check | Result |
|---|---|
| `npm test` (book model) | 20/20 pass |
| Viewer from `file://`: flip by button, arrow keys and drag; single page in a narrow window | pass |
| Dragging on a video does not turn the page; the same drag on bare page does | pass |
| Page link jumps to its page; web link opens a new tab without flipping | pass |
| Editor: PDF import (pages baked at 2000 px), broken PDF shows an error | pass |
| PDF with a landscape page among portrait ones: every page baked at page 1 size, centred | pass |
| Hidden YouTube/Vimeo player resets as soon as its spread leaves the screen | pass (stubbed player) |
| Autoplay boxes: video starts muted and loops only while its page is on screen; YouTube box loads only while on screen; setting saved on export | pass (play() counted, player stubbed) |
| Editor: draw, type, move (clamped), resize (min size), delete, preview | pass |
| Export blocked by an unfinished box, which gets selected | pass |
| Export / reopen / re-export into the same folder 3 times; removed media deleted | pass (browser-private storage stand-in for the folder picker) |
| Exporting into an unrelated folder asks first, names files it would replace, deletes nothing | pass (same stand-in) |
| Exporting a different book into an existing book folder asks before replacing it | pass (same stand-in) |
| Exported folder opened from disk shows every box | pass |

2026-10-14, Chrome 155.0.8059.40 driven over the DevTools protocol, Windows 11. 6-page demo book
(`npm run demo`) and a generated 3-page PDF.

| Check | Result |
|---|---|
| `npm test` (book model) | 25/25 pass |
| First / last, typed page, slider, page grid, Home / End; out-of-range page clamps to the last | pass |
| Cover and lone last page sit centred; the shift clears as soon as a turn starts | pass |
| `#p=N` follows the page without adding history; opening `#p=3`, `#p=99` (http and file://) lands right | pass |
| Share shown over http, hidden from disk | pass (share sheet itself not opened) |
| Video controls hidden while playing, shown on hover / focus and for a paused click-to-play video | pass (autoplay forced on; the blocked-autoplay path not run) |
| PDF import bakes 320 px WebP thumbnails and page text | pass |
| Viewer: pages near the reader load full size, the rest stay thumbnails; grid uses thumbnails | pass |
| 40-page book: only the spread ±2–3 pages hold full images; far pages return to thumbnails after jumps | pass |
| Phone size (390×844, touch emulated): no sideways scroll, slider row, ⋯ menu opens above the bar, tapping the book closes it, Pages / Search / Zoom open from it; desktop bar unchanged | pass |
| Zoom: opens at 2× centred, 1×–4× limits, mouse drag pans, Esc closes, page keys ignored | pass |
| Search: case / accent folding, counts, snippets, Enter and click jump to the page | pass |

Not yet checked in a real browser window:
- Opera GX with a real folder picked from disk (export, reopen, re-export into the same folder).
- YouTube and Vimeo playback (headless Chromium can't play them).
- A password-protected PDF.
- The "Leave site?" prompt after unsaved changes.
- Export and reopen of a book with thumbnails and text through a real folder picker.
- Zoom and search on a phone; search on a real-world PDF (columns, odd fonts).
