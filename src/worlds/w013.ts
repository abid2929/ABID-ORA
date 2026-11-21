/* 013 Motorcycle Gallery: Lean Angle Lab. A motorcycle laps a circuit. The lean it needs in every
   corner comes from tan(lean) = v² / (g·r); grip and ground clearance set the limit. The
   "fastest safe lap" mode solves the speed profile with braking and acceleration limits. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, stats, loop, clamp } from './kit';

interface Bike { name: string; clear: number; accel: number; brake: number; vmax: number }
const BIKES: Record<string, Bike> = {
  sport: { name: 'Sport bike', clear: 56, accel: 7, brake: 10, vmax: 290 },
  naked: { name: 'Naked roadster', clear: 50, accel: 6, brake: 9.5, vmax: 240 },
  adv: { name: 'Adventure tourer', clear: 45, accel: 5, brake: 8.5, vmax: 210 },
  cruiser: { name: 'Cruiser', clear: 32, accel: 4, brake: 7.5, vmax: 180 },
  scooter: { name: 'City scooter', clear: 38, accel: 2.5, brake: 7, vmax: 100 },
};
const SURF: Record<string, [string, number]> = { dry: ['Dry asphalt', 1.1], wet: ['Wet asphalt', .7], gravel: ['Loose gravel', .45] };
const G = 9.81;

/* a closed circuit from control points, resampled every metre */
function circuit(): { x: number; y: number }[] {
  const P = [[0, 0], [380, 0], [470, 60], [470, 170], [400, 220], [300, 190], [230, 240], [250, 330], [160, 380], [40, 330], [-40, 240], [-60, 110]];
  const pts: { x: number; y: number }[] = [];
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 60; k++) { const t = k / 60, t2 = t * t, t3 = t2 * t; const f = (a: number, b: number, c: number, d: number) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); pts.push({ x: f(p0[0], p1[0], p2[0], p3[0]), y: f(p0[1], p1[1], p2[1], p3[1]) }); }
  }
  /* resample to 1 m spacing (1 unit = 2 m) */
  const out: { x: number; y: number }[] = []; let acc = 0; out.push(pts[0]);
  for (let i = 1; i <= pts.length; i++) { const a = { ...pts[i - 1] }, b = pts[i % pts.length]; let d = Math.hypot(b.x - a.x, b.y - a.y) * 2; while (acc + d >= 1) { const k = (1 - acc) / d; const nx = a.x + (b.x - a.x) * k, ny = a.y + (b.y - a.y) * k; out.push({ x: nx, y: ny }); a.x = nx; a.y = ny; d = Math.hypot(b.x - a.x, b.y - a.y) * 2; acc = 0; } acc += d; }
  return out;
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const track = circuit(), N = track.length;
  /* curvature radius (m) at every metre from three points 8 m apart */
  const R = track.map((_, i) => { const a = track[(i - 8 + N) % N], b = track[i], c = track[(i + 8) % N]; const ab = Math.hypot(b.x - a.x, b.y - a.y) * 2, bc = Math.hypot(c.x - b.x, c.y - b.y) * 2, ca = Math.hypot(a.x - c.x, a.y - c.y) * 2; const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) * 4 / 2; return area < 1e-6 ? 1e5 : ab * bc * ca / (4 * area); });
  const sign = track.map((_, i) => { const a = track[(i - 8 + N) % N], b = track[i], c = track[(i + 8) % N]; return Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) || 1; });
  let bike = 'sport', surf = 'dry', mode = 'fast', fixed = 90, s = 0, lapT = 0, last = 0, best = 0, worst = 0;
  let prof: number[] = [];
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ff7a45');
  L.view.style.background = '#101112';
  const S = canvas(L.view, t('track', 'Circuit seen from above'));
  const rear = h('canvas', { role: 'img', 'aria-label': t('rear', 'Rear view of the bike leaning'), style: { position: 'absolute', inset: 'auto', insetInlineEnd: '14px', top: '14px', width: 'min(230px,40%)', height: 'auto', aspectRatio: '1', background: 'rgba(0,0,0,.55)', borderRadius: '14px', border: '1px solid rgba(255,255,255,.1)' } }) as HTMLCanvasElement;
  L.view.append(rear);
  const info = stats(L.panel, [['lean', t('lean', 'Lean now')], ['speed', t('speed', 'Speed')], ['lap', t('lap', 'Lap time')], ['max', t('limit', 'Lean limit')]]);

  function limit() { const b = BIKES[bike], mu = SURF[surf][1]; return Math.min(b.clear, Math.atan(mu) * 180 / Math.PI); }
  function solve() {
    const b = BIKES[bike], lim = limit() * Math.PI / 180, vmax = b.vmax / 3.6;
    const v = R.map((r) => Math.min(vmax, Math.sqrt(G * r * Math.tan(lim) * .97)));
    if (mode === 'fixed') { prof = R.map(() => fixed / 3.6); return; }
    /* forward pass (acceleration) and backward pass (braking), twice for the loop */
    for (let k = 0; k < 2; k++) {
      for (let i = 1; i < N * 2; i++) { const a = (i - 1) % N, c = i % N; v[c] = Math.min(v[c], Math.sqrt(v[a] ** 2 + 2 * b.accel)); }
      for (let i = N * 2 - 2; i >= 0; i--) { const a = (i + 1) % N, c = i % N; v[c] = Math.min(v[c], Math.sqrt(v[a] ** 2 + 2 * b.brake)); }
    }
    prof = v;
    let tt = 0; for (const x of v) tt += 1 / Math.max(.5, x); best = tt;
  }
  function needLean(i: number, v: number) { return Math.atan(v * v / (G * R[i])) * 180 / Math.PI; }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const xs = track.map((p) => p.x), ys = track.map((p) => p.y), mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const sc = Math.min((W - 60) / (mxx - mnx), (H - 60) / (mxy - mny)), ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc, oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
    const P = (p: { x: number; y: number }) => [ox + p.x * sc, oy + p.y * sc];
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#2b2d30'; g.lineWidth = 22; g.beginPath(); track.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
    /* colour the racing line by how much lean it needs */
    const lim = limit();
    for (let i = 0; i < N; i += 2) { const [x1, y1] = P(track[i]), [x2, y2] = P(track[(i + 2) % N]); const ln = needLean(i, prof[i]); const k = clamp(ln / lim, 0, 1.2); g.strokeStyle = k > 1 ? '#ff3b3b' : `hsl(${120 - k * 100},80%,${45 + k * 10}%)`; g.lineWidth = 4; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    const [sx, sy] = P(track[0]); g.fillStyle = '#fff'; g.fillRect(sx - 2, sy - 14, 4, 28);
    const i = Math.floor(s) % N, p = track[i], q = track[(i + 3) % N], [bx, by] = P(p), ang = Math.atan2(q.y - p.y, q.x - p.x);
    g.save(); g.translate(bx, by); g.rotate(ang); g.fillStyle = '#ff7a45'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-7, -4); g.lineTo(-7, 4); g.closePath(); g.fill(); g.restore();
    /* rear view */
    const rr = rear.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); if (rear.width !== Math.round(rr.width * d)) { rear.width = rear.height = Math.round(rr.width * d); }
    const rg = rear.getContext('2d')!, RW = rear.width; rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, RW, RW);
    const v = prof[i], lean = needLean(i, v) * sign[i], over = Math.abs(lean) > lim;
    rg.fillStyle = '#2b2d30'; rg.fillRect(0, RW * .8, RW, RW * .2);
    rg.save(); rg.translate(RW / 2, RW * .8); rg.rotate(clamp(lean, -70, 70) * Math.PI / 180);
    rg.fillStyle = '#151515'; rg.beginPath(); rg.ellipse(0, -RW * .08, RW * .05, RW * .085, 0, 0, Math.PI * 2); rg.fill();
    rg.fillStyle = over ? '#ff3b3b' : '#ff7a45'; rg.beginPath(); rg.moveTo(-RW * .1, -RW * .14); rg.lineTo(RW * .1, -RW * .14); rg.lineTo(RW * .07, -RW * .32); rg.lineTo(-RW * .07, -RW * .32); rg.closePath(); rg.fill();
    rg.fillStyle = '#e9e5da'; rg.beginPath(); rg.ellipse(-Math.sign(lean) * RW * .03, -RW * .44, RW * .07, RW * .1, 0, 0, Math.PI * 2); rg.fill();
    rg.fillStyle = '#222'; rg.beginPath(); rg.arc(-Math.sign(lean) * RW * .05, -RW * .58, RW * .06, 0, Math.PI * 2); rg.fill();
    rg.restore();
    rg.fillStyle = '#fff'; rg.font = `${12 * d}px ui-monospace,monospace`; rg.fillText(`${Math.abs(lean).toFixed(0)}°`, 10 * d, 20 * d);
    rg.strokeStyle = 'rgba(255,255,255,.35)'; rg.setLineDash([4 * d, 4 * d]); for (const sg of [-1, 1]) { rg.beginPath(); rg.moveTo(RW / 2, RW * .8); rg.lineTo(RW / 2 + Math.sin(sg * lim * Math.PI / 180) * RW * .6, RW * .8 - Math.cos(lim * Math.PI / 180) * RW * .6); rg.stroke(); } rg.setLineDash([]);
    if (over) { rg.fillStyle = '#ff3b3b'; rg.fillText(t('slide', 'too much lean!'), 10 * d, RW - 10 * d); }
    worst = Math.max(worst, Math.abs(lean));
    info('lean', `${Math.abs(lean).toFixed(0)}°`); info('speed', `${Math.round(v * 3.6)} km/h`); info('max', `${lim.toFixed(0)}°`);
  }
  loop(ctx, S.cv, (dt) => {
    const k = ctx.calm ? .4 : 1, v = prof[Math.floor(s) % N];
    s += v * dt * k; lapT += dt * k;
    if (s >= N) { s -= N; last = lapT; lapT = 0; info('lap', `${last.toFixed(2)} s`); }
    draw();
  });
  heading(L.panel, t('ride', 'The ride'));
  seg(L.panel, t('bike', 'Motorcycle'), Object.entries(BIKES).map(([k, v]) => [k, t('b.' + k, v.name)]), bike, (v) => { bike = v; solve(); });
  seg(L.panel, t('surface', 'Surface'), Object.entries(SURF).map(([k, v]) => [k, t('s.' + k, v[0])]), surf, (v) => { surf = v; solve(); });
  seg(L.panel, t('mode', 'Speed'), [['fast', t('m.fast', 'Fastest safe lap')], ['fixed', t('m.fixed', 'Constant speed')]], mode, (v) => { mode = v; fx.input.closest('label')!.hidden = v !== 'fixed'; solve(); });
  const fx = range(L.panel, t('fixed', 'Constant speed'), { min: 20, max: 200, step: 5, value: fixed, fmt: (v) => v + ' km/h' }, (v) => { fixed = v; solve(); });
  fx.input.closest('label')!.hidden = true;
  note(L.panel, t('how', 'In a steady turn the bike leans until gravity balances the cornering force: tan(lean) = v² ÷ (g × radius). Tyre grip (μ) caps it at atan(μ), and the footpegs or exhausts touch down at the bike’s ground-clearance angle. Green parts of the line need little lean, red parts are past the limit.'));
  note(L.panel, t('safe', 'A physics illustration, not riding advice. Real riders also counter-steer, shift weight and leave a safety margin.'));
  solve(); void best; void h;
}
