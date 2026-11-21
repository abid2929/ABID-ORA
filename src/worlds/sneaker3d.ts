/* Sneaker World, 3D showroom: a real 3D sneaker (glTF, physically based materials) with its three factory
   colourways, a custom tint and finish on top, five camera views, three light moods, and true-to-size scale:
   pick an EU size and the shoe is scaled to that length in centimetres next to a 3D ruler.
   Model: "Materials Variants Shoe" © 2021 Shopify, CC BY 4.0 (Khronos glTF Sample Assets). */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { show3d, floor, THREE } from './show3d';
import { h, type Ctx } from './kit';
import { loadZones, attachZones, type ZonePack, type ZoneLook } from './scanzones';

const LIGHTS: Record<string, { exp: number; env: number; key: number; ki: number; rim: number; ri: number; bg: number }> = {
  studio: { exp: 1.1, env: 1, key: 0xffffff, ki: 2.4, rim: 0x9fc3e8, ri: 1.2, bg: 0x0f1013 },
  sunset: { exp: 1.1, env: .7, key: 0xffb27a, ki: 3, rim: 0x7aa2ff, ri: 1.6, bg: 0x1a0f0b },
  night: { exp: .9, env: .35, key: 0x9fb8ff, ki: 1.6, rim: 0xff5fa2, ri: 2.6, bg: 0x07080d },
};
/* EU sizing: the Paris point is 2/3 cm, so the shoe's inner length in cm = EU size x 2/3 (a common approximation) */
const lengthCm = (eu: number) => eu * 2 / 3;

export function sneakerShow(ctx: Ctx, root: string) {
  const t = ctx.t;
  const S = show3d(ctx, { bg: '#0f1013', acc: '#9fc3e8', hint: t('s3.hint2', 'Drag to turn · pinch, Ctrl + scroll or + / − to zoom · tap the numbered dots') });
  const { scene, renderer, key, rim } = S;
  floor(S, 0, 3, '#9fc3e8');

  /* a 40 cm ruler on the floor, with centimetre ticks drawn on its face */
  const rc = document.createElement('canvas'); rc.width = 2048; rc.height = 128; const g = rc.getContext('2d')!;
  g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 2048, 128); g.fillStyle = '#1d1b18'; g.font = '600 34px sans-serif';
  for (let mm = 0; mm <= 400; mm++) { const x = 24 + mm * 5; const L = mm % 10 === 0 ? 58 : mm % 5 === 0 ? 38 : 22; g.fillRect(x, 0, mm % 10 === 0 ? 3 : 2, L); if (mm % 50 === 0 && mm) g.fillText(String(mm / 10), x - 18, 104); }
  const rt = new THREE.CanvasTexture(rc); rt.colorSpace = THREE.SRGBColorSpace; rt.anisotropy = 8;
  const side = new THREE.MeshStandardMaterial({ color: 0xd9d3c7, roughness: .6 });
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(.41, .003, .025), [side, side, new THREE.MeshStandardMaterial({ map: rt, roughness: .6 }), side, side, side]);
  ruler.position.set(0, .0015, .085); ruler.receiveShadow = true; scene.add(ruler);

  const st = { variant: 0, light: 'studio', tint: '', finish: 'factory', size: 42 };
  /* parts of the real scan, each recolourable while the scan keeps its own grain and shading */
  let pack: ZonePack | null = null; let looks: ZoneLook[] = []; let selZ = 0;
  let shoe: THREE.Group | null = null, parser: any = null; const meshes: THREE.Mesh[] = []; let baseLen = 1, variants: string[] = [];

  const gC = S.group(t('cw', 'Colourway')); const gP = S.group(t('parts', 'Parts')); const gT = S.group(t('tint', 'Your tint')); const gF = S.group(t('fin', 'Finish'));
  const gS = S.group(t('size', 'Size (EU)')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  const lenNote = h('p', { class: 's3-note' }); gS.append(lenNote);

  async function apply() {
    for (const m of meshes) {
      const map = (m.userData.maps as { variants: number[]; material: number }[]).find((x) => x.variants.includes(st.variant));
      const base = (map ? await parser.getDependency('material', map.material) : m.userData.orig) as THREE.MeshStandardMaterial;
      const mt = base.clone() as THREE.MeshStandardMaterial;
      if (st.tint) mt.color.set(st.tint);
      if (st.finish === 'matte') { mt.roughness = 1; mt.roughnessMap = null; }
      let fin: THREE.MeshStandardMaterial = mt;
      if (st.finish === 'gloss') { const p = new THREE.MeshPhysicalMaterial(); p.copy(mt as any); p.clearcoat = .6; p.clearcoatRoughness = .18; fin = p; }
      if (st.finish === 'metal') { mt.metalness = .85; mt.roughness = .28; mt.metalnessMap = null; }
      if (pack) attachZones(fin, pack, looks, ({ midnight: 0, beach: 1, street: 2 } as Record<string, number>)[variants[st.variant]] ?? 0);
      m.material = fin;
    }
  }
  function setSize(eu: number) {
    st.size = eu; if (!shoe) return; const L = lengthCm(eu) / 100;
    shoe.scale.setScalar(L / baseLen); const b = new THREE.Box3().setFromObject(shoe); shoe.position.y -= b.min.y; shoe.position.x += -.2 - b.min.x; shoe.position.z -= (b.min.z + b.max.z) / 2;   // heel on the ruler's zero
    lenNote.textContent = t('len', 'Inner length ≈ {cm} cm. The shoe on the ruler is shown at this true length.').replace('{cm}', (L * 100).toFixed(1));
  }
  function setLight(n: string) { const L = LIGHTS[n]; st.light = n; renderer.toneMappingExposure = L.exp; scene.environmentIntensity = L.env; key.color.set(L.key); key.intensity = L.ki; rim.color.set(L.rim); rim.intensity = L.ri; (scene.background as THREE.Color).set(L.bg); }

  const partRow = h('div', { class: 's3-row' }), partBox = h('div'); gP.append(partRow, partBox);
  const PAL: [string, string][] = [['#f4f2ee', 'Chalk'], ['#1c1c1e', 'Black'], ['#8c8f94', 'Grey'], ['#24324a', 'Navy'], ['#2f93c9', 'Blue'], ['#7fb3d5', 'Sky'], ['#2f4a35', 'Forest'], ['#6f8f6a', 'Olive'], ['#c9a46b', 'Sand'], ['#8a5a34', 'Brown'], ['#c43b2f', 'Red'], ['#e07a3f', 'Orange'], ['#e8c547', 'Yellow'], ['#e7c3c1', 'Blush'], ['#7b4fa0', 'Purple']];
  function renderParts() {
    if (!pack) { gP.hidden = true; return; } gP.hidden = false;
    partRow.replaceChildren(...pack.zones.map((z, i) => { const dot = h('i', { class: 'fx-dot', style: { background: looks[i]?.color ?? z.hex[0] } });
      const b = h('button', { type: 'button', class: 's3-chip', 'aria-pressed': String(i === selZ) }, dot, document.createTextNode(' ' + t('zn.' + z.id, z.label))); b.onclick = () => { selZ = i; renderParts(); }; return b; }));
    const L = looks[selZ], row = h('div', { class: 's3-row', style: { marginTop: '10px' } });
    const orig = h('button', { type: 'button', class: 's3-chip', text: t('p.orig', 'Original'), 'aria-pressed': String(!L.color) }); orig.onclick = () => { L.color = null; void apply(); renderParts(); }; row.append(orig);
    for (const [c, n] of PAL) { const b = h('button', { type: 'button', class: 's3-sw', title: t('c.' + n.toLowerCase(), n), 'aria-label': t('c.' + n.toLowerCase(), n), 'aria-pressed': String(L.color === c) }); b.style.background = c; b.onclick = () => { L.color = c; void apply(); renderParts(); }; row.append(b); }
    const pick = h('input', { type: 'color', value: L.color ?? '#c9a46b', 'aria-label': t('p.own', 'Any colour for this part'), style: { width: '100%', height: '30px', marginTop: '8px', background: 'none', border: '0', cursor: 'pointer' } }) as HTMLInputElement;
    pick.oninput = () => { L.color = pick.value; void apply(); };
    pick.onchange = () => renderParts();
    const fin = h('div', { class: 's3-row', style: { marginTop: '8px' } });
    for (const [k, l] of [['factory', t('f.fac', 'Factory')], ['matte', t('f.matte', 'Matte')], ['satin', t('f.satin', 'Satin')], ['gloss', t('f.gloss', 'Gloss')]] as [ZoneLook['finish'], string][]) { const b = h('button', { type: 'button', class: 's3-chip', text: l, 'aria-pressed': String(L.finish === k) }); b.onclick = () => { L.finish = k; void apply(); renderParts(); }; fin.append(b); }
    const all = h('button', { type: 'button', class: 's3-chip', text: t('p.reset', 'All parts back to original') }); all.onclick = () => { looks = looks.map(() => ({ color: null, finish: 'factory' })); void apply(); renderParts(); };
    partBox.replaceChildren(row, pick, fin, h('div', { class: 's3-row', style: { marginTop: '8px' } }, all),
      h('p', { class: 's3-note', text: t('p.note', 'Each part keeps the real scan’s grain, stitching and shading; only its colour and finish change.') }));
  }
  gP.hidden = true;
  const zonesP = loadZones(root + 'assets/models/scans/sneaker-variants/').then((p) => { pack = p; looks = p.zones.map(() => ({ color: null, finish: 'factory' })); }).catch(() => { pack = null; });
  new GLTFLoader().load(root + 'assets/models/sneaker-variants.glb', async (gl) => {
    await zonesP; renderParts();
    parser = gl.parser; shoe = gl.scene; const json = parser.json;
    variants = (json.extensions?.KHR_materials_variants?.variants ?? []).map((v: { name: string }) => v.name);
    shoe.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
      const a = parser.associations.get(m); if (!a || a.meshes === undefined) return;
      const maps = json.meshes[a.meshes].primitives[a.primitives ?? 0]?.extensions?.KHR_materials_variants?.mappings; if (maps) { m.userData.maps = maps; m.userData.orig = m.material; meshes.push(m); } });
    /* the model's long axis is X: measure it once, then sizes scale from there */
    const b0 = new THREE.Box3().setFromObject(shoe), s0 = b0.getSize(new THREE.Vector3()); baseLen = Math.max(s0.x, s0.z);
    if (s0.z > s0.x) shoe.rotation.y = Math.PI / 2;
    scene.add(shoe); setSize(st.size);
    const b = new THREE.Box3().setFromObject(shoe), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3());
    key.target = shoe; key.shadow.camera.left = key.shadow.camera.bottom = -.4; key.shadow.camera.right = key.shadow.camera.top = .4; key.shadow.camera.updateProjectionMatrix();
    S.frame(c, [{ name: '3/4', pos: [.32, .16, .34] }, { name: 'side', pos: [0, .08, .5] }, { name: 'top', pos: [.01, .5, .02] }, { name: 'back', pos: [-.48, .12, 0] }, { name: 'sole', pos: [.16, -.32, .1] }]);
    S.spots([
      { label: t('sp1', 'Upper'), text: t('sp1t', 'Knit and suede panels. Each colourway swaps real colour and roughness maps, so suede stays matte and knit keeps its weave.'), at: new THREE.Vector3(c.x, b.min.y + sz.y * .55, c.z + sz.z * .3) },
      { label: t('sp2', 'Midsole'), text: t('sp2t', 'Foam with a soft sheen. Light wraps around its curve because it is lit by a real environment, not painted on.'), at: new THREE.Vector3(c.x + sz.x * .3, b.min.y + sz.y * .14, c.z + sz.z * .45) },
      { label: t('sp3', 'Laces'), text: t('sp3t', 'Separate geometry with depth. Zoom in: every lace casts its own shadow.'), at: new THREE.Vector3(c.x + sz.x * .12, b.min.y + sz.y * .66, c.z + sz.z * .1) },
    ]);
    const NAMES: Record<string, [string, string]> = { midnight: ['linear-gradient(135deg,#2f93c9 50%,#f3f2ee 50%)', t('v.mid', 'Midnight')], beach: ['linear-gradient(135deg,#e7c3c1 50%,#f3f2ee 50%)', t('v.beach', 'Beach')], street: ['linear-gradient(135deg,#2c2a2b 50%,#e0574e 50%)', t('v.street', 'Street')] };
    S.swatches(gC, variants.map((v, i) => [String(i), NAMES[v]?.[0] ?? '#888', NAMES[v]?.[1] ?? v]), '0', (v) => { st.variant = +v; void apply(); });
    await apply(); S.setLoading(null);
  }, undefined, () => S.setLoading(t('s3.fail', 'The 3D model could not load. Please refresh the page.')));

  S.swatches(gT, [['', 'conic-gradient(#e0574e,#e8b46a,#9fc3e8,#7bd389,#e0574e)', t('t.none', 'Factory colours')], ['#ffffff', '#f4f2ee', t('t.white', 'Chalk')], ['#c9a46b', '#c9a46b', t('t.sand', 'Sand')], ['#6f8f6a', '#6f8f6a', t('t.olive', 'Olive')], ['#7d93c9', '#7d93c9', t('t.blue', 'Sky')], ['#c96f6f', '#c96f6f', t('t.rose', 'Rose')], ['#3a3a3f', '#3a3a3f', t('t.coal', 'Coal')]], '', (v) => { st.tint = v; void apply(); });
  const tintIn = h('input', { type: 'color', value: '#c9a46b', 'aria-label': t('t.own', 'Pick your own tint'), style: { width: '100%', height: '30px', marginTop: '8px', background: 'none', border: '0', cursor: 'pointer' } }) as HTMLInputElement;
  tintIn.oninput = () => { st.tint = tintIn.value; void apply(); }; gT.append(tintIn);
  S.chips(gF, [['factory', t('f.fac', 'Factory')], ['matte', t('f.matte', 'Matte')], ['gloss', t('f.gloss', 'Gloss')], ['metal', t('f.metal', 'Metallic')]], 'factory', (v) => { st.finish = v; void apply(); });
  S.chips(gS, [36, 38, 40, 42, 44, 46].map((n) => [String(n), String(n)]), '42', (v) => setSize(+v));
  S.chips(gV, [['3/4', '3/4'], ['side', t('vw.side', 'Side')], ['top', t('vw.top', 'Top')], ['back', t('vw.back', 'Back')], ['sole', t('vw.sole', 'Sole')]], '3/4', (v) => S.go(v));
  S.chips(gL, [['studio', t('l.studio', 'Studio')], ['sunset', t('l.sunset', 'Sunset')], ['night', t('l.night', 'Night')]], 'studio', setLight);
  S.rail.append(h('p', { class: 's3-note', text: t('credit', '3D model: “Materials Variants Shoe” © 2021 Shopify, CC BY 4.0. Scanned product model; Abidora added the part map so you can recolour it (licence: creativecommons.org/licenses/by/4.0).') }));
  setLight('studio');
}
