/* 067 Cultural Discovery. How different cultures count days and write numbers, computed live:
   · Calendars: one date seen through eleven calendars at once — the revised Bengali calendar of Bangladesh
     (implemented here), Gregorian, Islamic (Umm al-Qura), Hebrew, Chinese, Persian (Solar Hijri), Indian national
     (Saka), Ethiopian, Coptic, Buddhist and Japanese era, using your browser's built-in calendar engine (ICU).
     A ring for each calendar shows how far through its year the date is, and when its next new year falls.
   · Numbers: one number written in many numeral systems — Bengali, Devanagari, Eastern Arabic, Persian, Thai,
     Tamil, Tibetan, Chinese characters, Roman numerals — plus Maya base-20 dots and bars and Babylonian base-60
     wedges, drawn here. */
import { type Ctx, h, s, layout, heading, note, seg, stats, store, clamp } from './kit';

/* ---------- the revised Bengali calendar (Bangladesh, 2019 revision) ----------
   1 Boishakh = 14 April. Boishakh–Ashwin have 31 days; Kartik, Ogrohayon, Poush, Magh and Chaitra 30;
   Falgun 29, or 30 when that February is a leap year. This keeps 21 February = 8 Falgun,
   26 March = 12 Chaitra and 16 December = 1 Poush every year. */
export const BN_MONTHS = ['বৈশাখ', 'জ্যৈষ্ঠ', 'আষাঢ়', 'শ্রাবণ', 'ভাদ্র', 'আশ্বিন', 'কার্তিক', 'অগ্রহায়ণ', 'পৌষ', 'মাঘ', 'ফাল্গুন', 'চৈত্র'];
export const BN_MONTHS_LAT = ['Boishakh', 'Joishtho', 'Asharh', 'Srabon', 'Bhadro', 'Ashwin', 'Kartik', 'Ogrohayon', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
const leap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const DAY = 86400000;
const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
export function bangla(d: Date) {
  let y = d.getUTCFullYear(); if (utcDay(d) < Date.UTC(y, 3, 14)) y--;
  const start = Date.UTC(y, 3, 14), lens = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, leap(y + 1) ? 30 : 29, 30];
  let n = Math.round((utcDay(d) - start) / DAY), m = 0; while (n >= lens[m]) { n -= lens[m]; m++; }
  return { year: y - 593, month: m, day: n + 1, dayOfYear: Math.round((utcDay(d) - start) / DAY), yearLen: lens.reduce((a, b) => a + b, 0), nextNew: Date.UTC(y + 1, 3, 14) };
}

/* ---------- other calendars through Intl ---------- */
export const CALS = ['gregory', 'islamic-umalqura', 'hebrew', 'chinese', 'persian', 'indian', 'ethiopic', 'coptic', 'buddhist', 'japanese'] as const;
export function supported(cal: string) { try { return new Intl.DateTimeFormat('en-u-ca-' + cal, { timeZone: 'UTC' }).resolvedOptions().calendar === cal; } catch { return false; } }
/** a key that changes exactly when the calendar's year changes */
function yearKey(f: Intl.DateTimeFormat, t: number) { const p = f.formatToParts(new Date(t)); return p.filter((x) => x.type === 'year' || x.type === ('relatedYear' as string) || x.type === ('yearName' as string) || x.type === 'era').map((x) => x.value).join('|'); }
/** first day of the year containing day t, first day of the next year (UTC midnights) */
export function yearBounds(cal: string, t: number) {
  const f = new Intl.DateTimeFormat('en-u-ca-' + cal, { year: 'numeric', era: 'short', timeZone: 'UTC' }), k = yearKey(f, t);
  const edge = (dir: 1 | -1) => { let a = t; for (let step = 32; step >= 1; step /= 2) while (yearKey(f, a + dir * step * DAY) === k && Math.abs(a - t) < 800 * DAY) a += dir * step * DAY; return a; };
  return { start: edge(-1), next: edge(1) + DAY };
}
export function fmt(cal: string, lang: string, t: number) {
  try { return new Intl.DateTimeFormat(`${lang}-u-ca-${cal}`, { year: 'numeric', month: 'long', day: 'numeric', era: cal === 'gregory' ? undefined : 'short', timeZone: 'UTC' }).format(new Date(t)); } catch { return '—'; }
}
export const ZODIAC = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
/** animal of a Chinese year given its related Gregorian year (1984 began a Rat year) */
export const zodiac = (relatedYear: number) => ZODIAC[(((relatedYear - 1984) % 12) + 12) % 12];

/* ---------- numerals ---------- */
export function roman(n: number) { if (n < 1 || n > 3999) return ''; const v: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let o = ''; for (const [k, r] of v) while (n >= k) { o += r; n -= k; } return o; }
const CD = '零一二三四五六七八九';
function cn4(n: number, lead: boolean) { const u = ['千', '百', '十', ''], d = [Math.floor(n / 1000), Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10]; let o = '', zero = false, started = lead;
  d.forEach((x, i) => { if (x === 0) { if (started) zero = true; return; } if (zero) { o += '零'; zero = false; } o += CD[x] + u[i]; started = true; }); return o; }
/** Chinese numerals with 十 百 千 万 亿, as written in everyday text */
export function chinese(n: number) {
  if (!Number.isInteger(n) || n < 0 || n >= 1e12) return ''; if (n === 0) return '零';
  const g = [n % 10000, Math.floor(n / 1e4) % 10000, Math.floor(n / 1e8)], names = ['', '万', '亿']; let o = '', zero = false;
  for (let i = 2; i >= 0; i--) { if (!g[i]) { if (o) zero = true; continue; } if (o && (zero || g[i] < 1000)) o += '零'; o += cn4(g[i], false) + names[i]; zero = false; }
  return o.replace(/^一十/, '十');
}
export const digitsIn = (n: number, base: number) => { if (n === 0) return [0]; const o: number[] = []; while (n > 0) { o.unshift(n % base); n = Math.floor(n / base); } return o; };
export const NUMSYS: [string, string][] = [['beng', 'Bengali'], ['deva', 'Devanagari'], ['arab', 'Eastern Arabic'], ['arabext', 'Persian / Urdu'], ['thai', 'Thai'], ['tamldec', 'Tamil'], ['tibt', 'Tibetan'], ['mymr', 'Myanmar'], ['khmr', 'Khmer']];
export function inSystem(n: number, nu: string) { try { const f = new Intl.NumberFormat('en-u-nu-' + nu, { useGrouping: false }); return f.resolvedOptions().numberingSystem === nu ? f.format(n) : ''; } catch { return ''; } }

/* ---------- world ---------- */
export default function (ctx: Ctx) {
  const t = ctx.t, lang = ctx.lang;
  const L = layout(ctx); L.view.classList.add('flow', 'w67');
  const stage = h('div', { class: 'w67-stage' }); L.view.append(stage);
  type Cfg = { room: 'cal' | 'num'; n: number };
  const st = store<Cfg>(ctx.id, 'cfg', { room: 'cal', n: 1971 }, (v) => typeof v === 'object' && v !== null && 'room' in v);
  const cfg: Cfg = { ...({ room: 'cal', n: 1971 } as Cfg), ...st.get() }; const save = () => st.set(cfg);
  let day = utcDay(new Date());

  heading(L.panel, t('h', 'Discover'));
  seg(L.panel, t('room', 'Room'), [['cal', t('r.cal', 'Calendars')], ['num', t('r.num', 'Numbers')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); build(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };
  const CALNAME: Record<string, string> = { bangla: t('c.bangla', 'Bengali (Bangladesh)'), gregory: t('c.gregory', 'Gregorian'), 'islamic-umalqura': t('c.islamic', 'Islamic (Umm al-Qura)'), hebrew: t('c.hebrew', 'Hebrew'), chinese: t('c.chinese', 'Chinese'), persian: t('c.persian', 'Persian (Solar Hijri)'), indian: t('c.indian', 'Indian national (Saka)'), ethiopic: t('c.ethiopic', 'Ethiopian'), coptic: t('c.coptic', 'Coptic'), buddhist: t('c.buddhist', 'Buddhist (Thai)'), japanese: t('c.japanese', 'Japanese era') };
  const COLS = ['#e76f51', '#2a9d8f', '#e9c46a', '#8ab17d', '#d62828', '#6d597a', '#f4a261', '#457b9d', '#bc6c25', '#9c6644', '#5e60ce'];
  const dfmt = (ms: number) => new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  /* ---------- calendars ---------- */
  function calRows() {
    const b = bangla(new Date(day));
    const bnText = lang === 'bn' ? `${new Intl.NumberFormat('bn').format(b.day)} ${BN_MONTHS[b.month]} ${new Intl.NumberFormat('bn', { useGrouping: false }).format(b.year)} বঙ্গাব্দ` : `${b.day} ${BN_MONTHS_LAT[b.month]} ${b.year} (${b.day} ${BN_MONTHS[b.month]})`;
    const rows: { id: string; text: string; frac: number; next: number; extra?: string }[] = [{ id: 'bangla', text: bnText, frac: b.dayOfYear / b.yearLen, next: b.nextNew }];
    for (const c of CALS) {
      if (!supported(c)) continue;
      const yb = yearBounds(c, day), frac = (day - yb.start) / (yb.next - yb.start);
      let extra = ''; if (c === 'chinese') { const ry = new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(day)).find((p) => p.type === ('relatedYear' as string)); if (ry) extra = `${t('z.' + zodiac(+ry.value), zodiac(+ry.value))}`; }
      rows.push({ id: c, text: fmt(c, lang, day), frac, next: yb.next, extra });
    }
    return rows;
  }
  function drawCal() {
    stage.replaceChildren();
    const rows = calRows();
    const R0 = 46, gap = 13, N = rows.length, size = 2 * (R0 + gap * N) + 20, c = size / 2;
    const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'w67-rings', role: 'img', 'aria-label': t('rings', 'Rings: how far through its year each calendar is on this date') });
    rows.forEach((r, i) => {
      const rad = R0 + gap * (N - i), a = r.frac * Math.PI * 2, x = c + rad * Math.sin(a), y = c - rad * Math.cos(a);
      svg.append(s('circle', { cx: c, cy: c, r: rad, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .12, 'stroke-width': 9 }));
      svg.append(s('path', { d: `M${c},${c - rad} A${rad},${rad} 0 ${a > Math.PI ? 1 : 0} 1 ${x.toFixed(2)},${y.toFixed(2)}`, fill: 'none', stroke: COLS[i % COLS.length], 'stroke-width': 9, 'stroke-linecap': 'round' }));
    });
    svg.append(s('text', { x: c, y: c - 4, 'text-anchor': 'middle', class: 'w67-c1' }, document.createTextNode(new Date(day).toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'UTC' }))));
    svg.append(s('text', { x: c, y: c + 14, 'text-anchor': 'middle', class: 'w67-c2' }, document.createTextNode(String(new Date(day).getUTCFullYear()))));
    const list = h('ol', { class: 'w67-list' });
    rows.forEach((r, i) => {
      const daysTo = Math.round((r.next - day) / DAY);
      list.append(h('li', {}, h('span', { class: 'w67-dot', style: { background: COLS[i % COLS.length] } }), h('div', {}, h('strong', { text: CALNAME[r.id] }), h('span', { class: 'w67-date', text: r.text + (r.extra ? ` · ${t('zodiac', 'zodiac animal')}: ${r.extra}` : '') }), h('span', { class: 'w67-m', text: `${Math.round(r.frac * 100)}% ${t('through', 'through the year')} · ${t('newyear', 'next new year')} ${dfmt(r.next)} (${daysTo} ${t('days', 'days')})` }))));
    });
    stage.append(h('div', { class: 'w67-calwrap' }, svg, list));
    const soonest = rows.slice().sort((a, b) => a.next - b.next)[0];
    out('a', String(rows.length)); out('b', `${CALNAME[soonest.id]}`); out('c', `${Math.round((soonest.next - day) / DAY)} ${t('days', 'days')}`);
  }

  /* ---------- numbers ---------- */
  function mayaSvg(n: number) {
    const D = digitsIn(n, 20), cell = 64, W = 120, H = D.length * cell + 10;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w67-maya', role: 'img', 'aria-label': `${t('maya', 'Maya')}: ${D.join(' · ')}` });
    D.forEach((d, i) => {
      const y0 = 5 + i * cell, bars = Math.floor(d / 5), dots = d % 5;
      if (i) svg.append(s('line', { x1: 14, x2: W - 14, y1: y0, y2: y0, stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-dasharray': '3 4' }));
      if (d === 0) { svg.append(s('ellipse', { cx: W / 2, cy: y0 + cell / 2, rx: 26, ry: 13, fill: 'none', stroke: 'currentColor', 'stroke-width': 3 })); svg.append(s('path', { d: `M${W / 2 - 18},${y0 + cell / 2} q18,-10 36,0`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2 })); return; }
      const top = y0 + (cell - (bars * 12 + (dots ? 14 : 0))) / 2;
      for (let k = 0; k < dots; k++) svg.append(s('circle', { cx: W / 2 + (k - (dots - 1) / 2) * 16, cy: top + 5, r: 5.5, fill: 'currentColor' }));
      for (let k = 0; k < bars; k++) svg.append(s('rect', { x: W / 2 - 34, y: top + (dots ? 14 : 0) + k * 12, width: 68, height: 8, rx: 3, fill: 'currentColor' }));
    });
    return svg;
  }
  function babySvg(n: number) {
    const D = digitsIn(n, 60), cw = 92, W = D.length * cw + 10, H = 92;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'w67-baby', role: 'img', 'aria-label': `${t('baby', 'Babylonian')}: ${D.join(' · ')}` });
    const wedge = (x: number, y: number) => svg.append(s('path', { d: `M${x - 6},${y} h12 l-6,7 Z M${x},${y + 6} v22`, fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 2.4 }));
    const corner = (x: number, y: number) => svg.append(s('path', { d: `M${x + 10},${y - 10} L${x - 6},${y} L${x + 10},${y + 10}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 3, 'stroke-linejoin': 'round' }));
    D.forEach((d, i) => {
      const x0 = 5 + i * cw, tens = Math.floor(d / 10), ones = d % 10;
      for (let k = 0; k < tens; k++) corner(x0 + 10 + (k % 3) * 12, 28 + Math.floor(k / 3) * 24);
      for (let k = 0; k < ones; k++) wedge(x0 + (tens ? 46 : 22) + (k % 3) * 14, 12 + Math.floor(k / 3) * 26);
      if (d === 0) svg.append(s('text', { x: x0 + cw / 2, y: 50, 'text-anchor': 'middle', class: 'w67-m' }, document.createTextNode(t('gap', '(gap)'))));
    });
    return svg;
  }
  function drawNum() {
    stage.replaceChildren();
    const n = cfg.n, grid = h('div', { class: 'w67-grid' });
    const card = (name: string, val: string, cls = '') => { if (val) grid.append(h('div', { class: 'w67-card' }, h('span', { class: 'w67-m', text: name }), h('span', { class: 'w67-big ' + cls, text: val }))); };
    card(t('n.western', 'Western Arabic'), String(n));
    for (const [nu, nm] of NUMSYS) card(t('n.' + nu, nm), inSystem(n, nu));
    card(t('n.chinese', 'Chinese characters'), chinese(n), 'w67-cjk');
    if (n >= 1 && n <= 3999) card(t('n.roman', 'Roman'), roman(n)); else grid.append(h('div', { class: 'w67-card' }, h('span', { class: 'w67-m', text: t('n.roman', 'Roman') }), h('span', { text: n ? t('toobig', 'Romans had no standard way past 3,999') : t('nozero', 'no zero in Roman numerals') })));
    const md = digitsIn(n, 20), bd = digitsIn(n, 60);
    grid.append(h('div', { class: 'w67-card' }, h('span', { class: 'w67-m', text: `${t('maya', 'Maya')} · ${t('base20', 'base 20, read top to bottom')}: ${md.join(' | ')}` }), mayaSvg(n)));
    grid.append(h('div', { class: 'w67-card w67-wide' }, h('span', { class: 'w67-m', text: `${t('baby', 'Babylonian')} · ${t('base60', 'base 60, read left to right')}: ${bd.join(' | ')}` }), babySvg(n)));
    stage.append(grid);
    out('a', String(n)); out('b', md.join('·')); out('c', bd.join('·'));
  }

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.room === 'cal') {
      about.textContent = t('ab.cal', 'The same day has many names. Some calendars follow the Sun, some the Moon, some both; their years start on different days. Each ring shows how far through its own year this date is. The Bengali calendar follows the revised Bangladesh rules; the others come from your browser\'s calendar engine. Any of them can differ by a day from official announcements or local moon sighting.');
      const id = 'w67d'; const inp = h('input', { type: 'date', id, value: new Date(day).toISOString().slice(0, 10) }) as HTMLInputElement;
      inp.addEventListener('change', () => { const v = Date.parse(inp.value + 'T00:00:00Z'); if (!isNaN(v)) { day = v; drawCal(); } });
      box.append(h('label', { class: 'wk-r', for: id }, h('span', { text: t('date', 'Date') }), inp));
      const row = h('div', { class: 'wk-row' });
      const jump = (txt: string, f: () => number) => row.append(h('button', { type: 'button', class: 'wk-b', text: txt, onclick: () => { day = f(); inp.value = new Date(day).toISOString().slice(0, 10); drawCal(); } }));
      jump(t('today', 'Today'), () => utcDay(new Date()));
      jump(t('pohela', 'Pohela Boishakh'), () => { const y = new Date().getUTCFullYear(), x = Date.UTC(y, 3, 14); return x >= utcDay(new Date()) ? x : Date.UTC(y + 1, 3, 14); });
      jump(t('ekushe', '21 February'), () => Date.UTC(new Date().getUTCFullYear(), 1, 21));
      jump('−1', () => day - DAY); jump('+1', () => day + DAY);
      box.append(row);
      lab(t('st.cals', 'Calendars shown'), t('st.next', 'Next new year'), t('st.in', 'In'));
      drawCal();
    } else {
      about.textContent = t('ab.num', 'Digits look different around the world, but most modern systems, including Bengali and Devanagari, work like the Western ones: ten symbols and place value, an idea that came from India. Chinese characters name the powers of ten instead. The Maya counted in twenties with dots and bars and had a zero; the Babylonians counted in sixties with two wedge signs, which is why an hour has 60 minutes.');
      const id = 'w67n'; const inp = h('input', { type: 'number', id, min: 0, max: 99999999, step: 1, value: String(cfg.n), inputmode: 'numeric' }) as HTMLInputElement;
      inp.addEventListener('input', () => { const v = Math.floor(+inp.value); if (Number.isFinite(v)) { cfg.n = clamp(v, 0, 99999999); save(); drawNum(); } });
      box.append(h('label', { class: 'wk-r', for: id }, h('span', { text: t('number', 'Number') }), inp));
      const row = h('div', { class: 'wk-row' });
      for (const [v, k] of [[1971, 'y1971'], [2026, 'thisyear'], [3600, 'hour'], [400, 'maya400']] as [number, string][]) row.append(h('button', { type: 'button', class: 'wk-b', text: String(v), 'aria-label': `${v}`, onclick: () => { cfg.n = v; inp.value = String(v); save(); drawNum(); void k; } }));
      box.append(row);
      lab(t('st.n', 'Number'), t('st.maya', 'Maya digits'), t('st.baby', 'Babylonian digits'));
      drawNum();
    }
  }
  build();
}
