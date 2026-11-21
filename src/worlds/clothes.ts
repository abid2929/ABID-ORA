/* Clothing: models, editable parts and the design library for the Abidora clothing studio.
   The 3D garments are original Abidora designs built in Blender (tools/blender/garment.py): hoodie, T-shirt, shirt,
   jeans, a belted trench coat and a cafe-racer jacket. Every part is a separate zone with real thickness, folds,
   seams and stitching, and baked contact shadows. */
import type { StudioConfig, Design, DesignState, ZoneState, MatKey, Finish, Pattern, PrintState } from './fashion3d';

const z = (c: string, m: MatKey, f: Finish = 'matte', p: Pattern = 'solid', pc = '#f4f2ee'): ZoneState => ({ c, m, f, p, pc });
const FAB: MatKey[] = ['cotton', 'jersey', 'fleece', 'denim', 'twill', 'wool', 'linen', 'canvas', 'knit', 'nylon', 'silk', 'satin', 'leather', 'suede', 'nubuck', 'croc'];
type ZS = Record<string, ZoneState>;
const T = '#e9e5dc';
const BASE: Record<string, () => ZS> = {
  hoodie: () => ({ body: z('#8c8f94', 'fleece'), sleeves: z('#8c8f94', 'fleece'), hood: z('#8c8f94', 'fleece'), pocket: z('#8c8f94', 'fleece'), cuffs: z('#8c8f94', 'rib'), hem: z('#8c8f94', 'rib'),
    inside: z('#c9c6bf', 'fleece'), strings: z('#f1eee6', 'cotton'), aglets: z('#c9c9cc', 'metal', 'metallic'), thread: z('#7a7d82', 'cotton') }),
  tee: () => ({ body: z('#f3f0e8', 'jersey'), sleeves: z('#f3f0e8', 'jersey'), collar: z('#f3f0e8', 'rib'), inside: z('#ebe7de', 'jersey'), thread: z('#e2ddd2', 'cotton') }),
  shirt: () => ({ body: z('#a9c1dc', 'cotton', 'satin'), sleeves: z('#a9c1dc', 'cotton', 'satin'), pocket: z('#a9c1dc', 'cotton', 'satin'), collar: z('#a9c1dc', 'cotton', 'satin'), placket: z('#a9c1dc', 'cotton', 'satin'),
    cuffs: z('#a9c1dc', 'cotton', 'satin'), inside: z('#a9c1dc', 'cotton'), buttons: z('#f2efe8', 'patent', 'gloss'), thread: z('#dfe6ee', 'cotton') }),
  jeans: () => ({ legs: z('#2d4466', 'denim'), waistband: z('#2d4466', 'denim'), loops: z('#2d4466', 'denim'), pocket: z('#2d4466', 'denim'), inside: z('#c8cfd9', 'cotton'),
    hardware: z('#b08a4a', 'metal', 'metallic'), patch: z('#8a5a34', 'leather'), thread: z('#d79a3b', 'cotton') }),
  coat: () => ({ body: z('#b48a5a', 'twill'), sleeves: z('#b48a5a', 'twill'), collar: z('#b48a5a', 'twill'), belt: z('#b48a5a', 'twill'), buttons: z('#3a2a1c', 'patent', 'gloss'),
    hardware: z('#b8b6b0', 'metal', 'metallic'), inside: z('#5a3a2a', 'satin', 'satin', 'check', '#8a6a4a'), cuffs: z('#1c1c1e', 'rib'), hem: z('#1c1c1e', 'rib'),
    placket: z('#1c1c1e', 'leather'), zip: z('#c9c9cc', 'metal', 'metallic'), thread: z('#6a5a48', 'cotton') }),
};
const P0 = (): PrintState => ({ on: false, text: '', art: 'none', ink: '#f4f2ee' });
function make(model: string, variant: string, ov: Record<string, Partial<ZoneState>>, o: { size?: string; strings?: boolean; belt?: boolean; front?: Partial<PrintState>; back?: Partial<PrintState>; wear?: number } = {}): DesignState {
  const zones = BASE[model]();
  for (const [k, v] of Object.entries(ov)) if (zones[k]) Object.assign(zones[k], v);
  return { model, variant, size: o.size ?? 'M', zones, show: { strings: o.strings ?? true, belt: o.belt ?? true, label: true },
    prints: { print_front: { ...P0(), ...o.front }, print_back: { ...P0(), ...o.back } }, wear: o.wear ?? 0 };
}
const all = (keys: string[], v: Partial<ZoneState>) => Object.fromEntries(keys.map((k) => [k, v]));
const MAIN = ['body', 'sleeves', 'hood', 'pocket'];
const D = (id: string, name: string, cat: string[], tags: string[], note: string, state: DesignState): Design => ({ id, name, cat, tags, note, state });

export const CLOTH_DESIGNS: Design[] = [
  D('hood-heather', 'Heather Fleece Hoodie', ['hoodies', 'casual', 'classic', 'trending'], ['grey', 'fleece', 'everyday'], 'Brushed heather-grey fleece with rib cuffs, a kangaroo pocket and cotton drawstrings.', make('hoodie', 'regular', {})),
  D('hood-noir', 'Noir Oversized Hoodie', ['hoodies', 'streetwear', 'trending'], ['black', 'oversized', 'back print'], 'Dropped-shoulder oversized cut in black fleece, with a large Abidora star on the back.', make('hoodie', 'oversized', { ...all([...MAIN, 'cuffs', 'hem'], { c: '#1c1c1e' }), strings: { c: '#1c1c1e' }, aglets: { c: '#2a2a2d' }, thread: { c: '#2a2a2d' } }, { back: { on: true, art: 'star', text: 'ABIDORA', ink: '#e9e5dc' } })),
  D('hood-sage', 'Sage Loop Hoodie', ['hoodies', 'casual'], ['green', 'pastel'], 'Soft sage fleece with cream drawstrings and a small chest wave.', make('hoodie', 'regular', { ...all([...MAIN, 'cuffs', 'hem'], { c: '#8fa38a' }), strings: { c: '#efe7d2' } }, { front: { on: true, art: 'wave', ink: '#efe7d2' } })),
  D('hood-block', 'Colour-block Hoodie', ['hoodies', 'streetwear', 'sports'], ['colour block', 'navy', 'rust'], 'Navy body, cream sleeves and a rust hood: three panels, each its own colour.', make('hoodie', 'regular', { body: { c: '#24324a' }, pocket: { c: '#24324a' }, sleeves: { c: '#e9e2c8' }, cuffs: { c: '#24324a' }, hem: { c: '#24324a' }, hood: { c: '#b4532f' }, inside: { c: '#e9e2c8' } })),
  D('hood-camo', 'Field Camo Hoodie', ['hoodies', 'streetwear'], ['camo', 'olive'], 'Woodland camo fleece with olive rib trims.', make('hoodie', 'oversized', { ...all(MAIN, { c: '#5d6b4a', p: 'camo', pc: '#3f4a32' }), cuffs: { c: '#3f4a32' }, hem: { c: '#3f4a32' } })),
  D('tee-white', 'Essential White Tee', ['tees', 'casual', 'classic'], ['white', 'jersey', 'basic'], 'Combed cotton jersey crew neck in off-white. The base of every wardrobe.', make('tee', 'crew', {})),
  D('tee-mono', 'Monogram Black Tee', ['tees', 'streetwear', 'trending'], ['black', 'graphic'], 'Black jersey with the Abidora monogram on the chest.', make('tee', 'crew', { ...all(['body', 'sleeves', 'collar'], { c: '#1c1c1e' }), inside: { c: '#2a2a2d' }, thread: { c: '#2a2a2d' } }, { front: { on: true, art: 'mono', ink: '#e9e5dc' } })),
  D('tee-breton', 'Breton Stripe Tee', ['tees', 'classic', 'casual'], ['stripe', 'navy', 'nautical'], 'Ecru and navy stripes on a heavier cotton jersey.', make('tee', 'crew', { ...all(['body', 'sleeves'], { c: '#f1ece0', p: 'stripe', pc: '#24324a' }), collar: { c: '#f1ece0' } })),
  D('tee-olive-v', 'Olive V-neck', ['tees', 'casual'], ['olive', 'v-neck'], 'Washed olive jersey with a deep V-neck band.', make('tee', 'vneck', { ...all(['body', 'sleeves', 'collar'], { c: '#5d6b4a' }) })),
  D('tee-sun', 'Sunburst Tee', ['tees', 'streetwear', 'sports'], ['graphic', 'orange', 'back print'], 'Sand jersey with a burnt-orange sunburst across the back.', make('tee', 'crew', { ...all(['body', 'sleeves', 'collar'], { c: '#d8c6a3' }) }, { back: { on: true, art: 'sun', text: 'GOLDEN HOUR', ink: '#c0582c' } })),
  D('shirt-oxford', 'Oxford Blue Shirt', ['shirts', 'formal', 'classic'], ['blue', 'cotton', 'button-down'], 'Sky-blue cotton shirt with a chest pocket and two-button cuffs.', make('shirt', 'long', {})),
  D('shirt-poplin', 'White Poplin Shirt', ['shirts', 'formal', 'luxury'], ['white', 'crisp'], 'Crisp white poplin with mother-of-pearl style buttons.', make('shirt', 'long', { ...all(['body', 'sleeves', 'pocket', 'collar', 'placket', 'cuffs', 'inside'], { c: '#f6f5f1', m: 'cotton', f: 'satin' }), buttons: { c: '#efeae0', m: 'patent', f: 'gloss' }, thread: { c: '#f0eee9' } })),
  D('shirt-gingham', 'Red Gingham Shirt', ['shirts', 'casual'], ['gingham', 'red', 'check'], 'Red and white gingham cotton with a solid white collar.', make('shirt', 'long', { ...all(['body', 'sleeves', 'pocket', 'placket', 'cuffs'], { c: '#f6f5f1', p: 'gingham', pc: '#b23a33' }), collar: { c: '#f6f5f1' } })),
  D('shirt-flannel', 'Highland Flannel', ['shirts', 'casual', 'outerwear'], ['flannel', 'check', 'wool'], 'Brushed wool flannel in a red and black check.', make('shirt', 'long', { ...all(['body', 'sleeves', 'pocket', 'collar', 'placket', 'cuffs'], { c: '#8e2a26', m: 'wool', f: 'matte', p: 'check', pc: '#1c1c1e' }), buttons: { c: '#2a1a10', m: 'cork' } })),
  D('shirt-linen', 'Sand Linen Shirt', ['shirts', 'casual', 'luxury'], ['linen', 'short sleeve', 'summer'], 'Short-sleeve linen in warm sand, cool and slubby for hot days.', make('shirt', 'short', { ...all(['body', 'sleeves', 'pocket', 'collar', 'placket', 'inside'], { c: '#d6c4a2', m: 'linen', f: 'matte' }), buttons: { c: '#6b4a2e', m: 'cork' } })),
  D('shirt-denim', 'Denim Work Shirt', ['shirts', 'streetwear', 'classic'], ['denim', 'workwear'], 'Mid-blue denim with copper-coloured stitching and snaps.', make('shirt', 'long', { ...all(['body', 'sleeves', 'pocket', 'collar', 'placket', 'cuffs'], { c: '#4b6a93', m: 'denim', f: 'matte' }), buttons: { c: '#b08a4a', m: 'metal', f: 'metallic' }, thread: { c: '#d79a3b' } })),
  D('jeans-indigo', 'Raw Indigo Straight', ['jeans', 'classic', 'trending'], ['indigo', 'raw denim'], 'Deep indigo denim with orange top-stitching, copper rivets and a leather back label.', make('jeans', 'straight', {})),
  D('jeans-light', 'Light Wash Straight', ['jeans', 'casual'], ['light wash', 'blue'], 'Sun-faded light blue denim with tonal stitching.', make('jeans', 'straight', { ...all(['legs', 'waistband', 'loops', 'pocket'], { c: '#8eaacb' }), thread: { c: '#c9a46b' } })),
  D('jeans-black', 'Black Denim', ['jeans', 'streetwear', 'formal'], ['black', 'clean'], 'Black denim with black thread and gunmetal rivets.', make('jeans', 'straight', { ...all(['legs', 'waistband', 'loops', 'pocket'], { c: '#1d1d20' }), thread: { c: '#3a3a3d' }, hardware: { c: '#55585e' }, patch: { c: '#1c1c1e' } })),
  D('jeans-ecru-wide', 'Ecru Wide Leg', ['jeans', 'luxury', 'trending'], ['ecru', 'wide leg'], 'Undyed ecru denim cut wide and straight from hip to hem.', make('jeans', 'wide', { ...all(['legs', 'waistband', 'loops', 'pocket'], { c: '#e6dcc6' }), thread: { c: '#c9b48a' }, inside: { c: '#e6dcc6' } })),
  D('jeans-worn', 'Worn-in Workwear Jeans', ['jeans', 'streetwear'], ['worn', 'vintage'], 'Mid-blue denim with a lived-in look: dust settled in the folds and seams.', make('jeans', 'straight', { ...all(['legs', 'waistband', 'loops', 'pocket'], { c: '#4b6a93' }) }, { wear: .6 })),
  D('trench-camel', 'Camel Trench', ['outerwear', 'classic', 'luxury', 'formal'], ['trench', 'camel', 'belted'], 'Double-breasted cotton gabardine trench with notch lapels, a belt and cuff straps.', make('coat', 'trench', {})),
  D('trench-black-leather', 'Black Leather Long Coat', ['outerwear', 'luxury', 'trending'], ['leather', 'black', 'long coat'], 'Long black leather coat with a belt, wide lapels and a burgundy satin lining.', make('coat', 'trench', { ...all(['body', 'sleeves', 'collar', 'belt'], { c: '#141416', m: 'leather', f: 'satin' }), buttons: { c: '#141416' }, inside: { c: '#5c1a1f', m: 'satin', f: 'satin', p: 'solid' }, thread: { c: '#2a2a2d' } })),
  D('trench-brown-leather', 'Brown Leather Coat', ['outerwear', 'luxury', 'classic'], ['leather', 'brown'], 'Cognac brown leather coat with a lived-in softness and a tan lining.', make('coat', 'trench', { ...all(['body', 'sleeves', 'collar', 'belt'], { c: '#6b3e22', m: 'leather', f: 'satin' }), buttons: { c: '#2a1a10' }, inside: { c: '#c9a46b', m: 'satin', p: 'solid' } }, { wear: .3 })),
  D('jacket-black', 'Cafe Racer Leather Jacket', ['outerwear', 'streetwear', 'trending'], ['leather', 'black', 'zip'], 'Black leather jacket with a stand collar, an offset metal zip and rib-free clean cuffs.', make('coat', 'jacket', { ...all(['body', 'sleeves', 'collar', 'cuffs', 'hem', 'placket'], { c: '#18181a', m: 'leather', f: 'satin' }), inside: { c: '#2a2a2d', m: 'satin', p: 'solid' } })),
  D('jacket-suede', 'Tan Suede Jacket', ['outerwear', 'casual', 'luxury'], ['suede', 'tan'], 'Soft tan suede cafe racer with a brass zip and a checked lining.', make('coat', 'jacket', { ...all(['body', 'sleeves', 'collar', 'cuffs', 'hem', 'placket'], { c: '#a8784a', m: 'suede' }), zip: { c: '#b08a4a' }, hardware: { c: '#b08a4a' } })),
];

const SIZE_CM: Record<string, number> = { XS: 88, S: 94, M: 100, L: 106, XL: 114 };
export const CLOTHES: StudioConfig = {
  key: 'cloth', bg: '#151417', acc: '#e8b46a', hint: 'Drag to turn · pinch, Ctrl + scroll or + / − to zoom',
  models: {
    hoodie: { name: 'Hoodie', variants: [['regular', 'Regular fit'], ['oversized', 'Oversized']], file: (v, l) => `assets/models/fashion/clothes/hoodie-${v}-${l}.glb`, note: 'Pullover hoodie: body, sleeves, hood lying over the back, kangaroo pocket, rib cuffs and hem, drawstrings with metal tips. Oversized drops the shoulder and widens the body.' },
    tee: { name: 'T-shirt', variants: [['crew', 'Crew neck'], ['vneck', 'V-neck']], file: (v, l) => `assets/models/fashion/clothes/tee-${v}-${l}.glb`, note: 'Jersey T-shirt with a ribbed neckband and twin-needle hems. The V-neck is its own neckline geometry.' },
    shirt: { name: 'Shirt', variants: [['long', 'Long sleeve'], ['short', 'Short sleeve']], file: (v, l) => `assets/models/fashion/clothes/shirt-${v}-${l}.glb`, note: 'Button shirt with a collar on a stand, front placket with seven buttons, chest pocket, curved shirt-tail hem and buttoned cuffs.' },
    jeans: { name: 'Jeans', variants: [['straight', 'Straight leg'], ['wide', 'Wide leg']], file: (v, l) => `assets/models/fashion/clothes/jeans-${v}-${l}.glb`, note: 'Five-pocket jeans: waistband with belt loops and a shank button, curved front pockets with rivets, back pockets, back label and top-stitching.' },
    coat: { name: 'Coat & jacket', variants: [['trench', 'Belted long coat'], ['jacket', 'Cafe racer jacket']], file: (v, l) => `assets/models/fashion/clothes/coat-${v}-${l}.glb`, note: 'Long coat: double-breasted with notch lapels, collar, belt and buckle, cuff straps and a back vent. Jacket: stand collar, offset metal zip with real teeth, rib-free cuffs and waistband.' },
  },
  zones: {
    body: { label: 'Body', mats: FAB, patterns: true }, sleeves: { label: 'Sleeves', mats: FAB, patterns: true }, hood: { label: 'Hood', mats: FAB, patterns: true },
    pocket: { label: 'Pockets', mats: FAB, patterns: true }, legs: { label: 'Legs', mats: FAB, patterns: true }, collar: { label: 'Collar, neckband & lapels', mats: ['rib', ...FAB], patterns: true },
    cuffs: { label: 'Cuffs', mats: ['rib', ...FAB], patterns: true }, hem: { label: 'Hem band', mats: ['rib', ...FAB], patterns: true },
    placket: { label: 'Placket & zip tape', mats: FAB, patterns: true }, waistband: { label: 'Waistband', mats: FAB }, loops: { label: 'Belt loops', mats: FAB },
    belt: { label: 'Belt & straps', mats: ['leather', 'suede', 'twill', 'canvas', 'patent', 'croc', 'nylon'] },
    inside: { label: 'Inside & lining', mats: ['jersey', 'cotton', 'fleece', 'satin', 'silk', 'nylon', 'twill', 'wool'], patterns: true },
    buttons: { label: 'Buttons', mats: ['patent', 'metal', 'cork', 'rubber', 'leather'] }, strings: { label: 'Drawstrings', mats: ['cotton', 'nylon', 'leather'] },
    aglets: { label: 'String tips & eyelets', mats: ['metal', 'rubber'] }, hardware: { label: 'Rivets, buckle & snaps', mats: ['metal'] }, zip: { label: 'Zip', mats: ['metal', 'rubber'] },
    patch: { label: 'Back label', mats: ['leather', 'suede', 'canvas'] }, thread: { label: 'Stitching', mats: ['cotton', 'nylon'] },
  },
  base: ['body', 'sleeves', 'hood', 'pocket', 'legs'],
  categories: [['hoodies', 'Hoodies'], ['tees', 'T-shirts'], ['shirts', 'Shirts'], ['jeans', 'Jeans'], ['outerwear', 'Coats & jackets'], ['casual', 'Casual'], ['formal', 'Formal'], ['streetwear', 'Streetwear'], ['sports', 'Sports'], ['luxury', 'Luxury'], ['classic', 'Classic'], ['trending', 'Trending']],
  designs: CLOTH_DESIGNS,
  sizes: ['XS', 'S', 'M', 'L', 'XL'].map((s) => [s, s]),
  sizeScale: (s) => ({ XS: .92, S: .96, M: 1, L: 1.04, XL: 1.09 } as Record<string, number>)[s] ?? 1,
  sizeNote: (s) => `Size ${s}: chest (or hip) about ${SIZE_CM[s] ?? 100} cm body measurement. The 3D garment is shown at this size.`,
  views: [['3/4', '3/4', [.6, .1, 1]], ['front', 'Front', [0, .05, 1.2]], ['back', 'Back', [0, .1, -1.2]], ['side', 'Side', [1.2, .05, .05]], ['detail', 'Close-up', [.3, .22, .55]]],
  lift: .5, dist: 1.55,
  shows: [['strings', 'Drawstrings', ['string', 'aglet', 'eyelet']], ['belt', 'Belt', ['belt', 'buckle']], ['label', 'Back label', ['patch']]],
  prints: [['print_front', 'Front graphic', 1.08], ['print_back', 'Back graphic', 1.08]],
  thumbView: [.55, .12, 1],
  credit: 'Clothing: original Abidora 3D garments built in Blender, with no brand logos. Every part is its own zone with real cloth thickness, folds, seams and stitching. Fabrics are physically based.',
};
