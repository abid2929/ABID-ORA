/* 008 Fashion Trends: Palette Lab. Build seasonal colour stories with colour theory, or pull a
   palette out of your own photo (k-means clustering, done in the browser: the photo never
   leaves the device). Lock colours you like, check contrast, see it on an outfit, export it. */
import { type Ctx, h, s, layout, heading, note, seg, buttons, store, download, hsl2hex, hex2hsl, hex2rgb, rgb2hex, contrast, rng, clamp, shade } from './kit';

type Mode = 'analogous' | 'complementary' | 'split' | 'triadic' | 'tetradic' | 'mono';
interface Sw { c: string; lock: boolean }
const MOODS: Record<string, [number, number, number, number]> = { /* sat min,max, light min,max */
  soft: [18, 42, 62, 86], earthy: [22, 48, 26, 62], vivid: [62, 92, 42, 62], dark: [20, 55, 12, 34], pastel: [35, 62, 78, 90], neutral: [4, 16, 18, 92],
};
const okSw = (v: unknown) => Array.isArray(v) && v.length === 5 && v.every((x) => x && /^#[0-9a-f]{6}$/i.test((x as Sw).c));

export default function (ctx: Ctx) {
  const t = ctx.t, st = store<Sw[]>(ctx.id, 'pal', [], okSw), lib = store<string[][]>(ctx.id, 'lib', [], (v) => Array.isArray(v) && v.length <= 24);
  let mode: Mode = 'analogous', mood = 'earthy', P: Sw[] = st.get();
  const L = layout(ctx); L.view.classList.add('flow');
  const strip = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: '0', borderRadius: '18px', overflow: 'hidden', minHeight: '260px' } });
  const outfit = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '16px', marginTop: '18px' } });
  const matrix = h('div', { style: { overflowX: 'auto', marginTop: '18px' } });
  const saved = h('div', { style: { display: 'grid', gap: '8px', marginTop: '18px' } });
  L.view.append(strip, outfit, matrix, saved);

  function gen() {
    const r = rng(Date.now()), hues: Record<string, number[]> = { earthy: [18, 32, 42, 85, 100], soft: [], vivid: [], dark: [], pastel: [], neutral: [30, 40, 210] }, hs = hues[mood], base = hs.length ? hs[(r() * hs.length) | 0] + (r() - .5) * 14 : r() * 360, [s0, s1, l0, l1] = MOODS[mood];
    const spread = mood === 'earthy' ? .6 : 1;
    const offs: Record<Mode, number[]> = { analogous: [-30, -15, 0, 15, 30], complementary: [0, 0, 180, 180, 10], split: [0, 150, 210, 0, 180], triadic: [0, 120, 240, 0, 120], tetradic: [0, 90, 180, 270, 0], mono: [0, 0, 0, 0, 0] };
    const o = offs[mode];
    P = Array.from({ length: 5 }, (_, i) => {
      if (P[i]?.lock) return P[i];
      const sat = s0 + r() * (s1 - s0), li = mode === 'mono' ? l0 + (l1 - l0) * (i / 4) : l0 + r() * (l1 - l0);
      return { c: hsl2hex(base + o[i] * (mode === 'analogous' ? spread : 1) + (r() - .5) * 8, sat, li), lock: false };
    });
    /* order light to dark so the strip reads as a story */
    const locked = P.map((x) => x.lock);
    if (!locked.some(Boolean)) P.sort((a, b) => hex2hsl(b.c)[2] - hex2hsl(a.c)[2]);
    render();
  }
  function fromImage(file: File) {
    if (!/^image\//.test(file.type) || file.size > 25e6) { msg.textContent = t('bad', 'Please choose an image file under 25 MB.'); return; }
    const img = new Image(); img.onload = () => {
      const c = h('canvas', { width: 120, height: Math.max(1, Math.round(120 * img.height / img.width)) }) as HTMLCanvasElement;
      const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data, px: number[][] = [];
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
      /* k-means, k = 5, seeded with k-means++ */
      const r = rng(42), K = 5, cent: number[][] = [px[(r() * px.length) | 0]];
      const dist = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      while (cent.length < K) { const ds = px.map((p) => Math.min(...cent.map((c2) => dist(p, c2)))); const tot = ds.reduce((a, b) => a + b, 0); let x = r() * tot, i = 0; while (x > ds[i] && i < ds.length - 1) { x -= ds[i]; i++; } cent.push(px[i]); }
      const cnt = new Array(K).fill(0);
      for (let it = 0; it < 12; it++) {
        const sum = cent.map(() => [0, 0, 0]); cnt.fill(0);
        for (const p of px) { let b = 0, bd = Infinity; cent.forEach((c2, k) => { const dd = dist(p, c2); if (dd < bd) { bd = dd; b = k; } }); sum[b][0] += p[0]; sum[b][1] += p[1]; sum[b][2] += p[2]; cnt[b]++; }
        cent.forEach((c2, k) => { if (cnt[k]) { c2[0] = sum[k][0] / cnt[k]; c2[1] = sum[k][1] / cnt[k]; c2[2] = sum[k][2] / cnt[k]; } });
      }
      const order = cent.map((c2, k) => ({ c: rgb2hex(c2[0], c2[1], c2[2]), n: cnt[k] })).sort((a, b) => b.n - a.n);
      P = order.map((o) => ({ c: o.c, lock: false }));
      msg.textContent = t('fromimg', 'Palette taken from your photo, most common colour first. The photo stayed on this device.');
      URL.revokeObjectURL(img.src); render();
    };
    img.onerror = () => { msg.textContent = t('bad', 'Please choose an image file under 25 MB.'); };
    img.src = URL.createObjectURL(file);
  }
  function render() {
    st.set(P);
    strip.replaceChildren(...P.map((sw, i) => {
      const txt = contrast(sw.c, '#ffffff') > contrast(sw.c, '#111111') ? '#ffffff' : '#111111';
      const [hh, ss, ll] = hex2hsl(sw.c);
      return h('div', { style: { background: sw.c, color: txt, padding: '14px 10px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '6px', minWidth: '0' } },
        h('b', { class: 'mono', text: sw.c.toUpperCase(), style: { fontSize: 'clamp(9.5px, 2.6vw, 13px)', fontWeight: '500', letterSpacing: '0' } }),
        h('span', { class: 'mono', text: `H${Math.round(hh)} S${Math.round(ss)} L${Math.round(ll)}`, style: { fontSize: '9.5px', opacity: '.75', overflowWrap: 'anywhere' } }),
        h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
          h('button', { type: 'button', 'aria-pressed': String(sw.lock), 'aria-label': (sw.lock ? t('unlock', 'Unlock') : t('lock', 'Lock')) + ' ' + sw.c, text: sw.lock ? '■' : '□', style: { border: `1px solid ${txt}`, color: txt, borderRadius: '6px', padding: '2px 7px', minWidth: '30px', minHeight: '30px', background: 'transparent', cursor: 'pointer' }, onclick: () => { sw.lock = !sw.lock; render(); } }),
          h('button', { type: 'button', 'aria-label': t('copy', 'Copy') + ' ' + sw.c, text: '⧉', style: { border: `1px solid ${txt}`, color: txt, borderRadius: '6px', padding: '2px 7px', minWidth: '30px', minHeight: '30px', background: 'transparent', cursor: 'pointer' }, onclick: () => { navigator.clipboard?.writeText(sw.c).then(() => { msg.textContent = t('copied', 'Copied') + ' ' + sw.c; }).catch(() => {}); } }),
          (() => { const inp = h('input', { type: 'color', 'aria-label': t('edit', 'Edit colour') + ' ' + (i + 1), style: { width: '30px', height: '30px', border: '0', padding: '0', background: 'none' } }) as HTMLInputElement; inp.value = sw.c; inp.addEventListener('change', () => { sw.c = inp.value; render(); }); return inp; })()));
    }));
    /* the palette worn: coat, knit, trousers, shoes */
    const [a, b, c, d, e] = P.map((x) => x.c);
    const look = (cols: string[], label: string) => { const sv = s('svg', { viewBox: '0 0 200 240', width: '100%', role: 'img', 'aria-label': label, style: 'max-height:260px' });
      sv.append(s('rect', { width: 200, height: 240, rx: 14, fill: cols[0] }),
        s('path', { d: 'M62 44 L100 58 L138 44 L160 64 L166 150 L152 152 L146 92 L146 168 L54 168 L54 92 L48 152 L34 150 L40 64 Z', fill: cols[1], stroke: shade(cols[1], -.35) }),
        s('path', { d: 'M78 50 Q100 64 122 50 L132 60 L130 120 L70 120 L68 60 Z', fill: cols[2], stroke: shade(cols[2], -.35) }),
        s('path', { d: 'M72 166 L128 166 L132 226 L106 226 L100 186 L94 226 L68 226 Z', fill: cols[3], stroke: shade(cols[3], -.35) }),
        s('path', { d: 'M62 226 L96 226 L96 234 L58 234 Z M104 226 L138 226 L142 234 L104 234 Z', fill: cols[4] }));
      return h('figure', { style: { margin: '0', display: 'grid', gap: '6px' } }, sv, h('figcaption', { class: 'mono', text: label, style: { fontSize: '10px', color: 'var(--mute)' } })); };
    outfit.replaceChildren(look([a, d, b, c, e], t('look1', 'Look A: light ground')), look([e, b, a, d, c], t('look2', 'Look B: dark ground')), look([c, a, e, b, d], t('look3', 'Look C: accent coat')));
    /* WCAG contrast matrix */
    const tb = h('table', { style: { borderCollapse: 'collapse', fontSize: '12px' } });
    tb.append(h('caption', { class: 'mono', text: t('wcag', 'Text contrast (WCAG 2): AA needs 4.5 for body text, 3 for large text'), style: { textAlign: 'start', color: 'var(--mute)', fontSize: '10.5px', padding: '0 0 8px' } }));
    tb.append(h('tr', {}, h('th', {}), ...P.map((x) => h('th', { style: { padding: '4px' } }, h('span', { style: { display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%', background: x.c, border: '1px solid var(--line)' } })))));
    P.forEach((r1) => tb.append(h('tr', {}, h('th', { style: { padding: '4px' } }, h('span', { style: { display: 'inline-block', width: '22px', height: '22px', borderRadius: '50%', background: r1.c, border: '1px solid var(--line)' } })),
      ...P.map((r2) => { const cr = contrast(r1.c, r2.c); return h('td', { class: 'mono', text: r1 === r2 ? '—' : cr.toFixed(1), style: { padding: '6px 8px', textAlign: 'center', color: cr >= 4.5 ? 'var(--signal)' : cr >= 3 ? 'var(--bone2)' : 'var(--mute)', fontWeight: cr >= 4.5 ? '600' : '400' } }); }))));
    matrix.replaceChildren(tb);
    saved.replaceChildren(...(lib.get().length ? [h('h3', { class: 'mono', text: t('saved', 'Saved palettes'), style: { fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400', margin: '8px 0 0' } })] : []),
      ...lib.get().map((p, i) => h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
        h('button', { type: 'button', 'aria-label': t('use', 'Use palette') + ' ' + (i + 1), style: { display: 'flex', flex: '1', height: '30px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--line)', padding: '0', cursor: 'pointer' }, onclick: () => { P = p.map((c2) => ({ c: c2, lock: false })); render(); } }, ...p.map((c2) => h('span', { style: { flex: '1', background: c2 } }))),
        h('button', { type: 'button', class: 'wk-b', text: '×', 'aria-label': t('del', 'Delete palette') + ' ' + (i + 1), onclick: () => { const a2 = lib.get(); a2.splice(i, 1); lib.set(a2); render(); } }))));
  }
  heading(L.panel, t('theory', 'Colour theory'));
  seg(L.panel, t('harmony', 'Harmony'), [['analogous', t('m.an', 'Analogous')], ['complementary', t('m.co', 'Complementary')], ['split', t('m.sp', 'Split')], ['triadic', t('m.tr', 'Triadic')], ['tetradic', t('m.te', 'Tetradic')], ['mono', t('m.mo', 'Monochrome')]], mode, (v) => { mode = v as Mode; gen(); });
  seg(L.panel, t('mood', 'Mood'), Object.keys(MOODS).map((k) => [k, t('md.' + k, k[0].toUpperCase() + k.slice(1))]), mood, (v) => { mood = v; gen(); });
  buttons(L.panel, [[t('gen', 'New palette (space)'), gen, true]]);
  heading(L.panel, t('photo', 'From a photo'));
  const file = h('input', { type: 'file', accept: 'image/*' }) as HTMLInputElement; file.addEventListener('change', () => { if (file.files?.[0]) fromImage(file.files[0]); file.value = ''; });
  L.panel.append(h('label', { class: 'wk-r' }, h('span', { text: t('pick', 'Choose an image') }), file));
  const msg = note(L.panel, '');
  heading(L.panel, t('keep', 'Keep it'));
  buttons(L.panel, [[t('save', 'Save palette'), () => { const a2 = lib.get(); a2.unshift(P.map((x) => x.c)); lib.set(a2.slice(0, 24)); render(); }],
    [t('css', 'Copy CSS'), () => { const css = ':root {\n' + P.map((x, i) => `  --palette-${i + 1}: ${x.c};`).join('\n') + '\n}'; navigator.clipboard?.writeText(css).then(() => { msg.textContent = t('cssok', 'CSS variables copied.'); }).catch(() => {}); }],
    [t('png', 'Swatch card (PNG)'), () => { const c = h('canvas', { width: 1500, height: 600 }) as HTMLCanvasElement; const g = c.getContext('2d')!; P.forEach((x, i) => { g.fillStyle = x.c; g.fillRect(i * 300, 0, 300, 600); g.fillStyle = contrast(x.c, '#fff') > 3 ? '#fff' : '#111'; g.font = '28px ui-monospace,monospace'; g.fillText(x.c.toUpperCase(), i * 300 + 24, 560); }); download(c, 'abidora-palette.png'); }]]);
  note(L.panel, t('honest', 'This is a colour-theory tool, not a trend forecast: it does not use any trend data. Lock a swatch to keep it while generating.'));
  const key = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea,select,button,a') && L.wrap.getBoundingClientRect().top < innerHeight) { e.preventDefault(); gen(); } };
  document.addEventListener('keydown', key); ctx.onDispose(() => document.removeEventListener('keydown', key));
  if (P.length === 5) render(); else gen();
  void hex2rgb; void clamp;
}
