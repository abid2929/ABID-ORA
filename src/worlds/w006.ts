/* 006 Bags & Accessories: Tote Pattern Maker. Enter the bag you want; get the cut list, a
   fabric layout packed onto your fabric width, how much fabric to buy, sewing steps, a 3D
   preview and a full-size SVG pattern to print. */
import { bagShow } from './bag3d';
import { type Ctx, h, s, layout, heading, note, range, select, check, color, buttons, stats, store, download, svgBlob, shade } from './kit';

interface Opt { w: number; ht: number; d: number; hl: number; hw: number; sa: number; fw: number; lining: boolean; pocket: boolean; col: string; acc: string }
const DEF: Opt = { w: 38, ht: 40, d: 12, hl: 60, hw: 3, sa: 1, fw: 140, lining: true, pocket: true, col: '#c9b48f', acc: '#6b3f2a' };
type Piece = { name: string; w: number; h: number; n: number; fabric: 'main' | 'lining'; notch?: number };

function pieces(o: Opt): Piece[] {
  const hem = 3, P: Piece[] = [];
  /* boxed-corner body: the bottom half of the depth comes out of each panel, the corners are cut away */
  P.push({ name: 'Body', w: o.w + o.d + 2 * o.sa, h: o.ht + o.d / 2 + o.sa + hem, n: 2, fabric: 'main', notch: o.d / 2 });
  P.push({ name: 'Handle', w: o.hw * 4, h: o.hl + 2 * hem, n: 2, fabric: 'main' });
  if (o.lining) P.push({ name: 'Lining', w: o.w + o.d + 2 * o.sa, h: o.ht + o.d / 2 + 2 * o.sa, n: 2, fabric: 'lining', notch: o.d / 2 });
  if (o.pocket) P.push({ name: 'Pocket', w: Math.round(o.w * .55) + 2 * o.sa, h: Math.round(o.ht * .45) * 2 + 2 * o.sa, n: 1, fabric: o.lining ? 'lining' : 'main' });
  return P;
}
/* shelf packing: tallest first, left to right across the fabric width; pieces may rotate */
function pack(list: Piece[], fw: number) {
  const items: { p: Piece; w: number; h: number; x: number; y: number }[] = [];
  for (const p of list) for (let i = 0; i < p.n; i++) { const rot = p.w > fw - 2 && p.h <= fw - 2; items.push({ p, w: rot ? p.h : p.w, h: rot ? p.w : p.h, x: 0, y: 0 }); }
  items.sort((a, b) => b.h - a.h);
  let x = 1, y = 0, shelf = 0;
  for (const it of items) { if (x + it.w > fw - 1) { x = 1; y += shelf + 1; shelf = 0; } it.x = x; it.y = y; x += it.w + 1; shelf = Math.max(shelf, it.h); }
  return { items, len: y + shelf + 1, fit: items.every((i) => i.w <= fw - 2) };
}

/* owner, 21 Nov: the flat 2D tote pattern maker is retired (kept below, not called) */
export default function (ctx: Ctx) { bagShow(ctx); }
export { maker };
function maker(ctx: Ctx) {
  const t = ctx.t, st = store<Opt>(ctx.id, 'opt', DEF, (v) => !!v && typeof (v as Opt).w === 'number');
  const O: Opt = { ...DEF, ...st.get() };
  const L = layout(ctx); L.view.classList.add('flow');
  const preview = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '18px', alignItems: 'start' } });
  const cut = h('div'), steps = h('ol', { style: { margin: '0', paddingInlineStart: '20px', color: 'var(--bone2)', fontSize: '14px', lineHeight: '1.6', display: 'grid', gap: '4px' } });
  const fabricBox = h('div', { style: { marginTop: '18px' } });
  L.view.append(preview, fabricBox, h('h2', { class: 'mono', text: t('steps', 'How to sew it'), style: { fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400', margin: '22px 0 10px' } }), steps);
  const info = stats(L.panel, [['main', t('main', 'Main fabric')], ['lin', t('lin', 'Lining')], ['vol', t('vol', 'Volume')], ['pcs', t('pcs', 'Pieces to cut')]]);
  heading(L.panel, t('size', 'Finished size'));
  const cm = (v: number) => v + ' cm';
  range(L.panel, t('w', 'Width'), { min: 20, max: 60, value: O.w, fmt: cm }, (v) => { O.w = v; go(); });
  range(L.panel, t('h', 'Height'), { min: 20, max: 55, value: O.ht, fmt: cm }, (v) => { O.ht = v; go(); });
  range(L.panel, t('d', 'Depth (gusset)'), { min: 0, max: 24, value: O.d, fmt: cm }, (v) => { O.d = v; go(); });
  range(L.panel, t('hl', 'Handle length'), { min: 30, max: 120, step: 5, value: O.hl, fmt: cm }, (v) => { O.hl = v; go(); });
  range(L.panel, t('hw', 'Handle width'), { min: 2, max: 5, step: .5, value: O.hw, fmt: cm }, (v) => { O.hw = v; go(); });
  heading(L.panel, t('make', 'Making'));
  select(L.panel, t('fw', 'Fabric width'), [['110', '110 cm (44")'], ['140', '140 cm (55")'], ['150', '150 cm (60")']], String(O.fw), (v) => { O.fw = +v; go(); });
  range(L.panel, t('sa', 'Seam allowance'), { min: .5, max: 1.5, step: .5, value: O.sa, fmt: cm }, (v) => { O.sa = v; go(); });
  check(L.panel, t('lining', 'Lined'), O.lining, (v) => { O.lining = v; go(); });
  check(L.panel, t('pocket', 'Inside pocket'), O.pocket, (v) => { O.pocket = v; go(); });
  color(L.panel, t('col', 'Fabric colour'), O.col, (v) => { O.col = v; go(); });
  color(L.panel, t('acc', 'Handle colour'), O.acc, (v) => { O.acc = v; go(); });
  buttons(L.panel, [[t('svg', 'Download full-size pattern (SVG)'), () => download(svgBlob(fullSize()), 'abidora-tote-pattern.svg'), true], [t('reset', 'Reset'), () => { Object.assign(O, DEF); st.set(O); location.reload(); }]]);
  note(L.panel, t('print', 'The SVG is drawn at real size in centimetres. Print at 100% scale (no “fit to page”) and check the 10 cm test square before cutting.'));

  function tote() {
    /* simple oblique projection of the finished bag */
    const k = 4, W = O.w * k, H = O.ht * k, D = O.d * k * .55, sv = s('svg', { viewBox: `-20 ${-O.hl * k * .42 - 20} ${W + D + 40} ${H + O.hl * k * .42 + D + 40}`, width: '100%', role: 'img', 'aria-label': t('pv', 'Preview of the finished tote') });
    const f = O.col, sd = shade(O.col, -.18), tp = shade(O.col, -.32);
    sv.append(s('path', { d: `M${W} ${D} l${D} ${-D} v${H} l${-D} ${D} Z`, fill: sd }),
      s('path', { d: `M0 ${D} l${D} ${-D} h${W} l${-D} ${D} Z`, fill: tp }),
      s('rect', { x: 0, y: D, width: W, height: H, fill: f, stroke: shade(f, -.4), 'stroke-width': 1 }),
      s('path', { d: `M0 ${D + 10} h${W}`, stroke: shade(f, -.45), 'stroke-dasharray': '4 3' }));
    const hh = O.hl * k * .42, hw = Math.max(5, O.hw * k);
    for (const [x0, dx] of [[W * .25, 0], [W * .25 + D, -D]]) sv.append(s('path', { d: `M${x0 + dx * 0} ${D + dx} q${W * .25} ${-hh * 2} ${W * .5} 0`, fill: 'none', stroke: O.acc, 'stroke-width': hw, 'stroke-linecap': 'round', transform: dx ? `translate(${D} ${-D})` : '' }));
    if (O.pocket) sv.append(s('rect', { x: W * .3, y: D + H * .35, width: W * .4, height: H * .3, fill: 'none', stroke: shade(f, -.35), 'stroke-dasharray': '3 3' }));
    return sv;
  }
  function pieceSvg(p: Piece, scale: number, x = 0, y = 0, rot = false) {
    const g = s('g', { transform: `translate(${x} ${y})` }), w = (rot ? p.h : p.w) * scale, hh = (rot ? p.w : p.h) * scale;
    const fill = p.fabric === 'main' ? O.col : '#e8e4da';
    let d = `M0 0 H${w} V${hh} H0 Z`;
    if (p.notch && !rot) { const n = p.notch * scale; d = `M0 0 H${w} V${hh - n} H${w - n} V${hh} H${n} V${hh - n} H0 Z`; }
    g.append(s('path', { d, fill, 'fill-opacity': .85, stroke: '#222', 'stroke-width': .6 }));
    const lab = s('text', { x: w / 2, y: hh / 2, 'text-anchor': 'middle', 'font-size': Math.max(7, Math.min(14, w / 8)), fill: '#1a1a1a', 'font-family': 'ui-sans-serif,system-ui' }); lab.textContent = t('pc.' + p.name, p.name);
    const dim = s('text', { x: w / 2, y: hh / 2 + Math.max(9, Math.min(15, w / 7)), 'text-anchor': 'middle', 'font-size': Math.max(6, Math.min(11, w / 10)), fill: '#333', 'font-family': 'ui-monospace,monospace' }); dim.textContent = `${+(rot ? p.h : p.w).toFixed(1)}×${+(rot ? p.w : p.h).toFixed(1)}`;
    g.append(lab, dim, s('path', { d: rot ? `M${w * .2} ${hh * .8} H${w * .8} M${w * .8 - 5} ${hh * .8 - 4} L${w * .8} ${hh * .8} L${w * .8 - 5} ${hh * .8 + 4}` : `M${w * .15} ${hh * .2} V${hh * .8} M${w * .15 - 4} ${hh * .2 + 5} L${w * .15} ${hh * .2} L${w * .15 + 4} ${hh * .2 + 5}`, stroke: '#333', fill: 'none', 'stroke-width': .7 }));
    return g;
  }
  function layoutSvg(fab: 'main' | 'lining') {
    const list = pieces(O).filter((p) => p.fabric === fab); if (!list.length) return null;
    const pk = pack(list, O.fw), sc = 2.4, W = O.fw * sc, H = pk.len * sc;
    const sv = s('svg', { viewBox: `-30 -24 ${W + 60} ${H + 48}`, width: '100%', role: 'img', 'aria-label': `${t('lay', 'Cutting layout')}: ${fab}` });
    sv.append(s('rect', { x: 0, y: 0, width: W, height: H, fill: fab === 'main' ? shade(O.col, .55) : '#f4f1ea', stroke: '#888' }));
    for (let x = 0; x <= O.fw; x += 10) sv.append(s('path', { d: `M${x * sc} -6 V0`, stroke: '#999' }));
    const cap = s('text', { x: 0, y: -10, 'font-size': 11, fill: 'currentColor', 'font-family': 'ui-monospace,monospace' }); cap.textContent = `${fab === 'main' ? t('main', 'Main fabric') : t('lin', 'Lining')} · ${O.fw} cm ${t('wide', 'wide')} · ${t('buy', 'buy')} ${Math.ceil(pk.len / 10) / 10} m`;
    sv.append(cap);
    pk.items.forEach((it) => sv.append(pieceSvg(it.p, sc, it.x * sc, it.y * sc, it.w !== it.p.w)));
    return { sv, len: pk.len, fit: pk.fit };
  }
  function fullSize() {
    const all = pieces(O); let y = 2; const W = Math.max(...all.map((p) => p.w)) + 4;
    const total = all.reduce((a, p) => a + p.h + 3, 0) + 16;
    const sv = s('svg', { xmlns: 'http://www.w3.org/2000/svg', width: `${W}cm`, height: `${total}cm`, viewBox: `0 0 ${W} ${total}` });
    sv.append(s('rect', { x: 2, y, width: 10, height: 10, fill: 'none', stroke: '#000', 'stroke-width': .05 }));
    const tq = s('text', { x: 13, y: y + 5, 'font-size': .8 }); tq.textContent = '10 cm test square'; sv.append(tq); y += 13;
    for (const p of all) { const g = pieceSvg(p, 1, 2, y); g.querySelectorAll('[stroke-width]').forEach((e) => e.setAttribute('stroke-width', '.05')); g.querySelectorAll('text').forEach((e) => e.setAttribute('font-size', '1.2')); const c = s('text', { x: 2, y: y - .4, 'font-size': .9 }); c.textContent = `${p.name}: cut ${p.n} (${p.fabric}), includes ${O.sa} cm seam allowance`; sv.append(c, g); y += p.h + 3; }
    return sv;
  }
  function go() {
    st.set(O);
    const P = pieces(O), mainL = layoutSvg('main'), linL = layoutSvg('lining');
    preview.replaceChildren(h('div', { style: { background: 'color-mix(in srgb,var(--bone) 6%,transparent)', borderRadius: '16px', padding: '16px' } }, tote()), cut);
    cut.replaceChildren(h('h2', { class: 'mono', text: t('cutlist', 'Cut list (cm, seam allowance included)'), style: { fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400', margin: '0 0 10px' } }),
      h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' } }, ...P.map((p) => h('tr', { style: { borderBottom: '1px solid var(--line)' } }, h('td', { text: t('pc.' + p.name, p.name), style: { padding: '8px 4px' } }), h('td', { text: `${+p.w.toFixed(1)} × ${+p.h.toFixed(1)}`, class: 'mono', style: { padding: '8px 4px', color: 'var(--signal)' } }), h('td', { text: `× ${p.n}`, style: { padding: '8px 4px', color: 'var(--mute)' } }), h('td', { text: p.fabric === 'main' ? t('main', 'Main fabric') : t('lin', 'Lining'), style: { padding: '8px 4px', color: 'var(--mute)', fontSize: '12px' } })))));
    fabricBox.replaceChildren(...[mainL?.sv, linL?.sv].filter(Boolean).map((x) => h('div', { style: { background: 'color-mix(in srgb,var(--bone) 4%,transparent)', borderRadius: '12px', padding: '10px', marginTop: '10px', color: 'var(--bone2)' } }, x as Node)));
    info('main', mainL ? `${(Math.ceil(mainL.len / 10) / 10).toFixed(1)} m` : '—'); info('lin', linL ? `${(Math.ceil(linL.len / 10) / 10).toFixed(1)} m` : '—');
    info('vol', `${((O.w * O.ht * Math.max(O.d, 1)) / 1000).toFixed(1)} L`); info('pcs', String(P.reduce((a, p) => a + p.n, 0)));
    const S2 = [
      t('s1', `Cut every piece on the straight grain (arrows run parallel to the selvage).`),
      t('s2', `Handles: fold each strip in half lengthwise, press, fold both raw edges to the centre crease, fold again and topstitch both edges: ${O.hw} cm wide.`),
      O.pocket ? t('s3', 'Pocket: fold right sides together, sew around leaving a 6 cm gap, turn, press and topstitch it to one lining panel.') : '',
      t('s4', `Body: place the two body panels right sides together and sew the sides and bottom with ${O.sa} cm seams. Leave the cut-out corners open.`),
      O.d ? t('s5', `Box the corners: pull each corner open so the side seam lies on the bottom seam and sew straight across. This makes the ${O.d} cm depth.`) : '',
      O.lining ? t('s6', 'Lining: sew it the same way, leaving a 12 cm gap in the bottom seam for turning.') : '',
      t('s7', `Pin the handle ends to the top edge, ${Math.round(O.w * .25)} cm in from each side, ends pointing down.`),
      O.lining ? t('s8', 'Put the bag inside the lining, right sides together, sew around the top, turn through the gap, close the gap and topstitch the top edge.') : t('s8b', 'Fold the top edge 1 cm then 2 cm to the inside over the handle ends and stitch around twice.'),
    ].filter(Boolean);
    steps.replaceChildren(...S2.map((x) => h('li', { text: x })));
  }
  go();
}
