/* Abidora nature & space render kit (worlds 17-24: Ocean, Wildlife, Forest, Mountain, Galaxy,
   Solar System, Astronomy, Science Discovery). One WebGL stage per world: sharp on phones (device
   pixel ratio up to 2, MSAA), ACES tone mapping, orbit/touch camera with cinematic fly-tos, a
   desktop side panel that becomes a draggable bottom sheet on phones, and small control helpers.
   Every class is prefixed ns- so nothing clashes with the global site CSS. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Ctx } from './kit';
import { I18N } from '../scripts/i18n';
export { THREE };

const CSS = `
.ns{--acc:#7fd1ff;--ink:#05070c;--fg:#eef2f7;--mut:rgba(238,242,247,.62);--pan:rgba(8,11,18,.62);--line:rgba(255,255,255,.12);
position:relative;width:100%;height:min(88svh,980px);min-height:540px;overflow:hidden;background:var(--ink);color:var(--fg);
font-family:'Inter Tight',system-ui,sans-serif;border-radius:18px;isolation:isolate;-webkit-tap-highlight-color:transparent}
.ns.ns-full{height:100svh;border-radius:0;min-height:0}
.ns canvas.ns-gl{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.ns:before{content:'';position:absolute;left:0;right:0;top:0;height:220px;z-index:1;pointer-events:none;background:linear-gradient(rgba(0,0,0,.42),rgba(0,0,0,0))}
.ns-top{position:absolute;left:22px;top:20px;right:22px;z-index:3;pointer-events:none;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.ns-tt{max-width:min(540px,70%)}
.ns-num{font:500 11px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.22em;color:var(--acc);text-transform:uppercase;display:flex;gap:10px;align-items:center}
.ns-num:before{content:'';width:26px;height:1px;background:var(--acc)}
.ns-h{font-family:var(--hf,'Instrument Serif'),Georgia,serif;font-weight:400;font-size:clamp(34px,5.4vw,64px);line-height:.95;margin:.22em 0 .12em;letter-spacing:-.01em;text-shadow:0 2px 30px rgba(0,0,0,.35)}
.ns-sub{font-size:14px;line-height:1.45;color:rgba(238,242,247,.82);max-width:420px;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.ns-tools{display:flex;gap:8px;pointer-events:auto}
.ns-ib{width:40px;height:40px;border-radius:50%;border:1px solid var(--line);background:var(--pan);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--fg);display:grid;place-items:center;cursor:pointer;font-size:16px}
.ns-ib:hover{border-color:var(--acc)}
.ns-ib svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ns-dock{position:absolute;left:22px;bottom:22px;z-index:3;display:flex;gap:8px;flex-wrap:wrap;max-width:calc(100% - 420px)}
.ns-chip{appearance:none;border:1px solid var(--line);background:var(--pan);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:var(--fg);
font:500 13px/1 'Inter Tight',system-ui,sans-serif;padding:11px 16px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background .25s,border-color .25s,color .25s}
.ns-chip[aria-pressed=true]{background:var(--acc);border-color:var(--acc);color:#05070c}
.ns-chip:hover{border-color:var(--acc)}
.ns-sheet{position:absolute;right:18px;top:18px;bottom:18px;width:340px;z-index:4;background:var(--pan);backdrop-filter:blur(22px) saturate(1.3);-webkit-backdrop-filter:blur(22px) saturate(1.3);
border:1px solid var(--line);border-radius:16px;display:flex;flex-direction:column;overflow:hidden;transition:transform .45s cubic-bezier(.2,.8,.2,1)}
.ns-grab{display:none}
.ns-body>*{flex:none}
.ns-body{overflow:auto;padding:18px 18px 22px;display:flex;flex-direction:column;gap:14px;overscroll-behavior:contain;scrollbar-width:thin}
.ns-sec{font:500 10.5px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);margin-top:6px}
.ns-p{font-size:13.5px;line-height:1.5;color:var(--mut);margin:0}
.ns-r{display:flex;flex-direction:column;gap:7px;font-size:13px}
.ns-r>span{display:flex;justify-content:space-between;gap:10px;color:var(--mut)}
.ns-r output{color:var(--fg);font-variant-numeric:tabular-nums}
.ns input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:28px;background:transparent;margin:0;cursor:pointer}
.ns input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:3px;background:linear-gradient(90deg,var(--acc) var(--p,50%),rgba(255,255,255,.18) var(--p,50%))}
.ns input[type=range]::-moz-range-track{height:3px;border-radius:3px;background:rgba(255,255,255,.18)}
.ns input[type=range]::-moz-range-progress{height:3px;background:var(--acc)}
.ns input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;margin-top:-8.5px;box-shadow:0 0 0 4px color-mix(in srgb,var(--acc) 35%,transparent)}
.ns input[type=range]::-moz-range-thumb{width:18px;height:18px;border:0;border-radius:50%;background:#fff}
.ns-seg{display:flex;gap:4px;padding:3px;border:1px solid var(--line);border-radius:12px;background:rgba(0,0,0,.18);flex-wrap:wrap}
.ns-seg button{flex:1;appearance:none;border:0;background:transparent;color:var(--mut);font:500 12.5px/1 'Inter Tight',system-ui,sans-serif;padding:9px 8px;border-radius:9px;cursor:pointer;min-width:0}
.ns-seg button[aria-pressed=true]{background:rgba(255,255,255,.14);color:var(--fg)}
.ns-btns{display:flex;gap:8px;flex-wrap:wrap}
.ns-btn{appearance:none;border:1px solid var(--line);background:rgba(255,255,255,.06);color:var(--fg);font:500 13px/1 'Inter Tight',system-ui,sans-serif;padding:11px 14px;border-radius:10px;cursor:pointer;flex:1;white-space:nowrap}
.ns-btn:hover{border-color:var(--acc)}
.ns-btn.pri{background:var(--acc);border-color:var(--acc);color:#05070c}
.ns-stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.ns-stat{background:color-mix(in srgb,var(--ink) 70%,transparent);padding:10px 12px;min-width:0}
.ns-stat b{display:block;font:500 9.5px/1.2 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.ns-stat span{display:block;font:400 17px/1.15 'Inter Tight',system-ui,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ns-card{position:absolute;z-index:5;left:50%;bottom:86px;transform:translate(-50%,16px);opacity:0;pointer-events:none;max-width:min(420px,calc(100% - 40px));
background:var(--pan);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--line);border-radius:14px;padding:14px 16px;transition:.35s cubic-bezier(.2,.8,.2,1)}
.ns-card.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.ns-card h4{margin:0 0 4px;font-family:var(--hf,'Instrument Serif'),Georgia,serif;font-weight:400;font-size:24px}
.ns-card p{margin:0;font-size:13px;line-height:1.5;color:var(--mut)}
.ns-card .x{position:absolute;right:8px;top:8px;border:0;background:none;color:var(--mut);font-size:18px;cursor:pointer;width:32px;height:32px}
.ns-hint{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2;pointer-events:none;font:500 12px/1 'JetBrains Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--mut);opacity:0;transition:opacity .6s}
.ns-hint.on{opacity:1}
.ns-load{position:absolute;inset:0;z-index:6;display:grid;place-items:center;background:var(--ink);transition:opacity .8s;font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.3em;text-transform:uppercase;color:var(--mut)}
.ns-load.off{opacity:0;pointer-events:none}
.ns-load i{display:block;width:120px;height:1px;margin:14px auto 0;background:linear-gradient(90deg,transparent,var(--acc),transparent);animation:nsl 1.4s infinite}
@keyframes nsl{0%{transform:scaleX(.1)}50%{transform:scaleX(1)}100%{transform:scaleX(.1)}}
.ns-more>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;margin:10px 0;border-radius:999px;border:1px solid var(--line);font:500 13px var(--sans,sans-serif);color:var(--fg,#ece6dc)}.ns-more>summary::-webkit-details-marker{display:none}.ns-more>summary::after{content:'+';font-size:16px}.ns-more[open]>summary::after{content:'−'}
.ns-lab{position:absolute;inset:0;z-index:8;background:var(--ink);overflow:auto;display:none}
.ns-lab.on{display:block}
.ns-lab-bar{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--ink);border-bottom:1px solid var(--line)}
.ns-tag{position:absolute;z-index:2;pointer-events:none;font:500 11px/1.2 'Inter Tight',system-ui,sans-serif;color:#fff;white-space:nowrap;transform:translate(-50%,-140%);text-shadow:0 1px 6px rgba(0,0,0,.8);padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12)}
@media (max-width:899px){
 .ns{height:100svh;min-height:0;border-radius:0}
 .ns-top{left:16px;top:14px;right:14px}
 .ns-h{font-size:clamp(30px,9vw,44px)}
 .ns-sub{font-size:12.5px;max-width:260px}
 .ns-tt{max-width:calc(100% - 100px)}
 .ns-ib{width:36px;height:36px}
 .ns-tools{gap:6px}
 .ns-num{font-size:10px;letter-spacing:.16em}
 .ns-dock{left:0;right:0;bottom:calc(var(--peek,128px) + 10px);max-width:none;flex-wrap:nowrap;overflow-x:auto;padding:0 16px;scrollbar-width:none;transition:bottom .45s cubic-bezier(.2,.8,.2,1)}
 .ns-dock::-webkit-scrollbar{display:none}
 .ns-sheet{left:0;right:0;top:auto;bottom:0;width:auto;height:min(68svh,620px);border-radius:20px 20px 0 0;border-bottom:0;transform:translateY(calc(100% - var(--peek,128px)))}
 .ns-sheet.open{transform:translateY(0)}
 .ns.sheet-open .ns-dock{opacity:0;pointer-events:none}
 .ns-grab{display:flex;justify-content:center;align-items:center;flex-direction:column;gap:6px;height:34px;flex:none;cursor:grab;touch-action:none;border:0;background:none;color:var(--mut);width:100%;font:500 10px/1 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase}
 .ns-grab:before{content:'';width:42px;height:4px;border-radius:4px;background:rgba(255,255,255,.35)}
 .ns-body{padding:4px 16px calc(22px + env(safe-area-inset-bottom))}
 .ns-card{bottom:calc(var(--peek,128px) + 64px)}
 .ns-chip{padding:12px 16px;font-size:13.5px}
 .ns input[type=range]{height:34px}
}
@media (prefers-reduced-motion:reduce){.ns-sheet,.ns-card,.ns-dock{transition:none}}
`;

function css() {
  if (document.getElementById('ns3d-css')) return;
  const s = document.createElement('style'); s.id = 'ns3d-css'; s.textContent = CSS; document.head.append(s);
  if (!document.querySelector('link[data-ns-fonts]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.dataset.nsFonts = '1';
    l.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@400;500;600&family=JetBrains+Mono:wght@500&family=Fraunces:opsz,wght@9..144,300;9..144,400&family=Cormorant+Garamond:wght@400;500&family=Space+Grotesk:wght@400;500&display=swap';
    document.head.append(l);
  }
}

type Kid = Node | string | null | undefined | false;
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}

export const ease = (t: number) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const ICON: Record<string, string> = {
  full: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  lab: '<svg viewBox="0 0 24 24"><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3"/><path d="M7.5 14h9"/></svg>',
};

export interface StageOpts { num: string; title: string; sub: string; acc: string; ink: string; hf?: string; fov?: number; near?: number; far?: number; alpha?: boolean; lab?: () => Promise<{ default: (c: Ctx) => void | (() => void) }>; labName?: string }

export function stage(ctx: Ctx, o: StageOpts) {
  css();
  const t = ctx.t;
  const phone = matchMedia('(max-width: 899px)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const root = el('div', { class: 'ns', style: { '--acc': o.acc, '--ink': o.ink, ...(o.hf ? { '--hf': o.hf } : {}) } as unknown as Record<string, string> });
  for (const [k, v] of [['--acc', o.acc], ['--ink', o.ink], ['--hf', o.hf ?? '']] as const) if (v) root.style.setProperty(k, v);
  if ((ctx as unknown as { full?: boolean }).full) root.classList.add('ns-full');
  const cv = el('canvas', { class: 'ns-gl', tabindex: '0', role: 'img', 'aria-label': o.title });
  const load = el('div', { class: 'ns-load' }, el('div', {}, t('ns.load', 'Entering world'), el('i')));
  const tools = el('div', { class: 'ns-tools' });
  const top = el('div', { class: 'ns-top' }, el('div', { class: 'ns-tt' }, el('div', { class: 'ns-num', text: o.num }), el('h2', { class: 'ns-h', text: o.title }), el('p', { class: 'ns-sub', text: o.sub })), tools);
  const dock = el('div', { class: 'ns-dock', role: 'toolbar' });
  const body = el('div', { class: 'ns-body' });
  const grab = el('button', { class: 'ns-grab', type: 'button', 'aria-label': t('ns.panel', 'Controls'), text: t('ns.panel', 'Controls') });
  const sheet = el('aside', { class: 'ns-sheet' }, grab, body);
  const card = el('div', { class: 'ns-card', role: 'status' });
  const hint = el('div', { class: 'ns-hint' });
  const tags = el('div', { style: { position: 'absolute', inset: '0', zIndex: '2', pointerEvents: 'none' } });
  root.append(cv, tags, top, dock, sheet, card, hint, load);
  ctx.root.append(root);
  /* 0.9.6 (owner, 21 Nov: only what is really needed): first two control groups stay; the rest and long explanations go under More */
  setTimeout(() => { if (body.querySelector('.ns-more')) return; const kids = [...body.children] as HTMLElement[];
    const heads = kids.filter((k) => k.classList.contains('ns-sec')); const longP = kids.filter((k) => k.classList.contains('ns-p') && (k.textContent ?? '').length > 140);
    const ctl = kids.filter((k) => /\bns-(r|seg|btns)\b/.test(k.className)); const c5 = ctl.length > 5 ? kids.indexOf(ctl[4]) + 1 : kids.length;
    const cut = Math.min(heads.length >= 3 ? kids.indexOf(heads[2]) : kids.length, c5); if (cut >= kids.length && !longP.length) return;
    const move = kids.filter((k, i) => i >= cut || longP.includes(k)); if (!move.length) return;
    const mv = (globalThis as { I18N_BOOT?: { dict?: Record<string, string> } }).I18N_BOOT?.dict?.['s3.more'];
    const box = el('details', { class: 'ns-more' }, el('summary', { text: mv || 'More options' })); box.append(...move); body.append(box); }, 0);

  /* renderer: sharp on every screen. Phones with DPR 3 render at 2 (indistinguishable, 44% fewer pixels) */
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: !!o.alpha, powerPreference: 'high-performance' });
  let dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 45, 1, o.near ?? .1, o.far ?? 5000);
  const controls = new OrbitControls(camera, cv);
  controls.enableDamping = true; controls.dampingFactor = .06; controls.rotateSpeed = coarse ? .55 : .6; controls.zoomSpeed = .8;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  /* phone bottom sheet: tap or drag the handle */
  const setOpen = (v: boolean) => { sheet.classList.toggle('open', v); root.classList.toggle('sheet-open', v); };
  grab.addEventListener('click', () => setOpen(!sheet.classList.contains('open')));
  let gy = 0, moved = false;
  grab.addEventListener('pointerdown', (e) => { gy = e.clientY; moved = false; grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', (e) => { if (!grab.hasPointerCapture(e.pointerId)) return; const d = e.clientY - gy; if (Math.abs(d) > 24 && !moved) { moved = true; setOpen(d < 0); } });
  grab.addEventListener('click', (e) => { if (moved) { e.stopImmediatePropagation(); } }, true);

  /* tools: reset view, original lab, fullscreen */
  const fns: ((dt: number, time: number) => void)[] = [];
  let home: { p: THREE.Vector3; t: THREE.Vector3 } | null = null;
  const ib = (icon: string, label: string, on: () => void) => { const b = el('button', { class: 'ns-ib', type: 'button', 'aria-label': label, title: label, html: ICON[icon], onclick: on }); tools.append(b); return b; };
  const back = (ctx as unknown as { back?: () => void }).back;
  if (back) { const b = ib('home', t('ns.all', 'All worlds'), back); b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'; }
  ib('home', t('ns.reset', 'Reset view'), () => { if (home) flyTo(home.p, home.t, 1.4); });
  let labEl: HTMLElement | null = null, labOff: (() => void) | void;
  if (o.lab) ib('lab', o.labName ?? t('ns.lab', 'Open the original lab'), async () => {
    if (!labEl) {
      const inner = el('div', { style: { padding: '0' } });
      labEl = el('div', { class: 'ns-lab' }, el('div', { class: 'ns-lab-bar' }, el('strong', { text: o.labName ?? t('ns.lab', 'Original lab') }), el('button', { class: 'ns-btn', style: { flex: 'none' }, text: t('ns.back3d', 'Back to 3D'), onclick: () => labEl!.classList.remove('on') })), inner);
      root.append(labEl);
      const m = await o.lab!();
      labOff = m.default({ ...ctx, root: inner, onDispose: ctx.onDispose });
    }
    labEl.classList.add('on');
  });
  ib('full', t('ns.full', 'Full screen'), () => { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen?.().catch(() => {}); });
  const onFs = () => { root.classList.toggle('ns-full', !!document.fullscreenElement || !!(ctx as unknown as { full?: boolean }).full); };
  document.addEventListener('fullscreenchange', onFs);

  /* sizing */
  let W = 1, H = 1;
  const resize = () => {
    const r = root.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    /* desktop: the side panel covers the right edge, so the picture is centred in the free space */
    if (!matchMedia('(max-width: 899px)').matches && W > 900) { const off = 180; camera.setViewOffset(W + off * 2, H, off * 2, 0, W, H); } else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    const peek = grab.offsetHeight + (body.querySelector('.ns-peek') as HTMLElement | null)?.offsetHeight! || 128;
    root.style.setProperty('--peek', Math.min(Math.max(peek + 8, 96), 190) + 'px');
    resizers.forEach((f) => f(W, H));
  };
  const resizers: ((w: number, h: number) => void)[] = [];
  let draw = () => renderer.render(scene, camera);
  const ro = new ResizeObserver(resize); ro.observe(root);

  /* cinematic camera moves */
  let fly: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; d: number; k: number; done?: () => void; arc: number } | null = null;
  function flyTo(p: THREE.Vector3, tgt: THREE.Vector3, d = 2, done?: () => void, arc = 0) {
    fly = { p0: camera.position.clone(), p1: p.clone(), t0: controls.target.clone(), t1: tgt.clone(), d: (globalThis as unknown as { NS_SNAP?: boolean }).NS_SNAP ? .001 : ctx.calm ? Math.min(d, .6) : d, k: 0, done, arc };
  }
  function setHome(p: THREE.Vector3, tgt: THREE.Vector3) { home = { p: p.clone(), t: tgt.clone() }; }
  controls.addEventListener('start', () => { if (fly && fly.k > .05) fly = null; card.classList.remove('on'); });

  /* frame loop: sleeps when the tab is hidden or the stage is off screen */
  let visible = true, raf = 0, last = performance.now(), time = 0, frames = 0, acc = 0, checked = false;
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
  io.observe(root);
  function tick(now: number) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(.05, (now - last) / 1000); last = now; time += dt;
    if (fly) {
      fly.k = Math.min(1, fly.k + dt / fly.d); const e = ease(fly.k);
      camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e);
      if (fly.arc) camera.position.y += Math.sin(Math.PI * e) * fly.arc;
      if (fly.k >= 1) { const d = fly.done; fly = null; d?.(); }
    }
    controls.update();
    for (const f of fns) f(dt, time);
    draw();
    /* quality guard: if a weak phone cannot hold ~35 fps at full sharpness, step down to 1.5x (still crisp) once */
    if (!checked) { frames++; acc += dt; if (acc > 2.5) { checked = true; const fps = frames / acc; if (fps < 35 && dpr > 1.5) { dpr = 1.5; renderer.setPixelRatio(dpr); resize(); } } }
    raf = requestAnimationFrame(tick);
  }
  const vis = () => { if (!document.hidden && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  document.addEventListener('visibilitychange', vis);
  function start() { resize(); raf = requestAnimationFrame(tick); setTimeout(() => load.classList.add('off'), 150); }

  /* picking */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(list: () => THREE.Object3D[], on: (hit: THREE.Intersection) => void, opts: { recursive?: boolean } = {}) {
    let down = { x: 0, y: 0, t: 0 };
    cv.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    cv.addEventListener('pointerup', (e) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 600) return;
      const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(list(), opts.recursive ?? true);
      if (hits[0]) on(hits[0]);
    });
  }
  function showCard(title: string, text: string, ms = 0) {
    card.innerHTML = '';
    card.append(el('button', { class: 'x', type: 'button', 'aria-label': t('ns.close', 'Close'), text: '×', onclick: () => card.classList.remove('on') }), el('h4', { text: title }), el('p', { text }));
    card.classList.add('on');
    if (ms) setTimeout(() => card.classList.remove('on'), ms);
  }
  function showHint(text: string, ms = 2600) { hint.textContent = text; hint.classList.add('on'); setTimeout(() => hint.classList.remove('on'), ms); }

  /* screen-space labels that follow 3D points */
  const v3 = new THREE.Vector3();
  function tag(text: string) {
    const e = el('div', { class: 'ns-tag', text }); tags.append(e);
    return { el: e, at(p: THREE.Vector3, show = true) { v3.copy(p).project(camera); const vis = show && v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1; e.style.display = vis ? '' : 'none'; if (vis) e.style.left = ((v3.x + 1) / 2 * W) + 'px', e.style.top = ((1 - v3.y) / 2 * H) + 'px'; } };
  }

  function dispose() {
    cancelAnimationFrame(raf); raf = 0; ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', vis); document.removeEventListener('fullscreenchange', onFs);
    controls.dispose();
    scene.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose?.(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((x) => { for (const v of Object.values(x)) if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); x.dispose(); }); });
    renderer.dispose(); renderer.forceContextLoss?.();
    if (typeof labOff === 'function') labOff();
    root.remove();
  }
  ctx.onDispose(dispose);
  const api = {
    root, cv, renderer, scene, camera, controls, dock, body, sheet, card, phone, coarse, t,
    get size() { return { w: W, h: H }; },
    onFrame(f: (dt: number, time: number) => void) { fns.push(f); },
    onResize(f: (w: number, h: number) => void) { resizers.push(f); },
    setRender(f: () => void) { draw = f; },
    /** fixed pixel ratio chosen by a world's quality setting (turns off the automatic step-down) */
    setPixelRatio(r: number) { checked = true; dpr = Math.min(r, devicePixelRatio || 1, 2); renderer.setPixelRatio(dpr); resize(); },
    get pixelRatio() { return dpr; },
    flyTo, setHome, pick, showCard, showHint, tag, start, setOpen, dispose, loaded: () => load.classList.add('off'),
  };
  (globalThis as unknown as { NS_DBG?: unknown }).NS_DBG = api;
  return api;
}
export type Stage = ReturnType<typeof stage>;

/* ---------- panel controls ---------- */
export function sec(p: HTMLElement, text: string) { const e = el('div', { class: 'ns-sec', text }); p.append(e); return e; }
export function para(p: HTMLElement, text: string) { const e = el('p', { class: 'ns-p', text }); p.append(e); return e; }
let uid = 0;
export function slider(p: HTMLElement, label: string, o: { min: number; max: number; step?: number; value: number; fmt?: (v: number) => string }, on: (v: number) => void) {
  const id = 'ns' + (++uid), out = el('output', { for: id });
  const inp = el('input', { type: 'range', id, min: o.min, max: o.max, step: o.step ?? 1 }) as HTMLInputElement; inp.value = String(o.value);
  const fmt = o.fmt ?? String;
  const upd = () => { out.textContent = fmt(+inp.value); inp.style.setProperty('--p', ((+inp.value - o.min) / (o.max - o.min) * 100) + '%'); };
  inp.addEventListener('input', () => { upd(); on(+inp.value); }); upd();
  p.append(el('label', { class: 'ns-r', for: id }, el('span', {}, el('span', { text: label }), out), inp));
  return { input: inp, set(v: number, fire = false) { inp.value = String(v); upd(); if (fire) on(v); } };
}
export function segs(p: HTMLElement, label: string, opts: [string, string][], value: string, on: (v: string) => void) {
  const box = el('div', { class: 'ns-seg', role: 'group', 'aria-label': label });
  const btns = opts.map(([v, tx]) => el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === value), text: tx, onclick: () => { set(v); on(v); } }));
  const set = (v: string) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  box.append(...btns);
  p.append(el('div', { class: 'ns-r' }, label ? el('span', { text: label }) : null, box));
  return { set };
}
export function btns(p: HTMLElement, list: [string, () => void, boolean?][]) {
  const box = el('div', { class: 'ns-btns' });
  const out = list.map(([tx, on, pri]) => { const b = el('button', { class: 'ns-btn' + (pri ? ' pri' : ''), type: 'button', text: tx, onclick: on }); box.append(b); return b; });
  p.append(box); return out;
}
export function stats(p: HTMLElement, list: [string, string][], peek = false) {
  const box = el('div', { class: 'ns-stats' + (peek ? ' ns-peek' : '') }); const map = new Map<string, HTMLElement>();
  for (const [k, label] of list) { const v = el('span', { text: '–' }); map.set(k, v); box.append(el('div', { class: 'ns-stat' }, el('b', { text: label }), v)); }
  p.append(box);
  return (k: string, v: string) => { const e = map.get(k); if (e && e.textContent !== v) e.textContent = v; };
}
export function chips(s: Stage, list: [string, string][], value: string, on: (v: string) => void) {
  const bs = list.map(([v, tx]) => el('button', { class: 'ns-chip', type: 'button', 'data-v': v, 'aria-pressed': String(v === value), text: tx, onclick: () => { set(v); on(v); } }));
  const set = (v: string) => bs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  s.dock.append(...bs);
  return { set };
}

/* ---------- lighting ---------- */
/** daylight sky dome: zenith/horizon colours that follow the sun height (blue noon, golden low sun,
    rose twilight), a sun disk with a soft halo. The same dome is baked into image-based lighting. */
const SKY_VS = `varying vec3 vD; void main(){ vD=normalize((modelMatrix*vec4(position,1.)).xyz-cameraPosition); vec4 p=projectionMatrix*viewMatrix*modelMatrix*vec4(position,1.); gl_Position=p.xyww; }`;
const SKY_FS = `uniform vec3 uSun; uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGlow; uniform float uDisk; uniform vec3 uGround; varying vec3 vD;
void main(){ vec3 d=normalize(vD); float h=d.y; float mu=max(dot(d,uSun),0.);
  vec3 c=mix(uHor,uZen,pow(clamp(h,0.,1.),.45));
  c+=uGlow*(pow(mu,8.)*.55+pow(mu,64.)*.9)*(1.-clamp(h,0.,1.)*.6);
  c+=vec3(1.,.95,.85)*smoothstep(.9994,.99975,mu)*uDisk;
  c=mix(c,uGround,smoothstep(0.,-.08,h));
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
export function skyColors(elev: number) {
  const e = clamp(elev / 50, -.2, 1), low = 1 - clamp(elev / 18, 0, 1), dusk = clamp(1 - (elev + 4) / 8, 0, 1);
  const zen = new THREE.Color().setRGB(lerp(.045, .05, low), lerp(.2, .13, low), lerp(.55, .32, low)).lerp(new THREE.Color(.012, .02, .06), dusk);
  const hor = new THREE.Color().setRGB(lerp(.42, .95, low), lerp(.6, .55, low), lerp(.78, .36, low)).lerp(new THREE.Color(.25, .12, .18), dusk);
  const glow = new THREE.Color().setRGB(1, lerp(.85, .55, low), lerp(.7, .3, low)).multiplyScalar(lerp(.9, 1.6, low) * (1 - dusk));
  return { zen: zen.multiplyScalar(e > 0 ? 1 : .6), hor: hor.multiplyScalar(1.0), glow };
}
export function daylight(s: Stage, o: { elev: number; azim: number; size?: number; envOnly?: boolean; ground?: number }) {
  const mk = () => new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false, uniforms: { uSun: { value: new THREE.Vector3() }, uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() }, uDisk: { value: 9 }, uGround: { value: new THREE.Color(o.ground ?? 0x0c1a24) } } });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mk()); sky.scale.setScalar(o.size ?? 4000); sky.frustumCulled = false; sky.renderOrder = -1;
  const u = (sky.material as THREE.ShaderMaterial).uniforms;
  const sun = new THREE.Vector3();
  const pm = new THREE.PMREMGenerator(s.renderer);
  const envScene = new THREE.Scene(); const sky2 = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mk()); (sky2.material as THREE.ShaderMaterial).uniforms.uDisk.value = 2; envScene.add(sky2);
  let rt: THREE.WebGLRenderTarget | null = null;
  function set(elev: number, azim: number) {
    const phi = THREE.MathUtils.degToRad(90 - elev), th = THREE.MathUtils.degToRad(azim);
    sun.setFromSphericalCoords(1, phi, th);
    const c = skyColors(elev);
    for (const uu of [u, (sky2.material as THREE.ShaderMaterial).uniforms]) { uu.uSun.value.copy(sun); uu.uZen.value.copy(c.zen); uu.uHor.value.copy(c.hor); uu.uGlow.value.copy(c.glow); }
    rt?.dispose(); rt = pm.fromScene(envScene, 0, .1, 2000); s.scene.environment = rt.texture;
  }
  set(o.elev, o.azim);
  if (!o.envOnly) s.scene.add(sky);
  return { sky, sun, set, uniforms: u };
}

/* ---------- textures ---------- */
export function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, o: { srgb?: boolean; repeat?: number; aniso?: number } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; draw(g, w, h);
  const tx = new THREE.CanvasTexture(c);
  if (o.srgb !== false) tx.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(o.repeat, o.repeat); }
  tx.anisotropy = o.aniso ?? 8;
  return tx;
}
/** soft round sprite for stars, dust and glows */
export function glowTex(size = 128, stops: [number, string][] = [[0, 'rgba(255,255,255,1)'], [.25, 'rgba(255,255,255,.55)'], [1, 'rgba(255,255,255,0)']]) {
  return canvasTex(size, size, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); for (const [k, c] of stops) r.addColorStop(k, c); g.fillStyle = r; g.fillRect(0, 0, w, w); });
}

/* ---------- GLSL ---------- */
export const GLSL_NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;i=mod289(i);
vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*snoise(p);p*=2.03;a*=.5;}return s;}
`;

/* ---------- value noise on the CPU (seeded) ---------- */
export function noise2(seed = 1) {
  const R = rng(seed), P = new Uint8Array(512), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const g = (h: number, x: number, y: number) => { const a = (h & 7) * Math.PI / 4; return Math.cos(a) * x + Math.sin(a) * y; };
  const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
    const u = f(x), v = f(y), a = P[X] + Y, b = P[X + 1] + Y;
    return lerp(lerp(g(P[a], x, y), g(P[b], x - 1, y), u), lerp(g(P[a + 1], x, y - 1), g(P[b + 1], x - 1, y - 1), u), v) * 1.41;
  };
}

/* ---------- assets ---------- */
/** asset base: the site serves real files under /assets/ns/; the preview sets NS_ASSETS (and base64 .txt copies, because artifacts do not serve .glb) */
export function assetUrl(name: string) {
  const g = globalThis as unknown as { NS_ASSETS?: { base: string; b64?: boolean }; NS_ROOT?: string };
  const a = g.NS_ASSETS ?? { base: (g.NS_ROOT ?? I18N.root) + 'assets/ns/' };
  return a.base + name + (a.b64 && name.endsWith('.glb') ? '.txt' : '');
}
export async function loadGLB(name: string) {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const url = assetUrl(name), L = new GLTFLoader();
  try { const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js'); L.setMeshoptDecoder(MeshoptDecoder); } catch { /* plain GLBs still load */ }
  if (url.endsWith('.txt')) {
    const b64 = (await (await fetch(url)).text()).trim(), bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return await L.parseAsync(u8.buffer, '');
  }
  return await L.loadAsync(url);
}
