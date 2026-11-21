/* 050 Color Universe: Colour Vision Lab. Colour is not in the paint or the lamp: it is what three
   kinds of cone make of a spectrum. Everything here is computed from spectra, 380 to 730 nm, through
   the CIE 1931 standard observer (Wyman-Sloan-Shirley fit) to sRGB. Mix coloured lamps (spectra add),
   mix paints (Kubelka-Munk pigment mixing under a chosen light), and meet metamers: two paints with
   different spectra that match in daylight and part ways under a lamp. Every view can be seen as
   people with protanopia, deuteranopia or tritanopia see it (Machado 2009). */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, local, clamp, store, rng } from './kit';

/* ---------- spectral machinery ---------- */
export const L0 = 380, L1 = 730, STEP = 5, N = (L1 - L0) / STEP + 1;
export const lam = Array.from({ length: N }, (_, i) => L0 + i * STEP);
const g = (x: number, mu: number, s1: number, s2: number) => { const s = x < mu ? s1 : s2; return Math.exp(-.5 * ((x - mu) / s) ** 2); };
/** CIE 1931 2° colour matching functions, multi-lobe Gaussian fit (Wyman, Sloan and Shirley 2013) */
export function cmf(l: number): [number, number, number] {
  return [1.056 * g(l, 599.8, 37.9, 31.0) + .362 * g(l, 442.0, 16.0, 26.7) - .065 * g(l, 501.1, 20.4, 26.2), .821 * g(l, 568.8, 46.9, 40.5) + .286 * g(l, 530.9, 16.3, 31.1), 1.217 * g(l, 437.0, 11.8, 36.0) + .681 * g(l, 459.0, 26.0, 13.8)];
}
const CMF = lam.map(cmf);
/* CIE standard illuminant D65 at 10 nm, 380-750 */
const D65_10 = [49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86, 115.92, 108.81, 109.35, 107.80, 104.79, 107.69, 104.41, 104.05, 100.00, 96.33, 95.79, 88.69, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28, 78.28, 69.72, 71.61, 74.35, 61.60, 69.89];
export type Spec = Float64Array;
const spec = (f: (l: number) => number): Spec => Float64Array.from(lam, f);
export const planck = (T: number) => (l: number) => { const m = l * 1e-9; return 1 / (m ** 5 * (Math.exp(1.4388e-2 / (m * T)) - 1)); };
export const ILLUM: Record<string, Spec> = {
  d65: spec((l) => { const k = (l - 380) / 10, i = Math.floor(k), f = k - i; return D65_10[i] + (D65_10[Math.min(i + 1, D65_10.length - 1)] - D65_10[i]) * f; }),
  inc: (() => { const p = planck(2856), s = spec(p), r = p(560); return s.map((v) => v / r * 100) as Spec; })(),
  led: spec((l) => 100 * (1.1 * g(l, 452, 10, 12) + .95 * g(l, 565, 45, 60))),
};
export function xyz(S: Spec): [number, number, number] { let X = 0, Y = 0, Z = 0; for (let i = 0; i < N; i++) { X += S[i] * CMF[i][0]; Y += S[i] * CMF[i][1]; Z += S[i] * CMF[i][2]; } return [X * STEP, Y * STEP, Z * STEP]; }
export const chroma = (c: number[]) => { const s = c[0] + c[1] + c[2] || 1; return [c[0] / s, c[1] / s]; };
/** reflectance under an illuminant, normalised so a perfect white has Y = 1 */
export function surface(R: Spec, I: Spec): [number, number, number] { const W = xyz(I)[1]; const c = xyz(I.map((v, i) => v * R[i]) as Spec); return [c[0] / W, c[1] / W, c[2] / W]; }

/* ---------- colour spaces ---------- */
type M3 = number[][];
const mm = (M: M3, v: number[]) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const mmul = (A: M3, B: M3) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
export function inv3(m: M3): M3 {
  const [a, b, c] = m[0], [d, e, f] = m[1], [gg, hh, i] = m[2], A = e * i - f * hh, B = -(d * i - f * gg), C = d * hh - e * gg, det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * hh) / det, (b * f - c * e) / det], [B / det, (a * i - c * gg) / det, -(a * f - c * d) / det], [C / det, -(a * hh - b * gg) / det, (a * e - b * d) / det]];
}
const XYZ2RGB: M3 = [[3.2406, -1.5372, -.4986], [-.9689, 1.8758, .0415], [.0557, -.2040, 1.0570]];
const BRAD: M3 = [[.8951, .2664, -.1614], [-.7502, 1.7135, .0367], [.0389, -.0685, 1.0296]], BRADI = inv3(BRAD);
/** Bradford chromatic adaptation: what the colour looks like once the eye has adapted from white wS to white wD */
export function adapt(c: number[], wS: number[], wD: number[]) {
  const s = mm(BRAD, wS), d = mm(BRAD, wD), D: M3 = [[d[0] / s[0], 0, 0], [0, d[1] / s[1], 0], [0, 0, d[2] / s[2]]];
  return mm(mmul(BRADI, mmul(D, BRAD)), c);
}
/* colour-vision deficiency simulation in linear RGB, severity 1 (Machado, Oliveira and Fernandes 2009) */
export const CVD: Record<string, M3> = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[.152286, 1.052583, -.204868], [.114503, .786281, .099216], [-.003882, -.048116, 1.051998]],
  deutan: [[.367322, .860646, -.227968], [.280085, .672501, .047413], [-.011820, .042940, .968881]],
  tritan: [[1.255528, -.076749, -.178779], [-.078411, .930809, .147602], [.004733, .691367, .303900]],
};
const enc = (v: number) => { v = clamp(v, 0, 1); return v <= .0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - .055; };
/** XYZ (Y = 1 white) to an sRGB colour, pulling out-of-gamut colours toward grey of the same luminance */
export function toRGB(c: number[], vision = 'normal'): { rgb: [number, number, number]; out: boolean } {
  let r = mm(XYZ2RGB, c); const Y = clamp(c[1], 0, 1); let out = false;
  if (Math.min(...r) < -.002) { out = true; let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2, q = r.map((v) => Y + (v - Y) * m); if (Math.min(...q) < 0) hi = m; else lo = m; } r = r.map((v) => Y + (v - Y) * lo); }
  if (Math.max(...r) > 1.002) { out = true; const m = Math.max(...r); r = r.map((v) => v / m); }
  r = mm(CVD[vision] ?? CVD.normal, r);
  return { rgb: r.map((v) => Math.round(enc(v) * 255)) as [number, number, number], out };
}
const hex = (c: number[]) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
export function lab(c: number[], w: number[]) {
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116), fx = f(c[0] / w[0]), fy = f(c[1] / w[1]), fz = f(c[2] / w[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const dE = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/* ---------- lights, paints, metamers ---------- */
export const lamp = (peak: number, width: number, power: number): Spec => spec((l) => power * g(l, peak, width, width));
const sig = (l: number, c: number, w: number) => 1 / (1 + Math.exp(-(l - c) / w));
export const PIGMENTS: Record<string, [string, (l: number) => number]> = {
  yellow: ['Lemon yellow', (l) => .05 + .82 * sig(l, 505, 9)],
  red: ['Cadmium red', (l) => .04 + .8 * sig(l, 598, 8)],
  magenta: ['Quinacridone magenta', (l) => .06 + .66 * (1 - g(l, 545, 38, 32)) * (l < 470 ? .75 : 1)],
  cyan: ['Phthalo cyan', (l) => .04 + .62 * g(l, 482, 42, 40) + .05 * sig(l, 700, 10)],
  blue: ['Ultramarine', (l) => .04 + .5 * g(l, 448, 24, 30) + .3 * sig(l, 690, 10)],
  green: ['Viridian', (l) => .04 + .42 * g(l, 512, 30, 36)],
  sienna: ['Burnt sienna', (l) => .07 + .38 * sig(l, 585, 14)],
  white: ['Titanium white', () => .9],
  black: ['Ivory black', () => .035],
};
export const pigment = (id: string) => spec((PIGMENTS[id] ?? PIGMENTS.white)[1]);
/** Kubelka-Munk single-constant mixing: absorption/scattering ratios add in proportion to the amounts */
export function kmMix(rs: Spec[], w?: number[]): Spec {
  const ws = w ?? rs.map(() => 1 / rs.length);
  return spec(() => 0).map((_, i) => {
    let ks = 0; rs.forEach((r, j) => { const R = clamp(r[i], .001, .999); ks += ws[j] * (1 - R) ** 2 / (2 * R); });
    return 1 + ks - Math.sqrt(ks * ks + 2 * ks);
  }) as Spec;
}
/** a pair of reflectances with the same XYZ under illuminant I but different spectra */
export function metamers(seed: number, I = ILLUM.d65): [Spec, Spec] {
  const R = rng(seed), hue = 440 + R() * 220, A = spec((l) => .3 + .3 * g(l, hue, 60, 60) + .05 * Math.sin(l / 37));
  const ph = [R() * 6, R() * 6, R() * 6], f = spec((l) => Math.sin(l / 18 + ph[0]) + .8 * Math.sin(l / 11 + ph[1]) + .6 * Math.sin(l / 27 + ph[2]));
  /* remove from f everything the eye can see under I: what is left is a "metameric black" */
  const W = [0, 1, 2].map((k) => spec(() => 0).map((_, i) => I[i] * CMF[i][k]) as Spec);
  const G = W.map((a) => W.map((b) => a.reduce((s, v, i) => s + v * b[i], 0))), Gi = inv3(G), wf = W.map((a) => a.reduce((s, v, i) => s + v * f[i], 0)), co = mm(Gi, wf);
  const b = f.map((v, i) => v - co[0] * W[0][i] - co[1] * W[1][i] - co[2] * W[2][i]) as Spec;
  let s = 1e9; for (let i = 0; i < N; i++) { if (b[i] > 0) s = Math.min(s, (.97 - A[i]) / b[i]); if (b[i] < 0) s = Math.min(s, (A[i] - .03) / -b[i]); }
  return [A, A.map((v, i) => v + b[i] * s * .98) as Spec];
}

/* ---------- the world ---------- */
type Mode = 'lights' | 'paints' | 'meta';
interface Lamp { peak: number; width: number; power: number }
interface Cfg { mode: Mode; lamps: Lamp[]; paints: string[]; illum: string; vision: string; adapt: boolean; seed: number; pos: [number, number][] }
const DEF: Cfg = { mode: 'lights', lamps: [{ peak: 612, width: 22, power: .64 }, { peak: 542, width: 24, power: .84 }, { peak: 455, width: 18, power: 1 }], paints: ['cyan', 'magenta', 'yellow'], illum: 'd65', vision: 'normal', adapt: true, seed: 7, pos: [[.38, .4], [.62, .4], [.5, .64]] };
interface Reg { s: number[]; c: number[]; sp: Spec }
/* the analytic fit is poor below about 410 nm where the eye is almost blind, so the locus is drawn from 415 nm */
const LOCUS = lam.filter((l) => l >= 415 && l <= 700).map((l) => chroma(cmf(l)));

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(560px, 62vw, 680px)';
  const S = canvas(L.view, t('cv', 'Colour wall with overlapping lights or paints, a chromaticity diagram and the spectrum of each colour.'), { alpha: false });
  const st = store<Cfg>(ctx.id, 'cfg', DEF, (v) => typeof v === 'object' && v !== null && 'mode' in v);
  const cfg: Cfg = { ...DEF, ...st.get() }; if (!Array.isArray(cfg.pos) || cfg.pos.length !== 3) cfg.pos = DEF.pos.map((p) => [...p] as [number, number]);
  const save = () => st.set(cfg);

  heading(L.panel, t('modeh', 'Experiment'));
  const modeSeg = seg(L.panel, t('model', 'Mix'), [['lights', t('m.lights', 'Lights')], ['paints', t('m.paints', 'Paints')], ['meta', t('m.meta', 'Metamers')]], cfg.mode, (v) => { cfg.mode = v as Mode; save(); build(); draw(); });
  void modeSeg;
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  heading(L.panel, t('seeh', 'Seen by'));
  seg(L.panel, t('visl', 'Colour vision'), [['normal', t('v.normal', 'Typical')], ['protan', t('v.protan', 'Protanopia')], ['deutan', t('v.deutan', 'Deuteranopia')], ['tritan', t('v.tritan', 'Tritanopia')]], cfg.vision, (v) => { cfg.vision = v; save(); draw(); });
  const visNote = note(L.panel, '');
  const out = stats(L.panel, [['a', t('st.a', 'Colour A')], ['b', t('st.b', 'Colour B')], ['mix', t('st.mix', 'Mixture')], ['xy', t('st.xy', 'Chromaticity x, y')]]);
  const gamutNote = note(L.panel, '');

  const ABOUT: Record<Mode, string> = {
    lights: t('a.lights', 'Each lamp shines a band of wavelengths. Where beams overlap their spectra add, so red and green light make yellow, and all three make white. Drag the circles; shape each lamp\'s spectrum below.'),
    paints: t('a.paints', 'Each paint reflects some wavelengths and absorbs the rest. Mixed paints absorb what either absorbs (Kubelka-Munk mixing), so cyan and yellow make green and everything heads toward dark. Change the light to see the same paints shift.'),
    meta: t('a.meta', 'Two paints with different spectra can send the same signal to your three cone types, so they look identical. Change the light and the match can break. Fabric and car-paint makers check colours under several lights for exactly this reason.'),
  };
  const VIS: Record<string, string> = {
    normal: t('vn.normal', 'Three cone types (L, M, S), as in most people.'),
    protan: t('vn.protan', 'No working L (red) cones. About 1% of men. Reds look dark and are confused with greens.'),
    deutan: t('vn.deutan', 'No working M (green) cones. About 1% of men, and milder forms affect around 5%. Red and green are confused.'),
    tritan: t('vn.tritan', 'No working S (blue) cones. Rare, about 1 in 10,000. Blue and green, and yellow and violet, are confused.'),
  };
  const ILN: [string, string][] = [['d65', t('i.d65', 'Daylight')], ['inc', t('i.inc', 'Incandescent bulb')], ['led', t('i.led', 'White LED')]];
  function build() {
    box.replaceChildren(); about.textContent = ABOUT[cfg.mode];
    if (cfg.mode === 'lights') {
      buttons(box, [[t('pr.rgb', 'RGB lamps'), () => { cfg.lamps = DEF.lamps.map((l) => ({ ...l })); save(); build(); draw(); }], [t('pr.comp', 'Two lamps make white'), () => { cfg.lamps = [{ peak: 580, width: 14, power: .61 }, { peak: 481, width: 12, power: 1 }, { peak: 540, width: 30, power: 0 }]; save(); build(); draw(); }]]);
      const NM = [t('lamp1', 'Lamp 1'), t('lamp2', 'Lamp 2'), t('lamp3', 'Lamp 3')];
      cfg.lamps.forEach((lp, i) => {
        heading(box, NM[i]);
        range(box, t('peak', 'Peak wavelength'), { min: 400, max: 700, value: lp.peak, fmt: (v) => `${v} nm` }, (v) => { lp.peak = v; save(); draw(); });
        range(box, t('bw', 'Band width'), { min: 4, max: 120, value: lp.width, fmt: (v) => `${v} nm` }, (v) => { lp.width = v; save(); draw(); });
        range(box, t('pow', 'Brightness'), { min: 0, max: 1, step: .02, value: lp.power, fmt: (v) => `${Math.round(v * 100)}%` }, (v) => { lp.power = v; save(); draw(); });
      });
    } else {
      seg(box, t('illl', 'Light'), ILN, cfg.illum, (v) => { cfg.illum = v; save(); draw(); });
      check(box, t('adapt', 'Let my eyes adapt to the light'), cfg.adapt, (v) => { cfg.adapt = v; save(); draw(); });
      if (cfg.mode === 'paints') {
        const opts = Object.keys(PIGMENTS).map((k) => [k, t('pg.' + k, PIGMENTS[k][0])] as [string, string]);
        [0, 1, 2].forEach((i) => {
          const sel = h('select', { 'aria-label': `${t('paint', 'Paint')} ${i + 1}` }) as HTMLSelectElement;
          for (const [v, n] of opts) sel.append(h('option', { value: v, text: n }));
          sel.value = cfg.paints[i]; sel.addEventListener('change', () => { cfg.paints[i] = sel.value; save(); draw(); });
          box.append(h('label', { class: 'wk-r' }, h('span', { text: `${t('paint', 'Paint')} ${i + 1}` }), sel));
        });
      } else buttons(box, [[t('newpair', 'New pair'), () => { cfg.seed = (Math.random() * 1e6) | 0; save(); draw(); }, true]]);
    }
  }

  /* ---------- geometry and colour of each region ---------- */
  function areas() {
    const W = S.w, H = S.h, wide = W > 720;
    const wall = wide ? { x: 0, y: 0, w: W * .58, h: H } : { x: 0, y: 0, w: W, h: H * .52 };
    const side = wide ? { x: W * .58, y: 0, w: W * .42, h: H } : { x: 0, y: H * .52, w: W, h: H * .48 };
    const dia = wide ? { x: side.x + 16, y: 58, w: side.w - 32, h: side.h * .5 - 58 } : { x: 10, y: side.y + 10, w: W * .48 - 14, h: side.h - 20 };
    const spc = wide ? { x: side.x + 16, y: side.h * .5 + 26, w: side.w - 32, h: side.h * .5 - 52 } : { x: W * .5 + 4, y: side.y + 10, w: W * .5 - 14, h: side.h - 20 };
    return { wall, dia, spc };
  }
  /** colour (in XYZ, white Y = 1) of a region lit or painted by the members of `set` */
  function regionXYZ(set: number[]): { c: number[]; sp: Spec } {
    if (cfg.mode === 'lights') {
      const s = spec(() => 0); for (const i of set) { const lp = cfg.lamps[i], q = lamp(lp.peak, lp.width, lp.power); for (let k = 0; k < N; k++) s[k] += q[k]; }
      return { c: xyz(s), sp: s };
    }
    const I = ILLUM[cfg.illum] ?? ILLUM.d65, R = set.length ? (cfg.mode === 'paints' ? (set.length === 1 ? pigment(cfg.paints[set[0]]) : kmMix(set.map((i) => pigment(cfg.paints[i])))) : metamers(cfg.seed)[set[0]]) : spec(() => .9);
    let c: number[] = surface(R, I);
    if (cfg.adapt && cfg.illum !== 'd65') c = adapt(c, surface(spec(() => 1), I), surface(spec(() => 1), ILLUM.d65));
    return { c, sp: R };
  }
  let exposure = 1;
  function show(c: number[]) { return toRGB(c.map((v) => v * exposure), cfg.vision); }

  function draw() {
    const G = S.g, W = S.w, H = S.h, A = areas();
    const dark = cfg.mode === 'lights';
    G.fillStyle = dark ? '#09090d' : '#efece4'; G.fillRect(0, 0, W, H);
    const r = Math.min(A.wall.w, A.wall.h) * (cfg.mode === 'meta' ? .3 : .24), cx = (i: number) => A.wall.x + cfg.pos[i][0] * A.wall.w, cy = (i: number) => A.wall.y + cfg.pos[i][1] * A.wall.h;
    const subsets: number[][] = cfg.mode === 'meta' ? [[0], [1]] : [[0], [1], [2], [0, 1], [0, 2], [1, 2], [0, 1, 2]];
    const regs: Reg[] = subsets.map((s) => ({ s, ...regionXYZ(s) }));
    /* lights: auto-exposure like a camera, so the brightest overlap is just white */
    exposure = 1; if (dark) { const mY = Math.max(...regs.map((q) => mm(XYZ2RGB, q.c).reduce((a, b) => Math.max(a, b), 0))); exposure = mY > 0 ? .98 / mY : 1; }
    let anyOut = false;
    if (cfg.mode === 'meta') {
      /* two big swatches side by side, the background is the paper under the same light */
      const bg = show(regionXYZ([]).c).rgb; G.fillStyle = hex(bg); G.fillRect(A.wall.x, A.wall.y, A.wall.w, A.wall.h);
      const ww = A.wall.w * .36, hh = A.wall.h * .5, y = A.wall.y + A.wall.h * .25;
      regs.forEach((q, i) => { const c = show(q.c); anyOut ||= c.out; G.fillStyle = hex(c.rgb); G.fillRect(A.wall.x + A.wall.w * (.1 + i * .44), y, ww, hh); G.fillStyle = 'rgba(0,0,0,.65)'; G.font = '600 13px system-ui, sans-serif'; G.textAlign = 'center'; G.fillText(i ? 'B' : 'A', A.wall.x + A.wall.w * (.1 + i * .44) + ww / 2, y + hh + 20); });
      const la = lab(regs[0].c, [.9505, 1, 1.089]), lb = lab(regs[1].c, [.9505, 1, 1.089]), d = dE(la, lb);
      G.fillStyle = 'rgba(20,20,20,.8)'; G.font = '600 14px system-ui, sans-serif'; G.textAlign = 'center';
      G.fillText(`ΔE ${d.toFixed(1)}: ${d < 1 ? t('de.same', 'identical to the eye') : d < 3 ? t('de.close', 'barely different') : t('de.diff', 'clearly different')}`, A.wall.x + A.wall.w / 2, A.wall.y + A.wall.h * .16 + 20);
      out('a', hex(show(regs[0].c).rgb)); out('b', hex(show(regs[1].c).rgb)); out('mix', '—');
    } else {
      for (const q of regs) {
        G.save();
        /* clip to the intersection of the circles in this subset */
        for (const i of q.s) { G.beginPath(); G.arc(cx(i), cy(i), r, 0, Math.PI * 2); G.clip(); }
        const c = show(q.c); anyOut ||= c.out; G.fillStyle = hex(c.rgb);
        if (dark && q.s.length === 1) { G.shadowColor = hex(c.rgb); G.shadowBlur = 30; }
        G.fillRect(A.wall.x, A.wall.y, A.wall.w, A.wall.h); G.restore();
      }
      G.strokeStyle = dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.2)'; G.lineWidth = 1;
      for (let i = 0; i < 3; i++) { G.beginPath(); G.arc(cx(i), cy(i), r, 0, Math.PI * 2); G.stroke(); }
      out('a', hex(show(regs[0].c).rgb)); out('b', hex(show(regs[1].c).rgb)); out('mix', hex(show(regs[6].c).rgb));
    }
    drawDiagram(G, A.dia, regs, dark);
    drawSpectra(G, A.spc, regs, dark);
    const mix = cfg.mode === 'meta' ? regs[0] : regs[regs.length - 1], xy = chroma(mix.c);
    out('xy', `${xy[0].toFixed(3)}, ${xy[1].toFixed(3)}`);
    gamutNote.textContent = anyOut ? t('gamut', 'Some colours here lie outside what an sRGB screen can show; they are drawn as the nearest colour it can.') : '';
    visNote.textContent = VIS[cfg.vision] ?? '';
  }
  /* chromaticity diagram: the horseshoe of pure spectral colours, the sRGB triangle and our colours */
  let diaCache: { key: string; img: HTMLCanvasElement } | null = null;
  function drawDiagram(G: CanvasRenderingContext2D, R: { x: number; y: number; w: number; h: number }, regs: Reg[], dark: boolean) {
    const sz = Math.min(R.w, R.h * 1.1), ox = R.x + (R.w - sz) / 2, oy = R.y, X = (x: number) => ox + x / .8 * sz, Y = (y: number) => oy + (.9 - y) / .9 * R.h;
    const key = `${Math.round(sz)}|${Math.round(R.h)}|${cfg.vision}`;
    if (!diaCache || diaCache.key !== key) {
      const c = document.createElement('canvas'), w = Math.max(1, Math.round(sz / 2)), hh = Math.max(1, Math.round(R.h / 2)); c.width = w; c.height = hh;
      const cg = c.getContext('2d')!, img = cg.createImageData(w, hh);
      for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
        const x = i / w * .8, y = .9 - j / hh * .9; if (y <= 0 || !inLocus(x, y)) continue;
        const Yv = .42, XYZ = [x / y * Yv, Yv, (1 - x - y) / y * Yv], rgb = mm(XYZ2RGB, XYZ), m = Math.max(...rgb.map((v) => Math.max(0, v)));
        const k = toRGB(mm(inv3(XYZ2RGB), rgb.map((v) => Math.max(0, v) / (m || 1))), cfg.vision).rgb, p = (j * w + i) * 4;
        img.data[p] = k[0]; img.data[p + 1] = k[1]; img.data[p + 2] = k[2]; img.data[p + 3] = 235;
      }
      cg.putImageData(img, 0, 0); diaCache = { key, img: c };
    }
    G.save(); G.drawImage(diaCache.img, ox, oy, sz, R.h);
    G.strokeStyle = dark ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.55)'; G.lineWidth = 1.2; G.beginPath(); LOCUS.forEach(([x, y], i) => (i ? G.lineTo(X(x), Y(y)) : G.moveTo(X(x), Y(y)))); G.closePath(); G.stroke();
    G.setLineDash([4, 3]); G.beginPath(); G.moveTo(X(.64), Y(.33)); G.lineTo(X(.30), Y(.60)); G.lineTo(X(.15), Y(.06)); G.closePath(); G.stroke(); G.setLineDash([]);
    G.fillStyle = dark ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.7)'; G.font = '10px system-ui, sans-serif'; G.textAlign = 'left';
    for (const l of [460, 490, 520, 560, 600]) { const [x, y] = chroma(cmf(l)); G.fillText(`${l}`, X(x) + (l < 500 ? -24 : 5), Y(y) + (l < 500 ? 0 : -2)); }
    G.fillText('sRGB', X(.33), Y(.38)); G.fillText(t('dia', 'CIE 1931 chromaticity'), ox, oy + 10);
    for (const q of regs) {
      const s = q.c[0] + q.c[1] + q.c[2]; if (s <= 1e-9) continue; const [x, y] = chroma(q.c), big = q.s.length > 1;
      G.beginPath(); G.arc(X(x), Y(y), big ? 5.5 : 4, 0, Math.PI * 2); G.fillStyle = hex(show(q.c).rgb); G.fill(); G.strokeStyle = dark ? '#fff' : '#111'; G.lineWidth = big ? 2 : 1.2; G.stroke();
    }
    G.restore();
  }
  function inLocus(x: number, y: number) { let ins = false; for (let i = 0, j = LOCUS.length - 1; i < LOCUS.length; j = i++) { const [xi, yi] = LOCUS[i], [xj, yj] = LOCUS[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
  function drawSpectra(G: CanvasRenderingContext2D, R: { x: number; y: number; w: number; h: number }, regs: Reg[], dark: boolean) {
    const X = (l: number) => R.x + (l - L0) / (L1 - L0) * R.w, Y = (v: number) => R.y + R.h - 14 - v * (R.h - 30);
    G.save();
    for (let l = L0; l < L1; l += 2) { const c = toRGB(cmf(l).map((v) => v * .6), cfg.vision).rgb; G.fillStyle = hex(c); G.fillRect(X(l), R.y + R.h - 10, X(l + 2) - X(l) + .5, 8); }
    G.strokeStyle = dark ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.25)'; G.lineWidth = 1; G.beginPath(); G.moveTo(R.x, Y(0)); G.lineTo(R.x + R.w, Y(0)); G.stroke();
    G.fillStyle = dark ? 'rgba(255,255,255,.75)' : 'rgba(0,0,0,.7)'; G.font = '10px system-ui, sans-serif'; G.textAlign = 'center';
    for (const l of [400, 500, 600, 700]) G.fillText(`${l} nm`, X(l), R.y + R.h + 4);
    G.textAlign = 'left'; G.fillText(cfg.mode === 'lights' ? t('sp.light', 'Light spectrum (power)') : t('sp.refl', 'Reflectance (share of light returned)'), R.x, R.y + 4);
    const curves: { s: Spec; c: string; w: number }[] = [];
    const singles = cfg.mode === 'meta' ? regs.slice(0, 2) : regs.slice(0, 3);
    singles.forEach((q) => curves.push({ s: q.sp, c: hex(show(q.c).rgb), w: 2 }));
    if (cfg.mode !== 'meta') curves.push({ s: regs[regs.length - 1].sp, c: dark ? '#ffffff' : '#111111', w: 2.6 });
    const mx = cfg.mode === 'lights' ? Math.max(1e-9, ...curves.map((c) => Math.max(...c.s))) : 1;
    if (cfg.mode !== 'lights') { const I = ILLUM[cfg.illum] ?? ILLUM.d65, im = Math.max(...I); G.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.3)'; G.setLineDash([3, 3]); G.beginPath(); lam.forEach((l, i) => (i ? G.lineTo(X(l), Y(I[i] / im)) : G.moveTo(X(l), Y(I[i] / im)))); G.stroke(); G.setLineDash([]); }
    for (const c of curves) { G.strokeStyle = c.c; G.lineWidth = c.w; G.beginPath(); lam.forEach((l, i) => (i ? G.lineTo(X(l), Y(c.s[i] / mx)) : G.moveTo(X(l), Y(c.s[i] / mx)))); G.stroke(); }
    G.restore();
  }

  /* drag the circles */
  let drag = -1;
  S.cv.addEventListener('pointerdown', (e) => {
    if (cfg.mode === 'meta') return; const p = local(e, S.cv), A = areas(), r = Math.min(A.wall.w, A.wall.h) * .24;
    for (let i = 2; i >= 0; i--) if (Math.hypot(p.x - (A.wall.x + cfg.pos[i][0] * A.wall.w), p.y - (A.wall.y + cfg.pos[i][1] * A.wall.h)) < r) { drag = i; S.cv.setPointerCapture(e.pointerId); S.cv.style.touchAction = 'none'; break; }
  });
  S.cv.addEventListener('pointermove', (e) => { if (drag < 0) return; const p = local(e, S.cv), A = areas(); cfg.pos[drag] = [clamp((p.x - A.wall.x) / A.wall.w, .1, .9), clamp((p.y - A.wall.y) / A.wall.h, .12, .88)]; draw(); });
  const up = () => { if (drag >= 0) save(); drag = -1; S.cv.style.touchAction = 'pan-y'; };
  S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up); S.cv.style.touchAction = 'pan-y';
  S.onResize(draw);
  build(); draw();
}
