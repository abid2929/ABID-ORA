/* 027 Nature Universe: Living Type. A word set in huge letters becomes a window onto a landscape
   generated from noise: ridges, hills, forest, water, sky, sun or moon. One letter turns into an
   oval porthole and every layer moves at its own depth as you move the pointer (adapted from
   video ref 4). Pick season, hour and seed, type your own word, and save it as a wallpaper. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, buttons, loop, local, store, noise2, rng, clamp, lerp, download } from './kit';

const SEASON: Record<string, { n: string; far: string; mid: string; near: string; tree: string; water: string }> = {
  spring: { n: 'Spring', far: '#9fb7c9', mid: '#7fae7a', near: '#4f8a52', tree: '#2f6b3c', water: '#6aa6c4' },
  summer: { n: 'Summer', far: '#8fa9c4', mid: '#5f9a5c', near: '#3d7a3f', tree: '#1f5a2c', water: '#3f8fb8' },
  autumn: { n: 'Autumn', far: '#b7a6a0', mid: '#c98a3e', near: '#a85b2a', tree: '#7a3a1c', water: '#6f8fa3' },
  winter: { n: 'Winter', far: '#c9d3df', mid: '#e9eef3', near: '#d6dde6', tree: '#3a4a52', water: '#8fa7ba' },
};
const HOUR: Record<string, { n: string; top: string; bot: string; sun: string; dark: number }> = {
  dawn: { n: 'Dawn', top: '#f3c6c0', bot: '#fde7cf', sun: '#ffd1a8', dark: .05 },
  day: { n: 'Midday', top: '#7fb3e6', bot: '#d9ecf8', sun: '#fffbe8', dark: 0 },
  dusk: { n: 'Golden hour', top: '#f08a5d', bot: '#ffd59e', sun: '#fff0c2', dark: .12 },
  night: { n: 'Night', top: '#0b1430', bot: '#2a3a66', sun: '#f2f0e6', dark: .55 },
};
const mix = (a: string, b: string, k: number) => { const p = (x: string) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)); const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && typeof v === 'object' && 'word' in (v as object);
  const st = store(27, 'set', { word: 'NATURE', season: 'summer', hour: 'dusk', seed: 7, oval: 1 }, ok);
  const P = { ...st.get() }; P.word = String(P.word).slice(0, 10) || 'NATURE';
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#2f6b3c');
  L.view.style.background = '#f7f5f0';
  const S = canvas(L.view, t('cv', 'Landscape seen through the letters of a word'));
  const land = h('canvas') as HTMLCanvasElement, lg = land.getContext('2d')!, mask = h('canvas') as HTMLCanvasElement, mg = mask.getContext('2d')!;
  let px = 0, py = 0, tx = 0, ty = 0;
  S.cv.addEventListener('pointermove', (e) => { const p = local(e, S.cv); tx = (p.x / S.w - .5) * 2; ty = (p.y / S.h - .5) * 2; });
  S.cv.addEventListener('pointerleave', () => { tx = ty = 0; });

  /* paint the landscape into ctx g at size W×H with parallax offset (ox, oy) */
  function landscape(g: CanvasRenderingContext2D, W: number, H: number, ox: number, oy: number, time: number) {
    const se = SEASON[P.season], hr = HOUR[P.hour], n = noise2(P.seed), R = rng(P.seed);
    const sky = g.createLinearGradient(0, 0, 0, H * .7); sky.addColorStop(0, hr.top); sky.addColorStop(1, hr.bot); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (P.hour === 'night') for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${.3 + R() * .6})`; g.fillRect(R() * W + ox * 4, R() * H * .55 + oy * 2, 1.4, 1.4); }
    const sunX = W * (P.hour === 'dawn' ? .22 : P.hour === 'dusk' ? .75 : .6) + ox * 8, sunY = H * (P.hour === 'day' ? .18 : .42) + oy * 6;
    const gl = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * .35); gl.addColorStop(0, hr.sun + 'cc'); gl.addColorStop(1, hr.sun + '00'); g.fillStyle = gl; g.fillRect(0, 0, W, H);
    g.fillStyle = hr.sun; g.beginPath(); g.arc(sunX, sunY, H * .05, 0, 7); g.fill();
    /* drifting clouds */
    if (P.hour !== 'night') { g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) { const cx = ((R() * W + time * 6 * (i % 3 + 1)) % (W + 300)) - 150 + ox * 10, cy = H * (.1 + R() * .25) + oy * 5; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + k * 26, cy + Math.sin(k) * 6, 40, 16, 0, 0, 7); g.fill(); } } }
    const dark = (c: string, k: number) => mix(c.startsWith('#') ? c : '#000000', '#0b1020', clamp(k + hr.dark, 0, .85));
    const ridge = (base: number, amp: number, freq: number, col: string, depth: number, trees = false) => {
      const dx = ox * depth * 40, dy = oy * depth * 14;
      g.fillStyle = col; g.beginPath(); g.moveTo(-60, H);
      for (let x = -60; x <= W + 60; x += 6) { const y = H * base - (n((x - dx) * freq / W, base * 9) * .5 + .5) * H * amp + dy; g.lineTo(x, y); }
      g.lineTo(W + 60, H); g.closePath(); g.fill();
      if (trees) { g.fillStyle = dark(SEASON[P.season].tree, depth * .1); for (let x = -40; x <= W + 40; x += 11) { const r = (Math.sin(x * 12.9898 + P.seed) * 43758.5) % 1; if (Math.abs(r) < .45) continue; const y = H * base - (n((x - dx) * freq / W, base * 9) * .5 + .5) * H * amp + dy; const th = 18 + Math.abs(r) * 26 * depth; g.beginPath(); g.moveTo(x, y - th); g.lineTo(x - th * .28, y + 4); g.lineTo(x + th * .28, y + 4); g.closePath(); g.fill(); } }
    };
    ridge(.62, .32, 2.2, dark(se.far, .05), .3);
    ridge(.7, .22, 3.4, dark(se.mid, .1), .6);
    /* a lake reflecting the sky */
    const wy = H * .76 + oy * 10; const wg = g.createLinearGradient(0, wy, 0, H); wg.addColorStop(0, dark(se.water, 0)); wg.addColorStop(1, dark(se.water, .3)); g.fillStyle = wg; g.fillRect(0, wy, W, H - wy);
    g.strokeStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 14; i++) { const y = wy + 6 + i * 7, w0 = 40 + (i * 37) % 90; g.beginPath(); g.moveTo(sunX - w0 + Math.sin(time + i) * (ctx.calm ? 0 : 6), y); g.lineTo(sunX + w0, y); g.stroke(); }
    ridge(.86, .14, 4.8, dark(se.near, .15), 1, true);
  }
  function draw(time: number) {
    px = lerp(px, tx, .06); py = lerp(py, ty, .06);
    const W = S.w, H = S.h, d = S.dpr; if (!W) return;
    for (const c of [land, mask]) if (c.width !== Math.round(W * d) || c.height !== Math.round(H * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
    const word = P.word.toUpperCase(), size = Math.min(H * .62, W / Math.max(3, word.length) * 1.45);
    /* the landscape is painted into the band the letters occupy, so every letter shows sky, hills and water */
    const band = size * 1.02, bandTop = H / 2 + size * .34 - size * .78;
    lg.setTransform(d, 0, 0, d, 0, 0); lg.clearRect(0, 0, W, H); lg.setTransform(d, 0, 0, d, 0, d * bandTop); landscape(lg, W, band, ctx.calm ? 0 : px, ctx.calm ? 0 : py, time); lg.setTransform(d, 0, 0, d, 0, 0);
    /* the mask: the word, with one letter replaced by an oval window */
    mg.setTransform(d, 0, 0, d, 0, 0); mg.clearRect(0, 0, W, H);
    mg.font = `400 ${size}px "Instrument Serif", Georgia, serif`; mg.textBaseline = 'alphabetic';
    const widths = [...word].map((c) => mg.measureText(c).width), total = widths.reduce((a, b) => a + b, 0) + (word.length - 1) * size * .02;
    let x = (W - total) / 2; const base = H / 2 + size * .34;
    mg.fillStyle = '#000';
    [...word].forEach((c, i) => {
      if (i === P.oval % word.length) { const ow = Math.max(widths[i], size * .52); mg.beginPath(); mg.ellipse(x + widths[i] / 2 + px * 6, base - size * .34, ow * .48, size * .4, 0, 0, 7); mg.fill(); }
      else mg.fillText(c, x, base);
      x += widths[i] + size * .02;
    });
    mg.globalCompositeOperation = 'source-in'; mg.drawImage(land, 0, 0, W, H); mg.globalCompositeOperation = 'source-over';
    const g = S.g; g.clearRect(0, 0, W, H); g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, W, H);
    g.drawImage(mask, 0, 0, W, H);
    g.fillStyle = '#2b2a26'; g.font = '11px ui-monospace,monospace'; g.textAlign = 'center';
    g.fillText(`${t('s.' + P.season, SEASON[P.season].n).toUpperCase()} · ${t('h.' + P.hour, HOUR[P.hour].n).toUpperCase()} · SEED ${P.seed}`, W / 2, base + size * .22);
    g.textAlign = 'start';
  }
  loop(ctx, S.cv, (_dt, time) => draw(time));
  const save = () => st.set(P);

  heading(L.panel, t('word', 'Word'));
  const inp = h('input', { type: 'text', maxlength: 10, value: P.word, 'aria-label': t('word', 'Word') }) as HTMLInputElement;
  inp.addEventListener('input', () => { P.word = inp.value.replace(/\s+/g, '').slice(0, 10) || 'NATURE'; ov.input.max = String(Math.max(0, P.word.length - 1)); save(); });
  L.panel.append(h('label', { class: 'wk-r' }, h('span', { text: t('type', 'Type a word (up to 10 letters)') }), inp));
  const ov = range(L.panel, t('oval', 'Oval window at letter'), { min: 0, max: Math.max(0, P.word.length - 1), value: P.oval, fmt: (n) => String(n + 1) }, (v) => { P.oval = v; save(); });
  heading(L.panel, t('scene', 'Scene'));
  seg(L.panel, t('season', 'Season'), Object.entries(SEASON).map(([k, v]) => [k, t('s.' + k, v.n)]), P.season, (v) => { P.season = v; save(); });
  seg(L.panel, t('hour', 'Hour'), Object.entries(HOUR).map(([k, v]) => [k, t('h.' + k, v.n)]), P.hour, (v) => { P.hour = v; save(); });
  const sd = range(L.panel, t('seed', 'Landscape seed'), { min: 1, max: 999, value: P.seed }, (v) => { P.seed = v; save(); });
  buttons(L.panel, [[t('new', 'New landscape'), () => { P.seed = 1 + Math.floor(Math.random() * 999); sd.set(P.seed); save(); }, true]]);
  heading(L.panel, t('wall', 'Wallpaper'));
  const exportAt = (W: number, H: number, withWord: boolean, name: string) => {
    const c = h('canvas', { width: W, height: H }) as HTMLCanvasElement, g = c.getContext('2d')!;
    landscape(g, W, H, 0, 0, 0);
    if (withWord) { const m = h('canvas', { width: W, height: H }) as HTMLCanvasElement, q = m.getContext('2d')!; const word = P.word.toUpperCase(), size = Math.min(H * .3, W / word.length * 1.3); q.font = `400 ${size}px "Instrument Serif", Georgia, serif`; q.textAlign = 'center'; q.fillText(word, W / 2, H / 2 + size * .34); q.globalCompositeOperation = 'source-in'; q.drawImage(c, 0, 0); g.fillStyle = '#f7f5f0'; g.fillRect(0, 0, W, H); g.drawImage(m, 0, 0); }
    download(c, name);
  };
  buttons(L.panel, [[t('desk', 'Desktop 2560×1440'), () => exportAt(2560, 1440, false, 'abidora-landscape-desktop.png')], [t('phone', 'Phone 1080×2340'), () => exportAt(1080, 2340, false, 'abidora-landscape-phone.png')], [t('poster', 'Word poster'), () => exportAt(2400, 1600, true, 'abidora-word-poster.png')]]);
  note(L.panel, t('how', 'Every ridge is drawn from layered noise, so each seed is a different place. Move your pointer over the word: far mountains drift slowly, near hills quickly, like looking through a real window.'));
}
