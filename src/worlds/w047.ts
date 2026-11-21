/* 047 Illustration Gallery: Ink & Light Studio. Illustrators turn light into marks. A small still life
   (sphere, box, cylinder, cone) is ray-traced in real 3D with a light you move, which gives every point
   a value from white to black. That value is then drawn in one of seven pen-and-ink techniques: tone
   study, hatching, cross-hatching, engraving lines that follow the form, stippling, comic halftone and
   pure outline. Each technique is built so its marks cover the paper by the same amount as the value
   they stand for, and the studio measures how closely they do. Switch to the pen to draw over the
   scene yourself, then keep pieces in your own gallery or download them. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, local, clamp, store, download, noise2, rng } from './kit';

/* ---------- vectors ---------- */
type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/* ---------- scene ---------- */
export type Kind = 'sphere' | 'box' | 'cyl' | 'cone';
export interface Obj { k: Kind; x: number; z: number; r: number; h: number; rot: number }
export interface Hit { t: number; n: V3; u: number }

/** ray / object intersection. `u` is a surface coordinate in world metres used for engraving lines. */
export function hitObj(o: Obj, ro: V3, rd: V3): Hit | null {
  if (o.k === 'sphere') {
    const c: V3 = [o.x, o.r, o.z], oc = sub(ro, c), b = dot(oc, rd), cc = dot(oc, oc) - o.r * o.r, D = b * b - cc;
    if (D < 0) return null; const t = -b - Math.sqrt(D); if (t <= 1e-4) return null;
    const n = norm(sub(add(ro, mul(rd, t)), c));
    return { t, n, u: o.r * Math.asin(clamp(n[1], -1, 1)) };
  }
  if (o.k === 'box') {
    const cs = Math.cos(-o.rot), sn = Math.sin(-o.rot);
    const rx = (v: V3): V3 => [v[0] * cs - v[2] * sn, v[1], v[0] * sn + v[2] * cs];
    const lo = rx([ro[0] - o.x, ro[1] - o.h / 2, ro[2] - o.z]), ld = rx(rd), half: V3 = [o.r, o.h / 2, o.r];
    let tn = -1e9, tf = 1e9, ax = 0, sg = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]) < 1e-9) { if (Math.abs(lo[i]) > half[i]) return null; continue; }
      let t1 = (-half[i] - lo[i]) / ld[i], t2 = (half[i] - lo[i]) / ld[i], s = -1;
      if (t1 > t2) { [t1, t2] = [t2, t1]; s = 1; }
      if (t1 > tn) { tn = t1; ax = i; sg = s; }
      if (t2 < tf) tf = t2;
    }
    if (tn > tf || tn <= 1e-4) return null;
    const ln: V3 = [0, 0, 0]; ln[ax] = sg;
    const cb = Math.cos(o.rot), sb = Math.sin(o.rot), n: V3 = [ln[0] * cb - ln[2] * sb, ln[1], ln[0] * sb + ln[2] * cb];
    const lp = add(lo, mul(ld, tn));
    return { t: tn, n, u: ax === 1 ? lp[0] + o.r : lp[1] + o.h / 2 };
  }
  /* vertical cylinder and cone standing on the ground */
  const ox = ro[0] - o.x, oz = ro[2] - o.z, dx = rd[0], dz = rd[2];
  let best: Hit | null = null;
  if (o.k === 'cyl') {
    const a = dx * dx + dz * dz, b = ox * dx + oz * dz, c = ox * ox + oz * oz - o.r * o.r, D = b * b - a * c;
    if (a > 1e-12 && D >= 0) {
      const t = (-b - Math.sqrt(D)) / a, y = ro[1] + rd[1] * t;
      if (t > 1e-4 && y >= 0 && y <= o.h) best = { t, n: norm([ox + dx * t, 0, oz + dz * t]), u: y };
    }
    if (Math.abs(rd[1]) > 1e-9) {
      const t = (o.h - ro[1]) / rd[1], px = ox + dx * t, pz = oz + dz * t;
      if (t > 1e-4 && px * px + pz * pz <= o.r * o.r && (!best || t < best.t)) best = { t, n: [0, 1, 0], u: Math.hypot(px, pz) };
    }
    return best;
  }
  const k = o.r / o.h, oy = o.h - ro[1], dy = -rd[1];
  const a = dx * dx + dz * dz - k * k * dy * dy, b = ox * dx + oz * dz - k * k * oy * dy, c = ox * ox + oz * oz - k * k * oy * oy;
  const D = b * b - a * c;
  if (D < 0 || Math.abs(a) < 1e-12) return null;
  for (const t of [(-b - Math.sqrt(D)) / a, (-b + Math.sqrt(D)) / a].sort((p, q) => p - q)) {
    const y = ro[1] + rd[1] * t;
    if (t > 1e-4 && y >= 0 && y <= o.h) { const px = ox + dx * t, pz = oz + dz * t, rr = Math.hypot(px, pz) || 1e-6; return { t, n: norm([px / rr, k, pz / rr]), u: y }; }
  }
  return null;
}

export function lightDir(azDeg: number, elDeg: number): V3 {
  const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180;
  return [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
}

/** value (1 = white paper, 0 = black) of a lit surface point, the way an illustrator reads it */
export function value(n: V3, L: V3, V: V3, lit: boolean, ground: boolean, groundLit: number) {
  const diff = Math.max(0, dot(n, L)) * (lit ? 1 : 0);
  if (ground) return .2 + .8 * diff;
  const hv = norm(add(L, V)), spec = lit ? Math.max(0, dot(n, hv)) ** 60 * .55 : 0;
  const refl = Math.max(0, -n[1]) * .22 * groundLit + Math.max(0, -dot(n, L)) * .06; /* light bounced up from the table */
  return clamp(.07 + .9 * diff + refl + spec, 0, 1);
}

/* ---------- mark-making: each returns ink coverage 0..1 for one pixel ---------- */
/** distance-based anti-aliased line of a grating. u in line periods, per = period in pixels, f = width fraction */
export function gratingInk(u: number, per: number, f: number) {
  if (f <= 0) return 0; if (f >= 1) return 1;
  const dpx = Math.abs(u - Math.round(u)) * per, hw = f * per / 2;
  return clamp(hw - dpx + .5, 0, 1);
}
const CROSS_T = [0, .3, .52, .72];
/** cross-hatching layer widths chosen so that the layers together cover exactly `d` of the paper */
export function crossWidths(d: number) {
  const r = CROSS_T.map((t) => clamp((d - t) / .16, 0, 1)), s = r.reduce((a, b) => a + b, 0) || 1;
  return r.map((w) => (w > 0 ? 1 - (1 - Math.min(d, .985)) ** (w / s) : 0));
}
export const hash2 = (x: number, y: number, s = 0) => { let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

export type Tech = 'tone' | 'hatch' | 'cross' | 'engrave' | 'stipple' | 'halftone' | 'line';

/* ---------- the frame: geometry buffer, values, ink ---------- */
interface Frame { bw: number; bh: number; sc: number; id: Uint8Array; nrm: Float32Array; pos: Float32Array; u: Float32Array; ugrad: Float32Array; dark: Float32Array; depth: Float32Array; band: number }
interface Cam { ro: V3; f: V3; r: V3; up: V3; fpx: number; w: number; h: number }
function camera(w: number, hh: number): Cam {
  const ro: V3 = [0, 2.6, 6.3], tg: V3 = [0, .62, 0], f = norm(sub(tg, ro)), r = norm(cross(f, [0, 1, 0])), up = cross(r, f);
  const fpx = Math.min(hh / (2 * Math.tan(19 * Math.PI / 180)), w / (2 * Math.tan(27 * Math.PI / 180)));
  return { ro, f, r, up, fpx, w, h: hh };
}
const rayDir = (c: Cam, x: number, y: number): V3 => norm(add(add(mul(c.f, c.fpx), mul(c.r, x - c.w / 2)), mul(c.up, c.h / 2 - y)));
export function project(c: Cam, p: V3): [number, number, number] {
  const q = sub(p, c.ro), z = dot(q, c.f);
  return [c.w / 2 + dot(q, c.r) / z * c.fpx, c.h / 2 - dot(q, c.up) / z * c.fpx, z];
}
const FADE = 3.6;
function geometry(objs: Obj[], w: number, hh: number, sc: number, band: number): Frame {
  const bw = Math.max(1, Math.round(w * sc)), bh = Math.max(1, Math.round(hh * sc)), n = bw * bh, cam = camera(w, hh);
  const F: Frame = { bw, bh, sc, band, id: new Uint8Array(n), nrm: new Float32Array(n * 3), pos: new Float32Array(n * 3), u: new Float32Array(n), ugrad: new Float32Array(n), dark: new Float32Array(n), depth: new Float32Array(n) };
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const k = j * bw + i, rd = rayDir(cam, (i + .5) / sc, (j + .5) / sc);
    let best: Hit | null = null, bid = 0;
    objs.forEach((o, oi) => { const hh2 = hitObj(o, cam.ro, rd); if (hh2 && (!best || hh2.t < best.t)) { best = hh2; bid = oi + 2; } });
    if (rd[1] < 0) { const t = -cam.ro[1] / rd[1]; if (!best || t < (best as Hit).t) { const pz = cam.ro[2] + rd[2] * t; best = { t, n: [0, 1, 0], u: pz }; bid = 1; } }
    if (!best) { F.depth[k] = 1e9; continue; }
    const b = best as Hit, p = add(cam.ro, mul(rd, b.t));
    F.id[k] = bid; F.depth[k] = b.t; F.u[k] = b.u;
    F.nrm.set(b.n, k * 3); F.pos.set(p, k * 3);
  }
  /* screen-space rate of change of u, so engraving lines can be anti-aliased in pixels */
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const k = j * bw + i; if (!F.id[k]) continue;
    let gx = 0, gy = 0;
    if (i + 1 < bw && F.id[k + 1] === F.id[k]) gx = F.u[k + 1] - F.u[k]; else if (i > 0 && F.id[k - 1] === F.id[k]) gx = F.u[k] - F.u[k - 1];
    if (j + 1 < bh && F.id[k + bw] === F.id[k]) gy = F.u[k + bw] - F.u[k]; else if (j > 0 && F.id[k - bw] === F.id[k]) gy = F.u[k] - F.u[k - bw];
    F.ugrad[k] = Math.hypot(gx, gy);
  }
  return F;
}
function shadeFrame(F: Frame, objs: Obj[], L: V3) {
  const cam = camera(F.bw / F.sc, F.bh / F.sc), gl = Math.max(0, L[1]);
  for (let k = 0; k < F.bw * F.bh; k++) {
    const id = F.id[k]; if (!id) { F.dark[k] = 0; continue; }
    const n = [F.nrm[k * 3], F.nrm[k * 3 + 1], F.nrm[k * 3 + 2]] as V3, p = [F.pos[k * 3], F.pos[k * 3 + 1], F.pos[k * 3 + 2]] as V3;
    let lit = dot(n, L) > 0;
    if (lit) { const o2 = add(p, mul(n, 1e-3)); for (let i = 0; i < objs.length; i++) if (i + 2 !== id && hitObj(objs[i], o2, L)) { lit = false; break; } }
    const V = norm(sub(cam.ro, p)), v = value(n, L, V, lit, id === 1, gl);
    let d = 1 - v;
    if (id === 1) { const rr = Math.hypot(p[0], p[2] * 1.25); d *= clamp(1.25 - rr / FADE, 0, 1) * .85; }
    F.dark[k] = d;
  }
  /* the 10-step value scale along the bottom edge */
  const by = F.bh - Math.round(F.band * F.sc);
  for (let j = by; j < F.bh; j++) for (let i = 0; i < F.bw; i++) { const k = j * F.bw + i; F.id[k] = 250; F.dark[k] = Math.min(9, Math.floor(i / F.bw * 10)) / 9; }
}

export interface InkOpts { tech: Tech; spacing: number; wobble: number; outline: boolean; ink: [number, number, number]; paper: [number, number, number] }
const NZ = noise2(47);
/** draws the marks into RGBA pixels and returns how much ink was used and how faithfully it matches the values */
function inkFrame(F: Frame, o: InkOpts, out: Uint8ClampedArray) {
  const { bw, bh, sc } = F, per = Math.max(2, o.spacing * sc), wob = o.wobble, cell = Math.max(2, o.spacing * sc * (o.tech === 'stipple' ? .62 : .9));
  const A = new Float32Array(bw * bh), angles = [Math.PI / 4, -Math.PI / 4, 0, Math.PI / 2];
  const cs = angles.map(Math.cos), sn = angles.map(Math.sin);
  const sm = o.spacing * 6.5 / camera(bw / sc, bh / sc).fpx; /* engraving period in metres: about the chosen spacing at the still life's distance */
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const k = j * bw + i, d = F.dark[k]; if (!F.id[k] || (d <= .003 && o.tech !== 'line')) continue;
    const x = i / sc, y = j / sc, wv = wob ? NZ(x * .018, y * .018) * wob * 1.6 : 0;
    let a = 0;
    switch (o.tech) {
      case 'tone': a = d; break;
      case 'hatch': a = gratingInk((x * cs[0] + y * sn[0]) * sc / per + wv, per, Math.min(d, .97)); break;
      case 'cross': {
        const ws = crossWidths(d); let keep = 1;
        for (let L = 0; L < 4; L++) if (ws[L] > 0) keep *= 1 - gratingInk((x * cs[L] + y * sn[L]) * sc / per + wv * (L % 2 ? -1 : 1) + L * .37, per, ws[L]);
        a = 1 - keep; break;
      }
      case 'engrave': {
        if (F.id[k] === 250 || F.id[k] === 1) { a = gratingInk(y * sc / per + wv, per, Math.min(d, .97)); break; }
        const g = F.ugrad[k] / sm, pp = g > 1e-6 ? 1 / g : per;
        a = gratingInk(F.u[k] / sm + wv * .5, pp, Math.min(d, .97));
        if (pp < 1.6) a = Math.min(d, .97); /* lines finer than a pixel blend into their average */
        break;
      }
      case 'stipple': {
        const cx = Math.floor(i / cell), cy = Math.floor(j / cell); let cov = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const gx = cx + ox, gy = cy + oy, px = (gx + hash2(gx, gy, 1)) * cell, py = (gy + hash2(gx, gy, 2)) * cell;
          const si = clamp(Math.round(px), 0, bw - 1), sj = clamp(Math.round(py), 0, bh - 1), dd = F.dark[sj * bw + si];
          if (dd <= .003) continue;
          const r0 = cell * .42, aa = Math.PI * r0 * r0 / (cell * cell);
          let r = r0; if (dd > aa) r = cell * Math.sqrt(dd / Math.PI); else if (hash2(gx, gy, 3) > dd / aa) continue;
          cov = Math.max(cov, clamp(r - Math.hypot(i + .5 - px, j + .5 - py) + .5, 0, 1));
        }
        a = cov; break;
      }
      case 'halftone': {
        const c45 = Math.SQRT1_2, ux = (i * c45 + j * c45) / cell, uy = (-i * c45 + j * c45) / cell;
        const qx = Math.round(ux), qy = Math.round(uy), px = (qx - qy) * c45 * cell, py = (qx + qy) * c45 * cell;
        const si = clamp(Math.round(px), 0, bw - 1), sj = clamp(Math.round(py), 0, bh - 1), dd = F.id[sj * bw + si] ? F.dark[sj * bw + si] : 0;
        const dist = Math.hypot(ux - qx, uy - qy) * cell;
        a = dd <= .5 ? clamp(cell * Math.sqrt(dd / Math.PI) - dist + .5, 0, 1) : 1 - clamp(cell * Math.sqrt((1 - dd) / Math.PI) - dist + .5, 0, 1);
        if (dd <= .003) a = 0;
        break;
      }
      case 'line': a = 0; break;
    }
    A[k] = a;
  }
  /* outlines: heavier where a form meets the table or the empty paper, lighter on inner edges and creases */
  if (o.outline || o.tech === 'line') {
    const r1 = Math.max(1, Math.round(sc)), r2 = Math.max(2, Math.round(2 * sc));
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
      const k = j * bw + i, id = F.id[k]; if (id < 2 || id === 250) continue;
      let e = 0;
      for (const [dx, dy, rr] of [[r2, 0, 2], [-r2, 0, 2], [0, r2, 2], [0, -r2, 2], [r1, 0, 1], [-r1, 0, 1], [0, r1, 1], [0, -r1, 1]] as const) {
        const ii = i + dx, jj = j + dy; if (ii < 0 || jj < 0 || ii >= bw || jj >= bh) continue;
        const q = jj * bw + ii, qid = F.id[q];
        if (qid !== id) { if (qid < 2 || qid === 250 || F.depth[q] > F.depth[k] * 1.04) e = 1; else if (rr === 1) e = Math.max(e, .9); }
        else if (rr === 1 && F.nrm[k * 3] * F.nrm[q * 3] + F.nrm[k * 3 + 1] * F.nrm[q * 3 + 1] + F.nrm[k * 3 + 2] * F.nrm[q * 3 + 2] < .6) e = Math.max(e, .85);
      }
      if (e) A[k] = Math.max(A[k], e);
    }
  }
  /* compose onto paper, with faint paper tooth */
  let sumA = 0, n = 0, errS = 0, dS = 0;
  const B = Math.max(4, Math.round(14 * sc));
  for (let by = 0; by + B <= bh; by += B) for (let bx = 0; bx + B <= bw; bx += B) {
    let sa = 0, sd = 0; for (let j = by; j < by + B; j++) for (let i = bx; i < bx + B; i++) { const k = j * bw + i; sa += A[k]; sd += F.dark[k]; }
    errS += Math.abs(sa - sd); dS += sd;
  }
  for (let k = 0; k < bw * bh; k++) {
    const a = A[k], t = (hash2(k % bw, (k / bw) | 0, 9) - .5) * 6, p = k * 4;
    out[p] = o.paper[0] + t + (o.ink[0] - o.paper[0]) * a; out[p + 1] = o.paper[1] + t + (o.ink[1] - o.paper[1]) * a; out[p + 2] = o.paper[2] + t + (o.ink[2] - o.paper[2]) * a; out[p + 3] = 255;
    if (F.id[k] && F.id[k] !== 250) { sumA += a; n++; }
  }
  return { ink: n ? sumA / n : 0, match: dS > 0 ? clamp(1 - errS / dS, 0, 1) : 1 };
}

/* ---------- arrangements ---------- */
const ARR: Record<string, Obj[]> = {
  still: [{ k: 'box', x: .55, z: -.75, r: .62, h: 1.25, rot: .62 }, { k: 'sphere', x: -.95, z: .35, r: .72, h: 0, rot: 0 }, { k: 'cyl', x: 1.55, z: .55, r: .4, h: 1.05, rot: 0 }],
  tall: [{ k: 'cone', x: -1.15, z: -.35, r: .72, h: 2.05, rot: 0 }, { k: 'cyl', x: .35, z: -.7, r: .5, h: 1.7, rot: 0 }, { k: 'sphere', x: 1.0, z: .7, r: .5, h: 0, rot: 0 }],
  sphere: [{ k: 'sphere', x: 0, z: 0, r: 1.15, h: 0, rot: 0 }],
};
export function arrange(seed: number): Obj[] {
  const R = rng(seed), out: Obj[] = [], kinds: Kind[] = ['sphere', 'box', 'cyl', 'cone'];
  for (let tries = 0; out.length < 3 && tries < 200; tries++) {
    const k = kinds[Math.floor(R() * 4)], r = .38 + R() * .45, o: Obj = { k, r, h: k === 'sphere' ? 0 : r * (1.3 + R() * 1.8), rot: R() * 1.5, x: -1.9 + R() * 3.8, z: -1.2 + R() * 2.1 };
    const foot = (q: Obj) => q.r * (q.k === 'box' ? 1.42 : 1);
    if (out.every((q) => Math.hypot(q.x - o.x, q.z - o.z) > foot(q) + foot(o) + .08)) out.push(o);
  }
  return out;
}

/* ---------- the world ---------- */
interface Stroke { w: number; tool: string; p: number[] } /* p = x, y, width triples in CSS px of a reference width */
interface Saved { img: string; tech: Tech; at: number }
const INKS: Record<string, [number, number, number]> = { black: [24, 21, 19], sepia: [92, 52, 28], blue: [28, 48, 130] };
const PAPER: [number, number, number] = [246, 240, 226];

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(320px, 58vw, 600px)';
  const S = canvas(L.view, t('cv', 'A still life drawn in pen and ink. The light can be moved and the shading is redrawn in the chosen technique.'), { alpha: false });
  const st = store<{ tech: Tech; az: number; el: number; sp: number; wob: number; ol: boolean; ink: string; arr: string; seed: number }>(ctx.id, 'cfg', { tech: 'cross', az: -48, el: 38, sp: 7, wob: .5, ol: true, ink: 'black', arr: 'still', seed: 1 }, (v) => typeof v === 'object' && v !== null && 'tech' in v);
  const cfg = st.get();
  let objs: Obj[] = cfg.arr === 'random' ? arrange(cfg.seed) : ARR[cfg.arr] ?? ARR.still;
  let mode: 'light' | 'draw' = 'light', refA = .55, tool = 'pen';
  const strokes: Stroke[] = []; let cur: Stroke | null = null;
  const BAND = 22;

  /* --- panel --- */
  heading(L.panel, t('techh', 'Technique'));
  const TECH: [Tech, string][] = [['tone', t('t.tone', 'Tone study')], ['hatch', t('t.hatch', 'Hatching')], ['cross', t('t.cross', 'Cross-hatching')], ['engrave', t('t.engrave', 'Engraving')], ['stipple', t('t.stipple', 'Stippling')], ['halftone', t('t.halftone', 'Halftone')], ['line', t('t.line', 'Line only')]];
  const techSeg = seg(L.panel, t('techl', 'Draw the shading as'), TECH, cfg.tech, (v) => { cfg.tech = v as Tech; save(); techNote(); redraw('ink'); });
  void techSeg;
  const tnote = note(L.panel, '');
  const TN: Record<Tech, string> = {
    tone: t('n.tone', 'Smooth values, like a pencil or wash study. The labels show the five parts of light on a form.'),
    hatch: t('n.hatch', 'Parallel lines. The darker the value, the thicker the lines, so the paper between them shrinks.'),
    cross: t('n.cross', 'Layers of lines at new angles are added as the value darkens, the oldest pen-and-ink method for tone.'),
    engrave: t('n.engrave', 'Lines follow the surface of each form, like a banknote or a 19th-century engraving. Their width carries the value.'),
    stipple: t('n.stipple', 'Dots only. Light areas get scattered dots, dark areas crowd them until they touch.'),
    halftone: t('n.halftone', 'A grid of dots at 45°, as in printed comics and newspapers. Dot size carries the value.'),
    line: t('n.line', 'Outline only, with a heavier line where a form meets the table or the empty paper.'),
  };
  const techNote = () => { tnote.textContent = TN[cfg.tech]; };
  techNote();
  heading(L.panel, t('lighth', 'Light'));
  const azR = range(L.panel, t('az', 'Light direction'), { min: -180, max: 180, value: cfg.az, fmt: (v) => `${v}°` }, (v) => { cfg.az = v; save(); redraw('shade', true); });
  const elR = range(L.panel, t('el', 'Light height'), { min: 6, max: 85, value: cfg.el, fmt: (v) => `${v}°` }, (v) => { cfg.el = v; save(); redraw('shade', true); });
  heading(L.panel, t('penh', 'Pen'));
  range(L.panel, t('sp', 'Mark spacing'), { min: 4, max: 14, step: .5, value: cfg.sp, fmt: (v) => `${v} px` }, (v) => { cfg.sp = v; save(); redraw('ink', true); });
  range(L.panel, t('wob', 'Hand wobble'), { min: 0, max: 1, step: .05, value: cfg.wob, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { cfg.wob = v; save(); redraw('ink', true); });
  seg(L.panel, t('inkl', 'Ink'), [['black', t('i.black', 'Black')], ['sepia', t('i.sepia', 'Sepia')], ['blue', t('i.blue', 'Blue')]], cfg.ink, (v) => { cfg.ink = v; save(); redraw('ink'); });
  check(L.panel, t('ol', 'Outline the forms'), cfg.ol, (v) => { cfg.ol = v; save(); redraw('ink'); });
  heading(L.panel, t('sceneh', 'Still life'));
  const arrSeg = seg(L.panel, t('arrl', 'Arrangement'), [['still', t('a.still', 'Classic')], ['tall', t('a.tall', 'Tall forms')], ['sphere', t('a.sphere', 'One sphere')]], cfg.arr, (v) => { cfg.arr = v; objs = ARR[v]; save(); redraw('geo'); });
  buttons(L.panel, [[t('rand', 'New arrangement'), () => { cfg.arr = 'random'; cfg.seed = (Math.random() * 2 ** 31) | 0; objs = arrange(cfg.seed); arrSeg.set(''); save(); redraw('geo'); }]]);
  heading(L.panel, t('handh', 'Your hand'));
  const modeSeg = seg(L.panel, t('model', 'Dragging on the picture will'), [['light', t('m.light', 'Move the light')], ['draw', t('m.draw', 'Draw in ink')]], mode, (v) => setMode(v as 'light' | 'draw'));
  const drawBox = h('div', {});
  L.panel.append(drawBox);
  seg(drawBox, t('tooll', 'Tool'), [['pen', t('tl.pen', 'Fine pen')], ['brush', t('tl.brush', 'Brush pen')]], tool, (v) => { tool = v; });
  range(drawBox, t('ref', 'Reference strength'), { min: 0, max: 100, value: refA * 100, fmt: (v) => `${v}%` }, (v) => { refA = v / 100; paint(); });
  buttons(drawBox, [[t('undo', 'Undo stroke'), () => { strokes.pop(); paint(); }], [t('clear', 'Clear drawing'), () => { strokes.length = 0; paint(); }]]);
  const out = stats(L.panel, [['ink', t('s.ink', 'Ink on the forms')], ['match', t('s.match', 'Value match')], ['light', t('s.light', 'Light')]]);
  note(L.panel, t('matchn', 'Value match compares the ink in each small patch of paper with the value it stands for. 100% would be a perfect translation of light into marks.'));
  heading(L.panel, t('galh', 'My gallery'));
  buttons(L.panel, [[t('save', 'Save to my gallery'), () => saveGal(), true], [t('dl', 'Download'), () => exportPng()]]);
  const galBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap', gap: '6px' } });
  L.panel.append(galBox);
  const gal = store<Saved[]>(ctx.id, 'gallery', [], (v) => Array.isArray(v));
  const galMsg = note(L.panel, '');

  function save() { st.set(cfg); }
  function setMode(m: 'light' | 'draw') {
    mode = m; modeSeg.set(m); drawBox.style.display = m === 'draw' ? '' : 'none';
    S.cv.style.touchAction = m === 'draw' ? 'none' : 'pan-y'; S.cv.style.cursor = m === 'draw' ? 'crosshair' : 'grab'; paint();
  }

  /* --- rendering pipeline: geometry is cached; light changes re-shade; technique changes re-ink --- */
  const layer = document.createElement('canvas'), lg = layer.getContext('2d')!;
  let F: Frame | null = null, need: 0 | 1 | 2 | 3 = 3, fast = false, raf = 0, slowT = 0, last = { ink: 0, match: 1 };
  const LEVEL = { ink: 1, shade: 2, geo: 3 } as const;
  function scaleFor(w: number, hh: number, quick: boolean) { const d = Math.min(2, devicePixelRatio || 1), maxPx = 1.15e6; return Math.min(d, Math.sqrt(maxPx / (w * hh))) * (quick ? .5 : 1); }
  function redraw(what: keyof typeof LEVEL, quick = false) {
    need = Math.max(need, LEVEL[what]) as typeof need; fast = quick;
    if (!raf) raf = requestAnimationFrame(run);
    clearTimeout(slowT); if (quick) slowT = window.setTimeout(() => { need = 3; fast = false; if (!raf) raf = requestAnimationFrame(run); }, 260);
  }
  function inkOpts(): InkOpts { return { tech: cfg.tech, spacing: cfg.sp, wobble: cfg.wob, outline: cfg.ol, ink: INKS[cfg.ink] ?? INKS.black, paper: PAPER }; }
  function run() {
    raf = 0; const W = S.w, H = S.h, sc = scaleFor(W, H, fast);
    if (!F || need >= 3 || Math.abs(F.sc - sc) > 1e-6 || F.bw !== Math.max(1, Math.round(W * sc))) { F = geometry(objs, W, H, sc, BAND); need = 2; }
    if (need >= 2) shadeFrame(F, objs, lightDir(cfg.az, cfg.el));
    layer.width = F.bw; layer.height = F.bh;
    const img = lg.createImageData(F.bw, F.bh); last = inkFrame(F, inkOpts(), img.data); lg.putImageData(img, 0, 0);
    need = 0; paint();
    out('ink', `${Math.round(last.ink * 100)}%`); out('match', cfg.tech === 'line' ? '—' : `${Math.round(last.match * 100)}%`);
    out('light', `${cfg.az}° / ${cfg.el}°`);
  }
  function inkCss() { const c = INKS[cfg.ink] ?? INKS.black; return `rgb(${c[0]},${c[1]},${c[2]})`; }
  function drawStrokes(g: CanvasRenderingContext2D, k: number) {
    g.save(); g.fillStyle = g.strokeStyle = inkCss(); g.lineCap = g.lineJoin = 'round';
    for (const s of strokes.concat(cur ? [cur] : [])) {
      const f = k * S.w / s.w, p = s.p;
      if (p.length === 3) { g.beginPath(); g.arc(p[0] * f, p[1] * f, p[2] * f / 2, 0, 7); g.fill(); continue; }
      for (let i = 3; i < p.length; i += 3) { g.lineWidth = (p[i - 1] + p[i + 2]) / 2 * f; g.beginPath(); g.moveTo(p[i - 3] * f, p[i - 2] * f); g.lineTo(p[i] * f, p[i + 1] * f); g.stroke(); }
    }
    g.restore();
  }
  function labels(g: CanvasRenderingContext2D, W: number, H: number) {
    /* the five parts of light, found on the first sphere of the arrangement */
    const sp = objs.find((o) => o.k === 'sphere'); if (!sp) return;
    const cam = camera(W, H), Ld = lightDir(cfg.az, cfg.el), c: V3 = [sp.x, sp.r, sp.z];
    /* sample the visible half of the sphere and pick a representative point for each part of light */
    let hi: [number, V3] = [-1, c], li: [number, V3] = [9, c], co: [number, V3] = [9, c], re: [number, V3] = [-1, c];
    for (let a = 0; a < 40; a++) for (let b = 1; b < 20; b++) {
      const th = a / 40 * Math.PI * 2, ph = b / 20 * Math.PI, n: V3 = [Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)];
      const p = add(c, mul(n, sp.r)), vv = norm(sub(cam.ro, p)), nv = dot(n, vv); if (nv < .3) continue;
      const nl = dot(n, Ld), val = value(n, Ld, vv, nl > 0, false, Math.max(0, Ld[1]));
      if (val > hi[0]) hi = [val, p];
      if (nl > .35 && Math.abs(val - .68) < li[0]) li = [Math.abs(val - .68), p];
      if (nl < -.02 && nl > -.3 && val < co[0]) co = [val, p];
      if (nl < -.45 && val > re[0]) re = [val, p];
    }
    const items: [string, V3, number][] = [[t('v.hi', 'Highlight'), hi[1], 0]];
    if (li[0] < 9) items.push([t('v.light', 'Light'), li[1], 0]);
    if (co[0] < 9) items.push([t('v.core', 'Core shadow'), co[1], 0]);
    if (re[0] > 0) items.push([t('v.refl', 'Reflected light'), re[1], 0]);
    if (Ld[1] > .08) { const k = sp.r / Ld[1]; items.push([t('v.cast', 'Cast shadow'), [c[0] - Ld[0] * k * 1.25, 0, c[2] - Ld[2] * k * 1.25], 1]); }
    g.save(); g.font = '600 12px system-ui, sans-serif'; g.textBaseline = 'middle';
    if (W < 600) {
      /* narrow screens: numbered dots on the sphere and a key in the corner */
      const key: string[] = [];
      items.forEach(([txt, p]) => {
        const [x, y] = project(cam, p); if (x < 4 || x > W - 4 || y < 4 || y > H - BAND - 4) return;
        const n = String(key.length + 1); key.push(`${n}  ${txt}`);
        g.fillStyle = 'rgba(200,40,30,.95)'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.font = '700 10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(n, x, y + .5);
      });
      g.font = '600 11px system-ui, sans-serif'; g.textAlign = 'left';
      const y0 = H - BAND - 18 - key.length * 15, kw = Math.max(0, ...key.map((k) => g.measureText(k).width)) + 12;
      if (key.length) { g.fillStyle = 'rgba(255,252,244,.9)'; g.fillRect(4, y0 - 9, kw, key.length * 15 + 3); }
      key.forEach((k, i) => { g.fillStyle = '#7a1a12'; g.fillText(k, 10, y0 + i * 15); });
      g.restore(); return;
    }
    const used: number[][] = [];
    for (const [txt, p] of items) {
      const [x, y] = project(cam, p); if (x < 4 || x > W - 4 || y < 4 || y > H - BAND - 4) continue;
      const left = x > W * .5; let ly = y - 26; for (let pass = 0; pass < 4; pass++) for (const u of used) if (Math.abs(u[1] - ly) < 20 && Math.abs(u[0] - x) < 170) ly = u[1] - 22;
      const lx = x + (left ? -1 : 1) * Math.min(54, W * .09); used.push([x, ly]);
      g.strokeStyle = 'rgba(200,40,30,.9)'; g.fillStyle = 'rgba(200,40,30,.95)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); g.beginPath(); g.moveTo(x, y); g.lineTo(lx, ly); g.stroke();
      const tw = g.measureText(txt).width; g.fillStyle = 'rgba(255,252,244,.92)'; g.fillRect(left ? lx - tw - 8 : lx, ly - 9, tw + 8, 18);
      g.fillStyle = '#7a1a12'; g.textAlign = left ? 'right' : 'left'; g.fillText(txt, left ? lx - 4 : lx + 4, ly);
    }
    g.restore();
  }
  function compass(g: CanvasRenderingContext2D, W: number) {
    const cx = W - 40, cy = 40, r = 26, a = cfg.az * Math.PI / 180, e = cfg.el / 90;
    g.save(); g.fillStyle = 'rgba(255,252,244,.85)'; g.strokeStyle = 'rgba(40,30,20,.55)'; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke(); g.beginPath(); g.arc(cx, cy, r * .5, 0, 7); g.stroke();
    const sx = cx + Math.sin(a) * r * (1 - e), sy = cy + Math.cos(a) * r * (1 - e) * .6 - e * 4;
    g.fillStyle = '#e8a317'; g.beginPath(); g.arc(sx, sy, 5, 0, 7); g.fill(); g.strokeStyle = '#8a5a00'; g.stroke();
    g.fillStyle = '#3a2a1a'; g.font = '10px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(t('you', 'you'), cx, cy + r + 10);
    g.restore();
  }
  function paint() {
    const g = S.g, W = S.w, H = S.h;
    g.fillStyle = `rgb(${PAPER.join(',')})`; g.fillRect(0, 0, W, H);
    if (F) { g.save(); g.globalAlpha = mode === 'draw' ? refA : 1; g.imageSmoothingQuality = 'high'; g.drawImage(layer, 0, 0, W, H); g.restore(); }
    if (cfg.tech === 'tone' && mode === 'light') labels(g, W, H);
    drawStrokes(g, 1);
    if (mode === 'light') compass(g, W);
    g.save(); g.font = '600 10px system-ui, sans-serif'; g.fillStyle = 'rgba(60,40,20,.75)'; g.textBaseline = 'bottom'; g.fillText(t('scale', '10-step value scale'), 6, H - BAND - 3); g.restore();
  }

  /* --- pointer: orbit the light, or draw with speed- and pressure-sensitive ink --- */
  let drag: { x: number; y: number; az: number; el: number; lx: number; ly: number; lt: number; w: number } | null = null;
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv); S.cv.setPointerCapture(e.pointerId);
    drag = { x: p.x, y: p.y, az: cfg.az, el: cfg.el, lx: p.x, ly: p.y, lt: performance.now(), w: 0 };
    if (mode === 'draw') { const w = width(e, 0, true); cur = { w: S.w, tool, p: [p.x, p.y, w] }; drag.w = w; paint(); }
  });
  function width(e: PointerEvent, speed: number, start = false) {
    const base = tool === 'brush' ? 7 : 1.7, vary = tool === 'brush' ? .85 : .35;
    if (e.pointerType === 'pen' && e.pressure > 0) return base * (.25 + e.pressure * 1.1);
    const s = clamp(speed / 1.4, 0, 1); return base * (1 - vary * s) * (start ? .6 : 1);
  }
  S.cv.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = local(e, S.cv);
    if (mode === 'light') {
      cfg.az = Math.round(((drag.az + (p.x - drag.x) * .6 + 540) % 360) - 180); cfg.el = Math.round(clamp(drag.el - (p.y - drag.y) * .35, 6, 85));
      azR.set(cfg.az); elR.set(cfg.el); redraw('shade', true); return;
    }
    if (!cur) return;
    const now = performance.now(), dist = Math.hypot(p.x - drag.lx, p.y - drag.ly); if (dist < 1.2) return;
    const sp = dist / Math.max(1, now - drag.lt), w = drag.w * .6 + width(e, sp) * .4;
    cur.p.push(p.x, p.y, w); drag.lx = p.x; drag.ly = p.y; drag.lt = now; drag.w = w; paint();
  });
  const end = () => {
    if (mode === 'light' && drag) save();
    if (cur) { const p = cur.p; if (p.length >= 6) { p[2] *= .5; p[p.length - 1] *= .45; } strokes.push(cur); cur = null; paint(); }
    drag = null;
  };
  S.cv.addEventListener('pointerup', end); S.cv.addEventListener('pointercancel', end);
  S.cv.addEventListener('keydown', (e) => {
    const k = e.key; if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) return; e.preventDefault();
    if (k === 'ArrowLeft' || k === 'ArrowRight') { cfg.az = ((cfg.az + (k === 'ArrowLeft' ? -10 : 10) + 540) % 360) - 180; azR.set(cfg.az); }
    else { cfg.el = clamp(cfg.el + (k === 'ArrowUp' ? 5 : -5), 6, 85); elR.set(cfg.el); }
    save(); redraw('shade');
  });

  /* --- export, gallery --- */
  function compose(target: number) {
    const W = S.w, H = S.h, k = target / W, sc = Math.min(k, Math.sqrt(4.2e6 / (W * H)));
    const FF = geometry(objs, W, H, sc, BAND); shadeFrame(FF, objs, lightDir(cfg.az, cfg.el));
    const c = document.createElement('canvas'); c.width = FF.bw; c.height = FF.bh; const g = c.getContext('2d')!;
    const img = g.createImageData(FF.bw, FF.bh); inkFrame(FF, { ...inkOpts(), spacing: cfg.sp }, img.data); g.putImageData(img, 0, 0);
    drawStrokes(g, sc);
    return c;
  }
  function exportPng() { download(compose(2000), `abidora-ink-${cfg.tech}-${Date.now().toString(36)}.png`); }
  function saveGal() {
    const c = compose(900), list = gal.get();
    list.unshift({ img: c.toDataURL('image/jpeg', .82), tech: cfg.tech, at: Date.now() });
    while (list.length > 6) list.pop();
    while (list.length && !gal.set(list)) list.pop();
    galMsg.textContent = list.length ? '' : t('full', 'This browser has no room left to save pictures.');
    showGal();
  }
  function showGal() {
    galBox.replaceChildren();
    gal.get().forEach((s, i) => {
      const b = h('button', { type: 'button', class: 'wk-b', title: t('dlone', 'Download this picture'), style: { padding: '2px' }, onclick: () => { const a = h('a', { href: s.img, download: `abidora-ink-${s.tech}-${i + 1}.jpg` }); document.body.append(a); a.click(); a.remove(); } },
        h('img', { src: s.img, alt: TECH.find((x) => x[0] === s.tech)?.[1] ?? '', width: 84, style: { display: 'block', height: 'auto', borderRadius: '4px' } }));
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove from gallery'), text: '×', onclick: () => { const l = gal.get(); l.splice(i, 1); gal.set(l); showGal(); } });
      galBox.append(h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '2px' } }, b, del));
    });
  }

  S.onResize(() => redraw('geo'));
  setMode('light'); showGal(); redraw('geo');
  ctx.onDispose(() => { cancelAnimationFrame(raf); clearTimeout(slowT); });
}
