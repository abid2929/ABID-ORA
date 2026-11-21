/* 059 Creative Coding Lab: Turtle Studio. Write small programs that draw. The language is a
   friendly Logo built for this world, with its own parser and interpreter: nothing you type is run as
   JavaScript, so sketches are safe to paste and share. It has movement, pen colour and width, hue
   for rainbow lines, repeat loops with repcount, procedures with inputs, if, stop and random, which is
   enough for spirals, flowers, recursive trees and snowflakes. Programs run with a step limit, errors
   point to the line, the drawing animates at the speed you choose, and you can keep sketches and
   download PNG or SVG. */
import { type Ctx, h, layout, canvas, heading, range, select, stats, buttons, loop, clamp, store, download } from './kit';

/* ---------- language ---------- */
export interface Tok { v: string; line: number }
export function lex(src: string): Tok[] {
  const out: Tok[] = []; const lines = src.split('\n');
  lines.forEach((ln, i) => {
    const s = ln.replace(/;.*/, '').trimEnd(), re = /\s*([\[\]()+\-*/<>=]|#[0-9a-fA-F]{3,6}|:?[A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)/y; let pos = 0;
    while (pos < s.length) {
      re.lastIndex = pos; const m = re.exec(s);
      if (!m) { const bad = s.slice(pos).trim()[0]; throw new LogoError(`unexpected “${bad}”`, i + 1); }
      out.push({ v: m[1], line: i + 1 }); pos = re.lastIndex;
    }
  });
  return out;
}
export class LogoError extends Error { constructor(msg: string, public line: number) { super(msg); } }
export interface Seg { x1: number; y1: number; x2: number; y2: number; c: string; w: number }
const ALIAS: Record<string, string> = { forward: 'fd', back: 'bk', right: 'rt', left: 'lt', penup: 'pu', pendown: 'pd', pencolor: 'color', pensize: 'width' };
const ARGS: Record<string, number> = { fd: 1, bk: 1, rt: 1, lt: 1, pu: 0, pd: 0, color: 1, width: 1, hue: 1, home: 0, setxy: 2, seth: 1, stop: 0, circle: 1 };
const NAMED: Record<string, string> = { red: '#e05a4f', orange: '#f0a04b', yellow: '#f4d35e', green: '#3aa66b', teal: '#2bb3a6', blue: '#3d7fe0', purple: '#8e6fd8', pink: '#ec7fb0', white: '#f6f2ea', black: '#1d1b18', gold: '#d4a84b', grey: '#8a8f99', gray: '#8a8f99' };
const STOP = Symbol('stop');
/** run a program; returns line segments in turtle space (y up, start at 0,0 facing up) */
export function runLogo(src: string, opt: { maxSteps?: number; seed?: number } = {}) {
  const toks = lex(src); let p = 0; const maxSteps = opt.maxSteps ?? 200000; let steps = 0;
  let seed = (opt.seed ?? 1) >>> 0; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const procs = new Map<string, { params: string[]; body: Tok[]; line: number }>();
  /* first pass: collect procedure definitions (to name :a :b ... end) and keep the rest */
  const main: Tok[] = [];
  while (p < toks.length) {
    const tk = toks[p];
    if (tk.v.toLowerCase() === 'to') {
      const name = toks[p + 1]; if (!name || !/^[A-Za-z_]/.test(name.v)) throw new LogoError('“to” needs a procedure name', tk.line);
      p += 2; const params: string[] = []; while (p < toks.length && toks[p].v.startsWith(':') && toks[p].line === tk.line) params.push(toks[p++].v.slice(1).toLowerCase());
      const body: Tok[] = []; while (p < toks.length && toks[p].v.toLowerCase() !== 'end') body.push(toks[p++]);
      if (p >= toks.length) throw new LogoError(`procedure “${name.v}” has no “end”`, tk.line);
      p++; procs.set(name.v.toLowerCase(), { params, body, line: tk.line }); continue;
    }
    main.push(tk); p++;
  }
  const segs: Seg[] = []; const T = { x: 0, y: 0, h: 0, down: true, c: '#1d1b18', w: 2 };
  const step = (line: number) => { if (++steps > maxSteps) throw new LogoError(`stopped after ${maxSteps.toLocaleString()} steps (is there a loop or recursion that never ends?)`, line); };
  function move(d: number) { const a = T.h * Math.PI / 180, nx = T.x + Math.sin(a) * d, ny = T.y + Math.cos(a) * d; if (T.down) segs.push({ x1: T.x, y1: T.y, x2: nx, y2: ny, c: T.c, w: T.w }); T.x = nx; T.y = ny; }
  function block(ts: Tok[], vars: Map<string, number>, rep: number, depth: number): typeof STOP | undefined {
    let i = 0;
    /* expressions: comparison > additive > multiplicative > unary > primary */
    const peek = () => ts[i]?.v, line = () => ts[Math.min(i, ts.length - 1)]?.line ?? 1;
    function primary(): number {
      const tk = ts[i]; if (!tk) throw new LogoError('a number is missing at the end', line());
      if (tk.v === '(') { i++; const v = expr(); if (ts[i]?.v !== ')') throw new LogoError('missing “)”', tk.line); i++; return v; }
      if (tk.v === '-') { i++; return -primary(); }
      if (/^\d/.test(tk.v)) { i++; return +tk.v; }
      if (tk.v.startsWith(':')) { const k = tk.v.slice(1).toLowerCase(); if (!vars.has(k)) throw new LogoError(`unknown input “${tk.v}”`, tk.line); i++; return vars.get(k)!; }
      const w = tk.v.toLowerCase();
      if (w === 'repcount') { i++; return rep; }
      if (w === 'random') { i++; return Math.floor(rnd() * primary()); }
      if (w === 'heading') { i++; return T.h; }
      throw new LogoError(`expected a number, found “${tk.v}”`, tk.line);
    }
    function mul(): number { let v = primary(); while (peek() === '*' || peek() === '/') { const o = ts[i++].v, r = primary(); v = o === '*' ? v * r : v / r; } return v; }
    function add(): number { let v = mul(); while (peek() === '+' || peek() === '-') { const o = ts[i++].v, r = mul(); v = o === '+' ? v + r : v - r; } return v; }
    function expr(): number { const v = add(); const o = peek(); if (o === '<' || o === '>' || o === '=') { i++; const r = add(); return (o === '<' ? v < r : o === '>' ? v > r : Math.abs(v - r) < 1e-9) ? 1 : 0; } return v; }
    function bracket(): Tok[] {
      const open = ts[i]; if (open?.v !== '[') throw new LogoError('expected “[”', line()); let d = 0; const start = ++i;
      for (; i < ts.length; i++) { if (ts[i].v === '[') d++; else if (ts[i].v === ']') { if (d === 0) break; d--; } }
      if (i >= ts.length) throw new LogoError('missing “]”', open.line); const body = ts.slice(start, i); i++; return body;
    }
    while (i < ts.length) {
      const tk = ts[i]; step(tk.line); let w = tk.v.toLowerCase(); w = ALIAS[w] ?? w; i++;
      if (w === 'repeat') { const n = Math.floor(expr()); const body = bracket(); for (let k = 1; k <= n; k++) { const r = block(body, vars, k, depth); if (r === STOP) return STOP; } continue; }
      if (w === 'if') { const c = expr(); const body = bracket(); if (c) { const r = block(body, vars, rep, depth); if (r === STOP) return STOP; } continue; }
      if (w === 'stop') return STOP;
      if (w === 'color') { const a = ts[i]; if (a && (a.v.startsWith('#') || NAMED[a.v.toLowerCase()])) { T.c = a.v.startsWith('#') ? a.v : NAMED[a.v.toLowerCase()]; i++; continue; } throw new LogoError('color needs a name like red or a code like #3d7fe0', tk.line); }
      if (w in ARGS) {
        const a = ARGS[w] >= 1 ? expr() : 0, b = ARGS[w] >= 2 ? expr() : 0;
        if (w === 'fd') move(a); else if (w === 'bk') move(-a); else if (w === 'rt') T.h += a; else if (w === 'lt') T.h -= a;
        else if (w === 'pu') T.down = false; else if (w === 'pd') T.down = true; else if (w === 'width') T.w = clamp(a, .25, 40);
        else if (w === 'hue') T.c = `hsl(${((a % 360) + 360) % 360},75%,55%)`; else if (w === 'home') { T.x = 0; T.y = 0; T.h = 0; } else if (w === 'setxy') { T.x = a; T.y = b; } else if (w === 'seth') T.h = a;
        else if (w === 'circle') { const n = 36, s = 2 * Math.PI * a / n; for (let k = 0; k < n; k++) { move(s); T.h += 360 / n; } }
        continue;
      }
      const pr = procs.get(w);
      if (pr) {
        if (depth > 60) throw new LogoError(`“${tk.v}” calls itself too deeply (over 60 levels): add an if … [stop]`, tk.line);
        const nv = new Map<string, number>(); for (const k of pr.params) nv.set(k, expr());
        block(pr.body, nv, rep, depth + 1); continue;
      }
      throw new LogoError(`I don’t know how to “${tk.v}”`, tk.line);
    }
    return undefined;
  }
  block(main, new Map(), 0, 0);
  return { segs, steps, turtle: { ...T } };
}
export const EXAMPLES: Record<string, string> = {
  square: 'repeat 4 [fd 100 rt 90]',
  spiral: '; a square spiral that changes colour\nrepeat 120 [\n  hue repcount * 3\n  fd repcount * 2.5\n  rt 91\n]',
  flower: '; petals made of arcs\nto petal :size\n  repeat 2 [repeat 30 [fd :size rt 3] rt 90]\nend\nwidth 1.5\nrepeat 18 [\n  hue repcount * 20\n  petal 4\n  rt 20\n]',
  tree: '; a tree that draws itself with recursion\nto tree :len\n  if :len < 6 [stop]\n  width :len / 8\n  fd :len\n  lt 24 tree :len * 0.7\n  rt 48 tree :len * 0.7\n  lt 24\n  bk :len\nend\ncolor green\npu bk 120 pd\ntree 90',
  snow: '; Koch snowflake\nto side :len :depth\n  if :depth = 0 [fd :len stop]\n  side :len / 3 :depth - 1 lt 60\n  side :len / 3 :depth - 1 rt 120\n  side :len / 3 :depth - 1 lt 60\n  side :len / 3 :depth - 1\nend\ncolor blue\npu setxy -150 90 seth 90 pd\nrepeat 3 [side 300 4 rt 120]',
  stars: '; random stars\nto star :s\n  repeat 5 [fd :s rt 144]\nend\nrepeat 40 [\n  pu setxy random 500 - 250 random 360 - 180 pd\n  hue random 360\n  star 10 + random 30\n]',
};

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx, { panelFirst: false });
  L.view.style.minHeight = 'clamp(420px, 58vw, 620px)';
  const S = canvas(L.view, t('cv', 'The drawing made by your turtle program.'), { alpha: false });
  type Sk = { name: string; code: string };
  const st = store<{ code: string; speed: number; bg: string }>(ctx.id, 'cfg', { code: EXAMPLES.tree, speed: 60, bg: 'paper' }, (v) => typeof v === 'object' && v !== null && 'code' in v);
  const cfg = st.get(); const save = () => st.set(cfg);
  const kept = store<Sk[]>(ctx.id, 'kept', [], (v) => Array.isArray(v));
  let res: ReturnType<typeof runLogo> | null = null, shown = 0, err = '', errLine = 0;

  heading(L.panel, t('code', 'Program'));
  const ta = h('textarea', { rows: 13, spellcheck: false, 'aria-label': t('code', 'Program'), style: { width: '100%', fontFamily: 'var(--mono, ui-monospace, monospace)', fontSize: '13px', lineHeight: '1.45', tabSize: '2', resize: 'vertical', background: 'color-mix(in srgb, var(--ink) 80%, black)', color: 'var(--bone)', border: '1px solid var(--line)', borderRadius: '8px', padding: '8px' } }) as HTMLTextAreaElement;
  ta.value = cfg.code; L.panel.append(ta);
  const errBox = h('p', { class: 'wk-note', role: 'status', style: { color: '#f08c7f', minHeight: '1.2em' } }); L.panel.append(errBox);
  buttons(L.panel, [[t('run', 'Run ▶'), () => go(), true], [t('instant', 'Draw instantly'), () => { go(); shown = res?.segs.length ?? 0; lp.play(); }]]);
  ta.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); go(); } if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, ta.selectionEnd, 'end'); } });
  select(L.panel, t('ex', 'Examples'), [['', '—'], ['square', t('e.square', 'Square')], ['spiral', t('e.spiral', 'Colour spiral')], ['flower', t('e.flower', 'Flower')], ['tree', t('e.tree', 'Recursive tree')], ['snow', t('e.snow', 'Koch snowflake')], ['stars', t('e.stars', 'Random stars')]], '', (v) => { if (EXAMPLES[v]) { ta.value = EXAMPLES[v]; go(); } });
  range(L.panel, t('speed', 'Drawing speed'), { min: 1, max: 100, value: cfg.speed, fmt: (v) => (v >= 100 ? t('fastest', 'instant') : `${v}`) }, (v) => { cfg.speed = v; save(); });
  select(L.panel, t('bg', 'Paper'), [['paper', t('b.paper', 'Cream paper')], ['night', t('b.night', 'Night')], ['grid', t('b.grid', 'Graph paper')]], cfg.bg, (v) => { cfg.bg = v; save(); lp.play(); });
  const out = stats(L.panel, [['a', t('st.lines', 'Lines drawn')], ['b', t('st.steps', 'Steps run')], ['c', t('st.size', 'Size')]]);
  heading(L.panel, t('sk', 'My sketches'));
  buttons(L.panel, [[t('keep', 'Keep this sketch'), () => keep()], [t('png', 'Download PNG'), () => exportPng()], [t('svg', 'Download SVG'), () => exportSvg()]]);
  const keepBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } }); L.panel.append(keepBox);
  const help = h('details', {}, h('summary', { text: t('ref', 'Language reference') }), h('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '12px', fontFamily: 'var(--mono, monospace)' }, text: 'fd 50 / bk 50      move forward / back\nrt 90 / lt 90      turn right / left\npu / pd            pen up / pen down\ncolor red | #3d7fe0   pen colour\nhue 200            rainbow colour (0-360)\nwidth 3            pen width\ncircle 40          circle of radius 40\nsetxy 10 20 / seth 90 / home\nrepeat 10 [ ... ]  loop; repcount = 1, 2, 3…\nto name :a :b ... end   your own command\nif :a < 5 [ stop ] condition (< > =)\nrandom 100         0 to 99\n; comment          Ctrl+Enter runs' }));
  L.panel.append(help);

  function go() {
    cfg.code = ta.value.slice(0, 20000); save();
    try { res = runLogo(cfg.code, { seed: 7 }); err = ''; errLine = 0; } catch (e) { const le = e as LogoError; err = le.line ? `${t('line', 'Line')} ${le.line}: ${le.message}` : String(le.message); errLine = le.line ?? 0; }
    errBox.textContent = err; ta.setAttribute('aria-invalid', String(!!err));
    if (errLine) { const pos = ta.value.split('\n').slice(0, errLine - 1).join('\n').length + (errLine > 1 ? 1 : 0); try { ta.setSelectionRange(pos, pos + (ta.value.split('\n')[errLine - 1]?.length ?? 0)); } catch { /* not focused */ } }
    shown = cfg.speed >= 100 || ctx.calm ? res?.segs.length ?? 0 : 0; lp.play();
  }
  /* fit the drawing to the stage */
  function fit(W: number, H: number) {
    const s = res?.segs ?? []; let x0 = -50, x1 = 50, y0 = -50, y1 = 50;
    for (const g of s) { x0 = Math.min(x0, g.x1, g.x2); x1 = Math.max(x1, g.x1, g.x2); y0 = Math.min(y0, g.y1, g.y2); y1 = Math.max(y1, g.y1, g.y2); }
    const k = Math.min((W - 60) / (x1 - x0), (H - 90) / (y1 - y0), 3);
    return { k, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
  }
  function paintBg(g: CanvasRenderingContext2D, W: number, H: number) {
    g.fillStyle = cfg.bg === 'night' ? '#14161f' : '#f5f0e4'; g.fillRect(0, 0, W, H);
    if (cfg.bg === 'grid') { g.strokeStyle = 'rgba(70,120,190,.18)'; g.lineWidth = 1; for (let x = (W / 2) % 20; x < W; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = (H / 2) % 20; y < H; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  }
  function drawSegs(g: CanvasRenderingContext2D, W: number, H: number, n: number) {
    const F = fit(W, H), X = (x: number) => W / 2 + (x - F.cx) * F.k, Y = (y: number) => H / 2 + 14 - (y - F.cy) * F.k;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const s = res?.segs ?? [];
    for (let i = 0; i < Math.min(n, s.length); i++) { const q = s[i]; g.strokeStyle = cfg.bg === 'night' && q.c === '#1d1b18' ? '#f6f2ea' : q.c; g.lineWidth = Math.max(.6, q.w * Math.min(1.6, F.k)); g.beginPath(); g.moveTo(X(q.x1), Y(q.y1)); g.lineTo(X(q.x2), Y(q.y2)); g.stroke(); }
    return { F, X, Y };
  }
  const lp = loop(ctx, S.cv, (dt) => {
    const g = S.g, W = S.w, H = S.h, total = res?.segs.length ?? 0;
    if (shown < total) shown = Math.min(total, shown + Math.max(1, Math.round(Math.pow(cfg.speed / 100, 2) * 600 * dt * 60 / 10) + (cfg.speed > 80 ? total / 40 : 0)));
    paintBg(g, W, H);
    const { X, Y, F } = drawSegs(g, W, H, shown);
    /* the turtle itself, at the end of the last line drawn */
    const s = res?.segs ?? []; let tx = 0, ty = 0, th = 0;
    if (shown < total && shown > 0) { const q = s[shown - 1]; tx = q.x2; ty = q.y2; th = Math.atan2(q.x2 - q.x1, q.y2 - q.y1); } else if (res) { tx = res.turtle.x; ty = res.turtle.y; th = res.turtle.h * Math.PI / 180; }
    g.save(); g.translate(X(tx), Y(ty)); g.rotate(th); g.fillStyle = '#2e8b57'; g.beginPath(); g.moveTo(0, -11); g.lineTo(7, 7); g.lineTo(0, 3); g.lineTo(-7, 7); g.closePath(); g.fill(); g.restore();
    out('a', `${shown.toLocaleString()} / ${total.toLocaleString()}`); out('b', res ? res.steps.toLocaleString() : '—'); out('c', `${Math.round(F.w)} × ${Math.round(F.h)}`);
    if (shown >= total) lp.pause();
  });
  function keep() { const l = kept.get(); const first = (cfg.code.split('\n').find((x) => x.trim().startsWith(';')) ?? cfg.code.split('\n')[0]).replace(/^;\s*/, '').slice(0, 28) || 'sketch'; l.unshift({ name: first, code: cfg.code }); while (l.length > 10) l.pop(); kept.set(l); showKept(); }
  function showKept() {
    keepBox.replaceChildren();
    kept.get().forEach((k, i) => {
      const b = h('button', { type: 'button', class: 'wk-b', text: k.name, onclick: () => { ta.value = k.code; go(); } });
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove'), text: '×', onclick: () => { const l = kept.get(); l.splice(i, 1); kept.set(l); showKept(); } });
      keepBox.append(h('span', { style: { display: 'inline-flex', gap: '2px' } }, b, del));
    });
  }
  function exportPng() { const W = 1600, H = 1200, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!; paintBg(g, W, H); drawSegs(g, W, H, res?.segs.length ?? 0); download(c, 'abidora-turtle.png'); }
  function exportSvg() {
    const W = 1000, H = 760, F = fit(W, H), X = (x: number) => (W / 2 + (x - F.cx) * F.k).toFixed(1), Y = (y: number) => (H / 2 + 14 - (y - F.cy) * F.k).toFixed(1);
    const esc = (c: string) => c.replace(/[^#a-z0-9(),.% ]/gi, '');
    const lines = (res?.segs ?? []).map((q) => `<line x1="${X(q.x1)}" y1="${Y(q.y1)}" x2="${X(q.x2)}" y2="${Y(q.y2)}" stroke="${esc(q.c)}" stroke-width="${Math.max(.6, q.w * Math.min(1.6, F.k)).toFixed(2)}" stroke-linecap="round"/>`);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${cfg.bg === 'night' ? '#14161f' : '#f5f0e4'}"/>\n${lines.join('\n')}\n</svg>`;
    download(new Blob([svg], { type: 'image/svg+xml' }), 'abidora-turtle.svg');
  }
  S.onResize(() => lp.play());
  showKept(); go();
}
