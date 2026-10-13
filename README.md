# Folio

Turn a PDF into a page-flipping book with images, videos and links on any page, and export it as a
static folder you can upload anywhere or open from disk.

## Edit

    npm start

Open http://127.0.0.1:8080/editor/ in Chrome, Edge or Opera (export needs the File System Access API).

1. **Open PDF.** Every page is rendered to an image.
2. Drag on a page to draw a box. Choose its type in the right panel:
   - **Image**: PNG, JPEG, WebP or GIF from disk.
   - **Video file**: MP4 or WebM from disk, copied into the book.
   - **YouTube / Vimeo link**: paste the normal page address.
   - **Link**: a web address, or a page number to jump to.
3. Drag a box to move it, drag its corners to resize, and press Delete to remove it.
   **Preview** shows the boxes working.
4. **Export…** and pick a folder. To keep editing later, use **Open book folder** on that same folder,
   then export again.

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
| `npm test` (book model) | 19/19 pass |
| Viewer from `file://`: flip by button, arrow keys and drag; single page in a narrow window | pass |
| Dragging on a video does not turn the page; the same drag on bare page does | pass |
| Page link jumps to its page; web link opens a new tab without flipping | pass |
| Editor: PDF import (pages baked at 2000 px), broken PDF shows an error | pass |
| PDF with a landscape page among portrait ones: every page baked at page 1 size, centred | pass |
| Hidden YouTube/Vimeo player resets as soon as its spread leaves the screen | pass (stubbed player) |
| Editor: draw, type, move (clamped), resize (min size), delete, preview | pass |
| Export blocked by an unfinished box, which gets selected | pass |
| Export / reopen / re-export into the same folder 3 times; removed media deleted | pass (browser-private storage stand-in for the folder picker) |
| Exporting into an unrelated folder asks first, names files it would replace, deletes nothing | pass (same stand-in) |
| Exporting a different book into an existing book folder asks before replacing it | pass (same stand-in) |
| Exported folder opened from disk shows every box | pass |

Not yet checked in a real browser window:
- Opera GX with a real folder picked from disk (export, reopen, re-export into the same folder).
- YouTube and Vimeo playback (headless Chromium can't play them).
- A password-protected PDF.
- The "Leave site?" prompt after unsaved changes.
