/* Watches world, 3D boutique: the procedural automatic watch from the approved previews (every part is geometry),
   keeping real time in any time zone, with today's date, a sweeping seconds hand at 8 beats a second and a moving
   movement behind the sapphire caseback. Choose dial, case metal and strap, open the watch layer by layer, and turn
   it to see the crown, the date and the rotor. Built in millimetres, shown at 1 mm = 5 scene mm. */
import { show3d, floor, THREE } from './show3d';
import { buildWatch, materials, strapCurve, bandGeo, leatherMaps, RoundedBoxGeometry } from './watchkit';
import { h, type Ctx } from './kit';

const K = .005;
const ZONES: [string, string][] = [['', 'Local time'], ['Asia/Dhaka', 'Dhaka'], ['Europe/London', 'London'], ['America/New_York', 'New York'], ['Asia/Tokyo', 'Tokyo'], ['Asia/Dubai', 'Dubai'], ['Europe/Paris', 'Paris']];
const DIALS: [string, string][] = [['#0f1f47', 'Midnight blue'], ['#0b0b0d', 'Onyx'], ['#14382c', 'Racing green'], ['#d9dde3', 'Ice'], ['#7a2b2b', 'Oxblood'], ['#c9a46b', 'Champagne']];
const STRAPS: [string, string][] = [['#141416', 'Black'], ['#5a2f1a', 'Cognac'], ['#2b3550', 'Navy'], ['#3d4a33', 'Olive'], ['#c9b79a', 'Sand']];
const LIGHTS: Record<string, { exp: number; env: number; ki: number; bg: number }> = {
  noir: { exp: 1.05, env: 1.15, ki: 2.1, bg: 0x050506 }, salon: { exp: 1.12, env: 1.3, ki: 1.9, bg: 0x17130f }, gallery: { exp: 1.02, env: 1.5, ki: 1.7, bg: 0xdedbd6 },
};

export function watchShow(ctx: Ctx) {
  const t = ctx.t;
  const S = show3d(ctx, { bg: '#060607', acc: '#c9a96a', hint: t('w3.hint', 'Drag to turn · pinch, Ctrl + scroll or + / − to zoom · the watch shows the real time') });
  const { scene, renderer, key } = S;
  /* 0.9.13 premium look: a dark photo-studio environment with long soft-box strips, so steel and gold show crisp
     highlights against deep shadow (like a watch catalogue), instead of the flat grey room */
  { const E = new THREE.Scene(); E.background = new THREE.Color(0x030304);
    const strip = (w: number, hgt: number, x: number, y: number, z: number, c: [number, number, number]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); E.add(m); };
    strip(9, 1.4, 0, 6, 1, [5, 5, 5]); strip(1.3, 7, -6, 1.5, 2.5, [3.2, 3.2, 3.4]); strip(1.3, 7, 6, 1.5, -2.5, [3.6, 3.2, 2.8]); strip(10, 3, 0, -1, -7, [.5, .42, .32]); strip(3, 3, 3, -2, 6, [.9, .9, 1]);
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(E, .015).texture; pm.dispose(); }
  const warm = new THREE.SpotLight(0xfff1de, 1.1, 0, .5, .8); warm.position.set(-.5, .9, .7); scene.add(warm, warm.target);
  /* the neutral room environment from the showroom keeps steel looking like steel */

  const M = materials(); const W: any = buildWatch(M);
  const rig = new THREE.Group(); rig.rotation.x = Math.PI / 2 - .2; rig.scale.setScalar(K); scene.add(rig); rig.add(W.group);
  const curve = strapCurve();
  const strapM = new THREE.MeshPhysicalMaterial({ roughness: .5, clearcoat: .35, clearcoatRoughness: .5, sheen: .4, sheenColor: new THREE.Color(0x30303a) });
  const setStrap = (c: string) => { const lm = leatherMaps(c); strapM.map?.dispose(); strapM.map = lm.map; strapM.normalMap = lm.normalMap; strapM.normalScale.set(.7, .7); strapM.needsUpdate = true; };
  setStrap(STRAPS[0][0]);
  const strap = new THREE.Mesh(bandGeo(curve, 20.4, 3.4), strapM); strap.castShadow = strap.receiveShadow = true; rig.add(strap);
  const stitches: THREE.Mesh[] = [];
  const stitchM = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: .8 });
  for (const sx of [-8.6, 8.6]) { const pts = curve.getSpacedPoints(200).map((p: THREE.Vector3) => p.clone()); const T = new THREE.Vector3(), N = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);
    pts.forEach((p: THREE.Vector3, i: number) => { curve.getTangentAt(i / 200, T); N.crossVectors(X, T).normalize(); p.x += sx; p.addScaledVector(N, 1.72); });
    const sm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, .22, 5), stitchM); stitches.push(sm); rig.add(sm); }
  const velvet = new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: .95, sheen: 1, sheenColor: new THREE.Color(0x4a4a55), sheenRoughness: .45 });
  const pillow = new THREE.Mesh(new RoundedBoxGeometry(30, 24, 40, 6, 9), velvet); pillow.position.y = -18; pillow.castShadow = pillow.receiveShadow = true; rig.add(pillow);
  rig.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rig); rig.position.y = -box.min.y; rig.updateMatrixWorld(true);
  floor(S, 0, 3, '#c9a96a');

  /* open the watch: each part slides out along the watch's own axis */
  const P = W.parts as Record<string, THREE.Object3D>; const base = new Map<THREE.Object3D, number>();
  const LAYER: [string, number][] = [['crystal', 4], ['hands', 3], ['bezel', 2.2], ['dial', 1.4], ['case', 0], ['crown', 0], ['movement', -1.6], ['back', -2.8]];
  for (const [k] of LAYER) if (P[k]) base.set(P[k], P[k].position.y);
  let open = 0;
  const baseRot = P.bezel ? P.bezel.rotation.y : 0;
  const ease = (x: number) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  /* each layer starts a moment after the one above it, so the watch opens like a slow-motion catalogue shot */
  const explode = (v: number) => { open = v; LAYER.forEach(([k, d], i) => { if (!P[k]) return; const st = Math.abs(d) > 0 ? i * .06 : 0; const e = ease((v - st) / (1 - .42 + st * 0)); P[k].position.y = base.get(P[k])! + d * 8.5 * e; });
    if (P.bezel) P.bezel.rotation.y = baseRot + ease(v) * .9; strap.visible = pillow.visible = v < .05; stitches.forEach((m) => { m.visible = v < .05; }); S.stage.classList.toggle('w3open', v > .05); };
  let openT = 0; let anim: { a: number; b: number; t0: number } | null = null;

  const g = new THREE.Vector3(), q = new THREE.Quaternion(), tilt = new THREE.Vector2(); const zone = W.zone as { tz?: string };
  const clock = h('b', { style: { display: 'block', font: '300 34px/1.1 var(--serif, Georgia, serif)', color: '#ece6dc', fontVariantNumeric: 'tabular-nums', margin: '2px 0 4px' } });
  let lastS = '';
  S.onTick((dt) => {
    W.group.getWorldQuaternion(q); g.set(0, -1, 0).applyQuaternion(q.invert()); tilt.set(g.x, g.z);
    W.update(Date.now(), dt, tilt);
    if (anim) { const k = Math.min(1, (performance.now() - anim.t0) / (ctx.calm ? 1 : 1700)); const nv = anim.a + (anim.b - anim.a) * k; explode(nv); rng.value = String(Math.round(nv * 100)); if (k >= 1) anim = null; }
    const s = new Intl.DateTimeFormat('en-GB', { timeZone: zone.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date());
    if (s !== lastS) { clock.textContent = s; lastS = s; }
  });

  function setLight(n: string) { const L = LIGHTS[n]; renderer.toneMappingExposure = L.exp; scene.environmentIntensity = L.env; key.intensity = L.ki; (scene.background as THREE.Color).set(L.bg); }

  const gT = S.group(t('w3.time', 'Time on the dial')); const gD = S.group(t('w3.dial', 'Dial')); const gC = S.group(t('w3.case', 'Case'));
  const gS = S.group(t('w3.strap', 'Strap')); const gO = S.group(t('w3.open', 'Open the watch')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  gT.append(clock);
  const sel = h('select', { 'aria-label': t('w3.zone', 'Time zone'), style: { width: '100%', padding: '10px', borderRadius: '10px', background: 'rgba(0,0,0,.3)', color: '#ece6dc', border: '1px solid rgba(236,230,220,.2)', font: '500 14px var(--sans,sans-serif)' } }) as HTMLSelectElement;
  for (const [v, l] of ZONES) sel.append(h('option', { value: v, text: t('tz.' + (v || 'local'), l) }));
  sel.onchange = () => { zone.tz = sel.value || undefined; }; gT.append(sel);
  S.swatches(gD, DIALS.map(([c, l]) => [c, c, t('d.' + l, l)]), DIALS[0][0], (v) => W.setDial(v));
  S.chips(gC, [['steel', t('m.steel', 'Steel')], ['gold', t('m.yellow', 'Yellow gold')], ['rose', t('m.rose', 'Rose gold')]], 'steel', (v) => W.setCase(v));
  S.swatches(gS, STRAPS.map(([c, l]) => [c, c, t('s.' + l, l)]), STRAPS[0][0], (v) => setStrap(v));
  const rng = h('input', { type: 'range', min: '0', max: '100', value: '0', 'aria-label': t('w3.open', 'Open the watch'), style: { width: '100%', accentColor: '#c9a96a', height: '32px' } }) as HTMLInputElement;
  rng.oninput = () => { anim = null; openT = +rng.value / 100; explode(openT); syncOpen(); }; gO.append(rng, h('p', { class: 's3-note', text: t('w3.opent', 'Slide to lift off the crystal, hands, bezel and dial, and drop the movement and caseback: 8 real layers.') }));
  const setV = S.chips(gV, [['3/4', '3/4'], ['dial', t('vw.dial', 'Dial close-up')], ['crown', t('vw.crown', 'Crown side')], ['back', t('vw.caseback', 'Caseback')], ['wide', t('vw.wide', 'Wide')]], '3/4', (v) => { vbs?.forEach((x, i) => x.setAttribute('aria-pressed', String(VB[i][0] === v))); S.go(v); });
  S.chips(gL, [['noir', t('l.noir', 'Noir')], ['salon', t('l.salon', 'Salon')], ['gallery', t('l.gallery', 'White gallery')]], 'noir', setLight);
  S.rail.append(h('p', { class: 's3-note', text: t('w3.credit2', 'An original Abidora watch, built part by part in code. It shows your real time and today’s date.') }));

  /* big buttons on the 3D view (phone and computer): the main views, and one tap to open or close the watch */
  if (!document.getElementById('w3css')) { const st = document.createElement('style'); st.id = 'w3css'; st.textContent = '.w3open .s3-spot{display:none!important}.s3-vw .w3o{background:#c9a96a;color:#111;font-weight:600}.s3-vw .w3o[aria-pressed=true]{background:#ece6dc}@media (max-width:420px){.s3-vw{max-width:calc(100% - 16px);overflow-x:auto;scrollbar-width:none}.s3-vw button{padding:9px 10px;flex:none}}'; document.head.append(st); }
  const vw = h('div', { class: 's3-vw' }); const VB: [string, string][] = [['3/4', '3/4'], ['dial', t('w3.dial', 'Dial')], ['crown', t('w3.s1', 'Crown')], ['back', t('vw.caseback', 'Caseback')]];
  const vbs = VB.map(([v, l]) => { const b = h('button', { type: 'button', text: l, 'aria-pressed': String(v === '3/4') }); b.onclick = () => { vbs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); setV(v); S.go(v); }; vw.append(b); return b; });
  const ob = h('button', { type: 'button', class: 'w3o', 'aria-pressed': 'false', text: t('w3.op', 'Open') }); vw.append(ob);
  function syncOpen() { const on = openT > .5; ob.setAttribute('aria-pressed', String(on)); ob.textContent = on ? t('w3.cl', 'Close') : t('w3.op', 'Open'); }
  ob.onclick = () => { openT = openT > .5 ? 0 : 1; anim = { a: open, b: openT, t0: performance.now() }; syncOpen(); S.go(openT ? 'open' : '3/4'); vbs.forEach((x, i) => x.setAttribute('aria-pressed', String(!openT && i === 0))); };
  S.stage.append(vw);
  setLight('noir'); explode(0);
  key.target = rig; key.position.set(.6, 1.4, 1); key.shadow.camera.left = key.shadow.camera.bottom = -.3; key.shadow.camera.right = key.shadow.camera.top = .3; key.shadow.camera.updateProjectionMatrix();
  const c = new THREE.Box3().setFromObject(W.group).getCenter(new THREE.Vector3());
  S.frame(c, [{ name: '3/4', pos: [.36, .2, .72] }, { name: 'dial', pos: [.05, .1, .46] }, { name: 'crown', pos: [.7, .06, .14] }, { name: 'back', pos: [-.16, .4, -.7] }, { name: 'wide', pos: [.7, .4, 1.25] }, { name: 'open', pos: [1.05, .3, .55] }]);
  /* hotspots on the closed watch */
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyMatrix4(W.group.matrixWorld);
  rig.updateMatrixWorld(true);
  S.spots([
    { label: t('w3.s1', 'Crown'), text: t('w3.s1t', 'Knurled with 36 grips so it can be turned with a fingertip to set the time.'), at: at(23.5, -.2, 0) },
    { label: t('w3.s2', 'Date'), text: t('w3.s2t', 'Today’s real date, in a polished frame at 3 o’clock.'), at: at(11.4, 2.5, 0) },
    { label: t('w3.s3', 'Seconds hand'), text: t('w3.s3t', 'Moves in 8 small steps a second, like a 28,800 vibrations-per-hour automatic movement.'), at: at(0, 4.2, -9) },
  ]);
  S.setLoading(null);
  void open;
}
