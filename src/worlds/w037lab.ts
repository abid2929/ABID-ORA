/* 037 Galaxy Gallery: Galaxy Forge. Build galaxies the way astronomers explain them. Spiral arms
   appear when stars travel on slightly oval orbits whose orientation turns a little with distance
   from the centre (the density-wave idea): the orbits crowd together into arms that keep their
   shape while the stars stream through. Switch to "material arms" to see the winding problem:
   arms made of fixed stars wrap tighter every orbit. A Hubble-sequence label (E0–E7, S0, Sa–Sc,
   SBa–SBc) follows your settings, and finished galaxies can be saved as gallery cards. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, loop, local, rng, clamp, download } from './kit';

export interface Gal { kind: 'spiral' | 'elliptical'; twist: number; bulge: number; bar: number; ell: number; arms: number }
/** Hubble-sequence label from the settings */
export function hubble(gx: Gal) {
  if (gx.kind === 'elliptical') return `E${clamp(Math.round(gx.ell * 10), 0, 7)}`;
  if (gx.twist < .4) return gx.bar > .25 ? 'SB0' : 'S0';
  /* big bulge and tight arms → a; small bulge and open arms → c */
  const score = gx.bulge * 1.4 + (gx.twist - .4) * .3;
  const sub = score > .85 ? 'a' : score > .7 ? 'ab' : score > .55 ? 'b' : score > .42 ? 'bc' : 'c';
  return (gx.bar > .25 ? 'SB' : 'S') + sub;
}
/** angular speed for a rotation curve: flat (real galaxies, dark matter) or Keplerian (visible mass only) */
export const omega = (r: number, flat: boolean) => flat ? 1 / Math.max(r, .05) : Math.max(r, .05) ** -1.5;

interface Star { a: number; e: number; ph: number; arm: number; kind: 0 | 1 | 2 | 3; th0: number; z: number }

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#b9a6ff');
  L.view.style.background = '#03030a';
  const S = canvas(L.view, t('cv', 'A galaxy built from many thousands of stars. Drag to turn it.'));
  S.cv.style.cursor = 'grab';
  const info = stats(L.panel, [['type', t('type', 'Hubble type')], ['stars', t('stars', 'Stars drawn')], ['orbits', t('orbits', 'Orbits so far (middle)')], ['wind', t('wind', 'Arm winding')]]);
  const G: Gal & { mode: 'wave' | 'material'; flat: boolean; incl: number; pa: number; speed: number; seed: number } =
    { kind: 'spiral', twist: 1.6, bulge: .35, bar: 0, ell: .3, arms: 2, mode: 'wave', flat: true, incl: 35, pa: 0, speed: 1, seed: 7 };
  let stars: Star[] = [], time = 0;
  const N = ctx.calm ? 5000 : 14000;
  function build() {
    const R = rng(G.seed); stars = [];
    for (let i = 0; i < N; i++) {
      const u = R();
      if (G.kind === 'elliptical' || u < G.bulge * .55) {
        /* bulge / elliptical: concentrated (roughly de Vaucouleurs-like) random orbits */
        const a = (G.kind === 'elliptical' ? .95 : .35) * Math.pow(R(), 2.2) + .01;
        stars.push({ a, e: R() * .5, ph: R() * 6.283, arm: -1, kind: 0, th0: R() * 6.283, z: (R() - .5) * (G.kind === 'elliptical' ? 2 : 1.2) });
      } else {
        const a = .08 + Math.pow(R(), .8) * .92, arm = Math.floor(R() * G.arms);
        const young = R() < .45, hii = young && R() < .06, dust = !young && R() < .18;
        stars.push({ a, e: .1 + R() * .06, ph: R() * 6.283, arm, kind: hii ? 2 : dust ? 3 : young ? 1 : 0, th0: arm / G.arms * Math.PI * 2 + (R() - .5) * .5, z: (R() - .5) * .06 });
      }
    }
    time = 0; upd();
  }
  function upd() {
    info('type', hubble(G)); info('stars', N.toLocaleString(ctx.lang));
    const orb = time * omega(.5, G.flat) / (Math.PI * 2); info('orbits', orb.toFixed(1));
    if (G.mode === 'material' && G.kind === 'spiral') { const turns = time * (omega(.2, G.flat) - omega(.9, G.flat)) / (Math.PI * 2); info('wind', `${turns.toFixed(1)} ${t('turns', 'extra turns')}`); }
    else info('wind', G.kind === 'spiral' ? t('steady', 'steady pattern') : '—');
    L.hud.textContent = G.mode === 'material' && G.kind === 'spiral' && time > 6 ? t('windhint', 'Material arms wind up within a few orbits, but real spirals do not. That is the winding problem; density waves solve it.') : '';
  }
  let drag: { x: number; pa: number; incl: number; y: number } | null = null;
  S.cv.addEventListener('pointerdown', (e) => { const p = local(e, S.cv); drag = { x: p.x, y: p.y, pa: G.pa, incl: G.incl }; S.cv.setPointerCapture(e.pointerId); S.cv.style.cursor = 'grabbing'; });
  S.cv.addEventListener('pointermove', (e) => { if (!drag) return; const p = local(e, S.cv); G.pa = drag.pa + (p.x - drag.x) * .01; G.incl = clamp(drag.incl + (p.y - drag.y) * .3, 0, 85); incl.set(Math.round(G.incl)); });
  S.cv.addEventListener('pointerup', () => { drag = null; S.cv.style.cursor = 'grab'; });
  S.cv.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') G.pa -= .1; else if (e.key === 'ArrowRight') G.pa += .1; else if (e.key === 'ArrowUp') G.incl = clamp(G.incl - 3, 0, 85); else if (e.key === 'ArrowDown') G.incl = clamp(G.incl + 3, 0, 85); else return; incl.set(Math.round(G.incl)); e.preventDefault(); });
  let frame = 0;
  function draw(dt: number) {
    time += dt * G.speed * .35 * (ctx.calm ? .4 : 1);
    const g = S.g, W = S.w, H = S.h, sc = Math.min(W, H) * .46, cx = W / 2, cy = H / 2;
    g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(3,3,10,1)'; g.fillRect(0, 0, W, H);
    const ci = Math.cos(G.incl * Math.PI / 180), si = Math.sin(G.incl * Math.PI / 180), cp = Math.cos(G.pa), sp = Math.sin(G.pa);
    const pattern = time * .04; /* density-wave pattern turns slowly */
    g.globalCompositeOperation = 'lighter';
    const barR = G.bar * .45;
    let armW = 1;
    for (const s of stars) {
      let x: number, y: number; armW = 1;
      if (G.kind === 'elliptical') {
        const th = s.th0 + time * omega(s.a + .2, G.flat) * .3; x = Math.cos(th) * s.a; y = Math.sin(th) * s.a * (1 - G.ell);
      } else if (s.arm < 0 || G.mode === 'wave') {
        /* density waves: every orbit is an m-lobed oval turned a little more at each size. Stars move slowest at the
           far ends of the oval (dM/dE = 1 - 2k cos mE), so they crowd there, and those far ends line up into m arms. */
        const m = G.arms, inBar = s.arm >= 0 && s.a < barR, bulge = s.arm < 0;
        const orient = inBar ? pattern : s.a * G.twist * 3.2 + pattern;
        const M = s.ph + time * omega(s.a, G.flat) * .25 - pattern;
        const k = bulge ? .05 : inBar ? .38 : .4, mm = inBar ? 2 : m;
        let E = M; for (let it = 0; it < 4; it++) E -= (E - (2 * k / mm) * Math.sin(mm * E) - M) / (1 - 2 * k * Math.cos(mm * E));
        const ee = bulge ? s.e * .3 : inBar ? .5 : s.e;
        const rr = s.a * (1 + ee * Math.cos(mm * E)) / (1 + ee);
        armW = bulge ? 0 : Math.max(0, Math.cos(mm * E));
        const ang = E + orient;
        x = Math.cos(ang) * rr; y = Math.sin(ang) * rr;
      } else {
        /* material arms: each star keeps its place in an arm and simply orbits at its own speed → the arm winds up */
        const th = s.th0 + s.a * G.twist * 3.2 + time * omega(s.a, G.flat) * .25 + s.ph * .02;
        x = Math.cos(th) * s.a; y = Math.sin(th) * s.a;
      }
      const z = s.z * (G.kind === 'elliptical' ? s.a : s.arm < 0 ? s.a * .9 : 1);
      /* rotate by position angle, then tilt */
      const xr = x * cp - y * sp, yr = x * sp + y * cp;
      const X = cx + xr * sc, Y = cy + (yr * ci + z * si) * sc;
      const r = s.a;
      /* new stars, glowing gas and dust lanes form where the gas is squeezed, in the arms */
      if (s.kind === 3 && armW < .6 || s.kind === 2 && armW < .8) continue;
      if (s.kind === 3) { g.globalCompositeOperation = 'source-over'; g.fillStyle = 'rgba(20,10,10,.35)'; g.fillRect(X, Y, 2.2, 2.2); g.globalCompositeOperation = 'lighter'; continue; }
      const col = s.kind === 2 ? 'rgba(255,110,170,.9)' : s.kind === 1 ? `rgba(160,200,255,${Math.min(1, (.75 - r * .25) * (.12 + 1.3 * armW * armW * armW))})` : `rgba(255,${200 - r * 60},${140 - r * 60},${.35 + (1 - r) * .25})`;
      g.fillStyle = col; const sz = s.kind === 2 ? 2.2 : 1.3; g.fillRect(X, Y, sz, sz);
    }
    /* bright core */
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, sc * (.12 + G.bulge * .2)); core.addColorStop(0, 'rgba(255,240,210,.85)'); core.addColorStop(.4, 'rgba(255,200,140,.25)'); core.addColorStop(1, 'rgba(255,200,140,0)');
    g.fillStyle = core; g.save(); g.translate(cx, cy); g.scale(1, Math.max(.25, ci)); g.translate(-cx, -cy); g.beginPath(); g.arc(cx, cy, sc * (.12 + G.bulge * .2), 0, 7); g.fill(); g.restore();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = 'rgba(255,255,255,.75)'; g.font = '600 13px ui-monospace,monospace'; g.fillText(hubble(G), 16, H - 18);
    if (++frame % 15 === 0) upd();
  }
  loop(ctx, S.cv, draw);

  heading(L.panel, t('shape', 'Shape'));
  const kind = seg(L.panel, t('kind', 'Kind'), [['spiral', t('k.spiral', 'Spiral')], ['elliptical', t('k.ell', 'Elliptical')]], G.kind, (v) => { G.kind = v as Gal['kind']; spiralBox.hidden = v !== 'spiral'; ellBox.hidden = v === 'spiral'; build(); });
  const spiralBox = h('div', { style: { display: 'grid', gap: '12px' } }), ellBox = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(spiralBox, ellBox); ellBox.hidden = true;
  range(spiralBox, t('arms', 'Arms'), { min: 2, max: 4, value: G.arms }, (v) => { G.arms = v; build(); });
  range(spiralBox, t('twist', 'Arm winding'), { min: 0, max: 3, step: .1, value: G.twist, fmt: (n) => n < .4 ? t('none', 'none (lenticular)') : n.toFixed(1) }, (v) => { G.twist = v; upd(); });
  range(spiralBox, t('bulge', 'Central bulge'), { min: .05, max: .9, step: .05, value: G.bulge, fmt: (n) => Math.round(n * 100) + ' %' }, (v) => { G.bulge = v; build(); });
  range(spiralBox, t('bar', 'Bar'), { min: 0, max: 1, step: .05, value: G.bar, fmt: (n) => n < .25 ? t('nobar', 'no bar') : Math.round(n * 100) + ' %' }, (v) => { G.bar = v; upd(); });
  seg(spiralBox, t('mode', 'Arms are'), [['wave', t('m.wave', 'Density waves')], ['material', t('m.mat', 'Material (winding problem)')]], G.mode, (v) => { G.mode = v as typeof G.mode; time = 0; upd(); });
  range(ellBox, t('ell', 'Flattening'), { min: 0, max: .7, step: .1, value: G.ell, fmt: (n) => 'E' + Math.round(n * 10) }, (v) => { G.ell = v; upd(); });
  heading(L.panel, t('motion', 'Motion and view'));
  seg(L.panel, t('curve', 'Rotation curve'), [['flat', t('c.flat', 'Flat (dark matter)')], ['kep', t('c.kep', 'Visible mass only')]], 'flat', (v) => { G.flat = v === 'flat'; time = 0; upd(); });
  range(L.panel, t('speed', 'Time speed'), { min: 0, max: 4, step: .1, value: G.speed, fmt: (n) => '×' + n }, (v) => { G.speed = v; });
  const incl = range(L.panel, t('incl', 'Tilt (inclination)'), { min: 0, max: 85, value: G.incl, fmt: (n) => n + '°' }, (v) => { G.incl = v; });
  range(L.panel, t('seed', 'Galaxy number'), { min: 1, max: 99, value: G.seed }, (v) => { G.seed = v; build(); });
  heading(L.panel, t('presets', 'Famous shapes (approximate)'));
  const presets: [string, string, Partial<typeof G>][] = [
    ['mw', 'Barred spiral like the Milky Way (SBbc)', { kind: 'spiral', arms: 4, twist: .9, bulge: .22, bar: .6, incl: 20 }],
    ['m51', 'Grand-design spiral (Sc)', { kind: 'spiral', arms: 2, twist: 1.3, bulge: .08, bar: 0, incl: 15 }],
    ['sombrero', 'Edge-on, big bulge (Sa)', { kind: 'spiral', arms: 2, twist: 2.6, bulge: .8, bar: 0, incl: 84 }],
    ['m87', 'Giant elliptical (E0)', { kind: 'elliptical', ell: 0, incl: 0 }],
  ];
  const pr = h('div', { class: 'wk-row' });
  for (const [id, en, p] of presets) pr.append(h('button', { type: 'button', class: 'wk-b', text: t('p.' + id, en), onclick: () => { Object.assign(G, p); kind.set(G.kind); spiralBox.hidden = G.kind !== 'spiral'; ellBox.hidden = G.kind === 'spiral'; incl.set(G.incl); build(); } }));
  L.panel.append(pr);
  L.panel.append(h('div', { class: 'wk-row' }, h('button', { type: 'button', class: 'wk-b pri', text: t('save', 'Save gallery card (PNG)'), onclick: () => {
    const c = document.createElement('canvas'); c.width = S.cv.width; c.height = S.cv.height + 120 * S.dpr; const q = c.getContext('2d')!;
    q.fillStyle = '#03030a'; q.fillRect(0, 0, c.width, c.height); q.drawImage(S.cv, 0, 0); q.scale(S.dpr, S.dpr);
    q.fillStyle = '#fff'; q.font = '600 28px ui-serif,Georgia,serif'; q.fillText(`${t('card', 'Galaxy')} ${hubble(G)} · #${G.seed}`, 24, S.h + 52);
    q.fillStyle = 'rgba(255,255,255,.6)'; q.font = '14px ui-monospace,monospace'; q.fillText(`${G.kind === 'spiral' ? `${G.arms} ${t('armsw', 'arms')} · ${t('bulgew', 'bulge')} ${Math.round(G.bulge * 100)}% · ${t('barw', 'bar')} ${Math.round(G.bar * 100)}%` : `${t('flatw', 'flattening')} ${G.ell}`} · Abidora Galaxy Forge`, 24, S.h + 84);
    download(c, `abidora-galaxy-${hubble(G)}-${G.seed}.png`);
  } })));
  note(L.panel, t('how', 'Stars near the centre go round faster than stars far out. If arms were made of the same stars forever they would wind up tight within a few orbits. Instead, arms are traffic jams: orbits are slightly oval and turned a little more at each distance, so stars bunch up in arms and pass through them, like cars through a slow zone. A flat rotation curve, which needs dark matter, is what real galaxies show.'));
  note(L.panel, t('src', 'Based on the kinematic density-wave picture (Kalnajs, Lin & Shu) and the Hubble–de Vaucouleurs classification. Presets are styled after real galaxy types, not exact models of them.'));
  build();
}
