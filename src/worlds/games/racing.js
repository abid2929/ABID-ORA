/* World 12 · Racing: Abidora Circuit.
   A 3-lap race against three rivals on a sunset circuit. Car speed comes from the same physics as the old
   Performance Lab (power, grip, drag and rolling resistance, real units: metres, kg, kW), cornering is
   limited by tyre grip (mu x g), and the handbrake lets the rear slide for drifts that fill the nitro.
   The cars are real 3D models (CC BY 4.0); the circuit and scenery are built in code. */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { onKey, assetBase, makeStage, skyEnv, keys, btn, card, hud, toast, controlsLegend, best, fmtTime, sfx, run, topBar, el, TOUCH, clamp, lerp, damp, rng, noise2, canvasTex } from './gkit.js';

const G = 9.81, RHO = 1.225, CRR = .013;
/* Every car is a real downloaded 3D model (CC BY 4.0). Badges and plates are hidden and the film livery is
   replaced by plain paint. Physics numbers are a tuned late-1990s AWD twin-turbo coupe and a light fictional hover bike. */
export const CARS = {
  street: { name: 'Street Legend', kw: 420, kg: 1560, cd: .34, fa: 1.95, share: 1, mu: 1.2, col: '#c9932f', tag: 'AWD · 420 kW', by: 'vecarz', model: 'car-r34.glb' },
  night: { name: 'Night Runner', kw: 440, kg: 1540, cd: .33, fa: 1.95, share: .7, mu: 1.17, col: '#2f6fd6', tag: 'RWD-biased · 440 kW · drifts', by: 'DRIVER-FIRE', model: 'car-r34b.glb' },
  hover: { name: 'Hover Bike', kw: 260, kg: 620, cd: .45, fa: 1.1, share: 1, mu: 1.3, col: '#7fd0c8', tag: 'Fictional · 260 kW · agile', by: 'Adipriatna', model: 'hover-bike.glb', len: 3.2, lift: .35, drop: /^papan$/ },
};
/* load each model once (scaled to the body length the physics and camera use), then clone it per car with its own paint */
const models = {};
function loadModel(spec) {
  const { model: file, len = 4.62, lift = 0, drop } = spec;
  return (models[file] ??= (async () => {
    const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/libs/meshopt_decoder.module.js')]);
    const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
    const sc = (await ld.loadAsync(assetBase + file)).scene;
    const gone = [];
    sc.traverse((o) => {
      if (!o.isMesh) return; const n = o.material?.name ?? '';
      if (/Badge|ManufacturerPlate/i.test(n) || (drop && drop.test(n))) { gone.push(o); return; }   // brand marks, display stands
      if (/Paint_Material/.test(n)) o.userData.paint = true;
      o.castShadow = true;
      for (const m of [o.material].flat()) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) if (m[k]) m[k].anisotropy = 8;
    });
    gone.forEach((o) => o.removeFromParent());
    const b = new THREE.Box3().setFromObject(sc), sz = b.getSize(new THREE.Vector3()), ct = b.getCenter(new THREE.Vector3());
    const k = len / sz.z; sc.position.set(-ct.x, -b.min.y + lift / k, -ct.z);
    const w = new THREE.Group(); w.add(sc); w.scale.setScalar(k); return w;
  })());
}
const paints = {};
function modelCar(tpl, color) {
  const g = tpl.clone(true);
  paints[color] ??= new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .28, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.2 });
  g.traverse((o) => { if (o.isMesh && o.userData.paint) o.material = paints[color]; });
  /* soft contact shadow under the body so the car sits on the road */
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.2), shadowMat()); sh.rotation.x = -Math.PI / 2; sh.position.y = .03; sh.renderOrder = -1;
  const holder = new THREE.Group(); holder.add(g, sh);
  holder.userData.wheels = []; return holder;
}
let _shm;
function shadowMat() {
  return (_shm ??= new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(64, 128, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.setTransform(1, 0, 0, 2, 0, 0); g.fillStyle = r; g.fillRect(0, 0, w, h / 2); }) }));
}
const LEVELS = { easy: .82, normal: .93, hard: 1.0 };

/* ---------- the circuit ---------- */
/* the start line is the first point: it sits on the long, almost straight run (owner, 21 Nov: the old start was on a bend and the grandstand looked like a wall ahead) */
const CTRL = [[140, -10], [260, -60], [330, -170], [300, -290], [190, -330], [90, -270], [40, -180], [-40, -150], [-150, -230], [-280, -230], [-350, -130], [-320, 0], [-230, 90], [-120, 110], [0, 0]];
const HALF = 9;           // half width of the road, m
export function buildTrack() {
  const curve = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const N = 1600, P = [], T = [], Nn = [], L = [0];
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N);
    P.push(p); T.push(t); Nn.push(new THREE.Vector3(-t.z, 0, t.x));
    if (i) L.push(L[i - 1] + p.distanceTo(P[i - 1]));
  }
  const len = L[N - 1] + P[N - 1].distanceTo(P[0]);
  /* curvature ahead, used by rivals to pick speed */
  const K = P.map((_, i) => { const a = T[i], b = T[(i + 8) % N]; return Math.acos(clamp(a.dot(b), -1, 1)) / (len / N * 8); });
  return { curve, N, P, T, Nn, L, len, K };
}
/* nearest sample, searching around a hint */
export function nearest(tr, x, z, hint, span = 60) {
  let bi = hint, bd = Infinity;
  for (let k = -span; k <= span; k++) { const i = (hint + k + tr.N) % tr.N, p = tr.P[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
  const p = tr.P[bi], n = tr.Nn[bi]; return { i: bi, lat: (x - p.x) * n.x + (z - p.z) * n.z, d: Math.sqrt(bd) };
}

/* ---------- textures ---------- */
function asphaltMaps() {
  const r = rng(7);
  const map = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#2b2c2f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const v = 30 + r() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},${.35 + r() * .5})`; g.fillRect(r() * w, r() * h, 1 + r() * 1.6, 1 + r() * 1.6); }
    /* racing line rubber and wear */
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.35, 'rgba(10,10,10,.28)'); gr.addColorStop(.5, 'rgba(10,10,10,.12)'); gr.addColorStop(.65, 'rgba(10,10,10,.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9e6df'; g.fillRect(10, 0, 9, h); g.fillRect(w - 19, 0, 9, h);           // edge lines
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const rough = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); for (let i = 0; i < 6000; i++) { const v = 150 + r() * 105 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1.5, 1.5); } g.fillStyle = 'rgba(90,90,90,.5)'; g.fillRect(w * .3, 0, w * .4, h); }, false);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, roughnessMap: rough };
}
function grassMap() {
  const r = rng(3), n = noise2(5);
  const t = canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = n.fbm(x / 70, y / 70, 4) * .5 + .5, s = r(); const i = (y * w + x) * 4;
      d[i] = 58 + v * 40 + s * 22; d[i + 1] = 84 + v * 46 + s * 26; d[i + 2] = 34 + v * 16 + s * 8; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(220, 220); return t;
}

/* car profile in metres, z forward */
const sideTop = (z) => z > 1.6 ? lerp(.74, .5, (z - 1.6) / .72) : z > .4 ? lerp(.92, .74, (z - .4) / 1.2) : z > -1.7 ? .95 : lerp(.95, .82, (-z - 1.7) / .62);
const cabTop = (z) => z > .5 ? lerp(1.12, .9, (z - .5) / .65) : z > -.45 ? lerp(1.3, 1.12, (z + .45) / .95) : lerp(1.3, .95, (-z - .45) / .7);
const planHalf = (z) => { const e = Math.max(0, Math.abs(z) - 1.55) / .78; return .96 * Math.sqrt(Math.max(.18, 1 - e * e * .82)); };
function shaped(len, yr, half, k = 3, z0 = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1, 18, 10, 44); const p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).multiplyScalar(2);
    const m = (Math.abs(v.x) ** k + Math.abs(v.y) ** k + Math.abs(v.z) ** k) ** (1 / k) || 1;   // round the box corners
    const ux = v.x / m * .5, uy = v.y / m * .5 + .5, uz = v.z / m * .5;
    const z = uz * len + z0, [y0, y1] = yr(z), y = y0 + uy * (y1 - y0);
    p.setXYZ(i, ux * 2 * half(z, y), y, z);
  }
  const m2 = mergeVertices(g.deleteAttribute('normal').deleteAttribute('uv') && g, 1e-4); m2.computeVertexNormals(); return m2;
}
/* ---------- the car: extruded side profile, glass canopy, PBR paint ---------- */
const mats = {};
function carMesh(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .32, clearcoat: 1, clearcoatRoughness: .04, envMapIntensity: 1.3 });
  mats.dark ??= new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: .55, metalness: .2 });
  mats.glass ??= new THREE.MeshPhysicalMaterial({ color: 0x0a0e14, metalness: .3, roughness: .04, clearcoat: 1, envMapIntensity: 2 });
  mats.tyre ??= new THREE.MeshStandardMaterial({ color: 0x141414, roughness: .92 });
  mats.rim ??= new THREE.MeshStandardMaterial({ color: 0xbfc3c8, metalness: 1, roughness: .22 });
  mats.head ??= new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3dc, emissiveIntensity: 3.2 });
  mats.tail ??= new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff1a1a, emissiveIntensity: 2.6 });
  /* body: a rounded box (superellipsoid) bent to a side profile, a plan taper and tumblehome */
  const body = shaped(4.62, (z) => [.3, sideTop(z)], (z, y) => planHalf(z) * (1 - clamp((y - .62) / .5, 0, 1) * .1), 3.2);
  const bm = new THREE.Mesh(body, paint); bm.castShadow = true; g.add(bm);
  const cab = shaped(2.3, (z) => [.78, cabTop(z)], (z, y) => (.74 - clamp((y - .9) / .45, 0, 1) * .2) * (1 - (Math.abs(z) / 1.15) ** 6 * .25), 2.4, -.25);
  const cm = new THREE.Mesh(cab, mats.glass); cm.castShadow = true; g.add(cm);
  /* skirts, diffuser, splitter, wing */
  const sk = new THREE.Mesh(new THREE.BoxGeometry(1.9, .12, 2.2), mats.dark); sk.position.set(0, .3, -.05); g.add(sk);
  const sp = new THREE.Mesh(new THREE.BoxGeometry(2.0, .05, .4), mats.dark); sp.position.set(0, .3, 2.3); g.add(sp);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, .05, .36), mats.dark); wing.position.set(0, 1.18, -2.08); wing.rotation.x = .12; g.add(wing);
  for (const x of [-.6, .6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.05, .3, .14), mats.dark); p.position.set(x, 1.02, -2.05); g.add(p); }
  /* lights */
  for (const x of [-.68, .68]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(.48, .05, .06), mats.head); hl.position.set(x * .92, .62, 2.1); hl.rotation.x = -.6; hl.rotation.y = x > 0 ? .35 : -.35; g.add(hl); }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, .06, .05), mats.tail); tl.position.set(0, .8, -2.33); g.add(tl);
  /* wheels */
  const tyreG = new THREE.CylinderGeometry(.36, .36, .3, 32); tyreG.rotateZ(Math.PI / 2);
  const rimG = new THREE.CylinderGeometry(.25, .25, .31, 32); rimG.rotateZ(Math.PI / 2);
  const spokeG = new THREE.BoxGeometry(.02, .44, .07);
  const wheels = [];
  for (const [x, z] of [[-.98, 1.42], [.98, 1.42], [-.98, -1.42], [.98, -1.42]]) {
    const piv = new THREE.Group(); piv.position.set(x, .36, z);
    const spin = new THREE.Group(); piv.add(spin);
    const ty = new THREE.Mesh(tyreG, mats.tyre); ty.castShadow = true; spin.add(ty);
    spin.add(new THREE.Mesh(rimG, mats.rim));
    for (let k = 0; k < 5; k++) { const sp2 = new THREE.Mesh(spokeG, mats.rim); sp2.position.x = x > 0 ? .16 : -.16; sp2.rotation.x = k / 5 * Math.PI; spin.add(sp2); }
    g.add(piv); wheels.push({ piv, spin, front: z > 0 });
  }
  g.userData.wheels = wheels;
  return g;
}

/* ---------- scenery ---------- */
function scenery(S, tr) {
  const n = noise2(11), r = rng(21);
  /* ground: flat infield, rolling hills and mountains farther out */
  const size = 5200, seg = 220;
  const gg = new THREE.PlaneGeometry(size, size, seg, seg); gg.rotateX(-Math.PI / 2);
  const pos = gg.attributes.position, col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), rr = Math.hypot(x + 10, z + 110);
    const far = clamp((rr - 650) / 900, 0, 1), hill = n.fbm(x / 600, z / 600, 5) * .5 + .5;
    const y = far * far * (90 + hill * 520) + clamp((rr - 520) / 300, 0, 1) * n.fbm(x / 120, z / 120, 3) * 10;
    pos.setY(i, y);
    const snow = clamp((y - 330) / 90, 0, 1), rock = clamp((y - 150) / 160, 0, 1);
    const c = new THREE.Color(1, 1, 1).lerp(new THREE.Color(.42, .4, .38), rock * .8).lerp(new THREE.Color(1.7, 1.7, 1.8), snow);
    col.set([c.r, c.g, c.b], i * 3);
  }
  gg.setAttribute('color', new THREE.BufferAttribute(col, 3)); gg.computeVertexNormals();
  const ground = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ map: grassMap(), vertexColors: true, roughness: .95 }));
  ground.receiveShadow = true; S.scene.add(ground);

  /* road ribbon + kerbs */
  const ribbon = (off0, off1, y, vScale) => {
    const v = [], uv = [], idx = [];
    for (let i = 0; i <= tr.N; i++) {
      const k = i % tr.N, p = tr.P[k], nn = tr.Nn[k], L = i === tr.N ? tr.len : tr.L[k];
      v.push(p.x + nn.x * off0, y, p.z + nn.z * off0, p.x + nn.x * off1, y, p.z + nn.z * off1); uv.push(0, L / vScale, 1, L / vScale);
      if (i < tr.N) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  };
  const am = asphaltMaps(); am.map.repeat.set(1, 1);
  const road = new THREE.Mesh(ribbon(HALF, -HALF, .04, 18), new THREE.MeshStandardMaterial({ ...am, roughness: 1, metalness: 0 }));
  road.receiveShadow = true; S.scene.add(road);
  const kerbT = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#d82a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#f2efe8'; g.fillRect(0, 0, w, h / 2); });
  kerbT.wrapS = kerbT.wrapT = THREE.RepeatWrapping;
  const kerbM = new THREE.MeshStandardMaterial({ map: kerbT, roughness: .6 });
  for (const [a, b] of [[HALF + 1.6, HALF], [-HALF, -HALF - 1.6]]) { const k = new THREE.Mesh(ribbon(a, b, .07, 7), kerbM); k.receiveShadow = true; S.scene.add(k); }
  /* gravel run-off strip */
  const grav = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#9a8c74'; g.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 110 + r() * 90 | 0; g.fillStyle = `rgb(${v},${v - 8},${v - 26})`; g.fillRect(r() * w, r() * h, 2, 2); } });
  grav.wrapS = grav.wrapT = THREE.RepeatWrapping;
  for (const [a, b] of [[HALF + 7, HALF + 1.6], [-HALF - 1.6, -HALF - 7]]) { const k = new THREE.Mesh(ribbon(a, b, .03, 6), new THREE.MeshStandardMaterial({ map: grav, roughness: 1 })); k.receiveShadow = true; S.scene.add(k); }

  /* barriers: white/blue walls with posts */
  const wallT = canvasTex(512, 64, (g, w, h) => { g.fillStyle = '#eef0f2'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4f9a'; g.fillRect(0, h * .62, w, h * .38); g.fillStyle = '#e8b46a'; g.font = '700 30px Inter Tight, sans-serif'; g.fillText('ABIDORA', 30, 36); g.fillText('ABIDORA', 290, 36); });
  wallT.wrapS = THREE.RepeatWrapping;
  const wallM = new THREE.MeshStandardMaterial({ map: wallT, roughness: .5 });
  for (const side of [1, -1]) {
    const off = side * (HALF + 8.5), v = [], uv = [], idx = [];
    for (let i = 0; i <= tr.N; i++) {
      const k = i % tr.N, p = tr.P[k], nn = tr.Nn[k], L = i === tr.N ? tr.len : tr.L[k];
      const x = p.x + nn.x * off, z = p.z + nn.z * off; v.push(x, 0, z, x, 1.1, z); uv.push(L / 26, 0, L / 26, 1);
      if (i < tr.N) { const a = i * 2; idx.push(...(side > 0 ? [a, a + 2, a + 1, a + 1, a + 2, a + 3] : [a, a + 1, a + 2, a + 1, a + 3, a + 2])); }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, wallM); m.receiveShadow = true; m.castShadow = true; S.scene.add(m);
  }

  /* start line, gantry, grandstand */
  const st = tr.P[0], tn = tr.Nn[0], ang = Math.atan2(tr.T[0].x, tr.T[0].z);
  const chk = canvasTex(256, 32, (g, w, h) => { const s2 = 16; for (let y = 0; y < h; y += s2) for (let x = 0; x < w; x += s2) { g.fillStyle = ((x + y) / s2) % 2 ? '#111' : '#f4f2ee'; g.fillRect(x, y, s2, s2); } });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 2), new THREE.MeshStandardMaterial({ map: chk, roughness: .7 })); line.rotation.x = -Math.PI / 2; line.rotation.z = ang; line.position.set(st.x, .06, st.z); line.receiveShadow = true; S.scene.add(line);
  const gan = new THREE.Group(); gan.position.copy(st); gan.rotation.y = ang; S.scene.add(gan);
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: .85, roughness: .35 });
  for (const x of [-HALF - 3, HALF + 3]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.7, 9, .7), steel); p.position.set(x, 4.5, 0); p.castShadow = true; gan.add(p); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 7, 1.6, .9), steel); beam.position.y = 8.4; beam.castShadow = true; gan.add(beam);
  const sign = canvasTex(1024, 96, (g, w, h) => { g.fillStyle = '#07080a'; g.fillRect(0, 0, w, h); g.fillStyle = '#ece6dc'; g.font = '400 64px Instrument Serif, serif'; g.textAlign = 'center'; g.fillText('Abidora Circuit', w / 2, 66); g.fillStyle = '#e8b46a'; g.fillRect(40, 44, 50, 4); g.fillRect(w - 90, 44, 50, 4); });
  const sg = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2 + 6, 1.3), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 1.4 }));
  sg.position.set(0, 8.4, .46); gan.add(sg); const sg2 = sg.clone(); sg2.rotation.y = Math.PI; sg2.position.z = -.46; gan.add(sg2);
  /* start lights on the gantry */
  const lampM = [];
  for (let i = 0; i < 5; i++) { const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2020, emissiveIntensity: 0 }); lampM.push(m); const l = new THREE.Mesh(new THREE.SphereGeometry(.3, 16, 12), m); l.position.set(-2.4 + i * 1.2, 7.1, .2); gan.add(l); }
  /* grandstand on the outside of the main straight */
  const stand = new THREE.Group(); stand.position.set(st.x - tn.x * (HALF + 22), 0, st.z - tn.z * (HALF + 22)); stand.rotation.y = ang + Math.PI / 2; S.scene.add(stand);
  const conc = new THREE.MeshStandardMaterial({ color: 0x3a3c41, roughness: .8 });
  const seatC = [0x1f4f9a, 0xe8b46a, 0xeeeeee];
  for (let rw = 0; rw < 9; rw++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(3, .8, 70), conc); step.position.set(-rw * 1.6, rw * .8 + .4, 0); step.castShadow = step.receiveShadow = true; stand.add(step);
    const seats = new THREE.Mesh(new THREE.BoxGeometry(.9, .6, 69), new THREE.MeshStandardMaterial({ color: seatC[rw % 3], roughness: .5 })); seats.position.set(-rw * 1.6 - .6, rw * .8 + 1.05, 0); stand.add(seats);
  }
  const roofM = new THREE.Mesh(new THREE.BoxGeometry(18, .4, 74), steel); roofM.position.set(-7, 12.5, 0); roofM.rotation.z = -.08; roofM.castShadow = true; stand.add(roofM);
  for (let z = -33; z <= 33; z += 11) { const c = new THREE.Mesh(new THREE.BoxGeometry(.5, 13, .5), steel); c.position.set(-15, 6.5, z); stand.add(c); }
  /* warm light lines and a dark back wall: reads as a modern stand at dusk (matte, so it never flares in the bloom) */
  const led = new THREE.Mesh(new THREE.BoxGeometry(.12, .12, 72), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffd9a0, emissiveIntensity: 3 })); led.position.set(1.9, 12.6, 0); stand.add(led); const led2 = led.clone(); led2.position.set(-15.7, 11.6, 0); stand.add(led2); const led3 = led.clone(); led3.position.set(-15.7, 1.2, 0); stand.add(led3);
  const back = new THREE.Mesh(new THREE.BoxGeometry(.3, 12, 72), new THREE.MeshStandardMaterial({ color: 0x22262d, metalness: .25, roughness: .7 })); back.position.set(-15.4, 6.2, 0); back.castShadow = true; stand.add(back);
  /* keep the whole stand clear of the road (centre line + half width + run-off + wall): push it outward until no part of it is within 22 m */
  { const tmp = new THREE.Vector3(); const near = () => { stand.updateMatrixWorld(true); let md = Infinity;
      for (let zl = -37; zl <= 37; zl += 4) for (const xl of [-16, -8, 0, 3]) { tmp.set(xl, 0, zl).applyMatrix4(stand.matrixWorld); for (let k = 0; k < tr.N; k += 2) md = Math.min(md, Math.hypot(tr.P[k].x - tmp.x, tr.P[k].z - tmp.z)); }
      return md; };
    for (let g2 = 0; g2 < 40 && near() < HALF + 13; g2++) { stand.position.x -= tn.x * 2; stand.position.z -= tn.z * 2; } }

  /* trees: instanced pines away from the road */
  const trunk = new THREE.CylinderGeometry(.18, .3, 2.4, 6); trunk.translate(0, 1.2, 0);
  const cones = [new THREE.ConeGeometry(2.4, 4.2, 8), new THREE.ConeGeometry(1.9, 3.6, 8), new THREE.ConeGeometry(1.3, 3, 8)];
  cones[0].translate(0, 3.6, 0); cones[1].translate(0, 5.6, 0); cones[2].translate(0, 7.5, 0);
  const tM = new THREE.MeshStandardMaterial({ color: 0x4a3426, roughness: .9 }), lM = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: .85 });
  const COUNT = TOUCH ? 700 : 1100;
  const tI = new THREE.InstancedMesh(trunk, tM, COUNT), lI = cones.map((c) => new THREE.InstancedMesh(c, lM, COUNT));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col2 = new THREE.Color();
  let placed = 0, tries = 0;
  while (placed < COUNT && tries < 30000) {
    tries++;
    const x = (r() - .5) * 1500 - 10, z = (r() - .5) * 1300 - 110;
    let md = Infinity; for (let i = 0; i < tr.N; i += 8) { const d = (tr.P[i].x - x) ** 2 + (tr.P[i].z - z) ** 2; if (d < md) md = d; }
    if (md < 34 * 34) continue;
    if (Math.hypot(x - stand.position.x, z - stand.position.z) < 60) continue;
    if (n.fbm(x / 160, z / 160, 3) < -.08 && md < 160 * 160) continue;        // clearings near the track
    const s2 = .8 + r() * .7; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.3); sc.set(s2, s2 * (.85 + r() * .4), s2); p.set(x, 0, z);
    m4.compose(p, q, sc); tI.setMatrixAt(placed, m4); lI.forEach((li) => { li.setMatrixAt(placed, m4); li.setColorAt(placed, col2.setHSL(.27 + r() * .06, .35 + r() * .2, .5 + r() * .25)); });
    placed++;
  }
  tI.count = placed; lI.forEach((li) => { li.count = placed; li.castShadow = true; S.scene.add(li); }); S.scene.add(tI);

  /* floodlight masts with glowing heads */
  const headM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff1d6, emissiveIntensity: 2.4 });
  for (let i = 0; i < tr.N; i += 110) {
    const pp = tr.P[i], nn = tr.Nn[i]; const side = (i / 110) % 2 ? 1 : -1;
    const g2 = new THREE.Group(); g2.position.set(pp.x + nn.x * side * (HALF + 12), 0, pp.z + nn.z * side * (HALF + 12)); S.scene.add(g2);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(.18, .28, 16, 8), steel); mast.position.y = 8; g2.add(mast);
    const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, .5, .3), headM); head.position.y = 16; head.lookAt(pp.x, 0, pp.z); g2.add(head);
  }
  return { lampM };
}

/* ---------- skid marks: a ring buffer of quads ---------- */
function skids(scene) {
  const MAX = 1400, v = new Float32Array(MAX * 4 * 3), a = new Float32Array(MAX * 4), idx = [];
  for (let i = 0; i < MAX; i++) { const b = i * 4; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(v, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(a, 1)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'attribute float alpha; varying float va; void main(){ va=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying float va; void main(){ gl_FragColor=vec4(.03,.03,.03,va*.55); }' });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
  let k = 0; const last = new Map();
  return {
    add(id, x, z, nx, nz, s) {
      const prev = last.get(id); last.set(id, [x, z]); if (!prev || s <= 0) return;
      const w = .14, b = k * 4;
      v.set([prev[0] - nx * w, .06, prev[1] - nz * w, prev[0] + nx * w, .06, prev[1] + nz * w, x - nx * w, .06, z - nz * w, x + nx * w, .06, z + nz * w], b * 3);
      a.set([s, s, s, s], b); k = (k + 1) % MAX; geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true;
    },
    cut(id) { last.delete(id); },
  };
}

/* ---------- vehicle physics (also used by rivals) ---------- */
export function makeCar(spec, color, isPlayer, mesh) {
  return { spec, mesh: mesh ?? carMesh(color), x: 0, z: 0, h: 0, vx: 0, vz: 0, yaw: 0, steer: 0, idx: 0, lap: 0, prog: 0, half: false, done: false, finishT: 0, nitro: .35, player: isPlayer, lapStart: 0, bestLap: null, ai: { off: 0 } };
}
export function stepCar(c, inp, dt, tr) {
  const sp = c.spec, fx = Math.sin(c.h), fz = Math.cos(c.h), rx = fz, rz = -fx;
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;
  const near = nearest(tr, c.x, c.z, c.idx); c.idx = near.i;
  const off = Math.abs(near.lat) > HALF + 1.6, grav = Math.abs(near.lat) > HALF + 1.6 && Math.abs(near.lat) < HALF + 7;
  const muS = (off ? (grav ? .55 : .7) : 1) * sp.mu;
  /* drive force: min(traction limit, power / speed), as in the Performance Lab */
  const nitro = inp.nitro && c.nitro > 0 ? 1 : 0; if (nitro) c.nitro = Math.max(0, c.nitro - dt * .28);
  const P = sp.kw * 1000 * .88 * (1 + nitro * .45);
  const fT = muS * sp.kg * G * sp.share, fP = P / Math.max(Math.abs(vf), 6);
  let F = inp.gas * Math.min(fT, fP) - Math.sign(vf) * (.5 * RHO * sp.cd * sp.fa * vf * vf + CRR * sp.kg * G * (off ? 6 : 1));
  if (inp.brake) F -= Math.sign(vf || 1) * (vf > 1 ? muS * sp.kg * G * .95 : Math.min(fT, 9000) * .45 * (vf > -12 ? 1 : 0));
  vf += F / (sp.kg * 1.05) * dt;
  if (!inp.gas && !inp.brake && Math.abs(vf) < .3) vf = 0;
  /* steering: yaw rate limited by grip, less steering lock at speed */
  const lock = .55 / (1 + Math.abs(vf) / 28);
  c.steer = damp(c.steer, inp.steer * lock, 10, dt);
  const yawWant = vf * Math.tan(c.steer) / 2.7, yawMax = muS * G / Math.max(Math.abs(vf), 3) * 1.15;
  const hb = inp.hand && Math.abs(vf) > 8;
  c.yaw = damp(c.yaw, clamp(yawWant, -yawMax * (hb ? 1.9 : 1), yawMax * (hb ? 1.9 : 1)), hb ? 4 : 9, dt);
  c.h += c.yaw * dt;
  /* lateral grip: sideways speed decays, slower on handbrake = drift */
  const grip = hb ? 1.6 : (sp.share < 1 ? 7 : 10) * (off ? .6 : 1);
  vl = damp(vl, 0, grip, dt);
  const nfx = Math.sin(c.h), nfz = Math.cos(c.h), nrx = nfz, nrz = -nfx;
  c.vx = nfx * vf + nrx * vl; c.vz = nfz * vf + nrz * vl;
  c.x += c.vx * dt; c.z += c.vz * dt;
  /* walls */
  const n2 = nearest(tr, c.x, c.z, c.idx, 6), lim = HALF + 7.6;
  if (Math.abs(n2.lat) > lim) {
    const nn = tr.Nn[n2.i], push = (Math.abs(n2.lat) - lim) * Math.sign(n2.lat);
    c.x -= nn.x * push; c.z -= nn.z * push;
    const vn = c.vx * nn.x + c.vz * nn.z;
    if (vn * Math.sign(n2.lat) > 0) { c.vx -= nn.x * vn * 1.4; c.vz -= nn.z * vn * 1.4; c.vx *= .82; c.vz *= .82; c.hit = Math.abs(vn); }
  }
  c.slip = Math.abs(vl); c.vf = vf; c.off = off;
  return near;
}

export async function start(canvas, ui) {
  const S = makeStage(canvas, { exposure: .82, fov: 62, far: 6000, bloom: { strength: .55, radius: .55, threshold: 2.2 } });
  S.scene.environmentIntensity = .6;
  const sky = skyEnv(S, { elev: 7, azim: 240, turbidity: 8, rayleigh: 2.2, scale: 5000 });
  S.scene.fog = new THREE.Fog(0xcfb9a5, 500, 3400);
  const sunL = new THREE.DirectionalLight(0xffd2a1, 3.2); sunL.castShadow = true;
  sunL.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); const sc = sunL.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 10; sc.far = 400; sunL.shadow.bias = -.0004; sunL.shadow.normalBias = .04;
  S.scene.add(sunL, sunL.target); S.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x4a3a28, .45));
  const tr = buildTrack(); const scen = scenery(S, tr); const sk = skids(S.scene);
  const K = keys();

  /* --- UI --- */
  let pause = () => {};
  topBar(ui, () => pause());
  const top = hud(ui, 'rc-top'); const spd = hud(ui, 'rc-spd'); const mini = el('canvas', 'rc-mini'); mini.width = mini.height = 280; ui.append(mini);
  const css = el('style', '', `
  .rc-top{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 62px);display:flex;gap:10px;align-items:center}
  .rc-top span{padding:8px 12px;border-radius:999px;background:rgba(10,10,12,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12)}
  .rc-top b{font-weight:700;color:#e8b46a;margin-left:6px}
  .rc-spd{left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);text-align:center}
  .rc-spd .n{font:400 64px/0.9 'Instrument Serif',serif;letter-spacing:-.02em;text-transform:none}
  .rc-spd .u{font-size:10px;letter-spacing:.3em;color:#bdb6aa}
  .rc-spd .bar{width:150px;height:4px;border-radius:4px;background:rgba(255,255,255,.18);margin:8px auto 0;overflow:hidden}.rc-spd .bar i{display:block;height:100%;background:linear-gradient(90deg,#e8b46a,#ffe6b8);width:0}
  .rc-mini{position:fixed;left:calc(env(safe-area-inset-left,0px) + 14px);top:calc(env(safe-area-inset-top,0px) + 58px);width:140px;height:140px;pointer-events:none!important;border-radius:50%;background:rgba(10,10,12,.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12)}
  .rc-cd{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);font:400 120px 'Instrument Serif',serif;pointer-events:none!important;text-shadow:0 6px 40px rgba(0,0,0,.6)}
  .gk-btn.l{left:calc(env(safe-area-inset-left,0px) + 16px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px);width:84px;height:84px}
  .gk-btn.r{left:calc(env(safe-area-inset-left,0px) + 112px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px);width:84px;height:84px}
  .gk-btn.gas{right:calc(env(safe-area-inset-right,0px) + 16px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px);width:84px;height:84px}
  .gk-btn.brk{right:calc(env(safe-area-inset-right,0px) + 112px);bottom:calc(env(safe-area-inset-bottom,0px) + 22px)}
  .gk-btn.nit{right:calc(env(safe-area-inset-right,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 122px)}
  .gk-btn.drf{right:calc(env(safe-area-inset-right,0px) + 112px);bottom:calc(env(safe-area-inset-bottom,0px) + 112px)}
  @media (max-width:640px){.rc-spd{bottom:auto;top:calc(env(safe-area-inset-top,0px) + 108px);left:auto;right:calc(env(safe-area-inset-right,0px) + 16px);transform:none;text-align:right}.rc-spd .n{font-size:46px}.rc-spd .bar{width:96px;margin-right:0}.rc-mini{width:100px;height:100px;top:calc(env(safe-area-inset-top,0px) + 108px)}.rc-top{gap:6px}.rc-top span{padding:7px 10px}}
  @media (max-width:640px){.rc-pick small{display:none}.rc-pick label{padding:9px 12px}.gk-legend{display:none}}
  @media (max-height:500px){.rc-spd{bottom:calc(env(safe-area-inset-bottom,0px) + 14px)}.rc-mini{width:96px;height:96px}}
  .rc-pick{display:grid;gap:8px;margin:12px 0 4px}
  .rc-pick label{display:flex;align-items:center;gap:12px;padding:11px 14px;border:1px solid rgba(255,255,255,.13);border-radius:14px;cursor:pointer}
  .rc-pick input{accent-color:#e8b46a;width:18px;height:18px;margin:0}
  .rc-pick i{width:14px;height:14px;border-radius:50%;flex:none}.rc-pick small{display:block;color:#9a9387;font:500 10px 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;margin-top:3px}
  .rc-seg{display:flex;gap:6px;margin-top:10px}.rc-seg label{flex:1;text-align:center;padding:9px 0;border:1px solid rgba(255,255,255,.13);border-radius:999px;font:500 11px 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer}
  .rc-seg input{display:none}.rc-seg label:has(input:checked){background:#ece6dc;color:#111}
  `); ui.append(css);
  const T = { steerL: false, steerR: false };
  const bL = btn(ui, '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>', 'touch l');
  const bR = btn(ui, '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>', 'touch r');
  const bG = btn(ui, 'Gas', 'touch gas'), bB = btn(ui, 'Brake', 'touch brk'), bN = btn(ui, 'Nitro', 'touch nit'), bD = btn(ui, 'Drift', 'touch drf');
  const touchEls = [bL, bR, bG, bB, bN, bD].map((b) => b.el);
  const showTouch = (on) => touchEls.forEach((e) => (e.hidden = !on || !TOUCH));
  showTouch(false);

  /* --- race state --- */
  let curKey = 'street', sIn = 0, player, cars = [], phase = 'menu', t0 = 0, now = 0, cam = 0, autoGas = TOUCH, level = 'normal', raceTime = 0;
  const cams = [[6.4, 2.1], [10, 3.6], [0, 0]];
  const grid = (c, slot) => {
    const i = (tr.N - 8 - Math.floor(slot / 2) * 9 + tr.N) % tr.N, p = tr.P[i], nn = tr.Nn[i], side = slot % 2 ? -1 : 1;
    c.x = p.x + nn.x * side * 3.6; c.z = p.z + nn.z * side * 3.6; c.h = Math.atan2(tr.T[i].x, tr.T[i].z); c.vx = c.vz = 0; c.idx = i; c.lap = -1; c.prog = -((tr.N - i) / tr.N); c.half = true; c.done = false; c.nitro = .35; c.yaw = 0; c.steer = 0;
  };
  /* every car on the grid is one of the real models; rivals are the other models plus a second copy of yours in other paint */
  const setup = async (carKey) => {
    const keysAll = Object.keys(CARS), others = [...keysAll.filter((k) => k !== carKey), carKey];
    const tpls = {}; await Promise.all(keysAll.map(async (k) => { tpls[k] = await loadModel(CARS[k]); }));
    cars.forEach((c) => S.scene.remove(c.mesh)); cars = [];
    player = makeCar(CARS[carKey], CARS[carKey].col, true, modelCar(tpls[carKey], CARS[carKey].col));
    const rivalCols = ['#e9e4da', '#9b1d24', '#2c6e49'];
    const rivals = [others[0], others[1], others[2]].map((k, i) => { const c = makeCar(CARS[k], rivalCols[i], false, modelCar(tpls[k], rivalCols[i])); c.ai.off = (i - 1) * 2.4; c.ai.skill = LEVELS[level] * (.97 + i * .02); return c; });
    cars = [rivals[0], rivals[1], rivals[2], player];   // the player starts at the back
    cars.forEach((c, i) => { grid(c, i); S.scene.add(c.mesh); });
  };

  const menu = async () => {
    phase = 'menu'; showTouch(false);
    const saved = best.get('racing') ?? {};
    const body = `<p>Three laps of a 1.9 km circuit at sunset against three rivals. Speed, braking and grip use real car physics. Every car is a real 3D model.</p>
      <div class="rc-pick">${Object.entries(CARS).map(([k, c], i) => `<label><input type="radio" name="car" value="${k}" ${k === curKey ? 'checked' : ''}><i style="background:${c.col}"></i><span>${c.name}<small>${c.tag} · ${c.kg} kg · ${Math.round(c.kw / c.kg * 1000)} W/kg</small></span></label>`).join('')}</div>
      <div class="rc-seg">${Object.keys(LEVELS).map((k) => `<label><input type="radio" name="lv" value="${k}" ${k === level ? 'checked' : ''}>${k}</label>`).join('')}</div>
      ${TOUCH ? `<div class="rc-seg"><label><input type="radio" name="ag" value="1" ${autoGas ? 'checked' : ''}>Auto gas (easy)</label><label><input type="radio" name="ag" value="0" ${autoGas ? '' : 'checked'}>Manual gas</label></div>` : ''}
      ${controlsLegend([['← →', 'Steer'], ['↑ / W', 'Throttle'], ['↓ / S', 'Brake, reverse'], ['Space', 'Handbrake drift'], ['Shift', 'Nitro (fills when you drift)'], ['C', 'Change camera'], ['R', 'Back on track']], [['◀ ▶', 'Steer with your left thumb'], ['Gas · Brake', 'Right thumb'], ['Drift', 'Slide; drifting fills Nitro'], ['Nitro', 'Boost when the bar is full']])}
      <p class="mono" style="font-size:11px;color:#9a9387;margin-top:12px">BEST RACE ${fmtTime(saved.race)} · BEST LAP ${fmtTime(saved.lap)}</p>`;
    const p = card(ui, { kicker: 'World 12 · Racing', title: 'Abidora Circuit', body, buttons: ['Start race'], side: true });
    const box = ui.querySelector('.gk-card');
    let carKey = curKey;
    const preview = async (k) => { curKey = k; try { await setup(k); } catch (e) { console.warn(e); } };
    box.addEventListener('change', () => { const nk = box.querySelector('input[name=car]:checked').value; if (nk !== carKey) { carKey = nk; void preview(nk); } carKey = nk; level = box.querySelector('input[name=lv]:checked').value; const ag = box.querySelector('input[name=ag]:checked'); if (ag) autoGas = ag.value === '1'; });
    await p;
    toast(ui, 'Loading cars…', 3000);
    try { await setup(carKey); } catch (e) { console.warn(e); toast(ui, 'The 3D cars could not load. Check the connection and try again.', 5000); menu(); return; }
    countdown();
  };
  const cdEl = el('div', 'rc-cd'); cdEl.hidden = true; ui.append(cdEl);
  const countdown = () => {
    phase = 'count'; t0 = now; showTouch(true); bG.el.hidden = autoGas || !TOUCH; cdEl.hidden = false;
  };
  const finish = async () => {
    phase = 'done'; showTouch(false); sfx.blip(880, .4, 'triangle', .3);
    const order = [...cars].sort((a, b) => (b.done - a.done) || (a.done ? a.finishT - b.finishT : b.prog - a.prog));
    const posn = order.indexOf(player) + 1;
    const saved = best.get('racing') ?? {}; const newRace = !saved.race || player.finishT < saved.race; const newLap = player.bestLap && (!saved.lap || player.bestLap < saved.lap);
    best.set('racing', { race: newRace ? player.finishT : saved.race, lap: newLap ? player.bestLap : saved.lap });
    const pick = await card(ui, {
      kicker: posn === 1 ? 'Winner' : `Finished P${posn}`, title: posn === 1 ? 'Chequered flag' : ['', '', 'Second place', 'Third place', 'Fourth place'][posn],
      body: `<div class="gk-stats"><div><small>Position</small><b>${posn} / 4</b></div><div><small>Race</small><b>${fmtTime(player.finishT)}</b></div><div><small>Best lap</small><b>${fmtTime(player.bestLap)}</b></div></div>
      ${newRace || newLap ? '<p class="mono" style="font-size:11px;color:#e8b46a;margin-top:12px;letter-spacing:.14em">NEW PERSONAL BEST</p>' : ''}`,
      buttons: ['Race again', 'Change car'],
    });
    if (pick === 0) { cars.forEach((c, i) => grid(c, i)); countdown(); } else menu();
  };
  const loopR = run(frame);
  pause = async () => {
    if (phase !== 'race' && phase !== 'count') return;
    loopR.pause(true); engine.stop(); showTouch(false);
    const c = await card(ui, { kicker: 'Paused', title: 'Pit wall', buttons: ['Resume', 'Restart', 'Menu'] });
    loopR.pause(false); if (c === 0) { showTouch(true); bG.el.hidden = autoGas || !TOUCH; } else if (c === 1) { cars.forEach((c2, i) => grid(c2, i)); countdown(); } else menu();
  };
  onKey((e) => { if (e.code === 'Escape' || e.code === 'KeyP') pause(); if (e.code === 'KeyC') cam = (cam + 1) % cams.length; if (e.code === 'KeyR' && player && phase === 'race') respawn(player); });
  const respawn = (c) => { const p = tr.P[c.idx]; c.x = p.x; c.z = p.z; c.h = Math.atan2(tr.T[c.idx].x, tr.T[c.idx].z); c.vx = c.vz = 0; c.yaw = 0; sk.cut(c.mesh.id * 2); sk.cut(c.mesh.id * 2 + 1); };

  const engine = sfx.hum('sawtooth', 900);
  const camPos = new THREE.Vector3(0, 10, 30), camLook = new THREE.Vector3();
  let stuck = 0, aiInp = { gas: 0, brake: 0, steer: 0, hand: 0, nitro: 0 };

  /* draw the mini map once, then dots every frame */
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity; tr.P.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); });
  const mk = 200 / Math.max(maxX - minX, maxZ - minZ), mx = (x) => 140 + (x - (minX + maxX) / 2) * mk, mz = (z) => 140 + (z - (minZ + maxZ) / 2) * mk;
  const mg = mini.getContext('2d');
  const drawMini = () => {
    mg.clearRect(0, 0, 280, 280); mg.lineWidth = 10; mg.strokeStyle = 'rgba(236,230,220,.28)'; mg.lineJoin = 'round'; mg.beginPath();
    tr.P.forEach((p, i) => (i ? mg.lineTo(mx(p.x), mz(p.z)) : mg.moveTo(mx(p.x), mz(p.z)))); mg.closePath(); mg.stroke();
    mg.lineWidth = 3; mg.strokeStyle = 'rgba(236,230,220,.85)'; mg.stroke();
    for (const c of cars) { mg.fillStyle = c.player ? '#e8b46a' : '#8fb4ff'; mg.beginPath(); mg.arc(mx(c.x), mz(c.z), c.player ? 9 : 6, 0, 7); mg.fill(); if (c.player) { mg.strokeStyle = '#111'; mg.lineWidth = 2; mg.stroke(); } }
  };

  function frame(dt) {
    now += dt; S.watch(dt);
    const racing = phase === 'race';
    /* countdown */
    if (phase === 'count') {
      const k = now - t0, lit = Math.min(5, Math.floor(k / .6));
      scen.lampM.forEach((m, i) => (m.emissiveIntensity = i < lit ? 6 : 0));
      cdEl.textContent = k < 3 ? String(3 - Math.floor(k)) : 'GO';
      if (Math.floor(k) !== Math.floor(k - dt) && k < 3.2) sfx.blip(k < 3 ? 440 : 880, .25, 'square', .18);
      if (k >= 3) { phase = 'race'; raceTime = 0; cars.forEach((c) => (c.lapStart = 0)); scen.lampM.forEach((m) => (m.emissiveIntensity = 0)); setTimeout(() => (cdEl.hidden = true), 600); }
    }
    if (racing) raceTime += dt;
    /* inputs */
    if (player) {
      const left = K.has('ArrowLeft', 'KeyA') || bL.down, right = K.has('ArrowRight', 'KeyD') || bR.down;
      const inp = racing && !player.done ? {
        steer: (sIn = damp(sIn, (left ? 1 : 0) - (right ? 1 : 0), (left || right) ? 5 : 9, dt)),
        gas: (K.has('ArrowUp', 'KeyW') || bG.down || (TOUCH && autoGas && !bB.down)) ? 1 : 0,
        brake: K.has('ArrowDown', 'KeyS') || bB.down,
        hand: K.has('Space') || bD.down, nitro: K.has('ShiftLeft', 'ShiftRight') || bN.down,
      } : { steer: 0, gas: 0, brake: phase === 'done', hand: 0, nitro: 0 };
      if (phase === 'count' || phase === 'menu') { inp.gas = 0; }
      for (const c of cars) {
        let u = inp;
        if (!c.player) {
          /* rival driver: aim at a point ahead, slow for curvature, small racing-line offset */
          const look = Math.round(10 + Math.hypot(c.vx, c.vz) * .5), j = (c.idx + look) % tr.N, tp = tr.P[j], nn = tr.Nn[j];
          const tx = tp.x + nn.x * c.ai.off, tz = tp.z + nn.z * c.ai.off;
          let want = Math.atan2(tx - c.x, tz - c.z) - c.h; want = Math.atan2(Math.sin(want), Math.cos(want));
          let kmax = 0; for (let a = 0; a < 90; a += 6) kmax = Math.max(kmax, tr.K[(c.idx + a) % tr.N]);
          const vmax = Math.sqrt(c.spec.mu * G / Math.max(kmax, 1e-4)) * c.ai.skill * 1.05, v = Math.hypot(c.vx, c.vz);
          /* gentle rubber band so a race stays close */
          const gap = player.prog - c.prog, band = clamp(1 + gap * 1.6, .9, 1.1);
          aiInp = { steer: clamp(want * 2.6, -1, 1), gas: racing && v < vmax * band ? 1 : 0, brake: racing && v > vmax * band * 1.08, hand: 0, nitro: 0 };
          if (!racing || c.done) aiInp = { steer: c.done ? clamp(want * 2, -1, 1) : 0, gas: c.done && v < 18 ? 1 : 0, brake: !c.done && phase !== 'race', hand: 0, nitro: 0 };
          u = aiInp;
        }
        const pIdx = c.idx; stepCar(c, u, dt, tr);
        /* car-to-car contact */
        for (const o of cars) if (o !== c) { const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz); if (d < 2.4 && d > 0) { const k2 = (2.4 - d) / 2; c.x += dx / d * k2; c.z += dz / d * k2; } }
        /* lap counting */
        const di = c.idx - pIdx;
        if (di < -tr.N / 2) { if (c.half && racing) { c.lap++; c.half = false; if (c.player) onLap(c); else if (c.lap >= 3 && !c.done) { c.done = true; c.finishT = raceTime; } } }
        else if (di > tr.N / 2) c.lap--;
        if (c.idx > tr.N * .45 && c.idx < tr.N * .55) c.half = true;
        c.prog = c.lap + c.idx / tr.N;
        /* skid marks when sliding */
        const sl = clamp((c.slip - 2.2) / 6, 0, 1) * (c.off ? 0 : 1);
        if (c.player && u.hand && Math.abs(c.vf) > 10) c.nitro = Math.min(1, c.nitro + dt * .22);
        for (const s of [-.98, .98]) { const fx = Math.sin(c.h), fz = Math.cos(c.h); const wx = c.x + fz * s - fx * 1.42, wz = c.z - fx * s - fz * 1.42; sk.add(c.mesh.id * 2 + (s > 0 ? 1 : 0), wx, wz, fz, -fx, sl); }
        if (sl > .3 && c.player && Math.random() < dt * 8) sfx.noise(.12, .05 * sl, 1200);
        if (c.hit && c.player) { sfx.noise(.2, clamp(c.hit / 20, .05, .4), 500); c.hit = 0; } else c.hit = 0;
        /* mesh */
        c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.h;
        c.mesh.rotation.z = damp(c.mesh.rotation.z, -c.yaw * Math.abs(c.vf) * .0045, 6, dt);
        c.mesh.rotation.x = damp(c.mesh.rotation.x, -(u.gas ? .012 : 0) + (u.brake ? .02 : 0), 5, dt);
        for (const w of c.mesh.userData.wheels) { w.spin.rotation.x += c.vf * dt / .36; if (w.front) w.piv.rotation.y = c.steer; }
      }
      if (racing && player.off && Math.hypot(player.vx, player.vz) < 2 && inp.gas) { stuck += dt; if (stuck > 2.5) { respawn(player); stuck = 0; toast(ui, 'Back on track'); } } else stuck = 0;

      /* camera */
      const v = Math.hypot(player.vx, player.vz), fx = Math.sin(player.h), fz = Math.cos(player.h);
      if (cam === 2) { camPos.set(player.x + fx * .2, 1.15, player.z + fz * .2); camLook.set(player.x + fx * 20, 1.0, player.z + fz * 20); S.camera.position.copy(camPos); }
      else {
        const [dist, hgt] = phase === 'menu' ? [9 + Math.sin(now * .2) * 2, 2.8] : cams[cam];
        const ang = phase === 'menu' ? player.h + now * .25 : player.h;
        const want = new THREE.Vector3(player.x - Math.sin(ang) * dist, hgt + (phase === 'menu' ? .4 : 0), player.z - Math.cos(ang) * dist);
        camPos.x = damp(camPos.x, want.x, 6, dt); camPos.y = damp(camPos.y, want.y, 6, dt); camPos.z = damp(camPos.z, want.z, 6, dt);
        const ahead = phase === 'menu' ? 2 : 16 + clamp(v * .25, 0, 14); camLook.set(player.x + fx * ahead, phase === 'menu' ? 1.1 : 1.6, player.z + fz * ahead); S.camera.position.copy(camPos);
      }
      S.camera.lookAt(camLook);
      if (phase === 'menu' && S.w >= 900) S.camera.setViewOffset(S.w, S.h, -S.w * .2, 0, S.w, S.h); else if (S.camera.view) S.camera.clearViewOffset();
      S.camera.fov = damp(S.camera.fov, 60 + clamp(v / 85, 0, 1) * 16 + (inp.nitro && player.nitro > 0 ? 6 : 0), 3, dt); S.camera.updateProjectionMatrix();
      sunL.position.set(player.x + sky.sun.x * 160, sky.sun.y * 160, player.z + sky.sun.z * 160); sunL.target.position.set(player.x, 0, player.z);
      /* HUD + engine note */
      const kmh = Math.abs(player.vf) * 3.6;
      if (phase !== 'menu') engine.set(55 + (kmh % 90) * 2.2 + kmh * .5, .06 + inp.gas * .05); else engine.stop();
      const order = [...cars].sort((a, b) => (b.done - a.done) || (a.done ? a.finishT - b.finishT : b.prog - a.prog));
      top.innerHTML = phase === 'menu' ? '' : `<span>Lap<b>${clamp(player.lap + 1, 1, 3)}/3</b></span><span>Pos<b>${order.indexOf(player) + 1}/4</b></span><span>${fmtTime(raceTime)}</span>`;
      spd.innerHTML = phase === 'menu' ? '' : `<div class="n">${Math.round(kmh)}</div><div class="u">km/h</div><div class="bar"><i style="width:${player.nitro * 100}%"></i></div>`;
      drawMini();
    }
    S.render();
  }
  function onLap(c) {
    if (c.lap === 0) { c.lapStart = raceTime; return; }
    const lt = raceTime - c.lapStart; c.lapStart = raceTime;
    if (c.lap >= 1) { if (!c.bestLap || lt < c.bestLap) c.bestLap = lt; }
    if (c.lap >= 3) { c.done = true; c.finishT = raceTime; finish(); return; }
    toast(ui, `Lap ${c.lap + 1} / 3 · ${fmtTime(lt)}`); sfx.blip(660, .2, 'triangle', .25);
  }
  /* idle car for the menu backdrop */
  setup(curKey).then(() => cars.forEach((c) => { c.mesh.position.set(c.x, 0, c.z); c.mesh.rotation.y = c.h; })).catch((e) => console.warn(e));
  menu();
}
