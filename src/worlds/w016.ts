/* 016 Aircraft Explorer: design a NACA four-digit wing section, set angle of attack, speed and
   altitude, and see whether your aircraft flies. Lift slope and zero-lift angle come from thin
   airfoil theory, air density from the International Standard Atmosphere (ISA). */
import { type Ctx, h, layout, canvas, heading, note, seg, range, stats, loop, store, clamp } from './kit';

interface Plane { name: string; S: number; m: number; AR: number; cd0: number; vmax: number }
/* typical figures for each class of aircraft, not one specific model */
const PLANES: Record<string, Plane> = {
  trainer: { name: 'Light trainer', S: 16.2, m: 1100, AR: 7.3, cd0: .027, vmax: 70 },
  glider: { name: 'Sailplane', S: 10.5, m: 400, AR: 21, cd0: .011, vmax: 70 },
  liner: { name: 'Narrow-body airliner', S: 122.6, m: 65000, AR: 9.4, cd0: .02, vmax: 260 },
  drone: { name: 'Survey drone', S: .8, m: 6, AR: 8, cd0: .03, vmax: 35 },
};
export function isa(hm: number) {
  const h0 = clamp(hm, 0, 20000);
  const T = h0 <= 11000 ? 288.15 - .0065 * h0 : 216.65;
  const p = h0 <= 11000 ? 101325 * (T / 288.15) ** 5.25588 : 22632.06 * Math.exp(-.000157688 * (h0 - 11000));
  return { T, p, rho: p / (287.05 * T), a: Math.sqrt(1.4 * 287.05 * T) };
}
export function naca(code: string) {
  const m = +code[0] / 100, p = +code[1] / 10, th = +code.slice(2) / 100;
  const yc = (x: number) => !m || !p ? 0 : x < p ? m / (p * p) * (2 * p * x - x * x) : m / ((1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
  const dyc = (x: number) => !m || !p ? 0 : x < p ? 2 * m / (p * p) * (p - x) : 2 * m / ((1 - p) ** 2) * (p - x);
  const yt = (x: number) => 5 * th * (.2969 * Math.sqrt(x) - .126 * x - .3516 * x * x + .2843 * x ** 3 - .1015 * x ** 4);
  /* thin airfoil zero-lift angle: a0 = -(1/π)∫ dyc/dx (cosθ - 1) dθ */
  let a0 = 0; const n = 400; for (let i = 0; i < n; i++) { const tt = (i + .5) / n * Math.PI, x = (1 - Math.cos(tt)) / 2; a0 += dyc(x) * (Math.cos(tt) - 1) * Math.PI / n; } a0 = -a0 / Math.PI;
  const up: [number, number][] = [], lo: [number, number][] = [];
  for (let i = 0; i <= 80; i++) { const x = (1 - Math.cos(i / 80 * Math.PI)) / 2, a = Math.atan(dyc(x)), y = yc(x), tY = yt(x); up.push([x - tY * Math.sin(a), y + tY * Math.cos(a)]); lo.push([x + tY * Math.sin(a), y - tY * Math.cos(a)]); }
  return { a0, up, lo, th, m, yc };
}
/* lift curve: 2π per radian up to stall, then a gentle fall towards a flat plate */
export function cl(alphaDeg: number, a0: number, th: number) {
  const stall = 12 + th * 40, a = alphaDeg * Math.PI / 180, lin = 2 * Math.PI * (a - a0);
  if (alphaDeg <= stall) return { cl: lin, stalled: false };
  const peak = 2 * Math.PI * (stall * Math.PI / 180 - a0), flat = 1.9 * Math.sin(a) * Math.cos(a), k = clamp((alphaDeg - stall) / 6, 0, 1);
  return { cl: peak * (1 - k) * .85 + flat * k + peak * .15 * (1 - k), stalled: true };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const st = store(16, 'set', { code: '2412', alpha: 4, v: 55, alt: 1500, plane: 'trainer' }, (v) => !!v && typeof (v as { code: unknown }).code === 'string');
  let { code, alpha, v, alt, plane } = st.get();
  if (!/^\d{4}$/.test(code)) code = '2412';
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#9fb8ff');
  L.view.style.background = 'linear-gradient(180deg,#0d1730,#1d2c52 60%,#2b3e6b)';
  const S = canvas(L.view, t('cv', 'Wing section in the airflow'));
  const info = stats(L.panel, [['cl', t('cl', 'Lift coefficient')], ['lift', t('lift', 'Lift vs weight')], ['ld', t('ld', 'Lift ÷ drag')], ['vs', t('vs', 'Stall speed')], ['rho', t('rho', 'Air density')], ['mach', t('mach', 'Mach')]]);
  let A = naca(code);
  const save = () => st.set({ code, alpha, v, alt, plane });
  const parts: { x: number; y: number; y0: number }[] = [];
  for (let i = 0; i < 520; i++) parts.push({ x: Math.random(), y: 0, y0: (Math.random() - .5) * 1.1 });
  let state = { CL: 0, stalled: false, ratio: 0 };
  function calc() {
    const P = PLANES[plane], air = isa(alt), q = .5 * air.rho * v * v;
    const r = cl(alpha, A.a0, A.th), CL = r.cl, CLmax = cl(12 + A.th * 40, A.a0, A.th).cl;
    const e = .8, CD = P.cd0 + CL * CL / (Math.PI * e * P.AR) + (r.stalled ? .08 : 0);
    const Lf = q * P.S * CL, Wt = P.m * 9.81, ratio = Lf / Wt;
    const vs = Math.sqrt(2 * Wt / (air.rho * P.S * CLmax));
    info('cl', CL.toFixed(2) + (r.stalled ? ' ⚠' : '')); info('lift', `${(ratio * 100).toFixed(0)}%`); info('ld', (CL / CD).toFixed(1));
    info('vs', `${(vs * 3.6).toFixed(0)} km/h`); info('rho', `${air.rho.toFixed(3)} kg/m³`); info('mach', (v / air.a).toFixed(2));
    L.hud.textContent = r.stalled ? t('stall', 'Stalled: the flow has separated from the top of the wing') : ratio > 1.05 ? t('climb', 'Climbing: lift is more than the weight') : ratio < .95 ? t('sink', 'Sinking: not enough lift for level flight') : t('level', 'Level flight');
    state = { CL, stalled: r.stalled, ratio };
  }
  function draw(dt: number) {
    const g = S.g, Wd = S.w, H = S.h; g.clearRect(0, 0, Wd, H);
    const c = Math.min(Wd * .55, H * 1.2), ox = Wd * .5 - c * .45, oy = H * .5, a = alpha * Math.PI / 180;
    const T = (x: number, y: number) => { const X = (x - .25) * c, Y = -y * c; return [ox + .25 * c + X * Math.cos(a) - Y * Math.sin(a), oy + X * Math.sin(a) + Y * Math.cos(a)]; };
    /* airflow particles: displaced round the section, faster over the top when lifting, wake swirls after stall */
    const spd = (ctx.calm ? .12 : .3) * dt;
    g.lineWidth = 1.4;
    for (const p of parts) {
      const above = p.y0 > 0, near = Math.exp(-Math.abs(p.y0) * 5);
      const speedUp = 1 + (above ? 1 : -.6) * clamp(state.CL, -1, 2) * .35 * near;
      p.x += spd * speedUp; if (p.x > 1.05) { p.x = -.05; p.y0 = (Math.random() - .5) * 1.1; }
      const xc = (p.x * 2 - .5); /* chord units, wing from 0 to 1 */
      const inW = xc > 0 && xc < 1, thick = inW ? (above ? 1 : -1) * 5 * A.th * (.2969 * Math.sqrt(xc) - .126 * xc - .3516 * xc * xc + .2843 * xc ** 3 - .1015 * xc ** 4) + A.yc(xc) : 0;
      const down = xc > .25 ? -state.CL * .05 * (xc - .25) * near : 0;
      const tilt = inW ? (.25 - xc) * Math.tan(a) : xc >= 1 ? -.75 * Math.tan(a) * Math.exp(-(xc - 1) * 3) : 0;
      let yy = p.y0 * .55 + (inW ? thick * near * 1.3 : 0) + (tilt + down) * near;
      if (state.stalled && above && xc > .3) yy += Math.sin(xc * 18 + p.y0 * 40) * .03 * near;
      const X = ox + xc * c, Y = oy - yy * c; p.y = yy;
      g.strokeStyle = above ? `rgba(180,210,255,${.25 + near * .6})` : `rgba(255,214,170,${.2 + near * .5})`;
      g.beginPath(); g.moveTo(X - 6 * speedUp, Y); g.lineTo(X, Y); g.stroke();
    }
    /* section */
    g.beginPath(); A.up.forEach(([x, y], i) => { const [X, Y] = T(x, y); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); [...A.lo].reverse().forEach(([x, y]) => { const [X, Y] = T(x, y); g.lineTo(X, Y); }); g.closePath();
    const gr = g.createLinearGradient(0, oy - c * .1, 0, oy + c * .1); gr.addColorStop(0, '#f2f4f8'); gr.addColorStop(1, '#a9b2c4'); g.fillStyle = gr; g.fill();
    /* camber line */
    g.strokeStyle = 'rgba(13,23,48,.5)'; g.setLineDash([4, 4]); g.beginPath(); for (let i = 0; i <= 40; i++) { const [X, Y] = T(i / 40, A.yc(i / 40)); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); g.setLineDash([]);
    /* lift arrow at the quarter chord, perpendicular to the oncoming air */
    const [qx, qy] = T(.25, 0), len = clamp(state.CL, -1.5, 2) * c * .22;
    g.strokeStyle = state.stalled ? '#ff8a7a' : '#9fb8ff'; g.fillStyle = g.strokeStyle; g.lineWidth = 3; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx, qy - len); g.stroke();
    g.beginPath(); g.moveTo(qx, qy - len - Math.sign(len) * 10); g.lineTo(qx - 7, qy - len); g.lineTo(qx + 7, qy - len); g.closePath(); g.fill();
    g.font = '12px ui-monospace,monospace'; g.fillText(t('L', 'lift'), qx + 10, qy - len);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillText(`NACA ${code} · α ${alpha.toFixed(1)}°`, 14, 22);
  }
  loop(ctx, S.cv, (dt) => draw(dt));

  heading(L.panel, t('wing', 'Wing section (NACA 4-digit)'));
  const digits = (label: string, val: number, min: number, max: number, idx: [number, number], fmt: (v: number) => string) => range(L.panel, label, { min, max, value: val, fmt }, (n) => { const s = code.split(''); const str = String(n).padStart(idx[1] - idx[0], '0'); s.splice(idx[0], idx[1] - idx[0], ...str.split('')); code = s.join(''); A = naca(code); calc(); save(); });
  digits(t('camber', 'Camber'), +code[0], 0, 9, [0, 1], (n) => n + '%');
  digits(t('pos', 'Max camber at'), +code[1], 0, 9, [1, 2], (n) => n * 10 + '%');
  digits(t('thick', 'Thickness'), +code.slice(2), 6, 24, [2, 4], (n) => n + '%');
  heading(L.panel, t('flight', 'Flight'));
  seg(L.panel, t('plane', 'Aircraft'), Object.entries(PLANES).map(([k, p]) => [k, t('p.' + k, p.name)]), plane, (k) => { plane = k; sp.input.max = String(PLANES[k].vmax); if (v > PLANES[k].vmax) sp.set(PLANES[k].vmax, true); calc(); save(); });
  range(L.panel, t('alpha', 'Angle of attack'), { min: -6, max: 22, step: .5, value: alpha, fmt: (n) => n + '°' }, (n) => { alpha = n; calc(); save(); });
  const sp = range(L.panel, t('speed', 'Airspeed'), { min: 5, max: PLANES[plane].vmax, value: v, fmt: (n) => `${n} m/s · ${(n * 3.6).toFixed(0)} km/h` }, (n) => { v = n; calc(); save(); });
  range(L.panel, t('alt', 'Altitude'), { min: 0, max: 13000, step: 100, value: alt, fmt: (n) => n + ' m' }, (n) => { alt = n; calc(); save(); });
  note(L.panel, t('how', 'Thin airfoil theory gives lift: CL = 2π(α − α₀), where the zero-lift angle α₀ comes from the camber line. Above the stall angle the model falls away smoothly. Air density follows the ISA standard atmosphere, so the same wing needs more speed high up.'));
  note(L.panel, t('honest', 'Aircraft figures are typical for each class, not a particular model. A teaching model, not for flight planning.'));
  calc();
}
