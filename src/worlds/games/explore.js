/* World 13 · Open Exploration: Isle of Abidora.
   A 1.4 km island made in code (fractal terrain, sea with reflections, forests, rocks, a lighthouse, ruins and a pier).
   Fly a hover drone anywhere, follow the compass and recover eight light shards hidden at landmarks.
   Time of day changes the sky, sun and light on everything. */
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { onKey, makeStage, skyEnv, keys, stick, btn, dragLook, card, hud, toast, controlsLegend, best, fmtTime, sfx, run, topBar, el, TOUCH, clamp, lerp, damp, rng, noise2, canvasTex } from './gkit.js';

const R = 620;                      // island radius, m
const n1 = noise2(42), n2 = noise2(7);
const PEAK = [120, -80];
export function H(x, z) {
  const d = Math.hypot(x, z) / R + n2.fbm(x / 500, z / 500, 3) * .22;
  const mask = clamp((1 - d) / .55, 0, 1), m = mask * mask * (3 - 2 * mask);
  const hills = Math.pow(n1.fbm(x / 260, z / 260, 6) * .5 + .5, 1.7) * 95;
  const pk = Math.exp(-((x - PEAK[0]) ** 2 + (z - PEAK[1]) ** 2) / (2 * 150 * 150)) * 150;
  const ridge = (1 - Math.abs(n2(x / 140, z / 140))) ** 3 * 22;
  return m * (hills + pk + ridge * m + 6) - (1 - m) * 26 - 4;
}
function normalAt(x, z) { const e = 1.5; return new THREE.Vector3(H(x - e, z) - H(x + e, z), 2 * e, H(x, z - e) - H(x, z + e)).normalize(); }

/* tileable wave normals for the sea, drawn from integer-frequency sines so the edges meet */
function waterNormals() {
  return canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data, waves = [];
    const r = rng(9); for (let i = 0; i < 28; i++) waves.push([Math.round((r() - .5) * 18), Math.round((r() - .5) * 18), r() * 6.28, .3 + r()]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0;
      for (const [fx, fy, ph, a] of waves) { if (!fx && !fy) continue; const k = (fx * x / w + fy * y / h) * 6.2832 + ph, c = Math.cos(k) * a / Math.hypot(fx, fy); dx += c * fx; dy += c * fy; }
      const nx = -dx * .05, ny = -dy * .05, l = Math.hypot(nx, ny, 1), i = (y * w + x) * 4;
      d[i] = (nx / l * .5 + .5) * 255; d[i + 1] = (ny / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, false);
}
function detailTex() {
  const r = rng(4);
  const t = canvasTex(512, 512, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data, n = noise2(3);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 200 + n.fbm(x / 24, y / 24, 4) * 40 + r() * 30; const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = clamp(v, 0, 255); d[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160); return t;
}

const PLACES = [
  { name: 'Summit Cairn', fact: 'The highest point of the island. Air here is cooler: about 6.5 °C less for every kilometre you climb.', at: () => [PEAK[0] + 6, PEAK[1] - 4] },
  { name: 'The Lighthouse', fact: 'Lighthouses flash in a unique pattern so ships can tell them apart at night.', at: () => [-430, 230] },
  { name: 'Old Ruins', fact: 'Columns carry weight in compression; that is why stone temples could stand for thousands of years.', at: () => [-120, 150] },
  { name: 'Long Pier', fact: 'Waves slow down in shallow water, so they bend to meet the beach almost head-on.', at: () => [360, 330] },
  { name: 'Standing Stones', fact: 'Many ancient stone circles line up with the sunrise on the longest or shortest day of the year.', at: () => [250, -330] },
  { name: 'Pine Hollow', fact: 'A mature tree can move hundreds of litres of water from soil to air on a hot day.', at: () => [-260, -190] },
  { name: 'Sea Arch', fact: 'Arches form when waves erode both sides of a headland until they break through.', at: () => [-40, -560] },
  { name: 'Hidden Lagoon', fact: 'Lagoons are shallow, sheltered water: warmer and calmer than the open sea.', at: () => [470, -60] },
];

export async function start(canvas, ui) {
  const S = makeStage(canvas, { exposure: .78, fov: 60, far: 9000, near: .3, bloom: { strength: .45, radius: .5, threshold: 2.2 } });
  S.scene.environmentIntensity = .45;
  const sky = skyEnv(S, { elev: 14, azim: 150, turbidity: 5, rayleigh: 1.4, scale: 8000 });
  S.scene.fog = new THREE.FogExp2(0xbcd0de, .00055);
  const sunL = new THREE.DirectionalLight(0xfff0d8, 3.4); sunL.castShadow = true;
  sunL.shadow.mapSize.set(TOUCH ? 1024 : 2048, TOUCH ? 1024 : 2048); const sc = sunL.shadow.camera; sc.left = sc.bottom = -70; sc.right = sc.top = 70; sc.near = 10; sc.far = 600; sunL.shadow.bias = -.0005; sunL.shadow.normalBias = .06;
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x4a3a22, .3);
  S.scene.add(sunL, sunL.target, hemi);

  /* --- terrain --- */
  const SEG = TOUCH ? 230 : 300, SIZE = 1700;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG); tg.rotateX(-Math.PI / 2);
  const tp = tg.attributes.position, tc = new Float32Array(tp.count * 3), c = new THREE.Color();
  const sand = new THREE.Color(.86, .78, .6), grass = new THREE.Color(.3, .42, .14), grass2 = new THREE.Color(.46, .48, .2), rock = new THREE.Color(.45, .42, .4), snow = new THREE.Color(1.6, 1.6, 1.7), wet = new THREE.Color(.42, .38, .3);
  for (let i = 0; i < tp.count; i++) {
    const x = tp.getX(i), z = tp.getZ(i), y = H(x, z); tp.setY(i, y);
    const sl = 1 - normalAt(x, z).y, v = n1(x / 40, z / 40) * .5 + .5;
    c.copy(y < 0 ? wet : y < 4 ? sand : grass).lerp(grass2, y > 4 ? v * .6 : 0);
    if (y > 2.5 && y < 5) c.lerp(sand, (5 - y) / 2.5);
    c.lerp(rock, clamp((sl - .22) * 4, 0, 1)); c.lerp(rock, clamp((y - 120) / 40, 0, 1) * .7); c.lerp(snow, clamp((y - 175) / 20, 0, 1) * clamp(1 - sl * 2.5, 0, 1));
    tc.set([c.r, c.g, c.b], i * 3);
  }
  tg.setAttribute('color', new THREE.BufferAttribute(tc, 3)); tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTex(), roughness: .92 }));
  terrain.receiveShadow = true; terrain.castShadow = true; S.scene.add(terrain);

  /* --- sea --- */
  const water = new Water(new THREE.PlaneGeometry(9000, 9000), {
    textureWidth: TOUCH ? 512 : 1024, textureHeight: TOUCH ? 512 : 1024, waterNormals: (() => { const t = waterNormals(); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })(),
    sunDirection: sky.sun.clone(), sunColor: 0xfff2dd, waterColor: 0x0b3a4a, distortionScale: 2.6, fog: true,
  });
  water.rotation.x = -Math.PI / 2;
  { const orig = water.onBeforeRender.bind(water); water.onBeforeRender = (...a) => { forests.forEach((f) => (f.visible = false)); rocks.visible = false; orig(...a); forests.forEach((f) => (f.visible = true)); rocks.visible = true; }; } water.material.uniforms.size.value = 6; S.scene.add(water);

  /* --- vegetation and rocks (instanced) --- */
  const r = rng(77), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const pine = (() => { const parts = [new THREE.CylinderGeometry(.25, .4, 3, 6).translate(0, 1.5, 0), new THREE.ConeGeometry(2.6, 5, 9).translate(0, 4.6, 0), new THREE.ConeGeometry(2, 4.2, 9).translate(0, 7, 0), new THREE.ConeGeometry(1.3, 3.4, 9).translate(0, 9.2, 0)]; return parts; })();
  const broad = [new THREE.CylinderGeometry(.3, .45, 3.4, 6).translate(0, 1.7, 0), new THREE.IcosahedronGeometry(2.8, 1).translate(0, 5.2, 0), new THREE.IcosahedronGeometry(2.1, 1).translate(1.5, 4.4, .6)];
  /* each tree is one merged mesh (bark + leaves via vertex colour), so a forest is a single draw call */
  const merge = (parts) => { const gs = parts.map(([g, c]) => { const n = g.index ? g.toNonIndexed() : g; const cc = new Float32Array(n.attributes.position.count * 3); for (let i = 0; i < cc.length; i += 3) cc.set(c, i); n.setAttribute('color', new THREE.BufferAttribute(cc, 3)); n.deleteAttribute('uv'); return n; }); return mergeGeometries(gs); };
  const BARK = [.32, .22, .16], LEAF = [1, 1, 1];
  const pineG = merge(pine.map((g, i) => [g, i ? LEAF : BARK])), broadG = merge(broad.map((g, i) => [g, i ? LEAF : BARK]));
  const treeM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, flatShading: true });
  const forests = [];
  const plant = (geo, count, ok, scale) => {
    const m = new THREE.InstancedMesh(geo, treeM, count); m.castShadow = true; m.receiveShadow = true; S.scene.add(m); forests.push(m);
    let k = 0, tries = 0;
    while (k < count && tries++ < count * 30) {
      const x = (r() - .5) * 1300, z = (r() - .5) * 1300, y = H(x, z); if (!ok(x, z, y)) continue;
      const s = scale * (.7 + r() * .6); q.setFromAxisAngle(up, r() * 6.3); sv.set(s, s * (.8 + r() * .5), s); pv.set(x, y - .3, z); m4.compose(pv, q, sv);
      col.setHSL(.22 + r() * .1, .35 + r() * .25, .2 + r() * .12); m.setMatrixAt(k, m4); m.setColorAt(k, col); k++;
    }
    m.count = k;
  };
  const slope = (x, z) => 1 - normalAt(x, z).y;
  plant(pineG, TOUCH ? 1100 : 1700, (x, z, y) => y > 8 && y < 150 && slope(x, z) < .25 && n1(x / 90, z / 90) > -.15, 1);
  plant(broadG, TOUCH ? 450 : 700, (x, z, y) => y > 5 && y < 70 && slope(x, z) < .18 && n2(x / 70, z / 70) > 0, 1);
  const rockG = new THREE.DodecahedronGeometry(1.6, 1); { const p = rockG.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(1 + n1(v.x * 2 + 5, v.z * 2 + v.y) * .25); p.setXYZ(i, v.x, v.y * .7, v.z); } rockG.computeVertexNormals(); }
  const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: 0x8a837a, roughness: .9, flatShading: true }), 900); rocks.castShadow = rocks.receiveShadow = true; S.scene.add(rocks);
  { let k = 0, t = 0; while (k < 900 && t++ < 40000) { const x = (r() - .5) * 1300, z = (r() - .5) * 1300, y = H(x, z); if (y < -1 || (slope(x, z) < .2 && r() > .15)) continue; const s = .5 + r() * 2.4; q.setFromEuler(new THREE.Euler(r(), r() * 6, r())); sv.set(s, s, s); pv.set(x, y, z); m4.compose(pv, q, sv); rocks.setMatrixAt(k++, m4); } rocks.count = k; }

  /* --- landmarks --- */
  const stone = new THREE.MeshStandardMaterial({ color: 0xc9bfae, roughness: .85 }), wood = new THREE.MeshStandardMaterial({ color: 0x6b4a31, roughness: .9 });
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; S.scene.add(mesh); return mesh; };
  /* lighthouse */
  { const [x, z] = PLACES[1].at(), y = H(x, z); const strip = canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#b8322a' : '#f1ede4'; g.fillRect(0, i * h / 8, w, h / 8); } });
    add(new THREE.Mesh(new THREE.CylinderGeometry(3, 4.6, 30, 32), new THREE.MeshStandardMaterial({ map: strip, roughness: .6 })), x, y + 15, z);
    add(new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 1, 32), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: .8, roughness: .4 })), x, y + 30.5, z);
    const lamp = add(new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 3.2, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 3 })), x, y + 32.6, z); lamp.castShadow = false;
    add(new THREE.Mesh(new THREE.ConeGeometry(3.2, 3, 24), new THREE.MeshStandardMaterial({ color: 0x1d1d1f, metalness: .6, roughness: .4 })), x, y + 35.7, z);
    add(new THREE.Mesh(new THREE.BoxGeometry(9, 5, 7), stone), x + 8, y + 2.2, z + 2); }
  /* ruins: a ring of columns, some broken */
  { const [x, z] = PLACES[2].at(), y = H(x, z); add(new THREE.Mesh(new THREE.CylinderGeometry(14, 15, 1.4, 40), stone), x, y + .2, z);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, hh = [9, 9, 4, 9, 6, 9, 9, 2.5, 9, 9, 5, 9][i]; const col2 = add(new THREE.Mesh(new THREE.CylinderGeometry(.75, .85, hh, 20), stone), x + Math.cos(a) * 11, y + .9 + hh / 2, z + Math.sin(a) * 11); col2.rotation.z = hh < 9 ? (r() - .5) * .1 : 0; if (hh === 9) add(new THREE.Mesh(new THREE.BoxGeometry(2.2, .6, 2.2), stone), col2.position.x, y + .9 + 9.3, col2.position.z); }
    const lintel = add(new THREE.Mesh(new THREE.BoxGeometry(12, 1, 2), stone), x + 6, y + 10.9, z - 8); lintel.rotation.y = .5; }
  /* pier */
  { const [x, z] = PLACES[3].at(); const ang = Math.atan2(x, z); const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ang; S.scene.add(g);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(5, .4, 80), wood); deck.position.set(0, 2.6, 30); deck.castShadow = deck.receiveShadow = true; g.add(deck);
    for (let i = 0; i < 16; i++) for (const s of [-2.2, 2.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, 8, 8), wood); p.position.set(s, -1.2, -8 + i * 5.2); g.add(p); } }
  /* standing stones */
  { const [x, z] = PLACES[4].at(), y = H(x, z); for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const st = add(new THREE.Mesh(new THREE.BoxGeometry(2, 6 + r() * 3, 1.2), stone), x + Math.cos(a) * 12, H(x + Math.cos(a) * 12, z + Math.sin(a) * 12) + 2.8, z + Math.sin(a) * 12); st.rotation.y = -a; st.rotation.z = (r() - .5) * .12; } }
  /* sea arch */
  { const [x, z] = PLACES[6].at(); const arch = new THREE.Mesh(new THREE.TorusGeometry(16, 6, 12, 32, Math.PI), new THREE.MeshStandardMaterial({ color: 0x8e7f6c, roughness: .95, flatShading: true }));
    const p = arch.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); const k = 1 + n1(v.x * .15, v.y * .15 + v.z * .1) * .18; p.setXYZ(i, v.x * k, v.y * k, v.z * k); } arch.geometry.computeVertexNormals();
    add(arch, x, -4, z); arch.rotation.y = .4; }

  /* --- light shards: glowing crystals with a column of light visible from afar --- */
  const shardM = new THREE.MeshPhysicalMaterial({ color: 0xffe2b0, emissive: 0xe8b46a, emissiveIntensity: 2.2, metalness: 0, roughness: .1, transmission: .3, thickness: 1, iridescence: .6 });
  const beamM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vu; void main(){ vu=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vu; uniform float t; void main(){ float a=(1.-vu.y)*.45*(.8+.2*sin(t*2.+vu.y*12.)); a*=smoothstep(0.,.5,1.-abs(vu.x-.5)*2.); gl_FragColor=vec4(1.,.78,.45,a); }' });
  const shards = PLACES.map((p, i) => {
    const [x, z] = p.at(), y = Math.max(H(x, z), 2.5) + (i === 3 ? 4 : 2.6) + (i === 6 ? 24 : 0);
    const g = new THREE.Group(); g.position.set(x, y, z); S.scene.add(g);
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), shardM); m.scale.y = 1.8; g.add(m);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 260, 16, 1, true), beamM); beam.position.y = 130; g.add(beam);
    const pl = new THREE.PointLight(0xffc887, 30, 22, 2); g.add(pl);
    return { ...p, g, m, found: false, x, y, z };
  });

  /* --- soft clouds (sprites) --- */
  const cloudT = canvasTex(256, 256, (g, w, h) => { for (let i = 0; i < 14; i++) { const x = 60 + Math.random() * 136, y = 90 + Math.random() * 76, rr = 40 + Math.random() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } });
  for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudT, transparent: true, depthWrite: false, fog: false, opacity: .9 })); const a = r() * 6.28, d = 500 + r() * 1800; sp.position.set(Math.cos(a) * d, 260 + r() * 200, Math.sin(a) * d); sp.scale.set(420 + r() * 300, 200 + r() * 120, 1); S.scene.add(sp); }

  /* --- the drone --- */
  const drone = new THREE.Group(); S.scene.add(drone);
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xcfc9bf, metalness: .1, roughness: .38, clearcoat: 1, clearcoatRoughness: .05 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: .6, roughness: .35 });
  const glowM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8b46a, emissiveIntensity: 3 });
  const bodyD = new THREE.Mesh(new THREE.SphereGeometry(.9, 40, 24), shell); bodyD.scale.set(1, .55, 1.35); bodyD.castShadow = true; drone.add(bodyD);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.42, 32, 16, 0, 6.283, 0, 1.4), new THREE.MeshPhysicalMaterial({ color: 0x0a0c10, metalness: .5, roughness: .05, clearcoat: 1 })); eye.position.set(0, .05, .95); eye.rotation.x = Math.PI / 2; drone.add(eye);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.95, .05, 12, 48), glowM); ring.rotation.x = Math.PI / 2; ring.scale.set(1, 1.35, 1); drone.add(ring);
  const rotors = [];
  for (const [x, z] of [[-1.25, .9], [1.25, .9], [-1.25, -.9], [1.25, -.9]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.9, .08, .14), darkM); arm.position.set(x * .6, 0, z * .7); arm.rotation.y = Math.atan2(z, x); drone.add(arm);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(.48, .48, .12, 28, 1, true), darkM); hub.position.set(x, .02, z); drone.add(hub);
    const blade = new THREE.Mesh(new THREE.CircleGeometry(.45, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .12, depthWrite: false })); blade.rotation.x = -Math.PI / 2; blade.position.set(x, .05, z); drone.add(blade); rotors.push(blade);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), glowM); tip.position.set(x, -.04, z); drone.add(tip);
  }
  const dL = new THREE.PointLight(0xffd59c, 6, 9, 2); dL.position.y = -.6; drone.add(dL);

  /* --- input + UI --- */
  const K = keys();
  const css = el('style', '', `
  .ex-top{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 62px);text-align:center}
  .ex-comp{width:min(420px,70vw);height:30px;position:relative;margin:0 auto;border-radius:999px;background:rgba(10,10,12,.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.14);overflow:hidden}
  .ex-comp span{position:absolute;top:8px;font-size:10px;transform:translateX(-50%);color:#bdb6aa}.ex-comp span.c{color:#ece6dc;font-weight:700}
  .ex-comp i{position:absolute;top:4px;width:22px;height:22px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,#ffe8c2,#e8b46a 55%,rgba(232,180,106,0) 72%)}
  .ex-comp::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:1.5px;background:#ece6dc}
  .ex-info{margin-top:8px;display:inline-flex;gap:10px}.ex-info span{padding:7px 12px;border-radius:999px;background:rgba(10,10,12,.5);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12)}.ex-info b{color:#e8b46a;margin-left:6px}
  .ex-found{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 26px);transform:translate(-50%,20px);opacity:0;transition:.5s;width:min(440px,calc(100vw - 32px));padding:16px 18px;border-radius:18px;background:rgba(12,12,14,.7);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,.14);pointer-events:none!important}
  .ex-found.in{opacity:1;transform:translate(-50%,0)}.ex-found p{margin:0;font-size:13.5px;line-height:1.5;color:#cfc8bc}.ex-found h3{margin:2px 0 6px;font:400 26px 'Instrument Serif',serif}
  .ex-found small{font:500 10px 'JetBrains Mono',monospace;letter-spacing:.2em;color:#e8b46a}
  @media (pointer:coarse){.ex-found{bottom:auto;top:calc(env(safe-area-inset-top,0px) + 150px)}}
  .gk-btn.up{right:calc(env(safe-area-inset-right,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 112px)}
  .gk-btn.dn{right:calc(env(safe-area-inset-right,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 28px)}
  .gk-btn.bo{right:calc(env(safe-area-inset-right,0px) + 108px);bottom:calc(env(safe-area-inset-bottom,0px) + 50px)}
  .ex-tod{position:fixed;right:calc(env(safe-area-inset-right,0px) + 12px);top:calc(env(safe-area-inset-top,0px) + 58px);display:flex;flex-direction:column;gap:6px}
  `); ui.append(css);
  let pause = () => {};
  const bar = topBar(ui, () => pause());
  const todB = el('button', 'gk-ic', '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'); todB.type = 'button'; todB.setAttribute('aria-label', 'Time of day'); bar.prepend(todB);
  const top = hud(ui, 'ex-top'); top.innerHTML = '<div class="ex-comp"></div><div class="ex-info"></div>';
  const comp = top.querySelector('.ex-comp'), info = top.querySelector('.ex-info');
  const found = el('div', 'ex-found'); ui.append(found);
  const st = stick(ui, { side: 'left' });
  const look = dragLook(canvas, { ignore: (e) => { if (e.pointerType !== 'touch') return false; const r = canvas.getBoundingClientRect(); return e.clientX - r.left < r.width * .46 && e.clientY - r.top > r.height * .48; } });
  const bUp = btn(ui, '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>', 'touch up'), bDn = btn(ui, '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>', 'touch dn'), bBo = btn(ui, 'Boost', 'touch bo');
  const touchEls = [st.el, bUp.el, bDn.el, bBo.el]; const showTouch = (on) => touchEls.forEach((e) => (e.hidden = !on || !TOUCH)); showTouch(false);

  /* time of day presets */
  const TOD = [['Morning', 14, 150, 5, 1.4, .78, 0xbcd0de], ['Golden hour', 4.5, 250, 9, 2.6, .7, 0xd9b48f], ['Noon', 58, 180, 3, 1, .62, 0xcfe0ec], ['Blue hour', -1.5, 260, 2, 3.2, 1.1, 0x40506e]];
  let tod = 0;
  const setTod = (i) => {
    tod = i; const [name, elev, az, turb, ray, exp, fog] = TOD[i];
    sky.sky.material.uniforms.turbidity.value = turb; sky.sky.material.uniforms.rayleigh.value = ray; sky.set(elev, az);
    S.renderer.toneMappingExposure = exp; S.scene.fog.color.setHex(fog);
    sunL.intensity = elev > 0 ? 3.4 * clamp(elev / 12, .35, 1) : .0; sunL.color.setHSL(.09, elev < 8 ? .8 : .3, .75);
    hemi.intensity = elev > 0 ? .3 : .25; water.material.uniforms.sunDirection.value.copy(sky.sun).normalize();
    shardM.emissiveIntensity = elev > 6 ? 2.2 : 4; return name;
  };
  todB.onclick = () => toast(ui, setTod((tod + 1) % TOD.length));
  setTod(0);

  /* --- state --- */
  const START = [-400, 330];
  const P = { x: START[0], y: Math.max(H(START[0], START[1]), 0) + 24, z: START[1], vx: 0, vy: 0, vz: 0, yaw: 0, camYaw: Math.atan2(START[0], START[1]), camPitch: .18, camDist: 10 };
  P.yaw = P.camYaw + Math.PI; let snap = true;
  let phase = 'menu', time = 0, count = 0, now = 0, fadeT = 0;
  const reset = () => { Object.assign(P, { x: START[0], y: Math.max(H(START[0], START[1]), 0) + 24, z: START[1], vx: 0, vy: 0, vz: 0 }); P.camYaw = Math.atan2(P.x, P.z); P.yaw = P.camYaw + Math.PI; snap = true; shards.forEach((s) => { s.found = false; s.g.visible = true; }); count = 0; time = 0; };
  const menu = async () => {
    phase = 'menu'; showTouch(false);
    const b = best.get('explore');
    await card(ui, { kicker: 'World 13 · Open Exploration', title: 'Isle of Abidora', side: true,
      body: `<p>An island built entirely in code: mountains, forests, beaches and a living sea. Fly anywhere. Eight light shards are hidden at landmarks; the compass points to the nearest one.</p>
      ${controlsLegend([['W A S D', 'Fly'], ['Mouse drag', 'Look around'], ['Space / E', 'Rise'], ['Q / Ctrl', 'Descend'], ['Shift', 'Boost'], ['T', 'Time of day']], [['Left thumb', 'Fly in any direction'], ['Drag right side', 'Look around'], ['▲ ▼', 'Rise and descend'], ['Boost', 'Fly faster']])}
      <p class="mono" style="font-size:11px;color:#9a9387;margin-top:12px">BEST TIME FOR ALL 8 · ${fmtTime(b)}</p>`, buttons: ['Explore'] });
    reset(); phase = 'play'; showTouch(true);
  };
  pause = async () => { if (phase !== 'play') return; loopR.pause(true); showTouch(false); const c = await card(ui, { kicker: 'Paused', title: 'Hovering', buttons: ['Resume', 'Start over'] }); loopR.pause(false); if (c === 1) reset(); showTouch(true); };
  onKey((e) => { if (e.code === 'Escape' || e.code === 'KeyP') pause(); if (e.code === 'KeyT') todB.click(); });
  const hum = sfx.hum('triangle', 500);
  const camPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  const loopR = run((dt) => {
    now += dt; S.watch(dt); beamM.uniforms.t.value = now;
    const play = phase === 'play';
    /* look */
    const [lx, ly, wh] = look.take();
    P.camYaw -= lx * .0055; P.camPitch = clamp(P.camPitch + ly * .004, -.35, 1.2); P.camDist = clamp(P.camDist + wh * .01, 6, 28);
    if (!play) P.camYaw += dt * .04;
    /* move relative to the camera */
    let mx = (K.has('KeyD', 'ArrowRight') ? 1 : 0) - (K.has('KeyA', 'ArrowLeft') ? 1 : 0) + st.x, mz = (K.has('KeyW', 'ArrowUp') ? 1 : 0) - (K.has('KeyS', 'ArrowDown') ? 1 : 0) - st.y;
    const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
    if (!play) mx = mz = 0;
    const boost = (K.has('ShiftLeft', 'ShiftRight') || bBo.down) ? 2.4 : 1, speed = 22 * boost;
    const fx = -Math.sin(P.camYaw), fz = -Math.cos(P.camYaw);
    const wx = (fx * mz + -fz * mx) * speed, wz = (fz * mz + fx * mx) * speed;
    P.vx = damp(P.vx, wx, 2.2, dt); P.vz = damp(P.vz, wz, 2.2, dt);
    const rise = play ? (K.has('Space', 'KeyE') || bUp.down ? 1 : 0) - (K.has('KeyQ', 'ControlLeft') || bDn.down ? 1 : 0) : 0;
    P.vy = damp(P.vy, rise * 16 * (boost > 1 ? 1.5 : 1), 3, dt);
    P.x += P.vx * dt; P.z += P.vz * dt; P.y += P.vy * dt;
    const ground = Math.max(H(P.x, P.z), .4) + 2.2; if (P.y < ground) { P.y = damp(P.y, ground, 12, dt); if (P.vy < 0) P.vy = 0; }
    P.y = Math.min(P.y, 420); const lim = 1500, d = Math.hypot(P.x, P.z); if (d > lim) { P.x *= lim / d; P.z *= lim / d; }
    const hs = Math.hypot(P.vx, P.vz); if (hs > 1) P.yaw = Math.atan2(P.vx, P.vz);
    drone.position.set(P.x, P.y + Math.sin(now * 2.2) * .12, P.z);
    drone.rotation.y += Math.atan2(Math.sin(P.yaw - drone.rotation.y), Math.cos(P.yaw - drone.rotation.y)) * Math.min(1, dt * 5);
    drone.rotation.x = damp(drone.rotation.x, clamp(hs / 60, 0, .35), 4, dt); drone.rotation.z = damp(drone.rotation.z, 0, 4, dt);
    rotors.forEach((b, i) => (b.material.opacity = .1 + Math.sin(now * 60 + i) * .03));
    if (play) hum.set(90 + hs * 3 + Math.abs(P.vy) * 4, .04 + hs * .0012); else hum.stop();
    /* camera follows, never under the ground */
    const cd = P.camDist, cp = P.camPitch;
    tmp.set(P.x + Math.sin(P.camYaw) * Math.cos(cp) * cd, P.y + Math.sin(cp) * cd + 1.5, P.z + Math.cos(P.camYaw) * Math.cos(cp) * cd);
    tmp.y = Math.max(tmp.y, Math.max(H(tmp.x, tmp.z), .3) + 1.4);
    camPos.lerp(tmp, 1 - Math.exp(-10 * dt)); if (snap) { camPos.copy(tmp); snap = false; }
    S.camera.position.copy(camPos); S.camera.lookAt(P.x, P.y + 1.2, P.z);
    if (phase === 'menu' && S.w >= 900) S.camera.setViewOffset(S.w, S.h, -S.w * .2, 0, S.w, S.h); else if (S.camera.view) S.camera.clearViewOffset();
    sunL.position.set(P.x + sky.sun.x * 300, Math.max(sky.sun.y, .05) * 300, P.z + sky.sun.z * 300); sunL.target.position.set(P.x, P.y, P.z);
    water.material.uniforms.time.value += dt * .5;
    /* shards */
    let nearS = null, nd = Infinity;
    for (const s of shards) {
      if (!s.g.visible) continue;
      s.m.rotation.y += dt * 1.2; s.m.position.y = Math.sin(now * 1.6 + s.x) * .4;
      if (s.found) { s.g.scale.multiplyScalar(1 - dt * 3); if (s.g.scale.x < .05) s.g.visible = false; continue; }
      const dd = Math.hypot(s.x - P.x, s.y - P.y, s.z - P.z); if (dd < nd) { nd = dd; nearS = s; }
      if (play && dd < 5) {
        s.found = true; count++; sfx.blip(660, .18, 'sine', .3); setTimeout(() => sfx.blip(990, .3, 'sine', .25), 120);
        found.innerHTML = `<small>SHARD ${count} OF 8</small><h3>${s.name}</h3><p>${s.fact}</p>`; found.classList.add('in'); fadeT = 6;
        if (count === 8) win();
      }
    }
    if (fadeT > 0) { fadeT -= dt; if (fadeT <= 0) found.classList.remove('in'); }
    if (play) time += dt;
    /* compass strip: N E S W and the nearest shard */
    const head = -P.camYaw + Math.PI; let h = '';
    const put = (ang, html) => { let a = Math.atan2(Math.sin(ang - head), Math.cos(ang - head)); if (Math.abs(a) < 1.3) h += html.replace('%', (50 + a / 1.3 * 50).toFixed(1) + '%'); };
    [['N', Math.PI], ['E', Math.PI / 2], ['S', 0], ['W', -Math.PI / 2]].forEach(([l, a]) => put(a, `<span class="c" style="left:%">${l}</span>`));
    for (let k = 0; k < 24; k++) if (k % 6) put(k / 24 * 6.283, '<span style="left:%">·</span>');
    if (nearS) put(Math.atan2(nearS.x - P.x, nearS.z - P.z), '<i style="left:%"></i>');
    comp.innerHTML = h;
    info.innerHTML = phase === 'menu' ? '' : `<span>Shards<b>${count}/8</b></span><span>${nearS ? Math.round(nd) + ' m' : '—'}</span><span>${fmtTime(time)}</span><span>Alt<b>${Math.round(P.y)} m</b></span>`;
    S.render();
  });
  const win = async () => {
    phase = 'done'; showTouch(false); const b = best.get('explore'); const nb = !b || time < b; if (nb) best.set('explore', time);
    await new Promise((r2) => setTimeout(r2, 2200));
    const c = await card(ui, { kicker: 'All eight shards', title: 'The island is yours', body: `<div class="gk-stats"><div><small>Time</small><b>${fmtTime(time)}</b></div><div><small>Best</small><b>${fmtTime(nb ? time : b)}</b></div><div><small>Shards</small><b>8 / 8</b></div></div>`, buttons: ['Free flight', 'Play again'] });
    if (c === 1) reset(); phase = 'play'; showTouch(true);
  };
  menu();
}
