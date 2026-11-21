/* 033 Underwater World: The Colour of Depth. Water swallows light one colour at a time: red
   is gone within a few metres, then orange, yellow and green, until only blue is left. This world
   filters a real photo (or yours) with the Beer–Lambert law per colour channel, so you can see
   what a diver sees at any depth and distance, with or without a strobe. A depth gauge beside it
   shows pressure, temperature, ocean zones, light and the safe depth for each breathing gas. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, loop, local, clamp, download } from './kit';
import { I18N } from '../scripts/i18n';

/** diffuse attenuation (per metre) for red, green, blue; clear ocean vs. green coastal water */
export const WATER: Record<string, [number, number, number]> = { ocean: [.36, .066, .028], coast: [.5, .14, .2] };
/** fraction of light left in each channel after a path of `m` metres */
export const transmit = (k: [number, number, number], m: number) => k.map((v) => Math.exp(-v * m)) as [number, number, number];
/** absolute pressure in bar at a depth in sea water (about 1 bar per 10 m, plus the air above) */
export const pressure = (d: number) => 1.01325 + d * 1025 * 9.80665 / 1e5;
/** maximum operating depth (m) for an oxygen fraction and a ppO2 limit */
export const mod = (fo2: number, limit = 1.4) => Math.max(0, (limit / fo2 - 1) * 10);
/** simple temperature profile: mixed layer, thermocline to 4 °C by 1000 m, then cooling to 1.5 °C */
export function tempAt(d: number, surf: number) {
  if (d < 50) return surf;
  if (d < 1000) { const s = Math.log(d / 50) / Math.log(20); return surf + (4 - surf) * Math.min(1, s ** .7); }
  return 4 - 2.5 * Math.min(1, (d - 1000) / 3000);
}
const ZONES: [number, string, string][] = [[0, 'z.epi', 'Sunlight zone'], [200, 'z.meso', 'Twilight zone'], [1000, 'z.bathy', 'Midnight zone'], [4000, 'z.abysso', 'Abyss'], [6000, 'z.hadal', 'Trenches (hadal zone)']];
const MAXD = 11000;

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#3fd0c9');
  L.view.style.background = '#03131f';
  L.view.style.display = 'grid'; L.view.style.placeItems = 'stretch'; L.view.style.gridTemplateColumns = '120px 1fr';
  const left = h('div', { style: { position: 'relative', minHeight: '380px' } }), right = h('div', { style: { position: 'relative' } });
  L.view.append(left, right);
  const G = canvas(left, t('gauge', 'Depth gauge from the surface to 11 000 metres. Drag or use arrow keys to dive.')); Object.assign(G.cv.style, { position: 'absolute', inset: '0', cursor: 'ns-resize' });
  const S = canvas(right, t('cv', 'The photo as it looks at the chosen depth')); Object.assign(S.cv.style, { position: 'absolute', inset: '0' });
  const info = stats(L.panel, [['depth', t('depth', 'Depth')], ['p', t('p', 'Pressure')], ['temp', t('temp', 'Water temperature')], ['zone', t('zone', 'Zone')], ['light', t('light', 'Light left (R/G/B)')], ['gas', t('gas', 'Safe on')]]);
  const P = { depth: 10, dist: 2, surf: 26, water: 'ocean', mode: 'natural' as 'natural' | 'strobe' | 'fix' };
  let src: ImageData | null = null, out: ImageData | null = null, dirty = true, glow: { x: number; y: number; p: number; s: number }[] = [];
  const work = document.createElement('canvas'), wg = work.getContext('2d', { willReadFrequently: true })!;
  function loadImg(url: string, revoke = false) {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { const w = Math.min(720, im.naturalWidth), hh = Math.round(w * im.naturalHeight / im.naturalWidth); work.width = w; work.height = hh; wg.drawImage(im, 0, 0, w, hh); src = wg.getImageData(0, 0, w, hh); out = wg.createImageData(w, hh); dirty = true; if (revoke) URL.revokeObjectURL(url); };
    im.onerror = () => { L.hud.textContent = t('imgerr', 'That image could not be opened'); };
    im.src = url;
  }
  /* depth on the gauge: square-root scale so the bright top metres get room */
  const TOP = 64, dToY = (d: number) => TOP + Math.sqrt(d / MAXD) * (G.h - TOP - 14), yToD = (y: number) => clamp(((y - TOP) / (G.h - TOP - 14)) ** 2 * MAXD, 0, MAXD);
  function render() {
    if (!src || !out) return;
    const k = WATER[P.water];
    /* path the light travels: sunlight down to the subject then to the camera; a strobe only covers camera→subject→camera */
    const path = P.mode === 'strobe' ? P.dist * 2 : P.depth + P.dist;
    const tr = transmit(k, path), amb = P.mode === 'strobe' ? 1 : clamp(1 - Math.max(0, P.depth - 200) / 800, 0, 1) ** 3;
    /* scattered blue-green haze grows with distance */
    const haze = 1 - Math.exp(-(P.water === 'coast' ? .35 : .12) * P.dist), hz = P.water === 'coast' ? [20, 90, 70] : [10, 60, 110];
    const hd = transmit(k, P.depth).map((v) => v * (P.mode === 'strobe' ? Math.max(.05, amb) : amb));
    let gain: number[] = [1, 1, 1];
    if (P.mode === 'fix') { const m = Math.max(...tr); gain = tr.map((v) => clamp(m / Math.max(v, 1e-4), 1, 40)); }
    const s = src.data, o = out.data, n = s.length;
    const fr = tr[0] * amb * gain[0], fg = tr[1] * amb * gain[1], fb = tr[2] * amb * gain[2];
    const noise = P.mode === 'fix' ? Math.min(60, Math.log2(Math.max(...gain)) * 9) : 0;
    for (let i = 0; i < n; i += 4) {
      const nz = noise ? (Math.random() - .5) * noise : 0;
      o[i] = s[i] * fr * (1 - haze) + hz[0] * hd[0] * haze * gain[0] + nz; o[i + 1] = s[i + 1] * fg * (1 - haze) + hz[1] * hd[1] * haze * gain[1] + nz; o[i + 2] = s[i + 2] * fb * (1 - haze) + hz[2] * hd[2] * haze * gain[2] + nz; o[i + 3] = 255;
    }
    wg.putImageData(out, 0, 0);
    const avg = (tr[0] + tr[1] + tr[2]) / 3 * amb;
    info('depth', `${Math.round(P.depth).toLocaleString(ctx.lang)} m`); info('p', `${pressure(P.depth).toFixed(1)} bar`); info('temp', `${tempAt(P.depth, P.surf).toFixed(1)} °C`);
    const z = [...ZONES].reverse().find((q) => P.depth >= q[0])!; info('zone', t(z[1], z[2]));
    const tn = transmit(k, P.depth).map((v) => v * 100 * amb); info('light', tn.map((v) => v < .01 ? '0' : v < 1 ? v.toFixed(2) : v.toFixed(0)).join(' / ') + ' %');
    const g = [[.21, t('air', 'air')], [.32, 'EAN32'], [.36, 'EAN36']].filter(([f]) => P.depth <= mod(f as number)).map((q) => q[1]);
    info('gas', P.depth <= 40 && g.length ? g.join(', ') : P.depth <= 100 ? t('trimix', 'trimix only (technical diving)') : t('sub', 'submersibles only'));
    L.hud.textContent = P.mode === 'fix' && avg < .02 ? t('fixnoise', 'Correcting this much colour needs huge gain: the picture turns to noise') : P.depth > 1000 && P.mode !== 'strobe' ? t('dark', 'No sunlight reaches here. The only light is made by animals (bioluminescence).') : '';
    void avg; dirty = false;
  }
  function drawGauge() {
    const g = G.g, W = G.w, H = G.h; g.clearRect(0, 0, W, H);
    const k = WATER[P.water];
    for (let y = TOP; y < H - 14; y++) { const d = yToD(y), tr = transmit(k, d), a = clamp(1 - Math.max(0, d - 200) / 800, 0, 1) ** 3; g.fillStyle = `rgb(${10 + 230 * tr[0] * a},${20 + 200 * tr[1] * a},${40 + 210 * tr[2] * a})`; g.fillRect(40, y, 26, 1); }
    g.font = '10px ui-monospace,monospace'; g.textAlign = 'right';
    for (const d of [0, 10, 40, 100, 200, 500, 1000, 2000, 4000, 6000, 8000, 11000]) { const y = dToY(d); g.fillStyle = 'rgba(200,240,255,.6)'; g.fillRect(34, y, 6, 1); g.fillText(d >= 1000 ? `${d / 1000}k` : String(d), 32, y + 3); }
    g.textAlign = 'left'; g.fillStyle = 'rgba(160,220,230,.55)';
    for (const z of ZONES) { const y = dToY(z[0]); g.fillRect(66, y, 6, 1); }
    /* colour-loss markers: depth where each channel drops to 10 % */
    ([[0, '#ff5a4a'], [1, '#6cff8a'], [2, '#5aa8ff']] as [number, string][]).forEach(([c, col]) => { const d = Math.log(10) / k[c]; if (d < MAXD) { const y = dToY(d); g.fillStyle = col; g.beginPath(); g.arc(78 + c * 9, y, 3.5, 0, 7); g.fill(); } });
    const y = dToY(P.depth); g.strokeStyle = '#3fd0c9'; g.lineWidth = 2; g.beginPath(); g.moveTo(36, y); g.lineTo(W - 4, y); g.stroke();
    g.fillStyle = '#3fd0c9'; g.beginPath(); g.moveTo(W - 4, y); g.lineTo(W - 14, y - 6); g.lineTo(W - 14, y + 6); g.closePath(); g.fill();
  }
  function draw(dt: number) {
    if (dirty) render();
    drawGauge();
    const g = S.g, W = S.w, H = S.h; g.fillStyle = '#020a12'; g.fillRect(0, 0, W, H);
    if (!src) { g.fillStyle = '#7fb'; g.fillText(t('loading', 'Loading photo…'), 20, 30); return; }
    const sc = Math.min(W / work.width, H / work.height), w = work.width * sc, hh = work.height * sc, ox = (W - w) / 2, oy = (H - hh) / 2;
    g.drawImage(work, ox, oy, w, hh);
    /* deep water: drifting bioluminescent sparks */
    const deep = clamp((P.depth - 300) / 700, 0, 1);
    if (deep > 0 && P.mode !== 'strobe') {
      if (glow.length < 60) glow.push({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 6, s: .5 + Math.random() * 1.5 });
      for (const q of glow) { q.p += dt * (ctx.calm ? .4 : 1.2); q.y -= dt * 4 * q.s; if (q.y < 0) q.y = H; const a = Math.max(0, Math.sin(q.p)) * deep; g.fillStyle = `rgba(90,255,220,${a * .8})`; g.beginPath(); g.arc(q.x, q.y, 1.5 * q.s + a * 2, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(2,10,18,.6)'; g.fillRect(10, H - 30, 260, 22); g.fillStyle = '#bff'; g.font = '11px ui-monospace,monospace';
    g.fillText(`${Math.round(P.depth)} m · ${P.dist} m ${t('away', 'away')} · ${P.mode === 'strobe' ? t('m.strobe', 'strobe') : P.mode === 'fix' ? t('m.fix', 'colour-corrected') : t('m.natural', 'daylight')}`, 18, H - 15);
  }
  loop(ctx, S.cv, draw);
  let drag = false;
  const setDepth = (d: number) => { P.depth = Math.round(clamp(d, 0, MAXD) * 10) / 10; dep.set(Math.round(P.depth)); dirty = true; };
  G.cv.addEventListener('pointerdown', (e) => { drag = true; G.cv.setPointerCapture(e.pointerId); setDepth(yToD(local(e, G.cv).y)); });
  G.cv.addEventListener('pointermove', (e) => { if (drag) setDepth(yToD(local(e, G.cv).y)); });
  G.cv.addEventListener('pointerup', () => { drag = false; });
  G.cv.addEventListener('keydown', (e) => { const st = P.depth < 50 ? 1 : P.depth < 500 ? 10 : 100; if (e.key === 'ArrowDown') setDepth(P.depth + st * (e.shiftKey ? 10 : 1)); else if (e.key === 'ArrowUp') setDepth(P.depth - st * (e.shiftKey ? 10 : 1)); else if (e.key === 'Home') setDepth(0); else if (e.key === 'End') setDepth(MAXD); else return; e.preventDefault(); });

  heading(L.panel, t('dive', 'Dive'));
  const dep = range(L.panel, t('depth', 'Depth'), { min: 0, max: MAXD, value: P.depth, fmt: (n) => n.toLocaleString(ctx.lang) + ' m' }, (v) => { P.depth = v; dirty = true; });
  range(L.panel, t('dist', 'Distance to the subject'), { min: .3, max: 15, step: .1, value: P.dist, fmt: (n) => n + ' m' }, (v) => { P.dist = v; dirty = true; });
  seg(L.panel, t('light2', 'Light'), [['natural', t('m.natural', 'daylight')], ['strobe', t('m.strobe', 'strobe')], ['fix', t('m.fix', 'colour-corrected')]], P.mode, (v) => { P.mode = v as typeof P.mode; dirty = true; });
  seg(L.panel, t('water', 'Water'), [['ocean', t('w.ocean', 'Clear ocean')], ['coast', t('w.coast', 'Green coast')]], P.water, (v) => { P.water = v; dirty = true; });
  range(L.panel, t('surf', 'Surface temperature'), { min: -1, max: 30, value: P.surf, fmt: (n) => n + ' °C' }, (v) => { P.surf = v; dirty = true; });
  heading(L.panel, t('photo', 'Photo'));
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('own', 'Use my own photo') }) as HTMLInputElement;
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) loadImg(URL.createObjectURL(f), true); });
  const row = h('div', { class: 'wk-row' },
    h('button', { type: 'button', class: 'wk-b', text: t('reef', 'Diver photo'), onclick: () => loadImg(I18N.root + 'assets/home/diver.jpg') }),
    h('button', { type: 'button', class: 'wk-b', text: t('oct', 'Octopus photo'), onclick: () => loadImg(I18N.root + 'assets/home/octopus.jpg') }),
    h('label', { class: 'wk-b', style: { cursor: 'pointer' } }, t('own', 'Use my own photo'), file),
    h('button', { type: 'button', class: 'wk-b pri', text: t('save', 'Save image'), onclick: () => download(work, `abidora-depth-${Math.round(P.depth)}m.png`) }));
  (file.style as CSSStyleDeclaration).display = 'none'; L.panel.append(row);
  note(L.panel, t('how', 'Light fades exponentially in water, and faster for red than blue (Beer–Lambert law). Sunlight must travel down to the subject and then across to you, so depth and distance both steal colour. A strobe only travels the short distance to the subject and back, which is why underwater photographers use one. Colour correction can only boost what is left, so deep shots turn noisy.'));
  note(L.panel, t('src', 'Attenuation values approximate clear oceanic and green coastal water. Safe depths use an oxygen partial pressure limit of 1.4 bar: air 56 m, EAN32 34 m, EAN36 29 m, and recreational divers stop at 40 m. This is a learning tool, not dive planning.'));
  note(L.panel, t('priv', 'Your own photo stays on this device; nothing is uploaded.'));
  loadImg(I18N.root + 'assets/home/diver.jpg');
}
