/* 051 Creative Canvas: Wet Paper Studio. A watercolour studio where the paint behaves like paint.
   The sheet is a grid of paper cells. Water spreads between wet cells and soaks slowly into dry
   ones; pigment travels with the water; water evaporates fastest at the edge of a wet patch, so flow
   carries pigment outward and leaves the dark rim of a dried wash; pigment settles faster in the
   paper's hollows (granulation); and colours mix by absorbing light (Beer-Lambert), so layers glaze
   rather than cover. Paint wet-in-wet, drop clean water into a drying wash for a bloom, lift with a
   tissue, tilt the board to make it run, then keep paintings or download them. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, local, loop, clamp, store, download, noise2, more } from './kit';

export interface Pig { id: string; name: string; k: [number, number, number]; gran: number }
/* absorbance per channel (R, G, B) for one full load: what each pigment takes out of white light */
export const PIGS: Pig[] = [
  { id: 'ultra', name: 'Ultramarine', k: [2.1, 1.5, .25], gran: 1 },
  { id: 'sienna', name: 'Burnt sienna', k: [.35, 1.15, 1.9], gran: .7 },
  { id: 'rose', name: 'Quinacridone rose', k: [.2, 1.8, 1.0], gran: .1 },
  { id: 'yellow', name: 'Hansa yellow', k: [.05, .3, 2.1], gran: .05 },
  { id: 'green', name: 'Sap green', k: [1.5, .45, 1.7], gran: .2 },
  { id: 'indigo', name: 'Indigo', k: [1.9, 1.5, .9], gran: .3 },
  { id: 'grey', name: "Payne's grey", k: [1.45, 1.3, 1.05], gran: .4 },
  { id: 'red', name: 'Pyrrol red', k: [.12, 2.0, 1.7], gran: .05 },
];
const PAPER: [number, number, number] = [250, 247, 239];

/** the wet-paper simulation, separable from drawing so it can be tested */
export class Sheet {
  n: number; w: Float32Array; s: Float32Array; d: Float32Array; hgt: Float32Array; fw: Float32Array; fs: Float32Array;
  tilt = 0; evap = 1; time = 0;
  constructor(public gw: number, public gh: number, paper = 'cold', seed = 3) {
    this.n = gw * gh; this.w = new Float32Array(this.n); this.s = new Float32Array(this.n * 3); this.d = new Float32Array(this.n * 3);
    this.hgt = new Float32Array(this.n); this.fw = new Float32Array(this.n); this.fs = new Float32Array(this.n * 3);
    this.setPaper(paper, seed);
  }
  setPaper(kind: string, seed = 3) {
    const nz = noise2(seed), sc = kind === 'rough' ? .32 : kind === 'hot' ? .9 : .5, amp = kind === 'rough' ? 1 : kind === 'hot' ? .25 : .6;
    for (let j = 0; j < this.gh; j++) for (let i = 0; i < this.gw; i++) { const v = nz(i * sc, j * sc) * .6 + nz(i * sc * 2.3, j * sc * 2.3) * .4; this.hgt[j * this.gw + i] = .5 + v * .5 * amp; }
  }
  /** load water and pigment into a soft disc */
  dab(cx: number, cy: number, r: number, water: number, pig: Pig | null, load: number, dry = false) {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.gh - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.gw - 1, Math.ceil(cx + r)); x++) {
      const q = (x - cx) ** 2 + (y - cy) ** 2; if (q > r2) continue;
      const f = 1 - q / r2, i = y * this.gw + x;
      if (dry) { /* a nearly dry brush only touches the tops of the paper grain */ if (pig && this.hgt[i] > .6 - f * .14) for (let c = 0; c < 3; c++) this.d[i * 3 + c] += pig.k[c] * load * .12 * f; continue; }
      this.w[i] = Math.min(1.2, this.w[i] + water * Math.sqrt(f) * .45);
      if (pig) for (let c = 0; c < 3; c++) this.s[i * 3 + c] += pig.k[c] * load * Math.sqrt(f) * .07;
    }
  }
  /** a tissue: soaks up water and the pigment still floating in it, and a little of what has settled */
  lift(cx: number, cy: number, r: number) {
    const r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.gh - 1, Math.ceil(cy + r)); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.gw - 1, Math.ceil(cx + r)); x++) {
      const q = (x - cx) ** 2 + (y - cy) ** 2; if (q > r2) continue; const f = 1 - q / r2, i = y * this.gw + x;
      this.w[i] *= 1 - .6 * f; for (let c = 0; c < 3; c++) { this.s[i * 3 + c] *= 1 - .7 * f; this.d[i * 3 + c] *= 1 - (this.w[i] > .02 ? .08 : .025) * f; }
    }
  }
  wetness() { let a = 0; for (let i = 0; i < this.n; i++) if (this.w[i] > .02) a++; return a / this.n; }
  /** one time step: flow, carry, evaporate, settle */
  step(dt = 1) {
    const { gw, gh, w, s, d, hgt, fw, fs } = this; fw.fill(0); fs.fill(0);
    const kFlow = .22 * dt, soak = .04 * dt, tilt = this.tilt * .05 * dt;
    /* flow between each cell and its right and lower neighbour */
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      for (const j of [x + 1 < gw ? i + 1 : -1, y + 1 < gh ? i + gw : -1]) {
        if (j < 0) continue;
        const wi = w[i], wj = w[j]; if (wi < .002 && wj < .002) continue;
        const wet = wi > .02 && wj > .02;
        /* water levels off between wet cells; it creeps into dry paper only from a full puddle */
        let f = (wi - wj + (hgt[i] - hgt[j]) * .06) * (wet ? kFlow : soak * Math.max(0, Math.max(wi, wj) - .35) * 4);
        if (j === i + gw && wet) f += tilt * Math.min(wi, 1); /* gravity pulls down the tilted board */
        f = clamp(f, -wj * .24, wi * .24); if (f === 0) continue;
        fw[i] -= f; fw[j] += f;
        const src = f > 0 ? i : j, frac = Math.abs(f) / Math.max(1e-6, w[src]);
        for (let c = 0; c < 3; c++) { const m = s[src * 3 + c] * frac * (f > 0 ? 1 : -1); fs[i * 3 + c] -= m; fs[j * 3 + c] += m; }
      }
    }
    for (let i = 0; i < this.n; i++) {
      w[i] = Math.max(0, w[i] + fw[i]); for (let c = 0; c < 3; c++) s[i * 3 + c] = Math.max(0, s[i * 3 + c] + fs[i * 3 + c]);
    }
    /* evaporation: faster where a wet cell borders dry paper, which drives flow toward the edge */
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
      const i = y * gw + x; if (w[i] <= 0) continue;
      let dryN = 0; if (x > 0 && w[i - 1] < .02) dryN++; if (x < gw - 1 && w[i + 1] < .02) dryN++; if (y > 0 && w[i - gw] < .02) dryN++; if (y < gh - 1 && w[i + gw] < .02) dryN++;
      w[i] = Math.max(0, w[i] - (.0007 + dryN * .0035) * dt * this.evap);
      /* settling: some floating pigment lands each step, more in the paper's hollows; all of it when dry */
      const rate = w[i] < .015 ? 1 : (.002 + (1 - hgt[i]) ** 2 * .02) * dt;
      for (let c = 0; c < 3; c++) { const m = s[i * 3 + c] * rate; s[i * 3 + c] -= m; d[i * 3 + c] += m; }
      if (w[i] < .015) w[i] = 0;
    }
    this.time += dt;
  }
  dryAll() { for (let i = 0; i < this.n; i++) { this.w[i] = 0; for (let c = 0; c < 3; c++) { this.d[i * 3 + c] += this.s[i * 3 + c]; this.s[i * 3 + c] = 0; } } }
  wash(amount: number) { for (let i = 0; i < this.n; i++) this.w[i] = Math.min(1.2, this.w[i] + amount); }
  total() { let a = 0; for (let i = 0; i < this.n * 3; i++) a += this.s[i] + this.d[i]; return a; }
  /** RGBA pixels: paper times exp(-absorbance), with wet areas a touch darker and glossier */
  render(out: Uint8ClampedArray, granShow = 1) {
    for (let i = 0; i < this.n; i++) {
      const wet = this.w[i] > .02, tex = .965 + this.hgt[i] * .05 * granShow, p = i * 4;
      for (let c = 0; c < 3; c++) out[p + c] = PAPER[c] * tex * Math.exp(-(this.d[i * 3 + c] + this.s[i * 3 + c] * .85)) * (wet ? .97 : 1);
      out[p + 3] = 255;
    }
  }
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(400px, 60vw, 640px)';
  const S = canvas(L.view, t('cv', 'A sheet of watercolour paper. Paint on it; the water and pigment keep moving until the paper dries.'), { alpha: false });
  const st = store<{ pig: string; tool: string; size: number; water: number; load: number; paper: string; tilt: boolean }>(ctx.id, 'cfg', { pig: 'ultra', tool: 'wet', size: 30, water: .8, load: .7, paper: 'cold', tilt: false }, (v) => typeof v === 'object' && v !== null && 'pig' in v);
  const cfg = st.get(); const save = () => st.set(cfg);
  let sheet: Sheet | null = null; const img = document.createElement('canvas'), ig = img.getContext('2d')!;
  const undo: { w: Float32Array; s: Float32Array; d: Float32Array }[] = [];

  heading(L.panel, t('pigh', 'Pigments'));
  const palRow = h('div', { class: 'wk-row', role: 'group', 'aria-label': t('pigh', 'Pigments'), style: { flexWrap: 'wrap', gap: '6px' } }); L.panel.append(palRow);
  const pigName = note(L.panel, '');
  const swatch = (p: Pig) => `rgb(${PAPER.map((c, i) => Math.round(c * Math.exp(-p.k[i] * .7))).join(',')})`;
  const pigBtns = PIGS.map((p) => { const b = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('pg.' + p.id, p.name), title: t('pg.' + p.id, p.name), style: { width: '38px', height: '38px', borderRadius: '50%', padding: '0', background: swatch(p) }, onclick: () => { cfg.pig = p.id; save(); markPig(); } }); palRow.append(b); return b; });
  function markPig() { PIGS.forEach((p, i) => { pigBtns[i].setAttribute('aria-pressed', String(p.id === cfg.pig)); pigBtns[i].style.outline = p.id === cfg.pig ? '3px solid var(--fg, #222)' : 'none'; pigBtns[i].style.outlineOffset = '2px'; }); const p = PIGS.find((q) => q.id === cfg.pig) ?? PIGS[0]; pigName.textContent = t('pg.' + p.id, p.name) + (p.gran > .5 ? ` · ${t('granulating', 'granulating')}` : ''); }
  heading(L.panel, t('brushh', 'Brush'));
  seg(L.panel, t('tooll', 'Tool'), [['wet', t('tl.wet', 'Wet brush')], ['water', t('tl.water', 'Clean water')], ['dry', t('tl.dry', 'Dry brush')], ['lift', t('tl.lift', 'Tissue lift')]], cfg.tool, (v) => { cfg.tool = v; save(); });
  buttons(L.panel, [[t('undo', 'Undo'), () => popUndo()], [t('clear', 'New sheet'), () => { push(); fresh(); }]]);
  const mo = more(L.panel);
  range(mo, t('size', 'Brush size'), { min: 4, max: 70, value: cfg.size, fmt: (v) => `${v} px` }, (v) => { cfg.size = v; save(); });
  range(mo, t('water', 'Water on the brush'), { min: .1, max: 1.2, step: .05, value: cfg.water, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { cfg.water = v; save(); });
  range(mo, t('load', 'Pigment on the brush'), { min: .05, max: 1.5, step: .05, value: cfg.load, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { cfg.load = v; save(); });
  heading(mo, t('sheeth', 'Paper'));
  seg(mo, t('paperl', 'Surface'), [['hot', t('p.hot', 'Hot-pressed (smooth)')], ['cold', t('p.cold', 'Cold-pressed')], ['rough', t('p.rough', 'Rough')]], cfg.paper, (v) => { cfg.paper = v; save(); sheet?.setPaper(v); });
  check(mo, t('tilt', 'Tilt the board'), cfg.tilt, (v) => { cfg.tilt = v; save(); if (sheet) sheet.tilt = v ? 1 : 0; });
  buttons(mo, [[t('dry', 'Dry it now'), () => { push(); sheet?.dryAll(); lp.play(); }], [t('wash', 'Wet the whole sheet'), () => { push(); sheet?.wash(.5); lp.play(); }]]);
  const out = stats(mo, [['wet', t('s.wet', 'Wet area')], ['state', t('s.state', 'Paper')]]);
  note(mo, t('tips', 'Try: lay a wash, then drop a second colour into it while it is wet. Wait until it is damp, not wet, and touch it with clean water to make a bloom. Watch the edges darken as each wash dries.'));
  heading(L.panel, t('galh', 'My paintings'));
  buttons(L.panel, [[t('save', 'Save to my paintings'), () => saveGal(), true], [t('dl', 'Download'), () => exportPng()]]);
  const galBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap', gap: '6px' } }); L.panel.append(galBox);
  const gal = store<string[]>(ctx.id, 'gallery', [], (v) => Array.isArray(v));
  const galMsg = note(L.panel, '');

  /* grid about a third of the CSS size: big enough for detail, small enough to run smoothly */
  const cellPx = () => Math.max(2.2, Math.sqrt(S.w * S.h / 95000));
  function fresh() {
    const cp = cellPx(), gw = Math.max(40, Math.round(S.w / cp)), gh = Math.max(30, Math.round(S.h / cp));
    sheet = new Sheet(gw, gh, cfg.paper, (Math.random() * 1e6) | 0); sheet.tilt = cfg.tilt ? 1 : 0; img.width = gw; img.height = gh; lp.play();
  }
  function push() { if (!sheet) return; undo.push({ w: sheet.w.slice(), s: sheet.s.slice(), d: sheet.d.slice() }); while (undo.length > 8) undo.shift(); }
  function popUndo() { const u = undo.pop(); if (!u || !sheet || u.w.length !== sheet.w.length) return; sheet.w.set(u.w); sheet.s.set(u.s); sheet.d.set(u.d); lp.play(); }

  let idle = 0;
  const lp = loop(ctx, S.cv, (dt) => {
    if (!sheet) return;
    const wet = sheet.wetness();
    if (wet > 0) { const k = Math.min(4, Math.round(dt * 60 * 2)); for (let i = 0; i < Math.max(1, k); i++) sheet.step(1); idle = 0; } else idle++;
    if (idle > 2 && !drawing) { lp.pause(); }
    const id = ig.createImageData(sheet.gw, sheet.gh); sheet.render(id.data, cfg.paper === 'rough' ? 1.6 : cfg.paper === 'hot' ? .4 : 1); ig.putImageData(id, 0, 0);
    S.g.imageSmoothingEnabled = true; S.g.imageSmoothingQuality = 'high'; S.g.drawImage(img, 0, 0, S.w, S.h);
    out('wet', `${Math.round(wet * 100)}%`); out('state', wet > .001 ? t('st.wet', 'wet, still moving') : t('st.dry', 'dry'));
  });

  /* painting with the pointer: stamps along the path, spaced by a fraction of the brush */
  let drawing = false, lx = 0, ly = 0;
  const toGrid = (x: number, y: number) => [x / S.w * (sheet?.gw ?? 1), y / S.h * (sheet?.gh ?? 1)];
  function stamp(x: number, y: number) {
    if (!sheet) return; const [gx, gy] = toGrid(x, y), r = cfg.size / 2 / S.w * sheet.gw, pig = PIGS.find((p) => p.id === cfg.pig) ?? PIGS[0];
    if (cfg.tool === 'lift') sheet.lift(gx, gy, r);
    else if (cfg.tool === 'water') sheet.dab(gx, gy, r, cfg.water, null, 0);
    else if (cfg.tool === 'dry') sheet.dab(gx, gy, r, 0, pig, cfg.load, true);
    else sheet.dab(gx, gy, r, cfg.water, pig, cfg.load * (1 + pig.gran * .0));
  }
  S.cv.style.touchAction = 'none'; S.cv.style.cursor = 'crosshair';
  S.cv.addEventListener('pointerdown', (e) => { if (!sheet) return; push(); drawing = true; S.cv.setPointerCapture(e.pointerId); const p = local(e, S.cv); lx = p.x; ly = p.y; stamp(p.x, p.y); lp.play(); });
  S.cv.addEventListener('pointermove', (e) => {
    if (!drawing) return; const p = local(e, S.cv), d = Math.hypot(p.x - lx, p.y - ly), stepPx = Math.max(1.5, cfg.size * .2);
    if (d < stepPx) return; const n = Math.ceil(d / stepPx);
    for (let k = 1; k <= n; k++) stamp(lx + (p.x - lx) * k / n, ly + (p.y - ly) * k / n);
    lx = p.x; ly = p.y; lp.play();
  });
  const end = () => { drawing = false; }; S.cv.addEventListener('pointerup', end); S.cv.addEventListener('pointercancel', end);

  function exportCanvas(k: number) {
    const c = document.createElement('canvas'); c.width = Math.round(S.w * k); c.height = Math.round(S.h * k); const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height); return c;
  }
  function exportPng() { download(exportCanvas(Math.max(2, 2000 / S.w)), `abidora-watercolour-${Date.now().toString(36)}.png`); }
  function saveGal() {
    const l = gal.get(); l.unshift(exportCanvas(Math.min(1, 900 / S.w)).toDataURL('image/jpeg', .85)); while (l.length > 6) l.pop();
    while (l.length && !gal.set(l)) l.pop(); galMsg.textContent = l.length ? '' : t('full', 'This browser has no room left to save pictures.'); showGal();
  }
  function showGal() {
    galBox.replaceChildren();
    gal.get().forEach((src, i) => {
      const b = h('button', { type: 'button', class: 'wk-b', title: t('dlone', 'Download this painting'), style: { padding: '2px' }, onclick: () => { const a = h('a', { href: src, download: `abidora-watercolour-${i + 1}.jpg` }); document.body.append(a); a.click(); a.remove(); } }, h('img', { src, alt: `${t('galh', 'My paintings')} ${i + 1}`, width: 84, style: { display: 'block', height: 'auto', borderRadius: '4px' } }));
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove painting'), text: '×', onclick: () => { const l = gal.get(); l.splice(i, 1); gal.set(l); showGal(); } });
      galBox.append(h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '2px' } }, b, del));
    });
  }
  let sized = 0;
  S.onResize(() => { if (!sheet || Math.abs(S.w - sized) > 40) { sized = S.w; fresh(); } else lp.play(); });
  markPig(); showGal(); if (!sheet) { sized = S.w; fresh(); }
}
