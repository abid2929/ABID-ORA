/* 048 Generative Art Lab: Systems That Draw. Generative art is the design of a process, not a picture.
   Five classic systems run live on the canvas: a particle flow field, Gray-Scott reaction-diffusion,
   differential growth, circle packing and a Physarum slime-mould simulation. Each is the real algorithm,
   seeded, so the same recipe (system + parameters + seed) always grows the same work. Touch the canvas
   to intervene, keep recipes in a lab book, and export PNG, or SVG ready for a pen plotter where the
   system draws lines. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, local, loop, clamp, store, download, noise2, rng, hex2rgb } from './kit';

export type SysId = 'flow' | 'rd' | 'grow' | 'pack' | 'slime';
type P = Record<string, number>;
export interface Sys { step(): void; draw(g: CanvasRenderingContext2D): void; poke(x: number, y: number): void; svg?(): string; count(): number; done(): boolean }
interface Pal { id: string; bg: string; ink: string[] }
const PALS: Pal[] = [
  { id: 'paper', bg: '#f3eee2', ink: ['#1b1a17', '#3a3530', '#8a3324', '#20465a'] },
  { id: 'night', bg: '#0d0f1a', ink: ['#f2c14e', '#f78154', '#5fad56', '#4d9de0'] },
  { id: 'river', bg: '#eef3ea', ink: ['#0f5257', '#1f8a70', '#bedb39', '#fd7400'] },
  { id: 'kiln', bg: '#f6e9dc', ink: ['#7a2e1d', '#c4572b', '#e3a33b', '#2e3b4e'] },
  { id: 'ice', bg: '#08131f', ink: ['#e8f1f2', '#9ad1e8', '#3a7ca5', '#d0b8ff'] },
];
const rgbs = (p: Pal) => [hex2rgb(p.bg), ...p.ink.map(hex2rgb)];
/** colour ramp from the background through the palette, t in 0..1 */
function ramp(p: Pal) {
  const c = rgbs(p), n = c.length - 1, lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) { const t = i / 255 * n, k = Math.min(n - 1, Math.floor(t)), f = t - k; for (let j = 0; j < 3; j++) lut[i * 3 + j] = c[k][j] + (c[k + 1][j] - c[k][j]) * f; }
  return lut;
}
const f1 = (v: number) => Math.round(v * 10) / 10;

/* ---------- 1. flow field: particles follow the angle of a noise field ---------- */
export class Flow implements Sys {
  lines: { c: number; p: number[] }[] = []; act: { x: number; y: number; age: number; li: number }[] = []; made = 0; R: () => number; nz: (x: number, y: number) => number; nz2: (x: number, y: number) => number;
  constructor(public W: number, public H: number, public o: P, seed: number, public pal: Pal) { this.R = rng(seed); this.nz = noise2(seed); this.nz2 = noise2(seed + 7); }
  angle(x: number, y: number) { const s = this.o.scale / 1000; return this.nz(x * s, y * s) * Math.PI * this.o.turb + this.nz2(x * s * 3.1, y * s * 3.1) * .35; }
  spawn(x = this.R() * this.W, y = this.R() * this.H) { this.lines.push({ c: Math.floor(this.R() * this.pal.ink.length), p: [x, y] }); this.act.push({ x, y, age: 0, li: this.lines.length - 1 }); this.made++; }
  step() {
    while (this.act.length < 260 && this.made < this.o.lines) this.spawn();
    for (let s = 0; s < 3; s++) for (let i = this.act.length - 1; i >= 0; i--) {
      const q = this.act[i], a = this.angle(q.x, q.y); q.x += Math.cos(a) * 1.5; q.y += Math.sin(a) * 1.5; q.age++;
      const ln = this.lines[q.li].p; ln.push(q.x, q.y);
      if (q.age > this.o.len || q.x < -2 || q.y < -2 || q.x > this.W + 2 || q.y > this.H + 2) this.act.splice(i, 1);
    }
  }
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = this.pal.bg; g.fillRect(0, 0, this.W, this.H); g.lineWidth = this.o.width; g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = .82;
    for (const l of this.lines) { const p = l.p; if (p.length < 4) continue; g.strokeStyle = this.pal.ink[l.c]; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); }
    g.globalAlpha = 1;
  }
  poke(x: number, y: number) { for (let i = 0; i < 40; i++) { const a = this.R() * 6.283, r = this.R() * 18; this.spawn(x + Math.cos(a) * r, y + Math.sin(a) * r); } }
  svg() { return this.lines.filter((l) => l.p.length >= 4).map((l) => `<polyline fill="none" stroke="${this.pal.ink[l.c]}" stroke-width="${this.o.width}" stroke-linecap="round" points="${l.p.map(f1).join(' ')}"/>`).join('\n'); }
  count() { return this.lines.length; }
  done() { return this.made >= this.o.lines && !this.act.length; }
}

/* ---------- 2. Gray-Scott reaction-diffusion ---------- */
export const RD_PRESETS: Record<string, [number, number]> = { coral: [.0545, .062], mitosis: [.0367, .0649], maze: [.029, .057], spots: [.025, .06], waves: [.014, .045] };
export class RD implements Sys {
  gw: number; gh: number; U: Float32Array; V: Float32Array; U2: Float32Array; V2: Float32Array; n = 0; lut: Uint8ClampedArray; cv = document.createElement('canvas'); R: () => number;
  constructor(public W: number, public H: number, public o: P, seed: number, public pal: Pal, public preset: string) {
    this.gw = Math.round(clamp(W / 2.6, 90, 300)); this.gh = Math.max(40, Math.round(this.gw * H / W));
    const N = this.gw * this.gh; this.U = new Float32Array(N).fill(1); this.V = new Float32Array(N); this.U2 = new Float32Array(N); this.V2 = new Float32Array(N);
    this.R = rng(seed); this.lut = ramp(pal); this.cv.width = this.gw; this.cv.height = this.gh;
    const k = 6 + Math.floor(this.R() * 10);
    for (let i = 0; i < k; i++) this.blob(this.R() * this.gw, this.R() * this.gh, 2 + this.R() * 4);
  }
  blob(cx: number, cy: number, r: number) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue; const i = ((y + this.gh) % this.gh) * this.gw + ((x + this.gw) % this.gw); this.U[i] = .5; this.V[i] = .25 + this.R() * .05;
    }
  }
  /** one explicit Euler step of the Gray-Scott equations (Da = 1, Db = 0.5, dt = 1, 3x3 Laplacian) */
  tick() {
    const { gw, gh, U, V, U2, V2 } = this, [f0, k0] = RD_PRESETS[this.preset] ?? RD_PRESETS.coral, f = f0 + this.o.df / 1000, k = k0 + this.o.dk / 1000;
    for (let y = 0; y < gh; y++) {
      const ym = ((y - 1 + gh) % gh) * gw, y0 = y * gw, yp = ((y + 1) % gh) * gw;
      for (let x = 0; x < gw; x++) {
        const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw, i = y0 + x;
        const lu = .2 * (U[y0 + xm] + U[y0 + xp] + U[ym + x] + U[yp + x]) + .05 * (U[ym + xm] + U[ym + xp] + U[yp + xm] + U[yp + xp]) - U[i];
        const lv = .2 * (V[y0 + xm] + V[y0 + xp] + V[ym + x] + V[yp + x]) + .05 * (V[ym + xm] + V[ym + xp] + V[yp + xm] + V[yp + xp]) - V[i];
        const u = U[i], v = V[i], uvv = u * v * v;
        U2[i] = clamp(u + lu - uvv + f * (1 - u), 0, 1); V2[i] = clamp(v + .5 * lv + uvv - (k + f) * v, 0, 1);
      }
    }
    this.U = U2; this.V = V2; this.U2 = U; this.V2 = V; this.n++;
  }
  step() { const s = this.gw * this.gh > 40000 ? 8 : 12; for (let i = 0; i < s; i++) this.tick(); }
  draw(g: CanvasRenderingContext2D) {
    const x = this.cv.getContext('2d')!, img = x.createImageData(this.gw, this.gh), d = img.data, lut = this.lut;
    for (let i = 0; i < this.gw * this.gh; i++) { const t = clamp(Math.round((this.V[i] * 2.6 + (1 - this.U[i]) * .6) * 255), 0, 255) * 3; d[i * 4] = lut[t]; d[i * 4 + 1] = lut[t + 1]; d[i * 4 + 2] = lut[t + 2]; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(this.cv, 0, 0, this.W, this.H);
  }
  poke(x: number, y: number) { this.blob(x / this.W * this.gw, y / this.H * this.gh, 4); }
  count() { return this.n; }
  done() { return this.n > 30000; }
}

/* ---------- 3. differential growth ---------- */
export class Growth implements Sys {
  loops: { x: number[]; y: number[] }[] = []; hist: string[] = []; n = 0; R: () => number; layer = document.createElement('canvas');
  constructor(public W: number, public H: number, public o: P, seed: number, public pal: Pal, public dpr: number) {
    this.R = rng(seed); this.layer.width = Math.round(W * dpr); this.layer.height = Math.round(H * dpr);
    const lg = this.layer.getContext('2d')!; lg.setTransform(dpr, 0, 0, dpr, 0, 0); lg.fillStyle = pal.bg; lg.fillRect(0, 0, W, H);
    const k = 1 + Math.floor(this.R() * 2);
    for (let i = 0; i < k; i++) this.seed(W * (.3 + this.R() * .4), H * (.3 + this.R() * .4), 14 + this.R() * 10);
  }
  seed(cx: number, cy: number, r: number) { const x: number[] = [], y: number[] = []; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832; x.push(cx + Math.cos(a) * r * (1 + (this.R() - .5) * .1)); y.push(cy + Math.sin(a) * r); } this.loops.push({ x, y }); }
  nodes() { return this.loops.reduce((s, l) => s + l.x.length, 0); }
  tick() {
    const Rr = this.o.radius, rest = Rr * .45, maxE = Rr * .62, cell = Rr, gw = Math.ceil(this.W / cell) + 1, gh = Math.ceil(this.H / cell) + 1;
    const grid = new Map<number, number[]>(), all: [number, number][] = [];
    this.loops.forEach((l, li) => l.x.forEach((_, i) => { const k = Math.floor(l.y[i] / cell) * gw + Math.floor(l.x[i] / cell); let b = grid.get(k); if (!b) grid.set(k, (b = [])); b.push(all.length); all.push([li, i]); }));
    const moves = this.loops.map((l) => l.x.map(() => [0, 0]));
    this.loops.forEach((l, li) => {
      const n = l.x.length;
      for (let i = 0; i < n; i++) {
        const px = l.x[i], py = l.y[i], a = (i - 1 + n) % n, b = (i + 1) % n; let mx = 0, my = 0;
        /* alignment: pull toward the midpoint of the two neighbours (smooths the curve) */
        mx += ((l.x[a] + l.x[b]) / 2 - px) * .35; my += ((l.y[a] + l.y[b]) / 2 - py) * .35;
        /* attraction: keep edges near their rest length */
        for (const j of [a, b]) { const dx = l.x[j] - px, dy = l.y[j] - py, d = Math.hypot(dx, dy) || 1; if (d > rest) { mx += dx / d * (d - rest) * .1; my += dy / d * (d - rest) * .1; } }
        /* repulsion from every node within the radius, found through the spatial grid */
        const gx = Math.floor(px / cell), gy = Math.floor(py / cell);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (gx + ox < 0 || gy + oy < 0 || gx + ox >= gw || gy + oy >= gh) continue;
          const bk = grid.get((gy + oy) * gw + gx + ox); if (!bk) continue;
          for (const q of bk) { const [lj, j] = all[q]; if (lj === li && j === i) continue; const dx = px - this.loops[lj].x[j], dy = py - this.loops[lj].y[j], d = Math.hypot(dx, dy); if (d > 0 && d < Rr) { const f = (Rr - d) / Rr; mx += dx / d * f * .9; my += dy / d * f * .9; } }
        }
        moves[li][i] = [mx, my];
      }
    });
    const m = 8;
    this.loops.forEach((l, li) => l.x.forEach((_, i) => {
      let [mx, my] = moves[li][i]; const s = Math.hypot(mx, my); if (s > 1.2) { mx *= 1.2 / s; my *= 1.2 / s; }
      l.x[i] = clamp(l.x[i] + mx, m, this.W - m); l.y[i] = clamp(l.y[i] + my, m, this.H - m);
    }));
    /* split long edges, and add new nodes at random: that is the growth */
    for (const l of this.loops) {
      for (let i = 0; i < l.x.length; i++) { const j = (i + 1) % l.x.length; if (Math.hypot(l.x[j] - l.x[i], l.y[j] - l.y[i]) > maxE) { l.x.splice(i + 1, 0, (l.x[i] + l.x[j]) / 2); l.y.splice(i + 1, 0, (l.y[i] + l.y[j]) / 2); i++; } }
      if (this.nodes() < this.o.max) for (let k = 0; k < this.o.rate; k++) { const i = Math.floor(this.R() * l.x.length), j = (i + 1) % l.x.length; l.x.splice(i + 1, 0, (l.x[i] + l.x[j]) / 2 + (this.R() - .5) * .5); l.y.splice(i + 1, 0, (l.y[i] + l.y[j]) / 2 + (this.R() - .5) * .5); }
    }
    this.n++;
  }
  path(g: CanvasRenderingContext2D) { g.beginPath(); for (const l of this.loops) { g.moveTo(l.x[0], l.y[0]); for (let i = 1; i < l.x.length; i++) g.lineTo(l.x[i], l.y[i]); g.closePath(); } }
  d() { return this.loops.map((l) => 'M' + l.x.map((x, i) => `${f1(x)} ${f1(l.y[i])}`).join('L') + 'Z').join(''); }
  step() {
    if (this.done()) return; this.tick();
    if (this.n % 14 === 0) {
      const lg = this.layer.getContext('2d')!, c = this.pal.ink[(this.n / 14) % this.pal.ink.length | 0];
      lg.strokeStyle = c; lg.globalAlpha = .55; lg.lineWidth = .8; this.path(lg); lg.stroke(); lg.globalAlpha = 1;
      if (this.hist.length < 400) this.hist.push(`<path fill="none" stroke="${c}" stroke-width=".8" stroke-opacity=".55" d="${this.d()}"/>`);
    }
  }
  draw(g: CanvasRenderingContext2D) { g.drawImage(this.layer, 0, 0, this.W, this.H); g.strokeStyle = this.pal.ink[0]; g.lineWidth = 2; g.lineJoin = 'round'; this.path(g); g.stroke(); }
  poke(x: number, y: number) { this.seed(x, y, this.o.radius * 1.4); }
  svg() { return this.hist.join('\n') + `\n<path fill="none" stroke="${this.pal.ink[0]}" stroke-width="2" stroke-linejoin="round" d="${this.d()}"/>`; }
  count() { return this.nodes(); }
  done() { return this.nodes() >= this.o.max && this.n > 4000; }
}

/* ---------- 4. circle packing ---------- */
export class Pack implements Sys {
  c: { x: number; y: number; r: number; k: number }[] = []; fails = 0; R: () => number;
  constructor(public W: number, public H: number, public o: P, seed: number, public pal: Pal) { this.R = rng(seed); }
  /** largest radius that fits at (x, y) without touching any circle or the frame, or -1 if inside one */
  room(x: number, y: number) {
    let r = Math.min(this.o.rmax, x - 6, y - 6, this.W - 6 - x, this.H - 6 - y);
    for (const q of this.c) { const d = Math.hypot(q.x - x, q.y - y) - q.r - this.o.gap; if (d < r) { r = d; if (r < this.o.rmin) return -1; } }
    return r;
  }
  add(x: number, y: number) { const r = this.room(x, y); if (r >= this.o.rmin) { this.c.push({ x, y, r, k: Math.floor(this.R() * this.pal.ink.length) }); return true; } return false; }
  step() { for (let i = 0; i < 70 && !this.done(); i++) if (this.add(this.R() * this.W, this.R() * this.H)) this.fails = 0; else this.fails++; }
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = this.pal.bg; g.fillRect(0, 0, this.W, this.H);
    for (const q of this.c) {
      if (this.o.style === 1) { g.strokeStyle = this.pal.ink[q.k]; g.lineWidth = 1; for (let r = q.r; r > 1; r -= 3.2) { g.beginPath(); g.arc(q.x, q.y, r, 0, 6.2832); g.stroke(); } }
      else { g.fillStyle = this.pal.ink[q.k]; g.beginPath(); g.arc(q.x, q.y, q.r, 0, 6.2832); g.fill(); }
    }
  }
  poke(x: number, y: number) { this.add(x, y); }
  svg() { return this.c.map((q) => this.o.style === 1 ? Array.from({ length: Math.max(1, Math.floor(q.r / 3.2)) }, (_, i) => `<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${f1(q.r - i * 3.2)}" fill="none" stroke="${this.pal.ink[q.k]}"/>`).join('') : `<circle cx="${f1(q.x)}" cy="${f1(q.y)}" r="${f1(q.r)}" fill="${this.pal.ink[q.k]}"/>`).join('\n'); }
  count() { return this.c.length; }
  done() { return this.fails > 2500 || this.c.length >= 5000; }
}

/* ---------- 5. Physarum: agents sense, turn, move and leave a trail that diffuses and decays ---------- */
export class Slime implements Sys {
  gw: number; gh: number; T: Float32Array; T2: Float32Array; ax: Float32Array; ay: Float32Array; ah: Float32Array; n = 0; R: () => number; lut: Uint8ClampedArray; cv = document.createElement('canvas');
  constructor(public W: number, public H: number, public o: P, seed: number, public pal: Pal) {
    this.gw = Math.round(clamp(W / 2.4, 100, 340)); this.gh = Math.max(50, Math.round(this.gw * H / W));
    this.T = new Float32Array(this.gw * this.gh); this.T2 = new Float32Array(this.gw * this.gh); this.R = rng(seed); this.lut = ramp(pal);
    const N = Math.round(o.agents * this.gw * this.gh / 60000); this.ax = new Float32Array(N); this.ay = new Float32Array(N); this.ah = new Float32Array(N);
    /* scattered start with random headings: the network self-organises within a few hundred steps */
    for (let i = 0; i < N; i++) { this.ax[i] = this.R() * this.gw; this.ay[i] = this.R() * this.gh; this.ah[i] = this.R() * 6.2832; }
    this.cv.width = this.gw; this.cv.height = this.gh;
  }
  sense(x: number, y: number, a: number) { const so = this.o.sdist, i = Math.round(x + Math.cos(a) * so), j = Math.round(y + Math.sin(a) * so); return this.T[((j + this.gh) % this.gh) * this.gw + ((i + this.gw) % this.gw)]; }
  tick() {
    const sa = this.o.sangle * Math.PI / 180, ra = this.o.turn * Math.PI / 180, { gw, gh, T } = this;
    for (let i = 0; i < this.ax.length; i++) {
      const x = this.ax[i], y = this.ay[i], a = this.ah[i], F = this.sense(x, y, a), L = this.sense(x, y, a - sa), Rt = this.sense(x, y, a + sa);
      let na = a; if (F > L && F > Rt) { /* keep going */ } else if (F < L && F < Rt) na += (this.R() < .5 ? -1 : 1) * ra; else if (L > Rt) na -= ra; else if (Rt > L) na += ra;
      let nx = x + Math.cos(na), ny = y + Math.sin(na); if (nx < 0) nx += gw; if (ny < 0) ny += gh; if (nx >= gw) nx -= gw; if (ny >= gh) ny -= gh;
      this.ax[i] = nx; this.ay[i] = ny; this.ah[i] = na; T[(ny | 0) * gw + (nx | 0)] += 1;
    }
    const T2 = this.T2, keep = 1 - this.o.decay / 100;
    for (let y = 0; y < gh; y++) { const ym = ((y - 1 + gh) % gh) * gw, y0 = y * gw, yp = ((y + 1) % gh) * gw; for (let x = 0; x < gw; x++) { const xm = (x - 1 + gw) % gw, xp = (x + 1) % gw; T2[y0 + x] = (T[y0 + x] * .5 + (T[ym + xm] + T[ym + x] + T[ym + xp] + T[y0 + xm] + T[y0 + x] + T[y0 + xp] + T[yp + xm] + T[yp + x] + T[yp + xp]) / 18) * keep; } }
    this.T = T2; this.T2 = T; this.n++;
  }
  step() { this.tick(); this.tick(); }
  draw(g: CanvasRenderingContext2D) {
    const x = this.cv.getContext('2d')!, img = x.createImageData(this.gw, this.gh), d = img.data, lut = this.lut;
    let mx = 1e-6; for (let i = 0; i < this.T.length; i += 7) if (this.T[i] > mx) mx = this.T[i];
    const sc = 255 / Math.sqrt(mx * .7);
    for (let i = 0; i < this.gw * this.gh; i++) { const t = Math.min(255, Math.round(Math.sqrt(this.T[i]) * sc)) * 3; d[i * 4] = lut[t]; d[i * 4 + 1] = lut[t + 1]; d[i * 4 + 2] = lut[t + 2]; d[i * 4 + 3] = 255; }
    x.putImageData(img, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(this.cv, 0, 0, this.W, this.H);
  }
  poke(x: number, y: number) { const cx = x / this.W * this.gw, cy = y / this.H * this.gh; for (let j = -6; j <= 6; j++) for (let i = -6; i <= 6; i++) if (i * i + j * j <= 36) { const X = Math.round(cx + i), Y = Math.round(cy + j); if (X >= 0 && Y >= 0 && X < this.gw && Y < this.gh) this.T[Y * this.gw + X] += 40; } }
  count() { return this.ax.length; }
  done() { return this.n > 20000; }
}

/* ---------- parameters per system ---------- */
interface Spec { k: string; label: [string, string]; min: number; max: number; step: number; v: number; fmt?: (v: number) => string }
const SPECS: Record<SysId, Spec[]> = {
  flow: [{ k: 'scale', label: ['p.scale', 'Field scale'], min: 1, max: 12, step: .5, v: 3.5 }, { k: 'turb', label: ['p.turb', 'Turbulence'], min: .5, max: 6, step: .1, v: 2.2 }, { k: 'lines', label: ['p.lines', 'Lines'], min: 200, max: 4000, step: 100, v: 1600 }, { k: 'len', label: ['p.len', 'Line length'], min: 20, max: 400, step: 10, v: 140 }, { k: 'width', label: ['p.width', 'Pen width'], min: .4, max: 3, step: .1, v: 1 }],
  rd: [{ k: 'df', label: ['p.df', 'Feed rate offset'], min: -6, max: 6, step: .5, v: 0, fmt: (v) => (v > 0 ? '+' : '') + (v / 1000).toFixed(4) }, { k: 'dk', label: ['p.dk', 'Kill rate offset'], min: -4, max: 4, step: .25, v: 0, fmt: (v) => (v > 0 ? '+' : '') + (v / 1000).toFixed(4) }],
  grow: [{ k: 'radius', label: ['p.radius', 'Repulsion radius'], min: 6, max: 24, step: 1, v: 14 }, { k: 'rate', label: ['p.rate', 'Growth per step'], min: 1, max: 8, step: 1, v: 3 }, { k: 'max', label: ['p.max', 'Most nodes'], min: 400, max: 3200, step: 100, v: 2400 }],
  pack: [{ k: 'rmax', label: ['p.rmax', 'Largest circle'], min: 10, max: 160, step: 2, v: 70 }, { k: 'rmin', label: ['p.rmin', 'Smallest circle'], min: 1, max: 12, step: .5, v: 2 }, { k: 'gap', label: ['p.gap', 'Gap'], min: 0, max: 8, step: .5, v: 2 }, { k: 'style', label: ['p.style', 'Concentric rings'], min: 0, max: 1, step: 1, v: 0, fmt: (v) => (v ? '✓' : '—') }],
  slime: [{ k: 'agents', label: ['p.agents', 'Agents'], min: 4000, max: 60000, step: 2000, v: 30000 }, { k: 'sangle', label: ['p.sangle', 'Sensor angle'], min: 10, max: 80, step: 1, v: 30, fmt: (v) => v + '°' }, { k: 'sdist', label: ['p.sdist', 'Sensor distance'], min: 2, max: 30, step: 1, v: 9 }, { k: 'turn', label: ['p.turn', 'Turn angle'], min: 5, max: 90, step: 1, v: 40, fmt: (v) => v + '°' }, { k: 'decay', label: ['p.decay', 'Trail fade'], min: 1, max: 30, step: 1, v: 8, fmt: (v) => v + '%' }],
};
export const defaults = (s: SysId): P => Object.fromEntries(SPECS[s].map((x) => [x.k, x.v]));
interface Recipe { sys: SysId; seed: number; pal: string; preset: string; p: P }
const SYS_IDS: SysId[] = ['flow', 'rd', 'grow', 'pack', 'slime'];

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(360px, 60vw, 640px)';
  const S = canvas(L.view, t('cv', 'The generative canvas. The chosen system draws here step by step; touch it to intervene.'), { alpha: false });
  const last = store<Recipe>(ctx.id, 'last', { sys: 'flow', seed: 2024, pal: 'paper', preset: 'coral', p: defaults('flow') }, (v) => typeof v === 'object' && v !== null && 'sys' in v);
  let R: Recipe = last.get(); if (!SYS_IDS.includes(R.sys)) R = { sys: 'flow', seed: 2024, pal: 'paper', preset: 'coral', p: defaults('flow') };
  R.p = { ...defaults(R.sys), ...R.p };
  let sys: Sys | null = null, playing = true, t0 = performance.now(), el = 0;

  heading(L.panel, t('sysh', 'System'));
  const NAMES: Record<SysId, string> = { flow: t('s.flow', 'Flow field'), rd: t('s.rd', 'Reaction-diffusion'), grow: t('s.grow', 'Differential growth'), pack: t('s.pack', 'Circle packing'), slime: t('s.slime', 'Slime mould') };
  const sysSeg = seg(L.panel, t('sysl', 'Algorithm'), SYS_IDS.map((s) => [s, NAMES[s]]), R.sys, (v) => { R = { ...R, sys: v as SysId, p: defaults(v as SysId) }; build(); restart(); });
  const about = note(L.panel, '');
  const ABOUT: Record<SysId, string> = {
    flow: t('a.flow', 'Thousands of particles follow the angle of a smooth noise field and leave their paths as ink, a technique made popular by plotter artists. Touch to release a burst of particles.'),
    rd: t('a.rd', 'Two chemicals diffuse at different speeds while one feeds on the other (the Gray-Scott model). Alan Turing proposed in 1952 that this kind of process makes spots and stripes in nature. Touch to add a drop.'),
    grow: t('a.grow', 'A closed line keeps adding points while every point pushes its neighbours away, so it folds like coral, brain tissue or lettuce. Faint rings record its earlier shapes. Touch to plant a new loop.'),
    pack: t('a.pack', 'Circles are placed at random and grown until they touch a neighbour, filling the space ever more tightly. Touch to place a circle yourself.'),
    slime: t('a.slime', 'Tens of thousands of agents each sniff the trail ahead, turn toward the strongest scent and leave more trail, the model Jeff Jones published in 2010 for the slime mould Physarum. Touch to drop food.'),
  };
  const presetBox = h('div', {}); L.panel.append(presetBox);
  const paramBox = h('div', {}); L.panel.append(paramBox);
  heading(L.panel, t('palh', 'Palette and seed'));
  const palSeg = seg(L.panel, t('pall', 'Palette'), PALS.map((p) => [p.id, t('c.' + p.id, ({ paper: 'Ink on paper', night: 'Night bloom', river: 'Riverbank', kiln: 'Kiln', ice: 'Ice' } as Record<string, string>)[p.id])]), R.pal, (v) => { R.pal = v; restart(); });
  const seedOut = h('output', { class: 'wk-note' });
  L.panel.append(h('div', { class: 'wk-r' }, h('span', { text: t('seedl', 'Seed') }), seedOut));
  const ctl = buttons(L.panel, [[t('newseed', 'New seed'), () => { R.seed = (Math.random() * 1e6) | 0; restart(); }, true], [t('pause', 'Pause'), () => { playing = !playing; ctl[1].textContent = playing ? t('pause', 'Pause') : t('play', 'Play'); if (playing) lp.kick(); }], [t('restart', 'Restart'), () => restart()]]);
  const out = stats(L.panel, [['sys', t('st.sys', 'System')], ['steps', t('st.n', 'Steps / elements')], ['state', t('st.state', 'State')]]);
  heading(L.panel, t('exph', 'Export and lab book'));
  const exp = buttons(L.panel, [[t('png', 'Download PNG'), () => exportPng()], [t('svg', 'Download SVG'), () => exportSvg()], [t('keep', 'Keep this recipe'), () => keep(), true]]);
  note(L.panel, t('svgn', 'SVG is offered for the systems that draw lines or circles, so the work can be cut, scaled without loss or drawn by a pen plotter.'));
  const book = store<Recipe[]>(ctx.id, 'book', [], (v) => Array.isArray(v));
  const bookBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } }); L.panel.append(bookBox);

  function build() {
    sysSeg.set(R.sys); about.textContent = ABOUT[R.sys];
    presetBox.replaceChildren(); paramBox.replaceChildren();
    if (R.sys === 'rd') seg(presetBox, t('presl', 'Pattern'), Object.keys(RD_PRESETS).map((k) => [k, t('r.' + k, ({ coral: 'Coral', mitosis: 'Dividing cells', maze: 'Maze', spots: 'Spots', waves: 'Waves' } as Record<string, string>)[k])]), R.preset, (v) => { R.preset = v; restart(); });
    for (const sp of SPECS[R.sys]) range(paramBox, t(sp.label[0], sp.label[1]), { min: sp.min, max: sp.max, step: sp.step, value: R.p[sp.k] ?? sp.v, fmt: sp.fmt }, (v) => { R.p[sp.k] = v; restart(); });
    exp[1].disabled = !['flow', 'grow', 'pack'].includes(R.sys);
  }
  function make(): Sys {
    const pal = PALS.find((p) => p.id === R.pal) ?? PALS[0], W = S.w, H = S.h;
    switch (R.sys) {
      case 'rd': return new RD(W, H, R.p, R.seed, pal, R.preset);
      case 'grow': return new Growth(W, H, R.p, R.seed, pal, S.dpr);
      case 'pack': return new Pack(W, H, R.p, R.seed, pal);
      case 'slime': return new Slime(W, H, R.p, R.seed, pal);
      default: return new Flow(W, H, R.p, R.seed, pal);
    }
  }
  let rt = 0;
  function restart() {
    clearTimeout(rt); rt = window.setTimeout(() => { sys = make(); t0 = performance.now(); el = 0; seedOut.textContent = String(R.seed); palSeg.set(R.pal); last.set(R); lp.kick(); }, 60);
  }
  const lp = loop(ctx, S.cv, () => {
    if (!sys) return;
    const fin = sys.done();
    if (playing && !fin) { const s = performance.now(); let k = 0; do { sys.step(); k++; } while (performance.now() - s < 9 && k < 4 && !(sys instanceof RD) && !(sys instanceof Slime)); }
    sys.draw(S.g);
    out('sys', NAMES[R.sys]); out('steps', R.sys === 'rd' || R.sys === 'slime' ? `${(sys as RD | Slime).n} · ${R.sys === 'slime' ? sys.count().toLocaleString() : (sys as RD).gw + '×' + (sys as RD).gh}` : sys.count().toLocaleString());
    if (!fin && playing) el = (performance.now() - t0) / 1000;
    out('state', (fin ? t('done', 'finished') : playing ? t('growing', 'growing') : t('paused', 'paused')) + ` · ${el.toFixed(0)} s`);
  });
  S.cv.style.touchAction = 'none'; S.cv.style.cursor = 'crosshair';
  let down = false;
  S.cv.addEventListener('pointerdown', (e) => { down = true; S.cv.setPointerCapture(e.pointerId); const p = local(e, S.cv); sys?.poke(p.x, p.y); lp.kick(); });
  S.cv.addEventListener('pointermove', (e) => { if (!down || !sys || sys instanceof Growth || sys instanceof Pack) return; const p = local(e, S.cv); if (Math.random() < .5) sys.poke(p.x, p.y); });
  const up = () => { down = false; }; S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); ctl[1].click(); } else if (e.key === 'Enter') { e.preventDefault(); ctl[0].click(); } });

  const name = () => `abidora-${R.sys}-${R.seed}`;
  function exportPng() {
    if (!sys) return; const k = Math.max(2, Math.min(4, 2400 / S.w)), c = document.createElement('canvas'); c.width = Math.round(S.w * k); c.height = Math.round(S.h * k);
    const g = c.getContext('2d')!; g.scale(k, k); sys.draw(g); download(c, name() + '.png');
  }
  function exportSvg() {
    if (!sys?.svg) return; const pal = PALS.find((p) => p.id === R.pal) ?? PALS[0];
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}" viewBox="0 0 ${S.w} ${S.h}">\n<!-- Abidora Generative Art Lab: ${R.sys}, seed ${R.seed} -->\n<rect width="100%" height="100%" fill="${pal.bg}"/>\n${sys.svg()}\n</svg>`;
    download(new Blob([svg], { type: 'image/svg+xml' }), name() + '.svg');
  }
  function keep() { const l = book.get(); l.unshift(JSON.parse(JSON.stringify(R))); while (l.length > 12) l.pop(); book.set(l); showBook(); }
  function showBook() {
    bookBox.replaceChildren();
    book.get().forEach((r, i) => {
      const pal = PALS.find((p) => p.id === r.pal) ?? PALS[0];
      const b = h('button', { type: 'button', class: 'wk-b', title: t('load', 'Grow this recipe again'), style: { borderLeft: `6px solid ${pal.ink[1]}` }, text: `${NAMES[r.sys] ?? r.sys} · ${r.seed}`, onclick: () => { R = JSON.parse(JSON.stringify(r)); R.p = { ...defaults(R.sys), ...R.p }; build(); restart(); } });
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove recipe'), text: '×', onclick: () => { const l = book.get(); l.splice(i, 1); book.set(l); showBook(); } });
      bookBox.append(h('span', { style: { display: 'inline-flex', gap: '2px' } }, b, del));
    });
  }
  S.onResize(() => restart());
  build(); showBook(); restart();
  ctx.onDispose(() => clearTimeout(rt));
}
