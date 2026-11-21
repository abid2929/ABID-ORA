/* 054 Infinite Zoom Gallery. Two kinds of picture that never run out.
   The fractal wing: a live Mandelbrot explorer. Every pixel is computed from z → z² + c, so zooming
   reveals new detail all the way down to the limit of ordinary 64-bit numbers (about 10¹³×), which
   the world states honestly instead of faking. Fly to famous places, see the Julia set that belongs
   to the point you are looking at, cycle the colours, keep views and download them.
   The Droste wing: a picture that contains itself. Paint on a scene, place a frame, and the scene is
   repeated inside the frame forever; tilt the frame and the repeats become a spiral. Paint strokes
   land on every copy at once, the zoom loops seamlessly, and the loop can be recorded as a video. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, select, stats, buttons, color, local, loop, clamp, store, download } from './kit';

/* ---------- fractal maths ---------- */
/** smooth escape count for c = (cx, cy); -1 inside the set */
export function mandel(cx: number, cy: number, max: number) {
  const q = (cx - .25) ** 2 + cy * cy;
  if (q * (q + (cx - .25)) <= .25 * cy * cy || (cx + 1) ** 2 + cy * cy <= .0625) return -1; /* main cardioid, period-2 bulb */
  let x = 0, y = 0;
  for (let i = 0; i < max; i++) {
    const xx = x * x, yy = y * y;
    if (xx + yy > 256) return i + 1 - Math.log2(Math.log2(xx + yy) / 2);
    y = 2 * x * y + cy; x = xx - yy + cx;
  }
  return -1;
}
export function julia(zx: number, zy: number, cx: number, cy: number, max: number) {
  let x = zx, y = zy;
  for (let i = 0; i < max; i++) {
    const xx = x * x, yy = y * y;
    if (xx + yy > 256) return i + 1 - Math.log2(Math.log2(xx + yy) / 2);
    y = 2 * x * y + cy; x = xx - yy + cx;
  }
  return -1;
}
/** a view: centre (cx, cy) and r = half the stage height in complex units */
export interface View { cx: number; cy: number; r: number }
export const HOME: View = { cx: -.6, cy: 0, r: 1.25 };
/** deepest r before 64-bit numbers can no longer tell neighbouring pixels apart */
export const MIN_R = 1e-13;
export const maxIterFor = (r: number, detail = 1) => Math.round(clamp((160 + 70 * Math.log2(Math.max(1, HOME.r / r))) * detail, 80, 6000));
/** complex point under stage pixel (px, py) */
export function toC(v: View, px: number, py: number, W: number, H: number): [number, number] { const k = 2 * v.r / H; return [v.cx + (px - W / 2) * k, v.cy - (py - H / 2) * k]; }
/** zoom by factor f (>1 = in) keeping the point under (px, py) fixed on screen */
export function zoomAt(v: View, px: number, py: number, f: number, W: number, H: number): View {
  const [zx, zy] = toC(v, px, py, W, H), r = clamp(v.r / f, MIN_R, 3);
  const s = r / v.r; return { cx: zx + (v.cx - zx) * s, cy: zy + (v.cy - zy) * s, r };
}
/** smooth flight between two views: a similarity motion that holds one point still, so the zoom feels like a straight dive */
export function flight(a: View, b: View) {
  const ratio = b.r / a.r;
  if (Math.abs(Math.log(ratio)) < 1e-9) return (u: number): View => ({ cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, r: a.r });
  const px = (b.cx - a.cx * ratio) / (1 - ratio), py = (b.cy - a.cy * ratio) / (1 - ratio);
  return (u: number): View => { const e = u < .5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2, r = a.r * ratio ** e, s = r / a.r; return { cx: px + (a.cx - px) * s, cy: py + (a.cy - py) * s, r }; };
}
export const LOCS: { id: string; en: string; v: View }[] = [
  { id: 'seahorse', en: 'Seahorse Valley, 10¹¹× deep', v: { cx: -.743643887037151, cy: .13182590420533, r: 5e-12 } },
  { id: 'mini', en: 'A small copy of the whole set', v: { cx: -1.7548776662, cy: 0, r: .012 } },
  { id: 'spiral', en: 'Spiral arms at the top', v: { cx: -.10109636384562, cy: .95628651080914, r: 2e-6 } },
  { id: 'double', en: 'Double spiral', v: { cx: -.7746806106269039, cy: -.1374168856037867, r: 1e-6 } },
  { id: 'elephant', en: 'Elephant Valley', v: { cx: .2549870375144766, cy: -.0005679790528465, r: 1e-9 } },
  { id: 'tendril', en: 'Tendrils between the bulbs', v: { cx: -1.25066, cy: .02012, r: 2e-4 } },
];
/* cosine palettes: rgb = a + b·cos(2π(c·t + d)) */
export const PALS: Record<string, number[][]> = {
  ember: [[.5, .5, .5], [.5, .5, .5], [1, 1, 1], [0, .1, .2]],
  ocean: [[.5, .5, .5], [.5, .5, .5], [1, 1, .5], [.8, .9, .3]],
  aurora: [[.5, .5, .5], [.5, .5, .5], [1, .7, .4], [0, .15, .2]],
  ink: [[.62, .6, .56], [.38, .38, .38], [1, 1, 1], [0, 0, 0]],
};
export function palColor(p: number[][], t: number): [number, number, number] {
  const o: number[] = []; for (let k = 0; k < 3; k++) o.push(clamp(255 * (p[0][k] + p[1][k] * Math.cos(6.2831853 * (p[2][k] * t + p[3][k]))), 0, 255));
  return o as [number, number, number];
}

/* ---------- Droste maths: 2-D affine maps in canvas order [a, b, c, d, e, f] ---------- */
export type Aff = [number, number, number, number, number, number];
export const mul = (m: Aff, n: Aff): Aff => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const app = (m: Aff, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export function inv(m: Aff): Aff { const d = m[0] * m[3] - m[1] * m[2]; const a = m[3] / d, b = -m[1] / d, c = -m[2] / d, e = m[0] / d; return [a, b, c, e, -(a * m[4] + c * m[5]), -(b * m[4] + e * m[5])]; }
/** the frame: centre (x, y), side w (fraction of the picture), angle a (radians) */
export interface Frame { x: number; y: number; w: number; a: number }
/** T maps the whole picture (unit square) onto the frame's inside */
export function frameT(F: Frame): Aff { const c = Math.cos(F.a) * F.w, s = Math.sin(F.a) * F.w; return [c, s, -s, c, F.x - (c * .5 - s * .5), F.y - (s * .5 + c * .5)]; }
/** the one point that T leaves where it is: the centre of the endless zoom */
export function fixedPoint(F: Frame): [number, number] { const T = frameT(F); const a = 1 - T[0], b = -T[2], c = -T[1], d = 1 - T[3], det = a * d - b * c; return [(d * T[4] - b * T[5]) / det, (-c * T[4] + a * T[5]) / det]; }
/** the view at loop phase t ∈ [0, 1): zoom (and turn) about the fixed point by T^(−t); at t = 1 it equals T⁻¹ */
export function viewAt(F: Frame, t: number): Aff {
  const [px, py] = fixedPoint(F), q = F.w ** -t, an = -F.a * t, c = Math.cos(an) * q, s = Math.sin(an) * q;
  return [c, s, -s, c, px - (c * px - s * py), py - (s * px + c * py)];
}
/** true when picture point (x, y) lies inside the frame's opening */
export function inFrame(F: Frame, x: number, y: number) { const [u, v] = app(inv(frameT(F)), x, y); return u >= 0 && u <= 1 && v >= 0 && v <= 1; }

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(400px, 62vw, 660px)';
  const S = canvas(L.view, t('cv', 'An endlessly zooming picture: a Mandelbrot fractal, or a scene that contains itself.'), { alpha: false, maxDpr: 1.5 });
  const phone = matchMedia('(max-width: 600px)').matches;
  type Cfg = { mode: 'fractal' | 'droste'; v: View; pal: string; dens: number; detail: number; F: Frame; style: string; speed: number; scene: string; brush: string; size: number; julia: boolean };
  const def: Cfg = { mode: 'fractal', v: { ...HOME }, pal: 'ember', dens: 1, detail: 1, F: { x: .5, y: .4, w: .34, a: 0 }, style: 'gilt', speed: 6, scene: 'gallery', brush: '#c0392b', size: 10, julia: true };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'mode' in v && 'F' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);

  heading(L.panel, t('wing', 'Wing'));
  seg(L.panel, t('wingl', 'Gallery wing'), [['fractal', t('m.fractal', 'Fractal deep zoom')], ['droste', t('m.droste', 'Picture inside itself')]], cfg.mode, (v) => { cfg.mode = v as Cfg['mode']; save(); build(); restart(); lp.play(); });
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const limitNote = note(L.panel, ''); limitNote.setAttribute('aria-live', 'polite');
  heading(L.panel, t('keeph', 'Kept'));
  const keepRow = buttons(L.panel, [[t('save', 'Keep this view'), () => keep(), true], [t('png', 'Download PNG'), () => exportPng()]]);
  const recBtn = h('button', { type: 'button', class: 'wk-b', text: t('rec', 'Record the loop (video)'), onclick: () => record() }) as HTMLButtonElement;
  keepRow[0].parentElement!.append(recBtn);
  const keepBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } }); L.panel.append(keepBox);
  type Kept = { mode: Cfg['mode']; v?: View; pal?: string; F?: Frame; name: string };
  const kept = store<Kept[]>(ctx.id, 'kept', [], (v) => Array.isArray(v));

  /* ================= fractal wing ================= */
  let buf: ImageData | null = null, mu: Float32Array = new Float32Array(1), bw = 0, bh = 0, q = 1;
  const work = document.createElement('canvas'), snap = document.createElement('canvas');
  let snapView: View | null = null, job = { row: 0, step: 8, done: false }, muLo = 0, cyc = 0, cycling = false, fly: { f: (u: number) => View; u: number; dur: number; next?: View } | null = null;
  function alloc() {
    q = phone ? 1 : Math.min(1.25, S.dpr); bw = Math.max(1, Math.round(S.w * q)); bh = Math.max(1, Math.round(S.h * q));
    work.width = bw; work.height = bh; snap.width = bw; snap.height = bh;
    buf = new ImageData(bw, bh); mu = new Float32Array(bw * bh).fill(-2); snapView = null; job = { row: 0, step: 8, done: false };
  }
  function viewChanged() {
    /* keep what is on screen so it can be stretched into place while the new view is computed */
    if (buf) { const sg = snap.getContext('2d')!; sg.clearRect(0, 0, bw, bh); sg.drawImage(work, 0, 0); snapView = lastView ? { ...lastView } : null; }
    if (buf) { buf.data.fill(0); mu.fill(-2); }
    muLo = 0;
    job = { row: 0, step: 8, done: false }; lp.play();
  }
  let lastView: View | null = null;
  function colourPixel(i: number, m: number) {
    const d = buf!.data, o = i * 4;
    if (m < 0) { d[o] = 6; d[o + 1] = 6; d[o + 2] = 10; d[o + 3] = 255; return; }
    /* colour by escape count above the fastest escape in view, so deep views keep their full range of colour */
    const c = palColor(PALS[cfg.pal] ?? PALS.ember, Math.log(Math.max(0, m - muLo) + 1) * .32 * cfg.dens + cyc);
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  function recolour() { if (!buf) return; for (let i = 0; i < mu.length; i++) if (mu[i] > -2) colourPixel(i, mu[i]); }
  /** compute rows until the time budget runs out; coarse blocks first, then every pixel */
  function computeSome(budget: number) {
    if (!buf || job.done) return;
    const v = cfg.v, max = maxIterFor(v.r, cfg.detail), k = 2 * v.r / bh, t0 = performance.now();
    while (performance.now() - t0 < budget) {
      const s = job.step, y = job.row;
      for (let x = 0; x < bw; x += s) {
        const m = mandel(v.cx + (x + s / 2 - bw / 2) * k, v.cy - (y + s / 2 - bh / 2) * k, max);
        for (let yy = y; yy < Math.min(bh, y + s); yy++) for (let xx = x; xx < Math.min(bw, x + s); xx++) { const i = yy * bw + xx; mu[i] = m; colourPixel(i, m); }
      }
      job.row += s;
      if (job.row >= bh) {
        if (s === 8) { /* the coarse pass tells us the fastest escape in view: set the colour floor from it and repaint */
          let lo = Infinity; for (let i = 0; i < mu.length; i += 8) if (mu[i] >= 0 && mu[i] < lo) lo = mu[i];
          muLo = Number.isFinite(lo) ? Math.max(0, lo - 2) : 0; recolour();
        }
        if (s === 1) { job.done = true; break; } job.step = s === 8 ? 2 : 1; job.row = 0;
      }
    }
  }
  function drawFractal(g: CanvasRenderingContext2D) {
    const v = cfg.v;
    const wg = work.getContext('2d')!;
    /* underlay: the previous picture moved and scaled to where its points now sit */
    if (snapView && !job.done) {
      const sc = snapView.r / v.r, dx = (snapView.cx - v.cx) / (2 * v.r / bh), dy = -(snapView.cy - v.cy) / (2 * v.r / bh);
      wg.fillStyle = '#060609'; wg.fillRect(0, 0, bw, bh);
      wg.setTransform(sc, 0, 0, sc, bw / 2 - sc * bw / 2 + dx, bh / 2 - sc * bh / 2 + dy); wg.drawImage(snap, 0, 0); wg.setTransform(1, 0, 0, 1, 0, 0);
      const tmp = tmpCanvas(); tmp.getContext('2d')!.putImageData(buf!, 0, 0); wg.drawImage(tmp, 0, 0);
    } else wg.putImageData(buf!, 0, 0);
    lastView = { ...v };
    g.imageSmoothingEnabled = true; g.drawImage(work, 0, 0, S.w, S.h);
    if (cfg.julia && job.done && S.w > 360) drawJulia(g);
  }
  let tmpC: HTMLCanvasElement | null = null;
  const tmpCanvas = () => { if (!tmpC || tmpC.width !== bw || tmpC.height !== bh) { tmpC = document.createElement('canvas'); tmpC.width = bw; tmpC.height = bh; } return tmpC; };
  /* the Julia set that belongs to the centre point, as a small inset */
  const jc = document.createElement('canvas'); let jKey = '';
  function drawJulia(g: CanvasRenderingContext2D) {
    const n = 128, key = `${cfg.v.cx},${cfg.v.cy},${cfg.pal},${cyc.toFixed(2)},${cfg.dens}`;
    if (key !== jKey) {
      jKey = key; jc.width = n; jc.height = n; const jg = jc.getContext('2d')!, im = jg.createImageData(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const m = julia((x / n - .5) * 3.2, (y / n - .5) * 3.2, cfg.v.cx, cfg.v.cy, 220), o = (y * n + x) * 4;
        const c = m < 0 ? [6, 6, 10] : palColor(PALS[cfg.pal] ?? PALS.ember, Math.log(m + 1) * .32 * cfg.dens + cyc);
        im.data[o] = c[0]; im.data[o + 1] = c[1]; im.data[o + 2] = c[2]; im.data[o + 3] = 255;
      }
      jg.putImageData(im, 0, 0);
    }
    const sz = 120, x = S.w - sz - 12, y = 58;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(x - 4, y - 4, sz + 8, sz + 24);
    g.drawImage(jc, x, y, sz, sz); g.strokeStyle = 'rgba(255,255,255,.4)'; g.strokeRect(x, y, sz, sz);
    g.fillStyle = '#e8e4da'; g.font = '11px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(t('jlabel', 'Julia set of the centre'), x + sz / 2, y + sz + 14); g.textAlign = 'start';
    /* crosshair marks the centre whose Julia set is shown */
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.moveTo(S.w / 2 - 7, S.h / 2); g.lineTo(S.w / 2 + 7, S.h / 2); g.moveTo(S.w / 2, S.h / 2 - 7); g.lineTo(S.w / 2, S.h / 2 + 7); g.stroke();
  }
  function setView(v: View) { cfg.v = { cx: v.cx, cy: v.cy, r: clamp(v.r, MIN_R, 3) }; viewChanged(); }
  function flyTo(target: View) {
    const a = { ...cfg.v };
    if (a.r < .5 && Math.hypot(target.cx - a.cx, target.cy - a.cy) > a.r * 2) { /* far away and deep: rise to the overview first, then dive */
      fly = { f: flight(a, HOME), u: 0, dur: Math.max(.8, Math.abs(Math.log(HOME.r / a.r)) * .22), next: target };
    } else fly = { f: flight(a, target), u: 0, dur: Math.max(.8, Math.abs(Math.log(target.r / a.r)) * .32) };
    lp.play();
  }

  /* ================= Droste wing ================= */
  const N = phone ? 720 : 1024;
  const pic = document.createElement('canvas'); pic.width = N; pic.height = N; const pg = pic.getContext('2d')!;
  const picStore = { get() { try { return localStorage.getItem(`abidora.w${ctx.id}.pic`); } catch { return null; } }, set(v: string) { try { localStorage.setItem(`abidora.w${ctx.id}.pic`, v); } catch { /* storage full: the picture simply is not remembered */ } } };
  let phase = 0, playing = true, tool: 'paint' | 'frame' = 'paint';
  const undo: HTMLCanvasElement[] = [];
  function pushUndo() { const c = document.createElement('canvas'); c.width = N; c.height = N; c.getContext('2d')!.drawImage(pic, 0, 0); undo.push(c); if (undo.length > 8) undo.shift(); }
  function scene(name: string) {
    const g = pg; g.setTransform(N, 0, 0, N, 0, 0);
    if (name === 'blank') { g.fillStyle = '#f4efe4'; g.fillRect(0, 0, 1, 1); return; }
    if (name === 'desk') {
      const sky = g.createLinearGradient(0, 0, 0, .62); sky.addColorStop(0, '#2b3a55'); sky.addColorStop(1, '#55607a'); g.fillStyle = sky; g.fillRect(0, 0, 1, .62);
      g.fillStyle = '#e9d9b8'; for (let i = 0; i < 26; i++) { const x = (i * 0.137) % 1, y = (i * 0.071) % .5; g.globalAlpha = .25 + (i % 3) * .15; g.fillRect(x, y, .004, .004); } g.globalAlpha = 1;
      g.fillStyle = '#6b4a32'; g.fillRect(0, .62, 1, .38); g.fillStyle = '#5a3d29'; for (let i = 0; i < 7; i++) g.fillRect(0, .64 + i * .05, 1, .004);
      /* laptop: its screen is the frame */
      g.fillStyle = '#1d1f24'; g.beginPath(); g.moveTo(.22, .78); g.lineTo(.78, .78); g.lineTo(.86, .86); g.lineTo(.14, .86); g.closePath(); g.fill();
      g.fillStyle = '#2a2d33'; g.fillRect(.29, .2, .42, .5);
      g.fillStyle = '#c9b48a'; g.beginPath(); g.ellipse(.89, .74, .04, .012, 0, 0, 7); g.fill(); g.fillStyle = '#efe6d2'; g.fillRect(.855, .62, .07, .12); g.fillStyle = '#7a4b2a'; g.fillRect(.863, .63, .054, .03);
      return;
    }
    /* gallery: wall, light, floor, bench and a visitor looking at the frame */
    const wall = g.createRadialGradient(.5, .3, .05, .5, .35, .75); wall.addColorStop(0, '#efe7d6'); wall.addColorStop(1, '#bfb19a'); g.fillStyle = wall; g.fillRect(0, 0, 1, .74);
    g.fillStyle = '#7d5a3c'; g.fillRect(0, .74, 1, .26); g.fillStyle = '#6a4b31'; for (let i = 0; i < 9; i++) { g.fillRect(0, .76 + i * i * .003, 1, .002); }
    g.fillStyle = '#e6ddc9'; g.fillRect(0, .72, 1, .022);
    g.fillStyle = 'rgba(255,248,225,.35)'; g.beginPath(); g.moveTo(.47, 0); g.lineTo(.53, 0); g.lineTo(.78, .7); g.lineTo(.22, .7); g.closePath(); g.fill();
    g.fillStyle = '#efe7d6'; g.fillRect(.455, .62, .09, .026); g.fillStyle = '#6d6252'; g.font = '.012px serif'; g.textAlign = 'center'; g.fillText('Abidora · ∞', .5, .637); g.textAlign = 'start';
    g.fillStyle = '#3d3a36'; g.fillRect(.33, .82, .34, .03); g.fillRect(.35, .85, .02, .07); g.fillRect(.63, .85, .02, .07);
    g.fillStyle = '#2e3440'; g.beginPath(); g.arc(.78, .6, .028, 0, 7); g.fill(); g.beginPath(); g.moveTo(.74, .64); g.quadraticCurveTo(.78, .62, .82, .64); g.lineTo(.83, .82); g.lineTo(.73, .82); g.closePath(); g.fill();
    g.fillRect(.745, .82, .022, .12); g.fillRect(.79, .82, .022, .12);
  }
  function sceneFrame(name: string): Frame { return name === 'desk' ? { x: .5, y: .45, w: .4, a: 0 } : name === 'blank' ? { x: .62, y: .4, w: .4, a: .35 } : { x: .5, y: .36, w: .34, a: 0 }; }
  function loadPic() {
    const d = picStore.get();
    if (d) { const im = new Image(); im.onload = () => { pg.setTransform(1, 0, 0, 1, 0, 0); pg.drawImage(im, 0, 0, N, N); lp.play(); }; im.src = d; }
    scene(cfg.scene);
  }
  let saveT = 0;
  function persistPic() { clearTimeout(saveT); saveT = window.setTimeout(() => picStore.set(pic.toDataURL('image/jpeg', .86)), 500); }
  const disp = () => { const s = Math.min(S.w, S.h) - 24; return { s, ox: (S.w - s) / 2, oy: (S.h - s) / 2 }; };
  function moldingStyle(g: CanvasRenderingContext2D, w: number) {
    if (cfg.style === 'none') return;
    if (cfg.style === 'thin') { g.strokeStyle = '#111'; g.lineWidth = w * .03; g.strokeRect(-w / 2 - w * .015, -w / 2 - w * .015, w * 1.03, w * 1.03); return; }
    const bands: [string, number][] = [['#5c4515', .1], ['#b8923a', .075], ['#e8cf7a', .045], ['#8a6a24', .02]];
    for (const [c, k] of bands) { g.strokeStyle = c; g.lineWidth = w * k; g.strokeRect(-w / 2 - w * k / 2, -w / 2 - w * k / 2, w * (1 + k), w * (1 + k)); }
  }
  /** draw the endless picture with loop phase ph into g (size s at ox, oy, device scale dp) */
  function drawDroste(g: CanvasRenderingContext2D, ph: number, s: number, ox: number, oy: number, dp: number) {
    const F = cfg.F, V = viewAt(F, ph), T = frameT(F), scr: Aff = [s * dp, 0, 0, s * dp, ox * dp, oy * dp];
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.beginPath(); g.rect(ox * dp, oy * dp, s * dp, s * dp); g.clip();
    let M = mul(scr, V), levels = 0;
    for (let k = 0; k < 40; k++) {
      const sizePx = Math.hypot(M[0], M[1]);
      if (sizePx < 1.2) break;
      g.setTransform(M[0] / N, M[1] / N, M[2] / N, M[3] / N, M[4], M[5]); g.drawImage(pic, 0, 0);
      g.setTransform(...mul(M, [Math.cos(F.a), Math.sin(F.a), -Math.sin(F.a), Math.cos(F.a), F.x, F.y])); moldingStyle(g, F.w);
      M = mul(M, T); levels++;
    }
    g.restore();
    return levels;
  }
  /* painting maps the pointer through the zoom and down through the frames, so a stroke lands on the picture itself */
  function toPic(px: number, py: number) {
    const { s, ox, oy } = disp(), V = viewAt(cfg.F, phase);
    let [x, y] = app(inv(V), (px - ox) / s, (py - oy) / s); let sc = 1 / Math.hypot(V[0], V[1]);
    const Ti = inv(frameT(cfg.F));
    for (let d = 0; d < 30 && inFrame(cfg.F, x, y); d++) { [x, y] = app(Ti, x, y); sc /= cfg.F.w; }
    return { x, y, sc };
  }
  let stroke: { x: number; y: number } | null = null, fdrag: { x: number; y: number; F: Frame } | null = null;
  function paintTo(px: number, py: number) {
    const p = toPic(px, py), r = cfg.size / disp().s * p.sc / 2;
    pg.setTransform(N, 0, 0, N, 0, 0); pg.strokeStyle = cfg.brush; pg.fillStyle = cfg.brush; pg.lineCap = 'round'; pg.lineWidth = r * 2;
    if (stroke && Math.hypot(stroke.x - p.x, stroke.y - p.y) < .2) { pg.beginPath(); pg.moveTo(stroke.x, stroke.y); pg.lineTo(p.x, p.y); pg.stroke(); }
    else { pg.beginPath(); pg.arc(p.x, p.y, r, 0, 7); pg.fill(); }
    stroke = { x: p.x, y: p.y }; lp.play();
  }

  /* ================= panel ================= */
  let fileIn: HTMLInputElement | null = null;
  function build() {
    box.replaceChildren(); recBtn.hidden = cfg.mode !== 'droste';
    if (cfg.mode === 'fractal') {
      about.textContent = t('a.fractal', 'Each pixel asks one question: does z → z² + c run away to infinity, or stay close? The black points stay; the colours show how fast the rest escape. The edge has detail at every scale, so the picture never runs out.');
      select(box, t('fly', 'Fly to'), [['', '—'], ...LOCS.map((l) => [l.id, t('loc.' + l.id, l.en)] as [string, string]), ['home', t('loc.home', 'The whole set')]], '', (v) => { if (v === 'home') flyTo(HOME); else { const l = LOCS.find((x) => x.id === v); if (l) flyTo(l.v); } });
      buttons(box, [[t('zin', 'Zoom in'), () => flyTo({ ...cfg.v, r: cfg.v.r / 4 }), true], [t('zout', 'Zoom out'), () => flyTo({ ...cfg.v, r: Math.min(3, cfg.v.r * 4) })], [t('home', 'Start again'), () => flyTo(HOME)]]);
      seg(box, t('pal', 'Colours'), [['ember', t('p.ember', 'Ember')], ['ocean', t('p.ocean', 'Ocean')], ['aurora', t('p.aurora', 'Aurora')], ['ink', t('p.ink', 'Ink')]], cfg.pal, (v) => { cfg.pal = v; save(); recolour(); lp.play(); });
      range(box, t('dens', 'Colour bands'), { min: .4, max: 3, step: .1, value: cfg.dens, fmt: (v) => `${v.toFixed(1)}×` }, (v) => { cfg.dens = v; save(); recolour(); lp.play(); });
      range(box, t('detail', 'Detail (iterations)'), { min: .5, max: 3, step: .25, value: cfg.detail, fmt: (v) => `${v}×` }, (v) => { cfg.detail = v; save(); viewChanged(); });
      buttons(box, [[t('cycle', 'Cycle the colours'), () => { cycling = !cycling; lp.play(); }], [cfg.julia ? t('jhide', 'Hide the Julia inset') : t('jshow', 'Show the Julia inset'), () => { cfg.julia = !cfg.julia; save(); build(); lp.play(); }]]);
      note(box, t('fhelp', 'Scroll or pinch to zoom where you point, drag to move, double-click to dive in. Keys: arrows move, + and − zoom.'));
      dts[0].textContent = t('st.mag', 'Magnification'); dts[1].textContent = t('st.iter', 'Iterations per pixel'); dts[2].textContent = t('st.centre', 'Centre');
    } else {
      about.textContent = t('a.droste', 'The frame shows the whole picture again, and that copy has a frame too, and so on forever (the Droste effect). The zoom loops without a seam, because one turn of the loop shrinks everything by exactly the frame size. Tilt the frame to turn the copies into a spiral.');
      seg(box, t('tool', 'Hand'), [['paint', t('t.paint', 'Paint')], ['frame', t('t.frame', 'Move the frame')]], tool, (v) => { tool = v as typeof tool; });
      const pr = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } });
      for (const c of ['#c0392b', '#1f6feb', '#2e8b57', '#f1c40f', '#111111', '#f4efe4']) pr.append(h('button', { type: 'button', class: 'wk-b', 'aria-label': c, style: { background: c, width: '30px', height: '30px', padding: '0', border: c === cfg.brush ? '2px solid currentColor' : '' }, onclick: () => { cfg.brush = c; save(); build(); } }));
      box.append(pr);
      color(box, t('brush', 'Brush colour'), cfg.brush, (v) => { cfg.brush = v; save(); });
      range(box, t('size', 'Brush size'), { min: 2, max: 40, value: cfg.size, fmt: (v) => `${v} px` }, (v) => { cfg.size = v; save(); });
      range(box, t('fsize', 'Frame size'), { min: .2, max: .7, step: .01, value: cfg.F.w, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { cfg.F.w = v; save(); lp.play(); });
      range(box, t('fang', 'Frame tilt'), { min: -45, max: 45, value: Math.round(cfg.F.a * 180 / Math.PI), fmt: (v) => `${v}°` }, (v) => { cfg.F.a = v * Math.PI / 180; save(); lp.play(); });
      seg(box, t('fstyle', 'Frame'), [['gilt', t('s.gilt', 'Gilded')], ['thin', t('s.thin', 'Thin')], ['none', t('s.none', 'None')]], cfg.style, (v) => { cfg.style = v; save(); lp.play(); });
      range(box, t('speed', 'Seconds per loop'), { min: 2, max: 14, value: cfg.speed, fmt: (v) => `${v} s` }, (v) => { cfg.speed = v; save(); });
      buttons(box, [[playing ? t('pause', 'Pause the zoom') : t('play', 'Play the zoom'), () => { playing = !playing; build(); lp.play(); }, true], [t('undo', 'Undo'), () => { const c = undo.pop(); if (c) { pg.setTransform(1, 0, 0, 1, 0, 0); pg.drawImage(c, 0, 0); persistPic(); lp.play(); } }]]);
      select(box, t('scene', 'Start from'), [['', '—'], ['gallery', t('sc.gallery', 'Gallery wall')], ['desk', t('sc.desk', 'Laptop at night')], ['blank', t('sc.blank', 'Blank paper')], ['photo', t('sc.photo', 'My own photo…')]], '', (v) => {
        if (!v) return; pushUndo();
        if (v === 'photo') { fileIn?.click(); return; }
        cfg.scene = v; cfg.F = sceneFrame(v); save(); scene(v); persistPic(); build(); lp.play();
      });
      fileIn = h('input', { type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement; box.append(fileIn);
      fileIn.addEventListener('change', () => {
        const f = fileIn!.files?.[0]; if (!f) return; const url = URL.createObjectURL(f), im = new Image();
        im.onload = () => { const k = Math.max(N / im.width, N / im.height); pg.setTransform(1, 0, 0, 1, 0, 0); pg.drawImage(im, (N - im.width * k) / 2, (N - im.height * k) / 2, im.width * k, im.height * k); URL.revokeObjectURL(url); persistPic(); lp.play(); };
        im.src = url;
      });
      note(box, t('dhelp', 'Paint anywhere: a stroke inside the frame lands on the picture itself, so it appears in every copy. Your photo stays on this device.'));
      dts[0].textContent = t('st.levels', 'Copies drawn'); dts[1].textContent = t('st.loop', 'Zoom per loop'); dts[2].textContent = t('st.spiral', 'Turn per loop');
    }
    showKept();
  }

  /* ================= loop ================= */
  function restart() { if (cfg.mode === 'fractal') { if (bw !== Math.round(S.w * (phone ? 1 : Math.min(1.25, S.dpr)))) alloc(); viewChanged(); } }
  const lp = loop(ctx, S.cv, (dt) => {
    const g = S.g;
    if (cfg.mode === 'fractal') {
      if (!buf || bw !== Math.round(S.w * q) || bh !== Math.round(S.h * q)) alloc();
      if (fly) {
        fly.u = Math.min(1, fly.u + dt / fly.dur); const v = fly.f(fly.u); cfg.v = { cx: v.cx, cy: v.cy, r: clamp(v.r, MIN_R, 3) }; viewChanged();
        if (fly.u >= 1) { const nx = fly.next; fly = null; save(); if (nx) flyTo(nx); }
      }
      if (cycling && !ctx.calm) { cyc = (cyc + dt * .06) % 1; recolour(); }
      computeSome(fly ? 9 : 14);
      drawFractal(g);
      const mag = HOME.r / cfg.v.r;
      out('a', mag < 1e4 ? `${mag.toFixed(mag < 10 ? 1 : 0)}×` : `${mag.toExponential(1).replace('e+', ' × 10^')}`);
      out('b', `${maxIterFor(cfg.v.r, cfg.detail).toLocaleString()}`);
      out('c', `${cfg.v.cx.toFixed(6)} ${cfg.v.cy >= 0 ? '+' : '−'} ${Math.abs(cfg.v.cy).toFixed(6)}i`);
      limitNote.textContent = cfg.v.r <= MIN_R * 1.01 ? t('limit', 'This is as deep as ordinary 64-bit numbers can go (about 10¹³×). Going further needs arbitrary-precision arithmetic, which this page does not fake.') : '';
      L.hud.textContent = job.done ? '' : t('computing', 'Computing…');
      if (job.done && !fly && !cycling) lp.pause();
      return;
    }
    if (playing && !ctx.calm) phase = (phase + dt / cfg.speed) % 1;
    const { s, ox, oy } = disp();
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#121216'; g.fillRect(0, 0, S.cv.width, S.cv.height);
    const levels = drawDroste(g, phase, s, ox, oy, S.dpr);
    if (tool === 'frame') { /* show the frame handle */
      g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0); const V = viewAt(cfg.F, phase), c = app(V, cfg.F.x, cfg.F.y);
      g.strokeStyle = '#fff'; g.setLineDash([5, 4]); g.beginPath(); g.arc(ox + c[0] * s, oy + c[1] * s, 10, 0, 7); g.stroke(); g.setLineDash([]);
    }
    g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    out('a', `${levels}`); out('b', `${(1 / cfg.F.w).toFixed(2)}×`); out('c', `${Math.round(cfg.F.a * 180 / Math.PI)}°`);
    limitNote.textContent = ''; L.hud.textContent = '';
    if (!playing) lp.pause();
  });
  S.onResize(() => { if (cfg.mode === 'fractal') { alloc(); } lp.play(); });

  /* ================= input ================= */
  const pts = new Map<number, { x: number; y: number }>(); let pinch: { d: number; v: View; mx: number; my: number } | null = null, pan: { x: number; y: number; v: View } | null = null;
  S.cv.style.touchAction = 'none';
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv); S.cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, p);
    if (cfg.mode === 'fractal') {
      fly = null;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), v: { ...cfg.v }, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; pan = null; }
      else pan = { x: p.x, y: p.y, v: { ...cfg.v } };
      return;
    }
    if (tool === 'frame') { fdrag = { x: p.x, y: p.y, F: { ...cfg.F } }; return; }
    pushUndo(); stroke = null; paintTo(p.x, p.y);
  });
  S.cv.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return; const p = local(e, S.cv); pts.set(e.pointerId, p);
    if (cfg.mode === 'fractal') {
      if (pinch && pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); setView(zoomAt(pinch.v, pinch.mx, pinch.my, d / pinch.d, S.w, S.h)); }
      else if (pan) { const k = 2 * pan.v.r / S.h; setView({ cx: pan.v.cx - (p.x - pan.x) * k, cy: pan.v.cy + (p.y - pan.y) * k, r: pan.v.r }); }
      return;
    }
    if (fdrag) { const { s } = disp(), V = viewAt(cfg.F, phase), sc = Math.hypot(V[0], V[1]) * s; cfg.F.x = clamp(fdrag.F.x + (p.x - fdrag.x) / sc, cfg.F.w * .6, 1 - cfg.F.w * .6); cfg.F.y = clamp(fdrag.F.y + (p.y - fdrag.y) / sc, cfg.F.w * .6, 1 - cfg.F.w * .6); lp.play(); return; }
    paintTo(p.x, p.y);
  });
  const up = (e: PointerEvent) => {
    pts.delete(e.pointerId); if (pts.size < 2) pinch = null;
    if (cfg.mode === 'fractal') { if (pts.size === 0) { pan = null; save(); } return; }
    if (fdrag) { fdrag = null; save(); }
    if (stroke) { stroke = null; persistPic(); }
  };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('wheel', (e) => { if (cfg.mode !== 'fractal') return; e.preventDefault(); fly = null; const p = local(e, S.cv); setView(zoomAt(cfg.v, p.x, p.y, Math.exp(-e.deltaY * .0016), S.w, S.h)); save(); }, { passive: false });
  S.cv.addEventListener('dblclick', (e) => { if (cfg.mode !== 'fractal') return; const p = local(e, S.cv); const [x, y] = toC(cfg.v, p.x, p.y, S.w, S.h); flyTo({ cx: x, cy: y, r: cfg.v.r / 5 }); });
  S.cv.addEventListener('keydown', (e) => {
    if (cfg.mode !== 'fractal') { if (e.key === ' ') { e.preventDefault(); playing = !playing; build(); lp.play(); } return; }
    const k = cfg.v.r * .15;
    const m: Record<string, () => void> = { ArrowLeft: () => setView({ ...cfg.v, cx: cfg.v.cx - k }), ArrowRight: () => setView({ ...cfg.v, cx: cfg.v.cx + k }), ArrowUp: () => setView({ ...cfg.v, cy: cfg.v.cy + k }), ArrowDown: () => setView({ ...cfg.v, cy: cfg.v.cy - k }), '+': () => flyTo({ ...cfg.v, r: cfg.v.r / 3 }), '=': () => flyTo({ ...cfg.v, r: cfg.v.r / 3 }), '-': () => flyTo({ ...cfg.v, r: Math.min(3, cfg.v.r * 3) }) };
    if (m[e.key]) { e.preventDefault(); m[e.key](); save(); }
  });

  /* ================= keep, export, record ================= */
  function keep() {
    const l = kept.get();
    if (cfg.mode === 'fractal') l.unshift({ mode: 'fractal', v: { ...cfg.v }, pal: cfg.pal, name: `${(HOME.r / cfg.v.r).toExponential(0).replace('e+', 'e')}×` });
    else l.unshift({ mode: 'droste', F: { ...cfg.F }, name: `${t('m.droste', 'Picture inside itself')} ${Math.round(cfg.F.a * 180 / Math.PI)}°` });
    while (l.length > 12) l.pop(); kept.set(l); showKept();
  }
  function showKept() {
    keepBox.replaceChildren();
    kept.get().forEach((k, i) => {
      if (k.mode !== cfg.mode) return;
      const b = h('button', { type: 'button', class: 'wk-b', text: k.name, onclick: () => { if (k.mode === 'fractal' && k.v) { if (k.pal) cfg.pal = k.pal; flyTo(k.v); } else if (k.F) { cfg.F = { ...k.F }; save(); build(); lp.play(); } } });
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove'), text: '×', onclick: () => { const l = kept.get(); l.splice(i, 1); kept.set(l); showKept(); } });
      keepBox.append(h('span', { style: { display: 'inline-flex', gap: '2px' } }, b, del));
    });
  }
  function exportPng() {
    if (cfg.mode === 'fractal') { download(work, `abidora-mandelbrot-${(HOME.r / cfg.v.r).toExponential(0).replace('e+', 'e')}.png`); return; }
    const n = 1600, c = document.createElement('canvas'); c.width = n; c.height = n; drawDroste(c.getContext('2d')!, phase, n, 0, 0, 1); download(c, 'abidora-droste.png');
  }
  let rec: { mr: MediaRecorder; cv: HTMLCanvasElement; t0: number; chunks: Blob[] } | null = null;
  const canRec = typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype;
  if (!canRec) { recBtn.disabled = true; recBtn.title = t('norec', 'This browser cannot record canvas video.'); }
  function record() {
    if (!canRec || rec || cfg.mode !== 'droste') return;
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 720;
    const types = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'], type = types.find((x) => MediaRecorder.isTypeSupported(x)) ?? '';
    let mr: MediaRecorder; try { mr = new MediaRecorder(cv.captureStream(30), type ? { mimeType: type } : {}); } catch { recBtn.disabled = true; return; }
    const chunks: Blob[] = []; mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = () => { const b = new Blob(chunks, { type: mr.mimeType || 'video/webm' }); download(b, `abidora-droste-loop.${(mr.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`); recBtn.textContent = t('rec', 'Record the loop (video)'); recBtn.disabled = false; };
    rec = { mr, cv, t0: performance.now(), chunks }; recBtn.disabled = true; recBtn.textContent = t('recording', 'Recording one loop…'); mr.start();
    /* its own frame clock, so recording continues even when the stage is scrolled out of view */
    const tick = () => { recFrame(); if (rec) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
  }
  function recFrame() {
    if (!rec) return; const u = (performance.now() - rec.t0) / 1000 / cfg.speed;
    const g = rec.cv.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); drawDroste(g, Math.min(u, .9999) % 1, 720, 0, 0, 1);
    if (u >= 1) { const r = rec; rec = null; r.mr.stop(); }
  }

  ctx.onDispose(() => { if (rec) { const r = rec; rec = null; r.mr.onstop = null; try { r.mr.stop(); } catch { /* already stopped */ } } });
  loadPic(); build(); alloc(); restart(); lp.play();
}
