/* 029 Forest World: Forest Succession. A one-hectare plot grows tree by tree. Each tree competes
   for light with its taller neighbours; pioneers race up in the open, shade-tolerant species win
   in the long run. Burn, storm or thin the stand and watch it recover. The title word is cut out
   of the living canopy (adapted from video ref 4). Carbon uses a published allometric equation. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, buttons, stats, loop, rng, clamp } from './kit';

interface Sp { n: string; col: string; grow: number; hmax: number; tol: number; life: number; seed: number; wood: number }
/* growth m/yr at full light, max height m, shade tolerance 0..1, lifespan yr, seeds/yr, wood density g/cm³ */
const SP: Record<string, Sp> = {
  birch: { n: 'Birch (pioneer)', col: '#c9d66b', grow: 1.1, hmax: 24, tol: .1, life: 90, seed: 3, wood: .51 },
  pine: { n: 'Pine', col: '#5f8f5a', grow: .7, hmax: 32, tol: .25, life: 250, seed: 1.6, wood: .42 },
  oak: { n: 'Oak', col: '#7c9a3c', grow: .45, hmax: 30, tol: .45, life: 400, seed: .9, wood: .6 },
  beech: { n: 'Beech (shade-tolerant)', col: '#2f6b4a', grow: .4, hmax: 35, tol: .85, life: 300, seed: 1, wood: .62 },
};
const KEYS = Object.keys(SP);
interface Tree { x: number; y: number; h: number; age: number; sp: string; vig: number }
const SIZE = 100; /* metres */

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#9ccf6a');
  L.view.style.background = '#0f1a12';
  L.view.style.display = 'grid'; L.view.style.placeItems = 'stretch'; L.view.style.gridTemplateRows = 'auto 1fr auto';
  const title = h('canvas', { 'aria-hidden': 'true', style: { width: '100%', height: '120px', display: 'block', position: 'relative' } }) as HTMLCanvasElement;
  const stage = h('div', { style: { position: 'relative', minHeight: '360px' } });
  const chart = h('canvas', { role: 'img', 'aria-label': t('chart', 'Trees of each species over time'), style: { width: '100%', height: '110px', display: 'block', position: 'relative' } }) as HTMLCanvasElement;
  L.view.append(title, stage, chart);
  const S = canvas(stage, t('cv', 'One-hectare forest plot from above, with a side view of tree heights'));
  Object.assign(S.cv.style, { position: 'absolute', inset: '0' });
  const info = stats(L.panel, [['year', t('year', 'Year')], ['n', t('n', 'Trees')], ['tall', t('tall', 'Tallest')], ['c', t('c', 'Carbon stored')]]);
  let R = rng(11), trees: Tree[] = [], year = 0, speed = 4, acc = 0, start = 'meadow';
  const hist: Record<string, number>[] = [];
  const crown = (tr: Tree) => Math.max(.6, tr.h * .22);
  function reset(kind: string) {
    R = rng(kind === 'meadow' ? 11 : kind === 'pine' ? 23 : 37); trees = []; year = 0; hist.length = 0;
    const n = kind === 'meadow' ? 40 : 160;
    for (let i = 0; i < n; i++) trees.push({ x: R() * SIZE, y: R() * SIZE, h: kind === 'meadow' ? .5 + R() : 4 + R() * 18, age: kind === 'meadow' ? 1 : 10 + R() * 60, sp: kind === 'pine' ? (R() < .85 ? 'pine' : KEYS[Math.floor(R() * 4)]) : KEYS[Math.floor(R() * 4)], vig: 1 });
    record();
  }
  function light(tr: Tree, grid: Tree[][]) {
    /* share of sky not covered by taller neighbouring crowns */
    let shade = 0; const r = crown(tr), gx = Math.floor(tr.x / 10), gy = Math.floor(tr.y / 10);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const o of grid[((gy + dy + 10) % 10) * 10 + ((gx + dx + 10) % 10)] ?? []) {
      if (o === tr || o.h <= tr.h) continue; const d = Math.hypot(o.x - tr.x, o.y - tr.y), ro = crown(o);
      if (d < r + ro) shade += clamp((r + ro - d) / (2 * Math.min(r, ro)), 0, 1) * Math.min(1, (ro * ro) / (r * r)) * .7;
    }
    return clamp(1 - shade, .02, 1);
  }
  function stepYear() {
    year++;
    const grid: Tree[][] = Array.from({ length: 100 }, () => []); for (const tr of trees) grid[Math.floor(tr.y / 10) % 10 * 10 + Math.floor(tr.x / 10) % 10].push(tr);
    const born: Tree[] = [];
    for (const tr of trees) {
      const s = SP[tr.sp], li = light(tr, grid);
      /* tolerant species keep growing in shade; pioneers stall */
      const eff = li ** (1.6 - s.tol * 1.4);
      tr.h += s.grow * eff * (1 - tr.h / s.hmax); tr.age++;
      tr.vig = tr.vig * .7 + eff * .3;
      if (tr.h > 3 && R() < s.seed * .08 * li) { const a = R() * 6.283, d = 2 + R() * 18; born.push({ x: (tr.x + Math.cos(a) * d + SIZE) % SIZE, y: (tr.y + Math.sin(a) * d + SIZE) % SIZE, h: .3, age: 0, sp: tr.sp, vig: 1 }); }
    }
    trees = trees.filter((tr) => { const s = SP[tr.sp]; const die = (tr.vig < .12 ? .25 : 0) + (tr.age > s.life ? .08 : 0) + .004; return R() > die; }).concat(born);
    if (trees.length > 900) trees = trees.sort((a, b) => b.h - a.h).slice(0, 900);
    record();
  }
  function carbon() {
    /* Chave et al. (2014): AGB = 0.0673 × (ρ D² H)^0.976 kg, with D (cm) from a height-diameter guess */
    let kg = 0; for (const tr of trees) { const D = Math.max(1, tr.h * 1.3), s = SP[tr.sp]; kg += .0673 * (s.wood * D * D * tr.h) ** .976; }
    return kg * .47 / 1000; /* tonnes of carbon, about 47% of dry biomass */
  }
  function record() {
    const c: Record<string, number> = {}; for (const k of KEYS) c[k] = 0; for (const tr of trees) if (tr.h > 2) c[tr.sp]++;
    hist.push(c); if (hist.length > 400) hist.shift();
    info('year', String(year)); info('n', String(trees.filter((x) => x.h > 2).length)); info('tall', `${Math.max(0, ...trees.map((x) => x.h)).toFixed(1)} m`); info('c', `${carbon().toFixed(0)} t C`);
  }
  function disturb(kind: string) {
    if (kind === 'fire') { const cx = R() * SIZE, cy = R() * SIZE, r = 25 + R() * 15; trees = trees.filter((tr) => Math.hypot(tr.x - cx, tr.y - cy) > r || R() < .08); L.hud.textContent = t('fired', 'A fire cleared a patch: watch the pioneers move in'); }
    else if (kind === 'storm') { trees = trees.filter((tr) => !(tr.h > 18 && R() < .45)); L.hud.textContent = t('stormed', 'A storm threw many of the tallest trees'); }
    else { const sorted = [...trees].sort((a, b) => b.h - a.h), cut = new Set(sorted.filter((_, i) => i % 3 === 0 && sorted[i].h > 10)); trees = trees.filter((tr) => !cut.has(tr)); L.hud.textContent = t('thinned', 'Every third large tree was felled'); }
    record();
  }
  function paintCanopy(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, hh: number) {
    g.fillStyle = '#2a2a17'; g.fillRect(x0, y0, w, hh);
    const sc = Math.min(w, hh) / SIZE;
    for (const tr of [...trees].sort((a, b) => a.h - b.h)) { const r = crown(tr) * sc; g.fillStyle = SP[tr.sp].col; g.globalAlpha = .55 + Math.min(.45, tr.h / 60); g.beginPath(); g.arc(x0 + tr.x * w / SIZE, y0 + tr.y * hh / SIZE, r, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const side = Math.min(H - 20, W * .55), x0 = 12, y0 = 10;
    paintCanopy(g, x0, y0, side, side);
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.strokeRect(x0, y0, side, side);
    /* side view: a 10 m wide transect through the middle */
    const tx = x0 + side + 18, tw = W - tx - 12, base = y0 + side;
    g.fillStyle = '#16251a'; g.fillRect(tx, y0, tw, side);
    for (const tr of trees.filter((q) => Math.abs(q.y - 50) < 5).sort((a, b) => a.y - b.y)) {
      const x = tx + tr.x / SIZE * tw, hh = tr.h / 40 * side, r = Math.max(2, crown(tr) / SIZE * tw);
      g.strokeStyle = '#6b4f33'; g.lineWidth = Math.max(1, hh / 60); g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - hh); g.stroke();
      g.fillStyle = SP[tr.sp].col; g.beginPath(); g.ellipse(x, base - hh, r, Math.max(2, r * (tr.sp === 'pine' ? 1.6 : .8)), 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '11px ui-monospace,monospace'; g.fillText(t('transect', 'side view through the middle · 40 m tall'), tx + 6, y0 + 14);
    /* title: the word cut out of the canopy */
    const d = Math.min(2, devicePixelRatio || 1), r0 = title.getBoundingClientRect(), tg = title.getContext('2d')!;
    if (title.width !== Math.round(r0.width * d)) { title.width = Math.round(r0.width * d); title.height = Math.round(r0.height * d); }
    tg.setTransform(d, 0, 0, d, 0, 0); tg.clearRect(0, 0, r0.width, r0.height);
    tg.font = `400 ${Math.min(110, r0.width / 4.2)}px "Instrument Serif", Georgia, serif`; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillStyle = '#000';
    tg.fillText(t('word', 'FOREST'), r0.width / 2, r0.height / 2 + 6);
    tg.globalCompositeOperation = 'source-in'; paintCanopy(tg, 0, 0, r0.width, r0.width); tg.globalCompositeOperation = 'source-over';
    /* chart */
    const cr = chart.getBoundingClientRect(), cg = chart.getContext('2d')!;
    if (chart.width !== Math.round(cr.width * d)) { chart.width = Math.round(cr.width * d); chart.height = Math.round(cr.height * d); }
    cg.setTransform(d, 0, 0, d, 0, 0); cg.clearRect(0, 0, cr.width, cr.height);
    const mx = Math.max(10, ...hist.map((r) => KEYS.reduce((a, k) => a + r[k], 0)));
    for (const k of KEYS) { cg.strokeStyle = SP[k].col; cg.lineWidth = 2; cg.beginPath(); hist.forEach((r, i) => { const x = 12 + i / Math.max(1, hist.length - 1) * (cr.width - 24), y = cr.height - 14 - r[k] / mx * (cr.height - 28); i ? cg.lineTo(x, y) : cg.moveTo(x, y); }); cg.stroke(); }
    cg.fillStyle = 'rgba(255,255,255,.6)'; cg.font = '11px ui-monospace,monospace'; cg.fillText(t('chartL', 'trees over 2 m, by species'), 14, 14);
  }
  loop(ctx, S.cv, (dt) => { acc += dt * speed * (ctx.calm ? .5 : 1); let n = 0; while (acc >= 1 && n < 10) { acc -= 1; stepYear(); n++; } draw(); });

  heading(L.panel, t('start', 'Start from'));
  seg(L.panel, t('startS', 'Plot'), [['meadow', t('s.meadow', 'Open meadow')], ['mixed', t('s.mixed', 'Mixed woodland')], ['pine', t('s.pine', 'Pine plantation')]], start, (v) => { start = v; reset(v); });
  heading(L.panel, t('time', 'Time'));
  range(L.panel, t('speed', 'Years per second'), { min: 0, max: 20, value: speed }, (v) => { speed = v; });
  heading(L.panel, t('events', 'Events'));
  buttons(L.panel, [[t('fire', 'Wildfire'), () => disturb('fire')], [t('storm', 'Storm'), () => disturb('storm')], [t('thin', 'Thin the stand'), () => disturb('thin')], [t('reset', 'Restart'), () => reset(start)]]);
  const legend = h('ul', { class: 'wk-list', style: { fontSize: '12px' } });
  for (const k of KEYS) legend.append(h('li', {}, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: SP[k].col, marginInlineEnd: '8px' } }), t('sp.' + k, SP[k].n)));
  L.panel.append(legend);
  note(L.panel, t('how', 'Each year every tree grows according to how much light reaches its crown past taller neighbours. Pioneers such as birch need full sun; beech can wait in the shade for centuries, then take over. This is ecological succession.'));
  note(L.panel, t('honest', 'A simplified model for learning. Carbon uses the Chave et al. (2014) allometric equation with estimated trunk diameters.'));
  reset(start);
}
