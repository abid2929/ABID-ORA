/* 043 Human Biology Explorer: Heartbeat Lab. A beating left heart driven by a classic physiology model:
   the time-varying elastance heart (Suga and Sagawa) filling from the left atrium through the mitral valve
   and emptying through the aortic valve into a two-element Windkessel artery (resistance and compliance).
   Change heart rate, contractility, filling pressure, vessel resistance and artery stiffness, and watch
   the pressure–volume loop, the pressure traces of the Wiggers diagram, a synthetic ECG and the numbers a
   doctor reads: stroke volume, ejection fraction, cardiac output and blood pressure. Presets show rest,
   exercise, an athlete, high blood pressure, heart failure and blood loss. Teaching model, not medical advice. */
import { type Ctx, h, layout, canvas, heading, note, range, stats, check, loop, clamp } from './kit';

/* ---------- model (exported for tests) ---------- */
export interface Params { hr: number; emax: number; emin: number; v0: number; pla: number; rmv: number; rav: number; r: number; c: number; pv: number }
export const BASE: Params = { hr: 72, emax: 2.3, emin: .07, v0: 10, pla: 8, rmv: .006, rav: .003, r: 1.15, c: 1.4, pv: 5 };
/** normalised elastance over one beat: rises in systole, relaxes, then 0 in diastole */
export function activation(tc: number, rr: number) {
  const ts = .2 + .15 * rr, t1 = ts * .55;
  if (tc < t1) return .5 * (1 - Math.cos(Math.PI * tc / t1));
  if (tc < ts) return .5 * (1 + Math.cos(Math.PI * (tc - t1) / (ts - t1)));
  return 0;
}
export class Heart {
  V = 120; Pa = 85; t = 0; Plv = 0; Qm = 0; Qa = 0; P: Params;
  constructor(P: Params) { this.P = P; }
  step(dt: number) {
    const P = this.P, rr = 60 / P.hr, tc = this.t % rr, E = P.emin + (P.emax - P.emin) * activation(tc, rr);
    this.Plv = E * (this.V - P.v0);
    this.Qm = P.pla > this.Plv ? (P.pla - this.Plv) / P.rmv : 0;
    this.Qa = this.Plv > this.Pa ? (this.Plv - this.Pa) / P.rav : 0;
    this.V += (this.Qm - this.Qa) * dt; this.Pa += (this.Qa - (this.Pa - P.pv) / P.r) / P.c * dt; this.t += dt;
  }
}
/** run to a steady state and report one beat */
export function steady(P: Params, secs = 20) {
  const H = new Heart(P), dt = .0005, rr = 60 / P.hr; let vmax = 0, vmin = 1e9, pmax = 0, pmin = 1e9, psum = 0, n = 0;
  while (H.t < secs) { H.step(dt); if (H.t > secs - rr) { vmax = Math.max(vmax, H.V); vmin = Math.min(vmin, H.V); pmax = Math.max(pmax, H.Pa); pmin = Math.min(pmin, H.Pa); psum += H.Pa; n++; } }
  return { edv: vmax, esv: vmin, sv: vmax - vmin, ef: (vmax - vmin) / vmax, co: (vmax - vmin) * P.hr / 1000, sys: pmax, dia: pmin, map: psum / n };
}
/** synthetic ECG (mV) at time tc into the beat: P wave, QRS complex and T wave as Gaussian bumps */
export function ecg(tc: number, rr: number) {
  const ts = .2 + .15 * rr, g = (c: number, a: number, w: number) => { let d = tc - c; if (d > rr / 2) d -= rr; if (d < -rr / 2) d += rr; return a * Math.exp(-d * d / (2 * w * w)); };
  return g(-.16, .12, .022) + g(-.03, -.1, .008) + g(-.005, 1.1, .011) + g(.022, -.25, .01) + g(ts * .82, .3, .045);
}

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#ff6f7d');
  L.view.style.background = '#0b0709';
  L.view.style.minHeight = 'clamp(420px, 62vw, 640px)';
  const S = canvas(L.view, t('cv', 'A beating heart with its pressure-volume loop, pressure traces and ECG.'));
  const P: Params = { ...BASE };
  const H = new Heart(P);
  for (let i = 0; i < 20000; i++) H.step(.0005); H.t = 0;

  /* ---------- controls ---------- */
  const PRE: [string, string, Partial<Params>, string][] = [
    ['rest', t('p.rest', 'At rest'), {}, t('d.rest', 'A healthy adult sitting still: about 5 litres a minute at roughly 115/75.')],
    ['ex', t('p.ex', 'Hard exercise'), { hr: 150, emax: 3.6, r: .42, pla: 11, c: 1.6 }, t('d.ex', 'Muscles open their vessels (resistance falls), the heart beats faster and harder: output triples.')],
    ['ath', t('p.ath', 'Athlete at rest'), { hr: 50, pla: 8, emin: .05, r: 1.05, c: 2.4 }, t('d.ath', 'A trained heart fills more and beats slowly, moving the same blood with fewer beats.')],
    ['htn', t('p.htn', 'High blood pressure'), { r: 1.7, c: .8 }, t('d.htn', 'Narrow, stiff arteries: the heart must squeeze against more pressure and pushes out less each beat.')],
    ['hf', t('p.hf', 'Heart failure'), { emax: .8, emin: .09, pla: 16, r: 1.25 }, t('d.hf', 'A weak, enlarged ventricle: ejection fraction falls well below 50 % and blood backs up into the lungs.')],
    ['bleed', t('p.bleed', 'Blood loss'), { pla: 4, hr: 115, r: 1.3 }, t('d.bleed', 'Less blood returning means little filling. The heart races and vessels tighten, but pressure still falls.')],
  ];
  const sliders: Record<string, ReturnType<typeof range>> = {};
  heading(L.panel, t('preh', 'Situations'));
  const desc = h('p', { class: 'wk-note' });
  const prow = h('div', { class: 'wk-row' });
  for (const [k, n, p, d] of PRE) prow.append(h('button', { type: 'button', class: 'wk-b', text: n, 'data-k': k, onclick: () => apply(p, d, k) }));
  L.panel.append(prow, desc);
  heading(L.panel, t('ctlh', 'Controls'));
  const sl = (k: keyof Params, label: string, o: { min: number; max: number; step: number }, fmt: (n: number) => string) => { sliders[k] = range(L.panel, label, { ...o, value: P[k], fmt }, (v) => { P[k] = v; mark(''); }); };
  sl('hr', t('hr', 'Heart rate'), { min: 35, max: 190, step: 1 }, (n) => n + ' ' + t('bpm', 'beats/min'));
  sl('emax', t('emax', 'Contractility (how hard it squeezes)'), { min: .4, max: 5, step: .05 }, (n) => n.toFixed(2) + ' mmHg/mL');
  sl('pla', t('pla', 'Filling pressure'), { min: 2, max: 25, step: .5 }, (n) => n + ' mmHg');
  sl('r', t('res', 'Vessel resistance'), { min: .3, max: 2.5, step: .01 }, (n) => n.toFixed(2) + ' mmHg·s/mL');
  sl('c', t('comp', 'Artery stretchiness'), { min: .5, max: 3, step: .05 }, (n) => n.toFixed(2) + ' mL/mmHg');
  let sound = false, ac: AudioContext | null = null;
  check(L.panel, t('snd', 'Heart sounds (lub-dub)'), false, (v) => { sound = v; if (v && !ac) { try { ac = new AudioContext(); } catch { ac = null; } } });
  const info = stats(L.panel, [['bp', t('bp', 'Blood pressure')], ['map', t('map', 'Mean pressure')], ['sv', t('sv', 'Stroke volume')], ['ef', t('ef', 'Ejection fraction')], ['co', t('co', 'Cardiac output')], ['edv', t('edv', 'Filled / emptied')]]);
  note(L.panel, t('n.heart', 'The ventricle stiffens and relaxes each beat (time-varying elastance). Valves open only when pressure pushes forward, so the loop has four sides: filling, squeezing with both valves shut, ejection, and relaxing. The artery is a stretchy tube draining through a resistance. This is a teaching model with textbook values, not a medical tool.'));
  function mark(k: string) { prow.querySelectorAll('button').forEach((b) => b.classList.toggle('pri', (b as HTMLElement).dataset.k === k)); if (!k) desc.textContent = t('custom', 'Your own settings.'); }
  function apply(p: Partial<Params>, d: string, k: string) {
    Object.assign(P, BASE, p); for (const key in sliders) sliders[key].set(P[key as keyof Params]); desc.textContent = d; mark(k);
  }
  apply({}, PRE[0][3], 'rest');

  /* ---------- per-beat bookkeeping ---------- */
  const N = 900; // samples kept for the traces (about 3 s)
  const tr = { lv: new Float32Array(N), ao: new Float32Array(N), la: new Float32Array(N), ecg: new Float32Array(N) }; let head = 0, acc = 0;
  let loopPts: [number, number][] = [], lastLoop: [number, number][] = [];
  let beat = { vmax: 0, vmin: 1e9, pmax: 0, pmin: 1e9, psum: 0, n: 0 }, lastTc = 0, mOpen = false, aOpen = false;
  const thump = (f: number, vol: number) => {
    if (!sound || !ac) return; const o = ac.createOscillator(), g = ac.createGain(), now = ac.currentTime;
    o.frequency.setValueAtTime(f, now); o.frequency.exponentialRampToValueAtTime(f * .6, now + .12); g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .012); g.gain.exponentialRampToValueAtTime(.0001, now + .16);
    o.connect(g).connect(ac.destination); o.start(now); o.stop(now + .18);
  };
  function sim(dt: number) {
    const rr = 60 / P.hr, steps = Math.ceil(dt / .0005), h2 = dt / steps;
    for (let i = 0; i < steps; i++) {
      H.step(h2);
      const tc = H.t % rr;
      if (tc < lastTc) {
        if (beat.n > 50) {
          const sv = beat.vmax - beat.vmin;
          info('bp', `${Math.round(beat.pmax)}/${Math.round(beat.pmin)} mmHg`); info('map', `${Math.round(beat.psum / beat.n)} mmHg`);
          info('sv', `${Math.round(sv)} mL`); info('ef', `${Math.round(sv / beat.vmax * 100)} %`); info('co', `${(sv * P.hr / 1000).toFixed(1)} L/min`); info('edv', `${Math.round(beat.vmax)} / ${Math.round(beat.vmin)} mL`);
        }
        beat = { vmax: 0, vmin: 1e9, pmax: 0, pmin: 1e9, psum: 0, n: 0 }; lastLoop = loopPts; loopPts = [];
      }
      lastTc = tc;
      beat.vmax = Math.max(beat.vmax, H.V); beat.vmin = Math.min(beat.vmin, H.V); beat.pmax = Math.max(beat.pmax, H.Pa); beat.pmin = Math.min(beat.pmin, H.Pa); beat.psum += H.Pa; beat.n++;
      const mo = H.Qm > 0, ao = H.Qa > 0;
      if (mOpen && !mo) thump(55, .5); if (aOpen && !ao) thump(80, .35); mOpen = mo; aOpen = ao;
      acc += h2; if (acc >= 3 / N) { acc -= 3 / N; tr.lv[head] = H.Plv; tr.ao[head] = H.Pa; tr.la[head] = P.pla; tr.ecg[head] = ecg(tc, rr); head = (head + 1) % N; }
      if (i % 8 === 0) loopPts.push([H.V, H.Plv]);
    }
  }

  /* ---------- drawing ---------- */
  function draw() {
    const g = S.g, W = S.w, Hh = S.h, wide = W > 620;
    g.fillStyle = '#0b0709'; g.fillRect(0, 0, W, Hh);
    const topH = wide ? Hh * .56 : Hh * .62;
    const hx = wide ? W * .25 : W * .27, hy = topH * .5;
    drawHeart(g, hx, hy, Math.min(wide ? W * .2 : W * .25, topH * .42), topH);
    drawLoop(g, wide ? W * .52 : W * .54, 16, wide ? W * .45 : W * .44, topH - 30);
    drawTraces(g, 12, topH + 6, W - 24, Hh - topH - 16);
  }
  function drawHeart(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, yb: number) {
    const k = Math.cbrt(clamp(H.V, 5, 400) / 120), mo = H.Qm > 0, ao = H.Qa > 0;
    g.save(); g.translate(cx, cy);
    /* aorta */
    g.strokeStyle = '#c23b4b'; g.lineWidth = s * .16; g.lineCap = 'round';
    g.beginPath(); g.moveTo(s * .05, -s * .35); g.bezierCurveTo(s * .05, -s * 1.05, s * .75, -s * 1.05, s * .7, -s * .45); g.stroke();
    /* left atrium */
    g.fillStyle = '#7a2230'; g.beginPath(); g.ellipse(s * .42, -s * .42, s * .3, s * .2, -.3, 0, 7); g.fill();
    /* right side, drawn for context (beats in step) */
    g.fillStyle = '#4a2a52'; g.beginPath(); g.ellipse(-s * .38, s * .12, s * .3 * (.85 + .15 * k), s * .55 * (.85 + .15 * k), .25, 0, 7); g.fill();
    /* left ventricle wall and cavity: size follows the simulated volume */
    g.fillStyle = '#8f2534'; g.beginPath(); g.ellipse(s * .12, s * .2, s * .5 * k + s * .14, s * .7 * k + s * .14, -.35, 0, 7); g.fill();
    g.fillStyle = '#d6475a'; g.beginPath(); g.ellipse(s * .12, s * .2, s * .5 * k, s * .7 * k, -.35, 0, 7); g.fill();
    /* valves */
    const valve = (x: number, y: number, open: boolean, ang: number) => { g.strokeStyle = '#f6e7d8'; g.lineWidth = 3; g.beginPath(); const a = open ? .9 : 0; g.moveTo(x - Math.cos(ang) * s * .12, y - Math.sin(ang) * s * .12); g.lineTo(x - Math.cos(ang - a) * s * .01, y - Math.sin(ang - a) * s * .01); g.moveTo(x + Math.cos(ang) * s * .12, y + Math.sin(ang) * s * .12); g.lineTo(x + Math.cos(ang + a) * s * .01, y + Math.sin(ang + a) * s * .01); g.stroke(); };
    valve(s * .32, -s * .28, mo, -.2); valve(s * .02, -s * .38, ao, .1);
    g.restore();
    g.font = '11px ui-monospace,monospace'; g.textAlign = 'left';
    g.fillStyle = mo ? '#ffd8a8' : 'rgba(255,255,255,.4)'; g.fillText((mo ? '● ' : '○ ') + t('mv', 'mitral valve'), 12, yb - 40);
    g.fillStyle = ao ? '#ffd8a8' : 'rgba(255,255,255,.4)'; g.fillText((ao ? '● ' : '○ ') + t('av', 'aortic valve'), 12, yb - 25);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText(`${t('lvv', 'left ventricle')} ${Math.round(H.V)} mL`, 12, yb - 10);
  }
  function drawLoop(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, hh: number) {
    const l = x0 + 34, r = x0 + w, tp = y0 + 6, bt = y0 + hh - 18, vMax = 260, pMax = 200, X = (v: number) => l + v / vMax * (r - l), Y = (p: number) => bt - clamp(p, -5, pMax) / pMax * (bt - tp);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; g.beginPath(); g.moveTo(l, tp); g.lineTo(l, bt); g.lineTo(r, bt); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace'; g.textAlign = 'right';
    for (const p of [0, 50, 100, 150, 200]) g.fillText(String(p), l - 4, Y(p) + 3);
    g.textAlign = 'center'; for (const v of [0, 100, 200]) g.fillText(String(v), X(v), bt + 12);
    g.fillText(t('ax.v', 'volume, mL'), (l + r) / 2, bt + 24 > y0 + hh + 6 ? bt + 12 : bt + 24);
    g.save(); g.translate(x0 + 8, (tp + bt) / 2); g.rotate(-Math.PI / 2); g.fillText(t('ax.p', 'pressure, mmHg'), 0, 0); g.restore();
    /* end-systolic pressure-volume line: its slope is the contractility */
    g.strokeStyle = 'rgba(255,111,125,.35)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(P.v0), Y(0)); g.lineTo(X(P.v0 + pMax / P.emax), Y(pMax)); g.stroke(); g.setLineDash([]);
    const path = (pts: [number, number][], col: string, lw: number) => { if (pts.length < 2) return; g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); pts.forEach(([v, p], i) => (i ? g.lineTo(X(v), Y(p)) : g.moveTo(X(v), Y(p)))); g.stroke(); };
    path(lastLoop, 'rgba(255,111,125,.45)', 2); path(loopPts, '#ff6f7d', 2.5);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(X(H.V), Y(H.Plv), 4, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'left'; g.fillText(t('pvl', 'pressure-volume loop'), l + 6, tp + 8);
  }
  function drawTraces(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, hh: number) {
    const ph = hh * .68, eh = hh - ph - 6, pMax = 200, X = (i: number) => x0 + i / (N - 1) * w, Yp = (p: number) => y0 + ph - clamp(p, 0, pMax) / pMax * ph;
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (const p of [0, 50, 100, 150]) { g.beginPath(); g.moveTo(x0, Yp(p)); g.lineTo(x0 + w, Yp(p)); g.stroke(); }
    const line = (arr: Float32Array, col: string, Y: (v: number) => number, lw = 1.6) => { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); for (let i = 0; i < N; i++) { const v = arr[(head + i) % N], x = X(i), y = Y(v); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
    line(tr.la, '#7fb2ff', Yp, 1.2); line(tr.ao, '#ffd27a', Yp); line(tr.lv, '#ff6f7d', Yp);
    const Ye = (v: number) => y0 + ph + 6 + eh * .7 - v * eh * .6; line(tr.ecg, '#7dffb0', Ye, 1.3);
    g.font = '10px ui-monospace,monospace'; g.textAlign = 'left';
    [['#ff6f7d', t('k.lv', 'ventricle')], ['#ffd27a', t('k.ao', 'aorta')], ['#7fb2ff', t('k.la', 'atrium')], ['#7dffb0', 'ECG']].forEach(([c, n], i) => { g.fillStyle = c; g.fillText('— ' + n, x0 + 4 + i * 92, y0 + 10); });
  }

  loop(ctx, S.cv, (dt) => { sim(dt * (ctx.calm ? .5 : 1)); draw(); });
  ctx.onDispose(() => { if (ac) ac.close().catch(() => {}); });
}
