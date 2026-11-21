/* Clothing world, 3D fitting room: a dress form wearing a garment built in code. Choose the cut, the fabric (each with
   its own weave relief, gloss and sheen), the colour, a woven or printed pattern and a size from XS to XL, whose chest
   measurement in centimetres sets the garment's true width. */
import { garmentShow, SIZES, type Cut, type Fabric } from './garment3d';
import { THREE } from './show3d';
import { h, type Ctx } from './kit';

const LIGHTS: Record<string, { exp: number; env: number; ki: number; bg: number }> = {
  atelier: { exp: 1.1, env: .8, ki: 1.6, bg: 0x17140f }, window: { exp: 1.15, env: 1.2, ki: 2.4, bg: 0xd9d3c8 }, runway: { exp: 1, env: .35, ki: 2.6, bg: 0x08080a },
};
const TONE: Record<string, [string, string]> = { atelier: ['#3a3128', '#1e1915'], window: ['#e6dfd2', '#b9ab98'], runway: ['#121214', '#0b0b0d'] };
export function clothShow(ctx: Ctx) {
  const t = ctx.t;
  const G = garmentShow(ctx, { bg: '#17140f', acc: '#e8b46a', hint: t('c3.hint', 'Drag to turn the dress form · pinch, Ctrl + scroll or + / − to zoom'), cut: 'tee', fabric: 'cotton', color: '#2f4a6b', room: true });
  const S = G.S;
  const gC = S.group(t('c3.cut', 'Garment')); const gF = S.group(t('c3.fabric', 'Fabric')); const gK = S.group(t('c3.colour', 'Colour'));
  const gP = S.group(t('c3.pattern', 'Pattern')); const gZ = S.group(t('c3.size', 'Size')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  const note = h('p', { class: 's3-note' });
  const fabNote = h('p', { class: 's3-note', style: { marginTop: '10px' } });
  const FN: Record<Fabric, string> = {
    cotton: t('f.cotton.t', 'Plain weave: threads cross one over, one under. Matte, breathable, a soft sheen at the edges.'),
    jersey: t('f.jersey.t', 'Knitted loops, not woven, so it stretches. The fabric of most T-shirts.'),
    denim: t('f.denim.t', 'Twill: each thread passes over two or more, which draws the diagonal lines. Indigo warp, white weft.'),
    silk: t('f.silk.t', 'Long smooth filaments reflect light in one direction, which gives silk its moving highlight.'),
    wool: t('f.wool.t', 'Fibres stand up from the knit and scatter light: a strong, soft halo (sheen) all over.'),
    linen: t('f.linen.t', 'Flax fibres of uneven thickness give a slubby, crisp plain weave that is cool to wear.'),
  };
  const setCut = S.chips(gC, [['tee', t('c3.tee', 'T-shirt')], ['long', t('c3.long', 'Sweater')], ['hoodie', t('c3.hoodie', 'Hoodie')], ['dress', t('c3.dress', 'Dress')]], 'tee', (v) => { G.set({ cut: v as Cut }); spots(); });
  void setCut;
  S.chips(gF, [['cotton', t('f.cotton', 'Cotton')], ['jersey', t('f.jersey', 'Jersey')], ['denim', t('f.denim', 'Denim')], ['silk', t('f.silk', 'Silk')], ['wool', t('f.wool', 'Wool knit')], ['linen', t('f.linen', 'Linen')]], 'cotton', (v) => { G.set({ fabric: v as Fabric }); fabNote.textContent = FN[v as Fabric]; });
  fabNote.textContent = FN.cotton; gF.append(fabNote);
  const COLS: [string, string][] = [['#2f4a6b', t('c.indigo', 'Indigo')], ['#f1ede4', t('c.ecru', 'Ecru')], ['#1b1b1d', t('c.black', 'Black')], ['#8e2a2a', t('c.brick', 'Brick')], ['#56663f', t('c.olive', 'Olive')], ['#c9a27a', t('c.camel', 'Camel')], ['#d8a7b1', t('c.rose', 'Dusty rose')], ['#e8c14a', t('c.mustard', 'Mustard')]];
  const setK = S.swatches(gK, COLS.map(([c, l]) => [c, c, l]), COLS[0][0], (v) => G.set({ color: v }));
  const pick = h('input', { type: 'color', value: COLS[0][0], 'aria-label': t('c3.own', 'Pick any colour'), style: { width: '100%', height: '34px', marginTop: '10px', background: 'none', border: '0', cursor: 'pointer' } }) as HTMLInputElement;
  pick.oninput = () => { setK(''); const lb = gK.querySelector('.l b'); if (lb) lb.textContent = pick.value; G.set({ color: pick.value }); }; gK.append(pick);
  S.chips(gP, [['solid', t('p.solid', 'Solid')], ['stripe', t('p.stripe', 'Breton stripe')], ['gingham', t('p.gingham', 'Gingham')], ['dots', t('p.dots', 'Polka dot')], ['pinstripe', t('p.pin', 'Pinstripe')]], 'solid', (v) => G.set({ pattern: v }));
  const gP2 = h('div', { style: { marginTop: '10px' } }); gP.append(gP2);
  S.swatches(gP2, [['#f2efe8', '#f2efe8', t('c.white', 'White')], ['#1b1b1d', '#1b1b1d', t('c.black', 'Black')], ['#b8402e', '#b8402e', t('c.red', 'Red')], ['#e8b46a', '#e8b46a', t('c.gold', 'Gold')]], '#f2efe8', (v) => G.set({ pcol: v }));
  const setNote = (s: string) => { note.textContent = t('c3.sz', 'Size {s}: chest {c} cm around, for a body of about {b} cm.').replace('{s}', s).replace('{c}', String(SIZES[s])).replace('{b}', String(SIZES[s] - 10)); };
  S.chips(gZ, Object.keys(SIZES).map((k) => [k, k]), 'M', (v) => { G.set({ size: v }); setNote(v); spots(); }); setNote('M'); gZ.append(note);
  S.chips(gV, [['3/4', '3/4'], ['front', t('vw.front', 'Front')], ['side', t('vw.side', 'Side')], ['back', t('vw.back', 'Back')], ['detail', t('vw.detail', 'Fabric close-up')]], '3/4', (v) => S.go(v));
  S.chips(gL, [['atelier', t('l.atelier', 'Atelier')], ['window', t('l.window', 'Shop window')], ['runway', t('l.runway', 'Runway')]], 'atelier', (n) => { const L = LIGHTS[n]; S.renderer.toneMappingExposure = L.exp; S.scene.environmentIntensity = L.env; S.key.intensity = L.ki; (S.scene.background as THREE.Color).set(L.bg); G.tone(...TONE[n]); });
  S.rail.append(h('p', { class: 's3-note', text: t('c3.credit', 'The garment and dress form are built in code, original to Abidora. Plan a week of outfits from your own rail below.') }));
  function spots() {
    const d = G.spotsFor();
    S.spots([
      { label: t('c3.s1', 'Rib collar'), text: t('c3.s1t', 'A knitted rib that stretches over the head and springs back.'), at: new THREE.Vector3(0, d.shoulderY + .05, d.a * .3) },
      { label: t('c3.s2', 'Fabric'), text: t('c3.s2t', 'The surface relief, gloss and sheen change with the fabric you pick. Zoom in to see the weave.'), at: new THREE.Vector3(d.a * .5, d.chestY - .08, d.a * .62) },
      { label: t('c3.s3', 'Hem'), text: t('c3.s3t', 'Length and shape of the hem follow the cut: straight for a tee, ribbed for a sweater, flared for a dress.'), at: new THREE.Vector3(-d.a * .6, d.hemY + .03, d.a * .55) },
    ]);
  }
  spots(); G.tone(...TONE.atelier); S.renderer.toneMappingExposure = LIGHTS.atelier.exp; S.scene.environmentIntensity = LIGHTS.atelier.env; S.key.intensity = LIGHTS.atelier.ki;
  S.controls.maxPolarAngle = Math.PI * .56;
  S.frame(new THREE.Vector3(0, .98, 0), [{ name: '3/4', pos: [1.5, .32, 2.9] }, { name: 'front', pos: [0, .15, 3.3] }, { name: 'side', pos: [3.2, .15, 0] }, { name: 'back', pos: [-.9, .2, -3] }, { name: 'detail', pos: [.28, .25, .62] }]);
  S.setLoading(null);
}
