/* 066 Global Architecture. Two drawing rooms about forms that travelled between cultures:
   · Star-pattern studio: geometric star patterns of the kind found on mosques, madrasas and palaces from Spain to
     Bengal, generated with the "polygons in contact" method described by E. H. Hankin (1925): start from a tiling,
     send two rays from the middle of every edge at a contact angle, and stop each ray where it meets its partner.
     Change the tiling, the angle and the band width, colour it, and download it as SVG.
   · Arches of the world: draw the same opening as a round, segmental, pointed, horseshoe, four-centred, ogee or
     catenary arch, built from wedge-shaped stones (voussoirs) you can count, with the span and rise measured. */
import { type Ctx, h, s, layout, canvas, heading, note, seg, select, range, color, check, stats, buttons, clamp, store, download } from './kit';

/* ---------- geometry ---------- */
export type V = [number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]], sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]], mul = (a: V, k: number): V => [a[0] * k, a[1] * k];
const rot = (a: V, t: number): V => [a[0] * Math.cos(t) - a[1] * Math.sin(t), a[0] * Math.sin(t) + a[1] * Math.cos(t)];
const len = (a: V) => Math.hypot(a[0], a[1]), norm = (a: V): V => mul(a, 1 / (len(a) || 1)), cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
/** intersection of rays p + t·d and q + u·e (t, u ≥ 0), or null */
export function rayHit(p: V, d: V, q: V, e: V): V | null { const den = cross(d, e); if (Math.abs(den) < 1e-12) return null; const w = sub(q, p), t = cross(w, e) / den, u = cross(w, d) / den; return t >= -1e-9 && u >= -1e-9 ? add(p, mul(d, t)) : null; }
export function centroid(P: V[]): V { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
export function inside(P: V[], q: V) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > q[1]) !== (b[1] > q[1]) && q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; }
export function regular(n: number, c: V, r: number, a0: number): V[] { return Array.from({ length: n }, (_, i) => add(c, rot([r, 0], a0 + (i * 2 * Math.PI) / n))); }

/* ---------- tilings: a finite patch of polygons covering a w × h box, edge length a ---------- */
export type Tiling = 'square' | 'hex' | 'oct' | 'trihex' | 'rhombi';
export function tiling(kind: Tiling, w: number, hh: number, a: number): V[][] {
  const out: V[][] = [], pad = 3 * a, seen = new Set<string>();
  const put = (P: V[]) => { const c = centroid(P), k = `${P.length}:${Math.round(c[0] * 4)}:${Math.round(c[1] * 4)}`; if (!seen.has(k)) { seen.add(k); out.push(P); } };
  const r3 = Math.sqrt(3);
  if (kind === 'square') { for (let y = -pad; y < hh + pad; y += a) for (let x = -pad; x < w + pad; x += a) put([[x, y], [x + a, y], [x + a, y + a], [x, y + a]]); }
  else if (kind === 'hex') { const dx = r3 * a, dy = 1.5 * a; let row = 0; for (let y = -pad; y < hh + pad; y += dy, row++) for (let x = -pad + (row % 2 ? dx / 2 : 0); x < w + pad; x += dx) put(regular(6, [x, y], a, Math.PI / 6)); }
  else if (kind === 'oct') { /* 4.8.8: octagons on a square lattice, small diamonds between */ const P = a * (1 + Math.SQRT2), Ro = a / (2 * Math.sin(Math.PI / 8)); for (let y = -pad; y < hh + pad; y += P) for (let x = -pad; x < w + pad; x += P) { put(regular(8, [x, y], Ro, Math.PI / 8)); put(regular(4, [x + P / 2, y + P / 2], a / Math.SQRT2, 0)); } }
  else if (kind === 'trihex') { /* 3.6.3.6: hexagons touching at corners, triangles between */ const dx = 2 * a, dy = r3 * a; let row = 0; for (let y = -pad; y < hh + pad; y += dy, row++) for (let x = -pad + (row % 2 ? a : 0); x < w + pad; x += dx) { put(regular(6, [x, y], a, 0)); put(regular(3, [x + a, y + a / r3], a / r3, -Math.PI / 2)); put(regular(3, [x + a, y - a / r3], a / r3, Math.PI / 2)); } }
  else { /* 3.4.6.4: each hexagon ringed by squares on its edges and triangles at its corners */ const dx = a * (1 + r3), dy = (dx * r3) / 2; let row = 0;
    for (let y = -pad; y < hh + pad; y += dy, row++) for (let x = -pad + (row % 2 ? dx / 2 : 0); x < w + pad; x += dx) {
      put(regular(6, [x, y], a, Math.PI / 6));
      for (let k = 0; k < 6; k++) { const ang = (k * Math.PI) / 3; put(regular(4, add([x, y], rot([(r3 / 2) * a + a / 2, 0], ang)), a / Math.SQRT2, ang + Math.PI / 4)); const va = Math.PI / 6 + ang; put(regular(3, add([x, y], rot([a + a / r3, 0], va)), a / r3, va + Math.PI)); }
    } }
  return out;
}
/** Hankin's method on one polygon: from each edge midpoint (shifted ±gap along the edge) two rays leave at `theta`
    from the edge, leaning towards each corner; each ray stops where it meets the ray from the neighbouring edge
    leaning towards the same corner. If they would meet outside the polygon the ray stops at the centre. */
export function hankin(P: V[], theta: number, gap = 0): [V, V][] {
  const n = P.length, c = centroid(P), segs: [V, V][] = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], d = P[(i + 2) % n]; /* corner b is shared by edge a→b and edge b→d */
    const m1 = mul(add(a, b), .5), m2 = mul(add(b, d), .5), u1 = norm(sub(b, a)), u2 = norm(sub(d, b));
    const p1 = add(m1, mul(u1, gap)), p2 = add(m2, mul(u2, -gap));
    const inward1 = inside(P, add(m1, rot(u1, Math.PI / 2))) ? 1 : -1, inward2 = inside(P, add(m2, rot(u2, Math.PI / 2))) ? 1 : -1;
    const r1 = rot(u1, inward1 * theta), r2 = rot(mul(u2, -1), -inward2 * theta);
    let x = rayHit(p1, r1, p2, r2);
    if (!x || !inside(P, x) || len(sub(x, c)) > len(sub(b, c))) { x = null; }
    if (x) { segs.push([p1, x], [p2, x]); } else { segs.push([p1, c], [p2, c]); }
  }
  return segs;
}

/* ---------- arches: intrados as points from the left springing point (−1, 0) to the right (1, 0), span 2 ---------- */
export type Arch = 'round' | 'segmental' | 'pointed' | 'horseshoe' | 'fourc' | 'ogee' | 'catenary';
const arcPts = (c: V, r: number, a0: number, a1: number, n = 40): V[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]; });
/** returns the inner curve; `k` shapes it (rise, pointedness, overhang …) within a sensible range */
export function arch(kind: Arch, k: number): V[] {
  const mirror = (left: V[]) => [...left, ...left.slice(0, -1).reverse().map((p) => [-p[0], p[1]] as V)];
  if (kind === 'round') return arcPts([0, 0], 1, Math.PI, 0);
  if (kind === 'segmental') { const rh = .2 + .6 * k, r = (1 + rh * rh) / (2 * rh), cy = rh - r, b = Math.atan2(-cy, 1); return arcPts([0, cy], r, Math.PI - b, b); }
  if (kind === 'pointed') { const r = 1 + 1.5 * k; /* radius in half-spans: 1 = round, 2 = equilateral (radius = span) */ return mirror(arcPts([-1 + r, 0], r, Math.PI, Math.acos((1 - r) / r), 40)); }
  if (kind === 'horseshoe') { const cy = .15 + .45 * k, r = Math.hypot(1, cy), al = Math.atan(cy); return arcPts([0, cy], r, Math.PI + al, -al, 80); }
  if (kind === 'fourc') {
    const phi = Math.PI / 3, r1 = .3 + .3 * k, c1: V = [-1 + r1, 0], tp: V = [c1[0] - r1 * Math.cos(phi), r1 * Math.sin(phi)];
    const need = (1 - r1 + r1 * Math.cos(phi)) / Math.cos(phi), r2 = need * (1.15 + .9 * (1 - k)), c2: V = [tp[0] + r2 * Math.cos(phi), tp[1] - r2 * Math.sin(phi)];
    return mirror([...arcPts(c1, r1, Math.PI, Math.PI - phi, 16), ...arcPts(c2, r2, Math.PI - phi, Math.acos(-c2[0] / r2), 30).slice(1)]);
  }
  if (kind === 'ogee') { const sy = .8 + 1.2 * k; return mirror([...arcPts([-.5, 0], .5, Math.PI, Math.PI / 2, 24), ...arcPts([-.5, 1], .5, -Math.PI / 2, 0, 24).slice(1)].map(([x, y]) => [x, y * sy] as V)); }
  /* catenary y = rise − a(cosh(x/a) − 1) with y(±1) = 0 */
  const rh = .8 + 1.4 * k; let lo = .05, hi = 50; for (let it = 0; it < 80; it++) { const a = (lo + hi) / 2; if (a * (Math.cosh(1 / a) - 1) > rh) lo = a; else hi = a; }
  const a = (lo + hi) / 2; return Array.from({ length: 81 }, (_, i) => { const x = -1 + i / 40; return [x, rh - a * (Math.cosh(x / a) - 1)] as V; });
}
export const rise = (P: V[]) => Math.max(...P.map((p) => p[1]));
/** cumulative arc length positions, used to cut the band into stones of equal length */
export function cuts(P: V[], n: number): V[][] {
  const Ls = [0]; for (let i = 1; i < P.length; i++) Ls.push(Ls[i - 1] + len(sub(P[i], P[i - 1])));
  const T = Ls[Ls.length - 1], out: V[][] = []; let j = 0;
  for (let k = 0; k <= n; k++) { const s0 = (T * k) / n; while (j < P.length - 2 && Ls[j + 1] < s0) j++; const f = (s0 - Ls[j]) / (Ls[j + 1] - Ls[j] || 1), p = add(P[j], mul(sub(P[j + 1], P[j]), f)), tg = norm(sub(P[j + 1], P[j])); out.push([p, tg]); }
  return out;
}

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.classList.add('w66');
  L.view.style.minHeight = 'clamp(420px, 58vw, 640px)';
  const S = canvas(L.view, t('cv', 'A drawing of a geometric star pattern or of an arch made of stones.'), { alpha: false });
  type Cfg = { room: 'star' | 'arch'; til: Tiling; theta: number; gap: number; size: number; line: string; bg: string; fill: boolean; showT: boolean; arch: Arch; k: number; stones: number };
  const def: Cfg = { room: 'star', til: 'oct', theta: 67.5, gap: 0, size: 70, line: '#e9c46a', bg: '#123a4a', fill: true, showT: false, arch: 'pointed', k: .5, stones: 15 };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'room' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);

  heading(L.panel, t('h', 'Drawing room'));
  seg(L.panel, t('room', 'Room'), [['star', t('r.star', 'Star patterns')], ['arch', t('r.arch', 'Arches of the world')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); build(); draw(); });
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };

  const TIL: [Tiling, string][] = [['square', t('t.square', 'Squares (4.4.4.4)')], ['hex', t('t.hex', 'Hexagons (6.6.6)')], ['oct', t('t.oct', 'Octagons and squares (4.8.8)')], ['trihex', t('t.trihex', 'Hexagons and triangles (3.6.3.6)')], ['rhombi', t('t.rhombi', 'Hexagons, squares, triangles (3.4.6.4)')]];
  const ARCH: [Arch, string, string][] = [
    ['round', t('a.round', 'Round (semicircular)'), t('ad.round', 'Rise is exactly half the span. Used by Roman builders in aqueducts and bridges, and later in Romanesque churches.')],
    ['segmental', t('a.segmental', 'Segmental'), t('ad.segmental', 'A slice of a circle, flatter than a half circle, so it pushes harder sideways and needs strong abutments. Common over windows and in bridges.')],
    ['pointed', t('a.pointed', 'Pointed (two-centred)'), t('ad.pointed', 'Two arcs meeting at a point. Used across the Islamic world and later in Gothic cathedrals; the point lets the rise change without changing the span.')],
    ['horseshoe', t('a.horseshoe', 'Horseshoe'), t('ad.horseshoe', 'The curve continues below the widest point. Typical of Moorish Spain and North Africa, as in the Great Mosque of Córdoba.')],
    ['fourc', t('a.fourc', 'Four-centred'), t('ad.fourc', 'Small arcs at the sides and large flat arcs to the top. Seen in Persian and Mughal iwans and gateways, and in English Tudor doorways.')],
    ['ogee', t('a.ogee', 'Ogee'), t('ad.ogee', 'Each side is an S curve, convex below and concave above. Decorative rather than strong; found in Venetian Gothic and in many South Asian buildings.')],
    ['catenary', t('a.catenary', 'Catenary'), t('ad.catenary', 'The shape of a hanging chain turned upside down, which carries its own weight in pure compression (Robert Hooke, 1675). Used by Antoni Gaudí.')],
  ];

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.room === 'star') {
      about.textContent = t('ab.star', 'Many star patterns on historic buildings can be drawn from a plain tiling. From the middle of each edge send two lines into the tile at the same angle, and stop each line where it meets its neighbour. E. H. Hankin described this in 1925. Small angles give a lattice; bigger angles grow stars and rosettes.');
      select(box, t('til', 'Starting tiling'), TIL, cfg.til, (v) => { cfg.til = v as Tiling; save(); draw(); });
      range(box, t('theta', 'Contact angle'), { min: 20, max: 85, step: .5, value: cfg.theta, fmt: (v) => `${v}°` }, (v) => { cfg.theta = v; save(); draw(); });
      range(box, t('gap', 'Line split'), { min: 0, max: 12, step: .5, value: cfg.gap, fmt: (v) => `${v}` }, (v) => { cfg.gap = v; save(); draw(); });
      range(box, t('size', 'Tile size'), { min: 30, max: 140, value: cfg.size, fmt: (v) => `${v} px` }, (v) => { cfg.size = v; save(); draw(); });
      color(box, t('line', 'Band colour'), cfg.line, (v) => { cfg.line = v; save(); draw(); });
      color(box, t('bg', 'Ground colour'), cfg.bg, (v) => { cfg.bg = v; save(); draw(); });
      check(box, t('fill', 'Colour the stars'), cfg.fill, (v) => { cfg.fill = v; save(); draw(); });
      check(box, t('showT', 'Show the starting tiling'), cfg.showT, (v) => { cfg.showT = v; save(); draw(); });
      buttons(box, [[t('svg', 'Download SVG'), exportSVG, true], [t('png', 'Download PNG'), () => download(S.cv, 'abidora-star-pattern.png')]]);
      lab(t('st.tiles', 'Tiles drawn'), t('st.lines', 'Line segments'), t('st.angle', 'Angle'));
    } else {
      about.textContent = t('ab.arch', 'The same opening, spanned seven ways. Every arch is a ring of wedge-shaped stones (voussoirs) that press on each other; the shape decides how high it rises, how hard it pushes sideways, and how it looks.');
      select(box, t('archT', 'Arch'), ARCH.map(([k, n]) => [k, n] as [string, string]), cfg.arch, (v) => { cfg.arch = v as Arch; save(); build(); draw(); });
      const info = ARCH.find((a) => a[0] === cfg.arch)!; box.append(h('p', { class: 'wk-note w66-d', text: info[2] }));
      if (cfg.arch !== 'round') range(box, t('shape', 'Shape'), { min: 0, max: 1, step: .01, value: cfg.k, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { cfg.k = v; save(); draw(); });
      range(box, t('stones', 'Stones (voussoirs)'), { min: 5, max: 41, step: 2, value: cfg.stones, fmt: (v) => `${v}` }, (v) => { cfg.stones = v; save(); draw(); });
      lab(t('st.span', 'Span (example)'), t('st.rise', 'Rise'), t('st.ratio', 'Rise ÷ span'));
    }
  }

  /* ---------- star pattern ---------- */
  function patternSegs(W: number, H: number) { const polys = tiling(cfg.til, W, H, cfg.size), th = (cfg.theta * Math.PI) / 180, segs: [V, V][] = []; for (const P of polys) segs.push(...hankin(P, th, cfg.gap)); return { polys, segs }; }
  function drawStar(g: CanvasRenderingContext2D, W: number, H: number) {
    const { polys, segs } = patternSegs(W, H);
    g.fillStyle = cfg.bg; g.fillRect(0, 0, W, H);
    if (cfg.fill) { /* fill each tile's star: the polygon formed by the ray meeting points */
      for (const P of polys) { const sg = hankin(P, (cfg.theta * Math.PI) / 180, 0); g.beginPath(); for (let i = 0; i < sg.length; i += 2) { const [m, x] = sg[i]; if (i) g.lineTo(m[0], m[1]); else g.moveTo(m[0], m[1]); g.lineTo(x[0], x[1]); } g.closePath(); g.fillStyle = P.length === 4 ? 'rgba(255,255,255,.07)' : P.length === 3 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.14)'; g.fill(); }
    }
    if (cfg.showT) { g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; for (const P of polys) { g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.stroke(); } }
    const bw = Math.max(3, cfg.size * .07);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = bw + 3; g.beginPath(); for (const [a, b] of segs) { g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); } g.stroke();
    g.strokeStyle = cfg.line; g.lineWidth = bw; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, bw * .25); g.stroke();
    out('a', String(polys.length)); out('b', String(segs.length)); out('c', `${cfg.theta}°`);
  }
  function exportSVG() {
    const W = 800, H = 800, { polys, segs } = patternSegs(W, H), bw = Math.max(3, cfg.size * .07);
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H });
    svg.append(s('rect', { width: W, height: H, fill: cfg.bg }));
    if (cfg.fill) for (const P of polys) { const sg = hankin(P, (cfg.theta * Math.PI) / 180, 0); const d = sg.filter((_, i) => i % 2 === 0).map(([m, x], i) => `${i ? 'L' : 'M'}${m[0].toFixed(1)},${m[1].toFixed(1)}L${x[0].toFixed(1)},${x[1].toFixed(1)}`).join('') + 'Z'; svg.append(s('path', { d, fill: P.length === 4 ? 'rgba(255,255,255,.07)' : P.length === 3 ? 'rgba(0,0,0,.15)' : 'rgba(255,255,255,.14)' })); }
    const d = segs.map(([a, b]) => `M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}`).join('');
    svg.append(s('path', { d, stroke: cfg.line, 'stroke-width': bw, 'stroke-linecap': 'round', fill: 'none' }));
    download(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }), 'abidora-star-pattern.svg');
  }

  /* ---------- arch ---------- */
  function drawArch(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = '#efe6d6'; g.fillRect(0, 0, W, H);
    const P = arch(cfg.arch, cfg.k), R = rise(P), thick = .26, low = Math.min(0, ...P.map((p) => p[1]));
    const sc = Math.min((W * .7) / (2 + 2 * thick + .8), (H * .78) / (R + thick + 1.1 - low)), ox = W / 2, base = H * .86;
    const X = (p: V): V => [ox + p[0] * sc, base - (p[1] + 1) * sc];
    /* ground, piers and wall */
    g.fillStyle = '#d9cbb3'; g.fillRect(0, base, W, H - base);
    const pierW = (thick + .4) * sc, wallTop = base - (R + thick + 1.35) * sc;
    g.fillStyle = '#e4d6bf'; g.fillRect(ox - (1 + thick + .4) * sc - 30, wallTop, (2 + 2 * thick + .8) * sc + 60, base - wallTop);
    g.fillStyle = '#d6c4a6'; g.fillRect(ox - (1 + thick + .4) * sc, X([-1, 0])[1], pierW, base - X([-1, 0])[1]); g.fillRect(ox + (1 - .0) * sc - 0, X([1, 0])[1], pierW, base - X([1, 0])[1]);
    /* opening (sky) */
    g.fillStyle = '#9fc4dd'; g.beginPath(); const sky = [[-1, -1] as V, ...P, [1, -1] as V].map(X); sky.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill();
    /* voussoirs */
    const n = cfg.stones, C = cuts(P, n), nrm = (tg: V): V => [-tg[1], tg[0]];
    for (let i = 0; i < n; i++) {
      const [a, ta] = C[i], [b, tb] = C[i + 1], na = nrm(ta), nb = nrm(tb);
      const q = [a, add(a, mul(na, thick)), add(b, mul(nb, thick)), b].map(X);
      g.beginPath(); q.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
      g.fillStyle = i === (n - 1) / 2 ? '#c99b5a' : i % 2 ? '#d8b98a' : '#cfae7c'; g.fill(); g.strokeStyle = '#7d6443'; g.lineWidth = 1.2; g.stroke();
    }
    /* dimensions */
    const L0 = X([-1, 0]), R0 = X([1, 0]), top = X([0, R]);
    g.strokeStyle = '#3a3a3a'; g.fillStyle = '#3a3a3a'; g.lineWidth = 1; g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(L0[0], L0[1]); g.lineTo(R0[0], R0[1]); g.moveTo(ox, L0[1]); g.lineTo(ox, top[1]); g.stroke(); g.setLineDash([]);
    g.font = '12px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(t('span', 'span'), ox, L0[1] + 16); g.textAlign = 'start'; g.fillText(t('riseL', 'rise'), ox + 6, (L0[1] + top[1]) / 2);
    const name = ARCH.find((a) => a[0] === cfg.arch)![1]; g.font = '600 16px ui-serif, Georgia, serif'; g.fillStyle = '#2b2620'; g.fillText(name, 16, 26);
    out('a', '4.00 m'); out('b', `${(R * 2).toFixed(2)} m`); out('c', (R / 2).toFixed(2));
    L.hud.textContent = `${t('stonesN', 'Stones')}: ${n} · ${t('key', 'the darker middle stone is the keystone')}`;
  }

  function draw() { const g = S.g, W = S.w, H = S.h; if (cfg.room === 'star') drawStar(g, W, H); else drawArch(g, W, H); }
  S.onResize(draw);
  build(); draw();
}
