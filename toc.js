// The manual's contents: a plain list of the sections. Open beside the text on wide screens, folded
// above it on narrow ones. The section being read is marked; scrolling is never taken over.
(() => {
  'use strict';
  const fold = document.querySelector('.toc-fold');
  const wide = matchMedia('(min-width: 861px)');
  const sync = () => { if (wide.matches) fold.open = true; };
  sync();
  wide.addEventListener('change', sync);

  const links = [...document.querySelectorAll('.toc a')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));
  let current = null;
  function mark() {
    let k = 0;
    for (let i = 0; i < heads.length; i++) if (heads[i] && heads[i].getBoundingClientRect().top < 160) k = i;
    if (current === k) return;
    current = k;
    links.forEach((a, i) => (i === k ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
  }
  window.addEventListener('scroll', mark, { passive: true });
  window.addEventListener('resize', mark);
  links.forEach((a) => a.addEventListener('click', () => { if (!wide.matches) fold.open = false; }));
  mark();
})();
