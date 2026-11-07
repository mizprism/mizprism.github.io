// Glass bands that show the background photo through them.
//
// Every element with class "glass" becomes a strip of glass over the photo. The photo is known, so
// instead of filtering the page behind the strip (backdrop-filter: url() does nothing in Safari),
// each strip holds its own copy of the photo, cut to the strip's shape, and that copy is filtered:
//
//   1. refraction: a displacement map worked out from Snell's law for a rounded edge of glass
//      (index 1.5), applied with feImage + feDisplacementMap;
//   2. colour fringes: the red, green and blue channels are displaced three times by slightly
//      different amounts and added back together;
//   3. saturate(1.85) brightness(1.02) after the refraction; a 12% white layer and the edge light
//      are drawn over the copy in CSS.
//
// data-field="<selector>"  the box the photo covers. Without it the photo covers the strip itself.
// data-zoom="z"             the photo is drawn z times larger than it needs to be to cover that box
//                          (default 1). The BOOTH image covers a square, which enlarges the photo
//                          1.5 times and leaves the pole and the trees on its left out of the frame.
// data-focus="fx fy"        the point of the photo (0..1 across, 0..1 down) put at the centre of the
//                          box, as far as the photo still covers the box (default 0.5 0.5).
// data-rows                 the rows of the photo are pushed sideways a little (inside the strip only).
(() => {
  'use strict';
  // The photo is 1476 x 1065 with a black border down its left (x < 17) and right (x > 1461) edges,
  // as a tape frame has; only the picture inside the border is laid over the box.
  const PHOTO = { src: 'assets/outside.webp', w: 1476, h: 1065, cx: 17, cy: 0, cw: 1444, ch: 1065 };
  const N = 1.5;               // refractive index of the glass
  const P = 2.6;               // the edge: a superellipse of this power (2 = round, larger = flatter top)
  const SVGNS = 'http://www.w3.org/2000/svg';
  const defs = document.getElementById('glass-defs');
  const strips = [...document.querySelectorAll('.glass')];
  let count = 0;

  // How far the image under a point is pushed, across one strip of thickness 1, as -1..1.
  // The edge of the strip is a rounded bevel (a squircle, h = (1 - (1 - d)^4)^(1/4), d = 0 at the
  // edge and 1 at the middle). A ray going straight down meets the surface at the angle of its
  // normal, t1 = atan(dh/dd), and leaves at t2 = asin(sin t1 / N); the sideways shift is
  // proportional to tan(t1 - t2). Near the edge the shift points outwards, so the edge of the strip
  // shows a little of the photo beyond it, squeezed.
  function profile(samples) {
    const out = new Float32Array(samples);
    const height = (d) => Math.pow(1 - Math.pow(1 - Math.min(Math.max(d, 0), 1), P), 1 / P);
    let max = 0;
    for (let i = 0; i < samples; i++) {
      const x = (i + 0.5) / samples;              // 0 .. 1 across the strip
      const d = Math.min(x, 1 - x) * 2;           // 0 at an edge, 1 in the middle
      const e = 1e-3;
      const slope = (height(d + e) - height(d - e)) / (2 * e);
      const t1 = Math.min(Math.atan(slope * 0.5), 1.35);
      const t2 = Math.asin(Math.sin(t1) / N);
      const s = Math.tan(t1 - t2) * (x < 0.5 ? -1 : 1);
      out[i] = s;
      max = Math.max(max, Math.abs(s));
    }
    for (let i = 0; i < samples; i++) out[i] = max ? out[i] / max : 0;
    return out;
  }

  // The displacement map for a copy of size w x h whose strip lies `m` px inside each edge.
  // Horizontal strips move pixels up and down (green channel), vertical ones left and right (red).
  function mapURL(w, h, m, vertical) {
    const across = Math.round(vertical ? w : h);
    const canvas = document.createElement('canvas');
    canvas.width = vertical ? across : 1;
    canvas.height = vertical ? 1 : across;
    const g = canvas.getContext('2d');
    const img = g.createImageData(canvas.width, canvas.height);
    const band = Math.max(1, across - 2 * m);
    const p = profile(Math.round(band));
    for (let i = 0; i < across; i++) {
      const k = i - m;
      const v = k >= 0 && k < p.length ? p[k] : 0;
      const c = Math.round(128 + 127 * v);
      const o = i * 4;
      img.data[o] = vertical ? c : 128;
      img.data[o + 1] = vertical ? 128 : c;
      img.data[o + 2] = 128;
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return canvas.toDataURL('image/png');
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function buildFilter(id, w, h, m, vertical, rows) {
    const old = document.getElementById(id);
    if (old) old.remove();
    const thick = vertical ? w - 2 * m : h - 2 * m;
    // The filter region is the copy's own box (objectBoundingBox), and the map image is given no
    // x / y / width / height, so it fills that region. Giving feImage a size in px drew nothing in
    // WebKit, and a map sized in objectBoundingBox units drew nothing in Chromium (both tried).
    const f = el('filter', { id, x: 0, y: 0, width: 1, height: 1, 'color-interpolation-filters': 'sRGB' }, defs);
    el('feImage', { href: mapURL(w, h, m, vertical), preserveAspectRatio: 'none', result: 'map' }, f);
    let src = 'SourceGraphic';
    if (rows) {
      // Rows of the photo pushed sideways in steps: noise that changes only from row to row,
      // quantised so whole rows move together.
      el('feTurbulence', { type: 'fractalNoise', baseFrequency: '0 0.085', numOctaves: 1, seed: 11, result: 'noise' }, f);
      const ct = el('feComponentTransfer', { in: 'noise', result: 'shift' }, f);
      el('feFuncR', { type: 'discrete', tableValues: '0.5 0.5 0.5 0.66 0.5 0.36 0.5 0.5 0.74 0.5' }, ct);
      el('feFuncG', { type: 'linear', slope: 0, intercept: 0.5 }, ct);
      el('feFuncB', { type: 'linear', slope: 0, intercept: 0.5 }, ct);
      el('feFuncA', { type: 'linear', slope: 0, intercept: 1 }, ct);
      el('feDisplacementMap', { in: 'SourceGraphic', in2: 'shift', scale: Math.round(thick * 1.6), xChannelSelector: 'R', yChannelSelector: 'G', result: 'rows' }, f);
      src = 'rows';
    }
    const s = thick * 1.0;
    const keep = {
      R: '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0',
      G: '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0',
      B: '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0',
    };
    [['R', 1.0], ['G', 0.72], ['B', 0.44]].forEach(([c, k]) => {
      el('feDisplacementMap', { in: src, in2: 'map', scale: (s * k).toFixed(2), xChannelSelector: 'R', yChannelSelector: 'G', result: 'd' + c }, f);
      el('feColorMatrix', { in: 'd' + c, type: 'matrix', values: keep[c], result: 'c' + c }, f);
    });
    el('feComposite', { in: 'cR', in2: 'cG', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'cRG' }, f);
    el('feComposite', { in: 'cRG', in2: 'cB', operator: 'arithmetic', k1: 0, k2: 1, k3: 1, k4: 0, result: 'rgb' }, f);
    el('feColorMatrix', { in: 'rgb', type: 'saturate', values: 1.85, result: 'sat' }, f);
    const b = el('feComponentTransfer', { in: 'sat' }, f);
    ['R', 'G', 'B'].forEach((c) => el('feFunc' + c, { type: 'linear', slope: 1.02, intercept: 0 }, b));
  }

  function layout(strip) {
    const r = strip.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const vertical = r.height > r.width;
    const thick = vertical ? r.width : r.height;
    // margin of photo around the strip: the farthest any channel samples from (refraction at the edge,
    // half of thick * 1.0, plus the row shift, up to 0.24 of thick * 1.6), so no channel reads past
    // the copy (a channel that reads nothing leaves the others alone: a pure blue or red pixel)
    const m = Math.ceil(thick * 0.95) + 2;
    let field;
    if (strip.dataset.field) {
      const f = document.querySelector(strip.dataset.field).getBoundingClientRect();
      field = { x: f.left - r.left, y: f.top - r.top, w: f.width, h: f.height };
    } else {
      field = { x: 0, y: 0, w: r.width, h: r.height };
    }
    const zoom = Number(strip.dataset.zoom || 1);
    const [fx, fy] = (strip.dataset.focus || '0.5 0.5').split(/\s+/).map(Number);
    const scale = Math.max(field.w / PHOTO.cw, field.h / PHOTO.ch) * zoom;
    const pw = PHOTO.cw * scale, ph = PHOTO.ch * scale;
    // the picture's top-left corner, so that the focus lands on the box's centre, kept covering the box
    const px = Math.min(0, Math.max(field.w - pw, field.w / 2 - fx * pw));
    const py = Math.min(0, Math.max(field.h - ph, field.h / 2 - fy * ph));
    const iw = PHOTO.w * scale, ih = PHOTO.h * scale;
    const ix = field.x + px - PHOTO.cx * scale;
    const iy = field.y + py - PHOTO.cy * scale;
    const w = Math.round(r.width + 2 * m), h = Math.round(r.height + 2 * m);
    const copy = strip.querySelector('.glass-copy');
    copy.style.cssText =
      `left:${-m}px;top:${-m}px;width:${w}px;height:${h}px;` +
      `background-image:url(${PHOTO.src});background-size:${iw.toFixed(1)}px ${ih.toFixed(1)}px;` +
      `background-position:${(ix + m).toFixed(1)}px ${(iy + m).toFixed(1)}px;` +
      `filter:url(#${strip.dataset.filter})`;
    buildFilter(strip.dataset.filter, w, h, m, vertical, 'rows' in strip.dataset);
  }

  for (const s of strips) {
    s.dataset.filter = 'glass-' + (++count);
    const copy = document.createElement('div');
    copy.className = 'glass-copy';
    const light = document.createElement('div');
    light.className = 'glass-light';
    s.prepend(copy);
    s.appendChild(light);
  }
  const all = () => strips.forEach(layout);
  all();
  let timer = 0;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(all, 120); });
  // Lay the strips out again once the fonts have settled (the sections below can move).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  window.glassLayout = all;
})();
