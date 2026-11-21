/* Abidora Cursor Studio: 104 original cursors in 13 families, all drawn live on one canvas.
   Spec keys: s shape, z size px, w stroke px, c colour (signal | bone | rainbow | #hex), f filled, b blend (d difference | n normal),
   l follow speed 0-1, o spring overshoot 0-1, t trail, n trail length, r spin deg/frame, x velocity stretch, p pulse,
   k click effect, h hover scale, g glyph, a trail colour override */
export type Shape = 'dot' | 'ring' | 'ringdot' | 'cross' | 'plus' | 'square' | 'diamond' | 'tri' | 'hex' | 'star' | 'bracket' | 'blob' | 'beam' | 'glyph' | 'orbit' | 'reticle';
export type Trail = 'none' | 'line' | 'ribbon' | 'dots' | 'particles' | 'sparks' | 'ghost' | 'comet' | 'constellation' | 'rise' | 'fall';
export type Click = 'none' | 'ripple' | 'burst' | 'shrink' | 'rings';
export interface CursorSpec { s: Shape; z: number; w?: number; c?: string; f?: boolean; b?: 'd' | 'n'; l?: number; o?: number; t?: Trail; n?: number; r?: number; x?: number; p?: number; k?: Click; h?: number; g?: string; a?: string }
export type CursorRow = [string, string, string, CursorSpec];

export const CFAMILIES: [string, string][] = [
  ['essential', 'Essentials'], ['ink', 'Ink & Paper'], ['neon', 'Neon'], ['particle', 'Particles'], ['geometry', 'Geometry'],
  ['technical', 'Technical'], ['motion', 'Motion'], ['soft', 'Soft'], ['glyph', 'Glyphs'], ['minimal', 'Minimal'],
  ['bold', 'Bold'], ['space', 'Space'], ['playful', 'Playful'],
];

export const CURSORS: CursorRow[] = [
  ['pinpoint', 'Pinpoint', 'essential', { s: 'dot', z: 9, f: true, c: 'signal', l: .45, k: 'shrink', h: 2.2 }],
  ['halo', 'Halo', 'essential', { s: 'ring', z: 30, w: 1.5, c: 'bone', b: 'd', l: .18, k: 'ripple', h: 1.6 }],
  ['bullseye', 'Bullseye', 'essential', { s: 'ringdot', z: 30, w: 1.2, c: 'signal', l: .22, k: 'rings', h: 1.5 }],
  ['crosshair', 'Crosshair', 'essential', { s: 'cross', z: 26, w: 1.2, c: 'bone', b: 'd', l: .6, k: 'ripple', h: 1.3 }],
  ['plus-sign', 'Plus', 'essential', { s: 'plus', z: 18, w: 2, c: 'signal', l: .5, k: 'burst', h: 1.6 }],
  ['frame', 'Frame', 'essential', { s: 'square', z: 22, w: 1.5, c: 'bone', b: 'd', l: .25, r: 0, k: 'shrink', h: 1.7 }],
  ['diamond', 'Diamond', 'essential', { s: 'diamond', z: 20, w: 1.5, c: 'signal', l: .3, k: 'ripple', h: 1.6 }],
  ['soft-dot', 'Soft Dot', 'essential', { s: 'dot', z: 16, f: true, c: 'bone', b: 'd', l: .16, k: 'shrink', h: 3 }],

  ['ink-drop', 'Ink Drop', 'ink', { s: 'dot', z: 8, f: true, c: 'bone', l: .5, t: 'line', n: 26, k: 'ripple', h: 2 }],
  ['fountain-pen', 'Fountain Pen', 'ink', { s: 'dot', z: 5, f: true, c: 'signal', l: .7, t: 'ribbon', n: 34, k: 'burst', h: 2.4 }],
  ['charcoal', 'Charcoal', 'ink', { s: 'dot', z: 7, f: true, c: '#9a948a', l: .45, t: 'dots', n: 30, k: 'shrink', h: 2 }],
  ['stamp', 'Stamp', 'ink', { s: 'square', z: 14, f: true, c: 'signal', l: .3, k: 'rings', h: 1.8 }],
  ['brush', 'Brush', 'ink', { s: 'blob', z: 16, f: true, c: 'bone', b: 'd', l: .35, t: 'comet', n: 22, x: .6, k: 'shrink', h: 1.8 }],
  ['quill', 'Quill', 'ink', { s: 'tri', z: 14, f: true, c: 'bone', l: .4, t: 'line', n: 40, k: 'ripple', h: 1.5 }],
  ['calligraphy', 'Calligraphy', 'ink', { s: 'diamond', z: 10, f: true, c: 'signal', l: .55, t: 'ribbon', n: 50, k: 'shrink', h: 2 }],
  ['blot', 'Blot', 'ink', { s: 'blob', z: 22, f: true, c: 'bone', b: 'd', l: .2, p: .12, x: .4, k: 'burst', h: 1.7 }],

  ['neon-ring', 'Neon Ring', 'neon', { s: 'ring', z: 26, w: 2.5, c: '#ff3df2', l: .3, t: 'line', n: 18, k: 'rings', h: 1.5 }],
  ['laser', 'Laser', 'neon', { s: 'cross', z: 18, w: 1.5, c: '#ff2d2d', l: .8, t: 'line', n: 60, k: 'burst', h: 1.4 }],
  ['glowstick', 'Glowstick', 'neon', { s: 'beam', z: 22, w: 4, c: '#39ff88', l: .35, t: 'comet', n: 18, r: 2, k: 'ripple', h: 1.4 }],
  ['tube-light', 'Tube Light', 'neon', { s: 'ring', z: 34, w: 3, c: '#19e3ff', l: .2, p: .05, k: 'ripple', h: 1.4 }],
  ['pink-signal', 'Pink Signal', 'neon', { s: 'dot', z: 12, f: true, c: '#ff8ac6', l: .4, t: 'ribbon', n: 26, k: 'rings', h: 2.2 }],
  ['cyan-arc', 'Cyan Arc', 'neon', { s: 'orbit', z: 30, w: 2, c: '#19e3ff', l: .25, r: 6, k: 'burst', h: 1.5 }],
  ['night-sign', 'Night Sign', 'neon', { s: 'square', z: 20, w: 2.5, c: '#ffe600', l: .3, t: 'ghost', n: 8, r: 1.5, k: 'rings', h: 1.5 }],
  ['strobe', 'Strobe', 'neon', { s: 'ring', z: 24, w: 2, c: 'rainbow', l: .3, p: .25, k: 'rings', h: 1.5 }],

  ['stardust', 'Stardust', 'particle', { s: 'dot', z: 7, f: true, c: 'signal', l: .5, t: 'particles', n: 3, k: 'burst', h: 2 }],
  ['sparkler', 'Sparkler', 'particle', { s: 'dot', z: 6, f: true, c: '#ffd76a', l: .6, t: 'sparks', n: 4, k: 'burst', h: 2 }],
  ['pollen', 'Pollen', 'particle', { s: 'dot', z: 8, f: true, c: '#f4e35a', l: .25, t: 'particles', n: 1, k: 'burst', h: 2 }],
  ['ember', 'Ember', 'particle', { s: 'dot', z: 7, f: true, c: '#ff6b3d', l: .45, t: 'rise', n: 2, k: 'burst', h: 2 }],
  ['snowfall', 'Snowfall', 'particle', { s: 'star', z: 12, w: 1.2, c: 'bone', l: .3, t: 'fall', n: 2, r: 1, k: 'burst', h: 1.6 }],
  ['bubbles', 'Bubbles', 'particle', { s: 'ring', z: 18, w: 1.2, c: '#7fc8d8', l: .25, t: 'rise', n: 1, k: 'rings', h: 1.6 }],
  ['confetti', 'Confetti', 'particle', { s: 'square', z: 10, f: true, c: 'rainbow', l: .4, t: 'particles', n: 3, r: 4, k: 'burst', h: 1.8 }],
  ['fireflies', 'Fireflies', 'particle', { s: 'dot', z: 6, f: true, c: '#e8ff7a', l: .2, t: 'particles', n: 1, p: .2, k: 'burst', h: 2.2 }],

  ['triangle', 'Triangle', 'geometry', { s: 'tri', z: 22, w: 1.6, c: 'bone', b: 'd', l: .3, k: 'ripple', h: 1.6 }],
  ['hexagon', 'Hexagon', 'geometry', { s: 'hex', z: 26, w: 1.5, c: 'signal', l: .25, r: .6, k: 'rings', h: 1.5 }],
  ['star', 'Star', 'geometry', { s: 'star', z: 22, w: 1.5, c: 'signal', l: .3, r: 1, k: 'burst', h: 1.6 }],
  ['spin-square', 'Spinning Square', 'geometry', { s: 'square', z: 20, w: 1.6, c: 'bone', b: 'd', l: .3, r: 3, k: 'shrink', h: 1.6 }],
  ['orbit', 'Orbit', 'geometry', { s: 'orbit', z: 32, w: 1.2, c: 'bone', b: 'd', l: .22, r: 4, k: 'rings', h: 1.5 }],
  ['tri-spin', 'Tri Spin', 'geometry', { s: 'tri', z: 20, w: 1.6, c: 'signal', l: .3, r: 3, k: 'burst', h: 1.6 }],
  ['compass', 'Compass', 'geometry', { s: 'cross', z: 30, w: 1.2, c: 'bone', b: 'd', l: .25, r: 1.2, k: 'ripple', h: 1.4 }],
  ['prism', 'Prism', 'geometry', { s: 'diamond', z: 22, w: 1.5, c: 'rainbow', l: .3, r: 1.5, k: 'rings', h: 1.6 }],

  ['blueprint-cross', 'Blueprint Cross', 'technical', { s: 'cross', z: 40, w: .8, c: '#9ecbff', l: 1, k: 'ripple', h: 1.2 }],
  ['coordinates', 'Coordinates', 'technical', { s: 'reticle', z: 30, w: 1, c: 'bone', b: 'd', l: .6, k: 'ripple', h: 1.3 }],
  ['brackets', 'Brackets', 'technical', { s: 'bracket', z: 28, w: 1.6, c: 'bone', b: 'd', l: .3, k: 'shrink', h: 1.5 }],
  ['target-lock', 'Target Lock', 'technical', { s: 'bracket', z: 30, w: 1.6, c: 'signal', l: .25, r: 1.5, k: 'rings', h: 1.3 }],
  ['scanner', 'Scanner', 'technical', { s: 'ring', z: 28, w: 1.2, c: '#39ff88', l: .3, p: .18, k: 'rings', h: 1.5 }],
  ['grid-snap', 'Grid Snap', 'technical', { s: 'square', z: 16, w: 1.4, c: 'signal', l: 1, t: 'ghost', n: 5, k: 'shrink', h: 1.6 }],
  ['radar', 'Radar', 'technical', { s: 'orbit', z: 36, w: 1, c: '#39ff88', l: .3, r: 5, k: 'rings', h: 1.3 }],
  ['reticle', 'Reticle', 'technical', { s: 'reticle', z: 36, w: 1.2, c: 'signal', l: .4, k: 'burst', h: 1.3 }],

  ['comet', 'Comet', 'motion', { s: 'dot', z: 10, f: true, c: 'signal', l: .35, t: 'comet', n: 30, k: 'burst', h: 2 }],
  ['elastic', 'Elastic', 'motion', { s: 'dot', z: 18, f: true, c: 'bone', b: 'd', l: .2, o: .55, x: 1.2, k: 'shrink', h: 2 }],
  ['jelly', 'Jelly', 'motion', { s: 'blob', z: 24, f: true, c: 'signal', l: .18, o: .5, x: 1, k: 'burst', h: 1.7 }],
  ['ghost', 'Lagging Ghost', 'motion', { s: 'ring', z: 22, w: 1.5, c: 'bone', b: 'd', l: .25, t: 'ghost', n: 10, k: 'ripple', h: 1.6 }],
  ['whip', 'Whip', 'motion', { s: 'dot', z: 6, f: true, c: 'bone', l: .8, t: 'line', n: 80, k: 'burst', h: 2.4 }],
  ['bounce', 'Bounce', 'motion', { s: 'ringdot', z: 24, w: 1.5, c: 'signal', l: .2, o: .7, k: 'rings', h: 1.5 }],
  ['drift', 'Drift', 'motion', { s: 'ring', z: 34, w: 1, c: 'bone', b: 'd', l: .06, k: 'ripple', h: 1.4 }],
  ['snappy', 'Snappy', 'motion', { s: 'square', z: 10, f: true, c: 'signal', l: 1, k: 'shrink', h: 2.2 }],

  ['bubble', 'Bubble', 'soft', { s: 'ring', z: 36, w: 1, c: '#bfe6ff', l: .15, p: .06, k: 'ripple', h: 1.3 }],
  ['cloud', 'Cloud', 'soft', { s: 'blob', z: 30, f: true, c: 'bone', b: 'd', l: .12, p: .05, k: 'shrink', h: 1.5 }],
  ['pebble', 'Pebble', 'soft', { s: 'blob', z: 16, f: true, c: '#a49d92', l: .3, k: 'shrink', h: 1.8 }],
  ['petal', 'Petal', 'soft', { s: 'diamond', z: 14, f: true, c: '#ffb3c7', l: .25, t: 'fall', n: 1, k: 'burst', h: 1.8 }],
  ['marshmallow', 'Marshmallow', 'soft', { s: 'dot', z: 28, f: true, c: '#f5eef0', b: 'd', l: .14, x: .5, k: 'shrink', h: 1.6 }],
  ['soap', 'Soap Ring', 'soft', { s: 'ring', z: 26, w: 2, c: 'rainbow', l: .2, k: 'rings', h: 1.4 }],
  ['feather', 'Feather', 'soft', { s: 'dot', z: 5, f: true, c: 'bone', l: .12, t: 'ribbon', n: 40, k: 'ripple', h: 2.4 }],
  ['mist', 'Mist', 'soft', { s: 'dot', z: 22, f: true, c: '#cfd8dc', l: .2, t: 'ghost', n: 12, k: 'ripple', h: 1.6 }],

  ['sparkle', 'Sparkle', 'glyph', { s: 'glyph', g: '✦', z: 22, c: 'signal', l: .35, r: 1, k: 'burst', h: 1.5 }],
  ['asterisk', 'Asterisk', 'glyph', { s: 'glyph', g: '✱', z: 22, c: 'bone', l: .35, r: 2, k: 'burst', h: 1.5 }],
  ['note', 'Note', 'glyph', { s: 'glyph', g: '♪', z: 24, c: 'signal', l: .3, t: 'rise', n: 1, k: 'burst', h: 1.4 }],
  ['arrowhead', 'Arrowhead', 'glyph', { s: 'glyph', g: '➤', z: 20, c: 'bone', l: .5, k: 'shrink', h: 1.4 }],
  ['sun', 'Sun', 'glyph', { s: 'glyph', g: '☼', z: 26, c: '#ffd76a', l: .3, r: 1.5, k: 'rings', h: 1.4 }],
  ['moon', 'Moon', 'glyph', { s: 'glyph', g: '☾', z: 26, c: '#e4ebff', l: .25, k: 'ripple', h: 1.4 }],
  ['ora', 'Ora', 'glyph', { s: 'glyph', g: '◎', z: 26, c: 'signal', l: .3, k: 'rings', h: 1.5 }],
  ['flower', 'Flower', 'glyph', { s: 'glyph', g: '✿', z: 24, c: '#ff8ac6', l: .3, r: 1, k: 'burst', h: 1.5 }],

  ['hairline', 'Hairline', 'minimal', { s: 'ring', z: 24, w: .8, c: 'bone', b: 'd', l: .25, k: 'ripple', h: 1.6 }],
  ['micro', 'Micro Dot', 'minimal', { s: 'dot', z: 4, f: true, c: 'bone', b: 'd', l: .7, k: 'shrink', h: 3 }],
  ['ghost-ring', 'Ghost Ring', 'minimal', { s: 'ring', z: 40, w: .8, c: '#8d877d', l: .12, k: 'ripple', h: 1.3 }],
  ['mono-square', 'Mono Square', 'minimal', { s: 'square', z: 8, f: true, c: 'bone', b: 'd', l: .5, k: 'shrink', h: 2.4 }],
  ['whisper', 'Whisper', 'minimal', { s: 'dot', z: 6, f: true, c: '#8d877d', l: .3, k: 'shrink', h: 2.4 }],
  ['pin', 'Pin', 'minimal', { s: 'ringdot', z: 14, w: 1, c: 'bone', b: 'd', l: .5, k: 'shrink', h: 1.8 }],
  ['beam', 'Beam', 'minimal', { s: 'beam', z: 22, w: 1.5, c: 'bone', b: 'd', l: .6, k: 'shrink', h: 1.4 }],
  ['point', 'Point', 'minimal', { s: 'plus', z: 10, w: 1.2, c: 'bone', b: 'd', l: .6, k: 'shrink', h: 1.8 }],

  ['big-ring', 'Big Ring', 'bold', { s: 'ring', z: 64, w: 1.5, c: 'bone', b: 'd', l: .16, k: 'ripple', h: 1.3 }],
  ['spotlight', 'Spotlight', 'bold', { s: 'dot', z: 90, f: true, c: '#ffffff', b: 'd', l: .14, k: 'shrink', h: 1.3 }],
  ['inverter', 'Inverter', 'bold', { s: 'dot', z: 40, f: true, c: '#ffffff', b: 'd', l: .3, k: 'shrink', h: 1.6 }],
  ['block', 'Block', 'bold', { s: 'square', z: 34, f: true, c: '#ffffff', b: 'd', l: .25, k: 'shrink', h: 1.5 }],
  ['monolith', 'Monolith', 'bold', { s: 'beam', z: 44, w: 10, c: 'signal', l: .3, k: 'burst', h: 1.3 }],
  ['eclipse', 'Eclipse', 'bold', { s: 'ring', z: 46, w: 8, c: 'signal', l: .2, k: 'rings', h: 1.3 }],
  ['magnet', 'Magnet', 'bold', { s: 'ringdot', z: 30, w: 2, c: 'signal', l: .25, k: 'ripple', h: 2.6 }],
  ['billboard', 'Billboard', 'bold', { s: 'square', z: 48, w: 3, c: 'bone', b: 'd', l: .2, k: 'rings', h: 1.4 }],

  ['planet', 'Planet', 'space', { s: 'orbit', z: 34, w: 1.4, c: '#ffd76a', l: .2, r: 3, k: 'rings', h: 1.4 }],
  ['satellite', 'Satellite', 'space', { s: 'plus', z: 16, w: 2, c: '#e4ebff', l: .3, r: 2, t: 'dots', n: 16, k: 'burst', h: 1.6 }],
  ['black-hole', 'Black Hole', 'space', { s: 'ring', z: 30, w: 5, c: '#ff7b00', l: .2, t: 'particles', n: 2, p: .08, k: 'rings', h: 1.4 }],
  ['pulsar', 'Pulsar', 'space', { s: 'ringdot', z: 24, w: 1.5, c: '#00d1ff', l: .3, p: .3, k: 'rings', h: 1.5 }],
  ['nebula', 'Nebula', 'space', { s: 'dot', z: 10, f: true, c: 'rainbow', l: .3, t: 'particles', n: 3, k: 'burst', h: 2 }],
  ['meteor', 'Meteor', 'space', { s: 'dot', z: 9, f: true, c: '#ffb46a', l: .6, t: 'comet', n: 40, k: 'burst', h: 2 }],
  ['moonwalk', 'Moonwalk', 'space', { s: 'ring', z: 20, w: 1.2, c: '#e4ebff', l: .1, t: 'ghost', n: 14, k: 'ripple', h: 1.6 }],
  ['constellation', 'Constellation', 'space', { s: 'star', z: 12, w: 1.2, c: '#ffd76a', l: .4, t: 'constellation', n: 14, k: 'burst', h: 1.8 }],

  ['ripple', 'Ripple', 'playful', { s: 'dot', z: 12, f: true, c: 'signal', l: .4, k: 'rings', h: 2.2 }],
  ['pop', 'Pop', 'playful', { s: 'ring', z: 20, w: 2, c: 'rainbow', l: .35, k: 'burst', h: 1.7 }],
  ['wobble', 'Wobble', 'playful', { s: 'blob', z: 26, f: true, c: '#c9a7ff', l: .2, o: .4, x: .8, p: .1, k: 'burst', h: 1.6 }],
  ['rainbow', 'Rainbow', 'playful', { s: 'dot', z: 10, f: true, c: 'rainbow', l: .45, t: 'ribbon', n: 40, k: 'burst', h: 2 }],
  ['gummy', 'Gummy', 'playful', { s: 'square', z: 20, f: true, c: '#ff8ac6', l: .22, o: .6, x: 1, k: 'shrink', h: 1.6 }],
  ['boing', 'Boing', 'playful', { s: 'ring', z: 24, w: 3, c: 'signal', l: .2, o: .8, p: .1, k: 'rings', h: 1.6 }],
  ['yoyo', 'Yo-yo', 'playful', { s: 'ringdot', z: 20, w: 2, c: 'bone', b: 'd', l: .08, o: .85, k: 'burst', h: 1.6 }],
  ['kaleido', 'Kaleido', 'playful', { s: 'hex', z: 20, w: 1.6, c: 'rainbow', l: .3, r: 2, t: 'particles', n: 2, k: 'burst', h: 1.6 }],
];

export const cursorById = (id: string) => CURSORS.find((c) => c[0] === id);
