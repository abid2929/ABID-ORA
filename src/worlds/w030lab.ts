/* 030 Wildlife Kingdom: Predator and Prey. An agent-based meadow: grass regrows, hares graze and
   breed, foxes hunt hares. Populations rise and crash in cycles, drawn live next to the classic
   Lotka–Volterra equations so you can compare a living model with the textbook one. */
import { type Ctx, h, layout, canvas, heading, note, range, buttons, stats, loop, rng, clamp } from './kit';

interface A { x: number; y: number; a: number; e: number; age: number }
const GW = 60, GH = 40;

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#f0a04b');
  L.view.style.background = '#1c1a12';
  L.view.style.display = 'grid'; L.view.style.placeItems = 'stretch'; L.view.style.gridTemplateRows = '1fr 150px';
  const top = h('div', { style: { position: 'relative', minHeight: '320px' } }), bottom = h('div', { style: { position: 'relative' } });
  L.view.append(top, bottom);
  const S = canvas(top, t('cv', 'Meadow with grass, hares and foxes')); Object.assign(S.cv.style, { position: 'absolute', inset: '0' });
  const C = canvas(bottom, t('chart', 'Population chart and phase plot')); Object.assign(C.cv.style, { position: 'absolute', inset: '0' });
  const info = stats(L.panel, [['hares', t('hares', 'Hares')], ['foxes', t('foxes', 'Foxes')], ['grass', t('grass', 'Grass cover')], ['day', t('day', 'Day')]]);
  const P = { regrow: .02, hunt: 1, hareBirth: 6, foxBirth: 12 };
  let R = rng(3), grass = new Float32Array(GW * GH), hares: A[] = [], foxes: A[] = [], day = 0;
  const hist: [number, number][] = [], lv: [number, number][] = [];
  let lvH = 0, lvF = 0;
  function reset() {
    R = rng(3); grass.fill(.8); hares = []; foxes = []; day = 0; hist.length = 0; lv.length = 0;
    for (let i = 0; i < 120; i++) hares.push({ x: R() * GW, y: R() * GH, a: R() * 6.28, e: 4 + R() * 4, age: 0 });
    for (let i = 0; i < 14; i++) foxes.push({ x: R() * GW, y: R() * GH, a: R() * 6.28, e: 10 + R() * 6, age: 0 });
    lvH = 120; lvF = 14;
  }
  const wrap = (a: A) => { a.x = (a.x + GW) % GW; a.y = (a.y + GH) % GH; };
  function tick() {
    day++;
    for (let i = 0; i < grass.length; i++) grass[i] = Math.min(1, grass[i] + P.regrow * (.3 + grass[i]));
    /* hares wander, graze, breed */
    const born: A[] = [];
    for (const r of hares) {
      r.a += (R() - .5) * .9; r.x += Math.cos(r.a) * .5; r.y += Math.sin(r.a) * .5; wrap(r); r.age++;
      const gi = Math.floor(r.y) * GW + Math.floor(r.x), bite = Math.min(grass[gi], .35); grass[gi] -= bite; r.e += bite * 2.6 - .3;
      if (r.e > P.hareBirth && R() < .2) { r.e /= 2; born.push({ x: r.x, y: r.y, a: R() * 6.28, e: r.e, age: 0 }); }
    }
    hares = hares.filter((r) => r.e > 0 && r.age < 160).concat(born);
    /* foxes: steer to the nearest hare in sight, catch within reach */
    const bucket = new Map<number, A[]>(); for (const r of hares) { const k = Math.floor(r.x / 4) + Math.floor(r.y / 4) * 100; (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(r); }
    const eaten = new Set<A>(), cubs: A[] = [];
    for (const f of foxes) {
      let best: A | null = null, bd = 4;
      const bx = Math.floor(f.x / 4), by = Math.floor(f.y / 4);
      for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const r of bucket.get(((bx + dx + 15) % 15) + ((by + dy + 10) % 10) * 100) ?? []) { if (eaten.has(r)) continue; const d = Math.hypot(r.x - f.x, r.y - f.y); if (d < bd) { bd = d; best = r; } }
      if (best) f.a = Math.atan2(best.y - f.y, best.x - f.x) + (R() - .5) * .3; else f.a += (R() - .5) * .6;
      f.x += Math.cos(f.a) * .75; f.y += Math.sin(f.a) * .75; wrap(f); f.age++; f.e -= .2;
      if (best && bd < 1.1 && R() < .08 * P.hunt) { eaten.add(best); f.e += 6; }
      if (f.e > P.foxBirth && R() < .06) { f.e /= 2; cubs.push({ x: f.x, y: f.y, a: R() * 6.28, e: f.e, age: 0 }); }
    }
    hares = hares.filter((r) => !eaten.has(r)); foxes = foxes.filter((f) => f.e > 0 && f.age < 600).concat(cubs);
    if (hares.length > 1500) hares = hares.slice(0, 1500);
    /* neighbouring land: a few animals wander in, as they would into a real meadow */
    if (imm) { if (hares.length < 20 && R() < .3) hares.push({ x: 0, y: R() * GH, a: 0, e: 5, age: 0 }); if (foxes.length < 2 && R() < .02) foxes.push({ x: GW - 1, y: R() * GH, a: Math.PI, e: 12, age: 0 }); }
    /* textbook Lotka–Volterra integrated alongside (Euler, small steps) */
    for (let k = 0; k < 10; k++) { const a = .04, b = .0012, c = .06, d = .00025, dt = .1; const dH = a * lvH - b * lvH * lvF, dF = d * lvH * lvF - c * lvF; lvH = Math.max(0, lvH + dH * dt); lvF = Math.max(0, lvF + dF * dt); }
    hist.push([hares.length, foxes.length]); lv.push([lvH, lvF]); if (hist.length > 600) { hist.shift(); lv.shift(); }
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h, cw = W / GW, ch = H / GH;
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const v = grass[y * GW + x]; g.fillStyle = `rgb(${Math.round(112 - v * 50)},${Math.round(92 + v * 70)},${Math.round(56 - v * 14)})`; g.fillRect(x * cw, y * ch, cw + .5, ch + .5); }
    g.fillStyle = '#f4efe2'; for (const r of hares) { g.beginPath(); g.ellipse(r.x * cw, r.y * ch, 3, 2.2, r.a, 0, 7); g.fill(); }
    for (const f of foxes) { g.save(); g.translate(f.x * cw, f.y * ch); g.rotate(f.a); g.fillStyle = '#e46a1f'; g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -4); g.lineTo(-3, 0); g.lineTo(-5, 4); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(-8, -1, 3, 2); g.restore(); }
    let gs = 0; for (const v of grass) gs += v;
    info('hares', String(hares.length)); info('foxes', String(foxes.length)); info('grass', `${Math.round(gs / grass.length * 100)}%`); info('day', String(day));
    if (!foxes.length) L.hud.textContent = t('nofox', 'The foxes died out: hares now boom until grass runs short'); else if (!hares.length) L.hud.textContent = t('nohare', 'No hares left: the foxes will starve'); else L.hud.textContent = '';
    /* chart */
    const q = C.g, w = C.w, hh = C.h; q.clearRect(0, 0, w, hh);
    const cwid = w * .66, mxH = Math.max(50, ...hist.map((p) => p[0]), ...lv.map((p) => p[0])), mxF = Math.max(10, ...hist.map((p) => p[1]), ...lv.map((p) => p[1]));
    const line = (arr: [number, number][], idx: 0 | 1, mx: number, col: string, dash: number[]) => { q.strokeStyle = col; q.setLineDash(dash); q.lineWidth = 1.6; q.beginPath(); arr.forEach((p, i) => { const x = 10 + i / 600 * (cwid - 20), y = hh - 12 - p[idx] / mx * (hh - 28); i ? q.lineTo(x, y) : q.moveTo(x, y); }); q.stroke(); q.setLineDash([]); };
    line(hist, 0, mxH, '#f4efe2', []); line(hist, 1, mxF, '#e46a1f', []); line(lv, 0, mxH, 'rgba(244,239,226,.35)', [4, 4]); line(lv, 1, mxF, 'rgba(228,106,31,.45)', [4, 4]);
    q.fillStyle = 'rgba(255,255,255,.6)'; q.font = '11px ui-monospace,monospace'; q.fillText(t('legend', 'solid: this meadow · dashed: Lotka–Volterra'), 12, 13);
    /* phase plot: hares against foxes */
    const px = cwid + 14, pw = w - px - 10; q.strokeStyle = 'rgba(255,255,255,.15)'; q.strokeRect(px, 6, pw, hh - 12);
    q.strokeStyle = '#f0a04b'; q.beginPath(); hist.forEach((p, i) => { const x = px + p[0] / mxH * pw, y = hh - 6 - p[1] / mxF * (hh - 12); i ? q.lineTo(x, y) : q.moveTo(x, y); }); q.stroke();
    q.fillStyle = 'rgba(255,255,255,.6)'; q.fillText(t('phase', 'hares → / foxes ↑'), px + 6, 18);
  }
  let acc = 0, speed = 12, imm = true;
  loop(ctx, S.cv, (dt) => { acc += dt * speed * (ctx.calm ? .4 : 1); let n = 0; while (acc >= 1 && n < 8) { acc -= 1; tick(); n++; } draw(); });

  heading(L.panel, t('world', 'The meadow'));
  range(L.panel, t('regrow', 'Grass regrowth'), { min: .002, max: .06, step: .002, value: P.regrow, fmt: (n) => (n * 100).toFixed(1) + '%' }, (v) => { P.regrow = v; });
  range(L.panel, t('hunt', 'Fox hunting skill'), { min: .2, max: 2, step: .1, value: P.hunt, fmt: (n) => '×' + n }, (v) => { P.hunt = v; });
  range(L.panel, t('speed', 'Days per second'), { min: 1, max: 40, value: speed }, (v) => { speed = v; });
  const im = h('input', { type: 'checkbox', checked: true }) as HTMLInputElement; im.addEventListener('change', () => { imm = im.checked; });
  L.panel.append(h('label', { class: 'wk-chk' }, im, h('span', { text: t('imm', 'Animals can wander in from neighbouring land') })));
  buttons(L.panel, [[t('addF', 'Release 10 foxes'), () => { for (let i = 0; i < 10; i++) foxes.push({ x: R() * GW, y: R() * GH, a: R() * 6.28, e: 12, age: 0 }); }], [t('addH', 'Release 50 hares'), () => { for (let i = 0; i < 50; i++) hares.push({ x: R() * GW, y: R() * GH, a: R() * 6.28, e: 5, age: 0 }); }], [t('cull', 'Remove all foxes'), () => { foxes = []; }], [t('reset', 'Restart'), reset, true]]);
  note(L.panel, t('how', 'Every hare and fox is its own animal with energy: hares gain it from grass, foxes from hares, and both spend it moving. When food is plenty they breed. The result is cycles: more hares feed more foxes, which eat the hares down, then starve, and the hares recover.'));
  note(L.panel, t('lv', 'The dashed lines are the Lotka–Volterra equations: dH/dt = aH − bHF and dF/dt = dHF − cF. The living meadow adds grass, space and chance, so its cycles are messier, like real ones.'));
  reset();
  void clamp;
}
