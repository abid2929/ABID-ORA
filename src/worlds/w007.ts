/* 007 Streetwear Culture: Drop Graphic Maker. Type-driven streetwear graphics in the screen-print
   tradition: stacked outlines, arcs, waves and repeats, two-ink misregistration and halftone.
   Preview as a poster or printed on a tee, then export at print resolution. */
import { streetShow } from './street3d';
import { scanStudio, SCAN_CLOTHES, SCAN_SHOES } from './scanstudio';
import { I18N } from '../scripts/i18n';
import { type Ctx, h, layout, canvas, heading, note, select, seg, color, range, buttons, store, download, rng, shade } from './kit';

interface D { txt: string; sub: string; lay: string; font: string; ink1: string; ink2: string; bg: string; tee: string; mis: number; half: boolean; grain: boolean; seed: number; view: string }
const DEF: D = { txt: 'NO LIMITS', sub: 'ABIDORA · DROP 01', lay: 'stack', font: 'grotesk', ink1: '#ff4d2e', ink2: '#f1ede4', bg: '#121212', tee: '#161616', mis: 4, half: true, grain: true, seed: 7, view: 'tee' };
const FONTS: Record<string, [string, string]> = {
  grotesk: ['900 {s}px "Inter Tight", "Arial Black", system-ui, sans-serif', 'Heavy grotesk'],
  serif: ['italic 400 {s}px "Instrument Serif", Georgia, serif', 'Editorial serif'],
  mono: ['700 {s}px "JetBrains Mono", ui-monospace, monospace', 'Mono'],
  condensed: ['900 {s}px Impact, "Arial Narrow", "Inter Tight", sans-serif', 'Condensed'],
};
const TEMPLATES: Record<string, Partial<D>> = {
  heat: { ink1: '#ff4d2e', ink2: '#f1ede4', bg: '#121212', tee: '#161616', lay: 'stack' },
  acid: { ink1: '#c4f06a', ink2: '#121212', bg: '#e9e6dd', tee: '#efece4', lay: 'wave' },
  club: { ink1: '#ff5ce1', ink2: '#5fd4d0', bg: '#0c0a1d', tee: '#1c1a2e', lay: 'arc', font: 'serif' },
  workwear: { ink1: '#e8b46a', ink2: '#2b2b26', bg: '#3f4a2f', tee: '#4a5636', lay: 'badge', font: 'condensed' },
  mono: { ink1: '#f2f2f2', ink2: '#7a7a7a', bg: '#0e0e0e', tee: '#202020', lay: 'grid', font: 'mono' },
};

/* owner, 21 Nov: the code-made dress form and the 2D print maker are retired from the page (kept here, not called) */
export function printMaker(ctx: Ctx) {
  const t = ctx.t, st = store<D>(ctx.id, 'd', DEF, (v) => !!v && typeof (v as D).txt === 'string');
  const S: D = { ...DEF, ...st.get() };
  const G3 = streetShow(ctx);
  const L = layout(ctx);
  const C = canvas(L.view, t('art', 'Graphic preview'));
  const font = (sz: number) => FONTS[S.font][0].replace('{s}', String(Math.round(sz)));

  /* the artwork is drawn into a square of size A */
  function art(g: CanvasRenderingContext2D, A: number, transparent: boolean) {
    const r = rng(S.seed);
    if (!transparent) { g.fillStyle = S.bg; g.fillRect(0, 0, A, A); }
    const txt = (S.txt.trim() || 'ABIDORA').toUpperCase().slice(0, 28);
    const pass = (ink: string, dx: number, dy: number, which: 1 | 2) => {
      g.save(); g.translate(dx, dy); g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      if (S.lay === 'stack') {
        let sz = A * .2; g.font = font(sz); const w = g.measureText(txt).width; sz = Math.min(sz, sz * A * .9 / w); g.font = font(sz);
        const n = Math.max(3, Math.floor(A * .78 / (sz * .9)));
        for (let i = 0; i < n; i++) {
          const y = A * .12 + i * sz * .9 + sz / 2, solid = i === Math.floor(n / 2);
          if (which === 1 && solid) g.fillText(txt, A / 2, y);
          if (which === 2 && !solid) { g.lineWidth = Math.max(1, sz * .03); g.strokeText(txt, A / 2, y); }
        }
      } else if (S.lay === 'arc') {
        const R = A * .32; let sz = A * .1; g.font = font(sz); const chars = Array.from(txt + ' · '); const tot = chars.reduce((a, c) => a + g.measureText(c).width, 0);
        sz *= Math.min(1, (Math.PI * 2 * R * .95) / tot); g.font = font(sz);
        let ang = -Math.PI / 2; const tot2 = chars.reduce((a, c) => a + g.measureText(c).width, 0);
        const reps = Math.max(1, Math.floor(Math.PI * 2 * R / tot2));
        for (let k = 0; k < reps; k++) for (const c of chars) { const w = g.measureText(c).width; ang += w / 2 / R; g.save(); g.translate(A / 2 + Math.cos(ang) * R, A / 2 + Math.sin(ang) * R); g.rotate(ang + Math.PI / 2); if (which === 1) g.fillText(c, 0, 0); g.restore(); ang += w / 2 / R; }
        if (which === 2) { g.beginPath(); g.arc(A / 2, A / 2, R * .62, 0, Math.PI * 2); g.lineWidth = A * .012; g.stroke(); g.font = font(A * .12); g.fillText(txt.split(' ')[0].slice(0, 8), A / 2, A / 2); }
      } else if (S.lay === 'wave') {
        let sz = A * .16; g.font = font(sz); const w0 = g.measureText(txt).width; sz = Math.min(sz, sz * A * .86 / w0); g.font = font(sz);
        const chars = Array.from(txt), total = chars.reduce((a, c) => a + g.measureText(c).width, 0);
        for (let row = 0; row < 5; row++) {
          let x = A / 2 - total / 2; const base = A * .2 + row * sz * 1.05;
          for (const [i, c] of chars.entries()) { const w = g.measureText(c).width; const y = base + Math.sin(i * .7 + row * 1.1) * sz * .22; g.save(); g.translate(x + w / 2, y); g.rotate(Math.cos(i * .7 + row) * .12); if ((row + (which === 1 ? 0 : 1)) % 2 === 0) g.fillText(c, 0, 0); else { g.lineWidth = sz * .03; g.strokeText(c, 0, 0); } g.restore(); x += w; }
        }
      } else if (S.lay === 'grid') {
        const n = 6, cell = A * .84 / n; g.font = font(cell * .5);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const on = r() > .5; if ((which === 1) === on) { g.save(); g.translate(A * .08 + (x + .5) * cell, A * .08 + (y + .5) * cell); g.rotate((Math.floor(r() * 4)) * Math.PI / 2); g.fillText(txt[(x + y * n) % txt.length], 0, 0); g.restore(); } }
      } else if (S.lay === 'badge') {
        if (which === 2) { g.lineWidth = A * .02; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? A * .36 : A * .4; g.lineTo(A / 2 + Math.cos(a) * rr, A / 2 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
        else { g.font = font(A * .09); const words = txt.split(' '); words.slice(0, 3).forEach((w, i, arr) => { g.fillText(w, A / 2, A / 2 + (i - (arr.length - 1) / 2) * A * .1); }); g.beginPath(); g.arc(A / 2, A / 2, A * .3, 0, Math.PI * 2); g.lineWidth = A * .008; g.stroke(); }
      }
      if (which === 2 && S.sub) { g.font = `500 ${A * .028}px "JetBrains Mono", ui-monospace, monospace`; g.fillText(S.sub.toUpperCase().slice(0, 40), A / 2, A * .95); }
      g.restore();
    };
    pass(S.ink2, -S.mis * A / 1000, 0, 2);
    pass(S.ink1, S.mis * A / 1000, S.mis * A / 1600, 1);
    if (S.half) { // halftone knock-out dots over the lower third, like a fading screen print
      g.save(); g.globalCompositeOperation = transparent ? 'destination-out' : 'source-over'; g.fillStyle = transparent ? '#000' : S.bg; const step = A / 90;
      for (let y = A * .55; y < A * .9; y += step) for (let x = 0; x < A; x += step) { const k = (y - A * .55) / (A * .45); const rad = step * .55 * k * k; if (rad > .3) { g.beginPath(); g.arc(x + ((y / step) % 2 ? step / 2 : 0), y, rad, 0, Math.PI * 2); g.fill(); } }
      g.restore();
    }
    if (S.grain) { g.save(); g.globalCompositeOperation = transparent ? 'destination-out' : 'source-over'; g.fillStyle = transparent ? 'rgba(0,0,0,.45)' : S.bg; for (let i = 0; i < A * 8; i++) g.fillRect(r() * A, r() * A, A / 700 + r() * A / 500, A / 700); g.restore(); }
  }
  function tee(g: CanvasRenderingContext2D, W: number, H: number) {
    const k = Math.min(W / 1.1, H) * .92, x0 = W / 2 - k * .5, y0 = (H - k) / 2;
    const P = (x: number, y: number): [number, number] => [x0 + x * k, y0 + y * k];
    g.save(); g.beginPath();
    const pts: [number, number][] = [[.3, .06], [.4, .03], [.6, .03], [.7, .06], [.94, .2], [.86, .33], [.76, .28], [.76, .96], [.24, .96], [.24, .28], [.14, .33], [.06, .2]];
    pts.forEach(([x, y], i) => { const [px, py] = P(x, y); if (i === 2) { const [cx, cy] = P(.5, .13); g.quadraticCurveTo(cx, cy, px, py); return; } if (i) g.lineTo(px, py); else g.moveTo(px, py); });
    g.closePath();
    const gr = g.createLinearGradient(x0, 0, x0 + k, 0); gr.addColorStop(0, shade(S.tee, -.12)); gr.addColorStop(.5, shade(S.tee, .06)); gr.addColorStop(1, shade(S.tee, -.12));
    g.fillStyle = gr; g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 30; g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = shade(S.tee, -.35); g.lineWidth = 1.2; g.stroke(); g.clip();
    const A = k * .42, [ax, ay] = P(.5, .22);
    const off = document.createElement('canvas'); off.width = off.height = Math.max(2, Math.round(A * C.dpr)); const og = off.getContext('2d')!; og.scale(C.dpr, C.dpr); art(og, A, true);
    g.globalAlpha = .93; g.drawImage(off, ax - A / 2, ay, A, A); g.globalAlpha = 1;
    // fabric folds
    for (let i = 0; i < 5; i++) { const [fx, fy] = P(.3 + i * .1, .5); const fg = g.createLinearGradient(fx - 20, 0, fx + 20, 0); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(.5, 'rgba(0,0,0,.08)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(fx - 20, fy - k * .3, 40, k * .8); }
    g.restore();
  }
  function draw() {
    G3.art((g, A) => art(g, A, true), S.tee);
    const g = C.g; g.clearRect(0, 0, C.w, C.h);
    if (S.view === 'poster') { const A = Math.min(C.w, C.h) * .9; g.save(); g.translate((C.w - A) / 2, (C.h - A) / 2); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.fillStyle = S.bg; g.fillRect(0, 0, A, A); g.shadowColor = 'transparent'; art(g, A, false); g.restore(); }
    else tee(g, C.w, C.h);
    st.set(S);
  }
  C.onResize(draw);
  const inp = (label: string, key: 'txt' | 'sub', max: number) => { const i = h('input', { type: 'text', maxlength: max, value: S[key] }) as HTMLInputElement; i.value = S[key]; i.addEventListener('input', () => { S[key] = i.value; draw(); }); L.panel.append(h('label', { class: 'wk-r' }, h('span', { text: label }), i)); };
  heading(L.panel, t('words', 'Words'));
  inp(t('main', 'Main line'), 'txt', 28); inp(t('sub', 'Small print'), 'sub', 40);
  heading(L.panel, t('design', 'Design'));
  select(L.panel, t('tpl', 'Start from'), [['', t('choose', 'A colour story…')], ...Object.keys(TEMPLATES).map((k) => [k, t('tp.' + k, k[0].toUpperCase() + k.slice(1))] as [string, string])], '', (v) => { if (TEMPLATES[v]) { Object.assign(S, TEMPLATES[v]); location.hash = ''; sync(); } });
  const lay = seg(L.panel, t('layout', 'Layout'), [['stack', t('l.stack', 'Stack')], ['arc', t('l.arc', 'Arc')], ['wave', t('l.wave', 'Wave')], ['grid', t('l.grid', 'Grid')], ['badge', t('l.badge', 'Badge')]], S.lay, (v) => { S.lay = v; draw(); });
  const fnt = select(L.panel, t('font', 'Type'), Object.entries(FONTS).map(([k, v]) => [k, t('f.' + k, v[1])]), S.font, (v) => { S.font = v; draw(); });
  const c1 = color(L.panel, t('ink1', 'Ink 1'), S.ink1, (v) => { S.ink1 = v; draw(); });
  const c2 = color(L.panel, t('ink2', 'Ink 2'), S.ink2, (v) => { S.ink2 = v; draw(); });
  const c3 = color(L.panel, t('bg', 'Paper / background'), S.bg, (v) => { S.bg = v; draw(); });
  const c4 = color(L.panel, t('tee', 'Garment'), S.tee, (v) => { S.tee = v; draw(); });
  range(L.panel, t('mis', 'Misregistration'), { min: 0, max: 14, value: S.mis, fmt: (v) => v ? v + '' : t('off', 'off') }, (v) => { S.mis = v; draw(); });
  const vw = seg(L.panel, t('view', 'Preview'), [['tee', t('v.tee', 'On a tee')], ['poster', t('v.poster', 'Poster')]], S.view, (v) => { S.view = v; draw(); });
  buttons(L.panel, [[t('half', 'Halftone'), () => { S.half = !S.half; draw(); }], [t('grain', 'Grain'), () => { S.grain = !S.grain; draw(); }], [t('shuffle', 'Shuffle'), () => { S.seed = (Math.random() * 1e6) | 0; draw(); }]]);
  heading(L.panel, t('export', 'Export'));
  buttons(L.panel, [[t('png', 'Print file, transparent (PNG 3000px)'), () => { const c = h('canvas', { width: 3000, height: 3000 }) as HTMLCanvasElement; art(c.getContext('2d')!, 3000, true); download(c, 'abidora-print.png'); }, true], [t('poster', 'Poster (PNG)'), () => { const c = h('canvas', { width: 2400, height: 2400 }) as HTMLCanvasElement; art(c.getContext('2d')!, 2400, false); download(c, 'abidora-poster.png'); }]]);
  note(L.panel, t('note', 'The print file has a transparent background, the format most print-on-demand and screen printers ask for. Use only words and names you have the right to print.'));
  function sync() { lay.set(S.lay); fnt.value = S.font; c1.value = S.ink1; c2.value = S.ink2; c3.value = S.bg; c4.value = S.tee; vw.set(S.view); draw(); }
  document.fonts?.ready.then(draw);
  draw();
  /* real scanned streetwear (21 Nov): licensed CC BY pieces, every part recolourable; loads only when scrolled near */
  const STREET = ['denim-jacket-blue', 'denim-jacket-black', 'denim-vest', 'jacket-suede', 'polo-striped', 'tee-raglan', 'tee-longsleeve', 'shorts-denim', 'sweatpants-velour', 'top-offshoulder', 'tracksuit', 'hoodie-sport', 'jeans-oversized', 'tee-men'];
  const items = STREET.map((id) => SCAN_CLOTHES.find((x) => x.id === id)).filter((x): x is (typeof SCAN_CLOTHES)[number] => !!x);
  const sc = h('section', { class: 'w007-scan' }), sHost = h('div');
  sc.append(h('h2', { text: t('scan.h', 'Real 3D streetwear'), style: { margin: '48px 0 6px', fontSize: 'clamp(22px,3vw,30px)' } }), h('p', { text: t('scan.p', 'Denim, tees, polos and sweats from real scans and cloth simulation. Pick a part and give it a new colour or finish; the real grain, folds and stitching stay.'), style: { margin: '0 0 14px', opacity: '.8', maxWidth: '68ch' } }), sHost);
  ctx.root.append(sc);
  let started = false; const io = new IntersectionObserver((es) => { if (started || !es.some((e) => e.isIntersecting)) return; started = true; io.disconnect(); scanStudio({ ...ctx, root: sHost }, I18N.root, items, { title: 'streetwear', acc: '#ff4d2e' }); }, { rootMargin: '300px' });
  io.observe(sc); ctx.onDispose(() => io.disconnect());
}

export default function (ctx: Ctx) {
  const STREET = ['denim-jacket-blue', 'denim-jacket-black', 'denim-vest', 'jacket-suede', 'polo-striped', 'tee-raglan', 'tee-longsleeve', 'shorts-denim', 'sweatpants-velour', 'top-offshoulder', 'tracksuit', 'hoodie-sport', 'jeans-oversized', 'tee-men', 'hitop-bolt'];
  const all = [...SCAN_CLOTHES, ...SCAN_SHOES];
  const items = STREET.map((id) => all.find((x) => x.id === id)).filter((x): x is (typeof all)[number] => !!x);
  scanStudio(ctx, I18N.root, items, { title: 'streetwear', acc: '#ff4d2e' });
}
