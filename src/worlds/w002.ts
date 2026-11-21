/* 002 Clothing Gallery: Capsule Wardrobe Planner. Build a small wardrobe, see every outfit it
   makes, which ones are colour-harmonious, and a seven-day plan that rotates pieces evenly. */
import { scanStudio, SCAN_CLOTHES } from './scanstudio';
import { I18N } from '../scripts/i18n';
import { type Ctx, h, s, layout, heading, note, select, color, buttons, stats, store, hex2hsl, shade, download, svgBlob } from './kit';

type Kind = 'top' | 'bottom' | 'dress' | 'shoes' | 'outer';
type Style = 'tee' | 'shirt' | 'knit' | 'trousers' | 'jeans' | 'skirt' | 'dress' | 'sneaker' | 'boot' | 'jacket' | 'coat';
interface Item { k: Kind; s: Style; c: string }
const KIND: Record<Style, Kind> = { tee: 'top', shirt: 'top', knit: 'top', trousers: 'bottom', jeans: 'bottom', skirt: 'bottom', dress: 'dress', sneaker: 'shoes', boot: 'shoes', jacket: 'outer', coat: 'outer' };
const PATH: Record<Style, string> = {
  tee: 'M30 12 L44 7 Q50 14 56 7 L70 12 L88 28 L78 39 L70 32 L70 102 L30 102 L30 32 L22 39 L12 28 Z',
  shirt: 'M30 12 L44 7 L50 15 L56 7 L70 12 L84 24 L92 84 L82 86 L72 38 L72 106 L28 106 L28 38 L18 86 L8 84 L16 24 Z',
  knit: 'M32 12 Q50 20 68 12 L84 22 Q90 50 92 86 L80 88 L72 42 L72 104 Q50 108 28 104 L28 42 L20 88 L8 86 Q10 50 16 22 Z',
  trousers: 'M30 6 L70 6 L75 112 L57 112 L50 40 L43 112 L25 112 Z',
  jeans: 'M30 6 L70 6 L74 112 L57 112 L50 42 L43 112 L26 112 Z',
  skirt: 'M34 10 L66 10 L82 98 Q50 104 18 98 Z',
  dress: 'M38 6 L44 6 Q50 14 56 6 L62 6 L64 34 Q60 44 62 48 L84 114 Q50 120 16 114 L38 48 Q40 44 36 34 Z',
  sneaker: 'M10 74 Q11 54 28 51 L48 48 Q62 52 72 62 L89 67 Q95 73 91 80 L12 80 Z',
  boot: 'M30 22 L52 22 L53 64 L82 71 Q90 75 88 82 L28 82 Z',
  jacket: 'M30 8 L50 20 L70 8 L88 24 L93 96 L81 98 L74 44 L74 104 L26 104 L26 44 L19 98 L7 96 L12 24 Z',
  coat: 'M30 6 L50 20 L70 6 L88 22 L94 104 L82 106 L76 44 L78 118 L22 118 L24 44 L18 106 L6 104 L12 22 Z',
};
const DETAIL: Partial<Record<Style, string>> = {
  shirt: 'M50 15 L50 106 M44 7 L50 22 L56 7', knit: 'M28 98 L72 98 M30 14 Q50 24 70 14', jeans: 'M50 6 L50 40 M33 14 Q38 22 44 14 M56 14 Q62 22 67 14', trousers: 'M50 6 L50 40 M38 6 L40 112 M62 6 L60 112',
  skirt: 'M34 18 L66 18', dress: 'M37 48 Q50 52 63 48', sneaker: 'M12 74 L91 74 M34 52 L44 66 M40 50 L50 64', boot: 'M30 74 L88 76 M52 34 L30 34',
  jacket: 'M50 20 L50 104 M50 20 L40 46 M50 20 L60 46', coat: 'M50 20 L50 118 M50 20 L38 50 M50 20 L62 50 M24 70 L76 70',
};
const LABEL: Record<Style, string> = { tee: 'T-shirt', shirt: 'Shirt', knit: 'Knit', trousers: 'Trousers', jeans: 'Jeans', skirt: 'Skirt', dress: 'Dress', sneaker: 'Sneakers', boot: 'Boots', jacket: 'Jacket', coat: 'Coat' };
const START: Item[] = [
  { k: 'top', s: 'tee', c: '#f3efe6' }, { k: 'top', s: 'shirt', c: '#9fbcd8' }, { k: 'top', s: 'knit', c: '#2e3a4f' }, { k: 'top', s: 'tee', c: '#b8452f' },
  { k: 'bottom', s: 'jeans', c: '#34507a' }, { k: 'bottom', s: 'trousers', c: '#c6ae86' }, { k: 'bottom', s: 'skirt', c: '#1d1c1a' },
  { k: 'dress', s: 'dress', c: '#5d6b4a' }, { k: 'shoes', s: 'sneaker', c: '#f6f4ef' }, { k: 'shoes', s: 'boot', c: '#4a3326' },
  { k: 'outer', s: 'jacket', c: '#6b5a45' }, { k: 'outer', s: 'coat', c: '#262a33' },
];
const HEX = /^#[0-9a-f]{6}$/i;
const ok = (v: unknown) => Array.isArray(v) && v.length <= 40 && v.every((i) => i && (i as Item).s in KIND && HEX.test((i as Item).c));

/* colour sense: neutrals go with everything; accents must be close (analogous) or opposite (complementary) */
function neutral(c: string) {
  const [hh, ss, l] = hex2hsl(c);
  return ss < 16 || l < 15 || l > 90 || (hh >= 200 && hh <= 235 && l < 32) || (hh >= 20 && hh <= 50 && ss < 55 && l > 55) || (hh >= 200 && hh <= 225 && ss < 60 && l < 58);
}
function harmony(cs: string[]): boolean {
  const acc = cs.filter((c) => !neutral(c)).map((c) => hex2hsl(c)[0]);
  if (acc.length <= 1) return true;
  const d = (a: number, b: number) => { const x = Math.abs(a - b) % 360; return x > 180 ? 360 - x : x; };
  if (acc.length === 2) { const x = d(acc[0], acc[1]); return x < 36 || x > 150; }
  return acc.every((a) => acc.every((b) => d(a, b) < 40));
}

export default function (ctx: Ctx) {
  /* owner, 21 Nov: only the real 3D clothes stay on this page; the code-made dress form and the 2D outfit planner are retired (planner kept below, not called) */
  /* real 3D clothes first (owner, 21 Nov: "make the clothing real too"): licensed scans and cloth simulations, every part recolourable */
  const sc = h('section', { class: 'w002-scan' }); const sHost = h('div');
  sc.append(h('h2', { class: 'w002-sh', text: ctx.t('scan.h', 'Real 3D clothes'), style: { margin: '8px 0 6px', fontSize: 'clamp(22px,3vw,30px)' } }), h('p', { class: 'w002-sp', text: ctx.t('scan.p', 'Leather coats, dresses and tops made from real scans and cloth simulation. Pick a part and give it a new colour or finish; the real grain, folds and stitching stay.'), style: { margin: '0 0 14px', opacity: '.8', maxWidth: '68ch' } }), sHost);
  ctx.root.prepend(sc);
  scanStudio({ ...ctx, root: sHost }, I18N.root, SCAN_CLOTHES, { title: 'clothes', acc: '#d9c7a8' });
}
export function planner(ctx: Ctx) {
  const t = ctx.t, st = store<Item[]>(ctx.id, 'wardrobe', START, ok);
  let W = st.get(); let sel = -1; let shown = 0;
  type Wear = Partial<Record<Kind, number>>;
  let wear: Wear = {};
  const L = layout(ctx);
  L.view.classList.add('flow');
  const rack = h('div', { class: 'w2-rail', role: 'group', 'aria-label': t('rail', 'Clothes rail') });
  const shelf = h('div', { class: 'w2-shelf', role: 'group', 'aria-label': t('shelf', 'Shoe shelf') });
  const stage = h('div', { class: 'w2-stage' });
  const outfitBox = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '18px', alignItems: 'start', marginTop: '22px' } });
  const week = h('ol', { style: { listStyle: 'none', padding: '0', margin: '0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(84px,1fr))', gap: '8px' } });
  L.view.append(h('h2', { class: 'mono', text: t('rack', 'Your rail: click a piece to put it on'), style: { margin: '0 0 4px', fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400' } }), rack, shelf, stage,
    outfitBox, h('h2', { class: 'mono', text: t('week', 'A week without repeats'), style: { margin: '26px 0 12px', fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400' } }), week);

  function garment(it: Item, size = 100): SVGSVGElement {
    const sv = s('svg', { viewBox: '0 0 100 122', width: size, height: size * 1.22, 'aria-hidden': 'true' });
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    const gr = s('linearGradient', { id, x1: 0, y1: 0, x2: 1, y2: 1 }, s('stop', { offset: 0, 'stop-color': shade(it.c, .12) }), s('stop', { offset: 1, 'stop-color': shade(it.c, -.18) }));
    sv.append(s('defs', {}, gr), s('path', { d: PATH[it.s], fill: `url(#${id})`, stroke: shade(it.c, -.45), 'stroke-width': 1.2, 'stroke-linejoin': 'round' }));
    if (DETAIL[it.s]) sv.append(s('path', { d: DETAIL[it.s]!, fill: 'none', stroke: it.s === 'jeans' ? '#d9a441' : shade(it.c, -.4), 'stroke-width': 1, 'stroke-dasharray': it.s === 'jeans' ? '2 1.5' : '', opacity: .85 }));
    return sv;
  }
  function outfits() {
    const by = (k: Kind) => W.map((x, i) => [x, i] as [Item, number]).filter(([x]) => x.k === k);
    const tops = by('top'), bots = by('bottom'), dresses = by('dress'), shoes = by('shoes'), outs: ([Item, number] | null)[] = [null, ...by('outer')];
    const res: number[][] = [];
    for (const sh of shoes) for (const o of outs) {
      for (const tp of tops) for (const bt of bots) res.push([tp[1], bt[1], sh[1], ...(o ? [o[1]] : [])]);
      for (const d of dresses) res.push([d[1], sh[1], ...(o ? [o[1]] : [])]);
    }
    return res;
  }
  function flatlay(o: number[], w = 220) {
    const sv = s('svg', { viewBox: '0 0 220 300', width: '100%', style: `max-width:${w}px`, role: 'img', 'aria-label': o.map((i) => LABEL[W[i].s]).join(', ') });
    const place = (i: number, x: number, y: number, sc: number) => { const g = s('g', { transform: `translate(${x} ${y}) scale(${sc})` }); g.append(...Array.from(garment(W[i]).childNodes)); sv.append(g); };
    const items = o.map((i) => W[i]);
    const outer = o.find((i) => W[i].k === 'outer'), top = o.find((i) => W[i].k === 'top' || W[i].k === 'dress'), bot = o.find((i) => W[i].k === 'bottom'), sh = o.find((i) => W[i].k === 'shoes');
    if (outer !== undefined) place(outer, 6, 10, 1.05);
    if (top !== undefined) place(top, outer !== undefined ? 92 : 50, W[top].k === 'dress' ? 30 : 8, W[top].k === 'dress' ? 1.1 : 1);
    if (bot !== undefined) place(bot, 70, 120, 1.05);
    if (sh !== undefined) place(sh, 4, 196, .9);
    void items; return sv;
  }
  const cnt = stats(L.panel, [['pieces', t('pieces', 'Pieces')], ['all', t('outfits', 'Outfits')], ['good', t('good', 'Harmonious')], ['per', t('per', 'Outfits per piece')]]);
  heading(L.panel, t('add', 'Add a piece'));
  let nStyle: Style = 'tee', nCol = '#c7b299';
  select(L.panel, t('type', 'Type'), (Object.keys(LABEL) as Style[]).map((k) => [k, t('s.' + k, LABEL[k])]), nStyle, (v) => { nStyle = v as Style; });
  color(L.panel, t('colour', 'Colour'), nCol, (v) => { nCol = v; });
  buttons(L.panel, [[t('addb', 'Add to rack'), () => { if (W.length < 40) { W.push({ k: KIND[nStyle], s: nStyle, c: nCol }); save(); } }, true]]);
  heading(L.panel, t('edit', 'Selected piece'));
  const edTxt = note(L.panel, t('pick', 'Tap a piece on the rack to recolour or remove it.'));
  const edCol = color(L.panel, t('colour', 'Colour'), '#888888', (v) => { if (W[sel]) { W[sel].c = v; save(); } });
  const edBtns = buttons(L.panel, [[t('remove', 'Remove piece'), () => { if (W[sel]) { W.splice(sel, 1); sel = -1; wear = {}; save(); } }]]);
  heading(L.panel, t('tools', 'Wardrobe'));
  buttons(L.panel, [[t('reset', 'Start example capsule'), () => { W = structuredClone(START); sel = -1; save(); }], [t('svg', 'Download outfit (SVG)'), () => { const o = good()[shown]; if (o) download(svgBlob(flatlay(o)), 'abidora-outfit.svg'); }]]);
  note(L.panel, t('rule', 'Harmony rule: neutrals (white, black, grey, navy, denim, beige, camel) go with anything. Two accent colours work when they are close on the colour wheel or opposite it. Three accents must all be close.'));

  const good = () => outfits().filter((o) => harmony(o.map((i) => W[i].c)));
  function render() {
    const hanger = (it: Item, i: number) => {
      const on = Object.values(wear).includes(i);
      const hook = s('svg', { viewBox: '0 0 40 22', width: 40, height: 22, 'aria-hidden': 'true' }, s('path', { d: 'M20 1 q5 0 5 5 t-5 5 M20 11 L3 21 H37 Z', fill: 'none', stroke: '#b9b9b9', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
      const b = h('button', { type: 'button', class: 'w2-h' + (on ? ' on' : ''), 'aria-pressed': String(i === sel), 'aria-label': `${t('s.' + it.s, LABEL[it.s])} ${it.c}${on ? ' · ' + t('wearing', 'wearing') : ''}`, onclick: () => { toggleWear(i); sel = i; render(); } },
        it.k === 'shoes' ? null : hook, h('span', { class: 'w2-g' }, garment(it, it.k === 'shoes' ? 60 : 70)), h('span', { class: 'mono w2-tag', text: on ? t('on', 'on') : t('s.' + it.s, LABEL[it.s]) }));
      return b;
    };
    rack.replaceChildren(...W.map((it, i) => [it, i] as [Item, number]).filter(([it]) => it.k !== 'shoes').map(([it, i]) => hanger(it, i)));
    shelf.replaceChildren(...W.map((it, i) => [it, i] as [Item, number]).filter(([it]) => it.k === 'shoes').map(([it, i]) => hanger(it, i)));
    drawStage();
    const all = outfits(), g = good();
    cnt('pieces', String(W.length)); cnt('all', String(all.length)); cnt('good', String(g.length)); cnt('per', W.length ? (g.length / W.length).toFixed(1) : '0');
    edTxt.textContent = W[sel] ? `${t('s.' + W[sel].s, LABEL[W[sel].s])} · ${t('in', 'in')} ${W[sel].c}` : t('pick', 'Tap a piece on the rack to recolour or remove it.');
    edCol.closest('label')!.hidden = !W[sel]; edBtns[0].hidden = !W[sel]; if (W[sel]) edCol.value = W[sel].c;
    shown = g.length ? shown % g.length : 0;
    const o = g[shown];
    const day = h('div', { style: { display: 'grid', gap: '10px' } },
      h('p', { class: 'mono', text: g.length ? `${t('look', 'Look')} ${shown + 1} / ${g.length}` : t('none', 'No harmonious outfit yet: add a top, a bottom (or a dress) and shoes.'), style: { margin: '0', fontSize: '11px', color: 'var(--mute)' } }),
      h('div', { class: 'wk-row' }, h('button', { type: 'button', class: 'wk-b', text: '←', 'aria-label': t('prev', 'Previous look'), onclick: () => { shown = (shown - 1 + g.length) % Math.max(1, g.length); render(); } }), h('button', { type: 'button', class: 'wk-b', text: '→', 'aria-label': t('next', 'Next look'), onclick: () => { shown = (shown + 1) % Math.max(1, g.length); render(); } }), h('button', { type: 'button', class: 'wk-b pri', text: t('shuffle', 'Surprise me'), onclick: () => { shown = Math.floor(Math.random() * Math.max(1, g.length)); render(); } }), o ? h('button', { type: 'button', class: 'wk-b', text: t('wearit', 'Put it on'), onclick: () => wearLook(o) }) : null),
      o ? h('ul', { class: 'wk-list', style: { fontSize: '13px', color: 'var(--bone2)' } }, ...o.map((i) => h('li', {}, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: W[i].c, marginInlineEnd: '8px', border: '1px solid var(--line)' } }), t('s.' + W[i].s, LABEL[W[i].s])))) : null);
    outfitBox.replaceChildren(h('div', { style: { background: 'color-mix(in srgb,var(--bone) 6%,transparent)', borderRadius: '16px', padding: '14px', display: 'grid', placeItems: 'center' } }, o ? flatlay(o) : h('span', { text: '—' })), day);
    /* week plan: greedy, always pick the look whose pieces were worn least */
    const worn = new Map<number, number>(); const plan: number[][] = []; const pool = [...g];
    for (let d = 0; d < 7 && pool.length; d++) {
      let best = 0, bs = Infinity; pool.forEach((p, i) => { const sc = p.reduce((a, x) => a + (worn.get(x) ?? 0) ** 2, 0); if (sc < bs) { bs = sc; best = i; } });
      const p = pool.splice(best, 1)[0]; p.forEach((x) => worn.set(x, (worn.get(x) ?? 0) + 1)); plan.push(p);
    }
    const days = [...Array(7)].map((_, i) => new Intl.DateTimeFormat(ctx.lang, { weekday: 'short' }).format(new Date(2024, 0, 1 + i)));
    week.replaceChildren(...plan.map((p, i) => h('li', { style: { border: '1px solid var(--line)', borderRadius: '12px', padding: '6px', display: 'grid', gap: '4px', justifyItems: 'center' } }, h('span', { class: 'mono', text: days[i], style: { fontSize: '10px', color: 'var(--mute)' } }), flatlay(p, 90))));
  }
  function toggleWear(i: number) {
    const k = W[i].k;
    if (wear[k] === i) { delete wear[k]; return; }
    wear[k] = i;
    if (k === 'dress') { delete wear.top; delete wear.bottom; }
    if (k === 'top' || k === 'bottom') delete wear.dress;
  }
  function cleanWear() { for (const k of Object.keys(wear) as Kind[]) if (wear[k] === undefined || !W[wear[k]!] || W[wear[k]!].k !== k) delete wear[k]; }
  /* the dress form: garments are layered onto a neutral mannequin */
  function drawStage() {
    cleanWear();
    const m = s('svg', { viewBox: '0 0 200 400', class: 'w2-m', role: 'img', 'aria-label': t('mannequin', 'Mannequin wearing') + ': ' + (Object.values(wear).map((i) => LABEL[W[i!].s]).join(', ') || t('nothing', 'nothing yet')) });
    const skin = 'color-mix(in srgb, var(--bone) 55%, #8a7a6a)';
    m.append(s('ellipse', { cx: 100, cy: 392, rx: 70, ry: 6, fill: 'rgba(0,0,0,.25)' }),
      s('path', { d: 'M88 300 L84 384 M112 300 L116 384', stroke: skin, 'stroke-width': 13, 'stroke-linecap': 'round', fill: 'none' }),
      s('path', { d: 'M62 82 L44 196 M138 82 L156 196', stroke: skin, 'stroke-width': 11, 'stroke-linecap': 'round', fill: 'none' }),
      s('path', { d: 'M70 76 Q100 66 130 76 L132 180 Q100 192 68 180 Z', fill: skin }),
      s('rect', { x: 92, y: 48, width: 16, height: 22, rx: 6, fill: skin }),
      s('ellipse', { cx: 100, cy: 34, rx: 19, ry: 23, fill: skin }));
    const put = (i: number | undefined, tf: string) => { if (i === undefined) return; const g = s('g', { class: 'wear', transform: tf }); g.append(...Array.from(garment(W[i]).childNodes)); m.append(g); };
    put(wear.bottom, 'translate(46 168) scale(1.08 1.62)');
    put(wear.dress, 'translate(36 58) scale(1.28 2.25)');
    put(wear.top, 'translate(32 62) scale(1.36 1.12)');
    put(wear.outer, W[wear.outer ?? -1]?.s === 'coat' ? 'translate(28 58) scale(1.44 2.05)' : 'translate(28 58) scale(1.44 1.3)');
    if (wear.shoes !== undefined) { put(wear.shoes, 'translate(52 336) scale(.5)'); put(wear.shoes, 'translate(148 336) scale(-.5 .5)'); }
    const cols = Object.values(wear).map((i) => W[i!].c), full = (wear.top !== undefined && wear.bottom !== undefined) || wear.dress !== undefined;
    const verdict = !cols.length ? t('dress', 'Click pieces on the rail to dress the mannequin.') : harmony(cols) ? (full && wear.shoes !== undefined ? t('works', 'This outfit is colour-harmonious.') : t('partial', 'So far so good: the colours work together.')) : t('clash', 'Two accent colours are fighting here. Try a neutral piece.');
    stage.replaceChildren(m, h('div', { style: { display: 'grid', gap: '10px' } },
      h('p', { text: verdict, style: { margin: '0', fontFamily: 'var(--serif)', fontSize: '24px', lineHeight: '1.15' } }),
      h('ul', { class: 'wk-list', style: { fontSize: '13px', color: 'var(--bone2)' } }, ...Object.values(wear).map((i) => h('li', {}, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: W[i!].c, marginInlineEnd: '8px', border: '1px solid var(--line)' } }), t('s.' + W[i!].s, LABEL[W[i!].s])))),
      h('div', { class: 'wk-row' }, h('button', { type: 'button', class: 'wk-b', text: t('undress', 'Take it all off'), onclick: () => { wear = {}; render(); } }))));
  }
  function wearLook(o: number[]) { wear = {}; o.forEach((i) => { wear[W[i].k] = i; }); render(); }
  function save() { st.set(W); render(); }
  { const g0 = good()[0]; if (g0) g0.forEach((i) => { wear[W[i].k] = i; }); }
  render();
}
