/* 052 Visual Storytelling: Storyboard Studio. Film grammar you can test. Two characters stand in a
   small room seen from above. Each shot is a real camera on that floor plan, with a position, an aim,
   a height and a lens, and its frame is drawn in true perspective. The studio reads every frame the
   way an editor would: how big the subject is (from extreme wide to extreme close-up), whether the
   camera is low, level or high, who is on the left of the screen, and whether a cut breaks the
   180-degree rule (the camera jumps across the line between the two characters, so they swap sides)
   or risks a jump cut (too little change between shots of the same subject). Build a sequence, write
   the action or dialogue under each frame, and download the board. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, buttons, local, clamp, store, download } from './kit';

type V3 = [number, number, number];
export interface Shot { x: number; z: number; yaw: number; ang: 'low' | 'eye' | 'high'; f: number; cap: string }
export interface Board { A: [number, number]; B: [number, number]; shots: Shot[] }
const ANG = { low: { h: .62, p: 11 }, eye: { h: 1.6, p: -1 }, high: { h: 3.1, p: -27 } } as const;
export const ASPECT = 16 / 9;
const HEAD = 1.62, TOP = 1.75;

/* ---------- camera maths ---------- */
export interface Cam { c: V3; fw: V3; rt: V3; up: V3; fpx: number; W: number; H: number }
export function camOf(s: Shot, W: number, H: number): Cam {
  const a = ANG[s.ang] ?? ANG.eye, p = a.p * Math.PI / 180, fw: V3 = [Math.cos(s.yaw) * Math.cos(p), Math.sin(p), Math.sin(s.yaw) * Math.cos(p)];
  const rl = Math.hypot(fw[2], fw[0]) || 1, rt: V3 = [-fw[2] / rl, 0, fw[0] / rl];
  const up: V3 = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]];
  /* a 36 mm wide full-frame sensor: horizontal field of view from the focal length */
  return { c: [s.x, a.h, s.z], fw, rt, up, fpx: (W / 2) / (18 / s.f), W, H };
}
export function proj(cm: Cam, p: V3): [number, number, number] {
  const d: V3 = [p[0] - cm.c[0], p[1] - cm.c[1], p[2] - cm.c[2]], zc = d[0] * cm.fw[0] + d[1] * cm.fw[1] + d[2] * cm.fw[2];
  return [cm.W / 2 + (d[0] * cm.rt[0] + d[2] * cm.rt[2]) / zc * cm.fpx, cm.H / 2 - (d[0] * cm.up[0] + d[1] * cm.up[1] + d[2] * cm.up[2]) / zc * cm.fpx, zc];
}
/** side of the line from A to B the camera stands on (+1 or -1); this is what the 180-degree rule protects */
export const sideOf = (bd: Board, x: number, z: number) => Math.sign((bd.B[0] - bd.A[0]) * (z - bd.A[1]) - (bd.B[1] - bd.A[1]) * (x - bd.A[0])) || 1;

export type Size = 'ews' | 'ws' | 'fs' | 'mls' | 'ms' | 'mcu' | 'cu' | 'ecu' | 'none';
export interface Read { size: Size; subject: 'A' | 'B' | ''; left: 'A' | 'B' | ''; ots: boolean; inFrame: { A: boolean; B: boolean } }
/** read a frame like an editor: who dominates it, how much of them shows, who is on the left */
export function readShot(bd: Board, s: Shot): Read {
  const cm = camOf(s, 1600, 900), r: Read = { size: 'none', subject: '', left: '', ots: false, inFrame: { A: false, B: false } };
  const info = (['A', 'B'] as const).map((k) => {
    const [x, z] = bd[k], foot = proj(cm, [x, 0, z]), top = proj(cm, [x, TOP, z]), mid = proj(cm, [x, 1.2, z]);
    if (foot[2] < .2) return null;
    const hpx = foot[1] - top[1], halfW = .25 / foot[2] * cm.fpx, vis = mid[0] + halfW > 0 && mid[0] - halfW < 1600 && top[1] < 900 && foot[1] > 0;
    if (!vis) return null;
    r.inFrame[k] = true;
    /* how many metres of the figure, from the top of the head down, are inside the frame */
    const yAt = (yy: number) => proj(cm, [x, yy, z])[1];
    let cut = 0; if (foot[1] > 900) { let lo = 0, hi = TOP; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (yAt(m) > 900) lo = m; else hi = m; } cut = lo; }
    const centred = 1 - Math.min(1, Math.abs(mid[0] - 800) / 800), edge = mid[0] - halfW < 0 || mid[0] + halfW > 1600;
    return { k, hpx, visM: TOP - cut, cx: mid[0], centred, edge, near: foot[2] };
  }).filter((q): q is NonNullable<typeof q> => !!q);
  if (!info.length) return r;
  if (info.length === 2) r.left = info[0].cx < info[1].cx ? info[0].k : info[1].k;
  /* the subject is the character the frame is about: big and central beats near and cut off at the edge */
  info.sort((a, b) => (b.hpx * (.4 + b.centred) * (b.edge ? .45 : 1)) - (a.hpx * (.4 + a.centred) * (a.edge ? .45 : 1)));
  const sj = info[0]; r.subject = sj.k;
  r.ots = info.length === 2 && info[1].edge && info[1].near < sj.near;
  const ratio = sj.hpx / 900;
  if (sj.visM >= TOP - .02) r.size = ratio < .14 ? 'ews' : ratio < .42 ? 'ws' : 'fs';
  else r.size = sj.visM < .32 ? 'ecu' : sj.visM < .58 ? 'cu' : sj.visM < .85 ? 'mcu' : sj.visM < 1.15 ? 'ms' : 'mls';
  return r;
}
export interface Note { k: 'line' | 'jump' | 'ok'; i: number }
/** check each cut against the previous shot */
export function checkCuts(bd: Board): Note[] {
  const out: Note[] = [], R = bd.shots.map((s) => readShot(bd, s));
  for (let i = 1; i < bd.shots.length; i++) {
    const a = bd.shots[i - 1], b = bd.shots[i];
    const both = (R[i - 1].inFrame.A || R[i - 1].inFrame.B) && (R[i].inFrame.A || R[i].inFrame.B);
    if (both && sideOf(bd, a.x, a.z) !== sideOf(bd, b.x, b.z)) { out.push({ k: 'line', i }); continue; }
    if (R[i].subject && R[i].subject === R[i - 1].subject && R[i].size === R[i - 1].size) {
      const P = bd[R[i].subject as 'A' | 'B'], d1 = Math.atan2(a.z - P[1], a.x - P[0]), d2 = Math.atan2(b.z - P[1], b.x - P[0]);
      let dd = Math.abs(d1 - d2) * 180 / Math.PI; if (dd > 180) dd = 360 - dd;
      if (dd < 30) out.push({ k: 'jump', i });
    }
  }
  return out;
}
/** classic set-ups, placed on the current side of the line */
export function preset(bd: Board, kind: string, side: number): Shot {
  const [ax, az] = bd.A, [bx, bz] = bd.B, dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * side, nz = ux * side;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2, aim = (x: number, z: number, tx: number, tz: number) => Math.atan2(tz - z, tx - x);
  const mk = (x: number, z: number, tx: number, tz: number, f: number, ang: Shot['ang'] = 'eye'): Shot => ({ x, z, yaw: aim(x, z, tx, tz), ang, f, cap: '' });
  switch (kind) {
    case 'wide': return mk(mx + nx * 3.0, mz + nz * 3.0, mx, mz, 18);
    case 'two': return mk(mx + nx * 2.3, mz + nz * 2.3, mx, mz, 28);
    case 'otsA': { const x = bx + ux * .95 + nx * .42, z = bz + uz * .95 + nz * .42; return mk(x, z, ax, az, 50); }
    case 'otsB': { const x = ax - ux * .95 + nx * .42, z = az - uz * .95 + nz * .42; return mk(x, z, bx, bz, 50); }
    case 'cuA': { const x = ax + ux * 1.15 + nx * 1.35, z = az + uz * 1.15 + nz * 1.35; return mk(x, z, ax, az, 85); }
    case 'cuB': { const x = bx - ux * 1.15 + nx * 1.35, z = bz - uz * 1.15 + nz * 1.35; return mk(x, z, bx, bz, 85); }
    default: return mk(mx + nx * 3, mz + nz * 3, mx, mz, 35);
  }
}
export const DEFAULT_BOARD = (): Board => { const bd: Board = { A: [-.75, .1], B: [.75, -.1], shots: [] }; bd.shots = ['wide', 'otsB', 'otsA', 'cuA'].map((k) => preset(bd, k, 1)); return bd; };

/* ---------- drawing a frame ---------- */
const COL = { A: '#2f8f8a', B: '#d0674c', skin: '#e9c3a0', skin2: '#8a5a3c' };
function clipNear(poly: V3[], cm: Cam): [number, number][] {
  const near = .08, z = (p: V3) => (p[0] - cm.c[0]) * cm.fw[0] + (p[1] - cm.c[1]) * cm.fw[1] + (p[2] - cm.c[2]) * cm.fw[2], out: V3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], za = z(a), zb = z(b);
    if (za >= near) out.push(a);
    if ((za >= near) !== (zb >= near)) { const t = (near - za) / (zb - za); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
  }
  return out.map((p) => { const q = proj(cm, p); return [q[0], q[1]]; });
}
function fillPoly(g: CanvasRenderingContext2D, pts: [number, number][], col: string) { if (pts.length < 3) return; g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): V3[][] {
  return [[[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]]];
}
export function drawFrame(g: CanvasRenderingContext2D, bd: Board, s: Shot, ox: number, oy: number, W: number, H: number) {
  const cm = camOf(s, W, H);
  g.save(); g.beginPath(); g.rect(ox, oy, W, H); g.clip(); g.translate(ox, oy);
  g.fillStyle = '#e9e4da'; g.fillRect(0, 0, W, H);
  /* room: floor, back and side walls, a window and a door, so space and direction read clearly */
  const walls: [V3[], string][] = [
    [[[-4, 0, -3.2], [4, 0, -3.2], [4, 0, 3.2], [-4, 0, 3.2]], '#c9b79c'],
    [[[-4, 0, 3.2], [4, 0, 3.2], [4, 2.8, 3.2], [-4, 2.8, 3.2]], '#dcd3c3'],
    [[[-4, 0, -3.2], [4, 0, -3.2], [4, 2.8, -3.2], [-4, 2.8, -3.2]], '#d3cdc4'],
    [[[-4, 0, -3.2], [-4, 0, 3.2], [-4, 2.8, 3.2], [-4, 2.8, -3.2]], '#cfc6b6'],
    [[[4, 0, -3.2], [4, 0, 3.2], [4, 2.8, 3.2], [4, 2.8, -3.2]], '#d6cdbd'],
  ];
  const inside = Math.abs(s.x) < 4 && Math.abs(s.z) < 3.2;
  const wallsSorted = walls.slice(1).sort((a, b) => { const za = proj(cm, a[0][0])[2] + proj(cm, a[0][2])[2], zb = proj(cm, b[0][0])[2] + proj(cm, b[0][2])[2]; return zb - za; });
  for (const [p, c] of [walls[0], ...wallsSorted]) { if (!inside && p[0][1] === 0 && p[2][1] === 2.8) { const n = proj(cm, [(p[0][0] + p[2][0]) / 2, 1.4, (p[0][2] + p[2][2]) / 2]); if (n[2] < 0) continue; } fillPoly(g, clipNear(p, cm), c); }
  g.strokeStyle = 'rgba(80,60,40,.18)'; g.lineWidth = 1;
  for (let k = -4; k <= 4; k++) { const a = clipNear([[k, .001, -3.2], [k, .001, 3.2], [k, .001, 3.2]], cm); if (a.length >= 2) { g.beginPath(); g.moveTo(a[0][0], a[0][1]); g.lineTo(a[1][0], a[1][1]); g.stroke(); } }
  for (let k = -3; k <= 3; k++) { const a = clipNear([[-4, .001, k], [4, .001, k], [4, .001, k]], cm); if (a.length >= 2) { g.beginPath(); g.moveTo(a[0][0], a[0][1]); g.lineTo(a[1][0], a[1][1]); g.stroke(); } }
  fillPoly(g, clipNear([[-1.2, 1, 3.19], [1.2, 1, 3.19], [1.2, 2.3, 3.19], [-1.2, 2.3, 3.19]], cm), '#9cc3d6');
  fillPoly(g, clipNear([[-.05, 1, 3.18], [.05, 1, 3.18], [.05, 2.3, 3.18], [-.05, 2.3, 3.18]], cm), '#f4efe6');
  fillPoly(g, clipNear([[-3.99, 0, -1.6], [-3.99, 0, -.6], [-3.99, 2.1, -.6], [-3.99, 2.1, -1.6]], cm), '#8b6b4f');
  /* objects with depth: props and the two characters, far to near */
  type Item = { z: number; draw: () => void };
  const items: Item[] = [];
  const addBox = (b: V3[][], col: string[], cx: number, cz: number) => { const d = proj(cm, [cx, .5, cz])[2]; items.push({ z: d, draw: () => b.map((f) => ({ f, z: f.reduce((s2, p) => s2 + proj(cm, p)[2], 0) })).sort((a, b2) => b2.z - a.z).forEach(({ f }, i) => fillPoly(g, clipNear(f, cm), col[i % col.length])) }); };
  addBox(box(2.4, 3.0, 0, .9, 1.9, 2.5), ['#7b8b5c', '#6c7b50', '#87986a'], 2.7, 2.2);
  addBox(box(2.62, 2.78, .9, 1.9, 2.12, 2.28), ['#4e5b3a'], 2.7, 2.2);
  addBox(box(-3.3, -2.5, 0, .75, 1.8, 2.6), ['#9a7552', '#86643f', '#a8825d'], -2.9, 2.2);
  addBox(box(-3.05, -2.75, .75, 1.55, 2.05, 2.35), ['#e8d29a', '#d9c07f'], -2.9, 2.2);
  for (const k of ['A', 'B'] as const) {
    const [x, z] = bd[k], other = bd[k === 'A' ? 'B' : 'A'], face = Math.atan2(other[1] - z, other[0] - x), d = proj(cm, [x, 1, z])[2];
    items.push({ z: d, draw: () => figure(g, cm, x, z, face, COL[k], k) });
  }
  items.sort((a, b) => b.z - a.z).forEach((it) => { if (it.z > .1) it.draw(); });
  g.restore();
}
function figure(g: CanvasRenderingContext2D, cm: Cam, x: number, z: number, face: number, col: string, label: string) {
  const P = (y: number) => proj(cm, [x, y, z]);
  const f = P(0), hd = P(HEAD), sh = P(1.38), hip = P(.85); if (f[2] < .12) return;
  const k = cm.fpx / f[2];
  /* torso and legs as simple shapes, head with a face that turns with the character */
  g.fillStyle = '#3b3a44'; g.beginPath(); g.moveTo(hip[0] - .17 * k, hip[1]); g.lineTo(hip[0] + .17 * k, hip[1]); g.lineTo(f[0] + .13 * k, f[1]); g.lineTo(f[0] - .13 * k, f[1]); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.moveTo(sh[0] - .24 * k, sh[1]); g.quadraticCurveTo(sh[0], sh[1] - .08 * k, sh[0] + .24 * k, sh[1]); g.lineTo(hip[0] + .19 * k, hip[1] + .03 * k); g.lineTo(hip[0] - .19 * k, hip[1] + .03 * k); g.closePath(); g.fill();
  const toCam = Math.atan2(cm.c[2] - z, cm.c[0] - x), rel = Math.atan2(Math.sin(face - toCam), Math.cos(face - toCam)), facing = Math.cos(rel), turn = Math.sin(rel);
  const hr = .115 * k;
  g.fillStyle = COL.skin; g.fillRect(hd[0] - .05 * k, hd[1], .1 * k, .14 * k);
  g.beginPath(); g.ellipse(hd[0], hd[1], hr * .9, hr * 1.12, 0, 0, Math.PI * 2); g.fill();
  /* hair covers the back of the head: more of it shows as the character turns away */
  g.fillStyle = COL.skin2; g.beginPath(); g.ellipse(hd[0] - turn * hr * .25, hd[1] - hr * .35, hr * .95, hr * .8, 0, Math.PI, Math.PI * 2); g.fill();
  if (facing < -.3) { g.beginPath(); g.ellipse(hd[0], hd[1], hr * .92, hr * 1.1, 0, 0, Math.PI * 2); g.fill(); }
  else {
    const ex = -turn * hr * .5, sp = Math.max(.15, facing) * hr * .38;
    g.fillStyle = '#2a2420';
    if (facing > .25) { g.beginPath(); g.arc(hd[0] + ex - sp, hd[1], Math.max(1, hr * .09), 0, 7); g.arc(hd[0] + ex + sp, hd[1], Math.max(1, hr * .09), 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(hd[0] + ex - Math.sign(turn) * hr * .25, hd[1], Math.max(1, hr * .09), 0, 7); g.fill(); g.fillStyle = COL.skin; g.beginPath(); g.arc(hd[0] - Math.sign(turn) * hr * .9, hd[1] + hr * .2, hr * .18, 0, 7); g.fill(); }
  }
  if (k > 30) { g.fillStyle = 'rgba(255,255,255,.9)'; g.font = `700 ${clamp(k * .09, 10, 22)}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(label, hd[0], hd[1] - hr * 1.6); }
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(620px, 66vw, 760px)';
  const S = canvas(L.view, t('cv', 'Storyboard studio: a floor plan with cameras, the selected frame, and the strip of shots.'), { alpha: false });
  const st = store<Board>(ctx.id, 'board', DEFAULT_BOARD(), (v) => typeof v === 'object' && v !== null && 'shots' in v && Array.isArray((v as Board).shots));
  let bd: Board = st.get(); if (!bd.shots.length) bd = DEFAULT_BOARD();
  let sel = 0; const save = () => st.set(bd);
  const SIZE: Record<Size, string> = { ews: t('sz.ews', 'Extreme wide'), ws: t('sz.ws', 'Wide shot'), fs: t('sz.fs', 'Full shot'), mls: t('sz.mls', 'Medium long'), ms: t('sz.ms', 'Medium shot'), mcu: t('sz.mcu', 'Medium close-up'), cu: t('sz.cu', 'Close-up'), ecu: t('sz.ecu', 'Extreme close-up'), none: t('sz.none', 'Nobody in frame') };
  const ANGN = { low: t('ang.low', 'Low angle'), eye: t('ang.eye', 'Eye level'), high: t('ang.high', 'High angle') };

  heading(L.panel, t('shoth', 'This shot'));
  const shotTitle = note(L.panel, '');
  const angSeg = seg(L.panel, t('angl', 'Camera height'), [['low', ANGN.low], ['eye', ANGN.eye], ['high', ANGN.high]], 'eye', (v) => { bd.shots[sel].ang = v as Shot['ang']; save(); draw(); });
  const lens = range(L.panel, t('lens', 'Lens'), { min: 16, max: 135, value: 35, fmt: (v) => `${v} mm` }, (v) => { bd.shots[sel].f = v; save(); draw(); });
  const cap = h('input', { type: 'text', maxlength: 120, placeholder: t('capph', 'Action or dialogue for this frame'), 'aria-label': t('capl', 'Caption'), style: { width: '100%', padding: '8px', borderRadius: '8px', font: 'inherit' } }) as HTMLInputElement;
  cap.addEventListener('input', () => { bd.shots[sel].cap = cap.value; save(); draw(); }); L.panel.append(cap);
  heading(L.panel, t('seth', 'Set up a classic shot'));
  const side = () => sideOf(bd, bd.shots[0]?.x ?? 0, bd.shots[0]?.z ?? 3);
  const P = (k: string) => () => { const s = preset(bd, k, side()); s.cap = bd.shots[sel].cap; bd.shots[sel] = s; save(); syncPanel(); draw(); };
  buttons(L.panel, [[t('p.wide', 'Wide'), P('wide')], [t('p.two', 'Two-shot'), P('two')], [t('p.otsB', 'Over A\'s shoulder'), P('otsB')], [t('p.otsA', 'Over B\'s shoulder'), P('otsA')], [t('p.cuA', 'Close-up on A'), P('cuA')], [t('p.cuB', 'Close-up on B'), P('cuB')]]);
  heading(L.panel, t('seqh', 'Sequence'));
  buttons(L.panel, [[t('add', 'Add shot'), () => { if (bd.shots.length >= 8) return; const c = { ...bd.shots[sel], cap: '' }; bd.shots.splice(sel + 1, 0, c); sel++; save(); syncPanel(); draw(); }, true], [t('del', 'Delete shot'), () => { if (bd.shots.length <= 1) return; bd.shots.splice(sel, 1); sel = Math.min(sel, bd.shots.length - 1); save(); syncPanel(); draw(); }], [t('left', 'Move earlier'), () => mv(-1)], [t('right', 'Move later'), () => mv(1)]]);
  const rules = h('div', { class: 'wk-note', 'aria-live': 'polite' }); L.panel.append(rules);
  note(L.panel, t('rulesn', 'The 180-degree rule: keep every camera on one side of the line between the two characters, so A stays on one side of the screen and B on the other. Cross it only on purpose, ideally with a moving shot or a neutral shot in between.'));
  buttons(L.panel, [[t('dl', 'Download the board'), () => exportBoard(), true], [t('reset', 'Start again'), () => { bd = DEFAULT_BOARD(); sel = 0; save(); syncPanel(); draw(); }]]);
  function mv(d: number) { const j = sel + d; if (j < 0 || j >= bd.shots.length) return; [bd.shots[sel], bd.shots[j]] = [bd.shots[j], bd.shots[sel]]; sel = j; save(); syncPanel(); draw(); }
  function syncPanel() { const s = bd.shots[sel]; angSeg.set(s.ang); lens.set(s.f); cap.value = s.cap; }

  /* ---------- layout ---------- */
  function areas() {
    const W = S.w, H = S.h, wide = W > 760, strip = Math.min(150, H * .22);
    if (wide) { const top = H - strip - 12, planW = W * .36, fw = Math.min(W - planW - 24, (top - 16) * ASPECT); return { plan: { x: 8, y: 8, w: planW - 12, h: top - 8 }, frame: { x: planW + 8, y: 8 + (top - 8 - fw / ASPECT) / 2, w: fw, h: fw / ASPECT }, strip: { x: 8, y: H - strip - 4, w: W - 16, h: strip } }; }
    const fw = W - 16, fh = fw / ASPECT, planH = Math.max(150, H - fh - strip - 36);
    return { plan: { x: 8, y: 8, w: W - 16, h: planH }, frame: { x: 8, y: planH + 16, w: fw, h: fh }, strip: { x: 8, y: planH + fh + 24, w: W - 16, h: H - planH - fh - 28 } };
  }
  const planMap = (R: { x: number; y: number; w: number; h: number }) => { const sc = Math.min(R.w / 9, R.h / 7.2), cx = R.x + R.w / 2, cy = R.y + R.h / 2; return { sc, X: (x: number) => cx + x * sc, Y: (z: number) => cy + z * sc, ix: (px: number) => (px - cx) / sc, iz: (py: number) => (py - cy) / sc }; };

  function draw() {
    const g = S.g, W = S.w, H = S.h, A = areas(); g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, W, H);
    const reads = bd.shots.map((s) => readShot(bd, s)), cuts = checkCuts(bd);
    /* floor plan */
    const pm = planMap(A.plan); g.save();
    g.fillStyle = '#fff'; g.strokeStyle = '#b9ae9d'; g.lineWidth = 2; g.fillRect(pm.X(-4), pm.Y(-3.2), 8 * pm.sc, 6.4 * pm.sc); g.strokeRect(pm.X(-4), pm.Y(-3.2), 8 * pm.sc, 6.4 * pm.sc);
    g.strokeStyle = '#9cc3d6'; g.lineWidth = 4; g.beginPath(); g.moveTo(pm.X(-1.2), pm.Y(3.2)); g.lineTo(pm.X(1.2), pm.Y(3.2)); g.stroke();
    g.strokeStyle = '#8b6b4f'; g.beginPath(); g.moveTo(pm.X(-4), pm.Y(-1.6)); g.lineTo(pm.X(-4), pm.Y(-.6)); g.stroke();
    g.fillStyle = '#c7d0b5'; g.fillRect(pm.X(2.4), pm.Y(1.9), .6 * pm.sc, .6 * pm.sc); g.fillStyle = '#e3d3b5'; g.fillRect(pm.X(-3.3), pm.Y(1.8), .8 * pm.sc, .8 * pm.sc);
    /* the line of action, extended across the room */
    const [ax, az] = bd.A, [bx, bz] = bd.B, dx = bx - ax, dz = bz - az, ll = Math.hypot(dx, dz) || 1;
    g.setLineDash([6, 5]); g.strokeStyle = 'rgba(200,60,40,.65)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(pm.X(ax - dx / ll * 6), pm.Y(az - dz / ll * 6)); g.lineTo(pm.X(bx + dx / ll * 6), pm.Y(bz + dz / ll * 6)); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(200,60,40,.8)'; g.font = '10px system-ui, sans-serif'; g.fillText(t('axis', 'the line'), pm.X(bx + dx / ll * 1.1) + 4, pm.Y(bz + dz / ll * 1.1) - 4);
    for (const k of ['A', 'B'] as const) { const [x, z] = bd[k]; g.fillStyle = COL[k]; g.beginPath(); g.arc(pm.X(x), pm.Y(z), .26 * pm.sc, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${Math.max(11, .22 * pm.sc)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, pm.X(x), pm.Y(z)); }
    bd.shots.forEach((s, i) => {
      const cx = pm.X(s.x), cy = pm.Y(s.z), hf = Math.atan(18 / s.f), on = i === sel, r = on ? 1.6 : 1.1;
      g.fillStyle = on ? 'rgba(40,90,200,.14)' : 'rgba(60,60,60,.05)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r * pm.sc, s.yaw - hf, s.yaw + hf); g.closePath(); g.fill();
      g.save(); g.translate(cx, cy); g.rotate(s.yaw); g.fillStyle = on ? '#2d5bd0' : '#55565e'; g.fillRect(-9, -6, 14, 12); g.beginPath(); g.moveTo(5, -4); g.lineTo(11, -7); g.lineTo(11, 7); g.lineTo(5, 4); g.fill(); g.restore();
      g.fillStyle = on ? '#2d5bd0' : '#55565e'; g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), cx, cy - 15);
      if (on) { const hx = cx + Math.cos(s.yaw) * 1.25 * pm.sc, hy = cy + Math.sin(s.yaw) * 1.25 * pm.sc; g.strokeStyle = '#2d5bd0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(hx, hy); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, 6, 0, 7); g.fill(); g.stroke(); }
    });
    g.fillStyle = 'rgba(40,40,40,.65)'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillText(t('planh', 'Floor plan: drag cameras, their aim handles, or the characters'), A.plan.x + 4, A.plan.y + A.plan.h - 4);
    g.restore();
    /* selected frame, large */
    const s = bd.shots[sel], rd = reads[sel];
    drawFrame(g, bd, s, A.frame.x, A.frame.y, A.frame.w, A.frame.h);
    g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(A.frame.x, A.frame.y, A.frame.w, A.frame.h);
    g.save(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; for (const f of [1 / 3, 2 / 3]) { g.beginPath(); g.moveTo(A.frame.x + A.frame.w * f, A.frame.y); g.lineTo(A.frame.x + A.frame.w * f, A.frame.y + A.frame.h); g.moveTo(A.frame.x, A.frame.y + A.frame.h * f); g.lineTo(A.frame.x + A.frame.w, A.frame.y + A.frame.h * f); g.stroke(); } g.restore();
    const label = `${sel + 1} · ${rd.ots ? t('sz.ots', 'Over-the-shoulder') + ', ' : ''}${SIZE[rd.size]}${rd.subject && !(rd.inFrame.A && rd.inFrame.B && ['ews', 'ws', 'fs'].includes(rd.size)) ? ' ' + t('on', 'on') + ' ' + rd.subject : ''} · ${ANGN[s.ang]} · ${s.f} mm`;
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(A.frame.x, A.frame.y, Math.min(A.frame.w, g.measureText(label).width * 1.25 + 24), 24); g.fillStyle = '#fff'; g.font = '600 12px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, A.frame.x + 8, A.frame.y + 12);
    if (s.cap) { g.font = '13px system-ui, sans-serif'; const tw = g.measureText(s.cap).width; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(A.frame.x + A.frame.w / 2 - tw / 2 - 8, A.frame.y + A.frame.h - 30, tw + 16, 22); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(s.cap, A.frame.x + A.frame.w / 2, A.frame.y + A.frame.h - 19); }
    /* strip of all shots, with cut warnings between them */
    const n = bd.shots.length, gap = 10, tw = Math.min((A.strip.w - gap * (n - 1)) / n, (A.strip.h - 22) * ASPECT), th = tw / ASPECT;
    stripRects = [];
    bd.shots.forEach((sh, i) => {
      const x = A.strip.x + i * (tw + gap), y = A.strip.y; stripRects.push([x, y, tw, th]);
      drawFrame(g, bd, sh, x, y, tw, th); g.strokeStyle = i === sel ? '#2d5bd0' : '#333'; g.lineWidth = i === sel ? 3 : 1; g.strokeRect(x, y, tw, th);
      g.fillStyle = '#333'; g.font = '600 10px system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${i + 1} ${SIZE[reads[i].size]}`, x, y + th + 3);
      const c = cuts.find((q) => q.i === i);
      if (c) { g.fillStyle = c.k === 'line' ? '#c8321e' : '#c98a00'; g.beginPath(); g.arc(x - gap / 2, y + th / 2, 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '700 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', x - gap / 2, y + th / 2 + .5); }
    });
    shotTitle.textContent = `${t('shot', 'Shot')} ${sel + 1} / ${n}: ${label.split(' · ').slice(1).join(' · ')}${rd.left ? ' · ' + t('leftis', 'on screen left:') + ' ' + rd.left : ''}`;
    rules.replaceChildren(...(cuts.length ? cuts.map((c) => h('p', { text: `${t('cut', 'Cut')} ${c.i} → ${c.i + 1}: ${c.k === 'line' ? t('w.line', 'crosses the line. A and B swap sides of the screen, which can confuse who is looking at whom.') : t('w.jump', 'same subject, same size, less than 30° apart. This reads as a jump cut; change the size or move the camera further round.')}` })) : [h('p', { text: t('w.ok', 'Every cut keeps the characters on their sides of the screen and changes enough between shots.') })]));
  }
  let stripRects: [number, number, number, number][] = [];

  /* ---------- pointer: select from the strip, drag on the plan ---------- */
  let drag: { k: 'cam' | 'aim' | 'A' | 'B'; i: number } | null = null;
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv), A = areas(), pm = planMap(A.plan);
    const hit = stripRects.findIndex(([x, y, w, hh]) => p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + hh);
    if (hit >= 0) { sel = hit; syncPanel(); draw(); return; }
    const s = bd.shots[sel], hx = pm.X(s.x) + Math.cos(s.yaw) * 1.25 * pm.sc, hy = pm.Y(s.z) + Math.sin(s.yaw) * 1.25 * pm.sc;
    if (Math.hypot(p.x - hx, p.y - hy) < 14) drag = { k: 'aim', i: sel };
    else {
      for (const k of ['A', 'B'] as const) if (Math.hypot(p.x - pm.X(bd[k][0]), p.y - pm.Y(bd[k][1])) < Math.max(14, .3 * pm.sc)) drag = { k, i: -1 };
      if (!drag) bd.shots.forEach((q, i) => { if (!drag && Math.hypot(p.x - pm.X(q.x), p.y - pm.Y(q.z)) < 16) { drag = { k: 'cam', i }; sel = i; syncPanel(); } });
    }
    if (drag) { S.cv.setPointerCapture(e.pointerId); S.cv.style.touchAction = 'none'; draw(); }
  });
  S.cv.addEventListener('pointermove', (e) => {
    if (!drag) return; const p = local(e, S.cv), pm = planMap(areas().plan), x = clamp(pm.ix(p.x), -6, 6), z = clamp(pm.iz(p.y), -5, 5);
    if (drag.k === 'cam') { bd.shots[drag.i].x = x; bd.shots[drag.i].z = z; }
    else if (drag.k === 'aim') { const s = bd.shots[drag.i]; s.yaw = Math.atan2(z - s.z, x - s.x); }
    else { bd[drag.k] = [clamp(x, -3.6, 3.6), clamp(z, -2.8, 2.8)]; }
    draw();
  });
  const up = () => { if (drag) save(); drag = null; S.cv.style.touchAction = 'pan-y'; };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up); S.cv.style.touchAction = 'pan-y';
  S.cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { sel = Math.min(bd.shots.length - 1, sel + 1); syncPanel(); draw(); } else if (e.key === 'ArrowLeft') { sel = Math.max(0, sel - 1); syncPanel(); draw(); } });

  function exportBoard() {
    const n = bd.shots.length, cols = n <= 4 ? 2 : 3, rows = Math.ceil(n / cols), fw = 640, fh = fw / ASPECT, pad = 36, capH = 64;
    const c = document.createElement('canvas'); c.width = cols * fw + (cols + 1) * pad; c.height = rows * (fh + capH) + (rows + 1) * pad + 40; const g = c.getContext('2d')!;
    g.fillStyle = '#fbfaf7'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#222'; g.font = '700 22px system-ui, sans-serif'; g.fillText(t('boardt', 'Storyboard'), pad, pad + 6);
    const reads = bd.shots.map((s) => readShot(bd, s)), cuts = checkCuts(bd);
    bd.shots.forEach((s, i) => {
      const x = pad + (i % cols) * (fw + pad), y = pad + 30 + Math.floor(i / cols) * (fh + capH + pad);
      drawFrame(g, bd, s, x, y, fw, fh); g.strokeStyle = '#222'; g.lineWidth = 2; g.strokeRect(x, y, fw, fh);
      g.fillStyle = '#222'; g.font = '700 15px system-ui, sans-serif'; g.fillText(`${i + 1}. ${reads[i].ots ? t('sz.ots', 'Over-the-shoulder') + ', ' : ''}${SIZE[reads[i].size]} · ${ANGN[s.ang]} · ${s.f} mm`, x, y + fh + 22);
      g.font = '14px system-ui, sans-serif'; g.fillStyle = '#444'; g.fillText(s.cap || '', x, y + fh + 44);
      const cu = cuts.find((q) => q.i === i); if (cu) { g.fillStyle = cu.k === 'line' ? '#c8321e' : '#c98a00'; g.font = '600 12px system-ui, sans-serif'; g.fillText(cu.k === 'line' ? t('b.line', '! crosses the line') : t('b.jump', '! jump cut risk'), x + fw - 150, y + fh + 22); }
    });
    download(c, 'abidora-storyboard.png');
  }
  S.onResize(draw);
  syncPanel(); draw();
}
