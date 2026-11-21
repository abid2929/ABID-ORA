/* 065 World Explorer. A live map of the real Earth (Natural Earth 1:110m coastlines, public domain) that you
   can view three ways: a globe you spin, the Mercator map and the Equal Earth map (2018). On top of it:
   · day and night for this very minute (or any date and hour), from the Sun's position computed in the browser;
   · the shortest route between two cities (a great circle) with distance, compass heading, a rough flight
     time and the local clock and day length at each end;
   · Tissot circles: identical 600 km circles placed around the world, which show how each map stretches
     and squeezes the planet. Nothing is fetched from the network. */
import { type Ctx, h, layout, canvas, heading, note, seg, select, range, check, stats, local, loop, clamp } from './kit';
import { LAND110 } from './land110';

import { RAD, DEG, R_EARTH, haversine, bearing, destination, greatCircle, sun, sunAlt, dayLength, CITIES } from './geo';
export { R_EARTH, haversine, bearing, destination, greatCircle, sun, sunAlt, dayLength, CITIES };

/* ---------- map projections (x right, y up, unit sphere) ---------- */
export type Proj = 'globe' | 'mercator' | 'equalearth';
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
export function eeFwd(lo: number, la: number): [number, number] {
  const l = lo * RAD, th = Math.asin(M * Math.sin(la * RAD)), t2 = th * th, t6 = t2 * t2 * t2;
  return [l * Math.cos(th) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
}
export function eeInv(x: number, y: number): [number, number] | null {
  let th = y; for (let i = 0; i < 12; i++) { const t2 = th * th, t6 = t2 * t2 * t2, fy = th * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y, fpy = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2), d = fy / fpy; th -= d; if (Math.abs(d) < 1e-9) break; }
  const t2 = th * th, t6 = t2 * t2 * t2;
  if (Math.abs(th) > Math.PI / 3 + 1e-9) return null;
  const l = M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)) / Math.cos(th);
  if (Math.abs(l) > Math.PI + 1e-9) return null;
  return [l * DEG, Math.asin(clamp(Math.sin(th) / M, -1, 1)) * DEG];
}
export function orthoFwd(lo: number, la: number, l0: number, p0: number): [number, number] | null {
  const p = la * RAD, dl = (lo - l0) * RAD, q = p0 * RAD, cc = Math.sin(q) * Math.sin(p) + Math.cos(q) * Math.cos(p) * Math.cos(dl);
  if (cc < 0) return null;
  return [Math.cos(p) * Math.sin(dl), Math.cos(q) * Math.sin(p) - Math.sin(q) * Math.cos(p) * Math.cos(dl)];
}
export function orthoInv(x: number, y: number, l0: number, p0: number): [number, number] | null {
  const r = Math.hypot(x, y); if (r > 1) return null; if (r < 1e-12) return [l0, p0];
  const c = Math.asin(r), q = p0 * RAD, la = Math.asin(Math.cos(c) * Math.sin(q) + y * Math.sin(c) * Math.cos(q) / r);
  const lo = l0 * RAD + Math.atan2(x * Math.sin(c), r * Math.cos(c) * Math.cos(q) - y * Math.sin(c) * Math.sin(q));
  return [((lo * DEG + 540) % 360) - 180, la * DEG];
}
export const MERC_MAX = 85.05113;
export const wrap = (lo: number) => ((((lo + 180) % 360) + 360) % 360) - 180;

/* ---------- land ---------- */
export function decodeLand(s = LAND110): [number, number][][] {
  return s.split(';').map((r) => { const v = r.split(',').map(Number), o: [number, number][] = []; let x = 0, y = 0; for (let i = 0; i < v.length; i += 2) { x += v[i]; y += v[i + 1]; o.push([x / 10, y / 10]); } return o; });
}

/** make each ring's longitudes continuous across ±180°; rings that wrap the globe are closed via the nearer pole */
export function unwrapRings(rings: [number, number][][]): [number, number][][] {
  return rings.map((r) => {
    const o: [number, number][] = []; let shift = 0;
    r.forEach(([lo, la], i) => { if (i) { const d = lo - r[i - 1][0]; if (d > 180) shift -= 360; else if (d < -180) shift += 360; } o.push([lo + shift, la]); });
    const span = o[o.length - 1][0] - o[0][0];
    if (Math.abs(span) > 180) { const pole = o.reduce((s, p) => s + p[1], 0) < 0 ? -90 : 90; o.push([o[o.length - 1][0], pole], [o[0][0], pole]); }
    return o;
  });
}

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.classList.add('w65');
  L.view.style.minHeight = 'clamp(420px, 58vw, 640px)';
  const S = canvas(L.view, t('cv', 'A map of the Earth with day and night, city routes and distortion circles. Drag to turn it; click a city to choose it.'), { alpha: false });
  const C = { space: '#05070d', sea: [18, 52, 86], land: [196, 178, 128], ice: [226, 232, 238], route: '#ff5d73', grid: 'rgba(255,255,255,.14)', city: '#ffe9a8', tissot: 'rgba(120,220,255,.35)' };
  const rings = decodeLand();

  /* rasterise the land once into an equirectangular mask */
  const MW = 1440, MH = 720, mask = new Uint8Array(MW * MH);
  {
    const oc = document.createElement('canvas'); oc.width = MW; oc.height = MH; const g = oc.getContext('2d');
    if (g) {
      g.fillStyle = '#000'; g.fillRect(0, 0, MW, MH); g.fillStyle = '#fff'; g.beginPath();
      /* rings that cross the 180° line are unwrapped into continuous longitudes and drawn three times (shifted by ±360°), so nothing
         streaks across the map; a ring around a pole is closed along that pole */
      for (const r of unwrapRings(rings)) for (const off of [-360, 0, 360]) r.forEach(([lo, la], i) => { const x = (lo + off + 180) / 360 * MW, y = (90 - la) / 180 * MH; if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.fill('evenodd');
      const d = g.getImageData(0, 0, MW, MH).data; for (let i = 0; i < MW * MH; i++) mask[i] = d[i * 4] > 127 ? 1 : 0;
    }
  }
  const isLand = (lo: number, la: number) => mask[clamp(Math.floor((90 - la) / 180 * MH), 0, MH - 1) * MW + clamp(Math.floor((lo + 180) / 360 * MW), 0, MW - 1)] === 1;

  type Cfg = { proj: Proj; a: number; b: number; live: boolean; day: number; hour: number; tissot: boolean; grid: boolean };
  const now0 = new Date(), doy0 = Math.floor((now0.getTime() - Date.UTC(now0.getUTCFullYear(), 0, 1)) / 86400000);
  const cfg: Cfg = { proj: 'globe', a: 0, b: 2, live: true, day: doy0, hour: now0.getUTCHours(), tissot: false, grid: true };
  let l0 = 90, p0 = 20, mL0 = 0; /* globe centre; map centre longitude */

  heading(L.panel, t('h', 'Explore'));
  seg(L.panel, t('view', 'View'), [['globe', t('v.globe', 'Globe')], ['mercator', t('v.merc', 'Mercator')], ['equalearth', t('v.ee', 'Equal Earth')]], cfg.proj, (v) => { cfg.proj = v as Proj; about(); dirty = true; lp.play(); });
  const ab = note(L.panel, '');
  const about = () => { ab.textContent = cfg.proj === 'globe' ? t('a.globe', 'The globe is the only view without distortion, but you can see just half the world at once. Drag to spin it.') : cfg.proj === 'mercator' ? t('a.merc', 'Mercator (1569) keeps compass directions true, which made it the sailors\' map, but it blows up areas towards the poles: Greenland looks as big as Africa, which is in fact about 14 times larger. Turn on the circles to see it.') : t('a.ee', 'Equal Earth (2018) keeps every area in its true proportion, so Africa looks as big as it really is, at the cost of some bending of shapes near the edges.'); };
  about();
  const opts = CITIES.map((c, i) => [String(i), c[0]] as [string, string]);
  const selA = select(L.panel, t('from', 'From'), opts, String(cfg.a), (v) => { cfg.a = +v; focus(); });
  const selB = select(L.panel, t('to', 'To'), opts, String(cfg.b), (v) => { cfg.b = +v; focus(); });
  const liveC = check(L.panel, t('live', 'Live: the Sun right now'), cfg.live, (v) => { cfg.live = v; if (v) syncNow(); dirty = true; refresh(); });
  const dayR = range(L.panel, t('date', 'Date'), { min: 0, max: 364, value: cfg.day, fmt: (v) => new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1 + v)).toLocaleDateString(ctx.lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }) }, (v) => { cfg.day = v; cfg.live = false; liveC.checked = false; dirty = true; refresh(); });
  const hourR = range(L.panel, t('hour', 'Hour (UTC)'), { min: 0, max: 23.75, step: .25, value: cfg.hour, fmt: (v) => `${String(Math.floor(v)).padStart(2, '0')}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}` }, (v) => { cfg.hour = v; cfg.live = false; liveC.checked = false; dirty = true; refresh(); });
  check(L.panel, t('tissot', 'Show 600 km circles (distortion)'), cfg.tissot, (v) => { cfg.tissot = v; lp.play(); });
  check(L.panel, t('grid', 'Show latitude and longitude lines'), cfg.grid, (v) => { cfg.grid = v; lp.play(); });
  const out = stats(L.panel, [['d', t('st.d', 'Distance')], ['b', t('st.b', 'Start heading')], ['f', t('st.f', 'Rough flight time')], ['ta', '—'], ['tb', '—'], ['sun', t('st.sun', 'Sun now')]]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  note(L.panel, t('foot', 'Coastlines: Natural Earth 1:110m (public domain). Flight time is distance ÷ 850 km/h + 30 minutes, a rough guide only; real routes follow winds and airways.'));

  function syncNow() { const n = new Date(); cfg.day = Math.min(364, Math.floor((n.getTime() - Date.UTC(n.getUTCFullYear(), 0, 1)) / 86400000)); cfg.hour = n.getUTCHours() + n.getUTCMinutes() / 60; dayR.set(cfg.day); hourR.set(Math.round(cfg.hour * 4) / 4); }
  const when = () => (cfg.live ? new Date() : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1 + cfg.day) + cfg.hour * 3600000));
  function focus() { const A = CITIES[cfg.a], B = CITIES[cfg.b], mid = greatCircle(A[1], A[2], B[1], B[2], 2)[1]; l0 = mid[1]; p0 = clamp(mid[0], -60, 60); mL0 = 0; dirty = true; refresh(); }
  /** redraw, and update the numbers at once even if the map is scrolled out of view (the frame loop pauses off screen) */
  function refresh() { sunNow = sun(when()); stats_(); lp.play(); }

  /* ---------- geometry for the current view ---------- */
  const geo = () => {
    const W = S.w, H = S.h;
    if (cfg.proj === 'globe') { const r = Math.min(W, H) * .46; return { cx: W / 2, cy: H / 2, s: r }; }
    if (cfg.proj === 'mercator') { const ymax = Math.log(Math.tan(Math.PI / 4 + MERC_MAX * RAD / 2)), s = Math.min(W / (2 * Math.PI), H / (2 * ymax)) * .96; return { cx: W / 2, cy: H / 2, s }; }
    const ex = eeFwd(180, 0)[0], ey = eeFwd(0, 90)[1], s = Math.min(W / (2 * ex), H / (2 * ey)) * .94; return { cx: W / 2, cy: H / 2, s };
  };
  /** lon/lat → screen, or null when hidden */
  function fwd(lo: number, la: number): [number, number] | null {
    const G = geo();
    if (cfg.proj === 'globe') { const p = orthoFwd(lo, la, l0, p0); return p ? [G.cx + p[0] * G.s, G.cy - p[1] * G.s] : null; }
    const l = wrap(lo - mL0);
    if (cfg.proj === 'mercator') { const q = clamp(la, -MERC_MAX, MERC_MAX) * RAD; return [G.cx + l * RAD * G.s, G.cy - Math.log(Math.tan(Math.PI / 4 + q / 2)) * G.s]; }
    const p = eeFwd(l, la); return [G.cx + p[0] * G.s, G.cy - p[1] * G.s];
  }
  function inv(x: number, y: number): [number, number] | null {
    const G = geo(), u = (x - G.cx) / G.s, v = (G.cy - y) / G.s;
    if (cfg.proj === 'globe') return orthoInv(u, v, l0, p0);
    if (cfg.proj === 'mercator') { if (Math.abs(u) > Math.PI) return null; const la = (2 * Math.atan(Math.exp(v)) - Math.PI / 2) * DEG; if (Math.abs(la) > MERC_MAX) return null; return [wrap(u * DEG + mL0), la]; }
    const r = eeInv(u, v); return r ? [wrap(r[0] + mL0), r[1]] : null;
  }

  /* ---------- raster: land, sea and night ---------- */
  let dirty = true, img: ImageData | null = null; const rc = document.createElement('canvas'); let sunNow = sun(new Date());
  function raster() {
    const k = Math.min(1, (drag?.moved ? 380 : 900) / Math.max(S.w, 1)) /* coarse while dragging, sharp when still */, w = Math.max(2, Math.round(S.w * k)), hh = Math.max(2, Math.round(S.h * k));
    rc.width = w; rc.height = hh; const g = rc.getContext('2d'); if (!g) return;
    img = g.createImageData(w, hh); const d = img.data, s = sunNow;
    const sd = Math.sin(s.dec * RAD), cd = Math.cos(s.dec * RAD);
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4, ll = inv((i + .5) / k, (j + .5) / k);
      if (!ll) { d[o] = 5; d[o + 1] = 7; d[o + 2] = 13; d[o + 3] = 255; continue; }
      const [lo, la] = ll, land = isLand(lo, la), base = land ? (la < -60 || la > 72 ? C.ice : C.land) : C.sea;
      const alt = Math.asin(clamp(Math.sin(la * RAD) * sd + Math.cos(la * RAD) * cd * Math.cos((lo - s.lon) * RAD), -1, 1)) * DEG;
      const light = alt > 0 ? 1 : alt < -12 ? .22 : .22 + .78 * (1 + alt / 12) ** 1.6; /* full night past nautical twilight */
      let r = base[0] * light, gg = base[1] * light, b = base[2] * light;
      if (alt < -6 && land) { const city = .12 * (1 - light); r += 255 * city * .3; gg += 200 * city * .3; b += 120 * city * .2; } /* faint warm tint on land at night */
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    }
    g.putImageData(img, 0, 0); dirty = false;
  }

  /* ---------- vector overlay ---------- */
  function path(g: CanvasRenderingContext2D, pts: [number, number][]) {
    let prev: [number, number] | null = null; g.beginPath();
    for (const [la, lo] of pts) { const p = fwd(lo, la); if (!p) { prev = null; continue; } if (prev && Math.abs(p[0] - prev[0]) < S.w * .5) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); prev = p; }
    g.stroke();
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h;
    sunNow = sun(when());
    if (dirty || !img) raster();
    g.fillStyle = C.space; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true; g.drawImage(rc, 0, 0, W, H);
    const G = geo();
    if (cfg.proj === 'globe') { const gr = g.createRadialGradient(G.cx - G.s * .3, G.cy - G.s * .3, G.s * .1, G.cx, G.cy, G.s * 1.05); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(1, 'rgba(120,180,255,.18)'); g.fillStyle = gr; g.beginPath(); g.arc(G.cx, G.cy, G.s, 0, 7); g.fill(); g.strokeStyle = 'rgba(140,200,255,.5)'; g.lineWidth = 1.5; g.stroke(); }
    if (cfg.grid) {
      g.strokeStyle = C.grid; g.lineWidth = 1;
      for (let lo = -180; lo < 180; lo += 30) path(g, Array.from({ length: 61 }, (_, i) => [-90 + i * 3, lo] as [number, number]));
      for (let la = -60; la <= 60; la += 30) path(g, Array.from({ length: 121 }, (_, i) => [la, -180 + i * 3] as [number, number]));
      g.strokeStyle = 'rgba(255,209,102,.35)'; path(g, Array.from({ length: 121 }, (_, i) => [0, -180 + i * 3] as [number, number]));
    }
    if (cfg.tissot) {
      g.fillStyle = C.tissot; g.strokeStyle = 'rgba(160,230,255,.7)';
      for (let la = -75; la <= 75; la += 25) for (let lo = -165; lo < 180; lo += 30) {
        const ring = Array.from({ length: 37 }, (_, i) => destination(la, lo, i * 10, 600));
        let ok = true; const ps: [number, number][] = []; for (const [a, b] of ring) { const p = fwd(b, a); if (!p) { ok = false; break; } ps.push(p); }
        if (!ok) continue; let span = 0; for (const p of ps) span = Math.max(span, Math.abs(p[0] - ps[0][0])); if (span > W * .5) continue;
        g.beginPath(); ps.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); g.fill(); g.stroke();
      }
    }
    /* route */
    const A = CITIES[cfg.a], B = CITIES[cfg.b];
    const gc = greatCircle(A[1], A[2], B[1], B[2], 160);
    g.strokeStyle = C.route; g.lineWidth = 2.5; g.setLineDash([]); path(g, gc); g.lineWidth = 1;
    /* sun */
    const sp = fwd(sunNow.lon, sunNow.dec); if (sp) { g.fillStyle = '#ffd166'; g.shadowColor = '#ffd166'; g.shadowBlur = 16; g.beginPath(); g.arc(sp[0], sp[1], 7, 0, 7); g.fill(); g.shadowBlur = 0; }
    /* cities */
    g.font = '11px ui-sans-serif, system-ui';
    CITIES.forEach((c, i) => {
      const p = fwd(c[2], c[1]); if (!p) return; const sel = i === cfg.a || i === cfg.b;
      g.fillStyle = sel ? C.route : C.city; g.beginPath(); g.arc(p[0], p[1], sel ? 5 : 2.6, 0, 7); g.fill();
      if (sel || W > 700) { g.fillStyle = sel ? '#fff' : 'rgba(255,240,210,.75)'; g.font = sel ? '600 13px ui-sans-serif, system-ui' : '10.5px ui-sans-serif, system-ui'; g.fillText(c[0], p[0] + 7, p[1] - 6); }
    });
    stats_();
  }
  const fmtTime = (tz: string, d: Date) => { try { return d.toLocaleTimeString(ctx.lang, { hour: '2-digit', minute: '2-digit', timeZone: tz }); } catch { return '—'; } };
  function stats_() {
    const A = CITIES[cfg.a], B = CITIES[cfg.b], d = haversine(A[1], A[2], B[1], B[2]), w = when();
    const km = new Intl.NumberFormat(ctx.lang, { maximumFractionDigits: 0 });
    out('d', `${km.format(d)} km · ${km.format(d * 0.621371)} mi`);
    out('b', `${Math.round(bearing(A[1], A[2], B[1], B[2]))}°`);
    const ft = d < 1 ? 0 : d / 850 + .5; out('f', d < 1 ? '—' : `${Math.floor(ft)} h ${String(Math.round((ft % 1) * 60)).padStart(2, '0')} min`);
    const dl = (c: typeof A) => { const v = dayLength(c[1], sunNow.dec); return v === 0 ? t('polarN', 'polar night') : v === 24 ? t('polarD', 'midnight sun') : `${Math.floor(v)} h ${String(Math.round((v % 1) * 60)).padStart(2, '0')}`; };
    dts[3].textContent = `${A[0]}`; dts[4].textContent = `${B[0]}`;
    out('ta', `${fmtTime(A[3], w)} · ${t('daylight', 'daylight')} ${dl(A)}`); out('tb', `${fmtTime(B[3], w)} · ${t('daylight', 'daylight')} ${dl(B)}`);
    const alt = sunAlt(A[1], A[2], sunNow); out('sun', `${A[0]}: ${alt > 0 ? t('up', 'up') : t('down', 'below horizon')} ${Math.round(alt)}°`);
  }

  /* ---------- interaction ---------- */
  let drag: { x: number; y: number; l0: number; p0: number; m: number; moved: boolean } | null = null, pick = 0;
  S.cv.style.touchAction = 'none'; S.cv.style.cursor = 'grab';
  S.cv.addEventListener('pointerdown', (e) => { const p = local(e, S.cv); S.cv.setPointerCapture(e.pointerId); drag = { x: p.x, y: p.y, l0, p0, m: mL0, moved: false }; S.cv.style.cursor = 'grabbing'; });
  S.cv.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = local(e, S.cv), dx = p.x - drag.x, dy = p.y - drag.y; if (Math.hypot(dx, dy) > 4) drag.moved = true; if (!drag.moved) return;
    const G = geo();
    if (cfg.proj === 'globe') { l0 = wrap(drag.l0 - dx / G.s * DEG); p0 = clamp(drag.p0 + dy / G.s * DEG, -85, 85); }
    else mL0 = wrap(drag.m - dx / G.s * DEG);
    dirty = true; lp.play();
  });
  const up = (e: PointerEvent) => {
    if (!drag) return; const was = drag; drag = null; S.cv.style.cursor = 'grab'; if (was.moved) { dirty = true; lp.play(); return; }
    const p = local(e, S.cv); let best = -1, bd = 22;
    CITIES.forEach((c, i) => { const q = fwd(c[2], c[1]); if (!q) return; const d = Math.hypot(q[0] - p.x, q[1] - p.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0) { const ll = inv(p.x, p.y); L.hud.textContent = ll ? `${Math.abs(ll[1]).toFixed(1)}° ${ll[1] >= 0 ? t('N', 'N') : t('S', 'S')}, ${Math.abs(ll[0]).toFixed(1)}° ${ll[0] >= 0 ? t('E', 'E') : t('W', 'W')} · ${isLand(ll[0], ll[1]) ? t('land', 'land') : t('sea', 'sea')} · ${t('sunalt', 'Sun')} ${Math.round(sunAlt(ll[1], ll[0], sunNow))}°` : ''; return; }
    if (pick === 0) { cfg.a = best; selA.value = String(best); } else { cfg.b = best; selB.value = String(best); }
    pick = 1 - pick; L.hud.textContent = `${t('picked', 'Chosen')}: ${CITIES[best][0]} (${pick === 1 ? t('nextTo', 'next click sets “To”') : t('nextFrom', 'next click sets “From”')})`; refresh();
  };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', () => { drag = null; });
  S.onResize(() => { dirty = true; lp.play(); });

  let liveTimer = 0; ctx.onDispose(() => clearTimeout(liveTimer));
  const lp = loop(ctx, S.cv, () => { /* in live mode the picture refreshes every 30 s; the night edge moves about 0.25° a minute */
    draw();
    if (!drag && !cfg.live) lp.pause();
    else if (!drag && cfg.live) { lp.pause(); clearTimeout(liveTimer); liveTimer = window.setTimeout(() => { dirty = true; lp.play(); }, 30000); }
  });
  focus();
}
