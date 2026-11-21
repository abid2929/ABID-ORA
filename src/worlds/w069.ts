/* 069 Famous Landmarks. Real landmarks compared honestly, drawn in code (no borrowed photos):
   · Skyline to scale: pick landmarks and see them side by side at their true heights next to a person,
     in metres or feet, with the year each was finished. Outlines are simplified; heights are to scale.
   · View from the top: how far you can see from each landmark's highest public viewpoint (Earth's curve,
     with and without normal air refraction), how far away its tip can be seen from a given eye height,
     and the great-circle distance, compass direction and local time from your city. */
import { type Ctx, h, layout, canvas, heading, note, seg, select, range, stats, check, clamp, store, local } from './kit';
import { haversine, bearing, CITIES, R_EARTH } from './geo';

export type Shape = 'pyramid' | 'lattice' | 'spire' | 'needle' | 'twin' | 'statue' | 'clock' | 'lean' | 'shells' | 'arena' | 'dome' | 'deco' | 'memorial' | 'christ';
/** id, name, height to tip (m), highest public viewpoint above ground (m), ground elevation (m), year finished, city, lat, lon, IANA zone, outline, drawn base width (m) */
export type Landmark = { id: string; name: string; h: number; view: number; ground: number; year: number; city: string; lat: number; lon: number; tz: string; shape: Shape; w: number };
export const LANDMARKS: Landmark[] = [
  { id: 'burj', name: 'Burj Khalifa', h: 828, view: 555, ground: 0, year: 2010, city: 'Dubai', lat: 25.1972, lon: 55.2744, tz: 'Asia/Dubai', shape: 'spire', w: 90 },
  { id: 'sky', name: 'Tokyo Skytree', h: 634, view: 450, ground: 0, year: 2012, city: 'Tokyo', lat: 35.7101, lon: 139.8107, tz: 'Asia/Tokyo', shape: 'needle', w: 68 },
  { id: 'cn', name: 'CN Tower', h: 553, view: 447, ground: 0, year: 1976, city: 'Toronto', lat: 43.6426, lon: -79.3871, tz: 'America/Toronto', shape: 'needle', w: 60 },
  { id: 'petronas', name: 'Petronas Towers', h: 452, view: 370, ground: 0, year: 1998, city: 'Kuala Lumpur', lat: 3.1579, lon: 101.7116, tz: 'Asia/Kuala_Lumpur', shape: 'twin', w: 140 },
  { id: 'empire', name: 'Empire State Building', h: 443, view: 373, ground: 0, year: 1931, city: 'New York', lat: 40.7484, lon: -73.9857, tz: 'America/New_York', shape: 'deco', w: 130 },
  { id: 'eiffel', name: 'Eiffel Tower', h: 330, view: 276, ground: 0, year: 1889, city: 'Paris', lat: 48.8584, lon: 2.2945, tz: 'Europe/Paris', shape: 'lattice', w: 125 },
  { id: 'giza', name: 'Great Pyramid of Giza', h: 138.5, view: 0, ground: 0, year: -2560, city: 'Giza', lat: 29.9792, lon: 31.1342, tz: 'Africa/Cairo', shape: 'pyramid', w: 230 },
  { id: 'bigben', name: 'Elizabeth Tower (Big Ben)', h: 96, view: 0, ground: 0, year: 1859, city: 'London', lat: 51.5007, lon: -0.1246, tz: 'Europe/London', shape: 'clock', w: 12 },
  { id: 'liberty', name: 'Statue of Liberty', h: 93, view: 82, ground: 0, year: 1886, city: 'New York', lat: 40.6892, lon: -74.0445, tz: 'America/New_York', shape: 'statue', w: 28 },
  { id: 'taj', name: 'Taj Mahal', h: 73, view: 0, ground: 0, year: 1653, city: 'Agra', lat: 27.1751, lon: 78.0421, tz: 'Asia/Kolkata', shape: 'dome', w: 95 },
  { id: 'opera', name: 'Sydney Opera House', h: 65, view: 0, ground: 0, year: 1973, city: 'Sydney', lat: -33.8568, lon: 151.2153, tz: 'Australia/Sydney', shape: 'shells', w: 183 },
  { id: 'pisa', name: 'Leaning Tower of Pisa', h: 57, view: 56, ground: 0, year: 1372, city: 'Pisa', lat: 43.7230, lon: 10.3966, tz: 'Europe/Rome', shape: 'lean', w: 16 },
  { id: 'colosseum', name: 'Colosseum', h: 48, view: 0, ground: 0, year: 80, city: 'Rome', lat: 41.8902, lon: 12.4922, tz: 'Europe/Rome', shape: 'arena', w: 189 },
  { id: 'smriti', name: 'National Martyrs’ Memorial', h: 45.7, view: 0, ground: 0, year: 1982, city: 'Savar', lat: 23.9113, lon: 90.2547, tz: 'Asia/Dhaka', shape: 'memorial', w: 40 },
  { id: 'christ', name: 'Christ the Redeemer', h: 38, view: 8, ground: 700, year: 1931, city: 'Rio de Janeiro', lat: -22.9519, lon: -43.2105, tz: 'America/Sao_Paulo', shape: 'christ', w: 28 },
];
export const PERSON = 1.7;
export const FT = 3.28084;
/** distance to the sea-level horizon from eye height h metres (km). k = 1 is pure geometry; k ≈ 7/6 models normal air refraction. */
export function horizonKm(h: number, k = 1) { if (h <= 0) return 0; const R = R_EARTH * k, hk = h / 1000; return Math.sqrt(2 * R * hk + hk * hk); }
/** the farthest distance (km) at which a tip at height a can just be seen by an eye at height b, over a smooth sea */
export function mutualKm(a: number, b: number, k = 1) { return horizonKm(a, k) + horizonKm(b, k); }
/** how much of an object at distance d km is hidden below the horizon for an eye at height b (m) */
export function hiddenM(d: number, b: number, k = 1) { const R = R_EARTH * k * 1000, dh = horizonKm(b, k) * 1000, x = d * 1000 - dh; if (x <= 0) return 0; return Math.sqrt(R * R + x * x) - R; }
export const yearText = (y: number, bce: string, ce: string) => (y < 0 ? `≈ ${-y} ${bce}` : y < 1000 ? `${ce} ${y}` : String(y));

export default function (ctx: Ctx) {
  const t = ctx.t, lang = ctx.lang;
  const L = layout(ctx);
  L.view.classList.add('w69');
  L.view.style.minHeight = 'clamp(420px, 58vw, 640px)';
  const S = canvas(L.view, t('cv', 'Famous landmarks drawn side by side at their true heights, or the view from the top.'), { alpha: false });
  type Cfg = { room: 'scale' | 'view'; pick: string[]; ft: boolean; lm: string; home: number; eye: number; refr: boolean };
  const def: Cfg = { room: 'scale', pick: ['burj', 'eiffel', 'giza', 'taj', 'smriti', 'liberty'], ft: false, lm: 'burj', home: 0, eye: 1.7, refr: true };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'room' in v && Array.isArray((v as Cfg).pick));
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);
  cfg.pick = cfg.pick.filter((id) => LANDMARKS.some((l) => l.id === id));
  const nm = (l: Landmark) => t('n.' + l.id, l.name);
  const fmtH = (m: number) => (cfg.ft ? `${Math.round(m * FT).toLocaleString(lang)} ft` : `${(Math.round(m * 10) / 10).toLocaleString(lang)} m`);
  const fmtKm = (km: number) => `${Math.round(km).toLocaleString(lang)} km`;
  const yr = (y: number) => yearText(y, t('bce', 'BCE'), t('ce', 'AD'));
  let hover = -1, boxes: { x0: number; x1: number; i: number }[] = [];

  heading(L.panel, t('h', 'Landmark lab'));
  seg(L.panel, t('room', 'View'), [['scale', t('r.scale', 'Skyline to scale')], ['view', t('r.view', 'View from the top')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); build(); draw(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.room === 'scale') {
      about.textContent = t('ab.scale', 'Each landmark is drawn at its real height to the tip, on the same ground line, with a 1.7 m person for scale. Outlines are simplified and widths are approximate. Tick landmarks to add or remove them; hover or tap one for its facts.');
      const list = h('fieldset', { class: 'w69-list' }, h('legend', { text: t('pick', 'Landmarks') }));
      for (const l of LANDMARKS) {
        const id = `w69-${l.id}`, inp = h('input', { type: 'checkbox', id }) as HTMLInputElement; inp.checked = cfg.pick.includes(l.id);
        inp.addEventListener('change', () => { cfg.pick = LANDMARKS.filter((x) => (x.id === l.id ? inp.checked : cfg.pick.includes(x.id))).map((x) => x.id); save(); draw(); });
        list.append(h('label', { for: id }, inp, h('span', { text: `${nm(l)} · ${fmtH(l.h)}` })));
      }
      box.append(list);
      check(box, t('ft', 'Show feet'), cfg.ft, (v) => { cfg.ft = v; save(); build(); draw(); });
      lab(t('st.tall', 'Tallest shown'), t('st.ratio', 'Tallest ÷ shortest'), t('st.sel', 'Selected'));
    } else {
      about.textContent = t('ab.view', 'From high up you see farther, because the Earth curves away. The table uses each landmark’s highest public viewpoint. Air bends light slightly downward, so you normally see about 7% farther than pure geometry says. The last line is how far away the tip could just be seen over a calm sea by someone at the eye height you set.');
      select(box, t('lm', 'Landmark'), LANDMARKS.map((l) => [l.id, nm(l)] as [string, string]), cfg.lm, (v) => { cfg.lm = v; save(); draw(); });
      select(box, t('home', 'Your city'), CITIES.map((c, i) => [String(i), c[0]] as [string, string]), String(cfg.home), (v) => { cfg.home = +v; save(); draw(); });
      range(box, t('eye', 'Your eye height'), { min: 0, max: 3, step: .01, value: Math.log10(clamp(cfg.eye, 1, 1000)), fmt: (v) => fmtH(10 ** v) }, (v) => { cfg.eye = Math.round(10 ** v * 10) / 10; save(); draw(); });
      check(box, t('refr', 'Include air refraction'), cfg.refr, (v) => { cfg.refr = v; save(); draw(); });
      check(box, t('ft', 'Show feet'), cfg.ft, (v) => { cfg.ft = v; save(); build(); draw(); });
      lab(t('st.hor', 'Horizon from the top'), t('st.see', 'Tip visible from up to'), t('st.dist', 'From your city'));
    }
  }

  /* ---------- outlines (unit: metres, origin at base centre, y up) ---------- */
  function outline(g: CanvasRenderingContext2D, l: Landmark, s: number, x: number, y: number, fill: string, line: string, q = 1) {
    const H = l.h * s, W = l.w * s, P = (px: number, py: number) => [x + px * s * q, y - py * s] as const;
    const poly = (pts: [number, number][]) => { g.beginPath(); pts.forEach(([a, b], i) => { const [X, Y] = P(a, b); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fill(); g.stroke(); };
    const rect = (x0: number, y0: number, w: number, hh: number) => poly([[x0, y0], [x0 + w, y0], [x0 + w, y0 + hh], [x0, y0 + hh]]);
    g.fillStyle = fill; g.strokeStyle = line; g.lineWidth = 1; const h0 = l.h, w0 = l.w;
    switch (l.shape) {
      case 'pyramid': poly([[-w0 / 2, 0], [w0 / 2, 0], [0, h0]]); break;
      case 'lattice': {
        poly([[-w0 / 2, 0], [-w0 * .3, 0], [-w0 * .12, 57], [w0 * .12, 57], [w0 * .3, 0], [w0 / 2, 0], [w0 * .2, 57], [w0 * .14, 116], [w0 * .045, 276], [w0 * .03, 300], [0, h0], [-w0 * .03, 300], [-w0 * .045, 276], [-w0 * .14, 116], [-w0 * .2, 57]]);
        g.beginPath(); const [ax, ay] = P(-w0 * .3, 0), [bx, by] = P(w0 * .3, 0), [cx, cy] = P(0, 40); g.moveTo(ax, ay); g.quadraticCurveTo(cx, cy - 30 * s, bx, by); g.fillStyle = '#0b1020'; g.fill(); g.fillStyle = fill;
        for (const lv of [57, 116, 276]) { const [a, b] = P(-w0 * .3, lv), [c] = P(w0 * .3, lv); g.beginPath(); g.moveTo(a, b); g.lineTo(c, b); g.stroke(); }
        break;
      }
      case 'spire': { const steps = [1, .82, .62, .45, .3, .16], ys = [0, 150, 300, 450, 560, 620, 640], right: [number, number][] = [];
        steps.forEach((f, i) => { right.push([w0 / 2 * f, ys[i]], [w0 / 2 * f, ys[i + 1]]); });
        poly([...right, [w0 * .03, 640], [0, h0], [-w0 * .03, 640], ...right.slice().reverse().map(([a, b2]) => [-a, b2] as [number, number])]); break; }
      case 'needle': { const pod = l.id === 'cn' ? 342 : 340, pod2 = l.id === 'cn' ? 447 : 450, top = l.id === 'cn' ? 457 : 495;
        poly([[-w0 / 2, 0], [w0 / 2, 0], [w0 * .1, pod], [w0 * .1, top], [w0 * .02, top], [0, h0], [-w0 * .02, top], [-w0 * .1, top], [-w0 * .1, pod]]);
        rect(-w0 * .33, pod, w0 * .66, 25); rect(-w0 * .2, pod2 - 6, w0 * .4, 12); break; }
      case 'twin': for (const sx of [-1, 1]) { const cx = sx * w0 * .3; poly([[cx - 22, 0], [cx + 22, 0], [cx + 22, 300], [cx + 15, 300], [cx + 15, 375], [cx + 8, 375], [cx + 8, 400], [cx + 2, 400], [cx, h0], [cx - 2, 400], [cx - 8, 400], [cx - 8, 375], [cx - 15, 375], [cx - 15, 300], [cx - 22, 300]]); } rect(-w0 * .3 + 15, 170, w0 * .6 - 30, 6); break;
      case 'deco': poly([[-w0 / 2, 0], [w0 / 2, 0], [w0 / 2, 25], [w0 * .3, 25], [w0 * .3, 260], [w0 * .2, 260], [w0 * .2, 320], [w0 * .1, 320], [w0 * .1, 381], [w0 * .04, 381], [w0 * .015, 420], [0, h0], [-w0 * .015, 420], [-w0 * .04, 381], [-w0 * .1, 381], [-w0 * .1, 320], [-w0 * .2, 320], [-w0 * .2, 260], [-w0 * .3, 260], [-w0 * .3, 25], [-w0 / 2, 25]]); break;
      case 'clock': poly([[-6, 0], [6, 0], [6, 55], [7, 55], [7, 70], [5, 70], [3, 85], [0, h0], [-3, 85], [-5, 70], [-7, 70], [-7, 55], [-6, 55]]); { const [cx, cy] = P(0, 62); g.beginPath(); g.arc(cx, cy, Math.max(1, 4.5 * s), 0, 7); g.fillStyle = '#f5e6b8'; g.fill(); g.fillStyle = fill; } break;
      case 'statue': poly([[-14, 0], [14, 0], [14, 14], [9, 14], [9, 47], [4, 47], [4, 72], [3, 80], [1.8, 80], [1.8, 89], [3.5, 93], [0.5, 93], [0.8, 89], [-1, 80], [-3, 80], [-4, 72], [-4, 47], [-9, 47], [-9, 14], [-14, 14]]); break;
      case 'dome': rect(-w0 / 2, 0, w0, 7); for (const sx of [-1, 1]) { rect(sx * w0 * .46 - 2, 7, 4, 40); } poly([[-28, 7], [28, 7], [28, 35], [-28, 35]]); { const [cx, cy] = P(0, 35); g.beginPath(); g.moveTo(cx - 14 * s, cy); g.bezierCurveTo(cx - 22 * s, cy - 18 * s, cx - 6 * s, cy - 30 * s, cx, cy - (h0 - 35) * s); g.bezierCurveTo(cx + 6 * s, cy - 30 * s, cx + 22 * s, cy - 18 * s, cx + 14 * s, cy); g.closePath(); g.fill(); g.stroke(); } break;
      case 'shells': for (const [ox, hh, ww] of [[-60, 45, 50], [-15, 55, 55], [35, h0, 60], [70, 40, 40]] as const) { poly([[ox - ww / 2, 0], [ox + ww / 2, 0], [ox + ww * .1, hh], [ox - ww * .25, hh * .55]]); } rect(-w0 / 2, 0, w0, 6); break;
      case 'arena': { const [x0, y0] = P(-w0 / 2, 0), [x1] = P(w0 / 2, 0), [, y1] = P(0, h0); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + 6 * s, y1 + 8 * s); g.quadraticCurveTo((x0 + x1) / 2, y1 - 4 * s, x1 - 50 * s, y1); g.lineTo(x1, y0 - 25 * s); g.lineTo(x1, y0); g.closePath(); g.fill(); g.stroke();
        g.fillStyle = '#0b1020'; for (let r = 0; r < 3; r++) for (let i = 0; i < 12; i++) { const ax = -w0 / 2 + 10 + i * 13.5, ay = 3 + r * 11.5; if (ax > w0 / 2 - 50 && r > 0) continue; const [px, py] = P(ax, ay); g.fillRect(px, py - 7 * s, 5 * s, 7 * s); } g.fillStyle = fill; break; }
      case 'lean': { g.save(); const [bx, by] = P(0, 0); g.translate(bx, by); g.rotate(4 * Math.PI / 180); g.translate(-bx, -by); rect(-8, 0, 16, 50); rect(-6.5, 50, 13, 7); for (let k = 1; k < 7; k++) { const [a, b] = P(-8, k * 7.5), [c] = P(8, 0); g.beginPath(); g.moveTo(a, b); g.lineTo(c, b); g.stroke(); } g.restore(); break; }
      case 'memorial': for (let k = 0; k < 7; k++) { const f = 0.3 + k * .7 / 6, hh = h0 * f, ww = w0 * (0.35 + f * .65) / 2, off = (k - 3) * 0; poly([[off - ww, 0], [off + ww, 0], [off, hh]]); } break;
      case 'christ': { const gr = l.ground; void gr; poly([[-4, 0], [4, 0], [4, 8], [2.5, 8], [2.5, 26], [14, 27], [14, 28.5], [2.5, 29], [1.6, 30], [1.6, 33], [0, 34.5], [-1.6, 33], [-1.6, 30], [-2.5, 29], [-14, 28.5], [-14, 27], [-2.5, 26], [-2.5, 8], [-4, 8]]); { const [hx, hy] = P(0, 36); g.beginPath(); g.arc(hx, hy, Math.max(1, 2 * s), 0, 7); g.fill(); } break; }
    }
    void H; void W;
  }
  function person(g: CanvasRenderingContext2D, s: number, x: number, y: number) {
    const hp = PERSON * s; g.fillStyle = '#ffd166'; g.fillRect(x - Math.max(1, hp * .12), y - hp * .82, Math.max(2, hp * .24), hp * .82); g.beginPath(); g.arc(x, y - hp * .9, Math.max(1, hp * .1), 0, 7); g.fill();
  }

  function drawScale(g: CanvasRenderingContext2D, W: number, Hh: number) {
    const sky = g.createLinearGradient(0, 0, 0, Hh); sky.addColorStop(0, '#0b1020'); sky.addColorStop(1, '#1d2a44'); g.fillStyle = sky; g.fillRect(0, 0, W, Hh);
    const list = LANDMARKS.filter((l) => cfg.pick.includes(l.id));
    const m = { l: 52, r: 16, t: 30, b: 64 }, ground = Hh - m.b;
    if (!list.length) { g.fillStyle = '#cfd6e4'; g.font = '14px ui-sans-serif, system-ui'; g.fillText(t('none', 'Tick at least one landmark.'), m.l, Hh / 2); out('a', '—'); out('b', '—'); out('c', '—'); boxes = []; return; }
    const maxH = Math.max(...list.map((l) => l.h)), gap = 14;
    const totalW = list.reduce((a, l) => a + l.w, 0);
    /* heights always fill the chart; when the row is too wide for the screen, outlines are narrowed (never shortened) */
    const s = (ground - m.t) / maxH, q = Math.min(1, (W - m.l - m.r - gap * (list.length + 1)) / (totalW * s));
    /* grid */
    const step = [10, 20, 50, 100, 200][[10, 20, 50, 100, 200].findIndex((v) => maxH / v <= 9)] ?? 200;
    g.font = '11px ui-monospace, monospace'; g.textAlign = 'right';
    for (let v = 0; v <= maxH + 1; v += step) { const y = ground - v * s; g.strokeStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(m.l, y); g.lineTo(W - m.r, y); g.stroke(); g.fillStyle = '#8f9bb3'; g.fillText(cfg.ft ? `${Math.round(v * FT)}` : `${v}`, m.l - 6, y + 4); }
    g.textAlign = 'left'; g.fillText(cfg.ft ? 'ft' : 'm', 6, m.t - 10);
    g.fillStyle = '#2c3a28'; g.fillRect(0, ground, W, Hh - ground);
    const used = list.reduce((a, l) => a + l.w * s * q, 0), pad = (W - m.l - m.r - used) / (list.length + 1);
    let x = m.l + pad; boxes = [];
    list.forEach((l, i) => {
      const lw = l.w * s * q, cx = x + lw / 2, on = hover === i, slot = lw + pad;
      outline(g, l, s, cx, ground, on ? '#e9c46a' : '#b8c4dc', on ? '#fff' : 'rgba(255,255,255,.5)', q);
      boxes.push({ x0: x - pad / 2, x1: x + lw + pad / 2, i });
      g.fillStyle = on ? '#fff' : '#cfd6e4'; g.font = `${on ? '600 ' : ''}11px ui-sans-serif, system-ui`; g.textAlign = 'center';
      const top = ground - l.h * s - 6; if (slot >= 34 || on) g.fillText(fmtH(l.h), cx, Math.max(m.t + 10, top));
      const label = nm(l), room = Math.floor((slot * 2 - 8) / 6.2), short = label.length > room ? label.slice(0, Math.max(1, room - 1)) + '…' : label;
      if (room >= 6 || on) g.fillText(on ? label : short, clamp(cx, m.l + 40, W - 40), ground + 16 + (on ? 28 : (i % 2) * 14));
      x += lw + pad;
    });
    g.textAlign = 'left';
    person(g, s, m.l + 4, ground);
    if (q < .999) { g.fillStyle = '#8f9bb3'; g.font = '11px ui-sans-serif, system-ui'; g.fillText(t('narrow', 'Narrowed to fit; heights are true.'), m.l, Hh - 8); }
    const hi = list.reduce((a, b) => (b.h > a.h ? b : a)), lo = list.reduce((a, b) => (b.h < a.h ? b : a));
    out('a', `${nm(hi)} · ${fmtH(hi.h)}`); out('b', list.length > 1 ? `${(hi.h / lo.h).toLocaleString(lang, { maximumFractionDigits: 1 })}×` : '—');
    const sel = hover >= 0 ? list[hover] : hi;
    out('c', `${nm(sel)} · ${yr(sel.year)}`);
    L.hud.textContent = `${nm(sel)} — ${sel.city} · ${t('fin', 'finished')} ${yr(sel.year)} · ${fmtH(sel.h)} · ≈ ${Math.round(sel.h / PERSON).toLocaleString(lang)} ${t('ppl', 'people standing on each other')}`;
  }

  function drawView(g: CanvasRenderingContext2D, W: number, Hh: number) {
    const l = LANDMARKS.find((x) => x.id === cfg.lm) ?? LANDMARKS[0], k = cfg.refr ? 7 / 6 : 1;
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, Hh);
    const top = l.ground + (l.view || l.h);
    const hor = horizonKm(top, k), see = mutualKm(l.ground + l.h, cfg.eye, k);
    /* side view: the Earth's curve exaggerated 40× in height so the drop is visible; everything labelled with true numbers */
    const m = { l: 30, r: 30, t: 50, b: 70 }, pw = W - m.l - m.r, ph = Hh - m.t - m.b;
    const span = Math.max(see, hor) * 1.12, sx = pw / span, ex = 40;
    const drop = (km: number) => (km * km) / (2 * R_EARTH * k) * 1000; /* metres below the tangent plane */
    const hiM = (l.ground + l.h) * 1.1, loM = -drop(span), sy = ph / (hiM - loM);
    const X = (km: number) => m.l + km * sx, Y = (mm: number) => m.t + (hiM - mm) * sy;
    const base = (km: number) => Y(-drop(km));
    g.beginPath(); g.moveTo(X(0), base(0)); for (let i = 1; i <= 120; i++) { const d = (span * i) / 120; g.lineTo(X(d), base(d)); } g.lineTo(W, Hh); g.lineTo(0, Hh); g.closePath();
    const sea = g.createLinearGradient(0, base(0), 0, Hh); sea.addColorStop(0, '#1f4e79'); sea.addColorStop(1, '#0d2238'); g.fillStyle = sea; g.fill();
    /* landmark as a bar */
    if (l.ground > 0) { g.fillStyle = '#3d5a3a'; g.beginPath(); g.moveTo(X(0), base(0)); g.lineTo(X(0), Y(l.ground)); g.lineTo(X(0) + 26, base(0)); g.closePath(); g.fill(); }
    g.fillStyle = '#e9c46a'; g.fillRect(X(0) - 1, Y(l.ground + l.h), 6, Y(l.ground) - Y(l.ground + l.h) + 1);
    /* sight line to the horizon */
    g.strokeStyle = '#ffd166'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(0), Y(top)); g.lineTo(X(hor), base(hor)); g.stroke();
    /* observer far away */
    g.strokeStyle = '#7fd1ff'; g.beginPath(); g.moveTo(X(see), base(see) - cfg.eye * sy); g.lineTo(X(0), Y(l.ground + l.h)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#7fd1ff'; g.beginPath(); g.arc(X(see), base(see) - cfg.eye * sy, 4, 0, 7); g.fill();
    g.fillStyle = '#ffd166'; g.beginPath(); g.arc(X(hor), base(hor), 4, 0, 7); g.fill();
    g.font = '12px ui-sans-serif, system-ui'; g.fillStyle = '#e8ecf4';
    g.fillText(`${nm(l)} · ${fmtH(l.h)}${l.ground ? ` + ${fmtH(l.ground)} ${t('hill', 'hill')}` : ''}`, m.l, 24);
    g.fillStyle = '#ffd166'; g.fillText(`${t('horizon', 'horizon')} ${fmtKm(hor)}`, clamp(X(hor) - 40, m.l, W - 150), base(hor) + 22);
    g.fillStyle = '#7fd1ff'; g.fillText(`${t('you', 'you')} ${fmtKm(see)}`, clamp(X(see) - 60, m.l, W - 120), Math.min(Hh - 30, base(see) - cfg.eye * sy - 12));
    g.fillStyle = '#8f9bb3'; g.font = '11px ui-sans-serif, system-ui'; g.fillText(t('exag', 'Heights exaggerated; distances to scale.'), m.l, Hh - 12); void ex;
    const c = CITIES[cfg.home], d = haversine(c[1], c[2], l.lat, l.lon), b = bearing(c[1], c[2], l.lat, l.lon);
    const lt = new Date().toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', timeZone: l.tz });
    out('a', l.view || l.ground ? `${fmtKm(hor)} (${fmtH(top)})` : t('noview', 'no public viewpoint'));
    out('b', fmtKm(see)); out('c', `${fmtKm(d)} · ${Math.round(b)}°`);
    L.hud.textContent = `${c[0]} → ${l.city}: ${fmtKm(d)}, ${t('head', 'heading')} ${Math.round(b)}° · ${t('lt', 'local time there')} ${lt}`;
  }

  S.cv.addEventListener('pointermove', (e) => { if (cfg.room !== 'scale') return; const p = local(e, S.cv); const hit = boxes.find((bx) => p.x >= bx.x0 && p.x < bx.x1); const nh = hit ? hit.i : -1; if (nh !== hover) { hover = nh; draw(); } });
  S.cv.addEventListener('pointerleave', () => { if (hover !== -1) { hover = -1; draw(); } });
  S.cv.addEventListener('click', (e) => { if (cfg.room !== 'scale') return; const p = local(e, S.cv); const hit = boxes.find((bx) => p.x >= bx.x0 && p.x < bx.x1); hover = hit ? hit.i : -1; draw(); });

  let raf = 0;
  function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; if (cfg.room === 'scale') drawScale(S.g, S.w, S.h); else drawView(S.g, S.w, S.h); }); }
  ctx.onDispose(() => cancelAnimationFrame(raf));
  S.onResize(draw);
  build(); draw();
}
