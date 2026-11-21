/* 032 Mountain Explorer: Route Planner. A mountain range is grown from fractal noise and then
   carved by thousands of simulated raindrops (hydraulic erosion), drawn as a topographic map with
   hillshade and contour lines. Click to plan a hike: you get the elevation profile, distance,
   climb, an estimated walking time (Naismith's rule with Langmuir's descent corrections) and the
   temperature at each height from the standard lapse rate, so you can see where the snow starts. */
import { type Ctx, h, layout, canvas, heading, note, range, buttons, stats, loop, local, rng, noise2, clamp, download } from './kit';

const N = 128, SIZE_KM = 8, LOW = 400, HIGH = 3200;

/** Walking time in hours: 5 km/h on the flat, +1 h per 600 m climbed (Naismith),
 *  descent per Langmuir: gentle 5–12° saves 10 min per 300 m, steeper than 12° costs 10 min per 300 m. */
export function hikeHours(segs: { d: number; dz: number }[]) {
  let t = 0;
  for (const s of segs) {
    t += s.d / 5000;
    if (s.dz > 0) t += s.dz / 600;
    else if (s.dz < 0 && s.d > 0) {
      const deg = Math.atan2(-s.dz, s.d) * 180 / Math.PI;
      if (deg >= 5 && deg <= 12) t -= (-s.dz / 300) * (10 / 60);
      else if (deg > 12) t += (-s.dz / 300) * (10 / 60);
    }
  }
  return Math.max(0, t);
}
/** Air temperature at an altitude from a valley reading, standard lapse rate 6.5 °C per km */
export const tempAt = (t0: number, z0: number, z: number) => t0 - 6.5 * (z - z0) / 1000;

export function makeTerrain(seed: number, rugged: number, drops: number) {
  const n = noise2(seed), n2 = noise2(seed + 7), H = new Float32Array(N * N), R = rng(seed);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let a = 0, f = 1.6 / N, amp = 1, sum = 0;
    for (let o = 0; o < 6; o++) { const v = n(x * f + o * 17, y * f - o * 9); a += (o < 2 ? v : (1 - Math.abs(v)) * 2 - 1) * amp * (o < 2 ? 1 : rugged); sum += amp; amp *= .5; f *= 2.03; }
    const warp = n2(x / 50, y / 50) * .25, cx = x / N - .5, cy = y / N - .5;
    H[y * N + x] = a / sum + .55 - Math.hypot(cx * 1.2, cy) * .6 + warp;
  }
  let mn = Infinity, mx = -Infinity; for (const v of H) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
  for (let i = 0; i < H.length; i++) H[i] = ((H[i] - mn) / (mx - mn)) ** 1.35;
  /* hydraulic erosion: each droplet runs downhill, picks up sediment when fast, drops it when slow */
  const hb = (x: number, y: number) => { const X = Math.floor(x), Y = Math.floor(y), u = x - X, v = y - Y, i = Y * N + X; return { h: H[i] * (1 - u) * (1 - v) + H[i + 1] * u * (1 - v) + H[i + N] * (1 - u) * v + H[i + N + 1] * u * v, gx: (H[i + 1] - H[i]) * (1 - v) + (H[i + N + 1] - H[i + N]) * v, gy: (H[i + N] - H[i]) * (1 - u) + (H[i + N + 1] - H[i + 1]) * u }; };
  for (let d = 0; d < drops; d++) {
    let x = 1 + R() * (N - 3), y = 1 + R() * (N - 3), dx = 0, dy = 0, sp = 1, w = 1, sed = 0;
    for (let life = 0; life < 40; life++) {
      const X = Math.floor(x), Y = Math.floor(y), u = x - X, v = y - Y, p = hb(x, y);
      dx = dx * .3 - p.gx * .7; dy = dy * .3 - p.gy * .7; const l = Math.hypot(dx, dy); if (l < 1e-9) break; dx /= l; dy /= l;
      x += dx; y += dy; if (x < 1 || y < 1 || x > N - 2 || y > N - 2) break;
      const dh = hb(x, y).h - p.h, cap = Math.max(-dh * sp * w * 4, .002), i = Y * N + X;
      if (sed > cap || dh > 0) {
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * .3; sed -= amt;
        H[i] += amt * (1 - u) * (1 - v); H[i + 1] += amt * u * (1 - v); H[i + N] += amt * (1 - u) * v; H[i + N + 1] += amt * u * v;
      } else {
        const amt = Math.min((cap - sed) * .3, -dh); sed += amt;
        H[i] -= amt * (1 - u) * (1 - v); H[i + 1] -= amt * u * (1 - v); H[i + N] -= amt * (1 - u) * v; H[i + N + 1] -= amt * u * v;
      }
      sp = Math.sqrt(Math.max(0, sp * sp - dh * 4)); w *= .985;
    }
  }
  for (let i = 0; i < H.length; i++) H[i] = LOW + clamp(H[i], 0, 1) * (HIGH - LOW);
  return H;
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#d1572a');
  L.view.style.background = '#efe8d6';
  L.view.style.display = 'grid'; L.view.style.placeItems = 'stretch'; L.view.style.gridTemplateRows = '1fr 140px';
  const top = h('div', { style: { position: 'relative', minHeight: '320px' } }), bot = h('div', { style: { position: 'relative', borderTop: '1px solid #c9bea2' } });
  L.view.append(top, bot);
  const S = canvas(top, t('cv', 'Topographic map of a mountain range. Click to add route points; arrow keys move the cursor, Enter adds a point.'));
  Object.assign(S.cv.style, { position: 'absolute', inset: '0', cursor: 'crosshair' });
  const C = canvas(bot, t('prof', 'Elevation profile of your route')); Object.assign(C.cv.style, { position: 'absolute', inset: '0' });
  const info = stats(L.panel, [['dist', t('dist', 'Distance')], ['up', t('up', 'Climb')], ['down', t('down', 'Descent')], ['time', t('time', 'Walking time')], ['top', t('top', 'Highest point')], ['cold', t('cold', 'Coldest')]]);
  const P = { seed: 11, rugged: 1, erosion: 60, ci: 100, t0: 18 };
  let H = new Float32Array(N * N), img: HTMLCanvasElement | null = null, contours: number[][] = [], peaks: [number, number, number][] = [];
  let route: [number, number][] = [], cur: [number, number] = [N / 2, N / 2], hover: [number, number] | null = null;
  const elev = (x: number, y: number) => { x = clamp(x, 0, N - 1.001); y = clamp(y, 0, N - 1.001); const X = Math.floor(x), Y = Math.floor(y), u = x - X, v = y - Y, i = Y * N + X; return H[i] * (1 - u) * (1 - v) + H[i + 1] * u * (1 - v) + H[i + N] * (1 - u) * v + H[i + N + 1] * u * v; };
  const cellM = SIZE_KM * 1000 / N;
  const STOPS: [number, number[]][] = [[0, [126, 160, 104]], [.25, [170, 182, 120]], [.5, [214, 196, 146]], [.72, [176, 146, 112]], [.88, [150, 138, 130]], [1, [200, 196, 192]]];
  /* hypsometric tint: green valleys, tan slopes, grey rock, white above the snow line */
  function tint(z: number, snowZ: number) {
    const f = clamp((z - LOW) / (HIGH - LOW), 0, 1); let k = 0; while (k < STOPS.length - 2 && f > STOPS[k + 1][0]) k++;
    const a = STOPS[k], b = STOPS[k + 1], m = clamp((f - a[0]) / (b[0] - a[0]), 0, 1);
    let c = a[1].map((v, j) => v + (b[1][j] - v) * m);
    if (z > snowZ) { const s = clamp((z - snowZ) / 150, 0, 1); c = c.map((v) => v + (250 - v) * s * .9); }
    return c;
  }

  function build() {
    H = makeTerrain(P.seed, P.rugged, P.erosion * 1000);
    paint(); route = []; profile();
  }
  function paint() {
    /* hypsometric tint + hillshade at grid resolution, snow where the air is below −2 °C */
    const cv = document.createElement('canvas'); cv.width = N; cv.height = N; const g = cv.getContext('2d')!, id = g.createImageData(N, N);
    const snowZ = LOW + (P.t0 + 2) / 6.5 * 1000;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, z = H[i], f = (z - LOW) / (HIGH - LOW);
      const c = tint(z, snowZ);
      const gx = (H[y * N + Math.min(N - 1, x + 1)] - H[y * N + Math.max(0, x - 1)]) / (2 * cellM), gy = (H[Math.min(N - 1, y + 1) * N + x] - H[Math.max(0, y - 1) * N + x]) / (2 * cellM);
      /* Lambert hillshade, light from the north-west 45° up; slopes halved so steep faces stay readable */
      const nx = -gx * .5, ny = -gy * .5, nl = Math.hypot(nx, ny, 1), dot = (nx * -.5 + ny * -.5 + .707) / nl, shade = clamp(.55 + .6 * (dot - .707) / .3 + .25, .55, 1.2);
      id.data.set([c[0] * shade, c[1] * shade, c[2] * shade, 255], i * 4);
    }
    g.putImageData(id, 0, 0); img = cv;
    /* marching squares contours */
    contours = [];
    for (let lv = Math.ceil(LOW / P.ci) * P.ci; lv < HIGH; lv += P.ci) {
      const segs: number[] = [];
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
        const a = H[y * N + x], b = H[y * N + x + 1], c = H[(y + 1) * N + x + 1], d = H[(y + 1) * N + x];
        const pts: number[] = [];
        const e = (p: number, q: number, x1: number, y1: number, x2: number, y2: number) => { if ((p < lv) !== (q < lv)) { const s = (lv - p) / (q - p); pts.push(x1 + (x2 - x1) * s, y1 + (y2 - y1) * s); } };
        e(a, b, x, y, x + 1, y); e(b, c, x + 1, y, x + 1, y + 1); e(c, d, x + 1, y + 1, x, y + 1); e(d, a, x, y + 1, x, y);
        if (pts.length >= 4) segs.push(pts[0], pts[1], pts[2], pts[3]); if (pts.length === 8) segs.push(pts[4], pts[5], pts[6], pts[7]);
      }
      segs.push(lv); contours.push(segs);
    }
    /* named summits: local maxima in a 15-cell window, highest three */
    peaks = [];
    for (let y = 4; y < N - 4; y += 2) for (let x = 4; x < N - 4; x += 2) { const z = H[y * N + x]; let top = true; for (let j = -7; j <= 7 && top; j++) for (let i = -7; i <= 7; i++) { const xx = x + i, yy = y + j; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; if (H[yy * N + xx] > z) { top = false; break; } } if (top) peaks.push([x, y, z]); }
    peaks.sort((a, b) => b[2] - a[2]); peaks = peaks.slice(0, 3);
  }
  const view = () => { const s = Math.min(S.w - 70, S.h - 16), ox = 8 + (S.w - 70 - s) / 2, oy = (S.h - s) / 2; return { s, ox, oy, k: s / (N - 1) }; };
  function draw() {
    const g = S.g, W = S.w, Hh = S.h, v = view(); g.clearRect(0, 0, W, Hh);
    if (!img) return;
    g.imageSmoothingEnabled = true; g.drawImage(img, v.ox, v.oy, v.s, v.s);
    g.lineWidth = .6;
    for (const segs of contours) {
      const lv = segs[segs.length - 1], idx = Math.round(lv / P.ci) % 5 === 0;
      g.strokeStyle = idx ? 'rgba(80,48,22,.85)' : 'rgba(96,62,32,.5)'; g.lineWidth = idx ? 1.2 : .7; g.beginPath();
      for (let i = 0; i + 3 < segs.length - 1; i += 4) { g.moveTo(v.ox + segs[i] * v.k, v.oy + segs[i + 1] * v.k); g.lineTo(v.ox + segs[i + 2] * v.k, v.oy + segs[i + 3] * v.k); }
      g.stroke();
    }
    g.font = '600 11px ui-serif,Georgia,serif'; g.textAlign = 'left';
    peaks.forEach((p, i) => { const x = v.ox + p[0] * v.k, y = v.oy + p[1] * v.k; g.fillStyle = '#3a2412'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 5, y + 3); g.lineTo(x - 5, y + 3); g.closePath(); g.fill(); g.fillText(`${['I', 'II', 'III'][i]} · ${Math.round(p[2])} m`, x + 7, y + 3); });
    /* route */
    if (route.length) {
      g.strokeStyle = '#d1572a'; g.lineWidth = 3; g.setLineDash([7, 4]); g.beginPath(); route.forEach((p, i) => { const x = v.ox + p[0] * v.k, y = v.oy + p[1] * v.k; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); g.setLineDash([]);
      route.forEach((p, i) => { const x = v.ox + p[0] * v.k, y = v.oy + p[1] * v.k; g.fillStyle = i === 0 ? '#2c6e49' : i === route.length - 1 ? '#d1572a' : '#fff'; g.strokeStyle = '#3a2412'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.stroke(); });
    }
    /* cursor (keyboard) and hover readout */
    const hp = hover ?? (document.activeElement === S.cv ? cur : null);
    if (hp) {
      const x = v.ox + hp[0] * v.k, y = v.oy + hp[1] * v.k, z = elev(hp[0], hp[1]), tc = tempAt(P.t0, LOW, z);
      g.strokeStyle = '#3a2412'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 9, y); g.lineTo(x + 9, y); g.moveTo(x, y - 9); g.lineTo(x, y + 9); g.stroke();
      const txt = `${Math.round(z)} m · ${tc.toFixed(1)} °C`; g.font = '11px ui-monospace,monospace'; const tw = g.measureText(txt).width;
      const bx = clamp(x + 12, 4, W - tw - 14); g.fillStyle = 'rgba(255,250,238,.92)'; g.fillRect(bx, y - 22, tw + 10, 18); g.fillStyle = '#3a2412'; g.fillText(txt, bx + 5, y - 9);
    }
    /* legend: elevation bar with snowline, scale bar */
    const lx = W - 48, ly = 20, lh = Math.min(260, Hh - 80);
    for (let i = 0; i < lh; i++) { const z = HIGH - i / lh * (HIGH - LOW), c = tint(z, LOW + (P.t0 + 2) / 6.5 * 1000); g.fillStyle = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; g.fillRect(lx, ly + i, 12, 1); }
    g.strokeStyle = '#3a2412'; g.strokeRect(lx, ly, 12, lh); g.fillStyle = '#3a2412'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
    g.fillText(`${HIGH}`, lx - 6, ly - 5); g.fillText(`${LOW} m`, lx - 6, ly + lh + 12);
    const snowZ = LOW + (P.t0 + 2) / 6.5 * 1000; if (snowZ < HIGH) { const sy = ly + (HIGH - snowZ) / (HIGH - LOW) * lh; g.strokeStyle = '#2b5c8a'; g.beginPath(); g.moveTo(lx - 4, sy); g.lineTo(lx + 16, sy); g.stroke(); g.fillStyle = '#2b5c8a'; g.fillText('❄', lx + 18, sy + 4); }
    const sb = v.k * (N - 1) / SIZE_KM * 2; g.fillStyle = '#3a2412'; g.fillRect(v.ox + 8, v.oy + v.s - 14, sb, 3); g.fillText('2 km', v.ox + 8, v.oy + v.s - 18);
    g.fillText('N ↑', v.ox + v.s - 26, v.oy + 14);
  }
  /* route sampling every ~20 m */
  function sample() {
    const pts: { d: number; z: number; t: number }[] = []; let D = 0;
    for (let i = 0; i < route.length; i++) {
      if (!i) { const z = elev(...route[0]); pts.push({ d: 0, z, t: tempAt(P.t0, LOW, z) }); continue; }
      const [ax, ay] = route[i - 1], [bx, by] = route[i], len = Math.hypot(bx - ax, by - ay) * cellM, n = Math.max(1, Math.ceil(len / 20));
      for (let k = 1; k <= n; k++) { const s = k / n, z = elev(ax + (bx - ax) * s, ay + (by - ay) * s); D += len / n; pts.push({ d: D, z, t: tempAt(P.t0, LOW, z) }); }
    }
    return pts;
  }
  let prof: { d: number; z: number; t: number }[] = [];
  function profile() {
    prof = sample();
    let up = 0, dn = 0; const segs: { d: number; dz: number }[] = [];
    for (let i = 1; i < prof.length; i++) { const dz = prof[i].z - prof[i - 1].z; if (dz > 0) up += dz; else dn -= dz; segs.push({ d: prof[i].d - prof[i - 1].d, dz }); }
    const D = prof.length ? prof[prof.length - 1].d : 0, hrs = hikeHours(segs);
    info('dist', `${(D / 1000).toFixed(2)} km`); info('up', `${Math.round(up)} m`); info('down', `${Math.round(dn)} m`);
    info('time', prof.length > 1 ? `${Math.floor(hrs)} h ${String(Math.round((hrs % 1) * 60)).padStart(2, '0')} min` : '—');
    const top = prof.reduce((m, p) => Math.max(m, p.z), 0); info('top', prof.length ? `${Math.round(top)} m` : '—');
    info('cold', prof.length ? `${tempAt(P.t0, LOW, top).toFixed(1)} °C` : '—');
    L.hud.textContent = route.length < 2 ? t('hint', 'Click the map to start a route, then click again for each turn') : tempAt(P.t0, LOW, top) < 0 ? t('ice', 'Your route goes above freezing level: expect snow or ice') : '';
    drawProf();
  }
  function drawProf() {
    const g = C.g, W = C.w, Hh = C.h; g.clearRect(0, 0, W, Hh); g.fillStyle = '#f7f2e4'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#6b5236'; g.font = '11px ui-monospace,monospace';
    if (prof.length < 2) { g.fillText(t('noprof', 'Elevation profile appears here'), 14, Hh / 2); return; }
    const D = prof[prof.length - 1].d, zs = prof.map((p) => p.z), z0 = Math.min(...zs) - 50, z1 = Math.max(...zs) + 50;
    const X = (d: number) => 46 + d / D * (W - 60), Y = (z: number) => Hh - 22 - (z - z0) / (z1 - z0) * (Hh - 40);
    g.strokeStyle = 'rgba(107,82,54,.2)'; g.lineWidth = 1; for (let z = Math.ceil(z0 / 200) * 200; z < z1; z += 200) { g.beginPath(); g.moveTo(46, Y(z)); g.lineTo(W - 14, Y(z)); g.stroke(); g.fillText(`${z}`, 6, Y(z) + 4); }
    const snowZ = LOW + (P.t0 + 2) / 6.5 * 1000; if (snowZ < z1 && snowZ > z0) { g.strokeStyle = '#2b5c8a'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(46, Y(snowZ)); g.lineTo(W - 14, Y(snowZ)); g.stroke(); g.setLineDash([]); g.fillStyle = '#2b5c8a'; g.fillText(t('snow', 'snow line'), W - 80, Y(snowZ) - 4); }
    const grd = g.createLinearGradient(0, Y(z1), 0, Y(z0)); grd.addColorStop(0, '#b08d6a'); grd.addColorStop(1, '#8ea86f');
    g.fillStyle = grd; g.beginPath(); g.moveTo(X(0), Hh - 22); prof.forEach((p) => g.lineTo(X(p.d), Y(p.z))); g.lineTo(X(D), Hh - 22); g.closePath(); g.fill();
    g.strokeStyle = '#d1572a'; g.lineWidth = 2; g.beginPath(); prof.forEach((p, i) => i ? g.lineTo(X(p.d), Y(p.z)) : g.moveTo(X(p.d), Y(p.z))); g.stroke();
    /* steep sections (over 25 %) marked */
    g.fillStyle = 'rgba(160,30,20,.55)'; for (let i = 1; i < prof.length; i++) { const gr = Math.abs(prof[i].z - prof[i - 1].z) / Math.max(1, prof[i].d - prof[i - 1].d); if (gr > .25) g.fillRect(X(prof[i - 1].d), Hh - 20, Math.max(1, X(prof[i].d) - X(prof[i - 1].d)), 4); }
    g.fillStyle = '#6b5236'; for (let k = 0; k <= D / 1000; k++) g.fillText(`${k} km`, X(k * 1000) - 8, Hh - 6);
    g.fillStyle = 'rgba(160,30,20,.8)'; g.fillText(t('steep', '▬ steeper than 25 %'), W - 150, 12);
  }
  const toGrid = (e: PointerEvent): [number, number] | null => { const p = local(e, S.cv), v = view(); const x = (p.x - v.ox) / v.k, y = (p.y - v.oy) / v.k; return x < 0 || y < 0 || x > N - 1 || y > N - 1 ? null : [x, y]; };
  S.cv.addEventListener('pointermove', (e) => { hover = toGrid(e); });
  S.cv.addEventListener('pointerleave', () => { hover = null; });
  S.cv.addEventListener('pointerdown', (e) => { const p = toGrid(e); if (p) { route.push(p); cur = p; profile(); } });
  S.cv.addEventListener('keydown', (e) => {
    const st = e.shiftKey ? 8 : 2;
    if (e.key === 'ArrowLeft') cur = [clamp(cur[0] - st, 0, N - 1), cur[1]]; else if (e.key === 'ArrowRight') cur = [clamp(cur[0] + st, 0, N - 1), cur[1]];
    else if (e.key === 'ArrowUp') cur = [cur[0], clamp(cur[1] - st, 0, N - 1)]; else if (e.key === 'ArrowDown') cur = [cur[0], clamp(cur[1] + st, 0, N - 1)];
    else if (e.key === 'Enter' || e.key === ' ') { route.push([...cur]); profile(); } else if (e.key === 'Backspace') { route.pop(); profile(); } else return;
    e.preventDefault();
  });
  S.onResize(draw);
  loop(ctx, S.cv, () => draw());
  C.onResize(drawProf);

  heading(L.panel, t('range', 'The range'));
  range(L.panel, t('seed', 'Mountain range number'), { min: 1, max: 99, value: P.seed }, (v) => { P.seed = v; build(); });
  range(L.panel, t('rug', 'Ruggedness'), { min: .4, max: 1.6, step: .1, value: P.rugged, fmt: (n) => '×' + n }, (v) => { P.rugged = v; build(); });
  range(L.panel, t('ero', 'Rain erosion (drops)'), { min: 0, max: 150, step: 10, value: P.erosion, fmt: (n) => n ? `${n} 000` : t('none', 'none') }, (v) => { P.erosion = v; build(); });
  range(L.panel, t('ci', 'Contour interval'), { min: 50, max: 200, step: 50, value: P.ci, fmt: (n) => n + ' m' }, (v) => { P.ci = v; paint(); });
  range(L.panel, t('t0', `Valley temperature (${LOW} m)`), { min: -10, max: 35, value: P.t0, fmt: (n) => n + ' °C' }, (v) => { P.t0 = v; paint(); profile(); });
  heading(L.panel, t('route', 'Your route'));
  buttons(L.panel, [[t('undo', 'Undo point'), () => { route.pop(); profile(); }], [t('back', 'Return to start'), () => { if (route.length > 1) { route.push([...route[0]]); profile(); } }], [t('clear', 'Clear route'), () => { route = []; profile(); }],
    [t('csv', 'Download profile (CSV)'), () => { if (prof.length < 2) return; download(new Blob(['distance_m,elevation_m,temperature_c\n' + prof.map((p) => `${p.d.toFixed(0)},${p.z.toFixed(0)},${p.t.toFixed(1)}`).join('\n')], { type: 'text/csv' }), 'abidora-route-profile.csv'); }], [t('png', 'Save map (PNG)'), () => download(S.cv, 'abidora-mountain-map.png'), true]]);
  note(L.panel, t('how', 'The terrain starts as layered noise, then thousands of raindrops run downhill, carrying soil away from fast slopes and dropping it where water slows. That carves valleys and fans you can see in the contour lines. Thick lines are every fifth contour.'));
  note(L.panel, t('src', 'Walking time uses Naismith\'s rule (5 km/h, plus 1 hour per 600 m of climb) with Langmuir\'s corrections for descent. Temperature falls about 6.5 °C per 1000 m. Real mountains also need weather, daylight and fitness taken into account.'));
  build();
}
