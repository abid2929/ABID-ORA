/* Host for the Abidora 3D game worlds (12 Racing, 36 Starfall Run, 41 Demolition Lab, 82 Isle of Abidora, 99 Prism Lab).
   Mounts one game into the world stage, keeps it from stealing keys or the mouse wheel until the visitor has
   clicked into it, pauses it when it is off screen, opens a full-screen play mode on phones, translates the
   game's interface into the page language, and (for worlds that had an earlier 2D lab) keeps that lab as a tab. */
import type { Ctx } from '../kit';
import './games.css';
import { setHost } from './gkit.js';
import { I18N } from '../../scripts/i18n';

type Legacy = () => Promise<{ default: (c: Ctx) => void | (() => void) }>;
type Game = () => Promise<{ start: (canvas: HTMLCanvasElement, ui: HTMLElement) => unknown }>;
export interface GameSpec { game: Game; label: string; tabs?: { key: string; label: string; load: Legacy }[] }

const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

/* translation keys for game text: "g" + a hash of the English text with numbers replaced by {n},
   so "Level 3 solved" and "Level 12 solved" share one translation ("… {n} …"). tools/game-strings.mjs makes the same keys. */
const NUM = /\d+(?:[.,:]\d+)*(?![A-Za-z\d])|—/g;
export function gkey(text: string) {
  const s = text.replace(/\s+/g, ' ').trim().replace(NUM, '{n}');
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 'g' + (h >>> 0).toString(36);
}

function translator(ctx: Ctx, root: HTMLElement) {
  const cache = new Map<string, string>();
  const tx = (n: Text) => {
    const raw = n.nodeValue ?? ''; if (!/[A-Za-z]{2}/.test(raw)) return;
    const k = gkey(raw); let v = cache.get(k);
    if (v === undefined) { v = ctx.t(k, ''); cache.set(k, v); }
    if (!v) return;
    const nums = raw.match(NUM) ?? []; let i = 0;
    const out = v.replace(/\{n\}/g, () => nums[i++] ?? '');
    const lead = /^\s*/.exec(raw)![0], tail = /\s*$/.exec(raw)![0];
    n.nodeValue = lead + out + tail;
  };
  const walk = (el: Node) => {
    if (el.nodeType === 3) { tx(el as Text); return; }
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t: Node | null;
    while ((t = w.nextNode())) tx(t as Text);
  };
  walk(root);
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') tx(m.target as Text);
      else m.addedNodes.forEach(walk);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true });
}

export function mountGame(ctx: Ctx, spec: GameSpec) {
  const t = ctx.t;
  const gm = document.createElement('div'); gm.className = 'gm';
  if (ctx.rtl) gm.dataset.rtl = '';
  const canvas = document.createElement('canvas'); canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', spec.label); canvas.setAttribute('role', 'application');
  const ui = document.createElement('div'); ui.className = 'gm-ui';
  const load = document.createElement('div'); load.className = 'gm-load'; load.textContent = t('loading', 'Loading 3D world…');
  const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'gm-x'; exit.hidden = true;
  exit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  exit.append(t('exit', 'Exit'));
  gm.append(canvas, ui, load, exit);

  /* tabs: the new 3D game first, the earlier lab beside it */
  const panes: HTMLElement[] = [gm];
  if (spec.tabs?.length) {
    const bar = document.createElement('div'); bar.className = 'gm-tabs'; bar.setAttribute('role', 'tablist');
    const names = [spec.label, ...spec.tabs.map((x) => x.label)];
    const btns = names.map((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.textContent = n; b.setAttribute('aria-selected', String(i === 0)); bar.append(b); return b; });
    const holder = document.createElement('div'); holder.className = 'gm-wrap'; holder.append(bar, gm);
    const mounted: boolean[] = [];
    spec.tabs.forEach((tab, i) => {
      const p = document.createElement('div'); p.className = 'gm-pane'; p.hidden = true; p.setAttribute('role', 'tabpanel'); holder.append(p); panes.push(p);
      btns[i + 1].addEventListener('click', () => {
        if (!mounted[i]) {
          mounted[i] = true;
          tab.load().then((m) => { const d = m.default({ ...ctx, root: p }); if (typeof d === 'function') ctx.onDispose(d); })
            .catch((e) => { console.error(e); p.innerHTML = `<p class="gm-fail">${t('err', 'This part could not load. Please reload the page.')}</p>`; });
        }
      });
    });
    btns.forEach((b, i) => b.addEventListener('click', () => {
      btns.forEach((x, j) => x.setAttribute('aria-selected', String(i === j)));
      panes.forEach((p, j) => (p.hidden = i !== j));
      try { localStorage.setItem(`abidora.w${ctx.id}.tab`, String(i)); } catch { /* private mode */ }
    }));
    ctx.root.append(holder);
    let saved = 0; try { saved = +(localStorage.getItem(`abidora.w${ctx.id}.tab`) ?? 0) || 0; } catch { /* private mode */ }
    if (saved > 0 && saved < btns.length) queueMicrotask(() => btns[saved].click());
    (gm as HTMLElement & { _tabs?: HTMLButtonElement[] })._tabs = btns;
  } else ctx.root.append(gm);

  /* no WebGL: say so plainly, and open the 2D lab if there is one */
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) {
    load.remove(); ui.innerHTML = `<p class="gm-fail">${t('nogl', 'This 3D game needs WebGL, which this browser has turned off. Try another browser or device.')}</p>`;
    const tabs = (gm as HTMLElement & { _tabs?: HTMLButtonElement[] })._tabs; if (tabs) tabs[1].click();
    return;
  }

  /* on screen? clicked into? */
  let vis = false, engaged = false, full = false;
  new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: [0, .01] }).observe(gm);
  document.addEventListener('pointerdown', (e) => { engaged = gm.contains(e.target as Node); }, true);
  gm.addEventListener('focusin', () => { engaged = true; });
  gm.addEventListener('focusout', (e) => { if (!gm.contains(e.relatedTarget as Node)) engaged = false; });
  setHost({
    t: (k: string, en: string) => t(k, en),
    shown: () => (vis || full) && !document.hidden && !gm.hidden,
    gate: () => full || (engaged && vis && !gm.hidden),
    engaged: () => full || engaged,
    assetBase: `${I18N.root}assets/games/`,
  });
  if (ctx.lang !== 'en') translator(ctx, ui);

  /* phones: play full screen. The first tap on a main card button (Start, Explore, Launch…) opens it; Exit closes it. */
  let pushed = false;
  const setFull = (on: boolean) => {
    if (on === full) return; full = on;
    gm.classList.toggle('full', on); document.documentElement.classList.toggle('gm-lock', on); exit.hidden = !on;
    if (on) {
      try { history.pushState({ gm: 1 }, ''); pushed = true; } catch { pushed = false; }
      if (gm.requestFullscreen && document.fullscreenEnabled) gm.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    } else {
      if (document.fullscreenElement === gm) document.exitFullscreen().catch(() => {});
      if (pushed) { pushed = false; history.back(); }
      gm.scrollIntoView({ block: 'center' });
    }
    dispatchEvent(new Event('resize'));
  };
  addEventListener('popstate', () => { if (full) { pushed = false; setFull(false); } });
  document.addEventListener('fullscreenchange', () => { if (full && !document.fullscreenElement) setFull(false); });
  exit.addEventListener('click', () => setFull(false));
  if (TOUCH) ui.addEventListener('click', (e) => { if (!full && (e.target as Element).closest?.('.gk-cbtn.pri')) setFull(true); }, true);

  /* the loading veil lifts when the game is ready or as soon as it shows its first card (some games wait on that card) */
  let lifted = false;
  const lift = () => { if (lifted) return; lifted = true; cardWatch.disconnect(); load.classList.add('done'); setTimeout(() => load.remove(), 700); };
  const cardWatch = new MutationObserver(() => { if (ui.querySelector('.gk-card')) lift(); });
  cardWatch.observe(ui, { childList: true, subtree: true });
  spec.game().then(async (m) => {
    await m.start(canvas, ui); lift();
  }).catch((e) => {
    cardWatch.disconnect();
    console.error(e); load.remove();
    ui.innerHTML = `<p class="gm-fail">${t('err', 'This part could not load. Please reload the page.')}</p>`;
  });
}
