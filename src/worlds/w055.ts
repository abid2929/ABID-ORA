/* 055 AI Universe. A small solar system of ideas from the history of artificial intelligence, where
   every planet runs the real algorithm in your browser (no remote model, nothing pretended):
   · Shannon's text machine (1948): count which letter or word follows which, then write by rolling dice.
   · The perceptron (1958): a single artificial neuron learning a straight dividing line from your points,
     and honestly failing on XOR, the problem that cooled the field for a decade.
   · A* search (1968, built for the Shakey robot): find the shortest way through a maze you draw.
   · Minimax game search (Shannon 1950, Deep Blue 1997): a noughts-and-crosses player that looks ahead
     through every reply, with the option to see the score it gives each move. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, local, loop, store, rng } from './kit';

/* ================= Shannon's text machine ================= */
export const CORPUS = `The night sea keeps its own clock. When the tide goes out, the sand remembers every wave in thin silver lines, and the crabs come out to read them. A boy walks along the water with a lantern and counts the stars that fall into the sea. He counts one for his mother, one for his sister, and one for the small boat that never came home. The old fisherman says the stars do not drown. He says they swim down to the bottom and light the way for the fish, and in the morning they climb back into the sky. The boy does not believe him, but he likes the story, and he tells it to his sister every night. She asks where the boat went. He says the boat went where the stars go, and that one day it will climb back too. The wind turns cold and the lantern shakes. The boy walks home over the dunes, and behind him the sea writes new lines in the sand, and the crabs come out to read them again.`;
export function tokens(text: string, unit: 'char' | 'word') { return unit === 'char' ? [...text.replace(/\s+/g, ' ')] : text.replace(/\s+/g, ' ').trim().split(' '); }
/** order-k model: for every run of k tokens, how often each next token followed it */
export function train(tk: string[], k: number) {
  const m = new Map<string, Map<string, number>>();
  for (let i = k; i < tk.length; i++) { const ctx = tk.slice(i - k, i).join('\u0001'); let row = m.get(ctx); if (!row) m.set(ctx, row = new Map()); row.set(tk[i], (row.get(tk[i]) ?? 0) + 1); }
  return m;
}
/** next-token probabilities after context, sharpened or flattened by temperature */
export function nextProbs(m: Map<string, Map<string, number>>, ctx: string[], temp: number): [string, number][] {
  const row = m.get(ctx.join('\u0001')); if (!row) return [];
  const e = [...row.entries()].map(([k, c]) => [k, Math.pow(c, 1 / Math.max(.05, temp))] as [string, number]);
  const s = e.reduce((a, b) => a + b[1], 0); return e.map(([k, v]) => [k, v / s] as [string, number]).sort((a, b) => b[1] - a[1]);
}
export function generate(m: Map<string, Map<string, number>>, seed: string[], k: number, n: number, temp: number, R: () => number, start: string[]) {
  const out = [...seed];
  for (let i = 0; i < n; i++) {
    let p = nextProbs(m, out.slice(out.length - k), temp);
    if (!p.length) { out.push(...start); p = nextProbs(m, out.slice(out.length - k), temp); if (!p.length) break; continue; }
    let r = R(), pick = p[p.length - 1][0]; for (const [t, q] of p) { r -= q; if (r <= 0) { pick = t; break; } } out.push(pick);
  }
  return out;
}

/* ================= Perceptron ================= */
export interface Pt { x: number; y: number; c: 1 | -1 }
export class Perceptron {
  w = [0, 0]; b = 0; epochs = 0; updates = 0;
  constructor(public rate = .1) {}
  predict(x: number, y: number) { return this.w[0] * x + this.w[1] * y + this.b >= 0 ? 1 : -1; }
  /** one pass over the points in order; returns how many it got wrong */
  epoch(pts: Pt[]) {
    let wrong = 0;
    for (const p of pts) if (this.predict(p.x, p.y) !== p.c) { wrong++; this.w[0] += this.rate * p.c * p.x; this.w[1] += this.rate * p.c * p.y; this.b += this.rate * p.c; this.updates++; }
    this.epochs++; return wrong;
  }
  accuracy(pts: Pt[]) { return pts.length ? pts.filter((p) => this.predict(p.x, p.y) === p.c).length / pts.length : 1; }
}
export function examplePts(kind: 'line' | 'xor', R: () => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < 40; i++) {
    const x = R() * 1.8 - .9, y = R() * 1.8 - .9;
    if (kind === 'line') { const d = .6 * x - y + .15; if (Math.abs(d) < .12) continue; out.push({ x, y, c: d > 0 ? 1 : -1 }); }
    else { if (Math.abs(x) < .12 || Math.abs(y) < .12) continue; out.push({ x, y, c: x * y > 0 ? 1 : -1 }); }
  }
  return out;
}

/* ================= A* on a grid ================= */
export type Algo = 'astar' | 'dijkstra' | 'greedy';
/** returns the order cells were expanded and the path found (cell indices), on a 4-connected grid */
export function search(W: number, H: number, wall: Uint8Array, s: number, g: number, algo: Algo) {
  const hx = (i: number) => Math.abs((i % W) - (g % W)) + Math.abs(Math.floor(i / W) - Math.floor(g / W));
  const dist = new Float64Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const heap: [number, number, number][] = []; /* [priority, tiebreak h, cell] */
  const push = (e: [number, number, number]) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (cmp(heap[p], heap[i]) <= 0) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const cmp = (a: [number, number, number], b: [number, number, number]) => a[0] - b[0] || a[1] - b[1];
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && cmp(heap[l], heap[m]) < 0) m = l; if (r < heap.length && cmp(heap[r], heap[m]) < 0) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const pri = (d: number, i: number) => algo === 'dijkstra' ? d : algo === 'greedy' ? hx(i) : d + hx(i);
  dist[s] = 0; push([pri(0, s), hx(s), s]);
  const order: number[] = [];
  while (heap.length) {
    const [, , i] = pop(); if (closed[i]) continue; closed[i] = 1; order.push(i);
    if (i === g) break;
    const x = i % W, y = Math.floor(i / W);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx;
      if (wall[j] || closed[j]) continue; const nd = dist[i] + 1;
      if (nd < dist[j]) { dist[j] = nd; from[j] = i; push([pri(nd, j), hx(j), j]); }
    }
  }
  const path: number[] = []; if (closed[g]) { for (let c = g; c !== -1; c = from[c]) path.unshift(c); }
  return { order, path };
}

/* ================= Minimax noughts and crosses ================= */
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export function winner(b: string[]) { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; return b.every(Boolean) ? 'draw' : ''; }
/** score for `me` with `turn` to move: +10 − depth for a win, −10 + depth for a loss, 0 for a draw; alpha-beta pruned */
export function minimax(b: string[], turn: string, me: string, depth: number, maxDepth: number, alpha: number, beta: number, count: { n: number }): number {
  count.n++;
  const w = winner(b); if (w === me) return 10 - depth; if (w === 'draw') return 0; if (w) return depth - 10;
  if (depth >= maxDepth) return 0;
  const other = turn === 'X' ? 'O' : 'X';
  if (turn === me) { let best = -99; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; best = Math.max(best, minimax(b, other, me, depth + 1, maxDepth, alpha, beta, count)); b[i] = ''; alpha = Math.max(alpha, best); if (beta <= alpha) break; } return best; }
  let best = 99; for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; best = Math.min(best, minimax(b, other, me, depth + 1, maxDepth, alpha, beta, count)); b[i] = ''; beta = Math.min(beta, best); if (beta <= alpha) break; } return best;
}
/** score of every empty square for the player to move */
export function scoreMoves(b: string[], me: string, maxDepth = 9) {
  const count = { n: 0 }, other = me === 'X' ? 'O' : 'X', out: (number | null)[] = Array(9).fill(null);
  for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = me; out[i] = minimax(b, other, me, 1, maxDepth, -99, 99, count); b[i] = ''; }
  return { scores: out, examined: count.n };
}
export function bestMove(b: string[], me: string, maxDepth = 9, R: () => number = Math.random) {
  const { scores, examined } = scoreMoves(b, me, maxDepth); let best = -99; const opts: number[] = [];
  scores.forEach((s, i) => { if (s === null) return; if (s > best) { best = s; opts.length = 0; opts.push(i); } else if (s === best) opts.push(i); });
  return { move: opts[Math.floor(R() * opts.length)] ?? -1, examined, scores };
}

/* ================= world ================= */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(400px, 60vw, 620px)';
  const S = canvas(L.view, t('cv', 'A map of four ideas from the history of AI, each running for real: a text machine, a learning neuron, a path finder and a game player.'), { alpha: false });
  type Planet = 'map' | 'text' | 'neuron' | 'path' | 'game';
  type Cfg = { p: Planet; unit: 'char' | 'word'; k: number; temp: number; text: string; algo: Algo; depth: number; think: boolean };
  const st = store<Cfg>(ctx.id, 'cfg', { p: 'map', unit: 'char', k: 4, temp: 1, text: '', algo: 'astar', depth: 9, think: true }, (v) => typeof v === 'object' && v !== null && 'p' in v);
  const cfg: Cfg = st.get(); const save = () => st.set(cfg);
  const R = rng(Date.now() % 100000);
  const PL: { id: Planet; year: string; en: string; col: string; orbit: number; size: number }[] = [
    { id: 'text', year: '1948', en: 'Shannon’s text machine', col: '#e0b05a', orbit: .2, size: 13 },
    { id: 'neuron', year: '1958', en: 'The perceptron', col: '#5fb3a1', orbit: .31, size: 15 },
    { id: 'path', year: '1968', en: 'A* path search', col: '#7d8fe0', orbit: .42, size: 12 },
    { id: 'game', year: '1950–1997', en: 'Minimax game search', col: '#d9705a', orbit: .53, size: 16 },
  ];
  const pname = (id: Planet) => { const p = PL.find((x) => x.id === id); return p ? t('pl.' + id, p.en) : ''; };

  heading(L.panel, t('where', 'Where to'));
  const nav = seg(L.panel, t('planet', 'Planet'), [['map', t('pl.map', 'Map')], ...PL.map((p) => [p.id, `${p.year} · ${pname(p.id)}`] as [string, string])], cfg.p, (v) => go(v as Planet));
  nav.box.style.flexWrap = 'wrap';
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };

  function go(p: Planet) { cfg.p = p; save(); nav.set(p); build(); lp.play(); }

  /* ---------- text machine state ---------- */
  let model = train(tokens(CORPUS, 'char'), 4), gen: string[] = [], genTarget = 0;
  const corpus = () => (cfg.text.trim().length > 80 ? cfg.text : CORPUS);
  function retrain() { const tk = tokens(corpus(), cfg.unit); model = train(tk, cfg.k); gen = tk.slice(0, cfg.k); genTarget = cfg.unit === 'char' ? 640 : 130; }
  /* ---------- perceptron state ---------- */
  let pts: Pt[] = examplePts('line', rng(7)), net = new Perceptron(), cls: 1 | -1 = 1, learning = false;
  /* ---------- path state ---------- */
  const GW = 30, GH = 18; let wall = new Uint8Array(GW * GH), sCell = GW * 9 + 2, gCell = GW * 9 + 27, res: ReturnType<typeof search> | null = null, shown = 0, ptool: 'wall' | 'erase' | 'start' | 'goal' = 'wall';
  function mazeDefault() { wall = new Uint8Array(GW * GH); for (let y = 2; y < 16; y++) wall[y * GW + 14] = 1; for (let x = 6; x < 14; x++) wall[4 * GW + x] = 1; for (let x = 15; x < 24; x++) wall[13 * GW + x] = 1; for (let y = 4; y < 10; y++) wall[y * GW + 20] = 1; }
  mazeDefault();
  function runSearch() { res = search(GW, GH, wall, sCell, gCell, cfg.algo); shown = 0; lp.play(); }
  /* ---------- game state ---------- */
  let board: string[] = Array(9).fill(''), msg = '', lastExam = 0, thinkScores: (number | null)[] = Array(9).fill(null);
  const human = 'X', bot = 'O';
  function botTurn() {
    if (winner(board)) return;
    const r = bestMove(board, bot, cfg.depth, R); lastExam = r.examined; if (r.move >= 0) board[r.move] = bot; afterMove();
  }
  function afterMove() {
    const w = winner(board);
    msg = w === human ? t('g.youwin', 'You win. Try a full look-ahead: then it cannot be beaten.') : w === bot ? t('g.botwin', 'The machine wins.') : w === 'draw' ? t('g.draw', 'A draw. With perfect play on both sides, this game always ends in a draw.') : '';
    thinkScores = !w ? scoreMoves(board, human, cfg.depth).scores : Array(9).fill(null);
    lp.play();
  }

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    const p = cfg.p;
    if (p === 'map') {
      about.textContent = t('a.map', 'Four ideas that shaped artificial intelligence, placed on orbits by the year they appeared. Every planet runs the real method in your browser, so you can see what it does well and where it breaks. Choose a planet, or click one on the map.');
      lab(t('st.planets', 'Planets'), t('st.span', 'Years covered'), t('st.remote', 'Remote AI used'));
      out('a', '4'); out('b', '1948–1997'); out('c', t('none', 'None'));
      return;
    }
    if (p === 'text') {
      about.textContent = t('a.text', 'Claude Shannon showed in 1948 that you can write surprisingly real-looking text just by counting which letter follows which, then rolling dice. With a longer memory the text looks more like the original; with too long a memory it simply copies it. Modern language models predict the next token too, with far richer context.');
      seg(box, t('unit', 'Unit'), [['char', t('u.char', 'Letters')], ['word', t('u.word', 'Words')]], cfg.unit, (v) => { cfg.unit = v as Cfg['unit']; save(); retrain(); build(); lp.play(); });
      range(box, t('k', 'Memory (tokens it looks back)'), { min: 1, max: 8, value: cfg.k, fmt: (v) => `${v}` }, (v) => { cfg.k = v; save(); retrain(); lp.play(); });
      range(box, t('temp', 'Temperature'), { min: .2, max: 2.5, step: .1, value: cfg.temp, fmt: (v) => v.toFixed(1) }, (v) => { cfg.temp = v; save(); });
      buttons(box, [[t('write', 'Write again'), () => { retrain(); lp.play(); }, true]]);
      const ta = h('textarea', { rows: 5, placeholder: t('paste', 'Paste your own text here (at least a few sentences) to train on it instead. It stays in this browser.'), style: { width: '100%', font: 'inherit', fontSize: '13px' } }) as HTMLTextAreaElement;
      ta.value = cfg.text; ta.addEventListener('change', () => { cfg.text = ta.value.slice(0, 20000); save(); retrain(); lp.play(); });
      box.append(h('label', { class: 'wk-r' }, h('span', { text: t('own', 'Your own training text') }), ta));
      lab(t('st.ctx', 'Contexts learned'), t('st.cand', 'Choices after this context'), t('st.copy', 'Copied from the source'));
      retrain(); return;
    }
    if (p === 'neuron') {
      about.textContent = t('a.neuron', 'Frank Rosenblatt’s perceptron is one artificial neuron: it weighs two inputs, adds a bias and says yes or no. Each mistake nudges the weights toward the right answer. If a straight line can separate the colours, it is guaranteed to find one. XOR has no such line, and the perceptron never settles: this limit, published in 1969, slowed AI research for years.');
      seg(box, t('class', 'Click adds'), [['1', t('c.a', 'Gold points')], ['-1', t('c.b', 'Blue points')]], String(cls), (v) => { cls = +v as 1 | -1; });
      buttons(box, [[learning ? t('stop', 'Stop learning') : t('learn', 'Start learning'), () => { learning = !learning; build(); lp.play(); }, true], [t('step', 'One pass'), () => { net.epoch(pts); lp.play(); }], [t('reset', 'Forget'), () => { net = new Perceptron(); lp.play(); }]]);
      buttons(box, [[t('ex.line', 'Separable example'), () => { pts = examplePts('line', R); net = new Perceptron(); lp.play(); }], [t('ex.xor', 'XOR (no line works)'), () => { pts = examplePts('xor', R); net = new Perceptron(); lp.play(); }], [t('clear', 'Clear points'), () => { pts = []; net = new Perceptron(); lp.play(); }]]);
      lab(t('st.acc', 'Accuracy'), t('st.epochs', 'Passes'), t('st.w', 'Weights'));
      return;
    }
    if (p === 'path') {
      about.textContent = t('a.path', 'A* was invented for Shakey, the first mobile robot to reason about its actions. It explores the cells that look most promising: distance travelled so far plus a guess of the distance left. Dijkstra’s method ignores the guess and explores in rings; greedy search trusts only the guess and can take a longer route.');
      seg(box, t('algo', 'Method'), [['astar', 'A*'], ['dijkstra', t('a.dij', 'Dijkstra')], ['greedy', t('a.greedy', 'Greedy')]], cfg.algo, (v) => { cfg.algo = v as Algo; save(); runSearch(); });
      seg(box, t('ptool', 'Drawing'), [['wall', t('pt.wall', 'Walls')], ['erase', t('pt.erase', 'Erase')], ['start', t('pt.start', 'Start')], ['goal', t('pt.goal', 'Goal')]], ptool, (v) => { ptool = v as typeof ptool; });
      buttons(box, [[t('run', 'Search'), () => runSearch(), true], [t('maze', 'Random maze'), () => { wall = new Uint8Array(GW * GH); for (let i = 0; i < GW * GH; i++) if (R() < .28) wall[i] = 1; wall[sCell] = 0; wall[gCell] = 0; runSearch(); }], [t('empty', 'Empty grid'), () => { wall = new Uint8Array(GW * GH); runSearch(); }]]);
      lab(t('st.exp', 'Cells explored'), t('st.len', 'Path length'), t('st.ratio', 'Explored per path step'));
      runSearch(); return;
    }
    about.textContent = t('a.game', 'Minimax imagines every move, every reply, every reply to that, to the end of the game, assuming both sides play their best. Alpha-beta pruning skips lines that cannot change the decision. Deep Blue used the same idea, with a much deeper search and a chess evaluation, to beat the world champion in 1997.');
    seg(box, t('depth', 'Look-ahead'), [['1', t('d.1', '1 move')], ['2', t('d.2', '2 moves')], ['4', t('d.4', '4 moves')], ['9', t('d.9', 'To the end')]], String(cfg.depth), (v) => { cfg.depth = +v; save(); afterMove(); });
    buttons(box, [[t('new', 'New game'), () => { board = Array(9).fill(''); lastExam = 0; afterMove(); }, true], [t('botfirst', 'Machine starts'), () => { board = Array(9).fill(''); botTurn(); }], [cfg.think ? t('hide', 'Hide its thinking') : t('show', 'Show its thinking'), () => { cfg.think = !cfg.think; save(); build(); lp.play(); }]]);
    lab(t('st.exam', 'Positions examined'), t('st.you', 'You play'), t('st.status', 'Status'));
    afterMove();
  }

  /* ---------- drawing ---------- */
  let hoverPl: Planet | null = null, time = 0;
  const geo = () => ({ cx: S.w / 2, cy: S.h / 2, R: Math.min(S.w, S.h) });
  const planetPos = (i: number) => { const g = geo(), p = PL[i], a = time * (.12 / (1 + i * .6)) + i * 1.9; return { x: g.cx + Math.cos(a) * p.orbit * g.R, y: g.cy + Math.sin(a) * p.orbit * g.R * .62 }; };
  const stars = Array.from({ length: 220 }, () => [R(), R(), R()]);
  const lp = loop(ctx, S.cv, (dt) => {
    const g = S.g, W = S.w, H = S.h; if (!ctx.calm) time += dt;
    const p = cfg.p;
    g.fillStyle = p === 'map' ? '#07080f' : '#f4f1ea'; g.fillRect(0, 0, W, H);
    if (p === 'map') { drawMap(g, W, H); return; }
    if (p === 'text') { drawText(g, W, H); return; }
    if (p === 'neuron') { drawNeuron(g, W, H); return; }
    if (p === 'path') { drawPath(g, W, H); return; }
    drawGame(g, W, H); lp.pause();
  });
  function drawMap(g: CanvasRenderingContext2D, W: number, H: number) {
    for (const [x, y, b] of stars) { g.fillStyle = `rgba(255,255,255,${.25 + b * .6})`; g.fillRect(x * W, y * H, b > .9 ? 2 : 1, b > .9 ? 2 : 1); }
    const G = geo();
    const sun = g.createRadialGradient(G.cx, G.cy, 2, G.cx, G.cy, 46); sun.addColorStop(0, '#fff6dc'); sun.addColorStop(.4, '#f3c76a'); sun.addColorStop(1, 'rgba(243,199,106,0)'); g.fillStyle = sun; g.beginPath(); g.arc(G.cx, G.cy, 46, 0, 7); g.fill();
    g.fillStyle = '#d8cfba'; g.font = '12px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(t('sun', 'Can machines think? (Turing, 1950)'), G.cx, G.cy + 62);
    PL.forEach((pl, i) => {
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.ellipse(G.cx, G.cy, pl.orbit * G.R, pl.orbit * G.R * .62, 0, 0, 7); g.stroke();
      const q = planetPos(i), r = pl.size * (hoverPl === pl.id ? 1.25 : 1);
      const gr = g.createRadialGradient(q.x - r * .4, q.y - r * .4, 1, q.x, q.y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, pl.col); gr.addColorStop(1, '#111'); g.fillStyle = gr; g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.fill();
      g.fillStyle = '#efe9da'; g.font = `${W < 500 ? 10 : 12}px ui-monospace, monospace`; g.fillText(`${pl.year} · ${pname(pl.id)}`, q.x, q.y - r - 8);
    });
    g.textAlign = 'start';
  }
  let genAcc = 0;
  function drawText(g: CanvasRenderingContext2D, W: number, H: number) {
    const tk = tokens(corpus(), cfg.unit);
    if (gen.length < genTarget && !ctx.calm) { genAcc += cfg.unit === 'char' ? 2 : .5; while (genAcc >= 1 && gen.length < genTarget) { genAcc--; gen = generate(model, gen, cfg.k, 1, cfg.temp, R, tk.slice(0, cfg.k)); } }
    else if (gen.length < genTarget) gen = generate(model, gen, cfg.k, genTarget - gen.length, cfg.temp, R, tk.slice(0, cfg.k));
    const sep = cfg.unit === 'char' ? '' : ' ', text = gen.join(sep);
    /* wrap and draw the generated text */
    const pad = 22, chartH = Math.min(170, H * .3), fs = Math.round(Math.max(13, Math.min(W < 500 ? 17 : 26, Math.sqrt((W - pad * 2) * (H - chartH - 110) / Math.max(200, genTarget * (cfg.unit === 'char' ? 1 : 5.5)) / .75)))); g.fillStyle = '#1d1b18'; g.font = `${fs}px Georgia, serif`;
    const words = text.split(' '); let line = '', y = pad + fs + 48; const lines: string[] = [];
    for (const w of words) { const tst = line ? line + ' ' + w : w; if (g.measureText(tst).width > W - pad * 2 && line) { lines.push(line); line = w; } else line = tst; } lines.push(line);
    const maxL = Math.floor((H - chartH - y - 20) / (fs * 1.45)); const vis = lines.slice(Math.max(0, lines.length - maxL));
    vis.forEach((l, i) => g.fillText(l, pad, y + i * fs * 1.45));
    /* highlight the memory window: the last k tokens the machine is looking at */
    if (vis.length) {
      const last = vis[vis.length - 1], win = gen.slice(-cfg.k).join(sep), at = last.lastIndexOf(win.trim() || win);
      if (at >= 0) { const x0 = pad + g.measureText(last.slice(0, at)).width, wv = g.measureText(win.trim() || win).width, ly = y + (vis.length - 1) * fs * 1.45; g.fillStyle = 'rgba(194,139,44,.28)'; g.fillRect(x0 - 2, ly - fs * .95, wv + 4, fs * 1.25); }
    }
    /* how often the latest stretch appears word for word in the training text */
    const recent = gen.slice(-Math.min(gen.length, cfg.unit === 'char' ? 24 : 6)).join(sep), copied = corpus().replace(/\s+/g, ' ').includes(recent);
    /* next-token chart */
    const probs = nextProbs(model, gen.slice(gen.length - cfg.k), cfg.temp).slice(0, 8), cy = H - chartH - 6;
    g.fillStyle = '#6b655a'; g.font = '12px ui-monospace, monospace';
    g.fillText(`${t('after', 'After')} “${gen.slice(-cfg.k).join(sep).replace(/ /g, '␣')}” ${t('comes', 'the next token is')}:`, pad, cy + 14);
    const bw = Math.min(96, (W - pad * 2) / Math.max(4, probs.length));
    probs.forEach(([tok, q], i) => {
      const bh = q * (chartH - 46), x = pad + i * bw; g.fillStyle = i === 0 ? '#c28b2c' : '#8fa7b8'; g.fillRect(x + 4, H - 26 - bh, bw - 8, bh);
      g.fillStyle = '#1d1b18'; g.textAlign = 'center'; g.fillText(tok === ' ' ? '␣' : tok.slice(0, 9), x + bw / 2, H - 10); g.fillText(`${Math.round(q * 100)}%`, x + bw / 2, H - 30 - bh); g.textAlign = 'start';
    });
    out('a', model.size.toLocaleString()); out('b', `${probs.length}`); out('c', copied ? t('yes', 'Yes, word for word') : t('no', 'No, a new mix'));
    if (gen.length >= genTarget) lp.pause();
  }
  const region = document.createElement('canvas');
  const nMap = (W: number, H: number) => { const s = Math.min(W, H) * .44; return { s, cx: W / 2, cy: H / 2 }; };
  function drawNeuron(g: CanvasRenderingContext2D, W: number, H: number) {
    if (learning && !ctx.calm) { const wrong = net.epoch(pts); if (wrong === 0 && pts.length) { learning = false; build(); } }
    const M = nMap(W, H), step = W < 500 ? 8 : 10;
    /* the two decision regions, computed at low resolution into one small image and scaled up */
    const cw = Math.ceil(W / step), ch = Math.ceil(H / step);
    if (region.width !== cw || region.height !== ch) { region.width = cw; region.height = ch; }
    const rg = region.getContext('2d')!, im = rg.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const c = net.predict((x * step + step / 2 - M.cx) / M.s, -(y * step + step / 2 - M.cy) / M.s), o = (y * cw + x) * 4; if (c > 0) { im.data[o] = 236; im.data[o + 1] = 222; im.data[o + 2] = 196; } else { im.data[o] = 214; im.data[o + 1] = 222; im.data[o + 2] = 230; } im.data[o + 3] = 255; }
    rg.putImageData(im, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(region, 0, 0, cw * step, ch * step); g.imageSmoothingEnabled = true;
    g.strokeStyle = 'rgba(0,0,0,.15)'; g.strokeRect(M.cx - M.s, M.cy - M.s, M.s * 2, M.s * 2);
    /* the line w·x + b = 0 */
    const [a, b] = net.w, c = net.b;
    /* draw it as a bounded segment: nearest point to the origin ± a few units along the line, so tiny weights never produce huge coordinates */
    const nn = Math.hypot(a, b);
    if (nn > 1e-6) {
      const px = -c * a / (nn * nn), py = -c * b / (nn * nn), dx = -b / nn, dy = a / nn;
      if (Math.hypot(px, py) < 3) { g.strokeStyle = '#1d1b18'; g.lineWidth = 2; g.beginPath(); g.moveTo(M.cx + (px - dx * 3) * M.s, M.cy - (py - dy * 3) * M.s); g.lineTo(M.cx + (px + dx * 3) * M.s, M.cy - (py + dy * 3) * M.s); g.stroke(); g.lineWidth = 1; }
    }
    for (const p of pts) { const x = M.cx + p.x * M.s, y = M.cy - p.y * M.s, ok = net.predict(p.x, p.y) === p.c; g.fillStyle = p.c > 0 ? '#c28b2c' : '#3d6fb0'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); if (!ok) { g.strokeStyle = '#c0392b'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 9, 0, 7); g.stroke(); g.lineWidth = 1; } }
    out('a', `${Math.round(net.accuracy(pts) * 100)}%`); out('b', `${net.epochs}`); const sg = (v: number) => `${v < 0 ? '−' : '+'}${Math.min(9.99, Math.abs(v)).toFixed(2)}`; out('c', `${sg(net.w[0])} ${sg(net.w[1])} ${sg(net.b)}`); /* fixed width, so the panel never reflows */
    L.hud.textContent = learning && net.epochs > 60 && net.accuracy(pts) < 1 ? t('nosettle', 'Still changing its mind after 60 passes: no straight line separates these points.') : '';
    if (!learning) lp.pause();
  }
  const gGeo = (W: number, H: number) => { const c = Math.floor(Math.min((W - 20) / GW, (H - 20) / GH)); return { c, ox: (W - c * GW) / 2, oy: (H - c * GH) / 2 }; };
  function drawPath(g: CanvasRenderingContext2D, W: number, H: number) {
    const G = gGeo(W, H);
    if (res && shown < res.order.length) shown = ctx.calm ? res.order.length : Math.min(res.order.length, shown + Math.max(2, Math.ceil(res.order.length / 90)));
    const seen = new Set(res ? res.order.slice(0, shown) : []);
    for (let i = 0; i < GW * GH; i++) {
      const x = G.ox + (i % GW) * G.c, y = G.oy + Math.floor(i / GW) * G.c;
      g.fillStyle = wall[i] ? '#2b2a33' : seen.has(i) ? '#cfe0f0' : '#fbfaf6'; g.fillRect(x, y, G.c - 1, G.c - 1);
    }
    if (res && shown >= res.order.length && res.path.length) {
      g.strokeStyle = '#d9705a'; g.lineWidth = Math.max(3, G.c * .3); g.lineJoin = 'round'; g.beginPath();
      res.path.forEach((i, k) => { const x = G.ox + (i % GW + .5) * G.c, y = G.oy + (Math.floor(i / GW) + .5) * G.c; if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.lineWidth = 1;
    }
    for (const [i, col, l] of [[sCell, '#2e8b57', 'S'], [gCell, '#c0392b', 'G']] as [number, string, string][]) { const x = G.ox + (i % GW + .5) * G.c, y = G.oy + (Math.floor(i / GW) + .5) * G.c; g.fillStyle = col; g.beginPath(); g.arc(x, y, G.c * .42, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = `bold ${Math.round(G.c * .5)}px sans-serif`; g.textAlign = 'center'; g.fillText(l, x, y + G.c * .18); g.textAlign = 'start'; }
    const done = !!res && shown >= res.order.length;
    out('a', `${shown}`); out('b', done ? (res!.path.length ? `${res!.path.length - 1}` : t('nopath', 'No way through')) : '…'); out('c', done && res!.path.length ? (shown / Math.max(1, res!.path.length - 1)).toFixed(1) : '—');
    if (done) lp.pause();
  }
  const bGeo = (W: number, H: number) => { const s = Math.min(W, H) * .7, c = s / 3; return { s, c, ox: (W - s) / 2, oy: (H - s) / 2 + 10 }; };
  function drawGame(g: CanvasRenderingContext2D, W: number, H: number) {
    const B = bGeo(W, H);
    g.strokeStyle = '#1d1b18'; g.lineWidth = 4; g.lineCap = 'round';
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(B.ox + i * B.c, B.oy + 8); g.lineTo(B.ox + i * B.c, B.oy + B.s - 8); g.stroke(); g.beginPath(); g.moveTo(B.ox + 8, B.oy + i * B.c); g.lineTo(B.ox + B.s - 8, B.oy + i * B.c); g.stroke(); }
    for (let i = 0; i < 9; i++) {
      const x = B.ox + (i % 3 + .5) * B.c, y = B.oy + (Math.floor(i / 3) + .5) * B.c, r = B.c * .3;
      if (board[i] === 'X') { g.strokeStyle = '#1d1b18'; g.lineWidth = 6; g.beginPath(); g.moveTo(x - r, y - r); g.lineTo(x + r, y + r); g.moveTo(x + r, y - r); g.lineTo(x - r, y + r); g.stroke(); }
      else if (board[i] === 'O') { g.strokeStyle = '#d9705a'; g.lineWidth = 6; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }
      else if (cfg.think && thinkScores[i] !== null) {
        const s = thinkScores[i]!; g.fillStyle = s > 0 ? 'rgba(46,139,87,.18)' : s < 0 ? 'rgba(192,57,43,.16)' : 'rgba(0,0,0,.05)'; g.fillRect(x - B.c / 2 + 6, y - B.c / 2 + 6, B.c - 12, B.c - 12);
        g.fillStyle = '#4a463e'; g.font = `${Math.round(B.c * .13)}px ui-monospace, monospace`; g.textAlign = 'center';
        g.fillText(s > 0 ? t('g.wins', 'you can win') : s < 0 ? t('g.loses', 'you lose') : t('g.draws', 'draw'), x, y + 4); g.textAlign = 'start';
      }
    }
    g.lineWidth = 1; g.fillStyle = '#1d1b18'; g.font = '14px Georgia, serif'; g.textAlign = 'center'; g.fillText(msg || t('g.your', 'Your move: you are X.'), W / 2, Math.max(18, B.oy - 14)); g.textAlign = 'start';
    out('a', lastExam.toLocaleString()); out('b', 'X'); out('c', winner(board) ? t('g.over', 'Game over') : t('g.on', 'Playing'));
  }

  /* ---------- input ---------- */
  let painting: 0 | 1 | null = null;
  S.cv.addEventListener('pointermove', (e) => {
    const q = local(e, S.cv);
    if (cfg.p === 'map') { let hit: Planet | null = null; PL.forEach((pl, i) => { const pp = planetPos(i); if (Math.hypot(pp.x - q.x, pp.y - q.y) < pl.size + 10) hit = pl.id; }); hoverPl = hit; S.cv.style.cursor = hit ? 'pointer' : ''; return; }
    if (cfg.p === 'path' && painting !== null) { const c = cellAt(q.x, q.y); if (c >= 0 && c !== sCell && c !== gCell) { wall[c] = painting; runSearch(); } }
  });
  const cellAt = (x: number, y: number) => { const G = gGeo(S.w, S.h), cx = Math.floor((x - G.ox) / G.c), cy = Math.floor((y - G.oy) / G.c); return cx < 0 || cy < 0 || cx >= GW || cy >= GH ? -1 : cy * GW + cx; };
  S.cv.addEventListener('pointerdown', (e) => {
    const q = local(e, S.cv);
    if (cfg.p === 'map') { PL.forEach((pl, i) => { const pp = planetPos(i); if (Math.hypot(pp.x - q.x, pp.y - q.y) < pl.size + 14) go(pl.id); }); return; }
    if (cfg.p === 'neuron') { const M = nMap(S.w, S.h), x = (q.x - M.cx) / M.s, y = -(q.y - M.cy) / M.s; if (Math.abs(x) <= 1.1 && Math.abs(y) <= 1.1) { pts.push({ x, y, c: e.button === 2 ? (-cls as 1 | -1) : cls }); lp.play(); } return; }
    if (cfg.p === 'path') {
      const c = cellAt(q.x, q.y); if (c < 0) return;
      if (ptool === 'start') { if (c !== gCell) { sCell = c; wall[c] = 0; } runSearch(); return; }
      if (ptool === 'goal') { if (c !== sCell) { gCell = c; wall[c] = 0; } runSearch(); return; }
      if (c === sCell || c === gCell) return;
      painting = ptool === 'wall' ? 1 : 0; wall[c] = painting; S.cv.setPointerCapture(e.pointerId); runSearch(); return;
    }
    if (cfg.p === 'game') {
      const B = bGeo(S.w, S.h), cx = Math.floor((q.x - B.ox) / B.c), cy = Math.floor((q.y - B.oy) / B.c); if (cx < 0 || cy < 0 || cx > 2 || cy > 2) return;
      const i = cy * 3 + cx; if (board[i] || winner(board)) return; board[i] = human; afterMove(); if (!winner(board)) botTurn();
    }
  });
  const up = () => { painting = null; }; S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('contextmenu', (e) => { if (cfg.p === 'neuron') e.preventDefault(); });
  S.cv.addEventListener('keydown', (e) => {
    if (cfg.p === 'game' && /^[1-9]$/.test(e.key)) { const i = +e.key - 1; if (!board[i] && !winner(board)) { board[i] = human; afterMove(); if (!winner(board)) botTurn(); } }
  });
  S.onResize(() => lp.play());
  build(); lp.play();
}
