/* 018 Transportation Innovation: Commute Compare. Enter your trip and see how eight ways of
   travelling compare over a year in time, money, CO₂ and energy you burn yourself. A transit-map
   style race shows who arrives first. Every factor is editable, because cities differ a lot. */
import { type Ctx, h, layout, canvas, heading, note, range, select, seg, buttons, loop, store, clamp } from './kit';

interface Mode { key: string; name: string; col: string; kmh: number; wait: number; trip: number; perKm: number; co2: number; kcal: number }
/* Typical averages, rounded. CO₂ is grams per passenger-km (single-occupant car); see the note. */
const BASE: Mode[] = [
  { key: 'walk', name: 'Walk', col: '#2e9d5b', kmh: 5, wait: 0, trip: 0, perKm: 0, co2: 0, kcal: 50 },
  { key: 'bike', name: 'Bicycle', col: '#7bbf3a', kmh: 15, wait: 2, trip: 0, perKm: .02, co2: 0, kcal: 25 },
  { key: 'ebike', name: 'E-bike', col: '#d6b11f', kmh: 20, wait: 2, trip: 0, perKm: .02, co2: 5, kcal: 12 },
  { key: 'scoot', name: 'Shared e-scooter', col: '#f08a24', kmh: 15, wait: 3, trip: 1, perKm: .25, co2: 35, kcal: 0 },
  { key: 'bus', name: 'Bus', col: '#e5484d', kmh: 18, wait: 8, trip: 1.5, perKm: 0, co2: 100, kcal: 5 },
  { key: 'rail', name: 'Metro / rail', col: '#8e4ec6', kmh: 32, wait: 10, trip: 2, perKm: 0, co2: 35, kcal: 5 },
  { key: 'car', name: 'Petrol car', col: '#3e63dd', kmh: 30, wait: 8, trip: 0, perKm: .25, co2: 170, kcal: 0 },
  { key: 'ev', name: 'Electric car', col: '#0091ff', kmh: 30, wait: 8, trip: 0, perKm: .1, co2: 50, kcal: 0 },
];
const CUR: [string, string][] = [['$', 'US dollar $'], ['€', 'Euro €'], ['£', 'Pound £'], ['৳', 'Taka ৳'], ['₹', 'Rupee ₹'], ['¥', 'Yen ¥'], ['', 'No symbol']];

export function yearly(m: Mode, km: number, days: number, weeks = 46) {
  const trips = 2 * days * weeks;
  return { hours: trips * (km / m.kmh * 60 + m.wait) / 60, cost: trips * (m.trip + m.perKm * km), co2: trips * km * m.co2 / 1000, kcal: trips * km * m.kcal, mins: km / m.kmh * 60 + m.wait };
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const ok = (v: unknown) => !!v && typeof v === 'object' && Array.isArray((v as { modes: unknown }).modes);
  const st = store(18, 'set', { km: 8, days: 5, cur: '$', rate: 1, modes: BASE }, ok);
  const S0 = st.get();
  let km = clamp(+S0.km || 8, .5, 80), days = clamp(+S0.days || 5, 1, 7), cur = S0.cur ?? '$', rate = +S0.rate || 1, sort: 'hours' | 'cost' | 'co2' = 'hours';
  const modes: Mode[] = BASE.map((b) => ({ ...b, ...(S0.modes.find((m: Mode) => m.key === b.key) ?? {}) }));
  const enabled = new Set(modes.map((m) => m.key));
  const save = () => st.set({ km, days, cur, rate, modes });
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#e5484d');
  L.view.classList.add('flow'); L.view.style.background = '#f6f4ef'; L.view.style.color = '#16181d';
  const raceBox = h('div', { style: { position: 'relative', height: '300px', borderRadius: '14px', background: '#fff', border: '1px solid #e2dfd6', overflow: 'hidden' } });
  const S = canvas(raceBox, t('race', 'Race from home to work'));
  const tbl = h('div', { style: { marginTop: '18px', overflowX: 'auto' } });
  L.view.append(h('h2', { style: { margin: '0 0 12px', fontFamily: 'var(--serif, Georgia, serif)', fontWeight: '400', fontSize: 'clamp(22px,3vw,34px)' }, text: t('h', 'Your commute, eight ways') }), raceBox, tbl);
  let tRace = 0;
  const money = (n: number) => `${cur}${Math.round(n * rate).toLocaleString(ctx.lang)}`;

  function table() {
    const rows = modes.filter((m) => enabled.has(m.key)).map((m) => ({ m, y: yearly(m, km, days) })).sort((a, b) => a.y[sort] - b.y[sort]);
    const mx = { hours: Math.max(...rows.map((r) => r.y.hours), 1), cost: Math.max(...rows.map((r) => r.y.cost), 1), co2: Math.max(...rows.map((r) => r.y.co2), 1) };
    const bar = (v: number, max: number, col: string) => h('div', { style: { height: '6px', borderRadius: '3px', background: '#ece9e1', marginTop: '4px' } }, h('div', { style: { width: `${v / max * 100}%`, height: '100%', borderRadius: '3px', background: col } }));
    const th = (k: string, txt: string) => h('th', { scope: 'col', style: { textAlign: 'start', fontWeight: '500', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.08em', padding: '8px', color: '#6b6a64' } }, k ? h('button', { type: 'button', style: { all: 'unset', cursor: 'pointer', textDecoration: sort === k ? 'underline' : 'none' }, text: txt, onclick: () => { sort = k as typeof sort; table(); } }) : txt);
    const tb = h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', minWidth: '560px' } },
      h('thead', {}, h('tr', {}, th('', t('c.mode', 'Mode')), th('', t('c.trip', 'One way')), th('hours', t('c.hours', 'Hours a year')), th('cost', t('c.cost', 'Cost a year')), th('co2', t('c.co2', 'CO₂ a year')), th('', t('c.kcal', 'kcal burned')))));
    const body = h('tbody');
    for (const { m, y } of rows) body.append(h('tr', { style: { borderTop: '1px solid #e2dfd6' } },
      h('td', { style: { padding: '9px 8px' } }, h('span', { style: { display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: m.col, marginInlineEnd: '8px' } }), t('m.' + m.key, m.name)),
      h('td', { style: { padding: '9px 8px', fontFamily: 'ui-monospace,monospace' }, text: `${Math.round(y.mins)} min` }),
      h('td', { style: { padding: '9px 8px' } }, `${Math.round(y.hours)} h`, bar(y.hours, mx.hours, m.col)),
      h('td', { style: { padding: '9px 8px' } }, money(y.cost), bar(y.cost, mx.cost, m.col)),
      h('td', { style: { padding: '9px 8px' } }, `${Math.round(y.co2)} kg`, bar(y.co2, mx.co2, m.col)),
      h('td', { style: { padding: '9px 8px', fontFamily: 'ui-monospace,monospace' }, text: y.kcal ? Math.round(y.kcal).toLocaleString(ctx.lang) : '—' })));
    tb.append(body); tbl.replaceChildren(tb);
    const best = rows[0]; L.hud.textContent = best ? `${t('fastest', 'Best by')} ${t('s.' + sort, sort === 'hours' ? 'time' : sort === 'cost' ? 'cost' : 'CO₂')}: ${t('m.' + best.m.key, best.m.name)}` : '';
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const list = modes.filter((m) => enabled.has(m.key)), n = list.length; if (!n) return;
    const x0 = 120, x1 = W - 40, slowest = Math.max(...list.map((m) => yearly(m, km, days).mins));
    /* race clock: 6 s of animation covers the slowest trip */
    const minute = tRace / 6 * slowest;
    g.font = '12px system-ui,sans-serif'; g.textBaseline = 'middle';
    list.forEach((m, i) => {
      const y = 30 + i * (H - 50) / Math.max(1, n - 1 || 1), mins = yearly(m, km, days).mins;
      g.strokeStyle = m.col; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke();
      for (const sx of [x0, x1]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(sx, y, 7, 0, Math.PI * 2); g.fill(); g.lineWidth = 3; g.stroke(); }
      g.fillStyle = '#16181d'; g.textAlign = 'end'; g.fillText(t('m.' + m.key, m.name), x0 - 14, y);
      /* waiting/parking happens at the start, then the ride */
      const ride = Math.max(0, minute - m.wait), k = clamp(ride / (mins - m.wait || 1), 0, 1);
      const x = x0 + (x1 - x0) * k;
      g.fillStyle = m.col; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
      g.textAlign = 'start'; g.fillStyle = '#6b6a64';
      if (k >= 1) g.fillText(`${Math.round(mins)} min`, Math.min(x + 14, W - 60), y - 14);
      else if (minute < m.wait) g.fillText(t('waiting', 'waiting'), x + 14, y - 14);
    });
    g.fillStyle = '#6b6a64'; g.textAlign = 'end'; g.fillText(`${Math.min(slowest, minute).toFixed(0)} min`, W - 12, H - 8); g.textAlign = 'start';
  }
  loop(ctx, S.cv, (dt) => { tRace += dt * (ctx.calm ? .5 : 1); if (tRace > 7.5) tRace = 0; draw(); });

  heading(L.panel, t('trip', 'Your trip'));
  range(L.panel, t('km', 'Distance one way'), { min: .5, max: 60, step: .5, value: km, fmt: (n) => n + ' km' }, (n) => { km = n; tRace = 0; table(); save(); });
  range(L.panel, t('days', 'Days a week'), { min: 1, max: 7, value: days, fmt: (n) => String(n) }, (n) => { days = n; table(); save(); });
  select(L.panel, t('cur', 'Currency symbol'), CUR.map(([k, v]) => [k, v]), cur, (v) => { cur = v; table(); save(); });
  range(L.panel, t('rate', 'Price level (× the default prices)'), { min: .1, max: 150, step: .1, value: rate, fmt: (n) => '×' + n }, (n) => { rate = n; table(); save(); });
  seg(L.panel, t('sort', 'Sort by'), [['hours', t('s.hours', 'Time')], ['cost', t('s.cost', 'Cost')], ['co2', t('s.co2', 'CO₂')]], sort, (v) => { sort = v as typeof sort; table(); });
  heading(L.panel, t('modes', 'Modes and factors'));
  const ed = h('div', { style: { display: 'grid', gap: '8px' } }); L.panel.append(ed);
  function editors() {
    ed.replaceChildren();
    for (const m of modes) {
      const box = h('details', { style: { border: '1px solid var(--line)', borderRadius: '10px', padding: '6px 10px' } });
      const cb = h('input', { type: 'checkbox', checked: enabled.has(m.key), 'aria-label': t('use', 'Include') + ' ' + m.name, onclick: (e: Event) => e.stopPropagation() }) as HTMLInputElement;
      cb.addEventListener('change', () => { if (cb.checked) enabled.add(m.key); else enabled.delete(m.key); table(); });
      box.append(h('summary', { style: { cursor: 'pointer', fontSize: '12.5px', display: 'flex', gap: '8px', alignItems: 'center' } }, cb, h('span', { style: { width: '9px', height: '9px', borderRadius: '50%', background: m.col } }), t('m.' + m.key, m.name)));
      const num = (label: string, key: keyof Mode, step: number) => { const i = h('input', { type: 'number', step, min: 0, value: String(m[key]), style: { width: '100%' } }) as HTMLInputElement; i.addEventListener('change', () => { const v = Math.max(0, +i.value); if (Number.isFinite(v) && (key !== 'kmh' || v > 0)) { (m as unknown as Record<string, number>)[key] = v; table(); save(); } else i.value = String(m[key]); }); return h('label', { class: 'wk-r' }, h('span', { text: label }), i); };
      box.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' } }, num(t('f.kmh', 'Speed km/h'), 'kmh', 1), num(t('f.wait', 'Wait/park min'), 'wait', 1), num(t('f.trip', 'Fare per trip'), 'trip', .1), num(t('f.km', 'Cost per km'), 'perKm', .01), num(t('f.co2', 'g CO₂ per km'), 'co2', 1), num(t('f.kcal', 'kcal per km'), 'kcal', 1)));
      ed.append(box);
    }
  }
  buttons(L.panel, [[t('reset', 'Reset factors'), () => { modes.forEach((m, i) => Object.assign(m, BASE[i])); rate = 1; editors(); table(); save(); }]]);
  note(L.panel, t('src', 'Defaults are rounded typical averages from public sources such as the UK government’s greenhouse gas conversion factors. The car figures assume one person in the car; electric-car CO₂ depends on how your grid makes electricity. Prices are placeholders: set your own fares and costs.'));
  note(L.panel, t('yr', 'A year here means 46 working weeks, two trips a day.'));
  editors(); table();
}
