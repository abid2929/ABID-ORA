/* 061 Interactive Data World. A small data studio that runs in the browser:
   · Load a table: Anscombe's quartet (the real 1973 data), live dice rolls, points you click,
     timings of the files this very page loaded (measured by your browser), or your own CSV
     (pasted or opened; it never leaves your device).
   · The columns are typed automatically and summarised (count, mean, median, spread, range).
   · Chart it as a scatter plot with a fitted line and correlation, a histogram, bars of a
     category, or a line, and split any chart into small panels by a category.
   · In a scatter plot you can drag points and watch the line and r change, which shows how much
     one point can matter. Export the chart as PNG or the table as CSV. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, select, stats, buttons, check, local, loop, clamp, store, rng, download } from './kit';

/* ---------- table tools ---------- */
export type Cell = string | number | null;
export interface Table { cols: string[]; rows: Cell[][]; num: boolean[] }

/** RFC-4180 style CSV: quoted fields, doubled quotes, commas/newlines inside quotes, CRLF, ; or tab separators */
export function parseCSV(text: string, maxRows = 5000): string[][] {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch: string) => first.split(ch).length - 1;
  const sep = [',', ';', '\t'].sort((a, b) => count(b) - count(a))[0];
  const out: string[][] = []; let row: string[] = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === '') q = true;
    else if (c === sep) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((v) => v.trim() !== '')) out.push(row); row = []; if (out.length > maxRows) break; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); if (row.some((v) => v.trim() !== '')) out.push(row); }
  return out;
}
const numRe = /^[-+]?(\d+([.,]\d*)?|[.,]\d+)([eE][-+]?\d+)?%?$/;
export function toNum(s: string): number | null { const v = s.trim().replace(/\s/g, ''); if (!v || !numRe.test(v)) return null; const n = parseFloat(v.replace(',', '.')); return Number.isFinite(n) ? n : null; }
/** first row = header; a column is numeric when at least 80% of its non-empty cells are numbers */
const blank = (s: string) => !s || /^(n\/?a|null|none|-|—)$/i.test(s);
export function makeTable(grid: string[][]): Table {
  const head = grid[0] || [], body = grid.slice(1), w = Math.max(head.length, ...body.map((r) => r.length), 0);
  const cols = Array.from({ length: w }, (_, i) => (head[i] || '').trim() || `col ${i + 1}`);
  const num = cols.map((_, i) => { let n = 0, k = 0; for (const r of body) { const s = (r[i] ?? '').trim(); if (blank(s)) continue; k++; if (toNum(s) !== null) n++; } return k > 0 && n / k >= .8; });
  const rows = body.map((r) => cols.map((_, i) => { const s = (r[i] ?? '').trim(); if (blank(s)) return null; return num[i] ? toNum(s) : s; }));
  return { cols, rows, num };
}
export function toCSV(tb: Table) { const esc = (v: Cell) => { const s = v === null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [tb.cols.map(esc).join(','), ...tb.rows.map((r) => r.map(esc).join(','))].join('\n'); }
export function summary(a: number[]) {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y), n = v.length;
  if (!n) return { n: 0, mean: NaN, median: NaN, sd: NaN, min: NaN, max: NaN };
  const mean = v.reduce((s, x) => s + x, 0) / n, median = n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
  const sd = n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, median, sd, min: v[0], max: v[n - 1] };
}
/** least-squares line y = a + b·x and Pearson r */
export function linreg(xs: number[], ys: number[]) {
  const n = xs.length; if (n < 2) return { a: NaN, b: NaN, r: NaN };
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const b = sxx ? sxy / sxx : NaN; return { a: my - b * mx, b, r: sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN };
}
export function histogram(a: number[], bins: number, lo?: number, hi?: number) {
  const v = a.filter(Number.isFinite); const mn = lo ?? Math.min(...v), mx = hi ?? Math.max(...v), w = (mx - mn) / bins || 1;
  const counts = new Array(bins).fill(0); for (const x of v) counts[clamp(Math.floor((x - mn) / w), 0, bins - 1)]++;
  return { lo: mn, w, counts };
}
/** "nice" axis ticks (1, 2, 5 × 10ⁿ) */
export function niceTicks(lo: number, hi: number, n = 5) {
  if (!(hi > lo)) { hi = lo + 1; lo -= 1; }
  const raw = (hi - lo) / n, p = 10 ** Math.floor(Math.log10(raw)), m = raw / p, step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  const out: number[] = []; for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(+v.toFixed(12));
  return { ticks: out, step };
}
export const fmtN = (v: number) => (!Number.isFinite(v) ? '—' : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2) : String(+v.toFixed(Math.abs(v) >= 100 ? 1 : 3)));

/* ---------- built-in data ---------- */
/** Anscombe, F. J. (1973). Graphs in Statistical Analysis. The American Statistician 27(1), 17–21. */
export const ANSCOMBE = (() => {
  const x = [10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5], x4 = [8, 8, 8, 8, 8, 8, 8, 19, 8, 8, 8];
  const y = [[8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68], [9.14, 8.14, 8.74, 8.77, 9.26, 8.10, 6.13, 3.10, 9.13, 7.26, 4.74], [7.46, 6.77, 12.74, 7.11, 7.81, 8.84, 6.08, 5.39, 8.15, 6.42, 5.73], [6.58, 5.76, 7.71, 8.84, 8.47, 7.04, 5.25, 12.50, 5.56, 7.91, 6.89]];
  const rows: Cell[][] = []; ['I', 'II', 'III', 'IV'].forEach((s, k) => y[k].forEach((v, i) => rows.push([s, k === 3 ? x4[i] : x[i], v])));
  return { cols: ['set', 'x', 'y'], rows, num: [false, true, true] } as Table;
})();
export function diceTable(dice: number, rolls: number, R: () => number): Table {
  const rows: Cell[][] = [];
  for (let i = 0; i < rolls; i++) { let s = 0, mx = 0; for (let d = 0; d < dice; d++) { const v = 1 + Math.floor(R() * 6); s += v; mx = Math.max(mx, v); } rows.push([i + 1, s, mx, s / dice]); }
  return { cols: ['roll', 'sum', 'highest', 'average'], rows, num: [true, true, true, true] };
}
function pageTable(): Table {
  const ent = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).slice(0, 400);
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  const all: PerformanceResourceTiming[] = nav ? [nav as unknown as PerformanceResourceTiming, ...ent] : ent;
  const kind = (e: PerformanceResourceTiming) => { const u = e.name.split('?')[0]; const ext = (u.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase(); return e.entryType === 'navigation' ? 'page' : ext === 'js' || ext === 'mjs' ? 'script' : ext === 'css' ? 'style' : /^(png|jpe?g|webp|avif|gif|svg)$/.test(ext) ? 'image' : /^(woff2?|ttf|otf)$/.test(ext) ? 'font' : ext === 'json' ? 'data' : e.initiatorType || 'other'; };
  const rows: Cell[][] = all.map((e) => [e.name.split('?')[0].split('/').pop() || '/', kind(e), Math.round(e.startTime), Math.round(e.duration * 10) / 10, e.transferSize ? Math.round(e.transferSize / 102.4) / 10 : null, e.decodedBodySize ? Math.round(e.decodedBodySize / 102.4) / 10 : null]);
  return { cols: ['file', 'type', 'start ms', 'duration ms', 'transfer kB', 'size kB'], rows, num: [false, false, true, true, true, true] };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(420px, 58vw, 640px)';
  const S = canvas(L.view, t('cv', 'A chart of the chosen data: scatter plot, histogram, bars or line, optionally split into panels.'), { alpha: false });
  type Cfg = { src: string; chart: string; x: string; y: string; split: string; agg: string; bins: number; fit: boolean; dice: number; rolls: number };
  const def: Cfg = { src: 'anscombe', chart: 'scatter', x: 'x', y: 'y', split: 'set', agg: 'count', bins: 12, fit: true, dice: 2, rolls: 300 };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'src' in v && 'chart' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);
  const clicks = store<[number, number, string][]>(ctx.id, 'clicks', [], (v) => Array.isArray(v));
  const csvStore = store<string>(ctx.id, 'csv', '', (v) => typeof v === 'string');
  const PAL = ['#2f6fd0', '#d9822b', '#2e9e6b', '#c04a6d', '#7b5cc4', '#8a7a2a', '#3aa3b8', '#6b6b6b'];
  const INK = '#24211c', MUTED = '#7a7366', BG = '#f6f2e9';
  let tb: Table = ANSCOMBE, edited = false, rollSeed = 1;

  function load() {
    edited = false;
    if (cfg.src === 'anscombe') tb = { ...ANSCOMBE, rows: ANSCOMBE.rows.map((r) => [...r]) };
    else if (cfg.src === 'dice') tb = diceTable(cfg.dice, cfg.rolls, rng(rollSeed));
    else if (cfg.src === 'page') tb = pageTable();
    else if (cfg.src === 'clicks') tb = { cols: ['x', 'y', 'group'], rows: clicks.get().map((p) => [...p]), num: [true, true, false] };
    else { const g = parseCSV(csvStore.get()); tb = g.length ? makeTable(g) : { cols: ['x', 'y'], rows: [], num: [true, true] }; }
    const nums = tb.cols.filter((_, i) => tb.num[i]), cats = tb.cols.filter((_, i) => !tb.num[i]);
    if (!tb.cols.includes(cfg.x)) cfg.x = (cfg.chart === 'bars' ? cats[0] : nums[0]) || tb.cols[0] || '';
    if (!nums.includes(cfg.y)) cfg.y = nums[1] || nums[0] || '';
    if (cfg.split && !cats.includes(cfg.split)) cfg.split = '';
  }
  const ci = (name: string) => tb.cols.indexOf(name);
  const numCol = (name: string, rows = tb.rows) => { const i = ci(name); return rows.map((r) => (i >= 0 && typeof r[i] === 'number' ? (r[i] as number) : NaN)); };

  /* ---------- panel ---------- */
  heading(L.panel, t('h', 'Data studio'));
  select(L.panel, t('src', 'Data'), [['anscombe', t('s.ans', 'Anscombe’s quartet (1973)')], ['dice', t('s.dice', 'Dice rolls (live)')], ['page', t('s.page', 'This page’s own load timings')], ['clicks', t('s.clicks', 'Points I click')], ['csv', t('s.csv', 'My own CSV')]], cfg.src, (v) => { cfg.src = v; if (v === 'anscombe') { cfg.chart = 'scatter'; cfg.x = 'x'; cfg.y = 'y'; cfg.split = 'set'; } if (v === 'dice') { cfg.chart = 'hist'; cfg.x = 'sum'; cfg.split = ''; } if (v === 'page') { cfg.chart = 'bars'; cfg.x = 'type'; cfg.y = 'transfer kB'; cfg.agg = 'sum'; cfg.split = ''; } if (v === 'clicks') { cfg.chart = 'scatter'; cfg.x = 'x'; cfg.y = 'y'; cfg.split = ''; } hover = -1; L.hud.textContent = ''; save(); load(); build(); lp.play(); });
  const about = note(L.panel, '');
  const srcBox = h('div', {}); L.panel.append(srcBox);
  const chartBox = h('div', {}); L.panel.append(chartBox);
  const out = stats(L.panel, [['a', t('st.rows', 'Rows')], ['b', t('st.r', 'Correlation r')], ['c', t('st.line', 'Fitted line')]]);
  const sumBox = h('div', { class: 'wk-tbl', style: { overflowX: 'auto', fontSize: '.8rem' } }); L.panel.append(sumBox);
  const exportRow = h('div', {}); L.panel.append(exportRow);
  buttons(exportRow, [[t('png', 'Save chart PNG'), () => download(S.cv, `abidora-chart-${cfg.chart}.png`)], [t('csvout', 'Save table CSV'), () => download(new Blob([toCSV(tb)], { type: 'text/csv' }), 'abidora-data.csv')]]);

  function build() {
    srcBox.replaceChildren(); chartBox.replaceChildren();
    const A: Record<string, string> = {
      anscombe: t('a.ans', 'Four small data sets published by the statistician Francis Anscombe in 1973. All four have almost the same mean, spread, correlation (0.816) and fitted line, yet the pictures are completely different. Drag any point to see how one value moves the line.'),
      dice: t('a.dice', 'Real random rolls made in your browser just now (not real-world data). Watch the histogram of the sum: with more dice it turns into a bell curve.'),
      page: t('a.page', 'Measured by your own browser: every file this page loaded, with its type, start time, duration and size. Numbers differ on each device and visit; cached files show 0 kB transferred.'),
      clicks: t('a.clicks', 'Click the chart to add points in the chosen group, drag to move them, and right-click a point to delete it (on a touch screen, use Clear points). They are kept in this browser only.'),
      csv: t('a.csv', 'Paste a table with a header row, or open a .csv file. It is read in your browser and kept only here; nothing is uploaded. Up to 5,000 rows.'),
    };
    about.textContent = A[cfg.src] || '';
    if (cfg.src === 'dice') {
      range(srcBox, t('dice', 'Dice per roll'), { min: 1, max: 10, value: cfg.dice }, (v) => { cfg.dice = v; save(); load(); lp.play(); });
      range(srcBox, t('rolls', 'Rolls'), { min: 20, max: 3000, step: 20, value: cfg.rolls }, (v) => { cfg.rolls = v; save(); load(); lp.play(); });
      buttons(srcBox, [[t('reroll', 'Roll again'), () => { rollSeed++; load(); lp.play(); }, true]]);
    }
    if (cfg.src === 'page') buttons(srcBox, [[t('remeasure', 'Measure again'), () => { load(); build(); lp.play(); }]]);
    if (cfg.src === 'clicks') {
      seg(srcBox, t('group', 'Group'), [['A', 'A'], ['B', 'B'], ['C', 'C']], clickGroup, (v) => { clickGroup = v; });
      buttons(srcBox, [[t('clear', 'Clear points'), () => { clicks.set([]); load(); lp.play(); }]]);
    }
    if (cfg.src === 'csv') {
      const ta = h('textarea', { rows: 5, spellcheck: false, 'aria-label': t('paste', 'Paste CSV here'), placeholder: 'city,year,rain mm\nDhaka,2020,2100\n…', style: { width: '100%', fontFamily: 'ui-monospace, monospace', fontSize: '.8rem' } }) as HTMLTextAreaElement;
      ta.value = csvStore.get(); srcBox.append(ta);
      const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv', 'aria-label': t('open', 'Open a CSV file') }) as HTMLInputElement;
      const use = (s: string) => { if (s.length > 2_000_000) { L.hud.textContent = t('big', 'That file is larger than 2 MB; please use a smaller one.'); return; } csvStore.set(s); ta.value = s; load(); build(); lp.play(); };
      file.addEventListener('change', () => { const f = file.files?.[0]; if (f) f.text().then(use); file.value = ''; });
      buttons(srcBox, [[t('use', 'Use this table'), () => use(ta.value), true], [t('open', 'Open a CSV file'), () => file.click()]]);
    }
    const nums = tb.cols.filter((_, i) => tb.num[i]), cats = tb.cols.filter((_, i) => !tb.num[i]);
    seg(chartBox, t('chart', 'Chart'), [['scatter', t('c.scatter', 'Scatter')], ['hist', t('c.hist', 'Histogram')], ['bars', t('c.bars', 'Bars')], ['line', t('c.line', 'Line')]], cfg.chart, (v) => { cfg.chart = v; if (v === 'bars' && !cats.includes(cfg.x)) cfg.x = cats[0] || cfg.x; if (v !== 'bars' && !nums.includes(cfg.x)) cfg.x = nums[0] || cfg.x; save(); build(); lp.play(); });
    const xOpts = (cfg.chart === 'bars' ? cats : nums).map((c) => [c, c] as [string, string]);
    if (xOpts.length) select(chartBox, cfg.chart === 'bars' ? t('cat', 'Category') : cfg.chart === 'hist' ? t('col', 'Column') : t('xax', 'Across (x)'), xOpts, cfg.x, (v) => { cfg.x = v; save(); lp.play(); });
    if (cfg.chart === 'bars') select(chartBox, t('agg', 'Bar height'), [['count', t('g.count', 'Number of rows')], ...nums.flatMap((c) => [[`mean:${c}`, `${t('g.mean', 'Average of')} ${c}`], [`sum:${c}`, `${t('g.sum', 'Total of')} ${c}`]] as [string, string][])], cfg.agg === 'count' ? 'count' : `${cfg.agg}:${cfg.y}`, (v) => { const [a, c] = v.split(/:(.*)/s); cfg.agg = a; if (c) cfg.y = c; save(); lp.play(); });
    if (cfg.chart === 'scatter' || cfg.chart === 'line') select(chartBox, t('yax', 'Up (y)'), nums.map((c) => [c, c]), cfg.y, (v) => { cfg.y = v; save(); lp.play(); });
    if (cfg.chart === 'hist') range(chartBox, t('bins', 'Bars in histogram'), { min: 3, max: 40, value: cfg.bins }, (v) => { cfg.bins = v; save(); lp.play(); });
    if (cats.length && cfg.chart !== 'bars') select(chartBox, t('split', 'Split into panels by'), [['', t('none', 'No split')], ...cats.map((c) => [c, c] as [string, string])], cfg.split, (v) => { cfg.split = v; save(); lp.play(); });
    if (cfg.chart === 'scatter') check(chartBox, t('fit', 'Show fitted line'), cfg.fit, (v) => { cfg.fit = v; save(); lp.play(); });
    if (edited && cfg.src === 'anscombe') buttons(chartBox, [[t('restore', 'Put the points back'), () => { load(); build(); lp.play(); }]]);
  }
  let clickGroup = 'A';

  function renderSummary() {
    const nums = tb.cols.filter((_, i) => tb.num[i]).slice(0, 6);
    const groups = cfg.split && cfg.chart !== 'bars' ? [...new Set(tb.rows.map((r) => String(r[ci(cfg.split)] ?? '—')))].slice(0, 6) : [''];
    const tbl = h('table', { style: { borderCollapse: 'collapse', width: '100%' } });
    const th = (s: string) => h('th', { text: s, style: { textAlign: 'right', padding: '2px 6px', fontWeight: '600' } });
    const td = (s: string) => h('td', { text: s, style: { textAlign: 'right', padding: '2px 6px', fontVariantNumeric: 'tabular-nums' } });
    tbl.append(h('tr', {}, ...[groups.length > 1 ? cfg.split : '', t('col', 'Column'), 'n', t('mean', 'mean'), t('median', 'median'), t('sd', 'spread (sd)'), 'min', 'max'].map(th)));
    for (const gname of groups) for (const c of nums) {
      const rows = gname ? tb.rows.filter((r) => String(r[ci(cfg.split)] ?? '—') === gname) : tb.rows, s = summary(numCol(c, rows));
      tbl.append(h('tr', {}, ...[gname, c, String(s.n), fmtN(s.mean), fmtN(s.median), fmtN(s.sd), fmtN(s.min), fmtN(s.max)].map(td)));
    }
    sumBox.replaceChildren(h('p', { class: 'wk-note', text: t('sum', 'Summary of the numeric columns') }), tbl);
  }

  /* ---------- drawing ---------- */
  type Panel = { name: string; rows: number[]; x0: number; y0: number; w: number; h: number };
  let panels: Panel[] = [], xr = [0, 1], yr = [0, 1];
  const groupRows = () => {
    const idx = tb.rows.map((_, i) => i);
    if (!cfg.split || cfg.chart === 'bars') return [{ name: '', rows: idx }];
    const k = ci(cfg.split), m = new Map<string, number[]>(); for (const i of idx) { const g = String(tb.rows[i][k] ?? '—'); if (!m.has(g)) m.set(g, []); m.get(g)!.push(i); }
    return [...m].slice(0, 12).map(([name, rows]) => ({ name, rows }));
  };
  const PX = (p: Panel, v: number) => p.x0 + (v - xr[0]) / (xr[1] - xr[0]) * p.w, PY = (p: Panel, v: number) => p.y0 + p.h - (v - yr[0]) / (yr[1] - yr[0]) * p.h;
  function axes(g: CanvasRenderingContext2D, p: Panel, xt: number[], yt: number[], xlab: string, ylab: string, small: boolean) {
    g.strokeStyle = 'rgba(0,0,0,.08)'; g.lineWidth = 1; g.fillStyle = MUTED; g.font = `${small ? 9 : 11}px ui-monospace, monospace`;
    g.textAlign = 'center'; for (const v of xt) { const x = PX(p, v); g.beginPath(); g.moveTo(x, p.y0); g.lineTo(x, p.y0 + p.h); g.stroke(); g.fillText(fmtN(v), x, p.y0 + p.h + (small ? 11 : 14)); }
    g.textAlign = 'right'; for (const v of yt) { const y = PY(p, v); g.beginPath(); g.moveTo(p.x0, y); g.lineTo(p.x0 + p.w, y); g.stroke(); g.fillText(fmtN(v), p.x0 - 4, y + 3); }
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeRect(p.x0, p.y0, p.w, p.h); g.textAlign = 'start';
    if (!small) { g.fillStyle = INK; g.font = '12px ui-sans-serif, system-ui'; g.textAlign = 'right'; g.fillText(xlab, p.x0 + p.w, p.y0 + p.h + 30); g.textAlign = 'start'; g.save(); g.translate(p.x0 - 44, p.y0); g.rotate(-Math.PI / 2); g.textAlign = 'right'; g.fillText(ylab, 0, 0); g.restore(); g.textAlign = 'start'; }
  }
  let hover = -1, rText = '', lineText = '';
  /** bins: whole-number data gets whole-number-wide bars centred on the values */
  function histSpec() {
    const all = numCol(cfg.x).filter(Number.isFinite), s = summary(all);
    if (!all.length) return { lo: 0, hi: 1, nb: 1 };
    if (all.every((v) => Number.isInteger(v))) { const w = Math.max(1, Math.ceil((s.max - s.min + 1) / cfg.bins)), nb = Math.ceil((s.max - s.min + 1) / w); return { lo: s.min - .5, hi: s.min - .5 + nb * w, nb }; }
    return { lo: s.min, hi: s.max > s.min ? s.max : s.min + 1, nb: cfg.bins };
  }
  function draw(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = BG; g.fillRect(0, 0, W, H);
    const groups = groupRows(), n = groups.length, phone = W < 560;
    const cols = n === 1 ? 1 : phone ? 2 : n <= 4 ? 2 : Math.min(4, Math.ceil(Math.sqrt(n))), rowsN = Math.ceil(n / cols), small = n > 1;
    const ml = small ? 34 : 58, mt = small ? 30 : 22, mb = small ? 22 : 44, mr = 14, gap = 12, top = 8, bottom = phone ? 40 : 34;
    const cw = (W - gap * (cols - 1) - 8) / cols, chh = (H - top - bottom - gap * (rowsN - 1)) / rowsN;
    panels = groups.map((gr, k) => ({ name: gr.name, rows: gr.rows, x0: 4 + (k % cols) * (cw + gap) + ml, y0: top + Math.floor(k / cols) * (chh + gap) + mt, w: cw - ml - mr, h: chh - mt - mb }));
    out('a', String(tb.rows.length)); rText = ''; lineText = '';
    if (!tb.rows.length) { g.fillStyle = MUTED; g.font = '14px ui-sans-serif, system-ui'; g.textAlign = 'center'; g.fillText(cfg.src === 'clicks' ? t('emptyc', 'Click anywhere here to add points.') : t('empty', 'No rows yet.'), W / 2, H / 2); g.textAlign = 'start'; if (cfg.src === 'clicks') { xr = [0, 10]; yr = [0, 10]; } out('b', '—'); out('c', '—'); return; }
    const col = (name: string, i: number) => { const v = tb.rows[i][ci(name)]; return typeof v === 'number' ? v : NaN; };
    if (cfg.chart === 'scatter' || cfg.chart === 'line') {
      const xs = numCol(cfg.x).filter(Number.isFinite), ys = numCol(cfg.y).filter(Number.isFinite);
      if (cfg.src === 'clicks') { xr = [0, 10]; yr = [0, 10]; } else { const xs0 = summary(xs), ys0 = summary(ys), px = (xs0.max - xs0.min) * .08 || 1, py = (ys0.max - ys0.min) * .08 || 1; xr = [xs0.min - px, xs0.max + px]; yr = [Math.min(0, ys0.min) < 0 || ys0.min > (ys0.max - ys0.min) ? ys0.min - py : 0, ys0.max + py]; }
      const xt = niceTicks(xr[0], xr[1], small ? 3 : 6).ticks, yt = niceTicks(yr[0], yr[1], small ? 3 : 5).ticks;
      const rs: string[] = [];
      panels.forEach((p, k) => {
        axes(g, p, xt, yt, cfg.x, cfg.y, small);
        if (small) { g.fillStyle = INK; g.font = '600 12px ui-sans-serif, system-ui'; g.fillText(p.name, p.x0, p.y0 - 8); }
        const pts = p.rows.map((i) => [col(cfg.x, i), col(cfg.y, i), i]).filter((q) => Number.isFinite(q[0]) && Number.isFinite(q[1]));
        g.save(); g.beginPath(); g.rect(p.x0, p.y0, p.w, p.h); g.clip();
        if (cfg.chart === 'line') { pts.sort((a, b) => a[0] - b[0]); g.strokeStyle = PAL[k % PAL.length]; g.lineWidth = 2; g.beginPath(); pts.forEach(([x, y], j) => (j ? g.lineTo(PX(p, x), PY(p, y)) : g.moveTo(PX(p, x), PY(p, y)))); g.stroke(); g.lineWidth = 1; }
        const fit = linreg(pts.map((q) => q[0]), pts.map((q) => q[1]));
        if (cfg.chart === 'scatter' && cfg.fit && Number.isFinite(fit.b)) { g.strokeStyle = '#b8402e'; g.lineWidth = 2; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(PX(p, xr[0]), PY(p, fit.a + fit.b * xr[0])); g.lineTo(PX(p, xr[1]), PY(p, fit.a + fit.b * xr[1])); g.stroke(); g.setLineDash([]); g.lineWidth = 1; }
        const rad = pts.length > 800 ? 2 : small ? 4 : 5;
        for (const [x, y, i] of pts) { const cc = cfg.src === 'clicks' ? PAL[['A', 'B', 'C'].indexOf(String(tb.rows[i][2]))] || PAL[0] : PAL[k % PAL.length]; g.fillStyle = cc; g.globalAlpha = pts.length > 800 ? .5 : .9; g.beginPath(); g.arc(PX(p, x), PY(p, y), i === hover ? rad + 3 : rad, 0, 7); g.fill(); g.globalAlpha = 1; if (i === hover) { g.strokeStyle = INK; g.lineWidth = 2; g.stroke(); g.lineWidth = 1; } }
        g.restore();
        if (Number.isFinite(fit.r)) { rs.push(`${p.name ? p.name + ' ' : ''}${fit.r.toFixed(3)}`); if (small) { g.fillStyle = MUTED; g.font = '10px ui-monospace, monospace'; g.textAlign = 'right'; g.fillText(p.w < 230 ? `r ${fit.r.toFixed(3)}` : `r ${fit.r.toFixed(3)}  y = ${fmtN(fit.a)} + ${fmtN(fit.b)}x`, p.x0 + p.w, p.y0 - 8); g.textAlign = 'start'; } else lineText = `y = ${fmtN(fit.a)} + ${fmtN(fit.b)}·x`; }
      });
      rText = rs.join(' · ');
      out('b', rText ? (rs.length > 1 ? rs.map((s) => s.split(' ').pop()).join(' ') : rText) : '—'); out('c', lineText || (rs.length > 1 ? t('perpanel', 'see each panel') : '—'));
    } else if (cfg.chart === 'hist') {
      const { lo, hi, nb } = histSpec();
      const hs = panels.map((p) => histogram(p.rows.map((i) => col(cfg.x, i)), nb, lo, hi)), top = Math.max(1, ...hs.flatMap((x) => x.counts));
      xr = [lo, hi]; yr = [0, top * 1.1];
      const xt = niceTicks(lo, hi, small ? 3 : 6).ticks, yt = niceTicks(0, top * 1.1, small ? 3 : 5).ticks.filter((v) => Number.isInteger(v));
      panels.forEach((p, k) => {
        axes(g, p, xt, yt, cfg.x, t('count', 'how many'), small);
        if (small) { g.fillStyle = INK; g.font = '600 12px ui-sans-serif, system-ui'; g.fillText(p.name, p.x0, p.y0 - 8); }
        const hh = hs[k]; g.fillStyle = PAL[k % PAL.length];
        hh.counts.forEach((c, j) => { const x0 = PX(p, lo + j * hh.w), x1 = PX(p, lo + (j + 1) * hh.w), y = PY(p, c); g.globalAlpha = j === hover ? 1 : .8; g.fillRect(x0 + .5, y, Math.max(1, x1 - x0 - 1), p.y0 + p.h - y); });
        g.globalAlpha = 1;
        const sm = summary(p.rows.map((i) => col(cfg.x, i))); if (Number.isFinite(sm.mean)) { const x = PX(p, sm.mean); g.strokeStyle = INK; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x, p.y0); g.lineTo(x, p.y0 + p.h); g.stroke(); g.setLineDash([]); g.fillStyle = INK; g.font = '10px ui-monospace, monospace'; g.fillText(`${t('mean', 'mean')} ${fmtN(sm.mean)}`, x + 4, p.y0 + 12); }
      });
      out('b', '—'); out('c', '—');
    } else {
      const k = ci(cfg.x), m = new Map<string, number[]>(); for (let i = 0; i < tb.rows.length; i++) { const key = String(tb.rows[i][k] ?? '—'); if (!m.has(key)) m.set(key, []); m.get(key)!.push(i); }
      let bars = [...m].map(([name, rows]) => { const v = rows.map((i) => col(cfg.y, i)).filter(Number.isFinite); return { name, v: cfg.agg === 'count' ? rows.length : cfg.agg === 'sum' ? v.reduce((a, b) => a + b, 0) : v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0 }; });
      bars.sort((a, b) => b.v - a.v); bars = bars.slice(0, phone ? 10 : 20);
      const p = panels[0], top = Math.max(1e-9, ...bars.map((b) => b.v)), lw = Math.min(phone ? 90 : 150, p.w * .35);
      const p2: Panel = { ...p, x0: p.x0 - ml + lw + 8, w: p.w + ml - lw - 8 - 40 }; panels = [p2];
      xr = [0, top * 1.08]; yr = [0, 1];
      const xt = niceTicks(0, top * 1.08, phone ? 3 : 5).ticks, bh = Math.min(56, p2.h / bars.length); p2.h = bh * bars.length;
      g.strokeStyle = 'rgba(0,0,0,.08)'; g.fillStyle = MUTED; g.font = '10px ui-monospace, monospace'; g.textAlign = 'center';
      for (const v of xt) { const x = PX(p2, v); g.beginPath(); g.moveTo(x, p2.y0); g.lineTo(x, p2.y0 + p2.h); g.stroke(); g.fillText(fmtN(v), x, p2.y0 + p2.h + 14); }
      bars.forEach((b, j) => {
        const y = p2.y0 + j * bh + bh * .12, hgt = bh * .76; g.fillStyle = PAL[j % PAL.length]; g.globalAlpha = j === hover ? 1 : .85; g.fillRect(p2.x0, y, Math.max(1, PX(p2, b.v) - p2.x0), hgt); g.globalAlpha = 1;
        g.fillStyle = INK; g.font = `${Math.min(13, hgt * .7)}px ui-sans-serif, system-ui`; g.textAlign = 'right'; g.fillText(b.name.length > 18 ? b.name.slice(0, 17) + '…' : b.name, p2.x0 - 6, y + hgt * .68);
        g.textAlign = 'start'; g.fillStyle = MUTED; g.fillText(fmtN(b.v), PX(p2, b.v) + 4, y + hgt * .68);
      });
      g.textAlign = 'start'; g.fillStyle = INK; g.font = '12px ui-sans-serif, system-ui';
      g.fillText(cfg.agg === 'count' ? t('g.count', 'Number of rows') : `${cfg.agg === 'sum' ? t('g.sum', 'Total of') : t('g.mean', 'Average of')} ${cfg.y}`, p2.x0, p2.y0 + p2.h + 30);
      hoverBars = bars.map((b) => `${b.name}: ${fmtN(b.v)}`);
      out('b', '—'); out('c', '—');
    }
  }
  let hoverBars: string[] = [];
  const lp = loop(ctx, S.cv, () => { draw(S.g, S.w, S.h); lp.pause(); });

  /* ---------- pointer: hover, drag, add ---------- */
  let drag = -1, dragPanel: Panel | null = null;
  const editable = () => (cfg.chart === 'scatter') && (cfg.src === 'anscombe' || cfg.src === 'clicks' || cfg.src === 'csv' || cfg.src === 'dice');
  function nearest(x: number, y: number) {
    let best = -1, bd = 18 * 18, bp: Panel | null = null;
    for (const p of panels) for (const i of p.rows) { const a = tb.rows[i][ci(cfg.x)], b = tb.rows[i][ci(cfg.y)]; if (typeof a !== 'number' || typeof b !== 'number') continue; const d = (PX(p, a) - x) ** 2 + (PY(p, b) - y) ** 2; if (d < bd) { bd = d; best = i; bp = p; } }
    return { i: best, p: bp };
  }
  const panelAt = (x: number, y: number) => panels.find((p) => x >= p.x0 && x <= p.x0 + p.w && y >= p.y0 && y <= p.y0 + p.h) || null;
  const unX = (p: Panel, x: number) => xr[0] + (x - p.x0) / p.w * (xr[1] - xr[0]), unY = (p: Panel, y: number) => yr[0] + (p.y0 + p.h - y) / p.h * (yr[1] - yr[0]);
  const describe = (i: number) => tb.cols.map((c, k) => `${c}: ${tb.rows[i][k] === null ? '—' : typeof tb.rows[i][k] === 'number' ? fmtN(tb.rows[i][k] as number) : tb.rows[i][k]}`).join(' · ');
  S.cv.style.touchAction = 'none';
  S.cv.addEventListener('pointerdown', (e) => {
    const q = local(e, S.cv);
    if (cfg.chart !== 'scatter') return;
    const n = nearest(q.x, q.y);
    if (cfg.src === 'clicks' && e.button === 2 && n.i >= 0) { const l = clicks.get(); l.splice(n.i, 1); clicks.set(l); load(); hover = -1; lp.play(); renderSummary(); return; }
    if (n.i >= 0 && editable()) { drag = n.i; dragPanel = n.p; S.cv.setPointerCapture(e.pointerId); return; }
    if (cfg.src === 'clicks') { const p = panelAt(q.x, q.y) || (panels.length === 1 ? panels[0] : null); if (!p && tb.rows.length) return; const pp = p || { x0: 58, y0: 22, w: S.w - 72, h: S.h - 100, name: '', rows: [] }; const l = clicks.get(); if (l.length >= 500) l.shift(); l.push([+clamp(unX(pp, q.x), 0, 10).toFixed(2), +clamp(unY(pp, q.y), 0, 10).toFixed(2), clickGroup]); clicks.set(l); load(); lp.play(); renderSummary(); }
  });
  S.cv.addEventListener('pointermove', (e) => {
    const q = local(e, S.cv);
    if (drag >= 0 && dragPanel) {
      const xv = unX(dragPanel, clamp(q.x, dragPanel.x0, dragPanel.x0 + dragPanel.w)), yv = unY(dragPanel, clamp(q.y, dragPanel.y0, dragPanel.y0 + dragPanel.h));
      tb.rows[drag][ci(cfg.x)] = +xv.toFixed(2); tb.rows[drag][ci(cfg.y)] = +yv.toFixed(2);
      if (cfg.src === 'clicks') { const l = clicks.get(); if (l[drag]) { l[drag][0] = +xv.toFixed(2); l[drag][1] = +yv.toFixed(2); clicks.set(l); } }
      if (!edited) { edited = true; build(); }
      hover = drag; L.hud.textContent = describe(drag); lp.play(); return;
    }
    let hv = -1;
    if (cfg.chart === 'scatter' || cfg.chart === 'line') { hv = nearest(q.x, q.y).i; L.hud.textContent = hv >= 0 ? describe(hv) : ''; }
    else if (cfg.chart === 'hist') { const p = panelAt(q.x, q.y); if (p) { const H = histSpec(), v = unX(p, q.x), bw = (H.hi - H.lo) / H.nb; hv = clamp(Math.floor((v - H.lo) / bw), 0, H.nb - 1); const a = H.lo + hv * bw, c = histogram(p.rows.map((i) => tb.rows[i][ci(cfg.x)] as number), H.nb, H.lo, H.hi).counts[hv]; L.hud.textContent = `${cfg.x} ${fmtN(a)} – ${fmtN(a + bw)}: ${c} ${t('rows', 'rows')}`; } }
    else { const p = panels[0]; if (p && q.y >= p.y0 && q.y <= p.y0 + p.h) { hv = Math.floor((q.y - p.y0) / Math.min(56, p.h / Math.max(1, hoverBars.length))); L.hud.textContent = hoverBars[hv] || ''; } }
    if (hv !== hover) { hover = hv; lp.play(); }
  });
  const up = () => { if (drag >= 0) { drag = -1; dragPanel = null; renderSummary(); } };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('pointerleave', () => { if (drag < 0 && hover !== -1) { hover = -1; L.hud.textContent = ''; lp.play(); } });
  S.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  S.onResize(() => lp.play());

  /* keep the summary table in step with the controls and edits */
  L.panel.addEventListener('change', () => renderSummary());
  L.panel.addEventListener('click', (e) => { if ((e.target as HTMLElement).tagName === 'BUTTON') setTimeout(renderSummary, 0); });
  load(); build(); renderSummary(); lp.play();
}
