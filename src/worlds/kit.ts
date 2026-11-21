/* Shared toolkit for Abidora worlds: DOM builder, panel controls, a DPR-aware canvas,
   a frame loop that sleeps when hidden, seeded randomness, noise and small helpers.
   Each world module exports `default (ctx: Ctx) => void | (() => void)`. */

export interface Ctx {
  id: number;
  root: HTMLElement;
  /** world UI string: translated when a `wi.<id>.<key>` entry exists, English otherwise */
  t: (key: string, en: string) => string;
  calm: boolean;
  lang: string;
  rtl: boolean;
  onDispose: (f: () => void) => void;
}

type Kid = Node | string | null | undefined | false;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (k === 'text') e.textContent = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v as EventListener);
    else if (k in e && typeof v !== 'string') (e as unknown as Record<string, unknown>)[k] = v;
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
export const svgNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...kids: (Node | null)[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  for (const c of kids) if (c) e.append(c);
  return e;
}

/* ---------- layout ---------- */
export function layout(ctx: Ctx, opts: { panelFirst?: boolean } = {}) {
  const view = h('div', { class: 'wk-v' }), panel = h('div', { class: 'wk-p' });
  const hud = h('div', { class: 'wk-hud', 'aria-live': 'polite' });
  view.append(hud);
  const wrap = h('div', { class: 'wk' }, view, panel);
  if (opts.panelFirst) wrap.classList.add('pf');
  ctx.root.append(wrap);
  setTimeout(() => tidyPanel(panel), 0);
  return { wrap, view, panel, hud };
}
/* 0.9.6 (owner, 21 Nov: "keep only the options that are really needed"): the first two control groups stay in view;
   later groups and long explanations move into one closed "More options" box. Nothing is removed. */
function tidyPanel(panel: HTMLElement) {
  if (panel.querySelector('.wk-more, [role=tablist]')) return;
  const kids = [...panel.children] as HTMLElement[];
  const heads = kids.filter((k) => k.tagName === 'H2');
  const longNotes = kids.filter((k) => k.classList.contains('wk-note') && (k.textContent ?? '').length > 140);
  const ctl = kids.filter((k) => !/^H2$/.test(k.tagName) && !k.classList.contains('wk-note') && k.querySelector('input,button,select'));
  const c5 = ctl.length > 5 ? kids.indexOf(ctl[4]) + 1 : kids.length;
  const cut = Math.min(heads.length >= 3 ? kids.indexOf(heads[2]) : kids.length, c5); if (cut >= kids.length && !longNotes.length) return;
  const move = kids.filter((k, i) => i >= cut || longNotes.includes(k));
  if (!move.length) return;
  const box = more(panel); box.append(...move);
}

/* ---------- controls ---------- */
let uid = 0;
const nid = () => 'wk' + (++uid);
/* 0.9.6 (owner: show only what is really needed): a closed "More options" box for the extra controls */
export function more(p: HTMLElement) {
  const v = (globalThis as { I18N_BOOT?: { dict?: Record<string, string> } }).I18N_BOOT?.dict?.['s3.more'];
  const d = h('details', { class: 'wk-more' }, h('summary', { text: v || 'More options' })); p.append(d); return d as HTMLElement;
}
export function heading(p: HTMLElement, text: string) { const e = h('h2', { text }); p.append(e); return e; }
export function note(p: HTMLElement, text: string) { const e = h('p', { class: 'wk-note', text }); p.append(e); return e; }
export function range(p: HTMLElement, label: string, o: { min: number; max: number; step?: number; value: number; fmt?: (v: number) => string }, on: (v: number) => void) {
  const id = nid(); const out = h('output', { for: id });
  const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step ?? 1 }) as HTMLInputElement; inp.value = String(o.value);
  const fmt = o.fmt ?? ((v: number) => String(v));
  const upd = () => { out.textContent = fmt(+inp.value); };
  inp.addEventListener('input', () => { upd(); on(+inp.value); }); upd();
  p.append(h('label', { class: 'wk-r', for: id }, h('span', {}, h('span', { text: label }), out), inp));
  return { input: inp, set(v: number, fire = false) { inp.value = String(v); upd(); if (fire) on(v); } };
}
export function select(p: HTMLElement, label: string, opts: [string, string][], value: string, on: (v: string) => void) {
  const id = nid(); const sel = h('select', { id }) as HTMLSelectElement;
  for (const [v, t] of opts) sel.append(h('option', { value: v, text: t }));
  sel.value = value; sel.addEventListener('change', () => on(sel.value));
  p.append(h('label', { class: 'wk-r', for: id }, h('span', { text: label }), sel));
  return sel;
}
export function seg(p: HTMLElement, label: string, opts: [string, string][], value: string, on: (v: string) => void) {
  const box = h('div', { class: 'wk-seg', role: 'group', 'aria-label': label });
  const btns = opts.map(([v, t]) => h('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === value), text: t, onclick: () => { set(v); on(v); } }));
  const set = (v: string) => btns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
  box.append(...btns);
  p.append(h('div', { class: 'wk-r' }, h('span', { text: label }), box));
  return { set, box };
}
export function color(p: HTMLElement, label: string, value: string, on: (v: string) => void) {
  const id = nid(); const inp = h('input', { type: 'color', id }) as HTMLInputElement; inp.value = value;
  inp.addEventListener('input', () => on(inp.value));
  p.append(h('label', { class: 'wk-r', for: id }, h('span', { text: label }), inp));
  return inp;
}
export function check(p: HTMLElement, label: string, value: boolean, on: (v: boolean) => void) {
  const inp = h('input', { type: 'checkbox' }) as HTMLInputElement; inp.checked = value;
  inp.addEventListener('change', () => on(inp.checked));
  p.append(h('label', { class: 'wk-chk' }, inp, h('span', { text: label })));
  return inp;
}
export function buttons(p: HTMLElement, list: [string, () => void, boolean?][]) {
  const row = h('div', { class: 'wk-row' });
  const bs = list.map(([t, f, pri]) => h('button', { type: 'button', class: 'wk-b' + (pri ? ' pri' : ''), text: t, onclick: f }));
  row.append(...bs); p.append(row); return bs;
}
export function stats(p: HTMLElement, list: [string, string][]) {
  const dl = h('dl', { class: 'wk-stat' }); const dd: Record<string, HTMLElement> = {};
  for (const [k, l] of list) { dd[k] = h('dd', { text: '—' }); dl.append(h('div', {}, h('dt', { text: l }), dd[k])); }
  p.append(dl);
  return (k: string, v: string) => { if (dd[k]) dd[k].textContent = v; };
}

/* ---------- canvas ---------- */
export interface Surface { cv: HTMLCanvasElement; g: CanvasRenderingContext2D; w: number; h: number; dpr: number; onResize: (f: () => void) => void }
export function canvas(parent: HTMLElement, label = '', opts: { maxDpr?: number; alpha?: boolean } = {}): Surface {
  const cv = h('canvas', { role: 'img', 'aria-label': label, tabindex: 0 }) as HTMLCanvasElement;
  parent.prepend(cv);
  const g = cv.getContext('2d', { alpha: opts.alpha ?? true })!;
  const S: Surface = { cv, g, w: 1, h: 1, dpr: 1, onResize: (f) => { cbs.push(f); } };
  const cbs: (() => void)[] = [];
  const fit = () => {
    const r = cv.getBoundingClientRect(); const d = Math.min(opts.maxDpr ?? 2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    if (w === S.w && hh === S.h && d === S.dpr) return;
    /* resizing a canvas wipes it; keep the last picture on screen until the world draws the next frame, so a layout change never flashes black */
    let keep: HTMLCanvasElement | null = null;
    if (opts.alpha === false && S.w > 1 && S.h > 1 && cv.width > 1) { try { keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height; keep.getContext('2d')!.drawImage(cv, 0, 0); } catch { keep = null; } }
    S.w = w; S.h = hh; S.dpr = d; cv.width = Math.round(w * d); cv.height = Math.round(hh * d);
    if (keep) { g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(keep, 0, 0); }
    g.setTransform(d, 0, 0, d, 0, 0); cbs.forEach((f) => f());
  };
  new ResizeObserver(fit).observe(cv); fit();
  return S;
}
/** pointer position in CSS px relative to the element */
export function local(e: PointerEvent | MouseEvent, el: Element) { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

/* ---------- frame loop: pauses when the tab is hidden or the stage is off screen ---------- */
export function loop(ctx: Ctx, el: Element, fn: (dt: number, t: number) => void) {
  let raf = 0, last = 0, vis = true, on = true;
  const tick = (now: number) => { raf = 0; const dt = Math.min(.05, last ? (now - last) / 1000 : 1 / 60); last = now; fn(dt, now / 1000); go(); };
  const go = () => { if (!raf && on && vis && !document.hidden) raf = requestAnimationFrame(tick); else if (!raf) last = 0; };
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; go(); }); io.observe(el);
  const vc = () => go(); document.addEventListener('visibilitychange', vc);
  ctx.onDispose(() => { on = false; cancelAnimationFrame(raf); io.disconnect(); document.removeEventListener('visibilitychange', vc); });
  go();
  return { pause() { on = false; cancelAnimationFrame(raf); raf = 0; last = 0; }, play() { on = true; go(); }, get running() { return on; }, kick: go };
}

/* ---------- maths ---------- */
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function rng(seed = Date.now()) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** 2D gradient noise in about [-1, 1] */
export function noise2(seed = 1) {
  const r = rng(seed), p = new Uint8Array(512), perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const gr = (h: number, x: number, y: number) => { const a = (h & 7) * Math.PI / 4; return Math.cos(a) * x + Math.sin(a) * y; };
  const f = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const X = Math.floor(x), Y = Math.floor(y), xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255;
    const u = f(xf), v = f(yf);
    const n00 = gr(p[p[xi] + yi], xf, yf), n10 = gr(p[p[xi + 1] + yi], xf - 1, yf), n01 = gr(p[p[xi] + yi + 1], xf, yf - 1), n11 = gr(p[p[xi + 1] + yi + 1], xf - 1, yf - 1);
    return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v) * 1.41;
  };
}

/* ---------- colour ---------- */
export function hex2rgb(h: string): [number, number, number] { const m = h.replace('#', ''); const n = parseInt(m.length === 3 ? m.replace(/./g, '$&$&') : m, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgb2hex(r: number, g: number, b: number) { return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
export function hsl2hex(h: number, s: number, l: number) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgb2hex(f(0) * 255, f(8) * 255, f(4) * 255);
}
export function hex2hsl(hx: string): [number, number, number] {
  const [r, g, b] = hex2rgb(hx).map((v) => v / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let hh = 0, ss = 0;
  if (mx !== mn) { const d = mx - mn; ss = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hh *= 60; }
  return [hh, ss * 100, l * 100];
}
export function shade(hx: string, k: number) { const [r, g, b] = hex2rgb(hx); return k >= 0 ? rgb2hex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : rgb2hex(r * (1 + k), g * (1 + k), b * (1 + k)); }
export function lum(hx: string) { const f = (c: number) => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }; const [r, g, b] = hex2rgb(hx); return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); }
export function contrast(a: string, b: string) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export const cssVar = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* ---------- storage + files ---------- */
export function store<T>(id: number, key: string, def: T, ok: (v: unknown) => boolean = () => true) {
  const k = `abidora.w${id}.${key}`;
  return {
    get(): T { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null'); return v !== null && ok(v) ? v as T : def; } catch { return def; } },
    set(v: T) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
}
export function download(data: Blob | HTMLCanvasElement, name: string) {
  const save = (b: Blob | null) => { if (!b) return; const a = h('a', { href: URL.createObjectURL(b), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); };
  if (data instanceof HTMLCanvasElement) data.toBlob(save, 'image/png'); else save(data);
}
export function svgBlob(svg: SVGSVGElement) { return new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }); }

/* ---------- showroom stage (fashion worlds) ----------
   A dark gallery stage: a lamp from above, a turntable disc, an optional mirror reflection of an SVG piece,
   three light moods, and zoom + pan on an SVG through its viewBox (wheel, pinch, buttons, drag; double-click resets). */
export type Light = 'cool' | 'warm' | 'gallery';
export function showroom(view: HTMLElement, o: { disc?: boolean; light?: Light } = {}) {
  view.classList.add('wk-show'); view.dataset.light = o.light ?? 'warm';
  const lamp = h('div', { class: 'wk-lamp', 'aria-hidden': 'true' });
  view.prepend(lamp);
  if (o.disc !== false) view.append(h('div', { class: 'wk-disc', 'aria-hidden': 'true' }));
  return { setLight(l: Light) { view.dataset.light = l; } };
}
export function lightSeg(p: HTMLElement, label: string, names: Record<Light, string>, value: Light, on: (l: Light) => void) {
  return seg(p, label, (['cool', 'warm', 'gallery'] as Light[]).map((l) => [l, names[l]]), value, (v) => on(v as Light));
}
export function zoomable(sv: SVGSVGElement, base: [number, number, number, number], o: { max?: number; onChange?: (z: number) => void } = {}) {
  const max = o.max ?? 4; let z = 1, cx = base[0] + base[2] / 2, cy = base[1] + base[3] / 2;
  const apply = () => {
    z = clamp(z, 1, max); const w = base[2] / z, hh = base[3] / z;
    cx = clamp(cx, base[0] + w / 2, base[0] + base[2] - w / 2); cy = clamp(cy, base[1] + hh / 2, base[1] + base[3] - hh / 2);
    sv.setAttribute('viewBox', `${cx - w / 2} ${cy - hh / 2} ${w} ${hh}`); sv.style.cursor = z > 1 ? 'grab' : ''; o.onChange?.(z);
  };
  const toSvg = (x: number, y: number) => { const r = sv.getBoundingClientRect(); const vb = sv.viewBox.baseVal; const k = Math.max(vb.width / r.width, vb.height / r.height); return { x: vb.x + (x - r.left - (r.width - vb.width / k) / 2) * k, y: vb.y + (y - r.top - (r.height - vb.height / k) / 2) * k }; };
  const zoomAt = (f: number, px?: number, py?: number) => {
    if (px !== undefined && py !== undefined) { const p = toSvg(px, py); const nz = clamp(z * f, 1, max); const k = z / nz; cx = p.x + (cx - p.x) * k; cy = p.y + (cy - p.y) * k; z = nz; } else z *= f;
    apply();
  };
  sv.addEventListener('wheel', (e) => { if (!e.ctrlKey && z === 1 && e.deltaY > 0) return; e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY); }, { passive: false });
  const pts = new Map<number, { x: number; y: number }>(); let moved = 0, pinch0 = 0;
  sv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  sv.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) { zoomAt(d / pinch0, (a.x + b.x) / 2, (a.y + b.y) / 2); } pinch0 = d; moved = 99; return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
    if (z > 1) { const r = sv.getBoundingClientRect(); const k = (base[2] / z) / r.width; cx -= dx * k; cy -= dy * k; apply(); }
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  sv.addEventListener('pointerup', up); sv.addEventListener('pointercancel', up);
  sv.addEventListener('click', (e) => { if (moved > 8) { e.stopPropagation(); e.preventDefault(); } }, true);   // a drag is not a click on a part
  sv.addEventListener('dblclick', () => { z = 1; apply(); });
  sv.style.touchAction = 'pan-y';
  apply();
  return { in: () => zoomAt(1.4), out: () => zoomAt(1 / 1.4), reset: () => { z = 1; apply(); }, get z() { return z; }, dragged: () => moved > 8 };
}
