// The page's own instruments, and the size of the frame on the first screen.
//
// Frame interval: the median of the last 120 intervals between requestAnimationFrame calls, in ms,
// one decimal. "—" until 120 have been seen, and again after the tab was hidden (the intervals
// across a hidden tab are not frames). The small bitmap beside it shows the last 32 intervals, one
// column each, one pixel per 1/480 s, capped at 12 pixels.
//
// Frame size: S is the shorter side of the window; the white outside the glass is 0.0475 S and the
// glass is 0.030 S (the proportions of the BOOTH image the frame comes from). The reading of the
// glass is the height of the top strip as laid out, read back from the page.
(() => {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;

  // ---- frame size ----
  function frame() {
    const w = window.innerWidth, h = window.innerHeight;
    const S = Math.min(w, h);
    root.style.setProperty('--S', S + 'px');
    for (const n of document.querySelectorAll('[data-read="screen"]')) n.textContent = `${w} × ${h}`;
    const band = document.querySelector('.hero .b-top');
    const t = band ? band.getBoundingClientRect().height : 0;
    for (const n of document.querySelectorAll('[data-read="band"]')) n.textContent = t ? t.toFixed(1) : '—';
  }
  frame();
  window.addEventListener('resize', frame);

  // ---- frame interval ----
  const values = [...document.querySelectorAll('[data-read="interval"]')];
  const bits = [...document.querySelectorAll('canvas.bits')];
  if (!values.length && !bits.length) return;
  const KEEP = 120, COLS = 32, ROWS = 12;
  const gaps = [];
  let last = 0, shown = 0;
  for (const c of bits) { c.width = COLS; c.height = ROWS; }

  function median() {
    const s = gaps.slice().sort((a, b) => a - b);
    const k = s.length >> 1;
    return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
  }

  function draw() {
    for (const c of bits) {
      const g = c.getContext('2d');
      g.clearRect(0, 0, COLS, ROWS);
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--blue').trim() || '#3D3AE0';
      const recent = gaps.slice(-COLS);
      recent.forEach((dt, i) => {
        const hgt = Math.max(1, Math.min(ROWS, Math.round(dt / (1000 / 480))));
        g.fillRect(COLS - recent.length + i, ROWS - hgt, 1, hgt);
      });
    }
  }

  function tick(t) {
    if (last) {
      gaps.push(t - last);
      if (gaps.length > KEEP) gaps.shift();
    }
    last = t;
    if (t - shown >= 240) {          // the page's time grid: refresh the reading every 240 ms
      shown = t;
      const text = gaps.length >= KEEP ? median().toFixed(1) : '—';
      for (const v of values) v.textContent = text;
      if (!reduce.matches || !bits.drawn) { draw(); if (gaps.length >= COLS) bits.drawn = true; }
    }
    requestAnimationFrame(tick);
  }
  document.addEventListener('visibilitychange', () => {
    gaps.length = 0;
    last = 0;
    for (const v of values) v.textContent = '—';
  });
  requestAnimationFrame(tick);
})();
