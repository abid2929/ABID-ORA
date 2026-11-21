/* 053 Experimental Art: Vibration Machines. Two experiments where physics makes the picture.
   The Chladni plate: a square metal plate sprinkled with sand is driven at a frequency. Near one of
   its resonances it vibrates in a standing-wave pattern; sand is thrown off the moving parts and
   collects on the nodal lines, which stay still (Ernst Chladni, 1787). The harmonograph: a Victorian
   drawing machine whose pen is moved by swinging pendulums; their frequency ratio sets the figure,
   a slight detuning makes it turn, friction makes it spiral in. Listen to the plate, draw with the
   pendulums, keep your drawings and download them as PNG or SVG. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, local, loop, clamp, store, download, rng } from './kit';

/* ---------- Chladni plate ---------- */
export interface Mode { n: number; m: number; s: 1 | -1; f: number }
const F0 = 18; /* Hz per unit of n² + m², chosen so the modes span the audible mid range */
/** standing-wave shapes of a square plate with free edges (classic approximation) */
export function modes(): Mode[] {
  const out: Mode[] = [];
  for (let n = 0; n <= 8; n++) for (let m = n; m <= 9; m++) for (const s of [1, -1] as const) {
    if (n === m && s === -1) continue; if (n + m < 2) continue;
    out.push({ n, m, s, f: F0 * (n * n + m * m) * (s > 0 ? 1.025 : .975) });
  }
  out.sort((a, b) => a.f - b.f);
  /* modes that would ring at (almost) the same pitch: a real plate shows only one of them, so keep the first */
  return out.filter((md, i) => i === 0 || md.f - out[i - 1].f > md.f * .012);
}
export const MODES = modes();
export const shape = (md: Mode, x: number, y: number) => Math.cos(md.n * Math.PI * x) * Math.cos(md.m * Math.PI * y) + md.s * Math.cos(md.m * Math.PI * x) * Math.cos(md.n * Math.PI * y);
/** nearest resonance to f and how strongly the plate responds (Lorentzian, Q about 25) */
export function respond(f: number) {
  let best = MODES[0], amp = 0;
  for (const md of MODES) { const bw = md.f / 25, a = 1 / (1 + ((f - md.f) / bw) ** 2); if (a > amp) { amp = a; best = md; } }
  return { md: best, amp };
}
export class Sand {
  x: Float32Array; y: Float32Array; R: () => number;
  constructor(public n: number, seed = 1) { this.R = rng(seed); this.x = new Float32Array(n); this.y = new Float32Array(n); this.scatter(); }
  scatter() { for (let i = 0; i < this.n; i++) { this.x[i] = this.R(); this.y[i] = this.R(); } }
  /** grains hop in random directions by an amount set by how much the plate moves beneath them */
  step(md: Mode, amp: number, k = .012) {
    for (let i = 0; i < this.n; i++) {
      const z = Math.abs(shape(md, this.x[i], this.y[i])) / 2, hop = z * amp * k + .00012;
      const a = this.R() * Math.PI * 2;
      let x = this.x[i] + Math.cos(a) * hop, y = this.y[i] + Math.sin(a) * hop;
      if (x < 0) x = -x; if (y < 0) y = -y; if (x > 1) x = 2 - x; if (y > 1) y = 2 - y;
      this.x[i] = x; this.y[i] = y;
    }
  }
  /** mean |displacement| under the grains: falls as they gather on the still lines */
  meanMotion(md: Mode) { let s = 0; for (let i = 0; i < this.n; i++) s += Math.abs(shape(md, this.x[i], this.y[i])) / 2; return s / this.n; }
}

/* ---------- harmonograph ---------- */
export interface Harm { p: number; q: number; detune: number; phase: number; damp: number; rot: number }
export function harmPoint(H: Harm, t: number): [number, number] {
  const e = Math.exp(-H.damp * t), ph = H.phase * Math.PI / 180, w1 = H.p, w2 = H.q + H.detune, r = H.rot;
  const x = (1 - r * .5) * Math.sin(w1 * t + ph) * e + r * .5 * Math.sin(w1 * 1.003 * t + Math.PI / 2) * e;
  const y = (1 - r * .5) * Math.sin(w2 * t) * e + r * .5 * Math.sin(w1 * 1.003 * t) * e;
  return [x, y];
}
export const harmEnd = (H: Harm) => Math.log(60) / Math.max(1e-4, H.damp);

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(400px, 60vw, 640px)';
  const S = canvas(L.view, t('cv', 'A vibrating plate with sand, or a harmonograph drawing made by swinging pendulums.'), { alpha: false });
  type Cfg = { mode: 'plate' | 'harm'; f: number; H: Harm; lines: boolean };
  const st = store<Cfg>(ctx.id, 'cfg', { mode: 'plate', f: 314, H: { p: 3, q: 2, detune: .006, phase: 90, damp: .012, rot: .3 }, lines: false }, (v) => typeof v === 'object' && v !== null && 'mode' in v);
  const cfg: Cfg = st.get(); const save = () => st.set(cfg);
  const sand = new Sand(matchMedia('(max-width: 600px)').matches ? 7000 : 14000, 5);
  let audio: { ac: AudioContext; osc: OscillatorNode; gain: GainNode } | null = null;

  heading(L.panel, t('mach', 'Machine'));
  seg(L.panel, t('machl', 'Experiment'), [['plate', t('m.plate', 'Chladni plate')], ['harm', t('m.harm', 'Harmonograph')]], cfg.mode, (v) => { cfg.mode = v as Cfg['mode']; save(); build(); if (cfg.mode !== 'plate') stopSound(); restartHarm(); lp.play(); });
  const about = note(L.panel, '');
  const box = h('div', {}); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  heading(L.panel, t('keeph', 'My drawings'));
  buttons(L.panel, [[t('save', 'Keep this one'), () => keep(), true], [t('png', 'Download PNG'), () => exportPng()], [t('svg', 'Download SVG'), () => exportSvg()]]);
  const keepBox = h('div', { class: 'wk-row', style: { flexWrap: 'wrap' } }); L.panel.append(keepBox);
  const kept = store<Cfg[]>(ctx.id, 'kept', [], (v) => Array.isArray(v));
  const svgBtnNote = note(L.panel, '');

  let fR: ReturnType<typeof range> | null = null;
  function build() {
    box.replaceChildren();
    if (cfg.mode === 'plate') {
      about.textContent = t('a.plate', 'Sand on a plate driven at one frequency. At a resonance the plate vibrates in a fixed pattern; grains bounce off the moving parts and come to rest on the lines that do not move. Between resonances the plate barely moves and nothing forms.');
      fR = range(box, t('freq', 'Driving frequency'), { min: 60, max: 2200, value: cfg.f, fmt: (v) => `${v} Hz` }, (v) => { cfg.f = v; save(); tone(); lp.play(); });
      buttons(box, [[t('prev', '◀ Previous resonance'), () => jump(-1)], [t('next', 'Next resonance ▶'), () => jump(1), true], [t('scatter', 'Scatter the sand'), () => { sand.scatter(); lp.play(); }]]);
      buttons(box, [[audio ? t('soundoff', 'Sound off') : t('soundon', 'Sound on'), () => { if (audio) stopSound(); else startSound(); build(); }]]);
      check(box, t('lines', 'Show where the plate stays still'), cfg.lines, (v) => { cfg.lines = v; save(); lp.play(); });
      dts[0].textContent = t('st.mode', 'Mode (n, m)'); dts[1].textContent = t('st.res', 'Response'); dts[2].textContent = t('st.mot', 'Sand still');
      svgBtnNote.textContent = t('svgn.plate', 'SVG saves each grain as a dot, ready for cutting or plotting.');
    } else {
      about.textContent = t('a.harm', 'Two pendulums swing at right angles and move the pen. Their frequency ratio decides the figure: 1:1 gives ellipses, 2:1 a figure of eight, 3:2 a pretzel. A tiny detuning makes the figure slowly turn, and friction lets it spiral into the centre.');
      const ratios: [string, string][] = [['1:1', '1 : 1'], ['2:1', '2 : 1'], ['3:2', '3 : 2'], ['3:1', '3 : 1'], ['4:3', '4 : 3'], ['5:4', '5 : 4']];
      seg(box, t('ratio', 'Frequency ratio'), ratios, `${cfg.H.p}:${cfg.H.q}`, (v) => { const [p, q] = v.split(':').map(Number); cfg.H.p = p; cfg.H.q = q; save(); restartHarm(); });
      const R = (k: keyof Harm, label: string, o: { min: number; max: number; step: number; fmt?: (v: number) => string }) => range(box, label, { ...o, value: cfg.H[k] }, (v) => { cfg.H[k] = v; save(); restartHarm(); });
      R('detune', t('detune', 'Detuning'), { min: -.03, max: .03, step: .001, fmt: (v) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(1)}%` });
      R('phase', t('phase', 'Phase'), { min: 0, max: 180, step: 1, fmt: (v) => `${v}°` });
      R('damp', t('damp', 'Friction'), { min: .002, max: .05, step: .001, fmt: (v) => `${(v * 1000).toFixed(0)}` });
      R('rot', t('rot', 'Rotary pendulum'), { min: 0, max: 1, step: .05, fmt: (v) => `${Math.round(v * 100)}%` });
      buttons(box, [[t('redraw', 'Draw again'), () => restartHarm(), true], [t('random', 'Surprise me'), () => { const r = Math.random; cfg.H = { p: [1, 2, 3, 3, 4, 5][Math.floor(r() * 6)], q: [1, 1, 2, 1, 3, 4][Math.floor(r() * 6)], detune: Math.round((r() - .5) * 40) / 1000, phase: Math.round(r() * 180), damp: Math.round((4 + r() * 20)) / 1000, rot: Math.round(r() * 10) / 10 }; save(); build(); restartHarm(); }]]);
      dts[0].textContent = t('st.ratio', 'Ratio'); dts[1].textContent = t('st.time', 'Pendulum time'); dts[2].textContent = t('st.pts', 'Pen points');
      svgBtnNote.textContent = t('svgn.harm', 'SVG saves the pen line itself, so a pen plotter can draw it again.');
    }
  }
  function jump(d: number) {
    const cur = respond(cfg.f).md, i = MODES.indexOf(cur), j = clamp(i + d, 0, MODES.length - 1);
    let k = j; if (d > 0 && MODES[j].f <= cfg.f && j < MODES.length - 1) k = j + 1; if (d < 0 && MODES[j].f >= cfg.f && j > 0) k = j - 1;
    cfg.f = Math.round(MODES[k].f); fR?.set(cfg.f); save(); tone(); sand.scatter(); lp.play();
  }
  function startSound() {
    try {
      const ac = new AudioContext(), osc = ac.createOscillator(), gain = ac.createGain();
      osc.type = 'sine'; osc.frequency.value = cfg.f; gain.gain.value = 0; osc.connect(gain).connect(ac.destination); osc.start();
      gain.gain.setTargetAtTime(.06, ac.currentTime, .05); audio = { ac, osc, gain };
    } catch { audio = null; }
  }
  function stopSound() { if (!audio) return; const a = audio; audio = null; a.gain.gain.setTargetAtTime(0, a.ac.currentTime, .04); setTimeout(() => { a.osc.stop(); a.ac.close(); }, 250); }
  function tone() { if (audio) audio.osc.frequency.setTargetAtTime(cfg.f, audio.ac.currentTime, .03); }
  ctx.onDispose(() => stopSound());

  /* ---------- harmonograph drawing state ---------- */
  const layer = document.createElement('canvas'); let lg = layer.getContext('2d')!, ht = 0, pts: number[] = [];
  function restartHarm() {
    layer.width = Math.round(S.w * S.dpr); layer.height = Math.round(S.h * S.dpr); lg = layer.getContext('2d')!; lg.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    lg.fillStyle = '#f7f2e7'; lg.fillRect(0, 0, S.w, S.h); ht = 0; pts = []; lp.play();
  }
  const hMap = () => { const r = Math.min(S.w, S.h) * .44; return (p: [number, number]) => [S.w / 2 + p[0] * r, S.h / 2 + p[1] * r] as [number, number]; };

  /* ---------- main loop ---------- */
  const plateRect = () => { const s = Math.min(S.w, S.h) - 36; return { x: (S.w - s) / 2, y: (S.h - s) / 2, s }; };
  let still = 0;
  const lp = loop(ctx, S.cv, (dt) => {
    const g = S.g, W = S.w, H = S.h;
    if (cfg.mode === 'plate') {
      const { md, amp } = respond(cfg.f);
      for (let i = 0; i < 6; i++) sand.step(md, amp, .02);
      const P = plateRect();
      g.fillStyle = '#16161b'; g.fillRect(0, 0, W, H);
      const grd = g.createLinearGradient(P.x, P.y, P.x + P.s, P.y + P.s); grd.addColorStop(0, '#3a3d45'); grd.addColorStop(1, '#23252b');
      g.fillStyle = grd; g.fillRect(P.x, P.y, P.s, P.s);
      if (cfg.lines) {
        g.fillStyle = 'rgba(120,200,255,.35)'; const N = 140, c = P.s / N;
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const z = shape(md, (i + .5) / N, (j + .5) / N); if (Math.abs(z) < .07) g.fillRect(P.x + i * c, P.y + j * c, c + .5, c + .5); }
      }
      g.fillStyle = '#efe4c8';
      for (let i = 0; i < sand.n; i++) g.fillRect(P.x + sand.x[i] * P.s, P.y + sand.y[i] * P.s, 1.4, 1.4);
      g.fillStyle = '#888'; g.beginPath(); g.arc(P.x + P.s / 2, P.y + P.s / 2, 4, 0, 7); g.fill();
      still = 1 - clamp(sand.meanMotion(md) / .32, 0, 1);
      out('a', `(${md.n}, ${md.m})${md.s > 0 ? '+' : '−'} · ${Math.round(md.f)} Hz`); out('b', `${Math.round(amp * 100)}%`); out('c', `${Math.round(still * 100)}%`);
      return;
    }
    /* harmonograph: advance pendulum time and ink the new stretch of line */
    const H2 = cfg.H, end = harmEnd(H2), map = hMap();
    if (ht < end) {
      lg.strokeStyle = 'rgba(28,32,60,.55)'; lg.lineWidth = .7; lg.lineJoin = 'round'; lg.beginPath();
      let p = map(harmPoint(H2, ht)); lg.moveTo(p[0], p[1]);
      const n = 260, dtp = .045;
      for (let i = 0; i < n && ht < end; i++) { ht += dtp; p = map(harmPoint(H2, ht)); lg.lineTo(p[0], p[1]); if (pts.length < 60000) pts.push(Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10); }
      lg.stroke();
    }
    g.drawImage(layer, 0, 0, W, H);
    const pen = map(harmPoint(H2, ht)); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(pen[0], pen[1], 3.5, 0, 7); g.fill();
    out('a', `${H2.p} : ${H2.q}`); out('b', `${Math.round(ht)} s / ${Math.round(end)} s`); out('c', `${(pts.length / 2).toLocaleString()}`);
    if (ht >= end) lp.pause();
    void dt;
  });

  /* drag on the plate to bow its edge: moves the frequency, like a violin bow on Chladni's plates */
  let drag: { x: number; f: number } | null = null;
  S.cv.addEventListener('pointerdown', (e) => { if (cfg.mode !== 'plate') return; const p = local(e, S.cv); drag = { x: p.x, f: cfg.f }; S.cv.setPointerCapture(e.pointerId); });
  S.cv.addEventListener('pointermove', (e) => { if (!drag) return; const p = local(e, S.cv); cfg.f = Math.round(clamp(drag.f * Math.exp((p.x - drag.x) / 300), 60, 2200)); fR?.set(cfg.f); tone(); lp.play(); });
  const up = () => { if (drag) save(); drag = null; }; S.cv.addEventListener('pointerup', up); S.cv.addEventListener('pointercancel', up);
  S.cv.style.touchAction = 'pan-y';
  S.cv.addEventListener('keydown', (e) => { if (cfg.mode === 'plate' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { e.preventDefault(); jump(e.key === 'ArrowRight' ? 1 : -1); } });

  /* ---------- keep, export ---------- */
  function keep() { const l = kept.get(); l.unshift(JSON.parse(JSON.stringify(cfg))); while (l.length > 10) l.pop(); kept.set(l); showKept(); }
  function showKept() {
    keepBox.replaceChildren();
    kept.get().forEach((k, i) => {
      const label = k.mode === 'plate' ? `${t('m.plate', 'Chladni plate')} ${Math.round(k.f)} Hz` : `${t('m.harm', 'Harmonograph')} ${k.H.p}:${k.H.q}`;
      const b = h('button', { type: 'button', class: 'wk-b', text: label, onclick: () => { Object.assign(cfg, JSON.parse(JSON.stringify(k))); save(); build(); if (cfg.mode === 'plate') { sand.scatter(); } restartHarm(); } });
      const del = h('button', { type: 'button', class: 'wk-b', 'aria-label': t('del', 'Remove'), text: '×', onclick: () => { const l = kept.get(); l.splice(i, 1); kept.set(l); showKept(); } });
      keepBox.append(h('span', { style: { display: 'inline-flex', gap: '2px' } }, b, del));
    });
  }
  function exportPng() {
    const k = Math.max(2, 2000 / S.w), c = document.createElement('canvas'); c.width = Math.round(S.w * k); c.height = Math.round(S.h * k); const g = c.getContext('2d')!; g.scale(k, k);
    if (cfg.mode === 'harm') { g.fillStyle = '#f7f2e7'; g.fillRect(0, 0, S.w, S.h); g.drawImage(layer, 0, 0, S.w, S.h); }
    else { g.drawImage(S.cv, 0, 0, S.w, S.h); }
    download(c, `abidora-${cfg.mode === 'plate' ? 'chladni-' + Math.round(cfg.f) + 'hz' : 'harmonograph-' + cfg.H.p + '-' + cfg.H.q}.png`);
  }
  function exportSvg() {
    let body = '';
    if (cfg.mode === 'harm') { const parts: string[] = []; for (let i = 0; i < pts.length; i += 4000) parts.push(`<polyline fill="none" stroke="#1c203c" stroke-width=".7" stroke-opacity=".7" points="${pts.slice(Math.max(0, i - 2), i + 4000).join(' ')}"/>`); body = `<rect width="100%" height="100%" fill="#f7f2e7"/>\n${parts.join('\n')}`; }
    else { const P = plateRect(), dots: string[] = []; for (let i = 0; i < sand.n; i++) dots.push(`M${(P.x + sand.x[i] * P.s).toFixed(1)} ${(P.y + sand.y[i] * P.s).toFixed(1)}h1.4`); body = `<rect width="100%" height="100%" fill="#16161b"/>\n<path stroke="#efe4c8" stroke-width="1.4" d="${dots.join('')}"/>`; }
    const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${S.w}" height="${S.h}" viewBox="0 0 ${S.w} ${S.h}">\n${body}\n</svg>`;
    download(new Blob([svg], { type: 'image/svg+xml' }), `abidora-${cfg.mode === 'plate' ? 'chladni-' + Math.round(cfg.f) + 'hz' : 'harmonograph-' + cfg.H.p + '-' + cfg.H.q}.svg`);
  }
  S.onResize(() => restartHarm());
  build(); showKept(); restartHarm();
}
