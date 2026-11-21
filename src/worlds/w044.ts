/* 044 Future Science: Fusion Lab. Can you make a star on Earth? A zero-dimensional power balance for a
   deuterium–tritium plasma in a tokamak: fusion power from the Bosch–Hale (1992) D-T reactivity, alpha
   particles heating the plasma, energy leaking out through the confinement time and bremsstrahlung
   X-rays, and the outside heating needed to make up the difference. The result is the gain Q (fusion
   power out ÷ heating in) and whether the plasma ignites, drawn on the Lawson chart of temperature
   against the triple product n·T·τE, with the Q = 1, Q = 10 and ignition curves computed from the same
   physics. A simplified teaching model: real machines lose more to impurities, helium ash and profiles. */
import { type Ctx, h, layout, canvas, heading, note, range, stats, loop, rng, clamp } from './kit';

/* ---------- physics (exported for tests) ---------- */
/** D-T fusion reactivity <σv> in m³/s at ion temperature T in keV (Bosch & Hale 1992, valid 0.2 to 100 keV) */
export function reactivity(T: number) {
  const BG = 34.3827, mrc2 = 1124656, C1 = 1.17302e-9, C2 = 1.51361e-2, C3 = 7.51886e-2, C4 = 4.60643e-3, C5 = 1.35e-2, C6 = -1.0675e-4, C7 = 1.366e-5;
  const th = T / (1 - T * (C2 + T * (C4 + T * C6)) / (1 + T * (C3 + T * (C5 + T * C7)))), xi = Math.cbrt(BG * BG / (4 * th));
  return C1 * th * Math.sqrt(xi / (mrc2 * T ** 3)) * Math.exp(-3 * xi) * 1e-6;
}
const KEV = 1.602176634e-16, EF = 17.59e3 * KEV, EA = 3.52e3 * KEV, CB = 5.35e-37;
/** power densities in W/m³ for density n (m⁻³, 50:50 D-T), temperature T (keV) and confinement time tau (s) */
export function balance(n: number, T: number, tau: number) {
  const pf = n * n / 4 * reactivity(T) * EF, pa = pf * EA / EF, pb = CB * n * n * Math.sqrt(T), pc = 3 * n * T * KEV / tau, aux = pc + pb - pa;
  return { pf, pa, pb, pc, aux, Q: aux > 0 ? pf / aux : Infinity, ignited: aux <= 0 };
}
/** triple product n·T·τE (keV·s/m³) needed for gain Q at temperature T (Q = Infinity means ignition); NaN where it is impossible */
export function needed(T: number, Q: number) {
  const d = (EA + (Number.isFinite(Q) ? EF / Q : 0)) / 4 * reactivity(T) - CB * Math.sqrt(T);
  return d > 0 ? 3 * T * KEV / d * T : NaN; // n·τE times T
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ff9f5a');
  L.view.style.background = '#06060c';
  L.view.style.minHeight = 'clamp(420px, 60vw, 620px)';
  const S = canvas(L.view, t('cv', 'A tokamak plasma and the Lawson chart showing how close it is to self-sustaining fusion.'));
  const R = rng();
  const P = { n: 1.0e20, T: 9, tau: 2.5, V: 830 };

  const PRE: [string, string, Partial<typeof P>, string][] = [
    ['lab', t('p.lab', 'Small lab tokamak'), { n: 5e19, T: 2, tau: .05, V: 1 }, t('d.lab', 'An illustrative university-size machine: hot, but it leaks heat in a few hundredths of a second. Almost no fusion.')],
    ['cold', t('p.cold', 'Too cold'), { n: 1.0e20, T: 3, tau: 2.5, V: 830 }, t('d.cold', 'A big machine at 3 keV (35 million °C): nuclei rarely get close enough to fuse. Temperature matters most.')],
    ['iter', t('p.iter', 'ITER-scale'), { n: 1.0e20, T: 9, tau: 2.5, V: 830 }, t('d.iter', 'Parameters near ITER\'s design goal of 500 MW of fusion from 50 MW of heating (Q = 10). This model leaves out impurities and uneven profiles, so it needs a shorter confinement time to match.')],
    ['leak', t('p.leak', 'Leaky plasma'), { n: 1.0e20, T: 9, tau: .5, V: 830 }, t('d.leak', 'Same size and heat, but turbulence carries energy out five times faster. The heating bill explodes.')],
    ['ign', t('p.ign', 'Power plant concept'), { n: 1.2e20, T: 12, tau: 4, V: 1000 }, t('d.ign', 'An illustrative future plant: the alpha particles alone keep the plasma hot. That is ignition.')],
  ];
  heading(L.panel, t('preh', 'Machines'));
  const desc = h('p', { class: 'wk-note' }), prow = h('div', { class: 'wk-row' });
  for (const [k, n, p, d] of PRE) prow.append(h('button', { type: 'button', class: 'wk-b', text: n, 'data-k': k, onclick: () => apply(p, d, k) }));
  L.panel.append(prow, desc);
  heading(L.panel, t('ctlh', 'Plasma'));
  const sT = range(L.panel, t('temp', 'Temperature'), { min: Math.log10(1), max: Math.log10(100), step: .005, value: Math.log10(P.T), fmt: (v) => { const k = 10 ** v; return `${k < 10 ? k.toFixed(1) : Math.round(k)} keV · ${Math.round(k * 11.6)} ${t('mill', 'million °C')}`; } }, (v) => { P.T = 10 ** v; mark(); });
  const sN = range(L.panel, t('dens', 'Density'), { min: 19, max: 21, step: .01, value: Math.log10(P.n), fmt: (v) => (10 ** v / 1e20).toFixed(2) + ' × 10²⁰ /m³' }, (v) => { P.n = 10 ** v; mark(); });
  const sTau = range(L.panel, t('tau', 'Energy confinement time'), { min: -2, max: 1, step: .01, value: Math.log10(P.tau), fmt: (v) => { const s = 10 ** v; return (s < 1 ? s.toFixed(2) : s.toFixed(1)) + ' s'; } }, (v) => { P.tau = 10 ** v; mark(); });
  const sV = range(L.panel, t('vol', 'Plasma volume'), { min: 0, max: 3.3, step: .01, value: Math.log10(P.V), fmt: (v) => { const m = 10 ** v; return (m < 10 ? m.toFixed(1) : Math.round(m)) + ' m³'; } }, (v) => { P.V = 10 ** v; mark(); });
  const info = stats(L.panel, [['pf', t('pf', 'Fusion power')], ['aux', t('aux', 'Heating needed')], ['q', t('q', 'Gain Q')], ['tp', t('tp', 'Triple product')], ['alpha', t('alpha', 'Self-heating')], ['state', t('state', 'Verdict')]]);
  note(L.panel, t('n.fus', 'Deuterium and tritium fuse into helium and a neutron, releasing 17.6 MeV; the helium nucleus (3.5 MeV) stays and heats the plasma, the neutron (14.1 MeV) escapes to make electricity. Heat leaks out over the confinement time and as X-rays. Gain Q is fusion power ÷ outside heating; at ignition the plasma heats itself. Reaction rates follow Bosch and Hale (1992). This is a zero-dimensional teaching model.'));
  function mark(k = '') { prow.querySelectorAll('button').forEach((b) => b.classList.toggle('pri', (b as HTMLElement).dataset.k === k)); if (!k) desc.textContent = t('custom', 'Your own plasma.'); upd(); }
  function apply(p: Partial<typeof P>, d: string, k: string) { Object.assign(P, p); sT.set(Math.log10(P.T)); sN.set(Math.log10(P.n)); sTau.set(Math.log10(P.tau)); sV.set(Math.log10(P.V)); mark(k); desc.textContent = d; }
  let B = balance(P.n, P.T, P.tau);
  const mw = (w: number) => { const m = w / 1e6; return m >= 100 ? Math.round(m).toLocaleString(ctx.lang) + ' MW' : m >= 1 ? m.toFixed(1) + ' MW' : m >= .001 ? (m * 1000).toFixed(1) + ' kW' : (m * 1e6).toFixed(1) + ' W'; };
  function upd() {
    B = balance(P.n, P.T, P.tau);
    info('pf', mw(B.pf * P.V)); info('aux', B.ignited ? t('none', 'none') : mw(B.aux * P.V));
    info('q', B.ignited ? '∞' : B.Q < .01 ? B.Q.toExponential(1) : B.Q.toFixed(B.Q < 10 ? 2 : 1));
    const tp = P.n * P.T * P.tau; info('tp', tp.toExponential(1) + ' keV·s/m³');
    info('alpha', Math.min(100, B.pa / (B.pc + B.pb) * 100).toFixed(B.pa / (B.pc + B.pb) < .1 ? 2 : 0) + ' %');
    info('state', B.ignited ? t('v.ign', 'Ignition: it heats itself') : B.Q >= 10 ? t('v.q10', 'Power-plant territory') : B.Q >= 1 ? t('v.q1', 'Breakeven passed') : B.Q >= .1 ? t('v.close', 'Getting close') : t('v.far', 'Far from breakeven'));
  }
  apply(PRE[2][2], PRE[2][3], 'iter');

  /* ---------- drawing ---------- */
  type Ion = { a: number; r: number; z: number; s: number; c: number };
  const ions: Ion[] = Array.from({ length: 160 }, () => ({ a: R() * Math.PI * 2, r: R(), z: R() * Math.PI * 2, s: .5 + R(), c: R() < .5 ? 0 : 1 }));
  const flashes: { x: number; y: number; life: number; a: number }[] = [];
  let ph = 0;
  function drawTokamak(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, dt: number) {
    const heat = clamp(Math.log10(P.T) / 2, 0, 1), glowA = clamp(.15 + Math.log10(P.n / 1e19) * .3, .1, .8);
    /* vessel: a torus seen from slightly above */
    const Rm = s, rm = s * .36, sq = .42;
    g.strokeStyle = 'rgba(160,170,200,.35)'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(cx, cy, Rm + rm, (Rm + rm) * sq, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(cx, cy, Rm - rm, (Rm - rm) * sq, 0, 0, 7); g.stroke();
    /* coils */
    g.strokeStyle = 'rgba(200,140,80,.16)'; g.lineWidth = 3;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, x = cx + Math.cos(a) * Rm, y = cy + Math.sin(a) * Rm * sq; g.beginPath(); g.ellipse(x, y, rm * .25 + 4, rm * 1.05, 0, 0, 7); g.stroke(); }
    /* plasma glow */
    const col = `hsl(${330 - heat * 110},85%,${50 + heat * 18}%)`;
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = col; g.globalAlpha = glowA; g.lineWidth = rm * 1.3; g.filter = 'blur(10px)';
    g.beginPath(); g.ellipse(cx, cy, Rm, Rm * sq, 0, 0, 7); g.stroke(); g.filter = 'none'; g.globalAlpha = 1;
    /* ions spiral round the ring along twisted field lines */
    ph += dt * (ctx.calm ? .2 : 1) * (0.4 + heat * 1.6);
    for (const p of ions) {
      const a = p.a + ph * p.s * .35, tw = p.z + ph * p.s * 2.2, rr = rm * .55 * Math.sqrt(p.r);
      const x = cx + Math.cos(a) * (Rm + Math.cos(tw) * rr), y = cy + Math.sin(a) * (Rm + Math.cos(tw) * rr) * sq - Math.sin(tw) * rr * .9;
      g.fillStyle = p.c ? 'rgba(140,200,255,.9)' : 'rgba(255,190,120,.9)'; g.fillRect(x - 1, y - 1, 2, 2);
    }
    /* neutrons: flashes at a rate tied to the fusion rate (log scale) */
    const rate = clamp((Math.log10(B.pf * P.V + 1) - 2) * 4, 0, 40);
    if (!ctx.calm) { let k = rate * dt; while (k > 0) { if (R() < k) { const a = R() * Math.PI * 2; flashes.push({ x: cx + Math.cos(a) * Rm, y: cy + Math.sin(a) * Rm * sq, life: 1, a: R() * Math.PI * 2 }); } k -= 1; } }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]; f.life -= dt * 2.2; if (f.life <= 0) { flashes.splice(i, 1); continue; }
      const d = (1 - f.life) * s * .8; g.strokeStyle = `rgba(255,255,255,${f.life * .8})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(f.x + Math.cos(f.a) * d * .6, f.y + Math.sin(f.a) * d * .6); g.lineTo(f.x + Math.cos(f.a) * d, f.y + Math.sin(f.a) * d); g.stroke();
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'center';
    g.fillText(t('neu', 'white streaks: neutrons carrying fusion energy out'), cx, cy + (Rm + rm) * sq + 22);
  }
  function drawLawson(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, hh: number) {
    const l = x0 + 44, r = x0 + w - 6, tp = y0 + 8, bt = y0 + hh - 26, tl0 = 0, tl1 = 2, pl0 = 19, pl1 = 23;
    const X = (T: number) => l + (Math.log10(T) - tl0) / (tl1 - tl0) * (r - l), Y = (v: number) => bt - (Math.log10(v) - pl0) / (pl1 - pl0) * (bt - tp);
    g.fillStyle = 'rgba(10,10,20,.6)'; g.fillRect(x0, y0, w, hh);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace';
    for (let p = pl0; p <= pl1; p++) { g.beginPath(); g.moveTo(l, Y(10 ** p)); g.lineTo(r, Y(10 ** p)); g.stroke(); g.textAlign = 'right'; g.fillText('10' + sup(p), l - 4, Y(10 ** p) + 3); }
    for (const T of [1, 3, 10, 30, 100]) { g.beginPath(); g.moveTo(X(T), tp); g.lineTo(X(T), bt); g.stroke(); g.textAlign = 'center'; g.fillText(T + ' keV', X(T), bt + 12); }
    g.fillText(t('ax.t', 'temperature'), (l + r) / 2, bt + 23);
    g.save(); g.translate(x0 + 9, (tp + bt) / 2); g.rotate(-Math.PI / 2); g.fillText('n·T·τE (keV·s/m³)', 0, 0); g.restore();
    const curve = (Q: number, col: string, lab: string, at: number) => {
      g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); let on = false, lx = 0, ly = 0;
      for (let i = 0; i <= 120; i++) { const T = 10 ** (tl0 + (tl1 - tl0) * i / 120), v = needed(T, Q); if (!Number.isFinite(v) || v <= 0 || v > 10 ** pl1) { on = false; continue; } const x = X(T), y = Y(v); if (on) g.lineTo(x, y); else g.moveTo(x, y); on = true; if (T > at && !lx) { lx = x; ly = y; } }
      g.stroke(); if (lx) { g.fillStyle = col; g.textAlign = 'left'; g.fillText(lab, lx + 4, ly - 4); }
    };
    curve(1, 'rgba(127,178,255,.8)', 'Q = 1', 14); curve(10, 'rgba(255,210,122,.85)', 'Q = 10', 30); curve(Infinity, 'rgba(255,111,90,.9)', t('ignl', 'ignition'), 55);
    const tp3 = P.n * P.T * P.tau, ux = X(clamp(P.T, 1, 100)), uy = Y(clamp(tp3, 10 ** pl0, 10 ** pl1));
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(ux, uy, 7, 0, 7); g.stroke(); g.fillStyle = '#ff9f5a'; g.beginPath(); g.arc(ux, uy, 4, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 11px ui-monospace,monospace'; g.textAlign = ux > (l + r) / 2 ? 'right' : 'left'; g.fillText(t('you', 'your plasma'), ux + (ux > (l + r) / 2 ? -10 : 10), uy + 4);
  }
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'; const sup = (n: number) => String(n).split('').map((c) => SUP[+c]).join('');
  loop(ctx, S.cv, (dt) => {
    const g = S.g, W = S.w, H = S.h, wide = W > 640;
    g.fillStyle = '#06060c'; g.fillRect(0, 0, W, H);
    if (wide) { drawTokamak(g, W * .27, H * .48, Math.min(W * .17, H * .5), dt); drawLawson(g, W * .52, 14, W * .46, H - 28); }
    else { drawTokamak(g, W / 2, H * .22, Math.min(W * .3, H * .24), dt); drawLawson(g, 8, H * .44, W - 16, H * .54); }
  });
}
