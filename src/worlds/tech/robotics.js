/* World 10 · Robotics: The Robot Cell.
   An industrial six-axis arm in a factory cell. Tap a crate and the arm plans a straight-line move, picks it up and
   waits for you to tap where it should go: the table, the conveyor, or on top of another crate. Every pose is found by
   inverse kinematics each frame, with joint speed limits. Teach it a program, or let it sort the crates on its own.
   The line-following robot of the earlier world drives on the floor beside it with the same PID controller. */
import * as THREE from 'three';
import { boot, studioEnv, sheet, linkView, h, css, range, btn, row, seg, stats, hud, store, cnv, tex, grainNormal, hash, TAU, clamp, lerp, isPhone, calm } from './tk.js';

/* ---------- arm kinematics (metres, radians) ---------- */
export const H0 = 1.05, L1 = .92, L2 = .82, L3 = .44;          // shoulder height, upper arm, forearm, wrist to fingertips
/** tool pointing straight down at (x, y, z): yaw, shoulder, elbow, wrist; reachable says whether the point was in range */
export function ik(x, y, z) {
  const yaw = Math.atan2(x, z), r = Math.hypot(x, z), wy = y + L3 - H0;
  let d = Math.hypot(r, wy); const reach = L1 + L2 - 1e-4, inner = Math.abs(L1 - L2) + .05;
  const reachable = d <= reach && d >= inner; const dd = clamp(d, inner, reach);
  const k = dd / (d || 1), rr = r * k, yy = wy * k;
  const c2 = clamp((dd * dd - L1 * L1 - L2 * L2) / (2 * L1 * L2), -1, 1), a2 = -Math.acos(c2);           // elbow up
  const a1 = Math.atan2(yy, rr) - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
  const a3 = -Math.PI / 2 - a1 - a2;
  return { yaw, a1, a2, a3, reachable };
}
export function fk(j) {
  const ex = L1 * Math.cos(j.a1), ey = L1 * Math.sin(j.a1), wx = ex + L2 * Math.cos(j.a1 + j.a2), wy = ey + L2 * Math.sin(j.a1 + j.a2);
  const tx = wx + L3 * Math.cos(j.a1 + j.a2 + j.a3), ty = wy + L3 * Math.sin(j.a1 + j.a2 + j.a3);
  return new THREE.Vector3(Math.sin(j.yaw) * tx, H0 + ty, Math.cos(j.yaw) * tx);
}

/* ---------- line follower (from world 056) ---------- */
export const TRACKS = {
  oval: Array.from({ length: 64 }, (_, i) => { const a = i / 64 * TAU; return [1 + .72 * Math.cos(a), .65 + .42 * Math.sin(a)]; }),
  eight: Array.from({ length: 96 }, (_, i) => { const a = i / 96 * TAU; return [1 + .78 * Math.sin(a), .65 + .4 * Math.sin(a) * Math.cos(a) * 2]; }),
  wave: (() => { const out = [], cy = .71, r = .31; for (let i = 0; i <= 40; i++) out.push([.35 + 1.3 * i / 40, cy - r + .07 * Math.sin(i / 40 * Math.PI * 4)]); for (let i = 1; i < 16; i++) { const a = -Math.PI / 2 + i / 16 * Math.PI; out.push([1.65 + r * Math.cos(a), cy + r * Math.sin(a)]); } for (let i = 40; i >= 0; i--) out.push([.35 + 1.3 * i / 40, cy + r - .05 * Math.sin(i / 40 * Math.PI * 3)]); for (let i = 1; i < 16; i++) { const a = Math.PI / 2 + i / 16 * Math.PI; out.push([.35 + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; })(),
};
const LINE_W = .028, SENS = [-2, -1, 0, 1, 2], SPACING = .013, AHEAD = .07, BASE = .12, CTRL_DT = .02, MOTOR_TAU = .1;
function nearest(track, x, y) {
  let best = Infinity;
  for (let i = 0; i < track.length; i++) {
    const [ax, ay] = track[i], [bx, by] = track[(i + 1) % track.length], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const tt = l2 ? clamp(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1) : 0, d = Math.hypot(ax + dx * tt - x, ay + dy * tt - y); if (d < best) best = d;
  }
  return best;
}
const darkness = (track, x, y) => clamp(1 - (nearest(track, x, y) - LINE_W / 2) / .006, 0, 1);
export class Bot {
  constructor(track) { const [a, b] = [track[0], track[1]]; this.x = a[0]; this.y = a[1]; this.th = Math.atan2(b[1] - a[1], b[0] - a[0]); this.i = 0; this.prevE = 0; this.lastE = 0; this.lost = 0; this.wl = 0; this.wr = 0; this.cl = 0; this.cr = 0; this.acc = 0; this.lastR = [0, 0, 0, 0, 0]; this.dist = 0; }
  sensors(track) { const c = Math.cos(this.th), s = Math.sin(this.th); return SENS.map((o) => darkness(track, this.x + c * AHEAD - s * o * SPACING, this.y + s * AHEAD + c * o * SPACING)); }
  step(track, dt, g) {
    this.acc += dt;
    if (this.acc >= CTRL_DT) {
      this.acc -= CTRL_DT; const r = this.sensors(track), sum = r.reduce((a, b) => a + b, 0); this.lastR = r; let e;
      if (sum > .05) { e = r.reduce((a, b, k) => a + b * SENS[k], 0) / sum / 2; this.lost = 0; } else { e = Math.sign(this.lastE || 1); this.lost += CTRL_DT; }
      this.i = clamp(this.i + e * CTRL_DT, -1, 1); const de = (e - this.prevE) / CTRL_DT; this.prevE = e; this.lastE = e;
      const turn = g.kp * e + g.ki * this.i + g.kd * de;
      this.cl = clamp(g.v * (1 + turn), -g.v, g.v * 2); this.cr = clamp(g.v * (1 - turn), -g.v, g.v * 2);
    }
    const k = 1 - Math.exp(-dt / MOTOR_TAU); this.wl += (this.cl - this.wl) * k; this.wr += (this.cr - this.wr) * k;
    const w = (this.wl - this.wr) / BASE, v = (this.wl + this.wr) / 2;
    this.th += w * dt; this.x += Math.cos(this.th) * v * dt; this.y += Math.sin(this.th) * v * dt; this.dist += Math.abs(v) * dt;
    return this.lastE;
  }
}

/* ---------- textures ---------- */
function concrete() {
  const S = 1024, [c, g] = cnv(S); g.fillStyle = '#6d6c69'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const x = Math.random() * S, y = Math.random() * S, r = Math.random() * 3 + .5, v = 90 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v - 4},${Math.random() * .35})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  for (let i = 0; i < 70; i++) { const x = Math.random() * S, y = Math.random() * S, r = 40 + Math.random() * 160, gr = g.createRadialGradient(x, y, 0, x, y, r); const d = Math.random() < .5; gr.addColorStop(0, d ? 'rgba(40,38,36,.16)' : 'rgba(150,148,142,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  g.strokeStyle = 'rgba(30,30,30,.55)'; g.lineWidth = 3; g.strokeRect(0, 0, S, S);               // saw-cut joints between slabs
  return tex(c, true, 6);
}
function hazard() { const [c, g] = cnv(256, 32); g.fillStyle = '#111'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#e8b832'; for (let x = -32; x < 256; x += 32) { g.beginPath(); g.moveTo(x, 32); g.lineTo(x + 16, 32); g.lineTo(x + 48, 0); g.lineTo(x + 32, 0); g.fill(); } const t = tex(c); t.wrapS = THREE.RepeatWrapping; return t; }
function belt() { const [c, g] = cnv(64, 256); g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#26282b'; for (let y = 0; y < 256; y += 16) g.fillRect(0, y, 64, 3); const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }
function crateTex(color, n) {
  const [c, g] = cnv(256); g.fillStyle = color; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 10; g.strokeRect(5, 5, 246, 246);
  g.fillStyle = 'rgba(15,15,15,.85)'; g.font = "600 46px 'JetBrains Mono', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 128, 132);
  return tex(c);
}

export async function start(canvas, ui) {
  css('r-css', `.r-wp{display:flex;flex-direction:column;gap:4px;margin:8px 0;max-height:160px;overflow:auto}
  .r-wp div{display:flex;justify-content:space-between;font:400 12px 'JetBrains Mono',monospace;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.05)}
  .r-wp div.on{background:rgba(232,176,74,.22)}
  .r-plot{width:100%;height:90px;border-radius:12px;background:rgba(0,0,0,.35);display:block;margin:8px 0}`);
  const k = boot(canvas, { fov: 36, bloom: [.3, .4, .97], exposure: 1.05, bg: 0x0d0e10, fog: new THREE.Fog(0x0d0e10, 9, 26) });
  const { scene, camera, controls, renderer } = k;
  const env = studioEnv(renderer, { bg: 0x101114, warm: 0xffe4c4, cool: 0xd4e2ff, strength: .9 });
  scene.environment = env; scene.environmentIntensity = .75;
  camera.position.set(3.4, 2.6, 4.4); controls.target.set(0, 1, .4); controls.maxPolarAngle = Math.PI * .49; controls.minDistance = 1.4; controls.maxDistance = 12;

  /* ---------- hall ---------- */
  scene.add(new THREE.HemisphereLight(0xcfd8ff, 0x2a2622, .5));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.4); sun.position.set(3, 7, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -4, right: 6, top: 4, bottom: -4, near: 1, far: 20 }); sun.shadow.bias = -.0003; sun.shadow.normalBias = .02; scene.add(sun);
  const fill = new THREE.SpotLight(0x9fc0ff, 25, 14, .7, .8, 1.5); fill.position.set(-4, 4, -2); fill.target.position.set(0, .8, .5); scene.add(fill, fill.target);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: concrete(), roughness: .82, metalness: 0, normalMap: grainNormal(512, .35), normalScale: new THREE.Vector2(.6, .6), envMap: env, envMapIntensity: .25 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  /* safety lines round the cell */
  const hz = hazard();
  const line = (x, z, len, rot) => { const t = hz.clone(); t.needsUpdate = true; t.repeat.set(len * 4, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(len, .1), new THREE.MeshStandardMaterial({ map: t, roughness: .7 })); m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, .002, z); m.receiveShadow = true; scene.add(m); };
  line(0, -2.2, 5.6, 0); line(0, 2.4, 5.6, 0); line(-2.8, .1, 4.6, Math.PI / 2); line(2.8, .1, 4.6, Math.PI / 2);
  /* overhead light bars */
  const barM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff4e6).multiplyScalar(3) });
  for (let i = -1; i <= 1; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(3.4, .04, .12), barM); b.position.set(i * 2.2, 5.2, .2); scene.add(b); }
  /* back wall with ribbed panels */
  const wallM = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: .6, metalness: .5 });
  for (let i = -12; i <= 12; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.9, 6, .08), wallM); p.position.set(i * .95, 3, -6); scene.add(p); }

  /* ---------- materials ---------- */
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xe8a23a, roughness: .32, metalness: .05, clearcoat: 1, clearcoatRoughness: .08, envMap: env, envMapIntensity: .9 });
  const dark = new THREE.MeshPhysicalMaterial({ color: 0x1c1d20, roughness: .45, metalness: .6, envMap: env, envMapIntensity: .7 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xbfc3c9, roughness: .3, metalness: 1, normalMap: grainNormal(512, .06, .4), envMap: env, envMapIntensity: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: .8 });
  const M = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = o.receiveShadow = true; return o; };
  const cyl = (r, hh, seg = 48) => new THREE.CylinderGeometry(r, r, hh, seg);
  const zAxis = (g) => { g.rotateX(Math.PI / 2); return g; };
  const xAxis = (g) => { g.rotateZ(Math.PI / 2); return g; };

  /* ---------- the arm ---------- */
  const arm = new THREE.Group(); scene.add(arm);
  const foot = M(cyl(.36, .12), dark); foot.position.y = .06; arm.add(foot);
  const ped = M(cyl(.3, .28), paint); ped.position.y = .26; arm.add(ped);
  const turret = new THREE.Group(); turret.position.y = .4; arm.add(turret);
  const drum = M(cyl(.33, .2, 64), paint); drum.position.y = .1; turret.add(drum);
  const yoke = M(new THREE.BoxGeometry(.5, .5, .42), paint); yoke.position.set(0, .45, -.05); turret.add(yoke);
  const motorS = M(xAxis(cyl(.18, .2, 40)), dark); motorS.position.set(-.33, H0 - .4, 0); turret.add(motorS);
  const shoulder = new THREE.Group(); shoulder.position.y = H0 - .4; turret.add(shoulder);
  shoulder.add(M(xAxis(cyl(.22, .46, 48)), paint));
  /* upper arm: a tapered box along +z */
  const upG = new THREE.BoxGeometry(.24, .3, L1 + .1); upG.translate(0, 0, L1 / 2);
  const up = M(upG, paint); shoulder.add(up);
  const elbow = new THREE.Group(); elbow.position.z = L1; shoulder.add(elbow);
  elbow.add(M(xAxis(cyl(.17, .36, 40)), dark));
  const counter = M(new THREE.BoxGeometry(.2, .2, .3), dark); counter.position.z = -.22; elbow.add(counter);
  const foG = new THREE.CylinderGeometry(.09, .12, L2, 32); foG.rotateX(Math.PI / 2); foG.translate(0, 0, L2 / 2);
  elbow.add(M(foG, paint));
  const wrist = new THREE.Group(); wrist.position.z = L2; elbow.add(wrist);
  wrist.add(M(xAxis(cyl(.1, .22, 32)), dark));
  const roll = new THREE.Group(); wrist.add(roll);
  const flange = M(zAxis(cyl(.07, .1, 32)), steel); flange.position.z = .1; roll.add(flange);
  const gbody = M(new THREE.BoxGeometry(.2, .08, .08), dark); gbody.position.z = .19; roll.add(gbody);
  const fingers = [-1, 1].map((s) => { const f = M(new THREE.BoxGeometry(.025, .06, .22), steel); f.position.set(s * .07, 0, .33); roll.add(f); return f; });
  /* a cable loom from the turret to the forearm */
  const loom = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(.2, .7, -.2), new THREE.Vector3(.26, 1.1, .1), new THREE.Vector3(.2, 1.3, .3)]), 30, .03, 8), rubber);
  turret.add(loom);
  /* status light on the turret */
  const lamp = new THREE.Mesh(cyl(.04, .12, 16), new THREE.MeshBasicMaterial({ color: 0x55ff99 })); lamp.position.set(.2, .78, -.22); turret.add(lamp);

  /* ---------- work table, conveyor, bin ---------- */
  const TY = .8;
  const table = new THREE.Group(); scene.add(table);
  const top = M(new THREE.BoxGeometry(2.2, .06, 1.0), new THREE.MeshPhysicalMaterial({ color: 0x9da2a8, roughness: .5, metalness: .9, normalMap: grainNormal(512, .08, .5), envMap: env, envMapIntensity: .6 })); top.position.set(0, TY - .03, 1.05); table.add(top);
  for (const [x, z] of [[-1.05, .6], [1.05, .6], [-1.05, 1.5], [1.05, 1.5]]) { const l = M(new THREE.BoxGeometry(.06, TY - .06, .06), dark); l.position.set(x, (TY - .06) / 2, z); table.add(l); }
  const conv = new THREE.Group(); conv.position.set(-1.35, 0, -.2); scene.add(conv);
  const beltTex = belt(); beltTex.repeat.set(1, 6);
  const beltM = new THREE.MeshStandardMaterial({ map: beltTex, roughness: .85 });
  const beltMesh = M(new THREE.BoxGeometry(.5, .05, 3.2), beltM); beltMesh.position.y = TY - .025; conv.add(beltMesh);
  for (const s of [-1, 1]) { const rail = M(new THREE.BoxGeometry(.04, .1, 3.3), steel); rail.position.set(s * .27, TY - .01, 0); conv.add(rail); }
  for (let z = -1.5; z <= 1.5; z += .75) for (const s of [-1, 1]) { const l = M(new THREE.BoxGeometry(.05, TY - .05, .05), dark); l.position.set(s * .22, (TY - .05) / 2, z); conv.add(l); }
  const bin = new THREE.Group(); bin.position.set(-1.35, 0, -2.2); scene.add(bin);
  const binM = new THREE.MeshStandardMaterial({ color: 0x2b5c8a, roughness: .55 });
  [[0, .25, -.35, .8, .5, .04], [0, .25, .35, .8, .5, .04], [-.4, .25, 0, .04, .5, .7], [.4, .25, 0, .04, .5, .7], [0, .02, 0, .8, .04, .7]].forEach(([x, y, z, w, hh, d]) => { const p = M(new THREE.BoxGeometry(w, hh, d), binM); p.position.set(x, y, z); bin.add(p); });

  /* ---------- crates ---------- */
  const COLORS = [['#d9604a', 'R'], ['#3fa38c', 'G'], ['#e7b13f', 'Y'], ['#5b84d6', 'B']];
  const CS = .14;
  const crates = [];
  const crateG = new THREE.BoxGeometry(CS, CS, CS);
  function addCrate(ci, x, z) {
    const m = new THREE.MeshPhysicalMaterial({ map: crateTex(COLORS[ci][0], COLORS[ci][1]), roughness: .55, clearcoat: .2, envMap: env, envMapIntensity: .5 });
    const o = M(crateG, m); o.position.set(x, TY + CS / 2, z); scene.add(o);
    const c = { o, ci, held: false, vy: 0, onBelt: false }; crates.push(c); return c;
  }
  const home = [[-.6, 1.15], [-.25, 1.25], [.15, 1.1], [.55, 1.25], [-.45, .85], [.4, .85]];
  function resetCrates() { crates.splice(0).forEach((c) => scene.remove(c.o)); home.forEach(([x, z], i) => addCrate(i % 4, x, z)); }
  resetCrates();

  /* ---------- line follower area ---------- */
  const LF = new THREE.Group(); LF.position.set(3.6, .002, -.6); scene.add(LF);
  const matG = new THREE.PlaneGeometry(2.2, 1.5); matG.rotateX(-Math.PI / 2);
  const mat = new THREE.Mesh(matG, new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: .9 })); mat.position.set(1, 0, .65); mat.receiveShadow = true; LF.add(mat);
  let trackMesh = null;
  function drawTrack(tr) {
    if (trackMesh) LF.remove(trackMesh);
    const pos = [], idx = [];
    for (let i = 0; i <= tr.length; i++) {
      const a = tr[i % tr.length], b = tr[(i + 1) % tr.length], p = tr[(i - 1 + tr.length) % tr.length];
      const dx = b[0] - p[0], dy = b[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * LINE_W / 2, ny = dx / l * LINE_W / 2;
      pos.push(a[0] + nx, .002, a[1] + ny, a[0] - nx, .002, a[1] - ny);
      if (i < tr.length) { const k2 = i * 2; idx.push(k2, k2 + 1, k2 + 2, k2 + 1, k2 + 3, k2 + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    trackMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })); LF.add(trackMesh);
  }
  const rover = new THREE.Group(); LF.add(rover);
  const chassis = M(new THREE.BoxGeometry(.12, .025, .1), new THREE.MeshPhysicalMaterial({ color: 0x1f6d55, roughness: .4, clearcoat: 1 })); chassis.position.y = .035; rover.add(chassis);
  const wheels = [-1, 1].map((s) => { const w = M(new THREE.CylinderGeometry(.03, .03, .018, 24), rubber); w.rotation.x = Math.PI / 2; w.position.set(-.01, .03, s * .062); rover.add(w); return w; });
  const ledM = SENS.map(() => new THREE.MeshBasicMaterial({ color: 0x331111 }));
  SENS.forEach((o, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(.006, 8, 6), ledM[i]); l.position.set(AHEAD, .02, o * SPACING); rover.add(l); });
  const chip = M(new THREE.BoxGeometry(.04, .01, .04), dark); chip.position.set(-.02, .05, 0); rover.add(chip);

  /* ---------- state ---------- */
  const st = store('w56.cfg3d', { prog: [], kp: 2, ki: 0, kd: .06, v: .32, track: 'oval' });
  const cfg = { ...{ prog: [], kp: 2, ki: 0, kd: .06, v: .32, track: 'oval' }, ...st.get() }; const save = () => st.set(cfg);
  const J = { yaw: 0, a1: .9, a2: -1.6, a3: 0, roll: 0, grip: .07 };     // current joints (grip = finger offset)
  let goal = null;                                    // cartesian goal {p, roll, grip}
  const tip = fk(J); let tipGoal = tip.clone(), gripGoal = .07, rollGoal = 0;
  const SPEED = .55, JSPEED = 1.6;                   // m/s straight-line speed, rad/s joint limit
  let queue = [], heldCrate = null, mode = 'ik', manual = false, playing = false, pIdx = 0, waitT = 0, busyMsg = '', sorting = false;
  let bot = new Bot(TRACKS[cfg.track]); drawTrack(TRACKS[cfg.track]); let lfRun = false; const errHist = [];

  /* ---------- interface ---------- */
  const sh = sheet(ui, { title: 'The Robot Cell', kicker: 'World 10 · Robotics', tabs: ['Pick & place', 'Program', 'Joints', 'Line robot', 'Learn'], accent: '#e8a23a' });
  linkView(k, sh);
  const hd = hud(ui, 'Gripper at', '–');
  const [S0, S1, S2, S3, S4] = sh.secs;
  S0.append(h('p', { text: 'Tap a crate: the arm picks it up. Then tap where it should go: the table, the conveyor belt, or the top of another crate. The belt carries crates to the blue bin.' }));
  const r0 = row(S0);
  btn(r0, 'Sort all crates', () => { startSort(); }, 'pri');
  btn(r0, 'Reset crates', () => { stopAll(); resetCrates(); sh.toast('Crates back on the table.'); });
  btn(r0, 'Home', () => { stopAll(); go(new THREE.Vector3(0, 1.75, .9), .07); });
  const out = stats(S0, [['reach', 'Reach'], ['speed', 'Tool speed'], ['moves', 'Moves done'], ['held', 'Holding']]);
  let moves = 0;

  S1.append(h('p', { text: 'Teach the arm: move it (tap the table, or use Joints), then Save point. Play runs your points in a loop, with the gripper as you saved it.' }));
  const r1 = row(S1);
  btn(r1, '+ Save point', () => { cfg.prog.push({ p: [tipGoal.x, tipGoal.y, tipGoal.z], g: gripGoal < .04 }); save(); listWP(); });
  const playP = btn(r1, '▶ Play program', () => { if (playing) { playing = false; playP.textContent = '▶ Play program'; return; } if (!cfg.prog.length) { sh.toast('Save a few points first.'); return; } stopAll(); playing = true; pIdx = 0; playP.textContent = '■ Stop'; }, 'pri');
  btn(r1, 'Clear', () => { cfg.prog = []; save(); listWP(); playing = false; playP.textContent = '▶ Play program'; });
  const gripB = btn(row(S1), 'Gripper: open', () => { gripGoal = gripGoal > .04 ? .015 : .07; gripB.textContent = 'Gripper: ' + (gripGoal > .04 ? 'open' : 'closed'); grabCheck(); });
  const wpBox = h('div', { class: 'r-wp' }); S1.append(wpBox);
  function listWP() { wpBox.replaceChildren(...cfg.prog.map((w, i) => h('div', { class: playing && i === pIdx ? 'on' : '' }, h('span', { text: `${i + 1}. x ${w.p[0].toFixed(2)} y ${w.p[1].toFixed(2)} z ${w.p[2].toFixed(2)}` }), h('span', { text: w.g ? 'grip' : 'open' })))); }
  listWP();

  S2.append(h('p', { text: 'Turn each joint yourself (forward kinematics). The readout shows where the fingertips end up.' }));
  const deg = (v) => `${Math.round(v * 180 / Math.PI)}°`;
  const jr = {
    yaw: range(S2, 'Base (axis 1)', { min: -170, max: 170, value: 0, fmt: (v) => v + '°' }, (v) => { manualSet('yaw', v); }),
    a1: range(S2, 'Shoulder (axis 2)', { min: -10, max: 120, value: 50, fmt: (v) => v + '°' }, (v) => { manualSet('a1', v); }),
    a2: range(S2, 'Elbow (axis 3)', { min: -160, max: 0, value: -90, fmt: (v) => v + '°' }, (v) => { manualSet('a2', v); }),
    roll: range(S2, 'Wrist roll (axis 6)', { min: -180, max: 180, value: 0, fmt: (v) => v + '°' }, (v) => { manualSet('roll', v); }),
  };
  const jout = stats(S2, [['x', 'Tip x'], ['y', 'Tip y'], ['z', 'Tip z']]);
  function manualSet(key, v) { stopAll(); manual = true; J[key] = v * Math.PI / 180; if (key !== 'roll') J.a3 = -Math.PI / 2 - J.a1 - J.a2; else rollGoal = J.roll; tipGoal.copy(fk(J)); }

  S3.append(h('p', { text: 'A two-wheeled robot with five light sensors follows the black line. A PID controller steers: tune it and watch the error.' }));
  const r3 = row(S3);
  const lfB = btn(r3, '▶ Drive', () => { lfRun = !lfRun; lfB.textContent = lfRun ? '❚❚ Pause' : '▶ Drive'; if (lfRun) k.fly([5.4, 1.6, 2.4], [4.6, 0, 0], 1.4); }, 'pri');
  btn(r3, 'Restart', () => { bot = new Bot(TRACKS[cfg.track]); errHist.length = 0; });
  seg(S3, [['oval', 'Oval'], ['eight', 'Figure 8'], ['wave', 'Wavy']], cfg.track, (v) => { cfg.track = v; save(); bot = new Bot(TRACKS[v]); drawTrack(TRACKS[v]); errHist.length = 0; });
  range(S3, 'Kp (steer by error)', { min: 0, max: 8, step: .1, value: cfg.kp, fmt: (v) => v.toFixed(1) }, (v) => { cfg.kp = v; save(); });
  range(S3, 'Ki (steer by built-up error)', { min: 0, max: 4, step: .05, value: cfg.ki, fmt: (v) => v.toFixed(2) }, (v) => { cfg.ki = v; save(); });
  range(S3, 'Kd (steer by change)', { min: 0, max: .4, step: .01, value: cfg.kd, fmt: (v) => v.toFixed(2) }, (v) => { cfg.kd = v; save(); });
  range(S3, 'Speed', { min: .1, max: .8, step: .02, value: cfg.v, fmt: (v) => `${(v * 100).toFixed(0)} cm/s` }, (v) => { cfg.v = v; save(); });
  const plot = h('canvas', { class: 'r-plot', width: 600, height: 180, 'aria-label': 'Steering error over time' }); S3.append(plot);
  const lout = stats(S3, [['e', 'Error now'], ['d', 'Distance'], ['l', 'On the line']]);

  S4.append(h('h3', { text: 'Inverse kinematics' }), h('p', { text: 'You choose where the fingertips go; the robot works out the angles. The base turns toward the point, then the shoulder and elbow form a triangle whose sides are the two arm links (law of cosines), and the wrist tilts so the gripper always points straight down.' }),
    h('h3', { text: 'Straight-line moves' }), h('p', { text: 'Industrial robots move the tool in straight lines at a set speed. Here the target slides along the line at up to 55 cm/s and the angles are solved again every frame, with a speed limit on every joint.' }),
    h('h3', { text: 'PID' }), h('p', { text: 'P steers in proportion to how far off the line the robot is, I corrects a steady drift, D damps wobbling. Too much P makes it zig-zag; add a little D to calm it.' }));

  /* ---------- motion ---------- */
  function go(p, grip, roll = 0, wait = 0) { queue.push({ p: p.clone(), grip, roll, wait }); }
  function stopAll() { queue = []; playing = false; sorting = false; playP.textContent = '▶ Play program'; manual = false; }
  const above = (v, dy = .35) => new THREE.Vector3(v.x, v.y + dy, v.z);
  function pickCrate(c) {
    if (heldCrate) { sh.toast('Already holding a crate: tap where to put it.'); return; }
    const p = c.o.position.clone(); const top = topOf(c); if (top !== c) { sh.toast('Take the top crate first.'); return; }
    const reach = ik(p.x, p.y + CS / 2 - .02, p.z); if (!reach.reachable) { sh.toast('Out of reach for this arm.'); return; }
    const g = new THREE.Vector3(p.x, p.y - .02, p.z);    // fingertips just below the crate's middle: the gripper body stays clear above it
    queue.push({ p: above(g), grip: .1 }, { p: g, grip: .1 }, { p: g, grip: .083, grab: c, wait: .25 }, { p: above(g, .4), grip: .083 });
  }
  function placeAt(x, z, y) {
    if (!heldCrate) return; const g = new THREE.Vector3(x, y + CS / 2 - .015, z);
    if (!ik(x, g.y, z).reachable) { sh.toast('Out of reach: try closer to the robot.'); return; }
    queue.push({ p: above(g), grip: .083 }, { p: g, grip: .083 }, { p: g, grip: .1, drop: true, wait: .2 }, { p: above(g), grip: .07 });
  }
  function topOf(c) { let t = c; for (const o of crates) if (o !== c && !o.held && Math.abs(o.o.position.x - c.o.position.x) < CS * .8 && Math.abs(o.o.position.z - c.o.position.z) < CS * .8 && o.o.position.y > t.o.position.y) t = o; return t; }
  function grabCheck() {
    if (gripGoal < .04 && !heldCrate) { const tp = fk(J); const c = crates.find((o) => o.o.position.distanceTo(new THREE.Vector3(tp.x, tp.y + .02, tp.z)) < .1); if (c) attach(c); }
    if (gripGoal > .04 && heldCrate) release();
  }
  function attach(c) { heldCrate = c; c.held = true; c.onBelt = false; roll.attach(c.o); moves++; }
  function release() { const c = heldCrate; if (!c) return; scene.attach(c.o); c.o.rotation.set(0, c.o.rotation.y, 0); c.held = false; c.vy = 0; heldCrate = null; }
  function startSort() {
    stopAll(); sorting = true; sh.toast('Sorting: every crate goes onto the belt, one by one.');
  }
  function sortStep() {
    if (!sorting || queue.length || heldCrate) return;
    const free = crates.filter((c) => !c.held && !c.onBelt && c.o.position.z > .4 && Math.abs(c.o.position.y - (TY + CS / 2)) < .5);
    if (!free.length) { sorting = false; sh.toast('All crates sorted.'); go(new THREE.Vector3(0, 1.75, .9), .07); return; }
    const c = topOf(free.sort((a, b) => a.o.position.x - b.o.position.x)[0]); pickCrate(c);
    queue.push({ then: () => placeAt(-1.35, .5, TY) });
  }

  /* taps in the scene */
  k.pick(() => [...crates.map((c) => c.o), top, beltMesh], (hit) => {
    const c = crates.find((o) => o.o === hit.object);
    if (c && !c.held) { stopAll(); if (heldCrate) { const t = topOf(c); placeAt(t.o.position.x, t.o.position.z, t.o.position.y + CS / 2); } else pickCrate(c); return; }
    const p = hit.point;
    if (heldCrate) { stopAll(); placeAt(p.x, p.z, TY); return; }
    if (hit.object === top) { stopAll(); go(new THREE.Vector3(p.x, TY + .25, p.z), gripGoal); }
  });

  /* ---------- frame ---------- */
  const tmp = new THREE.Vector3(); let lastTip = fk(J), speedNow = 0;
  k.onFrame((dt, t) => {
    /* program playback */
    if (playing && !queue.length) { const w = cfg.prog[pIdx % cfg.prog.length]; queue.push({ p: new THREE.Vector3(...w.p), grip: w.g ? .015 : .07, wait: .25, grabAuto: true }); pIdx++; listWP(); }
    sortStep();
    /* run the queue: slide the goal in a straight line */
    if (queue.length) {
      const q = queue[0];
      if (q.then) { queue.shift(); q.then(); }
      else {
        manual = false;
        const d = tmp.copy(q.p).sub(tipGoal), L = d.length(), stepL = SPEED * dt;
        if (L > stepL) tipGoal.addScaledVector(d, stepL / L); else tipGoal.copy(q.p);
        gripGoal = q.grip; rollGoal = q.roll ?? rollGoal;
        const here = fk(J).distanceTo(tipGoal) < .01;
        if (L <= stepL && here) {
          q.wait = (q.wait ?? 0) - dt;
          if (q.wait <= 0) { if (q.grab) attach(q.grab); if (q.drop) release(); if (q.grabAuto) grabCheck(); queue.shift(); }
        }
      }
    }
    /* joints follow the goal with a speed limit */
    if (!manual) {
      const s = ik(tipGoal.x, tipGoal.y, tipGoal.z);
      for (const key of ['yaw', 'a1', 'a2', 'a3']) { let dd = s[key] - J[key]; if (key === 'yaw') dd = Math.atan2(Math.sin(dd), Math.cos(dd)); J[key] += clamp(dd, -JSPEED * dt, JSPEED * dt); }
    }
    J.roll += clamp(rollGoal - J.roll, -2 * dt, 2 * dt);
    J.grip += clamp(gripGoal - J.grip, -.12 * dt, .12 * dt);
    turret.rotation.y = J.yaw; shoulder.rotation.x = -J.a1; elbow.rotation.x = -J.a2; wrist.rotation.x = -J.a3; roll.rotation.z = J.roll;
    fingers[0].position.x = -J.grip; fingers[1].position.x = J.grip;
    const tp = fk(J); speedNow = lerp(speedNow, tp.distanceTo(lastTip) / Math.max(dt, 1e-3), .1); lastTip.copy(tp);
    lamp.material.color.set(queue.length || playing || sorting ? 0xffb02e : 0x55ff99);
    /* crates: gravity onto table, belt or other crates */
    for (const c of crates) {
      if (c.held) continue; const p = c.o.position;
      let floorY = 0;
      const onTable = Math.abs(p.x) < 1.1 && p.z > .55 && p.z < 1.55, onBelt = Math.abs(p.x + 1.35) < .25 && Math.abs(p.z + .2) < 1.6;
      if (onTable || onBelt) floorY = TY;
      for (const o of crates) if (o !== c && !o.held && Math.abs(o.o.position.x - p.x) < CS * .8 && Math.abs(o.o.position.z - p.z) < CS * .8 && o.o.position.y < p.y) floorY = Math.max(floorY, o.o.position.y + CS / 2);
      const rest = floorY + CS / 2;
      if (p.y > rest + 1e-4) { c.vy -= 9.81 * dt; p.y = Math.max(rest, p.y + c.vy * dt); } else { p.y = rest; c.vy = 0; }
      c.onBelt = onBelt && Math.abs(p.y - (TY + CS / 2)) < .02;
      if (c.onBelt) { p.z -= .35 * dt; }
      if (p.y < .05 && Math.abs(p.z + 2.2) < .5) { /* landed in the bin: respawn on the table after a moment */
        if (!c.binT) c.binT = t; if (t - c.binT > 1.5) { const free = home.find(([x, z]) => !crates.some((o) => o !== c && Math.hypot(o.o.position.x - x, o.o.position.z - z) < .1)) || home[0]; p.set(free[0], TY + 1.2, free[1]); c.binT = 0; c.vy = 0; } }
    }
    beltTex.offset.y = (beltTex.offset.y + dt * .35 / 3.2 * 6) % 1;
    /* readouts */
    const reach = Math.hypot(tp.x, tp.z);
    out('reach', `${reach.toFixed(2)} m`); out('speed', `${(speedNow * 100).toFixed(0).padStart(3, ' ')} cm/s`); out('moves', moves); out('held', heldCrate ? ['Red', 'Green', 'Yellow', 'Blue'][heldCrate.ci] : 'nothing');
    hd.set(`${tp.x.toFixed(2)}  ${tp.y.toFixed(2)}  ${tp.z.toFixed(2)}`);
    if (sh.tab === 2) { jout('x', tp.x.toFixed(3)); jout('y', tp.y.toFixed(3)); jout('z', tp.z.toFixed(3));
      if (!manual) { jr.yaw.set(Math.round(J.yaw * 180 / Math.PI)); jr.a1.set(Math.round(J.a1 * 180 / Math.PI)); jr.a2.set(Math.round(J.a2 * 180 / Math.PI)); } }
    /* line robot */
    if (lfRun) {
      const tr = TRACKS[cfg.track];
      for (let s = 0; s < 4; s++) { const e = bot.step(tr, dt / 4, cfg); if (s === 0) { errHist.push(e); if (errHist.length > 300) errHist.shift(); } }
      if (bot.lost > 1.5 || bot.x < -.2 || bot.x > 2.2 || bot.y < -.2 || bot.y > 1.5) { bot = new Bot(tr); sh.toast('The robot lost the line and restarted. Try a lower speed or more Kd.'); }
      wheels.forEach((w, i) => { w.rotation.y += (i ? bot.wr : bot.wl) * dt / .03; });
      if (sh.tab === 3) {
        const g = plot.getContext('2d'), W = plot.width, Hh = plot.height; g.clearRect(0, 0, W, Hh); g.strokeStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.moveTo(0, Hh / 2); g.lineTo(W, Hh / 2); g.stroke();
        g.strokeStyle = '#e8a23a'; g.lineWidth = 3; g.beginPath(); errHist.forEach((e, i) => { const x = i / 300 * W, y = Hh / 2 - e * Hh * .45; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
        lout('e', (bot.lastE >= 0 ? '+' : '') + bot.lastE.toFixed(2)); lout('d', `${bot.dist.toFixed(1)} m`); lout('l', bot.lost ? 'lost' : 'yes');
      }
    }
    rover.position.set(bot.x, 0, bot.y); rover.rotation.y = -bot.th;
    bot.lastR.forEach((r, i) => ledM[i].color.setRGB(.2 + r * 2.5, .07 + r * .3, .07));
  });
  sh.onTab((i) => { if (i === 3) k.fly([5.4, 1.6, 2.4], [4.6, 0, 0], 1.4); else if (k.camera.position.x > 4.5) k.fly([3.4, 2.6, 4.4], [0, 1, .4]); });
  go(new THREE.Vector3(0, 1.75, .9), .07); k.dbg = { crates, J, fk, roll, get held() { return heldCrate; }, get q() { return queue; } };
  camera.position.set(6, 4.5, 8); k.fly([3.4, 2.6, 4.4], [0, 1, .4], 3);
  return k;
}
