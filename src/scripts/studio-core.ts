/* Personal Universe Studio, core: the visitor's settings live only in their own browser
   (localStorage "abidora.studio") and are applied on every page. */
import { theme, TYPE, DEFAULT_THEME, type Theme } from '../data/themes';
import { cursorById, type CursorSpec } from '../data/cursors';
import { cursorFx, type CursorFx } from './cursor-fx';
export type Mood = 'natural' | 'noir' | 'dusk' | 'arctic' | 'neon';
/* cursor: 'lens' | 'dot' | 'native' or a Cursor Studio preset id; type: 'auto' (the theme's pairing) or a TYPE key; scale: text size in % */
export interface Studio { mood: Mood; cursor: string; motion: 'full' | 'calm'; grain: 'on' | 'off'; theme: string; type: string; scale: number; cc?: CursorSpec }
const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
export const DEFAULTS: Studio = { mood: 'natural', cursor: 'lens', motion: R ? 'calm' : 'full', grain: 'on', theme: DEFAULT_THEME, type: 'auto', scale: 100 };
export const studio: Studio = { ...DEFAULTS };
let chose = false;
/* v2: a motion choice saved by older previews (before v0.4.2) is dropped, so the hero moves again by default */
try { const o = JSON.parse(localStorage.getItem('abidora.studio') ?? '{}'); if (o.v !== 2) delete o.motion; delete o.v; if (o.motion) chose = true; Object.assign(studio, o); } catch { /* ignore */ }
export const SIGNAL: Record<Mood, string> = { natural: '', noir: '#ece6dc', dusk: '#ff8a5c', arctic: '#8fd0ff', neon: '#ff5ce1' };
export const calm = () => studio.motion === 'calm';
/* mouse-driven effects (hero lens and photo follow) answer the visitor's own hand, so they only stop when the visitor picked Calm in the Studio */
export const handCalm = () => chose && studio.motion === 'calm';
export function choseMotion() { chose = true; }
export function motionChosen() { return chose; }

export function saveStudio() {
  try { const o: Partial<Studio> & { v: number } = { ...studio, v: 2 }; if (!chose) delete o.motion; localStorage.setItem('abidora.studio', JSON.stringify(o)); } catch { /* ignore */ }
  try { dispatchEvent(new CustomEvent('abidora:studio')); } catch { /* ignore */ }
}

/* ---- cursor presets (Cursor Studio) ---- */
let fx: CursorFx | null = null;
export function presetSpec(s: Studio): CursorSpec | null {
  if (s.cursor === 'custom') return s.cc ?? null;
  if (s.cursor === 'lens' || s.cursor === 'dot' || s.cursor === 'native') return null;
  return cursorById(s.cursor)?.[3] ?? null;
}
/** show a cursor spec without saving it (Cursor Studio hover preview); null restores the saved one */
export function previewCursor(spec: CursorSpec | null) { if (!FINE) return; fx = fx ?? cursorFx(); const c = document.getElementById('cur'); const sp = spec ?? presetSpec(studio); c?.classList.toggle('pre', !!sp); fx.set(sp); }
export function fxHidden(on: boolean) { fx?.hidden(on); }

/* ---- theme engine ---- */
let base: { serif: string; sans: string; mono: string } | null = null;
const loaded = new Set<string>(['Instrument Serif', 'Inter Tight', 'JetBrains Mono']);
export function loadFonts(fams: string[]) {
  const need = fams.filter((f) => !loaded.has(f)); if (!need.length) return;
  need.forEach((f) => loaded.add(f));
  const q = need.map((f) => 'family=' + f.replace(/ /g, '+') + (/Mono|VT323|Black|Mincho|Serif Display|Shippori/.test(f) ? '' : ':wght@400;500;700')).join('&');
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + q + '&display=swap'; document.head.appendChild(l);
}
export function themeVars(t: Theme, mood: Mood): Record<string, string> {
  return { '--ink': t.ink, '--ink2': t.ink2, '--bone': t.bone, '--bone2': t.bone2, '--mute': t.mute, '--line': t.line, '--signal': (mood !== 'natural' && !t.light ? SIGNAL[mood] : '') || t.signal };
}
export function applyStudio(s: Studio) {
  const root = document.documentElement;
  if (!base) { const cs = getComputedStyle(root); base = { serif: cs.getPropertyValue('--serif'), sans: cs.getPropertyValue('--sans'), mono: cs.getPropertyValue('--mono') }; }
  const t = theme(s.theme);
  Object.entries(themeVars(t, s.mood)).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.tone = t.light ? 'light' : 'dark'; root.dataset.theme = t.id; root.style.colorScheme = t.light ? 'light' : 'dark';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.ink);
  const tp = TYPE[s.type === 'auto' ? t.type : s.type] ?? TYPE.editorial;
  if (tp.d === 'Instrument Serif' && tp.s === 'Inter Tight') { ['--serif', '--sans', '--mono'].forEach((k) => root.style.removeProperty(k)); }
  else {
    loadFonts([tp.d, tp.s, tp.m]);
    root.style.setProperty('--serif', `'${tp.d}',${base.serif}`); root.style.setProperty('--sans', `'${tp.s}',${base.sans}`); root.style.setProperty('--mono', `'${tp.m}',${base.mono}`);
  }
  root.style.setProperty('--fs', String((s.scale || 100) / 100));
  root.dataset.motion = s.motion;
  const g = document.getElementById('grain'); if (g) g.style.display = s.grain === 'on' ? '' : 'none';
  /* hide the system mouse only on pages that draw their own cursor (#cur); pages without it, like Abidora AI, keep the normal mouse */
  const c = document.getElementById('cur');
  const custom = FINE && s.cursor !== 'native' && !!c;
  root.classList.toggle('cz', custom);
  if (c) { c.style.display = custom ? '' : 'none'; c.classList.toggle('dotc', s.cursor === 'dot'); }
  const spec = presetSpec(s);
  if (c) c.classList.toggle('pre', !!spec);
  if (FINE && c && (spec || fx)) { fx = fx ?? cursorFx(); fx.set(spec); }
  try { dispatchEvent(new CustomEvent('abidora:applied')); } catch { /* ignore */ }
}

/* film grain texture, generated once */
export function grain() {
  const g = document.getElementById('grain'); if (!g) return;
  const t = document.createElement('canvas'), x = t.getContext('2d'); if (!x) return;
  t.width = t.height = 200; const d = x.createImageData(200, 200);
  for (let i = 0; i < d.data.length; i += 4) { const v = (Math.random() * 255) | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  x.putImageData(d, 0, 0); g.style.backgroundImage = `url(${t.toDataURL()})`; g.style.width = '200%'; g.style.height = '200%';
}

/* custom cursor with an optional label */
export function cursor() {
  const ce = document.getElementById('cur'); if (!ce || !FINE) return { label: (_: string) => {} };
  let cx = -100, cy = -100, tx = -100, ty = -100;
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; ce.classList.add('live'); tx = e.clientX; ty = e.clientY; });
  (function tick() { requestAnimationFrame(tick); cx += (tx - cx) * .2; cy += (ty - cy) * .2; ce.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`; })();
  const span = ce.querySelector('span');
  return { label(t: string) { if (studio.cursor === 'dot') t = ''; ce.classList.toggle('lab', !!t); if (t && span) span.textContent = t; fx?.hidden(!!t); } };
}

/* ---- import safety: only known keys and values are ever accepted from a shared code or file ---- */
const SHAPES = ['dot', 'ring', 'ringdot', 'cross', 'plus', 'square', 'diamond', 'tri', 'hex', 'star', 'bracket', 'blob', 'beam', 'glyph', 'orbit', 'reticle'];
const TRAILS = ['none', 'line', 'ribbon', 'dots', 'particles', 'sparks', 'ghost', 'comet', 'constellation', 'rise', 'fall'];
const CLICKS = ['none', 'ripple', 'burst', 'shrink', 'rings'];
const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
export function sanitize(o: unknown): Partial<Studio> | null {
  if (!o || typeof o !== 'object') return null;
  const i = o as Record<string, unknown>, out: Partial<Studio> = {};
  if (typeof i.theme === 'string' && theme(i.theme).id === i.theme) out.theme = i.theme;
  if (typeof i.type === 'string' && (i.type === 'auto' || i.type in TYPE)) out.type = i.type;
  if (typeof i.mood === 'string' && ['natural', 'noir', 'dusk', 'arctic', 'neon'].includes(i.mood)) out.mood = i.mood as Mood;
  if (i.motion === 'full' || i.motion === 'calm') out.motion = i.motion;
  if (i.grain === 'on' || i.grain === 'off') out.grain = i.grain;
  if (i.scale !== undefined) out.scale = Math.round(num(i.scale, 90, 130, 100) / 5) * 5;
  if (typeof i.cursor === 'string' && (['lens', 'dot', 'native', 'custom'].includes(i.cursor) || cursorById(i.cursor))) out.cursor = i.cursor;
  if (i.cc && typeof i.cc === 'object') {
    const c = i.cc as Record<string, unknown>;
    if (typeof c.s === 'string' && SHAPES.includes(c.s)) {
      out.cc = { s: c.s as CursorSpec['s'], z: num(c.z, 4, 90, 24), w: num(c.w, .5, 10, 1.6), l: num(c.l, .02, 1, .3), o: num(c.o, 0, .9, 0), r: num(c.r, 0, 8, 0), n: num(c.n, 1, 80, 26), h: num(c.h, 1, 3, 1.6),
        f: !!c.f, b: c.b === 'd' ? 'd' : 'n', t: (typeof c.t === 'string' && TRAILS.includes(c.t) ? c.t : 'none') as CursorSpec['t'], k: (typeof c.k === 'string' && CLICKS.includes(c.k) ? c.k : 'ripple') as CursorSpec['k'],
        c: typeof c.c === 'string' && (['signal', 'bone', 'rainbow'].includes(c.c) || HEX.test(c.c)) ? c.c : 'signal' };
    }
  }
  if (out.cursor === 'custom' && !out.cc) delete out.cursor;
  /* home Studio preview photo: picture, side, size */
  const X = out as Record<string, unknown>;
  if (typeof i.fpic === 'string' && ['castle-mist', 'aurora', 'coast', 'city-dawn', 'forest-mist'].includes(i.fpic)) X.fpic = i.fpic;
  if (i.fside === 'l' || i.fside === 'r') X.fside = i.fside;
  if (i.fzoom === 's' || i.fzoom === 'm' || i.fzoom === 'l') X.fzoom = i.fzoom;
  return out;
}
export function encodeStudio(s: Studio): string {
  const o: Record<string, unknown> = { theme: s.theme, type: s.type, mood: s.mood, motion: s.motion, grain: s.grain, scale: s.scale, cursor: s.cursor };
  if (s.cursor === 'custom' && s.cc) o.cc = s.cc;
  let bin = ''; new TextEncoder().encode(JSON.stringify(o)).forEach((c) => { bin += String.fromCharCode(c); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeStudio(code: string): Partial<Studio> | null {
  try { const b = code.trim().replace(/-/g, '+').replace(/_/g, '/'); if (b.length > 4000) return null; const bin = atob(b); return sanitize(JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))))); } catch { return null; }
}

/* ---- saved worlds (favourites), shared by world pages and the Studio ---- */
export function favs(): number[] { try { const a = JSON.parse(localStorage.getItem('abidora.favs') ?? '[]'); return Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n > 0 && n < 1000) : []; } catch { return []; } }
export function setFav(id: number, on: boolean) { const f = favs().filter((n) => n !== id); if (on) f.unshift(id); try { localStorage.setItem('abidora.favs', JSON.stringify(f.slice(0, 200))); } catch { /* ignore */ } }

/* whatever was stored is re-validated once, so a damaged or hand-edited setting can never break a page */
Object.assign(studio, { ...DEFAULTS, ...(sanitize(studio) ?? {}) });
