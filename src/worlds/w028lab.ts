/* 028 Ocean Explorer: Wave Lab. Linear wave theory in your hands: the dispersion relation
   ω² = g·k·tanh(k·h) sets wavelength and speed from the period and the depth, water particles
   trace circles in deep water and flat ellipses in the shallows, and on a sloping beach the wave
   slows, steepens and breaks. Wind mode grows waves from wind speed and fetch. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, stats, loop, store, clamp } from './kit';

const G = 9.81;
export function waveNumber(T: number, depth: number) {
  const w = 2 * Math.PI / T; let k = w * w / G; /* deep-water first guess, then Newton */
  for (let i = 0; i < 40; i++) { const th = Math.tanh(k * depth), f = G * k * th - w * w, df = G * th + G * k * depth * (1 - th * th); const nk = k - f / df; if (Math.abs(nk - k) < 1e-10) { k = nk; break; } k = Math.max(1e-6, nk); }
  return k;
}
export function windWaves(U: number, fetchKm: number) {
  /* Shore Protection Manual (1984) deep-water, fetch-limited growth, capped at fully developed */
  const UA = .71 * U ** 1.23, F = fetchKm * 1000, X = G * F / (UA * UA);
  const hs = Math.min(1.6e-3 * Math.sqrt(X), .2433) * UA * UA / G, tp = Math.min(.2857 * Math.cbrt(X), 8.134) * UA / G;
  return { hs, tp };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && typeof v === 'object' && 'T' in (v as object);
  const st = store(28, 'set', { mode: 'swell', T: 8, H: 1.5, depth: 30, U: 15, fetch: 100, beach: false }, ok);
  const P = { ...st.get() };
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#36c2d6');
  L.view.style.background = 'linear-gradient(180deg,#cfe8f2 0%,#eaf5f8 40%,#0a3a52 40.2%,#04182a 100%)';
  const S = canvas(L.view, t('cv', 'Side view of waves with water particles moving in orbits'));
  const info = stats(L.panel, [['L', t('L', 'Wavelength')], ['c', t('c', 'Wave speed')], ['cg', t('cg', 'Energy speed')], ['type', t('type', 'Water is')], ['H', t('H', 'Wave height')], ['T', t('T', 'Period')]]);
  let time = 0;
  function waveParams() { if (P.mode === 'wind') { const w = windWaves(P.U, P.fetch); return { T: w.tp, H: w.hs }; } return { T: P.T, H: P.H }; }
  function calc() {
    const { T, H } = waveParams(), k = waveNumber(T, P.depth), Lw = 2 * Math.PI / k, c = Lw / T, n = .5 * (1 + 2 * k * P.depth / Math.sinh(2 * k * P.depth));
    info('L', `${Lw.toFixed(1)} m`); info('c', `${c.toFixed(1)} m/s · ${(c * 3.6).toFixed(0)} km/h`); info('cg', `${(c * n).toFixed(1)} m/s`);
    const r = P.depth / Lw; info('type', r > .5 ? t('deep', 'deep') : r < .05 ? t('shallow', 'shallow') : t('inter', 'in between'));
    info('H', `${H.toFixed(2)} m`); info('T', `${T.toFixed(1)} s`);
    st.set(P);
  }
  function draw(dt: number) {
    time += dt * (ctx.calm ? .35 : 1);
    const g = S.g, W = S.w, Hh = S.h; g.clearRect(0, 0, W, Hh);
    const { T, H } = waveParams(), w = 2 * Math.PI / T, k0 = waveNumber(T, P.depth), L0 = 2 * Math.PI / k0;
    /* horizontal span: three wavelengths; vertical: the deepest of depth or half a wavelength */
    const span = L0 * 3, sx = W / span, yS = Hh * .4, maxD = Math.min(P.depth, Math.max(L0 * .6, 8)), sy = (Hh - yS - 10) / maxD;
    const vScale = Math.max(1, Math.min(6, (Hh * .12) / (H * sy)));
    /* depth along x (beach: slope from full depth to dry) */
    const depthAt = (x: number) => P.beach ? Math.max(.05, P.depth * (1 - x / span * 1.05)) : P.depth;
    /* phase integrates the local wave number so waves shorten in the shallows */
    const N = 240, phase = new Float64Array(N + 1), amp = new Float64Array(N + 1), kk = new Float64Array(N + 1);
    let ph = 0; const cg0 = (w / k0) * .5 * (1 + 2 * k0 * P.depth / Math.sinh(2 * k0 * P.depth));
    let broken = -1;
    for (let i = 0; i <= N; i++) {
      const x = i / N * span, d = depthAt(x), k = waveNumber(T, d), cg = (w / k) * .5 * (1 + 2 * k * d / Math.sinh(2 * k * d));
      kk[i] = k; if (i) ph += k * span / N; phase[i] = ph;
      let a = H / 2 * Math.sqrt(cg0 / cg); if (a * 2 > .78 * d) { a = .39 * d; if (broken < 0) broken = i; } amp[i] = a;
    }
    /* seabed */
    g.fillStyle = '#c9b27c'; g.beginPath(); g.moveTo(0, Hh); for (let i = 0; i <= N; i++) { const x = i / N * span; g.lineTo(x * sx, yS + Math.min(depthAt(x), maxD * 1.05) * sy); } g.lineTo(W, Hh); g.closePath(); g.fill();
    /* water surface */
    const surf = (i: number) => yS - amp[i] * Math.cos(phase[i] - w * time) * sy * vScale;
    g.fillStyle = 'rgba(16,94,128,.55)'; g.beginPath(); g.moveTo(0, Hh); for (let i = 0; i <= N; i++) g.lineTo(i / N * W, surf(i)); g.lineTo(W, Hh); g.closePath(); g.fill();
    g.strokeStyle = '#e8fbff'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= N; i++) { const y = surf(i); i ? g.lineTo(i / N * W, y) : g.moveTo(0, y); } g.stroke();
    if (broken >= 0) { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = broken; i <= N; i += 3) { const y = surf(i); if (Math.cos(phase[i] - w * time) > .3) { g.beginPath(); g.arc(i / N * W, y - 2, 2 + Math.random() * 3, 0, 7); g.fill(); } } }
    /* water particles: linear-theory orbits shrink with depth (cosh/sinh) */
    for (let col = 0; col < 18; col++) {
      const i = Math.round((col + .5) / 18 * N), x0 = i / N * span, d = depthAt(x0), k = kk[i];
      for (let row = 0; row < 6; row++) {
        const z0 = -d * (row + .5) / 6; if (-z0 > maxD) continue;
        const a = amp[i], A = a * Math.cosh(k * (z0 + d)) / Math.sinh(k * d), B = a * Math.sinh(k * (z0 + d)) / Math.sinh(k * d), th = phase[i] - w * time;
        const X = x0 * sx - A * Math.sin(th) * sx * vScale, Y = yS - z0 * sy - B * Math.cos(th) * sy * vScale;
        g.strokeStyle = 'rgba(160,230,245,.25)'; g.beginPath(); g.ellipse(x0 * sx, yS - z0 * sy, Math.max(.5, A * sx * vScale), Math.max(.5, B * sy * vScale), 0, 0, 7); g.stroke();
        g.fillStyle = '#bff3ff'; g.beginPath(); g.arc(X, Y, 2.6, 0, 7); g.fill();
      }
    }
    /* a buoy riding the surface */
    const bi = Math.round(N * .18), by = surf(bi), slope = (surf(bi + 2) - surf(bi - 2)) / (W / N * 4);
    g.save(); g.translate(bi / N * W, by); g.rotate(Math.atan(slope) * .8); g.fillStyle = '#ff5a36'; g.fillRect(-7, -16, 14, 18); g.fillStyle = '#fff'; g.fillRect(-7, -10, 14, 4); g.restore();
    g.fillStyle = '#0b3346'; g.font = '11px ui-monospace,monospace'; g.fillText(`${t('scale', 'heights ×')}${vScale.toFixed(1)} · ${span.toFixed(0)} m ${t('across', 'across')}`, 12, 18);
    L.hud.textContent = broken >= 0 ? t('break', 'Breaking: the wave became taller than about 0.78 × the depth') : '';
  }
  loop(ctx, S.cv, (dt) => draw(dt));

  heading(L.panel, t('source', 'Waves from'));
  seg(L.panel, t('mode', 'Source'), [['swell', t('m.swell', 'A swell I choose')], ['wind', t('m.wind', 'Wind over the sea')]], P.mode, (v) => { P.mode = v; box1.hidden = v !== 'swell'; box2.hidden = v !== 'wind'; calc(); });
  const box1 = h('div', { style: { display: 'grid', gap: '12px' } }), box2 = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box1, box2);
  range(box1, t('T', 'Period'), { min: 2, max: 20, step: .5, value: P.T, fmt: (n) => n + ' s' }, (v) => { P.T = v; calc(); });
  range(box1, t('Hs', 'Height'), { min: .2, max: 8, step: .1, value: P.H, fmt: (n) => n + ' m' }, (v) => { P.H = v; calc(); });
  range(box2, t('U', 'Wind speed (10 m up)'), { min: 3, max: 35, value: P.U, fmt: (n) => `${n} m/s · ${(n * 3.6).toFixed(0)} km/h` }, (v) => { P.U = v; calc(); });
  range(box2, t('fetch', 'Fetch (open water the wind blows over)'), { min: 1, max: 1000, value: P.fetch, fmt: (n) => n + ' km' }, (v) => { P.fetch = v; calc(); });
  box1.hidden = P.mode !== 'swell'; box2.hidden = P.mode !== 'wind';
  heading(L.panel, t('sea', 'Sea'));
  range(L.panel, t('depth', 'Water depth'), { min: 1, max: 200, value: P.depth, fmt: (n) => n + ' m' }, (v) => { P.depth = v; calc(); });
  seg(L.panel, t('bed', 'Seabed'), [['flat', t('b.flat', 'Flat')], ['beach', t('b.beach', 'Slopes up to a beach')]], P.beach ? 'beach' : 'flat', (v) => { P.beach = v === 'beach'; calc(); });
  note(L.panel, t('how', 'Longer-period waves are longer and faster. In deep water (depth over half a wavelength) particles move in circles that fade with depth; in shallow water they flatten into back-and-forth ellipses and the wave feels the bottom, slows, grows taller and finally breaks.'));
  note(L.panel, t('src', 'Wind mode uses the US Army Corps of Engineers Shore Protection Manual (1984) growth curves for deep water. Heights are significant wave height; real seas mix many waves.'));
  calc();
}
