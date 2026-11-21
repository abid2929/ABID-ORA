/* Founder portrait motion: scroll parallax of the frame, plus a 3D tilt and light sheen that follow the mouse.
   The whole photo always stays visible (nothing is zoomed or cropped). Off in calm motion or reduced motion. */
import { calm, FINE } from './studio-core';
const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
export function parallax(amount = 0.08) {
  const frames = Array.from(document.querySelectorAll<HTMLElement>('.hf-pic,.fh-pic'));
  if (!frames.length) return;
  let on = false, queued = false;
  const vis = new Set<Element>();
  const io = new IntersectionObserver((es) => { es.forEach((e) => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))); on = vis.size > 0; if (on) req(); });
  frames.forEach((f) => io.observe(f));
  function frame() {
    queued = false;
    frames.forEach((fr) => {
      if (R || calm()) { fr.style.setProperty('--py', '0px'); return; }
      const sec = (fr.parentElement || fr).getBoundingClientRect();
      const c = (sec.top + sec.height / 2 - innerHeight / 2) / innerHeight;
      fr.style.setProperty('--py', (c * -amount * 600).toFixed(1) + 'px');
    });
  }
  function req() { if (!queued && on) { queued = true; requestAnimationFrame(frame); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', req);
  if (!FINE) return;
  frames.forEach((fr) => {
    fr.addEventListener('pointermove', (e) => {
      if (R || calm()) return;
      const b = fr.getBoundingClientRect(), x = (e.clientX - b.left) / b.width, y = (e.clientY - b.top) / b.height;
      fr.style.setProperty('--ry', ((x - .5) * 10).toFixed(2) + 'deg');
      fr.style.setProperty('--rx', ((.5 - y) * 8).toFixed(2) + 'deg');
      fr.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
      fr.style.setProperty('--my', (y * 100).toFixed(1) + '%');
      fr.classList.add('tilt');
    });
    fr.addEventListener('pointerleave', () => { fr.style.setProperty('--rx', '0deg'); fr.style.setProperty('--ry', '0deg'); fr.classList.remove('tilt'); });
  });
}
