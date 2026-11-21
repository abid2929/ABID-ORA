/* 026 Architectural Photography: Keystone Studio. Looking up at a building makes its verticals lean
   inward. Drag four corners onto something that is really a rectangle, and a projective transform
   (a homography solved from those four points) straightens it, the way a tilt-shift lens would.
   Works on your own photo too; it never leaves the browser. */
import { type Ctx, h, layout, canvas, heading, note, seg, buttons, stats, local, clamp, download } from './kit';
import { I18N } from '../scripts/i18n';

type Pt = [number, number];
/* solve the 3×3 homography that maps 4 points a[i] to b[i] (Gaussian elimination, 8 unknowns) */
export function homography(a: Pt[], b: Pt[]) {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) { const [x, y] = a[i], [u, v] = b[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]); A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k]; } }
  const hv = A.map((r, i) => r[8] / r[i]); return [...hv, 1];
}
const apply = (H: number[], x: number, y: number): Pt => { const w = H[6] * x + H[7] * y + H[8]; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; };

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#9ad0ff');
  L.view.style.background = '#0e1013';
  const S = canvas(L.view, t('cv', 'Photo with four corner handles; drag them onto a rectangle in the scene'));
  const info = stats(L.panel, [['lean', t('lean', 'Verticals lean')], ['out', t('out', 'Output size')], ['ms', t('ms', 'Render time')], ['src', t('src', 'Photo')]]);
  let img: HTMLCanvasElement | null = null, data: ImageData | null = null, out: HTMLCanvasElement | null = null;
  let quad: Pt[] = [[.505, .38], [.645, .37], [.66, .9], [.51, .92]]; /* sample photo: the tower's facade (normalised) */
  let view: 'edit' | 'after' = 'edit', grid = true, hot = -1, drag = -1, srcName = t('sample', 'Sample');
  const box = () => { if (!img) return { x: 0, y: 0, w: 1, h: 1 }; const k = Math.min(S.w / img.width, S.h / img.height) * .94, w = img.width * k, hh = img.height * k; return { x: (S.w - w) / 2, y: (S.h - hh) / 2, w, h: hh }; };
  function load(src: string | File) {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { const k = Math.min(1, 1600 / Math.max(im.width, im.height)); const c = h('canvas', { width: Math.round(im.width * k), height: Math.round(im.height * k) }) as HTMLCanvasElement; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(im, 0, 0, c.width, c.height); img = c; data = g.getImageData(0, 0, c.width, c.height); info('src', `${srcName} · ${c.width}×${c.height}`); render(); if (typeof src !== 'string') URL.revokeObjectURL(im.src); };
    im.onerror = () => { L.hud.textContent = t('err', 'That file could not be opened as an image.'); };
    im.src = typeof src === 'string' ? src : URL.createObjectURL(src);
  }
  function lean() {
    const [a, b, c, d] = quad.map(([x, y]) => [x * (img?.width ?? 1), y * (img?.height ?? 1)]);
    const al = Math.atan2(d[0] - a[0], d[1] - a[1]), ar = Math.atan2(c[0] - b[0], c[1] - b[1]);
    return Math.abs(al - ar) * 180 / Math.PI;
  }
  function correct() {
    if (!img || !data) return;
    const t0 = performance.now(), W0 = img.width, H0 = img.height, q = quad.map(([x, y]) => [x * W0, y * H0] as Pt);
    const wTop = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]), wBot = Math.hypot(q[2][0] - q[3][0], q[2][1] - q[3][1]), hL = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]), hR = Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1]);
    let ow = Math.max(wTop, wBot), oh = Math.max(hL, hR); const k = Math.min(1, 1400 / Math.max(ow, oh)); ow = Math.round(ow * k); oh = Math.round(oh * k);
    const Hm = homography([[0, 0], [ow, 0], [ow, oh], [0, oh]], q);
    const c = out ?? (h('canvas') as HTMLCanvasElement); c.width = ow; c.height = oh; out = c;
    const g = c.getContext('2d')!, o = g.createImageData(ow, oh), src = data.data, dst = o.data;
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const [sx, sy] = apply(Hm, x + .5, y + .5), x0 = Math.floor(sx - .5), y0 = Math.floor(sy - .5), fx = sx - .5 - x0, fy = sy - .5 - y0, i = (y * ow + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 >= W0 - 1 || y0 >= H0 - 1) { dst[i + 3] = 0; continue; }
      const p = (y0 * W0 + x0) * 4, r = W0 * 4;
      for (let ch = 0; ch < 3; ch++) dst[i + ch] = (src[p + ch] * (1 - fx) + src[p + 4 + ch] * fx) * (1 - fy) + (src[p + r + ch] * (1 - fx) + src[p + r + 4 + ch] * fx) * fy;
      dst[i + 3] = 255;
    }
    g.putImageData(o, 0, 0);
    info('ms', `${Math.round(performance.now() - t0)} ms`); info('out', `${ow} × ${oh}`);
  }
  function render() {
    const g = S.g; g.clearRect(0, 0, S.w, S.h);
    if (!img) return;
    info('lean', `${lean().toFixed(1)}°`);
    if (view === 'after') {
      correct(); if (!out) return;
      const k = Math.min(S.w / out.width, S.h / out.height) * .94, w = out.width * k, hh = out.height * k, x = (S.w - w) / 2, y = (S.h - hh) / 2;
      g.drawImage(out, x, y, w, hh);
      if (grid) { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1; for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(x + w * i / 3, y); g.lineTo(x + w * i / 3, y + hh); g.moveTo(x, y + hh * i / 3); g.lineTo(x + w, y + hh * i / 3); g.stroke(); } }
      L.hud.textContent = t('afterH', 'Corrected: verticals are parallel again');
      return;
    }
    const b = box(); g.drawImage(img, b.x, b.y, b.w, b.h);
    const P = quad.map(([x, y]) => [b.x + x * b.w, b.y + y * b.h]);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.moveTo(P[0][0], P[0][1]); for (const p of [P[3], P[2], P[1]]) g.lineTo(p[0], p[1]); g.closePath(); g.fill('evenodd');
    g.strokeStyle = '#9ad0ff'; g.lineWidth = 1.5; g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.stroke();
    /* extend the side edges to show where the verticals would meet */
    g.setLineDash([4, 6]); g.strokeStyle = 'rgba(154,208,255,.5)'; for (const [a, c] of [[0, 3], [1, 2]]) { const dx = P[a][0] - P[c][0], dy = P[a][1] - P[c][1]; g.beginPath(); g.moveTo(P[c][0], P[c][1]); g.lineTo(P[c][0] + dx * 3, P[c][1] + dy * 3); g.stroke(); } g.setLineDash([]);
    P.forEach(([x, y], i) => { g.fillStyle = i === hot || i === drag ? '#fff' : '#9ad0ff'; g.beginPath(); g.arc(x, y, 8, 0, 7); g.fill(); g.strokeStyle = '#0e1013'; g.lineWidth = 2; g.stroke(); });
    L.hud.textContent = t('editH', 'Drag the four corners onto something that is really a rectangle');
  }
  S.onResize(render);
  const near = (e: PointerEvent) => { const b = box(), p = local(e, S.cv); let bi = -1, bd = 22; quad.forEach(([x, y], i) => { const d = Math.hypot(b.x + x * b.w - p.x, b.y + y * b.h - p.y); if (d < bd) { bd = d; bi = i; } }); return bi; };
  S.cv.addEventListener('pointerdown', (e) => { if (view !== 'edit') return; drag = near(e); if (drag >= 0) S.cv.setPointerCapture(e.pointerId); render(); });
  S.cv.addEventListener('pointermove', (e) => { if (view !== 'edit') return; if (drag < 0) { const n = near(e); if (n !== hot) { hot = n; render(); } return; } const b = box(), p = local(e, S.cv); quad[drag] = [clamp((p.x - b.x) / b.w, 0, 1), clamp((p.y - b.y) / b.h, 0, 1)]; render(); });
  S.cv.addEventListener('pointerup', () => { drag = -1; render(); });
  S.cv.addEventListener('keydown', (e) => { if (e.key === 'Tab' || view !== 'edit') return; const m: Record<string, Pt> = { ArrowLeft: [-.003, 0], ArrowRight: [.003, 0], ArrowUp: [0, -.003], ArrowDown: [0, .003] }; if (['1', '2', '3', '4'].includes(e.key)) { hot = +e.key - 1; render(); } else if (m[e.key] && hot >= 0) { e.preventDefault(); quad[hot] = [clamp(quad[hot][0] + m[e.key][0], 0, 1), clamp(quad[hot][1] + m[e.key][1], 0, 1)]; render(); } });

  heading(L.panel, t('photo', 'Photo'));
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('own', 'Open your own photo') }) as HTMLInputElement;
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) { srcName = f.name.slice(0, 24); quad = [[.25, .2], [.75, .2], [.8, .85], [.2, .85]]; load(f); } });
  L.panel.append(h('label', { class: 'wk-r' }, h('span', { text: t('own', 'Open your own photo') }), file));
  const vs = seg(L.panel, t('view', 'View'), [['edit', t('v.edit', 'Mark the rectangle')], ['after', t('v.after', 'Corrected')]], view, (v) => { view = v as typeof view; render(); });
  const gc = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement; gc.addEventListener('change', () => { grid = gc.checked; render(); }); L.panel.append(h('label', { class: 'wk-chk' }, gc, h('span', { text: t('grid', 'Rule-of-thirds grid') })));
  buttons(L.panel, [[t('fix', 'Straighten it'), () => { view = 'after'; vs.set('after'); render(); }, true], [t('save', 'Save JPEG'), () => { if (view !== 'after') { view = 'after'; vs.set('after'); render(); } if (out) download(out, 'abidora-corrected.jpg'); }], [t('reset', 'Reset corners'), () => { quad = [[.2, .2], [.8, .2], [.8, .8], [.2, .8]]; view = 'edit'; vs.set('edit'); render(); }]]);
  note(L.panel, t('how', 'Corners go clockwise from top-left. Arrow keys nudge the selected corner (press 1–4 to pick one). The four points fix a homography, the 3 × 3 matrix that maps any flat rectangle seen at an angle back to a straight-on view.'));
  note(L.panel, t('privacy', 'Your photo is processed only in this browser tab and is never uploaded.'));
  note(L.panel, t('credit', 'Sample photo from Unsplash (Unsplash License).'));
  load(`${I18N.root}assets/home/architecture.jpg`);
}
