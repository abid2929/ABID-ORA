/* 039 Astronomy Observatory: Tonight's Sky. A live all-sky chart for any place and time: 1,600 real
   stars (Hipparcos, via d3-celestial), the 88 constellations, and the Sun, Moon and planets worked
   out from published formulas (the Astronomical Almanac low-precision Sun, a truncated lunar theory
   and JPL's approximate Keplerian elements for the planets). Twilight colours the sky, light
   pollution hides faint stars, and clicking any object gives where it is and when it rises and sets. */
import { type Ctx, h, layout, canvas, heading, note, select, seg, check, stats, loop, local, clamp } from './kit';
import { I18N } from '../scripts/i18n';

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = (d: number) => Math.sin(d * D2R), cos = (d: number) => Math.cos(d * D2R);
const norm = (d: number) => ((d % 360) + 360) % 360;
export const jd = (ms: number) => ms / 86400000 + 2440587.5;
/** Greenwich mean sidereal time in degrees */
export const gmst = (J: number) => norm(280.46061837 + 360.98564736629 * (J - 2451545));
const OBL = 23.43928;
function ecl2eq(lam: number, bet: number) {
  const x = cos(bet) * cos(lam), y = cos(bet) * sin(lam), z = sin(bet);
  const ye = y * cos(OBL) - z * sin(OBL), ze = y * sin(OBL) + z * cos(OBL);
  return { ra: norm(Math.atan2(ye, x) * R2D), dec: Math.asin(ze) * R2D };
}
/** the Sun (Astronomical Almanac low-precision formula, about 0.01°) */
export function sun(J: number) {
  const n = J - 2451545, L = norm(280.46 + .9856474 * n), g = norm(357.528 + .9856003 * n);
  const lam = L + 1.915 * sin(g) + .02 * sin(2 * g);
  return { ...ecl2eq(lam, 0), lam };
}
/** the Moon (main terms of the lunar theory, about 0.3°), with illuminated fraction */
export function moon(J: number) {
  const d = J - 2451545;
  const Lp = 218.316 + 13.176396 * d, Mp = 134.963 + 13.064993 * d, F = 93.272 + 13.22935 * d, D = 297.85 + 12.190749 * d, M = 357.529 + .98560028 * d;
  const lam = Lp + 6.289 * sin(Mp) + 1.274 * sin(2 * D - Mp) + .658 * sin(2 * D) + .214 * sin(2 * Mp) - .186 * sin(M) - .114 * sin(2 * F);
  const bet = 5.128 * sin(F) + .281 * sin(Mp + F) + .278 * sin(Mp - F) + .173 * sin(2 * D - F);
  const s = sun(J), elong = Math.acos(cos(bet) * cos(lam - s.lam)) * R2D;
  const waxing = norm(lam - s.lam) < 180;
  return { ...ecl2eq(lam, bet), lam: norm(lam), illum: (1 - cos(elong)) / 2, waxing, age: norm(lam - s.lam) / 360 * 29.530589 };
}
/* JPL "Approximate Positions of the Planets", Table 1 (valid 1800–2050): a, e, I, L, long. peri, long. node, and rates per century */
const EL: Record<string, number[]> = {
  Mercury: [.38709927, .20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593, .00000037, .00001906, -.00594749, 149472.67411175, .16047689, -.12534081],
  Venus: [.72333566, .00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255, .0000039, -.00004107, -.0007889, 58517.81538729, .00268329, -.27769418],
  Earth: [1.00000261, .01671123, -.00001531, 100.46457166, 102.93768193, 0, .00000562, -.00004392, -.01294668, 35999.37244981, .32327364, 0],
  Mars: [1.52371034, .0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891, .00001847, .00007882, -.00813131, 19140.30268499, .44441088, -.29257343],
  Jupiter: [5.202887, .04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909, -.00011607, -.00013253, -.00183714, 3034.74612775, .21252668, .20469106],
  Saturn: [9.53667594, .05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448, -.0012506, -.00050991, .00193609, 1222.49362201, -.41897216, -.28867794],
  Uranus: [19.18916464, .04725744, .77263783, 313.23810451, 170.9542763, 74.01692503, -.00196176, -.00004397, -.00242939, 428.48202785, .40805281, .04240589],
  Neptune: [30.06992276, .00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574, .00026291, .00005105, .00035372, 218.45945325, -.32241464, -.00508664],
};
/* absolute magnitude H and phase coefficient (mag per degree), Mallama & Hilton 2018 simplified */
const MAG: Record<string, [number, number]> = { Mercury: [-.6, .038], Venus: [-4.4, .013], Mars: [-1.6, .016], Jupiter: [-9.4, .005], Saturn: [-8.9, .044], Uranus: [-7.2, .002], Neptune: [-6.9, 0] };
export function helio(p: string, T: number) {
  const e0 = EL[p], [a, e, I, L, w, O] = e0.slice(0, 6).map((v, i) => v + e0[i + 6] * T);
  const M = norm(L - w), om = w - O;
  let E = M + R2D * e * sin(M); for (let k = 0; k < 6; k++) E -= (E - R2D * e * sin(E) - M) / (1 - e * cos(E));
  const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
  const x = (cos(om) * cos(O) - sin(om) * sin(O) * cos(I)) * xp + (-sin(om) * cos(O) - cos(om) * sin(O) * cos(I)) * yp;
  const y = (cos(om) * sin(O) + sin(om) * cos(O) * cos(I)) * xp + (-sin(om) * sin(O) + cos(om) * cos(O) * cos(I)) * yp;
  const z = sin(om) * sin(I) * xp + cos(om) * sin(I) * yp;
  return [x, y, z];
}
/** a planet's apparent position and approximate magnitude */
export function planet(p: string, J: number) {
  const T = (J - 2451545) / 36525, P = helio(p, T), E = helio('Earth', T);
  const g = [P[0] - E[0], P[1] - E[1], P[2] - E[2]], dist = Math.hypot(...g), r = Math.hypot(...P);
  const lam = norm(Math.atan2(g[1], g[0]) * R2D), bet = Math.asin(g[2] / dist) * R2D;
  const ph = Math.acos(clamp((r * r + dist * dist - Math.hypot(...E) ** 2) / (2 * r * dist), -1, 1)) * R2D;
  const [H, k] = MAG[p];
  return { ...ecl2eq(lam, bet), lam, dist, mag: H + 5 * Math.log10(r * dist) + k * ph };
}
/** altitude and azimuth (from north through east) for a place */
export function altaz(ra: number, dec: number, lat: number, lon: number, J: number) {
  const H = norm(gmst(J) + lon - ra);
  const alt = Math.asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H)) * R2D;
  const az = norm(Math.atan2(-sin(H) * cos(dec), cos(lat) * sin(dec) - sin(lat) * cos(dec) * cos(H)) * R2D);
  return { alt, az };
}
export const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];

export const PLACES: [string, string, number, number, string][] = [
  ['dhaka', 'Dhaka', 23.81, 90.41, 'Asia/Dhaka'], ['london', 'London', 51.51, -.13, 'Europe/London'], ['ny', 'New York', 40.71, -74.01, 'America/New_York'],
  ['sydney', 'Sydney', -33.87, 151.21, 'Australia/Sydney'], ['tokyo', 'Tokyo', 35.68, 139.69, 'Asia/Tokyo'], ['cape', 'Cape Town', -33.92, 18.42, 'Africa/Johannesburg'],
  ['reyk', 'Reykjavík', 64.15, -21.94, 'Atlantic/Reykjavik'], ['quito', 'Quito (on the equator)', -.18, -78.47, 'America/Guayaquil'], ['dubai', 'Dubai', 25.2, 55.27, 'Asia/Dubai'],
  ['atacama', 'Atacama Desert (dark sky)', -24.63, -70.4, 'America/Santiago'], ['mauna', 'Mauna Kea (observatory)', 19.82, -155.47, 'Pacific/Honolulu'], ['delhi', 'New Delhi', 28.61, 77.21, 'Asia/Kolkata']];

/** minutes east of UTC for a time zone at a given instant */
export function tzOff(ms: number, tz: string) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
    return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000;
  } catch { return -new Date(ms).getTimezoneOffset(); }
}
const pad = (n: number) => String(n).padStart(2, '0');
export function bvRGB(bv: number) {
  /* star colour from its B−V index */
  const t = clamp((bv + .4) / 2.4, 0, 1);
  return t < .25 ? [170 + t * 300, 195 + t * 200, 255] : t < .45 ? [245, 245, 255 - (t - .25) * 200] : [255, 235 - (t - .45) * 220, 200 - (t - .45) * 300];
}

type Obj = { kind: string; name: string; ra: number; dec: number; mag: number; con?: string };
interface Sky { s: number[]; n: Record<string, string>; l: Record<string, number[][][]>; c: Record<string, [string, number, number, string]> }

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#8fb8ff');
  L.view.style.background = '#03050c';
  const S = canvas(L.view, t('cv', 'All-sky chart: the edge is the horizon, the centre is straight overhead. Click a star or planet for details; drag to turn the chart.'));
  S.cv.style.cursor = 'crosshair';
  const info = stats(L.panel, [['lt', t('lt', 'Local time')], ['sky', t('sky', 'Sky')], ['moon', t('moon', 'Moon')], ['up', t('up', 'Planets up')]]);
  const P = { place: 'dhaka', lat: 23.81, lon: 90.41, tz: 'Asia/Dhaka', ms: Date.now(), speed: 0, lines: true, names: true, grid: false, ecl: true, limit: 5, rot: 0 };
  let sky: Sky | null = null, sel = null as Obj | null;
  fetch(I18N.root + 'assets/sky/sky.json').then((r) => r.json()).then((d) => { sky = d; }).catch(() => { L.hud.textContent = t('err', 'Could not load the star catalogue.'); });

  const placeName = () => P.place === 'me' ? t('here', 'My location') : t('pl.' + P.place, PLACES.find((p) => p[0] === P.place)![1]);
  const fmtLocal = (ms: number) => { const d = new Date(ms + tzOff(ms, P.tz) * 60000); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`; };
  const hm = (ms: number) => fmtLocal(ms).slice(11);

  /* ---------- objects ---------- */
  function bodies(J: number) {
    const s = sun(J), m = moon(J);
    const list: { kind: string; name: string; ra: number; dec: number; mag: number; extra?: string }[] = [
      { kind: 'sun', name: t('sun', 'Sun'), ra: s.ra, dec: s.dec, mag: -26.7 },
      { kind: 'moon', name: t('moonn', 'Moon'), ra: m.ra, dec: m.dec, mag: -12.7 * m.illum + 0 * 1 }];
    for (const p of PLANETS) { const q = planet(p, J); list.push({ kind: 'planet', name: t('p.' + p, p), ra: q.ra, dec: q.dec, mag: q.mag, extra: `${q.dist.toFixed(2)} AU` }); }
    return { list, s, m };
  }
  function phaseName(m: ReturnType<typeof moon>) {
    const a = m.age; return a < 1.5 || a > 28 ? t('ph.new', 'new moon') : a < 6.4 ? t('ph.wxc', 'waxing crescent') : a < 8.4 ? t('ph.fq', 'first quarter') : a < 13.8 ? t('ph.wxg', 'waxing gibbous') : a < 15.8 ? t('ph.full', 'full moon') : a < 21.1 ? t('ph.wng', 'waning gibbous') : a < 23.1 ? t('ph.lq', 'last quarter') : t('ph.wnc', 'waning crescent');
  }
  /* rise / set within the next 24 h, by stepping 10 minutes and refining */
  function riseSet(get: (J: number) => { ra: number; dec: number }, J0: number, h0: number) {
    const alt = (J: number) => { const p = get(J); return altaz(p.ra, p.dec, P.lat, P.lon, J).alt - h0; };
    let rise: number | null = null, set: number | null = null, prev = alt(J0);
    for (let k = 1; k <= 144 && (rise === null || set === null); k++) {
      const J = J0 + k / 144, a = alt(J);
      if (prev < 0 && a >= 0 && rise === null) rise = J - (a / (a - prev)) / 144;
      if (prev >= 0 && a < 0 && set === null) set = J - (a / (a - prev)) / 144;
      prev = a;
    }
    return { rise, set, always: rise === null && set === null && alt(J0) > 0 };
  }
  const msOf = (J: number) => (J - 2440587.5) * 86400000;

  /* ---------- drawing ---------- */
  let hits: { x: number; y: number; o: Obj }[] = [];
  function draw(dt: number) {
    if (P.speed) { P.ms += dt * P.speed * 60000; syncInput(); }
    const g = S.g, W = S.w, H = S.h, J = jd(P.ms);
    const cx = W / 2, cy = 64 + (H - 64) / 2, R = Math.min(W / 2 - 24, (H - 64) / 2 - 22);
    const { list, s, m } = bodies(J), sa = altaz(s.ra, s.dec, P.lat, P.lon, J).alt;
    /* sky colour from the Sun's altitude: day, civil, nautical, astronomical twilight, night */
    const dayK = clamp((sa + 18) / 24, 0, 1), skyTop = `rgb(${Math.round(4 + 60 * dayK ** 2)},${Math.round(6 + 110 * dayK ** 1.6)},${Math.round(14 + 190 * dayK ** 1.3)})`;
    g.fillStyle = '#03050c'; g.fillRect(0, 0, W, H);
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, skyTop); grd.addColorStop(1, sa > -12 && sa < 3 ? `rgb(${Math.round(60 + 140 * clamp((sa + 12) / 15, 0, 1))},${Math.round(40 + 70 * clamp((sa + 12) / 15, 0, 1))},${Math.round(70 + 40 * dayK)})` : skyTop);
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    /* stereographic projection centred on the zenith, north up and east on the left (as you see the sky lying on your back) */
    const proj = (alt: number, az: number) => { const r = R * Math.tan((90 - alt) * D2R / 2); const a = (az + P.rot) * D2R; return [cx - r * Math.sin(a), cy - r * Math.cos(a)]; };
    const dimByDay = clamp((-sa - 4) / 10, 0, 1); /* stars fade out through twilight */
    const lst = norm(gmst(J) + P.lon), sl = sin(P.lat), cl = cos(P.lat);
    const fast = (ra: number, dec: number) => { const Hh = (lst - ra) * D2R, sd = Math.sin(dec * D2R), cd = Math.cos(dec * D2R), ch = Math.cos(Hh); const alt = Math.asin(sl * sd + cl * cd * ch) * R2D; const az = Math.atan2(-Math.sin(Hh) * cd, cl * sd - sl * cd * ch) * R2D; return { alt, az }; };
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    hits = [];
    if (P.grid) {
      g.strokeStyle = 'rgba(140,170,255,.18)'; g.lineWidth = 1;
      for (const a of [30, 60]) { const r = R * Math.tan((90 - a) * D2R / 2); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
      for (let az = 0; az < 360; az += 45) { const [x, y] = proj(0, az); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); }
    }
    if (P.ecl) {
      g.strokeStyle = 'rgba(255,210,120,.35)'; g.setLineDash([4, 5]); g.beginPath(); let pen = false;
      for (let l = 0; l <= 360; l += 3) { const q = ecl2eq(l, 0), p = fast(q.ra, q.dec); if (p.alt < -2) { pen = false; continue; } const [x, y] = proj(p.alt, p.az); pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; }
      g.stroke(); g.setLineDash([]);
    }
    if (sky) {
      if (P.lines) {
        g.strokeStyle = `rgba(140,180,255,${.03 + .37 * dimByDay})`; g.lineWidth = 1;
        for (const k in sky.l) for (const segm of sky.l[k]) {
          g.beginPath(); let pen = false;
          for (const [ra, dec] of segm) { const p = fast(ra, dec); if (p.alt < -5) { pen = false; continue; } const [x, y] = proj(p.alt, p.az); pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; }
          g.stroke();
        }
        if (P.names) {
          g.fillStyle = `rgba(160,190,255,${.04 + .56 * dimByDay})`; g.font = '10px ui-monospace,monospace'; g.textAlign = 'center';
          for (const k in sky.c) { const [nm, ra, dec, rank] = sky.c[k]; if (+rank > 2 && R < 300) continue; const p = fast(ra, dec); if (p.alt < 5) continue; const [x, y] = proj(p.alt, p.az); g.fillText(t('c.' + k, nm).toUpperCase(), x, y); }
        }
      }
      const s4 = sky.s, lim = Math.min(P.limit, 1 + dimByDay * 5);
      for (let i = 0; i < s4.length; i += 4) {
        const mag = s4[i + 2]; if (mag > lim) continue;
        const p = fast(s4[i], s4[i + 1]); if (p.alt < 0) continue;
        const [x, y] = proj(p.alt, p.az), [r, gg, b] = bvRGB(s4[i + 3]);
        const rad = Math.max(.6, 3.4 - mag * .55) * (R / 330 + .4), al = clamp((lim - mag + .5) / 2, .2, 1) * (.35 + .65 * dimByDay);
        g.fillStyle = `rgba(${r | 0},${gg | 0},${b | 0},${al})`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
        const nm = sky.n[i / 4];
        if (mag < 3.2) hits.push({ x, y, o: { kind: 'star', name: nm || `${t('star', 'Star')} (mag ${mag})`, ra: s4[i], dec: s4[i + 1], mag } });
        if (nm && P.names && mag < 1.6 && dimByDay > .3) { g.fillStyle = 'rgba(255,255,255,.65)'; g.font = '11px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(nm, x + rad + 3, y + 3); }
      }
    }
    /* Sun, Moon and planets */
    for (const b of list) {
      const p = fast(b.ra, b.dec); if (p.alt < -1) continue;
      const [x, y] = proj(p.alt, p.az);
      if (b.kind === 'sun') { const gl = g.createRadialGradient(x, y, 0, x, y, 40); gl.addColorStop(0, 'rgba(255,250,220,1)'); gl.addColorStop(.2, 'rgba(255,230,150,.6)'); gl.addColorStop(1, 'rgba(255,200,100,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, 40, 0, 7); g.fill(); }
      else if (b.kind === 'moon') {
        const r = 9; g.fillStyle = 'rgba(40,40,50,.9)'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        /* lit part: terminator ellipse; the bright limb faces the Sun */
        const sp = fast(s.ra, s.dec), [sx, sy] = proj(sp.alt, sp.az), ang = Math.atan2(sy - y, sx - x), k = 1 - 2 * m.illum;
        g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#f2efe4'; g.beginPath(); g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); g.ellipse(0, 0, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, k > 0); g.fill(); g.restore();
      } else { const rad = clamp(4 - b.mag * .8, 2, 6); g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); if (b.mag > 4.5) { g.strokeStyle = 'rgba(255,233,176,.6)'; g.beginPath(); g.arc(x, y, rad + 3, 0, 7); g.stroke(); } }
      g.fillStyle = 'rgba(255,233,176,.95)'; g.font = '12px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(b.name, x + 10, y - 6);
      hits.push({ x, y, o: { kind: b.kind, name: b.name, ra: b.ra, dec: b.dec, mag: b.mag } });
    }
    if (sel) { const p = fast(sel.ra, sel.dec); if (p.alt > 0) { const [x, y] = proj(p.alt, p.az); g.strokeStyle = '#8fb8ff'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 12, 0, 7); g.stroke(); } }
    g.restore();
    /* horizon ring and compass */
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.font = 'bold 12px ui-monospace,monospace'; g.textAlign = 'center';
    for (const [lab, az] of [[t('N', 'N'), 0], [t('E', 'E'), 90], [t('S', 'S'), 180], [t('W', 'W'), 270]] as [string, number][]) { const a = (az + P.rot) * D2R; g.fillText(lab, cx - (R + 13) * Math.sin(a), cy - (R + 13) * Math.cos(a) + 4); }
    /* panel numbers, a few times a second */
    tick += dt; if (tick > .25) { tick = 0; stat(J, sa, m, list); }
  }
  let tick = 1;
  function stat(J: number, sa: number, m: ReturnType<typeof moon>, list: ReturnType<typeof bodies>['list']) {
    info('lt', `${fmtLocal(P.ms).replace('T', ' ')} · ${placeName()}`);
    info('sky', sa > 0 ? t('day', 'daytime') : sa > -6 ? t('civil', 'civil twilight') : sa > -12 ? t('naut', 'nautical twilight') : sa > -18 ? t('astro', 'astronomical twilight') : t('night', 'full night'));
    info('moon', `${phaseName(m)} · ${Math.round(m.illum * 100)}%`);
    const up = list.filter((b) => b.kind === 'planet' && altaz(b.ra, b.dec, P.lat, P.lon, J).alt > 0 && b.mag < 6).map((b) => b.name);
    info('up', up.length ? up.join(', ') : t('noneup', 'none above the horizon'));
    if (sel) {
      const J0 = jd(P.ms), o = sel, pos = altaz(o.ra, o.dec, P.lat, P.lon, J0);
      const get = o.kind === 'star' ? () => ({ ra: o.ra, dec: o.dec }) : (JJ: number) => bodies(JJ).list.find((b) => b.name === o.name)!;
      const rs = riseSet(get, J0, o.kind === 'sun' || o.kind === 'moon' ? -.833 : -.57);
      const when = rs.always ? t('always', 'never sets today') : `${t('rise', 'rises')} ${rs.rise ? hm(msOf(rs.rise)) : '—'} · ${t('set', 'sets')} ${rs.set ? hm(msOf(rs.set)) : '—'}`;
      const dir = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(pos.az / 45) % 8];
      L.hud.textContent = `${o.name} · mag ${o.mag.toFixed(1)} · ${t('alt', 'altitude')} ${pos.alt.toFixed(0)}° ${t('dir', 'towards')} ${t(dir, dir)} (${pos.az.toFixed(0)}°) · ${when}`;
    }
  }

  /* ---------- interaction ---------- */
  let drag: { x: number; rot: number; moved: boolean } | null = null;
  S.cv.addEventListener('pointerdown', (e) => { drag = { x: local(e, S.cv).x, rot: P.rot, moved: false }; S.cv.setPointerCapture(e.pointerId); });
  S.cv.addEventListener('pointermove', (e) => { if (!drag) return; const dx = local(e, S.cv).x - drag.x; if (Math.abs(dx) > 4) drag.moved = true; if (drag.moved) P.rot = drag.rot + dx * .4; });
  S.cv.addEventListener('pointerup', (e) => {
    const was = drag; drag = null; if (was?.moved) return;
    const p = local(e, S.cv); let best = 16, pick: Obj | null = null;
    for (const hh of hits) { const d = Math.hypot(hh.x - p.x, hh.y - p.y); if (d < best) { best = d; pick = hh.o; } }
    sel = pick; if (!sel) L.hud.textContent = ''; tick = 1;
  });
  S.cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') P.rot -= 5; else if (e.key === 'ArrowRight') P.rot += 5; else if (e.key === '+' || e.key === '=') step(60); else if (e.key === '-') step(-60); else return; e.preventDefault(); });

  /* ---------- controls ---------- */
  heading(L.panel, t('where', 'Where and when'));
  const placeSel = select(L.panel, t('place', 'Place'), PLACES.map((p) => [p[0], t('pl.' + p[0], p[1])]), P.place, (v) => { const p = PLACES.find((q) => q[0] === v)!; Object.assign(P, { place: v, lat: p[2], lon: p[3], tz: p[4] }); syncInput(); tick = 1; });
  const geo = h('button', { type: 'button', class: 'wk-b', text: t('geo', 'Use my location'), onclick: () => {
    if (!navigator.geolocation) { L.hud.textContent = t('nogeo', 'Location is not available in this browser.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => { Object.assign(P, { place: 'me', lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), tz: Intl.DateTimeFormat().resolvedOptions().timeZone }); syncInput(); tick = 1; L.hud.textContent = t('geook', 'Using your location. It stays on this device.'); },
      () => { L.hud.textContent = t('geono', 'Location was not shared, so a city is used.'); }, { timeout: 8000 });
  } });
  L.panel.append(h('div', { class: 'wk-row' }, geo));
  const dtIn = h('input', { type: 'datetime-local', 'aria-label': t('dt', 'Date and time at that place') }) as HTMLInputElement;
  dtIn.addEventListener('change', () => {
    const [d, tm] = dtIn.value.split('T'); if (!d || !tm) return; const [Y, M, Dd] = d.split('-').map(Number), [hh, mm] = tm.split(':').map(Number);
    const guess = Date.UTC(Y, M - 1, Dd, hh, mm); P.ms = guess - tzOff(guess, P.tz) * 60000; P.ms = guess - tzOff(P.ms, P.tz) * 60000; tick = 1;
  });
  L.panel.append(h('label', { class: 'wk-l' }, h('span', { text: t('dt', 'Date and time at that place') }), dtIn));
  function syncInput() { if (document.activeElement !== dtIn) dtIn.value = fmtLocal(P.ms); }
  const step = (min: number) => { P.ms += min * 60000; syncInput(); tick = 1; };
  L.panel.append(h('div', { class: 'wk-row' },
    h('button', { type: 'button', class: 'wk-b', text: t('now', 'Now'), onclick: () => { P.ms = Date.now(); syncInput(); tick = 1; } }),
    h('button', { type: 'button', class: 'wk-b', text: '−1 h', onclick: () => step(-60) }),
    h('button', { type: 'button', class: 'wk-b', text: '+1 h', onclick: () => step(60) }),
    h('button', { type: 'button', class: 'wk-b', text: t('tonight', 'Tonight 22:00'), onclick: () => { const v = fmtLocal(P.ms).slice(0, 10) + 'T22:00'; dtIn.value = v; dtIn.dispatchEvent(new Event('change')); syncInput(); } })));
  seg(L.panel, t('speed', 'Time-lapse'), [['0', t('sp0', 'Paused')], ['1', t('sp1', '1 min/s')], ['10', t('sp10', '10 min/s')], ['60', t('sp60', '1 h/s')]], '0', (v) => { P.speed = +v * (ctx.calm ? .5 : 1); });
  heading(L.panel, t('showh', 'Show'));
  check(L.panel, t('lines', 'Constellation lines'), P.lines, (v) => { P.lines = v; });
  check(L.panel, t('names', 'Names'), P.names, (v) => { P.names = v; });
  check(L.panel, t('eclip', 'Ecliptic (path of Sun and planets)'), P.ecl, (v) => { P.ecl = v; });
  check(L.panel, t('grid', 'Altitude rings (30°, 60°)'), P.grid, (v) => { P.grid = v; });
  seg(L.panel, t('lp', 'Sky darkness'), [['2.5', t('lp.city', 'Big city')], ['4', t('lp.sub', 'Suburb')], ['5', t('lp.dark', 'Dark site')]], '5', (v) => { P.limit = +v; });
  note(L.panel, t('how', 'Centre = straight overhead, edge = horizon; east is on the left because you are looking up. Star positions are from the Hipparcos catalogue (J2000, via d3-celestial, BSD licence); the Sun, Moon and planets are computed here from published formulas and are good to well under a degree, plenty for finding them by eye. Times follow the place\'s own time zone, including daylight saving.'));
  void placeSel;
  syncInput();
  loop(ctx, S.cv, draw);
}
