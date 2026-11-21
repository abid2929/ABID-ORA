/* 024 · Science Discovery World (site world 040). A night-time museum laboratory with four
   experiments that changed science, rebuilt in 3D so you can run them and get the answer from your own
   measurements, using the physics of world 040's Discovery Lab:
   1. Eratosthenes (about 240 BCE): two sticks, parallel sunlight, the size of the Earth.
   2. Galileo (1604): a ball rolling down a ramp passes bells placed at 1, 4, 9, 16 units: equal beats.
   3. Millikan (1909): hold charged oil drops still between two plates; charges come in steps of e.
   4. Geiger, Marsden and Rutherford (1909 to 1911): alpha particles on gold foil, a few bounce back. */
import type { Ctx } from './kit';
import { MERIDIAN, circumference, rampAcc, slope0, E_CHARGE, holdV, bestUnit, closest, scatter } from './w040lab';
import { paint } from './w038';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { THREE, stage, sec, para, slider, segs, stats, chips, btns, el, canvasTex, glowTex, rng, clamp, noise2 } from './nskit';

const TILT = 23.4;
const DIST: Record<string, number> = { era: 6.4, gal: 5.2, mil: 4.4, rut: 5.6 };
const STATIONS = [
  { id: 'era', x: -9, z: -3 }, { id: 'gal', x: -3, z: -7 }, { id: 'mil', x: 3, z: -7 }, { id: 'rut', x: 9, z: -3 },
];

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 24 · Science'), title: t('title', 'Science Discovery World'), sub: t('sub', 'Four experiments that changed what we know. Run them yourself and find the answer in your own data.'),
    acc: '#ffd27a', ink: '#07070a', hf: "'Fraunces'", fov: 40, near: .05, far: 200,
    lab: () => import('./w040lab'), labName: t('lab', 'Discovery Lab (2D)'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.toneMappingExposure = 1; renderer.shadowMap.enabled = true;
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .55;
  scene.background = new THREE.Color(0x07070a); scene.fog = new THREE.Fog(0x07070a, 18, 46);

  /* ---- the hall ---- */
  const floorTex = canvasTex(1024, 1024, (g, w) => { const im = g.createImageData(w, w), n1 = noise2(3), n2 = noise2(4); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = n1(x / 90, y / 90) * .5 + .5, v = 28 + k * 18 + (n2(x / 6, y / 6) * .5 + .5) * 8 + ((x % 256 < 2 || y % 256 < 2) ? 14 : 0); im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v * 1.05; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: 6 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshStandardMaterial({ map: floorTex, roughness: .32, metalness: .2 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 9, 96, 1, true), new THREE.MeshStandardMaterial({ color: 0x221f22, roughness: .85, side: THREE.BackSide })); wall.position.y = 4.5; scene.add(wall);
  const ribM = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: .4, metalness: .6 });
  for (let i = 0; i < 28; i++) { const a = i / 28 * Math.PI * 2, rib = new THREE.Mesh(new THREE.BoxGeometry(.18, 9, .4), ribM); rib.position.set(Math.sin(a) * 15.8, 4.5, Math.cos(a) * 15.8); rib.rotation.y = a; scene.add(rib); }
  scene.add(new THREE.HemisphereLight(0x8090b0, 0x101010, .35));
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: .28 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x2b2a2e, roughness: .55, metalness: .1 });
  const wood = new THREE.MeshStandardMaterial({ map: canvasTex(512, 128, (g, w, h) => { const n = noise2(7); const im = g.createImageData(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = Math.sin(y * .35 + n(x / 80, y / 20) * 6) * .5 + .5; im.data[i] = 120 + k * 50; im.data[i + 1] = 72 + k * 32; im.data[i + 2] = 40 + k * 18; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }), roughness: .5 });
  const groups: Record<string, THREE.Group> = {};
  for (const st of STATIONS) {
    const g = new THREE.Group(); g.position.set(st.x, 0, st.z); g.lookAt(0, 0, 6); scene.add(g); groups[st.id] = g;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.05, .9, 64), stone); ped.position.y = .45; ped.castShadow = ped.receiveShadow = true; g.add(ped);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.9, .03, 12, 96), brass); rim.rotation.x = Math.PI / 2; rim.position.y = .9; g.add(rim);
    const spot = new THREE.SpotLight(0xfff0d8, 60, 14, .42, .55, 1.6); spot.position.set(0, 7.5, 1.2); spot.target.position.set(0, .9, 0); spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); g.add(spot, spot.target);
  }
  const top = .9;

  /* ===== 1. Eratosthenes ===== */
  const E = { km: 800 };
  const era = groups.era, R = 1.1;
  const earthMap = paint('Earth', S.phone ? 1024 : 2048); earthMap.wrapS = THREE.RepeatWrapping; earthMap.offset.x = 32.5 / 360; /* Egypt faces the Sun */
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ roughness: .62, map: earthMap }));
  globe.rotation.z = -TILT * Math.PI / 180; /* midsummer noon: the Tropic of Cancer faces the Sun */
  globe.position.y = top + .2 + R; globe.castShadow = true; era.add(globe);
  const stickM = new THREE.MeshStandardMaterial({ color: 0xf2e6c8, roughness: .4 });
  const mkStick = () => { const s = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(.014, .014, .32, 12), stickM); m.position.y = .16; s.add(m); return s; };
  const syene = mkStick(), alex = mkStick(); globe.add(syene, alex);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, .03), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .8, side: THREE.DoubleSide })); alex.add(shadow);
  const rays = new THREE.Group(); for (let i = -4; i <= 4; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 3.4, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .55 })); r.rotation.z = Math.PI / 2; r.position.set(2.1, i * .18, 0); rays.add(r); }
  rays.position.y = globe.position.y; era.add(rays);
  const eSun = new THREE.DirectionalLight(0xfff2d0, 2.2); eSun.position.set(6, globe.position.y, 0); eSun.target = globe; era.add(eSun);
  const wedge = new THREE.Mesh(new THREE.CircleGeometry(R * .97, 48, TILT * Math.PI / 180, .2), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: .35, side: THREE.DoubleSide, depthTest: false })); globe.add(wedge);
  function eraUpdate() {
    const ang = E.km / MERIDIAN * 360, vis = Math.min(ang * 4, 70); /* the drawing exaggerates the angle 4× so it can be seen */
    const place = (s: THREE.Group, latDeg: number) => { const a = latDeg * Math.PI / 180; s.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); s.rotation.z = a - Math.PI / 2; };
    place(syene, TILT); place(alex, TILT + vis);
    const L = Math.tan(vis * Math.PI / 180) * .32; shadow.scale.x = Math.max(.001, L); shadow.position.set(0, .002, 0); shadow.rotation.set(-Math.PI / 2, 0, 0); shadow.position.x = -L / 2;
    wedge.geometry.dispose(); wedge.geometry = new THREE.CircleGeometry(R * .97, 48, TILT * Math.PI / 180, vis * Math.PI / 180);
    const meas = ang * (1 + Math.sin(E.km) * .01); /* careful, but not perfect */
    eInfo('ang', `${meas.toFixed(2)}°`); eInfo('c', `${Math.round(circumference(meas, E.km)).toLocaleString(ctx.lang)} km`);
    eInfo('err', `${((circumference(meas, E.km) / MERIDIAN - 1) * 100).toFixed(1)}%`);
  }

  /* ===== 2. Galileo's ramp ===== */
  const Gp = { deg: 3, rolling: true };
  const gal = groups.gal, RL = 3.2;
  const rampG = new THREE.Group(); gal.add(rampG);
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(RL, .06, .26), wood); ramp.position.x = RL / 2; ramp.castShadow = ramp.receiveShadow = true;
  const groove = new THREE.Mesh(new THREE.BoxGeometry(RL, .02, .05), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: .7 })); groove.position.set(RL / 2, .035, 0);
  const tilt = new THREE.Group(); tilt.add(ramp, groove); rampG.add(tilt);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(.08, 1, .2), wood); gal.add(leg);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.045, 32, 24), brass); ball.castShadow = true; tilt.add(ball);
  const bells: THREE.Mesh[] = []; for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(.07, .012, 10, 32), brass); b.rotation.y = Math.PI / 2; tilt.add(b); bells.push(b); }
  let roll = { on: false, t: 0, hits: [] as number[] };
  const flashes: { m: THREE.Mesh; t: number }[] = [];
  function flash(b: THREE.Mesh) { const f = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); b.add(f); flashes.push({ m: f, t: 0 }); }
  function galGeom() {
    const a = Gp.deg * Math.PI / 180, hgt = Math.sin(a) * RL;
    rampG.position.set(-RL / 2, top + .05 + hgt, 0); tilt.rotation.z = -a;
    leg.position.set(-RL / 2 + .05, top + hgt / 2, 0); leg.scale.y = Math.max(.05, hgt);
    bells.forEach((b, i) => { b.position.set(.15 + (i + 1) ** 2 / 16 * 2.9, .09, 0); });
    ball.position.set(.15, .085, 0);
    const acc = rampAcc(Gp.deg, Gp.rolling);
    gInfo('a', `${acc.toFixed(2)} m/s²`); gInfo('beat', `${Math.sqrt(2 * (2.9 / 16) / acc).toFixed(2)} s`);
  }
  function galRelease() { roll = { on: true, t: 0, hits: [] }; gInfo('t', '…'); ball.position.x = .15; }
  function galStep(dt: number) {
    if (!roll.on) return;
    roll.t += dt; const acc = rampAcc(Gp.deg, Gp.rolling), x = .5 * acc * roll.t ** 2;
    ball.position.x = .15 + Math.min(x, 3.0); ball.rotation.z = -x / .045;
    bells.forEach((b, i) => { const bx = (i + 1) ** 2 / 16 * 2.9; if (x >= bx && roll.hits.length === i) { roll.hits.push(roll.t); flash(b); } });
    if (x >= 3.0) {
      roll.on = false; const ts = roll.hits, xs = ts.map((_, i) => (i + 1) ** 2 / 16 * 2.9);
      gInfo('t', ts.map((v) => v.toFixed(2)).join(' · ') + ' s'); gInfo('fit', `${(2 * slope0(ts.map((v) => v * v), xs)).toFixed(2)} m/s²`);
    }
  }

  /* ===== 3. Millikan's oil drops ===== */
  const mil = groups.mil;
  const plateM = new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 1, roughness: .18 });
  const p1 = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .05, 64), plateM), p2 = p1.clone(); p1.position.y = top + .35; p2.position.y = top + 1.65; p1.castShadow = p2.castShadow = true; mil.add(p1, p2);
  for (const x of [-.75, .75]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.3, 12), brass); post.position.set(x, top + 1, -.4); mil.add(post); }
  const jar = new THREE.Mesh(new THREE.CylinderGeometry(.95, .95, 1.4, 64, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .12, depthWrite: false })); jar.position.y = top + 1; mil.add(jar);
  const lampB = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, .3, 24), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: .8, roughness: .3 })); lampB.rotation.z = Math.PI / 2; lampB.position.set(-1.25, top + 1, 0); mil.add(lampB);
  const M = { V: 200, drops: [] as { r: number; n: number; m: THREE.Mesh }[], sel: 0, qs: [] as number[] };
  const dropM = new THREE.MeshBasicMaterial({ color: 0xfff1c8 });
  const dropGlow = new THREE.SpriteMaterial({ map: glowTex(64), color: 0xffe9b0, blending: THREE.AdditiveBlending, depthWrite: false });
  const Rm = rng(5);
  function newDrops() {
    M.drops.forEach((d) => mil.remove(d.m)); M.drops = [];
    for (let i = 0; i < 5; i++) {
      const r = (.45 + Rm() * .6) * 1e-6, n = 1 + Math.floor(Rm() * 6), m = new THREE.Mesh(new THREE.SphereGeometry(.018, 12, 8), dropM);
      const s = new THREE.Sprite(dropGlow); s.scale.setScalar(.12); m.add(s);
      m.position.set((Rm() - .5) * .9, top + 1 + (Rm() - .5) * .8, (Rm() - .5) * .6); mil.add(m); M.drops.push({ r, n, m });
    }
    M.sel = 0; milInfo();
  }
  /* terminal speed from the net force over Stokes drag; positive is up */
  function dropV(d: { r: number; n: number }) { const mg = 4 / 3 * Math.PI * d.r ** 3 * 900 * 9.81, F = d.n * E_CHARGE * M.V / 5e-3 - mg; return F / (6 * Math.PI * 1.82e-5 * d.r); }
  function milInfo() { const d = M.drops[M.sel]; if (!d) return; mInfo('v', `${(dropV(d) * 1e6).toFixed(0)} µm/s`); mInfo('hold', `${M.qs.length}`); mInfo('e', M.qs.length ? `${(bestUnit(M.qs) * 1e19).toFixed(3)} × 10⁻¹⁹ C` : '–'); }
  function milMeasure() {
    const d = M.drops[M.sel]; if (!d) return;
    if (Math.abs(dropV(d)) > 30e-6) { S.showHint(t('m.move', 'Not still yet: change the voltage until the drop hangs in the air')); return; }
    const q = holdV(d.r, 1) / M.V * (1 + (Rm() - .5) * .02);
    M.qs.push(q); S.showCard(t('m.got', 'Charge measured'), `q = ${(q * 1e19).toFixed(2)} × 10⁻¹⁹ C ≈ ${Math.round(q / E_CHARGE)} × e`, 3500);
    M.sel = (M.sel + 1) % M.drops.length; milInfo();
  }
  const selRing = new THREE.Mesh(new THREE.RingGeometry(.05, .06, 32), new THREE.MeshBasicMaterial({ color: 0xffd27a, side: THREE.DoubleSide })); mil.add(selRing);

  /* ===== 4. Rutherford's gold foil ===== */
  const rut = groups.rut;
  const foil = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshStandardMaterial({ color: 0xe8c060, metalness: 1, roughness: .2, side: THREE.DoubleSide })); foil.position.set(0, top + 1.1, 0); foil.rotation.y = Math.PI / 2 - .55; rut.add(foil);
  const src = new THREE.Mesh(new THREE.BoxGeometry(.35, .3, .3), new THREE.MeshStandardMaterial({ color: 0x3a3d44, metalness: .8, roughness: .35 })); src.position.set(-1.4, top + 1.1, 0); rut.add(src);
  const screen = new THREE.Mesh(new THREE.SphereGeometry(1.2, 64, 32), new THREE.MeshStandardMaterial({ color: 0x9fe0a0, transparent: true, opacity: .025, side: THREE.BackSide, depthWrite: false })); screen.position.copy(foil.position); rut.add(screen);
  const Rr = { MeV: 7.7, n: 0, back: 0, wide: 0 };
  const AL = 300, alphaP = new Float32Array(AL * 3), alphaS = Array.from({ length: AL }, () => ({ t: -Math.random() * 2, b: 0, ph: 0, th: 0 }));
  const alphaG = new THREE.BufferGeometry(); alphaG.setAttribute('position', new THREE.BufferAttribute(alphaP, 3));
  rut.add(new THREE.Points(alphaG, new THREE.PointsMaterial({ color: 0xff8a5c, size: .06, map: glowTex(32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const HITS = 1500, hitP = new Float32Array(HITS * 3).fill(999), hitG = new THREE.BufferGeometry(); hitG.setAttribute('position', new THREE.BufferAttribute(hitP, 3)); let hitI = 0;
  rut.add(new THREE.Points(hitG, new THREE.PointsMaterial({ color: 0x9dffb0, size: .035, map: glowTex(32), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
  const Rn = rng(9);
  /* impact parameters spread over the beam; the deflection is Rutherford's 2·atan(d0 / 2b) */
  function spawn(a: typeof alphaS[0]) { const d0 = closest(79, Rr.MeV); a.t = -Rn() * 1.2; a.b = Math.sqrt(Rn()) * 4000 * d0 / 45; a.th = scatter(a.b, d0); a.ph = Rn() * 6.283; }
  alphaS.forEach(spawn);
  function rutStep(dt: number) {
    const o = foil.position;
    for (let i = 0; i < AL; i++) {
      const a = alphaS[i]; a.t += dt * 1.1;
      const off = Math.min(.18, a.b / 12000), y0 = Math.cos(a.ph) * off, z0 = Math.sin(a.ph) * off; let x: number, y: number, z: number;
      if (a.t < 0) { alphaP.set([0, 999, 0], i * 3); continue; }
      if (a.t < 1) { x = -1.25 + a.t * 1.25; y = y0; z = z0; }
      else { const s = (a.t - 1) * 1.25, r = Math.sin(a.th) * s; x = Math.cos(a.th) * s; y = y0 + Math.cos(a.ph) * r; z = z0 + Math.sin(a.ph) * r; }
      if (a.t >= 1 && Math.hypot(x, y, z) > 1.18) {
        hitP.set([x + o.x, y + o.y, z + o.z], (hitI++ % HITS) * 3); hitG.attributes.position.needsUpdate = true;
        Rr.n++; if (a.th > Math.PI / 2) Rr.back++; if (a.th > .17) Rr.wide++;
        spawn(a); continue;
      }
      alphaP.set([x + o.x, y + o.y, z + o.z], i * 3);
    }
    alphaG.attributes.position.needsUpdate = true;
  }

  /* ---- panel: one section per experiment ---- */
  const B = S.body;
  const boxes: Record<string, HTMLElement> = {};
  const box = (id: string) => { const d = el('div', { style: { display: 'none', flexDirection: 'column', gap: '12px' } }); B.append(d); boxes[id] = d; return d; };
  let b = box('era');
  sec(b, t('e.h', 'Eratosthenes · the size of the Earth'));
  para(b, t('e.p', 'At noon on midsummer the Sun shone straight down a well in Syene, but in Alexandria a stick cast a shadow. The shadow angle is the slice of the whole circle between the two cities.'));
  const eInfo = stats(b, [['ang', t('e.ang', 'Shadow angle')], ['c', t('e.c', 'Your Earth')], ['err', t('e.err', 'Error vs true')]]);
  slider(b, t('e.km', 'Distance Syene → Alexandria'), { min: 200, max: 2500, step: 10, value: E.km, fmt: (v) => v + ' km' }, (v) => { E.km = v; eraUpdate(); });
  b = box('gal');
  sec(b, t('g.h', 'Galileo · the law of falling'));
  para(b, t('g.p', 'The bells sit at distances 1, 4, 9 and 16. If distance grows with time squared, the ball rings them on an even beat.'));
  const gInfo = stats(b, [['a', t('g.a', 'Acceleration')], ['beat', t('g.beat', 'Beat')], ['t', t('g.t', 'Bell times')], ['fit', t('g.fit', 'From your data')]]);
  slider(b, t('g.deg', 'Ramp angle'), { min: 1, max: 12, step: .5, value: Gp.deg, fmt: (v) => v + '°' }, (v) => { Gp.deg = v; roll.on = false; galGeom(); });
  segs(b, '', [['ball', t('g.ball', 'Rolling ball')], ['block', t('g.block', 'Frictionless block')]], 'ball', (v) => { Gp.rolling = v === 'ball'; galGeom(); });
  btns(b, [[t('g.go', 'Release the ball'), galRelease, true]]);
  b = box('mil');
  sec(b, t('m.h', 'Millikan · the charge of the electron'));
  para(b, t('m.p', 'Tiny oil drops pick up a few extra electrons. Turn the voltage until the ringed drop hangs still: the electric pull then equals its weight, and that gives its charge.'));
  const mInfo = stats(b, [['v', t('m.v', 'Drop speed (up +)')], ['hold', t('m.n', 'Drops measured')], ['e', t('m.e', 'Your value of e')]]);
  slider(b, t('m.V', 'Plate voltage'), { min: 0, max: 1500, step: 1, value: M.V, fmt: (v) => v + ' V' }, (v) => { M.V = v; milInfo(); });
  btns(b, [[t('m.go', 'Measure this drop'), milMeasure, true], [t('m.new', 'New drops'), newDrops]]);
  b = box('rut');
  sec(b, t('r.h', 'Rutherford · the atom is mostly empty'));
  para(b, t('r.p', 'If atoms were soft puddings of charge, every alpha particle would pass straight through. Watch for the rare ones that bounce back: they hit a tiny, heavy nucleus.'));
  const rInfo = stats(b, [['n', t('r.n', 'Alphas counted')], ['wide', t('r.w', 'Deflected > 10°')], ['back', t('r.b', 'Bounced back')], ['d0', t('r.d0', 'Closest approach')]]);
  slider(b, t('r.E', 'Alpha energy'), { min: 2, max: 12, step: .1, value: Rr.MeV, fmt: (v) => v.toFixed(1) + ' MeV' }, (v) => { Rr.MeV = v; Rr.n = Rr.back = Rr.wide = 0; hitP.fill(999); hitG.attributes.position.needsUpdate = true; });

  function go(id: string) {
    Object.entries(boxes).forEach(([k, d]) => { d.style.display = k === id ? 'flex' : 'none'; });
    const g = groups[id], p = new THREE.Vector3(0, top + (id === 'era' ? 1.3 : 1), 0), c = new THREE.Vector3(0, top + 1.7, DIST[id] * (S.phone ? 1.45 : 1));
    g.localToWorld(p); g.localToWorld(c); S.flyTo(c, p, 2.4);
  }
  const ch = chips(S, [['era', t('c.era', 'Eratosthenes')], ['gal', t('c.gal', 'Galileo')], ['mil', t('c.mil', 'Millikan')], ['rut', t('c.rut', 'Rutherford')]], 'era', go);

  const home = { p: new THREE.Vector3(0, 6.5, 14), t: new THREE.Vector3(0, 1.2, -3) };
  if (S.phone) home.p.set(0, 9, 21);
  camera.position.set(0, 12, 26); controls.target.copy(home.t); S.setHome(home.p, home.t);
  controls.maxPolarAngle = Math.PI * .49; controls.maxDistance = 30; controls.minDistance = 1.2;
  eraUpdate(); galGeom(); newDrops();
  let acc = 0;
  S.onFrame((dt, tm) => {
    const k = ctx.calm ? .4 : 1;
    galStep(dt);
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.m.scale.setScalar(1 + f.t * 4); (f.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - f.t * 2); if (f.t > .5) { f.m.parent?.remove(f.m); flashes.splice(i, 1); } }
    for (const d of M.drops) { d.m.position.y = clamp(d.m.position.y + dropV(d) * dt * 2e4 * k, top + .42, top + 1.58); d.m.position.x += Math.sin(tm * 3 + d.r * 1e7) * dt * .004; }
    const sd = M.drops[M.sel]; if (sd) { selRing.position.copy(sd.m.position); selRing.lookAt(camera.position); }
    rutStep(dt * k);
    if ((acc += dt) > .25) { acc = 0; milInfo(); rInfo('n', String(Rr.n)); rInfo('wide', Rr.n ? `${(Rr.wide / Rr.n * 100).toFixed(1)}%` : '–'); rInfo('back', `${Rr.back}`); rInfo('d0', `${closest(79, Rr.MeV).toFixed(0)} fm`); }
  });
  S.pick(() => [globe, ramp, p1, p2, foil, ...M.drops.map((d) => d.m)], (hit) => {
    const o = hit.object;
    const di = M.drops.findIndex((d) => d.m === o); if (di >= 0) { M.sel = di; milInfo(); return; }
    const id = o === globe ? 'era' : o === ramp ? 'gal' : o === p1 || o === p2 ? 'mil' : o === foil ? 'rut' : '';
    if (id) { ch.set(id); go(id); }
  });
  boxes.era.style.display = 'flex';
  S.flyTo(home.p, home.t, 3.2);
  S.start();
}
