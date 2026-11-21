/* Abidora 2040 layer: adds the light field, the scroll hairline and the heading light sweep. Styles in styles/future.css.
   Off switch: localStorage 'ab.f40' = '0' (or ?f40=0 in the address) shows the site exactly as before. */
import { guessTier } from './tier';
const root = document.documentElement;
let off = false; try { off = localStorage.getItem('ab.f40') === '0' || /[?&]f40=0\b/.test(location.search); } catch { /* private mode */ }
if (!off && !document.getElementById('f40f')) {
  root.classList.add('f40'); if (guessTier() === 'low') root.classList.add('f40-low');
  const f = document.createElement('div'); f.id = 'f40f'; f.setAttribute('aria-hidden', 'true'); f.innerHTML = '<i></i><i></i><b></b>';
  const p = document.createElement('div'); p.id = 'f40p'; p.setAttribute('aria-hidden', 'true');
  document.body.prepend(f, p);
  /* light sweep: only big display headings that hold plain text (an icon inside would turn invisible with text clipping) */
  const hs = [...document.querySelectorAll<HTMLElement>('h1, h2')].filter((h) => !h.querySelector('svg,img,canvas') && !h.closest('.bar,.mnu,[aria-hidden=true]') && parseFloat(getComputedStyle(h).fontSize) >= 34 && (h.textContent || '').trim().length > 1);
  if (hs.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('f40in'); io.unobserve(e.target); } }), { threshold: .4 });
    hs.forEach((h) => { h.classList.add('f40h'); io.observe(h); });
  }
}
