/* Streetwear world, 3D drop preview: the graphic you make in the maker below is printed live onto a 3D tee, long
   sleeve or hoodie on a dress form, at a real print width (pocket, standard or oversized), so you can judge scale
   and placement before printing. */
import { garmentShow, SIZES, type Cut, type Fabric } from './garment3d';
import { THREE } from './show3d';
import { h, type Ctx } from './kit';

export function streetShow(ctx: Ctx) {
  const t = ctx.t;
  const G = garmentShow(ctx, { bg: '#101010', acc: '#ff4d2e', hint: t('st3.hint', 'Your graphic, printed live on the garment · drag to turn'), cut: 'tee', fabric: 'jersey', color: '#161616' });
  const S = G.S;
  let draw: ((g: CanvasRenderingContext2D, A: number) => void) | null = null, width = 28, raf = 0;
  const push = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; G.print(draw, width); }); };
  const gC = S.group(t('st3.cut', 'Blank')); const gF = S.group(t('st3.fab', 'Fabric')); const gW = S.group(t('st3.w', 'Print size'));
  const gZ = S.group(t('st3.size', 'Size')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  S.chips(gC, [['tee', t('c3.tee', 'T-shirt')], ['long', t('st3.long', 'Long sleeve')], ['hoodie', t('c3.hoodie', 'Hoodie')]], 'tee', (v) => { G.set({ cut: v as Cut }); push(); });
  S.chips(gF, [['jersey', t('st3.jersey', 'Cotton jersey, 180 gsm')], ['cotton', t('st3.heavy', 'Heavyweight cotton, 260 gsm')], ['wool', t('st3.fleece', 'Brushed fleece')]], 'jersey', (v) => G.set({ fabric: v as Fabric }));
  S.chips(gW, [['10', t('st3.pocket', 'Pocket 10 cm')], ['28', t('st3.std', 'Standard 28 cm')], ['36', t('st3.over', 'Oversized 36 cm')]], '28', (v) => { width = +v; push(); });
  const zn = h('p', { class: 's3-note' });
  const setZ = (s: string) => { zn.textContent = t('st3.zn', 'Size {s}: chest {c} cm around. The print keeps its real width, so it looks bigger on a small size.').replace('{s}', s).replace('{c}', String(SIZES[s])); };
  S.chips(gZ, Object.keys(SIZES).map((k) => [k, k]), 'M', (v) => { G.set({ size: v }); setZ(v); push(); }); setZ('M'); gZ.append(zn);
  S.chips(gV, [['front', t('vw.front', 'Front')], ['3/4', '3/4'], ['print', t('vw.print', 'Print close-up')], ['back', t('vw.back', 'Back')]], 'front', (v) => S.go(v));
  S.chips(gL, [['studio', t('l.studio', 'Studio')], ['street', t('l.street', 'Street night')], ['day', t('l.day', 'Daylight')]], 'studio', (n) => {
    const L = ({ studio: [1.1, 1, 2.4, 0x101010], street: [1, .45, 3.2, 0x0b0a14], day: [1.2, 1.3, 2.2, 0xdcd8d0] } as Record<string, number[]>)[n];
    S.renderer.toneMappingExposure = L[0]; S.scene.environmentIntensity = L[1]; S.key.intensity = L[2]; (S.scene.background as THREE.Color).set(L[3]); });
  S.rail.append(h('p', { class: 's3-note', text: t('st3.credit', 'Change the text, layout, inks or tee colour in the maker below and the 3D garment updates at once.') }));
  S.frame(new THREE.Vector3(0, 1.1, 0), [{ name: 'front', pos: [0, .15, 2.4] }, { name: '3/4', pos: [1.3, .3, 2.1] }, { name: 'print', pos: [.05, .12, .95] }, { name: 'back', pos: [-.6, .25, -2.3] }]);
  S.setLoading(null);
  return {
    art(fn: (g: CanvasRenderingContext2D, A: number) => void, tee: string) { draw = fn; G.set({ color: tee }); push(); },
  };
}
