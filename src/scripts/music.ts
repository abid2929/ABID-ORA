/* Background music for 3D pages.
   Public-domain (CC0) tracks from freepd.com, levelled to the same medium loudness.
   Browsers only allow sound after the visitor touches the page, so music starts on the first
   tap, click or key press, fades in slowly, plays one track after another, and fades out when
   the tab is hidden or the page is left. A small button turns it off; the choice is remembered. */
import { I18N } from './i18n';

/* 3D pages: lively tracks with a clear beat (owner, 21 Nov: "bit baje") */
const TRACKS: [string, string, string][] = [
  ['shenzhen-nightlife', 'Shenzhen Nightlife', 'Kevin MacLeod'],
  ['funshine', 'Funshine', 'freepd.com'],
  ['blippy-trance', 'Blippy Trance', 'freepd.com'],
  ['take-the-ride', 'Take the Ride', 'Bryan Teoh'],
  ['inspiration', 'Inspiration', 'freepd.com'],
  ['funkeriffic', 'Funkeriffic', 'freepd.com'],
  ['be-jammin', 'Be Jammin', 'Alexander Nakarada'],
  ['gotta-keep-on-movin', 'Gotta Keep On Movin', 'freepd.com'],
  ['downtown-boogie', 'Downtown Boogie', 'Bryan Teoh'],
  ['pump-up-your-graduation', 'Pump Up Your Graduation', 'freepd.com'],
  ['be-chillin', 'Be Chillin', 'Alexander Nakarada'],
  ['groovin', 'Groovin', 'freepd.com'],
  ['city-sunshine', 'City Sunshine', 'Kevin MacLeod'],
];
/* home page "Sound on": calmer tracks */
const CALM_T: [string, string, string][] = [
  ['infinite-wonder', 'Infinite Wonder', 'Kevin MacLeod'],
  ['screen-saver', 'Screen Saver', 'Kevin MacLeod'],
  ['study-and-relax', 'Study and Relax', 'Kevin MacLeod'],
  ['meditating-beat', 'Meditating Beat', 'Kevin MacLeod'],
];
const VOL = 0.26, KEY = 'ab.music';

const get = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const set = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };
const T = (k: string, f: string) => { const v = I18N.t(k); return v && v !== k ? v : f; };

export function music(): void {
  if (document.getElementById('abmus')) return;
  const saveData = (navigator as unknown as { connection?: { saveData?: boolean } }).connection?.saveData;
  let on = get() ? get() === 'on' : !saveData;

  const order = TRACKS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  let pos = 0, started = false, fadeT = 0;
  const a = new Audio(); a.preload = 'none'; a.volume = 0;
  const load = () => { const t = TRACKS[order[pos % order.length]]; a.src = `${I18N.root}assets/music/${t[0]}.mp3`; name.textContent = `${t[1]} · ${t[2]}`; };

  const fade = (to: number, ms: number, done?: () => void) => {
    cancelAnimationFrame(fadeT);
    const from = a.volume, t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) fadeT = requestAnimationFrame(step); else done?.();
    };
    fadeT = requestAnimationFrame(step);
  };
  const play = () => { if (!a.src) load(); a.play().then(() => { started = true; fade(VOL, 3500); ui(); }).catch(() => { /* wait for next touch */ }); };
  const stop = (ms = 900) => fade(0, ms, () => { a.pause(); ui(); });
  const next = () => { pos++; load(); a.volume = 0; if (on && !document.hidden) play(); };

  a.addEventListener('ended', next);
  a.addEventListener('error', () => { if (started) setTimeout(next, 800); });
  a.addEventListener('timeupdate', () => { if (a.duration && a.duration - a.currentTime < 3 && a.volume > 0.02 && !a.paused) fade(0, 2500); });

  const btn = document.createElement('button');
  btn.id = 'abmus'; btn.type = 'button';
  btn.innerHTML = '<span class="mb" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="mn"></span>';
  const name = btn.querySelector('.mn') as HTMLSpanElement;
  const ui = () => {
    const playing = on && !a.paused;
    btn.classList.toggle('on', playing); btn.classList.toggle('off', !on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? T('mu.off', 'Turn music off') : T('mu.on', 'Turn music on'));
    btn.title = on ? `${T('mu.now', 'Now playing')}: ${name.textContent}` : T('mu.on', 'Turn music on');
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); on = !on; set(on ? 'on' : 'off');
    if (on) { if (started) { pos++; load(); a.volume = 0; } play(); } else stop(); ui(); });
  document.body.append(btn);
  load(); ui();

  const first = () => { if (on && !started) play(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, first, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!a.paused) stop(600); } else if (on && started) play(); });
  addEventListener('pagehide', () => { a.pause(); });

  const css = document.createElement('style');
  css.textContent = `#abmus{position:fixed;z-index:70;inset-inline-end:132px;bottom:calc(46px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:8px;height:40px;padding:0 12px;border-radius:999px;border:1px solid var(--line,rgba(255,255,255,.15));background:color-mix(in srgb,var(--ink,#0b0b0d) 82%,transparent);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:var(--bone,#efe9df);cursor:pointer;font:500 11px/1 var(--mono,ui-monospace,monospace);letter-spacing:.04em}
#abmus .mn{max-width:0;overflow:hidden;white-space:nowrap;transition:max-width .4s ease;opacity:.85}
#abmus:hover .mn,#abmus:focus-visible .mn{max-width:220px}
#abmus .mb{display:flex;align-items:flex-end;gap:2px;height:14px}
#abmus .mb i{display:block;width:3px;height:4px;border-radius:2px;background:var(--gold,#e8b46a)}
#abmus.on .mb i{animation:abmb 1s ease-in-out infinite}
#abmus.on .mb i:nth-child(2){animation-delay:-.35s}#abmus.on .mb i:nth-child(3){animation-delay:-.7s}#abmus.on .mb i:nth-child(4){animation-delay:-.2s}
#abmus.off .mb{opacity:.45}#abmus.off .mb::after{content:"";position:absolute;width:20px;height:2px;background:currentColor;transform:rotate(-35deg) translate(-2px,6px)}
#abmus.off{position:fixed}#abmus .mb{position:relative}
@keyframes abmb{0%,100%{height:4px}50%{height:14px}}
@media (max-width:800px){#abmus{bottom:calc(84px + env(safe-area-inset-bottom));inset-inline-start:auto;inset-inline-end:12px;height:36px;padding:0 10px}#abmus .mn{display:none}}
@media (prefers-reduced-motion:reduce){#abmus.on .mb i{animation:none;height:10px}}`;
  document.head.append(css);
}

/* Home page: the header "Sound on" button plays the calm tracks, one after another, at half the 3D-page volume. */
export function homeMusic(): (on: boolean) => void {
  const list = CALM_T.slice(); for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  let pos = 0, fadeT = 0, want = false;
  const a = new Audio(); a.preload = 'none'; a.volume = 0;
  const load = () => { a.src = `${I18N.root}assets/music/${list[pos % list.length][0]}.mp3`; };
  const fade = (to: number, ms: number, done?: () => void) => { cancelAnimationFrame(fadeT); const from = a.volume, t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k < 1) fadeT = requestAnimationFrame(step); else done?.(); };
    fadeT = requestAnimationFrame(step); };
  const play = () => { if (!a.src) load(); a.play().then(() => fade(VOL / 2, 2500)).catch(() => { /* blocked */ }); };
  a.addEventListener('ended', () => { pos++; load(); a.volume = 0; if (want) play(); });
  a.addEventListener('timeupdate', () => { if (a.duration && a.duration - a.currentTime < 3 && a.volume > .02) fade(0, 2500); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) fade(0, 500, () => a.pause()); else if (want) play(); });
  let played = false;
  a.addEventListener('playing', () => { played = true; });
  /* turning it on again starts a different song */
  return (on: boolean) => { want = on; if (on) { if (played) { pos++; load(); a.volume = 0; } play(); } else fade(0, 900, () => a.pause()); };
}
