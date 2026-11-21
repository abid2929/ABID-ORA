/* 049 Typography Playground: Letter Foundry. Design a typeface of your own the way type was
   understood before computers, as a skeleton written with a pen. Every letter (a-z, A-Z, 0-9 and
   basic punctuation) is an original skeleton of lines, bowls and curves; a pen model then writes it:
   a monoline pen, a broad nib held at an angle (thick and thin come from the nib, as in humanist
   writing) or a pointed pen that swells on downstrokes (as in copperplate). Sliders set weight,
   contrast, width, x-height, roundness, slant, tracking and serifs. Type any text, see how many
   characters fit on a line, save your fonts and download the setting as PNG or SVG. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, clamp, store, download } from './kit';

export interface FontP { pen: 'mono' | 'broad' | 'pointed'; weight: number; contrast: number; angle: number; width: number; xh: number; round: number; slant: number; track: number; serif: boolean }
export const DEFAULT: FontP = { pen: 'broad', weight: .09, contrast: .85, angle: 30, width: 1, xh: .5, round: 2.2, slant: 0, track: 0, serif: false };
export const PRESETS: Record<string, FontP> = {
  humanist: DEFAULT,
  geometric: { pen: 'mono', weight: .06, contrast: 0, angle: 0, width: 1.12, xh: .5, round: 2, slant: 0, track: .01, serif: false },
  script: { pen: 'pointed', weight: .075, contrast: .92, angle: 0, width: .86, xh: .42, round: 2, slant: .3, track: -.01, serif: false },
  slab: { pen: 'mono', weight: .085, contrast: 0, angle: 0, width: .98, xh: .53, round: 3.4, slant: 0, track: .02, serif: true },
  gothic: { pen: 'broad', weight: .1, contrast: .85, angle: 42, width: .74, xh: .46, round: 7, slant: 0, track: 0, serif: false },
};
type Pt = [number, number];
interface Glyph { adv: number; strokes: Pt[][]; dots: Pt[] }

/* ---------- skeleton builder (em units, y up, baseline 0) ---------- */
class B {
  strokes: Pt[][] = []; dots: Pt[] = [];
  constructor(public p: FontP) {}
  L(x1: number, y1: number, x2: number, y2: number) { this.strokes.push([[x1, y1], [x2, y2]]); }
  /** superellipse arc from angle a0 to a1 in degrees (either direction); roundness 2 is a true ellipse */
  O(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) {
    const n = this.p.round, st = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 5)), pts: Pt[] = [];
    for (let i = 0; i <= st; i++) {
      const a = (a0 + (a1 - a0) * i / st) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
      pts.push([cx + rx * Math.sign(c) * Math.abs(c) ** (2 / n), cy + ry * Math.sign(s) * Math.abs(s) ** (2 / n)]);
    }
    this.strokes.push(pts);
  }
  /** smooth Catmull-Rom curve through the points */
  P(q: Pt[]) {
    const pts: Pt[] = [];
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
      for (let k = 0; k < 10; k++) {
        const t = k / 10, t2 = t * t, t3 = t2 * t;
        pts.push([0, 1].map((j) => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)) as Pt);
      }
    }
    pts.push(q[q.length - 1]); this.strokes.push(pts);
  }
  D(x: number, y: number) { this.dots.push([x, y]); }
  /** a vertical stem, with optional serifs at its foot and head */
  S(x: number, y0: number, y1: number, foot = true, head = true) {
    this.L(x, y0, x, y1);
    if (this.p.serif) { const s = .06 + this.p.weight * .45; if (foot) this.L(x - s, y0, x + s, y0); if (head) this.L(x - s, y1, x + s, y1); }
  }
}

export function glyph(ch: string, p: FontP): Glyph | null {
  const b = new B(p), X = p.xh, C = Math.max(.7, X + .14), A = Math.max(.76, X + .2), Dd = -.22, w = X * .92 * p.width, cw = C * .72 * p.width, dw = C * .6 * p.width, hr = Math.min(.17, w * .38);
  const bowl = () => b.O(w / 2, X / 2, w / 2, X / 2, 0, 360);
  const arch = (x0: number, ww: number) => { b.O(x0 + ww / 2, X * .55, ww / 2, X * .45, 180, 0); b.S(x0 + ww, 0, X * .55, true, false); };
  let adv = w;
  switch (ch) {
    case 'a': bowl(); b.S(w, 0, X, true, false); break;
    case 'b': b.S(0, 0, A); bowl(); break;
    case 'c': b.O(w / 2, X / 2, w / 2, X / 2, 42, 318); break;
    case 'd': bowl(); b.S(w, 0, A); break;
    case 'e': b.O(w / 2, X / 2, w / 2, X / 2, 0, 325); b.L(0, X / 2, w, X / 2); break;
    case 'f': b.S(w * .3, 0, A - hr, true, false); b.O(w * .3 + hr, A - hr, hr, hr, 180, 50); b.L(0, X, w * .7, X); adv = w * .72; break;
    case 'g': bowl(); b.S(w, X, -.04, false, true); b.O(w / 2, -.04, w / 2, .16, 0, -165); break;
    case 'h': b.S(0, 0, A); arch(0, w); break;
    case 'i': b.S(0, 0, X); b.D(0, X + .15); adv = 0; break;
    case 'j': b.S(0, X, -.06, false, true); b.O(-hr, -.06, hr, hr, 0, -170); b.D(0, X + .15); adv = 0; break;
    case 'k': b.S(0, 0, A); b.L(w * .82, X, 0, X * .36); b.L(w * .26, X * .52, w * .88, 0); adv = w * .88; break;
    case 'l': b.S(0, 0, A); adv = 0; break;
    case 'm': b.S(0, 0, X); arch(0, w * .76); arch(w * .76, w * .76); adv = w * 1.52; break;
    case 'n': b.S(0, 0, X); arch(0, w); break;
    case 'o': bowl(); break;
    case 'p': b.S(0, Dd, X); bowl(); break;
    case 'q': bowl(); b.S(w, Dd, X); break;
    case 'r': b.S(0, 0, X); b.O(w * .55, X * .55, w * .55, X * .45, 180, 62); adv = w * .66; break;
    case 's': b.P([[w * .86, X * .84], [w * .5, X], [w * .12, X * .8], [w * .24, X * .57], [w * .76, X * .43], [w * .9, X * .2], [w * .5, 0], [w * .06, X * .16]]); adv = w * .94; break;
    case 't': b.L(w * .25, A - .1, w * .25, X * .22); b.O(w * .25 + w * .3, X * .22, w * .3, X * .22, 180, 300); b.L(0, X, w * .68, X); adv = w * .7; break;
    case 'u': b.S(0, X * .45, X, false, true); b.O(w / 2, X * .45, w / 2, X * .45, 180, 360); b.S(w, 0, X); break;
    case 'v': b.L(0, X, w / 2, 0); b.L(w / 2, 0, w, X); break;
    case 'w': b.L(0, X, w * .33, 0); b.L(w * .33, 0, w * .66, X); b.L(w * .66, X, w * .99, 0); b.L(w * .99, 0, w * 1.32, X); adv = w * 1.32; break;
    case 'x': b.L(0, X, w, 0); b.L(0, 0, w, X); break;
    case 'y': { const t = X / (X - Dd), xm = w - w * .75 * t; b.L(0, X, xm, 0); b.L(w, X, w * .25, Dd); break; }
    case 'z': b.L(0, X, w, X); b.L(w, X, 0, 0); b.L(0, 0, w, 0); break;
    case 'A': b.L(0, 0, cw / 2, C); b.L(cw / 2, C, cw, 0); b.L(cw * .2, C * .32, cw * .8, C * .32); adv = cw; break;
    case 'B': b.S(0, 0, C); b.L(0, C, cw * .5, C); b.O(cw * .5, C * .75, cw * .36, C * .25, 90, -90); b.L(cw * .5, C * .5, 0, C * .5); b.O(cw * .56, C * .25, cw * .42, C * .25, 90, -90); b.L(cw * .56, 0, 0, 0); adv = cw * .98; break;
    case 'C': b.O(cw * .55, C / 2, cw * .55, C / 2, 42, 318); adv = cw * 1.1; break;
    case 'D': b.S(0, 0, C); b.L(0, C, cw * .4, C); b.O(cw * .4, C / 2, cw * .62, C / 2, 90, -90); b.L(cw * .4, 0, 0, 0); adv = cw * 1.02; break;
    case 'E': b.S(0, 0, C); b.L(0, C, cw * .82, C); b.L(0, C / 2, cw * .68, C / 2); b.L(0, 0, cw * .85, 0); adv = cw * .85; break;
    case 'F': b.S(0, 0, C); b.L(0, C, cw * .82, C); b.L(0, C / 2, cw * .68, C / 2); adv = cw * .82; break;
    case 'G': b.O(cw * .55, C / 2, cw * .55, C / 2, 42, 360); b.L(cw * 1.1, C / 2, cw * .62, C / 2); adv = cw * 1.1; break;
    case 'H': b.S(0, 0, C); b.S(cw, 0, C); b.L(0, C / 2, cw, C / 2); adv = cw; break;
    case 'I': b.S(0, 0, C); adv = 0; break;
    case 'J': b.S(cw * .6, C * .26, C, false, true); b.O(cw * .3, C * .26, cw * .3, C * .26, 0, -180); adv = cw * .6; break;
    case 'K': b.S(0, 0, C); b.L(cw * .9, C, 0, C * .36); b.L(cw * .3, C * .58, cw * .95, 0); adv = cw * .95; break;
    case 'L': b.S(0, 0, C); b.L(0, 0, cw * .8, 0); adv = cw * .8; break;
    case 'M': b.S(0, 0, C); b.L(0, C, cw * .6, 0); b.L(cw * .6, 0, cw * 1.2, C); b.S(cw * 1.2, 0, C); adv = cw * 1.2; break;
    case 'N': b.S(0, 0, C); b.L(0, C, cw, 0); b.S(cw, 0, C); adv = cw; break;
    case 'O': b.O(cw * .56, C / 2, cw * .56, C / 2, 0, 360); adv = cw * 1.12; break;
    case 'P': b.S(0, 0, C); b.L(0, C, cw * .5, C); b.O(cw * .5, C * .73, cw * .42, C * .27, 90, -90); b.L(cw * .5, C * .46, 0, C * .46); adv = cw * .92; break;
    case 'Q': b.O(cw * .56, C / 2, cw * .56, C / 2, 0, 360); b.L(cw * .66, C * .22, cw * 1.16, -.05); adv = cw * 1.14; break;
    case 'R': b.S(0, 0, C); b.L(0, C, cw * .5, C); b.O(cw * .5, C * .73, cw * .42, C * .27, 90, -90); b.L(cw * .5, C * .46, 0, C * .46); b.L(cw * .45, C * .46, cw * .95, 0); adv = cw * .95; break;
    case 'S': b.P([[cw * .86, C * .86], [cw * .48, C], [cw * .1, C * .8], [cw * .24, C * .56], [cw * .76, C * .44], [cw * .9, C * .2], [cw * .48, 0], [cw * .04, C * .15]]); adv = cw * .92; break;
    case 'T': b.L(0, C, cw, C); b.S(cw / 2, 0, C, true, false); adv = cw; break;
    case 'U': b.S(0, C * .36, C, false, true); b.O(cw / 2, C * .36, cw / 2, C * .36, 180, 360); b.S(cw, C * .36, C, false, true); adv = cw; break;
    case 'V': b.L(0, C, cw / 2, 0); b.L(cw / 2, 0, cw, C); adv = cw; break;
    case 'W': b.L(0, C, cw * .35, 0); b.L(cw * .35, 0, cw * .7, C); b.L(cw * .7, C, cw * 1.05, 0); b.L(cw * 1.05, 0, cw * 1.4, C); adv = cw * 1.4; break;
    case 'X': b.L(0, C, cw, 0); b.L(0, 0, cw, C); adv = cw; break;
    case 'Y': b.L(0, C, cw / 2, C * .45); b.L(cw, C, cw / 2, C * .45); b.S(cw / 2, 0, C * .45, true, false); adv = cw; break;
    case 'Z': b.L(0, C, cw, C); b.L(cw, C, 0, 0); b.L(0, 0, cw, 0); adv = cw; break;
    case '0': b.O(dw / 2, C / 2, dw / 2, C / 2, 0, 360); adv = dw; break;
    case '1': b.S(dw * .55, 0, C, true, false); b.L(dw * .55, C, dw * .12, C * .76); adv = dw; break;
    case '2': { const a = -28 * Math.PI / 180; b.O(dw / 2, C * .72, dw / 2, C * .28, 158, -28); b.L(dw / 2 + dw / 2 * Math.cos(a), C * .72 + C * .28 * Math.sin(a), 0, 0); b.L(0, 0, dw, 0); adv = dw; break; }
    case '3': b.O(dw / 2, C * .75, dw * .44, C * .25, 150, -90); b.O(dw / 2, C * .27, dw / 2, C * .27, 90, -150); adv = dw; break;
    case '4': b.S(dw * .74, 0, C * .3, true, false); b.L(dw * .74, C, dw * .74, C * .3); b.L(dw * .74, C, 0, C * .3); b.L(0, C * .3, dw, C * .3); adv = dw; break;
    case '5': b.L(dw * .9, C, dw * .14, C); b.L(dw * .14, C, dw * .08, C * .56); b.O(dw / 2, C * .3, dw / 2, C * .3, 128, -150); adv = dw; break;
    case '6': b.O(dw / 2, C * .3, dw / 2, C * .3, 0, 360); b.P([[0, C * .3], [dw * .14, C * .76], [dw * .78, C]]); adv = dw; break;
    case '7': b.L(0, C, dw, C); b.L(dw, C, dw * .3, 0); adv = dw; break;
    case '8': b.O(dw / 2, C * .76, dw * .42, C * .24, 0, 360); b.O(dw / 2, C * .26, dw / 2, C * .26, 0, 360); adv = dw; break;
    case '9': b.O(dw / 2, C * .7, dw / 2, C * .3, 0, 360); b.P([[dw, C * .7], [dw * .86, C * .24], [dw * .22, 0]]); adv = dw; break;
    case '.': b.D(0, 0); adv = 0; break;
    case ',': b.D(0, 0); b.L(.012, 0, -.03, -.11); adv = 0; break;
    case ':': b.D(0, 0); b.D(0, X * .9); adv = 0; break;
    case ';': b.D(0, X * .9); b.D(0, 0); b.L(.012, 0, -.03, -.11); adv = 0; break;
    case '!': b.L(0, C * .28, 0, C); b.D(0, 0); adv = 0; break;
    case '?': { const a = -60 * Math.PI / 180, ex = dw * .42 + dw * .42 * Math.cos(a), ey = C * .76 + C * .24 * Math.sin(a); b.O(dw * .42, C * .76, dw * .42, C * .24, 165, -60); b.P([[ex, ey], [dw * .42, C * .4], [dw * .42, C * .26]]); b.D(dw * .42, 0); adv = dw * .84; break; }
    case "'": case '’': b.L(0, C, 0, C * .8); adv = 0; break;
    case '"': b.L(0, C, 0, C * .8); b.L(.09, C, .09, C * .8); adv = .09; break;
    case '-': b.L(0, X * .48, w * .5, X * .48); adv = w * .5; break;
    case '/': b.L(0, Dd, w * .7, A); adv = w * .7; break;
    case '&': b.P([[w * 1.05, 0], [w * .25, X * .9], [w * .3, C * .95], [w * .6, C * .9], [w * .55, C * .62], [w * .05, X * .35], [w * .25, 0], [w * .7, X * .18], [w * 1.0, X * .6]]); adv = w * 1.05; break;
    default: return null;
  }
  return { adv, strokes: b.strokes, dots: b.dots };
}
/** side bearing grows with weight so heavier letters do not touch */
export const bearing = (p: FontP) => .05 + p.weight * .55 + p.track;
export const wordSpace = (p: FontP) => p.xh * .5 * p.width + p.track * 2;

/* ---------- pen models: turn skeleton strokes into ink shapes ---------- */
export type Shape = { k: 'poly'; pts: Pt[] } | { k: 'line'; pts: Pt[]; w: number } | { k: 'dot'; x: number; y: number; r: number };
/** shapes in em units (y up) for one glyph at origin x0, with slant applied */
export function ink(gl: Glyph, p: FontP, x0: number): Shape[] {
  const out: Shape[] = [], tx = (q: Pt): Pt => [x0 + q[0] + q[1] * p.slant, q[1]];
  const W = p.weight, thin = W * (1 - p.contrast) + .006;
  for (const s of gl.strokes) {
    const pts = s.map(tx);
    if (p.pen === 'mono') { out.push({ k: 'line', pts, w: W }); continue; }
    if (p.pen === 'broad') {
      /* a flat nib of width W held at a fixed angle: sweep it along the path */
      const a = p.angle * Math.PI / 180, nx = Math.cos(a) * (W - thin) / 2, ny = Math.sin(a) * (W - thin) / 2;
      for (let i = 1; i < pts.length; i++) { const [x1, y1] = pts[i - 1], [x2, y2] = pts[i]; out.push({ k: 'poly', pts: [[x1 + nx, y1 + ny], [x2 + nx, y2 + ny], [x2 - nx, y2 - ny], [x1 - nx, y1 - ny]] }); }
      out.push({ k: 'line', pts, w: thin });
      continue;
    }
    /* pointed pen: the nib opens under pressure on the vertical (down) strokes and closes to a hairline on the horizontals */
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = s[i - 1], [x2, y2] = s[i], len = Math.hypot(x2 - x1, y2 - y1) || 1e-9, down = clamp(Math.abs(y2 - y1) / len, 0, 1) ** 2;
      const wd = thin + (W * 1.35 - thin) * down, [X1, Y1] = pts[i - 1], [X2, Y2] = pts[i], dx = (X2 - X1), dy = (Y2 - Y1), L2 = Math.hypot(dx, dy) || 1e-9, ox = -dy / L2 * wd / 2, oy = dx / L2 * wd / 2;
      out.push({ k: 'poly', pts: [[X1 + ox, Y1 + oy], [X2 + ox, Y2 + oy], [X2 - ox, Y2 - oy], [X1 - ox, Y1 - oy]] });
      out.push({ k: 'dot', x: X2, y: Y2, r: wd / 2 });
    }
    out.push({ k: 'dot', x: pts[0][0], y: pts[0][1], r: thin / 2 });
  }
  for (const d of gl.dots) { const [x, y] = tx(d); out.push({ k: 'dot', x, y: y + W * .3, r: W * .62 }); }
  return out;
}
/** stroke widths actually produced by the pen, for the contrast readout */
export function contrastRatio(p: FontP) {
  const thin = p.weight * (1 - p.contrast) + .006;
  if (p.pen === 'mono') return 1;
  if (p.pen === 'broad') return (p.weight) / thin;
  return (p.weight * 1.35) / thin;
}

/* ---------- typesetting ---------- */
export interface Line { words: { text: string; x: number }[]; width: number }
export function advanceOf(word: string, p: FontP) { let x = 0; for (const ch of word) { const g = glyph(ch, p); x += (g ? g.adv : wordSpace(p)) + bearing(p) * 2; } return x; }
export function setText(text: string, p: FontP, measure: number): Line[] {
  const lines: Line[] = [], sp = wordSpace(p);
  for (const para of text.split('\n')) {
    let cur: Line = { words: [], width: 0 };
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const wv = advanceOf(word, p), x = cur.words.length ? cur.width + sp : 0;
      if (cur.words.length && x + wv > measure) { lines.push(cur); cur = { words: [{ text: word, x: 0 }], width: wv }; }
      else { cur.words.push({ text: word, x }); cur.width = x + wv; }
    }
    lines.push(cur);
  }
  return lines;
}

const SAMPLE = 'Sphinx of black quartz, judge my vow!\nTypography is the craft of making words easy and beautiful to read.';
const SPEC = 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789 .,:;!?&-/';

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(380px, 56vw, 620px)';
  const S = canvas(L.view, t('cv', 'Your text set in the typeface you are designing.'), { alpha: false });
  const st = store<{ p: FontP; text: string; size: number; guides: boolean }>(ctx.id, 'cfg', { p: DEFAULT, text: SAMPLE, size: 76, guides: true }, (v) => typeof v === 'object' && v !== null && 'p' in v);
  const cfg = st.get(); let p: FontP = { ...DEFAULT, ...cfg.p };
  const save = () => { cfg.p = p; st.set(cfg); };

  heading(L.panel, t('texth', 'Your text'));
  const ta = h('textarea', { rows: 3, 'aria-label': t('texth', 'Your text'), style: { width: '100%', font: 'inherit', padding: '8px', borderRadius: '8px', resize: 'vertical' } }) as HTMLTextAreaElement;
  ta.value = cfg.text; ta.addEventListener('input', () => { cfg.text = ta.value.slice(0, 600); save(); draw(); });
  L.panel.append(ta);
  const missNote = note(L.panel, '');
  heading(L.panel, t('presh', 'Start from'));
  const presSeg = seg(L.panel, t('presl', 'Style'), [['humanist', t('pr.humanist', 'Humanist')], ['geometric', t('pr.geometric', 'Geometric')], ['script', t('pr.script', 'Script')], ['slab', t('pr.slab', 'Slab serif')], ['gothic', t('pr.gothic', 'Gothic')]], '', (v) => { p = { ...PRESETS[v] }; sync(); save(); draw(); });
  heading(L.panel, t('penh', 'Pen'));
  const penSeg = seg(L.panel, t('penl', 'Pen'), [['mono', t('pen.mono', 'Monoline')], ['broad', t('pen.broad', 'Broad nib')], ['pointed', t('pen.pointed', 'Pointed pen')]], p.pen, (v) => { p.pen = v as FontP['pen']; presSeg.set(''); save(); draw(); });
  const penNote = note(L.panel, '');
  const ctl: Record<string, ReturnType<typeof range>> = {};
  const R = (k: keyof FontP, label: string, o: { min: number; max: number; step: number; fmt?: (v: number) => string }) => { ctl[k] = range(L.panel, label, { ...o, value: p[k] as number }, (v) => { (p as unknown as Record<string, number>)[k] = v; presSeg.set(''); save(); draw(); }); };
  R('weight', t('weight', 'Weight'), { min: .02, max: .16, step: .005, fmt: (v) => `${Math.round(v * 1000)}` });
  R('contrast', t('contrast', 'Contrast'), { min: 0, max: .95, step: .05, fmt: (v) => `${Math.round(v * 100)}%` });
  R('angle', t('angle', 'Nib angle'), { min: 0, max: 80, step: 1, fmt: (v) => `${v}°` });
  heading(L.panel, t('shapeh', 'Shape'));
  R('width', t('width', 'Width'), { min: .6, max: 1.4, step: .02, fmt: (v) => `${Math.round(v * 100)}%` });
  R('xh', t('xh', 'x-height'), { min: .36, max: .62, step: .01, fmt: (v) => `${Math.round(v * 100)}%` });
  R('round', t('round', 'Squareness'), { min: 2, max: 8, step: .2, fmt: (v) => (v <= 2.05 ? t('oval', 'oval') : v.toFixed(1)) });
  R('slant', t('slant', 'Slant'), { min: 0, max: .45, step: .01, fmt: (v) => `${Math.round(Math.atan(v) * 180 / Math.PI)}°` });
  R('track', t('track', 'Letter spacing'), { min: -.03, max: .15, step: .005, fmt: (v) => `${Math.round(v * 1000)}` });
  const serifChk = check(L.panel, t('serif', 'Serifs'), p.serif, (v) => { p.serif = v; presSeg.set(''); save(); draw(); });
  heading(L.panel, t('seth', 'Setting'));
  range(L.panel, t('size', 'Size'), { min: 24, max: 160, step: 2, value: cfg.size, fmt: (v) => `${v} px` }, (v) => { cfg.size = v; save(); draw(); });
  check(L.panel, t('guides', 'Show guide lines'), cfg.guides, (v) => { cfg.guides = v; save(); draw(); });
  const out = stats(L.panel, [['cpl', t('s.cpl', 'Characters per line')], ['con', t('s.con', 'Thick : thin')], ['xr', t('s.xr', 'x-height : cap height')]]);
  const cplNote = note(L.panel, '');
  heading(L.panel, t('fontsh', 'My fonts'));
  buttons(L.panel, [[t('savef', 'Save to my fonts'), () => { const l = fonts.get(); l.unshift({ ...p }); while (l.length > 10) l.pop(); fonts.set(l); showFonts(); }, true], [t('png', 'Download PNG'), () => exportPng()], [t('svg', 'Download SVG'), () => exportSvg()]]);
  const fonts = store<FontP[]>(ctx.id, 'fonts', [], (v) => Array.isArray(v));
  const fontBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } }); L.panel.append(fontBox);

  const PN: Record<FontP['pen'], string> = {
    mono: t('pn.mono', 'One even line everywhere, like a technical pen or most modern sans serifs.'),
    broad: t('pn.broad', 'A chisel-edged nib held at a fixed angle. Strokes along the edge come out thin, strokes across it thick, the root of serif type since the Renaissance.'),
    pointed: t('pn.pointed', 'A flexible pointed nib that spreads under pressure on downstrokes, the engine of 18th-century copperplate and Bodoni-style contrast.'),
  };
  function sync() {
    penSeg.set(p.pen); serifChk.checked = p.serif;
    for (const k of Object.keys(ctl)) ctl[k].set((p as unknown as Record<string, number>)[k]);
  }
  function showFonts() {
    fontBox.replaceChildren();
    fonts.get().forEach((f, i) => {
      const c = document.createElement('canvas'); c.width = 132; c.height = 44; const g = c.getContext('2d')!;
      g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, 132, 44); g.fillStyle = '#1a1714'; paintWord(g, 'Aag', { ...f, track: Math.max(0, f.track) }, 10, 34, 34);
      const b = h('button', { type: 'button', class: 'wk-b', title: t('loadf', 'Use this font'), style: { padding: '2px' }, onclick: () => { p = { ...DEFAULT, ...f }; sync(); presSeg.set(''); save(); draw(); } }, c);
      c.style.display = 'block'; c.style.width = '66px'; c.style.height = '22px';
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove font'), text: '×', onclick: () => { const l = fonts.get(); l.splice(i, 1); fonts.set(l); showFonts(); } });
      fontBox.append(h('span', { style: { display: 'inline-flex', gap: '2px' } }, b, del));
    });
  }

  /* ---------- drawing ---------- */
  function paintShapes(g: CanvasRenderingContext2D, shapes: Shape[], ox: number, oy: number, sz: number) {
    const X = (x: number) => ox + x * sz, Y = (y: number) => oy - y * sz;
    g.beginPath();
    for (const s of shapes) if (s.k === 'poly') { g.moveTo(X(s.pts[0][0]), Y(s.pts[0][1])); for (let i = 1; i < s.pts.length; i++) g.lineTo(X(s.pts[i][0]), Y(s.pts[i][1])); g.closePath(); }
    else if (s.k === 'dot') { g.moveTo(X(s.x) + s.r * sz, Y(s.y)); g.arc(X(s.x), Y(s.y), s.r * sz, 0, Math.PI * 2); }
    g.fill('nonzero');
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = g.fillStyle as string;
    for (const s of shapes) if (s.k === 'line') { g.lineWidth = s.w * sz; g.beginPath(); g.moveTo(X(s.pts[0][0]), Y(s.pts[0][1])); for (let i = 1; i < s.pts.length; i++) g.lineTo(X(s.pts[i][0]), Y(s.pts[i][1])); g.stroke(); }
  }
  function wordShapes(word: string, f: FontP) {
    const shapes: Shape[] = []; let x = 0;
    for (const ch of word) { const gl = glyph(ch, f); x += bearing(f); if (gl) { shapes.push(...ink(gl, f, x)); x += gl.adv; } else x += wordSpace(f); x += bearing(f); }
    return shapes;
  }
  function paintWord(g: CanvasRenderingContext2D, word: string, f: FontP, ox: number, oy: number, sz: number) { paintShapes(g, wordShapes(word, f), ox, oy, sz); }
  /** lay out the text and the specimen; returns everything placed, in px, for canvas and SVG alike */
  function compose(W: number, H: number) {
    const sz = Math.min(cfg.size, W / 6), m = Math.max(16, W * .04), measure = (W - 2 * m) / sz, lead = 1.32;
    const lines = setText(cfg.text || ' ', p, measure), placed: { shapes: Shape[]; ox: number; oy: number; sz: number }[] = [];
    let y = m + sz * .82; const guides: number[] = [];
    lines.forEach((ln, i) => {
      if (y > H - m) return;
      if (i === 0) guides.push(y);
      for (const wv of ln.words) placed.push({ shapes: wordShapes(wv.text, p), ox: m + wv.x * sz, oy: y, sz });
      y += sz * lead;
    });
    const used = lines.filter((_, i) => m + sz * .82 + i * sz * lead <= H - m);
    const chars = used.map((l) => l.words.reduce((s, w2) => s + w2.text.length + 1, -1)).filter((c) => c > 0);
    /* specimen of every glyph underneath */
    const s2 = clamp(sz * .36, 16, 34), sy0 = y + s2 * .4;
    let specY = -1;
    if (sy0 + s2 * 1.2 < H - 8) {
      specY = sy0;
      setText(SPEC, p, (W - 2 * m) / s2).forEach((ln, i) => {
        const yy = sy0 + s2 * .8 + i * s2 * 1.35; if (yy > H - 8) return;
        for (const wv of ln.words) placed.push({ shapes: wordShapes(wv.text, p), ox: m + wv.x * s2, oy: yy, sz: s2 });
      });
    }
    return { placed, guides, sz, m, chars, specY };
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, W, H);
    const c = compose(W, H);
    if (cfg.guides && c.guides.length) {
      const y0 = c.guides[0], X = p.xh, Cp = Math.max(.7, X + .14), A = Math.max(.76, X + .2);
      const rows: [string, number, string][] = [[t('g.asc', 'ascender'), A, '#9bb'], [t('g.cap', 'cap height'), Cp, '#b9b'], [t('g.xh', 'x-height'), X, '#d77'], [t('g.base', 'baseline'), 0, '#57a'], [t('g.desc', 'descender'), -.22, '#9bb']];
      g.save(); g.font = '10px system-ui, sans-serif'; g.textAlign = 'right';
      for (const [n, v, col] of rows) { const yy = y0 - v * c.sz; g.strokeStyle = col; g.globalAlpha = .7; g.setLineDash(v === 0 || v === X ? [] : [4, 4]); g.beginPath(); g.moveTo(c.m * .3, yy); g.lineTo(W - 4, yy); g.stroke(); g.globalAlpha = 1; g.fillStyle = col; g.fillText(n, W - 6, yy - 3); }
      g.restore();
    }
    g.fillStyle = '#1a1714';
    for (const q of c.placed) paintShapes(g, q.shapes, q.ox, q.oy, q.sz);
    if (c.specY > 0) { g.strokeStyle = 'rgba(26,23,20,.2)'; g.beginPath(); g.moveTo(c.m, c.specY - 6); g.lineTo(W - c.m, c.specY - 6); g.stroke(); }
    const avg = c.chars.length ? Math.round(c.chars.reduce((a, b) => a + b, 0) / c.chars.length) : 0;
    out('cpl', String(avg)); out('con', `${contrastRatio(p).toFixed(1)} : 1`); out('xr', `${Math.round(p.xh / Math.max(.7, p.xh + .14) * 100)}%`);
    cplNote.textContent = avg < 45 ? t('cpl.short', 'Fewer than about 45 characters per line makes the eye jump back too often: fine for headlines, tiring for reading.') : avg > 75 ? t('cpl.long', 'More than about 75 characters per line makes it hard to find the start of the next line.') : t('cpl.ok', 'Between 45 and 75 characters per line is the comfortable range for reading.');
    penNote.textContent = PN[p.pen];
    const miss = [...new Set([...(cfg.text || '')].filter((ch) => !/\s/.test(ch) && !glyph(ch, p)))].slice(0, 12).join(' ');
    missNote.textContent = miss ? t('miss', 'This typeface covers Latin letters, numbers and basic punctuation. Not drawn yet:') + ' ' + miss : '';
  }
  function exportPng() {
    const k = Math.max(2, 2400 / S.w), c = document.createElement('canvas'); c.width = Math.round(S.w * k); c.height = Math.round(S.h * k);
    const g = c.getContext('2d')!; g.scale(k, k); g.fillStyle = '#fbf8f1'; g.fillRect(0, 0, S.w, S.h); g.fillStyle = '#1a1714';
    for (const q of compose(S.w, S.h).placed) paintShapes(g, q.shapes, q.ox, q.oy, q.sz);
    download(c, `abidora-type-${p.pen}.png`);
  }
  function exportSvg() {
    const f = (v: number) => Math.round(v * 100) / 100, parts: string[] = [];
    for (const q of compose(S.w, S.h).placed) {
      const X = (x: number) => f(q.ox + x * q.sz), Y = (y: number) => f(q.oy - y * q.sz);
      let d = '';
      for (const s of q.shapes) {
        if (s.k === 'poly') d += 'M' + s.pts.map((pt) => `${X(pt[0])} ${Y(pt[1])}`).join('L') + 'Z';
        else if (s.k === 'dot') { const r = f(s.r * q.sz); d += `M${f(X(s.x) - r)} ${Y(s.y)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`; }
        else parts.push(`<polyline fill="none" stroke="#1a1714" stroke-linecap="round" stroke-linejoin="round" stroke-width="${f(s.w * q.sz)}" points="${s.pts.map((pt) => `${X(pt[0])},${Y(pt[1])}`).join(' ')}"/>`);
      }
      if (d) parts.push(`<path fill="#1a1714" d="${d}"/>`);
    }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}" viewBox="0 0 ${S.w} ${S.h}">\n<rect width="100%" height="100%" fill="#fbf8f1"/>\n${parts.join('\n')}\n</svg>`;
    download(new Blob([svg], { type: 'image/svg+xml' }), `abidora-type-${p.pen}.svg`);
  }
  S.onResize(draw);
  showFonts(); draw();
}
