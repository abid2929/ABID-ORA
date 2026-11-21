/* Homepage Universe controller: reads the world list the server rendered (so the map and the list can never
   disagree), loads Three.js only when the section comes near, and keeps an accessible path at all times:
   every category label is a real button, the full list is one tap away, and Esc always goes back. */
import { I18N } from './i18n';
import { measureTier, stillMotion } from './tier';
import type { Universe, UStar } from './universe-scene';

const T = I18N.t;
export function visitedSet(): Set<number> { try { return new Set((JSON.parse(localStorage.getItem('ab.visited') || '[]') as number[]).filter(Number.isFinite)); } catch { return new Set(); } }

export function initUniverse() {
  const sec = document.getElementById('universe'); if (!sec) return;
  const stage = sec.querySelector<HTMLElement>('.uv-stage')!, cv = sec.querySelector<HTMLCanvasElement>('canvas')!, labels = sec.querySelector<HTMLElement>('.uv-labels')!;
  const panel = sec.querySelector<HTMLElement>('.uv-panel')!, list = sec.querySelector<HTMLElement>('.uv-list')!, btn = sec.querySelector<HTMLButtonElement>('.uv-listbtn')!, hint = sec.querySelector<HTMLElement>('.uv-hint')!;
  const seen = visitedSet();
  type Cat = { id: string; color: string; name: string; worlds: { id: number; live: boolean; name: string; href: string; visited: boolean }[] };
  const cats: Cat[] = Array.from(list.querySelectorAll<HTMLElement>('section[data-c]')).map((s) => ({
    id: s.dataset.c!, color: s.dataset.col || '#e8b46a', name: (s.querySelector('h3')?.firstChild?.textContent || '').trim(),
    worlds: Array.from(s.querySelectorAll<HTMLLIElement>('li[data-id]')).map((li) => { const id = +li.dataset.id!; const a = li.querySelector('a'); return { id, live: li.dataset.s === 'live', name: (li.textContent || '').trim(), href: a?.getAttribute('href') || '', visited: seen.has(id) }; }),
  }));
  /* mark visited worlds in the list view too */
  list.querySelectorAll<HTMLLIElement>('li[data-id]').forEach((li) => { if (seen.has(+li.dataset.id!)) li.classList.add('seen'); });
  const stars: UStar[] = []; const starInfo: { cat: number; w: Cat['worlds'][number] }[] = [];
  cats.forEach((c, ci) => c.worlds.forEach((w) => { stars.push({ id: w.id, cat: ci, live: w.live, visited: w.visited }); starInfo.push({ cat: ci, w }); }));

  /* list view toggle (always works, even before 3D loads) */
  let listOn = false;
  const setList = (on: boolean) => { listOn = on; list.hidden = !on; stage.hidden = on; btn.setAttribute('aria-expanded', String(on)); btn.textContent = on ? T('uv.mapshow') : T('uv.listshow'); if (!on) uni?.resize(); };
  btn.addEventListener('click', () => setList(!listOn));

  /* category labels: real buttons, positioned over the 3D systems every frame */
  const lbs = cats.map((c, i) => {
    const live = c.worlds.filter((w) => w.live).length;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'uv-lb'; b.style.setProperty('--cc', c.color);
    b.innerHTML = `<span></span><small class="mono"></small>`; (b.firstChild as HTMLElement).textContent = c.name; (b.lastChild as HTMLElement).textContent = T('uv.count').replace('{l}', I18N.ng(live)).replace('{t}', I18N.ng(c.worlds.length));
    b.addEventListener('click', () => open(i)); labels.append(b); return b;
  });

  let uni: Universe | null = null;
  function card(i: number | null, star: number | null) {
    if (i === null) { panel.hidden = true; panel.replaceChildren(); stage.classList.remove('focus'); return; }
    const c = cats[i]; stage.classList.add('focus'); panel.hidden = false; panel.style.setProperty('--cc', c.color);
    const h = (tag: string, cls = '', txt = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
    const back = h('button', 'uv-back mono', (I18N.rtl ? '→ ' : '← ') + T('uv.back')) as HTMLButtonElement; back.type = 'button'; back.addEventListener('click', () => open(null));
    const head = h('div', 'uv-ph'); head.append(h('span', 'mono uv-cl', c.id), h('h3', '', c.name));
    const cnt = h('p', 'mono uv-ct', T('uv.count').replace('{l}', I18N.ng(c.worlds.filter((w) => w.live).length)).replace('{t}', I18N.ng(c.worlds.length)));
    panel.replaceChildren(back, head, cnt);
    if (star !== null) {
      const w = starInfo[star].w, box = h('div', 'uv-world');
      box.append(h('span', 'mono', I18N.n(w.id, 3) + ' · ' + (w.live ? T('uv.live') : T('uv.planned')) + (w.visited ? ' · ' + T('uv.visited') : '')), h('strong', '', w.name));
      if (w.live) { const a = h('a', 'uv-enter mono', T('uv.enter') + (I18N.rtl ? ' ←' : ' →')) as HTMLAnchorElement; a.href = w.href; box.append(a); }
      panel.append(box);
    }
    const ul = h('ul', 'uv-ws');
    c.worlds.forEach((w) => { const li = h('li', w.live ? 'live' : 'planned'); if (w.visited) li.classList.add('seen'); const n = h('span', 'mono', I18N.n(w.id, 3));
      if (w.live) { const a = h('a', '', w.name) as HTMLAnchorElement; a.href = w.href; a.addEventListener('pointerenter', () => uni?.highlight(w.id)); a.addEventListener('pointerleave', () => uni?.highlight(null)); a.addEventListener('focus', () => uni?.highlight(w.id)); li.append(n, a); }
      else li.append(n, h('span', '', w.name), h('em', 'mono', T('uv.planned')));
      ul.append(li); });
    panel.append(ul);
  }
  function open(i: number | null, star: number | null = null) {
    uni?.focus(i); card(i, star);
    /* phones: the card sits under the sky, so bring it fully into view */
    if (i !== null && innerWidth < 760) setTimeout(() => { const r = panel.getBoundingClientRect(); if (r.bottom > innerHeight - 8) scrollBy({ top: r.bottom - innerHeight + 24, behavior: stillMotion() ? 'auto' : 'smooth' }); }, 80);
    lbs.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
    if (i !== null && star === null) (panel.querySelector('.uv-ws a') as HTMLElement | null)?.focus({ preventScroll: true });
    if (i === null) lbs[0]?.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && uni && uni.focused() !== null && !listOn) { e.preventDefault(); open(null); } });

  /* pointer: drag to turn the universe, tap a system or a star */
  let down: { x: number; y: number; lx: number; moved: boolean } | null = null;
  const loc = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  cv.addEventListener('pointerdown', (e) => { const p = loc(e); down = { x: p.x, y: p.y, lx: p.x, moved: false }; });
  cv.addEventListener('pointermove', (e) => {
    const p = loc(e);
    if (down) { const dx = p.x - down.lx; if (Math.abs(p.x - down.x) > 6) { down.moved = true; hint.classList.add('gone'); } if (down.moved) uni?.drag(dx); down.lx = p.x; return; }
    if (!uni || e.pointerType !== 'mouse') return;
    const s = uni.pickStar(p.x, p.y), sys = s === null ? uni.pickSystem(p.x, p.y) : null;
    cv.style.cursor = s !== null || sys !== null ? 'pointer' : 'grab'; uni.highlight(s !== null ? stars[s].id : null);
  });
  const up = (e: PointerEvent) => {
    if (!down || !uni) { down = null; return; } const moved = down.moved; down = null; if (moved) return;
    const p = loc(e), s = uni.pickStar(p.x, p.y);
    if (s !== null) { open(stars[s].cat, s); return; }
    const sys = uni.pickSystem(p.x, p.y); if (sys !== null) open(sys);
    else if (uni.focused() !== null) open(null);
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { down = null; });
  cv.addEventListener('pointerleave', () => { if (!down) uni?.highlight(null); });

  /* load the 3D only when the section is near; fall back to the list if WebGL is missing */
  const ok = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (!ok) { stage.classList.add('nogl'); hint.textContent = T('uv.nogl'); setList(true); return; }
  let visible = false;
  const vis = new IntersectionObserver((es) => { visible = es[0].isIntersecting; uni?.setActive(visible && document.visibilityState === 'visible'); }, { threshold: 0.05 });
  document.addEventListener('visibilitychange', () => uni?.setActive(visible && document.visibilityState === 'visible'));
  const near = new IntersectionObserver(async (es, ob) => {
    if (!es[0].isIntersecting) return; ob.disconnect();
    try {
      const [{ createUniverse }, tier] = await Promise.all([import('./universe-scene'), measureTier()]);
      const place = (proj: { sys: { x: number; y: number; z: number; vis: boolean }[] }) => {
        const f = uni?.focused() ?? null;
        const W = cv.clientWidth;
        proj.sys.forEach((p, i) => { const b = lbs[i]; const show = p.vis && (f === null || f === i); const hw = b.offsetWidth / 2 + 4; const x = Math.max(hw, Math.min(W - hw, p.x)); b.style.transform = `translate(${x.toFixed(1)}px, ${(p.y + 26).toFixed(1)}px) translate(-50%, 0)`; b.style.opacity = show ? String(Math.max(.35, Math.min(1, 1.6 - p.z))) : '0'; b.tabIndex = show || f === null ? 0 : -1; b.style.zIndex = String(Math.round((1 - p.z) * 1000)); });
      };
      uni = createUniverse({ canvas: cv, cats: cats.map((c) => ({ id: c.id, color: c.color })), stars, tier, still: stillMotion(), rtl: I18N.rtl, onFrame: place });
      stage.classList.add('on'); vis.observe(stage);
      new ResizeObserver(() => uni?.resize()).observe(stage);
    } catch (err) { console.warn('universe', err); stage.classList.add('nogl'); hint.textContent = T('uv.nogl'); setList(true); }
  }, { rootMargin: '0px 0px 120px 0px' });
  /* Three.js is the heaviest file on the page, so it is only fetched after the page has finished loading and the
     browser is idle, and only once the visitor comes near the section */
  const start = () => near.observe(stage);
  const idle = () => ('requestIdleCallback' in window ? (window as Window & { requestIdleCallback: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback(start, { timeout: 2500 }) : setTimeout(start, 600));
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle, { once: true });
}
