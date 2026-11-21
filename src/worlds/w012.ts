/* 012 Electric Vehicle World: EV Trip Planner. A physics-based energy model (air drag, rolling
   resistance, climate control, cold-battery losses) plans a road trip: where to charge, for how
   long on a realistic charging curve, total time and cost, and how speed changes range. */
import { type Ctx, h, layout, canvas, heading, note, select, range, buttons, stats, store, clamp } from './kit';

interface Ev { name: string; kwh: number; kg: number; cda: number; maxkw: number }
const EVS: Record<string, Ev> = {
  compact: { name: 'Compact hatch', kwh: 52, kg: 1550, cda: .62, maxkw: 100 },
  saloon: { name: 'Long-range saloon', kwh: 78, kg: 1900, cda: .5, maxkw: 200 },
  suv: { name: 'Family SUV', kwh: 90, kg: 2350, cda: .78, maxkw: 175 },
  pickup: { name: 'Electric pickup', kwh: 130, kg: 3100, cda: 1.15, maxkw: 250 },
};
interface Trip { car: string; km: number; speed: number; temp: number; soc0: number; reserve: number; charger: number; price: number }
const DEF: Trip = { car: 'saloon', km: 640, speed: 110, temp: 12, soc0: 90, reserve: 10, charger: 150, price: .45 };

function whPerKm(e: Ev, v: number, temp: number) {
  const ms = v / 3.6, aero = .5 * 1.225 * e.cda * ms * ms, roll = .011 * e.kg * 9.81;
  const drive = (aero + roll) * 1000 / .88 / 3600; // Wh per km at the wheels → battery
  const hvac = temp < 18 ? clamp((18 - temp) * .14, 0, 3.2) : temp > 25 ? (temp - 25) * .12 : .15; // kW
  const aux = .3, hours = 1 / v;
  const cold = 1 + Math.max(0, 10 - temp) * .01;
  return drive * cold + (hvac + aux) * 1000 * hours;
}
/* charging power at a state of charge: full to 50 %, tapering to 30 % of peak at 80 %, then slow */
function chargeKw(e: Ev, charger: number, soc: number) {
  const peak = Math.min(e.maxkw, charger), k = soc < 50 ? 1 : soc < 80 ? 1 - (soc - 50) / 30 * .7 : .3 - (soc - 80) / 20 * .2;
  return Math.max(3, peak * k);
}
function plan(T: Trip) {
  const e = EVS[T.car], use = whPerKm(e, T.speed, T.temp) / 1000; // kWh/km
  let soc = T.soc0, x = 0, time = 0, energy = 0; const segs: { kind: 'drive' | 'charge'; from: number; to: number; dt: number; s0: number; s1: number }[] = [];
  const pts: [number, number][] = [[0, soc]]; let guard = 0;
  while (x < T.km - 1e-6 && guard++ < 40) {
    const usable = (soc - T.reserve) / 100 * e.kwh, reach = usable / use, leg = Math.min(T.km - x, Math.max(0, reach));
    if (leg <= 0.1) return { ok: false as const, why: 'reserve' };
    const s0 = soc; soc -= leg * use / e.kwh * 100; x += leg; time += leg / T.speed; energy += leg * use;
    segs.push({ kind: 'drive', from: x - leg, to: x, dt: leg / T.speed, s0, s1: soc }); pts.push([x, soc]);
    if (x >= T.km - 1e-6) break;
    /* charge just enough to finish (plus reserve), but never past 80 % unless the last leg needs it */
    const need = (T.km - x) * use / e.kwh * 100 + T.reserve + 3, target = Math.min(Math.max(need > 80 ? 80 : need, soc + 5), need > 80 ? 80 : 100);
    let ct = 0, s = soc; while (s < target) { const kw = chargeKw(e, T.charger, s); const ds = kw / e.kwh * 100 / 60; s += ds; ct += 1 / 60; }
    segs.push({ kind: 'charge', from: x, to: x, dt: ct, s0: soc, s1: s }); time += ct + 5 / 60; energy += (s - soc) / 100 * e.kwh / .92; soc = s; pts.push([x, soc]);
  }
  return { ok: true as const, segs, pts, time, energy, use, cost: energy * T.price, stops: segs.filter((s) => s.kind === 'charge').length, arrive: soc, rangeFull: e.kwh / use };
}
const hm = (h0: number) => { const m = Math.round(h0 * 60); return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };

export default function (ctx: Ctx) {
  const t = ctx.t, st = store<Trip>(ctx.id, 'trip', DEF, (v) => !!v && (v as Trip).car in EVS);
  const T: Trip = { ...DEF, ...st.get() };
  const L = layout(ctx);
  L.wrap.style.setProperty('--signal', '#5fd4d0');
  L.view.classList.add('flow');
  const err = h('p', { role: 'alert', style: { color: '#ff9b8a', margin: '0 0 10px', minHeight: '1em' } });
  const timeline = h('div', { style: { display: 'flex', height: '46px', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--line)', margin: '12px 0 6px' } });
  const legend = h('ol', { style: { listStyle: 'none', padding: '0', margin: '10px 0 0', display: 'grid', gap: '6px', fontSize: '13.5px', color: 'var(--bone2)' } });
  const chart = h('div', { style: { position: 'relative', height: '220px', marginTop: '18px' } }), chart2 = h('div', { style: { position: 'relative', height: '200px', marginTop: '18px' } });
  const H3 = (x: string) => h('h2', { class: 'mono', text: x, style: { fontSize: '11px', color: 'var(--mute)', letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: '400', margin: '20px 0 4px' } });
  L.view.append(err, H3(t('tl', 'Your trip')), timeline, legend, H3(t('soc', 'Battery along the route')), chart, H3(t('spd', 'How speed changes range (full battery)')), chart2);
  const C1 = canvas(chart, t('soc', 'Battery along the route')), C2 = canvas(chart2, t('spd', 'How speed changes range'));
  const info = stats(L.panel, [['time', t('time', 'Total time')], ['stops', t('stops', 'Charging stops')], ['use', t('use', 'Consumption')], ['cost', t('cost', 'Energy cost')]]);
  heading(L.panel, t('trip', 'Plan the trip'));
  select(L.panel, t('car', 'Vehicle'), Object.entries(EVS).map(([k, v]) => [k, `${t('ev.' + k, v.name)} · ${v.kwh} kWh`]), T.car, (v) => { T.car = v; go(); });
  range(L.panel, t('km', 'Distance'), { min: 20, max: 1500, step: 10, value: T.km, fmt: (v) => v + ' km' }, (v) => { T.km = v; go(); });
  range(L.panel, t('speed', 'Cruising speed'), { min: 50, max: 150, step: 5, value: T.speed, fmt: (v) => v + ' km/h' }, (v) => { T.speed = v; go(); });
  range(L.panel, t('temp', 'Outside temperature'), { min: -20, max: 40, value: T.temp, fmt: (v) => v + ' °C' }, (v) => { T.temp = v; go(); });
  range(L.panel, t('soc0', 'Charge at departure'), { min: 20, max: 100, value: T.soc0, fmt: (v) => v + ' %' }, (v) => { T.soc0 = v; go(); });
  range(L.panel, t('res', 'Never go below'), { min: 5, max: 30, value: T.reserve, fmt: (v) => v + ' %' }, (v) => { T.reserve = v; go(); });
  select(L.panel, t('chg', 'Fast chargers on the route'), [['50', '50 kW'], ['150', '150 kW'], ['250', '250 kW'], ['350', '350 kW']], String(T.charger), (v) => { T.charger = +v; go(); });
  range(L.panel, t('price', 'Charging price'), { min: .1, max: 1, step: .01, value: T.price, fmt: (v) => v.toFixed(2) + ' / kWh' }, (v) => { T.price = v; go(); });
  buttons(L.panel, [[t('reset', 'Reset'), () => { Object.assign(T, DEF); st.set(T); location.reload(); }]]);
  note(L.panel, t('how', 'Energy per km = air drag (grows with speed²) + rolling resistance + heating or cooling + electronics, with extra loss in the cold. Charging runs at full power to 50 %, then tapers. Real cars, weather, hills and chargers vary: treat the result as a careful estimate, not a promise.'));
  function go() {
    st.set(T);
    const p = plan(T), e = EVS[T.car];
    if (!p.ok) { err.textContent = t('err', 'The departure charge is at or below the reserve you set. Raise the charge or lower the reserve.'); timeline.replaceChildren(); legend.replaceChildren(); return; }
    err.textContent = '';
    info('time', hm(p.time)); info('stops', String(p.stops)); info('use', `${Math.round(p.use * 1000)} Wh/km`); info('cost', p.cost.toFixed(2));
    timeline.replaceChildren(...p.segs.map((s) => h('div', { title: s.kind === 'drive' ? `${Math.round(s.to - s.from)} km` : hm(s.dt), style: { flex: String(Math.max(.02, s.dt)), background: s.kind === 'drive' ? 'linear-gradient(90deg,#2d6f6c,#5fd4d0)' : 'repeating-linear-gradient(45deg,#f2c14e 0 6px,#e0a92f 6px 12px)', borderInlineEnd: '1px solid rgba(0,0,0,.4)' } })));
    let km = 0;
    legend.replaceChildren(...p.segs.map((s, i) => { if (s.kind === 'drive') km = s.to; return h('li', { style: { display: 'flex', gap: '10px' } }, h('span', { class: 'mono', text: String(i + 1).padStart(2, '0'), style: { color: 'var(--mute)', fontSize: '11px' } }), h('span', { text: s.kind === 'drive' ? `${t('drive', 'Drive')} ${Math.round(s.to - s.from)} km · ${hm(s.dt)} · ${Math.round(s.s0)}% → ${Math.round(s.s1)}%` : `${t('charge', 'Charge at km')} ${Math.round(km)} · ${hm(s.dt)} · ${Math.round(s.s0)}% → ${Math.round(s.s1)}%` })); }),
      h('li', { style: { color: 'var(--signal)' } }, `${t('arrive', 'Arrive with')} ${Math.round(p.arrive)}% · ${t('energy', 'energy used')} ${p.energy.toFixed(1)} kWh`));
    drawSoc(p.pts); drawRange(e);
  }
  function axes(g: CanvasRenderingContext2D, W: number, H: number, xl: string, yl: string) { g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(40, 10); g.lineTo(40, H - 26); g.lineTo(W - 10, H - 26); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace'; g.fillText(xl, W - 70, H - 8); g.fillText(yl, 4, 12); }
  function drawSoc(pts: [number, number][]) {
    const g = C1.g, W = C1.w, H = C1.h; g.clearRect(0, 0, W, H); axes(g, W, H, 'km', '%');
    const X = (k: number) => 40 + k / T.km * (W - 54), Y = (s: number) => H - 26 - s / 100 * (H - 40);
    g.fillStyle = 'rgba(255,90,90,.12)'; g.fillRect(40, Y(T.reserve), W - 50, Y(0) - Y(T.reserve));
    g.strokeStyle = '#5fd4d0'; g.lineWidth = 2; g.beginPath(); pts.forEach(([k, s], i) => (i ? g.lineTo(X(k), Y(s)) : g.moveTo(X(k), Y(s)))); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.5)'; for (const s of [0, 50, 100]) g.fillText(s + '', 14, Y(s) + 3); for (let k = 0; k <= T.km; k += Math.max(50, Math.round(T.km / 6 / 50) * 50)) g.fillText(String(k), X(k) - 8, H - 12);
    pts.forEach(([k, s], i) => { if (i && pts[i - 1][0] === k) { g.fillStyle = '#f2c14e'; g.beginPath(); g.arc(X(k), Y(s), 4, 0, Math.PI * 2); g.fill(); } });
  }
  function drawRange(e: Ev) {
    const g = C2.g, W = C2.w, H = C2.h; g.clearRect(0, 0, W, H); axes(g, W, H, 'km/h', 'km');
    const vs = Array.from({ length: 21 }, (_, i) => 40 + i * 5.5), rs = vs.map((v) => e.kwh * 1000 / whPerKm(e, v, T.temp)), mx = Math.max(...rs) * 1.08;
    const X = (v: number) => 40 + (v - 40) / 110 * (W - 54), Y = (r: number) => H - 26 - r / mx * (H - 40);
    g.strokeStyle = '#f2c14e'; g.lineWidth = 2; g.beginPath(); vs.forEach((v, i) => (i ? g.lineTo(X(v), Y(rs[i])) : g.moveTo(X(v), Y(rs[i])))); g.stroke();
    const r0 = e.kwh * 1000 / whPerKm(e, T.speed, T.temp); g.fillStyle = '#5fd4d0'; g.beginPath(); g.arc(X(T.speed), Y(r0), 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#eef'; g.font = '12px ui-sans-serif,system-ui'; g.fillText(`${Math.round(r0)} km @ ${T.speed} km/h`, Math.min(W - 150, X(T.speed) + 8), Y(r0) - 8);
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '10px ui-monospace,monospace'; for (const v of [40, 80, 120, 150]) g.fillText(String(v), X(v) - 8, H - 12);
  }
  C1.onResize(go); C2.onResize(go);
  go();
}
