/* 068 Travel Photography. Two tools a travelling photographer actually uses, both working offline:
   · Light planner: for any of 40 cities and any date, the day's sunrise, sunset, golden hours (Sun between
     −4° and 6°) and blue hours (−6° to −4°) in that city's own clock, from the Sun's position computed in the
     browser, with the Sun's height through the day and the compass direction the light comes from.
   · Composition desk: your own photo (it never leaves your device) or a generated sample, with rule-of-thirds,
     golden-ratio, golden-spiral and diagonal guides, crop ratios for prints and social media, a straightening
     slider, a live brightness histogram with clipping warnings, and full-resolution export. */
import { type Ctx, h, layout, canvas, heading, note, seg, select, range, stats, buttons, local, clamp, store, download } from './kit';
import { sun, sunAlt, CITIES, RAD, DEG } from './geo';

/* ---------- light ---------- */
/** the Sun's compass direction (0 = north, 90 = east), degrees */
export function sunAz(la: number, lo: number, s: { dec: number; lon: number }) {
  const H = (lo - s.lon) * RAD, p = la * RAD, d = s.dec * RAD;
  return ((Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(p) - Math.tan(d) * Math.cos(p)) * DEG + 180) % 360 + 360) % 360;
}
/** minutes to add to UTC to get local clock time in `tz` at instant t */
export function tzOffset(tz: string, t: number) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t));
  const g = (k: string) => +(p.find((x) => x.type === k)?.value ?? 0);
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')) - Math.floor(t / 60000) * 60000) / 60000);
}
/** UTC instant of local midnight starting the given calendar day in tz */
export function localMidnight(tz: string, y: number, m: number, d: number) { let t = Date.UTC(y, m, d); for (let i = 0; i < 3; i++) t = Date.UTC(y, m, d) - tzOffset(tz, t) * 60000; return t; }
export interface Span { a: number; b: number }
/** one sample per minute over the local day; spans where lo ≤ altitude < hi, in minutes after local midnight */
export function plan(la: number, lo: number, t0: number) {
  const alt: number[] = [], az: number[] = [];
  for (let i = 0; i <= 1440; i++) { const s = sun(new Date(t0 + i * 60000)); alt.push(sunAlt(la, lo, s)); az.push(sunAz(la, lo, s)); }
  const spans = (lo2: number, hi2: number) => { const o: Span[] = []; let st = -1; for (let i = 0; i <= 1440; i++) { const inn = i < 1440 && alt[i] >= lo2 && alt[i] < hi2; if (inn && st < 0) st = i; if (!inn && st >= 0) { o.push({ a: st, b: i }); st = -1; } } return o; };
  const cross = (lv: number, up: boolean) => { for (let i = 1; i <= 1440; i++) if (up ? alt[i - 1] < lv && alt[i] >= lv : alt[i - 1] >= lv && alt[i] < lv) return i - 1 + (lv - alt[i - 1]) / (alt[i] - alt[i - 1]); return null; };
  let noon = 0; for (let i = 1; i <= 1440; i++) if (alt[i] > alt[noon]) noon = i;
  return { alt, az, golden: spans(-4, 6), blue: spans(-6, -4), rise: cross(-0.833, true), set: cross(-0.833, false), noon, maxAlt: alt[noon] };
}

/* ---------- composition ---------- */
export const PHI = (1 + Math.sqrt(5)) / 2;
export const RATIOS: [string, number][] = [['3:2', 3 / 2], ['4:5', 4 / 5], ['1:1', 1], ['16:9', 16 / 9], ['9:16', 9 / 16], ['A4', Math.SQRT2]];
/** the squares of a golden-rectangle subdivision (for the spiral) */
export function goldenSquares(w: number, hh: number, n = 9) {
  /* squares are cut from the left, top, right, bottom in turn, so quarter arcs join into one spiral */
  const sq: { x: number; y: number; s: number; k: number }[] = []; let x = 0, y = 0, W = w, H = hh;
  for (let k = 0; k < n; k++) {
    const s = Math.min(W, H); if (s <= 1e-9) break; const side = k % 4;
    if (side === 0) { sq.push({ x, y, s, k }); x += s; W -= s; }
    else if (side === 1) { sq.push({ x, y, s, k }); y += s; H -= s; }
    else if (side === 2) { sq.push({ x: x + W - s, y, s, k }); W -= s; }
    else { sq.push({ x, y: y + H - s, s, k }); H -= s; }
  }
  return sq;
}
/** luminance histogram (256 bins, Rec. 709 weights) and the share of clipped pixels */
export function histogram(d: Uint8ClampedArray) {
  const bins = new Uint32Array(256); let n = 0, lo = 0, hi = 0;
  for (let i = 0; i < d.length; i += 4) { const y = Math.round(.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]); bins[y]++; n++; if (d[i] >= 254 || d[i + 1] >= 254 || d[i + 2] >= 254) { if (y >= 250) hi++; } if (y <= 3) lo++; }
  return { bins, n, lowClip: n ? lo / n : 0, highClip: n ? hi / n : 0 };
}

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t, lang = ctx.lang;
  const L = layout(ctx);
  L.view.classList.add('w68');
  L.view.style.minHeight = 'clamp(420px, 58vw, 640px)';
  const S = canvas(L.view, t('cv', 'A day of sunlight for a city, or your photo with composition guides.'), { alpha: false });
  type Cfg = { room: 'light' | 'comp'; city: number; ratio: string; guide: string; orient: number };
  const def: Cfg = { room: 'light', city: 0, ratio: '3:2', guide: 'thirds', orient: 0 };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'room' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);
  const today = new Date(); let dY = today.getFullYear(), dM = today.getMonth(), dD = today.getDate();

  heading(L.panel, t('h', 'Field kit'));
  seg(L.panel, t('room', 'Tool'), [['light', t('r.light', 'Light planner')], ['comp', t('r.comp', 'Composition desk')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); build(); draw(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };
  const COMPASS = [t('N', 'N'), t('NE', 'NE'), t('E', 'E'), t('SE', 'SE'), t('S', 'S'), t('SW', 'SW'), t('W', 'W'), t('NW', 'NW')];
  const dir = (az: number) => COMPASS[Math.round(az / 45) % 8];

  /* ---------- light planner ---------- */
  let P: ReturnType<typeof plan> | null = null, t0 = 0;
  const hm = (min: number | null) => { if (min === null) return '—'; const v = Math.round(min); return new Date(t0 + v * 60000).toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', timeZone: CITIES[cfg.city][3] }); };
  function compute() { const c = CITIES[cfg.city]; t0 = localMidnight(c[3], dY, dM, dD); P = plan(c[1], c[2], t0); }
  function drawLight(g: CanvasRenderingContext2D, W: number, H: number) {
    if (!P) compute(); const p = P!, c = CITIES[cfg.city];
    g.fillStyle = '#0d1321'; g.fillRect(0, 0, W, H);
    const m = { l: 44, r: 18, t: 46, b: 70 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
    const X = (min: number) => m.l + (min / 1440) * pw, maxA = Math.max(30, Math.ceil(p.maxAlt / 10) * 10), minA = -30, Y = (a: number) => m.t + ((maxA - a) / (maxA - minA)) * ph;
    /* sky bands by altitude */
    for (let i = 0; i < 1440; i++) { const a = p.alt[i]; g.fillStyle = a >= 6 ? 'rgba(120,180,255,.22)' : a >= -4 ? 'rgba(255,170,60,.55)' : a >= -6 ? 'rgba(70,110,230,.55)' : a >= -12 ? 'rgba(40,50,120,.4)' : 'rgba(0,0,0,0)'; g.fillRect(X(i), m.t, pw / 1440 + .6, ph); }
    /* axes */
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(m.l, Y(0)); g.lineTo(m.l + pw, Y(0)); g.stroke();
    g.fillStyle = '#aab4c8'; g.font = '11px ui-monospace, monospace';
    for (let hr = 0; hr <= 24; hr += 3) { g.fillText(String(hr).padStart(2, '0'), X(hr * 60) - 7, m.t + ph + 16); g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(X(hr * 60), m.t); g.lineTo(X(hr * 60), m.t + ph); g.stroke(); }
    for (let a = minA; a <= maxA; a += 15) g.fillText(`${a}°`, 4, Y(a) + 4);
    /* altitude curve */
    g.save(); g.beginPath(); g.rect(m.l, m.t, pw, ph); g.clip();
    g.strokeStyle = '#ffd166'; g.lineWidth = 2.5; g.beginPath(); p.alt.forEach((a, i) => (i ? g.lineTo(X(i), Y(a)) : g.moveTo(X(i), Y(a)))); g.stroke(); g.restore(); g.lineWidth = 1;
    /* now marker if today */
    const now = Date.now(); if (now >= t0 && now < t0 + 1440 * 60000) { const i = (now - t0) / 60000; g.strokeStyle = '#fff'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(i), m.t); g.lineTo(X(i), m.t + ph); g.stroke(); g.setLineDash([]); g.fillStyle = '#fff'; g.fillText(t('now', 'now'), X(i) + 4, m.t + 12); }
    /* title */
    g.fillStyle = '#e8ecf4'; g.font = '600 15px ui-sans-serif, system-ui'; g.fillText(`${c[0]} · ${new Date(Date.UTC(dY, dM, dD)).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}`, m.l, 24);
    /* legend */
    const lg: [string, string][] = [['rgba(255,170,60,.9)', t('golden', 'golden hour')], ['rgba(70,110,230,.9)', t('blue', 'blue hour')], ['#ffd166', t('alt', 'Sun height')]];
    let lx = m.l; g.font = '12px ui-sans-serif, system-ui'; for (const [col, txt] of lg) { g.fillStyle = col; g.fillRect(lx, H - 30, 12, 12); g.fillStyle = '#cfd6e4'; g.fillText(txt, lx + 18, H - 20); lx += g.measureText(txt).width + 40; }
    const gs = p.golden.map((s) => `${hm(s.a)}–${hm(s.b)}`).join(', ') || '—';
    out('a', `${hm(p.rise)} / ${hm(p.set)}`); out('b', gs); out('c', `${Math.round(p.maxAlt)}° · ${hm(p.noon)}`);
    const ev = p.rise !== null ? `${t('morning', 'Morning light from the')} ${dir(p.az[Math.round(p.rise)])} (${Math.round(p.az[Math.round(p.rise)])}°)` : p.maxAlt < -0.833 ? t('polarN', 'The Sun does not rise today.') : t('polarD', 'The Sun does not set today.');
    const ev2 = p.set !== null ? ` · ${t('evening', 'evening light from the')} ${dir(p.az[Math.round(p.set)])} (${Math.round(p.az[Math.round(p.set)])}°)` : '';
    L.hud.textContent = ev + ev2;
  }

  /* ---------- composition desk ---------- */
  let img: CanvasImageSource | null = null, iw = 0, ih = 0, rotDeg = 0, zoom = 1, pan = { x: 0, y: 0 }, isSample = true;
  function sample() {
    const c = document.createElement('canvas'); c.width = 1800; c.height = 1200; const g = c.getContext('2d'); if (!g) return;
    const sky = g.createLinearGradient(0, 0, 0, 760); sky.addColorStop(0, '#26315e'); sky.addColorStop(.55, '#c8637a'); sky.addColorStop(1, '#ffc27a'); g.fillStyle = sky; g.fillRect(0, 0, 1800, 1200);
    g.fillStyle = '#fff1c9'; g.beginPath(); g.arc(1180, 690, 70, 0, 7); g.fill();
    const ridge = (y0: number, amp: number, col: string, seed: number) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, 1200); for (let x = 0; x <= 1800; x += 10) g.lineTo(x, y0 - amp * (Math.sin(x / 180 + seed) * .6 + Math.sin(x / 67 + seed * 2) * .25 + Math.sin(x / 23 + seed * 3) * .08)); g.lineTo(1800, 1200); g.fill(); };
    ridge(760, 120, '#5b3f63', 1); ridge(840, 90, '#3c2d4f', 2.4);
    const sea = g.createLinearGradient(0, 860, 0, 1200); sea.addColorStop(0, '#e59a74'); sea.addColorStop(1, '#2b2742'); g.fillStyle = sea; g.fillRect(0, 860, 1800, 340);
    g.fillStyle = 'rgba(255,240,200,.5)'; for (let i = 0; i < 26; i++) g.fillRect(1120 + Math.sin(i) * 40, 880 + i * 12, 120 - i * 3, 3);
    g.fillStyle = '#1b1426'; g.beginPath(); g.moveTo(420, 1000); g.lineTo(560, 1000); g.lineTo(540, 1030); g.lineTo(440, 1030); g.fill(); g.fillRect(488, 900, 4, 100); g.beginPath(); g.moveTo(492, 905); g.lineTo(552, 990); g.lineTo(492, 990); g.fill();
    img = c; iw = 1800; ih = 1200; isSample = true;
  }
  sample();
  const ratioOf = () => (RATIOS.find((r) => r[0] === cfg.ratio) ?? RATIOS[0])[1];
  /** view geometry: crop frame (axis-aligned, centred) and the transform placing the image under it */
  function geom(W: number, H: number) {
    const r = ratioOf(), fw = Math.min(W - 40, (H - 40) * r), fh = fw / r, fx = (W - fw) / 2, fy = (H - fh) / 2;
    /* base scale makes the image cover the frame at zoom 1, even when rotated */
    const th = Math.abs(rotDeg) * RAD, needW = fw * Math.cos(th) + fh * Math.sin(th), needH = fw * Math.sin(th) + fh * Math.cos(th);
    const base = Math.max(needW / iw, needH / ih), sc = base * zoom;
    return { fx, fy, fw, fh, sc, cx: W / 2 + pan.x, cy: H / 2 + pan.y };
  }
  function paint(g: CanvasRenderingContext2D, G: ReturnType<typeof geom>, k = 1, ox = 0, oy = 0) {
    if (!img) return; g.save(); g.translate((G.cx - ox) * k, (G.cy - oy) * k); g.rotate(rotDeg * RAD); g.scale(G.sc * k, G.sc * k); g.drawImage(img, -iw / 2, -ih / 2); g.restore();
  }
  function guides(g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3;
    const line = (x1: number, y1: number, x2: number, y2: number) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
    if (cfg.guide === 'thirds' || cfg.guide === 'phi') { const f = cfg.guide === 'thirds' ? 1 / 3 : 1 - 1 / PHI; for (const q of [f, 1 - f]) { line(x + w * q, y, x + w * q, y + hh); line(x, y + hh * q, x + w, y + hh * q); } }
    if (cfg.guide === 'diag') {
      /* both diagonals, and from each remaining corner the line meeting a diagonal at a right angle */
      const d = (w * w) / (w * w + hh * hh), P = (u: number, v: number): [number, number] => [x + w * u, y + hh * v];
      const seg2 = (a: [number, number], b: [number, number]) => line(a[0], a[1], b[0], b[1]);
      seg2(P(0, 0), P(1, 1)); seg2(P(1, 0), P(0, 1));
      seg2(P(1, 0), P(d, d)); seg2(P(0, 1), P(1 - d, 1 - d)); seg2(P(0, 0), P(1 - d, d)); seg2(P(1, 1), P(d, 1 - d));
    }
    if (cfg.guide === 'spiral') {
      /* a true golden rectangle subdivision, stretched to the frame as photo editors do; orient turns it */
      const land = w >= hh, fx2 = cfg.orient & 1, fy2 = cfg.orient & 2;
      const M = (u: number, v: number): [number, number] => { let a = land ? u / PHI : v, b2 = land ? v : u / PHI; if (fx2) a = 1 - a; if (fy2) b2 = 1 - b2; return [x + w * a, y + hh * b2]; };
      const poly = (pts: [number, number][]) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
      for (const q of goldenSquares(PHI, 1, 10)) {
        g.strokeStyle = 'rgba(255,255,255,.3)'; poly([M(q.x, q.y), M(q.x + q.s, q.y), M(q.x + q.s, q.y + q.s), M(q.x, q.y + q.s), M(q.x, q.y)]);
        const cs: [number, number, number][] = [[q.x + q.s, q.y + q.s, Math.PI], [q.x, q.y + q.s, -Math.PI / 2], [q.x, q.y, 0], [q.x + q.s, q.y, Math.PI / 2]];
        const [cx, cy, a0] = cs[q.k % 4], arc: [number, number][] = [];
        for (let i = 0; i <= 24; i++) { const a = a0 + (Math.PI / 2) * (i / 24); arc.push(M(cx + q.s * Math.cos(a), cy + q.s * Math.sin(a))); }
        g.strokeStyle = 'rgba(255,255,255,.9)'; poly(arc);
      }
    }
    g.restore();
  }
  function drawComp(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = '#141414'; g.fillRect(0, 0, W, H);
    const G = geom(W, H); paint(g, G);
    /* dim outside the frame */
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillRect(0, 0, W, G.fy); g.fillRect(0, G.fy + G.fh, W, H - G.fy - G.fh); g.fillRect(0, G.fy, G.fx, G.fh); g.fillRect(G.fx + G.fw, G.fy, W - G.fx - G.fw, G.fh);
    /* histogram of the picture inside the frame, read before the frame line and guides are drawn over it */
    let hist: ReturnType<typeof histogram> | null = null;
    try { const d = S.dpr, im = g.getImageData(Math.round(G.fx * d), Math.round(G.fy * d), Math.max(1, Math.round(G.fw * d)), Math.max(1, Math.round(G.fh * d))); hist = histogram(im.data); } catch { hist = null; }
    g.strokeStyle = '#fff'; g.lineWidth = 1; g.strokeRect(G.fx + .5, G.fy + .5, G.fw - 1, G.fh - 1);
    guides(g, G.fx, G.fy, G.fw, G.fh);
    if (hist && W > 360) {
      const hw = 150, hh = 60, hx = W - hw - 12, hy = H - hh - 12; let mx = 1; for (let i = 2; i < 254; i++) mx = Math.max(mx, hist.bins[i]);
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(hx - 6, hy - 6, hw + 12, hh + 12); g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 256; i++) { const v = Math.min(1, hist.bins[i] / mx); g.fillRect(hx + (i / 256) * hw, hy + hh - v * hh, hw / 256 + .4, v * hh); }
      if (hist.highClip > .01) { g.fillStyle = '#ff5d5d'; g.fillRect(hx + hw - 4, hy, 4, hh); } if (hist.lowClip > .01) { g.fillStyle = '#5d9bff'; g.fillRect(hx, hy, 4, hh); }
    }
    out('a', `${cfg.ratio} · ${rotDeg.toFixed(1)}°`);
    out('b', hist ? `${(hist.lowClip * 100).toFixed(1)}% / ${(hist.highClip * 100).toFixed(1)}%` : '—');
    const k = 1 / G.sc; out('c', `${Math.round(G.fw * k)} × ${Math.round(G.fh * k)} px`);
  }
  function exportPhoto(type: 'image/jpeg' | 'image/png') {
    const W = S.w, H = S.h, G = geom(W, H), k = Math.min(1 / G.sc, 4000 / G.fw);
    const c = document.createElement('canvas'); c.width = Math.round(G.fw * k); c.height = Math.round(G.fh * k); const g = c.getContext('2d'); if (!g) return;
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height); paint(g, G, k, G.fx, G.fy);
    c.toBlob((b) => { if (b) download(b, `abidora-crop-${cfg.ratio.replace(':', 'x')}.${type === 'image/png' ? 'png' : 'jpg'}`); }, type, .92);
  }
  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'w68-file' }) as HTMLInputElement;
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    if (f.size > 60 * 1024 * 1024) { L.hud.textContent = t('big', 'That file is too large (over 60 MB).'); return; }
    try { const bmp = await createImageBitmap(f); img = bmp; iw = bmp.width; ih = bmp.height; isSample = false; rotDeg = 0; zoom = 1; pan = { x: 0, y: 0 }; build(); draw(); L.hud.textContent = `${t('loaded', 'Loaded')}: ${iw} × ${ih} px · ${t('private', 'it stays on your device')}`; }
    catch { L.hud.textContent = t('bad', 'This file could not be opened as an image.'); }
  });

  function build() {
    box.replaceChildren(); L.hud.textContent = ''; L.view.classList.toggle('w68-comp', cfg.room === 'comp'); S.cv.style.touchAction = cfg.room === 'comp' ? 'none' : '';
    if (cfg.room === 'light') {
      about.textContent = t('ab.light', 'Photographers plan around the light. In the golden hour the Sun is low (between 4° below and 6° above the horizon), so light is warm, soft and long-shadowed; in the blue hour, just before sunrise and after sunset, the sky glows deep blue. Times are in the city\'s own clock and are worked out from the Sun\'s position; hills and buildings make the real sunrise later.');
      select(box, t('city', 'City'), CITIES.map((c, i) => [String(i), c[0]] as [string, string]), String(cfg.city), (v) => { cfg.city = +v; save(); compute(); draw(); });
      const id = 'w68d', inp = h('input', { type: 'date', id, value: new Date(Date.UTC(dY, dM, dD)).toISOString().slice(0, 10) }) as HTMLInputElement;
      inp.addEventListener('change', () => { const v = Date.parse(inp.value + 'T00:00:00Z'); if (!isNaN(v)) { const d = new Date(v); dY = d.getUTCFullYear(); dM = d.getUTCMonth(); dD = d.getUTCDate(); compute(); draw(); } });
      box.append(h('label', { class: 'wk-r', for: id }, h('span', { text: t('date', 'Date') }), inp));
      buttons(box, [[t('today', 'Today'), () => { const n = new Date(); dY = n.getFullYear(); dM = n.getMonth(); dD = n.getDate(); inp.value = new Date(Date.UTC(dY, dM, dD)).toISOString().slice(0, 10); compute(); draw(); }], [t('june', '21 June'), () => { dM = 5; dD = 21; inp.value = `${dY}-06-21`; compute(); draw(); }], [t('dec', '21 December'), () => { dM = 11; dD = 21; inp.value = `${dY}-12-21`; compute(); draw(); }]]);
      lab(t('st.rs', 'Sunrise / sunset'), t('st.golden', 'Golden hours'), t('st.high', 'Highest Sun'));
      compute();
    } else {
      about.textContent = t('ab.comp', 'Load a photo (it is read only in this browser and never uploaded) or use the sample. Choose a frame ratio, drag the picture to place it, zoom in, and straighten a tilted horizon. Guides show the rule of thirds, the golden ratio (lines at 38.2% and 61.8%), the golden spiral and diagonals. The histogram shows brightness inside the frame; red or blue edges warn of lost highlights or shadows.');
      box.append(h('label', { class: 'wk-r' }, h('span', { text: t('photo', 'Your photo') }), fileIn));
      select(box, t('ratio', 'Frame'), RATIOS.map(([k]) => [k, k === 'A4' ? t('a4', 'A-series paper (1:√2)') : k] as [string, string]), cfg.ratio, (v) => { cfg.ratio = v; save(); draw(); });
      select(box, t('guide', 'Guide'), [['thirds', t('g.thirds', 'Rule of thirds')], ['phi', t('g.phi', 'Golden ratio grid')], ['spiral', t('g.spiral', 'Golden spiral')], ['diag', t('g.diag', 'Diagonals')], ['none', t('g.none', 'None')]], cfg.guide, (v) => { cfg.guide = v; save(); draw(); });
      range(box, t('rot', 'Straighten'), { min: -15, max: 15, step: .1, value: rotDeg, fmt: (v) => `${v.toFixed(1)}°` }, (v) => { rotDeg = v; draw(); });
      range(box, t('zoom', 'Zoom'), { min: 1, max: 4, step: .01, value: zoom, fmt: (v) => `${v.toFixed(2)}×` }, (v) => { zoom = v; clampPan(); draw(); });
      buttons(box, [[t('turn', 'Turn the spiral'), () => { cfg.orient = (cfg.orient + 1) % 4; save(); draw(); }], [t('reset', 'Reset'), () => { rotDeg = 0; zoom = 1; pan = { x: 0, y: 0 }; build(); draw(); }]]);
      buttons(box, [[t('jpg', 'Download JPEG'), () => exportPhoto('image/jpeg'), true], [t('png', 'Download PNG'), () => exportPhoto('image/png')]]);
      if (!isSample) buttons(box, [[t('sample', 'Back to the sample'), () => { sample(); rotDeg = 0; zoom = 1; pan = { x: 0, y: 0 }; build(); draw(); }]]);
      lab(t('st.frame', 'Frame'), t('st.clip', 'Dark / bright clipping'), t('st.out', 'Export size'));
    }
  }
  /** keep the frame covered by the picture while panning */
  function clampPan() { const G = geom(S.w, S.h), th = Math.abs(rotDeg) * RAD, needW = G.fw * Math.cos(th) + G.fh * Math.sin(th), needH = G.fw * Math.sin(th) + G.fh * Math.cos(th); const mx = Math.max(0, (iw * G.sc - needW) / 2), my = Math.max(0, (ih * G.sc - needH) / 2); pan.x = clamp(pan.x, -mx, mx); pan.y = clamp(pan.y, -my, my); }
  let drag: { x: number; y: number; px: number; py: number } | null = null;
  S.cv.addEventListener('pointerdown', (e) => { if (cfg.room !== 'comp') return; const p = local(e, S.cv); S.cv.setPointerCapture(e.pointerId); drag = { x: p.x, y: p.y, px: pan.x, py: pan.y }; });
  S.cv.addEventListener('pointermove', (e) => { if (!drag) return; const p = local(e, S.cv); pan = { x: drag.px + p.x - drag.x, y: drag.py + p.y - drag.y }; clampPan(); draw(); });
  const up = () => { drag = null; }; S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('wheel', (e) => { if (cfg.room !== 'comp') return; e.preventDefault(); zoom = clamp(zoom * (e.deltaY < 0 ? 1.06 : 1 / 1.06), 1, 4); clampPan(); const r = L.panel.querySelectorAll('input[type=range]')[1] as HTMLInputElement | undefined; if (r) { r.value = String(zoom); r.dispatchEvent(new Event('input')); } else draw(); }, { passive: false });

  let raf = 0;
  function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const g = S.g; if (cfg.room === 'light') drawLight(g, S.w, S.h); else drawComp(g, S.w, S.h); }); }
  ctx.onDispose(() => { cancelAnimationFrame(raf); if (img && 'close' in (img as ImageBitmap)) try { (img as ImageBitmap).close(); } catch { /* ignore */ } });
  S.onResize(draw);
  build(); draw();
}
