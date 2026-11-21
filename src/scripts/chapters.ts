/* Founder chapters (Wave A, I-6): the five approved sections become chapters of one journey. A small
   chapter bar shows where you are and jumps to any chapter; headings already pin while their section scrolls. */
import { I18N } from './i18n';
import { calm } from './studio-core';

export function chapters(sel = 'section.fs') {
  const secs = Array.from(document.querySelectorAll<HTMLElement>(sel)); if (secs.length < 2) return;
  const nav = document.createElement('nav'); nav.className = 'chap'; nav.setAttribute('aria-label', I18N.t('ch.label'));
  const now = document.createElement('p'); now.className = 'chap-now mono'; now.setAttribute('aria-hidden', 'true');
  const ol = document.createElement('ol');
  const links = secs.map((s, i) => {
    const h = s.querySelector('h2'); const title = (h?.lastChild?.textContent || h?.textContent || '').trim();
    const li = document.createElement('li'); const a = document.createElement('a'); a.href = '#' + s.id;
    a.innerHTML = '<span class="mono"></span><i></i>'; (a.firstChild as HTMLElement).textContent = I18N.n(i + 1, 2); a.setAttribute('aria-label', title);
    a.addEventListener('click', (e) => { e.preventDefault(); s.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth' }); h?.setAttribute('tabindex', '-1'); h?.focus({ preventScroll: true }); history.replaceState(null, '', '#' + s.id); });
    li.append(a); ol.append(li); return { a, title };
  });
  nav.append(now, ol); document.body.append(nav);
  let cur = -1;
  const upd = () => {
    const mid = innerHeight * .4; let k = -1;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top < mid) k = i; });
    const first = secs[0].getBoundingClientRect().top, last = secs[secs.length - 1].getBoundingClientRect().bottom;
    nav.classList.toggle('on', first < innerHeight * .7 && last > innerHeight * .3);
    secs.forEach((s, i) => { const r = s.getBoundingClientRect(); const p = Math.max(0, Math.min(1, (mid - r.top) / r.height)); links[i].a.style.setProperty('--p', String(p)); });
    if (k !== cur) { cur = k; links.forEach((l, i) => { if (i === k) l.a.setAttribute('aria-current', 'step'); else l.a.removeAttribute('aria-current'); }); now.textContent = k >= 0 ? `${I18N.n(k + 1, 2)} / ${I18N.n(secs.length, 2)} · ${links[k].title}` : ''; }
  };
  let tick = false; addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(() => { tick = false; upd(); }); } }, { passive: true }); addEventListener('resize', upd); upd();
}
