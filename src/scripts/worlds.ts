/* Worlds atlas: live search (any script, accent-insensitive), category + status filters, URL hash sync. */
import { I18N } from './i18n';
import './common';
import { cursor } from './studio-core';
import { gsap } from 'gsap';

const cur = cursor();
/* the full list of all worlds sits behind one button; the 30 main worlds come first (owner, 21 Nov: "make it simpler") */
const allw = document.getElementById('allw')!, more = document.getElementById('a30more') as HTMLButtonElement;
const showAll = (on: boolean) => { allw.hidden = !on; more.setAttribute('aria-expanded', String(on)); more.textContent = I18N.t(on ? 'a30.hide' : 'a30.all'); };
more.addEventListener('click', () => { const on = allw.hidden === true; showAll(on); if (on) allw.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
if (/^#cat-/.test(location.hash)) showAll(true);
const q = document.getElementById('q') as HTMLInputElement;
const cats = document.getElementById('cats')!, sts = document.getElementById('sts')!;
const wc = document.getElementById('wc')!, none = document.getElementById('none')!;
const groups = Array.from(document.querySelectorAll<HTMLElement>('.cat'));
const items = Array.from(document.querySelectorAll<HTMLLIElement>('.xs li'));
const norm = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(I18N.loc);
const idxText = items.map((li) => norm(li.textContent ?? '') + ' ' + (li.dataset.en ?? ''));
let cat = '', st = '';

function press(group: HTMLElement, attr: string, v: string) { group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset[attr] ?? '') === v))); }
function run() {
  const term = norm(q.value.trim()); let shown = 0;
  items.forEach((li, i) => {
    const ok = (!cat || li.dataset.c === cat) && (!st || li.dataset.s === st) && (!term || idxText[i].includes(term));
    li.hidden = !ok; if (ok) shown++;
  });
  groups.forEach((g) => { g.hidden = !g.querySelector('li:not([hidden])'); });
  none.hidden = shown > 0;
  wc.textContent = I18N.t('wl.shown').replace('{n}', I18N.ng(shown)).replace('{t}', I18N.ng(items.length));
}
cats.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
  cat = b.dataset.c ?? ''; press(cats, 'c', cat); run();
  history.replaceState(null, '', cat ? `#cat-${cat}` : location.pathname + location.search);
  if (cat) document.getElementById(`cat-${cat}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
sts.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return; st = b.dataset.s ?? ''; press(sts, 's', st); run(); });
q.addEventListener('input', run);
addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== q) { e.preventDefault(); q.focus(); } });
const h = /^#cat-([A-Z])$/.exec(location.hash); if (h) { cat = h[1]; press(cats, 'c', cat); }
run();

document.querySelectorAll<HTMLAnchorElement>('.xs a').forEach((a) => { a.addEventListener('pointerenter', () => cur.label(I18N.t('live'))); a.addEventListener('pointerleave', () => cur.label('')); });
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  gsap.from('.wlh > *', { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .08 });
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return; io.unobserve(e.target); gsap.from(e.target.querySelectorAll('.L, h2, li'), { y: 24, opacity: 0, duration: .8, ease: 'power3.out', stagger: .015 }); }), { rootMargin: '0px 0px -10% 0px' });
  groups.forEach((g) => io.observe(g));
}
