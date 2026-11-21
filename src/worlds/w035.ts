/* 035 Environmental Discovery: Carbon Budget Lab. Draw the world's CO2 emissions from today to
   2100 and watch a real (if simplified) climate model respond: a carbon-cycle impulse response
   (Joos et al. 2013) turns emissions into CO2 concentration, the radiative forcing 5.35·ln(C/C0)
   heats a two-layer ocean energy-balance model (Geoffroy et al. 2013), and the result is the
   global warming path, the year 1.5 °C and 2 °C are crossed, and a strip of yearly colours. */
import { type Ctx, h, layout, canvas, heading, note, range, stats, loop, local, clamp, download } from './kit';

export const Y0 = 1850, NOW = 2024, END = 2100, GT_PER_PPM = 7.81;
const IRF = { a0: .2173, a: [.224, .2824, .2763], tau: [394.4, 36.54, 4.304] };
const KNOTS = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100];
const E_NOW = 41; /* GtCO2 per year, fossil fuels plus land use, about 2024 */
/** historical emissions: smooth exponential growth tuned so CO2 reaches about 425 ppm in 2024 */
const hist = (y: number) => E_NOW * Math.exp(.02 * (y - NOW));

export interface Run { years: number[]; E: number[]; C: number[]; T: number[] }
/** run the model from 1850 to 2100 with future emissions from knot values (GtCO2/yr at each KNOTS year) */
export function simulate(knots: number[], ecs = 3, other2100 = .25): Run {
  const lam = 3.71 / ecs, Cm = 7.3, Cd = 106, gam = .73;
  const years: number[] = [], E: number[] = [], C: number[] = [], T: number[] = [];
  const pools = [0, 0, 0]; let perm = 0, Tm = 0, Td = 0;
  for (let y = Y0; y <= END; y++) {
    let e: number;
    if (y <= NOW) e = hist(y);
    else { const xs = [NOW, ...KNOTS], vs = [E_NOW, ...knots]; let i = 0; while (i < xs.length - 2 && y > xs[i + 1]) i++; const f = (y - xs[i]) / (xs[i + 1] - xs[i]); e = vs[i] + (vs[i + 1] - vs[i]) * f; }
    /* carbon cycle: split each year's emission into pools that decay at different speeds */
    const ppm = e / GT_PER_PPM; perm += IRF.a0 * ppm;
    for (let k = 0; k < 3; k++) pools[k] = pools[k] * Math.exp(-1 / IRF.tau[k]) + IRF.a[k] * ppm;
    const co2 = 278 + perm + pools[0] + pools[1] + pools[2];
    /* forcing: CO2 plus other gases and aerosols (net), ramping in with industry */
    const oth = y <= NOW ? .25 * Math.max(0, (y - 1900) / (NOW - 1900)) : .25 + (other2100 - .25) * (y - NOW) / (END - NOW);
    const F = 5.35 * Math.log(co2 / 278) + oth;
    Tm += (F - lam * Tm - gam * (Tm - Td)) / Cm; Td += gam * (Tm - Td) / Cd;
    years.push(y); E.push(e); C.push(co2); T.push(Tm);
  }
  return { years, E, C, T };
}
/** first year a series crosses a level (null if never) */
export const crossYear = (r: Run, lvl: number) => { const i = r.T.findIndex((v) => v >= lvl); return i < 0 ? null : r.years[i]; };

const PRESETS: Record<string, [string, number[]]> = {
  current: ['Current policies', [40, 38, 36, 34, 32, 30, 28, 26]],
  nz2050: ['Net zero by 2050', [24, 11, 0, -2, -3, -3, -3, -3]],
  nz2070: ['Net zero by 2070', [33, 24, 16, 8, 0, -1, -1, -1]],
  high: ['Fossil-fuelled growth', [48, 58, 70, 82, 94, 104, 112, 118]],
  stop: ['Stop everything tomorrow', [0, 0, 0, 0, 0, 0, 0, 0]],
};

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ffb347');
  L.view.style.background = '#0d0f12';
  const S = canvas(L.view, t('cv', 'Three charts: future CO2 emissions you can drag, CO2 concentration, and global warming. Arrow keys adjust the selected decade.'));
  S.cv.style.cursor = 'ns-resize';
  const info = stats(L.panel, [['t2050', t('t2050', 'Warming in 2050')], ['t2100', t('t2100', 'Warming in 2100')], ['peak', t('peak', 'Peak warming')], ['c2100', t('c2100', 'CO2 in 2100')], ['y15', t('y15', 'Passes 1.5 °C')], ['y20', t('y20', 'Passes 2 °C')]]);
  const P = { knots: [...PRESETS.current[1]], ecs: 3, other: .25, sel: 0 };
  let run = simulate(P.knots, P.ecs, P.other), ghost: Run | null = null, dirty = true;
  const recalc = () => { run = simulate(P.knots, P.ecs, P.other); dirty = true; upd(); };
  function upd() {
    const at = (y: number) => run.T[y - Y0];
    info('t2050', `+${at(2050).toFixed(2)} °C`); info('t2100', `+${at(2100).toFixed(2)} °C`);
    const pk = Math.max(...run.T), py = run.years[run.T.indexOf(pk)]; info('peak', `+${pk.toFixed(2)} °C (${py})`);
    info('c2100', `${Math.round(run.C[run.C.length - 1])} ppm`);
    const a = crossYear(run, 1.5), b = crossYear(run, 2); info('y15', a ? String(a) : t('never', 'never')); info('y20', b ? String(b) : t('never', 'never'));
    const cum = run.E.slice(NOW - Y0 + 1).reduce((s, v) => s + v, 0);
    L.hud.textContent = `${t('cum', 'Future emissions')} ${Math.round(cum).toLocaleString(ctx.lang)} GtCO2 · ${pk < 1.5 ? t('ok15', 'stays under 1.5 °C') : pk < 2 ? t('ok20', 'stays under 2 °C') : t('over2', 'goes past 2 °C')}`;
  }
  /* layout of the three panels */
  const geom = () => { const W = S.w, H = S.h, padL = 56, padR = 18, top = 78, gap = 34, ph = (H - top - gap * 2 - 104) / 3; return { W, H, padL, padR, x: (y: number) => padL + (y - Y0) / (END - Y0) * (W - padL - padR), p: [0, 1, 2].map((i) => top + i * (ph + gap)), ph }; };
  const eRange = [-20, 130];
  const eY = (G: ReturnType<typeof geom>, v: number) => G.p[0] + G.ph - (v - eRange[0]) / (eRange[1] - eRange[0]) * G.ph;
  function panel(g: CanvasRenderingContext2D, G: ReturnType<typeof geom>, i: number, title: string, lo: number, hi: number, ticks: number[], fmt: (v: number) => string) {
    const y0 = G.p[i], Y = (v: number) => y0 + G.ph - (v - lo) / (hi - lo) * G.ph;
    g.fillStyle = 'rgba(255,255,255,.03)'; g.fillRect(G.padL, y0, G.W - G.padL - G.padR, G.ph);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'right';
    for (const v of ticks) { g.beginPath(); g.moveTo(G.padL, Y(v)); g.lineTo(G.W - G.padR, Y(v)); g.stroke(); g.fillText(fmt(v), G.padL - 6, Y(v) + 3); }
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '600 11px ui-sans-serif,system-ui'; g.fillText(title, G.padL + 6, y0 - 8);
    return Y;
  }
  const line = (g: CanvasRenderingContext2D, G: ReturnType<typeof geom>, Y: (v: number) => number, arr: number[], col: string, w = 2, from = 0) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = from; i < arr.length; i++) { const x = G.x(Y0 + i), y = Y(arr[i]); i === from ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); };
  function draw() {
    if (!dirty) return; dirty = false;
    const g = S.g, G = geom(); g.clearRect(0, 0, G.W, G.H);
    /* today marker */
    const xn = G.x(NOW); g.fillStyle = 'rgba(255,179,71,.06)'; g.fillRect(xn, 52, G.W - G.padR - xn, G.H - 140);
    g.strokeStyle = 'rgba(255,179,71,.4)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(xn, 52); g.lineTo(xn, G.H - 88); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffb347'; g.font = '10px ui-monospace,monospace'; g.fillText(t('today', 'today'), xn + 4, 64);
    /* emissions */
    const Ye = panel(g, G, 0, t('pE', 'CO2 emissions (GtCO2 per year) · drag the dots'), eRange[0], eRange[1], [0, 40, 80, 120], (v) => String(v));
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(G.padL, Ye(0)); g.lineTo(G.W - G.padR, Ye(0)); g.stroke();
    if (ghost) line(g, G, Ye, ghost.E, 'rgba(255,255,255,.18)', 1.5, NOW - Y0);
    line(g, G, Ye, run.E, 'rgba(255,255,255,.6)', 1.5, 0); line(g, G, Ye, run.E, '#ffb347', 2.5, NOW - Y0);
    KNOTS.forEach((k, i) => { const x = G.x(k), y = eY(G, P.knots[i]); g.fillStyle = i === P.sel ? '#fff' : '#ffb347'; g.beginPath(); g.arc(x, y, i === P.sel ? 7 : 5.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'center'; g.fillText(String(k), x, G.p[0] + G.ph + 12); });
    g.textAlign = 'left';
    /* concentration */
    const Yc = panel(g, G, 1, t('pC', 'CO2 in the air (ppm)'), 260, 1000, [280, 400, 600, 800], (v) => String(v));
    if (ghost) line(g, G, Yc, ghost.C, 'rgba(255,255,255,.18)', 1.5);
    line(g, G, Yc, run.C, '#9ad1ff', 2.2);
    /* temperature with 1.5 and 2 lines */
    const Yt = panel(g, G, 2, t('pT', 'Global warming since 1850–1900 (°C)'), -.3, 5, [0, 1, 2, 3, 4], (v) => '+' + v);
    for (const [lv, col] of [[1.5, 'rgba(255,200,80,.6)'], [2, 'rgba(255,90,60,.7)']] as [number, string][]) { g.strokeStyle = col; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(G.padL, Yt(lv)); g.lineTo(G.W - G.padR, Yt(lv)); g.stroke(); g.setLineDash([]); g.fillStyle = col; g.fillText(`${lv} °C`, G.W - G.padR - 40, Yt(lv) - 4); }
    if (ghost) line(g, G, Yt, ghost.T, 'rgba(255,255,255,.18)', 1.5);
    line(g, G, Yt, run.T, '#ff6a4d', 2.6);
    /* warming stripes: one bar per year, blue (cool) to red (warm) */
    const sy = G.H - 84, bw = (G.W - G.padL - G.padR) / run.T.length;
    run.T.forEach((v, i) => { const f = clamp((v + .3) / 3.3, 0, 1); const r = f < .5 ? 40 + f * 2 * 215 : 255, gg = f < .5 ? 90 + f * 2 * 150 : 240 - (f - .5) * 2 * 200, b = f < .5 ? 220 - f * 2 * 20 : 200 - (f - .5) * 2 * 180; g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(G.padL + i * bw, sy, bw + .6, 22); });
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillText('1850', G.padL, sy - 4); g.textAlign = 'right'; g.fillText('2100', G.W - G.padR, sy - 4); g.textAlign = 'left';
  }
  loop(ctx, S.cv, draw);
  S.onResize(() => { dirty = true; });
  let drag = -1;
  const pick = (e: PointerEvent) => { const p = local(e, S.cv), G = geom(); let best = -1, bd = 28; KNOTS.forEach((k, i) => { const d = Math.abs(G.x(k) - p.x); if (d < bd && p.y < G.p[0] + G.ph + 20) { bd = d; best = i; } }); return best; };
  const setAt = (e: PointerEvent) => { const p = local(e, S.cv), G = geom(); const v = eRange[0] + (G.p[0] + G.ph - p.y) / G.ph * (eRange[1] - eRange[0]); P.knots[drag] = Math.round(clamp(v, -15, 125)); recalc(); };
  S.cv.addEventListener('pointerdown', (e) => { const i = pick(e); if (i < 0) return; ghost ??= run; drag = i; P.sel = i; S.cv.setPointerCapture(e.pointerId); setAt(e); });
  S.cv.addEventListener('pointermove', (e) => { if (drag >= 0) setAt(e); });
  S.cv.addEventListener('pointerup', () => { drag = -1; });
  S.cv.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') P.sel = Math.max(0, P.sel - 1); else if (e.key === 'ArrowRight') P.sel = Math.min(KNOTS.length - 1, P.sel + 1);
    else if (e.key === 'ArrowUp') { P.knots[P.sel] = Math.min(125, P.knots[P.sel] + (e.shiftKey ? 10 : 2)); } else if (e.key === 'ArrowDown') { P.knots[P.sel] = Math.max(-15, P.knots[P.sel] - (e.shiftKey ? 10 : 2)); } else return;
    e.preventDefault(); recalc();
  });

  heading(L.panel, t('scen', 'Start from a path'));
  const row = h('div', { class: 'wk-row' });
  for (const [id, [en, ks]] of Object.entries(PRESETS)) row.append(h('button', { type: 'button', class: 'wk-b', text: t('s.' + id, en), onclick: () => { ghost = run; P.knots = [...ks]; recalc(); } }));
  L.panel.append(row);
  heading(L.panel, t('science', 'The science dials'));
  range(L.panel, t('ecs', 'Climate sensitivity (warming for doubled CO2)'), { min: 2, max: 5, step: .1, value: P.ecs, fmt: (n) => n.toFixed(1) + ' °C' }, (v) => { P.ecs = v; recalc(); });
  range(L.panel, t('other', 'Methane, other gases and aerosols in 2100'), { min: -.2, max: 1.2, step: .1, value: P.other, fmt: (n) => (n >= 0 ? '+' : '') + n.toFixed(1) + ' W/m²' }, (v) => { P.other = v; recalc(); });
  L.panel.append(h('div', { class: 'wk-row' },
    h('button', { type: 'button', class: 'wk-b', text: t('clearg', 'Hide comparison'), onclick: () => { ghost = null; dirty = true; } }),
    h('button', { type: 'button', class: 'wk-b', text: t('csv', 'Download data (CSV)'), onclick: () => download(new Blob(['year,emissions_gtco2,co2_ppm,warming_c\n' + run.years.map((y, i) => `${y},${run.E[i].toFixed(2)},${run.C[i].toFixed(1)},${run.T[i].toFixed(3)}`).join('\n')], { type: 'text/csv' }), 'abidora-carbon-budget.csv') }),
    h('button', { type: 'button', class: 'wk-b pri', text: t('png', 'Save chart (PNG)'), onclick: () => download(S.cv, 'abidora-carbon-budget.png') })));
  note(L.panel, t('how', 'CO2 lasts a very long time: about a fifth of each tonne is still in the air after a thousand years, so warming follows total (cumulative) emissions. That is why warming only stops rising once emissions reach net zero, and why the dates of 1.5 °C and 2 °C move so much with every decade of action. The faint line shows your previous path for comparison.'));
  note(L.panel, t('src', 'Model: Joos et al. (2013) CO2 impulse response, forcing 5.35·ln(C/278) W/m², and a two-layer energy balance model with CMIP5-mean ocean values (Geoffroy et al. 2013). History is a smooth curve tuned to today\'s CO2 (about 425 ppm) and warming (about 1.3–1.4 °C). It is a teaching model: real projections (IPCC AR6) use many more processes.'));
  upd();
}
