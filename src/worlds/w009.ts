/* 009 Digital Fashion Lab: Fabric Physics. A cloth simulated as a grid of particles joined by
   springs (Verlet integration with constraint relaxation). Each fabric has its own weight,
   stiffness and tear strength. Drag it, cut it, pin it, blow wind through it. */
import { type Ctx, layout, canvas, heading, note, seg, range, buttons, check, stats, loop, local, hex2rgb, clamp } from './kit';

interface Fab { name: string; mass: number; stiff: number; iters: number; tear: number; damp: number; c1: string; c2: string; pat: 'plain' | 'stripe' | 'check' | 'denim' }
const FABS: Record<string, Fab> = {
  silk: { name: 'Silk charmeuse', mass: .6, stiff: .9, iters: 4, tear: 2.6, damp: .995, c1: '#c94f6d', c2: '#e88aa0', pat: 'plain' },
  cotton: { name: 'Cotton shirting', mass: 1, stiff: 1, iters: 6, tear: 3, damp: .99, c1: '#e9e4d8', c2: '#7aa2d6', pat: 'stripe' },
  denim: { name: 'Denim', mass: 1.6, stiff: 1, iters: 10, tear: 4, damp: .985, c1: '#22406e', c2: '#3c5f91', pat: 'denim' },
  wool: { name: 'Wool tartan', mass: 1.3, stiff: 1, iters: 8, tear: 3.5, damp: .985, c1: '#7a1f24', c2: '#1c3a2a', pat: 'check' },
  chiffon: { name: 'Chiffon', mass: .35, stiff: .8, iters: 3, tear: 2.2, damp: .997, c1: '#e8d7f5', c2: '#c7b2e0', pat: 'plain' },
};
type Pt = { x: number; y: number; px: number; py: number; pin: boolean };
type Ln = { a: number; b: number; r: number; on: boolean };

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.background = 'linear-gradient(180deg, color-mix(in srgb,var(--bone) 7%,transparent), transparent)';
  const S = canvas(L.view, t('cloth', 'Hanging cloth simulation'));
  let fab = FABS.cotton, COLS = 34, ROWS = 26, wind = .25, gravity = 1, tool = 'drag', pins = 'top', shade = true;
  let P: Pt[] = [], Ln: Ln[] = [], torn = 0;
  let edgeMap = new Map<number, number>();
  const info = stats(L.panel, [['pts', t('pts', 'Particles')], ['links', t('links', 'Springs')], ['torn', t('torn', 'Torn')], ['fps', t('fps', 'Frame rate')]]);

  function build() {
    P = []; Ln = []; torn = 0;
    const W = Math.min(S.w * .62, 620), sp = W / (COLS - 1), x0 = (S.w - W) / 2, y0 = S.h * .1;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const px = x0 + x * sp, py = y0 + y * sp * .96;
      const pin = y === 0 && (pins === 'top' || (pins === 'corners' && (x === 0 || x === COLS - 1)) || (pins === 'three' && (x === 0 || x === COLS - 1 || x === (COLS >> 1))));
      P.push({ x: px, y: py, px, py, pin });
    }
    const idx = (x: number, y: number) => y * COLS + x;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (x < COLS - 1) Ln.push({ a: idx(x, y), b: idx(x + 1, y), r: sp, on: true });
      if (y < ROWS - 1) Ln.push({ a: idx(x, y), b: idx(x, y + 1), r: sp * .96, on: true });
    }
  }
  S.onResize(() => { build(); rebuildMap(); });
  let cutting = false, grab: { i: number; ox: number; oy: number } | null = null, mouse = { x: 0, y: 0, px: 0, py: 0, down: false };
  const nearest = (x: number, y: number, r: number) => { let b = -1, bd = r * r; P.forEach((p, i) => { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  S.cv.addEventListener('pointerdown', (e) => {
    const m = local(e, S.cv); mouse = { ...m, px: m.x, py: m.y, down: true }; S.cv.setPointerCapture(e.pointerId);
    cutting = tool === 'cut' || e.button === 2 || e.altKey;
    if (tool === 'pin') { const i = nearest(m.x, m.y, 30); if (i >= 0) P[i].pin = !P[i].pin; return; }
    if (!cutting) { const i = nearest(m.x, m.y, 40); if (i >= 0) grab = { i, ox: P[i].x - m.x, oy: P[i].y - m.y }; }
  });
  S.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  S.cv.addEventListener('pointermove', (e) => { const m = local(e, S.cv); mouse.px = mouse.x; mouse.py = mouse.y; mouse.x = m.x; mouse.y = m.y; });
  const up = () => { mouse.down = false; grab = null; cutting = false; };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);

  function cutAlong(x1: number, y1: number, x2: number, y2: number) {
    for (const l of Ln) {
      if (!l.on) continue; const a = P[l.a], b = P[l.b];
      const d = (x2 - x1) * (b.y - a.y) - (y2 - y1) * (b.x - a.x); if (Math.abs(d) < 1e-6) continue;
      const u = ((a.x - x1) * (b.y - a.y) - (a.y - y1) * (b.x - a.x)) / d, v = ((a.x - x1) * (y2 - y1) - (a.y - y1) * (x2 - x1)) / d;
      if (u >= 0 && u <= 1 && v >= 0 && v <= 1) { l.on = false; torn++; }
      else { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; if ((mx - x2) ** 2 + (my - y2) ** 2 < 36) { l.on = false; torn++; } }
    }
  }
  let fpsN = 0, fpsT = 0, time = 0;
  function step(dt: number) {
    time += dt;
    const g = 900 * gravity * fab.mass ** .2, k = dt * dt;
    const wx = wind * 260 * (Math.sin(time * 1.3) * .5 + .7);
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.pin) continue;
      const vx = (p.x - p.px) * fab.damp, vy = (p.y - p.py) * fab.damp;
      p.px = p.x; p.py = p.y;
      const gust = wx * (0.6 + .4 * Math.sin(time * 3 + (i % COLS) * .3 + Math.floor(i / COLS) * .2)) / fab.mass;
      p.x += vx + gust * k; p.y += vy + g * k;
      if (p.y > S.h - 4) { p.y = S.h - 4; p.px = p.x - vx * .5; }
    }
    if (grab) { const p = P[grab.i]; p.x = mouse.x + grab.ox; p.y = mouse.y + grab.oy; }
    if (mouse.down && cutting) cutAlong(mouse.px, mouse.py, mouse.x, mouse.y);
    for (let it = 0; it < fab.iters; it++) for (const l of Ln) {
      if (!l.on) continue; const a = P[l.a], b = P[l.b];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6;
      if (d > l.r * fab.tear) { l.on = false; torn++; continue; }
      const diff = (d - l.r) / d * .5 * fab.stiff, ox = dx * diff, oy = dy * diff;
      if (!a.pin) { a.x += ox; a.y += oy; } if (!b.pin) { b.x -= ox; b.y -= oy; }
    }
  }
  function draw() {
    const g = S.g; g.clearRect(0, 0, S.w, S.h);
    /* rail */
    const top = P.filter((p, i) => i < COLS); if (top.length) { g.strokeStyle = 'rgba(200,200,200,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(S.w * .1, top[0].py < 0 ? 0 : S.h * .1 - 6); g.lineTo(S.w * .9, S.h * .1 - 6); g.stroke(); }
    const c1 = hex2rgb(fab.c1), c2 = hex2rgb(fab.c2);
    /* draw quads whose four edges still exist; shade by how stretched / tilted the cell is */
    for (let y = 0; y < ROWS - 1; y++) for (let x = 0; x < COLS - 1; x++) {
      const i = y * COLS + x, a = P[i], b = P[i + 1], c = P[i + COLS + 1], d = P[i + COLS];
      if (!cellOk(x, y)) continue;
      const ex = b.x - a.x, ey = b.y - a.y, fx = d.x - a.x, fy = d.y - a.y;
      const area = ex * fy - ey * fx, rest = (S.w * .62 / (COLS - 1)) ** 2;
      let k = shade ? clamp(.55 + .45 * (area / rest) + (ey / (Math.hypot(ex, ey) + 1e-6)) * .35, .25, 1.15) : 1;
      if (area < 0) k *= .6; // we see the back of the cloth
      const col = pattern(x, y) ? c2 : c1;
      g.fillStyle = `rgb(${col[0] * k | 0},${col[1] * k | 0},${col[2] * k | 0})`;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath(); g.fill();
      g.strokeStyle = g.fillStyle; g.lineWidth = .6; g.stroke();
    }
    g.fillStyle = '#e8b46a'; P.forEach((p) => { if (p.pin) { g.beginPath(); g.arc(p.x, p.y, 3.2, 0, Math.PI * 2); g.fill(); } });
    if (tool === 'cut' && mouse.down) { g.strokeStyle = 'rgba(255,90,90,.9)'; g.beginPath(); g.arc(mouse.x, mouse.y, 6, 0, Math.PI * 2); g.stroke(); }
  }
  /* a cell is drawn while its four edges are intact; edges are found by their particle pair */
  const rebuildMap = () => { edgeMap = new Map(); Ln.forEach((l, i) => edgeMap.set(l.a * 100000 + l.b, i)); };
  const edgeOn = (a: number, b: number) => { const i = edgeMap.get(a * 100000 + b); return i !== undefined && Ln[i].on; };
  function cellOk(x: number, y: number) { const i = y * COLS + x; return edgeOn(i, i + 1) && edgeOn(i, i + COLS) && edgeOn(i + 1, i + 1 + COLS) && edgeOn(i + COLS, i + COLS + 1); }
  function pattern(x: number, y: number) {
    if (fab.pat === 'stripe') return x % 4 < 1;
    if (fab.pat === 'check') return (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
    if (fab.pat === 'denim') return (x + y) % 3 === 0;
    return false;
  }
  heading(L.panel, t('fabric', 'Fabric'));
  seg(L.panel, t('type', 'Type'), Object.entries(FABS).map(([k, f]) => [k, t('f.' + k, f.name)]), 'cotton', (v) => { fab = FABS[v]; });
  seg(L.panel, t('tool', 'Your hand'), [['drag', t('t.drag', 'Drag')], ['cut', t('t.cut', 'Scissors')], ['pin', t('t.pin', 'Pin / unpin')]], tool, (v) => { tool = v; });
  seg(L.panel, t('hang', 'Hanging from'), [['top', t('h.top', 'Whole top')], ['corners', t('h.corners', 'Two corners')], ['three', t('h.three', 'Three pins')]], pins, (v) => { pins = v; build(); rebuildMap(); });
  heading(L.panel, t('env', 'Environment'));
  range(L.panel, t('wind', 'Wind'), { min: 0, max: 1.5, step: .05, value: wind, fmt: (v) => Math.round(v * 100) + '%' }, (v) => { wind = v; });
  range(L.panel, t('grav', 'Gravity'), { min: 0, max: 2, step: .05, value: gravity, fmt: (v) => v.toFixed(2) + ' g' }, (v) => { gravity = v; });
  range(L.panel, t('res', 'Resolution'), { min: 14, max: 48, step: 2, value: COLS, fmt: (v) => `${v} × ${Math.round(v * .76)}` }, (v) => { COLS = v; ROWS = Math.round(v * .76); build(); rebuildMap(); });
  check(L.panel, t('shade', 'Light and shadow'), shade, (v) => { shade = v; });
  buttons(L.panel, [[t('reset', 'New cloth'), () => { build(); rebuildMap(); }, true], [t('drop', 'Drop it'), () => { P.forEach((p) => { p.pin = false; }); }]]);
  note(L.panel, t('how', 'Each frame every particle keeps its momentum (Verlet integration), then every spring is pulled back toward its rest length several times. Heavier, stiffer fabrics get more passes and tear later. Right-click or Alt-drag also cuts.'));
  build(); rebuildMap();
  loop(ctx, S.cv, (dt) => {
    const sub = 2; for (let i = 0; i < sub; i++) step(dt / sub);
    draw();
    fpsN++; fpsT += dt; if (fpsT > .5) { info('fps', Math.round(fpsN / fpsT) + ' fps'); fpsN = 0; fpsT = 0; info('pts', String(P.length)); info('links', String(Ln.filter((l) => l.on).length)); info('torn', String(torn)); }
  });
  L.hud.textContent = t('hud', 'Drag the cloth · switch to scissors to cut');
}
