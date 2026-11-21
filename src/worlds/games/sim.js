/* World 16 · Simulation: Demolition Lab.
   A real 3D rigid-body simulation (cannon-es: mass, friction, restitution, gravity, sleeping bodies).
   Challenge mode: knock every amber block off the plinth with a limited number of shots.
   Sandbox mode: build with wood, stone or glass, then use the cannon, a wrecking ball or a blast,
   on Earth, the Moon, Mars or Jupiter gravity, in slow motion if you like. The gravity presets carry over
   from the old 2D Physics Playground. */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { onKey, engaged, makeStage, card, hud, toast, best, sfx, run, topBar, el, TOUCH, clamp, lerp, damp, rng, noise2, canvasTex } from './gkit.js';

const GRAV = { earth: [9.81, 'Earth'], moon: [1.62, 'Moon'], mars: [3.71, 'Mars'], jupiter: [24.79, 'Jupiter'] };
const MATS = {
  wood: { density: 600, friction: .55, restitution: .15, name: 'Wood' },
  stone: { density: 2400, friction: .7, restitution: .05, name: 'Stone' },
  glass: { density: 2500, friction: .3, restitution: .3, name: 'Glass' },
  target: { density: 700, friction: .5, restitution: .1, name: 'Target' },
};
const PLINTH_R = 7, TOP = 1;

/* challenge structures: lists of [x, y, z, sx, sy, sz, material] in metres, y is the bottom of the block */
function L(n) {
  const b = [];
  const box = (x, y, z, sx, sy, sz, m = 'wood') => b.push([x, y, z, sx, sy, sz, m]);
  const ring = (rad, rows, h, m, tgtRow = -1) => { for (let r = 0; r < rows; r++) { const k = Math.max(6, Math.round(rad * 2.4)); for (let i = 0; i < k; i++) { const a = (i + (r % 2) * .5) / k * Math.PI * 2; b.push([Math.cos(a) * rad, r * h, Math.sin(a) * rad, .9, h, .5, r === tgtRow ? 'target' : m, -a]); } } };
  switch (n) {
    case 0: for (let i = 0; i < 6; i++) box(0, i * .6, 0, 1, .6, 1, i > 3 ? 'target' : 'wood'); return { b, shots: 3, name: 'First tower' };
    case 1: for (let r = 0; r < 5; r++) for (let i = 0; i <= 4 - r; i++) box((i - (4 - r) / 2) * 1.05, r * .6, 0, 1, .6, 1, r >= 3 ? 'target' : 'wood'); return { b, shots: 3, name: 'Pyramid' };
    case 2: for (let r = 0; r < 6; r++) for (let i = 0; i < 6; i++) box((i - 2.5 + (r % 2) * .5) * 1.02, r * .5, 0, 1, .5, .6, r === 5 || (r === 4 && i % 2) ? 'target' : 'stone'); return { b, shots: 4, name: 'Stone wall' };
    case 3: for (let i = 0; i < 9; i++) for (const s of [-1, 1]) box(s * .7, i * .55, 0, .5, .55, 1.6, 'wood'), box(0, i * .55 + .275, 0, 1.9, .28, .5, i > 6 ? 'target' : 'wood'); return { b, shots: 3, name: 'Ladder' };
    case 4: for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 1.6 - .8; box(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6, .25, 1.6, .8, i > 10 ? 'target' : 'wood'); b[b.length - 1].push(-a); } return { b, shots: 1, name: 'Domino arc' };
    case 5: for (let r = 0; r < 12; r++) for (let i = 0; i < 3; i++) { const rot = r % 2; box(rot ? (i - 1) * .52 : 0, r * .3, rot ? 0 : (i - 1) * .52, rot ? .5 : 1.56, .3, rot ? 1.56 : .5, r > 9 ? 'target' : 'wood'); } return { b, shots: 2, name: 'Stacking blocks' };
    case 6: ring(2.4, 6, .55, 'stone', 5); box(0, 3.3, 0, 3.6, .3, 3.6, 'glass'); box(0, 3.6, 0, .8, .8, .8, 'target'); return { b, shots: 4, name: 'Castle keep' };
    default: for (const [x, z] of [[-3, -2], [3, -2], [0, 2.5]]) for (let i = 0; i < 7; i++) box(x, i * .7, z, .9, .7, .9, i > 4 ? 'target' : i % 2 ? 'glass' : 'stone'); return { b, shots: 4, name: 'Three towers' };
  }
}
const LEVELS = 8;

function woodTex() {
  const r = rng(5), n = noise2(9);
  const t = canvasTex(256, 256, (g, w, h) => { const im = g.createImageData(w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = Math.sin((x + n.fbm(x / 60, y / 12, 4) * 40) * .22) * .5 + .5, i = (y * w + x) * 4, s = r() * 12; d[i] = 170 + v * 40 + s; d[i + 1] = 120 + v * 30 + s; d[i + 2] = 72 + v * 20; d[i + 3] = 255; } g.putImageData(im, 0, 0); });
  return t;
}
function stoneTex() {
  const r = rng(6), n = noise2(12);
  return canvasTex(256, 256, (g, w, h) => { const im = g.createImageData(w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = n.fbm(x / 30, y / 30, 5) * .5 + .5, i = (y * w + x) * 4, s = r() * 22; d[i] = 130 + v * 60 + s; d[i + 1] = 126 + v * 56 + s; d[i + 2] = 118 + v * 50 + s; d[i + 3] = 255; } g.putImageData(im, 0, 0); });
}
function floorTex() {
  const t = canvasTex(1024, 1024, (g, w, h) => { const n = noise2(2), r = rng(1); const im = g.createImageData(w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = n.fbm(x / 140, y / 140, 5) * .5 + .5, i = (y * w + x) * 4, s = r() * 10; const c = 92 + v * 34 + s; d[i] = c; d[i + 1] = c * .98; d[i + 2] = c * .94; d[i + 3] = 255; } g.putImageData(im, 0, 0);
    g.strokeStyle = 'rgba(30,30,30,.35)'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); } });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); return t;
}

export async function start(canvas, ui) {
  const S = makeStage(canvas, { exposure: 1.05, fov: 45, bloom: { strength: .35, radius: .5, threshold: 1.4 } });
  const { scene, camera } = S;
  scene.background = new THREE.Color(0xc9c6c0); scene.fog = new THREE.Fog(0xc9c6c0, 60, 140);
  /* hangar light: big soft window panels in a generated environment */
  { const pm = new THREE.PMREMGenerator(S.renderer), es = new THREE.Scene(); es.background = new THREE.Color(0x8d8a85);
    const add = (c, i, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    add(0xffffff, 3, 0, 12, 0, 16, 16); add(0xfff1dc, 2.2, 14, 5, 4, 6, 10); add(0xdde8ff, 1.6, -14, 5, -4, 6, 10); add(0x6d6a65, 1, 0, -8, 0, 30, 30);
    scene.environment = pm.fromScene(es, .03).texture; scene.environmentIntensity = .8; }
  const sun = new THREE.DirectionalLight(0xfff3e4, 2.6); sun.position.set(12, 22, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -14; sc.right = sc.top = 14; sc.near = 5; sc.far = 60; sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun, new THREE.HemisphereLight(0xffffff, 0x7a746c, .45));
  /* floor, plinth with a brass edge, a back wall with a glowing slit */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), new THREE.MeshStandardMaterial({ map: floorTex(), roughness: .82 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const plM = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1d, roughness: .3, metalness: .2, clearcoat: 1, clearcoatRoughness: .1 });
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(PLINTH_R, PLINTH_R + .25, TOP, 96), plM); plinth.position.y = TOP / 2; plinth.receiveShadow = plinth.castShadow = true; scene.add(plinth);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(PLINTH_R, .045, 10, 160), new THREE.MeshStandardMaterial({ color: 0xc8a165, metalness: 1, roughness: .25 })); edge.rotation.x = Math.PI / 2; edge.position.y = TOP; scene.add(edge);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(80, 26, 1), new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: .9 })); wall.position.set(0, 13, -34); wall.receiveShadow = true; scene.add(wall);
  const slit = new THREE.Mesh(new THREE.PlaneGeometry(60, .5), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1dc).multiplyScalar(3) })); slit.position.set(0, 9, -33.4); scene.add(slit);
  const tag = canvasTex(1024, 128, (g, w, h) => { g.fillStyle = '#2a2826'; g.font = '400 84px Instrument Serif, serif'; g.textAlign = 'center'; g.fillText('Abidora Demolition Lab', w / 2, 92); });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshBasicMaterial({ map: tag, transparent: true })); sign.position.set(0, 13.4, -33.4); scene.add(sign);

  /* physics world */
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true;
  world.solver.iterations = 14; world.defaultContactMaterial.friction = .5; world.defaultContactMaterial.restitution = .1;
  const ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
  const plBody = new CANNON.Body({ mass: 0, shape: new CANNON.Cylinder(PLINTH_R, PLINTH_R + .25, TOP, 32) }); plBody.position.set(0, TOP / 2, 0); world.addBody(plBody);
  const pmat = Object.fromEntries(Object.entries(MATS).map(([k, m]) => [k, new CANNON.Material(k)]));
  for (const a of Object.keys(MATS)) for (const b of Object.keys(MATS)) world.addContactMaterial(new CANNON.ContactMaterial(pmat[a], pmat[b], { friction: Math.sqrt(MATS[a].friction * MATS[b].friction), restitution: Math.max(MATS[a].restitution, MATS[b].restitution) }));

  /* render materials */
  const RM = {
    wood: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: .7 }),
    stone: new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: .9 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xcfe8f0, roughness: .04, metalness: 0, transmission: TOUCH ? 0 : .85, transparent: TOUCH, opacity: TOUCH ? .45 : 1, thickness: .6, ior: 1.5, clearcoat: 1 }),
    target: new THREE.MeshPhysicalMaterial({ color: 0xe8a33c, roughness: .25, metalness: .1, clearcoat: 1, clearcoatRoughness: .05, emissive: 0x6b3a00, emissiveIntensity: .25 }),
  };
  const ballM = new THREE.MeshStandardMaterial({ color: 0x232428, metalness: .85, roughness: .25 });
  const geoCache = new Map();
  const geoFor = (sx, sy, sz) => { const k = [sx, sy, sz].join(); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(sx, sy, sz) * .06)); return geoCache.get(k); };
  let items = [];
  const addBlock = (x, y, z, sx, sy, sz, m, yaw = 0) => {
    const body = new CANNON.Body({ mass: MATS[m].density * sx * sy * sz, material: pmat[m], shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)) });
    body.position.set(x, y + sy / 2 + TOP, z); body.quaternion.setFromEuler(0, yaw, 0); body.sleepSpeedLimit = .15; body.sleepTimeLimit = .6; body.linearDamping = .02; body.angularDamping = .04;
    world.addBody(body); body.sleep();
    const mesh = new THREE.Mesh(geoFor(sx, sy, sz), RM[m]); mesh.castShadow = mesh.receiveShadow = true; scene.add(mesh);
    const it = { body, mesh, m, target: m === 'target', down: false }; items.push(it);
    body.addEventListener('collide', (e) => { const v = Math.abs(e.contact.getImpactVelocityAlongNormal()); if (v > 2.2 && Math.random() < .5) { if (m === 'glass') sfx.blip(2200 + Math.random() * 800, .12, 'triangle', clamp(v / 40, .02, .12)); else sfx.noise(.08, clamp(v / 60, .02, .15), m === 'stone' ? 500 : 900); } });
    return it;
  };
  const addBall = (pos, vel, r = .45) => {
    const body = new CANNON.Body({ mass: 7800 * 4 / 3 * Math.PI * r ** 3 * .25, shape: new CANNON.Sphere(r), material: pmat.stone }); body.position.copy(pos); body.velocity.copy(vel); body.linearDamping = .01; world.addBody(body);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 24), ballM); mesh.castShadow = true; scene.add(mesh);
    const it = { body, mesh, m: 'ball', ball: true, age: 0 }; items.push(it); return it;
  };
  const clearAll = () => { items.forEach((i) => { world.removeBody(i.body); scene.remove(i.mesh); }); items = []; if (wreck) { world.removeConstraint(wreck.c); world.removeBody(wreck.anchor); scene.remove(wreck.rope); wreck = null; } };

  /* wrecking ball on a rope from a crane point */
  let wreck = null;
  const makeWreck = () => {
    const anchor = new CANNON.Body({ mass: 0 }); anchor.position.set(0, 14, 0); world.addBody(anchor);
    const it = addBall(new CANNON.Vec3(-9, 8, 0), new CANNON.Vec3(0, 0, 0), 1.1); it.body.mass = 4000; it.body.updateMassProperties(); it.wreck = true;
    const c = new CANNON.DistanceConstraint(anchor, it.body, Math.hypot(9, 6)); world.addConstraint(c);
    const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x222222 })); scene.add(rope);
    wreck = { anchor, it, c, rope };
  };

  /* --- UI --- */
  const css = el('style', '', `
  .sm-top{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 62px);display:flex;gap:8px}
  .sm-top span{padding:8px 12px;border-radius:999px;background:rgba(14,14,16,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12)}.sm-top b{color:#e8b46a;margin-left:6px}
  .sm-bar{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 14px);z-index:20;display:flex;flex-direction:column;gap:8px;align-items:center;width:max-content;max-width:calc(100vw - 20px)}
  .sm-row{display:flex;gap:4px;padding:4px;border-radius:999px;background:rgba(14,14,16,.66);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.12);overflow-x:auto;max-width:100%;scrollbar-width:none}
  .sm-row::-webkit-scrollbar{display:none}
  .sm-row button{min-height:40px;padding:0 13px;border-radius:999px;border:0;background:transparent;color:#d8d1c5;font:500 10.5px 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;white-space:nowrap}
  .sm-row button[aria-pressed=true]{background:#ece6dc;color:#111}
  .sm-row i{width:1px;background:rgba(255,255,255,.15);margin:6px 2px}
  `); ui.append(css);
  let pause = () => {};
  topBar(ui, () => pause());
  const top = hud(ui, 'sm-top');
  const bar = el('div', 'sm-bar'); ui.append(bar);
  const row1 = el('div', 'sm-row'), row2 = el('div', 'sm-row'); bar.append(row1, row2);
  const seg = (row, opts, val, on) => { const bs = opts.map(([v, t]) => { const b = el('button', '', t); b.type = 'button'; b.dataset.v = v; b.setAttribute('aria-pressed', String(v === val)); b.onclick = () => { bs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); on(v); }; row.append(b); return b; }); return bs; };
  const sep = (row) => row.append(el('i'));
  let tool = 'cannon', bmat = 'wood', mode = 'challenge', lvl = 0, shots = 0, slow = false, gkey = 'earth';
  const toolBs = seg(row1, [['cannon', 'Cannon'], ['blast', 'Blast'], ['wreck', 'Wrecking ball'], ['build', 'Build']], tool, (v) => { tool = v; if (v === 'wreck') swing(); if (v === 'build') matRow.forEach((b) => (b.hidden = false)); else matRow.forEach((b) => (b.hidden = true)); });
  sep(row1); const matRow = seg(row1, [['wood', 'Wood'], ['stone', 'Stone'], ['glass', 'Glass']], bmat, (v) => (bmat = v)); matRow.forEach((b) => (b.hidden = true));
  seg(row2, Object.entries(GRAV).map(([k, [, n]]) => [k, n]), gkey, (v) => { gkey = v; world.gravity.set(0, -GRAV[v][0], 0); items.forEach((i) => i.body.wakeUp()); toast(ui, `${GRAV[v][1]} gravity · ${GRAV[v][0]} m/s²`); });
  sep(row2);
  const slowB = el('button', '', 'Slow-mo'); slowB.type = 'button'; slowB.setAttribute('aria-pressed', 'false'); slowB.onclick = () => { slow = !slow; slowB.setAttribute('aria-pressed', String(slow)); }; row2.append(slowB);
  const resetB = el('button', '', 'Reset'); resetB.type = 'button'; resetB.onclick = () => load(); row2.append(resetB);
  const modeB = el('button', '', 'Menu'); modeB.type = 'button'; modeB.onclick = () => menu(); row2.append(modeB);

  /* --- load a level or the sandbox --- */
  let winT = 0, loseT = 0, done = false;
  const load = () => {
    clearAll(); done = false; winT = loseT = 0;
    if (mode === 'challenge') { const lv = L(lvl); shots = lv.shots; lv.b.forEach((a) => addBlock(...a)); toolBs.forEach((b) => (b.hidden = b.dataset.v === 'build')); if (tool === 'build') toolBs[0].click(); }
    else { shots = Infinity; for (let i = 0; i < 5; i++) addBlock(-2, i * .6, 0, 1, .6, 1, 'wood'); for (let i = 0; i < 4; i++) addBlock(2, i * .8, 0, .8, .8, .8, i % 2 ? 'glass' : 'stone'); toolBs.forEach((b) => (b.hidden = false)); }
    if (tool === 'wreck') swing();
  };
  const swing = () => {
    if (wreck) { world.removeConstraint(wreck.c); world.removeBody(wreck.anchor); scene.remove(wreck.rope); world.removeBody(wreck.it.body); scene.remove(wreck.it.mesh); items = items.filter((i) => i !== wreck.it); wreck = null; }
  };
  const menu = async () => {
    const prog = best.get('sim') ?? { at: 0 };
    const p = card(ui, { kicker: 'World 16 · Simulation', title: 'Demolition Lab', side: true,
      body: `<p>A real 3D physics simulation: every block has mass, friction and bounce; wood, stone and glass behave differently, and gravity can be switched to the Moon, Mars or Jupiter.</p>
      <p>Challenge: clear every amber block off the plinth with the shots you have.</p><p>Sandbox: build anything and knock it down.</p>
      <div class="pz-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px">${Array.from({ length: LEVELS }, (_, i) => `<button type="button" class="gk-cbtn" data-l="${i}" ${i > prog.at ? 'disabled style="opacity:.3"' : ''} style="min-height:44px;padding:0">${i + 1}</button>`).join('')}</div>
      <p class="mono" style="font-size:11px;color:#9a9387;margin-top:12px">${TOUCH ? 'TAP TO FIRE · DRAG TO ORBIT · PINCH TO ZOOM' : 'CLICK TO FIRE · DRAG TO ORBIT · WHEEL TO ZOOM'}</p>`, buttons: [`Challenge ${Math.min(prog.at, LEVELS - 1) + 1}`, 'Sandbox'] });
    let picked = null;
    ui.querySelectorAll('.gk-card [data-l]').forEach((b) => (b.onclick = () => { picked = +b.dataset.l; ui.querySelector('.gk-card .gk-cbtn.pri').click(); }));
    const c = await p;
    mode = c === 1 ? 'sandbox' : 'challenge'; lvl = picked ?? Math.min(prog.at, LEVELS - 1); load();
    toast(ui, mode === 'sandbox' ? 'Sandbox' : `Level ${lvl + 1} · ${L(lvl).name}`, 2000);
  };
  pause = menu;

  /* --- camera orbit + taps --- */
  let yaw = .5, pitch = .4, dist = 20, ty = .5, tp = .4, td = 20;
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), pts = new Map(); let down = null, pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) down = { x: e.clientX, y: e.clientY, moved: 0 }; else { down = null; const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  canvas.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) { pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) td = clamp(td * pinch / d, 10, 46); pinch = d; return; }
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (down) { down.moved += Math.abs(dx) + Math.abs(dy); if (down.moved > 9) { ty -= dx * .006; tp = clamp(tp + dy * .004, .08, 1.25); } }
  });
  const up = (e) => { if (down && down.moved <= 9 && pts.size === 1) act(e); pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; if (!pts.size) down = null; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', (e) => { pts.delete(e.pointerId); down = null; });
  canvas.addEventListener('wheel', (e) => { if (!engaged()) return; e.preventDefault(); td = clamp(td * (1 + e.deltaY * .001), 10, 46); }, { passive: false });
  const meshes = () => items.filter((i) => !i.ball).map((i) => i.mesh).concat([plinth, floor]);
  const act = (e) => {
    if (done) return;
    const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(meshes(), false)[0];
    if (tool === 'build') {
      if (!hit) return; const p = hit.point.clone().add(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).multiplyScalar(.4));
      if (Math.hypot(p.x, p.z) > PLINTH_R - .5) { toast(ui, 'Build on the plinth'); return; }
      const s = bmat === 'stone' ? [.8, .8, .8] : bmat === 'glass' ? [1.2, .5, .6] : [1.4, .4, .5];
      addBlock(p.x, Math.max(p.y, TOP) - TOP, p.z, ...s, bmat, Math.round(yaw / (Math.PI / 4)) * Math.PI / 4).body.wakeUp(); sfx.blip(300, .08, 'triangle', .15); return;
    }
    if (shots <= 0) { toast(ui, 'No shots left'); return; }
    if (tool === 'cannon') {
      const from = camera.position.clone().add(ray.ray.direction.clone().multiplyScalar(2)); from.y = Math.max(from.y, 1.5);
      const target = hit ? hit.point : ray.ray.at(30, new THREE.Vector3());
      /* aim with a little lob so gravity is visible */
      const dir = target.clone().sub(from), dist2 = dir.length(), v = 26, tt = dist2 / v, g = GRAV[gkey][0];
      const vel = dir.multiplyScalar(1 / tt); vel.y += .5 * g * tt;
      addBall(new CANNON.Vec3(from.x, from.y, from.z), new CANNON.Vec3(vel.x, vel.y, vel.z)); sfx.noise(.4, .35, 300); sfx.blip(90, .3, 'sine', .3, .5);
    } else if (tool === 'blast') {
      if (!hit) return; const c = hit.point; blastFx(c);
      for (const it of items) { const p = it.body.position, d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z); if (d < 5) { const k = (1 - d / 5) * 2600 * Math.cbrt(it.body.mass / 400); const dir = new CANNON.Vec3(p.x - c.x, p.y - c.y + .5, p.z - c.z); dir.normalize(); it.body.wakeUp(); it.body.applyImpulse(dir.scale(k), new CANNON.Vec3(p.x + (Math.random() - .5) * .2, p.y, p.z)); } }
      sfx.noise(.9, .5, 420);
    } else if (tool === 'wreck') {
      if (!wreck) makeWreck(); const b = wreck.it.body; const ang = Math.atan2(camera.position.z, camera.position.x);
      b.position.set(Math.cos(ang) * 9.5, 8.5, Math.sin(ang) * 9.5); b.velocity.set(0, 0, 0); b.angularVelocity.set(0, 0, 0); b.wakeUp(); sfx.blip(140, .5, 'sine', .2, .6);
    }
    if (mode === 'challenge') shots--;
  };
  /* blast flash: an expanding glowing shell + light */
  const fx = []; const fxM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb35c).multiplyScalar(3), transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false });
  const bl = new THREE.PointLight(0xffa860, 0, 30, 1.5); scene.add(bl);
  const blastFx = (c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), fxM.clone()); m.position.copy(c); scene.add(m); fx.push({ m, t: 0 }); bl.position.copy(c); bl.intensity = 400; };

  /* --- loop --- */
  const fixed = 1 / 60;
  run((dt) => {
    S.watch(dt);
    const sdt = dt * (slow ? .25 : 1);
    world.step(fixed, sdt, 4);
    for (const it of items) {
      it.mesh.position.copy(it.body.position); it.mesh.quaternion.copy(it.body.quaternion);
      if (it.ball && !it.wreck) { it.age += dt; if (it.age > 12 || it.body.position.y < -5) { it.gone = true; } }
      if (it.target) it.down = it.body.position.y < TOP - .05 || Math.hypot(it.body.position.x, it.body.position.z) > PLINTH_R + .2;
    }
    items = items.filter((it) => { if (it.gone) { world.removeBody(it.body); scene.remove(it.mesh); return false; } return true; });
    if (wreck) { const a = wreck.anchor.position, b = wreck.it.body.position; wreck.rope.geometry.setFromPoints([new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z)]); }
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; f.m.scale.setScalar(.5 + f.t * 14); f.m.material.opacity = Math.max(0, .8 - f.t * 2.2); if (f.t > .4) { scene.remove(f.m); fx.splice(i, 1); } }
    bl.intensity *= Math.exp(-dt * 9);
    /* camera */
    yaw = damp(yaw, ty, 8, dt); pitch = damp(pitch, tp, 8, dt); dist = damp(dist, td, 8, dt);
    const asp = S.w / S.h, d = dist * (asp < 1 ? 1.55 / Math.max(asp, .45) * .62 : 1);
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d + 1, Math.cos(yaw) * Math.cos(pitch) * d); camera.lookAt(0, 2.4, 0);
    /* rules */
    if (mode === 'challenge' && !done) {
      const tg = items.filter((i) => i.target), left = tg.filter((i) => !i.down).length;
      top.innerHTML = `<span>Level<b>${lvl + 1}</b></span><span>Shots<b>${shots}</b></span><span>Targets<b>${left}/${tg.length}</b></span><span>${GRAV[gkey][1]}</span>`;
      if (left === 0) { winT += dt; if (winT > 1) win(); } else winT = 0;
      if (shots <= 0 && left > 0) { const moving = items.some((i) => i.body.sleepState !== CANNON.Body.SLEEPING && i.body.velocity.length() > .2); loseT = moving ? 0 : loseT + dt; if (loseT > 2.5) lose(); }
    } else if (mode === 'sandbox') top.innerHTML = `<span>Sandbox</span><span>Blocks<b>${items.filter((i) => !i.ball).length}</b></span><span>${GRAV[gkey][1]} · ${GRAV[gkey][0]} m/s²</span>`;
    S.render();
  });
  const win = async () => {
    done = true; const prog = best.get('sim') ?? { at: 0 }; prog.at = Math.max(prog.at, Math.min(lvl + 1, LEVELS - 1)); best.set('sim', prog);
    sfx.blip(523, .4, 'sine', .25); setTimeout(() => sfx.blip(784, .6, 'sine', .25), 140);
    const c = await card(ui, { kicker: `Level ${lvl + 1} cleared`, title: L(lvl).name, body: `<div class="gk-stats"><div><small>Shots left</small><b>${shots}</b></div><div><small>Gravity</small><b>${GRAV[gkey][1]}</b></div><div><small>Level</small><b>${lvl + 1}/${LEVELS}</b></div></div>`, buttons: lvl < LEVELS - 1 ? ['Next level', 'Replay'] : ['Sandbox', 'Replay'] });
    if (c === 0) { if (lvl < LEVELS - 1) lvl++; else mode = 'sandbox'; } load();
  };
  const lose = async () => {
    done = true; const c = await card(ui, { kicker: `Level ${lvl + 1}`, title: 'Still standing', body: '<p>Out of shots. Try hitting lower down, use a blast between blocks, or switch to Jupiter gravity to make things topple harder.</p>', buttons: ['Try again', 'Menu'] });
    if (c === 0) load(); else menu();
  };
  load(); menu();
}
