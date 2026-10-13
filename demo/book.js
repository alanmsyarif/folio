window.BOOK = {
 "version": 1,
 "title": "Folio demo",
 "pageWidth": 700,
 "pageHeight": 990,
 "pages": [
  {
   "image": "pages/1.svg",
   "overlays": []
  },
  {
   "image": "pages/2.svg",
   "overlays": [
    {
     "id": "d1",
     "type": "link",
     "x": 0.1,
     "y": 0.3,
     "w": 0.8,
     "h": 0.1,
     "page": 5
    },
    {
     "id": "d2",
     "type": "link",
     "x": 0.1,
     "y": 0.5,
     "w": 0.8,
     "h": 0.1,
     "href": "https://example.com/"
    }
   ]
  },
  {
   "image": "pages/3.svg",
   "overlays": [
    {
     "id": "d3",
     "type": "embed",
     "x": 0.05,
     "y": 0.25,
     "w": 0.9,
     "h": 0.3,
     "url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ"
    },
    {
     "id": "d4",
     "type": "video",
     "x": 0.05,
     "y": 0.6,
     "w": 0.9,
     "h": 0.3,
     "src": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    }
   ]
  },
  {
   "image": "pages/4.svg",
   "overlays": [
    {
     "id": "d5",
     "type": "image",
     "x": 0.25,
     "y": 0.3,
     "w": 0.5,
     "h": 0.4,
     "src": "pages/1.svg"
    }
   ]
  },
  {
   "image": "pages/5.svg",
   "overlays": [
    {
     "id": "d6",
     "type": "video",
     "x": 0.05,
     "y": 0.3,
     "w": 0.9,
     "h": 0.4,
     "src": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
     "autoplay": true
    }
   ]
  },
  {
   "image": "pages/6.svg",
   "overlays": [
    {
     "id": "d7",
     "type": "embed",
     "x": 0.05,
     "y": 0.3,
     "w": 0.9,
     "h": 0.3,
     "url": "https://youtu.be/aqz-KE-bpKQ",
     "autoplay": true
    }
   ]
  }
 ]
};
