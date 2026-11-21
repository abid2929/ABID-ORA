/* 014 Automotive History: a printed-archive timeline of milestones that changed the car, with
   theme filters and keyboard navigation, plus "Put it in order", a chronology game that
   scores how close your order is to history (pairs in the right order, Kendall style). */
import { type Ctx, h, s, layout, heading, note, seg, buttons, stats, store, rng } from './kit';

type Theme = 'power' | 'make' | 'safe' | 'form';
interface M { y: number; th: Theme; title: string; text: string }
/* Dates checked against standard references; years are the first public/production year. */
const MS: M[] = [
  { y: 1886, th: 'power', title: 'Benz Patent-Motorwagen', text: 'Karl Benz patents a three-wheeled carriage built around a petrol engine: widely treated as the first practical automobile.' },
  { y: 1888, th: 'power', title: 'Bertha Benz’s long drive', text: 'Bertha Benz drives about 100 km from Mannheim to Pforzheim, proving the car could travel real distances.' },
  { y: 1908, th: 'make', title: 'Ford Model T', text: 'A simple, tough car priced for ordinary buyers. More than 15 million were built before production ended in 1927.' },
  { y: 1913, th: 'make', title: 'Moving assembly line', text: 'Ford’s Highland Park plant moves the car past the workers, cutting chassis assembly from hours to about an hour and a half.' },
  { y: 1934, th: 'form', title: 'Citroën Traction Avant', text: 'Front-wheel drive with a unitary steel body in mass production: lower, lighter and more stable than its rivals.' },
  { y: 1955, th: 'form', title: 'Citroën DS', text: 'Hydropneumatic self-levelling suspension and a body shape that still looks futuristic.' },
  { y: 1959, th: 'safe', title: 'Three-point seat belt', text: 'Volvo fits Nils Bohlin’s three-point belt as standard and leaves the patent open for every carmaker to use.' },
  { y: 1959, th: 'form', title: 'Mini', text: 'Alec Issigonis turns the engine sideways and puts the wheels at the corners, so four adults fit in a car three metres long.' },
  { y: 1975, th: 'power', title: 'Catalytic converters', text: 'Most new US cars get catalytic converters to meet emission rules, which also pushes unleaded petrol into use.' },
  { y: 1978, th: 'safe', title: 'Electronic ABS', text: 'Anti-lock brakes from Bosch go on sale in a Mercedes-Benz S-Class, letting drivers steer while braking hard.' },
  { y: 1981, th: 'safe', title: 'Driver airbag', text: 'A driver airbag, working with the seat belt, becomes an option on the Mercedes-Benz S-Class.' },
  { y: 1997, th: 'power', title: 'Toyota Prius', text: 'The first mass-produced hybrid car goes on sale in Japan, pairing a petrol engine with an electric motor.' },
  { y: 2008, th: 'power', title: 'Tesla Roadster', text: 'Lithium-ion laptop-style cells show that an electric car can be quick and travel over 300 km on a charge.' },
  { y: 2010, th: 'make', title: 'Nissan Leaf', text: 'One of the first electric cars built in large numbers for everyday buyers around the world.' },
];
const TH: Record<Theme, [string, string]> = { power: ['Power', '#b4442c'], make: ['Making', '#2d5d7b'], safe: ['Safety', '#3d7a4a'], form: ['Form', '#8a6a2a'] };

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#b4442c');
  const paper = '#efe8da', ink = '#1d1a16';
  L.view.classList.add('flow');
  L.view.style.background = paper; L.view.style.color = ink;
  let filter: Theme | 'all' = 'all', sel = 0, mode: 'tl' | 'game' = 'tl';
  const best = store(14, 'best', 0, (v) => typeof v === 'number');
  const head = h('div', { style: { fontFamily: 'var(--serif, Georgia, serif)', fontSize: 'clamp(26px,4vw,44px)', lineHeight: '1.05', margin: '6px 0 14px' } });
  const box = h('div');
  L.view.append(head, box);
  const info = stats(L.panel, [['n', t('shown', 'Milestones')], ['span', t('span', 'Years covered')], ['best', t('best', 'Best game score')], ['now', t('now', 'This round')]]);
  info('best', best.get() ? best.get() + '%' : '—');

  /* ---------- timeline ---------- */
  function list() { return MS.map((m, i) => ({ m, i })).filter(({ m }) => filter === 'all' || m.th === filter); }
  function timeline() {
    head.textContent = t('h.tl', 'A hundred and twenty-four years of the car');
    box.replaceChildren();
    const items = list();
    info('n', String(items.length)); info('span', items.length ? `${items[0].m.y}–${items[items.length - 1].m.y}` : '—');
    const W = 1000, H = 190, y0 = 1880, y1 = 2020, X = (y: number) => 30 + (y - y0) / (y1 - y0) * (W - 60);
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'list', 'aria-label': t('tl', 'Timeline'), style: 'display:block;overflow:visible' });
    svg.append(s('line', { x1: 20, x2: W - 20, y1: 120, y2: 120, stroke: ink, 'stroke-width': 1.2 }));
    for (let y = y0; y <= y1; y += 10) { svg.append(s('line', { x1: X(y), x2: X(y), y1: 115, y2: 125, stroke: ink, 'stroke-width': y % 50 ? .6 : 1.4 })); if (y % 20 === 0) { const tx = s('text', { x: X(y), y: 145, 'text-anchor': 'middle', 'font-size': 12, fill: ink, 'font-family': 'ui-monospace,monospace' }); tx.textContent = String(y); svg.append(tx); } }
    const stack: Record<number, number> = {};
    items.forEach(({ m, i }) => {
      const k = stack[m.y] = (stack[m.y] ?? -1) + 1, cx = X(m.y), cy = 120 - 22 - k * 26 - (i % 2) * 30;
      const g = s('g', { role: 'listitem', tabindex: 0, 'aria-label': `${m.y}: ${t('m' + i + '.t', m.title)}`, style: 'cursor:pointer;outline:none' });
      g.append(s('line', { x1: cx, x2: cx, y1: cy, y2: 120, stroke: TH[m.th][1], 'stroke-width': 1 }), s('circle', { cx, cy, r: i === sel ? 9 : 6, fill: i === sel ? TH[m.th][1] : paper, stroke: TH[m.th][1], 'stroke-width': 2.5 }));
      const pick = () => { sel = i; timeline(); };
      g.addEventListener('click', pick); g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); pick(); } });
      svg.append(g);
    });
    box.append(svg);
    const cur = MS[sel] && items.some((x) => x.i === sel) ? MS[sel] : items[0]?.m;
    if (cur) { const i = MS.indexOf(cur); sel = i;
      const pos = items.findIndex((x) => x.i === i);
      box.append(h('article', { style: { display: 'grid', gridTemplateColumns: 'minmax(80px,140px) 1fr', gap: '18px', marginTop: '20px', borderTop: `2px solid ${ink}`, paddingTop: '16px' } },
        h('div', { style: { fontFamily: 'var(--serif, Georgia, serif)', fontSize: 'clamp(40px,7vw,76px)', lineHeight: '.9', color: TH[cur.th][1] }, text: String(cur.y) }),
        h('div', {}, h('div', { style: { fontSize: '11px', letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'ui-monospace,monospace', color: TH[cur.th][1] }, text: t('th.' + cur.th, TH[cur.th][0]) }),
          h('h2', { style: { fontFamily: 'var(--serif, Georgia, serif)', fontWeight: '400', fontSize: '26px', margin: '6px 0' }, text: t('m' + i + '.t', cur.title) }),
          h('p', { style: { margin: 0, lineHeight: '1.55', maxWidth: '60ch' }, text: t('m' + i + '.x', cur.text) }),
          h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px' } },
            h('button', { type: 'button', class: 'wk-b', style: { color: ink, borderColor: ink }, text: '← ' + t('prev', 'Earlier'), disabled: pos <= 0, onclick: () => { sel = items[pos - 1].i; timeline(); } }),
            h('button', { type: 'button', class: 'wk-b', style: { color: ink, borderColor: ink }, text: t('next', 'Later') + ' →', disabled: pos >= items.length - 1, onclick: () => { sel = items[pos + 1].i; timeline(); } })))));
    }
  }

  /* ---------- the ordering game ---------- */
  let round: number[] = [], checked = false;
  function deal() {
    const r = rng(Date.now() & 0xffff), pool = MS.map((_, i) => i).filter((i) => !MS.some((m, j) => j !== i && m.y === MS[i].y && j < i));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    round = pool.slice(0, 6); checked = false; info('now', '—'); game();
  }
  function score() { let ok = 0, n = 0; for (let a = 0; a < round.length; a++) for (let b = a + 1; b < round.length; b++) { n++; if (MS[round[a]].y <= MS[round[b]].y) ok++; } return Math.round(ok / n * 100); }
  function game() {
    head.textContent = t('h.game', 'Put it in order: oldest at the top');
    box.replaceChildren();
    const ol = h('ol', { class: 'wk-list', style: { maxWidth: '640px' } });
    const sorted = [...round].sort((a, b) => MS[a].y - MS[b].y);
    round.forEach((idx, k) => {
      const right = checked && MS[sorted[k]].y === MS[idx].y;
      const li = h('li', { draggable: 'true', style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: `1.5px solid ${checked ? (right ? '#3d7a4a' : '#b4442c') : ink}`, borderRadius: '10px', background: checked ? (right ? '#dfe9d8' : '#f3d9cf') : '#f7f2e8', cursor: 'grab' } },
        h('span', { style: { fontFamily: 'ui-monospace,monospace', width: '22px' }, text: String(k + 1) }),
        h('span', { style: { flex: '1', fontFamily: 'var(--serif, Georgia, serif)', fontSize: '18px' }, text: t('m' + idx + '.t', MS[idx].title) }),
        checked ? h('span', { style: { fontFamily: 'ui-monospace,monospace' }, text: String(MS[idx].y) }) : null,
        h('button', { type: 'button', class: 'wk-b', style: { color: ink, borderColor: ink, padding: '4px 9px' }, 'aria-label': t('up', 'Move up'), text: '↑', disabled: k === 0 || checked, onclick: () => move(k, -1) }),
        h('button', { type: 'button', class: 'wk-b', style: { color: ink, borderColor: ink, padding: '4px 9px' }, 'aria-label': t('down', 'Move down'), text: '↓', disabled: k === round.length - 1 || checked, onclick: () => move(k, 1) }));
      li.addEventListener('dragstart', (e) => { (e as DragEvent).dataTransfer?.setData('text/plain', String(k)); });
      li.addEventListener('dragover', (e) => e.preventDefault());
      li.addEventListener('drop', (e) => { e.preventDefault(); const from = +((e as DragEvent).dataTransfer?.getData('text/plain') ?? -1); if (from >= 0 && from !== k && !checked) { const [x] = round.splice(from, 1); round.splice(k, 0, x); game(); } });
      ol.append(li);
    });
    box.append(ol);
    const row = h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' } });
    row.append(h('button', { type: 'button', class: 'wk-b pri', id: 'w14check', text: t('check', 'Check my order'), disabled: checked, onclick: () => { checked = true; const sc = score(); info('now', sc + '%'); if (sc > best.get()) { best.set(sc); info('best', sc + '%'); } game(); } }),
      h('button', { type: 'button', class: 'wk-b', style: { color: ink, borderColor: ink }, text: t('deal', 'New round'), onclick: deal }));
    if (checked) row.append(h('p', { role: 'status', style: { margin: '0', alignSelf: 'center' }, text: t('res', 'Pairs in the right order: ') + score() + '%' }));
    box.append(row);
  }
  function move(k: number, d: number) { const j = k + d; [round[k], round[j]] = [round[j], round[k]]; game(); }

  heading(L.panel, t('view', 'View'));
  seg(L.panel, t('mode', 'Mode'), [['tl', t('m.tl', 'Timeline')], ['game', t('m.game', 'Put it in order')]], mode, (v) => { mode = v as 'tl' | 'game'; if (mode === 'game') { if (!round.length) deal(); else game(); } else timeline(); });
  seg(L.panel, t('theme', 'Theme'), [['all', t('th.all', 'All')], ...Object.entries(TH).map(([k, v]) => [k, t('th.' + k, v[0])] as [string, string])], 'all', (v) => { filter = v as Theme | 'all'; if (mode === 'tl') timeline(); });
  buttons(L.panel, [[t('deal', 'New round'), () => { mode = 'game'; deal(); }]]);
  note(L.panel, t('how', 'Click a dot or tab to it and press Enter to read about it. In the game, drag the cards or use the arrows, then check: the score is the share of pairs you placed in the right order.'));
  note(L.panel, t('src', 'Years are the first public or production year from standard histories. When two firsts are disputed, the commonly cited one is used.'));
  timeline();
}
