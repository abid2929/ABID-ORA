/* Homepage 0.9: the 30-world portal.
   Phones and tablets: a touch deck (native snap scrolling, each card leans in 3D by its distance from the centre).
   Computers with WebGL: a 3D ring drawn by portal30-scene.ts (loaded only when the section comes near).
   Both: category filter, "see all 30" grid, and a portal opening (the photo grows over the screen) before a world loads. */
import { calm } from './studio-core';

const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode) => Array.from(c.querySelectorAll(s)) as unknown as T[];

export interface P3Item { i: number; k: string; cat: string; href: string; name: string; desc: string; no: string; st: string; tint: string; img: string; soon: boolean }

/* the opening: a copy of the card's photo grows from its place on screen to the full screen, then the world loads */
export function flyTo(src: string, r: { left: number; top: number; width: number; height: number }, href: string, w: number) {
  try { sessionStorage.setItem('ab.vt', JSON.stringify({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight, w, t: Date.now() })); } catch { /* private mode */ }
  if (calm()) { location.href = href; return; }
  const f = document.createElement('div'); f.className = 'p3-fly';
  Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const im = new Image(); im.src = src; im.alt = ''; f.appendChild(im); document.body.appendChild(f);
  void f.offsetWidth;
  requestAnimationFrame(() => { Object.assign(f.style, { left: '0px', top: '0px', width: innerWidth + 'px', height: innerHeight + 'px', borderRadius: '0px' }); f.classList.add('go'); });
  setTimeout(() => { location.href = href; }, 720);
  /* coming back with the back button restores this page from memory: take the cover away */
  addEventListener('pageshow', () => f.remove(), { once: true });
}

export function initPortal30() {
  const sec = document.getElementById('worlds30'); if (!sec) return;
  const deck = sec.querySelector('.p3-deck') as HTMLElement;
  const cards = $$<HTMLLIElement>('.p3-card', deck);
  const bar = sec.querySelector('.p3-dots i') as HTMLElement;
  const info = sec.querySelector('.p3-info') as HTMLElement;
  const items: P3Item[] = cards.map((li, i) => {
    const a = li.querySelector('.p3-link') as HTMLElement, img = li.querySelector('img') as HTMLImageElement;
    return { i, k: li.dataset.k!, cat: li.dataset.c!, href: a.getAttribute('href') || '', name: li.querySelector('.p3-nm')!.textContent || '', desc: li.querySelector('.p3-ds')!.textContent || '',
      no: li.querySelector('.p3-no')!.textContent || '', st: [li.querySelector('.p3-st')!.firstChild?.textContent || '', li.querySelector('.p3-st em')?.textContent || ''].filter(Boolean).join(' · '), tint: li.style.getPropertyValue('--tint'), img: img.getAttribute('src') || '', soon: li.classList.contains('soon') };
  });
  const wid = (h: string) => { const m = /[?&]w=(\d+)/.exec(h); return m ? +m[1] : 0; };
  let shown = cards.slice(), act = 0, gl: null | { setItems(ix: number[]): void; go(i: number): void; next(d: number): void; dispose?(): void } = null;

  /* ---------- deck (touch, or computers without WebGL) ---------- */
  let raf = 0;
  const layout = () => {
    raf = 0; if (sec.dataset.mode === 'grid' || sec.classList.contains('gl')) return;
    const w0 = shown[0]?.offsetWidth || 1, cw = shown.length > 1 ? Math.abs(shown[1].offsetLeft - shown[0].offsetLeft) || w0 : w0, mid = deck.scrollLeft + deck.clientWidth / 2;
    let best = 0, bd = 1e9;
    shown.forEach((li, k) => {
      const o = (li.offsetLeft + w0 / 2 - mid) / cw, a = Math.abs(o), c = Math.min(a, 2.4);
      if (a < bd) { bd = a; best = k; }
      if (a > 3.5) { li.style.transform = ''; return; }
      li.style.transform = calm() ? '' : `rotateY(${(-Math.sign(o) * Math.min(a, 1.4) * 30).toFixed(2)}deg) translateZ(${(-c * 110).toFixed(1)}px) scale(${(1 - Math.min(a, 1) * .1).toFixed(3)})`;
      li.style.setProperty('--a', Math.max(0, 1 - a * 1.4).toFixed(3));
      li.style.setProperty('--sh', (o * 90).toFixed(1) + '%');
      li.style.setProperty('--px', (o * -5).toFixed(2) + '%');
      li.style.zIndex = String(100 - Math.round(a * 10));
    });
    setActive(best);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(layout); };
  deck.addEventListener('scroll', kick, { passive: true });
  addEventListener('resize', kick);

  function setActive(k: number) {
    act = k; const li = shown[k]; if (!li) return; const it = items[+li.dataset.i!];
    sec!.style.setProperty('--tint', it.tint);
    const n = shown.length; bar.style.setProperty('--pw', (100 / n).toFixed(2) + '%'); bar.style.setProperty('--pl', (k * 100 / n).toFixed(2) + '%');
    shown.forEach((c, j) => c.classList.toggle('on', j === k));
  }
  const scrollToCard = (k: number, smooth = true) => {
    k = Math.max(0, Math.min(shown.length - 1, k)); const li = shown[k]; if (!li) return;
    const left = li.offsetLeft + li.offsetWidth / 2 - deck.clientWidth / 2;
    deck.scrollTo({ left, behavior: smooth && !calm() ? 'smooth' : 'auto' });
  };

  /* tap: a side card comes to the centre; the centre card opens its world */
  deck.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('.p3-card'); if (!li) return;
    const k = shown.indexOf(li); const a = li.querySelector('a.p3-link') as HTMLAnchorElement | null;
    if (sec.dataset.mode !== 'grid' && k !== act && !sec.classList.contains('gl')) { e.preventDefault(); scrollToCard(k); return; }
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    const ph = li.querySelector('.p3-ph') as HTMLElement, img = li.querySelector('img') as HTMLImageElement;
    flyTo(img.currentSrc || img.src, ph.getBoundingClientRect(), a.href, wid(a.href));
  });
  /* mouse users without WebGL: drag the deck like a phone */
  {
    let x0 = 0, s0 = 0, down = false, moved = false;
    deck.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse' || sec.dataset.mode === 'grid') return; down = true; moved = false; x0 = e.clientX; s0 = deck.scrollLeft; deck.style.scrollSnapType = 'none'; });
    addEventListener('pointermove', (e) => { if (!down) return; const dx = e.clientX - x0; if (Math.abs(dx) > 4) moved = true; deck.scrollLeft = s0 - dx; });
    addEventListener('pointerup', () => { if (!down) return; down = false; deck.style.scrollSnapType = ''; layout(); scrollToCard(act); });
    deck.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopImmediatePropagation(); moved = false; } }, true);
    deck.addEventListener('dragstart', (e) => e.preventDefault());
  }
  const step = (d: number) => { if (gl) gl.next(d); else scrollToCard(act + d); };
  sec.querySelector('.p3-prev')!.addEventListener('click', () => step(document.dir === 'rtl' ? 1 : -1));
  sec.querySelector('.p3-next')!.addEventListener('click', () => step(document.dir === 'rtl' ? -1 : 1));
  deck.addEventListener('keydown', (e) => {
    if (sec.dataset.mode === 'grid') return;
    const f = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (!f) return;
    e.preventDefault(); const k = Math.max(0, Math.min(shown.length - 1, act + f * (document.dir === 'rtl' ? -1 : 1)));
    (shown[k].querySelector('.p3-link') as HTMLElement).focus({ preventScroll: true });
  });
  /* keyboard focus moves the deck (and the 3D ring) to that card */
  deck.addEventListener('focusin', (e) => {
    const li = (e.target as HTMLElement).closest<HTMLLIElement>('.p3-card'); if (!li || sec.dataset.mode === 'grid') return;
    const k = shown.indexOf(li); if (gl) gl.go(k); else scrollToCard(k);
  });

  /* ---------- categories ---------- */
  const cbtn = $$<HTMLButtonElement>('.p3-cat', sec);
  cbtn.forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.c!; cbtn.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cards.forEach((li) => { li.hidden = c !== 'all' && li.dataset.c !== c; li.style.transform = ''; });
    shown = cards.filter((li) => !li.hidden);
    if (gl) gl.setItems(shown.map((li) => +li.dataset.i!));
    deck.scrollLeft = 0; act = 0; setActive(0); kick();
    b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: calm() ? 'auto' : 'smooth' });
  }));

  /* ---------- grid / 3D view ---------- */
  const vb = sec.querySelector('.p3-view') as HTMLButtonElement;
  vb.addEventListener('click', () => {
    const g = sec.dataset.mode !== 'grid'; sec.dataset.mode = g ? 'grid' : 'deck'; vb.setAttribute('aria-pressed', String(g));
    cards.forEach((li) => { li.style.transform = ''; });
    if (!g) { requestAnimationFrame(() => { layout(); scrollToCard(act, false); }); }
    const top = sec.getBoundingClientRect().top + scrollY - 20; if (g) scrollTo({ top, behavior: calm() ? 'auto' : 'smooth' });
  });

  /* ---------- 3D ring on computers ---------- */
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const wantGL = fine && innerWidth > 820 && !calm() && document.documentElement.dataset.q !== 'low' && (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (wantGL) {
    const io = new IntersectionObserver((en) => {
      if (!en.some((x) => x.isIntersecting)) return; io.disconnect();
      import('./portal30-scene').then((m) => {
        const canvas = sec.querySelector('.p3-gl') as HTMLCanvasElement;
        gl = m.mountRing(canvas, items, {
          active(i: number) {
            const it = items[i]; act = shown.findIndex((li) => +li.dataset.i! === i);
            sec.style.setProperty('--tint', it.tint);
            (info.querySelector('.p3-ino') as HTMLElement).textContent = it.no;
            (info.querySelector('.p3-inm') as HTMLElement).textContent = it.name;
            (info.querySelector('.p3-ids') as HTMLElement).textContent = it.desc;
            (info.querySelector('.p3-ist') as HTMLElement).textContent = it.st;
            const go = info.querySelector('.p3-go') as HTMLAnchorElement;
            if (it.href) { go.href = it.href; go.removeAttribute('aria-disabled'); go.tabIndex = -1; } else { go.setAttribute('aria-disabled', 'true'); go.removeAttribute('href'); }
            info.classList.remove('on'); void info.offsetWidth; info.classList.add('on');
            const n = shown.length; bar.style.setProperty('--pw', (100 / n).toFixed(2) + '%'); bar.style.setProperty('--pl', (Math.max(0, act) * 100 / n).toFixed(2) + '%');
          },
          enter(i: number, r: DOMRect) { const it = items[i]; if (!it.href) return; flyTo(it.img, r, new URL(it.href, location.href).href, wid(it.href)); },
        });
        if (gl) { sec.classList.add('gl'); cards.forEach((li) => { li.style.transform = ''; });
          /* 0.9.14: a narrow window (or a computer browser made phone-size) goes back to the card deck, so the ring's text never sits on the heading */
          const fit = () => { const wide = innerWidth > 820; if (wide === sec.classList.contains('gl')) return; sec.classList.toggle('gl', wide); if (wide) cards.forEach((li) => { li.style.transform = ''; }); else layout(); };
          addEventListener('resize', fit); fit(); }
      }).catch(() => { /* the deck stays */ });
    }, { rootMargin: '600px 0px' });
    io.observe(sec);
    (info.querySelector('.p3-go') as HTMLAnchorElement).addEventListener('click', (e) => {
      const a = e.currentTarget as HTMLAnchorElement; if (!a.href || a.getAttribute('aria-disabled')) { e.preventDefault(); return; }
      e.preventDefault(); const li = shown[act]; const it = items[+li.dataset.i!];
      const r = sec.querySelector('.p3-stage')!.getBoundingClientRect(); const w = Math.min(r.width * .28, 340), h = w * 4 / 3;
      flyTo(it.img, new DOMRect(r.left + r.width / 2 - w / 2, r.top + r.height / 2 - h / 2, w, h), a.href, wid(a.href));
    });
  }
  /* phones: lean the centre card with the phone's tilt (Android; iPhone asks permission, so it simply stays still) */
  if (!fine && !calm()) {
    let tx = 0;
    addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return; const v = Math.max(-1, Math.min(1, e.gamma / 30));
      if (Math.abs(v - tx) < .02) return; tx = v;
      const li = shown[act]; if (li) { const img = li.querySelector('img') as HTMLImageElement; img.style.translate = `${(v * -2.4).toFixed(2)}% 0`; }
    }, { passive: true });
  }
  requestAnimationFrame(() => { layout(); });
}
