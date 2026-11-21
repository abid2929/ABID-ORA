/* Bags world, 3D atelier: a leather bag built in code (no stock model), in three original silhouettes.
   Every part is real geometry: a softly bevelled body, a flap with edge stitching, rolled handles or a long strap,
   metal hardware and a hot-stamped monogram. Leathers are physically based: calf, pebbled grain, croc-embossed and
   suede each have their own surface relief, gloss and sheen. Sizes are true to centimetres. */
import { show3d, floor, leatherTex, normalTex, THREE } from './show3d';
import { h, type Ctx } from './kit';

type Style = 'tote' | 'top' | 'cross';
const DIM: Record<Style, [number, number, number]> = { tote: [.38, .31, .14], top: [.30, .22, .13], cross: [.23, .16, .065] };   // width, height, depth in metres at size M
const LIGHTS: Record<string, { exp: number; env: number; key: number; ki: number; rim: number; ri: number; bg: number }> = {
  boutique: { exp: 1.15, env: 1, key: 0xfff4e6, ki: 2.6, rim: 0xe8c48a, ri: 1.1, bg: 0x14110e },
  daylight: { exp: 1.25, env: 1.2, key: 0xffffff, ki: 2.2, rim: 0xbcd4ff, ri: .8, bg: 0x1b1b1d },
  evening: { exp: .95, env: .45, key: 0xffc58a, ki: 3, rim: 0x8a7bff, ri: 1.8, bg: 0x0b0a10 },
};
const LEATHER: Record<string, { n: 'smooth' | 'pebble' | 'croc'; rough: number; cc: number; sheen: number; grain: number; rep: number; nscale: number }> = {
  calf: { n: 'smooth', rough: .38, cc: .35, sheen: 0, grain: .22, rep: 3, nscale: .25 },
  pebble: { n: 'pebble', rough: .62, cc: .08, sheen: 0, grain: 1.2, rep: 9, nscale: .9 },
  croc: { n: 'croc', rough: .34, cc: .55, sheen: 0, grain: .5, rep: 6, nscale: 1.4 },
  suede: { n: 'smooth', rough: 1, cc: 0, sheen: 1, grain: 1.6, rep: 4, nscale: .1 },
};
const METAL: Record<string, [number, number, number]> = { gold: [0xd8b36a, 1, .22], silver: [0xd3d6db, 1, .2], black: [0x2a2a2c, .9, .38] };

export function bagShow(ctx: Ctx) {
  const t = ctx.t;
  const S = show3d(ctx, { bg: '#14110e', acc: '#e8c48a', hint: t('b3.hint', 'Drag to turn · pinch, Ctrl + scroll or + / − to zoom · tap the numbered dots') });
  const { scene, renderer, key, rim } = S;
  floor(S, 0, 3, '#e8c48a');
  const st = { style: 'top' as Style, leather: 'calf', col: '#6b3b26', metal: 'gold', stitch: 'tone', size: 1, mono: 'AI' };
  const bag = new THREE.Group(); scene.add(bag);
  const tex: Record<string, THREE.Texture> = {};
  const nmap = (k: 'smooth' | 'pebble' | 'croc') => (tex[k] ??= normalTex(k, 512));

  const leatherMat = new THREE.MeshPhysicalMaterial();
  const liningMat = new THREE.MeshStandardMaterial({ color: 0x2a201a, roughness: .9 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: .5 });
  const metalMat = new THREE.MeshPhysicalMaterial({ clearcoat: .4 });
  const threadMat = new THREE.MeshStandardMaterial({ roughness: .8 });
  const monoMat = new THREE.MeshPhysicalMaterial({ transparent: true, metalness: 1, roughness: .18, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2 });

  function paint() {
    const L = LEATHER[st.leather];
    leatherMat.map?.dispose(); leatherMat.map = leatherTex(st.col, L.grain, 7); leatherMat.map.repeat.set(L.rep, L.rep);
    leatherMat.normalMap = nmap(L.n); leatherMat.normalMap.repeat.set(L.rep, L.rep); leatherMat.normalScale.set(L.nscale, L.nscale);
    leatherMat.roughness = L.rough; leatherMat.clearcoat = L.cc; leatherMat.clearcoatRoughness = .35; leatherMat.sheen = L.sheen; leatherMat.sheenRoughness = .8;
    leatherMat.sheenColor.set(st.col).offsetHSL(0, -.1, .15); leatherMat.needsUpdate = true;
    const M = METAL[st.metal]; metalMat.color.set(M[0]); metalMat.metalness = M[1]; metalMat.roughness = M[2]; monoMat.color.set(M[0]);
    threadMat.color.set(st.stitch === 'tone' ? new THREE.Color(st.col).offsetHSL(0, 0, -.08) : new THREE.Color(st.stitch === 'cream' ? 0xefe4cc : 0xd2462e));
  }

  /* a rounded trapezoid: wider at the bottom for the top-handle and crossbody, wider at the top for the tote */
  function outline(w: number, hh: number, r: number, topScale: number) {
    const s = new THREE.Shape(), bw = w / 2, tw = w / 2 * topScale;
    s.moveTo(-bw + r, 0); s.lineTo(bw - r, 0); s.quadraticCurveTo(bw, 0, bw - (bw - tw) * (r / hh), r);
    s.lineTo(tw, hh - r * .4); s.quadraticCurveTo(tw, hh, tw - r * .4, hh); s.lineTo(-tw + r * .4, hh); s.quadraticCurveTo(-tw, hh, -tw, hh - r * .4);
    s.lineTo(-bw + (bw - tw) * (r / hh), r); s.quadraticCurveTo(-bw, 0, -bw + r, 0); return s;
  }
  /* edge stitching: tiny stitches laid along a path, all in one instanced mesh */
  function stitches(pts: THREE.Vector3[], pitch = .0042) {
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), n = Math.max(2, Math.floor(curve.getLength() / pitch));
    const geo = new THREE.CapsuleGeometry(.00055, .0024, 2, 6); geo.rotateZ(Math.PI / 2);
    const im = new THREE.InstancedMesh(geo, threadMat, n); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < n; i++) { const u = (i + .5) / n, p = curve.getPointAt(u), tg = curve.getTangentAt(u); q.setFromUnitVectors(X, tg); m.compose(p, q, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, m); }
    im.castShadow = false; return im;
  }
  function tube(pts: THREE.Vector3[], r: number, mat: THREE.Material, flat = 1) {
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, r, 14, false);
    if (flat !== 1) { /* flatten the strap across its width */ const p = g.attributes.position, c = new THREE.CatmullRomCurve3(pts), v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const z0 = v.z; v.z = z0 * flat; p.setXYZ(i, v.x, v.y, v.z); } void c; g.computeVertexNormals(); }
    const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
  }
  function ring(r: number, tr: number) { const m = new THREE.Mesh(new THREE.TorusGeometry(r, tr, 12, 40), metalMat); m.castShadow = true; return m; }
  function monogram(w: number) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d')!;
    g.fillStyle = '#fff'; g.font = '500 112px "Instrument Serif", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(st.mono.toUpperCase().split('').join(' · ').slice(0, 13), 256, 84);
    const tx = new THREE.CanvasTexture(c); monoMat.alphaMap?.dispose(); monoMat.alphaMap = tx; monoMat.needsUpdate = true;
    return new THREE.Mesh(new THREE.PlaneGeometry(w, w * 160 / 512), monoMat);
  }

  let spotsAt: { label: string; text: string; at: THREE.Vector3 }[] = [];
  function build() {
    bag.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); bag.clear();
    const [W0, H0, D0] = DIM[st.style], W = W0 * st.size, H = H0 * st.size, D = D0 * st.size, bev = Math.min(.012, D * .16);
    const topScale = st.style === 'tote' ? 1.12 : st.style === 'top' ? .82 : .96;
    const shp = outline(W - bev * 2, H - bev * 2, Math.min(W, H) * (st.style === 'cross' ? .22 : .12), topScale);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: D - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 6, curveSegments: 24 }), leatherMat);
    body.position.set(0, bev, -(D - bev * 2) / 2); body.castShadow = body.receiveShadow = true; bag.add(body);
    const zf = D / 2;  // front face
    const tw = (W - bev * 2) / 2 * topScale;
    if (st.style === 'tote') {
      /* open top with a dark lining showing, two rolled handles riveted to the front and back */
      const lin = new THREE.Mesh(new THREE.PlaneGeometry(tw * 2 - .01, D - .02), liningMat); lin.rotation.x = -Math.PI / 2; lin.position.y = H - .004; bag.add(lin);
      for (const z of [zf - .002, -zf + .002]) {
        const hx = W * .22, top = H + .14 * st.size;
        bag.add(tube([new THREE.Vector3(-hx, H - .05, z), new THREE.Vector3(-hx * .9, H + .06, z), new THREE.Vector3(0, top, z), new THREE.Vector3(hx * .9, H + .06, z), new THREE.Vector3(hx, H - .05, z)], .0065 * st.size, leatherMat));
        for (const x of [-hx, hx]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.0045, .0045, .004, 20), metalMat); r.rotation.x = Math.PI / 2; r.position.set(x, H - .05, z + Math.sign(z) * .004); bag.add(r); }
        const y = H - .012; bag.add(stitches([new THREE.Vector3(-tw + .008, y, z + Math.sign(z) * .0012), new THREE.Vector3(tw - .008, y, z + Math.sign(z) * .0012)]));
      }
      for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new THREE.Mesh(new THREE.SphereGeometry(.007, 16, 10, 0, 7, 0, Math.PI / 2), metalMat); f.rotation.x = Math.PI; f.position.set(x * (W / 2 - .035), .0005, z * (D / 2 - .03)); bag.add(f); }
      spotsAt = [
        { label: t('b3.s1', 'Rolled handles'), text: t('b3.s1t', 'Leather rolled around a cord core and riveted, so the handle keeps its round shape for years.'), at: new THREE.Vector3(0, H + .14 * st.size, zf) },
        { label: t('b3.s2', 'Edge stitching'), text: t('b3.s2t', 'Saddle stitches about 4 mm apart, every one modelled. Pick tonal, cream or red thread.'), at: new THREE.Vector3(tw * .5, H - .012, zf) },
        { label: t('b3.s3', 'Metal feet'), text: t('b3.s3t', 'Four studs lift the base off the floor and protect the leather.'), at: new THREE.Vector3(W / 2 - .035, .004, D / 2 - .03) },
      ];
    } else {
      /* a flap that folds over the top and down the front, with a turn-lock clasp */
      const fw = tw * 2 + bev * 2.2, fh = H * (st.style === 'top' ? .58 : .72), r = fw * .14;
      const fs = new THREE.Shape(); fs.moveTo(-fw / 2, 0); fs.lineTo(fw / 2, 0); fs.lineTo(fw / 2, -fh + r); fs.quadraticCurveTo(fw / 2, -fh, fw / 2 - r, -fh); fs.lineTo(-fw / 2 + r, -fh); fs.quadraticCurveTo(-fw / 2, -fh, -fw / 2, -fh + r); fs.closePath();
      const flap = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: .0025, bevelEnabled: true, bevelThickness: .0012, bevelSize: .0012, bevelSegments: 3, curveSegments: 20 }), [leatherMat, edgeMat]);
      flap.position.set(0, H + .001, zf + .0005); flap.castShadow = true; bag.add(flap);
      const lid = new THREE.Mesh(new THREE.ExtrudeGeometry(outline(fw, D + .002, .012, 1), { depth: .003, bevelEnabled: false, curveSegments: 12 }), [leatherMat, edgeMat]); lid.rotation.x = Math.PI / 2; lid.position.set(0, H + .0035, -(D + .002) / 2); lid.castShadow = true; bag.add(lid);
      const z = zf + .0045, inset = .006;
      bag.add(stitches([new THREE.Vector3(-fw / 2 + inset, H - .002, z), new THREE.Vector3(-fw / 2 + inset, H - fh + r, z), new THREE.Vector3(-fw / 2 + r * .7, H - fh + inset, z), new THREE.Vector3(fw / 2 - r * .7, H - fh + inset, z), new THREE.Vector3(fw / 2 - inset, H - fh + r, z), new THREE.Vector3(fw / 2 - inset, H - .002, z)]));
      const cy = H - fh + .012 + .018 * st.size;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.034 * st.size, .022 * st.size, .004), metalMat); plate.position.set(0, cy, z + .002); plate.castShadow = true; bag.add(plate);
      const turn = new THREE.Mesh(new THREE.CylinderGeometry(.006 * st.size, .006 * st.size, .006, 24), metalMat); turn.rotation.x = Math.PI / 2; turn.position.set(0, cy, z + .006); bag.add(turn);
      const mono = monogram(fw * .5); mono.position.set(0, H - fh * .34, z + .0004); bag.add(mono);
      if (st.style === 'top') {
        const hx = W * .17, top = H + .11 * st.size;
        bag.add(tube([new THREE.Vector3(-hx, H + .004, 0), new THREE.Vector3(-hx * .95, H + .07 * st.size, 0), new THREE.Vector3(0, top, 0), new THREE.Vector3(hx * .95, H + .07 * st.size, 0), new THREE.Vector3(hx, H + .004, 0)], .0075 * st.size, leatherMat));
        for (const x of [-hx, hx]) { const rg = ring(.009 * st.size, .0022); rg.position.set(x, H + .012, 0); bag.add(rg); }
        spotsAt = [{ label: t('b3.s4', 'Top handle'), text: t('b3.s4t', 'A single rolled handle on two metal rings, sized to carry by hand or in the crook of the arm.'), at: new THREE.Vector3(0, top, 0) }];
      } else {
        /* long crossbody strap: flattened leather from ring to ring over the shoulder */
        const sx = W / 2 + .004, len = .55;
        for (const s of [-1, 1]) { const rg = ring(.008, .0018); rg.rotation.y = Math.PI / 2; rg.position.set(s * sx, H * .82, 0); bag.add(rg); }
        bag.add(tube([new THREE.Vector3(-sx, H * .82, 0), new THREE.Vector3(-sx - .03, H + len * .45, -.02), new THREE.Vector3(-.05, H + len * .78, -.06), new THREE.Vector3(.05, H + len * .78, -.06), new THREE.Vector3(sx + .03, H + len * .45, -.02), new THREE.Vector3(sx, H * .82, 0)], .009, leatherMat, .28));
        spotsAt = [{ label: t('b3.s5', 'Adjustable strap'), text: t('b3.s5t', 'A flat leather strap long enough to wear across the body, clipped to two metal rings.'), at: new THREE.Vector3(-sx - .03, H + len * .45, -.02) }];
      }
      spotsAt.push({ label: t('b3.s6', 'Turn-lock clasp'), text: t('b3.s6t', 'Solid metal plate and turn lock. Change the hardware to gold, silver or black.'), at: new THREE.Vector3(0, cy, z + .01) },
        { label: t('b3.s7', 'Hot-stamped initials'), text: t('b3.s7t', 'Your initials pressed into the flap in metal foil. Type them in the Monogram box.'), at: new THREE.Vector3(fw * .22, H - fh * .34, z) });
    }
    S.spots(spotsAt);
    note.textContent = t('b3.dim', 'Size {s}: {w} × {h} × {d} cm (width × height × depth).').replace('{s}', st.size < 1 ? 'S' : st.size > 1 ? 'L' : 'M')
      .replace('{w}', (W * 100).toFixed(0)).replace('{h}', (H * 100).toFixed(0)).replace('{d}', (D * 100).toFixed(1).replace('.0', ''));
  }
  function setLight(n: string) { const L = LIGHTS[n]; renderer.toneMappingExposure = L.exp; scene.environmentIntensity = L.env; key.color.set(L.key); key.intensity = L.ki; rim.color.set(L.rim); rim.intensity = L.ri; (scene.background as THREE.Color).set(L.bg); }

  const gS = S.group(t('b3.style', 'Style')); const gL = S.group(t('b3.leather', 'Leather')); const gC = S.group(t('b3.colour', 'Colour'));
  const gM = S.group(t('b3.hw', 'Hardware & thread')); const gZ = S.group(t('b3.size', 'Size')); const gV = S.group(t('view', 'View')); const gLi = S.group(t('light', 'Light'));
  const note = h('p', { class: 's3-note' });
  S.chips(gS, [['top', t('b3.top', 'Top handle')], ['tote', t('b3.tote', 'Tote')], ['cross', t('b3.cross', 'Crossbody')]], st.style, (v) => { st.style = v as Style; build(); });
  S.chips(gL, [['calf', t('b3.calf', 'Smooth calf')], ['pebble', t('b3.pebble', 'Pebbled')], ['croc', t('b3.croc', 'Croc-embossed')], ['suede', t('b3.suede', 'Suede')]], st.leather, (v) => { st.leather = v; paint(); });
  const COLS: [string, string][] = [['#6b3b26', t('c.cognac', 'Cognac')], ['#1d1a18', t('c.black', 'Noir')], ['#efe6d6', t('c.ivory', 'Ivory')], ['#8c1d24', t('c.rouge', 'Rouge')], ['#1f3a5c', t('c.navy', 'Navy')], ['#3f5a3a', t('c.olive', 'Olive')], ['#c9a27a', t('c.sand', 'Sand')], ['#d9a3a8', t('c.blush', 'Blush')]];
  const setCol = S.swatches(gC, COLS.map(([c, l]) => [c, c, l]), st.col, (v) => { st.col = v; paint(); });
  const pick = h('input', { type: 'color', value: st.col, 'aria-label': t('b3.own', 'Pick any colour'), style: { width: '100%', height: '34px', marginTop: '10px', background: 'none', border: '0', cursor: 'pointer' } }) as HTMLInputElement;
  pick.oninput = () => { st.col = pick.value; setCol(''); const lb = gC.querySelector('.l b'); if (lb) lb.textContent = pick.value; paint(); }; gC.append(pick);
  S.chips(gM, [['gold', t('m.gold', 'Gold')], ['silver', t('m.silver', 'Silver')], ['black', t('m.black', 'Black')]], st.metal, (v) => { st.metal = v; paint(); });
  const gT = h('div', { style: { marginTop: '12px' } }); gM.append(gT);
  S.chips(gT, [['tone', t('th.tone', 'Tonal thread')], ['cream', t('th.cream', 'Cream thread')], ['red', t('th.red', 'Red thread')]], st.stitch, (v) => { st.stitch = v; paint(); });
  const monoIn = h('input', { type: 'text', value: st.mono, maxlength: '3', 'aria-label': t('b3.mono', 'Monogram, up to 3 letters'), placeholder: t('b3.mono', 'Monogram, up to 3 letters'),
    style: { marginTop: '12px', width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1px solid rgba(236,230,220,.2)', background: 'rgba(0,0,0,.25)', color: '#ece6dc', font: '500 15px var(--sans,sans-serif)', letterSpacing: '.2em', textTransform: 'uppercase' } }) as HTMLInputElement;
  monoIn.oninput = () => { st.mono = monoIn.value.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3); build(); }; gM.append(monoIn);
  S.chips(gZ, [['.85', 'S'], ['1', 'M'], ['1.15', 'L']], '1', (v) => { st.size = +v; build(); }); gZ.append(note);
  S.chips(gV, [['3/4', '3/4'], ['front', t('vw.front', 'Front')], ['side', t('vw.side', 'Side')], ['top', t('vw.top', 'Top')], ['back', t('vw.back', 'Back')]], '3/4', (v) => S.go(v));
  S.chips(gLi, [['boutique', t('l.boutique', 'Boutique')], ['daylight', t('l.day', 'Daylight')], ['evening', t('l.evening', 'Evening')]], 'boutique', setLight);
  S.rail.append(h('p', { class: 's3-note', text: t('b3.credit', 'Every part of this bag is built in code, original to Abidora. Plan and sew your own real tote with the pattern maker below.') }));

  paint(); build(); setLight('boutique');
  key.target = bag; key.shadow.camera.left = key.shadow.camera.bottom = -.5; key.shadow.camera.right = key.shadow.camera.top = .5; key.shadow.camera.updateProjectionMatrix();
  const c = new THREE.Vector3(0, .16, 0);
  S.frame(c, [{ name: '3/4', pos: [.5, .24, .74] }, { name: 'front', pos: [0, .07, .9] }, { name: 'side', pos: [.9, .07, 0] }, { name: 'top', pos: [.02, .86, .12] }, { name: 'back', pos: [-.35, .18, -.82] }]);
  S.setLoading(null);
}
