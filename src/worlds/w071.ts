/* 071 Global Food Universe. Where the food on one plate first came from, and the arithmetic of bread:
   · Plate atlas: pick a dish (or build your own plate) and the map draws a line from the place where each
     ingredient's plant or animal was first domesticated to the city where you eat it. The panel adds up the
     "food-kilometres", the continents on the plate and the oldest ingredient.
   · Origins timeline: every ingredient with a reasonably settled domestication date, from about 9500 BCE.
   · Baker's desk: baker's percentages. Choose a bread, the number of pieces and their weight; the desk works out
     every ingredient in grams, swaps between yeast types, splits a sourdough starter into its flour and water,
     and gives the water temperature for a target dough temperature.
   Origins are the places most researchers currently point to; dates are rough midpoints and change with new finds.
   Where no settled date exists we show none, rather than invent one. */
import { type Ctx, h, layout, canvas, heading, note, seg, range, select, stats, buttons, local, clamp, store } from './kit';
import { haversine, greatCircle, CITIES } from './geo';
import { eeFwd, decodeLand, unwrapRings } from './w065';

export type Region = 'asia' | 'africa' | 'americas' | 'europe' | 'oceania';
/** id, English name, origin place, lat, lon, approx. domestication year (negative = BCE; null = no settled date), region, animal? */
export type Food = { id: string; name: string; place: string; lat: number; lon: number; year: number | null; region: Region; animal?: boolean };
export const FOODS: Food[] = [
  { id: 'wheat', name: 'Wheat', place: 'Fertile Crescent (south-east Türkiye)', lat: 37.5, lon: 39.5, year: -9500, region: 'asia' },
  { id: 'barley', name: 'Barley', place: 'Fertile Crescent (Levant)', lat: 32.0, lon: 35.5, year: -8500, region: 'asia' },
  { id: 'lentil', name: 'Lentil', place: 'Fertile Crescent', lat: 36.5, lon: 38.0, year: -8000, region: 'asia' },
  { id: 'chickpea', name: 'Chickpea', place: 'South-east Türkiye', lat: 37.6, lon: 40.6, year: -7500, region: 'asia' },
  { id: 'rice', name: 'Rice', place: 'Yangtze valley, China', lat: 29.5, lon: 112.5, year: -7000, region: 'asia' },
  { id: 'millet', name: 'Millet', place: 'North China', lat: 36.5, lon: 114.3, year: -8000, region: 'asia' },
  { id: 'soy', name: 'Soybean', place: 'North-east China', lat: 42.0, lon: 124.0, year: -5000, region: 'asia' },
  { id: 'maize', name: 'Maize', place: 'Balsas valley, Mexico', lat: 18.3, lon: -100.0, year: -7000, region: 'americas' },
  { id: 'squash', name: 'Squash', place: 'Oaxaca, Mexico', lat: 16.9, lon: -96.4, year: -8000, region: 'americas' },
  { id: 'potato', name: 'Potato', place: 'Lake Titicaca, Andes', lat: -15.8, lon: -69.5, year: -6000, region: 'americas' },
  { id: 'tomato', name: 'Tomato', place: 'Mexico (wild ancestors in the Andes)', lat: 19.2, lon: -96.5, year: null, region: 'americas' },
  { id: 'chili', name: 'Chilli pepper', place: 'East-central Mexico', lat: 20.0, lon: -98.0, year: -4000, region: 'americas' },
  { id: 'cacao', name: 'Cacao', place: 'Upper Amazon, Ecuador', lat: -4.6, lon: -79.0, year: -3300, region: 'americas' },
  { id: 'vanilla', name: 'Vanilla', place: 'Gulf coast of Mexico', lat: 20.5, lon: -97.4, year: null, region: 'americas' },
  { id: 'peanut', name: 'Peanut', place: 'Southern Bolivia and north-west Argentina', lat: -22.0, lon: -64.0, year: null, region: 'americas' },
  { id: 'pineapple', name: 'Pineapple', place: 'Paraná–Paraguay river basin', lat: -22.0, lon: -55.0, year: null, region: 'americas' },
  { id: 'cassava', name: 'Cassava', place: 'South-west Amazon, Brazil', lat: -10.5, lon: -63.0, year: null, region: 'americas' },
  { id: 'coffee', name: 'Coffee', place: 'South-west Ethiopia', lat: 7.3, lon: 36.2, year: null, region: 'africa' },
  { id: 'sorghum', name: 'Sorghum', place: 'Eastern Sahel, Sudan', lat: 15.0, lon: 33.0, year: -3000, region: 'africa' },
  { id: 'tea', name: 'Tea', place: 'Yunnan, China', lat: 24.5, lon: 100.5, year: null, region: 'asia' },
  { id: 'banana', name: 'Banana', place: 'New Guinea highlands', lat: -5.8, lon: 144.3, year: -5000, region: 'oceania' },
  { id: 'sugarcane', name: 'Sugarcane', place: 'New Guinea', lat: -6.5, lon: 145.5, year: null, region: 'oceania' },
  { id: 'pepper', name: 'Black pepper', place: 'Malabar coast, India', lat: 11.5, lon: 75.8, year: null, region: 'asia' },
  { id: 'cardamom', name: 'Cardamom', place: 'Western Ghats, India', lat: 9.6, lon: 77.1, year: null, region: 'asia' },
  { id: 'cinnamon', name: 'Cinnamon', place: 'Sri Lanka', lat: 7.0, lon: 80.6, year: null, region: 'asia' },
  { id: 'turmeric', name: 'Turmeric', place: 'South Asia', lat: 18.0, lon: 80.0, year: null, region: 'asia' },
  { id: 'ginger', name: 'Ginger', place: 'Island South-east Asia', lat: 0.5, lon: 114.0, year: null, region: 'asia' },
  { id: 'sesame', name: 'Sesame', place: 'Indus valley', lat: 30.6, lon: 72.9, year: -2500, region: 'asia' },
  { id: 'basil', name: 'Basil', place: 'Tropical Asia (India)', lat: 22.0, lon: 76.0, year: null, region: 'asia' },
  { id: 'mango', name: 'Mango', place: 'North-east India and Myanmar', lat: 24.5, lon: 94.0, year: null, region: 'asia' },
  { id: 'citrus', name: 'Lemon and lime', place: 'South-east Himalayan foothills', lat: 25.5, lon: 97.0, year: null, region: 'asia' },
  { id: 'onion', name: 'Onion', place: 'Central Asia', lat: 40.0, lon: 68.0, year: null, region: 'asia' },
  { id: 'garlic', name: 'Garlic', place: 'Central Asia', lat: 42.0, lon: 71.0, year: null, region: 'asia' },
  { id: 'apricot', name: 'Apricot', place: 'Central Asia and China', lat: 41.0, lon: 78.0, year: null, region: 'asia' },
  { id: 'coriander', name: 'Coriander', place: 'Eastern Mediterranean', lat: 35.0, lon: 36.0, year: null, region: 'asia' },
  { id: 'saffron', name: 'Saffron', place: 'Bronze-Age Greece', lat: 38.0, lon: 23.8, year: null, region: 'europe' },
  { id: 'olive', name: 'Olive', place: 'Levant', lat: 33.0, lon: 35.5, year: -5000, region: 'asia' },
  { id: 'grape', name: 'Grape', place: 'South Caucasus (Georgia)', lat: 41.5, lon: 44.8, year: -6000, region: 'asia' },
  { id: 'chicken', name: 'Chicken (and eggs)', place: 'Mainland South-east Asia', lat: 17.0, lon: 101.0, year: -1500, region: 'asia', animal: true },
  { id: 'cattle', name: 'Cattle (milk, butter, ghee)', place: 'Upper Euphrates', lat: 37.0, lon: 39.0, year: -8500, region: 'asia', animal: true },
  { id: 'goat', name: 'Goat', place: 'Zagros mountains', lat: 34.5, lon: 46.5, year: -8000, region: 'asia', animal: true },
  { id: 'sheep', name: 'Sheep', place: 'Eastern Anatolia', lat: 38.5, lon: 41.0, year: -8500, region: 'asia', animal: true },
  { id: 'pig', name: 'Pig', place: 'Anatolia (and separately in China)', lat: 37.8, lon: 40.5, year: -8500, region: 'asia', animal: true },
  { id: 'buffalo', name: 'Water buffalo (mozzarella)', place: 'Indian subcontinent', lat: 27.0, lon: 76.5, year: null, region: 'asia', animal: true },
];
export const FOOD = Object.fromEntries(FOODS.map((f) => [f.id, f])) as Record<string, Food>;
export type Dish = { id: string; name: string; home: string; lat: number; lon: number; items: string[] };
export const DISHES: Dish[] = [
  { id: 'biryani', name: 'Kacchi biryani', home: 'Dhaka', lat: 23.81, lon: 90.41, items: ['rice', 'goat', 'potato', 'onion', 'garlic', 'ginger', 'chili', 'cardamom', 'cinnamon', 'pepper', 'saffron', 'cattle'] },
  { id: 'fuchka', name: 'Fuchka', home: 'Dhaka', lat: 23.81, lon: 90.41, items: ['wheat', 'potato', 'chickpea', 'chili', 'coriander', 'onion', 'citrus'] },
  { id: 'cha', name: 'Milk tea (cha)', home: 'Dhaka', lat: 23.81, lon: 90.41, items: ['tea', 'cattle', 'sugarcane', 'ginger', 'cardamom'] },
  { id: 'pizza', name: 'Pizza Margherita', home: 'Naples', lat: 40.85, lon: 14.27, items: ['wheat', 'tomato', 'buffalo', 'olive', 'basil'] },
  { id: 'padthai', name: 'Pad thai', home: 'Bangkok', lat: 13.76, lon: 100.5, items: ['rice', 'chicken', 'peanut', 'chili', 'citrus', 'garlic', 'sugarcane', 'soy', 'onion'] },
  { id: 'tacos', name: 'Tacos al pastor', home: 'Mexico City', lat: 19.43, lon: -99.13, items: ['maize', 'pig', 'pineapple', 'onion', 'chili', 'citrus', 'coriander'] },
  { id: 'ramen', name: 'Shoyu ramen', home: 'Tokyo', lat: 35.68, lon: 139.69, items: ['wheat', 'soy', 'pig', 'chicken', 'garlic', 'ginger'] },
  { id: 'hummus', name: 'Hummus', home: 'Beirut', lat: 33.89, lon: 35.5, items: ['chickpea', 'sesame', 'olive', 'citrus', 'garlic'] },
  { id: 'jollof', name: 'Jollof rice', home: 'Lagos', lat: 6.52, lon: 3.38, items: ['rice', 'tomato', 'chili', 'onion', 'chicken'] },
  { id: 'sacher', name: 'Sachertorte', home: 'Vienna', lat: 48.21, lon: 16.37, items: ['wheat', 'cacao', 'sugarcane', 'chicken', 'cattle', 'apricot'] },
];
export const REGION_COL: Record<Region, string> = { asia: '#f0a64b', africa: '#ee7d62', americas: '#74c98f', europe: '#86b6ff', oceania: '#cf9bff' };

/** sum of great-circle km from each ingredient's origin to the eating place, plus continents and oldest date */
export function plateStats(ids: string[], lat: number, lon: number) {
  const list = ids.map((i) => FOOD[i]).filter(Boolean);
  let km = 0, far: Food | null = null, farKm = -1, old: Food | null = null;
  const regions = new Set<Region>();
  for (const f of list) {
    const d = haversine(f.lat, f.lon, lat, lon); km += d; regions.add(f.region);
    if (d > farKm) { farKm = d; far = f; }
    if (f.year !== null && (!old || f.year < (old.year as number))) old = f;
  }
  return { n: list.length, km, regions: regions.size, far, farKm: Math.max(0, farKm), old };
}
/** "≈ 9500 BCE" / "≈ 1500 CE" / null */
export function yearText(y: number | null, bce = 'BCE', ce = 'CE') { return y === null ? null : y < 0 ? `≈ ${-y} ${bce}` : `≈ ${y} ${ce}`; }

/* ---------- baker's percentages ---------- */
export type Leaven = 'instant' | 'dry' | 'fresh' | 'starter';
export type Formula = { pieces: number; weight: number; hyd: number; salt: number; leaven: Leaven; lev: number; starterHyd: number; fat: number; sugar: number };
/** Every percentage is of the TOTAL flour, including the flour inside a sourdough starter; hydration likewise counts
    the starter's water. Returns grams. */
export function bake(f: Formula) {
  const total = f.pieces * f.weight;
  const yeastPct = f.leaven === 'starter' ? 0 : f.lev;
  const pct = 100 + f.hyd + f.salt + yeastPct + f.fat + f.sugar;
  const flour = total * 100 / pct, water = flour * f.hyd / 100;
  let starter = 0, sFlour = 0, sWater = 0;
  if (f.leaven === 'starter') { sFlour = flour * f.lev / 100; sWater = sFlour * f.starterHyd / 100; starter = sFlour + sWater; }
  return {
    total, flour, water, salt: flour * f.salt / 100, yeast: flour * yeastPct / 100, fat: flour * f.fat / 100, sugar: flour * f.sugar / 100,
    starter, sFlour, sWater, addFlour: flour - sFlour, addWater: water - sWater,
  };
}
/** the usual baker's swaps: 1 g instant ≈ 1.25 g active dry ≈ 3 g fresh (compressed) yeast */
const YF: Record<Exclude<Leaven, 'starter'>, number> = { instant: 1, dry: 1.25, fresh: 3 };
export function yeastSwap(g: number, from: Exclude<Leaven, 'starter'>, to: Exclude<Leaven, 'starter'>) { return g / YF[from] * YF[to]; }
/** water temperature for a desired dough temperature (all °C): the classic "base temperature" method */
export function waterTemp(ddt: number, room: number, flourT: number, friction: number, starterT: number | null) {
  return starterT === null ? 3 * ddt - room - flourT - friction : 4 * ddt - room - flourT - starterT - friction;
}
export function hydBand(hyd: number) { return hyd < 58 ? 0 : hyd < 65 ? 1 : hyd < 72 ? 2 : hyd < 80 ? 3 : 4; }
export const PRESETS: Record<string, Omit<Formula, 'pieces' | 'weight'> & { pieces: number; weight: number }> = {
  loaf: { pieces: 1, weight: 900, hyd: 62, salt: 2, leaven: 'instant', lev: 1, starterHyd: 100, fat: 4, sugar: 4 },
  baguette: { pieces: 3, weight: 350, hyd: 68, salt: 2, leaven: 'instant', lev: 0.6, starterHyd: 100, fat: 0, sugar: 0 },
  pizza: { pieces: 4, weight: 250, hyd: 62, salt: 2.8, leaven: 'fresh', lev: 0.2, starterHyd: 100, fat: 0, sugar: 0 },
  sourdough: { pieces: 1, weight: 1000, hyd: 75, salt: 2, leaven: 'starter', lev: 10, starterHyd: 100, fat: 0, sugar: 0 },
  ciabatta: { pieces: 2, weight: 450, hyd: 80, salt: 2.2, leaven: 'instant', lev: 0.5, starterHyd: 100, fat: 2, sugar: 0 },
  bagel: { pieces: 8, weight: 110, hyd: 55, salt: 2, leaven: 'instant', lev: 1, starterHyd: 100, fat: 0, sugar: 4 },
};

export default function (ctx: Ctx) {
  const t = ctx.t, lang = ctx.lang;
  const L = layout(ctx);
  L.view.classList.add('w71');
  L.view.style.minHeight = 'clamp(320px, 54vw, 640px)';
  const S = canvas(L.view, t('cv', 'A map of where the ingredients of a dish come from, a timeline of their origins, or a bread formula.'), { alpha: false });
  type Cfg = { room: 'plate' | 'time' | 'bake'; dish: string; mine: string[]; city: string; preset: string; f: Formula; ddt: number; rt: number; fr: number };
  const def: Cfg = { room: 'plate', dish: 'biryani', mine: ['rice', 'chicken', 'onion', 'chili'], city: 'home', preset: 'loaf', f: { ...PRESETS.loaf }, ddt: 25, rt: 28, fr: 4 };
  const st = store<Cfg>(ctx.id, 'cfg', def, (v) => typeof v === 'object' && v !== null && 'room' in v && 'f' in (v as object));
  const cfg: Cfg = { ...def, ...st.get() }; cfg.f = { ...def.f, ...cfg.f }; const save = () => st.set(cfg);
  if (cfg.dish !== 'mine' && !DISHES.some((d) => d.id === cfg.dish)) cfg.dish = 'biryani';
  cfg.mine = cfg.mine.filter((i) => FOOD[i]);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fn = (f: Food) => t('f.' + f.id, f.name), fp = (f: Food) => t('p.' + f.id, f.place);
  const dn = (d: Dish) => t('d.' + d.id, d.name);
  const yt = (y: number | null) => yearText(y, t('bce', 'BCE'), t('ce', 'CE'));
  const km = (v: number) => `${Math.round(v).toLocaleString(lang)} km`;
  const gr = (v: number) => (v < 10 ? (Math.round(v * 10) / 10).toLocaleString(lang) : Math.round(v).toLocaleString(lang)) + ' g';
  const regionName = (r: Region) => t('r.' + r, r);
  let sel: Food | null = null, anim = 1, animStart = 0;

  heading(L.panel, t('h', 'Food universe'));
  seg(L.panel, t('room', 'Room'), [['plate', t('m.plate', 'Plate atlas')], ['time', t('m.time', 'Origins timeline')], ['bake', t('m.bake', 'Baker’s desk')]], cfg.room, (v) => { cfg.room = v as Cfg['room']; save(); sel = null; build(); draw(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—'], ['d', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (...a: string[]) => a.forEach((s, i) => { dts[i].textContent = s; });

  const dish = () => DISHES.find((d) => d.id === cfg.dish) || null;
  const items = () => (cfg.dish === 'mine' ? cfg.mine : dish()?.items || []);
  function eatAt(): { name: string; lat: number; lon: number } {
    const c = CITIES.find((x) => x[0] === cfg.city); if (c) return { name: c[0], lat: c[1], lon: c[2] };
    const d = dish(); if (d) return { name: d.home, lat: d.lat, lon: d.lon };
    return { name: 'Dhaka', lat: 23.81, lon: 90.41 };
  }
  function replay() { anim = reduce ? 1 : 0; animStart = performance.now(); draw(); }

  let mineBox: HTMLElement | null = null, outBake: HTMLElement | null = null;
  const ctl: Record<string, ReturnType<typeof range>> = {};
  function build() {
    box.replaceChildren(); L.hud.textContent = ''; mineBox = null; outBake = null;
    for (const k in ctl) delete ctl[k];
    if (cfg.room === 'plate') {
      about.textContent = t('ab.plate', 'Every line runs from the place where an ingredient’s plant or animal was first domesticated to the city where the dish is eaten. Most plates are a meeting of several continents. Choose a dish, or “My plate” and tick ingredients, and tap any dot on the map for its story.');
      select(box, t('dish', 'Dish'), [...DISHES.map((d) => [d.id, dn(d)] as [string, string]), ['mine', t('mine', 'My plate')]], cfg.dish, (v) => { cfg.dish = v; save(); sel = null; build(); replay(); });
      select(box, t('eat', 'Eaten in'), [['home', t('home', 'The dish’s home city')], ...CITIES.slice(0, 38).map((c) => [c[0], c[0]] as [string, string])], cfg.city, (v) => { cfg.city = v; save(); replay(); });
      if (cfg.dish === 'mine') {
        mineBox = h('fieldset', { class: 'w71-mine' }, h('legend', { text: t('pick', 'Ingredients on my plate') }));
        for (const f of FOODS) {
          const id = `w71-${f.id}`, inp = h('input', { type: 'checkbox', id }) as HTMLInputElement; inp.checked = cfg.mine.includes(f.id);
          inp.addEventListener('change', () => { cfg.mine = inp.checked ? [...cfg.mine, f.id] : cfg.mine.filter((x) => x !== f.id); save(); sel = f; draw(); });
          mineBox.append(h('label', { for: id }, inp, h('i', { style: { background: REGION_COL[f.region] } }), h('span', { text: fn(f) })));
        }
        box.append(mineBox);
        buttons(box, [[t('clear', 'Clear plate'), () => { cfg.mine = []; save(); build(); draw(); }]]);
      }
      buttons(box, [[t('replay', 'Draw the journeys again'), replay, true]]);
      lab(t('st.n', 'Ingredients'), t('st.km', 'Food-kilometres'), t('st.cont', 'Continents'), t('st.old', 'Oldest ingredient'));
    } else if (cfg.room === 'time') {
      about.textContent = t('ab.time', 'Farming began independently in several places. Each dot is an ingredient with a reasonably settled date, placed by about when people first domesticated it; colour shows the continent. Dates are rough midpoints of current estimates. Ingredients whose date is still debated are listed underneath without one.');
      lab(t('st.dated', 'Dated ingredients'), t('st.first', 'Earliest'), t('st.latest', 'Most recent'), t('st.sel', 'Selected'));
    } else {
      about.textContent = t('ab.bake', 'Bakers write recipes as percentages of the flour, so one formula fits any batch size. Pick a bread, set how many pieces and how heavy, and the desk gives every ingredient in grams. A sourdough starter’s flour and water count towards the totals, so the hydration you set is the real one.');
      select(box, t('bread', 'Bread'), Object.keys(PRESETS).map((k) => [k, t('b.' + k, k)] as [string, string]), cfg.preset, (v) => { cfg.preset = v; cfg.f = { ...PRESETS[v] }; save(); build(); draw(); });
      const f = cfg.f, upd = () => { save(); draw(); };
      ctl.pieces = range(box, t('pieces', 'Pieces'), { min: 1, max: 24, value: f.pieces }, (v) => { f.pieces = v; upd(); });
      ctl.weight = range(box, t('weight', 'Weight of each piece'), { min: 50, max: 2000, step: 10, value: f.weight, fmt: (v) => `${v} g` }, (v) => { f.weight = v; upd(); });
      ctl.hyd = range(box, t('hyd', 'Hydration (water)'), { min: 50, max: 100, value: f.hyd, fmt: (v) => `${v}%` }, (v) => { f.hyd = v; upd(); });
      ctl.salt = range(box, t('salt', 'Salt'), { min: 0, max: 4, step: 0.1, value: f.salt, fmt: (v) => `${v.toFixed(1)}%` }, (v) => { f.salt = v; upd(); });
      select(box, t('leaven', 'Leavening'), [['instant', t('l.instant', 'Instant yeast')], ['dry', t('l.dry', 'Active dry yeast')], ['fresh', t('l.fresh', 'Fresh yeast')], ['starter', t('l.starter', 'Sourdough starter')]], f.leaven, (v) => {
        const was = f.leaven, nv = v as Leaven;
        if (was !== 'starter' && nv !== 'starter') f.lev = Math.round(yeastSwap(f.lev, was, nv) * 100) / 100; else if (nv === 'starter') f.lev = 10; else f.lev = nv === 'fresh' ? 1.5 : nv === 'dry' ? 0.6 : 0.5;
        f.leaven = nv; save(); build(); draw();
      });
      if (f.leaven === 'starter') {
        ctl.lev = range(box, t('lev.s', 'Flour in the starter (of all flour)'), { min: 2, max: 40, value: f.lev, fmt: (v) => `${v}%` }, (v) => { f.lev = v; upd(); });
        ctl.sh = range(box, t('shyd', 'Starter hydration'), { min: 50, max: 150, step: 5, value: f.starterHyd, fmt: (v) => `${v}%` }, (v) => { f.starterHyd = v; upd(); });
      } else ctl.lev = range(box, t('lev.y', 'Yeast'), { min: f.leaven === 'fresh' ? 0.1 : 0.05, max: f.leaven === 'fresh' ? 6 : 2.5, step: 0.05, value: f.lev, fmt: (v) => `${v.toFixed(2)}%` }, (v) => { f.lev = v; upd(); });
      ctl.fat = range(box, t('fat', 'Butter or oil'), { min: 0, max: 20, step: 0.5, value: f.fat, fmt: (v) => `${v}%` }, (v) => { f.fat = v; upd(); });
      ctl.sugar = range(box, t('sugar', 'Sugar'), { min: 0, max: 20, step: 0.5, value: f.sugar, fmt: (v) => `${v}%` }, (v) => { f.sugar = v; upd(); });
      box.append(h('h3', { class: 'w71-sub', text: t('temp', 'Water temperature') }));
      ctl.ddt = range(box, t('ddt', 'Target dough temperature'), { min: 20, max: 30, step: 0.5, value: cfg.ddt, fmt: (v) => `${v} °C` }, (v) => { cfg.ddt = v; upd(); });
      ctl.rt = range(box, t('rt', 'Room and flour temperature'), { min: 5, max: 40, step: 0.5, value: cfg.rt, fmt: (v) => `${v} °C` }, (v) => { cfg.rt = v; upd(); });
      ctl.fr = range(box, t('fr', 'Heat from mixing (friction)'), { min: 0, max: 15, step: 0.5, value: cfg.fr, fmt: (v) => `${v} °C` }, (v) => { cfg.fr = v; upd(); });
      outBake = h('p', { class: 'w71-water', 'aria-live': 'polite' }); box.append(outBake);
      note(box, t('fr.n', 'Friction depends on your mixer and how long you knead. To measure it, take the dough’s temperature right after mixing and subtract the room, flour and water temperatures’ share.'));
      lab(t('st.total', 'Total dough'), t('st.flour', 'Total flour'), t('st.hydb', 'Dough type'), t('st.swap', 'Yeast swap'));
    }
  }

  /* ---------- map ---------- */
  const rings = unwrapRings(decodeLand());
  let landCv: HTMLCanvasElement | null = null, geo = { cx: 0, cy: 0, k: 1 }, lastW = 0, lastH = 0;
  const EX = eeFwd(180, 0)[0], EY = eeFwd(0, 90)[1];
  const P = (lo: number, la: number): [number, number] => { const [x, y] = eeFwd(lo, la); return [geo.cx + x * geo.k, geo.cy - y * geo.k]; };
  function outlinePath(g: CanvasRenderingContext2D) { g.beginPath(); for (let la = -90; la <= 90; la += 2) { const [x, y] = P(180, la); if (la === -90) g.moveTo(x, y); else g.lineTo(x, y); } for (let la = 90; la >= -90; la -= 2) { const [x, y] = P(-180, la); g.lineTo(x, y); } g.closePath(); }
  function bakeLand(W: number, Hh: number) {
    const pad = 14, top = 34, k = Math.min((W - pad * 2) / (2 * EX), (Hh - top - pad - 12) / (2 * EY));
    geo = { cx: W / 2, cy: top + (Hh - top - pad - 12) / 2, k }; lastW = W; lastH = Hh;
    const c = document.createElement('canvas'), d = S.dpr; c.width = Math.max(1, Math.round(W * d)); c.height = Math.max(1, Math.round(Hh * d));
    const g = c.getContext('2d'); if (!g) return; g.scale(d, d);
    const bg = g.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, '#1b120c'); bg.addColorStop(1, '#120c09'); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    g.save(); outlinePath(g); g.fillStyle = '#21170f'; g.fill(); g.clip();
    g.beginPath(); for (const r of rings) for (const off of [-360, 0, 360]) r.forEach(([lo, la], i) => { const [x, y] = P(lo + off, la); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.fillStyle = '#3b2b1d'; g.fill('evenodd'); g.strokeStyle = 'rgba(245,205,150,.22)'; g.lineWidth = .6; g.stroke();
    g.restore(); outlinePath(g); g.strokeStyle = 'rgba(245,205,150,.3)'; g.lineWidth = 1; g.stroke();
    landCv = c;
  }
  function arc(g: CanvasRenderingContext2D, a: Food, b: { lat: number; lon: number }, frac: number) {
    const pts = greatCircle(a.lat, a.lon, b.lat, b.lon, 72), n = Math.max(1, Math.round(pts.length * frac));
    g.beginPath(); let px = 0;
    for (let i = 0; i < n; i++) { const [x, y] = P(pts[i][1], pts[i][0]); if (i === 0 || Math.abs(x - px) > S.w / 2) g.moveTo(x, y); else g.lineTo(x, y); px = x; }
    g.stroke();
  }
  function label(g: CanvasRenderingContext2D, txt: string, x: number, y: number, col: string, used: number[][]) {
    g.font = '600 11px ui-sans-serif, system-ui'; const w = g.measureText(txt).width + 8;
    let lx = clamp(x + 7, 4, S.w - w - 4), ly = y - 8;
    for (let k = 0; k < 14; k++) { const hit = used.some(([ux, uy, uw]) => lx < ux + uw && ux < lx + w && Math.abs(uy - ly) < 15); if (!hit) break; ly += 15; }
    used.push([lx, ly, w]);
    g.fillStyle = 'rgba(18,12,9,.82)'; g.fillRect(lx, ly - 11, w, 15); g.fillStyle = col; g.fillText(txt, lx + 4, ly);
  }
  function drawPlate(g: CanvasRenderingContext2D) {
    const ids = items(), at = eatAt(), list = ids.map((i) => FOOD[i]).filter(Boolean), mine = cfg.dish === 'mine';
    for (const f of FOODS) if (!ids.includes(f.id)) { const [x, y] = P(f.lon, f.lat); g.beginPath(); g.arc(x, y, mine ? 3.5 : 2.2, 0, 7); g.fillStyle = mine ? 'rgba(245,215,170,.45)' : 'rgba(245,215,170,.18)'; g.fill(); }
    g.lineWidth = 1.6; g.lineCap = 'round';
    list.forEach((f, i) => { const fr = clamp(anim * (list.length + 2) / 3 - i / 3, 0, 1); if (fr <= 0) return; g.strokeStyle = REGION_COL[f.region] + 'cc'; arc(g, f, at, fr); });
    const used: number[][] = [];
    for (const f of list) { const [x, y] = P(f.lon, f.lat); g.beginPath(); g.arc(x, y, sel?.id === f.id ? 7 : 5, 0, 7); g.fillStyle = REGION_COL[f.region]; g.fill(); g.strokeStyle = sel?.id === f.id ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = sel?.id === f.id ? 2 : 1; g.stroke(); }
    const [cx, cy] = P(at.lon, at.lat);
    g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fillStyle = '#fff6e6'; g.fill(); g.beginPath(); g.arc(cx, cy, 5, 0, 7); g.fillStyle = '#c4532d'; g.fill();
    if (S.w > 520 || list.length <= 6) for (const f of list) { const [x, y] = P(f.lon, f.lat); label(g, fn(f), x, y, REGION_COL[f.region], used); }
    label(g, at.name, cx, cy + 22, '#fff6e6', used);
    const title = cfg.dish === 'mine' ? t('mine', 'My plate') : dn(dish() as Dish);
    g.fillStyle = '#fbe9d0'; g.font = '600 15px ui-sans-serif, system-ui'; g.fillText(`${title} · ${t('eatin', 'eaten in')} ${at.name}`, 14, 22);
    const s = plateStats(ids, at.lat, at.lon);
    out('a', String(s.n)); out('b', km(s.km)); out('c', String(s.regions)); out('d', s.old ? fn(s.old).split(' (')[0] : '—');
    if (sel) {
      const y = yt(sel.year), d = haversine(sel.lat, sel.lon, at.lat, at.lon);
      L.hud.textContent = `${fn(sel)}: ${fp(sel)}${y ? `, ${t('dom', 'domesticated')} ${y}` : `, ${t('nodate', 'date still debated')}`}. ${km(d)} ${t('to', 'to')} ${at.name}.`;
    } else L.hud.textContent = s.n ? `${t('far', 'Furthest traveller')}: ${s.far ? fn(s.far) : ''} (${km(s.farKm)}). ${t('tapdot', 'Tap a dot for its story.')}` : t('empty', 'The plate is empty. Tick some ingredients or tap dots on the map.');
  }

  /* ---------- timeline ---------- */
  let tlHits: { f: Food; x: number; y: number }[] = [];
  function drawTime(g: CanvasRenderingContext2D, W: number, Hh: number) {
    g.fillStyle = '#150e0a'; g.fillRect(0, 0, W, Hh);
    const dated = FOODS.filter((f) => f.year !== null).sort((a, b) => (a.year as number) - (b.year as number));
    const undated = FOODS.filter((f) => f.year === null);
    const x0 = 24, x1 = W - 24, y0 = 46, axisY = Hh - (W < 600 ? 128 : 96), Y0 = -10000, Y1 = 0;
    const X = (y: number) => x0 + (y - Y0) / (Y1 - Y0) * (x1 - x0);
    g.fillStyle = '#fbe9d0'; g.font = '600 15px ui-sans-serif, system-ui'; g.fillText(t('tl', 'When our food was first domesticated'), 14, 24);
    g.strokeStyle = 'rgba(245,205,150,.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, axisY); g.lineTo(x1, axisY); g.stroke();
    g.font = '11px ui-sans-serif, system-ui'; g.fillStyle = 'rgba(251,233,208,.7)'; g.textAlign = 'center';
    const step = W < 520 ? 2000 : 1000;
    for (let y = Y0; y <= Y1; y += step) { const x = X(y); g.beginPath(); g.moveTo(x, axisY); g.lineTo(x, axisY + 5); g.stroke(); g.fillText(y === 0 ? '0' : `${-y}`, x, axisY + 18); }
    g.fillText(t('bce', 'BCE'), x0 + 12, axisY + 32); g.textAlign = 'left';
    const narrow = W < 600, maxRows = 40, lastX: number[] = Array(maxRows).fill(-1e9);
    tlHits = [];
    g.font = '600 11px ui-sans-serif, system-ui';
    const placed = dated.map((f) => { const x = X(f.year as number), name = fn(f).split(' (')[0], w = g.measureText(name).width + 14; let r = 0; while (r < maxRows - 1 && lastX[r] > x - 4) r++; lastX[r] = x + w; return { f, x, r, name }; });
    const used = Math.max(...placed.map((q) => q.r)) + 1, rowH = clamp((axisY - y0 - (narrow ? 26 : 10)) / used, 13, 46);
    for (const { f, x, r, name } of placed) {
      const y = axisY - 16 - r * rowH;
      g.strokeStyle = 'rgba(245,205,150,.18)'; g.beginPath(); g.moveTo(x, axisY); g.lineTo(x, y); g.stroke();
      g.beginPath(); g.arc(x, y, sel?.id === f.id ? 6 : 4, 0, 7); g.fillStyle = REGION_COL[f.region]; g.fill();
      if (sel?.id === f.id) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.lineWidth = 1; }
      g.fillStyle = sel?.id === f.id ? '#fff' : 'rgba(251,233,208,.9)'; g.fillText(name, x + 7, y + 4);
      tlHits.push({ f, x, y });
    }
    g.font = '11px ui-sans-serif, system-ui'; g.fillStyle = 'rgba(251,233,208,.6)';
    const txt = `${t('undated', 'Date still debated')}: ${undated.map((f) => fn(f).split(' (')[0]).join(', ')}`;
    const words = txt.split(' '); let line = '', ly = axisY + 52;
    for (const wd of words) { if (g.measureText(line + wd).width > W - 28 && line) { g.fillText(line, 14, ly); line = ''; ly += 14; if (ly > Hh - 4) break; } line += wd + ' '; }
    if (ly <= Hh - 4) g.fillText(line, 14, ly);
    { let lx = 14; const ly = narrow ? 44 : 24; if (!narrow) { lx = W - 14 - (['asia', 'americas', 'africa', 'europe', 'oceania'] as Region[]).reduce((a, r) => a + g.measureText(regionName(r)).width + 24, 0); }
      for (const r of (['asia', 'americas', 'africa', 'europe', 'oceania'] as Region[])) { const s = regionName(r), w = g.measureText(s).width; g.fillStyle = REGION_COL[r]; g.beginPath(); g.arc(lx + 4, ly - 4, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(251,233,208,.8)'; g.fillText(s, lx + 12, ly); lx += w + 24; } }
    out('a', `${dated.length} / ${FOODS.length}`); out('b', `${fn(dated[0]).split(' (')[0]} ${yt(dated[0].year)}`); const ld = dated[dated.length - 1]; out('c', `${fn(ld).split(' (')[0]} ${yt(ld.year)}`); out('d', sel ? fn(sel).split(' (')[0] : '—');
    L.hud.textContent = sel ? `${fn(sel)}: ${fp(sel)}, ${yt(sel.year) ?? t('nodate', 'date still debated')}.` : t('taptl', 'Tap a dot to see where it was domesticated.');
  }

  /* ---------- baker's desk ---------- */
  function drawBake(g: CanvasRenderingContext2D, W: number, Hh: number) {
    const f = cfg.f, r = bake(f);
    const bg = g.createLinearGradient(0, 0, 0, Hh); bg.addColorStop(0, '#2a1b12'); bg.addColorStop(1, '#170f0a'); g.fillStyle = bg; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#fbe9d0'; g.font = '600 15px ui-sans-serif, system-ui'; g.fillText(`${t('b.' + cfg.preset, cfg.preset)} · ${f.pieces} × ${f.weight} g`, 14, 24);
    const wide = W > 640, ballW = wide ? W * .36 : W, listX = wide ? ballW + 10 : 14, listY = wide ? 50 : Hh * .5;
    /* dough: wetter dough slumps wider and flatter, and shines more */
    const band = hydBand(f.hyd), cx = ballW / 2, base = wide ? Hh * .62 : Hh * .34, R = Math.min(ballW * .26, (wide ? Hh : Hh * .4) * .3);
    const spread = 1 + (f.hyd - 50) / 50 * .75, rx = R * spread, ry = R / spread * 1.05;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(cx, base + 4, rx * 1.05, ry * .22, 0, 0, 7); g.fill();
    const dg = g.createRadialGradient(cx - rx * .35, base - ry * 1.1, 2, cx, base - ry * .6, rx * 1.2);
    const hue = f.leaven === 'starter' ? '#efe0c4' : f.sugar + f.fat > 6 ? '#f6dfb3' : '#f3e6cf';
    dg.addColorStop(0, '#fffaf0'); dg.addColorStop(.35 - band * .04, hue); dg.addColorStop(1, '#b9946a');
    g.fillStyle = dg; g.beginPath(); g.ellipse(cx, base - ry * .55, rx, ry, 0, Math.PI, 0); g.lineTo(cx + rx, base); g.bezierCurveTo(cx + rx * .6, base + ry * .12, cx - rx * .6, base + ry * .12, cx - rx, base); g.closePath(); g.fill();
    g.fillStyle = `rgba(255,255,255,${.12 + band * .07})`; g.beginPath(); g.ellipse(cx - rx * .3, base - ry * 1.05, rx * .28, ry * .12, -.2, 0, 7); g.fill();
    if (f.leaven === 'starter') { g.fillStyle = 'rgba(120,90,60,.35)'; for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = (i % 3 + 1) * .22; g.beginPath(); g.arc(cx + Math.cos(a) * rx * rr, base - ry * .6 + Math.sin(a) * ry * rr * .5, 1.5 + (i % 2), 0, 7); g.fill(); } }
    g.textAlign = 'center'; g.fillStyle = '#fbe9d0'; g.font = '600 13px ui-sans-serif, system-ui';
    g.fillText(`${f.hyd}% · ${t('hb.' + band, ['stiff', 'firm', 'medium', 'soft', 'very wet'][band])}`, cx, base + ry * .35 + 26); g.textAlign = 'left';
    /* the formula, as bars scaled to the flour */
    const rows: [string, number, number, string][] = [];
    if (f.leaven === 'starter') { rows.push([t('i.addflour', 'Flour to add'), r.addFlour, r.addFlour / r.flour * 100, '#f2e2c4'], [t('i.addwater', 'Water to add'), r.addWater, r.addWater / r.flour * 100, '#7fc4ff'], [t('i.starter', 'Starter'), r.starter, r.starter / r.flour * 100, '#d9b98a']); }
    else rows.push([t('i.flour', 'Flour'), r.flour, 100, '#f2e2c4'], [t('i.water', 'Water'), r.water, f.hyd, '#7fc4ff'], [t('l.' + f.leaven, 'Yeast'), r.yeast, f.lev, '#d9b98a']);
    rows.push([t('i.salt', 'Salt'), r.salt, f.salt, '#e9eef5']);
    if (f.fat) rows.push([t('i.fat', 'Butter or oil'), r.fat, f.fat, '#f6d36b']);
    if (f.sugar) rows.push([t('i.sugar', 'Sugar'), r.sugar, f.sugar, '#f3b3c7']);
    const lw = W - listX - 14, lc = wide ? .32 : .4, rowH = Math.min(30, ((wide ? Hh - 70 : Hh * .5 - 20)) / (rows.length + 1)), barMax = lw * .5;
    g.font = '12px ui-sans-serif, system-ui';
    rows.forEach(([n, gm, pc, col], i) => {
      const y = listY + i * rowH;
      g.fillStyle = 'rgba(251,233,208,.85)'; g.fillText(n, listX, y + 13);
      g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(listX + lw * lc, y + 3, barMax, rowH - 10);
      g.fillStyle = col; g.fillRect(listX + lw * lc, y + 3, Math.max(1.5, barMax * Math.min(1, pc / 100)), rowH - 10);
      g.textAlign = 'right'; g.fillStyle = '#fff'; g.font = '600 12px ui-sans-serif, system-ui'; g.fillText(gr(gm), listX + lw, y + 13);
      g.font = '11px ui-sans-serif, system-ui'; g.fillStyle = 'rgba(251,233,208,.55)'; g.fillText(`${(Math.round(pc * 10) / 10).toLocaleString(lang)}%`, listX + lw * lc - 6, y + 13); g.textAlign = 'left'; g.font = '12px ui-sans-serif, system-ui';
    });
    const ty = listY + rows.length * rowH + 8;
    g.strokeStyle = 'rgba(245,205,150,.3)'; g.beginPath(); g.moveTo(listX, ty - 4); g.lineTo(listX + lw, ty - 4); g.stroke();
    g.fillStyle = '#fbe9d0'; g.font = '600 12px ui-sans-serif, system-ui'; g.fillText(t('i.total', 'Total'), listX, ty + 12); g.textAlign = 'right'; g.fillText(gr(r.total), listX + lw, ty + 12); g.textAlign = 'left';
    if (f.leaven === 'starter' && ty + 32 < Hh) { g.font = '11px ui-sans-serif, system-ui'; g.fillStyle = 'rgba(251,233,208,.65)'; g.fillText(`${t('i.starterIs', 'Starter')} = ${gr(r.sFlour)} ${t('i.flourW', 'flour')} + ${gr(r.sWater)} ${t('i.waterW', 'water')}`, listX, ty + 32); }
    /* outputs */
    const wt = waterTemp(cfg.ddt, cfg.rt, cfg.rt, cfg.fr, f.leaven === 'starter' ? cfg.rt : null);
    if (outBake) outBake.textContent = `${t('w.use', 'Use water at')} ${Math.round(wt)} °C. ${wt < 2 ? t('w.ice', 'That is below what tap water can give: chill the water with ice, or mix in a cooler place.') : wt > 40 ? t('w.hot', 'Above 40 °C can harm yeast: warm the room or flour instead, or aim for a cooler dough.') : ''}`;
    out('a', gr(r.total)); out('b', gr(r.flour)); out('c', t('hb.' + band, ['stiff', 'firm', 'medium', 'soft', 'very wet'][band]));
    if (f.leaven === 'starter') out('d', '—');
    else { const o = (['instant', 'dry', 'fresh'] as const).filter((x) => x !== f.leaven); out('d', o.map((x) => `${gr(yeastSwap(r.yeast, f.leaven as 'instant', x))} ${t('ls.' + x, x)}`).join(' · ')); }
    L.hud.textContent = `${t('b.' + cfg.preset, cfg.preset)}: ${gr(r.flour)} ${t('i.flourW', 'flour')}, ${gr(r.water)} ${t('i.waterW', 'water')} (${f.hyd}%), ${gr(r.salt)} ${t('i.saltW', 'salt')}. ${t('w.use', 'Use water at')} ${Math.round(wt)} °C.`;
  }

  S.cv.addEventListener('click', (e) => {
    const p = local(e, S.cv);
    if (cfg.room === 'plate') {
      let best: Food | null = null, bd = 16;
      for (const f of FOODS) { const [x, y] = P(f.lon, f.lat), d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = f; } }
      if (best && cfg.dish === 'mine' && !cfg.mine.includes(best.id)) { cfg.mine = [...cfg.mine, best.id]; save(); if (mineBox) { const c = mineBox.querySelector(`#w71-${best.id}`) as HTMLInputElement | null; if (c) c.checked = true; } }
      sel = best; draw();
    } else if (cfg.room === 'time') {
      let best: Food | null = null, bd = 18; for (const hh of tlHits) { const d = Math.hypot(hh.x - p.x, hh.y - p.y); if (d < bd) { bd = d; best = hh.f; } }
      sel = best; draw();
    }
  });

  let raf = 0;
  function draw() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const g = S.g, W = S.w, Hh = S.h;
      if (cfg.room === 'plate') {
        if (!landCv || W !== lastW || Hh !== lastH) bakeLand(W, Hh);
        if (landCv) g.drawImage(landCv, 0, 0, W, Hh);
        if (anim < 1) { anim = Math.min(1, (performance.now() - animStart) / 1600); }
        drawPlate(g);
        if (anim < 1) draw();
      } else if (cfg.room === 'time') drawTime(g, W, Hh);
      else drawBake(g, W, Hh);
    });
  }
  ctx.onDispose(() => cancelAnimationFrame(raf));
  S.onResize(() => { landCv = null; draw(); });
  build(); replay();
}
