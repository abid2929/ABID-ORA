/* 036 Space Explorer: The Long Way Out. A journey from the Sun to the nearest star at a speed
   you choose, from walking pace to the speed of light, with real distances. Time can be sped up
   by up to a billion times. A logarithmic map shows the whole route; a true-scale window around
   your craft shows how empty space really is. A scale-model calculator turns the Solar System
   into something you could lay out in your own town. */
import { type Ctx, h, layout, canvas, heading, note, range, select, seg, stats, loop, clamp } from '../kit';

export const AU = 149597870.7; /* km */
export const BODIES: [string, string, number, number, string][] = [
  /* id, English name, distance (AU, mean), radius (km), colour */
  ['sun', 'Sun', 0, 695700, '#ffcf5a'], ['mercury', 'Mercury', .387, 2440, '#b8a99a'], ['venus', 'Venus', .723, 6052, '#e8c58e'], ['earth', 'Earth', 1, 6371, '#5aa7ff'],
  ['mars', 'Mars', 1.524, 3390, '#e0754b'], ['jupiter', 'Jupiter', 5.203, 69911, '#d9b38c'], ['saturn', 'Saturn', 9.537, 58232, '#e8d29a'], ['uranus', 'Uranus', 19.19, 25362, '#9fe3e8'],
  ['neptune', 'Neptune', 30.07, 24622, '#5b7cff'], ['pluto', 'Pluto', 39.48, 1188, '#d8c7b4'], ['helio', 'Heliopause (edge of the solar wind)', 120, 0, '#8ab4ff'],
  ['voyager', 'Voyager 1 (about, in 2026)', 170, 0, '#ffffff'], ['oort', 'Inner Oort Cloud (estimated)', 2000, 0, '#b7a6ff'], ['proxima', 'Proxima Centauri (4.24 light years)', 268000, 107000, '#ff8a5a'],
];
export const SPEEDS: [string, string, number][] = [
  ['walk', 'Walking (5 km/h)', 5 / 3600], ['car', 'Car on a motorway (100 km/h)', 100 / 3600], ['jet', 'Airliner (900 km/h)', 900 / 3600], ['iss', 'Space station orbit (7.66 km/s)', 7.66],
  ['voyager', 'Voyager 1 (17 km/s)', 17], ['parker', 'Parker Solar Probe, fastest (192 km/s)', 191.7], ['light', 'Light (299 792 km/s)', 299792.458],
];
/** human-readable duration from seconds */
export function dur(s: number, lang = 'en') {
  const nf = (n: number, d = 0) => n.toLocaleString(lang, { maximumFractionDigits: d });
  if (s < 60) return `${nf(s, 1)} s`; if (s < 3600) return `${nf(s / 60, 1)} min`; if (s < 86400) return `${nf(s / 3600, 1)} h`;
  if (s < 86400 * 365.25) return `${nf(s / 86400, 1)} d`; return `${nf(s / (86400 * 365.25), s < 86400 * 365.25 * 100 ? 1 : 0)} y`;
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ffcf5a');
  L.view.style.background = 'radial-gradient(ellipse at 0% 50%, #1b1420 0%, #05060c 55%)';
  const S = canvas(L.view, t('cv', 'Map of the route from the Sun to Proxima Centauri on a logarithmic scale, with a true-scale window around the craft'));
  const info = stats(L.panel, [['d', t('d', 'Distance from the Sun')], ['tt', t('tt', 'Travel time so far')], ['next', t('next', 'Next stop')], ['eta', t('eta', 'Arrives in (travel time)')], ['light', t('lt', 'Light from here to Earth takes')]]);
  const P = { speed: 'light', warp: 1000, run: false, view: 'log' };
  let dist = 0, ttime = 0; /* km, s */
  const v = () => SPEEDS.find((q) => q[0] === P.speed)![2];
  const LMIN = Math.log10(.2), LMAX = Math.log10(400000);
  const stars = Array.from({ length: 260 }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 43758.5453) % 1, y: (Math.sin(i * 78.233) * 12345.678) % 1, m: (i * 7919 % 100) / 100 }));
  function upd() {
    const au = dist / AU, nx = BODIES.find((b) => b[2] > au + 1e-9);
    info('d', au < .01 ? `${Math.round(dist).toLocaleString(ctx.lang)} km` : au < 2000 ? `${au.toFixed(au < 10 ? 3 : 1)} AU` : `${(au / 63241).toFixed(3)} ${t('ly', 'light years')}`);
    info('tt', dur(ttime, ctx.lang));
    info('next', nx ? t('b.' + nx[0], nx[1]) : t('arrived', 'You have arrived'));
    info('eta', nx ? dur((nx[2] * AU - dist) / v(), ctx.lang) : '—');
    info('light', dur(Math.abs(dist - AU) / 299792.458, ctx.lang));
  }
  function draw(dt: number) {
    if (P.run) {
      dist += v() * dt * P.warp * (ctx.calm ? .5 : 1); ttime += dt * P.warp * (ctx.calm ? .5 : 1);
      const end = BODIES[BODIES.length - 1][2] * AU; if (dist >= end) { dist = end; P.run = false; go.textContent = t('go', 'Launch'); }
      upd();
    }
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    for (const s of stars) { g.fillStyle = `rgba(255,255,255,${.15 + Math.abs(s.m) * .5})`; g.fillRect(Math.abs(s.x) * W, Math.abs(s.y) * H, 1.2, 1.2); }
    const au = dist / AU;
    if (P.view === 'log') drawLog(g, W, H, au); else drawTrue(g, W, H, au);
  }
  function drawLog(g: CanvasRenderingContext2D, W: number, H: number, au: number) {
    const x = (a: number) => 40 + (Math.log10(Math.max(a, .2)) - LMIN) / (LMAX - LMIN) * (W - 170), y = H * .52;
    g.strokeStyle = 'rgba(255,207,90,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(40, y); g.lineTo(W - 40, y); g.stroke();
    g.font = '10px ui-monospace,monospace'; g.fillStyle = 'rgba(255,255,255,.35)'; g.textAlign = 'center';
    for (let e = 0; e <= 5; e++) { const xx = x(10 ** e); g.fillRect(xx, y + 60, 1, 6); g.fillText(`${(10 ** e).toLocaleString(ctx.lang)} AU`, xx, y + 80); }
    BODIES.forEach((b, i) => {
      const xx = b[2] === 0 ? 30 : x(b[2]), r = b[3] ? clamp(Math.log10(b[3]) * 3.2 - 7, 2.5, 20) : 0;
      if (r) { const gr = g.createRadialGradient(xx - r * .3, y - r * .3, r * .1, xx, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, b[4]); gr.addColorStop(1, b[4] + '55'); g.fillStyle = gr; g.beginPath(); g.arc(xx, y, r, 0, 7); g.fill(); if (b[0] === 'saturn') { g.strokeStyle = b[4]; g.beginPath(); g.ellipse(xx, y, r * 1.9, r * .5, -.3, 0, 7); g.stroke(); } }
      else { g.strokeStyle = b[4]; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(xx, y - 40); g.lineTo(xx, y + 40); g.stroke(); g.setLineDash([]); }
      g.fillStyle = 'rgba(255,255,255,.75)'; g.save(); g.translate(xx, y + (i % 2 ? 34 : -30)); g.rotate(-.5); g.textAlign = 'left'; g.fillText(t('b.' + b[0], b[1]).split(' (')[0], 0, 0); g.restore();
    });
    /* the craft */
    const cx = au <= 0 ? 30 : x(au);
    g.fillStyle = '#ffcf5a'; g.beginPath(); g.moveTo(cx + 9, y - 14); g.lineTo(cx - 6, y - 19); g.lineTo(cx - 6, y - 9); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,207,90,.8)'; g.beginPath(); g.moveTo(cx, y - 8); g.lineTo(cx, y); g.stroke();
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,.4)'; g.fillText(t('logn', 'Logarithmic map: each step right is ten times farther. Planet sizes are exaggerated.'), 40, H - 16);
  }
  function drawTrue(g: CanvasRenderingContext2D, W: number, H: number, au: number) {
    /* a window of fixed width in km centred on the craft, everything drawn at true size */
    const span = Math.max(4e6, dist * .02 + 4e6), kmpx = span / W, y = H * .5;
    const near = BODIES.filter((b) => Math.abs(b[2] * AU - dist) < span * .6);
    for (const b of BODIES) {
      const dx = (b[2] * AU - dist) / kmpx; if (Math.abs(dx) > W) continue;
      const xx = W / 2 + dx, r = b[3] / kmpx;
      g.fillStyle = b[4]; g.beginPath(); g.arc(xx, y, Math.max(r, .6), 0, 7); g.fill();
      if (r < 3) { g.strokeStyle = b[4]; g.beginPath(); g.arc(xx, y, 9, 0, 7); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '11px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText(t('b.' + b[0], b[1]).split(' (')[0], xx, y - Math.max(r, 9) - 8);
    }
    g.strokeStyle = '#ffcf5a'; g.beginPath(); g.moveTo(W / 2, y + 30); g.lineTo(W / 2, y + 12); g.stroke(); g.fillStyle = '#ffcf5a'; g.textAlign = 'center'; g.font = '11px ui-monospace,monospace'; g.fillText(t('you', 'you'), W / 2, y + 44);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.textAlign = 'left';
    g.fillText(`${t('truew', 'True scale: this window is')} ${Math.round(span).toLocaleString(ctx.lang)} km ${t('wide', 'wide')} · 1 px = ${Math.round(kmpx).toLocaleString(ctx.lang)} km`, 16, H - 16);
    if (!near.length) { g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '15px ui-serif,Georgia,serif'; g.textAlign = 'center'; g.fillText(t('empty', 'Nothing here. Space is almost entirely empty.'), W / 2, y - 60); }
    g.textAlign = 'left';
  }
  loop(ctx, S.cv, draw);

  heading(L.panel, t('trip', 'Your trip'));
  select(L.panel, t('speed', 'Travel at'), SPEEDS.map(([id, en]) => [id, t('s.' + id, en)] as [string, string]), P.speed, (x) => { P.speed = x; upd(); });
  const warps = [1, 60, 3600, 86400, 2592000, 31557600, 1e9];
  range(L.panel, t('warp', 'Time speed-up'), { min: 0, max: warps.length - 1, value: 2, fmt: (n) => ['×1 (real time)', t('w1', '1 min per second'), t('w2', '1 hour per second'), t('w3', '1 day per second'), t('w4', '1 month per second'), t('w5', '1 year per second'), t('w6', '32 years per second')][n] }, (n) => { P.warp = warps[n]; });
  P.warp = warps[2];
  seg(L.panel, t('view', 'View'), [['log', t('v.log', 'Whole route')], ['true', t('v.true', 'True scale')]], P.view, (x) => { P.view = x; });
  const go = h('button', { type: 'button', class: 'wk-b pri', text: t('go', 'Launch'), onclick: () => { P.run = !P.run; go.textContent = P.run ? t('pause', 'Pause') : t('go', 'Launch'); } });
  const jump = select(L.panel, t('jump', 'Jump to'), [['', '—'], ...BODIES.map(([id, en]) => [id, t('b.' + id, en)] as [string, string])], '', (id) => { const b = BODIES.find((q) => q[0] === id); if (b) { dist = b[2] * AU; ttime = dist / v(); upd(); } jump.value = ''; });
  L.panel.append(h('div', { class: 'wk-row' }, go, h('button', { type: 'button', class: 'wk-b', text: t('reset', 'Back to the Sun'), onclick: () => { dist = 0; ttime = 0; P.run = false; go.textContent = t('go', 'Launch'); upd(); } })));
  /* scale model calculator */
  heading(L.panel, t('model', 'Build it in your town'));
  const tbl = h('table', { class: 'wk-tbl', style: { width: '100%', fontSize: '12px', borderCollapse: 'collapse' } });
  const fmtLen = (m: number) => m < .001 ? `${(m * 1e6).toFixed(0)} µm` : m < .01 ? `${(m * 1000).toFixed(1)} mm` : m < 1 ? `${(m * 100).toFixed(1)} cm` : m < 1000 ? `${m.toFixed(m < 10 ? 1 : 0)} m` : `${(m / 1000).toLocaleString(ctx.lang, { maximumFractionDigits: 1 })} km`;
  function model(sunCm: number) {
    const k = (sunCm / 100) / (2 * BODIES[0][3]); /* metres per km */
    tbl.innerHTML = '';
    tbl.append(h('tr', {}, h('th', { text: t('obj', 'Object'), style: { textAlign: 'start' } }), h('th', { text: t('size', 'Size'), style: { textAlign: 'end' } }), h('th', { text: t('far', 'Distance'), style: { textAlign: 'end' } })));
    for (const b of BODIES) if (b[3] || b[2]) tbl.append(h('tr', {}, h('td', { text: t('b.' + b[0], b[1]).split(' (')[0] }), h('td', { text: b[3] ? fmtLen(b[3] * 2 * k) : '—', style: { textAlign: 'end' } }), h('td', { text: fmtLen(b[2] * AU * k), style: { textAlign: 'end' } })));
  }
  range(L.panel, t('sun', 'Make the Sun a ball this wide'), { min: 1, max: 100, value: 20, fmt: (n) => n + ' cm' }, model);
  L.panel.append(tbl); model(20);
  note(L.panel, t('how', 'Even light needs over 8 minutes to reach Earth from the Sun and more than 4 years to reach the next star. Voyager 1, our fastest object leaving the Solar System, would need about 75 000 years to cover the same distance. Switch to "True scale" to see how small even the giant planets are against the gaps between them.'));
  note(L.panel, t('src', 'Distances are mean orbital distances (NASA planetary fact sheets); Voyager 1 is about 170 AU from the Sun in 2026 and moving outward about 3.6 AU a year. The Oort Cloud distance is an estimate.'));
  upd();
}
