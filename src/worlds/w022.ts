/* 022 Sustainable Architecture: an envelope and energy studio. Choose a climate, insulation,
   windows and airtightness; U-values come from layer resistances, yearly heating and cooling
   from degree-days, and rooftop solar from typical yields, so you can chase a near-zero home.
   Editorial calm with a curved headline (adapted from video ref 2). */
import { type Ctx, h, s, layout, heading, note, range, select, seg, stats, store } from './kit';

/* rounded typical degree-days (base 18 °C) and PV yield (kWh per kWp per year); check local data */
const CLIM: Record<string, { n: string; hdd: number; cdd: number; pv: number }> = {
  oslo: { n: 'Oslo', hdd: 4400, cdd: 70, pv: 800 }, berlin: { n: 'Berlin', hdd: 3200, cdd: 250, pv: 950 }, london: { n: 'London', hdd: 2900, cdd: 150, pv: 900 },
  ny: { n: 'New York', hdd: 2700, cdd: 800, pv: 1250 }, tokyo: { n: 'Tokyo', hdd: 1700, cdd: 900, pv: 1150 }, madrid: { n: 'Madrid', hdd: 1900, cdd: 800, pv: 1600 },
  dhaka: { n: 'Dhaka', hdd: 50, cdd: 3300, pv: 1350 }, dubai: { n: 'Dubai', hdd: 50, cdd: 4300, pv: 1700 }, sing: { n: 'Singapore', hdd: 0, cdd: 3700, pv: 1250 },
};
const INS: Record<string, [string, number]> = { wool: ['Mineral wool', .035], eps: ['EPS foam', .033], pir: ['PIR board', .022], hemp: ['Hemp fibre', .04], cork: ['Cork', .04], straw: ['Straw bale', .055] };
const WIN: Record<string, [string, number]> = { single: ['Single glazing', 5.7], double: ['Double glazing', 2.8], low: ['Double low-e', 1.4], triple: ['Triple glazing', .8] };
export const uValue = (tCm: number, lambda: number, rBase = .4) => 1 / (.13 + rBase + (tCm / 100) / lambda + .04);

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && typeof v === 'object' && 'clim' in (v as object);
  const st = store(22, 'house', { clim: 'london', ins: 'wool', wallT: 15, roofT: 25, floorT: 10, win: 'double', wwr: 25, ach: 5, mvhr: 0, w: 10, d: 8, fl: 2 }, ok);
  const P = { ...st.get() };
  const L = layout(ctx);
  const ink = '#26302a', paper = '#eef0e8', accent = '#4c7a5a';
  L.wrap.style.setProperty('--signal', accent);
  L.view.classList.add('flow'); L.view.style.background = paper; L.view.style.color = ink;
  const arc = s('svg', { viewBox: '0 0 1000 150', width: '100%', role: 'heading', 'aria-level': 2, 'aria-label': t('h', 'Every watt has a way out'), style: 'display:block' });
  const ap = s('path', { id: 'w22arc', d: 'M30 130 Q500 10 970 130', fill: 'none' });
  const tx = s('text', { 'font-size': 64, fill: ink, 'font-family': 'var(--serif, Georgia, serif)' }); const tp = s('textPath', { href: '#w22arc', startOffset: '50%', 'text-anchor': 'middle' }); tp.textContent = t('h', 'Every watt has a way out'); tx.append(tp); arc.append(s('defs', {}, ap), tx);
  const house = s('svg', { viewBox: '0 0 640 360', width: '100%', role: 'img', 'aria-label': t('house', 'House section with heat loss through each part'), style: 'display:block;max-height:380px' });
  const wall = s('svg', { viewBox: '0 0 300 220', width: '100%', role: 'img', 'aria-label': t('wall', 'Wall build-up'), style: 'display:block;max-width:300px' });
  const bars = h('div', { style: { display: 'grid', gap: '6px', fontFamily: 'system-ui,sans-serif', fontSize: '13px' } });
  const verdict = h('p', { 'aria-live': 'polite', style: { fontFamily: 'var(--serif, Georgia, serif)', fontSize: 'clamp(18px,2.2vw,26px)', lineHeight: '1.35', margin: '10px 0 18px', maxWidth: '40ch' } });
  L.view.append(arc, verdict, house, h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '20px', marginTop: '16px', alignItems: 'start' } }, h('div', {}, h('h2', { style: { margin: '0 0 8px', fontFamily: 'ui-monospace,monospace', fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase' }, text: t('where', 'Where the heat goes') }), bars), h('div', {}, h('h2', { style: { margin: '0 0 8px', fontFamily: 'ui-monospace,monospace', fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase' }, text: t('wallH', 'Your wall') }), wall)));
  const info = stats(L.panel, [['heat', t('heat', 'Heating a year')], ['cool', t('cool', 'Cooling load a year')], ['int', t('int', 'Heating per m²')], ['pv', t('pv', 'Rooftop solar')]]);

  function calc() {
    const C = CLIM[P.clim], lam = INS[P.ins][1];
    const perim = 2 * (P.w + P.d), hgt = P.fl * 2.8, wallGross = perim * hgt, win = wallGross * P.wwr / 100, wallNet = wallGross - win, roof = P.w * P.d, floor = roof, area = roof * P.fl, vol = area * 2.5;
    const Uw = uValue(P.wallT, lam), Ur = uValue(P.roofT, lam, .2), Uf = uValue(P.floorT, lam, .3), Ug = WIN[P.win][1];
    const Hparts: [string, number, string][] = [['walls', Uw * wallNet, '#a35f3c'], ['windows', Ug * win, '#4f7fb0'], ['roof', Ur * roof, '#8a6d3b'], ['floor', Uf * floor * .7, '#6b6b6b'], ['air', .33 * P.ach * .07 * vol * (1 - P.mvhr / 100), '#4c7a5a']];
    /* ACH at 50 Pa divided by about 14 gives natural infiltration; .07 ≈ 1/14 */
    const Htot = Hparts.reduce((a, p) => a + p[1], 0);
    const heat = Htot * C.hdd * 24 / 1000, cool = Htot * C.cdd * 24 / 1000, perM2 = heat / area;
    const pvKwp = roof * .6 * .2, pv = pvKwp * C.pv;
    info('heat', `${Math.round(heat).toLocaleString(ctx.lang)} kWh`); info('cool', `${Math.round(cool).toLocaleString(ctx.lang)} kWh`); info('int', `${perM2.toFixed(0)} kWh/m²`); info('pv', `${Math.round(pv).toLocaleString(ctx.lang)} kWh`);
    const demand = heat / 3 + cool / 3; /* heat pump / air conditioner with a seasonal efficiency of about 3 */
    verdict.textContent = C.hdd > 500
      ? (perM2 <= 15 ? t('v.ph', 'Passive-house level: under 15 kWh of heat per m² a year.') : perM2 <= 50 ? t('v.good', 'A good low-energy home. Tighten the air and add insulation to reach passive-house level.') : t('v.leaky', 'This house is leaking heat. Start with the biggest bar below.'))
      : t('v.hot', 'In this climate the job is keeping heat out: shade the windows, insulate the roof and keep the envelope tight.');
    verdict.textContent += ' ' + (pv >= demand ? t('v.pv', 'The roof’s solar panels could cover the heating and cooling electricity.') : `${t('v.pv2', 'Solar on the roof covers about')} ${Math.round(pv / Math.max(1, demand) * 100)}% ${t('v.pv3', 'of the heating and cooling electricity.')}`);
    bars.replaceChildren(...Hparts.sort((a, b) => b[1] - a[1]).map(([k, v, c]) => h('div', {}, h('div', { style: { display: 'flex', justifyContent: 'space-between' } }, h('span', { text: t('p.' + k, k[0].toUpperCase() + k.slice(1)) }), h('span', { style: { fontFamily: 'ui-monospace,monospace' }, text: `${Math.round(v)} W/K · ${Math.round(v / Htot * 100)}%` })), h('div', { style: { height: '8px', background: '#d9ddd0', borderRadius: '4px' } }, h('div', { style: { width: `${v / Htot * 100}%`, height: '100%', background: c, borderRadius: '4px' } })))));
    drawHouse(Hparts, Htot); drawWall(Uw);
    st.set(P);
  }
  function drawHouse(parts: [string, number, string][], tot: number) {
    house.replaceChildren();
    const by = 300, lx = 170, rx = 470, top = by - P.fl * 70, roofY = top - 70;
    house.append(s('line', { x1: 20, x2: 620, y1: by, y2: by, stroke: ink }), s('rect', { x: lx, y: top, width: rx - lx, height: by - top, fill: '#f8f8f2', stroke: ink, 'stroke-width': 2 }), s('path', { d: `M${lx - 20} ${top} L320 ${roofY} L${rx + 20} ${top} Z`, fill: '#e3e5da', stroke: ink, 'stroke-width': 2 }));
    for (let f = 0; f < P.fl; f++) { const y = by - (f + 1) * 70; const wwH = 50 * Math.sqrt(P.wwr / 40); house.append(s('rect', { x: lx + 40, y: y + 35 - wwH / 2, width: 60, height: wwH, fill: '#bcd3e6', stroke: ink }), s('rect', { x: rx - 100, y: y + 35 - wwH / 2, width: 60, height: wwH, fill: '#bcd3e6', stroke: ink })); }
    const get = (k: string) => parts.find((p) => p[0] === k)!;
    const arrow = (x1: number, y1: number, x2: number, y2: number, k: string) => { const [, v, c] = get(k), w = 2 + v / tot * 40; house.append(s('path', { d: `M${x1} ${y1} L${x2} ${y2}`, stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', opacity: .8, 'marker-end': 'url(#w22h)' })); };
    house.append(s('defs', {}, s('marker', { id: 'w22h', viewBox: '0 0 10 10', refX: 5, refY: 5, markerWidth: 2.5, markerHeight: 2.5, orient: 'auto' }, s('path', { d: 'M0 0 L10 5 L0 10 z', fill: ink }))));
    arrow(lx, (top + by) / 2 + 20, lx - 90, (top + by) / 2 + 20, 'walls'); arrow(rx, (top + by) / 2 - 10, rx + 90, (top + by) / 2 - 10, 'windows'); arrow(320, roofY + 10, 320, roofY - 50, 'roof'); arrow(250, by, 250, by + 45, 'floor'); arrow(390, top + 20, 470, top - 50, 'air');
    for (const [k, x, y] of [['walls', lx - 140, (top + by) / 2 + 10], ['windows', rx + 30, (top + by) / 2 - 42], ['roof', 330, roofY - 40], ['air', 470, top - 58]] as [string, number, number][]) { const tt = s('text', { x, y, 'font-size': 13, fill: ink, 'font-family': 'system-ui,sans-serif' }); tt.textContent = t('p.' + k, k[0].toUpperCase() + k.slice(1)); house.append(tt); }
  }
  function drawWall(U: number) {
    wall.replaceChildren();
    const layers: [string, number, string][] = [[t('l.plaster', 'Plaster'), 1.5, '#e8e2d6'], [t('l.block', 'Masonry'), 20, '#b4775a'], [t('l.ins', INS[P.ins][0]), P.wallT, '#e9d27a'], [t('l.render', 'Render'), 2, '#d0ccc2']];
    const tot = layers.reduce((a, l) => a + l[1], 0); let x = 20;
    for (const [n, cm, c] of layers) { const w = cm / tot * 240; wall.append(s('rect', { x, y: 20, width: w, height: 150, fill: c, stroke: ink, 'stroke-width': .6 })); if (w > 14) { const tt = s('text', { x: x + w / 2, y: 95, 'font-size': 10, fill: ink, 'text-anchor': 'middle', transform: `rotate(-90 ${x + w / 2} 95)` }); tt.textContent = `${n} ${cm} cm`; wall.append(tt); } x += w; }
    const tt = s('text', { x: 20, y: 200, 'font-size': 13, fill: ink, 'font-family': 'ui-monospace,monospace' }); tt.textContent = `U = ${U.toFixed(2)} W/m²K · ${tot.toFixed(0)} cm`; wall.append(tt);
  }

  heading(L.panel, t('site', 'Site and size'));
  select(L.panel, t('clim', 'Climate'), Object.entries(CLIM).map(([k, c]) => [k, t('c.' + k, c.n)]), P.clim, (v) => { P.clim = v; calc(); });
  range(L.panel, t('w', 'Width'), { min: 5, max: 20, value: P.w, fmt: (n) => n + ' m' }, (v) => { P.w = v; calc(); });
  range(L.panel, t('d', 'Depth'), { min: 5, max: 20, value: P.d, fmt: (n) => n + ' m' }, (v) => { P.d = v; calc(); });
  range(L.panel, t('fl', 'Storeys'), { min: 1, max: 3, value: P.fl }, (v) => { P.fl = v; calc(); });
  heading(L.panel, t('env', 'Envelope'));
  select(L.panel, t('ins', 'Insulation'), Object.entries(INS).map(([k, v]) => [k, `${t('i.' + k, v[0])} (λ ${v[1]})`]), P.ins, (v) => { P.ins = v; calc(); });
  range(L.panel, t('wallT', 'Wall insulation'), { min: 0, max: 40, value: P.wallT, fmt: (n) => n + ' cm' }, (v) => { P.wallT = v; calc(); });
  range(L.panel, t('roofT', 'Roof insulation'), { min: 0, max: 50, value: P.roofT, fmt: (n) => n + ' cm' }, (v) => { P.roofT = v; calc(); });
  range(L.panel, t('floorT', 'Floor insulation'), { min: 0, max: 30, value: P.floorT, fmt: (n) => n + ' cm' }, (v) => { P.floorT = v; calc(); });
  select(L.panel, t('win', 'Windows'), Object.entries(WIN).map(([k, v]) => [k, `${t('w.' + k, v[0])} (U ${v[1]})`]), P.win, (v) => { P.win = v; calc(); });
  range(L.panel, t('wwr', 'Window share of wall'), { min: 5, max: 60, value: P.wwr, fmt: (n) => n + '%' }, (v) => { P.wwr = v; calc(); });
  heading(L.panel, t('air', 'Air'));
  range(L.panel, t('ach', 'Airtightness (air changes at 50 Pa)'), { min: .6, max: 12, step: .1, value: P.ach, fmt: (n) => String(n) }, (v) => { P.ach = v; calc(); });
  seg(L.panel, t('mvhr', 'Heat recovery ventilation'), [['0', t('none', 'None')], ['75', '75%'], ['90', '90%']], String(P.mvhr), (v) => { P.mvhr = +v; calc(); });
  note(L.panel, t('how', 'U-value = 1 ÷ the sum of each layer’s resistance (thickness ÷ conductivity). Heat loss = U × area for each part, plus air leakage. Yearly heating = loss × heating degree-days × 24 h. Passive-house homes need under 15 kWh/m² a year.'));
  note(L.panel, t('honest', 'Degree-days and solar yields are rounded typical values for each city, and solar gains through windows are left out, so treat results as a comparison, not a design certificate.'));
  calc();
}
