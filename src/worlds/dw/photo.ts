// @ts-nocheck
/* World 29 · Photography. A full-frame camera in a real 3D street. The scene is built in metres (flowers at
   your feet, a cyclist crossing, trees, facades and a skyline far away) and seen through a lens of the focal
   length you choose, so zooming really compresses the background. The picture is then developed like a sensor:
   - depth of field: every pixel is blurred by its true circle of confusion, c = f²/(N(s−f)) · |x−s|/x, plus diffraction;
   - motion blur: the scene is rendered many times across the shutter interval and averaged;
   - exposure: EV = log₂(N²/t) − log₂(ISO/100) against the scene's light; high ISO adds grain.
   Tap the picture to focus there. Take photos into a film strip and download them. */
import { THREE, loadGLB, on, onEnd, host, viewSize, renderer, panel, range, chips, buttons, note, toast, loop, el, tween, foliage,
  cv, tex, noise2, fbm, rng, clamp, lerp, skyDome, download, isPhone, TAU } from './akit';

export const SENSOR_W = 36, SENSOR_H = 24, COC = .03;
export const evOf = (N, t, iso) => Math.log2(N * N / t) - Math.log2(iso / 100);
export const hyperfocal = (f, N, c = COC) => f * f / (N * c) + f;
export function dof(f, N, s, c = COC) { const H = hyperfocal(f, N, c), near = s * (H - f) / (H + s - 2 * f), far = s >= H ? Infinity : s * (H - f) / (H - s); return { near, far, H }; }
export const airy = (N) => 2.44 * .00055 * N;
const STOPS_N = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_T = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const STOPS_ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
const tName = (t) => (t >= 1 ? t + ' s' : '1/' + Math.round(1 / t));
const LIGHT = { sun: ['Bright sun', 15], shade: ['Overcast', 12], gold: ['Golden hour', 10.5], night: ['Street at night', 6] };
const mFmt = (mm) => { const m = mm / 1000; return !Number.isFinite(m) || m >= 999 ? '∞' : m < 10 ? m.toFixed(1) + ' m' : Math.round(m) + ' m'; };

/* ---------- textures for the street ---------- */
function facadeTex(seed, kind) {
  const R = rng(seed), W = 512, H = 1024, [c, g] = cv(W, H), n = noise2(seed);
  const base = { brick: [150, 78, 58], stucco: [226, 214, 190], stone: [196, 190, 180], dark: [70, 72, 78], sage: [150, 168, 150] }[kind];
  const im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = fbm(n, x / 40, y / 40, 3), b = kind === 'brick' && ((y % 16 < 2) || ((x + (Math.floor(y / 16) % 2) * 16) % 32 < 2)) ? .78 : 1, p = (y * W + x) * 4, k = (.86 + v * .2) * b;
    im.data[p] = base[0] * k; im.data[p + 1] = base[1] * k; im.data[p + 2] = base[2] * k; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0);
  /* windows: 4 bays x 8 floors per tile (tile = 8 m x 16 m); lit at night is a separate emissive map */
  const [ec, eg] = cv(W, H); eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  for (let fl = 0; fl < 8; fl++) for (let b = 0; b < 4; b++) {
    const x = b * 128 + 34, y = fl * 128 + 26, w = 60, h = 84;
    g.fillStyle = kind === 'dark' ? '#e5e7ea' : '#f3efe6'; g.fillRect(x - 6, y - 6, w + 12, h + 14);
    const sky = g.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, '#7f97ad'); sky.addColorStop(1, '#2e3a46'); g.fillStyle = sky; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 4, y + 4, 10, h - 8);
    g.fillStyle = '#ddd'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * .38, w, 4);
    if (R() < .45) { eg.fillStyle = `rgb(255,${190 + R() * 40 | 0},${110 + R() * 50 | 0})`; eg.fillRect(x, y, w, h); }
  }
  const t = tex(c), e = tex(ec); t.wrapS = t.wrapT = e.wrapS = e.wrapT = THREE.RepeatWrapping; return { map: t, emap: e };
}
function asphalt(seed) {
  const n = noise2(seed), W = 512, [c, g] = cv(W); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = fbm(n, x / 6, y / 6, 3), sp = n(x / 1.5, y / 1.5) > .82 ? 1.3 : 1, p = (y * W + x) * 4, k = (52 + v * 30) * sp; im.data[p] = k; im.data[p + 1] = k; im.data[p + 2] = k * 1.03; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0); const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function paving(seed) {
  const R = rng(seed), W = 512, [c, g] = cv(W); g.fillStyle = '#8f8a82'; g.fillRect(0, 0, W, W);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const k = 160 + R() * 40; g.fillStyle = `rgb(${k},${k - 4},${k - 10})`; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

function shopTex(seed) {
  const R = rng(seed), [c, g] = cv(512, 256); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f3dcb8'); gr.addColorStop(1, '#8c6a4a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  for (let s = 0; s < 4; s++) { const y = 50 + s * 52; g.fillStyle = '#5a4030'; g.fillRect(0, y, 512, 6); let x = 6; while (x < 500) { const w = 8 + R() * 22, h = 16 + R() * 26; g.fillStyle = `hsl(${20 + R() * 40},${15 + R() * 25}%,${30 + R() * 35}%)`; g.fillRect(x, y - h, w, h); x += w + 3 + R() * 10; } }
  for (let k = 0; k < 3; k++) { const x = 60 + k * 170; const rg = g.createRadialGradient(x, 0, 2, x, 0, 90); rg.addColorStop(0, 'rgba(255,240,200,.9)'); rg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = rg; g.fillRect(x - 90, 0, 180, 90); }
  g.fillStyle = 'rgba(20,30,40,.25)'; g.fillRect(0, 0, 512, 256); for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.save(); g.translate(R() * 512, 0); g.rotate(.5); g.fillRect(0, -50, 18 + R() * 30, 400); g.restore(); }
  const t = tex(c); return t;
}

/* ---------- the cyclist: frame, wheels that turn, legs that pedal ---------- */
function cyclist() {
  const g = new THREE.Group(), M = (c, r = .5, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const frameM = M(0x1d6fd8, .25, .6), tyre = M(0x111111, .8), rim = M(0xd0d4d8, .25, 1), skin = M(0xb07a55, .6), jersey = M(0xe0352b, .55), shorts = M(0x15171c, .7), helmet = M(0xf4f4f4, .3);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  const wheels = [];
  for (const x of [-.52, .52]) { const w = new THREE.Group(); w.position.set(x, .34, 0); g.add(w); wheels.push(w);
    const t = new THREE.Mesh(new THREE.TorusGeometry(.33, .025, 10, 48), tyre); t.castShadow = true; w.add(t);
    const r = new THREE.Mesh(new THREE.TorusGeometry(.3, .012, 8, 48), rim); w.add(r);
    for (let k = 0; k < 16; k++) { const s = new THREE.Mesh(new THREE.CylinderGeometry(.002, .002, .6, 4), rim); s.rotation.z = k / 16 * Math.PI; w.add(s); } }
  const tube = (a, b, r = .018, m = frameM) => { const v = new THREE.Vector3().subVectors(b, a), o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 10), m); o.position.copy(a).addScaledVector(v, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); o.castShadow = true; g.add(o); return o; };
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z), BB = V(0, .34), SEAT = V(-.12, .86), HEAD = V(.38, .82), FA = V(.52, .34), RA = V(-.52, .34);
  tube(BB, SEAT); tube(SEAT, HEAD); tube(BB, HEAD, .022); tube(BB, RA, .012); tube(SEAT, RA, .012); tube(HEAD, FA, .016);
  tube(V(.38, .82), V(.42, .98), .014, rim); tube(V(.42, .98, -.2), V(.42, .98, .2), .012, M(0x222222));
  add(new THREE.BoxGeometry(.22, .04, .08), M(0x111111), -.13, .9, 0);
  /* rider */
  add(new THREE.CapsuleGeometry(.14, .42, 6, 12), jersey, .05, 1.2, 0, 0, 0, -1.05);
  add(new THREE.SphereGeometry(.1, 20, 16), skin, .36, 1.42, 0);
  add(new THREE.SphereGeometry(.12, 20, 12, 0, TAU, 0, Math.PI / 2), helmet, .35, 1.46, 0, 0, 0, -.3);
  add(new THREE.CapsuleGeometry(.045, .38, 4, 8), skin, .28, 1.13, .17, 0, 0, -.75); add(new THREE.CapsuleGeometry(.045, .38, 4, 8), skin, .28, 1.13, -.17, 0, 0, -.75);
  add(new THREE.CapsuleGeometry(.12, .12, 4, 10), shorts, -.12, .98, 0, Math.PI / 2);
  const legs = [];
  for (const side of [-1, 1]) { const th = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .34, 4, 8), shorts), sh = new THREE.Mesh(new THREE.CapsuleGeometry(.05, .36, 4, 8), skin); th.castShadow = sh.castShadow = true; g.add(th, sh); legs.push({ side, th, sh }); }
  const crank = new THREE.Group(); crank.position.copy(BB); g.add(crank); crank.add(new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, .01, 32).rotateX(Math.PI / 2), rim));
  const hip = V(-.1, .95), L1 = .44, L2 = .46;
  return { group: g, update(dist) {
    const a = dist / (2.1) * TAU; wheels.forEach((w) => (w.rotation.z = -dist / .34)); crank.rotation.z = -a * .45;
    for (const l of legs) { const ph = -a * .45 + (l.side > 0 ? 0 : Math.PI), foot = V(BB.x + Math.cos(ph) * .17, BB.y + Math.sin(ph) * .17, l.side * .1);
      const h = hip.clone(); h.z = l.side * .1; const d = Math.min(foot.distanceTo(h), L1 + L2 - .01), ang = Math.acos((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d));
      const dir = new THREE.Vector3().subVectors(foot, h).normalize(), knee = h.clone().addScaledVector(dir.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), ang), L1);
      const put = (o, a0, b0) => { const v = new THREE.Vector3().subVectors(b0, a0); o.position.copy(a0).addScaledVector(v, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()); };
      put(l.th, h, knee); put(l.sh, knee, foot); }
  } };
}

export async function start(canvas, ui) {
  const R = renderer(canvas, { tone: THREE.ACESFilmicToneMapping, keep: true });
  const phone = R.phone;
  R.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(40, 1.5, .1, 3000);
  const EYE = new THREE.Vector3(0, 1.3, 2.2); cam.position.copy(EYE); const AIM = new THREE.Vector3(0, 1.05, -9); cam.lookAt(AIM);
  const C = { N: 1.4, t: 1 / 1000, iso: 100, f: 50, focus: 9800, speed: 4, light: 'gold', vertical: false };

  /* ---------- the street ---------- */
  const sky = skyDome(0x3f74b8, 0xc9d8e6, 0x6e6a62, 2500); scene.add(sky);
  scene.fog = new THREE.Fog(0xc9d8e6, 120, 1600);
  const sun = new THREE.DirectionalLight(0xfff1dc, 4); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 200 }); scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x6a5a48, .8); scene.add(hemi);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(400, 8), new THREE.MeshStandardMaterial({ map: asphalt(3), roughness: .85 })); road.material.map.repeat.set(100, 2);
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -9); road.receiveShadow = true; scene.add(road);
  for (let x = -200; x < 200; x += 6) { const d = new THREE.Mesh(new THREE.PlaneGeometry(3, .14), new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: .6 })); d.rotation.x = -Math.PI / 2; d.position.set(x, .005, -9); d.receiveShadow = true; scene.add(d); }
  const pv = paving(4);
  for (const [z, d] of [[-3, 6], [-15, 4]]) { const s = new THREE.Mesh(new THREE.BoxGeometry(400, .14, d), new THREE.MeshStandardMaterial({ map: pv, roughness: .8 })); pv.repeat.set(200, 2); s.position.set(0, .07, z); s.receiveShadow = true; scene.add(s); }
  const curbM = new THREE.MeshStandardMaterial({ color: 0xbfb9ae, roughness: .7 });
  for (const z of [-5, -13]) { const c = new THREE.Mesh(new THREE.BoxGeometry(400, .16, .2), curbM); c.position.set(0, .08, z); c.receiveShadow = true; scene.add(c); }
  /* facades across the street */
  const kinds = ['brick', 'stucco', 'stone', 'dark', 'sage', 'stucco', 'brick'];
  const facades = []; const R0 = rng(7);
  let x = -70; while (x < 70) {
    const w = 8 + Math.floor(R0() * 3) * 4, h = 12 + Math.floor(R0() * 4) * 4, k = kinds[Math.floor(R0() * kinds.length)], ft = facadeTex(Math.floor(R0() * 1000), k);
    ft.map.repeat.set(w / 8, h / 16); ft.emap.repeat.set(w / 8, h / 16);
    const m = new THREE.MeshStandardMaterial({ map: ft.map, emissiveMap: ft.emap, emissive: 0xffffff, emissiveIntensity: 0, roughness: .85 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 10), m); b.position.set(x + w / 2, h / 2 + 3.2, -22); b.castShadow = b.receiveShadow = true; scene.add(b); facades.push(m);
    /* ground floor: shop glass and an awning */
    const st = shopTex(Math.floor(R0() * 999)); const shop = new THREE.Mesh(new THREE.BoxGeometry(w - .4, 3.2, .2), new THREE.MeshPhysicalMaterial({ map: st, emissiveMap: st, color: 0xffffff, roughness: .08, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0 })); shop.position.set(x + w / 2, 1.6, -17.05); scene.add(shop); facades.push(shop.material);
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, 3.2, 9.8), new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: .7 })); base.position.set(x + w / 2, 1.6, -22); scene.add(base);
    const aw = new THREE.Mesh(new THREE.BoxGeometry(w - 1, .06, 1.6), new THREE.MeshStandardMaterial({ color: [0x2f5e4e, 0x8d2f2a, 0xd9c7a0, 0x24344f][Math.floor(R0() * 4)], roughness: .8 })); aw.position.set(x + w / 2, 3.1, -16.3); aw.rotation.x = .25; aw.castShadow = true; scene.add(aw);
    x += w;
  }
  /* old bicycles parked outside the shops (photogrammetry scan: Collection of old bikes by Exploring Europe and Beyond, Sketchfab) */
  loadGLB('bikes.glb').then((m) => { if (!m) return;
    m.scale.setScalar(.85); m.position.set(-2.6, .14 + .43 * .85, -15.6); scene.add(m);
    ui.append(el('div', { class: 'credit', text: 'Bicycles · scan by Exploring Europe and Beyond (Sketchfab)' })); });
  /* trees along the far pavement */
  const cl = []; for (let tx = -60; tx <= 60; tx += 9) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(.12, .18, 3.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a3c30, roughness: 1 })); tr.position.set(tx, 1.7, -14.4); tr.castShadow = true; scene.add(tr);
    for (let k = 0; k < 5; k++) cl.push([tx + (R0() - .5) * 2, 4.2 + R0() * 1.6, -14.4 + (R0() - .5) * 2, 1.3 + R0() * .5]); }
  scene.add(foliage({ seed: 5, count: phone ? 14000 : 22000, size: .34, clusters: cl, color: 0x5d7d45 }));
  /* street lamps */
  const lamps = [];
  for (let lx = -40; lx <= 40; lx += 16) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 5, 10), new THREE.MeshStandardMaterial({ color: 0x1e2222, metalness: .6, roughness: .4 })); p.position.set(lx, 2.5, -13.5); scene.add(p);
    const head = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffc98a, emissiveIntensity: 0 })); head.position.set(lx, 5.1, -13.5); scene.add(head); lamps.push(head);
    const L = new THREE.PointLight(0xffc98a, 0, 22, 1.6); L.position.set(lx, 4.9, -12.5); scene.add(L); lamps.push(L); }
  /* skyline far away: hundreds of metres, so a long lens pulls it close */
  { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, .5, 0); const m = new THREE.MeshStandardMaterial({ color: 0x8a96a6, roughness: .6, metalness: .3, emissive: 0xffd9a0, emissiveIntensity: 0 });
    const im = new THREE.InstancedMesh(g, m, 70); const d = new THREE.Object3D(); for (let i = 0; i < 70; i++) { d.position.set((R0() - .5) * 900, 0, -380 - R0() * 400); d.scale.set(20 + R0() * 40, 50 + R0() * R0() * 260, 20 + R0() * 40); d.updateMatrix(); im.setMatrixAt(i, d.matrix); } scene.add(im); facades.push(m); }
  /* flowers at your feet: cosmos in two colours, 0.4-0.9 m tall, from 1 to 3 m away */
  { const N = phone ? 260 : 420, stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.004, .006, 1, 5).translate(0, .5, 0), new THREE.MeshStandardMaterial({ color: 0x3f6b2e, roughness: .8 }), N);
    const petalG = new THREE.CircleGeometry(.045, 8); const pos = petalG.attributes.position; for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getY(i), pos.getX(i)), r = Math.hypot(pos.getX(i), pos.getY(i)); const k = .55 + .45 * Math.abs(Math.cos(a * 4)); pos.setXY(i, Math.cos(a) * r * k, Math.sin(a) * r * k); }
    const heads = new THREE.InstancedMesh(petalG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, side: THREE.DoubleSide }), N);
    const cores = new THREE.InstancedMesh(new THREE.SphereGeometry(.012, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf0b62a, roughness: .5 }), N);
    const leaves = foliage({ seed: 8, count: phone ? 1500 : 2600, size: .07, clusters: Array.from({ length: 30 }, () => [(R0() - .5) * 5, .25, -.4 - R0() * 1.8, .35]), color: 0x4f7a3a, squash: .7 });
    const d = new THREE.Object3D(), c = new THREE.Color(), pal = [0xf2a6c8, 0xe0457b, 0xffffff, 0xf7d2e3];
    for (let i = 0; i < N; i++) { const fx = (R0() - .5) * 5, fz = -.3 - R0() * 1.9, hgt = .35 + R0() * .35; d.position.set(fx, 0, fz); d.scale.set(1, hgt, 1); d.rotation.set((R0() - .5) * .2, 0, (R0() - .5) * .2); d.updateMatrix(); stems.setMatrixAt(i, d.matrix);
      d.position.set(fx, hgt, fz); d.scale.set(1, 1, 1); d.rotation.set(-1.1 + (R0() - .5) * .6, (R0() - .5) * 1, 0); d.updateMatrix(); heads.setMatrixAt(i, d.matrix); heads.setColorAt(i, c.set(pal[Math.floor(R0() * pal.length)]));
      d.position.y += .004; d.updateMatrix(); cores.setMatrixAt(i, d.matrix); }
    scene.add(stems, heads, cores, leaves);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(6, .2, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a2d22, roughness: 1 })); bed.position.set(0, .0, -1.3); bed.receiveShadow = true; scene.add(bed); }
  const bike = cyclist(); bike.group.position.set(-12, 0, -7.6); scene.add(bike.group);
  let bikeX = -12, bikeDist = 0;

  /* ---------- the light ---------- */
  function applyLight() {
    const L = C.light, su = sky.material.uniforms;
    const P = { sun: { el: 52, az: 140, top: 0x2f68b8, mid: 0xc8d8e8, bot: 0x6e6a62, sI: 4.2, hI: .8, sC: 0xfff3e2, win: 0 }, shade: { el: 45, az: 160, top: 0x8c96a2, mid: 0xc4c8cc, bot: 0x6a6a68, sI: .25, hI: 1.6, sC: 0xffffff, win: 0 },
      gold: { el: 13, az: 215, top: 0x3a5a90, mid: 0xf2b27a, bot: 0x5a4a40, sI: 4.6, hI: .75, sC: 0xffa860, win: .2 }, night: { el: -12, az: 300, top: 0x02040c, mid: 0x0d1424, bot: 0x050505, sI: 0, hI: .06, sC: 0x6680ff, win: 1 } }[L];
    const e = P.el * Math.PI / 180, a = P.az * Math.PI / 180, dir = new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
    su.top.value.set(P.top); su.mid.value.set(P.mid); su.bot.value.set(P.bot); su.sun.value.copy(dir); su.sunCol.value.set(P.sC).multiplyScalar(L === 'night' ? 0 : L === 'shade' ? .1 : 1);
    scene.fog.color.set(P.mid); sun.position.copy(dir).multiplyScalar(80); sun.color.set(P.sC); sun.intensity = P.sI; hemi.intensity = P.hI;
    facades.forEach((m) => (m.emissiveIntensity = m.clearcoat ? .25 + P.win * .9 : P.win * (m.emissiveMap ? 1.2 : .6)));
    lamps.forEach((o) => { if (o.isPointLight) o.intensity = L === 'night' ? 30 : 0; else o.material.emissiveIntensity = L === 'night' ? 3 : 0; });
  }

  /* ---------- the sensor: render targets and the developing shader ---------- */
  const size = new THREE.Vector2(1, 1);
  const rtScene = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const rtDepth = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }); rtDepth.depthTexture = new THREE.DepthTexture(1, 1); rtDepth.depthTexture.type = THREE.FloatType;
  const rtAcc = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); const qScene = new THREE.Scene(); qScene.add(quad); const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const addM = new THREE.ShaderMaterial({ uniforms: { src: { value: null }, w: { value: 1 } }, transparent: true, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: 'uniform sampler2D src; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(src, vUv).rgb * w, 1.); }' });
  const dev = new THREE.ShaderMaterial({
    uniforms: { col: { value: null }, dep: { value: null }, near: { value: cam.near }, far: { value: cam.far }, res: { value: size }, f: { value: 50 }, N: { value: 2.8 }, s: { value: 9200 }, sensH: { value: 24 },
      gain: { value: 1 }, iso: { value: 100 }, seed: { value: 0 }, taps: { value: phone ? 36 : 56 }, maxR: { value: 36 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: `uniform sampler2D col, dep; uniform float near, far, f, N, s, sensH, gain, iso, seed, taps, maxR; uniform vec2 res; varying vec2 vUv;
      float lin(float d){ float z = d * 2. - 1.; return 2. * near * far / (far + near - z * (far - near)); }
      /* circle of confusion in pixels for a point at distance x (metres) */
      float coc(float xm){ float x = xm * 1000.; float c = (f * f / (N * (s - f))) * abs(x - s) / x; c += 2.44 * .00055 * N; return min(c / sensH * res.y, maxR); }
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
      void main(){
        float d0 = lin(texture2D(dep, vUv).r), r0 = coc(d0);
        vec3 acc = vec3(0.); float wsum = 0.;
        const float GA = 2.39996323;
        for (int i = 0; i < 64; i++) { if (float(i) >= taps) break;
          float fi = float(i) + .5, rr = sqrt(fi / taps), a = fi * GA; vec2 o = vec2(cos(a), sin(a)) * rr * r0;
          vec2 uv = vUv + o / res; float di = lin(texture2D(dep, uv).r), ri = coc(di);
          /* a sample only spreads onto this pixel if its own blur reaches this far; sharp things behind don't bleed forward */
          float w = di < d0 ? smoothstep(0., 1., ri - length(o) + 1.) : 1.;
          w = max(w, .02); acc += texture2D(col, uv).rgb * w; wsum += w; }
        vec3 c = acc / wsum * gain;
        /* sensor noise: photon shot noise grows with ISO, worst in shadows; plus some colour noise */
        float k = .006 * sqrt(iso / 100.) * (iso > 800. ? 1.6 : 1.);
        float n = (h(vUv * res) + h(vUv * res + 3.1) + h(vUv * res + 7.7) - 1.5) * 1.4;
        vec3 cn = vec3(h(vUv * res + 1.3), h(vUv * res + 2.7), h(vUv * res + 5.9)) - .5;
        c += (n + cn * (iso >= 3200. ? .8 : .3)) * k * sqrt(c + .02) * 3.;
        c = max(c, 0.);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });

  /* ---------- layout: the picture is 3:2 (or 2:3 held upright), in the space beside the controls ---------- */
  const box = { x: 0, y: 0, w: 1, h: 1 };
  function layout() {
    const [W, H] = viewSize(), desk = W > 760;
    const ax = desk ? 24 : 8, ay = desk ? 78 : 108, aw = desk ? W - 340 - 24 - 48 : W - 16, ah = desk ? H - 78 - 40 : H - 108 - 112 - 34;
    C.vertical = !desk && ah > aw * .9;
    const ar = C.vertical ? 2 / 3 : 3 / 2; let w = aw, h = w / ar; if (h > ah) { h = ah; w = h * ar; }
    box.w = Math.round(w); box.h = Math.round(h); box.x = Math.round(ax + (aw - w) / 2); box.y = Math.round(ay + (ah - h) / 2);
    Object.assign(canvas.style, { inset: 'auto', left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', borderRadius: '4px', boxShadow: '0 30px 80px rgba(0,0,0,.6)' });
    R.setSize(box.w, box.h, false); const pr = R.getPixelRatio(); size.set(box.w * pr, box.h * pr);
    for (const rt of [rtScene, rtDepth, rtAcc]) rt.setSize(size.x, size.y);
    cam.aspect = box.w / box.h; frameEl && Object.assign(frameEl.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
    lens();
  }
  function lens() { const sensV = C.vertical ? SENSOR_W : SENSOR_H; cam.fov = 2 * Math.atan(sensV / (2 * C.f)) * 180 / Math.PI; cam.updateProjectionMatrix(); dev.uniforms.sensH.value = sensV; }

  /* develop one frame: n sub-frames across the shutter interval, then the lens and sensor */
  function develop(now, nSub) {
    const t = C.t, v = C.speed; const x0 = bikeX;
    R.setRenderTarget(rtAcc); R.setClearColor(0x000000, 1); R.clear();
    for (let k = 0; k < nSub; k++) {
      const off = nSub > 1 ? (k / (nSub - 1) - .5) * v * t : 0;
      bike.group.position.x = x0 + off; bike.update(bikeDist + off);
      R.setRenderTarget(rtScene); R.render(scene, cam);
      addM.uniforms.src.value = rtScene.texture; addM.uniforms.w.value = 1 / nSub; quad.material = addM; R.setRenderTarget(rtAcc); R.autoClear = false; R.render(qScene, qCam); R.autoClear = true;
    }
    bike.group.position.x = x0; bike.update(bikeDist);
    R.setRenderTarget(rtDepth); R.render(scene, cam);
    const U = dev.uniforms; U.col.value = rtAcc.texture; U.dep.value = rtDepth.depthTexture; U.f.value = C.f; U.N.value = C.N; U.s.value = C.focus; U.iso.value = C.iso; U.seed.value = (now % 1000) * .37;
    U.gain.value = Math.pow(2, LIGHT[C.light][1] - evOf(C.N, C.t, C.iso)); U.maxR.value = Math.min(48, size.y * .045);
    quad.material = dev; R.setRenderTarget(null); R.render(qScene, qCam);
  }
  function subFrames() {
    /* how far the cyclist smears on the sensor, in pixels: speed × time, projected */
    const dist = Math.abs(bike.group.position.z - EYE.z) * 1000, mm = C.speed * C.t * 1000 * C.f / dist, px = mm / (C.vertical ? SENSOR_W : SENSOR_H) * size.y;
    return { px, n: clamp(Math.ceil(px / 3), 1, phone ? 8 : 14) };
  }

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 29 · Photography', title: 'Camera School', lede: 'A full-frame camera in a real 3D street. Aperture, shutter and ISO change the picture exactly as they would on a real sensor. Tap the picture to focus.' });
  const sExp = P.section('Exposure');
  chips(sExp, 'Light', Object.entries(LIGHT).map(([k, v]) => [k, v[0]]), C.light, (v) => { C.light = v; applyLight(); info(); });
  const rN = range(sExp, 'Aperture', { min: 0, max: STOPS_N.length - 1, value: STOPS_N.indexOf(C.N), fmt: (i) => 'f/' + STOPS_N[i] }, (i) => { C.N = STOPS_N[i]; info(); });
  const rT = range(sExp, 'Shutter speed', { min: 0, max: STOPS_T.length - 1, value: STOPS_T.indexOf(C.t), fmt: (i) => tName(STOPS_T[i]) + ' s' }, (i) => { C.t = STOPS_T[i]; info(); });
  const rI = range(sExp, 'ISO', { min: 0, max: STOPS_ISO.length - 1, value: 0, fmt: (i) => String(STOPS_ISO[i]) }, (i) => { C.iso = STOPS_ISO[i]; info(); });
  buttons(sExp, [['Meter: set the shutter for me', () => autoExpose(), true]]);
  const sLens = P.section('Lens & focus');
  range(sLens, 'Focal length', { min: Math.log(14), max: Math.log(200), step: .01, value: Math.log(C.f), fmt: (v) => Math.round(Math.exp(v)) + ' mm' }, (v) => { C.f = Math.round(Math.exp(v)); lens(); info(); });
  const rF = range(sLens, 'Focus distance', { min: Math.log(400), max: Math.log(100000), step: .01, value: Math.log(C.focus), fmt: (v) => mFmt(Math.exp(v)) }, (v) => { C.focus = Math.exp(v); info(); });
  buttons(sLens, [['Focus on the cyclist', () => setFocus(Math.abs(bike.group.position.z - EYE.z) * 1000)], ['Hyperfocal', () => setFocus(Math.min(99000, hyperfocal(C.f, C.N)))]]);
  range(sLens, 'Cyclist speed', { min: 0, max: 12, step: .5, value: C.speed, fmt: (v) => v + ' m/s · ' + Math.round(v * 3.6) + ' km/h' }, (v) => { C.speed = v; info(); });
  const sShot = P.section('Shoot');
  const sv = P.stats(sShot, [['ev', 'Exposure meter'], ['dof', 'Sharp from … to'], ['hyp', 'Hyperfocal'], ['mb', 'Motion blur']]);
  buttons(sShot, [['Take photo', () => shoot(), true]]);
  const strip = el('div', { style: { display: 'flex', gap: '6px', overflowX: 'auto', padding: '4px 0' } }); sShot.append(strip);
  note(sShot, 'Each stop of aperture, shutter or ISO doubles or halves the light. A wide aperture and a long lens blur the background; a fast shutter freezes the cyclist; high ISO brightens but adds grain. Sharpness uses a 0.03 mm circle of confusion, the full-frame standard. Tap a photo to download it.');
  const sv2 = P.stats(sExp, [['ev', 'Exposure meter'], ['mb', 'Motion blur']]);
  function setFocus(mm) { C.focus = clamp(mm, 400, 100000); rF.set(Math.log(C.focus)); info(); }
  function autoExpose() { const target = LIGHT[C.light][1]; let best = 0, bd = 1e9; STOPS_T.forEach((t, i) => { const d = Math.abs(evOf(C.N, t, C.iso) - target); if (d < bd) { bd = d; best = i; } }); C.t = STOPS_T[best]; rT.set(best); info(); toast(ui, `Metered: ${tName(C.t)} s at f/${C.N}, ISO ${C.iso}`); }
  function info() {
    const diff = evOf(C.N, C.t, C.iso) - LIGHT[C.light][1], ev = Math.abs(diff) < .17 ? '0 · correct' : (diff < 0 ? '+' : '−') + Math.abs(diff).toFixed(1) + (diff < 0 ? ' over' : ' under');
    const D = dof(C.f, C.N, C.focus), mb = subFrames().px;
    sv.ev.textContent = sv2.ev.textContent = ev; sv.dof.textContent = mFmt(D.near) + ' – ' + mFmt(D.far); sv.hyp.textContent = mFmt(D.H);
    sv.mb.textContent = sv2.mb.textContent = mb < 1 ? 'frozen' : Math.round(mb) + ' px';
    hud.innerHTML = `<b>${C.f} mm</b> · f/${C.N} · ${tName(C.t)} · ISO ${C.iso} · <span>${ev.startsWith('0') ? '●' : diff < 0 ? '▲' : '▼'} ${ev}</span>`;
  }
  let waitShot = false;
  function shoot(now) {
    if (!now && C.speed > 0 && Math.abs(bikeX - .3) > .4) { waitShot = true; toast(ui, 'Waiting for the cyclist…'); return; }
    const { n } = subFrames(); develop(performance.now(), n);
    const url = canvas.toDataURL('image/jpeg', .92); flash();
    const im = el('img', { src: url, alt: 'Photo', style: { height: '60px', borderRadius: '3px', cursor: 'pointer', border: '1px solid var(--line)', flex: 'none' } });
    const name = `abidora-${C.f}mm-f${C.N}-${tName(C.t).replace('/', '_')}-iso${C.iso}.jpg`;
    im.addEventListener('click', () => download(name, url)); strip.prepend(im); while (strip.children.length > 10) strip.lastChild.remove();
    if (phone) P.show(2); toast(ui, 'Photo taken · tap it to download');
  }
  /* viewfinder frame, info line, shutter button */
  const frameEl = el('div', { style: { position: 'fixed', zIndex: 5, pointerEvents: 'none', border: '1px solid rgba(255,255,255,.18)', borderRadius: '4px' } });
  frameEl.append(el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '36px', height: '24px', margin: '-12px 0 0 -18px', border: '1px solid rgba(255,204,51,.8)' } }));
  const fpt = el('div', { style: { position: 'absolute', width: '22px', height: '22px', margin: '-11px 0 0 -11px', border: '2px solid #ffcc33', borderRadius: '50%', opacity: 0, transition: 'opacity .4s' } }); frameEl.append(fpt);
  const flashEl = el('div', { style: { position: 'absolute', inset: 0, background: '#fff', opacity: 0, transition: 'opacity .25s' } }); frameEl.append(flashEl);
  ui.append(frameEl);
  const hud = el('div', { class: 'hint', style: { textTransform: 'none', letterSpacing: '.04em', fontSize: '12px' } }); ui.append(hud);
  const fab = el('div', { class: 'fab' }); const shutterB = el('button', { text: '● Take photo', 'aria-pressed': 'true', onclick: () => shoot() }); fab.append(shutterB); ui.append(fab);
  function flash() { flashEl.style.transition = 'none'; flashEl.style.opacity = .8; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .45s'; flashEl.style.opacity = 0; }); }
  const desk = () => viewSize()[0] > 760;
  const placeHud = () => { Object.assign(hud.style, desk() ? { left: box.x + box.w / 2 + 'px', top: box.y + box.h + 10 + 'px', bottom: 'auto' } : { left: '50%', top: box.y + box.h + 12 + 'px', bottom: 'auto' }); };
  /* tap to focus: read the distance under the finger */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointerup', (e) => {
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(scene.children, true).find((x) => x.object.visible && x.object !== sky); if (!h) return;
    const d = h.point.clone().sub(cam.position).dot(cam.getWorldDirection(new THREE.Vector3())) * 1000; setFocus(d);
    const hr = host.el ? host.el.getBoundingClientRect() : { left: 0, top: 0 }; fpt.style.left = (e.clientX - hr.left - box.x) + 'px'; fpt.style.top = (e.clientY - hr.top - box.y) + 'px'; fpt.style.opacity = 1; setTimeout(() => (fpt.style.opacity = 0), 900); toast(ui, 'Focused at ' + mFmt(d));
  });

  on(window, 'resize', () => { layout(); placeHud(); }); if (host.el && window.ResizeObserver) { const ro = new ResizeObserver(() => { layout(); placeHud(); }); ro.observe(host.el); onEnd(() => ro.disconnect()); }
  applyLight(); layout(); placeHud(); info();
  let frames = 0;
  loop((dt, t) => {
    bikeX += C.speed * dt; bikeDist += C.speed * dt; if (bikeX > 9) bikeX = -9;
    if (waitShot && Math.abs(bikeX - .3) < C.speed * dt + .02) { waitShot = false; shoot(true); }
    const { n } = subFrames(); if (frames++ % 20 === 0) info();
    develop(t * 1000, phone ? Math.min(n, 6) : n); R.adapt();
  });
  R.onDpr = () => layout();
}
