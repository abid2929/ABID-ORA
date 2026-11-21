// @ts-nocheck
/* World 28 · Digital Art. A gallery hall where every painting is new. Ten works hang under their own lights,
   one per movement or tradition, each painted on your device by that movement's real method (pointillist dots
   of unmixed colour, De Stijl's balanced grid, drips thrown along an arc, eight-fold star patterns, Bengali alpona...).
   Walk the hall, step up to a work, read its wall label, repaint it, keep it in your own exhibition, download it. */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { THREE, OrbitControls, loadGLB, on, renderer, panel, chips, buttons, note, toast, walkInput, lookInput, loop, fit, el, tween,
  cv, tex, noise2, fbm, clamp, lerp, store, download, panelEnv, TAU } from './akit';
import { GENS, rng as mrng } from './gens';

const ROOMS = [
  { id: 'point', name: 'Pointillism', year: '1886', ar: 1.3, gen: 'pointillism', label: 'Georges Seurat and Paul Signac painted with small dots of pure colour placed side by side, trusting the viewer’s eye to mix them. This scene was planned in flat colours, then rebuilt from eight unmixed paints.' },
  { id: 'stijl', name: 'De Stijl', year: '1917', ar: 1, gen: 'deStijl', label: 'The Dutch De Stijl group reduced painting to straight lines, right angles and the three primaries plus black, white and grey. The canvas is split again and again at uneven points until it balances.' },
  { id: 'supr', name: 'Suprematism', year: '1915', ar: .8, gen: 'suprematism', label: 'Kazimir Malevich wanted “the supremacy of pure feeling”: flat geometric forms floating on a white ground, tilted along one shared direction so they seem to drift in space.' },
  { id: 'op', name: 'Op Art', year: '1960s', ar: .8, gen: 'opArt', label: 'Bridget Riley and Victor Vasarely made still paintings that seem to move. Black and white bands bend smoothly around a hidden centre, and your eye supplies the motion.' },
  { id: 'field', name: 'Color Field', year: '1950s', ar: .78, gen: 'colorField', label: 'Painters such as Mark Rothko stacked large, soft-edged rectangles of related colour, thinly layered so they glow. The edges are feathered by many slightly shifted translucent coats.' },
  { id: 'drip', name: 'Action Painting', year: '1947', ar: 1.5, gen: 'drips', label: 'Jackson Pollock laid canvas on the floor and threw paint from sticks. The line thins where the hand moves fast and pools where it slows, which is how each stroke here is drawn.' },
  { id: 'girih', name: 'Islamic Geometry', year: '9th century on', ar: 1, gen: 'girih', label: 'Across the Islamic world, artisans built endless patterns from compass and ruler alone. Eight-pointed stars sit on a square grid; changing the contact angle changes the whole pattern.' },
  { id: 'alpona', name: 'Alpona', year: 'Bengal, centuries old', ar: 1, gen: 'alpona', label: 'Alpona is painted on floors and courtyards in Bengal with rice paste for festivals such as Pohela Boishakh. A central lotus grows outward in rings of petals, dots and creepers, white on red earth.' },
  { id: 'bauhaus', name: 'Bauhaus', year: '1919', ar: 1, gen: 'bauhaus', label: 'The Bauhaus school joined art and design through basic shapes and primary colours. Each square tile holds one quarter circle, circle, triangle or half circle, turned in steps of 90 degrees.' },
  { id: 'comp', name: 'Early Computer Art', year: '1965', ar: .72, gen: 'computerArt', label: 'Pioneers such as Georg Nees and Frieder Nake used plotters to draw rules, not pictures. Order turns into disorder row by row: each square is turned and shifted by an amount that grows down the page.' },
];
const HALL = { w: 9, l: 30, h: 5.2 };

function paint(i, seed, px = 1024) {
  const r = ROOMS[i], w = r.ar >= 1 ? px : Math.round(px * r.ar), hh = r.ar >= 1 ? Math.round(px / r.ar) : px;
  const [c, g] = cv(w, hh); GENS[r.gen](g, w, hh, mrng(seed)); return c;
}
function concreteFloor(seed) {
  const n = noise2(seed), W = 1024, [c, g] = cv(W); const im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const v = fbm(n, x / 120, y / 120, 5), sp = n(x / 2, y / 2) > .9 ? .9 : 1, p = (y * W + x) * 4, k = (118 + v * 46) * sp; im.data[p] = k; im.data[p + 1] = k * .99; im.data[p + 2] = k * .97; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0); g.strokeStyle = 'rgba(40,38,36,.5)'; g.lineWidth = 3; g.strokeRect(0, 0, W, W); return c;
}

export async function start(canvas, ui) {
  const R = renderer(canvas, { exposure: 1.12, tone: THREE.ACESFilmicToneMapping, keep: false });
  const phone = R.phone;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x111012);
  const cam = new THREE.PerspectiveCamera(phone ? 62 : 50, 1, .05, 120);
  fit(R, cam, canvas);
  scene.environment = panelEnv(R, [{ w: 6, h: 30, p: [0, 9, 0], i: 2.4, c: 0xfff6ea }, { w: 30, h: 4, p: [6, 2, 0], i: .35 }, { w: 30, h: 4, p: [-6, 2, 0], i: .35 }], 0x1a1816);
  scene.environmentIntensity = .5;

  /* hall: polished concrete floor, white walls, a long skylight */
  const fT = tex(concreteFloor(2)); fT.wrapS = fT.wrapT = THREE.RepeatWrapping; fT.repeat.set(HALL.w / 3, HALL.l / 3);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.l), new THREE.MeshPhysicalMaterial({ map: fT, roughness: .22, clearcoat: .6, clearcoatRoughness: .12 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallM = new THREE.MeshStandardMaterial({ color: 0xf1eee8, roughness: .95 });
  for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(HALL.l, HALL.h), wallM); w.position.set(sx * HALL.w / 2, HALL.h / 2, 0); w.rotation.y = -sx * Math.PI / 2; w.receiveShadow = true; scene.add(w); }
  for (const sz of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.h), new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: .9 })); w.position.set(0, HALL.h / 2, sz * HALL.l / 2); w.rotation.y = sz > 0 ? Math.PI : 0; w.material.color.set(0x8a3b2a); scene.add(w); }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL.w, HALL.l), new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 1, side: THREE.DoubleSide })); ceil.rotation.x = Math.PI / 2; ceil.position.y = HALL.h; scene.add(ceil);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, HALL.l - 2), new THREE.MeshBasicMaterial({ color: 0xfff8ee })); sky.rotation.x = Math.PI / 2; sky.position.y = HALL.h - .01; scene.add(sky);
  for (let k = -6; k <= 6; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.6, .12, .08), new THREE.MeshStandardMaterial({ color: 0x2a2826 })); b.position.set(0, HALL.h - .07, k * 2.2); scene.add(b); }
  /* skirting shadow gap */
  for (const sx of [-1, 1]) { const g = new THREE.Mesh(new THREE.BoxGeometry(.02, .05, HALL.l), new THREE.MeshBasicMaterial({ color: 0x181614 })); g.position.set(sx * (HALL.w / 2 - .01), .025, 0); scene.add(g); }
  scene.add(new THREE.HemisphereLight(0xfff7ec, 0x5a5048, .95));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2); key.position.set(1, 10, 2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 16, bottom: -16, near: 1, far: 20 }); scene.add(key);

  /* benches down the middle */
  const oakM = new THREE.MeshPhysicalMaterial({ color: 0x9a7552, roughness: .45, clearcoat: .3 }), steel = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: .8, roughness: .3 });
  for (const z of [-6, 6]) { const g = new THREE.Group(); const top = new THREE.Mesh(new RoundedBoxGeometry(.6, .06, 2.2, 3, .02), oakM); top.position.y = .45; top.castShadow = true; g.add(top);
    for (const sz of [-.9, .9]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.5, .42, .04), steel); l.position.set(0, .21, sz); l.castShadow = true; g.add(l); } g.position.z = z; scene.add(g); }
  /* a sculpture on a plinth at the far end: a polished torus knot */
  { const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 1, .8), new THREE.MeshStandardMaterial({ color: 0xf4f1eb, roughness: .8 })); p.position.set(0, .5, -HALL.l / 2 + 2); p.castShadow = p.receiveShadow = true; scene.add(p);
    /* the scanned bronze (Bronze Ray Statue by Console Art Cybernetic, Sketchfab); a gold knot stands in until it loads or if it cannot */
    const s = new THREE.Group(); s.position.set(0, 1, -HALL.l / 2 + 2); scene.add(s); scene.userData.sculpt = s;
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(.32, .1, 220, 32, 2, 3), new THREE.MeshPhysicalMaterial({ color: 0xd8b067, metalness: 1, roughness: .12 })); knot.position.y = .5; knot.castShadow = true; s.add(knot);
    loadGLB('statue.glb').then((m) => { if (!m) return; m.scale.setScalar(2.6); m.position.set(-.1, 0, .13); s.remove(knot); s.add(m);
      const lab = el('div', { class: 'credit', text: 'Bronze Ray Statue · scan by Console Art Cybernetic (Sketchfab)' }); ui.append(lab); });
    const sp = new THREE.SpotLight(0xfff2dc, 40, 9, .45, .6, 1.4); sp.position.set(0, HALL.h - .3, -HALL.l / 2 + 4); sp.target = s; scene.add(sp); }

  /* the works: frame, mat, canvas, a picture light and a wall label */
  const seeds = store('w28.seeds', null).get() || ROOMS.map((_, i) => (Date.now() + i * 7919) >>> 0);
  const frameMats = [new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: .35, clearcoat: .6 }), new THREE.MeshPhysicalMaterial({ color: 0xc9a25c, metalness: 1, roughness: .3 }), new THREE.MeshPhysicalMaterial({ color: 0x6b4a33, roughness: .5, clearcoat: .4 }), new THREE.MeshStandardMaterial({ color: 0xf2efe9, roughness: .7 })];
  const matM = new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: .95 });
  const works = ROOMS.map((r, i) => {
    const side = i < 5 ? -1 : 1, k = i < 5 ? i : i - 5, z = -11 + k * 5.5 + (side > 0 ? 1.2 : 0);
    const maxW = 2.3, maxH = 2.2; let w = maxW, h = w / r.ar; if (h > maxH) { h = maxH; w = h * r.ar; }
    const g = new THREE.Group(); g.position.set(side * (HALL.w / 2 - .02), 1.75, z); g.rotation.y = side * -Math.PI / 2; scene.add(g);
    const fm = frameMats[i % 4], ft = .07, mat = .18;
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w + 2 * mat + 2 * ft, h + 2 * mat + 2 * ft, .07, 2, .01), fm); frame.position.z = .035; frame.castShadow = true; g.add(frame);
    const mm = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * mat, h + 2 * mat, .02), matM); mm.position.z = .065; g.add(mm);
    const cm = new THREE.MeshStandardMaterial({ roughness: .78, map: tex(paint(i, seeds[i], phone ? 768 : 1024)) });
    const canvasM = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cm); canvasM.position.z = .077; g.add(canvasM);
    /* picture light: a brass bar with a downward spot */
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, w * .6, 16), frameMats[1]); bar.rotation.z = Math.PI / 2; bar.position.set(0, h / 2 + mat + .3, .22); g.add(bar);
    const sp = new THREE.SpotLight(0xffe9cc, 26, 6, .62, .55, 1.6); sp.position.set(0, h / 2 + 1.5, 1.3); g.add(sp); const tg = new THREE.Object3D(); tg.position.set(0, -.1, 0); g.add(tg); sp.target = tg;
    /* small wall label */
    const [lc, lg] = cv(512, 256); lg.fillStyle = '#fbfaf6'; lg.fillRect(0, 0, 512, 256); lg.fillStyle = '#1b1a18'; lg.font = '500 44px "Instrument Serif", Georgia, serif'; lg.fillText(r.name, 30, 82);
    lg.font = '400 24px "Inter Tight", sans-serif'; lg.fillStyle = '#6d675f'; lg.fillText(r.year + ' · method, painted live', 30, 132); lg.fillText('Abidora Digital Art · No. ' + String(i + 1).padStart(2, '0'), 30, 172);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(.36, .18), new THREE.MeshStandardMaterial({ map: tex(lc), roughness: .9 })); label.position.set(w / 2 + mat + ft + .4, -.5, .01); g.add(label);
    canvasM.userData.work = i; frame.userData.work = i;
    return { g, cm, canvasM, frame, w, h, side, z, sp };
  });

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 28 · Digital Art', title: 'Rooms of Technique', lede: 'A gallery where every painting is new: each one is painted on your device by a real art movement’s method. None is a copy of any real artwork.' });
  const sWork = P.section('The work');
  const lab = el('div', { class: 'c-n', style: { color: 'var(--ink)' } }); sWork.append(lab);
  buttons(sWork, [['Paint a new one', () => repaint(), true], ['Keep in my exhibition', () => keep()], ['Download', () => { const c = paint(cur, seeds[cur], 2000); download(`abidora-${ROOMS[cur].id}-${seeds[cur]}.png`, c.toDataURL('image/png')); }]]);
  buttons(sWork, [['← Previous', () => go((cur + 9) % 10)], ['Next →', () => go((cur + 1) % 10)]]);
  const sRooms = P.section('Rooms');
  const roomChips = chips(sRooms, null, ROOMS.map((r, i) => [String(i), r.name]), '0', (v) => go(+v), 'grid');
  const sMine = P.section('My exhibition');
  const favBox = el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '12px 0' } }); sMine.append(favBox);
  note(sMine, 'Saved works are kept as tiny recipes (movement and seed) in this browser only, so the same picture comes back each time.');
  const favStore = store('w28.favs', []); let favs = favStore.get().filter((f) => Array.isArray(f) && ROOMS.some((r) => r.id === f[0])).slice(0, 24);
  function renderFavs() {
    favBox.textContent = ''; if (!favs.length) { favBox.append(el('p', { class: 'c-n', text: 'Nothing kept yet.' })); return; }
    favs.forEach((f, k) => { const i = ROOMS.findIndex((r) => r.id === f[0]); const im = el('img', { src: paint(i, f[1], 120).toDataURL('image/jpeg', .8), alt: ROOMS[i].name, width: 56, height: 56, style: { width: '56px', height: '56px', objectFit: 'cover', borderRadius: '3px', cursor: 'pointer', border: '1px solid var(--line)' } });
      im.addEventListener('click', () => { seeds[i] = f[1]; retex(i); go(i); }); im.addEventListener('contextmenu', (e) => { e.preventDefault(); favs.splice(k, 1); favStore.set(favs); renderFavs(); }); favBox.append(im); });
  }
  function keep() { if (favs.some((f) => f[0] === ROOMS[cur].id && f[1] === seeds[cur])) { toast(ui, 'Already in your exhibition'); return; } favs.unshift([ROOMS[cur].id, seeds[cur]]); favs = favs.slice(0, 24); favStore.set(favs); renderFavs(); toast(ui, 'Kept in your exhibition'); }
  function retex(i) { const w = works[i]; w.cm.map.dispose(); w.cm.map = tex(paint(i, seeds[i], phone ? 768 : 1024)); w.cm.needsUpdate = true; store('w28.seeds', null).set(seeds); }
  function repaint() {
    seeds[cur] = (Math.random() * 2 ** 32) >>> 0; const w = works[cur], sp = w.sp, i0 = sp.intensity;
    tween(380, (k) => { sp.intensity = i0 * (1 - k); }, () => { retex(cur); tween(700, (k) => { sp.intensity = i0 * k; }); });
  }

  /* ---------- moving through the hall ---------- */
  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.enablePan = false; orbit.minDistance = .6; orbit.maxDistance = 5.5;
  orbit.enabled = false;
  const walk = walkInput(ui); walk.show(false); const look = lookInput(canvas, cam); look.on = false;
  let cur = 0, mode = 'view', stopFly = null;
  const fab = el('div', { class: 'fab' });
  const bView = el('button', { 'aria-pressed': 'true', text: 'Look closely', onclick: () => setMode('view') });
  const bWalk = el('button', { 'aria-pressed': 'false', text: 'Walk the hall', onclick: () => setMode('walk') });
  fab.append(bView, bWalk); ui.append(fab);
  const hint = el('div', { class: 'hint' }); ui.append(hint);
  function viewPose(i) { const w = works[i], d = phone ? 5.6 : 4.6, x = w.side * (HALL.w / 2 - d); return { p: new THREE.Vector3(x, 1.62, w.z + (phone ? .3 : 1.1)), t: new THREE.Vector3(w.side * (HALL.w / 2), 1.72, w.z) }; }
  function go(i) {
    cur = i; roomChips.set(String(i)); const r = ROOMS[i];
    lab.innerHTML = `<b style="font:400 24px var(--disp);display:block;margin-bottom:4px">${r.name}</b><span style="font:500 11px var(--mono);letter-spacing:.08em;color:var(--mute)">${r.year.toUpperCase()} · No. ${String(i + 1).padStart(2, '0')} · seed ${seeds[i]}</span><br><br>${r.label}`;
    if (mode === 'walk') setMode('view', true);
    const { p, t } = viewPose(i); stopFly?.(); const p0 = cam.position.clone(), t0 = orbit.target.clone();
    /* glide in an arc through the middle of the hall, never through a wall */
    const mid = new THREE.Vector3((p0.x + p.x) / 2 * .2, 1.75, (p0.z + p.z) / 2);
    stopFly = tween(1700, (k) => { const a = p0.clone().lerp(mid, k), b = mid.clone().lerp(p, k); cam.position.copy(a.lerp(b, k)); orbit.target.lerpVectors(t0, t, k); cam.lookAt(orbit.target); }, () => { stopFly = null; });
  }
  function setMode(m, quiet) {
    mode = m; bView.setAttribute('aria-pressed', String(m === 'view')); bWalk.setAttribute('aria-pressed', String(m === 'walk'));
    walk.show(m === 'walk'); look.on = m === 'walk'; orbit.enabled = m === 'view';
    hint.textContent = m === 'walk' ? (phone ? 'Thumb stick to walk · drag to look · tap a painting' : 'W A S D to walk · drag to look · click a painting') : (phone ? 'Drag to look around the work · tap another painting' : 'Drag to look around the work · click any painting');
    if (m === 'walk') { const e = new THREE.Euler().setFromQuaternion(cam.quaternion, 'YXZ'); look.yaw = e.y; look.pitch = e.x; if (phone) P.root.dataset.open = '0'; }
    if (!quiet && m === 'view') go(cur);
  }
  /* tap or click a painting to step up to it */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(); let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return; const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(works.flatMap((w) => [w.canvasM, w.frame]))[0]; if (h) { if (phone) P.show(0, false); go(h.object.userData.work); }
  });
  on(window, 'keydown', (e) => { if (mode === 'view' && e.key === 'ArrowRight') go((cur + 1) % 10); if (mode === 'view' && e.key === 'ArrowLeft') go((cur + 9) % 10); });

  renderFavs(); setMode('view', true);
  /* opening shot: from the end of the hall, then step up to the first work */
  cam.position.set(0, 1.7, HALL.l / 2 - 1); orbit.target.set(0, 1.7, 0); cam.lookAt(orbit.target);
  setTimeout(() => go(0), 1600);
  lab.textContent = 'Walking in…';

  const fwd = new THREE.Vector3(), right = new THREE.Vector3();
  loop((dt, t) => {
    if (mode === 'walk') {
      look.apply(); const v = walk.read(), sp = 2.4 * dt;
      fwd.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw)); right.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
      cam.position.x = clamp(cam.position.x + (fwd.x * v.y + right.x * v.x) * sp, -HALL.w / 2 + .5, HALL.w / 2 - .5);
      cam.position.z = clamp(cam.position.z + (fwd.z * v.y + right.z * v.x) * sp, -HALL.l / 2 + .6, HALL.l / 2 - .6); cam.position.y = 1.68;
    } else if (!stopFly) orbit.update();
    scene.userData.sculpt.rotation.y = t * .25;
    R.render(scene, cam); R.adapt();
  });
}
