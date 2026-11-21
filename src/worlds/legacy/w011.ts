/* 011 Supercar Universe: Performance Lab. Four archetype cars (no brands) you can tune, then race
   on a drag strip. Acceleration is simulated from power, traction, drag and rolling resistance,
   so the numbers react the way real cars do. */
import { type Ctx, h, layout, canvas, heading, note, select, seg, range, buttons, store, loop, clamp } from '../kit';

interface Car { name: string; kw: number; kg: number; cd: number; fa: number; drive: 'AWD' | 'RWD' | 'FWD'; mu: number; ev: boolean; col: string }
const CARS: Record<string, Car> = {
  hyper: { name: 'Hypercar', kw: 735, kg: 1600, cd: .36, fa: 2.0, drive: 'AWD', mu: 1.25, ev: false, col: '#c4f06a' },
  gt: { name: 'V8 grand tourer', kw: 460, kg: 1680, cd: .33, fa: 2.1, drive: 'RWD', mu: 1.15, ev: false, col: '#ff7a45' },
  ev: { name: 'Performance EV saloon', kw: 750, kg: 2250, cd: .23, fa: 2.4, drive: 'AWD', mu: 1.1, ev: true, col: '#8ab8ff' },
  hatch: { name: 'Hot hatch', kw: 235, kg: 1500, cd: .32, fa: 2.15, drive: 'AWD', mu: 1.05, ev: false, col: '#f2c14e' },
  classic: { name: '1960s sports car', kw: 150, kg: 1250, cd: .42, fa: 1.75, drive: 'RWD', mu: .85, ev: false, col: '#e9a6b8' },
};
const G = 9.81, RHO = 1.225, CRR = .012;
/* simulate a standing start; returns time series of distance & speed */
function simulate(c: Car) {
  const eta = c.ev ? .9 : .85, share = c.drive === 'AWD' ? 1 : c.drive === 'RWD' ? .62 : .55, me = c.kg * 1.05;
  let v = 0, x = 0, t = 0; const dt = .005, T: number[] = [0], X: number[] = [0], V: number[] = [0];
  let t100 = 0, t200 = 0, tq = 0, vq = 0, vmax = 0;
  while (t < 40) {
    const fTrac = c.mu * c.kg * G * share, fPow = c.kw * 1000 * eta / Math.max(v, c.ev ? 4 : 7);
    const f = Math.min(fTrac, fPow) - .5 * RHO * c.cd * c.fa * v * v - CRR * c.kg * G;
    v = Math.max(0, v + f / me * dt); x += v * dt; t += dt; vmax = Math.max(vmax, v);
    if (!t100 && v >= 100 / 3.6) t100 = t; if (!t200 && v >= 200 / 3.6) t200 = t; if (!tq && x >= 402.336) { tq = t; vq = v; }
    if (Math.round(t / dt) % 10 === 0) { T.push(t); X.push(x); V.push(v); }
  }
  /* top speed where power equals drag + rolling */
  let lo = 1, hi = 200; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const need = .5 * RHO * c.cd * c.fa * m ** 3 + CRR * c.kg * G * m; if (need > c.kw * 1000 * eta) hi = m; else lo = m; }
  return { T, X, V, t100, t200, tq, vq, top: lo };
}

export default function (ctx: Ctx) {
  const t = ctx.t, st = store<Record<string, Car>>(ctx.id, 'cars', CARS, (v) => !!v && typeof v === 'object' && Object.values(v as object).every((c) => typeof (c as Car).kw === 'number'));
  const cars: Record<string, Car> = { ...structuredClone(CARS), ...st.get() };
  let lanes = ['hyper', 'gt', 'ev', 'hatch'], edit = 'hyper', unit = 'kmh';
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#c4f06a');
  L.view.style.background = 'radial-gradient(120% 80% at 50% 0%, #1d2416, #0a0b09 70%)';
  L.view.style.display = 'block';
  const chips = h('div', { style: { position: 'absolute', insetInline: '18px', top: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '10px', zIndex: '2' } });
  L.view.append(chips);
  const S = canvas(L.view, t('strip', 'Drag strip'));
  let race: { t: number; on: boolean; lights: number; res: ReturnType<typeof simulate>[] } = { t: 0, on: false, lights: 0, res: lanes.map((k) => simulate(cars[k])) };

  function fmtV(ms: number) { return unit === 'kmh' ? `${Math.round(ms * 3.6)} km/h` : `${Math.round(ms * 2.23694)} mph`; }
  function at(r: ReturnType<typeof simulate>, time: number) { const i = Math.min(r.T.length - 1, Math.floor(time / (r.T[1] || .05))); return { x: r.X[i], v: r.V[i] }; }
  function chipsRender() {
    const c = cars[edit], r = simulate(c);
    const items: [string, string][] = [[t('c.0100', '0–100 km/h'), r.t100 ? r.t100.toFixed(2) + ' s' : '—'], [t('c.0200', '0–200 km/h'), r.t200 ? r.t200.toFixed(1) + ' s' : '—'], [t('c.q', '¼ mile'), r.tq ? `${r.tq.toFixed(2)} s` : '—'], [t('c.top', 'Top speed*'), fmtV(r.top)], [t('c.pw', 'Power / weight'), `${Math.round(c.kw * 1.341 / (c.kg / 1000))} hp/t`]];
    chips.replaceChildren(...items.map(([k, v]) => h('div', { style: { background: 'rgba(10,12,8,.72)', border: '1px solid rgba(196,240,106,.25)', borderRadius: '12px', padding: '8px 12px', backdropFilter: 'blur(6px)' } }, h('div', { class: 'mono', text: k, style: { fontSize: '9.5px', color: '#9aa58a', textTransform: 'uppercase', letterSpacing: '.08em' } }), h('div', { text: v, style: { fontSize: '20px', color: '#eef5df', fontVariantNumeric: 'tabular-nums' } }))));
  }
  function carShape(g: CanvasRenderingContext2D, x: number, y: number, w: number, col: string, kind: string) {
    const hgt = w * (kind === 'hatch' ? .38 : kind === 'ev' ? .33 : .28);
    g.save(); g.translate(x, y);
    g.fillStyle = col; g.beginPath();
    g.moveTo(-w * .5, 0); g.lineTo(-w * .5, -hgt * .45); g.quadraticCurveTo(-w * .42, -hgt * .62, -w * .2, -hgt * .65);
    g.quadraticCurveTo(-w * .05, -hgt * (kind === 'hatch' ? 1.15 : 1.05), w * .14, -hgt * (kind === 'hatch' ? 1.05 : .98));
    g.quadraticCurveTo(w * .3, -hgt * .7, w * .48, -hgt * .45); g.quadraticCurveTo(w * .53, -hgt * .2, w * .5, 0); g.closePath(); g.fill();
    g.fillStyle = 'rgba(20,24,30,.85)'; g.beginPath(); g.moveTo(-w * .14, -hgt * .7); g.quadraticCurveTo(-w * .02, -hgt * .98, w * .12, -hgt * .92); g.lineTo(w * .24, -hgt * .68); g.closePath(); g.fill();
    g.fillStyle = '#111'; for (const wx of [-w * .3, w * .3]) { g.beginPath(); g.arc(wx, 0, hgt * .36, 0, Math.PI * 2); g.fill(); g.fillStyle = '#777'; g.beginPath(); g.arc(wx, 0, hgt * .18, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; }
    g.fillStyle = '#fff6c8'; g.fillRect(w * .44, -hgt * .42, w * .05, hgt * .1);
    g.restore();
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const top = Math.min(160, H * .3), laneH = (H - top - 30) / lanes.length, x0 = 50, x1 = W - 30;
    // finish line at 402 m; scale
    const scale = (x1 - x0 - 40) / 402.336;
    g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x0, top, x1 - x0, laneH * lanes.length);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([14, 12]); for (let i = 1; i < lanes.length; i++) { g.beginPath(); g.moveTo(x0, top + laneH * i); g.lineTo(x1, top + laneH * i); g.stroke(); } g.setLineDash([]);
    for (const m of [0, 100, 200, 300, 402.336]) { const xx = x0 + 20 + m * scale; g.fillStyle = m === 402.336 ? '#eef5df' : 'rgba(255,255,255,.25)'; g.fillRect(xx, top, m === 402.336 || m === 0 ? 3 : 1, laneH * lanes.length); g.font = '10px ui-monospace,monospace'; g.fillStyle = '#9aa58a'; g.fillText(m === 402.336 ? '402 m' : m + ' m', xx + 4, top - 6); }
    // tree lights
    const lights = race.lights; for (let i = 0; i < 3; i++) { g.fillStyle = lights > i ? (lights >= 4 ? '#c4f06a' : '#f2c14e') : 'rgba(255,255,255,.1)'; g.beginPath(); g.arc(22, top + 20 + i * 22, 8, 0, Math.PI * 2); g.fill(); }
    lanes.forEach((k, i) => {
      const r = race.res[i], p = at(r, race.t), y = top + laneH * (i + .72), cx = x0 + 20 + Math.min(p.x, 430) * scale;
      const cw = Math.min(110, laneH * 1.6);
      if (race.on && p.v > 25) { g.fillStyle = `rgba(196,240,106,${Math.min(.25, p.v / 300)})`; g.fillRect(cx - cw * 2.2, y - cw * .12, cw * 1.7, 2); }
      carShape(g, cx - cw / 2, y, cw, cars[k].col, k);
      g.font = '12px ui-sans-serif,system-ui'; g.fillStyle = '#eef5df'; g.fillText(t('car.' + k, cars[k].name), x0 + 6, top + laneH * i + 16);
      g.font = '11px ui-monospace,monospace'; g.fillStyle = '#c4f06a';
      const done = p.x >= 402.336, txt = done ? `${r.tq.toFixed(2)} s @ ${fmtV(r.vq)}` : race.on || race.t > 0 ? `${race.t.toFixed(2)} s  ${fmtV(p.v)}` : '';
      g.fillText(txt, x1 - 170, top + laneH * i + 16);
    });
    if (race.on) {
      const winner = race.res.map((r, i) => [r.tq, i]).sort((a, b) => a[0] - b[0])[0];
      if (race.t > winner[0] + .4) { g.font = '400 28px "Instrument Serif", Georgia, serif'; g.fillStyle = '#eef5df'; g.textAlign = 'center'; g.fillText(`${t('wins', 'Winner')}: ${t('car.' + lanes[winner[1]], cars[lanes[winner[1]]].name)}`, W / 2, H - 14); g.textAlign = 'left'; }
    }
  }
  S.onResize(draw);
  let lightT = 0;
  loop(ctx, S.cv, (dt) => {
    if (race.lights > 0 && race.lights < 4) { lightT += dt; if (lightT > .5) { lightT = 0; race.lights++; if (race.lights >= 4) race.on = true; } }
    if (race.on) { race.t += dt * (ctx.calm ? .5 : 1); if (race.t > Math.max(...race.res.map((r) => r.tq)) + 3) race.on = false; }
    draw();
  });
  heading(L.panel, t('grid', 'On the grid'));
  lanes.forEach((k, i) => select(L.panel, `${t('lane', 'Lane')} ${i + 1}`, Object.keys(cars).map((c) => [c, t('car.' + c, cars[c].name)]), k, (v) => { lanes[i] = v; reset(); }));
  buttons(L.panel, [[t('go', 'Race ¼ mile'), () => { reset(); race.lights = 1; lightT = 0; }, true], [t('reset', 'Reset')!, reset]]);
  seg(L.panel, t('units', 'Units'), [['kmh', 'km/h'], ['mph', 'mph']], unit, (v) => { unit = v; chipsRender(); draw(); });
  heading(L.panel, t('tune', 'Tune a car'));
  const es = select(L.panel, t('editing', 'Editing'), Object.keys(cars).map((c) => [c, t('car.' + c, cars[c].name)]), edit, (v) => { edit = v; sync(); });
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  function sync() {
    const c = cars[edit]; box.replaceChildren();
    range(box, t('kw', 'Power'), { min: 50, max: 1500, step: 5, value: c.kw, fmt: (v) => `${v} kW · ${Math.round(v * 1.341)} hp` }, (v) => { c.kw = v; changed(); });
    range(box, t('kg', 'Mass'), { min: 700, max: 3000, step: 10, value: c.kg, fmt: (v) => `${v} kg` }, (v) => { c.kg = v; changed(); });
    range(box, t('cd', 'Drag coefficient (Cd)'), { min: .2, max: .6, step: .01, value: c.cd, fmt: (v) => v.toFixed(2) }, (v) => { c.cd = v; changed(); });
    range(box, t('fa', 'Frontal area'), { min: 1.5, max: 3, step: .05, value: c.fa, fmt: (v) => v.toFixed(2) + ' m²' }, (v) => { c.fa = v; changed(); });
    range(box, t('mu', 'Tyre grip (μ)'), { min: .7, max: 1.6, step: .05, value: c.mu, fmt: (v) => v.toFixed(2) }, (v) => { c.mu = v; changed(); });
    seg(box, t('drive', 'Driven wheels'), [['AWD', 'AWD'], ['RWD', 'RWD'], ['FWD', 'FWD']], c.drive, (v) => { c.drive = v as Car['drive']; changed(); });
    buttons(box, [[t('factory', 'Factory settings'), () => { cars[edit] = structuredClone(CARS[edit]); sync(); changed(); }]]);
  }
  function changed() { st.set(cars); chipsRender(); reset(); }
  function reset() { race = { t: 0, on: false, lights: 0, res: lanes.map((k) => simulate(cars[k])) }; draw(); }
  note(L.panel, t('how', 'Each car accelerates with whichever is smaller: what the tyres can grip (grip × weight on the driven wheels) or what the power can push (power ÷ speed). Air drag grows with the square of speed. *Top speed is where power equals drag, ignoring gearing and limiters. A simplified model: no gear changes, launch control or weight transfer.'));
  void es; void clamp;
  sync(); chipsRender(); reset();
}
