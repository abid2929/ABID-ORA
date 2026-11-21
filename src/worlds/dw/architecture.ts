// @ts-nocheck
/* World 25 · Architecture. A travertine-and-glass pavilion on a plinth, in a garden, under the real sun.
   Walk inside it (first person) or study it from outside. The sun is computed for any city, day and hour,
   so shadows fall exactly as they would there. Proportion re-sets the height of every bay; the garden gate is
   a true catenary arch (a hanging chain, flipped), rebuilt for any span and rise.
   Units: 1 = 1 metre. -Z is north, +X is east. */
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { THREE, viewSize, OrbitControls, renderer, foliage, panel, range, chips, buttons, note, toast, walkInput, lookInput, loop, fit, el, tween,
  cv, tex, normalFromHeight, noise2, fbm, rng, clamp, lerp, sunPos, sunDir, skyDome, TAU } from './akit';

const CITIES = [['Dhaka', 23.8], ['Singapore', 1.35], ['Cairo', 30], ['Tokyo', 35.7], ['New York', 40.7], ['London', 51.5], ['Reykjavík', 64.1], ['Sydney', -33.9]];
const RATIOS = [['phi', 1.618, 'Golden 1 : 1.618'], ['root2', Math.SQRT2, 'Paper 1 : √2'], ['four3', 4 / 3, 'Classic 3 : 4'], ['two', 2, 'Double 1 : 2']];
const BAY = 5.5, PL = { w: 36, d: 20, h: .6 };

export function catenaryA(span, rise) { let lo = 1e-3, hi = 1e6; for (let i = 0; i < 200; i++) { const a = Math.sqrt(lo * hi); (a * (Math.cosh(span / 2 / a) - 1) > rise ? lo = a : hi = a); } return Math.sqrt(lo * hi); }

/* ---------- materials drawn in code ---------- */
function travertine(seed, w = 1024, base = [222, 207, 182]) {
  const n = noise2(seed), [c, g] = cv(w), [hc, hg] = cv(w); const im = g.createImageData(w, w), hm = hg.createImageData(w, w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const band = fbm(n, x / 260, y / 26, 4), pore = n(x / 3.1 + 40, y / 1.6) > .82 ? 1 : 0, f = fbm(n, x / 60 + 9, y / 60, 3);
    const k = .86 + band * .2 - pore * .22 + f * .06, i = (y * w + x) * 4;
    im.data[i] = base[0] * k; im.data[i + 1] = base[1] * k; im.data[i + 2] = base[2] * k * .97; im.data[i + 3] = 255;
    const hgt = 200 - pore * 160 + band * 30; hm.data[i] = hm.data[i + 1] = hm.data[i + 2] = hgt; hm.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0);
  /* stone joints: slabs of 1.2 x 0.6 m drawn in the colour map */
  return { map: c, normal: normalFromHeight(hc, 1.6) };
}
function onyx(seed) {
  const n = noise2(seed), w = 1024, [c, g] = cv(w, w); const im = g.createImageData(w, w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const v = fbm(n, x / 180, y / 180, 5), s = Math.sin((x / w * 3 + v * 6) * Math.PI), k = Math.pow(Math.abs(s), .3), i = (y * w + x) * 4;
    const glow = fbm(n, x / 90 + 7, y / 90, 3);
    im.data[i] = 210 * k + 40 * glow + 10; im.data[i + 1] = 150 * k + 30 * glow + 8; im.data[i + 2] = 80 * k + 10; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function concrete(seed, w = 512) {
  const n = noise2(seed), [c, g] = cv(w), [hc, hg] = cv(w); const im = g.createImageData(w, w), hm = hg.createImageData(w, w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const f = fbm(n, x / 40, y / 40, 5), p = n(x / 2.3, y / 2.3) > .86 ? 1 : 0, i = (y * w + x) * 4, k = 190 + f * 40 - p * 40;
    im.data[i] = k; im.data[i + 1] = k * .985; im.data[i + 2] = k * .96; im.data[i + 3] = 255; hm.data[i] = hm.data[i + 1] = hm.data[i + 2] = 180 + f * 50 - p * 120; hm.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); hg.putImageData(hm, 0, 0); return { map: c, normal: normalFromHeight(hc, 1.2) };
}
function grass(seed) {
  const n = noise2(seed), w = 1024, [c, g] = cv(w); const im = g.createImageData(w, w);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const f = fbm(n, x / 90, y / 90, 4), blade = n(x / 1.3, y / 4) * .5 + n(x / 4, y / 1.2) * .5, i = (y * w + x) * 4;
    const k = .55 + f * .55 + blade * .35;
    im.data[i] = (70 + f * 40) * k; im.data[i + 1] = (88 + f * 26) * k; im.data[i + 2] = (48 + f * 10) * k; im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
function brick(seed) {
  const R = rng(seed), w = 512, [c, g] = cv(w), [hc, hg] = cv(w);
  g.fillStyle = '#d8cbb4'; g.fillRect(0, 0, w, w); hg.fillStyle = '#000'; hg.fillRect(0, 0, w, w);
  const bh = w / 16, bw = w / 4;
  for (let r = 0; r < 16; r++) for (let k = -1; k < 5; k++) {
    const x = k * bw + (r % 2) * bw / 2, y = r * bh, t = R();
    g.fillStyle = `rgb(${150 + t * 50 | 0},${70 + t * 30 | 0},${48 + t * 20 | 0})`; g.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(0,0,0,${R() * .12})`; g.fillRect(x + R() * bw, y + R() * bh, 3, 2); }
    hg.fillStyle = '#ddd'; hg.fillRect(x + 3, y + 3, bw - 6, bh - 6);
  }
  return { map: c, normal: normalFromHeight(hc, 3) };
}

/* ---------- start ---------- */
export async function start(canvas, ui) {
  const R = renderer(canvas, { exposure: 1.05, tone: THREE.ACESFilmicToneMapping });
  const phone = R.phone;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(phone ? 58 : 45, 1, .1, 900);
  fit(R, cam, canvas);

  /* sky, fog and an environment map that follows the sun */
  const sky = skyDome(0x3d6fb3, 0xcfd9e2, 0x8f9a86, 600); scene.add(sky);
  scene.fog = new THREE.Fog(0xcfd9e2, 160, 700);
  const envScene = new THREE.Scene(); const envSky = skyDome(0, 0, 0, 100); envScene.add(envSky);
  const pm = new THREE.PMREMGenerator(R); let envRT = null;

  const sunL = new THREE.DirectionalLight(0xfff0dc, 3.2);
  sunL.castShadow = true; const sz = 34; Object.assign(sunL.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 220 });
  sunL.shadow.mapSize.set(phone ? 2048 : 4096, phone ? 2048 : 4096); sunL.shadow.bias = -.0002; sunL.shadow.normalBias = .03; sunL.shadow.radius = 3;
  scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight(0xbcd3f0, 0x6b5a45, .55); scene.add(hemi);

  /* materials */
  const tv = travertine(3), tvMap = tex(tv.map, true), tvN = tex(tv.normal, false);
  [tvMap, tvN].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const stoneFloor = new THREE.MeshPhysicalMaterial({ map: tvMap, normalMap: tvN, normalScale: new THREE.Vector2(.6, .6), roughness: .55, clearcoat: .25, clearcoatRoughness: .4 });
  const stoneWall = stoneFloor.clone();
  const cc = concrete(9), ccMap = tex(cc.map, true), ccN = tex(cc.normal, false); [ccMap, ccN].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(4, 2); });
  const roofMat = new THREE.MeshStandardMaterial({ map: ccMap, normalMap: ccN, roughness: .9, color: 0xf2efe9 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xf2f3f5, metalness: 1, roughness: .07 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x8fa79d, metalness: 0, roughness: .02, transparent: true, opacity: .26, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false, specularIntensity: 1 });
  const onyxMap = tex(onyx(5)); const onyxMat = new THREE.MeshPhysicalMaterial({ map: onyxMap, roughness: .08, clearcoat: 1, clearcoatRoughness: .03, emissive: 0x3a1b05, emissiveMap: onyxMap, emissiveIntensity: .25 });
  const gr = tex(grass(4), true); gr.wrapS = gr.wrapT = THREE.RepeatWrapping; gr.repeat.set(36, 36);
  const grassMat = new THREE.MeshStandardMaterial({ map: gr, roughness: 1, color: 0xdfe8cf });
  const br = brick(7), brMap = tex(br.map), brN = tex(br.normal, false); [brMap, brN].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  const brickMat = new THREE.MeshStandardMaterial({ map: brMap, normalMap: brN, roughness: .85 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f4a2a, roughness: .9, flatShading: false });
  const olive = new THREE.MeshStandardMaterial({ color: 0x6f7f5a, roughness: .95 });
  const bark = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 });
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x6b3b22, roughness: .5, sheen: .6, sheenColor: new THREE.Color(0xc9875a), clearcoat: .3 });

  const mesh = (g, m, cast = true, recv = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = recv; return o; };
  const uvBox = (w, h, d, s = 1.2) => { const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv, p = g.attributes.position, nn = g.attributes.normal;
    for (let i = 0; i < uv.count; i++) { const ax = Math.abs(nn.getX(i)), ay = Math.abs(nn.getY(i)); const [u, v] = ax > .5 ? [p.getZ(i), p.getY(i)] : ay > .5 ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)]; uv.setXY(i, u / s / 6, v / s / 6); } return g; };

  /* ground */
  const ground = mesh(new THREE.CircleGeometry(420, 64), grassMat, false); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  /* gentle hills far away */
  const hillG = new THREE.PlaneGeometry(900, 900, 120, 120); hillG.rotateX(-Math.PI / 2);
  { const n = noise2(12), p = hillG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z); const k = clamp((r - 120) / 160, 0, 1); p.setY(i, -0.5 + k * k * (fbm(n, x / 90, z / 90, 4) * 70)); } hillG.computeVertexNormals(); }
  const hills = mesh(hillG, new THREE.MeshStandardMaterial({ color: 0x6f7d5c, roughness: 1 }), false); scene.add(hills);

  /* the plinth and its steps */
  const plinth = new THREE.Group(); scene.add(plinth);
  const pg = uvBox(PL.w, PL.h, PL.d); { const m = mesh(pg, stoneFloor); m.position.y = PL.h / 2; plinth.add(m); }
  for (let i = 0; i < 3; i++) { const s = mesh(uvBox(6, PL.h * (i + 1) / 3, .45), stoneFloor); s.position.set(-11, PL.h * (i + 1) / 6, PL.d / 2 + .45 * (3 - i) - .2); plinth.add(s); }
  /* joints in the floor: a slab grid drawn as fine lines */
  {
    const pts = []; for (let x = -PL.w / 2; x <= PL.w / 2; x += 1.2) pts.push(x, PL.h + .003, -PL.d / 2, x, PL.h + .003, PL.d / 2);
    for (let z = -PL.d / 2; z <= PL.d / 2; z += .6) pts.push(-PL.w / 2, PL.h + .003, z, PL.w / 2, PL.h + .003, z);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    plinth.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x8c7a62, transparent: true, opacity: .28 })));
  }

  /* reflecting pool cut into the plinth (east end) */
  const pool = new Reflector(new THREE.PlaneGeometry(7.6, 8), { textureWidth: phone ? 1024 : 2048, textureHeight: phone ? 1024 : 2048, color: 0x6a777a, clipBias: .003 });
  pool.rotation.x = -Math.PI / 2; pool.position.set(13.7, PL.h - .02, 1); scene.add(pool);
  const rim = new THREE.Shape(); rim.moveTo(-4.1, -4.3); rim.lineTo(4.1, -4.3); rim.lineTo(4.1, 4.3); rim.lineTo(-4.1, 4.3); rim.closePath();
  const hole = new THREE.Path(); hole.moveTo(-3.8, -4); hole.lineTo(-3.8, 4); hole.lineTo(3.8, 4); hole.lineTo(3.8, -4); hole.closePath(); rim.holes.push(hole);
  const rimG = new THREE.ExtrudeGeometry(rim, { depth: .06, bevelEnabled: false }); rimG.rotateX(-Math.PI / 2);
  const rimM = mesh(rimG, stoneFloor); rimM.position.set(13.7, PL.h, 1); scene.add(rimM);

  /* the pavilion: a floating roof slab on chrome cruciform columns; height follows the chosen proportion */
  const pav = new THREE.Group(); scene.add(pav);
  let H = BAY / 1.618;
  const roof = mesh(uvBox(4 * BAY + 2.6, .38, 2 * BAY + 2.4, 1), roofMat); pav.add(roof);
  const cols = [];
  const crossG = (() => { const s = new THREE.Shape(), a = .09, b = .02; s.moveTo(-a, -b); [[-b, -b], [-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b]].forEach((q) => s.lineTo(...q)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2 }); g.rotateX(-Math.PI / 2); return g; })();
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const c = mesh(crossG, chrome); c.position.set((i - 1.5) * BAY, PL.h, (j - .5) * BAY); pav.add(c); cols.push(c); }
  /* walls: travertine at the west end, onyx inside, green glass along the bays */
  const wWest = mesh(uvBox(.3, 1, 9), stoneWall); const wNorth = mesh(uvBox(14, 1, .3), stoneWall);
  const onyxW = mesh(new THREE.BoxGeometry(4.8, 1, .18), onyxMat);
  const panes = []; for (let k = 0; k < 3; k++) { const p = mesh(new THREE.PlaneGeometry(BAY - .1, 1), glass, false, false); panes.push(p); pav.add(p); }
  const mullions = []; for (let k = 0; k < 4; k++) { const m = mesh(new THREE.BoxGeometry(.05, 1, .05), chrome); mullions.push(m); pav.add(m); }
  pav.add(wWest, wNorth, onyxW);
  /* a pair of leather-and-chrome chairs facing the onyx */
  const chair = () => {
    const g = new THREE.Group();
    const seat = mesh(new RoundedBoxGeometry(.75, .12, .72, 3, .05), leather); seat.position.y = .4; g.add(seat);
    const back = mesh(new RoundedBoxGeometry(.75, .7, .12, 3, .05), leather); back.position.set(0, .72, -.34); back.rotation.x = -.18; g.add(back);
    const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, .38), new THREE.Vector3(0, .2, .2), new THREE.Vector3(0, .34, -.1), new THREE.Vector3(0, .9, -.42)]);
    for (const sx of [-.4, .4]) { const t = mesh(new THREE.TubeGeometry(cur, 40, .018, 8), chrome); t.position.x = sx; g.add(t); }
    return g;
  };
  const ch1 = chair(), ch2 = chair(); ch1.position.set(-2.4, PL.h, 1.4); ch2.position.set(-1.2, PL.h, 1.4); ch1.rotation.y = Math.PI + .25; ch2.rotation.y = Math.PI - .25; pav.add(ch1, ch2);
  const ottoman = mesh(new RoundedBoxGeometry(.6, .35, .5, 3, .05), leather); ottoman.position.set(-1.8, PL.h + .18, 2.5); pav.add(ottoman);

  function layoutPavilion() {
    roof.position.set(0, PL.h + H + .19, 0);
    cols.forEach((c) => { c.scale.y = H; });
    wWest.scale.y = H; wWest.position.set(-2 * BAY - .5, PL.h + H / 2, -1);
    wNorth.scale.y = H; wNorth.position.set(-6, PL.h + H / 2, -BAY / 2 - 1.1);
    onyxW.scale.y = Math.min(H * .78, 3.1); onyxW.position.set(-1.8, PL.h + onyxW.scale.y / 2, -.6);
    panes.forEach((p, k) => { p.scale.y = H; p.position.set((k - .5) * BAY, PL.h + H / 2, BAY / 2 + .6); });
    mullions.forEach((m, k) => { m.scale.y = H; m.position.set((k - 2) * BAY + BAY * .5, PL.h + H / 2, BAY / 2 + .6); });
    roofTag.textContent = `Bay ${BAY.toFixed(1)} m × ${H.toFixed(2)} m`;
  }

  /* trees: a row of Italian cypress behind, olives on the lawn */
  const cypG = (() => { const g = new THREE.SphereGeometry(1, 18, 22); const p = g.attributes.position, n = noise2(31);
    for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (n(x * 3 + y * 2, z * 3) - .5) * .25; const taper = 1 - Math.pow((y + 1) / 2, 1.7) * .85; p.setXYZ(i, x * k * taper * .9, (y + 1) * 5.2, z * k * taper * .9); }
    g.computeVertexNormals(); return g; })();
  const R0 = rng(5);
  const cypCl = [];
  for (let i = 0; i < 18; i++) {
    const t = mesh(cypG, leaf); const s = .8 + R0() * .45, sy = .85 + R0() * .4, x = -34 + i * 4 + R0(), z = -20 - R0() * 2;
    t.scale.set(s * .85, sy, s * .85); t.position.set(x, 0, z); scene.add(t);
    for (let k = 0; k < 9; k++) { const y = (k + .6) / 9 * 10.4 * sy, taper = 1 - Math.pow(y / (10.4 * sy), 1.7) * .85; cypCl.push([x, y, z, .95 * s * taper + .12]); }
  }
  scene.add(foliage({ seed: 99, count: phone ? 16000 : 26000, size: .3, clusters: cypCl, color: 0x3b5a33, squash: 1.2 }));
  let seed = 40;
  for (const [x, z] of [[24, 16], [28, 9], [-27, 14], [-22, 21], [6, 27], [30, -6], [-31, -4], [-4, 30]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = R0() * TAU;
    const trunk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(.25, 1.1, .1), new THREE.Vector3(-.1, 2.1, -.15), new THREE.Vector3(.2, 2.9, .1)]);
    g.add(mesh(new THREE.TubeGeometry(trunk, 16, .2, 8), bark));
    for (let b = 0; b < 3; b++) { const a = b / 3 * TAU + R0(); const br = new THREE.CatmullRomCurve3([new THREE.Vector3(.1, 2.2, 0), new THREE.Vector3(Math.cos(a) * .9, 2.9, Math.sin(a) * .9), new THREE.Vector3(Math.cos(a) * 1.5, 3.5, Math.sin(a) * 1.5)]); g.add(mesh(new THREE.TubeGeometry(br, 8, .08, 6), bark)); }
    const cl = []; for (let k = 0; k < 6; k++) { const a = R0() * TAU, r = R0() * 1.4; cl.push([Math.cos(a) * r, 3.4 + R0() * 1.2, Math.sin(a) * r, 1 + R0() * .5]); }
    g.add(foliage({ seed: seed++, count: phone ? 1600 : 2600, size: .26, clusters: cl, color: 0x7d8c66, squash: .7 }));
    scene.add(g);
  }

  /* the catenary gate on the garden path */
  const gate = new THREE.Group(); gate.position.set(-11, 0, 19); scene.add(gate);
  const path = mesh(uvBox(3.4, .04, 14), stoneFloor, false); path.position.set(-11, .02, 17.5); scene.add(path);
  let span = 5, rise = 6, archMesh = null;
  const archTag = el('div', { class: 'tag3d' }); ui.append(archTag);
  const roofTag = el('div', { class: 'tag3d' }); ui.append(roofTag);
  function buildArch() {
    if (archMesh) { gate.remove(archMesh); archMesh.geometry.dispose(); }
    const t = .55, a = catenaryA(span, rise), ao = catenaryA(span + 2 * t, rise + t);
    const curve = (A, sp, ri, n = 48) => { const pts = []; for (let i = 0; i <= n; i++) { const x = -sp / 2 + sp * i / n; pts.push([x, ri - A * (Math.cosh(x / A) - 1)]); } return pts; };
    const outer = curve(ao, span + 2 * t, rise + t), inner = curve(a, span, rise).reverse();
    const s = new THREE.Shape(); s.moveTo(...outer[0]); outer.slice(1).forEach((p) => s.lineTo(...p)); inner.forEach((p) => s.lineTo(...p)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: .9, bevelEnabled: true, bevelSize: .03, bevelThickness: .03, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -.45);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2);
    archMesh = mesh(g, brickMat); gate.add(archMesh);
    archTag.textContent = `Catenary · span ${span.toFixed(1)} m · rise ${rise.toFixed(1)} m · a = ${a.toFixed(2)}`;
  }

  /* ---------- sun ---------- */
  const S = { city: 0, day: 172, hour: 7.6 };
  const sk = sky.material.uniforms, ek = envSky.material.uniforms;
  const cTop = new THREE.Color(), cMid = new THREE.Color(), cBot = new THREE.Color(), cSun = new THREE.Color();
  function applySun() {
    const p = sunPos(CITIES[S.city][1], S.day, S.hour), d = sunDir(p.el, p.az), e = p.el;
    const day = clamp((e + 4) / 14, 0, 1), gold = 1 - clamp((e - 2) / 22, 0, 1);
    cTop.setRGB(lerp(.015, .06, day), lerp(.02, .2, day), lerp(.06, .55, day));
    cMid.setRGB(lerp(.05, lerp(.74, 1.0, gold), day), lerp(.06, lerp(.84, .62, gold), day), lerp(.12, lerp(.92, .42, gold), day));
    cBot.setRGB(lerp(.02, .45, day), lerp(.02, .48, day), lerp(.03, .42, day));
    cSun.setRGB(1, lerp(.95, .62, gold), lerp(.86, .34, gold));
    for (const u of [sk, ek]) { u.top.value.copy(cTop); u.mid.value.copy(cMid); u.bot.value.copy(cBot); u.sun.value.copy(d); u.sunCol.value.copy(cSun).multiplyScalar(clamp((e + 2) / 6, 0, 1)); }
    scene.fog.color.copy(cMid);
    sunL.position.copy(d).multiplyScalar(110); sunL.target.position.set(0, 0, 0);
    sunL.color.copy(cSun); sunL.intensity = 5.2 * clamp(e / 8, 0, 1);
    hemi.intensity = .08 + .3 * day; hemi.color.copy(cTop).lerp(new THREE.Color(1, 1, 1), .4);
    R.toneMappingExposure = lerp(1.6, .82, day);
    if (envRT) envRT.dispose(); envRT = pm.fromScene(envScene, .04); scene.environment = envRT.texture; scene.environmentIntensity = .25 + .45 * day;
    /* the facts */
    const sh = e > 0 ? H / Math.tan(e * Math.PI / 180) : Infinity;
    st.el.textContent = e.toFixed(1) + '°'; st.az.textContent = p.az.toFixed(0) + '°';
    st.sh.textContent = e > .5 ? sh.toFixed(1) + ' m' : 'night';
    let rise0 = null, set0 = null; for (let hh = 0; hh < 24; hh += 1 / 60) { const a = sunPos(CITIES[S.city][1], S.day, hh).el; if (rise0 === null && a > -.83) rise0 = hh; if (rise0 !== null && a > -.83) set0 = hh; }
    st.dl.textContent = rise0 === null ? 'polar night' : set0 - rise0 > 23.9 ? 'midnight sun' : `${(set0 - rise0).toFixed(1)} h`;
  }

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 25 · Architecture', title: 'The Stone Pavilion', lede: 'A travertine-and-glass pavilion under the real sun. Walk in, change the city, the day and the hour, and see light move exactly as it would there.' });
  const sSun = P.section('Sun');
  const date = (d) => new Date(2026, 0, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const hrs = (v) => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`;
  chips(sSun, 'City', CITIES.map(([n], i) => [String(i), n]), '0', (v) => { S.city = +v; applySun(); });
  const hourR = range(sSun, 'Solar time', { min: 4, max: 21, step: .05, value: S.hour, fmt: hrs }, (v) => { S.hour = v; applySun(); });
  range(sSun, 'Day of year', { min: 1, max: 365, value: S.day, fmt: date }, (v) => { S.day = v; applySun(); });
  const st = P.stats(sSun, [['el', 'Sun height'], ['az', 'Direction (from N)'], ['sh', 'Roof shadow length'], ['dl', 'Daylight']]);
  let stopTour = null;
  buttons(sSun, [['Play a day', () => { stopTour?.(); const h0 = 5, h1 = 20; stopTour = tween(16000, (k) => { S.hour = lerp(h0, h1, k); hourR.set(S.hour); applySun(); }, () => (stopTour = null)); }, true]]);
  const sForm = P.section('Proportion');
  note(sForm, 'Every bay is 5.5 m wide. Choose the proportion of its face and the whole pavilion rises or settles to match.');
  chips(sForm, 'Bay proportion', RATIOS.map(([k, , t]) => [k, t]), 'phi', (k) => { const r = RATIOS.find((x) => x[0] === k)[1]; const h0 = H, h1 = BAY / r; tween(900, (q) => { H = lerp(h0, h1, q); layoutPavilion(); }, applySun); }, 'grid');
  const sArch = P.section('Arch');
  note(sArch, 'Hang a chain and it takes a shape with no bending, only pull. Turn it upside down and that shape carries its own weight in pure compression: the strongest arch for its weight. The garden gate is rebuilt from y = a·cosh(x/a).');
  range(sArch, 'Span', { min: 2.5, max: 9, step: .1, value: span, fmt: (v) => v.toFixed(1) + ' m' }, (v) => { span = v; buildArch(); });
  range(sArch, 'Rise', { min: 2.5, max: 9, step: .1, value: rise, fmt: (v) => v.toFixed(1) + ' m' }, (v) => { rise = v; buildArch(); });
  buttons(sArch, [['Go to the gate', () => flyTo(new THREE.Vector3(-11, 1.65, 30), new THREE.Vector3(-11, 3.6, 19))]]);
  const sView = P.section('Views');
  const views = [
    ['Approach', [27, 6.5, 27], [0, 2, 0]], ['Under the roof', [-4, 1.75, 6.5], [-1.8, 1.8, -1]], ['Pool', [20, 2.2, 8], [4, 1.5, -2]],
    ['Bird’s eye', [26, 40, 34], [0, 0, 0]], ['Garden gate', [-11, 1.65, 30], [-11, 3.6, 19]],
  ];
  chips(sView, null, views.map(([n], i) => [String(i), n]), '-', (v) => { const [, p, t] = views[+v]; setMode('orbit'); flyTo(new THREE.Vector3(...p), new THREE.Vector3(...t)); });
  note(sView, 'Drag to look around, pinch or scroll to zoom. In walk mode use the thumb stick (or W A S D) and drag to turn.');

  /* ---------- camera: orbit and walk ---------- */
  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * .495; orbit.minDistance = 2; orbit.maxDistance = 140; orbit.target.set(0, 2, 0);
  const walk = walkInput(ui); walk.show(false);
  const look = lookInput(canvas, cam); look.on = false;
  let mode = 'orbit';
  const fab = el('div', { class: 'fab' });
  const bOrbit = el('button', { 'aria-pressed': 'true', text: 'Look at it', onclick: () => setMode('orbit') });
  const bWalk = el('button', { 'aria-pressed': 'false', text: 'Walk inside', onclick: () => setMode('walk') });
  fab.append(bOrbit, bWalk); ui.append(fab);
  const hint = el('div', { class: 'hint', text: 'Drag to turn · pinch to zoom' }); ui.append(hint);
  const walls = () => [  // simple collision boxes [x0,z0,x1,z1]
    [-2 * BAY - .65, -5.5, -2 * BAY - .35, 3.5], [-13, -BAY / 2 - 1.25, 1, -BAY / 2 - .95], [-4.2, -.7, .6, -.5], [-1.5 * BAY, BAY / 2 + .55, 1.5 * BAY, BAY / 2 + .65],
    [9.9, -3, 17.5, 5], [-11 - span / 2 - .6, 18.5, -11 - span / 2, 19.5], [-11 + span / 2, 18.5, -11 + span / 2 + .6, 19.5],
  ];
  const floorAt = (x, z) => (Math.abs(x) < PL.w / 2 && Math.abs(z) < PL.d / 2 ? PL.h : (Math.abs(x + 11) < 3 && z > PL.d / 2 && z < PL.d / 2 + 1.4 ? PL.h * clamp(1 - (z - PL.d / 2) / 1.4, 0, 1) : 0));
  function setMode(m) {
    mode = m; bOrbit.setAttribute('aria-pressed', String(m === 'orbit')); bWalk.setAttribute('aria-pressed', String(m === 'walk'));
    walk.show(m === 'walk'); orbit.enabled = m === 'orbit'; look.on = m === 'walk';
    hint.textContent = m === 'walk' ? (phone ? 'Thumb stick to walk · drag to look' : 'W A S D to walk · drag to look') : 'Drag to turn · pinch to zoom';
    if (m === 'walk') {
      stopFly?.(); const from = cam.position.clone(), to = new THREE.Vector3(-11, 1.65, 26);
      look.yaw = 0; look.pitch = .05;
      const q0 = cam.quaternion.clone(), q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(.05, 0, 0, 'YXZ'));
      stopFly = tween(1600, (k) => { cam.position.lerpVectors(from, to, k); cam.quaternion.slerpQuaternions(q0, q1, k); }, () => { stopFly = null; });
      if (phone) P.root.dataset.open = '0';
    } else {
      const d = new THREE.Vector3(); cam.getWorldDirection(d); orbit.target.copy(cam.position).addScaledVector(d, 8); orbit.target.y = Math.max(1, orbit.target.y);
    }
  }
  let stopFly = null;
  function flyTo(p, t) {
    stopFly?.(); if (mode === 'walk') setMode('orbit');
    const p0 = cam.position.clone(), t0 = orbit.target.clone();
    stopFly = tween(1800, (k) => { cam.position.lerpVectors(p0, p, k); orbit.target.lerpVectors(t0, t, k); }, () => (stopFly = null));
  }

  /* tags that follow the roof edge and the arch */
  const tagAt = (tag, v) => { const p = v.clone().project(cam); const vis = p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1; tag.hidden = !vis || mode === 'walk' && v.distanceTo(cam.position) > 30; if (vis) { const [vw, vh] = viewSize(); tag.style.left = (p.x * .5 + .5) * vw + 'px'; tag.style.top = (-p.y * .5 + .5) * vh + 'px'; } };

  layoutPavilion(); buildArch(); applySun();
  /* opening shot: drift in from the lawn */
  cam.position.set(58, 18, 60); orbit.target.set(0, 2, 0);
  stopFly = tween(4200, (k) => { cam.position.set(lerp(58, 27, k), lerp(18, 6.5, k), lerp(60, 27, k)); }, () => (stopFly = null));

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  loop((dt) => {
    if (mode === 'walk' && !stopFly) {
      look.apply();
      const v = walk.read(); const sp = 3.2 * dt;
      fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw)); right.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
      const nx = cam.position.x + (fwd.x * v.y + right.x * v.x) * sp, nz = cam.position.z + (fwd.z * v.y + right.z * v.x) * sp;
      const hit = (x, z) => walls().some(([a, b, c, d]) => x > a - .3 && x < c + .3 && z > b - .3 && z < d + .3);
      if (!hit(nx, cam.position.z)) cam.position.x = nx; if (!hit(cam.position.x, nz)) cam.position.z = nz;
      cam.position.x = clamp(cam.position.x, -120, 120); cam.position.z = clamp(cam.position.z, -120, 120);
      cam.position.y = lerp(cam.position.y, floorAt(cam.position.x, cam.position.z) + 1.65, .2);
    } else if (mode === 'orbit') orbit.update();
    tagAt(roofTag, new THREE.Vector3(2 * BAY + 1.3, PL.h + H + .4, BAY + 1.2));
    tagAt(archTag, new THREE.Vector3(-11, rise + .9, 19));
    R.render(scene, cam); R.adapt();
  });
}
