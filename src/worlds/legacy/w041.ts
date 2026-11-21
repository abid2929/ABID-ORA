/* 041 Physics Playground: a real 2D physics sandbox. Balls, walls, rods, ropes and springs, solved with
   extended position-based dynamics (XPBD, Macklin, Müller and Chentanez 2016) in small sub-steps, with a
   velocity pass for bounciness and friction (Müller et al. 2020). Throw balls, draw ramps, hang
   pendulums, build chains, change gravity to the Moon or Jupiter, and watch the energy bookkeeping:
   kinetic, potential and spring energy, and what friction and collisions take away. Presets show
   classic demonstrations: Newton's cradle, a Galton board building a bell curve, chaos in two double
   pendulums that start a hair apart, a hanging chain, springs of different stiffness and a pool break. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, loop, local, rng, clamp } from '../kit';

/* ---------- engine (exported for tests) ---------- */
export interface Ball { x: number; y: number; vx: number; vy: number; px: number; py: number; r: number; w: number; col: string; ghost?: boolean; peg?: boolean; trail?: number[] }
export interface Link { a: number; b: number; L: number; kind: 'rod' | 'rope' | 'spring'; k: number; lam: number }
export interface Wall { x1: number; y1: number; x2: number; y2: number }
type Contact = { a: number; b: number; nx: number; ny: number; vn: number };
export const DENSITY = 100; // kg per m² of disc, so a 20 cm ball weighs about 12.6 kg
export const massOf = (r: number) => DENSITY * Math.PI * r * r;

export class World {
  balls: Ball[] = []; links: Link[] = []; walls: Wall[] = [];
  g = 9.81; e = .6; mu = .2; drag = 0; sub = 20; lost = 0;
  private contacts: Contact[] = [];
  add(x: number, y: number, r: number, col = '#f2c46d', fixed = false, vx = 0, vy = 0) {
    this.balls.push({ x, y, vx, vy, px: x, py: y, r, w: fixed ? 0 : 1 / massOf(r), col });
    return this.balls.length - 1;
  }
  link(a: number, b: number, kind: Link['kind'], k = 200, L?: number) {
    const A = this.balls[a], B = this.balls[b];
    this.links.push({ a, b, kind, k, L: L ?? Math.hypot(B.x - A.x, B.y - A.y), lam: 0 });
  }
  remove(i: number) {
    this.balls.splice(i, 1);
    this.links = this.links.filter((l) => l.a !== i && l.b !== i).map((l) => ({ ...l, a: l.a > i ? l.a - 1 : l.a, b: l.b > i ? l.b - 1 : l.b }));
  }
  /** energies in joules: kinetic, gravitational potential (zero at the floor) and stored in springs */
  energy() {
    let ke = 0, pe = 0, se = 0;
    for (const b of this.balls) if (b.w) { const m = 1 / b.w; ke += .5 * m * (b.vx * b.vx + b.vy * b.vy); pe += m * this.g * (b.y - b.r); }
    for (const l of this.links) if (l.kind === 'spring') { const A = this.balls[l.a], B = this.balls[l.b], d = Math.hypot(B.x - A.x, B.y - A.y) - l.L; se += .5 * l.k * d * d; }
    return { ke, pe, se };
  }
  step(dt: number, grab?: { i: number; x: number; y: number } | null) {
    const n = this.sub, hh = dt / n, B = this.balls;
    for (let s = 0; s < n; s++) {
      const air = Math.exp(-this.drag * hh);
      for (const b of B) {
        if (!b.w) { b.px = b.x; b.py = b.y; continue; }
        b.vy -= this.g * hh; b.vx *= air; b.vy *= air;
        b.px = b.x; b.py = b.y; b.x += b.vx * hh; b.y += b.vy * hh;
      }
      if (grab && B[grab.i]) {
        const b = B[grab.i];
        if (!b.w) { b.x = grab.x; b.y = grab.y; } else { b.x += (grab.x - b.x) * .35; b.y += (grab.y - b.y) * .35; }
      }
      this.contacts.length = 0;
      for (const l of this.links) l.lam = 0;
      for (let it = 0; it < 2; it++) { this.solveLinks(hh); this.collide(it === 0); }
      for (const b of B) {
        if (!b.w) { b.vx = (b.x - b.px) / hh; b.vy = (b.y - b.py) / hh; continue; }
        b.vx = (b.x - b.px) / hh; b.vy = (b.y - b.py) / hh;
      }
      this.velocityPass(hh);
    }
    /* anything thrown out of the world is removed */
    for (let i = B.length - 1; i >= 0; i--) { const b = B[i]; if (b.y < -20 || b.y > 60 || b.x < -30 || b.x > 40 || !Number.isFinite(b.x + b.y)) { this.remove(i); this.lost++; } }
  }
  private solveLinks(hh: number) {
    const B = this.balls;
    for (const l of this.links) {
      const A = B[l.a], C = B[l.b]; if (!A || !C) continue;
      const wsum = A.w + C.w; if (!wsum) continue;
      let dx = C.x - A.x, dy = C.y - A.y; const d = Math.hypot(dx, dy) || 1e-9; dx /= d; dy /= d;
      const c = d - l.L; if (l.kind === 'rope' && c <= 0) continue;
      let dl: number;
      if (l.kind === 'spring') { const at = 1 / l.k / (hh * hh); dl = (-c - at * l.lam) / (wsum + at); l.lam += dl; }
      else dl = -c / wsum;
      A.x -= dx * dl * A.w; A.y -= dy * dl * A.w; C.x += dx * dl * C.w; C.y += dy * dl * C.w;
    }
  }
  private collide(record: boolean) {
    const B = this.balls; let maxR = .05;
    for (const b of B) if (b.r > maxR) maxR = b.r;
    const cs = maxR * 2, grid = new Map<number, number[]>(), key = (i: number, j: number) => i * 73856093 ^ j * 19349663;
    B.forEach((b, i) => { if (b.ghost) return; const k = key(Math.floor(b.x / cs), Math.floor(b.y / cs)); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push(i); });
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (a.ghost) continue;
      const gx = Math.floor(a.x / cs), gy = Math.floor(a.y / cs);
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const cell = grid.get(key(gx + ox, gy + oy)); if (!cell) continue;
        for (const j of cell) {
          if (j <= i) continue; const b = B[j], ws = a.w + b.w; if (!ws) continue;
          let dx = b.x - a.x, dy = b.y - a.y; const rr = a.r + b.r, d2 = dx * dx + dy * dy; if (d2 >= rr * rr) continue;
          const d = Math.sqrt(d2) || 1e-9; dx /= d; dy /= d; const pen = rr - d;
          if (record) this.contacts.push({ a: i, b: j, nx: dx, ny: dy, vn: (b.vx - a.vx) * dx + (b.vy - a.vy) * dy });
          a.x -= dx * pen * a.w / ws; a.y -= dy * pen * a.w / ws; b.x += dx * pen * b.w / ws; b.y += dy * pen * b.w / ws;
        }
      }
    }
    for (let i = 0; i < B.length; i++) {
      const b = B[i]; if (!b.w || b.ghost) continue;
      for (const w of this.walls) {
        const ex = w.x2 - w.x1, ey = w.y2 - w.y1, L2 = ex * ex + ey * ey || 1e-9, t = clamp(((b.x - w.x1) * ex + (b.y - w.y1) * ey) / L2, 0, 1);
        const cx = w.x1 + ex * t, cy = w.y1 + ey * t; let dx = b.x - cx, dy = b.y - cy; const d2 = dx * dx + dy * dy, R = b.r + .02;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-9; dx /= d; dy /= d;
        if (record) this.contacts.push({ a: -1, b: i, nx: dx, ny: dy, vn: b.vx * dx + b.vy * dy });
        b.x += dx * (R - d); b.y += dy * (R - d);
      }
    }
  }
  private velocityPass(hh: number) {
    const B = this.balls, rest = 2 * this.g * hh + .05;
    for (const c of this.contacts) {
      const A = c.a >= 0 ? B[c.a] : null, b = B[c.b]; if (!b) continue;
      const wa = A ? A.w : 0, ws = wa + b.w; if (!ws) continue;
      const rvx = b.vx - (A ? A.vx : 0), rvy = b.vy - (A ? A.vy : 0), vn = rvx * c.nx + rvy * c.ny;
      const e = Math.abs(c.vn) < rest ? 0 : this.e, target = Math.max(-e * c.vn, 0);
      const dvn = target - vn; if (dvn <= 0 && vn >= 0) continue;
      let ix = c.nx * dvn, iy = c.ny * dvn;
      /* Coulomb friction on the sliding part, limited by the normal change */
      const tx = rvx - vn * c.nx, ty = rvy - vn * c.ny, vt = Math.hypot(tx, ty);
      if (vt > 1e-6) { const f = Math.min(this.mu * Math.abs(dvn), vt) / vt; ix -= tx * f; iy -= ty * f; }
      if (A) { A.vx -= ix * wa / ws; A.vy -= iy * wa / ws; }
      b.vx += ix * b.w / ws; b.vy += iy * b.w / ws;
    }
  }
}

/* ---------- the world page ---------- */
const BW = 10, BH = 6.25; // the box in metres
const PAL = ['#f2c46d', '#7fb2ff', '#ff8a7a', '#9be59b', '#c6a8ff', '#6fd3d0', '#ffb36b'];

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#7fb2ff');
  L.view.style.background = '#0a0c12';
  L.view.style.minHeight = 'clamp(360px, 62vw, 620px)';
  const S = canvas(L.view, t('cv', 'The physics box. Use the tool chosen in the panel to add balls, walls and links, or drag things around.'));
  const R = rng();
  const W = new World();
  const st = { tool: 'ball', size: .2, slow: 1, paused: false, trails: false, pour: 0, pourT: 0, galton: false, chaos: false };
  const hist: [number, number, number][] = [];
  const say = (s: string) => { L.hud.textContent = s; };
  const walls0 = () => { W.walls = [{ x1: 0, y1: 0, x2: BW, y2: 0 }, { x1: 0, y1: 0, x2: 0, y2: BH }, { x1: BW, y1: 0, x2: BW, y2: BH }]; };
  const clearAll = () => { W.balls = []; W.links = []; walls0(); st.pour = 0; st.galton = false; st.chaos = false; hist.length = 0; W.lost = 0; };
  let gSlider: ReturnType<typeof range>, eSlider: ReturnType<typeof range>, muSlider: ReturnType<typeof range>, dragSlider: ReturnType<typeof range>;
  const setG = (v: number) => { W.g = v; gSlider.set(v); };
  const setMat = (e: number, mu: number, drag = 0) => { W.e = e; W.mu = mu; W.drag = drag; eSlider.set(e); muSlider.set(mu); dragSlider.set(drag); };

  /* ---------- presets ---------- */
  const PRESETS: Record<string, () => void> = {
    play() { clearAll(); setG(9.81); setMat(.6, .2); W.walls.push({ x1: .6, y1: 4.2, x2: 4.4, y2: 2.7 }, { x1: 9.4, y1: 2.6, x2: 6.2, y2: 1.3 });
      for (let i = 0; i < 6; i++) W.add(1 + i * .45, 5.4, .14 + R() * .12, PAL[i % PAL.length]);
      const p = W.add(6.4, 5.4, .05, '#888', true), q = W.add(7.8, 4.6, .25, PAL[1]); W.link(p, q, 'rod');
      say(t('h.play', 'Click or tap to drop a ball; drag back and let go to throw it.')); },
    cradle() { clearAll(); setG(9.81); setMat(1, 0);
      const r = .3, L0 = 2.6;
      for (let i = 0; i < 5; i++) { const x = 3.8 + i * (2 * r + .002), p = W.add(x, 5.6, .04, '#888', true), b = W.add(x, 5.6 - L0, r, '#c9ccd6'); W.link(p, b, 'rod'); }
      const p = W.balls[0], b = W.balls[1], a = -50 * Math.PI / 180; b.x = p.x + Math.sin(a) * L0; b.y = p.y - Math.cos(a) * L0; b.px = b.x; b.py = b.y;
      say(t('h.cradle', 'Momentum and energy pass through the row. Lower the bounciness to see what a real, slightly soft cradle does.')); },
    galton() { clearAll(); setG(9.81); setMat(.25, .05); st.galton = true;
      const rows = 12, dx = .3, top = 5.0, cx = BW / 2;
      for (let r = 0; r < rows; r++) for (let k = 0; k <= r; k++) W.add(cx + (k - r / 2) * dx, top - r * .2, .035, '#556', true);
      W.walls.push({ x1: cx - .32, y1: 5.15, x2: cx - 1.88, y2: 2.7 }, { x1: cx + .32, y1: 5.15, x2: cx + 1.88, y2: 2.7 });
      for (let k = 0; k <= rows + 1; k++) { const x = cx + (k - (rows + 1) / 2) * dx; W.walls.push({ x1: x, y1: 0, x2: x, y2: 2.25 }); }
      st.pour = 160; say(t('h.galton', 'Each ball goes left or right at every peg by chance. The pile builds the bell curve; the red numbers are the exact binomial prediction for the same number of balls.')); },
    chaos() { clearAll(); setG(9.81); setMat(.5, 0); st.chaos = true; st.trails = true; trailBox.checked = true;
      const px = BW / 2, py = 4.6, l = 1.25;
      [[0, '#f2c46d'], [.0002, '#7fb2ff']].forEach(([d, col]) => {
        const p = W.add(px, py, .04, '#888', true), a1 = 2.2 + (d as number), a2 = 2.6;
        const m1 = W.add(px + Math.sin(a1) * l, py - Math.cos(a1) * l, .12, col as string), m2 = W.add(W.balls[m1].x + Math.sin(a2) * l, W.balls[m1].y - Math.cos(a2) * l, .12, col as string);
        for (const i of [m1, m2]) { W.balls[i].ghost = true; W.balls[i].trail = []; }
        W.link(p, m1, 'rod'); W.link(m1, m2, 'rod');
      });
      say(t('h.chaos', 'Two double pendulums start about 0.01° apart. For a few seconds they move as one, then they go completely separate ways: that is chaos.')); },
    chain() { clearAll(); setG(9.81); setMat(.3, .4);
      const n = 22, a = W.add(1.2, 3.4, .06, '#888', true); let prev = a;
      for (let i = 1; i < n; i++) { const b = W.add(1.2 + i * (7.6 / n), 3.4, .09, '#9aa4b8'); W.link(prev, b, 'rope', 0, .39); prev = b; }
      const z = W.add(8.8, 3.4, .06, '#888', true); W.link(prev, z, 'rope', 0, .39);
      for (let i = 0; i < 3; i++) W.add(3 + i * 2, 5.6 + i * .3, .28, PAL[i]);
      say(t('h.chain', 'A hanging chain settles into a catenary, the same curve as power lines. Drop more balls on it.')); },
    springs() { clearAll(); setG(9.81); setMat(.4, .2);
      [[100, '#9be59b'], [400, '#7fb2ff'], [1600, '#ff8a7a']].forEach(([k, col], i) => {
        const x = 2.5 + i * 2.5, p = W.add(x, 5.9, .05, '#888', true), b = W.add(x, 3.4, .15, col as string); W.link(p, b, 'spring', k as number, 1.6);
      });
      say(t('h.springs', 'Same mass, springs of different stiffness. A four times stiffer spring bounces twice as fast: period = 2π√(m/k).')); },
    pool() { clearAll(); setG(0); setMat(.95, .05, .25);
      const r = .17; let c = 0;
      for (let row = 0; row < 5; row++) for (let k = 0; k <= row; k++) W.add(6.2 + row * (2 * r + .01) * .866, BH / 2 + (k - row / 2) * (2 * r + .01), r, PAL[c++ % PAL.length]);
      W.walls.push({ x1: 0, y1: BH, x2: BW, y2: BH });
      W.add(1.6, BH / 2 + .03, r, '#f4f1ea', false, 9, 0);
      say(t('h.pool', 'No gravity, seen from above. Throw the white ball with the ball tool for another break.')); },
  };

  /* ---------- panel ---------- */
  heading(L.panel, t('toolh', 'Tool'));
  const TOOLS: [string, string][] = [['ball', t('t.ball', 'Ball')], ['wall', t('t.wall', 'Wall')], ['rod', t('t.rod', 'Rod')], ['rope', t('t.rope', 'Rope')], ['spring', t('t.spring', 'Spring')], ['pin', t('t.pin', 'Pin')], ['grab', t('t.grab', 'Grab')], ['erase', t('t.erase', 'Erase')]];
  const HELP: Record<string, string> = {
    ball: t('u.ball', 'Tap to drop a ball. Drag back and let go to throw it, like a slingshot.'), wall: t('u.wall', 'Drag to draw a wall or ramp.'),
    rod: t('u.rod', 'Drag from one ball to another to join them with a stiff rod. Start or end on empty space to make a fixed pin there.'),
    rope: t('u.rope', 'Drag between two balls (or empty space for a pin) to tie a rope. A rope can go slack but never stretch.'),
    spring: t('u.spring', 'Drag between two balls (or empty space for a pin) to add a spring. Its stiffness is set below.'),
    pin: t('u.pin', 'Tap a ball to fix it in place, or tap again to free it.'), grab: t('u.grab', 'Drag any ball around. Let go while moving to fling it.'), erase: t('u.erase', 'Tap a ball or a wall to remove it.'),
  };
  const usage = h('p', { class: 'wk-note' });
  seg(L.panel, t('tool', 'Tool'), TOOLS, st.tool, (v) => { st.tool = v; usage.textContent = HELP[v]; });
  L.panel.append(usage); usage.textContent = HELP[st.tool];
  range(L.panel, t('size', 'Ball size'), { min: .06, max: .45, step: .01, value: st.size, fmt: (n) => Math.round(n * 200) + ' cm · ' + massOf(n).toFixed(1) + ' kg' }, (v) => { st.size = v; });
  let springK = 120;
  range(L.panel, t('stiff', 'Spring stiffness'), { min: 10, max: 2000, step: 10, value: springK, fmt: (n) => n + ' N/m' }, (v) => { springK = v; });
  heading(L.panel, t('worldh', 'World'));
  gSlider = range(L.panel, t('grav', 'Gravity'), { min: 0, max: 25, step: .01, value: W.g, fmt: (n) => n.toFixed(2) + ' m/s²' }, (v) => { W.g = v; });
  buttons(L.panel, [[t('g.0', 'Space'), () => setG(0)], [t('g.moon', 'Moon'), () => setG(1.62)], [t('g.mars', 'Mars'), () => setG(3.71)], [t('g.earth', 'Earth'), () => setG(9.81)], [t('g.jup', 'Jupiter'), () => setG(24.79)]]);
  eSlider = range(L.panel, t('bounce', 'Bounciness'), { min: 0, max: 1, step: .01, value: W.e, fmt: (n) => Math.round(n * 100) + ' %' }, (v) => { W.e = v; });
  muSlider = range(L.panel, t('fric', 'Friction'), { min: 0, max: 1, step: .01, value: W.mu, fmt: (n) => n.toFixed(2) }, (v) => { W.mu = v; });
  dragSlider = range(L.panel, t('air', 'Air drag'), { min: 0, max: 2, step: .05, value: 0, fmt: (n) => n.toFixed(2) }, (v) => { W.drag = v; });
  range(L.panel, t('slow', 'Speed'), { min: .1, max: 1, step: .05, value: 1, fmt: (n) => (n === 1 ? t('real', 'real time') : '× ' + n.toFixed(2)) }, (v) => { st.slow = v; });
  const trailBox = check(L.panel, t('trails', 'Draw trails'), false, (v) => { st.trails = v; for (const b of W.balls) b.trail = v && b.w ? [] : undefined; });
  const ctl = buttons(L.panel, [[t('pause', 'Pause'), () => { st.paused = !st.paused; ctl[0].textContent = st.paused ? t('play', 'Play') : t('pause', 'Pause'); }], [t('stepb', 'Step'), () => { W.step(1 / 60); }], [t('drop', 'Drop a ball'), () => { W.add(1 + R() * (BW - 2), BH - .5, st.size, PAL[Math.floor(R() * PAL.length)]); }], [t('clearb', 'Clear'), () => { clearAll(); say(''); }]]);
  heading(L.panel, t('preh', 'Classic demonstrations'));
  const PRE: [string, string][] = [['play', t('p.play', 'Playground')], ['cradle', t('p.cradle', 'Newton\'s cradle')], ['galton', t('p.galton', 'Galton board')], ['chaos', t('p.chaos', 'Chaos')], ['chain', t('p.chain', 'Hanging chain')], ['springs', t('p.springs', 'Springs')], ['pool', t('p.pool', 'Pool break')]];
  const prow = h('div', { class: 'wk-row' }); for (const [k, n] of PRE) prow.append(h('button', { type: 'button', class: 'wk-b', text: n, onclick: () => PRESETS[k]() })); L.panel.append(prow);
  heading(L.panel, t('enh', 'Energy'));
  const info = stats(L.panel, [['n', t('objs', 'Balls')], ['ke', t('ke', 'Kinetic')], ['pe', t('pe', 'Potential')], ['se', t('se', 'In springs')], ['tot', t('tot', 'Total')], ['chg', t('chg', 'Change in 5 s')]]);
  note(L.panel, t('n.phys', 'Energy is counted in joules (1 m box squares, 100 kg per square metre of ball). With bounciness at 100 %, no friction and no air drag the total should stay nearly constant (the solver itself loses about 0.3 % a second on a big pendulum swing). Every bounce below 100 % and every rub turns some energy into heat, which this box does not track. The solver works in 20 small steps per frame so stacks and chains stay stable.'));

  /* ---------- input ---------- */
  const view = () => { const s = Math.min(S.w / BW, S.h / BH) * .97; return { s, ox: (S.w - BW * s) / 2, oy: (S.h - BH * s) / 2 }; };
  const toW = (px: number, py: number) => { const v = view(); return { x: (px - v.ox) / v.s, y: BH - (py - v.oy) / v.s }; };
  const hit = (x: number, y: number) => { let best = -1, bd = Infinity; W.balls.forEach((b, i) => { const d = Math.hypot(b.x - x, b.y - y) - b.r; if (d < .12 && d < bd) { bd = d; best = i; } }); return best; };
  let down: { x: number; y: number; i: number } | null = null, cur = { x: 0, y: 0 }, grab: { i: number; x: number; y: number } | null = null, lastGrab = { x: 0, y: 0, t: 0 }, grabV = { x: 0, y: 0 };
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv), w = toW(p.x, p.y); S.cv.setPointerCapture(e.pointerId); cur = w;
    down = { ...w, i: hit(w.x, w.y) };
    if (st.tool === 'grab' && down.i >= 0) { grab = { i: down.i, ...w }; lastGrab = { ...w, t: performance.now() }; }
  });
  S.cv.addEventListener('pointermove', (e) => {
    const p = local(e, S.cv); cur = toW(p.x, p.y);
    if (grab) { const now = performance.now(), dtm = Math.max(1, now - lastGrab.t) / 1000; grabV = { x: (cur.x - lastGrab.x) / dtm, y: (cur.y - lastGrab.y) / dtm }; lastGrab = { ...cur, t: now }; grab.x = cur.x; grab.y = cur.y; }
  });
  const end = () => {
    if (!down) return; const a = down, b = cur, moved = Math.hypot(b.x - a.x, b.y - a.y) > .08; down = null;
    switch (st.tool) {
      case 'ball': { const r = st.size, x = clamp(a.x, r, BW - r), y = clamp(a.y, r, BH + 2); W.add(x, y, r, PAL[Math.floor(R() * PAL.length)], false, moved ? (a.x - b.x) * 4 : 0, moved ? (a.y - b.y) * 4 : 0); if (st.trails) W.balls[W.balls.length - 1].trail = []; break; }
      case 'wall': if (moved) W.walls.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }); break;
      case 'rod': case 'rope': case 'spring': {
        if (!moved) { say(t('dragto', 'Drag from one point to another to connect them.')); break; }
        const ia = a.i >= 0 ? a.i : W.add(a.x, a.y, .05, '#888', true); let ib = hit(b.x, b.y); if (ib < 0 || ib === ia) ib = W.add(b.x, b.y, .05, '#888', true);
        W.link(ia, ib, st.tool as Link['kind'], springK); break;
      }
      case 'pin': if (a.i >= 0) { const bb = W.balls[a.i]; bb.w = bb.w ? 0 : 1 / massOf(bb.r); bb.vx = bb.vy = 0; } break;
      case 'grab': if (grab && W.balls[grab.i]?.w) { const bb = W.balls[grab.i]; bb.vx = clamp(grabV.x, -30, 30); bb.vy = clamp(grabV.y, -30, 30); } grab = null; break;
      case 'erase': {
        if (a.i >= 0) { W.remove(a.i); break; }
        let wi = -1, wd = .15; W.walls.forEach((w, i) => { if (i < 3) return; const ex = w.x2 - w.x1, ey = w.y2 - w.y1, tt = clamp(((a.x - w.x1) * ex + (a.y - w.y1) * ey) / (ex * ex + ey * ey || 1), 0, 1), d = Math.hypot(a.x - w.x1 - ex * tt, a.y - w.y1 - ey * tt); if (d < wd) { wd = d; wi = i; } });
        if (wi >= 0) W.walls.splice(wi, 1); break;
      }
    }
  };
  S.cv.addEventListener('pointerup', end); S.cv.addEventListener('pointercancel', () => { down = null; grab = null; });

  /* ---------- drawing ---------- */
  let statT = 0, chaosT = 0;
  const binom = (n: number, k: number) => { let c = 1; for (let i = 1; i <= k; i++) c = c * (n - i + 1) / i; return c; };
  function draw() {
    const g = S.g, v = view(), X = (x: number) => v.ox + x * v.s, Y = (y: number) => v.oy + (BH - y) * v.s;
    g.fillStyle = '#0a0c12'; g.fillRect(0, 0, S.w, S.h);
    g.fillStyle = '#10131c'; g.fillRect(X(0), Y(BH), BW * v.s, BH * v.s);
    g.strokeStyle = 'rgba(255,255,255,.045)'; g.lineWidth = 1;
    for (let x = 1; x < BW; x++) { g.beginPath(); g.moveTo(X(x), Y(0)); g.lineTo(X(x), Y(BH)); g.stroke(); }
    for (let y = 1; y < BH; y++) { g.beginPath(); g.moveTo(X(0), Y(y)); g.lineTo(X(BW), Y(y)); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText('1 m', X(.05), Y(BH - .2));
    g.strokeStyle = '#c8cfdd'; g.lineCap = 'round'; g.lineWidth = Math.max(3, .05 * v.s);
    for (const w of W.walls) { g.beginPath(); g.moveTo(X(w.x1), Y(w.y1)); g.lineTo(X(w.x2), Y(w.y2)); g.stroke(); }
    /* trails */
    if (st.trails) for (const b of W.balls) if (b.trail && b.trail.length > 3) { g.strokeStyle = b.col + '88'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < b.trail.length; i += 2) { const x = X(b.trail[i]), y = Y(b.trail[i + 1]); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    /* links */
    for (const l of W.links) {
      const A = W.balls[l.a], B = W.balls[l.b]; if (!A || !B) continue; const ax = X(A.x), ay = Y(A.y), bx = X(B.x), by = Y(B.y);
      if (l.kind === 'spring') {
        const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, coils = 12, amp = 6;
        const stretch = (Math.hypot(B.x - A.x, B.y - A.y) - l.L) / l.L; g.strokeStyle = stretch > 0 ? `rgb(255,${clamp(200 - stretch * 300, 90, 200)},120)` : '#9fd0ff'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(ax, ay); for (let i = 1; i < coils * 2; i++) { const f = i / (coils * 2), s = (i % 2 ? 1 : -1) * amp; g.lineTo(ax + dx * f + nx * s, ay + dy * f + ny * s); } g.lineTo(bx, by); g.stroke();
      } else {
        const slack = l.kind === 'rope' && Math.hypot(B.x - A.x, B.y - A.y) < l.L - .01;
        g.strokeStyle = l.kind === 'rod' ? '#aab3c5' : '#d8c49a'; g.lineWidth = l.kind === 'rod' ? 2.4 : 1.4; if (slack) g.setLineDash([4, 4]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
      }
    }
    /* balls */
    for (const b of W.balls) {
      const x = X(b.x), y = Y(b.y), r = Math.max(2, b.r * v.s);
      if (!b.w && b.r <= .06) { g.fillStyle = '#5b6274'; g.beginPath(); g.arc(x, y, Math.max(3, r), 0, 7); g.fill(); g.strokeStyle = '#c8cfdd'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y); g.moveTo(x, y - 4); g.lineTo(x, y + 4); g.stroke(); continue; }
      const gr = g.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, b.col); gr.addColorStop(1, shadeCol(b.col));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (!b.w) { g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r + 2, 0, 7); g.stroke(); }
    }
    /* slingshot, wall and link previews */
    if (down) {
      const a = down; g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.setLineDash([5, 4]);
      if (st.tool === 'ball') { g.beginPath(); g.arc(X(a.x), Y(a.y), st.size * v.s, 0, 7); g.stroke(); g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(cur.x), Y(cur.y)); g.stroke(); }
      else if (st.tool === 'wall' || st.tool === 'rod' || st.tool === 'rope' || st.tool === 'spring') { g.beginPath(); g.moveTo(X(a.x), Y(a.y)); g.lineTo(X(cur.x), Y(cur.y)); g.stroke(); }
      g.setLineDash([]);
    }
    /* Galton bins: counts and the binomial prediction */
    if (st.galton) {
      const rows = 12, dx = .3, cx = BW / 2, nb = rows + 1, cnt = new Array(nb).fill(0);
      for (const b of W.balls) if (b.w && b.y < 2.3) { const k = Math.floor((b.x - (cx - nb / 2 * dx)) / dx); if (k >= 0 && k < nb) cnt[k]++; }
      const N = cnt.reduce((s, c) => s + c, 0);
      const narrow = dx * v.s < 26; g.font = (narrow ? 8 : 10) + 'px ui-monospace,monospace'; g.textAlign = 'center';
      for (let k = 0; k < nb; k++) {
        const x = cx + (k - rows / 2) * dx; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(String(cnt[k]), X(x), Y(2.25) - 15);
        if (N > 0) { const ex = N * binom(rows, k) / 2 ** rows; g.fillStyle = '#ff8a7a'; g.fillText(narrow ? String(Math.round(ex)) : ex.toFixed(1), X(x), Y(2.25) - 4); }
      }
      g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(t('gal.you', 'balls in each bin'), X(.15), Y(BH) + 30);
      g.fillStyle = '#ff8a7a'; g.fillText(t('gal.exp', 'binomial prediction'), X(.15), Y(BH) + 43);
    }
    if (st.chaos && W.balls.length >= 6) {
      const a = W.balls[2], b = W.balls[5], d = Math.hypot(a.x - b.x, a.y - b.y);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '11px ui-monospace,monospace'; g.textAlign = 'left';
      g.fillText(`${t('apart', 'apart')}: ${d < .01 ? (d * 1000).toFixed(2) + ' mm' : d.toFixed(2) + ' m'} · ${chaosT.toFixed(1)} s`, X(.15), Y(.25));
    }
    /* energy strip */
    if (hist.length > 2) {
      const w = Math.min(220, S.w * .32), hh = S.w < 500 ? 40 : 54, x0 = X(BW) - w - 8, y0 = Y(BH) + 8, mx = Math.max(1, ...hist.map((e) => e[0] + e[1] + e[2]));
      g.fillStyle = 'rgba(10,12,18,.75)'; g.fillRect(x0, y0, w, hh);
      const line = (f: (e: [number, number, number]) => number, col: string) => { g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); hist.forEach((e, i) => { const x = x0 + i / (300 - 1) * w, y = y0 + hh - f(e) / mx * (hh - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
      line((e) => e[0], '#f2c46d'); line((e) => e[1], '#7fb2ff'); line((e) => e[2], '#9be59b'); line((e) => e[0] + e[1] + e[2], '#ffffff');
      g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '9px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(t('enl', 'energy, last 5 s'), x0 + 4, y0 + 10);
    }
  }
  const shadeCol = (hx: string) => { const n = parseInt(hx.slice(1), 16), k = .45; return `rgb(${((n >> 16) & 255) * k | 0},${((n >> 8) & 255) * k | 0},${(n & 255) * k | 0})`; };

  PRESETS.play();
  loop(ctx, S.cv, (dt) => {
    if (!st.paused) {
      const step = dt * st.slow;
      if (st.pour > 0) { st.pourT += step; while (st.pourT > .11 && st.pour > 0) { st.pourT -= .11; st.pour--; const i = W.add(BW / 2 + (R() - .5) * .04, 5.45, .07, PAL[st.pour % PAL.length], false, 0, -1.6); if (st.trails) W.balls[i].trail = []; } }
      W.step(step, grab);
      if (st.chaos) chaosT += step;
      if (st.trails) for (const b of W.balls) if (b.trail) { b.trail.push(b.x, b.y); if (b.trail.length > (st.chaos ? 900 : 240)) b.trail.splice(0, 2); }
      const en = W.energy(); hist.push([en.ke, en.pe, en.se]); if (hist.length > 300) hist.shift();
    }
    draw();
    statT += dt; if (statT > .25) {
      statT = 0; const en = W.energy(), tot = en.ke + en.pe + en.se, j = (n: number) => (n < 10 ? n.toFixed(2) : n < 1000 ? n.toFixed(1) : Math.round(n).toLocaleString(ctx.lang)) + ' J';
      info('n', String(W.balls.filter((b) => b.w).length)); info('ke', j(en.ke)); info('pe', j(en.pe)); info('se', j(en.se)); info('tot', j(tot));
      if (hist.length >= 300) { const o = hist[0], ot = o[0] + o[1] + o[2]; info('chg', ot > .01 ? `${tot >= ot ? '+' : ''}${((tot / ot - 1) * 100).toFixed(1)} %` : '—'); } else info('chg', '—');
    }
  });
}
