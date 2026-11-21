/* Host for the Tech & AI worlds (07 AI Creation Studio, 08 AI Image & Design, 09 Future Technology, 10 Robotics,
   11 Digital Innovation). Each world is a full WebGL scene with its own control panel (a side panel on computers,
   a bottom sheet on phones). The host gives it a frame inside the world page, a "Full view" button for phones
   (fixed full screen, works on iPhone where element fullscreen does not), the page's language and links. */
import type { Ctx } from '../kit';
import { I18N } from '../../scripts/i18n';
import { setLang, setNav, L } from './tk.js';

type World = { start: (canvas: HTMLCanvasElement, ui: HTMLElement) => Promise<{ dispose?: () => void } | undefined> };

const CSS = `
.tkw{position:relative;height:clamp(560px,calc(100svh - 110px),960px);overflow:hidden;background:#050507;isolation:isolate;border-radius:inherit;contain:layout paint}
.tkw>canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.tkw-max{position:absolute;z-index:30;right:12px;top:12px;display:none;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.18);border-radius:999px;
  background:rgba(12,12,14,.72);color:#f1ece3;padding:9px 13px;min-height:40px;font:500 10.5px 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.tkw-load{position:absolute;inset:0;z-index:50;display:grid;place-items:center;background:#050507;color:#8d877c;font:400 11px 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;transition:opacity .8s}
.tkw-load.done{opacity:0;pointer-events:none}
.wstage:fullscreen .tkw{height:100vh;height:100dvh}
html.tkw-lock,html.tkw-lock body{overflow:hidden!important}
body:has(.tkw) #grain{display:none}
.tkw.max{position:fixed;inset:0;height:auto;z-index:2147483000;border-radius:0}
@media (max-width:760px){
  .tkw{height:max(520px,calc(100svh - 150px - env(safe-area-inset-bottom,0px)))}
  .tkw-max{display:inline-flex}
  .tkw.max .tkw-max{top:calc(env(safe-area-inset-top,0px) + 12px)}
  /* 0.9.13: on the page the controls sit UNDER the 3D view and the page scrolls once (no scroll inside a scroll). Full view keeps the pull-up sheet. */
  .tkw:not(.max){height:auto;overflow:visible;contain:none}
  .tkw:not(.max)>canvas{position:relative;inset:auto;height:60svh;min-height:360px}
}`;

export function mount(ctx: Ctx, load: () => Promise<World>) {
  if (!document.getElementById('tkw-css')) { const s = document.createElement('style'); s.id = 'tkw-css'; s.textContent = CSS; document.head.append(s); }
  (window as unknown as { ABIDORA_ROOT: string }).ABIDORA_ROOT = I18N.root;
  setLang((k: string, en: string) => ctx.t(k, en));
  setNav((id: number) => { location.href = `${I18N.url('world')}?w=${id}`; });

  const wrap = document.createElement('div'); wrap.className = 'tkw';
  const canvas = document.createElement('canvas'); canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', document.title);
  const veil = document.createElement('div'); veil.className = 'tkw-load'; veil.setAttribute('role', 'status'); veil.textContent = L('Entering the world…');
  const max = document.createElement('button'); max.type = 'button'; max.className = 'tkw-max';
  /* full view moves the world to <body>, above the site bar and every stacking context; the WebGL canvas keeps its context */
  const home = document.createComment('tkw');
  const setMax = (on: boolean) => {
    if (on && !wrap.classList.contains('max')) { wrap.before(home); document.body.append(wrap); }
    else if (!on && home.parentNode) home.replaceWith(wrap);
    wrap.classList.toggle('max', on); document.documentElement.classList.toggle('tkw-lock', on);
    max.textContent = on ? '✕  ' + L('Close full view') : '⤢  ' + L('Full view'); max.setAttribute('aria-pressed', String(on));
    dispatchEvent(new Event('resize'));
  };
  max.addEventListener('click', () => setMax(!wrap.classList.contains('max')));
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && wrap.classList.contains('max')) setMax(false); };
  addEventListener('keydown', esc);
  setMax(false);
  wrap.append(canvas, max, veil); ctx.root.append(wrap);
  /* safety: a pinch on the 3D view zooms the scene, never the page */
  const noPinch = (e: Event) => e.preventDefault();
  wrap.addEventListener('gesturestart', noPinch); wrap.addEventListener('gesturechange', noPinch);

  let k: { dispose?: () => void } | undefined, dead = false;
  ctx.onDispose(() => { dead = true; removeEventListener('keydown', esc); document.documentElement.classList.remove('tkw-lock'); k?.dispose?.(); });
  load().then(async (m) => {
    if (dead) return;
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]); } catch { /* ignore */ }
    k = await m.start(canvas, wrap);
    veil.classList.add('done'); setTimeout(() => veil.remove(), 900);
  }).catch((e) => { console.error(e); veil.textContent = L('This world needs WebGL. Please try another browser or device.'); });
}
