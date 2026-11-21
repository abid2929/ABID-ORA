/* 040 Scientific Discoveries: Discovery Lab. Four experiments that changed science, rebuilt so you can run
   them yourself and get the answer from your own data, with the same mistakes and noise the originals had.
   1. Eratosthenes (about 240 BCE): two shadows at noon give the size of the Earth (or use your own stick).
   2. Galileo (1604): a ball rolling down a ramp, timed by beats, shows distance grows with time squared.
   3. Millikan (1909): hold charged oil drops still in an electric field; charges come in whole steps of e.
   4. Geiger, Marsden and Rutherford (1909 to 1911): alpha particles on gold foil; a few bounce straight
      back, which only a tiny, heavy nucleus can explain.
   Every number on screen is computed from the physics below; nothing is a canned answer. */
import { type Ctx, h, layout, canvas, heading, note, range, select, seg, stats, buttons, check, loop, rng, clamp, store } from './kit';

/* ---------- shared physics (exported for tests) ---------- */
const D2R = Math.PI / 180;
/** Earth's pole-to-pole circumference through the poles, km (meridian) */
export const MERIDIAN = 40008;
/** noon sun angle from straight up, degrees: positive means the shadow points north */
export const zenith = (lat: number, decl: number) => lat - decl;
/** Eratosthenes: circumference from the shadow-angle difference (deg) and north-south distance (km) */
export const circumference = (dDeg: number, km: number) => 360 / dDeg * km;
/** acceleration down a ramp in m/s²; a solid ball rolling keeps 5/7 of it, a frictionless block all of it */
export const rampAcc = (deg: number, rolling: boolean, g = 9.81) => g * Math.sin(deg * D2R) * (rolling ? 5 / 7 : 1);
/** least-squares slope through the origin for y = k x */
export const slope0 = (xs: number[], ys: number[]) => { let a = 0, b = 0; xs.forEach((x, i) => { a += x * ys[i]; b += x * x; }); return b ? a / b : 0; };
export const E_CHARGE = 1.602176634e-19;
const RHO = 900, ETA = 1.82e-5, GG = 9.81, PLATE = 5e-3; // oil kg/m³, air viscosity Pa·s, plate gap m
/** voltage that holds a drop of radius r (m) with charge q (C) still */
export const holdV = (r: number, q: number) => 4 / 3 * Math.PI * r ** 3 * RHO * GG * PLATE / q;
/** Stokes' law: radius from the free-fall speed (m/s) */
export const radiusFromFall = (v: number) => Math.sqrt(9 * ETA * v / (2 * RHO * GG));
/** best single charge unit for a set of charges (C): scans 1.0 to 2.2 × 10⁻¹⁹ C, then refines by least squares */
export function bestUnit(qs: number[]) {
  if (!qs.length) return 0;
  let best = 0, cost = Infinity;
  for (let e = 1.0e-19; e <= 2.2e-19; e += 2e-23) {
    let c = 0; for (const q of qs) { const x = q / e; c += (x - Math.round(x)) ** 2; }
    if (c < cost - 1e-9) { cost = c; best = e; }
  }
  let a = 0, b = 0; for (const q of qs) { const n = Math.max(1, Math.round(q / best)); a += q * n; b += n * n; }
  return a / b;
}
/** head-on closest approach of an alpha (charge 2) to a nucleus of charge Z, fm, energy in MeV */
export const closest = (Z: number, MeV: number) => 1.44 * 2 * Z / MeV;
/** Rutherford scattering angle (rad) for impact parameter b and closest approach d0 (same units) */
export const scatter = (b: number, d0: number) => 2 * Math.atan(d0 / (2 * b));
/** impact parameter (fm) that gives angle θ (rad) */
export const bFor = (th: number, d0: number) => d0 / (2 * Math.tan(th / 2));

type Mode = 'era' | 'gal' | 'mil' | 'ruth';

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#f2c46d');
  L.view.style.background = '#0b0a08';
  L.view.style.minHeight = 'clamp(440px, 62vw, 560px)'; // each scene stacks a picture over a chart, so phones need the height
  const S = canvas(L.view, t('cv', 'The experiment you are running, with your results drawn below it.'));
  const R = rng();
  const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const saved = store<Mode>(ctx.id, 'mode', 'era', (v) => ['era', 'gal', 'mil', 'ruth'].includes(v as string));
  let mode: Mode = saved.get();
  const say = (s: string) => { L.hud.textContent = s; };
  /* on a phone the controls sit under the stage: bring the stage back into view when an experiment starts */
  const seeStage = () => { const r = L.view.getBoundingClientRect(); if (r.bottom < 80 || r.top > innerHeight - 80) L.view.scrollIntoView({ behavior: ctx.calm ? 'auto' : 'smooth', block: 'start' }); };
  const fmt = (n: number, d = 1) => n.toLocaleString(ctx.lang, { maximumFractionDigits: d, minimumFractionDigits: d });

  heading(L.panel, t('pick', 'Choose a discovery'));
  const modeSeg = seg(L.panel, t('exp', 'Experiment'), [['era', t('m.era', 'Size of the Earth')], ['gal', t('m.gal', 'Falling bodies')], ['mil', t('m.mil', 'Charge of the electron')], ['ruth', t('m.ruth', 'The atomic nucleus')]], mode, (v) => setMode(v as Mode));
  const intro = h('p', { class: 'wk-note' }); L.panel.append(intro);
  const sec: Record<Mode, HTMLElement> = { era: h('div'), gal: h('div'), mil: h('div'), ruth: h('div') };
  for (const k of Object.keys(sec) as Mode[]) { sec[k].style.display = 'grid'; sec[k].style.gap = '12px'; L.panel.append(sec[k]); }
  const INTRO: Record<Mode, string> = {
    era: t('i.era', 'Eratosthenes, about 240 BCE. At noon the sun stood straight above Syene but cast a shadow in Alexandria. The difference in shadow angles is the slice of the full circle between the two cities.'),
    gal: t('i.gal', 'Galileo, 1604. Free fall was too fast to time, so he slowed it down with a gentle ramp and timed it with a water clock. The distances grow like 1, 3, 5, 7: distance goes with time squared.'),
    mil: t('i.mil', 'Millikan, 1909. Tiny charged oil drops float between two plates. Set the voltage so a drop hangs still, record it, and the charges you find come only in whole steps of one smallest charge.'),
    ruth: t('i.ruth', 'Geiger, Marsden and Rutherford, 1909 to 1911. Alpha particles fired at thin gold foil mostly pass straight through, but a very few bounce back. Compare the two models of the atom.'),
  };

  /* =====================================================================================
     1. Eratosthenes
     ===================================================================================== */
  const CITIES: [string, string, number][] = [
    ['alx', 'Alexandria', 31.2], ['syn', 'Syene (Aswan)', 24.09], ['cai', 'Cairo', 30.04], ['ath', 'Athens', 37.98], ['dha', 'Dhaka', 23.81], ['ctg', 'Chattogram', 22.34],
    ['rng', 'Rangpur', 25.75], ['del', 'Delhi', 28.61], ['ktm', 'Kathmandu', 27.72], ['lon', 'London', 51.51], ['osl', 'Oslo', 59.91], ['lag', 'Lagos', 6.52],
    ['uio', 'Quito', -.18], ['cpt', 'Cape Town', -33.92], ['syd', 'Sydney', -33.87], ['tyo', 'Tokyo', 35.68]];
  const E = { a: 'alx', b: 'syn', day: 'jun', err: 0, own: false, h: 100, sa: 12.6, sb: 0, km: 800 };
  const decl = () => (E.day === 'jun' ? 23.44 : E.day === 'dec' ? -23.44 : 0);
  const city = (k: string) => CITIES.find((c) => c[0] === k)!;
  const cityOpts = CITIES.map(([k, n, lat]) => [k, `${t('c.' + k, n)} (${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? t('N', 'N') : t('S', 'S')})`] as [string, string]);
  select(sec.era, t('ca', 'First city'), cityOpts, E.a, (v) => { E.a = v; updEra(); });
  select(sec.era, t('cb', 'Second city'), cityOpts, E.b, (v) => { E.b = v; updEra(); });
  seg(sec.era, t('day', 'Day'), [['jun', t('d.jun', 'June solstice')], ['equ', t('d.equ', 'Equinox')], ['dec', t('d.dec', 'December solstice')]], E.day, (v) => { E.day = v; updEra(); });
  range(sec.era, t('pace', 'Error in pacing the distance'), { min: -15, max: 15, step: 1, value: 0, fmt: (n) => (n > 0 ? '+' : '') + n + ' %' }, (v) => { E.err = v; updEra(); });
  const ownBox = h('div', { style: { display: 'none', gap: '10px' } });
  check(sec.era, t('own', 'Use my own measurements'), false, (v) => { E.own = v; ownBox.style.display = v ? 'grid' : 'none'; updEra(); });
  const num = (label: string, key: 'h' | 'sa' | 'sb' | 'km', step: number) => {
    const i = h('input', { type: 'number', step, min: 0, value: String(E[key]) }) as HTMLInputElement;
    i.addEventListener('input', () => { const v = +i.value; if (Number.isFinite(v) && v >= 0) { E[key] = v; updEra(); } });
    ownBox.append(h('label', { class: 'wk-r' }, h('span', { text: label }), i));
  };
  num(t('o.h', 'Stick height (cm)'), 'h', 1); num(t('o.sa', 'Noon shadow, place 1 (cm)'), 'sa', .1); num(t('o.sb', 'Noon shadow, place 2 (cm)'), 'sb', .1); num(t('o.km', 'North-south distance between them (km)'), 'km', 1);
  ownBox.append(h('p', { class: 'wk-note', text: t('o.n', 'Measure both shadows at local noon on the same day (or ask a friend far north or south of you). Enter 0 where there is no shadow.') }));
  sec.era.append(ownBox);
  const eraSt = stats(sec.era, [['za', t('za', 'Sun angle, place 1')], ['zb', t('zb', 'Sun angle, place 2')], ['dz', t('dz', 'Difference')], ['km', t('kmd', 'North-south distance')], ['c', t('circ', 'Your Earth circumference')], ['err', t('vs', 'Versus the real one')]]);
  note(sec.era, t('n.era', 'Only the north-south part of the distance counts, because the sun angle changes with latitude. Eratosthenes found 7.2° and 5,000 stadia, so 250,000 stadia: within a few percent to about 15 % of the truth, depending on which stadion he used.'));
  let eraRes = { za: 0, zb: 0, dz: 0, km: 0, c: 0, ok: false, nightA: false, nightB: false };
  function updEra() {
    if (E.own) {
      const za = Math.atan2(E.sa, E.h || 1) / D2R, zb = Math.atan2(E.sb, E.h || 1) / D2R, dz = Math.abs(za - zb);
      eraRes = { za, zb, dz, km: E.km, c: dz > .05 ? circumference(dz, E.km) : 0, ok: dz > .05 && E.km > 0, nightA: false, nightB: false };
    } else {
      const A = city(E.a), B = city(E.b), za = zenith(A[2], decl()), zb = zenith(B[2], decl());
      const trueKm = Math.abs(A[2] - B[2]) * MERIDIAN / 360, km = trueKm * (1 + E.err / 100), dz = Math.abs(za - zb);
      eraRes = { za, zb, dz, km, c: dz > .05 ? circumference(dz, km) : 0, ok: dz > .05, nightA: Math.abs(za) >= 90, nightB: Math.abs(zb) >= 90 };
    }
    const r = eraRes, dir = (z: number) => (Math.abs(z) < .05 ? t('noshadow', 'no shadow') : z > 0 ? t('north', 'shadow north') : t('south', 'shadow south'));
    eraSt('za', r.nightA ? t('night', 'sun below horizon') : `${fmt(Math.abs(r.za))}° · ${dir(r.za)}`);
    eraSt('zb', r.nightB ? t('night', 'sun below horizon') : `${fmt(Math.abs(r.zb))}° · ${dir(r.zb)}`);
    eraSt('dz', `${fmt(r.dz, 2)}°`); eraSt('km', `${Math.round(r.km).toLocaleString(ctx.lang)} km`);
    eraSt('c', r.ok ? `${Math.round(r.c).toLocaleString(ctx.lang)} km` : '—');
    eraSt('err', r.ok ? `${r.c >= MERIDIAN ? '+' : ''}${fmt((r.c / MERIDIAN - 1) * 100)} %` : '—');
    if (!r.ok) say(t('far', 'Pick two places further apart from north to south.'));
    else if (r.nightA || r.nightB) say(t('polar', 'One place has no noon sun on this day, so it cannot be measured.'));
    else say(`360° ÷ ${fmt(r.dz, 2)}° × ${Math.round(r.km).toLocaleString(ctx.lang)} km = ${Math.round(r.c).toLocaleString(ctx.lang)} km`);
  }
  function drawEra() {
    const g = S.g, W = S.w, H = S.h, r = eraRes, wide = W > 640;
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, W, H);
    const cx = wide ? W * .3 : W * .42, cy = wide ? H * .5 : H * .3, Re = Math.min(wide ? W * .19 : W * .3, (wide ? H : H * .55) * .36);
    /* sunlight comes from the right as parallel rays */
    g.strokeStyle = 'rgba(242,196,109,.22)'; g.lineWidth = 1;
    for (let y = cy - Re * 1.3; y <= cy + Re * 1.3; y += 14) { g.beginPath(); g.moveTo(W, y); g.lineTo(cx + Math.sqrt(Math.max(0, Re * Re - (y - cy) ** 2)), y); g.stroke(); }
    const sky = g.createRadialGradient(cx + Re * .4, cy - Re * .2, Re * .1, cx, cy, Re);
    sky.addColorStop(0, '#2d6b8f'); sky.addColorStop(1, '#0d2333'); g.fillStyle = sky; g.beginPath(); g.arc(cx, cy, Re, 0, 7); g.fill();
    g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(cx, cy, Re, Math.PI / 2, Math.PI * 1.5); g.fill();
    const ang = (z: number) => -z * D2R; // angle on screen from the sub-solar point
    /* equator mark */
    const eq = ang(-decl()); g.strokeStyle = 'rgba(255,255,255,.25)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(cx - Re * Math.cos(eq), cy - Re * Math.sin(eq)); g.lineTo(cx + Re * Math.cos(eq), cy + Re * Math.sin(eq)); g.stroke(); g.setLineDash([]);
    const pts = [r.za, r.zb].map((z) => { const a = ang(z); return { x: cx + Re * Math.cos(a), y: cy + Re * Math.sin(a), a }; });
    g.strokeStyle = 'rgba(242,196,109,.9)'; g.lineWidth = 1.5;
    for (const p of pts) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(p.x, p.y); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x + Math.cos(p.a) * 14, p.y + Math.sin(p.a) * 14); g.stroke(); g.lineWidth = 1.5; }
    const a0 = Math.min(pts[0].a, pts[1].a), a1 = Math.max(pts[0].a, pts[1].a);
    g.strokeStyle = '#fff'; g.beginPath(); g.arc(cx, cy, Re * .28, a0, a1); g.stroke();
    g.fillStyle = '#fff'; g.font = '12px ui-monospace,monospace'; g.textAlign = 'center';
    const am = (a0 + a1) / 2; g.fillText(fmt(r.dz, 1) + '°', cx + Math.cos(am) * Re * .45, cy + Math.sin(am) * Re * .45 + 4);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '11px ui-monospace,monospace';
    ['1', '2'].forEach((n, i) => g.fillText(n, pts[i].x + Math.cos(pts[i].a) * 26, pts[i].y + Math.sin(pts[i].a) * 26 + 4));
    g.fillText(t('sun', 'sunlight →'), W - 60, cy - Re * 1.3 - 8);
    /* close-ups of the two sticks */
    const bx = wide ? W * .62 : 16, by = wide ? H * .2 : H * .58, bw = wide ? W * .34 : W - 32, bh = wide ? H * .6 : H * .26;
    [r.za, r.zb].forEach((z, i) => {
      const x0 = bx + (bw / 2) * i + bw / 4, gy = by + bh * .8, sh = Math.min(bh * .55, 90), night = Math.abs(z) >= 90;
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.beginPath(); g.moveTo(x0 - bw / 4 + 8, gy); g.lineTo(x0 + bw / 4 - 8, gy); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(t('N', 'N'), x0 - bw / 4 + 8, gy - 4); g.textAlign = 'right'; g.fillText(t('S', 'S'), x0 + bw / 4 - 8, gy - 4);
      g.strokeStyle = '#e8dcc0'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, gy); g.lineTo(x0, gy - sh); g.stroke(); g.lineWidth = 1;
      if (!night) {
        const len = clamp(Math.tan(Math.abs(z) * D2R) * sh, 0, bw / 4 - 10) * Math.sign(z);
        g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0, gy); g.lineTo(x0 - len, gy); g.stroke(); g.lineWidth = 1;
        g.strokeStyle = 'rgba(242,196,109,.8)'; g.beginPath(); g.moveTo(x0 - len, gy); g.lineTo(x0 + Math.sin(z * D2R) * sh * 1.6 - len, gy - Math.cos(z * D2R) * sh * 1.6); g.stroke();
      }
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '12px ui-monospace,monospace';
      g.fillText(night ? t('night', 'sun below horizon') : fmt(Math.abs(z)) + '°', x0, gy + 18);
      g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '11px ui-monospace,monospace';
      g.fillText(E.own ? t('place', 'place') + ' ' + (i + 1) : (i + 1) + ' · ' + t('c.' + city(i ? E.b : E.a)[0], city(i ? E.b : E.a)[1]), x0, gy + 34);
    });
  }

  /* =====================================================================================
     2. Galileo's ramp
     ===================================================================================== */
  const RAMP = 5; // metres
  const G = { deg: 3, roll: true, beat: .5, jitter: 20, run: false, time: 0, marks: [] as { t: number; d: number }[], nextBeat: 0 };
  range(sec.gal, t('slope', 'Ramp slope'), { min: 1, max: 20, step: .5, value: G.deg, fmt: (n) => n + '°' }, (v) => { G.deg = v; resetGal(); });
  seg(sec.gal, t('obj', 'Object'), [['roll', t('o.roll', 'Rolling ball')], ['slide', t('o.slide', 'Frictionless block')]], 'roll', (v) => { G.roll = v === 'roll'; resetGal(); });
  range(sec.gal, t('beat', 'Water-clock beat'), { min: .2, max: 1, step: .05, value: G.beat, fmt: (n) => n.toFixed(2) + ' s' }, (v) => { G.beat = v; resetGal(); });
  range(sec.gal, t('jit', 'Your timing error'), { min: 0, max: 80, step: 5, value: G.jitter, fmt: (n) => '± ' + n + ' ms' }, (v) => { G.jitter = v; });
  buttons(sec.gal, [[t('release', 'Release the ball'), () => { resetGal(); G.run = true; seeStage(); say(t('rolling', 'Rolling… a mark is made at every beat.')); }, true], [t('reset', 'Reset'), () => { resetGal(); say(''); }]]);
  const galSt = stats(sec.gal, [['n', t('marks', 'Marks')], ['odd', t('odd', 'Gaps, first = 1')], ['a', t('acc', 'Measured acceleration')], ['g', t('gest', 'Your value of g')]]);
  note(sec.gal, t('n.gal', 'Each gap between marks is longer by the same step: 1, 3, 5, 7. A graph of distance against time squared is a straight line, and its slope gives the acceleration. A rolling ball spends some energy on spinning, so it speeds up only 5/7 as fast as a sliding block; leave that out and your g comes out too small.'));
  function resetGal() { G.run = false; G.time = 0; G.marks = []; G.nextBeat = G.beat; updGal(); }
  function galFit() {
    const xs = G.marks.map((m) => m.t * m.t), ys = G.marks.map((m) => m.d), k = slope0(xs, ys), a = 2 * k;
    return { a, g: a / (Math.sin(G.deg * D2R) * (G.roll ? 5 / 7 : 1)), k };
  }
  function updGal() {
    galSt('n', String(G.marks.length));
    if (G.marks.length >= 2) {
      const gaps = G.marks.map((m, i) => m.d - (i ? G.marks[i - 1].d : 0)), u = gaps[0] || 1;
      galSt('odd', gaps.slice(0, 5).map((x) => fmt(x / u, 1)).join(' : '));
      const f = galFit(); galSt('a', `${fmt(f.a, 3)} m/s²`); galSt('g', `${fmt(f.g, 2)} m/s² (${f.g >= 9.81 ? '+' : ''}${fmt((f.g / 9.81 - 1) * 100)} %)`);
    } else { galSt('odd', '—'); galSt('a', '—'); galSt('g', '—'); }
  }
  function stepGal(dt: number) {
    if (!G.run) return;
    const a = rampAcc(G.deg, G.roll), tEnd = Math.sqrt(2 * RAMP / a);
    G.time += dt;
    while (G.nextBeat <= G.time && G.nextBeat <= tEnd) {
      const actual = clamp(G.nextBeat + gauss() * G.jitter / 1000, 0, tEnd);
      G.marks.push({ t: G.nextBeat, d: .5 * a * actual * actual }); G.nextBeat += G.beat; updGal();
    }
    if (G.time >= tEnd) { G.time = tEnd; G.run = false; say(G.marks.length >= 3 ? t('done', 'Done. Read your value of g in the panel.') : t('few', 'Too few marks: use a gentler slope or a shorter beat.')); }
  }
  function drawGal() {
    const g = S.g, W = S.w, H = S.h, a = rampAcc(G.deg, G.roll);
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, W, H);
    /* ramp, drawn steeper than real so it is easy to see */
    const vis = clamp(G.deg * 2.2, 6, 32) * D2R, x0 = 30, x1 = W - 30, top = 40, len = Math.min((x1 - x0) / Math.cos(vis), (H * .45) / Math.sin(vis));
    const ex = x0 + len * Math.cos(vis), ey = top + len * Math.sin(vis), P = (d: number) => ({ x: x0 + (d / RAMP) * len * Math.cos(vis), y: top + (d / RAMP) * len * Math.sin(vis) });
    g.fillStyle = '#2a2116'; g.beginPath(); g.moveTo(x0, top); g.lineTo(ex, ey); g.lineTo(x0, ey); g.closePath(); g.fill();
    g.strokeStyle = '#c8a46a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, top); g.lineTo(ex, ey); g.stroke(); g.lineWidth = 1;
    g.fillStyle = 'rgba(255,255,255,.4)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(t('steeper', 'slope drawn steeper than real'), x0 + 4, ey - 6);
    G.marks.forEach((m, i) => { const p = P(m.d); g.strokeStyle = '#f2c46d'; g.beginPath(); g.moveTo(p.x + Math.sin(vis) * 10, p.y - Math.cos(vis) * 10); g.lineTo(p.x - Math.sin(vis) * 4, p.y + Math.cos(vis) * 4); g.stroke(); g.fillStyle = '#f2c46d'; g.textAlign = 'center'; g.fillText(String(i + 1), p.x + Math.sin(vis) * 18, p.y - Math.cos(vis) * 18); });
    const d = Math.min(RAMP, .5 * a * G.time * G.time), p = P(d), br = 9;
    g.save(); g.translate(p.x + Math.sin(vis) * br, p.y - Math.cos(vis) * br);
    if (G.roll) { g.fillStyle = '#e9e2d0'; g.beginPath(); g.arc(0, 0, br, 0, 7); g.fill(); g.rotate(d / (br / 40)); g.strokeStyle = '#6b5a3b'; g.beginPath(); g.moveTo(-br, 0); g.lineTo(br, 0); g.stroke(); }
    else { g.rotate(vis); g.fillStyle = '#9fb6c8'; g.fillRect(-br, -br, br * 2, br * 2); }
    g.restore();
    /* graph: distance against time squared */
    const gx = 50, gy0 = H - 50, gw = W - 80, gtop = Math.max(ey + 56, H * .38), gh = gy0 - gtop;
    if (gh < 60) return;
    const tMax = Math.sqrt(2 * RAMP / a), X = (t2: number) => gx + t2 / (tMax * tMax) * gw, Y = (dd: number) => gy0 - dd / RAMP * gh;
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(gx, gtop); g.lineTo(gx, gy0); g.lineTo(gx + gw, gy0); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'left'; g.fillText(t('ax.d', 'distance (m)'), gx + 4, gtop + 2);
    g.textAlign = 'right'; g.fillText(t('ax.t2', 'time² (s²)') + '  ' + fmt(tMax * tMax, 1), gx + gw, gy0 + 16);
    g.textAlign = 'right'; g.fillText(String(RAMP), gx - 6, gtop + 4); g.fillText('0', gx - 6, gy0 + 4);
    if (G.marks.length >= 2) { const k = galFit().k; g.strokeStyle = 'rgba(242,196,109,.6)'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(0), Y(0)); const T2 = Math.min(tMax * tMax, RAMP / (k || 1)); g.lineTo(X(T2), Y(k * T2)); g.stroke(); g.setLineDash([]); }
    g.fillStyle = '#f2c46d'; for (const m of G.marks) { g.beginPath(); g.arc(X(m.t * m.t), Y(m.d), 3.5, 0, 7); g.fill(); }
  }

  /* =====================================================================================
     3. Millikan's oil drops
     ===================================================================================== */
  type Drop = { r: number; n: number; y: number; fall: number };
  const M = { V: 600, drop: null as unknown as Drop, qs: [] as number[], held: 0, e: 0 };
  const newDrop = (): Drop => { const r = (.55 + R() * .55) * 1e-6, n = 1 + Math.floor(R() ** 1.6 * 7); return { r, n, y: -120 + R() * 240, fall: 2 * RHO * GG * r * r / (9 * ETA) }; };
  M.drop = newDrop();
  const vDrop = (d: Drop, V: number) => { const q = d.n * E_CHARGE, m = 4 / 3 * Math.PI * d.r ** 3 * RHO; return (q * V / PLATE - m * GG) / (6 * Math.PI * ETA * d.r); };
  const volt = range(sec.mil, t('volt', 'Voltage across the plates'), { min: 0, max: 3000, step: 1, value: M.V, fmt: (n) => n + ' V' }, (v) => { M.V = v; });
  const nudge = (k: number) => { M.V = clamp(M.V + k, 0, 3000); volt.set(M.V); };
  buttons(sec.mil, [['−10 V', () => nudge(-10)], ['−1 V', () => nudge(-1)], ['+1 V', () => nudge(1)], ['+10 V', () => nudge(10)]]);
  buttons(sec.mil, [[t('rec', 'Record this drop'), () => record(), true], [t('next', 'New drop'), () => { M.drop = newDrop(); M.held = 0; say(t('newd', 'A new drop. Find the voltage that holds it still.')); }]]);
  buttons(sec.mil, [[t('auto', 'Measure 15 drops for me'), () => { seeStage(); for (let i = 0; i < 15; i++) { const d = newDrop(); measure(d, holdV(d.r, d.n * E_CHARGE) * (1 + gauss() * .006)); } updMil(); say(t('autod', '15 drops measured with a careful hand (about 0.6 % voltage error).')); }], [t('clear', 'Clear')
    , () => { M.qs = []; updMil(); }]]);
  const milSt = stats(sec.mil, [['drift', t('drift', 'Drop speed')], ['k', t('count', 'Drops recorded')], ['e', t('eunit', 'Your smallest charge')], ['err', t('vs', 'Versus the real one')]]);
  note(sec.mil, t('n.mil', 'When the drop hangs still, the electric push equals its weight, so charge = weight × plate gap ÷ voltage. Its size comes from how fast it falls with the field off (Stokes\' law). Noise and Brownian jitter are real here, so do several drops. Millikan got 1.592 × 10⁻¹⁹ C; the small gap from today\'s value came from a wrong figure for the viscosity of air.'));
  function measure(d: Drop, V: number) {
    const r = radiusFromFall(d.fall * (1 + gauss() * .015)), m = 4 / 3 * Math.PI * r ** 3 * RHO;
    M.qs.push(m * GG * PLATE / V);
  }
  function record() {
    const v = vDrop(M.drop, M.V) * 1e6;
    if (Math.abs(v) > 3 || M.held < .6) { say(t('notstill', 'Not still yet: keep the drop hovering for a moment, then record.')); return; }
    measure(M.drop, M.V); updMil();
    say(t('recd', 'Recorded. Now try a new drop.'));
    M.drop = newDrop(); M.held = 0;
  }
  function updMil() {
    milSt('k', String(M.qs.length));
    const e = M.e = bestUnit(M.qs);
    if (M.qs.length >= 3) { milSt('e', `${fmt(e * 1e19, 3)} × 10⁻¹⁹ C`); milSt('err', `${e >= E_CHARGE ? '+' : ''}${fmt((e / E_CHARGE - 1) * 100, 2)} %`); }
    else { milSt('e', t('need3', 'record 3 or more')); milSt('err', '—'); }
  }
  let driftShown = 0;
  function stepMil(dt: number) {
    const d = M.drop, v = vDrop(d, M.V) * 1e6; // µm/s, up is positive
    const jitter = Math.sqrt(2 * 1.380649e-23 * 293 / (6 * Math.PI * ETA * d.r)) * 1e6;
    d.y += (v * dt + gauss() * jitter * Math.sqrt(dt)) * (ctx.calm ? .5 : 1);
    M.held = Math.abs(v) < 3 ? M.held + dt : 0;
    if (d.y > 420 || d.y < -420) { M.drop = newDrop(); M.held = 0; say(t('lost', 'The drop drifted out of view. Here is a new one.')); }
    driftShown += dt; if (driftShown > .2) { driftShown = 0; milSt('drift', `${v >= 0 ? '↑' : '↓'} ${fmt(Math.abs(v), 1)} µm/s`); }
  }
  function drawMil() {
    const g = S.g, W = S.w, H = S.h, wide = W > 640;
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, W, H);
    const cx = wide ? W * .3 : W / 2, cy = wide ? H / 2 : H * .32, rr = Math.min(wide ? W * .25 : W * .42, (wide ? H : H * .6) * .42), k = rr / 400;
    g.fillStyle = '#081016'; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.clip();
    g.strokeStyle = 'rgba(160,210,255,.14)'; for (let y = -400; y <= 400; y += 100) { g.beginPath(); g.moveTo(cx - rr, cy + y * k); g.lineTo(cx + rr, cy + y * k); g.stroke(); }
    const dy = cy - M.drop.y * k, glow = g.createRadialGradient(cx, dy, 0, cx, dy, 9); glow.addColorStop(0, '#fff8e0'); glow.addColorStop(.35, 'rgba(255,220,140,.7)'); glow.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, dy, 9, 0, 7); g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); g.lineWidth = 1;
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText('100 µm', cx + rr * .7, cy + rr * .25 + 4);
    g.fillRect(cx + rr * .7 - 50 * k, cy + rr * .25 + 8, 100 * k, 2);
    g.fillText('+ ' + t('plate', 'plate') + ' ' + M.V + ' V', cx, cy - rr - 8 > 10 ? cy - rr - 8 : 12); g.fillText('− ' + t('plate', 'plate'), cx, cy + rr + 16);
    if (M.held > .6) { g.fillStyle = '#9be59b'; g.fillText(t('hold', 'holding still'), cx, cy + rr - 14); }
    /* charges on a number line in units of 10⁻¹⁹ C */
    const lx = wide ? W * .6 : 24, lw = wide ? W * .36 : W - 48, ly = wide ? H * .55 : H * .76, max = 12, X = (q: number) => lx + q / max * lw;
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx + lw, ly); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'center';
    for (let q = 0; q <= max; q += 2) { g.fillRect(X(q), ly, 1, 5); g.fillText(String(q), X(q), ly + 17); }
    g.fillText(t('ax.q', 'charge, × 10⁻¹⁹ C'), lx + lw / 2, ly + 33);
    const e = M.e * 1e19;
    if (M.qs.length >= 3 && e) { g.strokeStyle = 'rgba(242,196,109,.45)'; g.setLineDash([3, 4]); for (let n = 1; n * e <= max; n++) { g.beginPath(); g.moveTo(X(n * e), ly - 80); g.lineTo(X(n * e), ly); g.stroke(); g.fillStyle = '#f2c46d'; g.fillText(n + 'e', X(n * e), ly - 84); } g.setLineDash([]); }
    const stack: Record<number, number> = {};
    for (const q of M.qs) { const qq = q * 1e19, b = Math.round(qq * 8); stack[b] = (stack[b] || 0) + 1; g.fillStyle = '#fff'; g.beginPath(); g.arc(X(qq), ly - 5 - (stack[b] - 1) * 7, 3, 0, 7); g.fill(); }
    if (!M.qs.length) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillText(t('empty', 'Your recorded charges appear here.'), lx + lw / 2, ly - 30); }
  }

  /* =====================================================================================
     4. Gold foil
     ===================================================================================== */
  const METALS: [string, string, number, number][] = [['au', 'Gold', 79, 5.90e28], ['pt', 'Platinum', 78, 6.62e28], ['ag', 'Silver', 47, 5.86e28], ['cu', 'Copper', 29, 8.49e28], ['al', 'Aluminium', 13, 6.03e28]];
  const BINS = 18;
  const Rf = { model: 'nuc', metal: 'au', MeV: 7.7, um: .4, rate: 30000, run: true, fired: 0, acc: 0, bins: new Array(BINS).fill(0), back: 0, wide: 0 };
  const metal = () => METALS.find((m) => m[0] === Rf.metal)!;
  /* radius (fm) of the patch of foil each nucleus "owns": 1 / sqrt(π · atoms per m³ · thickness) */
  const bMax = () => 1 / Math.sqrt(Math.PI * metal()[3] * Rf.um * 1e-6) * 1e15;
  const sigmaSmall = () => D2R * .9 * Math.sqrt(Rf.um / .4) * (metal()[2] / 79) * (7.7 / Rf.MeV);
  const clearR = () => { Rf.fired = 0; Rf.bins.fill(0); Rf.back = 0; Rf.wide = 0; updRuth(); };
  seg(sec.ruth, t('model', 'Model of the atom'), [['nuc', t('mo.nuc', 'Tiny nucleus (Rutherford)')], ['plum', t('mo.plum', 'Plum pudding (Thomson)')]], 'nuc', (v) => { Rf.model = v; clearR(); });
  select(sec.ruth, t('foil', 'Foil'), METALS.map(([k, n, Z]) => [k, `${t('mt.' + k, n)} (Z = ${Z})`]), Rf.metal, (v) => { Rf.metal = v; clearR(); });
  range(sec.ruth, t('mev', 'Alpha energy'), { min: 2, max: 9, step: .1, value: Rf.MeV, fmt: (n) => n.toFixed(1) + ' MeV' }, (v) => { Rf.MeV = v; clearR(); });
  range(sec.ruth, t('thick', 'Foil thickness'), { min: .1, max: 2, step: .05, value: Rf.um, fmt: (n) => n.toFixed(2) + ' µm' }, (v) => { Rf.um = v; clearR(); });
  range(sec.ruth, t('rate', 'Alphas per second'), { min: 2, max: 5.3, step: .1, value: Math.log10(Rf.rate), fmt: (n) => Math.round(10 ** n).toLocaleString(ctx.lang) }, (v) => { Rf.rate = 10 ** v; });
  const runBtn = buttons(sec.ruth, [[t('pause', 'Pause'), () => { Rf.run = !Rf.run; runBtn[0].textContent = Rf.run ? t('pause', 'Pause') : t('resume', 'Resume'); }], [t('clear', 'Clear'), clearR]]);
  const ruthSt = stats(sec.ruth, [['f', t('fired', 'Alphas fired')], ['w', t('wide', 'Turned more than 10°')], ['b', t('back', 'Bounced back (over 90°)')], ['d0', t('d0', 'Closest approach')]]);
  note(sec.ruth, t('n.ruth', 'In the plum pudding model the positive charge is spread through the whole atom, so every alpha is nudged by about a degree at most. Only a tiny, heavy, charged centre can turn one right round. The dashed curve is Rutherford\'s 1911 formula; the bars are your counts, on a scale where each line is ten times the one below. This uses single scattering, a fair model for thin foils.'));
  function updRuth() {
    ruthSt('f', Math.round(Rf.fired).toLocaleString(ctx.lang));
    ruthSt('w', Rf.wide.toLocaleString(ctx.lang));
    ruthSt('b', Rf.back ? `${Rf.back.toLocaleString(ctx.lang)} · ${t('onein', '1 in')} ${Math.round(Rf.fired / Rf.back).toLocaleString(ctx.lang)}` : '0');
    ruthSt('d0', Rf.model === 'nuc' ? `${fmt(closest(metal()[2], Rf.MeV), 1)} fm` : t('none', 'no hard centre'));
  }
  function sampleAngle(B: number, d0: number, sig: number) {
    const s = sig * gauss();
    if (Rf.model === 'plum') return Math.min(Math.PI, Math.abs(s));
    return Math.min(Math.PI, Math.abs(scatter(B * Math.sqrt(R() || 1e-12), d0) + s));
  }
  type Alpha = { b: number; th: number; s: number };
  const shown: Alpha[] = []; let spawn = 0, statT = 0;
  function stepRuth(dt: number) {
    if (!Rf.run) return;
    Rf.acc += Rf.rate * dt; const n = Math.floor(Rf.acc); Rf.acc -= n;
    const B = bMax(), d0 = closest(metal()[2], Rf.MeV), sig = sigmaSmall();
    for (let i = 0; i < n; i++) {
      const th = sampleAngle(B, d0, sig), bin = Math.min(BINS - 1, Math.floor(th / Math.PI * BINS));
      Rf.bins[bin]++; if (th > 10 * D2R) Rf.wide++; if (th > Math.PI / 2) Rf.back++;
    }
    Rf.fired += n;
    /* the drawn particles are a zoomed sketch, not to scale */
    spawn += dt * (ctx.calm ? 6 : 26);
    while (spawn >= 1 && shown.length < 70) {
      spawn -= 1; const bv = (R() * 2 - 1);
      const th = Rf.model === 'plum' ? Math.abs(gauss() * 1.2 * D2R) : Math.min(Math.PI * .98, scatter(Math.abs(bv) + .002, .06 * closest(metal()[2], Rf.MeV) / 29.5));
      shown.push({ b: bv, th, s: 0 });
    }
    if (spawn > 3) spawn = 3;
    for (const a of shown) a.s += dt * (ctx.calm ? .35 : .7);
    for (let i = shown.length - 1; i >= 0; i--) if (shown[i].s > 1.6) shown.splice(i, 1);
    statT += dt; if (statT > .25) { statT = 0; updRuth(); }
  }
  function drawRuth() {
    const g = S.g, W = S.w, H = S.h;
    g.fillStyle = '#0b0a08'; g.fillRect(0, 0, W, H);
    const vh = H * .5, cx = W / 2, cy = vh / 2 + 10, half = Math.min(vh * .42, W * .3);
    /* the atom */
    if (Rf.model === 'plum') {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, half * .8); gr.addColorStop(0, 'rgba(255,120,120,.28)'); gr.addColorStop(1, 'rgba(255,120,120,.06)');
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, half * .8, 0, 7); g.fill();
      g.fillStyle = '#7fb2ff'; for (let i = 0; i < 14; i++) { const a = i * 2.4, r = half * .7 * Math.sqrt((i + .5) / 14); g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 0, 7); g.fill(); }
    } else {
      g.strokeStyle = 'rgba(127,178,255,.12)'; g.beginPath(); g.arc(cx, cy, half * .8, 0, 7); g.stroke();
      g.fillStyle = '#ff7a6b'; g.beginPath(); g.arc(cx, cy, 3.5, 0, 7); g.fill();
    }
    /* alpha paths: straight in, turn where they pass the centre, straight out; each one leaves a short trail */
    g.save(); g.beginPath(); g.rect(0, 0, W, vh + 14); g.clip();
    const x0 = cx - W * .55, L1 = cx - x0, L2 = W * .55;
    for (const a of shown) {
      const yb = cy + a.b * half, sgn = a.b >= 0 ? 1 : -1, d = a.s * (L1 + L2), back = a.th > Math.PI / 2;
      const at = (q: number) => q <= L1 ? [x0 + q, yb] : [cx + Math.cos(a.th) * (q - L1), yb + sgn * Math.sin(a.th) * (q - L1)];
      g.strokeStyle = back ? 'rgba(255,130,110,.85)' : 'rgba(242,196,109,.45)'; g.lineWidth = back ? 1.8 : 1;
      g.beginPath(); for (let k = 0; k <= 12; k++) { const [x, y] = at(Math.max(0, d - 110 + k * 110 / 12)); k ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
      const [x, y] = at(d); g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(x, y, 2.2, 0, 7); g.fill();
    }
    g.restore(); g.lineWidth = 1;
    g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'left'; g.fillText(t('zoom', 'one atom, zoomed in, not to scale'), 12, 16);
    /* counts by angle, log scale, with Rutherford's prediction */
    const gx = 56, gw = W - 76, gy0 = H - 50, gtop = vh + 30, gh = gy0 - gtop, top = Math.max(2, Math.ceil(Math.log10(Math.max(10, Rf.fired)))), Y = (c: number) => gy0 - (c > 0 ? Math.log10(c + 1) : 0) / top * gh, bw = gw / BINS;
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = 'rgba(255,255,255,.5)'; g.textAlign = 'right';
    for (let p = 0; p <= top; p++) { const y = gy0 - p / top * gh; g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + gw, y); g.stroke(); if (p % (top > 5 ? 2 : 1) === 0) g.fillText(p === 0 ? '0' : '10' + (p === 1 ? '' : sup(p)), gx - 6, y + 3); }
    for (let i = 0; i < BINS; i++) { const c = Rf.bins[i]; g.fillStyle = i >= BINS / 2 ? '#ff8270' : '#f2c46d'; const y = Y(c); g.fillRect(gx + i * bw + 2, y, bw - 4, gy0 - y); }
    if (Rf.model === 'nuc' && Rf.fired > 0) {
      const d0 = closest(metal()[2], Rf.MeV), B = bMax(), cap = (th: number) => (th <= 0 ? B : Math.min(B, bFor(th, d0)));
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.setLineDash([4, 3]); g.beginPath();
      for (let i = 0; i < BINS; i++) { const a = i / BINS * Math.PI, b = (i + 1) / BINS * Math.PI, p = (cap(a) ** 2 - cap(b) ** 2) / (B * B), y = Y(p * Rf.fired); const x = gx + (i + .5) * bw; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.setLineDash([]);
    }
    g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'center';
    for (let i = 0; i <= BINS; i += 3) g.fillText(i * 10 + '°', gx + i * bw, gy0 + 14);
    g.fillText(t('ax.th', 'angle turned'), gx + gw / 2, gy0 + 28);
  }
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'; const sup = (n: number) => String(n).split('').map((c) => SUP[+c]).join('');

  /* ---------- mode switching and the loop ---------- */
  function setMode(m: Mode) {
    mode = m; saved.set(m); modeSeg.set(m);
    for (const k of Object.keys(sec) as Mode[]) sec[k].style.display = k === m ? 'grid' : 'none';
    intro.textContent = INTRO[m]; say('');
    if (m === 'era') updEra();
    if (m === 'mil') say(t('mil.start', 'Move the voltage until the glowing drop hangs still.'));
  }
  setMode(mode); updGal(); updMil(); updRuth();
  loop(ctx, S.cv, (dt) => {
    if (mode === 'gal') stepGal(dt); else if (mode === 'mil') stepMil(dt); else if (mode === 'ruth') stepRuth(dt);
    if (mode === 'era') drawEra(); else if (mode === 'gal') drawGal(); else if (mode === 'mil') drawMil(); else drawRuth();
  });
}
