/* 015 Concept Car Lab: shape a car's side profile by dragging its control points, then watch air
   flow round it in a real 2D lattice-Boltzmann wind tunnel (D2Q9, BGK collision, moving floor).
   Drag is measured by momentum exchange on the body, so a smoother shape really scores lower. */
import { type Ctx, h, layout, canvas, heading, note, seg, buttons, stats, loop, local, store, clamp, download } from './kit';

const NX = 240, NY = 120, GROUND = NY - 4, U0 = .08, TAU = .56, RAMP = 800, SPONGE = 40;
const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1], CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36], OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6], RY = [0, 1, 4, 3, 2, 8, 7, 6, 5];
type P = [number, number];
/* top-profile control points (x, height above the floor) from nose to tail */
const PRESETS: Record<string, { name: string; pts: P[]; clear: number; wheels: boolean }> = {
  saloon: { name: 'Saloon', pts: [[55, 6], [57, 13], [72, 17], [92, 19], [108, 30], [138, 31], [158, 25], [172, 22], [174, 10]], clear: 3, wheels: true },
  tear: { name: 'Teardrop', pts: [[52, 5], [56, 12], [70, 20], [90, 26], [110, 28], [132, 26], [152, 21], [170, 15], [182, 8]], clear: 3, wheels: true },
  wedge: { name: 'Wedge', pts: [[52, 5], [56, 8], [80, 14], [100, 19], [112, 26], [140, 27], [160, 25], [172, 24], [173, 9]], clear: 3, wheels: true },
  van: { name: 'Van', pts: [[55, 6], [56, 18], [66, 22], [74, 36], [86, 38], [140, 38], [160, 38], [172, 37], [173, 6]], clear: 3, wheels: true },
  brick: { name: 'Brick (reference)', pts: [[60, 4], [60, 32], [80, 32], [100, 32], [120, 32], [140, 32], [160, 32], [170, 32], [170, 4]], clear: 3, wheels: true },
};

export default function (ctx: Ctx) {
  const t = ctx.t;
  const saved = store(15, 'shape', { preset: 'saloon', pts: PRESETS.saloon.pts }, (v) => !!v && Array.isArray((v as { pts: unknown }).pts) && (v as { pts: unknown[] }).pts.length === 9);
  let pts: P[] = saved.get().pts.map((p) => [clamp(+p[0], 40, 200), clamp(+p[1], 2, 60)] as P), preset = saved.get().preset;
  let sum = 0, cnt = 0, spf = 8, view: 'speed' | 'curl' | 'press' = 'speed', smoke = true, drag = 0, steps = 0;
  const results: { name: string; cd: number }[] = [];
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#7ee0ff');
  L.view.style.background = '#06080b';
  const frame = h('div', { style: { position: 'relative', width: 'calc(100% - 24px)', aspectRatio: `${NX} / ${NY}`, borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,.12)' } });
  L.view.append(frame);
  const S = canvas(frame, t('cv', 'Wind tunnel: drag the white points to reshape the car'));
  const img = new ImageData(NX, NY), off = h('canvas', { width: NX, height: NY }) as HTMLCanvasElement, og = off.getContext('2d')!;
  const info = stats(L.panel, [['cd', t('cd', 'Drag index')], ['h', t('front', 'Frontal height')], ['re', t('re', 'Reynolds no.')], ['t', t('time', 'Tunnel time')]]);

  /* ---------- lattice ---------- */
  const N = NX * NY;
  let f = Array.from({ length: 9 }, () => new Float32Array(N)), f2 = Array.from({ length: 9 }, () => new Float32Array(N));
  const solid = new Uint8Array(N), rho = new Float32Array(N), ux = new Float32Array(N), uy = new Float32Array(N);
  const feq = (i: number, r: number, u: number, v: number) => { const cu = 3 * (CX[i] * u + CY[i] * v); return W[i] * r * (1 + cu + .5 * cu * cu - 1.5 * (u * u + v * v)); };
  function reset() { for (let k = 0; k < N; k++) for (let i = 0; i < 9; i++) f[i][k] = feq(i, 1, 0, 0); steps = 0; drag = 0; sum = 0; cnt = 0; }
  function profile(): number[] {
    /* Catmull-Rom through the control points, sampled per column */
    const top = new Array(NX).fill(-1), n = pts.length, ext: P[] = [pts[0], ...pts, pts[n - 1]];
    for (let i = 1; i < ext.length - 2; i++) for (let k = 0; k <= 40; k++) { const tt = k / 40, t2 = tt * tt, t3 = t2 * tt; const c = (a: number, b: number, d: number, e: number) => .5 * (2 * b + (-a + d) * tt + (2 * a - 5 * b + 4 * d - e) * t2 + (-a + 3 * b - 3 * d + e) * t3); const x = Math.round(c(ext[i - 1][0], ext[i][0], ext[i + 1][0], ext[i + 2][0])), y = c(ext[i - 1][1], ext[i][1], ext[i + 1][1], ext[i + 2][1]); if (x >= 0 && x < NX) top[x] = Math.max(top[x], y); }
    return top;
  }
  let front = 0;
  function rasterize() {
    solid.fill(0); const top = profile(), P = PRESETS[preset] ?? PRESETS.saloon, base = GROUND - P.clear;
    let x0 = NX, x1 = 0;
    for (let x = 0; x < NX; x++) if (top[x] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let x = x0; x <= x1; x++) { let tp = top[x]; if (tp < 0) { /* fill gaps between samples */ let a = x - 1; while (a > x0 && top[a] < 0) a--; tp = top[a]; } for (let y = Math.floor(GROUND - P.clear - tp); y < base; y++) if (y >= 0) solid[y * NX + x] = 1; }
    if (P.wheels) for (const wx of [x0 + (x1 - x0) * .2, x0 + (x1 - x0) * .8]) for (let y = GROUND - 12; y < GROUND; y++) for (let x = Math.floor(wx - 7); x <= wx + 7; x++) if ((x - wx) ** 2 + (y - (GROUND - 6.5)) ** 2 < 6.5 ** 2) solid[y * NX + x] = 1;
    for (let x = 0; x < NX; x++) for (let y = GROUND; y < NY; y++) solid[y * NX + x] = 2; /* floor */
    let hmax = 0; for (let x = 0; x < NX; x++) for (let y = 0; y < GROUND; y++) if (solid[y * NX + x] === 1) { hmax = Math.max(hmax, GROUND - y); break; }
    front = hmax; info('h', `${front} ${t('cells', 'cells')}`);
    info('re', String(Math.round(U0 * (x1 - x0) / ((TAU - .5) / 3))));
  }
  function step() {
    let fx = 0;
    /* the wind ramps up gently so the start does not send pressure waves through the tunnel */
    const u0 = U0 * Math.min(1, steps / RAMP);
    /* collide; the last columns form a sponge that soaks up waves before the outlet */
    for (let k = 0; k < N; k++) {
      if (solid[k]) continue;
      let r = 0, u = 0, v = 0; for (let i = 0; i < 9; i++) { const q = f[i][k]; r += q; u += q * CX[i]; v += q * CY[i]; }
      u /= r; v /= r; rho[k] = r; ux[k] = u; uy[k] = v;
      for (let i = 0; i < 9; i++) f[i][k] += (feq(i, r, u, v) - f[i][k]) / TAU;
      const x = k % NX; if (x > NX - SPONGE) { const sp = ((x - (NX - SPONGE)) / SPONGE) ** 2 * .3; for (let i = 0; i < 9; i++) f[i][k] += (feq(i, 1, u0, 0) - f[i][k]) * sp; }
    }
    /* stream (pull) with bounce-back; momentum exchange gives the force on the car */
    for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) {
      const k = y * NX + x; if (solid[k]) continue;
      for (let i = 0; i < 9; i++) {
        const sx = x - CX[i], sy = y - CY[i];
        if (sx < 0) { f2[i][k] = feq(i, 1, u0, 0); continue; }
        if (sy < 0 || sy >= NY) { f2[i][k] = f[RY[i]][k]; continue; } /* free-slip roof */
        if (sx >= NX) { f2[i][k] = f[i][k - 1]; continue; } /* open outlet */
        const sk = sy * NX + sx, so = solid[sk];
        if (so === 1) { const o = OPP[i]; f2[i][k] = f[o][k]; fx += 2 * f[o][k] * CX[o]; }
        else if (so === 2) { const o = OPP[i]; f2[i][k] = f[o][k] + 6 * W[i] * (CX[i] * u0); } /* rolling road moves with the air */
        else f2[i][k] = f[i][sk];
      }
    }
    [f, f2] = [f2, f];
    steps++;
    const cd = fx / (.5 * U0 * U0 * Math.max(1, front));
    if (!Number.isFinite(cd)) { reset(); return; }
    /* long running mean after the start-up wave has passed: the instantaneous value swings with vortex shedding */
    if (steps > RAMP + 800) { sum += cd; cnt++; drag = sum / cnt; }
  }
  /* smoke particles released from a rake on the left */
  const smk: { x: number; y: number; a: number }[] = [];
  function render() {
    const d = img.data;
    for (let k = 0; k < N; k++) {
      const o = k * 4;
      if (solid[k] === 1) { d[o] = 226; d[o + 1] = 228; d[o + 2] = 232; d[o + 3] = 255; continue; }
      if (solid[k] === 2) { d[o] = 30; d[o + 1] = 33; d[o + 2] = 38; d[o + 3] = 255; continue; }
      let a: number;
      if (view === 'speed') a = clamp(Math.hypot(ux[k], uy[k]) / (U0 * 1.6), 0, 1);
      else if (view === 'press') a = clamp(.5 + (rho[k] - 1) * 18, 0, 1);
      else { const x = k % NX, y = (k / NX) | 0; const c = x > 0 && x < NX - 1 && y > 0 && y < NY - 1 ? (uy[k + 1] - uy[k - 1]) - (ux[k + NX] - ux[k - NX]) : 0; a = clamp(.5 + c * 12, 0, 1); }
      /* deep blue -> cyan -> warm white -> orange */
      const r = a < .5 ? 10 + a * 2 * 60 : 70 + (a - .5) * 2 * 185, g = a < .5 ? 20 + a * 2 * 170 : 190 - (a - .5) * 2 * 60, b = a < .5 ? 40 + a * 2 * 180 : 220 - (a - .5) * 2 * 190;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
    og.putImageData(img, 0, 0);
    const g = S.g; g.imageSmoothingEnabled = true; g.clearRect(0, 0, S.w, S.h); g.drawImage(off, 0, 0, S.w, S.h);
    const sx = S.w / NX, sy = S.h / NY;
    if (smoke) { g.fillStyle = 'rgba(255,255,255,.75)'; for (const p of smk) g.fillRect(p.x * sx - .8, p.y * sy - .8, 1.6, 1.6); }
    /* handles */
    const P = PRESETS[preset] ?? PRESETS.saloon;
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.setLineDash([3, 3]); g.beginPath(); pts.forEach((p, i) => { const X = p[0] * sx, Y = (GROUND - P.clear - p[1]) * sy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); g.setLineDash([]);
    pts.forEach((p, i) => { g.fillStyle = i === hot ? '#7ee0ff' : '#fff'; g.beginPath(); g.arc(p[0] * sx, (GROUND - P.clear - p[1]) * sy, i === hot ? 6 : 4.5, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#06080b'; g.lineWidth = 1.5; g.stroke(); });
    info('cd', cnt > 200 ? drag.toFixed(2) : t('settling', 'settling…')); info('t', String(steps));
  }
  function advect() {
    if (!smoke) return;
    for (let y = 6; y < GROUND - 2; y += 4) if (smk.length < 7000) smk.push({ x: 1, y: y + Math.random(), a: 0 });
    for (let i = smk.length - 1; i >= 0; i--) { const p = smk[i]; const k = (p.y | 0) * NX + (p.x | 0); if (p.x >= NX - 1 || p.y < 0 || p.y >= GROUND || solid[k]) { smk.splice(i, 1); continue; } p.x += ux[k] * spf; p.y += uy[k] * spf; }
  }
  let hot = -1, dragging = -1;
  const toGrid = (e: PointerEvent) => { const q = local(e, S.cv); return [q.x / S.w * NX, q.y / S.h * NY]; };
  const nearest = (e: PointerEvent) => { const [gx, gy] = toGrid(e), P = PRESETS[preset] ?? PRESETS.saloon; let bi = -1, bd = 7; pts.forEach((p, i) => { const d = Math.hypot(p[0] - gx, GROUND - P.clear - p[1] - gy); if (d < bd) { bd = d; bi = i; } }); return bi; };
  S.cv.addEventListener('pointerdown', (e) => { dragging = nearest(e); if (dragging >= 0) S.cv.setPointerCapture(e.pointerId); });
  S.cv.addEventListener('pointermove', (e) => {
    if (dragging < 0) { hot = nearest(e); S.cv.style.cursor = hot >= 0 ? 'grab' : 'default'; return; }
    const [gx, gy] = toGrid(e), P = PRESETS[preset] ?? PRESETS.saloon; pts[dragging] = [clamp(Math.round(gx), 40, 205), clamp(Math.round(GROUND - P.clear - gy), 2, 60)]; rasterize();
  });
  const up = () => { if (dragging >= 0) { dragging = -1; saved.set({ preset, pts }); reset(); } };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  /* keyboard: Tab focuses the tunnel, [ ] choose a point, arrows move it */
  S.cv.addEventListener('keydown', (e) => {
    if (e.key === '[' || e.key === ']') { hot = (Math.max(0, hot) + (e.key === ']' ? 1 : pts.length - 1)) % pts.length; e.preventDefault(); return; }
    const d: Record<string, P> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    if (d[e.key] && hot >= 0) { e.preventDefault(); pts[hot] = [clamp(pts[hot][0] + d[e.key][0], 40, 205), clamp(pts[hot][1] + d[e.key][1], 2, 60)]; rasterize(); saved.set({ preset, pts }); }
  });
  loop(ctx, S.cv, () => { const n = ctx.calm ? 3 : 8; spf = n; for (let i = 0; i < n; i++) step(); advect(); render(); });

  heading(L.panel, t('shape', 'Shape'));
  const ps = seg(L.panel, t('preset', 'Start from'), Object.entries(PRESETS).map(([k, v]) => [k, t('p.' + k, v.name)]), preset, (v) => { preset = v; pts = PRESETS[v].pts.map((p) => [...p] as P); saved.set({ preset, pts }); rasterize(); reset(); });
  void ps;
  heading(L.panel, t('show', 'Show'));
  seg(L.panel, t('field', 'Colour by'), [['speed', t('f.speed', 'Air speed')], ['press', t('f.press', 'Pressure')], ['curl', t('f.curl', 'Swirl')]], view, (v) => { view = v as typeof view; });
  const smk1 = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement; smk1.addEventListener('change', () => { smoke = smk1.checked; smk.length = 0; });
  L.panel.append(h('label', { class: 'wk-chk' }, smk1, h('span', { text: t('smoke', 'Smoke rake') })));
  const tbl = h('ol', { class: 'wk-list', 'aria-live': 'polite' });
  buttons(L.panel, [[t('rec', 'Record drag'), () => { if (cnt < 200) return; results.push({ name: t('p.' + preset, PRESETS[preset].name) + (results.length ? ' #' + (results.length + 1) : ''), cd: drag }); results.sort((a, b) => a.cd - b.cd); tbl.replaceChildren(...results.slice(0, 8).map((r) => h('li', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' } }, h('span', { text: r.name }), h('b', { text: r.cd.toFixed(2) })))); }, true], [t('restart', 'Restart flow'), reset], [t('png', 'Save PNG'), () => download(S.cv, 'abidora-wind-tunnel.png')]]);
  heading(L.panel, t('board', 'Your shapes, lowest drag first'));
  L.panel.append(tbl);
  note(L.panel, t('how', 'A lattice-Boltzmann solver moves packets of air on a 240 × 120 grid. Where air bounces off the body, the momentum it hands over is added up: that is the drag. The floor rolls with the air, like a rolling-road tunnel.'));
  note(L.panel, t('honest', 'This is a 2D tunnel at a low Reynolds number, so the index is for comparing your shapes with each other. It is not a real car’s Cd.'));
  rasterize(); reset();
}
