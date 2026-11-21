/* 034 Natural Wonders: Aurora Watch. Will you see the northern (or southern) lights tonight?
   Pick a place and a geomagnetic storm level (Kp). The world converts your position to geomagnetic
   latitude, places the auroral oval for that Kp, works out how far away the glowing curtains are
   and how high above your horizon they rise (from their real 100–400 km altitude and the curve of
   the Earth), then paints the sky you would see: green oxygen light low, red high up, purple
   nitrogen fringes in strong storms. Wipe the clouds away with your finger. */
import { type Ctx, h, layout, canvas, heading, note, range, select, stats, loop, local, clamp, noise2, rng, download } from './kit';

const R = 6371, POLE_LAT = 80.8, POLE_LON = -72.7, D2R = Math.PI / 180;
/** geomagnetic (dipole) latitude in degrees */
export function magLat(lat: number, lon: number) {
  const s = Math.sin(lat * D2R) * Math.sin(POLE_LAT * D2R) + Math.cos(lat * D2R) * Math.cos(POLE_LAT * D2R) * Math.cos((lon - POLE_LON) * D2R);
  return Math.asin(clamp(s, -1, 1)) / D2R;
}
/** equatorward edge of the auroral oval (geomagnetic latitude) for a Kp index; a common rule of thumb */
export const ovalEdge = (kp: number) => 66 - 2 * kp;
/** elevation angle (deg) of a point at height h km seen from the ground at a surface distance d km */
export function elevation(dKm: number, hKm: number) {
  const th = dKm / R; return Math.atan2((R + hKm) * Math.cos(th) - R, (R + hKm) * Math.sin(th)) / D2R;
}
export const gScale = (kp: number) => kp >= 9 ? 'G5' : kp >= 8 ? 'G4' : kp >= 7 ? 'G3' : kp >= 6 ? 'G2' : kp >= 5 ? 'G1' : '';
const PLACES: [string, string, number, number][] = [
  ['tromso', 'Tromsø, Norway', 69.65, 18.96], ['fairbanks', 'Fairbanks, Alaska', 64.84, -147.72], ['reykjavik', 'Reykjavík, Iceland', 64.15, -21.94], ['yellowknife', 'Yellowknife, Canada', 62.45, -114.37],
  ['oslo', 'Oslo, Norway', 59.91, 10.75], ['edinburgh', 'Edinburgh, UK', 55.95, -3.19], ['berlin', 'Berlin, Germany', 52.52, 13.4], ['seattle', 'Seattle, USA', 47.61, -122.33], ['newyork', 'New York, USA', 40.71, -74.0],
  ['tokyo', 'Tokyo, Japan', 35.68, 139.69], ['dhaka', 'Dhaka, Bangladesh', 23.81, 90.41], ['hobart', 'Hobart, Australia', -42.88, 147.33], ['queenstown', 'Queenstown, New Zealand', -45.03, 168.66], ['ushuaia', 'Ushuaia, Argentina', -54.8, -68.3],
];

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#5dffa8');
  L.view.style.background = '#020611';
  const S = canvas(L.view, t('cv', 'Night sky toward the magnetic pole with the aurora as it would appear from the chosen place. Drag to wipe clouds away.'));
  S.cv.style.cursor = 'grab';
  const info = stats(L.panel, [['mlat', t('mlat', 'Geomagnetic latitude')], ['edge', t('edge', 'Aurora reaches down to')], ['dist', t('dist', 'Distance to the aurora')], ['elev', t('elev', 'Top above horizon')], ['verdict', t('verdict', 'Tonight')]]);
  const P = { place: 'oslo', lat: 59.91, lon: 10.75, kp: 5, cloud: 40, moon: 20 };
  const N = noise2(34), Rr = rng(5);
  const stars = Array.from({ length: 420 }, () => ({ x: Rr(), y: Rr(), m: Rr() ** 3, tw: Rr() * 6 }));
  /* cloud layer with a wipe mask that slowly heals */
  const cl = document.createElement('canvas'), cg = cl.getContext('2d')!, mask = document.createElement('canvas'), mg = mask.getContext('2d')!, layer = document.createElement('canvas'), lg = layer.getContext('2d')!;
  function makeClouds() {
    const w = 320, hh = 180; cl.width = w; cl.height = hh; const id = cg.createImageData(w, hh);
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { let v = 0, a = 1, f = 1 / 60; for (let o = 0; o < 4; o++) { v += N(x * f + 50, y * f * 1.8) * a; a *= .5; f *= 2; } const d = clamp((v - .02) * 2.4, 0, 1) ** 1.3 * .9, lit = 52 + v * 40; id.data.set([lit, lit + 6, lit + 22, d * 255], (y * w + x) * 4); }
    cg.putImageData(id, 0, 0); mask.width = w; mask.height = hh; mg.fillStyle = '#000'; mg.fillRect(0, 0, w, hh);
  }
  makeClouds();
  let geo = { m: 0, edge: 0, inside: false, dLow: 0, eLow: 0, eTop: 0, south: false, vis: 0 };
  function calc() {
    const m = magLat(P.lat, P.lon), south = m < 0, am = Math.abs(m), edge = ovalEdge(P.kp);
    /* the bright band sits a few degrees poleward of the edge; the top of the light reaches 250 km, 400 km in big storms */
    const top = P.kp >= 7 ? 400 : 250, inside = am >= edge;
    const dLow = inside ? 0 : (edge - am) * 111.2;
    const eLow = inside ? 90 : elevation(dLow, 100), eTop = inside ? 90 : elevation(dLow, top);
    geo = { m, edge, inside, dLow, eLow, eTop, south, vis: inside ? 1 : clamp((eTop + 2) / 20, 0, 1) };
    info('mlat', `${m.toFixed(1)}°`); info('edge', `${edge.toFixed(0)}° ${t('mag', 'magnetic')}`); info('dist', inside ? t('over', 'overhead') : `${Math.round(dLow).toLocaleString(ctx.lang)} km`);
    info('elev', inside ? '90°' : eTop < 0 ? t('below', 'below horizon') : `${eTop.toFixed(0)}°`);
    const v = inside ? t('v.over', 'Overhead: look straight up') : eTop > 25 ? t('v.high', 'High in the sky') : eTop > 5 ? t('v.low', 'Low on the horizon') : eTop > 0 ? t('v.cam', 'Faint glow, maybe only on camera') : t('v.no', 'Not visible from here');
    info('verdict', v);
    L.hud.textContent = `${gScale(P.kp) ? gScale(P.kp) + ' · ' : ''}Kp ${P.kp} · ${t('facing', 'facing')} ${south ? t('south', 'south') : t('north', 'north')}${P.cloud > 70 ? ' · ' + t('cloudy', 'too cloudy: wipe the clouds') : ''}`;
  }
  let time = 0, wipe = false;
  function draw(dt: number) {
    time += dt * (ctx.calm ? .25 : 1);
    const g = S.g, W = S.w, H = S.h, hz = H * .8;
    /* sky: darker with no moon, deep blue near the horizon */
    const sky = g.createLinearGradient(0, 0, 0, hz); const mb = P.moon / 100;
    sky.addColorStop(0, `rgb(${2 + mb * 10},${4 + mb * 16},${12 + mb * 34})`); sky.addColorStop(1, `rgb(${8 + mb * 30},${14 + mb * 40},${34 + mb * 60})`);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (const s of stars) { const a = (.25 + s.m * .75) * (1 - mb * .7) * (.75 + .25 * Math.sin(time * 2 + s.tw)); g.fillStyle = `rgba(230,240,255,${a})`; g.fillRect(s.x * W, s.y * hz, 1 + s.m * 1.4, 1 + s.m * 1.4); }
    /* aurora curtains: elevation → screen height (0° at horizon, 90° at the top edge) */
    const yE = (e: number) => hz - clamp(e, -5, 90) / 90 * hz * 1.05;
    const I = geo.vis * clamp(.35 + P.kp / 9, 0, 1.2);
    if (I > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const cols = Math.ceil(W / 3);
      for (let i = 0; i < cols; i++) {
        const x = i * 3, u = x / W;
        /* folds in the curtain move the lower edge nearer and farther */
        const fold = N(u * 3 + time * .05, time * .08) * 1.6 + N(u * 9 - time * .15, 3) * .6;
        const dl = Math.max(0, geo.dLow + fold * 90 - (geo.inside ? 0 : 0)), el = geo.inside ? 14 + fold * 9 : elevation(dl, 100), et = geo.inside ? 90 : elevation(dl, P.kp >= 7 ? 400 : 250);
        const ray = Math.max(0, N(u * 40 + time * .6, time * .3) * .9 + .35) * (.6 + .4 * Math.sin(u * 30 + time * 1.3 + fold));
        const a = clamp(ray * I, 0, 1); if (a < .02 || et < -2) continue;
        const y0 = yE(el), y1 = yE(et), gr = g.createLinearGradient(0, y0, 0, y1);
        if (P.kp >= 7) gr.addColorStop(0, `rgba(190,80,255,${a * .5})`);
        gr.addColorStop(P.kp >= 7 ? .06 : 0, `rgba(90,255,150,${a * .9})`); gr.addColorStop(.45, `rgba(70,230,140,${a * .45})`);
        gr.addColorStop(.75, `rgba(255,70,90,${a * (P.kp >= 6 ? .35 : .12)})`); gr.addColorStop(1, 'rgba(255,40,80,0)');
        g.fillStyle = gr; g.fillRect(x, Math.min(y0, y1), 3, Math.abs(y0 - y1) + 2);
        /* soft lower fringe so the curtain hem fades instead of ending in a hard line */
        const fr = g.createLinearGradient(0, y0, 0, y0 + 46); fr.addColorStop(0, `rgba(90,255,150,${a * .55})`); fr.addColorStop(1, 'rgba(90,255,150,0)'); g.fillStyle = fr; g.fillRect(x, y0, 3, 46);
      }
      /* diffuse glow near the horizon */
      const gl = g.createLinearGradient(0, hz - 120, 0, hz); gl.addColorStop(0, 'rgba(60,255,140,0)'); gl.addColorStop(1, `rgba(60,255,140,${.18 * I})`); g.fillStyle = gl; g.fillRect(0, hz - 120, W, 120);
      g.restore();
    }
    /* clouds, minus the wiped mask */
    if (P.cloud > 0) {
      g.save(); g.globalAlpha = P.cloud / 100; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      const off = (time * 6) % W;
      layer.width = cl.width; layer.height = cl.height;
      lg.drawImage(cl, 0, 0); lg.globalCompositeOperation = 'destination-in'; lg.drawImage(mask, 0, 0); lg.globalCompositeOperation = 'source-over';
      g.drawImage(layer, -off, 0, W, hz); g.drawImage(layer, W - off, 0, W, hz); g.restore();
      mg.globalCompositeOperation = 'source-over'; mg.fillStyle = `rgba(0,0,0,${dt * .08})`; mg.fillRect(0, 0, mask.width, mask.height);
    }
    /* land silhouette */
    g.fillStyle = '#01030a'; g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) { const u = x / W; g.lineTo(x, hz - 18 - N(u * 4, 9) * 40 - Math.max(0, N(u * 22, 2)) * 22); }
    g.lineTo(W, H); g.closePath(); g.fill();
    drawMini(g, W);
    g.fillStyle = 'rgba(200,255,220,.7)'; g.font = '11px ui-monospace,monospace'; g.textAlign = 'center';
    for (const e of [10, 30, 60]) { const y = yE(e); g.fillRect(W - 24, y, 8, 1); g.textAlign = 'right'; g.fillText(e + '°', W - 28, y + 4); }
    g.textAlign = 'center'; g.fillText(geo.south ? 'S' : 'N', W / 2, hz + 30); g.textAlign = 'left';
  }
  /* inset: polar view of the auroral oval and you */
  function drawMini(g: CanvasRenderingContext2D, W: number) {
    const r = Math.min(64, W * .11), cx = 18 + r, cy = S.h - r - 64;
    g.fillStyle = 'rgba(2,8,20,.75)'; g.beginPath(); g.arc(cx, cy, r + 6, 0, 7); g.fill();
    const rr = (lat: number) => (90 - lat) / 60 * r;
    g.strokeStyle = 'rgba(160,200,255,.25)'; g.lineWidth = 1; for (const l of [40, 60, 80]) { g.beginPath(); g.arc(cx, cy, rr(l), 0, 7); g.stroke(); }
    const e = geo.edge; g.strokeStyle = 'rgba(90,255,150,.7)'; g.lineWidth = Math.max(2, rr(e) - rr(e + 6)); g.beginPath(); g.arc(cx, cy, (rr(e) + rr(e + 6)) / 2, 0, 7); g.stroke();
    const am = Math.abs(geo.m); g.fillStyle = '#ffd36e'; g.beginPath(); g.arc(cx, cy + rr(Math.max(30, am)), 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(220,240,255,.75)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'center'; g.fillText(t('you', 'you'), cx, cy + rr(Math.max(30, am)) + 14); g.fillText(geo.south ? t('spole', 'S magnetic pole') : t('npole', 'N magnetic pole'), cx, cy - r - 10); g.textAlign = 'left';
  }
  const doWipe = (e: PointerEvent) => { const p = local(e, S.cv), x = ((p.x + (time * 6) % S.w) % S.w) / S.w * mask.width, y = p.y / (S.h * .8) * mask.height; mg.globalCompositeOperation = 'destination-out'; const gr = mg.createRadialGradient(x, y, 0, x, y, 22); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); mg.fillStyle = gr; mg.beginPath(); mg.arc(x, y, 22, 0, 7); mg.fill(); };
  S.cv.addEventListener('pointerdown', (e) => { wipe = true; S.cv.setPointerCapture(e.pointerId); doWipe(e); });
  S.cv.addEventListener('pointermove', (e) => { if (wipe) doWipe(e); });
  S.cv.addEventListener('pointerup', () => { wipe = false; });
  loop(ctx, S.cv, draw);

  heading(L.panel, t('where', 'Where are you?'));
  const sel = select(L.panel, t('place', 'Place'), [...PLACES.map(([id, en]) => [id, t('p.' + id, en)] as [string, string]), ['custom', t('custom', 'My own coordinates')]], P.place, (v) => {
    P.place = v; const pl = PLACES.find((q) => q[0] === v); if (pl) { P.lat = pl[2]; P.lon = pl[3]; la.set(P.lat); lo.set(P.lon); } calc();
  });
  const la = range(L.panel, t('lat', 'Latitude'), { min: -70, max: 75, step: .1, value: P.lat, fmt: (n) => `${Math.abs(n).toFixed(1)}° ${n >= 0 ? 'N' : 'S'}` }, (v) => { P.lat = v; P.place = 'custom'; sel.value = 'custom'; calc(); });
  const lo = range(L.panel, t('lon', 'Longitude'), { min: -180, max: 180, step: .1, value: P.lon, fmt: (n) => `${Math.abs(n).toFixed(1)}° ${n >= 0 ? 'E' : 'W'}` }, (v) => { P.lon = v; P.place = 'custom'; sel.value = 'custom'; calc(); });
  const geoBtn = h('button', { type: 'button', class: 'wk-b', text: t('locate', 'Use my location'), onclick: () => {
    if (!navigator.geolocation) { L.hud.textContent = t('nogeo', 'Location is not available in this browser'); return; }
    navigator.geolocation.getCurrentPosition((p) => { P.lat = +p.coords.latitude.toFixed(1); P.lon = +p.coords.longitude.toFixed(1); la.set(P.lat); lo.set(P.lon); sel.value = 'custom'; calc(); }, () => { L.hud.textContent = t('geodeny', 'Location was not shared'); }, { maximumAge: 600000, timeout: 10000 });
  } });
  L.panel.append(h('div', { class: 'wk-row' }, geoBtn));
  heading(L.panel, t('tonight', 'Tonight'));
  range(L.panel, t('kp', 'Geomagnetic activity (Kp)'), { min: 0, max: 9, value: P.kp, fmt: (n) => `${n}${gScale(n) ? ' · ' + gScale(n) : ''}` }, (v) => { P.kp = v; calc(); });
  range(L.panel, t('cloud', 'Cloud cover'), { min: 0, max: 100, step: 5, value: P.cloud, fmt: (n) => n + ' %' }, (v) => { P.cloud = v; });
  range(L.panel, t('moon', 'Moonlight'), { min: 0, max: 100, step: 5, value: P.moon, fmt: (n) => n + ' %' }, (v) => { P.moon = v; });
  L.panel.append(h('div', { class: 'wk-row' }, h('button', { type: 'button', class: 'wk-b', text: t('clear', 'Clear all clouds'), onclick: () => { mg.globalCompositeOperation = 'source-over'; mg.clearRect(0, 0, mask.width, mask.height); } }), h('button', { type: 'button', class: 'wk-b pri', text: t('save', 'Save the sky (PNG)'), onclick: () => download(S.cv, 'abidora-aurora.png') })));
  note(L.panel, t('how', 'Aurora forms 100–400 km up, in a ring around each magnetic pole. When the Sun\'s storms push Kp higher the ring widens toward the equator. Because the light is so high, you can see it on your horizon from several hundred kilometres away. Green comes from oxygen around 100–250 km, red from oxygen higher up, and purple-blue edges from nitrogen in strong storms.'));
  note(L.panel, t('src', 'Magnetic latitude uses a tilted-dipole model (pole near 80.8° N, 72.7° W); the oval edge uses the rule of thumb 66° − 2 × Kp. Real forecasts (for example NOAA SWPC) use live satellite data; this world shows the geometry, not a forecast. Your location is only used on this device.'));
  calc();
}
