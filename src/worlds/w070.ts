/* 070 World Heritage. A heritage atlas and a "where in the world" game, drawn on real coastlines:
   · Atlas: 40 World Heritage properties on an Equal Earth map, coloured by type (cultural, natural, mixed),
     filtered by type and region, with a year slider and a "play the years" mode that shows how the list
     grew from the first inscriptions in 1978. Tap a site for its year, country and type.
   · Where is it?: ten rounds; the game names a site and you tap the map where you think it is. Scores
     come from the true great-circle distance, and your best game is kept on this device.
   Inscription years are the year each property was first inscribed by UNESCO's World Heritage Committee. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, stats, buttons, local, clamp, store, rng } from './kit';
import { haversine } from './geo';
import { eeFwd, eeInv, decodeLand, unwrapRings } from './w065';

export type Kind = 'c' | 'n' | 'm';
export type Region = 'asia' | 'europe' | 'africa' | 'americas' | 'oceania';
/** id, English name, country, first inscribed, type, region, lat, lon */
export type Site = { id: string; name: string; country: string; year: number; kind: Kind; region: Region; lat: number; lon: number };
export const SITES: Site[] = [
  { id: 'sundarbans', name: 'The Sundarbans', country: 'Bangladesh', year: 1997, kind: 'n', region: 'asia', lat: 21.95, lon: 89.18 },
  { id: 'bagerhat', name: 'Historic Mosque City of Bagerhat', country: 'Bangladesh', year: 1985, kind: 'c', region: 'asia', lat: 22.67, lon: 89.74 },
  { id: 'paharpur', name: 'Buddhist Vihara at Paharpur', country: 'Bangladesh', year: 1985, kind: 'c', region: 'asia', lat: 25.03, lon: 88.98 },
  { id: 'taj', name: 'Taj Mahal', country: 'India', year: 1983, kind: 'c', region: 'asia', lat: 27.17, lon: 78.04 },
  { id: 'kathmandu', name: 'Kathmandu Valley', country: 'Nepal', year: 1979, kind: 'c', region: 'asia', lat: 27.70, lon: 85.31 },
  { id: 'sagarmatha', name: 'Sagarmatha National Park', country: 'Nepal', year: 1979, kind: 'n', region: 'asia', lat: 27.95, lon: 86.82 },
  { id: 'greatwall', name: 'The Great Wall', country: 'China', year: 1987, kind: 'c', region: 'asia', lat: 40.43, lon: 116.57 },
  { id: 'angkor', name: 'Angkor', country: 'Cambodia', year: 1992, kind: 'c', region: 'asia', lat: 13.41, lon: 103.87 },
  { id: 'borobudur', name: 'Borobudur Temple Compounds', country: 'Indonesia', year: 1991, kind: 'c', region: 'asia', lat: -7.61, lon: 110.20 },
  { id: 'halong', name: 'Ha Long Bay', country: 'Viet Nam', year: 1994, kind: 'n', region: 'asia', lat: 20.91, lon: 107.18 },
  { id: 'kyoto', name: 'Historic Monuments of Ancient Kyoto', country: 'Japan', year: 1994, kind: 'c', region: 'asia', lat: 35.01, lon: 135.77 },
  { id: 'petra', name: 'Petra', country: 'Jordan', year: 1985, kind: 'c', region: 'asia', lat: 30.33, lon: 35.44 },
  { id: 'jerusalem', name: 'Old City of Jerusalem and its Walls', country: 'proposed by Jordan', year: 1981, kind: 'c', region: 'asia', lat: 31.78, lon: 35.23 },
  { id: 'goreme', name: 'Göreme National Park and the Rock Sites of Cappadocia', country: 'Türkiye', year: 1985, kind: 'm', region: 'asia', lat: 38.66, lon: 34.85 },
  { id: 'rome', name: 'Historic Centre of Rome', country: 'Italy / Holy See', year: 1980, kind: 'c', region: 'europe', lat: 41.90, lon: 12.49 },
  { id: 'venice', name: 'Venice and its Lagoon', country: 'Italy', year: 1987, kind: 'c', region: 'europe', lat: 45.44, lon: 12.33 },
  { id: 'acropolis', name: 'Acropolis, Athens', country: 'Greece', year: 1987, kind: 'c', region: 'europe', lat: 37.97, lon: 23.73 },
  { id: 'paris', name: 'Paris, Banks of the Seine', country: 'France', year: 1991, kind: 'c', region: 'europe', lat: 48.86, lon: 2.32 },
  { id: 'alhambra', name: 'Alhambra, Generalife and Albayzín, Granada', country: 'Spain', year: 1984, kind: 'c', region: 'europe', lat: 37.18, lon: -3.59 },
  { id: 'stonehenge', name: 'Stonehenge, Avebury and Associated Sites', country: 'United Kingdom', year: 1986, kind: 'c', region: 'europe', lat: 51.18, lon: -1.83 },
  { id: 'memphis', name: 'Memphis and its Necropolis (Pyramid Fields from Giza to Dahshur)', country: 'Egypt', year: 1979, kind: 'c', region: 'africa', lat: 29.98, lon: 31.13 },
  { id: 'lalibela', name: 'Rock-Hewn Churches, Lalibela', country: 'Ethiopia', year: 1978, kind: 'c', region: 'africa', lat: 12.03, lon: 39.04 },
  { id: 'timbuktu', name: 'Timbuktu', country: 'Mali', year: 1988, kind: 'c', region: 'africa', lat: 16.77, lon: -3.01 },
  { id: 'serengeti', name: 'Serengeti National Park', country: 'Tanzania', year: 1981, kind: 'n', region: 'africa', lat: -2.33, lon: 34.83 },
  { id: 'kilimanjaro', name: 'Kilimanjaro National Park', country: 'Tanzania', year: 1987, kind: 'n', region: 'africa', lat: -3.07, lon: 37.36 },
  { id: 'victoria', name: 'Mosi-oa-Tunya / Victoria Falls', country: 'Zambia, Zimbabwe', year: 1989, kind: 'n', region: 'africa', lat: -17.92, lon: 25.86 },
  { id: 'yellowstone', name: 'Yellowstone National Park', country: 'United States', year: 1978, kind: 'n', region: 'americas', lat: 44.43, lon: -110.59 },
  { id: 'grandcanyon', name: 'Grand Canyon National Park', country: 'United States', year: 1979, kind: 'n', region: 'americas', lat: 36.11, lon: -112.11 },
  { id: 'liberty', name: 'Statue of Liberty', country: 'United States', year: 1984, kind: 'c', region: 'americas', lat: 40.69, lon: -74.04 },
  { id: 'chichen', name: 'Pre-Hispanic City of Chichen-Itza', country: 'Mexico', year: 1988, kind: 'c', region: 'americas', lat: 20.68, lon: -88.57 },
  { id: 'galapagos', name: 'Galápagos Islands', country: 'Ecuador', year: 1978, kind: 'n', region: 'americas', lat: -0.67, lon: -90.55 },
  { id: 'machu', name: 'Historic Sanctuary of Machu Picchu', country: 'Peru', year: 1983, kind: 'm', region: 'americas', lat: -13.16, lon: -72.55 },
  { id: 'iguazu', name: 'Iguazu National Park', country: 'Argentina', year: 1984, kind: 'n', region: 'americas', lat: -25.69, lon: -54.44 },
  { id: 'rapanui', name: 'Rapa Nui National Park', country: 'Chile', year: 1995, kind: 'c', region: 'americas', lat: -27.12, lon: -109.35 },
  { id: 'reef', name: 'Great Barrier Reef', country: 'Australia', year: 1981, kind: 'n', region: 'oceania', lat: -18.29, lon: 147.70 },
  { id: 'uluru', name: 'Uluṟu-Kata Tjuṯa National Park', country: 'Australia', year: 1987, kind: 'm', region: 'oceania', lat: -25.34, lon: 131.04 },
  { id: 'opera', name: 'Sydney Opera House', country: 'Australia', year: 2007, kind: 'c', region: 'oceania', lat: -33.86, lon: 151.22 },
  { id: 'tongariro', name: 'Tongariro National Park', country: 'New Zealand', year: 1990, kind: 'm', region: 'oceania', lat: -39.20, lon: 175.58 },
  { id: 'baikal', name: 'Lake Baikal', country: 'Russian Federation', year: 1996, kind: 'n', region: 'asia', lat: 53.50, lon: 108.17 },
  { id: 'iceland', name: 'Þingvellir National Park', country: 'Iceland', year: 2004, kind: 'c', region: 'europe', lat: 64.26, lon: -21.13 },
];
export const KIND_COL: Record<Kind, string> = { c: '#f2b45a', n: '#59d39a', m: '#c99bff' };
/** points for a guess: 1000 at the spot, falling smoothly to 0 at 5,000 km and beyond */
export function score(km: number) { return Math.max(0, Math.round(1000 * Math.exp(-km / 1500) - 1000 * Math.exp(-5000 / 1500) * (km / 5000))); }
/** a game of n distinct sites drawn from the list with the given seed */
export function deal(n: number, seed: number, pool = SITES) { const r = rng(seed), a = pool.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, Math.min(n, a.length)); }
/** how many sites in a list were inscribed in or before year y, by type */
export function countBy(list: Site[], y: number) { const o = { c: 0, n: 0, m: 0 }; for (const s of list) if (s.year <= y) o[s.kind]++; return o; }

export default function (ctx: Ctx) {
  const t = ctx.t, lang = ctx.lang;
  const L = layout(ctx);
  L.view.classList.add('w70');
  L.view.style.minHeight = 'clamp(300px, 52vw, 620px)';
  const S = canvas(L.view, t('cv', 'A world map with World Heritage sites, or the where-is-it game.'), { alpha: false });
  type Cfg = { room: 'atlas' | 'game'; c: boolean; n: boolean; m: boolean; region: string; best: number; played: number };
  const def: Cfg = { room: 'atlas', c: true, n: true, m: true, region: 'all', best: 0, played: 0 };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'room' in v);
  const cfg: Cfg = { ...def, ...st.get() }; const save = () => st.set(cfg);
  const nm = (s: Site) => t('s.' + s.id, s.name);
  const kindName = (k: Kind) => (k === 'c' ? t('k.c', 'Cultural') : k === 'n' ? t('k.n', 'Natural') : t('k.m', 'Mixed'));
  const regionName = (r: string) => t('r.' + r, r);
  const fmtKm = (km: number) => `${Math.round(km).toLocaleString(lang)} km`;
  let year = 2026, playing = 0, sel: Site | null = null;
  /* game state */
  let round = 0, total = 0, deck: Site[] = [], guess: [number, number] | null = null, last: { km: number; pts: number } | null = null, finished = false;

  heading(L.panel, t('h', 'Heritage atlas'));
  seg(L.panel, t('room', 'Mode'), [['atlas', t('m.atlas', 'Atlas')], ['game', t('m.game', 'Where is it?')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); stopPlay(); build(); draw(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };
  let yr: ReturnType<typeof range> | null = null;
  const visible = () => SITES.filter((s) => cfg[s.kind] && (cfg.region === 'all' || s.region === cfg.region));

  function stopPlay() { if (playing) { clearInterval(playing); playing = 0; } }
  function newGame() { deck = deal(10, (Date.now() & 0xffffff) ^ 0x5eed, SITES); round = 0; total = 0; guess = null; last = null; finished = false; }

  function build() {
    box.replaceChildren(); L.hud.textContent = ''; yr = null;
    if (cfg.room === 'atlas') {
      about.textContent = t('ab.atlas', 'The World Heritage List protects places of outstanding value to all of humanity. Here are 40 of them. Gold dots are cultural sites, green are natural, violet are both (mixed). Move the year slider or press play to watch the list grow from its first inscriptions in 1978. Tap a dot for details.');
      const types = h('fieldset', { class: 'w70-types' }, h('legend', { text: t('types', 'Types') }));
      for (const k of ['c', 'n', 'm'] as Kind[]) { const id = `w70-${k}`, inp = h('input', { type: 'checkbox', id }) as HTMLInputElement; inp.checked = cfg[k]; inp.addEventListener('change', () => { cfg[k] = inp.checked; save(); draw(); }); types.append(h('label', { for: id }, inp, h('i', { style: { background: KIND_COL[k] } }), h('span', { text: kindName(k) }))); }
      box.append(types);
      const rs = h('select', { id: 'w70-region' }) as HTMLSelectElement;
      for (const r of ['all', 'africa', 'americas', 'asia', 'europe', 'oceania']) { const o = h('option', { value: r, text: r === 'all' ? t('r.all', 'All regions') : regionName(r) }) as HTMLOptionElement; if (r === cfg.region) o.selected = true; rs.append(o); }
      rs.addEventListener('change', () => { cfg.region = rs.value; save(); sel = null; draw(); });
      box.append(h('label', { class: 'wk-r', for: 'w70-region' }, h('span', { text: t('region', 'Region') }), rs));
      yr = range(box, t('year', 'Inscribed by'), { min: 1978, max: 2026, step: 1, value: year, fmt: (v) => String(v) }, (v) => { year = v; stopPlay(); draw(); });
      buttons(box, [[t('play', 'Play the years'), () => { stopPlay(); year = 1977; playing = window.setInterval(() => { year++; if (yr) yr.set(year); draw(); if (year >= 2026) stopPlay(); }, 160); }, true], [t('all', 'Show all'), () => { stopPlay(); year = 2026; if (yr) yr.set(year); draw(); }]]);
      lab(t('st.shown', 'Sites shown'), t('st.mix', 'Cultural / natural / mixed'), t('st.sel', 'Selected'));
    } else {
      about.textContent = t('ab.game', 'Ten rounds. Each round names a World Heritage site; tap the map where you think it is. The closer you are, the more points (up to 1,000 a round). Distances are measured along the Earth’s surface.');
      if (!deck.length) newGame();
      buttons(box, [[t('next', 'Next round'), () => { if (!guess || finished) return; round++; guess = null; last = null; if (round >= deck.length) { finished = true; round = deck.length - 1; cfg.played++; if (total > cfg.best) cfg.best = total; save(); } draw(); }, true], [t('new', 'New game'), () => { newGame(); draw(); }]]);
      lab(t('st.round', 'Round'), t('st.score', 'Score'), t('st.best', 'Best on this device'));
    }
  }

  /* ---------- map ---------- */
  const rings = unwrapRings(decodeLand());
  let landCv: HTMLCanvasElement | null = null, geo = { cx: 0, cy: 0, k: 1 }, lastW = 0, lastH = 0;
  const EX = eeFwd(180, 0)[0], EY = eeFwd(0, 90)[1];
  function frame(W: number, Hh: number) { const pad = 16, top = 34, k = Math.min((W - pad * 2) / (2 * EX), (Hh - top - pad - 20) / (2 * EY)); return { cx: W / 2, cy: top + (Hh - top - pad - 20) / 2, k }; }
  const P = (lo: number, la: number): [number, number] => { const [x, y] = eeFwd(lo, la); return [geo.cx + x * geo.k, geo.cy - y * geo.k]; };
  function outlinePath(g: CanvasRenderingContext2D) { g.beginPath(); for (let la = -90; la <= 90; la += 2) { const [x, y] = P(180, la); if (la === -90) g.moveTo(x, y); else g.lineTo(x, y); } for (let la = 90; la >= -90; la -= 2) { const [x, y] = P(-180, la); g.lineTo(x, y); } g.closePath(); }
  function bakeLand(W: number, Hh: number) {
    geo = frame(W, Hh); lastW = W; lastH = Hh;
    const c = document.createElement('canvas'), d = S.dpr; c.width = Math.max(1, Math.round(W * d)); c.height = Math.max(1, Math.round(Hh * d));
    const g = c.getContext('2d'); if (!g) return; g.scale(d, d);
    g.fillStyle = '#0a1422'; g.fillRect(0, 0, W, Hh);
    g.save(); outlinePath(g); g.fillStyle = '#10243a'; g.fill(); g.clip();
    g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
    for (let lo = -180; lo <= 180; lo += 30) { g.beginPath(); for (let la = -90; la <= 90; la += 3) { const [x, y] = P(lo, la); if (la === -90) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); for (let lo = -180; lo <= 180; lo += 3) { const [x, y] = P(lo, la); if (lo === -180) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
    g.beginPath(); for (const r of rings) for (const off of [-360, 0, 360]) r.forEach(([lo, la], i) => { const [x, y] = P(lo + off, la); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.fillStyle = '#2b3b33'; g.fill('evenodd'); g.strokeStyle = 'rgba(190,220,200,.25)'; g.lineWidth = .6; g.stroke();
    g.restore(); outlinePath(g); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1; g.stroke();
    landCv = c;
  }
  const toLonLat = (x: number, y: number) => eeInv((x - geo.cx) / geo.k, (geo.cy - y) / geo.k);

  function drawAtlas(g: CanvasRenderingContext2D, W: number, Hh: number) {
    const list = visible().filter((s) => s.year <= year);
    for (const s of list) { const [x, y] = P(s.lon, s.lat), on = sel?.id === s.id; g.beginPath(); g.arc(x, y, on ? 7 : 4.5, 0, 7); g.fillStyle = KIND_COL[s.kind]; g.fill(); g.lineWidth = on ? 2 : 1; g.strokeStyle = on ? '#fff' : 'rgba(0,0,0,.6)'; g.stroke(); }
    g.fillStyle = '#e8ecf4'; g.font = '600 15px ui-sans-serif, system-ui'; g.fillText(`${t('to', 'Inscribed by')} ${year}`, 16, 22);
    if (sel && list.includes(sel)) {
      const [x, y] = P(sel.lon, sel.lat); g.font = '12px ui-sans-serif, system-ui';
      const lines = [nm(sel), `${sel.country} · ${sel.year} · ${kindName(sel.kind)}`], w = Math.max(...lines.map((s) => g.measureText(s).width)) + 16;
      const bx = clamp(x + 10, 8, W - w - 8), by = clamp(y - 44, 30, Hh - 50);
      g.fillStyle = 'rgba(10,14,24,.88)'; g.fillRect(bx, by, w, 40); g.strokeStyle = KIND_COL[sel.kind]; g.strokeRect(bx + .5, by + .5, w - 1, 39);
      g.fillStyle = '#fff'; g.fillText(lines[0], bx + 8, by + 16); g.fillStyle = '#b9c3d6'; g.fillText(lines[1], bx + 8, by + 32);
    }
    const n = countBy(visible(), year);
    out('a', `${list.length} / ${visible().length}`); out('b', `${n.c} / ${n.n} / ${n.m}`); out('c', sel ? `${nm(sel).slice(0, 26)}${nm(sel).length > 26 ? '…' : ''}` : '—');
    L.hud.textContent = sel ? `${nm(sel)} — ${sel.country}, ${t('first', 'first inscribed')} ${sel.year} (${kindName(sel.kind)})` : t('tap', 'Tap a dot to see the site.');
  }
  function drawGame(g: CanvasRenderingContext2D) {
    const s = deck[round]; if (!s) return;
    g.fillStyle = '#e8ecf4'; g.font = '600 15px ui-sans-serif, system-ui';
    g.fillText(finished ? `${t('done', 'Game over')} · ${total.toLocaleString(lang)} / ${(deck.length * 1000).toLocaleString(lang)}` : `${round + 1}/${deck.length} · ${t('find', 'Find')}: ${nm(s)}`, 16, 22);
    if (guess) {
      const [gx, gy] = P(guess[0], guess[1]), [sx, sy] = P(s.lon, s.lat);
      g.strokeStyle = '#ffd166'; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(gx, gy); g.lineTo(sx, sy); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#7fd1ff'; g.beginPath(); g.arc(gx, gy, 5, 0, 7); g.fill();
      g.fillStyle = KIND_COL[s.kind]; g.beginPath(); g.arc(sx, sy, 7, 0, 7); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1;
      g.font = '600 12px ui-sans-serif, system-ui'; const lbl = nm(s), lw = g.measureText(lbl).width; const lx = clamp(sx + 10, 6, S.w - lw - 6), ly = clamp(sy - 10, 40, S.h - 8);
      g.fillStyle = 'rgba(10,14,24,.8)'; g.fillRect(lx - 4, ly - 13, lw + 8, 18); g.fillStyle = '#fff'; g.fillText(lbl, lx, ly);
    }
    out('a', `${round + 1} / ${deck.length}`); out('b', total.toLocaleString(lang)); out('c', cfg.best ? cfg.best.toLocaleString(lang) : '—');
    L.hud.textContent = finished ? `${t('final', 'Final score')} ${total.toLocaleString(lang)} · ${t('best', 'best')} ${cfg.best.toLocaleString(lang)}` : last ? `${nm(s)} — ${s.country}. ${t('dist', 'Distance')} ${fmtKm(last.km)} · +${last.pts} ${t('pts', 'points')}` : t('tapmap', 'Tap the map where you think it is.');
  }

  S.cv.addEventListener('click', (e) => {
    const p = local(e, S.cv), ll = toLonLat(p.x, p.y);
    if (cfg.room === 'atlas') {
      let best: Site | null = null, bd = 18; for (const s of visible().filter((x) => x.year <= year)) { const [x, y] = P(s.lon, s.lat), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = s; } }
      sel = best; draw(); return;
    }
    if (!ll || guess || finished) return; const s = deck[round]; if (!s) return;
    guess = [ll[0], ll[1]]; const km = haversine(ll[1], ll[0], s.lat, s.lon), pts = score(km); last = { km, pts }; total += pts;
    if (round === deck.length - 1) { finished = true; cfg.played++; if (total > cfg.best) cfg.best = total; save(); }
    draw();
  });

  let raf = 0;
  function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; const g = S.g, W = S.w, Hh = S.h; if (!landCv || W !== lastW || Hh !== lastH) bakeLand(W, Hh); if (landCv) g.drawImage(landCv, 0, 0, W, Hh); if (cfg.room === 'atlas') drawAtlas(g, W, Hh); else drawGame(g); }); }
  ctx.onDispose(() => { cancelAnimationFrame(raf); stopPlay(); });
  S.onResize(() => { landCv = null; draw(); });
  build(); draw();
}
