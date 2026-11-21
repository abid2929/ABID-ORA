/* 010 Virtual Style Gallery: A Century of Silhouettes. Women's dress silhouettes from 1900 to
   1999 as one parametric shape (shoulder, bust, waist height and width, hip, hem width and
   length, sleeves). Scrub the timeline and the dress morphs from one decade into the next. */
import { type Ctx, h, s, layout, heading, note, range, seg, buttons, store, loop, lerp, clamp, shade, download, svgBlob } from './kit';

interface Sil { sh: number; bu: number; wy: number; ww: number; hip: number; hem: number; hy: number; sl: number; flare: number; neck: number; c: string }
/* units: figure is 100 wide at the shoulders' widest, 0 = neck, 300 = floor */
const ERAS: [number, string, string, Sil][] = [
  [1900, 'Edwardian S-bend', 'A straight-front corset pushed the bust forward and the hips back; skirts swept the floor in a trumpet shape, collars rose high.', { sh: 38, bu: 44, wy: 78, ww: 22, hip: 46, hem: 92, hy: 300, sl: 1, flare: .9, neck: 0, c: '#d9c9b0' }],
  [1912, 'Hobble and high waist', 'Waists rose toward the bust and skirts narrowed at the ankle, the “hobble” look of the early 1910s.', { sh: 36, bu: 38, wy: 62, ww: 30, hip: 38, hem: 30, hy: 292, sl: .8, flare: .1, neck: 10, c: '#a8b8a0' }],
  [1925, 'Drop waist', 'The waist dropped to the hips and the line went straight and loose. By the middle of the decade hems reached the knee.', { sh: 38, bu: 36, wy: 128, ww: 38, hip: 40, hem: 44, hy: 205, sl: 0, flare: .2, neck: 22, c: '#c7a6c9' }],
  [1935, 'Bias cut', 'The natural waist returned. Fabric cut on the bias clung and fell in long, slim columns, often to the ankle for evening.', { sh: 40, bu: 38, wy: 88, ww: 28, hip: 38, hem: 52, hy: 286, sl: 0, flare: .45, neck: 18, c: '#b9c4d9' }],
  [1943, 'Wartime utility', 'Padded shoulders, a defined waist and knee-length skirts with little extra fabric, shaped by rationing.', { sh: 50, bu: 40, wy: 86, ww: 28, hip: 40, hem: 46, hy: 214, sl: .45, flare: .35, neck: 14, c: '#8f7f65' }],
  [1952, 'The New Look', 'After Christian Dior’s 1947 collection: soft shoulders, a tightly cinched waist and a very full skirt to mid-calf.', { sh: 38, bu: 42, wy: 84, ww: 22, hip: 56, hem: 112, hy: 238, sl: .25, flare: 1, neck: 16, c: '#c75b5b' }],
  [1966, 'Shift and mini', 'A simple shift with no defined waist; hemlines rose well above the knee in the mid-1960s.', { sh: 36, bu: 36, wy: 120, ww: 36, hip: 38, hem: 44, hy: 172, sl: 0, flare: .25, neck: 20, c: '#f0c24e' }],
  [1975, 'Maxi and empire', 'Long flowing maxi dresses, often with a high empire waist and wide sleeves.', { sh: 36, bu: 36, wy: 66, ww: 30, hip: 40, hem: 70, hy: 296, sl: 1.05, flare: .7, neck: 26, c: '#c8794a' }],
  [1986, 'Power shoulders', 'Wide padded shoulders over a narrow waist and a short or straight skirt: the strong inverted triangle of the 1980s.', { sh: 60, bu: 42, wy: 92, ww: 30, hip: 40, hem: 38, hy: 200, sl: .9, flare: .1, neck: 18, c: '#3f63b5' }],
  [1996, 'Minimal slip', 'Pared back: a bias slip dress on thin straps, close to the body, in quiet colours.', { sh: 30, bu: 34, wy: 92, ww: 30, hip: 36, hem: 42, hy: 260, sl: 0, flare: .3, neck: 34, c: '#3a3a3c' }],
];

function at(year: number): { s: Sil; i: number; k: number } {
  if (year <= ERAS[0][0]) return { s: ERAS[0][3], i: 0, k: 0 };
  for (let i = 0; i < ERAS.length - 1; i++) {
    const [y0, , , a] = ERAS[i], [y1, , , b] = ERAS[i + 1];
    if (year <= y1) {
      const k = (year - y0) / (y1 - y0), e = k * k * (3 - 2 * k), m = {} as Sil;
      (Object.keys(a) as (keyof Sil)[]).forEach((key) => { if (key === 'c') return; (m as unknown as Record<string, number>)[key] = lerp(a[key] as number, b[key] as number, e); });
      m.c = mixHex(a.c, b.c, e); return { s: m, i: k < .5 ? i : i + 1, k: e };
    }
  }
  return { s: ERAS[ERAS.length - 1][3], i: ERAS.length - 1, k: 1 };
}
function mixHex(a: string, b: string, k: number) { const p = (x: string, i: number) => parseInt(x.slice(1 + i * 2, 3 + i * 2), 16); return '#' + [0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), k)).toString(16).padStart(2, '0')).join(''); }

function dressPath(S: Sil) {
  const cx = 150, top = 40;
  const sh = S.sh, bu = S.bu, wy = top + S.wy, ww = S.ww, hip = S.hip, hy = top + Math.max(S.wy + 20, 130), hem = S.hem, fy = top + S.hy - 40;
  const neckY = top + 6 + S.neck * .6, nw = 12 + S.neck * .4;
  // right half, then mirrored
  const R = [
    `M${cx + nw} ${top}`, `Q${cx + sh * .7} ${top - 2} ${cx + sh} ${top + 10}`,
    `C${cx + bu + 2} ${top + 30} ${cx + bu} ${top + 44} ${cx + bu - 2} ${top + 56}`,
    `C${cx + bu - 4} ${wy - 20} ${cx + ww + 2} ${wy - 8} ${cx + ww} ${wy}`,
    `C${cx + ww + 6} ${wy + 18} ${cx + hip} ${hy - 22} ${cx + hip} ${hy}`,
    `C${cx + hip + (hem - hip) * S.flare * .3} ${hy + (fy - hy) * .4} ${cx + hem} ${fy - 10} ${cx + hem} ${fy}`,
    `Q${cx + hem * .5} ${fy + 8} ${cx} ${fy + 6}`,
  ];
  const L = [`Q${cx - hem * .5} ${fy + 8} ${cx - hem} ${fy}`, `C${cx - hem} ${fy - 10} ${cx - hip - (hem - hip) * S.flare * .3} ${hy + (fy - hy) * .4} ${cx - hip} ${hy}`,
    `C${cx - hip} ${hy - 22} ${cx - ww - 6} ${wy + 18} ${cx - ww} ${wy}`, `C${cx - ww - 2} ${wy - 8} ${cx - bu + 4} ${wy - 20} ${cx - bu + 2} ${top + 56}`,
    `C${cx - bu} ${top + 44} ${cx - bu - 2} ${top + 30} ${cx - sh} ${top + 10}`, `Q${cx - sh * .7} ${top - 2} ${cx - nw} ${top}`, `Q${cx} ${neckY} ${cx + nw} ${top}`, 'Z'];
  return R.join(' ') + ' ' + L.join(' ');
}
function sleeves(S: Sil) {
  if (S.sl < .08) return '';
  const cx = 150, top = 40, len = 20 + S.sl * 110, puff = S.sh > 48 ? 6 : 0, w = 14 + S.sl * 4 + (S.flare > .6 && S.sl > .9 ? 10 : 0);
  const one = (d: number) => `M${cx + d * S.sh} ${top + 10} Q${cx + d * (S.sh + 10 + puff)} ${top + 8} ${cx + d * (S.sh + 14)} ${top + 26} L${cx + d * (S.sh + 18 + w * .4)} ${top + 10 + len} L${cx + d * (S.sh + 18 - w * .6)} ${top + 14 + len} L${cx + d * (S.bu + 1)} ${top + 50} Z`;
  return one(1) + ' ' + one(-1);
}

export default function (ctx: Ctx) {
  const t = ctx.t, st = store<number>(ctx.id, 'year', 1952, (v) => typeof v === 'number' && v >= 1900 && v <= 1999);
  let year = st.get(), playing = false, ghost = true;
  const L = layout(ctx);
  L.view.style.background = 'radial-gradient(circle at 50% 30%, color-mix(in srgb,var(--bone) 9%,transparent), transparent 70%)';
  const sv = s('svg', { viewBox: '0 -10 300 330', role: 'img', style: 'height:min(70vh,640px);width:auto;max-width:100%' });
  const croquis = s('g', { fill: 'none', stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-width': 1 });
  croquis.innerHTML = '<ellipse cx="150" cy="14" rx="11" ry="14"/><path d="M146 27 L146 36 M154 27 L154 36 M150 300 L146 260 M150 300 L154 260"/><path d="M138 300 L142 250 M162 300 L158 250"/>';
  const ghostP = s('path', { fill: 'none', stroke: 'currentColor', 'stroke-opacity': .2, 'stroke-dasharray': '3 3' });
  const sl = s('path', {}), body = s('path', {}), waist = s('path', { fill: 'none', 'stroke-width': 2, 'stroke-opacity': .55 });
  const yr = s('text', { x: 150, y: 318, 'text-anchor': 'middle', 'font-size': 14, fill: 'currentColor', 'font-family': 'ui-monospace,monospace' });
  sv.append(croquis, ghostP, sl, body, waist, yr);
  L.view.append(h('div', { style: { color: 'var(--bone)', display: 'grid', placeItems: 'center' } }, sv));
  const title = h('h2', { style: { fontFamily: 'var(--serif)', fontSize: '30px', fontWeight: '400', margin: '0', textTransform: 'none', letterSpacing: '0', color: 'var(--bone)' } });
  const text = h('p', { style: { margin: '0', color: 'var(--bone2)', lineHeight: '1.55', fontSize: '14.5px' } });
  L.panel.append(title, text);
  const yrR = range(L.panel, t('year', 'Year'), { min: 1900, max: 1999, value: year, fmt: (v) => String(v) }, (v) => { year = v; playing = false; pb.textContent = t('play', 'Play the century'); draw(); });
  const pb = buttons(L.panel, [[t('play', 'Play the century'), () => { playing = !playing; if (year >= 1999) year = 1900; pb.textContent = playing ? t('pause', 'Pause') : t('play', 'Play the century'); }, true]])[0];
  heading(L.panel, t('jump', 'Jump to'));
  const box = h('div', { class: 'wk-seg' });
  box.append(...ERAS.map(([y, n]) => h('button', { type: 'button', text: `${y}s`.replace(/(\d{3})\ds$/, '$10s'), title: t('e' + y, n), onclick: () => { year = y; playing = false; draw(); } })));
  L.panel.append(box);
  seg(L.panel, t('compare', 'Show previous era'), [['on', t('on', 'On')], ['off', t('off', 'Off')]], 'on', (v) => { ghost = v === 'on'; draw(); });
  buttons(L.panel, [[t('svg', 'Download silhouette (SVG)'), () => download(svgBlob(sv.cloneNode(true) as SVGSVGElement), `abidora-silhouette-${year}.svg`)]]);
  note(L.panel, t('note', 'A simplified, stylised reading of widely documented changes in Western women’s fashion; real clothes in every decade were far more varied. Dates are approximate.'));
  function draw() {
    const { s: S, i } = at(year); yrR.set(Math.round(year));
    body.setAttribute('d', dressPath(S)); body.setAttribute('fill', S.c); body.setAttribute('stroke', shade(S.c, -.45));
    sl.setAttribute('d', sleeves(S)); sl.setAttribute('fill', shade(S.c, -.08)); sl.setAttribute('stroke', shade(S.c, -.45));
    const wy = 40 + S.wy; waist.setAttribute('d', `M${150 - S.ww} ${wy} Q150 ${wy + 4} ${150 + S.ww} ${wy}`); waist.setAttribute('stroke', shade(S.c, -.5));
    const prev = ERAS[Math.max(0, ERAS.findIndex(([y]) => y > year) - 2)] ?? ERAS[0];
    ghostP.setAttribute('d', ghost && Math.round(year) !== prev[0] ? dressPath(prev[3]) : '');
    yr.textContent = String(Math.round(year));
    const e = ERAS[i]; title.textContent = t('e' + e[0], e[1]); text.textContent = t('d' + e[0], e[2]);
    sv.setAttribute('aria-label', `${t('sil', 'Dress silhouette')} ${Math.round(year)}: ${e[1]}`);
    st.set(Math.round(year));
  }
  loop(ctx, sv, (dt) => { if (playing) { year += dt * (ctx.calm ? 3 : 6); if (year >= 1999) { year = 1999; playing = false; pb.textContent = t('play', 'Play the century'); } draw(); } });
  void clamp;
  draw();
}
