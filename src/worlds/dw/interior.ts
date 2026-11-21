// @ts-nocheck
/* World 26 · Interior Design. A real-size room in 3D. Every piece of furniture is modelled at its true size;
   drag it across the floor, turn it, add or remove pieces. The planner checks the layout the way a designer would:
   pieces that collide, a door that cannot swing open, walkways narrower than 60 cm. Change the floor, the walls and
   the hour, and sunlight moves through the window. Layouts are kept on this device and save as a picture.
   Units: 1 = 1 metre. The window is on the south wall (+Z), the door on the west wall (-X). */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { THREE, OrbitControls, renderer, panel, range, chips, buttons, note, toast, loop, fit, el, tween, foliage,
  cv, tex, normalFromHeight, noise2, fbm, rng, clamp, lerp, store, download, panelEnv, TAU } from './akit';

const K = {
  sofa: { name: 'Sofa, 3 seats', w: 2.2, d: .95 }, arm: { name: 'Armchair', w: .85, d: .85 }, coffee: { name: 'Coffee table', w: 1.1, d: .6 },
  dining: { name: 'Dining table', w: 1.6, d: .9 }, chair: { name: 'Dining chair', w: .46, d: .52 }, bed: { name: 'Double bed', w: 1.7, d: 2.15 },
  ward: { name: 'Wardrobe', w: 1.2, d: .6 }, desk: { name: 'Desk', w: 1.4, d: .7 }, shelf: { name: 'Bookcase', w: .9, d: .32 },
  tv: { name: 'TV unit', w: 1.8, d: .42 }, plant: { name: 'Plant', w: .5, d: .5 }, lamp: { name: 'Floor lamp', w: .4, d: .4 }, rug: { name: 'Rug', w: 2.4, d: 1.7, soft: true },
};
const START = { W: 5.4, D: 4.4, floor: 'oak', wall: '#ece6db', items: [
  { k: 'rug', x: 2.9, z: 2.3, r: 0 }, { k: 'sofa', x: 2.9, z: 3.75, r: 180 }, { k: 'coffee', x: 2.9, z: 2.35, r: 0 }, { k: 'tv', x: 2.9, z: .25, r: 0 },
  { k: 'arm', x: 4.6, z: 2.3, r: 270 }, { k: 'plant', x: .45, z: 3.95, r: 0 }, { k: 'lamp', x: 4.85, z: 3.9, r: 0 }, { k: 'shelf', x: 5.22, z: .9, r: 270 },
] };
const WALK = .6, H = 2.8, DOOR = { z0: .35, w: .9 };

/* ---------- surfaces drawn in code ---------- */
function oakPlanks(seed) {
  const n = noise2(seed), R = rng(seed), W = 1024, [c, g] = cv(W), [hc, hg] = cv(W);
  hg.fillStyle = '#fff'; hg.fillRect(0, 0, W, W);
  const pw = W / 6, rows = 6; /* six planks of 18 cm across 1.08 m */
  for (let i = 0; i < rows; i++) {
    let y0 = 0; while (y0 < W) {
      const len = W * (.45 + R() * .55), tone = .9 + R() * .14, off = R() * 100;
      const im = g.createImageData(pw | 0, Math.min(len, W - y0) | 0);
      for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
        const gr = fbm(n, (x + off) / 6 + Math.sin((y + off) / 90) * 2, (y + off) / 160, 4), ring = Math.sin(gr * 40) * .5 + .5, k = tone * (.78 + ring * .14 + gr * .2), p = (y * im.width + x) * 4;
        im.data[p] = 182 * k; im.data[p + 1] = 136 * k; im.data[p + 2] = 92 * k; im.data[p + 3] = 255;
      }
      g.putImageData(im, i * pw, y0); hg.fillStyle = '#000'; hg.fillRect(i * pw, y0, pw, 2); hg.fillRect(i * pw, y0, 2, len); y0 += len;
    }
  }
  return { map: c, normal: normalFromHeight(hc, 2.5) };
}
function marble(seed) {
  const n = noise2(seed), W = 1024, [c, g] = cv(W); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const v = fbm(n, x / 200, y / 200, 6), vein = Math.pow(1 - Math.abs(Math.sin((x / W + y / W * .6 + v * 2.2) * Math.PI * 3)), 14), p = (y * W + x) * 4, k = 236 - vein * 120 - v * 14;
    im.data[p] = k; im.data[p + 1] = k - 2; im.data[p + 2] = k - 4 + vein * 6; im.data[p + 3] = 255;
  }
  g.putImageData(im, 0, 0); g.strokeStyle = 'rgba(120,110,100,.35)'; g.lineWidth = 2; g.strokeRect(0, 0, W, W); return { map: c };
}
function terrazzo(seed) {
  const R = rng(seed), W = 1024, [c, g] = cv(W); g.fillStyle = '#e9e3d8'; g.fillRect(0, 0, W, W);
  const cols = ['#c75b3c', '#2f4f6f', '#d9a441', '#8a8a86', '#f7f4ee', '#5b7a5b'];
  for (let i = 0; i < 2600; i++) { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); const x = R() * W, y = R() * W, r = 2 + R() * R() * 16; g.moveTo(x + r, y); for (let k = 1; k < 7; k++) { const a = k / 7 * TAU, rr = r * (.6 + R() * .5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); }
  return { map: c };
}
function concreteF(seed) {
  const n = noise2(seed), W = 512, [c, g] = cv(W); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = fbm(n, x / 70, y / 70, 5), p = (y * W + x) * 4, k = 150 + v * 60; im.data[p] = k; im.data[p + 1] = k; im.data[p + 2] = k * .98; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0); return { map: c };
}
function fabricNormal(seed) {
  const W = 256, [c, g] = cv(W); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const a = Math.sin(x * .9) * Math.cos(y * .9), p = (y * W + x) * 4; im.data[p] = 128 + Math.cos(x * .9) * 40; im.data[p + 1] = 128 + Math.sin(y * .9) * 40 * (a > 0 ? 1 : -1); im.data[p + 2] = 235; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0); const t = tex(c, false); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14); return t;
}
function rugTex(seed) {
  const R = rng(seed), W = 1024, [c, g] = cv(W, W * .7); const H2 = W * .7;
  g.fillStyle = '#d7c3a5'; g.fillRect(0, 0, W, H2); g.strokeStyle = '#8c5a3c'; g.lineWidth = 16; g.strokeRect(40, 40, W - 80, H2 - 80);
  g.lineWidth = 4; g.strokeRect(70, 70, W - 140, H2 - 140);
  for (let i = 0; i < 9; i++) { g.strokeStyle = i % 2 ? '#b98a5e' : '#5d4636'; g.lineWidth = 3; g.beginPath(); g.moveTo(130 + i * 90, 110); g.lineTo(170 + i * 90, H2 / 2); g.lineTo(130 + i * 90, H2 - 110); g.stroke(); }
  for (let i = 0; i < 40000; i++) { g.fillStyle = `rgba(${R() > .5 ? '255,255,255' : '0,0,0'},.05)`; g.fillRect(R() * W, R() * H2, 2, 2); }
  return c;
}

export async function start(canvas, ui) {
  const R = renderer(canvas, { exposure: 1, tone: THREE.ACESFilmicToneMapping, keep: true });
  const phone = R.phone;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8e2d6);
  const cam = new THREE.PerspectiveCamera(phone ? 52 : 40, 1, .05, 200);
  fit(R, cam, canvas);
  scene.environment = panelEnv(R, [{ w: 8, h: 4, p: [0, 3, 8], i: 3, c: 0xfff3e0 }, { w: 12, h: 12, p: [0, 10, 0], i: 1.4 }, { w: 6, h: 6, p: [-8, 2, -2], i: .6, c: 0xdde6ff }], 0x9a9184);
  scene.environmentIntensity = .55;

  const st0 = store('w26.room', START), S = JSON.parse(JSON.stringify(st0.get()));
  if (!Array.isArray(S.items)) Object.assign(S, JSON.parse(JSON.stringify(START)));

  /* materials */
  const fl = { oak: oakPlanks(4), marble: marble(6), terrazzo: terrazzo(3), concrete: concreteF(8) };
  const flT = Object.fromEntries(Object.entries(fl).map(([k, v]) => { const t = tex(v.map); t.wrapS = t.wrapT = THREE.RepeatWrapping; return [k, { map: t, n: v.normal ? tex(v.normal, false) : null }]; }));
  Object.values(flT).forEach((o) => { if (o.n) o.n.wrapS = o.n.wrapT = THREE.RepeatWrapping; });
  const floorMat = new THREE.MeshPhysicalMaterial({ roughness: .45, clearcoat: .35, clearcoatRoughness: .25 });
  const wallMat = new THREE.MeshStandardMaterial({ color: S.wall, roughness: .92 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: .95 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: .6 });
  const fabN = fabricNormal(1);
  const fabric = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: .85, sheen: 1, sheenRoughness: .6, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), .4), normalMap: fabN, normalScale: new THREE.Vector2(.35, .35) });
  const grain = (() => { const n = noise2(21), W = 512, [c, g] = cv(W); const im = g.createImageData(W, W);
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const gr = fbm(n, x / 5 + Math.sin(y / 70) * 3, y / 140, 4), ring = Math.sin(gr * 38) * .5 + .5, k = .8 + ring * .12 + gr * .18, p = (y * W + x) * 4; im.data[p] = 182 * k; im.data[p + 1] = 136 * k; im.data[p + 2] = 92 * k; im.data[p + 3] = 255; }
    g.putImageData(im, 0, 0); return c; })();
  const oakT = tex(grain); oakT.wrapS = oakT.wrapT = THREE.RepeatWrapping;
  const wood = new THREE.MeshPhysicalMaterial({ map: oakT, roughness: .5, clearcoat: .4, clearcoatRoughness: .3 });
  const walnut = new THREE.MeshPhysicalMaterial({ map: oakT, color: 0x6a4a35, roughness: .45, clearcoat: .5 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x1b1b1c, metalness: .8, roughness: .35 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25c, metalness: 1, roughness: .28 });
  const lacquer = new THREE.MeshPhysicalMaterial({ color: 0xece8e0, roughness: .35, clearcoat: .6 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xd9cfc2, roughness: .4, clearcoat: .5 });
  const screen = new THREE.MeshPhysicalMaterial({ color: 0x050506, roughness: .05, metalness: .2, clearcoat: 1 });
  const linen = fabric(0xf1ece2), sofaF = fabric(0x8b9a87), armF = fabric(0xb5774c), duvet = fabric(0xe9e4da), shadeM = new THREE.MeshStandardMaterial({ color: 0xf6efe0, emissive: 0xffd9a0, emissiveIntensity: .0, side: THREE.DoubleSide, roughness: .9, transparent: true, opacity: .95 });
  const rugM = new THREE.MeshStandardMaterial({ map: tex(rugTex(3)), roughness: 1, normalMap: fabN, normalScale: new THREE.Vector2(.6, .6) });
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: 0, transparent: true, opacity: .12, depthWrite: false });
  const mesh = (g, m, cast = true) => { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; };
  const rb = (w, h, d, r = .03, m) => mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - .001, h / 2 - .001, d / 2 - .001)), m);
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  /* ---------- furniture, modelled at true size; origin at floor centre, front faces +Z ---------- */
  const B = {
    sofa() { const g = new THREE.Group(); const w = 2.2, d = .95;
      g.add(at(rb(w, .22, d - .05, .03, sofaF), 0, .26, 0));
      for (const sx of [-1, 1]) g.add(at(rb(.2, .62, d, .06, sofaF), sx * (w / 2 - .1), .31 + .0, 0));
      g.add(at(rb(w - .1, .5, .2, .07, sofaF), 0, .55, -d / 2 + .12));
      for (let i = 0; i < 3; i++) { const c = rb(.6, .16, .68, .07, sofaF); c.position.set((i - 1) * .61, .45, .08); g.add(c); const b = rb(.58, .42, .16, .07, sofaF); b.position.set((i - 1) * .61, .68, -.26); b.rotation.x = -.15; g.add(b); }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.CylinderGeometry(.018, .012, .15, 10), walnut), sx * (w / 2 - .08), .075, sz * (d / 2 - .08)));
      return g; },
    arm() { const g = new THREE.Group();
      g.add(at(rb(.8, .2, .78, .05, armF), 0, .3, 0)); const s = rb(.66, .14, .62, .06, armF); s.position.set(0, .45, .06); g.add(s);
      const bk = rb(.78, .55, .16, .07, armF); bk.position.set(0, .66, -.32); bk.rotation.x = -.18; g.add(bk);
      for (const sx of [-1, 1]) g.add(at(rb(.12, .32, .74, .05, armF), sx * .36, .52, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = mesh(new THREE.CylinderGeometry(.02, .013, .22, 10), walnut); l.position.set(sx * .34, .11, sz * .32); l.rotation.z = sx * .12; g.add(l); }
      return g; },
    coffee() { const g = new THREE.Group(); g.add(at(rb(1.1, .04, .6, .015, walnut), 0, .4, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.CylinderGeometry(.012, .012, .38, 8), blackMetal), sx * .5, .19, sz * .25));
      g.add(at(rb(1.0, .02, .5, .01, walnut), 0, .14, 0)); const b = mesh(new THREE.CylinderGeometry(.09, .07, .1, 24), ceramic); b.position.set(.25, .47, .05); g.add(b);
      for (let i = 0; i < 3; i++) { const bk = rb(.26 - i * .02, .03, .2, .004, new THREE.MeshStandardMaterial({ color: [0x2a3f5a, 0xb24a2b, 0xe8e0cf][i], roughness: .7 })); bk.position.set(-.25, .435 + i * .03, 0); bk.rotation.y = i * .2; g.add(bk); }
      return g; },
    dining() { const g = new THREE.Group(); g.add(at(rb(1.6, .045, .9, .015, wood), 0, .735, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(rb(.06, .71, .06, .01, wood), sx * .72, .355, sz * .37)); return g; },
    chair() { const g = new THREE.Group(); g.add(at(rb(.44, .04, .44, .01, wood), 0, .45, .02));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(mesh(new THREE.CylinderGeometry(.016, .014, .45, 8), wood), sx * .19, .225, sz * .19 + .02));
      const bk = rb(.42, .28, .025, .01, wood); bk.position.set(0, .74, -.22); bk.rotation.x = -.08; g.add(bk);
      for (const sx of [-1, 1]) g.add(at(mesh(new THREE.CylinderGeometry(.014, .014, .48, 8), wood), sx * .19, .68, -.2)); return g; },
    bed() { const g = new THREE.Group(); g.add(at(rb(1.7, .28, 2.1, .03, walnut), 0, .2, 0)); g.add(at(rb(1.62, .22, 2.0, .06, linen), 0, .45, .02));
      const hb = rb(1.76, 1.0, .1, .04, fabric(0x6f6a62)); hb.position.set(0, .5, -1.04); g.add(hb);
      const dv = rb(1.66, .1, 1.45, .05, duvet); dv.position.set(0, .58, .3); g.add(dv); const throwB = rb(1.68, .11, .45, .05, fabric(0x9a5b3c)); throwB.position.set(0, .6, .74); g.add(throwB);
      for (const sx of [-1, 1]) { const p = rb(.6, .14, .4, .07, linen); p.position.set(sx * .4, .64, -.75); p.rotation.x = -.35; g.add(p); } return g; },
    ward() { const g = new THREE.Group(); g.add(at(rb(1.2, 2.1, .6, .01, lacquer), 0, 1.05, 0));
      for (const sx of [-1, 1]) { g.add(at(rb(.58, 2.02, .02, .005, lacquer), sx * .3, 1.06, .305)); g.add(at(mesh(new THREE.CylinderGeometry(.008, .008, .3, 8), brass), sx * .03, 1.1, .33)); } return g; },
    desk() { const g = new THREE.Group(); g.add(at(rb(1.4, .03, .7, .01, wood), 0, .74, 0));
      for (const sx of [-1, 1]) { const f = rb(.03, .72, .6, .01, blackMetal); f.position.set(sx * .66, .36, 0); g.add(f); }
      g.add(at(rb(.5, .32, .02, .01, screen), .1, 1.02, -.2)); g.add(at(mesh(new THREE.CylinderGeometry(.01, .01, .15, 8), blackMetal), .1, .83, -.22));
      const lp = mesh(new THREE.ConeGeometry(.08, .12, 24, 1, true), brass); lp.position.set(-.5, 1.12, -.15); g.add(lp); g.add(at(mesh(new THREE.CylinderGeometry(.006, .006, .38, 8), brass), -.5, .93, -.15)); return g; },
    shelf() { const g = new THREE.Group(), R0 = rng(5);
      for (const sx of [-1, 1]) g.add(at(rb(.03, 1.9, .32, .005, walnut), sx * .435, .95, 0)); for (let i = 0; i < 6; i++) g.add(at(rb(.87, .025, .3, .005, walnut), 0, .05 + i * .36, 0));
      g.add(at(rb(.87, 1.9, .015, .002, walnut), 0, .95, -.15));
      const bc = [0x7a2e22, 0x23384f, 0xd8cdb5, 0x3c5a3f, 0xb48a4a, 0x1c1c1c, 0xa9a39a];
      for (let i = 0; i < 5; i++) { let x = -.4; while (x < .35) { const w = .025 + R0() * .03, hh = .2 + R0() * .1; if (R0() < .12) { x += .08; continue; } g.add(at(rb(w, hh, .22, .003, new THREE.MeshStandardMaterial({ color: bc[Math.floor(R0() * bc.length)], roughness: .8 })), x + w / 2, .065 + i * .36 + hh / 2, .02)); x += w + .003; } }
      return g; },
    tv() { const g = new THREE.Group(); g.add(at(rb(1.8, .45, .42, .01, walnut), 0, .3, 0)); for (const sx of [-1, 0, 1]) g.add(at(rb(.58, .4, .01, .003, walnut), sx * .6, .3, .215));
      for (const sx of [-1, 1]) g.add(at(mesh(new THREE.CylinderGeometry(.012, .012, .08, 8), blackMetal), sx * .8, .04, 0));
      g.add(at(rb(1.45, .83, .03, .006, screen), 0, 1.05, -.05)); g.add(at(rb(.3, .02, .18, .005, blackMetal), 0, .535, -.04)); g.add(at(mesh(new THREE.BoxGeometry(.04, .1, .02), blackMetal), 0, .58, -.06)); return g; },
    plant() { const g = new THREE.Group(); g.add(at(mesh(new THREE.CylinderGeometry(.2, .15, .42, 32), ceramic), 0, .21, 0));
      const cl = []; const R0 = rng(9); for (let i = 0; i < 7; i++) cl.push([(R0() - .5) * .3, .75 + R0() * .6, (R0() - .5) * .3, .22 + R0() * .1]);
      g.add(foliage({ seed: 3, count: 900, size: .17, clusters: cl, color: 0x4f7a42, squash: 1 })); g.add(at(mesh(new THREE.CylinderGeometry(.012, .02, .9, 6), new THREE.MeshStandardMaterial({ color: 0x4a3a2a })), 0, .8, 0)); return g; },
    lamp() { const g = new THREE.Group(); g.add(at(mesh(new THREE.CylinderGeometry(.16, .17, .025, 32), brass), 0, .012, 0)); g.add(at(mesh(new THREE.CylinderGeometry(.01, .01, 1.45, 8), brass), 0, .74, 0));
      const sh = mesh(new THREE.CylinderGeometry(.16, .22, .3, 32, 1, true), shadeM, false); sh.position.y = 1.5; g.add(sh);
      const L = new THREE.PointLight(0xffc98a, 0, 6, 1.6); L.position.y = 1.45; L.castShadow = false; g.add(L); g.userData.light = L; return g; },
    rug() { const g = new THREE.Group(); const r = mesh(new THREE.BoxGeometry(2.4, .012, 1.7), rugM, false); r.position.y = .006; g.add(r); return g; },
  };

  /* ---------- the room ---------- */
  const room = new THREE.Group(); scene.add(room);
  let floor, ceiling; const walls = {};
  const sunL = new THREE.DirectionalLight(0xfff0d8, 6); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -.0004; sunL.shadow.normalBias = .02;
  Object.assign(sunL.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: .5, far: 40 }); scene.add(sunL, sunL.target);
  const fill = new THREE.HemisphereLight(0xfff6ea, 0x8a7a68, .45); scene.add(fill);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(40, 18), new THREE.MeshBasicMaterial({ color: 0xd9e6ef })); scene.add(outside);
  /* a garden beyond the window: soft trees */
  const garden = new THREE.Group(); scene.add(garden);
  { const R0 = rng(4); const cl = []; for (let i = 0; i < 14; i++) cl.push([(R0() - .5) * 16, 1.5 + R0() * 3, 4 + R0() * 4, 1 + R0() * 1.2]); garden.add(foliage({ seed: 12, count: phone ? 5000 : 9000, size: .4, clusters: cl, color: 0x6f8f55, squash: .8 }));
    const gr = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshStandardMaterial({ color: 0x7d8f5a, roughness: 1 })); gr.rotation.x = -Math.PI / 2; gr.position.set(0, -.02, 8); gr.receiveShadow = true; garden.add(gr); }

  function wallWithHoles(len, holes) {
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len, 0); s.lineTo(len, H); s.lineTo(0, H); s.closePath();
    for (const [x0, y0, x1, y1] of holes) { const p = new THREE.Path(); p.moveTo(x0, y0); p.lineTo(x1, y0); p.lineTo(x1, y1); p.lineTo(x0, y1); p.closePath(); s.holes.push(p); }
    return new THREE.ExtrudeGeometry(s, { depth: .12, bevelEnabled: false });
  }
  const winW = () => Math.min(2.6, S.W - 1.2);
  function buildRoom() {
    room.clear();
    const W = S.W, D = S.D;
    floor = mesh(new THREE.PlaneGeometry(W, D), floorMat, false); floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, D / 2); room.add(floor);
    const rep = S.floor === 'oak' ? [W / 1.08, D / 1.08] : S.floor === 'concrete' ? [W / 2, D / 2] : [W / .9, D / .9];
    const ft = flT[S.floor]; ft.map.repeat.set(...rep); if (ft.n) ft.n.repeat.set(...rep);
    floorMat.map = ft.map; floorMat.normalMap = ft.n; floorMat.roughness = S.floor === 'marble' ? .12 : S.floor === 'oak' ? .5 : .35; floorMat.needsUpdate = true;
    ceiling = mesh(new THREE.PlaneGeometry(W, D), ceilMat, false); ceiling.rotation.x = Math.PI / 2; ceiling.position.set(W / 2, H, D / 2); room.add(ceiling);
    const ww = winW(), wx = (W - ww) / 2;
    /* north wall (z = 0, facing +Z) */
    const n = mesh(wallWithHoles(W + .24, []), wallMat); n.position.set(-.12, 0, -.12); room.add(n); walls.n = n;
    /* south wall with a tall window */
    const s = mesh(wallWithHoles(W + .24, [[wx + .12, .45, wx + ww + .12, 2.45]]), wallMat); s.position.set(-.12, 0, D); room.add(s); walls.s = s;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww, 2), glassM); pane.position.set(W / 2, 1.45, D + .06); room.add(pane); walls.pane = pane;
    const frames = new THREE.Group(); room.add(frames); walls.frames = frames;
    for (let k = 0; k <= 2; k++) { const m = mesh(new THREE.BoxGeometry(.04, 2, .08), blackMetal); m.position.set(wx + k * ww / 2, 1.45, D + .06); frames.add(m); }
    for (const y of [.45, 2.45]) { const m = mesh(new THREE.BoxGeometry(ww, .04, .14), blackMetal); m.position.set(W / 2, y, D + .06); frames.add(m); }
    /* west wall with the door, east wall plain */
    const w = mesh(wallWithHoles(D, [[D - DOOR.z0 - DOOR.w, 0, D - DOOR.z0, 2.1]]), wallMat); w.rotation.y = Math.PI / 2; w.position.set(-.12, 0, D); room.add(w); walls.w = w;
    const doorG = new THREE.Group(); doorG.position.set(0, 0, DOOR.z0); const leaf = rb(.04, 2.05, DOOR.w - .02, .005, lacquer); leaf.position.set(0, 1.03, DOOR.w / 2); doorG.add(leaf);
    const knob = mesh(new THREE.SphereGeometry(.03, 16, 12), brass); knob.position.set(.05, 1.0, DOOR.w - .1); doorG.add(knob); doorG.rotation.y = .6; room.add(doorG); walls.door = doorG;
    const e = mesh(wallWithHoles(D, []), wallMat); e.rotation.y = Math.PI / 2; e.position.set(W, 0, D); room.add(e); walls.e = e;
    /* skirting */
    for (const [x, z, l, ry] of [[W / 2, .006, W, 0], [W / 2, D - .006, W, 0], [W - .006, D / 2, D, Math.PI / 2]]) { const b = mesh(new THREE.BoxGeometry(l, .08, .012), trim, false); b.position.set(x, .04, z); b.rotation.y = ry; room.add(b); }
    /* door swing arc drawn on the floor */
    const arc = new THREE.Mesh(new THREE.RingGeometry(DOOR.w - .01, DOOR.w, 48, 1, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a4c25, transparent: true, opacity: .5, side: THREE.DoubleSide }));
    arc.rotation.x = Math.PI / 2; arc.position.set(0, .004, DOOR.z0); room.add(arc); walls.arc = arc;
    outside.position.set(W / 2, 4, D + 14); garden.position.set(W / 2, 0, D);
    furniture.forEach((f) => room.add(f.obj));
    placeAll(); camHome(true);
  }

  /* ---------- furniture state ---------- */
  const furniture = [];
  let sel = null;
  function make(it) {
    const obj = B[it.k](); obj.userData.item = it;
    obj.traverse((o) => { if (o.isMesh) o.userData.root = obj; });
    const f = { it, obj }; furniture.push(f); room.add(obj); return f;
  }
  S.items.filter((i) => K[i.k]).forEach(make);
  const dims = (it) => { const k = K[it.k], q = ((it.r % 180) + 180) % 180 === 90; return q ? [k.d, k.w] : [k.w, k.d]; };
  const box = (it) => { const [w, d] = dims(it); return [it.x - w / 2, it.z - d / 2, it.x + w / 2, it.z + d / 2]; };
  function placeAll() { furniture.forEach(({ it, obj }) => { obj.position.set(it.x, 0, it.z); obj.rotation.y = -it.r * Math.PI / 180; }); check(); }
  const ov = (a, b, m = 0) => a[0] < b[2] - m && a[2] > b[0] + m && a[1] < b[3] - m && a[3] > b[1] + m;

  /* the checks a designer makes */
  const tint = new Map();
  function check() {
    const bad = new Set(); let tight = 0, overlaps = 0;
    const solid = furniture.filter((f) => !K[f.it.k].soft);
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      const a = box(solid[i].it), b = box(solid[j].it);
      if (ov(a, b, .005)) { /* chairs tuck under tables */
        const pair = [solid[i].it.k, solid[j].it.k].sort().join(); if (pair !== 'chair,dining' && pair !== 'chair,desk') { bad.add(solid[i]); bad.add(solid[j]); overlaps++; } }
      else if (ov(a, b, -WALK) && !['chair', 'plant', 'lamp'].includes(solid[i].it.k) && !['chair', 'plant', 'lamp'].includes(solid[j].it.k)) {
        /* a gap narrower than a walkway, but wider than "pushed together" (5 cm) */
        const gx = Math.max(b[0] - a[2], a[0] - b[2]), gz = Math.max(b[1] - a[3], a[1] - b[3]), gap = Math.max(gx, gz);
        if (gap > .05 && gap < WALK) tight++;
      }
    }
    const doorBox = [0, DOOR.z0, DOOR.w, DOOR.z0 + DOOR.w];
    let doorBlocked = false; for (const f of solid) { const b = box(f.it); if (ov(b, doorBox, .01)) { bad.add(f); doorBlocked = true; } }
    const out = solid.filter((f) => { const b = box(f.it); return b[0] < -.01 || b[1] < -.01 || b[2] > S.W + .01 || b[3] > S.D + .01; }); out.forEach((f) => bad.add(f));
    let area = 0; for (const f of solid) { const [w, d] = dims(f.it); area += w * d; }
    furniture.forEach((f) => {
      const on = bad.has(f), s = f === sel;
      f.obj.traverse((o) => { if (!o.isMesh || !o.material.emissive) return;
        if (!tint.has(o)) { tint.set(o, o.material); o.material = o.material.clone(); }
        o.material.emissive.setHex(on ? 0x9a1a10 : s ? 0x6a4a20 : 0x000000); o.material.emissiveIntensity = on ? .55 : s ? .35 : 0; });
    });
    stv.ov.textContent = overlaps + out.length ? String(overlaps + out.length) : 'none';
    stv.door.textContent = doorBlocked ? 'blocked' : 'clear';
    stv.walk.textContent = tight ? `${tight} narrow` : 'all ≥ 60 cm';
    stv.free.textContent = Math.round((1 - area / (S.W * S.D)) * 100) + '% free';
    walls.arc && (walls.arc.material.color.setHex(doorBlocked ? 0xd0302a : 0x9a4c25));
    ['ov', 'door', 'walk'].forEach((k) => (stv[k].style.color = (k === 'ov' && overlaps + out.length) || (k === 'door' && doorBlocked) || (k === 'walk' && tight) ? '#b2321f' : ''));
  }
  const save = () => { S.items = furniture.map((f) => f.it); st0.set(S); };

  /* ---------- light: the sun through the window, and the lamp at night ---------- */
  let hour = 15;
  function applyLight() {
    const day = clamp(Math.sin((hour - 6) / 12 * Math.PI), 0, 1), az = (hour - 12) / 6 * 1.1, elv = Math.max(.05, day * 1.05);
    const dir = new THREE.Vector3(-Math.sin(az) * Math.cos(elv), Math.sin(elv), Math.cos(az) * Math.cos(elv));
    sunL.position.set(S.W / 2, 0, S.D / 2).addScaledVector(dir, 16); sunL.target.position.set(S.W / 2, 0, S.D / 2);
    const warm = 1 - clamp(day * 1.6, 0, 1);
    sunL.color.setRGB(1, lerp(.95, .7, warm), lerp(.88, .48, warm)); sunL.intensity = 7 * clamp(day * 3, 0, 1);
    fill.intensity = .12 + .45 * day; scene.environmentIntensity = .12 + .5 * day;
    outside.material.color.setRGB(lerp(.04, .85, day), lerp(.05, .9, day), lerp(.12, .95, day));
    const night = 1 - clamp(day * 4, 0, 1);
    furniture.forEach((f) => { const L = f.obj.userData.light; if (L) L.intensity = 3.2 * night + .3; });
    shadeM.emissiveIntensity = .2 + night * 1.6; R.toneMappingExposure = lerp(1.25, .95, day);
  }

  /* ---------- camera: a dollhouse view, walls nearest the camera fade away ---------- */
  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * .47; orbit.minDistance = 1.5; orbit.maxDistance = 16;
  let view = '3d';
  function camHome(instant) {
    const c = new THREE.Vector3(S.W / 2, .6, S.D / 2);
    const p = view === 'plan' ? new THREE.Vector3(S.W / 2, Math.max(S.W, S.D) * (phone ? 2.1 : 1.45), S.D / 2 + .01) : new THREE.Vector3(S.W / 2 + S.W * (phone ? .5 : .75), phone ? 8.4 : 5.6, S.D / 2 + S.D * (phone ? 1.9 : 1.45));
    if (instant) { cam.position.copy(p); orbit.target.copy(c); return; }
    const p0 = cam.position.clone(), t0 = orbit.target.clone(); tween(1100, (k) => { cam.position.lerpVectors(p0, p, k); orbit.target.lerpVectors(t0, c, k); });
  }
  function cutaway() {
    const c = cam.position, W = S.W, D = S.D;
    const vis = { n: c.z > 0, s: c.z < D, w: c.x > 0, e: c.x < W };
    if (view === 'plan') { vis.n = vis.s = vis.w = vis.e = true; }
    walls.n.visible = vis.n; walls.s.visible = vis.s; walls.pane.visible = vis.s; walls.frames.visible = vis.s; walls.w.visible = vis.w; walls.door.visible = vis.w; walls.e.visible = vis.e;
    ceiling.visible = c.y < H;
  }

  /* ---------- picking and dragging ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  let drag = null;
  const toNdc = (e) => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); };
  canvas.addEventListener('pointerdown', (e) => {
    toNdc(e); const hits = ray.intersectObjects(furniture.map((f) => f.obj), true);
    const h0 = hits.find((h) => h.object.visible);
    if (h0) {
      const root = h0.object.userData.root; select(furniture.find((f) => f.obj === root));
      ray.ray.intersectPlane(plane, hit); drag = { id: e.pointerId, dx: sel.it.x - hit.x, dz: sel.it.z - hit.z, moved: false }; orbit.enabled = false; canvas.setPointerCapture(e.pointerId);
    } else select(null);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return; toNdc(e); if (!ray.ray.intersectPlane(plane, hit)) return;
    const [w, d] = dims(sel.it), snap = (v) => Math.round(v * 20) / 20;
    sel.it.x = clamp(snap(hit.x + drag.dx), w / 2, S.W - w / 2); sel.it.z = clamp(snap(hit.z + drag.dz), d / 2, S.D - d / 2); drag.moved = true; placeAll(); showSel();
  });
  const endDrag = (e) => { if (!drag || e.pointerId !== drag.id) return; if (drag.moved) save(); drag = null; orbit.enabled = true; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  function select(f) { sel = f || null; check(); showSel(); if (sel && phone) P.show(0); }

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 26 · Interior Design', title: 'A Room, True to Size', lede: 'Every piece is modelled at its real size. Drag furniture across the floor, turn it, and the planner checks collisions, the door swing and 60 cm walkways as you go.' });
  const sPiece = P.section('Furniture');
  const selBox = el('div', { class: 'c-n' }); sPiece.append(selBox);
  const [bRot, bDel] = buttons(sPiece, [['Turn 90°', () => { if (!sel) return; sel.it.r = (sel.it.r + 90) % 360; const [w, d] = dims(sel.it); sel.it.x = clamp(sel.it.x, w / 2, S.W - w / 2); sel.it.z = clamp(sel.it.z, d / 2, S.D - d / 2); placeAll(); save(); showSel(); }, true],
    ['Remove', () => { if (!sel) return; room.remove(sel.obj); furniture.splice(furniture.indexOf(sel), 1); sel = null; check(); save(); showSel(); }]]);
  function showSel() {
    bRot.disabled = bDel.disabled = !sel;
    if (!sel) { selBox.textContent = phone ? 'Tap a piece to select it, then drag it.' : 'Click a piece to select it, then drag it across the floor.'; return; }
    const k = K[sel.it.k]; selBox.innerHTML = `<b style="color:var(--ink)">${k.name}</b> · ${Math.round(k.w * 100)} × ${Math.round(k.d * 100)} cm · at ${sel.it.x.toFixed(2)} m, ${sel.it.z.toFixed(2)} m`;
  }
  chips(sPiece, 'Add a piece', Object.entries(K).map(([k, v]) => [k, v.name]), '-', (k) => {
    const [w, d] = [K[k].w, K[k].d]; let best = null;
    for (let z = d / 2; z <= S.D - d / 2 && !best; z += .1) for (let x = w / 2; x <= S.W - w / 2; x += .1) { const it = { k, x, z, r: 0 }; const b = box(it); if (!furniture.some((f) => !K[f.it.k].soft && ov(box(f.it), b)) && !ov(b, [0, DOOR.z0, DOOR.w, DOOR.z0 + DOOR.w])) { best = it; break; } }
    const f = make(best || { k, x: S.W / 2, z: S.D / 2, r: 0 }); placeAll(); select(f); save(); applyLight(); toast(ui, best ? `${K[k].name} added` : 'No free space: placed in the middle');
  }, 'grid');
  const sRoom = P.section('Room');
  range(sRoom, 'Width', { min: 3, max: 8, step: .1, value: S.W, fmt: (v) => v.toFixed(1) + ' m' }, (v) => { S.W = v; buildRoom(); save(); });
  range(sRoom, 'Depth', { min: 3, max: 7, step: .1, value: S.D, fmt: (v) => v.toFixed(1) + ' m' }, (v) => { S.D = v; buildRoom(); save(); });
  chips(sRoom, 'Floor', [['oak', 'Oak planks', '#b88a5c'], ['marble', 'Marble', '#e8e6e2'], ['terrazzo', 'Terrazzo', '#d9c9b6'], ['concrete', 'Polished concrete', '#9a9a98']], S.floor, (v) => { S.floor = v; buildRoom(); save(); });
  chips(sRoom, 'Walls', [['#ece6db', 'Linen', '#ece6db'], ['#c9d3c4', 'Sage', '#c9d3c4'], ['#d8b8a0', 'Clay', '#d8b8a0'], ['#3e4a5a', 'Ink blue', '#3e4a5a'], ['#f6f4f0', 'Gallery white', '#f6f4f0']], S.wall, (v) => { S.wall = v; wallMat.color.set(v); save(); });
  const sLight = P.section('Light');
  const hr = (v) => `${Math.floor(v)}:${String(Math.round(v % 1 * 60)).padStart(2, '0')}`;
  range(sLight, 'Time of day', { min: 5, max: 23, step: .05, value: hour, fmt: hr }, (v) => { hour = v; applyLight(); });
  note(sLight, 'The window faces south. Morning light comes in from the left, evening light from the right; after dark the floor lamp takes over.');
  const sCheck = P.section('Checks');
  const stv = P.stats(sCheck, [['ov', 'Collisions'], ['door', 'Door swing'], ['walk', 'Walkways'], ['free', 'Floor']]);
  note(sCheck, 'Red pieces collide, block the door or poke through a wall. Chairs may tuck under a table or desk. A walkway narrower than 60 cm between large pieces is counted as narrow.');
  buttons(sCheck, [['Save picture', () => { cutaway(); R.render(scene, cam); download('abidora-room.png', canvas.toDataURL('image/png')); }, true], ['Start over', () => { furniture.forEach((f) => room.remove(f.obj)); furniture.length = 0; Object.assign(S, JSON.parse(JSON.stringify(START))); S.items.forEach(make); wallMat.color.set(S.wall); buildRoom(); save(); toast(ui, 'Back to the first layout'); }]]);

  const fab = el('div', { class: 'fab' });
  const b3 = el('button', { 'aria-pressed': 'true', text: '3D view', onclick: () => { view = '3d'; b3.setAttribute('aria-pressed', 'true'); bp.setAttribute('aria-pressed', 'false'); camHome(); } });
  const bp = el('button', { 'aria-pressed': 'false', text: 'Floor plan', onclick: () => { view = 'plan'; bp.setAttribute('aria-pressed', 'true'); b3.setAttribute('aria-pressed', 'false'); camHome(); } });
  fab.append(b3, bp); ui.append(fab);
  ui.append(el('div', { class: 'hint', text: phone ? 'Tap a piece, then drag · two fingers to turn' : 'Click a piece and drag · drag empty space to turn' }));

  buildRoom(); showSel(); applyLight();
  /* opening shot */
  const pEnd = cam.position.clone(); cam.position.set(S.W / 2 + 7, 7, S.D / 2 + 9); tween(2600, (k) => cam.position.lerpVectors(new THREE.Vector3(S.W / 2 + 7, 7, S.D / 2 + 9), pEnd, k));
  loop(() => { orbit.update(); cutaway(); R.render(scene, cam); R.adapt(); });
}
