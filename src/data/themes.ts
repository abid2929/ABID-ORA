/* Abidora Theme Studio: 104 original themes in 13 families.
   Row: id, name, family, mode (d dark / l light), ink (page), ink2 (raised surface), bone (text), mute (secondary text), signal (accent), type pairing.
   Secondary colours (bone2, line) are derived; contrast is enforced at runtime and checked by tools/themes-test.mjs. */
export type ThemeRow = [string, string, string, 'd' | 'l', string, string, string, string, string, string];

export const FAMILIES: [string, string][] = [
  ['editorial', 'Editorial'], ['nordic', 'Nordic'], ['neon', 'Tokyo Neon'], ['desert', 'Desert'], ['ocean', 'Ocean'],
  ['forest', 'Forest'], ['luxury', 'Luxury'], ['brutal', 'Brutalist'], ['swiss', 'Swiss & Bauhaus'], ['pastel', 'Pastel'],
  ['retro', 'Retro & Terminal'], ['cosmic', 'Cosmic'], ['ink', 'Ink & Monochrome'],
];

/* type pairings: display serif, text sans, mono (all Google Fonts) */
export const TYPE: Record<string, { n: string; d: string; s: string; m: string }> = {
  editorial: { n: 'Editorial', d: 'Instrument Serif', s: 'Inter Tight', m: 'JetBrains Mono' },
  grotesk: { n: 'Grotesk', d: 'Space Grotesk', s: 'Space Grotesk', m: 'Space Mono' },
  classic: { n: 'Classic', d: 'Playfair Display', s: 'Source Sans 3', m: 'IBM Plex Mono' },
  humanist: { n: 'Humanist', d: 'Fraunces', s: 'Work Sans', m: 'DM Mono' },
  tech: { n: 'Tech', d: 'Sora', s: 'Manrope', m: 'JetBrains Mono' },
  mono: { n: 'Monospace', d: 'IBM Plex Mono', s: 'IBM Plex Sans', m: 'IBM Plex Mono' },
  brutal: { n: 'Brutal', d: 'Archivo Black', s: 'Archivo', m: 'Space Mono' },
  elegant: { n: 'Elegant', d: 'Cormorant Garamond', s: 'Jost', m: 'DM Mono' },
  retro: { n: 'Retro', d: 'Bricolage Grotesque', s: 'Bricolage Grotesque', m: 'VT323' },
  neo: { n: 'Neo', d: 'Unbounded', s: 'Outfit', m: 'Martian Mono' },
  japan: { n: 'Mincho', d: 'Shippori Mincho', s: 'Zen Kaku Gothic New', m: 'DM Mono' },
  soft: { n: 'Soft', d: 'DM Serif Display', s: 'DM Sans', m: 'DM Mono' },
};

export const THEMES: ThemeRow[] = [
  ['abidora-night', 'Abidora Night', 'editorial', 'd', '#0d0c0b', '#161513', '#ece6dc', '#8d877d', '#e8b46a', 'editorial'],
  ['ink-press', 'Ink Press', 'editorial', 'd', '#101010', '#1a1a1a', '#f2f0eb', '#8f8b85', '#ff5a36', 'classic'],
  ['sepia-folio', 'Sepia Folio', 'editorial', 'l', '#f3ece0', '#e8dfcf', '#1f1a14', '#6e6456', '#a8432a', 'classic'],
  ['newsprint', 'Newsprint', 'editorial', 'l', '#f4f2ed', '#e9e6df', '#121212', '#5f5d58', '#c8102e', 'editorial'],
  ['midnight-edition', 'Midnight Edition', 'editorial', 'd', '#0b1020', '#131a2e', '#e9ecf5', '#8b93a8', '#f0c46c', 'editorial'],
  ['gallery-white', 'Gallery White', 'editorial', 'l', '#fafaf8', '#efefec', '#161616', '#6b6b6b', '#2f5bea', 'humanist'],
  ['graphite', 'Graphite', 'editorial', 'd', '#18191b', '#222326', '#e6e6e3', '#8c8d8f', '#b8f05a', 'grotesk'],
  ['vellum', 'Vellum', 'editorial', 'l', '#efe9dd', '#e3dccd', '#2a241b', '#6c6355', '#8a5a2b', 'humanist'],

  ['fjord', 'Fjord', 'nordic', 'd', '#0f1a20', '#16242c', '#e3ecef', '#86a0aa', '#7fc8d8', 'soft'],
  ['birch', 'Birch', 'nordic', 'l', '#f1efe9', '#e4e1d8', '#1d2124', '#636a6f', '#4f7d6a', 'soft'],
  ['polar-night', 'Polar Night', 'nordic', 'd', '#0c1117', '#141b23', '#dfe7ef', '#8796a6', '#9ecbff', 'tech'],
  ['lingonberry', 'Lingonberry', 'nordic', 'l', '#f6f1ee', '#ebe3de', '#231b1a', '#6d5d59', '#b4234a', 'humanist'],
  ['sauna', 'Sauna', 'nordic', 'd', '#1a1410', '#241c16', '#f0e6da', '#a08c78', '#e39a5a', 'humanist'],
  ['frost', 'Frost', 'nordic', 'l', '#eef3f6', '#e1e9ee', '#14202a', '#5a6b78', '#2c7fb8', 'tech'],
  ['moss-stone', 'Moss Stone', 'nordic', 'd', '#121612', '#1a201a', '#e5eadf', '#8a9682', '#a9d18e', 'soft'],
  ['aalto', 'Aalto', 'nordic', 'l', '#f5f3ee', '#e8e5dc', '#1b1b1b', '#666258', '#e05a2b', 'grotesk'],

  ['shinjuku', 'Shinjuku', 'neon', 'd', '#0a0614', '#140c24', '#f3e9ff', '#9b8cb8', '#ff3df2', 'neo'],
  ['akihabara', 'Akihabara', 'neon', 'd', '#050a12', '#0b1424', '#e6f6ff', '#7f9bb3', '#19e3ff', 'neo'],
  ['ramen-bar', 'Ramen Bar', 'neon', 'd', '#140808', '#200e0e', '#ffeede', '#b08a7f', '#ff6b3d', 'japan'],
  ['vending', 'Vending Machine', 'neon', 'd', '#071008', '#0d1a0f', '#e8ffe9', '#84a889', '#39ff88', 'tech'],
  ['sakura-night', 'Sakura Night', 'neon', 'd', '#120a10', '#1e121a', '#ffe9f3', '#b38fa3', '#ff8ac6', 'japan'],
  ['arcade-yellow', 'Arcade Yellow', 'neon', 'd', '#0a0a0a', '#161616', '#fffbe6', '#a39f8a', '#ffe600', 'brutal'],
  ['rain-sign', 'Rain Sign', 'neon', 'd', '#070b14', '#0f1626', '#e5eeff', '#8794b0', '#6c8cff', 'neo'],
  ['kabuki', 'Kabuki', 'neon', 'd', '#100808', '#1c0f0f', '#f7ece4', '#a8918a', '#ff2d2d', 'japan'],

  ['dune', 'Dune', 'desert', 'l', '#f3e7d3', '#eadbc2', '#2b1d10', '#76614a', '#c4622d', 'elegant'],
  ['sahara-dusk', 'Sahara Dusk', 'desert', 'd', '#1c120c', '#2a1b12', '#f5e5d1', '#b09378', '#ff9a4d', 'elegant'],
  ['mesa', 'Mesa', 'desert', 'd', '#1d0f0b', '#2b1712', '#f4e0d4', '#ad8b7c', '#e0643c', 'humanist'],
  ['oasis', 'Oasis', 'desert', 'l', '#f2ecdd', '#e6dec9', '#18241f', '#5e6a5f', '#1f8a70', 'soft'],
  ['terracotta', 'Terracotta', 'desert', 'l', '#f4e4d8', '#eacfbd', '#2a1712', '#75574a', '#b4472a', 'humanist'],
  ['mirage', 'Mirage', 'desert', 'd', '#191512', '#241f1a', '#efe7dc', '#a39686', '#e8c26a', 'elegant'],
  ['cactus-bloom', 'Cactus Bloom', 'desert', 'l', '#f1eee4', '#e5e0d0', '#1f241c', '#626a59', '#d6336c', 'soft'],
  ['night-caravan', 'Night Caravan', 'desert', 'd', '#0f0c14', '#18131f', '#ece4f2', '#988ca6', '#f2b25e', 'elegant'],

  ['abyss', 'Abyss', 'ocean', 'd', '#03101a', '#071b2a', '#dff1fb', '#7d9db0', '#2fd3c6', 'tech'],
  ['lagoon', 'Lagoon', 'ocean', 'l', '#ecf6f6', '#dcebeb', '#0f2a2e', '#4d6a6e', '#0f8b8d', 'soft'],
  ['coral-reef', 'Coral Reef', 'ocean', 'd', '#08141c', '#0e202b', '#eaf3f7', '#85a0ad', '#ff7f6b', 'humanist'],
  ['tidepool', 'Tidepool', 'ocean', 'l', '#eef3f1', '#dfe8e4', '#142621', '#566a63', '#2d6a4f', 'humanist'],
  ['deep-trench', 'Deep Trench', 'ocean', 'd', '#02060d', '#060f1c', '#d8e6f5', '#7488a0', '#4cc9f0', 'neo'],
  ['sea-glass', 'Sea Glass', 'ocean', 'l', '#eef6f2', '#dbeee5', '#12261f', '#4f6b60', '#3a9d8f', 'soft'],
  ['kelp', 'Kelp', 'ocean', 'd', '#0b140f', '#122019', '#e3efe7', '#85998c', '#b5d35c', 'grotesk'],
  ['harbor-fog', 'Harbor Fog', 'ocean', 'l', '#e9edef', '#dce2e5', '#1a2228', '#58646b', '#34658a', 'classic'],

  ['old-growth', 'Old Growth', 'forest', 'd', '#0d140e', '#142017', '#e4ecdf', '#8a9b85', '#9bd36a', 'humanist'],
  ['fern', 'Fern', 'forest', 'l', '#eff3ea', '#e1e8d8', '#182317', '#59684f', '#3f7d20', 'soft'],
  ['mushroom', 'Mushroom', 'forest', 'd', '#16120e', '#211b15', '#ede3d6', '#a49481', '#d9a05b', 'humanist'],
  ['lichen', 'Lichen', 'forest', 'l', '#eef0e6', '#e0e4d3', '#20241a', '#616654', '#6f8326', 'classic'],
  ['canopy', 'Canopy', 'forest', 'd', '#0a1510', '#10201a', '#def0e6', '#82a092', '#5ee0a0', 'tech'],
  ['autumn-floor', 'Autumn Floor', 'forest', 'l', '#f3ece2', '#e8dccb', '#2a1c12', '#73604c', '#c25b1b', 'elegant'],
  ['firefly', 'Firefly', 'forest', 'd', '#0a0d08', '#121710', '#eaf0dc', '#8f9a7c', '#f4e35a', 'soft'],
  ['pine-cabin', 'Pine Cabin', 'forest', 'd', '#12100d', '#1c1915', '#ece5d8', '#a0968a', '#c76b3a', 'classic'],

  ['noir-gold', 'Noir Gold', 'luxury', 'd', '#0b0a08', '#15130f', '#f1ead9', '#a39a85', '#d4af37', 'elegant'],
  ['champagne', 'Champagne', 'luxury', 'l', '#f5efe4', '#ebe2d1', '#231e16', '#6e6553', '#9a7628', 'elegant'],
  ['velvet', 'Velvet', 'luxury', 'd', '#12060c', '#1e0c15', '#f4e6ec', '#ad8d9a', '#e2b56b', 'classic'],
  ['marble', 'Marble', 'luxury', 'l', '#f4f3f1', '#e8e6e3', '#1c1c1c', '#66645f', '#8b6f47', 'elegant'],
  ['emerald-club', 'Emerald Club', 'luxury', 'd', '#04120d', '#0a1d16', '#e6f2ec', '#86a297', '#c9a85b', 'classic'],
  ['pearl', 'Pearl', 'luxury', 'l', '#f6f4f0', '#ebe7e0', '#232120', '#6c6862', '#9a7f6a', 'elegant'],
  ['onyx', 'Onyx', 'luxury', 'd', '#080808', '#121212', '#eeeeee', '#8f8f8f', '#c0c0c0', 'editorial'],
  ['rose-gold', 'Rose Gold', 'luxury', 'l', '#f7ede9', '#eddcd5', '#2a1d1a', '#74615b', '#a85d68', 'elegant'],

  ['concrete', 'Concrete', 'brutal', 'l', '#e4e2de', '#d6d3ce', '#111111', '#555350', '#d93200', 'brutal'],
  ['raw-black', 'Raw Black', 'brutal', 'd', '#000000', '#111111', '#ffffff', '#9a9a9a', '#ffea00', 'brutal'],
  ['blueprint', 'Blueprint', 'brutal', 'd', '#0a2a6b', '#10357f', '#eaf0ff', '#a9bce3', '#ffd23f', 'mono'],
  ['safety', 'Safety Orange', 'brutal', 'l', '#f2f2f0', '#e5e5e2', '#0d0d0d', '#5c5c5a', '#c84f00', 'brutal'],
  ['terminal', 'Terminal', 'brutal', 'd', '#000a00', '#001400', '#c8ffc8', '#6fbf6f', '#39ff14', 'mono'],
  ['xerox', 'Xerox', 'brutal', 'l', '#ededed', '#e0e0e0', '#000000', '#4f4f4f', '#0047ff', 'mono'],
  ['rebar', 'Rebar', 'brutal', 'd', '#1a1a1a', '#262626', '#f0f0f0', '#969696', '#ff2e63', 'brutal'],
  ['poster', 'Poster', 'brutal', 'l', '#fff8e7', '#f2ead5', '#111111', '#5a5547', '#d4002a', 'brutal'],

  ['helvetica-red', 'Helvetica Red', 'swiss', 'l', '#ffffff', '#f2f2f2', '#111111', '#5e5e5e', '#e30613', 'grotesk'],
  ['bauhaus', 'Bauhaus', 'swiss', 'l', '#f4efe4', '#e8e1d1', '#151515', '#5f5a50', '#0057b8', 'grotesk'],
  ['primary', 'Primary', 'swiss', 'd', '#111111', '#1c1c1c', '#f5f5f0', '#959590', '#ffcc00', 'grotesk'],
  ['grid-blue', 'Grid Blue', 'swiss', 'l', '#f5f7fa', '#e8ecf2', '#0f1a2b', '#56627a', '#1d4ed8', 'tech'],
  ['basel', 'Basel', 'swiss', 'd', '#121212', '#1e1e1e', '#f0efe9', '#93928c', '#00a676', 'grotesk'],
  ['ulm', 'Ulm', 'swiss', 'l', '#f2f2ee', '#e5e5df', '#1a1a1a', '#5f5f5a', '#d4580f', 'tech'],
  ['zurich', 'Zurich', 'swiss', 'd', '#0e1116', '#171b22', '#eceff4', '#8a909c', '#ff4d4d', 'grotesk'],
  ['kunsthalle', 'Kunsthalle', 'swiss', 'l', '#ebe8e1', '#ddd8ce', '#1d1b18', '#5d584f', '#6b3fa0', 'grotesk'],

  ['dawn', 'Dawn', 'pastel', 'l', '#fbf3ef', '#f2e5df', '#2b2120', '#6f5f5c', '#c4573c', 'soft'],
  ['lavender', 'Lavender', 'pastel', 'l', '#f5f2fb', '#e9e4f5', '#221d2e', '#625a74', '#6a48f0', 'soft'],
  ['mint', 'Mint', 'pastel', 'l', '#effaf5', '#ddf2e8', '#13261d', '#4f6b5d', '#0b8a6b', 'soft'],
  ['peach', 'Peach', 'pastel', 'l', '#fff3ea', '#fbe4d3', '#2b1d14', '#725d4f', '#d2541f', 'humanist'],
  ['cloud', 'Cloud', 'pastel', 'l', '#f4f6fb', '#e6eaf3', '#1b2030', '#5b6275', '#3e68e6', 'soft'],
  ['lilac-night', 'Lilac Night', 'pastel', 'd', '#16121f', '#201a2c', '#efe8fb', '#a499b8', '#c9a7ff', 'soft'],
  ['cotton', 'Cotton Candy', 'pastel', 'd', '#1a1718', '#252122', '#f5eef0', '#a69a9d', '#ffb3c7', 'soft'],
  ['butter', 'Butter', 'pastel', 'l', '#fffbea', '#f6efcf', '#26220f', '#6b6446', '#9a7600', 'humanist'],

  ['amber-crt', 'Amber CRT', 'retro', 'd', '#0c0700', '#170e00', '#ffd27a', '#b38a45', '#ffb000', 'retro'],
  ['green-crt', 'Green CRT', 'retro', 'd', '#010a04', '#03140a', '#b8ffcb', '#5fae78', '#33ff66', 'retro'],
  ['disco', 'Disco', 'retro', 'd', '#1a0b24', '#2a1238', '#fff0f8', '#b394c4', '#ff9f1c', 'retro'],
  ['vhs', 'VHS', 'retro', 'd', '#0f0d1a', '#1a1630', '#f2f0ff', '#9a95b8', '#ff4fa3', 'retro'],
  ['seventies', 'Seventies', 'retro', 'l', '#f6ead2', '#ecdbb8', '#2e1e0e', '#73603f', '#b84800', 'retro'],
  ['arcade-cab', 'Arcade Cabinet', 'retro', 'd', '#050510', '#0d0d24', '#f0f0ff', '#8e8eb0', '#00e5ff', 'retro'],
  ['polaroid', 'Polaroid', 'retro', 'l', '#f7f5f0', '#ece8df', '#222222', '#666360', '#d43f2d', 'humanist'],
  ['cassette', 'Cassette', 'retro', 'd', '#161412', '#211e1b', '#eee8de', '#a0978a', '#f2a541', 'retro'],

  ['nebula', 'Nebula', 'cosmic', 'd', '#0b0716', '#150e28', '#ece6ff', '#9a8fbf', '#b48cff', 'neo'],
  ['eclipse', 'Eclipse', 'cosmic', 'd', '#050505', '#0f0f0f', '#f2f2f2', '#8c8c8c', '#ff7b00', 'neo'],
  ['starlight', 'Starlight', 'cosmic', 'd', '#060a18', '#0d142b', '#e4ebff', '#8691b3', '#ffd76a', 'editorial'],
  ['mars', 'Mars', 'cosmic', 'd', '#170b08', '#24120d', '#f6e4dc', '#ae8b7f', '#ff5e3a', 'tech'],
  ['lunar', 'Lunar', 'cosmic', 'l', '#eceeef', '#dfe2e4', '#16191c', '#575d63', '#4f5f78', 'tech'],
  ['pulsar', 'Pulsar', 'cosmic', 'd', '#04060c', '#0a0f1c', '#e2f2ff', '#7f94ad', '#00d1ff', 'neo'],
  ['quasar', 'Quasar', 'cosmic', 'd', '#0d0412', '#1a0a22', '#fbe7ff', '#ac8ab8', '#ff00a8', 'neo'],
  ['orbit-white', 'Orbit White', 'cosmic', 'l', '#f7f8fa', '#eaedf1', '#10141b', '#535b68', '#3d5afe', 'tech'],

  ['sumi', 'Sumi', 'ink', 'l', '#f2efe8', '#e6e1d6', '#141414', '#5f5b53', '#b22222', 'japan'],
  ['washi', 'Washi', 'ink', 'l', '#f4efe3', '#e8e1d0', '#2a2620', '#6a6253', '#4a6f5a', 'japan'],
  ['kintsugi', 'Kintsugi', 'ink', 'd', '#121110', '#1c1b19', '#ece8df', '#9c968b', '#d6a84f', 'japan'],
  ['indigo-dye', 'Indigo Dye', 'ink', 'd', '#0b1022', '#121a33', '#e5e9f5', '#8b93ad', '#e8d5a3', 'japan'],
  ['mono-dark', 'Mono Dark', 'ink', 'd', '#0f0f0f', '#1a1a1a', '#e8e8e8', '#8a8a8a', '#ffffff', 'mono'],
  ['mono-light', 'Mono Light', 'ink', 'l', '#fafafa', '#eeeeee', '#111111', '#616161', '#000000', 'mono'],
  ['ink-wash', 'Ink Wash', 'ink', 'l', '#eeeeec', '#e0e0dd', '#1d1d1f', '#5e5e62', '#3a5a8c', 'classic'],
  ['charcoal', 'Charcoal', 'ink', 'd', '#1b1b1d', '#252528', '#e9e9ec', '#8e8e93', '#ff9f0a', 'mono'],
];

export const DEFAULT_THEME = 'abidora-night';

/* ---- colour maths (WCAG 2 contrast) ---- */
export function hexRgb(h: string): [number, number, number] { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export function rgbHex(r: number, g: number, b: number): string { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join(''); }
function lin(c: number) { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }
export function lum(h: string) { const [r, g, b] = hexRgb(h); return .2126 * lin(r) + .7152 * lin(g) + .0722 * lin(b); }
export function contrast(a: string, b: string) { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
export function mix(a: string, b: string, t: number) { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
/** move colour c toward `to` until it reaches the contrast target against bg */
export function ensure(c: string, bg: string, to: string, target: number) { let t = 0, out = c; while (contrast(out, bg) < target && t < 1) { t += .04; out = mix(c, to, Math.min(1, t)); } return out; }

export interface Theme { id: string; name: string; family: string; light: boolean; ink: string; ink2: string; bone: string; bone2: string; mute: string; signal: string; line: string; type: string }
export function theme(id: string): Theme {
  const r = THEMES.find((t) => t[0] === id) ?? THEMES[0];
  const [tid, name, family, mode, ink, ink2, bone, mute0, sig0, type] = r;
  const mute = ensure(mute0, ink, bone, 4.6), signal = ensure(sig0, ink, bone, 3.1);
  const [br, bg, bb] = hexRgb(bone);
  return { id: tid, name, family, light: mode === 'l', ink, ink2, bone, bone2: mix(bone, ink, .14), mute, signal, line: `rgba(${br},${bg},${bb},.16)`, type };
}
