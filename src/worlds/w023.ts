/* 023 Furniture Design: Shelf Studio. Design a bookcase and the beam formula tells you how far each
   shelf will sag under books: δ = 5wL⁴ / 384EI for a resting shelf, wL⁴ / 384EI when fixed at
   both ends. Wood creeps over time, so long-term sag is shown too. Cut list exports as CSV. */
import { type Ctx, h, s, layout, heading, note, range, select, seg, buttons, stats, store, download } from './kit';

/* stiffness (E, GPa), density (kg/m³) and a creep factor for long-term load; typical values */
const MAT: Record<string, { n: string; E: number; rho: number; creep: number; col: string }> = {
  pine: { n: 'Pine', E: 9, rho: 500, creep: 1.6, col: '#e2c48f' },
  oak: { n: 'Oak', E: 12, rho: 720, creep: 1.6, col: '#c49a63' },
  walnut: { n: 'Walnut', E: 11.5, rho: 640, creep: 1.6, col: '#7b5638' },
  ply: { n: 'Birch plywood', E: 8, rho: 680, creep: 1.8, col: '#e8d3a8' },
  mdf: { n: 'MDF', E: 3.5, rho: 750, creep: 2.5, col: '#b49a7a' },
  chip: { n: 'Particle board', E: 2.5, rho: 650, creep: 3, col: '#c8b08b' },
};
const LOADS: [string, number, string][] = [['light', 10, 'Ornaments'], ['paper', 20, 'Paperbacks'], ['hard', 35, 'Hardbacks'], ['vinyl', 45, 'Vinyl records']];
/* sag in mm for a uniformly loaded shelf */
export function sag(spanMm: number, depthMm: number, thickMm: number, E_GPa: number, kgPerM: number, fixed: boolean) {
  const w = kgPerM * 9.81 / 1000, L = spanMm, E = E_GPa * 1000, I = depthMm * thickMm ** 3 / 12; /* N/mm, mm, N/mm², mm⁴ */
  return (fixed ? 1 : 5) * w * L ** 4 / (384 * E * I);
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && typeof v === 'object' && 'mat' in (v as object);
  const st = store(23, 'shelf', { W: 1200, H: 1800, D: 280, T: 18, cols: 2, rows: 5, mat: 'oak', load: 35, fixed: false }, ok);
  const P = { ...st.get() };
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#c49a63');
  L.view.classList.add('flow'); L.view.style.background = '#f4efe7'; L.view.style.color = '#2a221b';
  const svg = s('svg', { viewBox: '0 0 700 520', width: '100%', role: 'img', 'aria-label': t('cv', 'Bookcase front view with shelf sag exaggerated'), style: 'display:block;max-height:560px' });
  const tbl = h('div', { style: { overflowX: 'auto', marginTop: '10px', fontFamily: 'system-ui,sans-serif', fontSize: '13px' } });
  const verdict = h('p', { 'aria-live': 'polite', style: { margin: '0 0 8px', fontFamily: 'var(--serif, Georgia, serif)', fontSize: 'clamp(18px,2vw,24px)' } });
  L.view.append(verdict, svg, tbl);
  const info = stats(L.panel, [['sag', t('sag', 'Sag now')], ['long', t('long', 'Sag after a year')], ['max', t('max', 'Safe load')], ['kg', t('kg', 'Unit weight')]]);
  let exag = 20;

  function calc() {
    const m = MAT[P.mat], span = (P.W - (P.cols + 1) * P.T) / P.cols;
    const d0 = sag(span, P.D, P.T, m.E, P.load, P.fixed), d1 = d0 * m.creep;
    /* visible-sag rule of thumb: about 1/600 of the span (≈ 1.7 mm per metre) */
    const limit = span / 600, safe = P.load * limit / d1;
    info('sag', `${d0.toFixed(1)} mm`); info('long', `${d1.toFixed(1)} mm`); info('max', `${Math.floor(safe)} kg/m`);
    const parts: [string, number, number, number, number][] = [[t('side', 'Side'), P.H, P.D, 2, P.T], [t('div', 'Divider'), P.H - 2 * P.T, P.D, P.cols - 1, P.T], [t('tb', 'Top and bottom'), P.W - 2 * P.T, P.D, 2, P.T], [t('shelfP', 'Shelf'), Math.round(span), P.D, P.cols * Math.max(0, P.rows - 1), P.T], [t('back', 'Back panel'), P.W, P.H, 1, 6]];
    let kg = 0; for (const [, a, b, q, th] of parts) kg += a * b * th * q / 1e9 * m.rho;
    info('kg', `${kg.toFixed(0)} kg`);
    verdict.textContent = d1 <= limit ? t('ok', 'Shelves stay visually straight') : t('bad', 'Shelves will sag visibly: shorten the span, thicken them, or pick a stiffer board');
    draw(span, d0, d1, limit);
    tbl.replaceChildren(h('table', { style: { width: '100%', borderCollapse: 'collapse', minWidth: '420px' } },
      h('thead', {}, h('tr', {}, ...[t('part', 'Part'), t('len', 'Length mm'), t('wid', 'Width mm'), t('thk', 'Thickness mm'), t('qty', 'Qty')].map((x) => h('th', { style: { textAlign: 'start', padding: '6px', borderBottom: '1px solid #2a221b33', fontWeight: '500' }, text: x })))),
      h('tbody', {}, ...parts.filter((p) => p[3] > 0).map(([n, a, b, q, th]) => h('tr', {}, ...[n, a, b, th, q].map((x) => h('td', { style: { padding: '6px', borderBottom: '1px solid #2a221b14' }, text: String(x) })))))));
    (tbl as HTMLElement & { csv?: string }).csv = ['part,length_mm,width_mm,thickness_mm,qty', ...parts.filter((p) => p[3] > 0).map(([n, a, b, q, th]) => `"${n}",${a},${b},${th},${q}`)].join('\n');
    st.set(P);
  }
  function draw(span: number, d0: number, d1: number, limit: number) {
    svg.replaceChildren();
    const m = MAT[P.mat], sc = Math.min(560 / P.W, 460 / P.H), ox = (700 - P.W * sc) / 2, oy = 500 - P.H * sc, T = P.T * sc;
    svg.append(s('rect', { x: ox, y: oy, width: P.W * sc, height: P.H * sc, fill: '#e7dccb' }));
    const board = (x: number, y: number, w: number, hh: number) => svg.append(s('rect', { x, y, width: w, height: hh, fill: m.col, stroke: '#2a221b', 'stroke-width': .6 }));
    board(ox, oy, T, P.H * sc); board(ox + P.W * sc - T, oy, T, P.H * sc);
    const bay = (P.W * sc - T) / P.cols;
    for (let c = 1; c < P.cols; c++) board(ox + c * bay, oy + T, T, P.H * sc - 2 * T);
    board(ox, oy, P.W * sc, T); board(ox, 500 - T, P.W * sc, T);
    const gapH = (P.H * sc - T) / P.rows, bend = d1 * sc * exag, bad = d1 > limit;
    for (let r = 1; r < P.rows; r++) for (let c = 0; c < P.cols; c++) {
      const x0 = ox + c * bay + T, x1 = ox + (c + 1) * bay, y = oy + r * gapH;
      /* deflected shape, exaggerated so you can see it */
      const path = `M${x0} ${y} Q${(x0 + x1) / 2} ${y + 2 * bend} ${x1} ${y} L${x1} ${y + T} Q${(x0 + x1) / 2} ${y + T + 2 * bend} ${x0} ${y + T} Z`;
      svg.append(s('path', { d: path, fill: m.col, stroke: bad ? '#b3261e' : '#2a221b', 'stroke-width': bad ? 1.4 : .6 }));
      /* books */
      const n = Math.floor((x1 - x0) / 9); for (let b = 0; b < n; b++) { const bx = x0 + 2 + b * 9, hh = gapH * (.55 + ((b * 37 + r * 11) % 30) / 100); const sagAt = bend * 4 * ((bx - x0) / (x1 - x0)) * (1 - (bx - x0) / (x1 - x0)); svg.append(s('rect', { x: bx, y: y - hh + sagAt, width: 7, height: hh, fill: ['#5b7083', '#a3533a', '#d9b45a', '#3e5641', '#8a6e8f'][(b + r) % 5], opacity: P.load > 15 ? 1 : .35 })); }
    }
    const tt = s('text', { x: 20, y: 24, 'font-size': 13, fill: '#2a221b', 'font-family': 'ui-monospace,monospace' }); tt.textContent = `${t('span', 'span')} ${Math.round(span)} mm · ${t('sagx', 'sag drawn')} ×${exag}`; svg.append(tt);
  }

  heading(L.panel, t('size', 'Size'));
  range(L.panel, t('W', 'Width'), { min: 400, max: 2400, step: 10, value: P.W, fmt: (n) => n + ' mm' }, (v) => { P.W = v; calc(); });
  range(L.panel, t('H', 'Height'), { min: 600, max: 2400, step: 10, value: P.H, fmt: (n) => n + ' mm' }, (v) => { P.H = v; calc(); });
  range(L.panel, t('D', 'Depth'), { min: 150, max: 450, step: 5, value: P.D, fmt: (n) => n + ' mm' }, (v) => { P.D = v; calc(); });
  range(L.panel, t('cols', 'Bays'), { min: 1, max: 6, value: P.cols }, (v) => { P.cols = v; calc(); });
  range(L.panel, t('rows', 'Shelf rows'), { min: 2, max: 9, value: P.rows }, (v) => { P.rows = v; calc(); });
  heading(L.panel, t('mat', 'Material'));
  select(L.panel, t('board', 'Board'), Object.entries(MAT).map(([k, m]) => [k, `${t('m.' + k, m.n)} (E ${m.E} GPa)`]), P.mat, (v) => { P.mat = v; calc(); });
  seg(L.panel, t('T', 'Thickness'), [['12', '12 mm'], ['18', '18 mm'], ['25', '25 mm'], ['32', '32 mm']], String(P.T), (v) => { P.T = +v; calc(); });
  seg(L.panel, t('fix', 'Shelves'), [['rest', t('f.rest', 'Resting on pins')], ['fixed', t('f.fixed', 'Fixed at both ends')]], P.fixed ? 'fixed' : 'rest', (v) => { P.fixed = v === 'fixed'; calc(); });
  heading(L.panel, t('load', 'Load'));
  seg(L.panel, t('what', 'What goes on it'), LOADS.map(([k, , n]) => [k, t('l.' + k, n)]), LOADS.find((l) => l[1] === P.load)?.[0] ?? 'hard', (v) => { P.load = LOADS.find((l) => l[0] === v)![1]; calc(); });
  range(L.panel, t('exag', 'Exaggerate sag'), { min: 1, max: 50, value: exag, fmt: (n) => '×' + n }, (v) => { exag = v; calc(); });
  buttons(L.panel, [[t('csv', 'Download cut list (CSV)'), () => download(new Blob([(tbl as HTMLElement & { csv?: string }).csv ?? ''], { type: 'text/csv' }), 'abidora-bookcase-cut-list.csv'), true]]);
  note(L.panel, t('how', 'Shelf sag uses beam theory: stiffness grows with the cube of thickness, and sag grows with the fourth power of span, so halving a span cuts sag sixteen times. Wood and boards creep under steady load; the year figure includes that.'));
  note(L.panel, t('honest', 'Material values are typical; real boards vary. Rule of thumb for “looks straight”: sag under 1/600 of the span.'));
  calc();
}
