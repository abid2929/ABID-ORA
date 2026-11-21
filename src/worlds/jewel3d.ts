/* Jewelry world, 3D ring atelier: a faceted gem cut in code from real proportions (table, crown, girdle, pavilion,
   culet), rendered with refraction (index of refraction per stone), colour absorption and dispersion (fire), set in
   prongs on a band whose inner diameter follows real ring sizes. Carat weight sets the stone's true diameter.
   Units: the model is built in millimetres and shown 10x (1 mm = 1 scene cm) so the camera can come close. */
import { show3d, floor, THREE } from './show3d';
import { h, type Ctx } from './kit';

const MM = .01;
const GEMS: Record<string, { col: number; ior: number; disp: number; att: number; name: string; sg: number }> = {
  diamond: { col: 0xffffff, ior: 2.42, disp: .9, att: 1e9, name: 'Diamond', sg: 3.52 },
  ruby: { col: 0xd0102e, ior: 1.77, disp: .25, att: 2.2, name: 'Ruby', sg: 4.0 },
  sapphire: { col: 0x1d47c8, ior: 1.77, disp: .25, att: 2.2, name: 'Sapphire', sg: 4.0 },
  emerald: { col: 0x0f9a55, ior: 1.58, disp: .18, att: 2.6, name: 'Emerald', sg: 2.72 },
  morganite: { col: 0xf3a9a4, ior: 1.59, disp: .2, att: 5, name: 'Morganite', sg: 2.8 },
};
const METALS: Record<string, [number, number]> = { yellow: [0xe3b85e, .16], rose: [0xe7a68c, .16], white: [0xe4e6ea, .12], platinum: [0xd2d4d6, .2] };
const LIGHTS: Record<string, { exp: number; env: number; key: number; ki: number; rim: number; ri: number; bg: number }> = {
  vitrine: { exp: 1.1, env: 1.5, key: 0xffffff, ki: 2.6, rim: 0xc9dbff, ri: 1.4, bg: 0x30343c },
  candle: { exp: 1, env: .8, key: 0xffb26b, ki: 3, rim: 0xff8a5c, ri: 1.2, bg: 0x140c08 },
  daylight: { exp: 1.05, env: 1.6, key: 0xffffff, ki: 2, rim: 0xffffff, ri: .6, bg: 0xe6e3de },
};
/* US ring size to inner diameter in mm (the standard linear rule) */
const usDia = (us: number) => 11.63 + .8128 * us;
/* carat to diameter of a round brilliant: 1 ct ≈ 6.5 mm, weight grows with the cube of the size */
const ctDia = (ct: number) => 6.5 * Math.cbrt(ct);

/* A brilliant-style stone from rings of points. shape: p = superellipse exponent (2 round, 6 square), sx = length/width */
function gemGeometry(d: number, sx: number, p: number) {
  const N = 16, R = d / 2, pos: number[] = [];
  const pt = (k: number, off: number, r: number, y: number) => { const a = (k + off) / N * Math.PI * 2 + Math.PI / N * (p > 2 ? 1 : 0), c = Math.cos(a), s = Math.sin(a);
    const se = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(s), p), -1 / p); return new THREE.Vector3(c * se * r * R * sx, y * d, s * se * r * R); };
  /* proportions after Tolkowsky: table 53-57 %, crown 16 % of diameter, girdle 3 %, pavilion 43 % */
  const rings = [
    { r: 0, y: .162, off: 0 }, { r: .56, y: .162, off: 0 }, { r: .82, y: .095, off: .5 }, { r: 1, y: .015, off: 0 }, { r: 1, y: -.015, off: 0 },
    { r: .55, y: -.24, off: .5 }, { r: 0, y: -.43, off: 0 },
  ];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i], B = rings[i + 1];
    for (let k = 0; k < N; k++) {
      const a0 = pt(k, A.off, A.r, A.y), a1 = pt(k + 1, A.off, A.r, A.y), b0 = pt(k, B.off, B.r, B.y), b1 = pt(k + 1, B.off, B.r, B.y);
      if (A.r === 0) { tri(a0, b1, b0); continue; } if (B.r === 0) { tri(a0, a1, b0); continue; }
      if (A.off === B.off) { tri(a0, a1, b0); tri(a1, b1, b0); }
      else if (B.off > A.off) { const bm = pt(k - 1, B.off, B.r, B.y); tri(a0, b0, bm); tri(a0, a1, b0); }
      else { const am = pt(k - 1, A.off, A.r, A.y); tri(am, a0, b0); tri(a0, b1, b0); }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  /* make sure every face points outward */
  const P = g.attributes.position, n = new THREE.Vector3(), c = new THREE.Vector3(), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (let i = 0; i < P.count; i += 3) { for (let j = 0; j < 3; j++) v[j].fromBufferAttribute(P, i + j);
    n.subVectors(v[1], v[0]).cross(c.subVectors(v[2], v[0])); const m = v[0].clone().add(v[1]).add(v[2]).divideScalar(3);
    if (n.dot(m) < 0) { P.setXYZ(i + 1, v[2].x, v[2].y, v[2].z); P.setXYZ(i + 2, v[1].x, v[1].y, v[1].z); } }
  g.computeVertexNormals(); return g;
}

export function jewelShow(ctx: Ctx) {
  const t = ctx.t;
  const S = show3d(ctx, { bg: '#0d0e12', acc: '#c9dbff', hint: t('j3.hint', 'Drag to turn the ring · pinch, Ctrl + scroll or + / − to zoom · watch the fire move') });
  const { scene, renderer, key, rim } = S;
  floor(S, 0, 2, '#c9dbff');
  const st = { gem: 'diamond', cut: 'round', ct: 1, metal: 'platinum', us: 7, prongs: 6 };
  const ring = new THREE.Group(); scene.add(ring);
  const gemMat = new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0, transmission: .96, thickness: 1.6, flatShading: true, specularIntensity: 1, envMapIntensity: 2.2 });
  const metalMat = new THREE.MeshPhysicalMaterial({ metalness: 1, clearcoat: .3, clearcoatRoughness: .1 });
  const note = h('p', { class: 's3-note' });

  function paint() {
    const G = GEMS[st.gem]; gemMat.ior = G.ior; gemMat.dispersion = G.disp; gemMat.color.set(0xffffff);
    gemMat.attenuationColor.set(G.col); gemMat.attenuationDistance = G.att * MM * 10; gemMat.needsUpdate = true;
    const M = METALS[st.metal]; metalMat.color.set(M[0]); metalMat.roughness = M[1];
  }
  let gemY = 0;
  function build() {
    ring.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); ring.clear();
    const id = usDia(st.us), bandW = 2.2, bandT = 1.7, R = (id / 2 + bandT / 2) * MM;
    /* comfort-fit band: a torus flattened across the finger */
    const band = new THREE.Mesh(new THREE.TorusGeometry(R, bandT / 2 * MM, 32, 160), metalMat); band.scale.z = bandW / bandT; band.castShadow = true; ring.add(band);
    const cut = { round: [1, 2], oval: [1.38, 2], cushion: [1, 3.2], princess: [1, 7] }[st.cut] as [number, number];
    const d = ctDia(st.ct) * (st.cut === 'oval' ? .85 : st.cut === 'princess' ? .86 : .95) * GEMS.diamond.sg / GEMS[st.gem].sg ** .9 * .98;
    const D = Math.min(d, 11);
    const gem = new THREE.Mesh(gemGeometry(D * MM, cut[0], cut[1]), gemMat); gem.castShadow = true;
    const top = R + bandT / 2 * MM; gemY = top + (.43 * D + 1.2) * MM; gem.position.y = gemY; gem.rotation.y = Math.PI / 2; ring.add(gem);
    /* prongs: claws from the band up the pavilion, bending over the girdle */
    const n = st.cut === 'princess' ? 4 : st.prongs; const pr = Math.max(.42, D * .07) * MM;
    for (let i = 0; i < n; i++) {
      const a = (i + .5) / n * Math.PI * 2, c0 = Math.cos(a), s0 = Math.sin(a), pe = cut[1], se = Math.pow(Math.pow(Math.abs(c0), pe) + Math.pow(Math.abs(s0), pe), -1 / pe);
      const ex = c0 * se * D / 2 * MM, ez = s0 * se * D / 2 * MM * cut[0];   /* the stone is turned 90°, so an oval's length runs along z */
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(ex * .25, top - .3 * MM, ez * .25), new THREE.Vector3(ex * .55, gemY - .3 * D * MM, ez * .55), new THREE.Vector3(ex * 1.02, gemY + .1 * MM, ez * 1.02), new THREE.Vector3(ex * .9, gemY + .5 * MM, ez * .9)]);
      const p = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, pr, 10), metalMat); p.castShadow = true; ring.add(p);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(pr * 1.05, 14, 10), metalMat); tip.position.copy(curve.getPoint(1)); ring.add(tip);
    }
    const basket = new THREE.Mesh(new THREE.TorusGeometry(D * .3 * MM, pr * .8, 10, 48), metalMat); basket.rotation.x = Math.PI / 2; basket.position.y = gemY - .26 * D * MM; ring.add(basket);
    ring.position.y = 0; ring.rotation.set(0, 0, 0);
    /* stand the ring on its band */
    const b = new THREE.Box3().setFromObject(ring); ring.position.y = -b.min.y;
    note.textContent = t('j3.note', 'US {us} (EU {eu}): inner diameter {id} mm. {ct} ct {gem}: about {d} mm across.').replace('{us}', String(st.us)).replace('{eu}', (Math.PI * id).toFixed(0))
      .replace('{id}', id.toFixed(1)).replace('{ct}', String(st.ct)).replace('{gem}', t('g.' + st.gem, GEMS[st.gem].name).toLowerCase()).replace('{d}', D.toFixed(1));
    const gy = gemY - b.min.y;
    S.spots([
      { label: t('j3.s1', 'Table and fire'), text: t('j3.s1t', 'The flat top facet, about 55 % of the width. Light enters here and comes back out here too, split into colours by dispersion: that is the fire you see as it turns.'), at: new THREE.Vector3(0, gy + .162 * D * MM, 0) },
      { label: t('j3.s2', 'Pavilion'), text: t('j3.s2t', 'The lower cone. At about 41° light hits it beyond the critical angle (24.4° for diamond, from Snell’s law) and is reflected back up: that is brilliance.'), at: new THREE.Vector3(0, gy - .3 * D * MM, D * .32 * MM) },
      { label: t('j3.s4', 'Prongs'), text: t('j3.s4t', 'Claws that hold the stone by its girdle while letting light in from the sides.'), at: new THREE.Vector3(Math.cos(Math.PI / n) * D * .5 * MM, gy, Math.sin(Math.PI / n) * D * .5 * MM) },
    ]);
  }
  function setLight(n: string) { const L = LIGHTS[n]; renderer.toneMappingExposure = L.exp; scene.environmentIntensity = L.env; key.color.set(L.key); key.intensity = L.ki; rim.color.set(L.rim); rim.intensity = L.ri; (scene.background as THREE.Color).set(L.bg); }
  /* turning the environment slowly makes facets catch and lose the light, like moving a ring under a lamp */
  let spin = !ctx.calm;
  S.onTick((dt) => { if (spin) scene.environmentRotation.y += dt * .35; });

  const gG = S.group(t('j3.gem', 'Stone')); const gC = S.group(t('j3.cut', 'Cut')); const gK = S.group(t('j3.ct', 'Carat'));
  const gM = S.group(t('j3.metal', 'Metal')); const gZ = S.group(t('j3.size', 'Ring size (US)')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  S.swatches(gG, Object.entries(GEMS).map(([k, g]) => [k, k === 'diamond' ? 'radial-gradient(circle at 35% 30%,#fff,#cfe3ff 45%,#8fa6c8)' : `radial-gradient(circle at 35% 30%,#fff8,#${g.col.toString(16).padStart(6, '0')} 55%)`, t('g.' + k, g.name)]), st.gem, (v) => { st.gem = v; paint(); build(); });
  S.chips(gC, [['round', t('c.round', 'Round brilliant')], ['oval', t('c.oval', 'Oval')], ['cushion', t('c.cushion', 'Cushion')], ['princess', t('c.princess', 'Princess')]], st.cut, (v) => { st.cut = v; build(); });
  S.chips(gK, [['0.5', '0.5'], ['1', '1'], ['1.5', '1.5'], ['2', '2'], ['3', '3']], '1', (v) => { st.ct = +v; build(); });
  S.chips(gM, [['platinum', t('m.plat', 'Platinum')], ['white', t('m.white', 'White gold')], ['yellow', t('m.yellow', 'Yellow gold')], ['rose', t('m.rose', 'Rose gold')]], st.metal, (v) => { st.metal = v; paint(); });
  const gP = h('div', { style: { marginTop: '12px' } }); gM.append(gP);
  S.chips(gP, [['4', t('j3.p4', '4 prongs')], ['6', t('j3.p6', '6 prongs')]], '6', (v) => { st.prongs = +v; build(); });
  S.chips(gZ, [5, 6, 7, 8, 9, 10].map((n) => [String(n), String(n)]), '7', (v) => { st.us = +v; build(); }); gZ.append(note);
  S.chips(gV, [['3/4', '3/4'], ['top', t('vw.top', 'From above')], ['side', t('vw.side', 'Side')], ['macro', t('vw.macro', 'Close-up')]], '3/4', (v) => S.go(v));
  S.chips(gL, [['vitrine', t('l.vitrine', 'Vitrine')], ['candle', t('l.candle', 'Candlelight')], ['daylight', t('l.day', 'Daylight')]], 'vitrine', setLight);
  const sp = h('button', { class: 's3-chip', type: 'button', text: t('j3.spin', 'Move the light'), 'aria-pressed': String(spin), style: { marginTop: '10px' } });
  sp.onclick = () => { spin = !spin; sp.setAttribute('aria-pressed', String(spin)); }; gL.append(sp);
  S.rail.append(h('p', { class: 's3-note', text: t('j3.credit', 'Stone, prongs and band are built in code from real proportions. Explore the physics of light inside a gem in the lab below.') }));

  paint(); build(); setLight('vitrine');
  key.target = ring; key.shadow.camera.left = key.shadow.camera.bottom = -.25; key.shadow.camera.right = key.shadow.camera.top = .25; key.shadow.camera.updateProjectionMatrix();
  const c = new THREE.Box3().setFromObject(ring).getCenter(new THREE.Vector3());
  S.frame(c, [{ name: '3/4', pos: [.36, .34, .62] }, { name: 'top', pos: [.01, .86, .05] }, { name: 'side', pos: [.8, .05, 0] }, { name: 'macro', pos: [.08, .3, .17] }]);
  S.setLoading(null);
}
