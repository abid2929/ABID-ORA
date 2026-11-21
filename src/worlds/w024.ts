/* 024 Industrial Design: Gear Train Studio. Real involute gears (20° pressure angle) drawn from
   their maths, meshing at the correct centre distance and turning at the right speeds. Set teeth,
   module and input speed; read the ratio, output speed and torque; export a gear as SVG in mm. */
import { type Ctx, h, s, layout, canvas, heading, note, range, seg, buttons, stats, loop, store, download, svgBlob } from './kit';

const PA = 20 * Math.PI / 180;
/* one gear outline as points (mm, centred), tooth 0 pointing along +x */
export function gearOutline(z: number, m: number) {
  const r = m * z / 2, rb = r * Math.cos(PA), ra = r + m, rf = r - 1.25 * m;
  const inv = (a: number) => Math.tan(a) - a;
  const half = Math.PI / (2 * z) + inv(PA); /* half tooth angle measured at the base circle */
  const pts: [number, number][] = [];
  const tMax = Math.sqrt((ra / rb) ** 2 - 1), N = 10;
  for (let k = 0; k < z; k++) {
    const c = k * 2 * Math.PI / z;
    const flank = (sign: number) => { const out: [number, number][] = []; for (let i = 0; i <= N; i++) { const tt = tMax * i / N, x = rb * (Math.cos(tt) + tt * Math.sin(tt)), y = rb * (Math.sin(tt) - tt * Math.cos(tt)); const rr = Math.hypot(x, y), ang = Math.atan2(y, x); const a = c + sign * (half - ang); out.push([rr * Math.cos(a), rr * Math.sin(a)]); } return out; };
    const start = c - Math.PI / z;
    pts.push([rf * Math.cos(start), rf * Math.sin(start)]);
    const a1 = c - half; pts.push([rf * Math.cos(a1), rf * Math.sin(a1)]);
    pts.push(...flank(-1));
    const f2 = flank(1).reverse(); pts.push(...f2);
    const a2 = c + half; pts.push([rf * Math.cos(a2), rf * Math.sin(a2)]);
  }
  return { pts, r, ra, rf };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && Array.isArray((v as { z: unknown }).z);
  const st = store(24, 'train', { z: [12, 30, 18], m: 2, rpm: 60, torque: 2 }, ok);
  const P = { ...st.get() };
  let sel = 0, spin = 0, playing = true;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ff8a3d');
  L.view.style.background = '#e9e9e4';
  const S = canvas(L.view, t('cv', 'Meshing gear train; click a gear to select it'));
  const info = stats(L.panel, [['ratio', t('ratio', 'Ratio')], ['out', t('out', 'Output speed')], ['tq', t('tq', 'Output torque')], ['dir', t('dir', 'Output turns')]]);
  const COLS = ['#ff8a3d', '#3d4a5c', '#6c8f7d', '#c9a24a'];
  let shapes = P.z.map((z: number) => gearOutline(z, P.m));
  function centres() {
    /* chain the gears along a gentle zig-zag, each at the exact centre distance m(z1+z2)/2 */
    const c: { x: number; y: number; phi: number }[] = [{ x: 0, y: 0, phi: 0 }];
    for (let i = 1; i < P.z.length; i++) { const d = P.m * (P.z[i - 1] + P.z[i]) / 2, phi = (i % 2 ? -1 : 1) * 18 * Math.PI / 180; c.push({ x: c[i - 1].x + d * Math.cos(phi), y: c[i - 1].y + d * Math.sin(phi), phi }); }
    return c;
  }
  function angles(theta0: number) {
    const c = centres(), a = [theta0];
    for (let i = 1; i < P.z.length; i++) { const phi = c[i].phi, zA = P.z[i - 1], zB = P.z[i]; a.push(phi + Math.PI + Math.PI / zB - (zA / zB) * (a[i - 1] - phi)); }
    return a;
  }
  function calc() {
    shapes = P.z.map((z: number) => gearOutline(z, P.m));
    const n = P.z.length, ratio = P.z[n - 1] / P.z[0], eff = .98 ** (n - 1);
    info('ratio', `${ratio.toFixed(2)} : 1`); info('out', `${(P.rpm / ratio).toFixed(1)} rpm`); info('tq', `${(P.torque * ratio * eff).toFixed(2)} N·m`);
    info('dir', (n - 1) % 2 ? t('opp', 'the other way') : t('same', 'the same way'));
    L.hud.textContent = `${t('g', 'Gear')} ${sel + 1}: ${P.z[sel]} ${t('teeth', 'teeth')} · ${t('pd', 'pitch Ø')} ${(P.m * P.z[sel]).toFixed(1)} mm`;
    st.set(P); zr.set(P.z[sel]);
  }
  function draw(dt: number) {
    if (playing) spin += dt * P.rpm / 60 * 2 * Math.PI * (ctx.calm ? .25 : 1);
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const c = centres(), a = angles(spin);
    const xs = c.map((p, i) => [p.x - shapes[i].ra, p.x + shapes[i].ra]).flat(), ys = c.map((p, i) => [p.y - shapes[i].ra, p.y + shapes[i].ra]).flat();
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const sc = Math.min((W - 40) / (mxx - mnx), (H - 40) / (mxy - mny)), ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc, oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
    c.forEach((p, i) => {
      const sh = shapes[i], cx = ox + p.x * sc, cy = oy + p.y * sc;
      g.save(); g.translate(cx, cy); g.rotate(a[i]);
      g.beginPath(); sh.pts.forEach(([x, y], k) => k ? g.lineTo(x * sc, y * sc) : g.moveTo(x * sc, y * sc)); g.closePath();
      g.fillStyle = COLS[i % 4]; g.fill(); g.lineWidth = i === sel ? 2.5 : 1; g.strokeStyle = i === sel ? '#111' : 'rgba(0,0,0,.35)'; g.stroke();
      /* lightening holes and hub */
      g.fillStyle = '#e9e9e4'; if (sh.rf * sc > 50) for (let k = 0; k < 5; k++) { const an = k * 2 * Math.PI / 5; g.beginPath(); g.arc(Math.cos(an) * sh.rf * .58 * sc, Math.sin(an) * sh.rf * .58 * sc, sh.rf * .2 * sc, 0, 7); g.fill(); }
      g.beginPath(); g.arc(0, 0, Math.max(3, sh.rf * .14 * sc), 0, 7); g.fill(); g.fillStyle = '#111'; g.fillRect(-1, -Math.max(3, sh.rf * .14 * sc), 2, Math.max(3, sh.rf * .14 * sc) * .6);
      g.restore();
      g.setLineDash([3, 4]); g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(cx, cy, sh.r * sc, 0, 7); g.stroke(); g.setLineDash([]);
    });
  }
  loop(ctx, S.cv, (dt) => draw(dt));
  S.cv.addEventListener('pointerdown', (e) => {
    const r = S.cv.getBoundingClientRect(), W = S.w, H = S.h, c = centres();
    const xs = c.map((p, i) => [p.x - shapes[i].ra, p.x + shapes[i].ra]).flat(), ys = c.map((p, i) => [p.y - shapes[i].ra, p.y + shapes[i].ra]).flat();
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    const sc = Math.min((W - 40) / (mxx - mnx), (H - 40) / (mxy - mny)), ox = (W - (mxx - mnx) * sc) / 2 - mnx * sc, oy = (H - (mxy - mny) * sc) / 2 - mny * sc;
    const mx = (e.clientX - r.left - ox) / sc, my = (e.clientY - r.top - oy) / sc;
    c.forEach((p, i) => { if (Math.hypot(mx - p.x, my - p.y) < shapes[i].ra) { sel = i; calc(); } });
  });

  heading(L.panel, t('train', 'Train'));
  seg(L.panel, t('n', 'Gears'), [['2', '2'], ['3', '3'], ['4', '4']], String(P.z.length), (v) => { const n = +v; while (P.z.length < n) P.z.push(20); P.z.length = n; sel = Math.min(sel, n - 1); calc(); });
  const zr = range(L.panel, t('z', 'Teeth on selected gear'), { min: 8, max: 80, value: P.z[sel] }, (v) => { P.z[sel] = v; calc(); });
  seg(L.panel, t('m', 'Module (tooth size)'), [['1', '1 mm'], ['2', '2 mm'], ['3', '3 mm'], ['5', '5 mm']], String(P.m), (v) => { P.m = +v; calc(); });
  heading(L.panel, t('drive', 'Drive'));
  range(L.panel, t('rpm', 'Input speed'), { min: 1, max: 240, value: P.rpm, fmt: (n) => n + ' rpm' }, (v) => { P.rpm = v; calc(); });
  range(L.panel, t('tqIn', 'Input torque'), { min: .1, max: 20, step: .1, value: P.torque, fmt: (n) => n + ' N·m' }, (v) => { P.torque = v; calc(); });
  buttons(L.panel, [[t('pause', 'Pause / play'), () => { playing = !playing; }], [t('svg', 'Export selected gear (SVG, mm)'), () => {
    const { pts, ra } = gearOutline(P.z[sel], P.m), size = ra * 2 + 4;
    const svg = s('svg', { xmlns: 'http://www.w3.org/2000/svg', width: `${size}mm`, height: `${size}mm`, viewBox: `${-size / 2} ${-size / 2} ${size} ${size}` }, s('path', { d: 'M' + pts.map(([x, y]) => `${x.toFixed(3)} ${y.toFixed(3)}`).join(' L') + ' Z', fill: 'none', stroke: '#000', 'stroke-width': .1 }), s('circle', { cx: 0, cy: 0, r: Math.max(1.5, P.m * 1.5), fill: 'none', stroke: '#000', 'stroke-width': .1 }));
    download(svgBlob(svg as SVGSVGElement), `abidora-gear-z${P.z[sel]}-m${P.m}.svg`);
  }, true]]);
  note(L.panel, t('how', 'Each tooth flank is an involute curve, the shape that keeps the speed ratio constant as teeth roll together. Gears that mesh share a module; their centres sit exactly m × (z₁ + z₂) ÷ 2 apart. Middle gears (idlers) change direction, not the overall ratio.'));
  note(L.panel, t('eff', 'Output torque assumes about 98% efficiency per mesh.'));
  calc(); void h;
}
