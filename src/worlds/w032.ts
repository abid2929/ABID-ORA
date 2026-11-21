/* 020 · Mountain World (site world 032). A whole mountain range in 3D, grown from fractal noise and
   carved by thousands of simulated raindrops (the hydraulic erosion of world 032), at true scale:
   8 × 8 km, valleys at 400 m, summits above 3,000 m. The snow line comes from the standard lapse
   rate (6.5 °C per km) and your valley temperature, so warming the valley really pulls the snow up
   the slopes; the tree line follows the same physics. Tap the mountains to plan a hike: the route is
   draped over the real terrain and you get distance, climb, walking time (Naismith's rule with
   Langmuir's descent corrections) and the coldest point. Then fly the route like a drone. */
import type { Ctx } from './kit';
import { makeTerrain, hikeHours, tempAt } from './w032lab';
import { THREE, stage, daylight, skyColors, sec, para, slider, stats, chips, btns, GLSL_NOISE, rng, clamp, noise2 } from './nskit';

const N = 128, SIZE = 8000, LOW = 400, HIGH = 3200, K = .1; /* 1 scene unit = 10 m */

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 20 · Nature'), title: t('title', 'Mountain World'), sub: t('sub', 'Peaks carved by rain, a snow line set by physics. Tap the slopes to plan a real hike.'),
    acc: '#f2c38b', ink: '#0b0d12', hf: "'Cormorant Garamond'", fov: 42, near: 1, far: 9000,
    lab: () => import('./w032lab'), labName: t('lab', 'Route Planner (map view)'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.toneMappingExposure = .82;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const P = { seed: 4, rugged: 1, erosion: 30, t0: 14, sun: 24, az: 235 };

  const day = daylight(S, { elev: P.sun, azim: P.az, size: 7000, ground: 0x2a2c30 });
  const sunL = new THREE.DirectionalLight(0xfff1dc, 3.4); sunL.castShadow = true;
  sunL.shadow.mapSize.set(S.phone ? 2048 : 4096, S.phone ? 2048 : 4096);
  Object.assign(sunL.shadow.camera, { left: -480, right: 480, top: 480, bottom: -480, near: 10, far: 2400 }); sunL.shadow.bias = -.0004; sunL.shadow.normalBias = .6;
  scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x3a3226, .55); scene.add(hemi);
  scene.fog = new THREE.Fog(0xaec3d6, 900, 3800);

  /* ---- terrain ---- */
  const SEG = S.phone ? 320 : 448, half = SIZE * K / 2;
  let Hm = makeTerrain(P.seed, P.rugged, P.erosion * 1000);
  const detail = noise2(77);
  /* bicubic sample of the 128² erosion grid, in metres */
  function hRaw(fx: number, fy: number) {
    const x = clamp(fx, 0, N - 1.001), y = clamp(fy, 0, N - 1.001), X = Math.floor(x), Y = Math.floor(y), u = x - X, v = y - Y;
    const g = (i: number, j: number) => Hm[clamp(j, 0, N - 1) * N + clamp(i, 0, N - 1)];
    const cub = (p0: number, p1: number, p2: number, p3: number, s: number) => p1 + .5 * s * (p2 - p0 + s * (2 * p0 - 5 * p1 + 4 * p2 - p3 + s * (3 * (p1 - p2) + p3 - p0)));
    const r = [-1, 0, 1, 2].map((j) => cub(g(X - 1, Y + j), g(X, Y + j), g(X + 1, Y + j), g(X + 2, Y + j), u));
    return cub(r[0], r[1], r[2], r[3], v);
  }
  /* metres at scene x,z, with fine rock detail on top of the eroded shape */
  function elev(x: number, z: number) {
    const fx = (x + half) / (SIZE * K) * (N - 1), fy = (z + half) / (SIZE * K) * (N - 1);
    const ed = Math.min(fx, fy, N - 1 - fx, N - 1 - fy) / (N * .14), e = clamp(ed, 0, 1), es = e * e * (3 - 2 * e);
    const base = (LOW + 140) + (hRaw(fx, fy) - (LOW + 140)) * es, f = clamp((base - LOW) / (HIGH - LOW), 0, 1);
    return base + (detail(x * .045, z * .045) * 22 + detail(x * .15, z * .15) * 6) * (.3 + f);
  }
  const geo = new THREE.PlaneGeometry(SIZE * K, SIZE * K, SEG, SEG); geo.rotateX(-Math.PI / 2);
  function shape() {
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setY(i, elev(p.getX(i), p.getZ(i)) * K);
    p.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  }
  shape();
  const tu = { uSnow: { value: 2200 }, uTree: { value: 1700 }, uK: { value: K } };
  const mat = new THREE.MeshStandardMaterial({ roughness: .95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, tu);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; varying vec3 vWN;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz; vWN=normalize(mat3(modelMatrix)*objectNormal);');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uSnow; uniform float uTree; uniform float uK; varying vec3 vW; varying vec3 vWN;
${GLSL_NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
  float z=vW.y/uK; float slope=1.-normalize(vWN).y; float n=fbm(vW*.02); float n2=snoise(vW*.25)*.5+.5; float n3=snoise(vW*1.3)*.5+.5;
  vec3 grass=mix(vec3(.13,.19,.07),vec3(.25,.27,.11),n2);
  vec3 forest=mix(vec3(.07,.12,.06),vec3(.12,.17,.08),n3);
  vec3 scree=mix(vec3(.36,.34,.31),vec3(.5,.47,.42),n3);
  vec3 rock=mix(vec3(.24,.22,.21),vec3(.42,.39,.35),n2*.7+n3*.3);
  rock*=.8+.4*snoise(vec3(vW.x*.06,vW.y*.6,vW.z*.06));
  vec3 c=mix(grass,forest,smoothstep(.0,.25,n*.5+.5-.45)*(1.-smoothstep(uTree-150.,uTree+80.,z+n*120.)));
  c=mix(c,scree,smoothstep(uTree,uTree+500.,z+n*200.));
  c=mix(c,rock,smoothstep(.28,.5,slope+n*.08));
  float snowLine=uSnow+n*220.;
  float snow=smoothstep(snowLine-40.,snowLine+60.,z)*(1.-smoothstep(.45,.7,slope+n3*.1));
  snow=max(snow,smoothstep(snowLine+450.,snowLine+700.,z)*(1.-smoothstep(.62,.85,slope)));
  c=mix(c,vec3(.93,.95,1.),snow);
  diffuseColor.rgb=c;`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.95,.55,snow);');
  };
  const land = new THREE.Mesh(geo, mat); land.receiveShadow = land.castShadow = true; scene.add(land);
  const skirtM = new THREE.MeshStandardMaterial({ color: 0x1d2a14, roughness: 1 });
  const sh2 = new THREE.Shape([new THREE.Vector2(-4500, -4500), new THREE.Vector2(4500, -4500), new THREE.Vector2(4500, 4500), new THREE.Vector2(-4500, 4500)]);
  sh2.holes.push(new THREE.Path([new THREE.Vector2(-half + 1, -half + 1), new THREE.Vector2(-half + 1, half - 1), new THREE.Vector2(half - 1, half - 1), new THREE.Vector2(half - 1, -half + 1)]));
  const skirt = new THREE.Mesh(new THREE.ShapeGeometry(sh2), mat); skirt.receiveShadow = true; skirt.rotation.x = -Math.PI / 2; skirt.position.y = (LOW + 140) * K - .5; scene.add(skirt);

  /* lakes fill the lowest valleys */
  const lake = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * K * .99, SIZE * K * .99), new THREE.MeshPhysicalMaterial({ color: 0x0d2f3a, roughness: .06, metalness: 0 }));
  lake.rotation.x = -Math.PI / 2; lake.position.y = (LOW + 60) * K; scene.add(lake);

  /* conifers below the tree line */
  const treeG = (() => {
    const c1 = new THREE.ConeGeometry(1.6, 4.2, 7); c1.translate(0, 3.6, 0);
    const c2 = new THREE.ConeGeometry(1.25, 3.4, 7); c2.translate(0, 5.4, 0);
    const tr = new THREE.CylinderGeometry(.2, .28, 2, 5); tr.translate(0, 1, 0);
    const g = new THREE.BufferGeometry(); const parts = [c1, c2, tr].map((x) => x.toNonIndexed());
    const pos: number[] = [], col: number[] = [];
    parts.forEach((p, k) => { const a = p.attributes.position.array; for (let i = 0; i < a.length; i++) pos.push(a[i]); for (let i = 0; i < a.length / 3; i++) if (k < 2) col.push(.06, .12 + k * .03, .06); else col.push(.22, .15, .1); });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  })();
  const TN = S.phone ? 5000 : 10000;
  const trees = new THREE.InstancedMesh(treeG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9 }), TN); trees.castShadow = true; trees.receiveShadow = true; scene.add(trees);
  function plantTrees() {
    const R = rng(P.seed * 13 + 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), n = new THREE.Vector3(); let c = 0, tries = 0;
    const tl = treeLine();
    while (c < TN && tries < TN * 12) {
      tries++;
      const x = (R() - .5) * SIZE * K * .98, z = (R() - .5) * SIZE * K * .98, h = elev(x, z);
      if (h < LOW + 75 || h > tl - R() * 250) continue;
      const e = 4, sx = (elev(x + e, z) - elev(x - e, z)) * K / (2 * e), sz = (elev(x, z + e) - elev(x, z - e)) * K / (2 * e);
      n.set(-sx, 1, -sz).normalize(); if (n.y < .8) continue;
      if (detail(x * .012 + 40, z * .012) < -.2) continue; /* clearings */
      const sc = .8 + R() * .8; q.setFromEuler(new THREE.Euler(0, R() * 6.28, 0));
      m4.compose(new THREE.Vector3(x, h * K - .3, z), q, new THREE.Vector3(sc, sc * (.9 + R() * .4), sc)); trees.setMatrixAt(c++, m4);
    }
    trees.count = c; trees.instanceMatrix.needsUpdate = true;
  }

  /* drifting cloud layers: fbm in a shader, soft edges */
  const cloudU = { uTime: { value: 0 } };
  const cloudM = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: cloudU, fog: false, side: THREE.DoubleSide,
    vertexShader: 'varying vec3 vW; void main(){ vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
    fragmentShader: `uniform float uTime; varying vec3 vW; ${GLSL_NOISE}
      void main(){ vec3 p=vec3(vW.xz*.0026+vec2(uTime*.004,uTime*.002),uTime*.01); float d=fbm(p)*.5+.5; float a=smoothstep(.55,.8,d);
        float r=length(vW.xz)/1500.; a*=1.-smoothstep(.55,1.,r);
        float lit=.8+.2*smoothstep(.5,.9,fbm(p+vec3(.04,0.,.03))*.5+.5);
        gl_FragColor=vec4(vec3(1.,.98,.95)*lit,a*.78);
        #include <colorspace_fragment>
      }`,
  });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), cloudM); clouds.rotation.x = -Math.PI / 2; clouds.position.y = 2400 * K; scene.add(clouds);

  /* ---- route ---- */
  const route: THREE.Vector3[] = [];
  const pinG = new THREE.SphereGeometry(2.2, 20, 14), pinM = new THREE.MeshStandardMaterial({ color: 0xf2c38b, emissive: 0x7a4a10, roughness: .4 });
  const pins = new THREE.Group(); scene.add(pins);
  let tube: THREE.Mesh | null = null;
  const tubeM = new THREE.MeshStandardMaterial({ color: 0xffb35c, emissive: 0xff7a1a, emissiveIntensity: .9, roughness: .5 });
  const info = stats(S.body, [['d', t('d', 'Distance')], ['up', t('up', 'Climb')], ['time', t('time', 'Walking time')], ['cold', t('cold', 'Coldest point')]], true);
  function draped() {
    const pts: THREE.Vector3[] = []; const segs: { d: number; dz: number }[] = []; let D = 0, up = 0, top = -1e9;
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1], b = route[i], len = Math.hypot(b.x - a.x, b.z - a.z) / K, n = Math.max(2, Math.ceil(len / 25));
      let prevZ = elev(a.x, a.z); if (i === 1) { pts.push(new THREE.Vector3(a.x, prevZ * K + 1.4, a.z)); top = prevZ; }
      for (let k = 1; k <= n; k++) {
        const s = k / n, x = a.x + (b.x - a.x) * s, z = a.z + (b.z - a.z) * s, h = elev(x, z);
        pts.push(new THREE.Vector3(x, h * K + 1.4, z)); segs.push({ d: len / n, dz: h - prevZ }); if (h > prevZ) up += h - prevZ; D += len / n; top = Math.max(top, h); prevZ = h;
      }
    }
    return { pts, segs, D, up, top };
  }
  function redraw() {
    pins.clear(); route.forEach((p) => { const m = new THREE.Mesh(pinG, pinM); m.position.copy(p).setY(elev(p.x, p.z) * K + 2.4); pins.add(m); });
    if (tube) { scene.remove(tube); tube.geometry.dispose(); tube = null; }
    if (route.length < 2) { info('d', '–'); info('up', '–'); info('time', '–'); info('cold', '–'); return; }
    const r = draped();
    tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(r.pts), r.pts.length * 2, 1.1, 8, false), tubeM); scene.add(tube);
    const hrs = hikeHours(r.segs), cold = tempAt(P.t0, LOW, r.top);
    info('d', `${(r.D / 1000).toFixed(1)} km`); info('up', `${Math.round(r.up)} m`); info('time', `${Math.floor(hrs)} h ${String(Math.round((hrs % 1) * 60)).padStart(2, '0')} min`); info('cold', `${cold.toFixed(1)} °C`);
    if (cold < 0) S.showHint(t('ice', 'Above the freezing level: expect snow and ice'));
  }
  S.pick(() => [land], (hit) => { if (route.length >= 12) route.shift(); route.push(hit.point.clone()); redraw(); });

  /* ---- panel ---- */
  const B = S.body;
  sec(B, t('s.route', 'Your hike'));
  para(B, t('p.route', 'Tap the mountains to drop waypoints. The path follows the real ground, and the time uses Naismith\'s rule: 5 km per hour plus one hour for every 600 m you climb.'));
  btns(B, [[t('b.fly', 'Fly the route'), () => flyRoute(), true], [t('b.undo', 'Undo'), () => { route.pop(); redraw(); }], [t('b.clear', 'Clear'), () => { route.length = 0; redraw(); }]]);
  sec(B, t('s.climate', 'Climate'));
  const snowOut = stats(B, [['snow', t('snow', 'Snow line')], ['tree', t('tree', 'Tree line')]]);
  slider(B, t('r.t0', 'Valley temperature (400 m)'), { min: -6, max: 30, step: 1, value: P.t0, fmt: (v) => v + ' °C' }, (v) => { P.t0 = v; climate(); });
  slider(B, t('r.sun', 'Time of day (sun height)'), { min: 2, max: 60, step: 1, value: P.sun, fmt: (v) => v + '°' }, (v) => { P.sun = v; setSun(); });
  sec(B, t('s.land', 'The range'));
  slider(B, t('r.rug', 'Ruggedness'), { min: .4, max: 1.6, step: .1, value: P.rugged, fmt: (v) => v.toFixed(1) }, (v) => { P.rugged = v; });
  slider(B, t('r.ero', 'Raindrops of erosion'), { min: 0, max: 60, step: 5, value: P.erosion, fmt: (v) => v + ' 000' }, (v) => { P.erosion = v; });
  btns(B, [[t('b.regen', 'Rebuild'), () => regen(P.seed)], [t('b.new', 'New range'), () => regen(P.seed + 1)]]);

  function treeLine() { return LOW + (P.t0 - 4) / 6.5 * 1000; }   /* simplified: forests stop near 4 °C below the valley-to-summit gradient */
  function snowLine() { return LOW + P.t0 / 6.5 * 1000; }          /* the 0 °C level from the valley reading */
  function climate() { tu.uSnow.value = snowLine(); tu.uTree.value = treeLine(); snowOut('snow', `${Math.round(snowLine())} m`); snowOut('tree', `${Math.max(LOW, Math.round(treeLine()))} m`); plantTrees(); redraw(); }
  function setSun() {
    day.set(P.sun, P.az); sunL.position.copy(day.sun).multiplyScalar(1200); sunL.target.position.set(0, 0, 0);
    const low = 1 - clamp(P.sun / 25, 0, 1); sunL.color.setRGB(1, .93 - low * .3, .85 - low * .45); sunL.intensity = 3.6 * clamp(P.sun / 8, .2, 1);
    (scene.fog as THREE.Fog).color.copy(skyColors(P.sun).hor);
  }
  function regen(seed: number) { P.seed = seed; Hm = makeTerrain(P.seed, P.rugged, P.erosion * 1000); shape(); route.length = 0; climate(); }

  /* drone flight along the planned route */
  let flying: ((dt: number) => void) | null = null;
  function flyRoute() {
    if (route.length < 2) { S.showHint(t('need', 'Tap at least two points on the mountains')); return; }
    const r = draped(), curve = new THREE.CatmullRomCurve3(r.pts.map((p) => p.clone().setY(p.y + 22)));
    let k = 0; const dur = clamp(curve.getLength() / 60, 6, 28);
    controls.enabled = false; S.setOpen(false);
    flying = (dt: number) => {
      k += dt / dur;
      const p = curve.getPointAt(Math.min(k, 1)), ahead = curve.getPointAt(Math.min(k + .04, 1));
      camera.position.lerp(p.clone().add(new THREE.Vector3(0, 10, 0)), .15); controls.target.lerp(ahead.setY(ahead.y - 14), .15);
      if (k >= 1) { controls.enabled = true; flying = null; }
    };
  }

  const home = { p: new THREE.Vector3(-520, 330, 620), t: new THREE.Vector3(30, 120, -20) };
  chips(S, [['range', t('c.range', 'The range')], ['summit', t('c.summit', 'Highest summit')], ['valley', t('c.valley', 'Lake valley')], ['top', t('c.top', 'Map view')]], 'range', (v) => {
    flying = null; controls.enabled = true;
    if (v === 'range') S.flyTo(home.p, home.t, 2.4);
    if (v === 'top') S.flyTo(new THREE.Vector3(0, 1100, 30), new THREE.Vector3(0, 0, 0), 2.4);
    if (v === 'summit' || v === 'valley') {
      const best = new THREE.Vector3(); let bz = v === 'summit' ? -1 : 1e9;
      for (let j = 8; j < N - 8; j += 2) for (let i = 8; i < N - 8; i += 2) { const z = Hm[j * N + i]; if (v === 'summit' ? z > bz : z < bz) { bz = z; best.set((i / (N - 1) - .5) * SIZE * K, z * K, (j / (N - 1) - .5) * SIZE * K); } }
      const dir = new THREE.Vector3(best.x, 0, best.z).normalize(); if (!isFinite(dir.x) || dir.lengthSq() < .5) dir.set(1, 0, 0);
      const cam = best.clone().add(dir.multiplyScalar((v === 'summit' ? 150 : 190) * (S.phone ? 1.5 : 1))).add(new THREE.Vector3(0, v === 'summit' ? 50 : 70, 0));
      S.flyTo(cam, best, 2.6);
      S.showCard(v === 'summit' ? t('k.sum', 'Summit') : t('k.val', 'Valley'), `${Math.round(bz)} m · ${tempAt(P.t0, LOW, bz).toFixed(1)} °C ${t('k.air', 'air temperature')}`);
    }
  });

  camera.position.set(-900, 700, 1200); controls.target.copy(home.t); S.setHome(home.p, home.t);
  controls.maxPolarAngle = Math.PI * .47; controls.maxDistance = 2200; controls.minDistance = 20;
  setSun(); climate();
  S.onFrame((dt, tm) => {
    cloudU.uTime.value = tm * (ctx.calm ? .3 : 1);
    if (flying) flying(dt);
    const g = elev(camera.position.x, camera.position.z) * K + 6; if (camera.position.y < g) camera.position.y = g;
  });
  S.flyTo(home.p, home.t, 3.5);
  S.start();
}
