/* 042 Chemistry Visual Lab: Reaction Workbench. Type any chemical equation (parentheses, hydrates like
   CuSO4·5H2O and brackets work) and it is balanced exactly: each element gives one equation, and the
   coefficients are the integer null space of that matrix, found with fraction-exact Gaussian elimination.
   Then watch it happen: every atom of the reactants flies to its place in the products, so you can see
   that nothing is created or lost. Molar masses use IUPAC standard atomic weights; enter grams of each
   reactant to find the limiting reagent and the theoretical yield of every product. */
import { type Ctx, h, layout, canvas, heading, note, buttons, stats, loop, clamp } from './kit';

/* ---------- data: standard atomic weights (IUPAC, abridged); [n] = mass number of the longest-lived isotope ---------- */
const AW_SRC = 'H 1.008 He 4.0026 Li 6.94 Be 9.0122 B 10.81 C 12.011 N 14.007 O 15.999 F 18.998 Ne 20.180 Na 22.990 Mg 24.305 Al 26.982 Si 28.085 P 30.974 S 32.06 Cl 35.45 Ar 39.95 K 39.098 Ca 40.078 Sc 44.956 Ti 47.867 V 50.942 Cr 51.996 Mn 54.938 Fe 55.845 Co 58.933 Ni 58.693 Cu 63.546 Zn 65.38 Ga 69.723 Ge 72.630 As 74.922 Se 78.971 Br 79.904 Kr 83.798 Rb 85.468 Sr 87.62 Y 88.906 Zr 91.224 Nb 92.906 Mo 95.95 Tc [98] Ru 101.07 Rh 102.91 Pd 106.42 Ag 107.87 Cd 112.41 In 114.82 Sn 118.71 Sb 121.76 Te 127.60 I 126.90 Xe 131.29 Cs 132.91 Ba 137.33 La 138.91 Ce 140.12 Pr 140.91 Nd 144.24 Pm [145] Sm 150.36 Eu 151.96 Gd 157.25 Tb 158.93 Dy 162.50 Ho 164.93 Er 167.26 Tm 168.93 Yb 173.05 Lu 174.97 Hf 178.49 Ta 180.95 W 183.84 Re 186.21 Os 190.23 Ir 192.22 Pt 195.08 Au 196.97 Hg 200.59 Tl 204.38 Pb 207.2 Bi 208.98 Po [209] At [210] Rn [222] Fr [223] Ra [226] Ac [227] Th 232.04 Pa 231.04 U 238.03 Np [237] Pu [244] Am [243] Cm [247] Bk [247] Cf [251] Es [252] Fm [257] Md [258] No [259] Lr [266] Rf [267] Db [268] Sg [269] Bh [270] Hs [269] Mt [278] Ds [281] Rg [282] Cn [285] Nh [286] Fl [289] Mc [290] Lv [293] Ts [294] Og [294]';
export const AW: Record<string, number> = {};
{ const a = AW_SRC.split(' '); for (let i = 0; i < a.length; i += 2) AW[a[i]] = parseFloat(a[i + 1].replace(/[[\]]/g, '')); }
/* CPK colours as used by Jmol */
const CPK: Record<string, string> = { H: '#ffffff', C: '#909090', N: '#3050f8', O: '#ff0d0d', F: '#90e050', Cl: '#1ff01f', Br: '#a62929', I: '#940094', S: '#ffff30', P: '#ff8000', Na: '#ab5cf2', K: '#8f40d4', Ca: '#3dff00', Mg: '#8aff00', Fe: '#e06633', Cu: '#c88033', Al: '#bfa6a6', Si: '#f0c8a0', Zn: '#7d80b0', Mn: '#9c7ac7', Ag: '#c0c0c0', Au: '#ffd123', Li: '#cc80ff', Ba: '#00c900', Pb: '#575961', Hg: '#b8b8d0', Cr: '#8a99c7', Ni: '#50d050', Co: '#f090a0', B: '#ffb5b5', He: '#d9ffff', Ne: '#b3e3f5', Ar: '#80d1e3', Ti: '#bfc2c7', Sn: '#668080', U: '#008fff' };
const col = (el: string) => CPK[el] ?? '#ff1493';

/* ---------- formula parser ---------- */
export type Counts = Record<string, number>;
export function parseFormula(src: string): Counts {
  const s = src.replace(/\s+/g, '').replace(/[·•*]/g, '.');
  if (!s) throw new Error('empty');
  /* hydrates: parts joined by dots, each with an optional leading multiplier */
  const total: Counts = {};
  s.split('.').forEach((part, i) => {
    if (!part) throw new Error('dot');
    const m = i > 0 ? /^(\d+)(.+)$/.exec(part) : null, mult = m ? +m[1] : 1, body = m ? m[2] : part;
    const c = parseGroup(body); for (const k in c) total[k] = (total[k] || 0) + c[k] * mult;
  });
  return total;
}
function parseGroup(s: string): Counts {
  let i = 0;
  const num = () => { let n = ''; while (i < s.length && /\d/.test(s[i])) n += s[i++]; return n ? +n : 1; };
  const group = (close?: string): Counts => {
    const c: Counts = {};
    while (i < s.length) {
      const ch = s[i];
      if (ch === '(' || ch === '[') { i++; const inner = group(ch === '(' ? ')' : ']'); const n = num(); for (const k in inner) c[k] = (c[k] || 0) + inner[k] * n; }
      else if (ch === ')' || ch === ']') { if (ch !== close) throw new Error('bracket'); i++; return c; }
      else if (/[A-Z]/.test(ch)) { let el = ch; i++; if (i < s.length && /[a-z]/.test(s[i])) el += s[i++]; if (!(el in AW)) throw new Error('element ' + el); const n = num(); c[el] = (c[el] || 0) + n; }
      else throw new Error('char ' + ch);
    }
    if (close) throw new Error('bracket');
    return c;
  };
  const r = group(); if (!Object.keys(r).length) throw new Error('empty'); return r;
}
export const molarMass = (c: Counts) => Object.entries(c).reduce((m, [el, n]) => m + AW[el] * n, 0);

/* ---------- exact balancing ---------- */
type Q = [bigint, bigint]; // numerator, denominator (denominator > 0)
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const q = (n: bigint, d = 1n): Q => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const qsub = (a: Q, b: Q): Q => q(a[0] * b[1] - b[0] * a[1], a[1] * b[1]);
const qmul = (a: Q, b: Q): Q => q(a[0] * b[0], a[1] * b[1]);
const qdiv = (a: Q, b: Q): Q => q(a[0] * b[1], a[1] * b[0]);
export type Species = { text: string; counts: Counts };
export type Balanced = { ok: true; coef: number[] } | { ok: false; why: 'impossible' | 'many' };
/** coefficients for reactants then products, smallest whole numbers */
export function balance(left: Species[], right: Species[]): Balanced {
  const sp = [...left, ...right], els = [...new Set(sp.flatMap((s) => Object.keys(s.counts)))], n = sp.length;
  const M: Q[][] = els.map((el) => sp.map((s, j) => q(BigInt((s.counts[el] || 0) * (j < left.length ? 1 : -1)))));
  /* reduced row echelon form */
  let row = 0; const piv: number[] = [];
  for (let c = 0; c < n && row < M.length; c++) {
    let p = row; while (p < M.length && M[p][c][0] === 0n) p++;
    if (p === M.length) continue;
    [M[row], M[p]] = [M[p], M[row]];
    const pv = M[row][c]; M[row] = M[row].map((x) => qdiv(x, pv));
    for (let r = 0; r < M.length; r++) if (r !== row && M[r][c][0] !== 0n) { const f = M[r][c]; M[r] = M[r].map((x, k) => qsub(x, qmul(f, M[row][k]))); }
    piv.push(c); row++;
  }
  const free = [...Array(n).keys()].filter((c) => !piv.includes(c));
  if (free.length === 0) return { ok: false, why: 'impossible' };
  if (free.length > 1) return { ok: false, why: 'many' };
  const f = free[0], v: Q[] = Array.from({ length: n }, () => q(0n)); v[f] = q(1n);
  piv.forEach((c, r) => { v[c] = q(-M[r][f][0], M[r][f][1]); });
  let L = 1n; for (const x of v) L = L / gcd(L, x[1]) * x[1];
  let ints = v.map((x) => x[0] * (L / x[1]));
  if (ints.every((x) => x <= 0n)) ints = ints.map((x) => -x);
  if (ints.some((x) => x <= 0n)) return { ok: false, why: 'impossible' };
  let G = 0n; for (const x of ints) G = gcd(G, x);
  return { ok: true, coef: ints.map((x) => Number(x / G)) };
}
export function parseEquation(src: string) {
  const sides = src.split(/\s*(?:->|→|=>|⇌|<=>|=)\s*/);
  if (sides.length !== 2) throw new Error('arrow');
  const side = (s: string) => s.split(/\s+\+\s+|\s*\+\s*(?=[A-Z([\d])/).map((x) => x.trim()).filter(Boolean).map((x) => { const t = x.replace(/^\d+\s*/, ''); return { text: t, counts: parseFormula(t) }; });
  const l = side(sides[0]), r = side(sides[1]);
  if (!l.length || !r.length) throw new Error('side');
  return { l, r };
}
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const pretty = (f: string) => f.replace(/\./g, '·').replace(/(?<=[A-Za-z)\]])\d+/g, (d) => d.split('').map((c) => SUB[+c]).join(''));

/* ---------- the world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#6fd3d0');
  L.view.style.background = '#070b0d';
  L.view.style.minHeight = 'clamp(380px, 58vw, 600px)';
  const S = canvas(L.view, t('cv', 'Animation of the reaction: each atom moves from the reactants on the left to the products on the right.'));
  const say = (s: string) => { L.hud.textContent = s; };

  const PRE: [string, string][] = [
    [t('r.ch4', 'Burning methane'), 'CH4 + O2 -> CO2 + H2O'], [t('r.c3h8', 'Burning propane'), 'C3H8 + O2 -> CO2 + H2O'],
    [t('r.photo', 'Photosynthesis'), 'CO2 + H2O -> C6H12O6 + O2'], [t('r.rust', 'Rusting iron'), 'Fe + O2 -> Fe2O3'],
    [t('r.haber', 'Making ammonia'), 'N2 + H2 -> NH3'], [t('r.therm', 'Thermite'), 'Al + Fe2O3 -> Al2O3 + Fe'],
    [t('r.soda', 'Baking soda and vinegar'), 'NaHCO3 + CH3COOH -> CH3COONa + H2O + CO2'], [t('r.blue', 'Heating blue vitriol'), 'CuSO4·5H2O -> CuSO4 + H2O'],
    [t('r.kmno4', 'Permanganate and acid'), 'KMnO4 + HCl -> KCl + MnCl2 + H2O + Cl2'], [t('r.lime', 'Limewater test'), 'Ca(OH)2 + CO2 -> CaCO3 + H2O'],
  ];
  heading(L.panel, t('eqh', 'Equation'));
  const inp = h('input', { type: 'text', value: PRE[1][1], spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', 'aria-label': t('eq', 'Chemical equation') }) as HTMLInputElement;
  L.panel.append(h('label', { class: 'wk-r' }, h('span', { text: t('eqlab', 'Type an equation, for example C3H8 + O2 -> CO2 + H2O') }), inp));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
  buttons(L.panel, [[t('bal', 'Balance and react'), () => run(), true], [t('replay', 'Replay'), () => { T = 0; }]]);
  const out = h('p', { class: 'wk-out', style: { fontSize: '17px', lineHeight: '1.5', margin: '0', color: 'var(--bone)', overflowWrap: 'anywhere' }, 'aria-live': 'polite' }); L.panel.append(out);
  heading(L.panel, t('preh', 'Try a reaction'));
  const prow = h('div', { class: 'wk-row' }); for (const [n, eq] of PRE) prow.append(h('button', { type: 'button', class: 'wk-b', text: n, onclick: () => { inp.value = eq; run(); } })); L.panel.append(prow);
  heading(L.panel, t('cnth', 'Atoms on each side'));
  const tbl = h('div', { style: { display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 14px', fontSize: '13px', fontFamily: 'var(--mono,ui-monospace,monospace)' } }); L.panel.append(tbl);
  heading(L.panel, t('stoh', 'Masses and yield'));
  const sto = h('div', { style: { display: 'grid', gap: '8px' } }); L.panel.append(sto);
  const info = stats(L.panel, [['lim', t('lim', 'Limiting reactant')], ['mass', t('mass', 'Mass in = mass out')]]);
  note(L.panel, t('n.chem', 'Balancing: every element must appear the same number of times on both sides, which gives one equation per element. The smallest whole-number solution is found exactly, without rounding. Masses use standard atomic weights; numbers in brackets would be the mass number of the most stable isotope for elements with no stable form. Yields are theoretical: real reactions rarely reach 100 %.'));

  type Atom = { el: string; ax: number; ay: number; bx: number; by: number; delay: number; pm: number };
  let atoms: Atom[] = [], eqn: ReturnType<typeof parseEquation> | null = null, coef: number[] = [], T = 0, tooMany = false;
  let molR: { x: number; y: number; atoms: number[] }[] = [], molP: { x: number; y: number; atoms: number[] }[] = [];
  const grams: number[] = [];

  function run() {
    let e: ReturnType<typeof parseEquation>;
    try { e = parseEquation(inp.value); }
    catch (err) {
      const m = String((err as Error).message);
      out.textContent = m === 'arrow' ? t('e.arrow', 'Use one arrow (-> or =) between the two sides.') : m.startsWith('element') ? t('e.el', 'Unknown element:') + ' ' + m.slice(8) + ' ' + t('e.case', '(check capital letters, for example Co is cobalt but CO is carbon monoxide)') : t('e.parse', 'Could not read that formula. Check brackets and spelling.');
      eqn = null; atoms = []; tbl.textContent = ''; sto.textContent = ''; info('lim', '—'); info('mass', '—'); return;
    }
    const b = balance(e.l, e.r);
    if (!b.ok) { out.textContent = b.why === 'many' ? t('e.many', 'This is really two or more reactions mixed together, so there is no single balance. Split it up.') : t('e.imp', 'This cannot be balanced: some element is missing on one side.'); eqn = null; atoms = []; tbl.textContent = ''; sto.textContent = ''; info('lim', '—'); info('mass', '—'); return; }
    eqn = e; coef = b.coef;
    const side = (list: Species[], off: number) => list.map((s, i) => (coef[off + i] > 1 ? coef[off + i] + ' ' : '') + pretty(s.text)).join(' + ');
    out.textContent = side(e.l, 0) + ' → ' + side(e.r, e.l.length);
    /* atom table */
    tbl.textContent = ''; tbl.append(h('b', { text: '' }), h('b', { text: t('left', 'Left') }), h('b', { text: t('right', 'Right') }));
    const els = [...new Set([...e.l, ...e.r].flatMap((s) => Object.keys(s.counts)))];
    for (const el of els) {
      const cnt = (list: Species[], off: number) => list.reduce((a, s, i) => a + (s.counts[el] || 0) * coef[off + i], 0);
      tbl.append(h('span', {}, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: col(el), marginInlineEnd: '6px' } }), el), h('span', { text: String(cnt(e.l, 0)) }), h('span', { text: String(cnt(e.r, e.l.length)) + ' ✓' }));
    }
    /* stoichiometry inputs, default: 10 g of each reactant */
    grams.length = 0; sto.textContent = '';
    e.l.forEach((s, i) => {
      grams[i] = 10; const mm = molarMass(s.counts);
      const box = h('input', { type: 'number', min: 0, step: .1, value: '10' }) as HTMLInputElement;
      box.addEventListener('input', () => { const v = +box.value; grams[i] = Number.isFinite(v) && v >= 0 ? v : 0; yieldCalc(); });
      sto.append(h('label', { class: 'wk-r' }, h('span', { text: `${pretty(s.text)} · ${mm.toFixed(2)} g/mol · ${t('grams', 'grams you have')}` }), box));
    });
    const yl = h('div', { class: 'wk-yield', style: { display: 'grid', gap: '4px', fontSize: '13px' } }); sto.append(yl);
    yieldCalc();
    build();
    T = 0; say(t('watch', 'Watch the atoms: none appear and none disappear.'));
  }
  function yieldCalc() {
    if (!eqn) return; const e = eqn, yl = sto.querySelector('.wk-yield') as HTMLElement;
    const ext = e.l.map((s, i) => grams[i] / molarMass(s.counts) / coef[i]); // moles of "reaction" each reactant allows
    const x = Math.min(...ext), li = ext.indexOf(x);
    info('lim', ext.every((v) => Math.abs(v - x) < 1e-12) ? t('none', 'none, exact amounts') : pretty(e.l[li].text));
    yl.textContent = '';
    let mIn = 0, mOut = 0;
    e.l.forEach((s, i) => { const used = x * coef[i] * molarMass(s.counts); mIn += used; if (grams[i] - used > 1e-9) yl.append(h('span', { text: `${pretty(s.text)}: ${(grams[i] - used).toFixed(2)} g ${t('left2', 'left over')}` })); });
    e.r.forEach((s, j) => { const g = x * coef[e.l.length + j] * molarMass(s.counts); mOut += g; yl.append(h('b', { text: `→ ${pretty(s.text)}: ${g.toFixed(2)} g` })); });
    info('mass', `${mIn.toFixed(2)} g = ${mOut.toFixed(2)} g`);
  }

  /* lay out molecules on each half and pair atoms by element */
  function build() {
    if (!eqn) return; const e = eqn;
    const W = S.w, H = S.h, wide = W > 560;
    const mols = (list: Species[], off: number) => list.flatMap((s, i) => Array.from({ length: coef[off + i] }, () => s));
    const lm = mols(e.l, 0), rm = mols(e.r, e.l.length);
    const nAtoms = lm.reduce((a, s) => a + Object.values(s.counts).reduce((x, y) => x + y, 0), 0);
    tooMany = nAtoms > 260 || lm.length > 40 || rm.length > 40;
    atoms = []; molR = []; molP = [];
    if (tooMany) return;
    const place = (list: Species[], x0: number, x1: number, y0: number, y1: number, store: typeof molR, isR: boolean, dry = false) => {
      const n = list.length, cols = Math.max(1, Math.ceil(Math.sqrt(n * (x1 - x0) / (y1 - y0)))), rows = Math.ceil(n / cols);
      const cw = (x1 - x0) / cols, ch = (y1 - y0) / rows;
      list.forEach((s, k) => {
        const cx = x0 + cw * (k % cols + .5), cy = y0 + ch * (Math.floor(k / cols) + .5), m = { x: cx, y: cy, atoms: [] as number[] };
        const els = Object.entries(s.counts).sort((a, b) => (a[0] === 'H' ? 1 : 0) - (b[0] === 'H' ? 1 : 0) || a[1] - b[1] || AW[b[0]] - AW[a[0]]).flatMap(([el, c]) => Array(c).fill(el) as string[]);
        const r0 = clamp(Math.min(cw, ch) / (2.6 + Math.sqrt(els.length) * 4.4), 3, 20); rMin = Math.min(rMin, r0); const r = fixed || r0; if (dry) return;
        els.forEach((el, a) => {
          const rad = a === 0 ? 0 : r * 2.05 * Math.sqrt(a), ang = a * 2.39996 + k;
          const px = cx + Math.cos(ang) * rad, py = cy + Math.sin(ang) * rad;
          if (isR) { atoms.push({ el, ax: px, ay: py, bx: 0, by: 0, delay: 0, pm: 0 }); m.atoms.push(atoms.length - 1); }
          else (slots[el] ||= []).push([px, py, store.length]);
        });
        store.push(m);
      });
      return rMin;
    };
    const slots: Record<string, [number, number, number][]> = {}; let rMin = 20;
    const top = 30, bot = H - 26;
    let fixed = 0;
    const doAll = (dry: boolean) => {
      if (wide) { place(lm, 14, W * .44, top, bot, molR, true, dry); place(rm, W * .56, W - 14, top, bot, molP, false, dry); }
      else { place(lm, 10, W - 10, top, H * .46, molR, true, dry); place(rm, 10, W - 10, H * .54, bot, molP, false, dry); }
    };
    doAll(true); fixed = aR = rMin; atoms = []; molR = []; molP = []; doAll(false);
    /* pair atoms with product slots of the same element; molecules finish in order */
    const used: Record<string, number> = {};
    for (const a of atoms) { const list = slots[a.el], k = used[a.el] = (used[a.el] ?? -1) + 1, sl = list[k]; a.bx = sl[0]; a.by = sl[1]; a.pm = sl[2]; a.delay = (sl[2] / Math.max(1, molP.length)) * .25; }
  }
  let aR = 6;
  S.onResize(() => { if (eqn) build(); });

  const ease = (x: number) => x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  function draw(dt: number) {
    const g = S.g, W = S.w, H = S.h, wide = W > 560;
    g.fillStyle = '#070b0d'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.45)'; g.font = '11px ui-monospace,monospace';
    if (wide) { g.textAlign = 'left'; g.fillText(t('reac', 'reactants'), 14, 18); g.textAlign = 'right'; g.fillText(t('prod', 'products'), W - 14, 18); g.strokeStyle = 'rgba(111,211,208,.4)'; g.lineWidth = 2; g.beginPath(); g.moveTo(W * .47, H / 2); g.lineTo(W * .53, H / 2); g.lineTo(W * .51, H / 2 - 6); g.moveTo(W * .53, H / 2); g.lineTo(W * .51, H / 2 + 6); g.stroke(); }
    else { g.textAlign = 'left'; g.fillText(t('reac', 'reactants'), 10, 18); g.fillText(t('prod', 'products'), 10, H * .54 - 6); g.strokeStyle = 'rgba(111,211,208,.25)'; g.beginPath(); g.moveTo(10, H / 2); g.lineTo(W - 10, H / 2); g.stroke(); }
    if (!eqn) { g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.5)'; g.fillText(t('typeeq', 'Type an equation in the panel.'), W / 2, H / 2 + 24); return; }
    if (tooMany) { g.textAlign = 'center'; g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '13px ui-monospace,monospace'; g.fillText(t('toomany', 'Too many molecules to animate clearly; the balance and masses are still exact.'), W / 2, H / 2 + 30); return; }
    T += dt / (ctx.calm ? 1.6 : 4.2);
    const p = clamp(T, 0, 1.3);
    /* bonds within molecules before and after */
    const bond = (ms: typeof molR, pos: (i: number) => [number, number] | null, alpha: number) => {
      if (alpha <= 0) return; g.strokeStyle = `rgba(200,220,230,${.35 * alpha})`; g.lineWidth = 2;
      for (const m of ms) { const c = pos(m.atoms[0]); if (!c) continue; for (const a of m.atoms.slice(1)) { const q2 = pos(a); if (q2) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(q2[0], q2[1]); g.stroke(); } } }
    };
    const cur = atoms.map((a) => { const k = ease(clamp((p - .3 - a.delay) / .5, 0, 1)), lift = Math.sin(k * Math.PI) * (wide ? -40 : 20); return [a.ax + (a.bx - a.ax) * k, a.ay + (a.by - a.ay) * k + lift, k] as [number, number, number]; });
    bond(molR, (i) => (i >= 0 ? [cur[i][0], cur[i][1]] : null), 1 - clamp((p - .22) / .08, 0, 1));
    if (p > .8) {
      /* product bonds: connect each product molecule's slots that are now filled */
      const filled: Record<number, [number, number][]> = {};
      atoms.forEach((a, i) => { if (cur[i][2] >= 1) (filled[a.pm] ||= []).push([a.bx, a.by]); });
      g.strokeStyle = `rgba(200,220,230,${.35 * clamp((p - .8) / .2, 0, 1)})`; g.lineWidth = 2;
      for (const k in filled) { const pts = filled[k], m = molP[+k]; let c = pts[0], best = Infinity; for (const q2 of pts) { const d = Math.hypot(q2[0] - m.x, q2[1] - m.y); if (d < best) { best = d; c = q2; } } for (const q2 of pts) if (q2 !== c) { g.beginPath(); g.moveTo(c[0], c[1]); g.lineTo(q2[0], q2[1]); g.stroke(); } }
    }
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i], [x, y] = cur[i], r = aR * (a.el === 'H' ? .72 : 1);
      const gr = g.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, col(a.el)); gr.addColorStop(1, shade(col(a.el)));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      if (r >= 8 && a.el !== 'H') { g.fillStyle = luminous(col(a.el)) ? '#111' : '#fff'; g.font = `bold ${Math.round(r * .9)}px system-ui,sans-serif`; g.textAlign = 'center'; g.fillText(a.el, x, y + r * .33); }
    }
  }
  const shade = (hx: string) => { const n = parseInt(hx.slice(1), 16); return `rgb(${((n >> 16) & 255) * .45 | 0},${((n >> 8) & 255) * .45 | 0},${(n & 255) * .45 | 0})`; };
  const luminous = (hx: string) => { const n = parseInt(hx.slice(1), 16); return ((n >> 16) & 255) * .3 + ((n >> 8) & 255) * .59 + (n & 255) * .11 > 150; };

  run();
  loop(ctx, S.cv, draw);
}
