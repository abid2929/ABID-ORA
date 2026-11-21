/* 005 Jewelry Universe: Gem Light Lab. A faceted gem whose sparkle follows your light, plus a real
   2D ray tracer through the stone's profile: Snell's law at every surface and total internal
   reflection beyond the critical angle show why cut proportions decide how much light returns. */
import { jewelShow } from './jewel3d';
import { type Ctx, h, layout, canvas, heading, note, select, range, stats, loop, hex2rgb, clamp } from './kit';

interface Gem { n: number; disp: number; sg: number; col: string; name: string }
const GEMS: Record<string, Gem> = {
  diamond: { n: 2.417, disp: .044, sg: 3.52, col: '#f4f8ff', name: 'Diamond' },
  moissanite: { n: 2.65, disp: .104, sg: 3.22, col: '#f2f6f0', name: 'Moissanite (lab)' },
  sapphire: { n: 1.77, disp: .018, sg: 4.0, col: '#2448b8', name: 'Blue sapphire' },
  ruby: { n: 1.77, disp: .018, sg: 4.0, col: '#c8143e', name: 'Ruby' },
  emerald: { n: 1.58, disp: .014, sg: 2.72, col: '#1f9a5a', name: 'Emerald' },
  aquamarine: { n: 1.58, disp: .014, sg: 2.7, col: '#86d3e6', name: 'Aquamarine' },
  amethyst: { n: 1.544, disp: .013, sg: 2.65, col: '#9254cc', name: 'Amethyst' },
  glass: { n: 1.5, disp: .009, sg: 2.5, col: '#e9f1f4', name: 'Glass (for comparison)' },
};
type Facet = { pts: [number, number][]; nx: number; ny: number; nz: number };
type V = [number, number];

/* crown facets from a girdle outline r(θ); tilt gives each facet a normal */
function brilliant(r: (a: number) => number, sx = 1, sy = 1): Facet[] {
  const F: Facet[] = [], N = 8, P = (a: number, k: number): V => [Math.cos(a) * k * r(a) * sx, Math.sin(a) * k * r(a) * sy];
  const tilt = (a: number, deg: number) => { const t = deg * Math.PI / 180; return { nx: Math.cos(a) * Math.sin(t), ny: Math.sin(a) * Math.sin(t), nz: Math.cos(t) }; };
  const T = (i: number) => P(i * Math.PI * 2 / N, .56), S = (i: number) => P((i + .5) * Math.PI * 2 / N, .78), G = (i: number) => P(i * Math.PI * 2 / (N * 2), 1);
  F.push({ pts: Array.from({ length: N }, (_, i) => T(i)), nx: 0, ny: 0, nz: 1 });
  for (let i = 0; i < N; i++) {
    const am = (i + .5) * Math.PI * 2 / N, a = i * Math.PI * 2 / N;
    F.push({ pts: [T(i), S(i), T(i + 1)], ...tilt(am, 15) });
    F.push({ pts: [T(i), S(i - 1), G(2 * i), S(i)], ...tilt(a, 34) });
    F.push({ pts: [S(i), G(2 * i), G(2 * i + 1)], ...tilt(am - .2, 42) });
    F.push({ pts: [S(i), G(2 * i + 1), G(2 * i + 2)], ...tilt(am + .2, 42) });
  }
  return F;
}
function stepCut(w: number, hh: number, c: number): Facet[] {
  const F: Facet[] = [], ring = (k: number): V[] => { const W = w * k, H = hh * k, C = c * k; return [[-W + C, -H], [W - C, -H], [W, -H + C], [W, H - C], [W - C, H], [-W + C, H], [-W, H - C], [-W, -H + C]]; };
  const ks = [.55, .72, .87, 1];
  F.push({ pts: ring(ks[0]), nx: 0, ny: 0, nz: 1 });
  for (let j = 0; j < 3; j++) {
    const a = ring(ks[j]), b = ring(ks[j + 1]), tl = (24 + j * 12) * Math.PI / 180;
    for (let i = 0; i < 8; i++) { const i2 = (i + 1) % 8, mx = (a[i][0] + a[i2][0]) / 2, my = (a[i][1] + a[i2][1]) / 2, L = Math.hypot(mx, my) || 1; F.push({ pts: [a[i], b[i], b[i2], a[i2]], nx: mx / L * Math.sin(tl), ny: my / L * Math.sin(tl), nz: Math.cos(tl) }); }
  }
  return F;
}
const CUTS: Record<string, [string, () => Facet[]]> = {
  round: ['Round brilliant', () => brilliant(() => 1)],
  oval: ['Oval', () => brilliant(() => 1, .74, 1)],
  princess: ['Princess', () => brilliant((a) => .86 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))))],
  cushion: ['Cushion', () => brilliant((a) => { const c = Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4; return .9 / c ** .25; })],
  emerald: ['Emerald (step cut)', () => stepCut(.66, .92, .18)],
  asscher: ['Asscher (step cut)', () => stepCut(.86, .86, .28)],
};

/* owner, 21 Nov: flat 2D drawings retired; the 3D ring stays (lab kept below, not called) */
export default function (ctx: Ctx) { jewelShow(ctx); }
export { lab };
function lab(ctx: Ctx) {
  const t = ctx.t;
  let gem = 'diamond', cut = 'round', pav = 40.8, crownA = 34.5, table = 56, ct = 1;
  let facets = CUTS[cut][1]();
  const L = layout(ctx);
  L.view.style.background = 'radial-gradient(circle at 50% 45%, #2a2c33, #0b0b0d 70%)';
  const S = canvas(L.view, t('gem', 'Faceted gem, top view'));
  const side = h('canvas', { role: 'img', 'aria-label': t('side', 'Light paths through the gem profile'), style: { position: 'absolute', inset: 'auto', insetInlineEnd: '12px', bottom: '12px', width: 'min(320px,46%)', height: 'auto', aspectRatio: '1.45', borderRadius: '12px', background: 'rgba(8,9,12,.82)', border: '1px solid rgba(255,255,255,.1)' } }) as HTMLCanvasElement;
  L.view.append(side);
  let light: [number, number] = [-.4, -.5], rot = 0, sparkle = 1;
  S.cv.addEventListener('pointermove', (e) => { const r = S.cv.getBoundingClientRect(); light = [((e.clientX - r.left) / r.width - .5) * 2, ((e.clientY - r.top) / r.height - .5) * 2]; });
  S.cv.addEventListener('keydown', (e) => { const d: Record<string, V> = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] }; if (d[e.key]) { e.preventDefault(); light = [clamp(light[0] + d[e.key][0], -1, 1), clamp(light[1] + d[e.key][1], -1, 1)]; } });

  function drawGem(time: number) {
    const g = S.g, W = S.w, H = S.h, G = GEMS[gem], R = Math.min(W, H) * .34, cx = W / 2, cy = H * .46;
    g.clearRect(0, 0, W, H);
    const [br, bg, bb] = hex2rgb(G.col);
    const lz = .9, ll = Math.hypot(light[0], light[1], lz), L0 = [light[0] / ll, light[1] / ll, lz / ll];
    const ret = lightReturn();
    g.save(); g.translate(cx, cy); if (!ctx.calm) g.rotate(rot);
    g.shadowColor = `rgba(${br},${bg},${bb},.35)`; g.shadowBlur = R * .25;
    g.beginPath(); facets.forEach((f) => { if (f.nz < 1) return; }); g.restore();
    g.save(); g.translate(cx, cy); if (!ctx.calm) g.rotate(rot);
    facets.forEach((f, i) => {
      // reflection of the light off this facet, plus the light the pavilion returns through it
      const rz = 2 * f.nz * (f.nx * L0[0] + f.ny * L0[1] + f.nz * L0[2]) - L0[2];
      const spec = Math.max(0, rz) ** 18;
      const back = Math.max(0, -(f.nx * L0[0] + f.ny * L0[1]) * 1.2 + .25) * ret;
      const tw = .5 + .5 * Math.sin(time * 2.2 + i * 1.7 + f.nx * 9);
      const k = clamp(.28 + back * .8 + spec * 1.4, 0, 1.6);
      let r = br * k, gg = bg * k, b = bb * k;
      /* fire: dispersion splits white light into colour flashes on some facets */
      const fire = i === 0 ? 0 : Math.min(.7, G.disp * 9 * sparkle) * Math.max(0, Math.sin(i * 12.9898 + light[0] * 7 + light[1] * 5 + rot * 6)) ** 8;
      if (fire > .03) { const hue = ((i * 47 + light[0] * 120) % 360 + 360) % 360, c = hsl(hue); r = lerpN(r, c[0] * 255 * k, fire); gg = lerpN(gg, c[1] * 255 * k, fire); b = lerpN(b, c[2] * 255 * k, fire); }
      g.fillStyle = `rgb(${clamp(r + tw * 6, 0, 255) | 0},${clamp(gg + tw * 6, 0, 255) | 0},${clamp(b + tw * 6, 0, 255) | 0})`;
      g.beginPath(); f.pts.forEach(([x, y], j) => (j ? g.lineTo(x * R, y * R) : g.moveTo(x * R, y * R))); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = .8; g.stroke();
      if (spec > .6 && sparkle) { const [x, y] = f.pts[0]; star(g, x * R, y * R, R * .08 * spec); }
    });
    g.restore();
    /* setting prongs */
    g.save(); g.translate(cx, cy); g.fillStyle = '#d9d4c7';
    for (let i = 0; i < (cut === 'emerald' || cut === 'asscher' || cut === 'princess' ? 4 : 6); i++) { const n = cut === 'emerald' || cut === 'asscher' || cut === 'princess' ? 4 : 6, a = i * Math.PI * 2 / n + (n === 4 ? Math.PI / 4 : 0) + (ctx.calm ? 0 : rot); g.beginPath(); g.ellipse(Math.cos(a) * R * 1.02 * (cut === 'oval' ? .74 : 1), Math.sin(a) * R * 1.02, R * .06, R * .085, a, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  function lerpN(a: number, b: number, k: number) { return a + (b - a) * k; }
  function hsl(hh: number): [number, number, number] { const f = (n: number) => { const k = (n + hh / 30) % 12; return .5 - .5 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [f(0), f(8), f(4)]; }
  function star(g: CanvasRenderingContext2D, x: number, y: number, s: number) { g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke(); g.restore(); }

  /* ---------- 2D ray tracer through the profile ---------- */
  function profile(): V[] {
    const tw = table / 200, ch = (.5 - tw) * Math.tan(crownA * Math.PI / 180), gd = .015, pd = .5 * Math.tan(pav * Math.PI / 180);
    return [[.5, 0], [tw, ch], [-tw, ch], [-.5, 0], [-.5, -gd], [0, -gd - pd], [.5, -gd]];
  }
  function trace(o: V, d: V, poly: V[], n: number) {
    const segs: { p: V[]; out?: V; top?: boolean } = { p: [o] };
    const hit = (p: V, dir: V, skip: number) => {
      let best = Infinity, bi = -1;
      for (let i = 0; i < poly.length; i++) {
        if (i === skip) continue; const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], den = dir[0] * ey - dir[1] * ex;
        if (Math.abs(den) < 1e-9) continue; const tt = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den, u = ((a[0] - p[0]) * dir[1] - (a[1] - p[1]) * dir[0]) / den;
        if (tt > 1e-6 && u >= 0 && u <= 1 && tt < best) { best = tt; bi = i; }
      }
      return { t: best, i: bi };
    };
    const nrm = (i: number): V => { const a = poly[i], b = poly[(i + 1) % poly.length], ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey); return [ey / l, -ex / l]; };
    const refr = (dd: V, N: V, eta: number): V | null => { const ci = -(N[0] * dd[0] + N[1] * dd[1]), k = 1 - eta * eta * (1 - ci * ci); if (k < 0) return null; const c = eta * ci - Math.sqrt(k); return [eta * dd[0] + c * N[0], eta * dd[1] + c * N[1]]; };
    let H = hit(o, d, -1); if (H.i < 0) return segs;
    let p: V = [o[0] + d[0] * H.t, o[1] + d[1] * H.t]; segs.p.push(p);
    let dir: V | null = refr(d, nrm(H.i), 1 / n); if (!dir) return segs;
    let edge = H.i;
    for (let b = 0; b < 8; b++) {
      H = hit(p, dir, edge); if (H.i < 0) break;
      p = [p[0] + dir[0] * H.t, p[1] + dir[1] * H.t]; segs.p.push(p); edge = H.i;
      const No = nrm(H.i), Ni: V = [-No[0], -No[1]];
      const out = refr(dir, Ni, n);
      if (out) { segs.out = out; segs.top = (poly[H.i][1] + poly[(H.i + 1) % poly.length][1]) / 2 > -1e-3; break; }
      const dn: number = dir[0] * No[0] + dir[1] * No[1]; dir = [dir[0] - 2 * dn * No[0], dir[1] - 2 * dn * No[1]];
    }
    return segs;
  }
  let cacheKey = '', cacheRet = 0;
  function lightReturn() {
    const key = [gem, pav, crownA, table].join();
    if (key === cacheKey) return cacheRet;
    const poly = profile(), n = GEMS[gem].n; let up = 0, tot = 0;
    for (let i = 0; i < 41; i++) { const x = -.27 + i * .54 / 40; const s = trace([x, 1], [0, -1], poly, n); tot++; if (s.top) up++; }
    cacheKey = key; cacheRet = up / tot; return cacheRet;
  }
  function drawSide() {
    const r = side.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    if (side.width !== Math.round(r.width * d)) { side.width = Math.round(r.width * d); side.height = Math.round(r.height * d); }
    const g = side.getContext('2d')!, W = side.width, H = side.height, sc = W * .78, ox = W / 2, oy = H * .38;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    const P = (v: V): V => [ox + v[0] * sc, oy - v[1] * sc];
    const poly = profile(), G = GEMS[gem];
    g.beginPath(); poly.forEach((v, i) => { const [x, y] = P(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
    const [cr, cg, cb] = hex2rgb(G.col); g.fillStyle = `rgba(${cr},${cg},${cb},.16)`; g.fill(); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = d; g.stroke();
    const ang = light[0] * .35;
    for (let i = 0; i < 9; i++) {
      const x = -.24 + i * .48 / 8, dir: V = [Math.sin(ang), -Math.cos(ang)], o: V = [x - dir[0] * 1.2, 1 + 0];
      const s = trace([o[0], .9], dir, poly, G.n);
      g.strokeStyle = s.top ? 'rgba(255,236,170,.9)' : 'rgba(255,90,90,.85)'; g.lineWidth = 1.2 * d;
      g.beginPath(); s.p.forEach((v, j) => { const [px, py] = P(v); j ? g.lineTo(px, py) : g.moveTo(px, py); });
      if (s.out) { const e = s.p[s.p.length - 1]; const [px, py] = P([e[0] + s.out[0] * .35, e[1] + s.out[1] * .35]); g.lineTo(px, py); }
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `${11 * d}px ui-monospace,monospace`;
    g.fillText(t('ret', 'light back to the eye') + ': ' + Math.round(lightReturn() * 100) + '%', 10 * d, H - 12 * d);
  }

  const info = stats(L.panel, [['crit', t('crit', 'Critical angle')], ['ri', t('ri', 'Refractive index')], ['ret', t('return', 'Light return')], ['mm', t('mm', 'Size (round)')]]);
  heading(L.panel, t('stone', 'Stone'));
  select(L.panel, t('gemt', 'Gem'), Object.entries(GEMS).map(([k, v]) => [k, t('g.' + k, v.name)]), gem, (v) => { gem = v; upd(); });
  select(L.panel, t('cut', 'Cut'), Object.entries(CUTS).map(([k, v]) => [k, t('c.' + k, v[0])]), cut, (v) => { cut = v; facets = CUTS[cut][1](); });
  range(L.panel, t('carat', 'Weight'), { min: .1, max: 5, step: .05, value: ct, fmt: (v) => v.toFixed(2) + ' ct' }, (v) => { ct = v; upd(); });
  heading(L.panel, t('prop', 'Proportions (profile on the right)'));
  range(L.panel, t('pav', 'Pavilion angle'), { min: 34, max: 48, step: .1, value: pav, fmt: (v) => v.toFixed(1) + '°' }, (v) => { pav = v; upd(); });
  range(L.panel, t('crown', 'Crown angle'), { min: 25, max: 42, step: .5, value: crownA, fmt: (v) => v.toFixed(1) + '°' }, (v) => { crownA = v; upd(); });
  range(L.panel, t('table', 'Table'), { min: 48, max: 70, value: table, fmt: (v) => v + '%' }, (v) => { table = v; upd(); });
  range(L.panel, t('sparkle', 'Sparkle'), { min: 0, max: 1, step: .05, value: sparkle, fmt: (v) => Math.round(v * 100) + '%' }, (v) => { sparkle = v; });
  note(L.panel, t('how', 'Light entering the table bends (Snell’s law). Where it meets a pavilion facet beyond the critical angle it reflects completely and comes back up as brilliance; at a shallower or steeper pavilion it leaks out of the bottom (red rays). Move the pointer over the gem to move the light.'));
  note(L.panel, t('size', 'Size is estimated from weight and density, scaled from the common guide that a 1 ct round diamond is about 6.5 mm across.'));
  function upd() {
    const G = GEMS[gem]; info('crit', (Math.asin(1 / G.n) * 180 / Math.PI).toFixed(1) + '°'); info('ri', G.n.toFixed(3));
    info('ret', Math.round(lightReturn() * 100) + '%'); info('mm', (6.5 * Math.cbrt(ct * 3.52 / G.sg)).toFixed(1) + ' mm');
  }
  upd();
  loop(ctx, S.cv, (dt, time) => { if (!ctx.calm) rot += dt * .08; drawGem(time); drawSide(); });
  L.hud.textContent = t('hud', 'Move the pointer to move the light');
}
