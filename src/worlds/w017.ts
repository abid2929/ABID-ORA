/* 017 Spacecraft Gallery: Orbit Sandbox. A spacecraft circles Earth under real gravity
   (μ = 398 600 km³/s²). Fire prograde, retrograde or radial burns and watch the orbit reshape;
   the Hohmann planner works out both burns to reach a new circular orbit and flies them. */
import { type Ctx, h, layout, canvas, heading, note, range, buttons, stats, loop, seg, clamp, rng } from './kit';

const MU = 398600.4418, RE = 6371;
type V2 = [number, number];
export function elements(r: V2, v: V2) {
  const rm = Math.hypot(...r), v2 = v[0] ** 2 + v[1] ** 2, rv = r[0] * v[0] + r[1] * v[1];
  const ex = ((v2 - MU / rm) * r[0] - rv * v[0]) / MU, ey = ((v2 - MU / rm) * r[1] - rv * v[1]) / MU, e = Math.hypot(ex, ey);
  const a = 1 / (2 / rm - v2 / MU), hz = r[0] * v[1] - r[1] * v[0];
  const peri = a * (1 - e), apo = e < 1 ? a * (1 + e) : Infinity, T = e < 1 ? 2 * Math.PI * Math.sqrt(a ** 3 / MU) : Infinity;
  return { a, e, peri, apo, T, w: Math.atan2(ey, ex), hz };
}
export function hohmann(r1: number, r2: number) {
  const at = (r1 + r2) / 2;
  const dv1 = Math.sqrt(MU / r1) * (Math.sqrt(2 * r2 / (r1 + r2)) - 1), dv2 = Math.sqrt(MU / r2) * (1 - Math.sqrt(2 * r1 / (r1 + r2)));
  return { dv1, dv2, time: Math.PI * Math.sqrt(at ** 3 / MU) };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ffd166');
  L.view.style.background = '#03040a';
  const S = canvas(L.view, t('cv', 'Earth and the spacecraft orbit, seen from above the North Pole'));
  const info = stats(L.panel, [['alt', t('alt', 'Altitude')], ['v', t('v', 'Speed')], ['ap', t('ap', 'Highest point')], ['pe', t('pe', 'Lowest point')], ['T', t('T', 'Orbit period')], ['dv', t('used', 'Δv used')]]);
  let r: V2 = [RE + 400, 0], v: V2 = [0, Math.sqrt(MU / (RE + 400))], warp = 60, dvStep = 100, used = 0, simT = 0, crashed = false;
  let hold = 0, target = 2000, plan: null | { dv2: number; at: 'apo' | 'peri' } = null, zoom = 1;
  const trail: V2[] = [];
  const stars = (() => { const R = rng(17); return Array.from({ length: 220 }, () => [R(), R(), R()]); })();
  function reset() { r = [RE + 400, 0]; v = [0, Math.sqrt(MU / (RE + 400))]; used = 0; simT = 0; crashed = false; plan = null; trail.length = 0; L.hud.textContent = ''; draw(); }
  function acc(p: V2): V2 { const d = Math.hypot(...p), k = -MU / d ** 3; return [k * p[0], k * p[1]]; }
  function rk4(dt: number) {
    const a1 = acc(r), v1 = v;
    const r2: V2 = [r[0] + v1[0] * dt / 2, r[1] + v1[1] * dt / 2], v2: V2 = [v[0] + a1[0] * dt / 2, v[1] + a1[1] * dt / 2], a2 = acc(r2);
    const r3: V2 = [r[0] + v2[0] * dt / 2, r[1] + v2[1] * dt / 2], v3: V2 = [v[0] + a2[0] * dt / 2, v[1] + a2[1] * dt / 2], a3 = acc(r3);
    const r4: V2 = [r[0] + v3[0] * dt, r[1] + v3[1] * dt], v4: V2 = [v[0] + a3[0] * dt, v[1] + a3[1] * dt], a4 = acc(r4);
    r = [r[0] + dt / 6 * (v1[0] + 2 * v2[0] + 2 * v3[0] + v4[0]), r[1] + dt / 6 * (v1[1] + 2 * v2[1] + 2 * v3[1] + v4[1])];
    v = [v[0] + dt / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]), v[1] + dt / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1])];
  }
  /* impulsive burn: dir 'pro' | 'retro' | 'out' | 'in', size in m/s */
  function burn(dir: string, dvm: number) {
    if (crashed) return;
    const sp = Math.hypot(...v), rm = Math.hypot(...r), dk = dvm / 1000;
    const u: V2 = dir === 'pro' ? [v[0] / sp, v[1] / sp] : dir === 'retro' ? [-v[0] / sp, -v[1] / sp] : dir === 'out' ? [r[0] / rm, r[1] / rm] : [-r[0] / rm, -r[1] / rm];
    v = [v[0] + u[0] * dk, v[1] + u[1] * dk]; used += Math.abs(dvm);
  }
  function step(dtTotal: number) {
    if (crashed) return;
    let left = dtTotal;
    while (left > 0) {
      const rm = Math.hypot(...r), h0 = Math.min(left, clamp(rm / 800, 1, 20));
      const before = r[0] * v[0] + r[1] * v[1];
      rk4(h0); left -= h0; simT += h0;
      const after = r[0] * v[0] + r[1] * v[1];
      /* second Hohmann burn fires when the craft passes the highest point (radial speed changes sign) */
      if (plan && ((plan.at === 'apo' && before > 0 && after <= 0) || (plan.at === 'peri' && before < 0 && after >= 0))) { burn(plan.at === 'apo' ? 'pro' : 'retro', Math.abs(plan.dv2) * 1000); L.hud.textContent = t('circ', 'Second burn done: new circular orbit'); plan = null; hold = performance.now() + 4000; }
      if (Math.hypot(...r) < RE) { crashed = true; L.hud.textContent = t('crash', 'The spacecraft hit Earth. Press Reset.'); break; }
    }
    if (!trail.length || Math.hypot(r[0] - trail[trail.length - 1][0], r[1] - trail[trail.length - 1][1]) > 120) { trail.push([...r] as V2); if (trail.length > 600) trail.shift(); }
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    for (const [x, y, b] of stars) { g.fillStyle = `rgba(255,255,255,${.15 + b * .5})`; g.fillRect(x * W, y * H, 1.2, 1.2); }
    const E = elements(r, v), span = Math.max(Math.hypot(...r), E.e < 1 ? E.apo : Math.hypot(...r) * 1.5, RE * 1.6) * 1.12;
    const sc = Math.min(W, H) / 2 / span * zoom, cx = W / 2, cy = H / 2;
    const P = (p: V2) => [cx + p[0] * sc, cy - p[1] * sc];
    /* Earth with a terminator and a thin atmosphere */
    const er = RE * sc; const gr = g.createRadialGradient(cx - er * .35, cy - er * .35, er * .1, cx, cy, er);
    gr.addColorStop(0, '#5aa7ff'); gr.addColorStop(.6, '#1f5fb8'); gr.addColorStop(1, '#0a2350'); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, er, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,190,255,.35)'; g.lineWidth = Math.max(1, 100 * sc); g.beginPath(); g.arc(cx, cy, (RE + 50) * sc, 0, Math.PI * 2); g.stroke();
    /* predicted orbit */
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(255,209,102,.8)'; g.setLineDash([5, 5]); g.beginPath();
    const pmax = E.e < 1 ? Math.PI : Math.acos(-1 / E.e) - .05;
    for (let i = 0; i <= 360; i++) { const nu = -pmax + i / 360 * 2 * pmax, rr = E.a * (1 - E.e * E.e) / (1 + E.e * Math.cos(nu)); if (rr < 0 || rr > span * 3) continue; const [x, y] = P([rr * Math.cos(nu + E.w), rr * Math.sin(nu + E.w)]); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    if (E.hz < 0) { /* retrograde orbits use the same conic */ }
    g.stroke(); g.setLineDash([]);
    if (plan) { g.strokeStyle = 'rgba(126,224,255,.6)'; g.beginPath(); g.arc(cx, cy, (RE + target) * sc, 0, Math.PI * 2); g.stroke(); }
    /* apsides */
    const mark = (rr: number, ang: number, label: string) => { const [x, y] = P([rr * Math.cos(ang), rr * Math.sin(ang)]); g.fillStyle = '#ffd166'; g.beginPath(); g.arc(x, y, 3.5, 0, Math.PI * 2); g.fill(); g.font = '11px ui-monospace,monospace'; g.fillText(label, x + 6, y - 6); };
    if (E.e > .002) { mark(E.peri, E.w, t('peL', 'low')); if (E.e < 1) mark(E.apo, E.w + Math.PI, t('apL', 'high')); }
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); trail.forEach((p, i) => { const [x, y] = P(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    const [sx, sy] = P(r), sp = Math.hypot(...v);
    g.save(); g.translate(sx, sy); g.rotate(Math.atan2(-v[1], v[0])); g.fillStyle = crashed ? '#ff5d5d' : '#fff'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -5); g.lineTo(-3, 0); g.lineTo(-6, 5); g.closePath(); g.fill(); g.restore();
    const alt = Math.hypot(...r) - RE;
    info('alt', `${alt.toFixed(0)} km`); info('v', `${sp.toFixed(2)} km/s`);
    info('ap', E.e < 1 ? `${(E.apo - RE).toFixed(0)} km` : t('esc', 'escaping')); info('pe', `${(E.peri - RE).toFixed(0)} km`);
    info('T', E.e < 1 ? `${(E.T / 60).toFixed(1)} min` : '∞'); info('dv', `${used.toFixed(0)} m/s`);
    if (!crashed && !plan && performance.now() > hold) L.hud.textContent = E.e >= 1 ? t('escH', 'Escape: this path never comes back') : E.peri - RE < 100 ? t('drag', 'Lowest point is inside the atmosphere: the orbit would decay') : '';
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '11px ui-monospace,monospace'; g.fillText(`T+ ${(simT / 3600).toFixed(2)} h · ×${warp}`, 12, 20);
  }
  loop(ctx, S.cv, (dt) => { step(dt * (ctx.calm ? Math.min(warp, 60) : warp)); draw(); });

  heading(L.panel, t('burns', 'Engine burns'));
  range(L.panel, t('size', 'Burn size'), { min: 10, max: 1500, step: 10, value: dvStep, fmt: (n) => n + ' m/s' }, (n) => { dvStep = n; });
  buttons(L.panel, [[t('pro', 'Prograde'), () => burn('pro', dvStep), true], [t('retro', 'Retrograde'), () => burn('retro', dvStep)], [t('out', 'Radial out'), () => burn('out', dvStep)], [t('in', 'Radial in'), () => burn('in', dvStep)]]);
  heading(L.panel, t('hoh', 'Hohmann transfer planner'));
  const tr = range(L.panel, t('target', 'Target circular altitude'), { min: 200, max: 36000, step: 100, value: target, fmt: (n) => n + ' km' }, (n) => { target = n; show(); });
  void tr;
  const pl = h('p', { class: 'wk-note', 'aria-live': 'polite' }); L.panel.append(pl);
  function show() { const E = elements(r, v); const r1 = Math.hypot(...r), H = hohmann(r1, RE + target); pl.textContent = `${t('b1', 'Burn 1')}: ${(H.dv1 * 1000).toFixed(0)} m/s · ${t('b2', 'Burn 2')}: ${(H.dv2 * 1000).toFixed(0)} m/s · ${t('coast', 'coast')} ${(H.time / 60).toFixed(0)} min${E.e > .01 ? ' · ' + t('notc', 'works best from a circular orbit') : ''}`; }
  buttons(L.panel, [[t('fly', 'Fly the transfer'), () => {
    if (crashed) return; const r1 = Math.hypot(...r), H = hohmann(r1, RE + target);
    /* going up: burn 2 at the highest point; going down: at the lowest point */
    burn(H.dv1 >= 0 ? 'pro' : 'retro', Math.abs(H.dv1) * 1000);
    plan = { dv2: H.dv2, at: H.dv1 >= 0 ? 'apo' : 'peri' };
    L.hud.textContent = t('coastH', 'Burn 1 done. Coasting to the far side for burn 2…');
  }, true], [t('reset', 'Reset'), () => { reset(); show(); }]]);
  heading(L.panel, t('time', 'Time'));
  seg(L.panel, t('warp', 'Time warp'), [['10', '×10'], ['60', '×60'], ['300', '×300'], ['1200', '×1200']], String(warp), (n) => { warp = +n; });
  range(L.panel, t('zoom', 'Zoom'), { min: .5, max: 3, step: .1, value: 1, fmt: (n) => '×' + n }, (n) => { zoom = n; });
  note(L.panel, t('how', 'Gravity is integrated with a fourth-order Runge–Kutta step. Speeding up along your path (prograde) raises the far side of the orbit; slowing down lowers it. A Hohmann transfer uses two prograde burns half an orbit apart, the cheapest way between two circular orbits.'));
  show(); const iv = setInterval(show, 1000); ctx.onDispose(() => clearInterval(iv));
}
