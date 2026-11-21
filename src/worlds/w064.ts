/* 064 Future Interfaces. An input lab: new ways of talking to computers are invented all the time, and
   two classic research tools are used to build and judge them. Both run here for real, on your own hand.
   · Gesture commands: a sketch-to-shape canvas driven by the $1 Unistroke Recognizer (Wobbrock, Wilson
     and Li, 2007). Draw a circle, triangle, rectangle or star and it becomes a clean shape; a check mark
     fills the last shape; a scribble deletes the shape under it. You can teach it gestures of your own.
   · Pointing test: a Fitts's law experiment (Fitts, 1954). Hit targets of different sizes and distances;
     the world fits movement time = a + b·log2(D/W + 1) to your own trials and reports your throughput in
     bits per second, so you can compare mouse, touch and pen. */
import { type Ctx, h, layout, canvas, heading, note, seg, stats, buttons, local, loop, clamp, store, rng } from './kit';

/* ---------- $1 Unistroke Recognizer ---------- */
export interface Pt { x: number; y: number }
export const N = 64, SQ = 250, HALF_DIAG = .5 * Math.hypot(SQ, SQ), A_RANGE = Math.PI / 4, A_PREC = Math.PI / 90, PHI = .5 * (-1 + Math.sqrt(5));
export const pathLen = (p: Pt[]) => { let d = 0; for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y); return d; };
export function resample(pts: Pt[], n = N): Pt[] {
  const I = pathLen(pts) / (n - 1), src = pts.map((p) => ({ ...p })), out: Pt[] = [{ ...src[0] }]; let D = 0;
  if (I === 0) return Array.from({ length: n }, () => ({ ...src[0] }));
  for (let i = 1; i < src.length; i++) {
    const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
    if (D + d >= I) { const q = { x: src[i - 1].x + ((I - D) / d) * (src[i].x - src[i - 1].x), y: src[i - 1].y + ((I - D) / d) * (src[i].y - src[i - 1].y) }; out.push(q); src.splice(i, 0, q); D = 0; }
    else D += d;
  }
  while (out.length < n) out.push({ ...src[src.length - 1] });
  return out.slice(0, n);
}
export const centroid = (p: Pt[]) => { let x = 0, y = 0; for (const q of p) { x += q.x; y += q.y; } return { x: x / p.length, y: y / p.length }; };
export function rotateBy(p: Pt[], a: number): Pt[] { const c = centroid(p), co = Math.cos(a), si = Math.sin(a); return p.map((q) => ({ x: (q.x - c.x) * co - (q.y - c.y) * si + c.x, y: (q.x - c.x) * si + (q.y - c.y) * co + c.y })); }
export function bbox(p: Pt[]) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const q of p) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
export function scaleTo(p: Pt[], s = SQ): Pt[] { const b = bbox(p); return p.map((q) => ({ x: q.x * (s / (b.w || 1)), y: q.y * (s / (b.h || 1)) })); }
export function translateToOrigin(p: Pt[]): Pt[] { const c = centroid(p); return p.map((q) => ({ x: q.x - c.x, y: q.y - c.y })); }
/** the full $1 normalisation: resample, rotate so the start points along +x from the centroid, scale to a square, centre */
export function normalise(raw: Pt[]): Pt[] { const r = resample(raw); const c = centroid(r); return translateToOrigin(scaleTo(rotateBy(r, -Math.atan2(c.y - r[0].y, c.x - r[0].x)))); }
const pathDist = (a: Pt[], b: Pt[]) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y); return d / a.length; };
/** golden-section search for the rotation that best matches the template */
export function distAtBestAngle(p: Pt[], t: Pt[], a = -A_RANGE, b = A_RANGE) {
  let x1 = PHI * a + (1 - PHI) * b, f1 = pathDist(rotateBy(p, x1), t), x2 = (1 - PHI) * a + PHI * b, f2 = pathDist(rotateBy(p, x2), t);
  while (Math.abs(b - a) > A_PREC) {
    if (f1 < f2) { b = x2; x2 = x1; f2 = f1; x1 = PHI * a + (1 - PHI) * b; f1 = pathDist(rotateBy(p, x1), t); }
    else { a = x1; x1 = x2; f1 = f2; x2 = (1 - PHI) * a + PHI * b; f2 = pathDist(rotateBy(p, x2), t); }
  }
  return Math.min(f1, f2);
}
export interface Tpl { name: string; pts: Pt[]; own?: boolean }
export const makeTpl = (name: string, raw: Pt[], own = false): Tpl => ({ name, pts: normalise(raw), own });
/** score is 1 − distance / (half the diagonal of the reference square), as in the paper */
export function recognise(raw: Pt[], tpls: Tpl[]) {
  const p = normalise(raw);
  const best = new Map<string, number>();
  for (const t of tpls) { const d = distAtBestAngle(p, t.pts), sc = 1 - d / HALF_DIAG; if (!best.has(t.name) || sc > best.get(t.name)!) best.set(t.name, sc); }
  return [...best].map(([name, score]) => ({ name, score })).sort((a, b) => b.score - a.score);
}
/* built-in gesture shapes, drawn as polylines in a unit box (y down), each also stored reversed so either drawing direction works */
const poly = (...xy: number[]) => { const o: Pt[] = []; for (let i = 0; i < xy.length; i += 2) o.push({ x: xy[i], y: xy[i + 1] }); return o; };
const dense = (p: Pt[], k = 8) => { const o: Pt[] = []; for (let i = 0; i < p.length - 1; i++) for (let j = 0; j < k; j++) o.push({ x: p[i].x + (p[i + 1].x - p[i].x) * j / k, y: p[i].y + (p[i + 1].y - p[i].y) * j / k }); o.push(p[p.length - 1]); return o; };
const ring = (a0: number, dir: number) => Array.from({ length: 41 }, (_, i) => { const a = a0 + dir * i / 40 * Math.PI * 2; return { x: .5 + .5 * Math.cos(a), y: .5 + .5 * Math.sin(a) }; });
const starPts = () => { const o: Pt[] = []; for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; o.push({ x: .5 + .5 * Math.cos(a), y: .5 + .5 * Math.sin(a) }); } return o; };
export const SHAPES = ['circle', 'triangle', 'rectangle', 'star', 'check', 'scribble'] as const;
export function builtIns(): Tpl[] {
  const out: Tpl[] = [];
  const add = (name: string, p: Pt[]) => { out.push(makeTpl(name, p)); out.push(makeTpl(name, [...p].reverse())); };
  add('circle', ring(-Math.PI / 2, 1)); add('circle', ring(Math.PI, 1));
  add('triangle', dense(poly(.5, 0, 1, 1, 0, 1, .5, 0))); add('triangle', dense(poly(0, 1, .5, 0, 1, 1, 0, 1)));
  add('rectangle', dense(poly(0, 0, 1, 0, 1, .7, 0, .7, 0, 0))); add('rectangle', dense(poly(0, 0, 0, .7, 1, .7, 1, 0, 0, 0)));
  add('star', dense(starPts()));
  out.push(makeTpl('check', dense(poly(0, .55, .32, 1, 1, 0))));
  for (let k = 3; k <= 8; k++) for (const ph of [0, 1]) { const z: number[] = []; for (let i = 0; i <= k; i++) z.push(i / k, (i + ph) % 2); add('scribble', dense(poly(...z))); } /* zig-zags with 3 to 8 strokes */
  return out;
}

/* ---------- Fitts's law ---------- */
export const fittsID = (D: number, W: number) => Math.log2(D / W + 1);
export interface Trial { D: number; W: number; mt: number; miss: number }
/** least-squares fit of movement time (ms) against index of difficulty (bits) */
export function fitts(trials: Trial[]) {
  const n = trials.length; if (n < 2) return null;
  const X = trials.map((t) => fittsID(t.D, t.W)), Y = trials.map((t) => t.mt), mx = X.reduce((a, b) => a + b, 0) / n, my = Y.reduce((a, b) => a + b, 0) / n;
  let sxx = 0, sxy = 0, syy = 0; for (let i = 0; i < n; i++) { sxx += (X[i] - mx) ** 2; sxy += (X[i] - mx) * (Y[i] - my); syy += (Y[i] - my) ** 2; }
  const b = sxx ? sxy / sxx : 0, a = my - b * mx, r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  const tp = X.reduce((s, x, i) => s + x / (Y[i] / 1000), 0) / n; /* mean of ID / MT, in bits per second */
  return { a, b, r2, tp, n };
}
/** a balanced, shuffled plan: every distance × width pair twice */
export function plan(seed: number, Ds: number[], Ws: number[]) { const R = rng(seed), o: { D: number; W: number }[] = []; for (const D of Ds) for (const W of Ws) o.push({ D, W }, { D, W }); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.classList.add('w64');
  L.view.style.minHeight = 'clamp(440px, 62vw, 660px)';
  const S = canvas(L.view, t('cv', 'An input lab: draw gestures that become shapes, or hit targets to measure your pointing speed.'), { alpha: false });
  type Shape = { kind: string; x: number; y: number; w: number; h: number; fill: boolean; born: number };
  type Cfg = { mode: 'gest' | 'fitts' };
  const st = store<Cfg>(ctx.id, 'cfg', { mode: 'gest' }, (v) => typeof v === 'object' && v !== null && 'mode' in v);
  const cfg: Cfg = { ...{ mode: 'gest' as Cfg['mode'] }, ...st.get() };
  const own = store<{ name: string; raw: Pt[] }[]>(ctx.id, 'own', [], (v) => Array.isArray(v));
  const runs = store<{ dev: string; tp: number; b: number; a: number; r2: number; n: number }[]>(ctx.id, 'runs', [], (v) => Array.isArray(v));
  const BASE = builtIns();
  let tpls: Tpl[] = [...BASE, ...own.get().map((o) => makeTpl(o.name, o.raw, true))];
  const NAME: Record<string, string> = { circle: t('g.circle', 'Circle'), triangle: t('g.triangle', 'Triangle'), rectangle: t('g.rectangle', 'Rectangle'), star: t('g.star', 'Star'), check: t('g.check', 'Check mark'), scribble: t('g.scribble', 'Scribble') };
  const nm = (k: string) => NAME[k] ?? k;
  const C = { bg: '#0b1220', grid: 'rgba(120,200,255,.07)', ink: '#e6f1ff', mute: '#8aa0bd', cyan: '#4fe3d1', pink: '#ff6fa8', gold: '#ffd166', lilac: '#a99bff' };
  const COL: Record<string, string> = { circle: C.cyan, triangle: C.gold, rectangle: C.lilac, star: C.pink };

  heading(L.panel, t('h', 'Input lab'));
  seg(L.panel, t('mode', 'Experiment'), [['gest', t('m.g', 'Gesture commands')], ['fitts', t('m.f', 'Pointing test')]], cfg.mode, (v) => { cfg.mode = v as Cfg['mode']; st.set(cfg); build(); lp.play(); });
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };

  /* ---------- gesture state ---------- */
  let nameIn: HTMLInputElement | null = null;
  let stroke: Pt[] = [], drawing = false, shapes: Shape[] = [], lastRes: { name: string; score: number }[] = [], lastRaw: Pt[] = [], flash = 0, msg = '';
  const MIN = .78;
  const shapeAt = (x: number, y: number) => { for (let i = shapes.length - 1; i >= 0; i--) { const s = shapes[i]; if (x >= s.x - 10 && x <= s.x + s.w + 10 && y >= s.y - 10 && y <= s.y + s.h + 10) return i; } return -1; };
  function act(raw: Pt[]) {
    const b = bbox(raw);
    if (pathLen(raw) < 30 || raw.length < 6) { msg = t('short', 'Too short: draw a bigger gesture.'); return; }
    lastRes = recognise(raw, tpls).slice(0, 3); lastRaw = raw;
    const top = lastRes[0];
    if (!top || top.score < MIN) { msg = `${t('unsure', 'Not sure what that was')} (${top ? nm(top.name) + ' ' + Math.round(top.score * 100) + '%' : '—'}). ${t('unsure2', 'Try again, or teach it as a new gesture.')}`; return; }
    const k = top.name, now = performance.now();
    if (k === 'scribble') { const c = centroid(raw), i = shapeAt(c.x, c.y), j = i >= 0 ? i : shapes.length - 1; if (j >= 0) { shapes.splice(j, 1); msg = t('del', 'Scribble: deleted a shape.'); } else msg = t('nothing', 'Scribble: nothing to delete.'); }
    else if (k === 'check') { const s = shapes[shapes.length - 1]; if (s) { s.fill = !s.fill; msg = t('fill', 'Check mark: filled the last shape.'); } else msg = t('nothing2', 'Check mark: draw a shape first.'); }
    else if (k in COL) { const sz = Math.max(b.w, b.h) < 24 ? 40 : 0; shapes.push({ kind: k, x: b.x - sz / 2, y: b.y - sz / 2, w: Math.max(b.w, 24) + sz, h: Math.max(b.h, 24) + sz, fill: false, born: now }); if (shapes.length > 40) shapes.shift(); msg = `${nm(k)} ${Math.round(top.score * 100)}%`; }
    else { shapes.push({ kind: 'tag:' + k, x: b.x, y: b.y, w: Math.max(80, b.w), h: Math.max(30, b.h), fill: false, born: now }); msg = `${t('owng', 'Your gesture')}: ${k} ${Math.round(top.score * 100)}%`; }
    flash = 1;
  }
  function teach() {
    if (lastRaw.length < 6) { L.hud.textContent = t('teach0', 'Draw the gesture first, then teach it.'); return; }
    const name = (nameIn?.value || '').trim().slice(0, 16);
    if (!name) { L.hud.textContent = t('teachq', 'Type a name for the gesture first (for example: heart, arrow, spiral).'); nameIn?.focus(); return; }
    const list = own.get(); list.push({ name, raw: resample(lastRaw, 48).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })) }); if (list.length > 30) list.shift(); own.set(list);
    tpls = [...BASE, ...list.map((o) => makeTpl(o.name, o.raw, true))];
    msg = `${t('taught', 'Learned')}: ${name}. ${t('taught2', 'Draw it again and it will be recognised.')}`; build(); lp.play();
  }

  /* ---------- Fitts state ---------- */
  type Phase = 'idle' | 'home' | 'target' | 'done';
  let phase: Phase = 'idle', trials: Trial[] = [], seq: { D: number; W: number }[] = [], cur = 0, home = { x: 0, y: 0 }, tgt = { x: 0, y: 0, w: 0 }, t0 = 0, misses = 0, dev = '', ripple: { x: number; y: number; t: number; ok: boolean }[] = [];
  const geo = () => { const W = S.w, H = S.h, wide = W > 720, aw = wide ? W * .58 : W, ah = wide ? H : H * .62; return { wide, aw, ah, m: Math.min(aw, ah) }; };
  function startRun() {
    const G = geo(), Ds = [.18, .32, .46].map((f) => Math.round(G.m * f * 1.4)), Ws = [14, 28, 56];
    seq = plan(Date.now() & 0xffff, Ds, Ws); trials = []; cur = 0; misses = 0; phase = 'home'; dev = ''; placeHome(); build(); lp.play();
  }
  function placeHome() { const G = geo(); home = { x: G.aw / 2, y: G.ah / 2 }; }
  function placeTarget() {
    const G = geo(), { D, W } = seq[cur], R = Math.random;
    for (let k = 0; k < 40; k++) { const a = R() * Math.PI * 2, x = home.x + D * Math.cos(a), y = home.y + D * Math.sin(a); if (x > W && y > W && x < G.aw - W && y < G.ah - W) { tgt = { x, y, w: W }; return; } }
    tgt = { x: clamp(home.x + D, W, G.aw - W), y: home.y, w: W }; /* fallback: straight right, clamped */
  }

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.mode === 'gest') {
      about.textContent = t('a.g', 'Draw one stroke on the canvas. A circle, triangle, rectangle or star becomes a clean shape where you drew it. A check mark fills the last shape. A scribble over a shape deletes it. The recogniser compares your stroke with stored examples after resampling it to 64 points and turning, scaling and centring it, so size, position and drawing speed do not matter.');
      nameIn = h('input', { type: 'text', maxLength: 16, placeholder: t('ph', 'heart, arrow, spiral…') }) as HTMLInputElement;
      box.append(h('label', { class: 'wk-r' }, h('span', { text: t('newname', 'Name for a new gesture') }), nameIn));
      buttons(box, [[t('teach', 'Teach the last stroke as this gesture'), teach, true], [t('clear', 'Clear the canvas'), () => { shapes = []; msg = ''; lp.play(); }]]);
      const mine = own.get();
      if (mine.length) {
        const ul = h('ul', { class: 'w64-own' });
        mine.forEach((o, i) => ul.append(h('li', {}, h('span', { text: o.name }), h('button', { type: 'button', class: 'wk-b', text: t('forget', 'Forget'), 'aria-label': `${t('forget', 'Forget')} ${o.name}`, onclick: () => { const l = own.get(); l.splice(i, 1); own.set(l); tpls = [...BASE, ...l.map((q) => makeTpl(q.name, q.raw, true))]; build(); lp.play(); } }))));
        box.append(h('p', { class: 'w64-t', text: t('yours', 'Your gestures') }), ul);
      }
      lab(t('st.top', 'Recognised'), t('st.2', 'Second guess'), t('st.n', 'Shapes on canvas'));
      return;
    }
    about.textContent = t('a.f', 'Every new input device, from the mouse to touch screens and eye tracking, is compared with a Fitts\'s law test. Tap the ring in the middle, then the target as fast as you can while staying accurate. 18 trials mix three distances and three sizes. The world fits time = a + b × difficulty, where difficulty = log2(distance / width + 1) bits, and reports your throughput.');
    buttons(box, [[phase === 'home' || phase === 'target' ? t('restart', 'Restart the test') : t('start', 'Start the test'), startRun, true]]);
    const prev = runs.get();
    if (prev.length) {
      const ul = h('ul', { class: 'w64-own' });
      prev.slice(-5).reverse().forEach((r) => ul.append(h('li', {}, h('span', { text: `${r.dev}: ${r.tp.toFixed(2)} ${t('bps', 'bits/s')}` }), h('span', { class: 'w64-m', text: `b = ${Math.round(r.b)} ms/bit · R² ${r.r2.toFixed(2)}` }))));
      box.append(h('p', { class: 'w64-t', text: t('prev', 'Your earlier runs (this browser)') }), ul);
      buttons(box, [[t('clearruns', 'Delete earlier runs'), () => { runs.set([]); build(); }]]);
    }
    lab(t('st.trial', 'Trial'), t('st.tp', 'Throughput'), t('st.fit', 'Fit'));
  }

  /* ---------- drawing ---------- */
  function bgGrid(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H); g.strokeStyle = C.grid; g.lineWidth = 1;
    for (let x = 0; x < W; x += 32) { g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
    for (let y = 0; y < H; y += 32) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
  }
  function drawShape(g: CanvasRenderingContext2D, s: Shape, now: number) {
    const k = clamp((now - s.born) / 260, 0, 1), e = 1 - (1 - k) ** 3, cx = s.x + s.w / 2, cy = s.y + s.h / 2, w = s.w * (.85 + .15 * e), hh = s.h * (.85 + .15 * e);
    g.save(); g.globalAlpha = .35 + .65 * e; g.lineWidth = 3; g.lineJoin = 'round';
    if (s.kind.startsWith('tag:')) {
      g.strokeStyle = C.mute; g.setLineDash([5, 4]); g.strokeRect(s.x, s.y, s.w, s.h); g.setLineDash([]);
      g.fillStyle = C.ink; g.font = '600 14px ui-sans-serif, system-ui'; g.textAlign = 'center'; g.fillText(s.kind.slice(4), cx, cy + 5); g.restore(); return;
    }
    const col = COL[s.kind] ?? C.ink; g.strokeStyle = col; g.fillStyle = col + '55'; g.shadowColor = col; g.shadowBlur = 12 * e;
    g.beginPath();
    if (s.kind === 'circle') g.ellipse(cx, cy, w / 2, hh / 2, 0, 0, Math.PI * 2);
    else if (s.kind === 'triangle') { g.moveTo(cx, cy - hh / 2); g.lineTo(cx + w / 2, cy + hh / 2); g.lineTo(cx - w / 2, cy + hh / 2); g.closePath(); }
    else if (s.kind === 'rectangle') g.rect(cx - w / 2, cy - hh / 2, w, hh);
    else if (s.kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .4 : 1, x = cx + Math.cos(a) * w / 2 * r, y = cy + Math.sin(a) * hh / 2 * r; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); }
    if (s.fill) g.fill(); g.stroke(); g.restore();
  }
  function drawGest(g: CanvasRenderingContext2D, W: number, H: number, now: number) {
    for (const s of shapes) drawShape(g, s, now);
    if (stroke.length > 1) { g.strokeStyle = C.ink; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); stroke.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
    else if (!shapes.length && !msg) { g.fillStyle = C.mute; g.font = '15px ui-sans-serif, system-ui'; g.textAlign = 'center'; g.fillText(t('hint', 'Draw a circle, triangle, rectangle or star here'), W / 2, H / 2); g.textAlign = 'start'; }
    /* the normalised stroke, as the recogniser sees it */
    if (lastRaw.length > 5 && W > 520) {
      const p = normalise(lastRaw), bs = 92, bx = W - bs - 16, by = 16;
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(bx, by, bs, bs); g.strokeStyle = 'rgba(255,255,255,.15)'; g.strokeRect(bx + .5, by + .5, bs, bs);
      g.fillStyle = C.cyan; for (const q of p) { g.beginPath(); g.arc(bx + bs / 2 + q.x / SQ * bs * .8, by + bs / 2 + q.y / SQ * bs * .8, 1.6, 0, 7); g.fill(); }
      g.fillStyle = C.mute; g.font = '10px ui-monospace, monospace'; g.textAlign = 'right'; g.fillText(t('seen', '64 points, as compared'), bx + bs, by + bs + 14); g.textAlign = 'start';
    }
    if (msg) { g.font = '600 14px ui-sans-serif, system-ui'; const tw = Math.min(W - 24, g.measureText(msg).width + 24); g.fillStyle = `rgba(11,18,32,${.75})`; g.fillRect(12, H - 44, tw, 30); g.fillStyle = flash > 0 ? C.cyan : C.ink; g.fillText(msg, 24, H - 24, tw - 24); }
    flash = Math.max(0, flash - .03);
    out('a', lastRes[0] ? `${nm(lastRes[0].name)} ${Math.round(lastRes[0].score * 100)}%` : '—');
    out('b', lastRes[1] ? `${nm(lastRes[1].name)} ${Math.round(lastRes[1].score * 100)}%` : '—');
    out('c', String(shapes.length));
  }
  function drawFitts(g: CanvasRenderingContext2D, W: number, H: number, now: number) {
    const G = geo();
    if (G.wide) { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(G.aw + .5, 0); g.lineTo(G.aw + .5, H); g.stroke(); }
    else { g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, G.ah + .5); g.lineTo(W, G.ah + .5); g.stroke(); }
    if (phase === 'idle') { g.fillStyle = C.mute; g.font = '15px ui-sans-serif, system-ui'; g.textAlign = 'center'; g.fillText(t('pressstart', 'Press “Start the test” to begin'), G.aw / 2, G.ah / 2); g.textAlign = 'start'; }
    if (phase === 'home' || phase === 'target') {
      g.lineWidth = 3; g.strokeStyle = phase === 'home' ? C.gold : 'rgba(255,209,102,.3)'; g.beginPath(); g.arc(home.x, home.y, 18, 0, 7); g.stroke();
      if (phase === 'home') { g.fillStyle = C.gold; g.font = '12px ui-sans-serif, system-ui'; g.textAlign = 'center'; g.fillText(t('tapring', 'tap the ring'), home.x, home.y + 36); g.textAlign = 'start'; }
      if (phase === 'target') { g.fillStyle = C.cyan; g.shadowColor = C.cyan; g.shadowBlur = 14; g.beginPath(); g.arc(tgt.x, tgt.y, tgt.w / 2, 0, 7); g.fill(); g.shadowBlur = 0; }
      g.fillStyle = C.mute; g.font = '12px ui-monospace, monospace'; g.fillText(`${Math.min(cur + 1, seq.length)} / ${seq.length}`, 12, 20);
    }
    if (phase === 'done') { g.fillStyle = C.ink; g.font = '600 16px ui-sans-serif, system-ui'; g.textAlign = 'center'; const f = fitts(trials); g.fillText(f ? `${t('result', 'Your throughput')}: ${f.tp.toFixed(2)} ${t('bps', 'bits/s')}` : '', G.aw / 2, G.ah / 2 - 8); g.fillStyle = C.mute; g.font = '13px ui-sans-serif, system-ui'; g.fillText(t('again', 'Try again with another device to compare.'), G.aw / 2, G.ah / 2 + 16); g.textAlign = 'start'; }
    ripple = ripple.filter((r) => now - r.t < 400);
    for (const r of ripple) { const k = (now - r.t) / 400; g.strokeStyle = r.ok ? `rgba(79,227,209,${1 - k})` : `rgba(255,111,168,${1 - k})`; g.lineWidth = 2; g.beginPath(); g.arc(r.x, r.y, 8 + k * 30, 0, 7); g.stroke(); }
    /* the chart: movement time against difficulty, with the fitted line */
    const px = G.wide ? G.aw + 46 : 46, py = G.wide ? 40 : G.ah + 26, pw = (G.wide ? W - G.aw : W) - 66, ph = (G.wide ? H : H - G.ah) - (G.wide ? 90 : 56);
    if (pw < 80 || ph < 50) return;
    const ids = trials.map((q) => fittsID(q.D, q.W)), mts = trials.map((q) => q.mt), xMax = Math.max(4, ...ids) * 1.05, yMax = Math.max(800, ...mts) * 1.1;
    const X = (v: number) => px + v / xMax * pw, Y = (v: number) => py + ph - v / yMax * ph;
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + ph); g.lineTo(px + pw, py + ph); g.stroke();
    g.fillStyle = C.mute; g.font = '10px ui-monospace, monospace';
    for (let v = 0; v <= xMax; v += 1) { g.fillText(String(v), X(v) - 3, py + ph + 13); }
    for (let v = 0; v <= yMax; v += yMax > 2000 ? 1000 : 500) { g.fillText(String(v), px - 34, Y(v) + 3); }
    g.fillText(t('axx', 'difficulty (bits)'), px + pw - 96, py + ph + 26); g.fillText(t('axy', 'time (ms)'), px, py - 8);
    trials.forEach((q, i) => { g.fillStyle = q.miss ? C.pink : C.cyan; g.beginPath(); g.arc(X(ids[i]), Y(mts[i]), 3.5, 0, 7); g.fill(); });
    const f = fitts(trials);
    if (f && trials.length >= 4) { g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.moveTo(X(0), Y(f.a)); g.lineTo(X(xMax), Y(f.a + f.b * xMax)); g.stroke(); g.lineWidth = 1; }
    out('a', phase === 'idle' ? '—' : `${trials.length} / ${seq.length}`);
    out('b', f ? `${f.tp.toFixed(2)} ${t('bps', 'bits/s')}` : '—');
    out('c', f && trials.length >= 4 ? `${Math.round(f.a)} + ${Math.round(f.b)}·ID ms · R² ${f.r2.toFixed(2)}` : '—');
  }
  const lp = loop(ctx, S.cv, (_dt, tt) => {
    const g = S.g, W = S.w, H = S.h, now = tt * 1000;
    bgGrid(g, W, H);
    if (cfg.mode === 'gest') { drawGest(g, W, H, performance.now()); const anim = shapes.some((s) => performance.now() - s.born < 300); if (!drawing && !anim && flash <= 0) lp.pause(); }
    else { drawFitts(g, W, H, performance.now()); if (!ripple.length && phase !== 'target') lp.pause(); }
    void now;
  });

  /* ---------- input ---------- */
  S.cv.style.touchAction = 'none';
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv);
    if (cfg.mode === 'gest') { S.cv.setPointerCapture(e.pointerId); drawing = true; stroke = [p]; msg = ''; lp.play(); return; }
    const now = performance.now();
    if (phase === 'home') { if (Math.hypot(p.x - home.x, p.y - home.y) <= 26) { phase = 'target'; placeTarget(); t0 = now; misses = 0; dev = dev || e.pointerType || 'mouse'; } lp.play(); return; }
    if (phase === 'target') {
      const hit = Math.hypot(p.x - tgt.x, p.y - tgt.y) <= tgt.w / 2 + 2;
      ripple.push({ x: p.x, y: p.y, t: now, ok: hit });
      if (!hit) { misses++; lp.play(); return; }
      trials.push({ D: Math.hypot(tgt.x - home.x, tgt.y - home.y), W: tgt.w, mt: now - t0, miss: misses });
      cur++;
      if (cur >= seq.length) {
        phase = 'done'; const f = fitts(trials);
        if (f) { const l = runs.get(); l.push({ dev: dev === 'touch' ? t('dev.touch', 'Touch') : dev === 'pen' ? t('dev.pen', 'Pen') : t('dev.mouse', 'Mouse'), tp: f.tp, b: f.b, a: f.a, r2: f.r2, n: f.n }); if (l.length > 20) l.shift(); runs.set(l); }
        build();
      } else { phase = 'home'; placeHome(); }
      lp.play();
    }
  });
  S.cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = local(e, S.cv), q = stroke[stroke.length - 1]; if (Math.hypot(p.x - q.x, p.y - q.y) >= 2) { stroke.push(p); lp.play(); } });
  const up = () => { if (!drawing) return; drawing = false; const raw = stroke; stroke = []; act(raw); lp.play(); };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', () => { drawing = false; stroke = []; lp.play(); });
  S.onResize(() => { if (cfg.mode === 'fitts' && (phase === 'home' || phase === 'target')) { phase = 'home'; placeHome(); } lp.play(); });
  build(); lp.play();
}
