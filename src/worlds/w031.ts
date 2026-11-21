/* 031 Bird Universe: Murmuration and Song. Starlings in a murmuration each watch about seven
   nearest neighbours, not everyone within a distance (Ballerini et al., 2008). This flock follows
   that rule, scatters from a falcon you steer, and reports how aligned it is. A second panel turns
   bird song from your microphone or an audio file into a live spectrogram. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, buttons, stats, loop, local, clamp } from './kit';

interface B { x: number; y: number; vx: number; vy: number }

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#f2b35b');
  L.view.style.background = 'linear-gradient(180deg,#f5c78a 0%,#e48d6b 45%,#5b4a6b 100%)';
  const S = canvas(L.view, t('cv', 'A murmuration of starlings at dusk; move the pointer to steer the falcon'));
  const info = stats(L.panel, [['n', t('n', 'Birds')], ['pol', t('pol', 'Alignment')], ['groups', t('groups', 'Flocks')], ['fps', t('fps', 'Frame rate')]]);
  let N = ctx.calm ? 300 : 700, K = 7, sep = 1.4, ali = 1, coh = .8, falcon = { x: -999, y: -999, on: false }, mode: 'flock' | 'song' = 'flock';
  let birds: B[] = [];
  const spawn = () => { birds = Array.from({ length: N }, () => { const a = Math.random() * 6.28; return { x: S.w * (.3 + Math.random() * .4), y: S.h * (.3 + Math.random() * .3), vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 }; }); };
  S.cv.addEventListener('pointermove', (e) => { const p = local(e, S.cv); falcon = { x: p.x, y: p.y, on: true }; });
  S.cv.addEventListener('pointerleave', () => { falcon.on = false; });
  let fpsA = 60, frameN = 0;
  function step(dt: number) {
    const cell = 40, grid = new Map<number, number[]>();
    birds.forEach((b, i) => { const k = Math.floor(b.x / cell) + Math.floor(b.y / cell) * 1000; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
    let sx = 0, sy = 0;
    const near: [number, number][] = [];
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i], cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell); near.length = 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(cx + dx + (cy + dy) * 1000) ?? []) { if (j === i) continue; const o = birds[j]; near.push([(o.x - b.x) ** 2 + (o.y - b.y) ** 2, j]); }
      /* topological rule: only the K nearest neighbours count */
      near.sort((a, c) => a[0] - c[0]);
      let ax = 0, ay = 0, mx = 0, my = 0, px = 0, py = 0, n = 0;
      for (const [d2, j] of near.slice(0, K)) { const o = birds[j], d = Math.sqrt(d2) || 1; if (d < 14) { px -= (o.x - b.x) / d * (14 - d); py -= (o.y - b.y) / d * (14 - d); } ax += o.vx; ay += o.vy; mx += o.x; my += o.y; n++; }
      if (n) { b.vx += (ax / n - b.vx) * .05 * ali + (mx / n - b.x) * .002 * coh + px * .02 * sep; b.vy += (ay / n - b.vy) * .05 * ali + (my / n - b.y) * .002 * coh + py * .02 * sep; }
      /* the falcon: flee within 90 px */
      if (falcon.on) { const dx = b.x - falcon.x, dy = b.y - falcon.y, d = Math.hypot(dx, dy); if (d < 90) { b.vx += dx / d * (90 - d) * .02; b.vy += dy / d * (90 - d) * .02; } }
      /* soft walls keep the flock in the sky */
      const m = 60; if (b.x < m) b.vx += .15; if (b.x > S.w - m) b.vx -= .15; if (b.y < m) b.vy += .15; if (b.y > S.h * .8) b.vy -= .2;
      const sp = Math.hypot(b.vx, b.vy), v = clamp(sp, 1.6, 3.4); b.vx = b.vx / (sp || 1) * v; b.vy = b.vy / (sp || 1) * v;
      sx += b.vx / v; sy += b.vy / v;
    }
    const k = dt * 60 * (ctx.calm ? .5 : 1); for (const b of birds) { b.x += b.vx * k; b.y += b.vy * k; }
    return Math.hypot(sx, sy) / birds.length;
  }
  function groups() {
    /* count flocks: birds linked when closer than 25 px (union-find on the grid) */
    const parent = birds.map((_, i) => i), f = (i: number): number => parent[i] === i ? i : (parent[i] = f(parent[i]));
    const cell = 25, grid = new Map<number, number[]>(); birds.forEach((b, i) => { const k = Math.floor(b.x / cell) + Math.floor(b.y / cell) * 1000; (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
    birds.forEach((b, i) => { const cx = Math.floor(b.x / cell), cy = Math.floor(b.y / cell); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const j of grid.get(cx + dx + (cy + dy) * 1000) ?? []) if (j > i && (birds[j].x - b.x) ** 2 + (birds[j].y - b.y) ** 2 < 625) parent[f(i)] = f(j); });
    const sizes = new Map<number, number>(); birds.forEach((_, i) => sizes.set(f(i), (sizes.get(f(i)) ?? 0) + 1));
    return [...sizes.values()].filter((v) => v >= 10).length;
  }
  /* ---------- song: spectrogram ---------- */
  let actx: AudioContext | null = null, an: AnalyserNode | null = null, src: AudioNode | null = null, stream: MediaStream | null = null, col = 0;
  const spec = h('canvas') as HTMLCanvasElement;
  function stopAudio() { stream?.getTracks().forEach((tr) => tr.stop()); stream = null; try { (src as AudioBufferSourceNode | null)?.disconnect(); } catch { /* already gone */ } src = null; }
  async function startMic() {
    stopAudio();
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { L.hud.textContent = t('micNo', 'Microphone not available or permission refused. Try an audio file instead.'); return; }
    actx = actx ?? new AudioContext(); an = actx.createAnalyser(); an.fftSize = 2048; src = actx.createMediaStreamSource(stream); src.connect(an); L.hud.textContent = t('micOn', 'Listening… whistle or play bird song near the microphone');
  }
  async function startFile(f: File) {
    stopAudio(); actx = actx ?? new AudioContext();
    try { const buf = await actx.decodeAudioData(await f.arrayBuffer()); const s = actx.createBufferSource(); s.buffer = buf; an = actx.createAnalyser(); an.fftSize = 2048; s.connect(an); an.connect(actx.destination); s.start(); src = s; L.hud.textContent = `${t('playing', 'Playing')} ${f.name.slice(0, 30)}`; }
    catch { L.hud.textContent = t('fileNo', 'That file could not be decoded as audio.'); }
  }
  function drawSong() {
    const g = S.g, W = S.w, H = S.h;
    if (spec.width !== Math.round(W) || spec.height !== Math.round(H)) { spec.width = Math.round(W); spec.height = Math.round(H); const sg = spec.getContext('2d')!; sg.fillStyle = '#0b0a12'; sg.fillRect(0, 0, W, H); col = 0; }
    const sg = spec.getContext('2d')!;
    if (an && actx) {
      const bins = new Uint8Array(an.frequencyBinCount); an.getByteFrequencyData(bins);
      const nyq = actx.sampleRate / 2, maxF = 12000; /* most bird song sits between 1 and 10 kHz */
      for (let y = 0; y < H; y++) { const fr = (1 - y / H) * maxF, b = bins[Math.min(bins.length - 1, Math.floor(fr / nyq * bins.length))] / 255; sg.fillStyle = `hsl(${280 - b * 240},90%,${b * 62}%)`; sg.fillRect(col, y, 2, 1); }
      col = (col + 2) % W; sg.fillStyle = 'rgba(255,255,255,.5)'; sg.fillRect(col, 0, 1, H);
    }
    g.clearRect(0, 0, W, H); g.drawImage(spec, 0, 0);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '11px ui-monospace,monospace'; for (const k of [2, 4, 6, 8, 10]) { const y = (1 - k / 12) * H; g.fillText(`${k} kHz`, 8, y); g.fillRect(48, y, 8, 1); }
    if (!an) { g.textAlign = 'center'; g.font = '16px system-ui,sans-serif'; g.fillText(t('songHint', 'Start the microphone or open a bird-song recording'), W / 2, H / 2); g.textAlign = 'start'; }
  }
  loop(ctx, S.cv, (dt) => {
    frameN++; fpsA = fpsA * .95 + (1 / Math.max(dt, 1e-3)) * .05;
    if (mode === 'song') { drawSong(); return; }
    if (birds.length !== N) spawn();
    const pol = step(dt);
    const g = S.g; g.clearRect(0, 0, S.w, S.h);
    g.fillStyle = '#1e1a24'; for (const b of birds) { const a = Math.atan2(b.vy, b.vx); g.save(); g.translate(b.x, b.y); g.rotate(a); g.beginPath(); g.moveTo(3.5, 0); g.lineTo(-2.5, -2.2); g.lineTo(-1.2, 0); g.lineTo(-2.5, 2.2); g.closePath(); g.fill(); g.restore(); }
    if (falcon.on) { g.fillStyle = '#5a2d1c'; g.beginPath(); g.moveTo(falcon.x + 10, falcon.y); g.lineTo(falcon.x - 9, falcon.y - 9); g.lineTo(falcon.x - 4, falcon.y); g.lineTo(falcon.x - 9, falcon.y + 9); g.closePath(); g.fill(); }
    g.fillStyle = '#2a2230'; g.fillRect(0, S.h * .9, S.w, S.h * .1); /* reed bed */
    if (frameN % 15 === 0) { info('n', String(birds.length)); info('pol', `${Math.round(pol * 100)}%`); info('groups', String(groups())); info('fps', `${Math.round(fpsA)}`); }
  });
  S.onResize(() => { if (!birds.length) spawn(); });

  heading(L.panel, t('mode', 'Watch or listen'));
  const flockBox = h('div', { style: { display: 'grid', gap: '12px' } }), songBox = h('div', { style: { display: 'grid', gap: '12px' } });
  seg(L.panel, t('modeS', 'Mode'), [['flock', t('m.flock', 'Murmuration')], ['song', t('m.song', 'Song spectrogram')]], mode, (v) => { mode = v as typeof mode; flockBox.hidden = v !== 'flock'; songBox.hidden = v !== 'song'; L.hud.textContent = ''; if (v === 'flock') stopAudio(); });
  L.panel.append(flockBox, songBox); songBox.hidden = true;
  range(flockBox, t('N', 'Birds'), { min: 100, max: 1500, step: 50, value: N }, (v) => { N = v; });
  range(flockBox, t('K', 'Neighbours each bird watches'), { min: 1, max: 20, value: K }, (v) => { K = v; });
  range(flockBox, t('sep', 'Personal space'), { min: 0, max: 3, step: .1, value: sep }, (v) => { sep = v; });
  range(flockBox, t('ali', 'Match heading'), { min: 0, max: 3, step: .1, value: ali }, (v) => { ali = v; });
  range(flockBox, t('coh', 'Stay together'), { min: 0, max: 3, step: .1, value: coh }, (v) => { coh = v; });
  buttons(flockBox, [[t('scatter', 'Scatter them'), () => { for (const b of birds) { const a = Math.random() * 6.28; b.vx = Math.cos(a) * 3; b.vy = Math.sin(a) * 3; } }]]);
  note(flockBox, t('how', 'Move the pointer into the sky to fly the falcon. With about seven neighbours the flock moves as one, ripples and splits around the predator; with one or two it falls apart. Alignment near 100% means everyone flies the same way.'));
  const file = h('input', { type: 'file', accept: 'audio/*', 'aria-label': t('file', 'Open a recording') }) as HTMLInputElement;
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) startFile(f); });
  buttons(songBox, [[t('mic', 'Use microphone'), () => { startMic(); }, true], [t('stop', 'Stop'), () => { stopAudio(); an = null; L.hud.textContent = ''; }]]);
  songBox.append(h('label', { class: 'wk-r' }, h('span', { text: t('file', 'Open a recording') }), file));
  note(songBox, t('songHow', 'A spectrogram shows pitch upwards and time across. Bird song shows as fast rising and falling strokes, mostly between 1 and 10 kHz. Sound stays on your device and is never recorded or uploaded.'));
  ctx.onDispose(() => { stopAudio(); actx?.close(); });
}
