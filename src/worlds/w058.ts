/* 058 Web Innovation Lab: Page-Load Simulator. What actually happens between pressing Enter and
   seeing a page, computed millisecond by millisecond: DNS lookups, TCP and TLS handshakes, TCP slow
   start, the six-connection limit of HTTP/1.1, multiplexing in HTTP/2 and HTTP/3 (QUIC), render-
   blocking CSS and scripts, late-discovered fonts, and lazy images. Change the network and the
   techniques, see the waterfall and the First Contentful Paint, Largest Contentful Paint and load
   time move, and keep runs side by side to compare. It is a teaching model, not a measurement of any
   real site, and the world says so. */
import { type Ctx, h, layout, canvas, heading, note, range, seg, stats, buttons, check, loop, store } from './kit';

export type Proto = 'h1' | 'h2' | 'h3';
export interface Opts { rtt: number; mbps: number; proto: Proto; images: number; gzip: boolean; defer: boolean; preload: boolean; preconnect: boolean; lazy: boolean }
export const DEFAULTS: Opts = { rtt: 100, mbps: 10, proto: 'h2', images: 12, gzip: true, defer: false, preload: false, preconnect: false, lazy: false };
type Kind = 'html' | 'css' | 'js' | 'img' | 'font';
export interface Row { name: string; kind: Kind; origin: string; size: number; disc: number; dns?: [number, number]; tcp?: [number, number]; tls?: [number, number]; sent: number; fb: number; end: number }
interface Res extends Row { left: number; conn: Conn | null; queued: boolean }
interface Conn { origin: string; ready: number; cw: number; grow: number; jobs: Res[] }
const SERVER_MS = 40, MSS_WINDOW = 14600;

/** run the whole page load; times in milliseconds */
export function simulate(o: Opts) {
  const B = o.mbps * 1e6 / 8 / 1000; /* bytes per ms */
  const z = (raw: number) => (o.gzip ? Math.round(raw * .26) : raw);
  const res: Res[] = [];
  const add = (name: string, kind: Kind, origin: string, size: number) => res.push({ name, kind, origin, size, disc: -1, sent: -1, fb: -1, end: -1, left: size, conn: null, queued: false });
  add('index.html', 'html', 'site', z(62000));
  add('style.css', 'css', 'site', z(42000)); add('theme.css', 'css', 'site', z(18000));
  add('app.js', 'js', 'site', z(160000)); add('vendor.js', 'js', 'site', z(240000)); add('analytics.js', 'js', 'site', z(38000));
  for (let i = 0; i < o.images; i++) add(i === 0 ? 'hero.jpg' : `photo-${i}.jpg`, 'img', 'site', i === 0 ? 140000 : 70000);
  add('font-regular.woff2', 'font', 'fonts', 28000); add('font-bold.woff2', 'font', 'fonts', 30000);
  const imgs = res.filter((r) => r.kind === 'img'), below = new Set(o.lazy ? imgs.slice(4) : []);
  const lazySkip = (r: Res, _i?: number) => below.has(r); /* photos below the fold wait until the reader scrolls */
  const origins = new Map<string, { dns: number; conns: Conn[] }>();
  const handshake = (o2: Opts) => (o2.proto === 'h3' ? 1 : 2); /* QUIC folds transport and TLS into one round trip */
  function originOf(name: string, t: number) { let g = origins.get(name); if (!g) { g = { dns: t + o.rtt, conns: [] }; origins.set(name, g); } return g; }
  function newConn(origin: string, t: number, r: Res | null): Conn {
    const g = originOf(origin, t), start = Math.max(t, g.dns), hs = handshake(o);
    const c: Conn = { origin, ready: start + hs * o.rtt, cw: MSS_WINDOW, grow: 0, jobs: [] }; g.conns.push(c);
    if (r) { if (g.dns > t && !res.some((x) => x.dns && x.origin === origin)) r.dns = [t, g.dns]; if (o.proto === 'h3') r.tcp = [start, start + o.rtt]; else { r.tcp = [start, start + o.rtt]; r.tls = [start + o.rtt, start + 2 * o.rtt]; } }
    return c;
  }
  if (o.preconnect) newConn('fonts', 0, null);
  let fcp = -1;
  const done = (k: Kind) => res.filter((r, i) => r.kind === k && !lazySkip(r, i)).every((r) => r.end >= 0);
  for (let t = 0; t < 120000; t++) {
    /* discovery: the HTML first, then what it references, then fonts once CSS is parsed (or at once if preloaded) */
    const html = res[0];
    res.forEach((r, i) => {
      if (r.disc >= 0 || lazySkip(r, i)) return;
      const firstCss = res.find((x) => x.kind === 'css' && x.end >= 0);
      const ok = r.kind === 'html' ? true : r.kind === 'font' ? (o.preload ? html.end >= 0 : !!firstCss) : html.end >= 0;
      if (ok) { r.disc = t; r.queued = true; }
    });
    /* assign queued requests to connections */
    for (const r of res) {
      if (!r.queued) continue; const g = originOf(r.origin, t);
      if (o.proto === 'h1') {
        const idle = g.conns.find((c) => c.jobs.length === 0);
        if (idle) { idle.jobs.push(r); r.conn = idle; r.queued = false; } else if (g.conns.length < 6) { const c = newConn(r.origin, t, r); c.jobs.push(r); r.conn = c; r.queued = false; }
      } else {
        const c = g.conns[0] ?? newConn(r.origin, t, r); c.jobs.push(r); r.conn = c; r.queued = false;
      }
    }
    /* requests go out once the connection is ready; the first byte comes back a round trip plus server time later */
    const active: Conn[] = [];
    for (const g of origins.values()) for (const c of g.conns) {
      if (t < c.ready) continue;
      for (const r of c.jobs) if (r.sent < 0) { r.sent = t; r.fb = t + o.rtt + SERVER_MS; }
      if (c.jobs.some((r) => r.fb >= 0 && t >= r.fb && r.left > 0)) active.push(c);
    }
    /* bandwidth: each connection can send its congestion window per round trip; together they share the link */
    const want = active.reduce((a, c) => a + c.cw / o.rtt, 0), scale = want > B ? B / want : 1;
    for (const c of active) {
      const flowing = c.jobs.filter((r) => t >= r.fb && r.left > 0), share = c.cw / o.rtt * scale / flowing.length;
      for (const r of flowing) { r.left -= share; if (r.left <= 0) { r.end = t + 1; } }
      if (t - c.grow >= o.rtt) { c.cw = Math.min(c.cw * 2, Math.max(MSS_WINDOW, B * o.rtt * 1.2)); c.grow = t; } /* slow start doubles the window every round trip */
      c.jobs = c.jobs.filter((r) => r.end < 0);
    }
    if (fcp < 0 && html.end >= 0 && done('css') && (o.defer || done('js'))) fcp = t + 30; /* first paint needs the HTML, all CSS and blocking scripts */
    if (fcp >= 0 && res.every((r, i) => r.end >= 0 || lazySkip(r, i))) break;
  }
  const loaded = res.filter((r, i) => !lazySkip(r, i));
  const hero = res.find((r) => r.name === 'hero.jpg');
  const lcp = hero && hero.end >= 0 ? Math.max(fcp, hero.end + 16) : fcp;
  const load = Math.max(...loaded.map((r) => r.end));
  const rows: Row[] = loaded.map(({ name, kind, origin, size, disc, dns, tcp, tls, sent, fb, end }) => ({ name, kind, origin, size, disc, dns, tcp, tls, sent, fb, end }));
  return { rows, fcp, lcp, load, bytes: loaded.reduce((a, r) => a + r.size, 0), conns: [...origins.values()].reduce((a, g) => a + g.conns.length, 0), skipped: res.length - loaded.length };
}

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.view.style.minHeight = 'clamp(460px, 62vw, 680px)';
  const S = canvas(L.view, t('cv', 'A waterfall chart of every file a web page loads, with handshakes, waiting and downloading shown as coloured bars.'), { alpha: false });
  type Kept = { o: Opts; fcp: number; lcp: number; load: number; bytes: number };
  const st = store<Opts>(ctx.id, 'opts', DEFAULTS, (v) => typeof v === 'object' && v !== null && 'rtt' in v);
  const o: Opts = { ...DEFAULTS, ...st.get() }; const save = () => st.set(o);
  const kept = store<Kept[]>(ctx.id, 'kept', [], (v) => Array.isArray(v));
  let sim = simulate(o), anim = 0;
  function rerun() { save(); sim = simulate(o); anim = 0; lp.play(); }

  heading(L.panel, t('net', 'Network'));
  note(L.panel, t('a', 'A teaching model of how a browser loads a page, computed millisecond by millisecond. It is not a measurement of any real site, but the effects are the real ones: round trips, handshakes, slow start, connection limits and render-blocking files.'));
  range(L.panel, t('rtt', 'Round-trip time'), { min: 10, max: 600, step: 10, value: o.rtt, fmt: (v) => `${v} ms` }, (v) => { o.rtt = v; rerun(); });
  range(L.panel, t('bw', 'Bandwidth'), { min: 1, max: 100, value: o.mbps, fmt: (v) => `${v} Mbit/s` }, (v) => { o.mbps = v; rerun(); });
  const presets: [string, string, Partial<Opts>][] = [['p3g', t('n.3g', 'Slow mobile'), { rtt: 300, mbps: 2 }], ['p4g', t('n.4g', '4G'), { rtt: 100, mbps: 10 }], ['pfib', t('n.fibre', 'Fibre'), { rtt: 20, mbps: 100 }], ['psat', t('n.sat', 'Satellite'), { rtt: 600, mbps: 20 }]];
  buttons(L.panel, presets.map(([, label, p]) => [label, () => { Object.assign(o, p); rerun(); build(); }] as [string, () => void]));
  const box = h('div', {}); L.panel.append(box);
  function build() {
    box.replaceChildren();
    seg(box, t('proto', 'Protocol'), [['h1', 'HTTP/1.1'], ['h2', 'HTTP/2'], ['h3', 'HTTP/3']], o.proto, (v) => { o.proto = v as Proto; rerun(); });
    range(box, t('imgs', 'Photos on the page'), { min: 0, max: 30, value: o.images, fmt: (v) => `${v}` }, (v) => { o.images = v; rerun(); });
    heading(box, t('tech', 'Techniques'));
    check(box, t('gzip', 'Compress text files (gzip or Brotli)'), o.gzip, (v) => { o.gzip = v; rerun(); });
    check(box, t('defer', 'Defer scripts (do not block the first paint)'), o.defer, (v) => { o.defer = v; rerun(); });
    check(box, t('preload', 'Preload the fonts'), o.preload, (v) => { o.preload = v; rerun(); });
    check(box, t('preconnect', 'Preconnect to the font host'), o.preconnect, (v) => { o.preconnect = v; rerun(); });
    check(box, t('lazy', 'Lazy-load photos below the fold'), o.lazy, (v) => { o.lazy = v; rerun(); });
  }
  build();
  const out = stats(L.panel, [['a', 'FCP'], ['b', 'LCP'], ['c', t('st.load', 'Fully loaded')]]);
  heading(L.panel, t('cmp', 'Compare runs'));
  buttons(L.panel, [[t('keep', 'Keep this run'), () => { const l = kept.get(); l.unshift({ o: { ...o }, fcp: sim.fcp, lcp: sim.lcp, load: sim.load, bytes: sim.bytes }); while (l.length > 6) l.pop(); kept.set(l); showKept(); }, true], [t('clearc', 'Clear'), () => { kept.set([]); showKept(); }]]);
  const table = h('div', { style: { fontSize: '12px', overflowX: 'auto' } }); L.panel.append(table);
  const ms = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`);
  function showKept() {
    table.replaceChildren(); const l = kept.get(); if (!l.length) return;
    const tb = h('table', { style: { width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--mono, monospace)' } });
    tb.append(h('tr', {}, ...['', 'FCP', 'LCP', t('st.load', 'Fully loaded')].map((x) => h('th', { text: x, style: { textAlign: 'start', padding: '3px 4px', borderBottom: '1px solid var(--line)' } }))));
    l.forEach((k) => tb.append(h('tr', {}, h('td', { text: `${k.o.proto.toUpperCase()} ${k.o.rtt}ms ${k.o.mbps}M${k.o.gzip ? ' gz' : ''}${k.o.defer ? ' df' : ''}${k.o.preload ? ' pl' : ''}${k.o.preconnect ? ' pc' : ''}${k.o.lazy ? ' lz' : ''}`, style: { padding: '3px 4px' } }), ...[k.fcp, k.lcp, k.load].map((v) => h('td', { text: ms(v), style: { padding: '3px 4px' } })))));
    table.append(tb, h('p', { class: 'wk-note', text: t('legend', 'gz compressed · df deferred scripts · pl preloaded fonts · pc preconnect · lz lazy photos') }));
  }
  showKept();

  /* ---------- waterfall ---------- */
  const COL: Record<string, string> = { queue: '#3a3f4b', dns: '#3fb8af', tcp: '#f0a04b', tls: '#a77bd6', wait: '#7fbf6a', dl: '#4f8fe8' };
  const lp = loop(ctx, S.cv, (dt) => {
    const g = S.g, W = S.w, H = S.h; anim = ctx.calm ? 1 : Math.min(1, anim + dt / 1.6);
    g.fillStyle = '#12151c'; g.fillRect(0, 0, W, H);
    const lw = W < 520 ? 92 : 150, top = 96, bottom = 46, rows = sim.rows, rh = Math.max(8, Math.min(28, (H - top - bottom) / rows.length)), span = Math.max(sim.load, sim.lcp) * 1.06, sx = (W - lw - 16) / span, X = (v: number) => lw + v * sx;
    const now = span * anim;
    /* time grid */
    const ticks = Math.max(3, Math.floor((W - lw) / 72)), stepT = [50, 100, 200, 500, 1000, 2000, 5000, 10000].find((s) => span / s < ticks) ?? 20000;
    g.font = '10px ui-monospace, monospace'; g.fillStyle = '#7d869a';
    for (let v = 0; v <= span; v += stepT) { g.strokeStyle = 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(X(v), top - 8); g.lineTo(X(v), H - bottom + 6); g.stroke(); g.fillText(ms(v), X(v) + 2, H - bottom + 18); }
    rows.forEach((r, i) => {
      const y = top + i * rh, bh = Math.max(4, rh * .62), yy = y + (rh - bh) / 2, clip = (a: number, b: number, c: string) => { const e = Math.min(b, now); if (e <= a) return; g.fillStyle = c; g.fillRect(X(a), yy, Math.max(1, (e - a) * sx), bh); };
      if (rh >= 10) { g.fillStyle = { html: '#e8e4da', css: '#c7a3ff', js: '#ffd166', img: '#7fd3c1', font: '#f4978e' }[r.kind]; g.font = `${Math.min(11, rh * .7)}px ui-monospace, monospace`; g.fillText(r.name.length > (lw / 7) ? r.name.slice(0, Math.floor(lw / 7) - 1) + '…' : r.name, 8, y + rh * .72); }
      const firstConn = r.dns?.[0] ?? r.tcp?.[0] ?? r.sent;
      clip(r.disc, firstConn, COL.queue);
      if (r.dns) clip(r.dns[0], r.dns[1], COL.dns);
      if (r.tcp) clip(r.tcp[0], r.tcp[1], COL.tcp);
      if (r.tls) clip(r.tls[0], r.tls[1], COL.tls);
      clip(r.tls?.[1] ?? r.tcp?.[1] ?? r.sent, r.sent, COL.queue);
      clip(r.sent, r.fb, COL.wait); clip(r.fb, r.end, COL.dl);
    });
    /* milestones */
    for (const [v, label, c] of [[sim.fcp, 'FCP', '#ffd166'], [sim.lcp, 'LCP', '#f4978e'], [sim.load, t('m.load', 'Loaded'), '#e8e4da']] as [number, string, string][]) {
      if (v > now) continue; g.strokeStyle = c; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(v), top - 18); g.lineTo(X(v), H - bottom); g.stroke(); g.setLineDash([]); g.fillStyle = c; g.font = '11px ui-monospace, monospace'; g.fillText(label, X(v) + 3, top - 20 + (label === 'LCP' ? 11 : label === 'FCP' ? 0 : 22));
    }
    /* legend */
    let lx = 8; const ly = H - 12;
    for (const [k, label] of [['dns', 'DNS'], ['tcp', 'TCP'], ['tls', 'TLS'], ['wait', t('l.wait', 'waiting')], ['dl', t('l.dl', 'download')], ['queue', t('l.queue', 'queued')]] as [string, string][]) { g.fillStyle = COL[k]; g.fillRect(lx, ly - 8, 10, 8); g.fillStyle = '#aeb6c8'; g.font = '10px ui-monospace, monospace'; g.fillText(label, lx + 13, ly); lx += g.measureText(label).width + 26; }
    out('a', ms(sim.fcp)); out('b', ms(sim.lcp)); out('c', ms(sim.load));
    g.fillStyle = '#aeb6c8'; g.font = '11px ui-monospace, monospace'; g.fillText(`${sim.rows.length} ${t('files', 'files')} · ${(sim.bytes / 1024).toFixed(0)} KB · ${sim.conns} ${t('conns', 'connections')}${sim.skipped ? ` · ${sim.skipped} ${t('later', 'photos wait for scrolling')}` : ''}`, 8, 62);
    if (anim >= 1) lp.pause();
  });
  S.onResize(() => lp.play());
  lp.play();
}
