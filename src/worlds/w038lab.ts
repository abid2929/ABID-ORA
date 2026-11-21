/* 038 Planet Universe: Planet Lab. Pick a star, an orbit, a mass and a size, and the planet is worked
   out from real physics: surface gravity, your weight there, escape speed, the length of its year,
   its temperature, whether it sits in the star's habitable zone, and which gases it can hold on to
   for billions of years (a gas stays when the escape speed is more than six times the typical speed
   of its molecules). The planet is drawn from those numbers (ice, oceans, desert, lava or gas bands)
   and placed on the classic "who keeps an atmosphere" chart next to the real planets. */
import { type Ctx, h, layout, canvas, heading, note, range, select, seg, stats, loop, noise2, clamp } from './kit';

const kB = 1.380649e-23, AMU = 1.66054e-27;
/** surface gravity in m/s² for mass and radius in Earth units */
export const gravity = (m: number, r: number) => 9.81 * m / (r * r);
/** escape speed in km/s */
export const vEsc = (m: number, r: number) => 11.186 * Math.sqrt(m / r);
/** equilibrium temperature in K: starlight in = heat out, with Bond albedo A */
export const tEq = (lum: number, au: number, albedo: number) => 278.6 * Math.pow(lum * (1 - albedo), .25) / Math.sqrt(au);
/** root-mean-square molecular speed in km/s */
export const vTh = (T: number, amu: number) => Math.sqrt(3 * kB * T / (amu * AMU)) / 1000;
/** conservative habitable zone (Kopparapu et al. 2013 style limits: runaway greenhouse ≈1.06 S⊕, maximum greenhouse ≈0.36 S⊕) */
export const hz = (lum: number) => [Math.sqrt(lum / 1.06), Math.sqrt(lum / .36)] as const;
/** orbital period in Earth years (Kepler's third law), star mass in Suns */
export const year = (au: number, mStar: number) => Math.sqrt(au ** 3 / mStar);
export const GASES: [string, number, string][] = [['H₂', 2, '#9fd3ff'], ['He', 4, '#ffd27a'], ['CH₄', 16, '#b2f2a6'], ['H₂O', 18, '#6fb6ff'], ['N₂', 28, '#c6b8ff'], ['O₂', 32, '#ff9fb5'], ['CO₂', 44, '#ffb37a']];
export const keeps = (m: number, r: number, T: number) => GASES.filter(([, amu]) => vEsc(m, r) > 6 * vTh(T, amu)).map(([n]) => n);

/* real stars and worlds (NASA planetary fact sheets; TRAPPIST-1 from Agol et al. 2021) */
const STARS: [string, string, number, number, number][] = [
  ['sun', 'Sun (G2, yellow)', 1, 1, 5772], ['eri', 'Epsilon Eridani (K2, orange)', .34, .82, 5084], ['prox', 'Proxima Centauri (M5, red dwarf)', .00155, .122, 3042],
  ['trap', 'TRAPPIST-1 (M8, ultra-cool)', .000553, .0898, 2566], ['proc', 'Procyon A (F5, white-yellow)', 6.9, 1.5, 6530], ['sir', 'Sirius A (A1, blue-white)', 25.4, 2.06, 9940]];
const WORLDS: [string, number, number, number, number, string][] = [
  ['Mercury', .0553, .383, 440, .088, 'sun'], ['Venus', .815, .949, 737, .77, 'sun'], ['Earth', 1, 1, 288, .306, 'sun'], ['Moon', .0123, .273, 250, .11, 'sun'],
  ['Mars', .107, .532, 210, .25, 'sun'], ['Jupiter', 317.8, 11.21, 165, .343, 'sun'], ['Saturn', 95.2, 9.45, 134, .342, 'sun'], ['Uranus', 14.5, 4.01, 76, .3, 'sun'],
  ['Neptune', 17.1, 3.88, 72, .29, 'sun'], ['Titan', .0225, .404, 94, .22, 'sun'], ['Pluto', .0022, .186, 44, .72, 'sun'], ['TRAPPIST-1e', .692, .92, 250, .3, 'trap']];
const ORB: Record<string, number> = { Mercury: .387, Venus: .723, Earth: 1, Moon: 1, Mars: 1.524, Jupiter: 5.2, Saturn: 9.58, Uranus: 19.2, Neptune: 30.1, Titan: 9.58, Pluto: 39.5, 'TRAPPIST-1e': .02925 };
/* greenhouse warming in K so the presets reproduce real mean surface temperatures */
const GH: Record<string, number> = { Venus: 737 - 232, Earth: 33, Mars: 5, Titan: 12 };

function starRGB(T: number): [number, number, number] {
  /* approximate blackbody colour (Tanner Helland fit) */
  const t = T / 100; let r: number, g: number, b: number;
  r = t <= 66 ? 255 : 329.7 * Math.pow(t - 60, -.1332);
  g = t <= 66 ? 99.47 * Math.log(t) - 161.1 : 288.1 * Math.pow(t - 60, -.0755);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5 * Math.log(t - 10) - 305;
  return [clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255)];
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#7fb2ff');
  L.view.style.background = '#05060d';
  L.view.style.display = 'grid'; L.view.style.placeItems = 'stretch'; L.view.style.gridTemplateRows = '1fr 210px';
  const top = h('div', { style: { position: 'relative', minHeight: '300px' } }), bot = h('div', { style: { position: 'relative', borderTop: '1px solid #1d2238' } });
  L.view.append(top, bot);
  const S = canvas(top, t('cv', 'Your planet, lit by its star, with the habitable zone strip below it.')); Object.assign(S.cv.style, { position: 'absolute', inset: '0' });
  const C = canvas(bot, t('chart', 'Chart of escape speed against temperature. Above a gas line a world keeps that gas.')); Object.assign(C.cv.style, { position: 'absolute', inset: '0' });
  const info = stats(L.panel, [['g', t('g', 'Surface gravity')], ['w', t('w', 'Your weight there')], ['esc', t('esc', 'Escape speed')], ['yr', t('yr', 'Year length')], ['temp', t('temp', 'Surface temperature')], ['zone', t('zone', 'Habitable zone')], ['air', t('air', 'Can keep')], ['look', t('look', 'Likely surface')]]);
  const P = { star: 'sun', au: 1, m: 1, r: 1, alb: .3, gh: 33, kg: 60 };
  let spin = 0;

  const star = () => STARS.find((s) => s[0] === P.star)!;
  function calc() {
    const [, , lum, ms, sT] = star();
    const Te = tEq(lum, P.au, P.alb), T = Te + P.gh, g = gravity(P.m, P.r), ve = vEsc(P.m, P.r), [hi, ho] = hz(lum);
    /* with little air there is nothing to even out heat, so gas escapes from the hot day side */
    const kept = keeps(P.m, P.r, P.gh < 10 ? T * 1.19 : T), gas = P.m > 10 && kept.includes('H₂');
    const water = kept.includes('H₂O'), thick = P.gh > 50 && kept.length > 0;
    /* rock starts to melt around 1000 K; a big greenhouse means thick air */
    const look = gas ? 'gas' : T > 1000 ? 'lava' : T > 373 ? (thick ? 'hot' : 'rock') : T >= 273 && water ? 'ocean' : T >= 180 ? 'cold' : 'ice';
    return { lum, ms, sT, Te, T, g, ve, hi, ho, kept, look, yr: year(P.au, ms) };
  }
  const LOOK: Record<string, string> = { gas: t('l.gas', 'gas giant: no solid surface'), lava: t('l.lava', 'molten or baked rock'), hot: t('l.hot', 'hot desert under thick air'), rock: t('l.rock', 'bare rock, little or no air'), ocean: t('l.ocean', 'liquid water can last'), cold: t('l.cold', 'cold desert, ice at the poles'), ice: t('l.ice', 'frozen surface') };
  function upd() {
    const c = calc();
    info('g', `${c.g.toFixed(2)} m/s² · ${(c.g / 9.81).toFixed(2)} g`);
    info('w', `${Math.round(P.kg * c.g / 9.81)} kg ${t('feel', 'feel')}`);
    info('esc', `${c.ve.toFixed(1)} km/s`);
    const days = c.yr * 365.25; info('yr', days < 100 ? `${days.toFixed(1)} ${t('days', 'days')}` : `${c.yr.toFixed(2)} ${t('years', 'Earth years')}`);
    info('temp', `${Math.round(c.T - 273.15)} °C (${Math.round(c.T)} K)`);
    info('zone', P.au < c.hi ? t('z.hot', 'too close, too hot') : P.au > c.ho ? t('z.cold', 'too far, too cold') : t('z.in', 'inside'));
    info('air', c.kept.length ? c.kept.join(' ') : t('none', 'nothing (airless)'));
    info('look', LOOK[c.look]);
    drawChart(c); tex = null;
  }

  /* ---------- planet texture (equirectangular), rebuilt when the look changes ---------- */
  let tex: { d: Uint8ClampedArray; look: string } | null = null;
  const TW = 256, TH = 128, n1 = noise2(3), n2 = noise2(9);
  function buildTex(look: string, T: number) {
    const d = new Uint8ClampedArray(TW * TH * 3);
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const lon = x / TW * Math.PI * 2, lat = (y / TH - .5) * Math.PI, cx = Math.cos(lat) * Math.cos(lon), cy = Math.sin(lat), cz = Math.cos(lat) * Math.sin(lon);
      let e = 0, a = 1, f = 1.6; for (let o = 0; o < 5; o++) { e += n1(cx * f + cz * .7 * f + o * 3, cy * f + cz * f * .5) * a; a *= .5; f *= 2.1; }
      const pole = Math.abs(cy); let r: number, g: number, b: number;
      if (look === 'gas') {
        const band = Math.sin(cy * 14 + n2(cx * 2, cy * 6) * 1.6), cold = T < 75;
        const k = .5 + .5 * band; r = cold ? 120 + 60 * k : 190 + 50 * k; g = cold ? 180 + 40 * k : 150 + 40 * k; b = cold ? 210 + 30 * k : 110 + 30 * k;
      } else if (look === 'ocean') {
        const land = e > .08; const ice = pole > .93 - (T - 273) / 400 + e * .08;
        if (ice) { r = 235; g = 242; b = 250; } else if (land) { const dry = clamp((T - 290) / 40, 0, 1); r = 55 + 130 * dry + e * 50; g = 95 + 50 * dry + e * 35; b = 50 + 40 * dry; } else { r = 20; g = 60 + e * 60; b = 130 + e * 80; }
      } else if (look === 'ice') { const k = .8 + e * .25; r = 210 * k; g = 225 * k; b = 240 * k; if (e < -.1) { r *= .85; g *= .9; } }
      else if (look === 'lava') { const crack = Math.abs(n2(cx * 6, cy * 6 + cz * 3)) < .06; r = crack ? 255 : 60 + e * 40; g = crack ? 120 : 40 + e * 25; b = crack ? 30 : 35 + e * 20; }
      else if (look === 'cold') { if (pole > .8 + e * .1) { r = 236; g = 238; b = 242; } else { r = 165 + e * 70; g = 95 + e * 45; b = 65 + e * 30; } }
      else if (look === 'hot') { r = 220 + e * 30; g = 180 + e * 30; b = 110 + e * 20; }
      else { r = 140 + e * 70; g = 125 + e * 60; b = 115 + e * 55; }
      const i = (y * TW + x) * 3; d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    tex = { d, look };
  }
  let img: ImageData | null = null;
  function drawScene(dt: number) {
    const c = calc(); if (!tex || tex.look !== c.look) buildTex(c.look, c.T);
    spin += dt * (ctx.calm ? .02 : .12);
    const g = S.g, W = S.w, H = S.h, TOP = 64;
    g.fillStyle = '#05060d'; g.fillRect(0, 0, W, H);
    /* star glow from the left; its brightness falls with distance squared (shown on a squashed scale) */
    const [sr, sg, sb] = starRGB(c.sT), flux = c.lum / (P.au * P.au);
    const glow = g.createRadialGradient(-40, H * .45, 0, -40, H * .45, W * (.25 + clamp(Math.log10(flux + 1e-3) + 3, 0, 6) * .08));
    glow.addColorStop(0, `rgba(${sr},${sg},${sb},.9)`); glow.addColorStop(.25, `rgba(${sr},${sg},${sb},.25)`); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow; g.fillRect(0, 0, W, H);
    /* planet: size on a log scale of radius */
    const R = clamp(Math.min(W, H - TOP - 60) * (.2 + .09 * Math.log2(P.r + .3)), 18, Math.min(W * .38, (H - TOP - 60) * .5));
    const px = W * .58, py = TOP + (H - TOP - 50) / 2, N = Math.ceil(R * 2);
    if (!img || img.width !== N) img = g.createImageData(N, N);
    const D = img.data, td = tex!.d, Lx = -.85, Ly = -.15, Lz = .5, ln = Math.hypot(Lx, Ly, Lz);
    const air = c.kept.length ? Math.min(1, c.kept.length / 4) : 0, tilt = .41;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + .5 - R) / R, y = (j + .5 - R) / R, rr = x * x + y * y, o = (j * N + i) * 4;
      if (rr > 1) { D[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - rr);
      const yy = y * Math.cos(tilt) - z * Math.sin(tilt), zz = y * Math.sin(tilt) + z * Math.cos(tilt);
      const lon = (Math.atan2(zz, x) + spin) % (Math.PI * 2), lat = Math.asin(clamp(-yy, -1, 1));
      const tx = Math.floor(((lon / (Math.PI * 2)) % 1 + 1) % 1 * TW), ty = clamp(Math.floor((lat / Math.PI + .5) * TH), 0, TH - 1), ti = (ty * TW + tx) * 3;
      let lit = (x * Lx + y * Ly + z * Lz) / ln; lit = clamp(lit, 0, 1);
      const night = c.look === 'lava' ? .45 : .04, k = night + (1 - night) * Math.pow(lit, .9), rim = Math.pow(1 - z, 3) * air;
      D[o] = td[ti] * k + rim * 120 * lit; D[o + 1] = td[ti + 1] * k + rim * 160 * lit; D[o + 2] = td[ti + 2] * k + rim * 255 * lit;
      D[o + 3] = 255 * clamp((1 - Math.sqrt(rr)) * R, 0, 1);
    }
    const off = offc(N); off.getContext('2d')!.putImageData(img, 0, 0);
    if (air > 0) { const halo = g.createRadialGradient(px, py, R * .95, px, py, R * (1.08 + air * .1)); halo.addColorStop(0, `rgba(130,180,255,${.35 * air})`); halo.addColorStop(1, 'rgba(130,180,255,0)'); g.fillStyle = halo; g.beginPath(); g.arc(px, py, R * 1.2, 0, 7); g.fill(); }
    g.drawImage(off, px - R, py - R);
    /* habitable-zone strip, log scale of distance */
    const y0 = H - 38, x0 = 24, x1 = W - 24, lo = Math.log10(.01), hi = Math.log10(60), X = (au: number) => x0 + (Math.log10(au) - lo) / (hi - lo) * (x1 - x0);
    g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0, y0, x1 - x0, 8);
    g.fillStyle = 'rgba(90,220,140,.55)'; g.fillRect(X(c.hi), y0, Math.max(2, X(c.ho) - X(c.hi)), 8);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '11px ui-monospace,monospace'; g.textAlign = 'center';
    for (const a of [.01, .1, 1, 10]) { g.fillRect(X(a), y0 + 9, 1, 4); g.fillText(a + ' AU', X(a), y0 + 25); }
    const mx = X(P.au); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(mx, y0 - 2); g.lineTo(mx - 5, y0 - 10); g.lineTo(mx + 5, y0 - 10); g.fill();
    g.textAlign = 'left'; g.fillStyle = 'rgba(160,240,190,.9)'; g.fillText(t('hzl', 'habitable zone'), x0, y0 - 6);
  }
  let oc: HTMLCanvasElement | null = null;
  const offc = (n: number) => { if (!oc) oc = document.createElement('canvas'); if (oc.width !== n) { oc.width = n; oc.height = n; } return oc; };

  /* ---------- the retention chart ---------- */
  function drawChart(c: ReturnType<typeof calc>) {
    const g = C.g, W = C.w, H = C.h, l = 46, r = W - 14, tp = 14, bt = H - 30;
    g.clearRect(0, 0, W, H); g.fillStyle = '#080a14'; g.fillRect(0, 0, W, H);
    const X = (T: number) => l + T / 800 * (r - l), lv0 = Math.log10(.5), lv1 = Math.log10(80), Y = (v: number) => bt - (Math.log10(v) - lv0) / (lv1 - lv0) * (bt - tp);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'right';
    for (const v of [1, 3, 10, 30, 60]) { g.beginPath(); g.moveTo(l, Y(v)); g.lineTo(r, Y(v)); g.stroke(); g.fillText(v + '', l - 5, Y(v) + 3); }
    g.textAlign = 'center'; for (let T = 0; T <= 800; T += 200) g.fillText(T + ' K', X(T), bt + 14);
    g.save(); g.translate(11, (tp + bt) / 2); g.rotate(-Math.PI / 2); g.fillText(t('ax', 'escape km/s'), 0, 0); g.restore();
    GASES.forEach(([n, amu, col], gi) => {
      g.strokeStyle = col; g.lineWidth = 1.2; g.beginPath();
      for (let T = 5; T <= 800; T += 5) { const v = 6 * vTh(T, amu); T === 5 ? g.moveTo(X(T), Y(Math.max(.5, v))) : g.lineTo(X(T), Y(Math.max(.5, v))); }
      const lt = 780 - gi * 55; g.stroke(); g.fillStyle = col; g.textAlign = 'center'; g.fillText(n, X(lt), Y(6 * vTh(lt, amu)) - 5);
    });
    g.textAlign = 'left';
    for (const [n, m, rad, T] of WORLDS) { const x = X(T), y = Y(vEsc(m, rad)); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; const lo = n === 'Uranus' || n === 'TRAPPIST-1e' || n === 'Moon'; g.textAlign = lo ? 'right' : 'left'; g.fillText(t('pl.' + n, n), lo ? x - 5 : x + 5, lo ? y + 11 : y - 3); }
    g.textAlign = 'left';
    const ux = X(clamp(c.T, 0, 800)), uy = Y(clamp(c.ve, .5, 80));
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(ux, uy, 7, 0, 7); g.stroke(); g.fillStyle = '#7fb2ff'; g.beginPath(); g.arc(ux, uy, 4, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 11px ui-monospace,monospace'; g.fillText(t('you', 'your planet'), ux + 10, uy + 14);
  }
  C.onResize(() => drawChart(calc()));

  /* ---------- controls ---------- */
  heading(L.panel, t('starh', 'Star and orbit'));
  select(L.panel, t('star', 'Star'), STARS.map((s) => [s[0], t('s.' + s[0], s[1])]), P.star, (v) => { P.star = v; upd(); });
  const au = range(L.panel, t('au', 'Distance from star'), { min: -2, max: 1.7, step: .01, value: 0, fmt: (n) => { const a = 10 ** n; return (a < .1 ? a.toFixed(3) : a < 10 ? a.toFixed(2) : a.toFixed(1)) + ' AU'; } }, (v) => { P.au = 10 ** v; upd(); });
  heading(L.panel, t('planeth', 'Planet'));
  const mass = range(L.panel, t('mass', 'Mass (Earth = 1)'), { min: -3, max: 3, step: .01, value: 0, fmt: (n) => { const m = 10 ** n; return m < .1 ? m.toFixed(4) : m < 10 ? m.toFixed(2) : m.toFixed(0); } }, (v) => { P.m = 10 ** v; upd(); });
  const rad = range(L.panel, t('rad', 'Radius (Earth = 1)'), { min: -1, max: 1.2, step: .01, value: 0, fmt: (n) => (10 ** n).toFixed(2) }, (v) => { P.r = 10 ** v; upd(); });
  const alb = range(L.panel, t('alb', 'Reflectivity (albedo)'), { min: 0, max: .9, step: .01, value: P.alb, fmt: (n) => Math.round(n * 100) + ' %' }, (v) => { P.alb = v; upd(); });
  const gh = range(L.panel, t('gh', 'Greenhouse warming'), { min: 0, max: 520, step: 1, value: P.gh, fmt: (n) => '+' + n + ' K' }, (v) => { P.gh = v; upd(); });
  range(L.panel, t('kg', 'Your weight on Earth'), { min: 10, max: 150, value: P.kg, fmt: (n) => n + ' kg' }, (v) => { P.kg = v; upd(); });
  heading(L.panel, t('realh', 'Load a real world'));
  const pick = h('div', { class: 'wk-row' });
  for (const [n, m, r, , a, st] of WORLDS) pick.append(h('button', { type: 'button', class: 'wk-b', text: t('pl.' + n, n), onclick: () => {
    P.star = st; P.m = m; P.r = r; P.au = ORB[n]; P.alb = a; P.gh = GH[n] ?? 0;
    starSel.value = st; au.set(Math.log10(P.au)); mass.set(Math.log10(m)); rad.set(Math.log10(r)); alb.set(a); gh.set(P.gh); upd();
  } }));
  L.panel.append(pick);
  const starSel = L.panel.querySelector('select') as HTMLSelectElement;
  seg(L.panel, t('mix', 'Quick planet'), [['earth', t('q.earth', 'Earth-like')], ['super', t('q.super', 'Super-Earth')], ['mini', t('q.mini', 'Mini-Neptune')]], 'earth', (v) => {
    const q = v === 'super' ? [5, 1.6] : v === 'mini' ? [8, 2.6] : [1, 1]; P.m = q[0]; P.r = q[1]; mass.set(Math.log10(q[0])); rad.set(Math.log10(q[1])); upd();
  });
  note(L.panel, t('how', 'Temperature starts from the balance of starlight in and heat out, then the greenhouse slider adds warming from the air. Worlds with little air are judged by their hotter day side. A gas stays for billions of years only when the escape speed is more than six times the average speed of its molecules; light, fast hydrogen leaks away first. This is a simplified model: real atmospheres also depend on the hotter upper air, magnetic fields and the star\'s wind.'));
  upd();
  loop(ctx, S.cv, drawScene);
}
