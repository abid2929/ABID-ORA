/* 060 Machine Learning Explorer. A small neural-network library written for this world (forward pass,
   backpropagation, Adam), running entirely in your browser, used two ways:
   · Boundary lab: train a network on 2-D points (circles, XOR, spiral, blobs or your own clicks) and
     watch the decision boundary, the weights in the network diagram and the loss curve change as it
     learns. Change layers, neurons, activation and inputs, and see held-out test accuracy.
   · Doodle trainer: draw examples of three things of your choice on a 16×16 pad, train a network on
     them (with small shifts as data augmentation), then draw something new and see what it guesses.
     It knows only what you showed it, and the world says so. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, select, stats, buttons, check, local, loop, clamp, store, rng } from './kit';

/* ---------- a small MLP ---------- */
export type Act = 'tanh' | 'relu';
export class MLP {
  W: Float64Array[] = []; b: Float64Array[] = []; mW: Float64Array[] = []; vW: Float64Array[] = []; mb: Float64Array[] = []; vb: Float64Array[] = []; t = 0;
  constructor(public sizes: number[], public act: Act = 'tanh', seed = 1) {
    const R = rng(seed);
    const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
    for (let l = 0; l < sizes.length - 1; l++) {
      const n = sizes[l], m = sizes[l + 1], sc = act === 'relu' && l < sizes.length - 2 ? Math.sqrt(2 / n) : Math.sqrt(1 / n);
      const w = new Float64Array(n * m); for (let i = 0; i < w.length; i++) w[i] = gauss() * sc;
      this.W.push(w); this.b.push(new Float64Array(m)); this.mW.push(new Float64Array(n * m)); this.vW.push(new Float64Array(n * m)); this.mb.push(new Float64Array(m)); this.vb.push(new Float64Array(m));
    }
  }
  /** activations of every layer; the last is softmax probabilities */
  forward(x: ArrayLike<number>) {
    const A: Float64Array[] = [Float64Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const n = this.sizes[l], m = this.sizes[l + 1], a = A[l], z = new Float64Array(m), w = this.W[l], last = l === this.W.length - 1;
      for (let j = 0; j < m; j++) { let s = this.b[l][j]; for (let i = 0; i < n; i++) s += w[j * n + i] * a[i]; z[j] = s; }
      if (last) { const mx = Math.max(...z); let s = 0; for (let j = 0; j < m; j++) { z[j] = Math.exp(z[j] - mx); s += z[j]; } for (let j = 0; j < m; j++) z[j] /= s; }
      else for (let j = 0; j < m; j++) z[j] = this.act === 'tanh' ? Math.tanh(z[j]) : Math.max(0, z[j]);
      A.push(z);
    }
    return A;
  }
  predict(x: ArrayLike<number>) { return this.forward(x)[this.W.length]; }
  /** one Adam step on a batch; returns mean cross-entropy */
  train(X: ArrayLike<number>[], Y: number[], lr = .01, l2 = 0) {
    const gW = this.W.map((w) => new Float64Array(w.length)), gb = this.b.map((b) => new Float64Array(b.length)); let loss = 0;
    for (let k = 0; k < X.length; k++) {
      const A = this.forward(X[k]), L = this.W.length, out = A[L]; loss -= Math.log(Math.max(1e-12, out[Y[k]]));
      let d = Float64Array.from(out); d[Y[k]] -= 1; /* softmax + cross-entropy gradient */
      for (let l = L - 1; l >= 0; l--) {
        const n = this.sizes[l], m = this.sizes[l + 1], a = A[l], w = this.W[l];
        for (let j = 0; j < m; j++) { gb[l][j] += d[j]; for (let i = 0; i < n; i++) gW[l][j * n + i] += d[j] * a[i]; }
        if (l > 0) { const nd = new Float64Array(n); for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < m; j++) s += w[j * n + i] * d[j]; nd[i] = this.act === 'tanh' ? s * (1 - a[i] * a[i]) : (a[i] > 0 ? s : 0); } d = nd; }
      }
    }
    this.t++; const b1 = .9, b2 = .999, c1 = 1 - b1 ** this.t, c2 = 1 - b2 ** this.t, N = X.length;
    const upd = (p: Float64Array, g: Float64Array, m: Float64Array, v: Float64Array, decay: number) => { for (let i = 0; i < p.length; i++) { const gi = g[i] / N + decay * p[i]; m[i] = b1 * m[i] + (1 - b1) * gi; v[i] = b2 * v[i] + (1 - b2) * gi * gi; p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + 1e-8); } };
    for (let l = 0; l < this.W.length; l++) { upd(this.W[l], gW[l], this.mW[l], this.vW[l], l2); upd(this.b[l], gb[l], this.mb[l], this.vb[l], 0); }
    return loss / N;
  }
}

/* ---------- 2-D datasets ---------- */
export interface P { x: number; y: number; c: number }
export function dataset(kind: string, n: number, noise: number, R: () => number): P[] {
  const out: P[] = []; const g = () => (R() + R() + R() - 1.5) * noise;
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    if (kind === 'circles') { const r = c ? .25 + R() * .25 : .65 + R() * .3, a = R() * Math.PI * 2; out.push({ x: r * Math.cos(a) + g(), y: r * Math.sin(a) + g(), c }); }
    else if (kind === 'xor') { let x = R() * 2 - 1, y = R() * 2 - 1; if (Math.abs(x) < .08) x += .1 * Math.sign(x || 1); if (Math.abs(y) < .08) y += .1 * Math.sign(y || 1); out.push({ x: x + g(), y: y + g(), c: x * y > 0 ? 1 : 0 }); }
    else if (kind === 'spiral') { const t = R() * 3.2 + .3, a = t * 1.9 + c * Math.PI; out.push({ x: t / 3.6 * Math.cos(a) + g(), y: t / 3.6 * Math.sin(a) + g(), c }); }
    else { out.push({ x: (c ? .45 : -.45) + (R() - .5) * .7 + g() * 2, y: (c ? .35 : -.35) + (R() - .5) * .7 + g() * 2, c }); }
  }
  return out;
}
export const feats = (x: number, y: number, sq: boolean) => (sq ? [x, y, x * x, y * y, x * y] : [x, y]);

/* ---------- doodles ---------- */
export const PAD = 16;
/** shift a 16×16 drawing by (dx, dy) cells for augmentation */
export function shift(img: ArrayLike<number>, dx: number, dy: number) { const o = new Float64Array(PAD * PAD); for (let y = 0; y < PAD; y++) for (let x = 0; x < PAD; x++) { const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0 && sx < PAD && sy < PAD) o[y * PAD + x] = img[sy * PAD + sx]; } return o; }
/** move the drawing's centre of ink to the middle, so position matters less */
export function centre(img: ArrayLike<number>) { let sx = 0, sy = 0, s = 0; for (let i = 0; i < PAD * PAD; i++) if (img[i] > 0) { sx += i % PAD; sy += Math.floor(i / PAD); s++; } if (!s) return Float64Array.from(img); return shift(img, Math.round(PAD / 2 - .5 - sx / s), Math.round(PAD / 2 - .5 - sy / s)); }

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(420px, 60vw, 640px)';
  const S = canvas(L.view, t('cv', 'A neural network learning: coloured regions show what it predicts, or a drawing pad where it guesses your doodles.'), { alpha: false });
  type Cfg = { mode: 'boundary' | 'doodle'; data: string; noise: number; layers: number; neurons: number; act: Act; lr: number; sq: boolean; names: string[] };
  const def: Cfg = { mode: 'boundary', data: 'circles', noise: .08, layers: 2, neurons: 6, act: 'tanh', lr: .03, sq: false, names: ['Sun', 'House', 'Fish'] };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'mode' in v && 'names' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);
  const R = rng(11);
  const COLS = ['#e0a63a', '#3d7fe0', '#5fb3a1'];

  heading(L.panel, t('h', 'Experiment'));
  seg(L.panel, t('mode', 'Mode'), [['boundary', t('m.b', 'Boundary lab')], ['doodle', t('m.d', 'Doodle trainer')]], cfg.mode, (v) => { cfg.mode = v as Cfg['mode']; save(); training = false; build(); lp.play(); });
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };

  /* ---------- boundary lab state ---------- */
  let pts: P[] = [], train: P[] = [], test: P[] = [], net: MLP, training = false, epoch = 0, losses: number[] = [], lstride = 1, cls = 0;
  const myPts = store<P[]>(ctx.id, 'pts', [], (v) => Array.isArray(v));
  function makeData() {
    pts = cfg.data === 'mine' ? myPts.get() : dataset(cfg.data, 300, cfg.noise, rng(cfg.data.length * 97 + Math.round(cfg.noise * 1000)));
    const order = pts.map((_, i) => i).sort((a, b) => ((a * 7919) % 101) - ((b * 7919) % 101)); /* fixed shuffle so the split is stable */
    test = order.filter((_, k) => k % 10 < 3).map((i) => pts[i]); train = order.filter((_, k) => k % 10 >= 3).map((i) => pts[i]);
  }
  function newNet() { net = new MLP([cfg.sq ? 5 : 2, ...Array(cfg.layers).fill(cfg.neurons), 2], cfg.act, 3); epoch = 0; losses = []; lstride = 1; }
  const acc = (set: P[]) => (set.length ? set.filter((p) => { const pr = net.predict(feats(p.x, p.y, cfg.sq)); return (pr[1] > pr[0] ? 1 : 0) === p.c; }).length / set.length : 0);
  function trainEpoch() {
    if (!train.length) return;
    const idx = train.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    let l = 0, nb = 0; for (let s = 0; s < idx.length; s += 16) { const bt = idx.slice(s, s + 16); l += net.train(bt.map((i) => feats(train[i].x, train[i].y, cfg.sq)), bt.map((i) => train[i].c), cfg.lr); nb++; }
    epoch++; if (epoch % lstride === 0) losses.push(l / nb); if (losses.length > 400) { losses = losses.filter((_, i) => i % 2 === 0); lstride *= 2; } /* keeps the whole history, thinned */
  }
  makeData(); newNet();

  /* ---------- doodle state ---------- */
  type Ex = { c: number; px: number[] };
  const exStore = store<Ex[]>(ctx.id, 'doodles', [], (v) => Array.isArray(v));
  let examples: Ex[] = exStore.get(), pad = new Float64Array(PAD * PAD), dnet: MLP | null = null, dtrainLeft = 0, dLoss = 0, guess: Float64Array | null = null;
  const clearPad = () => { pad = new Float64Array(PAD * PAD); guess = null; };
  function dTrainSome(n: number) {
    if (!dnet || !examples.length) return;
    for (let k = 0; k < n && dtrainLeft > 0; k++, dtrainLeft--) {
      const X: Float64Array[] = [], Y: number[] = [];
      for (let b = 0; b < 24; b++) { const e = examples[Math.floor(R() * examples.length)]; X.push(centre(shift(e.px, Math.floor(R() * 3) - 1, Math.floor(R() * 3) - 1))); Y.push(e.c); }
      dLoss = dnet.train(X, Y, .004, 1e-4);
    }
    if (pad.some((v) => v > 0)) guess = dnet.predict(centre(pad));
  }

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.mode === 'boundary') {
      about.textContent = t('a.b', 'Each point is gold or blue. The network sees only its x and y, guesses a colour, and nudges its weights to be less wrong (backpropagation). The shaded background is its guess for every spot. 30% of the points are kept aside as a test: if training accuracy is high but test accuracy is low, it has memorised instead of learned.');
      select(box, t('data', 'Data'), [['circles', t('d.circles', 'Circle inside a ring')], ['xor', t('d.xor', 'Four corners (XOR)')], ['spiral', t('d.spiral', 'Two spirals')], ['blobs', t('d.blobs', 'Two clouds')], ['mine', t('d.mine', 'My own points')]], cfg.data, (v) => { cfg.data = v; save(); makeData(); newNet(); build(); lp.play(); });
      if (cfg.data === 'mine') { seg(box, t('add', 'Click adds'), [['0', t('c.gold', 'Gold')], ['1', t('c.blue', 'Blue')]], String(cls), (v) => { cls = +v; }); buttons(box, [[t('clearp', 'Clear my points'), () => { myPts.set([]); makeData(); newNet(); lp.play(); }]]); }
      else range(box, t('noise', 'Noise'), { min: 0, max: .3, step: .01, value: cfg.noise, fmt: (v) => v.toFixed(2) }, (v) => { cfg.noise = v; save(); makeData(); lp.play(); });
      seg(box, t('layers', 'Hidden layers'), [['1', '1'], ['2', '2'], ['3', '3']], String(cfg.layers), (v) => { cfg.layers = +v; save(); newNet(); lp.play(); });
      range(box, t('neurons', 'Neurons per layer'), { min: 1, max: 8, value: cfg.neurons, fmt: (v) => `${v}` }, (v) => { cfg.neurons = v; save(); newNet(); lp.play(); });
      seg(box, t('act', 'Activation'), [['tanh', 'tanh'], ['relu', 'ReLU']], cfg.act, (v) => { cfg.act = v as Act; save(); newNet(); lp.play(); });
      range(box, t('lr', 'Learning rate'), { min: .001, max: .2, step: .001, value: cfg.lr, fmt: (v) => v.toFixed(3) }, (v) => { cfg.lr = v; save(); });
      check(box, t('sq', 'Also give it x², y² and x·y'), cfg.sq, (v) => { cfg.sq = v; save(); newNet(); lp.play(); });
      buttons(box, [[training ? t('pause', 'Pause') : t('train', 'Train'), () => { training = !training; build(); lp.play(); }, true], [t('step', 'One epoch'), () => { trainEpoch(); lp.play(); }], [t('reset', 'New random weights'), () => { net = new MLP(net.sizes, cfg.act, Math.floor(R() * 1e6)); epoch = 0; losses = []; lp.play(); }]]);
      lab(t('st.epoch', 'Epochs'), t('st.train', 'Training accuracy'), t('st.test', 'Test accuracy'));
      return;
    }
    about.textContent = t('a.d', 'Choose three things to teach, draw a few examples of each on the pad, then train. The network (256 inputs, 32 hidden neurons, 3 outputs) learns only from your drawings, shifted a little to make more examples. With five or more examples each it usually tells them apart; with one it mostly guesses.');
    const names = h('div', { class: 'wk-row' });
    cfg.names.forEach((nm, i) => { const inp = h('input', { type: 'text', value: nm, maxLength: 14, 'aria-label': `${t('name', 'Name')} ${i + 1}`, style: { width: '30%', borderBottom: `3px solid ${COLS[i]}` } }) as HTMLInputElement; inp.addEventListener('change', () => { cfg.names[i] = inp.value.trim().slice(0, 14) || `#${i + 1}`; save(); build(); lp.play(); }); names.append(inp); });
    box.append(h('label', { class: 'wk-r' }, h('span', { text: t('names', 'The three things') }), names));
    buttons(box, cfg.names.map((nm, i) => [`+ ${nm} (${examples.filter((e) => e.c === i).length})`, () => { if (!pad.some((v) => v > 0)) { L.hud.textContent = t('empty', 'Draw something on the pad first.'); return; } examples.push({ c: i, px: Array.from(pad, (v) => (v > 0 ? 1 : 0)) }); if (examples.length > 120) examples.shift(); exStore.set(examples); clearPad(); build(); lp.play(); }] as [string, () => void]));
    buttons(box, [[t('dtrain', 'Train on my examples'), () => { if ([0, 1, 2].some((i) => !examples.some((e) => e.c === i))) { L.hud.textContent = t('few', 'Add at least one example of each thing first.'); return; } dnet = new MLP([PAD * PAD, 32, 3], 'relu', 5); dtrainLeft = 400; lp.play(); }, true], [t('clearpad', 'Clear the pad'), () => { clearPad(); lp.play(); }]]);
    buttons(box, [[t('forget', 'Delete all examples'), () => { examples = []; exStore.set(examples); dnet = null; guess = null; build(); lp.play(); }]]);
    lab(t('st.ex', 'Examples'), t('st.loss', 'Training loss'), t('st.guess', 'Best guess'));
  }

  /* ---------- drawing ---------- */
  const plot = () => { const W = S.w, H = S.h, wide = W > 640, s = Math.min(H - 24, wide ? W * .58 : W - 24); return { s, ox: wide ? 14 : (W - s) / 2, oy: (H - s) / 2 + (wide ? 0 : 6), wide }; };
  const heat = document.createElement('canvas'); heat.width = 60; heat.height = 60;
  function drawBoundary(g: CanvasRenderingContext2D, W: number, H: number) {
    const P = plot(), hg = heat.getContext('2d')!, im = hg.createImageData(60, 60);
    for (let j = 0; j < 60; j++) for (let i = 0; i < 60; i++) {
      const x = (i + .5) / 60 * 2.4 - 1.2, y = 1.2 - (j + .5) / 60 * 2.4, pr = net.predict(feats(x, y, cfg.sq))[1], o = (j * 60 + i) * 4, k = Math.abs(pr - .5) * 2;
      const c = pr > .5 ? [61, 127, 224] : [224, 166, 58]; im.data[o] = 245 + (c[0] - 245) * k * .55; im.data[o + 1] = 241 + (c[1] - 241) * k * .55; im.data[o + 2] = 232 + (c[2] - 232) * k * .55; im.data[o + 3] = 255;
    }
    hg.putImageData(im, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(heat, P.ox, P.oy, P.s, P.s);
    const X = (x: number) => P.ox + (x + 1.2) / 2.4 * P.s, Y = (y: number) => P.oy + (1.2 - y) / 2.4 * P.s;
    for (const p of train) { g.fillStyle = COLS[p.c]; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.6, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.stroke(); }
    for (const p of test) { g.strokeStyle = COLS[p.c]; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.6, 0, 7); g.stroke(); g.lineWidth = 1; }
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.strokeRect(P.ox, P.oy, P.s, P.s);
    /* network diagram and loss curve on wide screens */
    const rx = P.ox + P.s + 24, rw = W - rx - 14;
    if (P.wide && rw > 180) {
      const sizes = net.sizes, top = 70, dh = H * .55 - top, colX = (l: number) => rx + 10 + l * (rw - 20) / (sizes.length - 1), rowY = (l: number, i: number) => top + (i + .5) * dh / sizes[l];
      for (let l = 0; l < sizes.length - 1; l++) { const w = net.W[l], n = sizes[l]; for (let j = 0; j < sizes[l + 1]; j++) for (let i = 0; i < n; i++) { const v = w[j * n + i]; g.strokeStyle = v > 0 ? 'rgba(61,127,224,.8)' : 'rgba(224,120,58,.8)'; g.lineWidth = clamp(Math.abs(v) * 1.6, .2, 5); g.beginPath(); g.moveTo(colX(l), rowY(l, i)); g.lineTo(colX(l + 1), rowY(l + 1, j)); g.stroke(); } }
      g.lineWidth = 1;
      const inLab = cfg.sq ? ['x', 'y', 'x²', 'y²', 'xy'] : ['x', 'y'];
      sizes.forEach((n, l) => { for (let i = 0; i < n; i++) { g.fillStyle = l === 0 ? '#2a2f38' : l === sizes.length - 1 ? COLS[i] : '#f5f0e4'; g.strokeStyle = '#2a2f38'; g.beginPath(); g.arc(colX(l), rowY(l, i), 8, 0, 7); g.fill(); g.stroke(); if (l === 0) { g.fillStyle = '#fff'; g.font = '9px ui-monospace, monospace'; g.textAlign = 'center'; g.fillText(inLab[i], colX(l), rowY(l, i) + 3); g.textAlign = 'start'; } } });
      const ly = H * .62, lh = H - ly - 30; g.fillStyle = '#2a2f38'; g.font = '11px ui-monospace, monospace'; g.fillText(`${t('losscurve', 'loss over epochs')}${losses.length ? `   ${losses[losses.length - 1].toFixed(4)}` : ''}`, rx, ly - 6);
      g.strokeStyle = 'rgba(0,0,0,.15)'; g.strokeRect(rx, ly, rw, lh);
      if (losses.length > 1) { const mx = Math.max(.7, ...losses); g.strokeStyle = '#c0392b'; g.lineWidth = 1.5; g.beginPath(); losses.forEach((v, i) => { const x = rx + i / Math.max(1, losses.length - 1) * rw, y = ly + lh - v / mx * lh; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.lineWidth = 1; }
    }
    out('a', `${epoch}`); out('b', `${Math.round(acc(train) * 100)}%`); out('c', `${Math.round(acc(test) * 100)}%`);
  }
  const padGeo = () => { const W = S.w, H = S.h, wide = W > 560, s = Math.min(wide ? H - 70 : H - 120, wide ? W * .5 : W - 30), c = s / PAD; return { s, c, ox: wide ? 24 : (W - s) / 2, oy: wide ? (H - s) / 2 + 10 : 54, wide }; };
  function drawDoodle(g: CanvasRenderingContext2D, W: number) {
    const G = padGeo();
    g.fillStyle = '#fbf8f1'; g.fillRect(G.ox, G.oy, G.s, G.s);
    g.strokeStyle = 'rgba(0,0,0,.06)'; for (let i = 1; i < PAD; i++) { g.beginPath(); g.moveTo(G.ox + i * G.c, G.oy); g.lineTo(G.ox + i * G.c, G.oy + G.s); g.moveTo(G.ox, G.oy + i * G.c); g.lineTo(G.ox + G.s, G.oy + i * G.c); g.stroke(); }
    g.fillStyle = '#1d1b18'; for (let i = 0; i < PAD * PAD; i++) if (pad[i] > 0) g.fillRect(G.ox + (i % PAD) * G.c, G.oy + Math.floor(i / PAD) * G.c, G.c + .5, G.c + .5);
    g.strokeStyle = '#2a2f38'; g.strokeRect(G.ox, G.oy, G.s, G.s);
    /* guesses */
    const bx = G.wide ? G.ox + G.s + 30 : G.ox, by = G.wide ? G.oy + 10 : G.oy + G.s + 8, bw = G.wide ? Math.min(300, W - bx - 20) : G.s;
    if (G.wide) { g.fillStyle = '#2a2f38'; g.font = '13px ui-sans-serif, system-ui'; g.fillText(dnet ? t('guessing', 'What it thinks you drew:') : t('untrained', 'Not trained yet: add examples, then train.'), bx, by); }
    cfg.names.forEach((nm, i) => {
      const y = G.wide ? by + 22 + i * 40 : by + i * 0, p = guess ? guess[i] : 0;
      if (!G.wide) return;
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(bx, y, bw, 26); g.fillStyle = COLS[i]; g.fillRect(bx, y, bw * p, 26);
      g.fillStyle = p > .25 ? '#1d1b18' : '#e8e4da'; g.font = '13px ui-sans-serif, system-ui'; g.fillText(`${nm}  ${guess ? Math.round(p * 100) + '%' : ''}`, bx + 8, y + 17);
      g.fillStyle = '#a49d90'; g.font = '11px ui-monospace, monospace'; g.fillText(`${examples.filter((e) => e.c === i).length} ${t('exs', 'examples')}`, bx + bw + 8, y + 17);
    });
    if (!G.wide && guess) { let b = 0; for (let i = 1; i < 3; i++) if (guess[i] > guess[b]) b = i; g.fillStyle = '#e8e4da'; g.font = '13px ui-sans-serif, system-ui'; g.fillText(`${t('guessing', 'What it thinks you drew:')} ${cfg.names[b]} ${Math.round(guess[b] * 100)}%`, G.ox, G.oy + G.s + 24); }
    let best = -1; if (guess) { best = 0; for (let i = 1; i < 3; i++) if (guess[i] > guess[best]) best = i; }
    out('a', `${examples.length}`); out('b', dnet ? dLoss.toFixed(3) : '—'); out('c', best >= 0 ? `${cfg.names[best]} ${Math.round(guess![best] * 100)}%` : '—');
    L.hud.textContent = dtrainLeft > 0 ? `${t('trainingnow', 'Training…')} ${Math.round((1 - dtrainLeft / 400) * 100)}%` : L.hud.textContent;
  }
  let drawing = false, erase = false, last: { x: number; y: number } | null = null;
  const lp = loop(ctx, S.cv, () => {
    const g = S.g, W = S.w, H = S.h;
    g.fillStyle = cfg.mode === 'boundary' ? '#f5f0e4' : '#262a33'; g.fillRect(0, 0, W, H);
    if (cfg.mode === 'boundary') {
      if (training) for (let k = 0; k < (cfg.layers * cfg.neurons > 16 ? 1 : 3); k++) trainEpoch();
      drawBoundary(g, W, H); if (!training) lp.pause(); return;
    }
    if (dtrainLeft > 0) { dTrainSome(8); if (dtrainLeft === 0) { L.hud.textContent = t('trained', 'Trained. Draw something new and watch the guess.'); if (dnet && pad.some((v) => v > 0)) guess = dnet.predict(centre(pad)); } }
    drawDoodle(g, W); if (dtrainLeft <= 0 && !drawing) lp.pause();
  });

  /* ---------- input ---------- */
  S.cv.style.touchAction = 'none';
  const padAt = (x: number, y: number) => { const G = padGeo(), i = Math.floor((x - G.ox) / G.c), j = Math.floor((y - G.oy) / G.c); return i < 0 || j < 0 || i >= PAD || j >= PAD ? -1 : j * PAD + i; };
  function ink(x: number, y: number) { const k = padAt(x, y); if (k < 0) return; pad[k] = erase ? 0 : 1; if (dnet) guess = dnet.predict(centre(pad)); lp.play(); }
  S.cv.addEventListener('pointerdown', (e) => {
    const p = local(e, S.cv); S.cv.setPointerCapture(e.pointerId);
    if (cfg.mode === 'doodle') { drawing = true; erase = e.button === 2; last = p; ink(p.x, p.y); return; }
    if (cfg.data !== 'mine') return;
    const P = plot(), x = (p.x - P.ox) / P.s * 2.4 - 1.2, y = 1.2 - (p.y - P.oy) / P.s * 2.4; if (Math.abs(x) > 1.2 || Math.abs(y) > 1.2) return;
    const l = myPts.get(); l.push({ x, y, c: e.button === 2 ? 1 - cls : cls }); if (l.length > 400) l.shift(); myPts.set(l); makeData(); lp.play();
  });
  S.cv.addEventListener('pointermove', (e) => { if (!drawing) return; const p = local(e, S.cv), a = last || p, G = padGeo(), n = Math.max(1, Math.ceil(Math.hypot(p.x - a.x, p.y - a.y) / (G.c * .4))); for (let k = 1; k <= n; k++) ink(a.x + (p.x - a.x) * k / n, a.y + (p.y - a.y) * k / n); last = p; });
  const up = () => { drawing = false; last = null; }; S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.addEventListener('contextmenu', (e) => e.preventDefault());
  S.onResize(() => lp.play());
  build(); lp.play();
}
