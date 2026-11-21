// @ts-nocheck
/* World 27 · Future City. A night city you plan block by block: a 2.4 km grid of 100 m blocks.
   Paint homes, shops, offices, parks and transit stops; a breadth-first walk from every home measures the
   minutes to the nearest of each (80 m a minute), and the score is the share of homes that reach all four
   within the limit: the "15-minute city". Towers light their windows, maglev pods fly the avenues, and the
   heat view colours every home by its longest walk. */
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { THREE, on, OrbitControls, renderer, panel, range, chips, buttons, note, toast, loop, fit, el, tween, rng, clamp, lerp, store, download, TAU } from './akit';

const G = 24, CELL_M = 100, WALK = 80, C = 4; /* blocks per side, metres per block, metres per minute, scene units per block */
const Z = ['empty', 'home', 'shop', 'work', 'park', 'transit'];
const NAME = { empty: 'Clear', home: 'Homes', shop: 'Shops', work: 'Offices', park: 'Park', transit: 'Transit stop' };
const COL = { empty: '#28304a', home: '#ffb469', shop: '#ff5fd2', work: '#7fb6ff', park: '#4fe39b', transit: '#59f0ff' };
const NEED = ['shop', 'work', 'park', 'transit'];

export function walkMinutes(grid, target) {
  const d = new Int32Array(G * G).fill(-1), q = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === target) { d[i] = 0; q.push(i); }
  for (let h0 = 0; h0 < q.length; h0++) { const i = q[h0], x = i % G, y = (i / G) | 0; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; const j = ny * G + nx; if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } }
  return Array.from(d, (v) => (v < 0 ? Infinity : v * CELL_M / WALK));
}

/* towers light their own windows: the pattern is computed from world position, so every height gets
   whole floors and every face gets real window bays */
function windowMaterial(base, lit, opt = {}) {
  const m = new THREE.MeshStandardMaterial({ color: base, roughness: opt.rough ?? .35, metalness: opt.metal ?? .6 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uLit = { value: new THREE.Color(lit) }; sh.uniforms.uOn = { value: opt.on ?? .55 }; sh.uniforms.uFloor = { value: opt.floor ?? .32 }; sh.uniforms.uBay = { value: opt.bay ?? .34 }; sh.uniforms.uTime = { value: 0 };
    m.userData.sh = sh;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying vec3 vWN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 wp4 = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp4 = instanceMatrix * wp4;
        #endif
        vWP = (modelMatrix * wp4).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vWP; varying vec3 vWN; uniform vec3 uLit; uniform float uOn, uFloor, uBay, uTime;
        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float side = 1.0 - abs(vWN.y);
          float u = abs(vWN.x) > .5 ? vWP.z : vWP.x;
          vec2 cell = vec2(floor(u / uBay), floor(vWP.y / uFloor));
          vec2 f = vec2(fract(u / uBay), fract(vWP.y / uFloor));
          float win = step(.14, f.x) * step(f.x, .86) * step(.22, f.y) * step(f.y, .8);
          float aa = clamp(1.6 - max(fwidth(u / uBay), fwidth(vWP.y / uFloor)) * 2.2, 0., 1.); win = mix(.32, win, aa);
          float r = h21(cell + floor(vWP.xz * .07) * 17.0 + vec2(vWN.x * 3.0, vWN.z * 5.0));
          float on = step(1.0 - uOn, r) * step(.9, vWP.y);
          float flick = .75 + .25 * h21(cell + floor(uTime * .2 + r * 9.0));
          vec3 tint = mix(uLit, vec3(1.0, .93, .8), h21(cell * 1.7));
          totalEmissiveRadiance += tint * win * on * side * flick * 1.5; }`);
  };
  return m;
}

export async function start(canvas, ui) {
  const R = renderer(canvas, { exposure: 1, tone: THREE.ACESFilmicToneMapping });
  const phone = R.phone;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x05070f); scene.fog = new THREE.FogExp2(0x070a18, .0095);
  const cam = new THREE.PerspectiveCamera(phone ? 55 : 42, 1, .5, 900);
  const comp = new EffectComposer(R); comp.addPass(new RenderPass(scene, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), .55, .5, .82); comp.addPass(bloom); comp.addPass(new OutputPass());
  fit(R, cam, canvas, (w, h) => { comp.setPixelRatio(R.getPixelRatio()); comp.setSize(w, h); });

  const hemi = new THREE.HemisphereLight(0x3a4a8a, 0x0a0a12, .6); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x8fa8ff, .7); moon.position.set(-60, 90, -40); scene.add(moon);
  /* horizon glow and a starry dome */
  { const g = new THREE.SphereGeometry(600, 32, 16); const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {},
      vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `varying vec3 v; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
        void main(){ float y = max(v.y, 0.); vec3 c = mix(vec3(.16, .09, .28), vec3(.01, .015, .045), pow(y, .35)); c += vec3(.25, .12, .4) * exp(-y * 14.);
          vec3 q = floor(v * 420.); float s = step(.9975, h(q)) * smoothstep(.05, .3, y); c += vec3(s) * .9; gl_FragColor = vec4(c, 1.); }` });
    scene.add(new THREE.Mesh(g, m)); }

  const half = G * C / 2, cellPos = (i) => [(i % G) * C - half + C / 2, ((i / G) | 0) * C - half + C / 2];
  /* ground: blocks, glowing street grid */
  const groundM = new THREE.MeshStandardMaterial({ color: 0x0b0e1a, roughness: .25, metalness: .4 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundM); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  { const pts = []; for (let k = 0; k <= G; k++) { const v = k * C - half; pts.push(-half, .03, v, half, .03, v, v, .03, -half, v, .03, half); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x2c7fae, transparent: true, opacity: .55 }))); }
  /* each block's pavement tile, coloured in the heat view */
  const tileG = new THREE.BoxGeometry(C * .86, .08, C * .86); const tileM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6, metalness: .2 });
  const tiles = new THREE.InstancedMesh(tileG, tileM, G * G); scene.add(tiles);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < G * G; i++) { const [x, z] = cellPos(i); dummy.position.set(x, .04, z); dummy.scale.set(1, 1, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); tiles.setMatrixAt(i, dummy.matrix); tiles.setColorAt(i, col.set(0x161b2e)); }

  /* buildings by type; up to 4 pieces per block */
  const MAXP = G * G * 4;
  const mats = {
    home: windowMaterial(0x2a2a33, 0xffb062, { on: .36, floor: .3, bay: .3, metal: .3, rough: .6 }),
    work: windowMaterial(0x1b2537, 0x8cc8ff, { on: .5, floor: .36, bay: .26, metal: .85, rough: .18 }),
    shop: windowMaterial(0x2b1f2e, 0xff7ad9, { on: .8, floor: .45, bay: .5, metal: .4, rough: .4 }),
  };
  const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, .5, 0);
  const inst = Object.fromEntries(Object.entries(mats).map(([k, m]) => { const im = new THREE.InstancedMesh(box, m, MAXP); im.count = 0; scene.add(im); return [k, im]; }));
  /* crowns: neon strips on top of towers and around shops */
  const neonM = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const neon = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), neonM, MAXP); neon.count = 0; scene.add(neon);
  /* parks: lawns and round trees; transit: a glowing ring on a pylon */
  const lawn = new THREE.InstancedMesh(new THREE.BoxGeometry(C * .86, .14, C * .86), new THREE.MeshStandardMaterial({ color: 0x173f2b, roughness: .9, emissive: 0x0b3a22, emissiveIntensity: .5 }), G * G); lawn.count = 0; scene.add(lawn);
  const treeG = new THREE.IcosahedronGeometry(.42, 2); treeG.scale(1, 1.25, 1); treeG.translate(0, .8, 0);
  const trees = new THREE.InstancedMesh(treeG, new THREE.MeshStandardMaterial({ color: 0x2f7a4c, roughness: .8, emissive: 0x1d6b3d, emissiveIntensity: .35 }), G * G * 6); trees.count = 0; scene.add(trees);
  const ringG = new THREE.TorusGeometry(1.1, .09, 12, 48); ringG.rotateX(Math.PI / 2);
  const rings = new THREE.InstancedMesh(ringG, new THREE.MeshBasicMaterial({ color: 0x59f0ff, toneMapped: false }), G * G); rings.count = 0; scene.add(rings);
  const pylonG = new THREE.CylinderGeometry(.12, .2, 1, 12); pylonG.translate(0, .5, 0);
  const pylons = new THREE.InstancedMesh(pylonG, new THREE.MeshStandardMaterial({ color: 0x9fb3c8, metalness: .9, roughness: .25 }), G * G); pylons.count = 0; scene.add(pylons);

  /* state */
  const st = store('w27.city', '');
  const grid = new Uint8Array(G * G), hgt = new Float32Array(G * G);
  { const R0 = rng(11); for (let i = 0; i < hgt.length; i++) hgt[i] = R0(); }
  let tool = 'home', limit = 15, view = 'city', res = {};

  function rebuild() {
    for (const k in inst) inst[k].count = 0; neon.count = lawn.count = trees.count = rings.count = pylons.count = 0;
    const R0 = rng(5);
    const put = (im, x, y, z, sx, sy, sz, c, ry = 0) => { dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); im.setMatrixAt(im.count, dummy.matrix); if (c != null) im.setColorAt(im.count, col.set(c)); im.count++; };
    /* density rises towards the centre of town, like land value does */
    for (let i = 0; i < grid.length; i++) {
      const z = Z[grid[i]], [x, y] = cellPos(i), r = Math.hypot(x, y) / half, core = clamp(1.2 - r, .25, 1), h = hgt[i];
      if (z === 'home') {
        const n = h > .5 ? 2 : 1;
        for (let k = 0; k < n; k++) { const ox = n === 2 ? (k ? .8 : -.8) : 0, ht = 1.2 + (h * 3 + R0() * 2.5) * core * core; put(inst.home, x + ox, .08, y + (k ? .6 : -.4) * (n - 1), n === 2 ? 1.4 : 2.6, ht, n === 2 ? 2.4 : 2.6, null);
          if (h > .7) put(neon, x + ox, .08 + ht, y, n === 2 ? 1.42 : 2.62, .05, .05, 0xffb469); }
      } else if (z === 'work') {
        const ht = 3 + (h * 16 + R0() * 6) * core * core * core; put(inst.work, x, .08, y, 2.4, ht, 2.4, null);
        if (ht > 9) { put(inst.work, x, .08 + ht, y, 1.5, ht * .18, 1.5, null); put(neon, x, .08 + ht * 1.18, y, .06, 1.6, .06, 0xff4060); }
        for (const [dx, dz, sx, sz] of [[0, 1.22, 2.44, .06], [0, -1.22, 2.44, .06], [1.22, 0, .06, 2.44], [-1.22, 0, .06, 2.44]]) put(neon, x + dx, .08 + ht, y + dz, sx, .06, sz, 0x7fb6ff);
      } else if (z === 'shop') {
        put(inst.shop, x, .08, y, 3.2, .9 + h * .9, 3.2, null); put(neon, x, .7 + h * .6, y + 1.62, 3.0, .12, .04, 0xff5fd2); put(neon, x + 1.62, .7 + h * .6, y, .04, .12, 3.0, 0xffd36e);
      } else if (z === 'park') {
        put(lawn, x, .07, y, 1, 1, 1, null); const nt = 4 + Math.floor(h * 3); for (let k = 0; k < nt; k++) { const s = .7 + R0() * .7; put(trees, x + (R0() - .5) * 2.8, .14, y + (R0() - .5) * 2.8, s, s, s, null); }
      } else if (z === 'transit') {
        put(pylons, x, .08, y, 1, 2.2, 1, null); put(rings, x, 2.4, y, 1, 1, 1, null); put(neon, x, .1, y, 3.2, .03, .2, 0x59f0ff); put(neon, x, .1, y, .2, .03, 3.2, 0x59f0ff);
      }
    }
    for (const im of [...Object.values(inst), neon, lawn, trees, rings, pylons]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    compute();
  }

  function compute() {
    for (const z of NEED) res[z] = walkMinutes(grid, Z.indexOf(z));
    let homes = 0, good = 0, worst = 0, parks = 0;
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] === 4) parks++;
      const m = Math.max(...NEED.map((z) => res[z][i]));
      if (grid[i] === 1) { homes++; worst = Math.max(worst, m); if (m <= limit) good++; }
      /* tile colour: in the heat view homes go green (all close) to red (far) */
      if (view === 'heat') { const k = Number.isFinite(m) ? clamp(m / (limit * 2), 0, 1) : 1; tiles.setColorAt(i, grid[i] === 1 ? col.setHSL((150 - k * 150) / 360, .85, .42) : col.set(0x12162a)); }
      else tiles.setColorAt(i, col.set(grid[i] === 4 ? 0x10301f : 0x161b2e));
    }
    tiles.instanceColor.needsUpdate = true;
    sv.score.textContent = homes ? `${Math.round(good / homes * 100)}%` : '–';
    sv.pop.textContent = (homes * 2400).toLocaleString('en');
    sv.green.textContent = `${Math.round(parks / grid.length * 100)}%`;
    sv.far.textContent = homes ? (Number.isFinite(worst) ? `${Math.round(worst)} min` : 'missing') : '–';
    hud.textContent = homes ? `${good} of ${homes} home blocks reach shops, work, a park and transit within ${limit} min` : 'Paint some homes to begin';
    st.set(Array.from(grid).join(''));
  }

  function generate(kind) {
    const R0 = rng(kind === 'random' ? (Date.now() & 0xffff) : kind === 'compact' ? 7 : 3);
    grid.fill(0);
    if (kind === 'sprawl') { for (let i = 0; i < grid.length; i++) { const x = i % G, y = (i / G) | 0; grid[i] = x < 8 && y < 8 ? 3 : x > 16 && y > 16 ? 2 : (x + y) % 7 === 0 ? 0 : 1; } grid[5 * G + 5] = 5; grid[20 * G + 20] = 4; }
    else if (kind === 'compact') {
      /* a polycentric plan: every 6 x 6 district has its own shops, offices, park and stop */
      for (let i = 0; i < grid.length; i++) { const x = i % G, y = (i / G) | 0, lx = x % 6, ly = y % 6; grid[i] = (lx === 2 || lx === 3) && (ly === 2 || ly === 3) ? (lx === 2 && ly === 2 ? 5 : lx === 3 && ly === 3 ? 4 : lx === 3 ? 2 : 3) : (lx === 0 && ly === 5) ? 4 : R0() < .12 ? 2 : 1; }
    } else { for (let i = 0; i < grid.length; i++) { const r = R0(); grid[i] = r < .52 ? 1 : r < .62 ? 2 : r < .72 ? 3 : r < .84 ? 4 : r < .88 ? 5 : 0; } }
    for (let i = 0; i < hgt.length; i++) hgt[i] = R0();
    rebuild();
  }

  /* flying pods: they cruise the avenues at two altitudes, leaving short light trails */
  const PODS = phone ? 70 : 140;
  const podG = new THREE.CapsuleGeometry(.12, .5, 4, 8); podG.rotateZ(Math.PI / 2);
  const pods = new THREE.InstancedMesh(podG, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), PODS); scene.add(pods);
  const trailG = new THREE.BoxGeometry(1, .05, .05); trailG.translate(-.5, 0, 0);
  const trails = new THREE.InstancedMesh(trailG, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), PODS); scene.add(trails);
  const pod = []; { const R0 = rng(31); for (let i = 0; i < PODS; i++) { const axis = R0() < .5 ? 0 : 1, lane = Math.floor(R0() * (G + 1)) * C - half, dir = R0() < .5 ? -1 : 1; pod.push({ axis, lane, dir, s: (R0() - .5) * 2 * half, v: 6 + R0() * 9, y: 6 + Math.floor(R0() * 3) * 3.5, c: [0x59f0ff, 0xff5fd2, 0xffd36e, 0xffffff][Math.floor(R0() * 4)] });
    pods.setColorAt(i, col.set(pod[i].c)); trails.setColorAt(i, col.set(pod[i].c)); } }
  function movePods(dt) {
    for (let i = 0; i < PODS; i++) { const p = pod[i]; p.s += p.v * p.dir * dt; if (p.s > half + 20) p.s = -half - 20; if (p.s < -half - 20) p.s = half + 20;
      const x = p.axis ? p.lane : p.s, z = p.axis ? p.s : p.lane, ry = p.axis ? (p.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (p.dir > 0 ? 0 : Math.PI);
      dummy.position.set(x, p.y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pods.setMatrixAt(i, dummy.matrix);
      dummy.scale.set(p.v * .45, 1, 1); dummy.updateMatrix(); trails.setMatrixAt(i, dummy.matrix); }
    pods.instanceMatrix.needsUpdate = trails.instanceMatrix.needsUpdate = true;
  }

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 27 · Future City', title: 'The 15-Minute City', lede: 'Plan a night city of 100 m blocks. Every home is checked: can its people walk to shops, work, a park and transit within the limit?' });
  const sPlan = P.section('Plan');
  chips(sPlan, 'Paint with', Z.slice(1).concat('empty').map((z) => [z, NAME[z], COL[z]]), tool, (v) => { tool = v; }, 'grid');
  range(sPlan, 'Walking limit', { min: 5, max: 30, value: limit, fmt: (v) => v + ' min' }, (v) => { limit = v; compute(); });
  const sv = P.stats(sPlan, [['score', '15-minute homes'], ['pop', 'Residents'], ['green', 'Green space'], ['far', 'Longest walk']]);
  const hud = el('p', { class: 'c-n' }); sPlan.append(hud);
  const sStart = P.section('Start from');
  note(sStart, 'Start from a ready-made plan, then fix it: watch the score as you add a park or a stop where homes are far.');
  chips(sStart, null, [['compact', 'Compact districts'], ['sprawl', 'Sprawl'], ['random', 'Random'], ['clear', 'Empty land']], '-', (k) => { if (k === 'clear') { grid.fill(0); rebuild(); } else generate(k); });
  const sView = P.section('View');
  chips(sView, null, [['city', 'Night city'], ['heat', 'Walk-time heat map']], view, (v) => { view = v; compute(); });
  note(sView, 'In the heat map every home block turns green when everything is close, red when something is far. 1 block = 100 m = 1¼ minutes on foot.');
  buttons(sView, [['Fly over', () => tour(), true], ['Save picture', () => { comp.render(); download('abidora-city.png', canvas.toDataURL('image/png')); }]]);

  /* ---------- camera and painting ---------- */
  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * .44; orbit.minDistance = 12; orbit.maxDistance = 190;
  orbit.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }; orbit.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  const fab = el('div', { class: 'fab' });
  const bPaint = el('button', { 'aria-pressed': 'true', text: 'Paint', onclick: () => setPaint(true) });
  const bMove = el('button', { 'aria-pressed': 'false', text: 'Move camera', onclick: () => setPaint(false) });
  fab.append(bPaint, bMove); ui.append(fab);
  const hint = el('div', { class: 'hint' }); ui.append(hint);
  let paint = true;
  function setPaint(on) { paint = on; bPaint.setAttribute('aria-pressed', String(on)); bMove.setAttribute('aria-pressed', String(!on));
    orbit.mouseButtons.LEFT = on ? null : THREE.MOUSE.ROTATE; orbit.touches.ONE = on ? null : THREE.TOUCH.ROTATE;
    hint.textContent = on ? (phone ? 'Drag on blocks to paint · two fingers to turn' : 'Drag on blocks to paint · right-drag to turn · scroll to zoom') : (phone ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll to zoom'); }
  setPaint(true);
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hp = new THREE.Vector3();
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(C * .94, .1, C * .94), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25, toneMapped: false })); scene.add(cursor);
  let painting = null, last = -1;
  const cellAt = (e) => { const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, cam); if (!ray.ray.intersectPlane(pl, hp)) return -1; const x = Math.floor((hp.x + half) / C), y = Math.floor((hp.z + half) / C); return x < 0 || y < 0 || x >= G || y >= G ? -1 : y * G + x; };
  const showCursor = (i) => { cursor.visible = i >= 0; if (i >= 0) { const [x, z] = cellPos(i); cursor.position.set(x, .12, z); cursor.material.color.set(COL[tool]); } };
  canvas.addEventListener('pointerdown', (e) => { if (!paint || e.button > 0 || (e.pointerType === 'touch' && !e.isPrimary)) return; painting = e.pointerId; last = -1; stroke(e); });
  canvas.addEventListener('pointermove', (e) => { const i = cellAt(e); showCursor(paint ? i : -1); if (painting === e.pointerId) stroke(e); });
  on(window, 'pointerup', (e) => { if (painting === e.pointerId) { painting = null; rebuild(); } });
  let pending = 0;
  function stroke(e) { const i = cellAt(e); if (i < 0 || i === last) return; last = i; grid[i] = Z.indexOf(tool); hgt[i] = Math.random(); clearTimeout(pending); pending = setTimeout(rebuild, 16); }
  /* a second finger cancels painting so pinch and turn work */
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !e.isPrimary) painting = null; });

  let stopT = null;
  function tour() {
    stopT?.(); const t0 = orbit.target.clone(), p0 = cam.position.clone();
    stopT = tween(14000, (k) => { const a = k * TAU * .85 + .6, r = lerp(70, 34, Math.sin(k * Math.PI)), h = lerp(46, 14, Math.sin(k * Math.PI));
      cam.position.set(Math.cos(a) * r, h, Math.sin(a) * r); orbit.target.set(0, 4 * Math.sin(k * Math.PI), 0); }, () => (stopT = null));
  }

  /* first visit: a compact plan; later visits: what you made */
  const saved = st.get(); if (typeof saved === 'string' && saved.length === G * G) { for (let i = 0; i < grid.length; i++) grid[i] = +saved[i] || 0; rebuild(); } else generate('compact');
  cam.position.set(110, 90, 120); orbit.target.set(0, 0, 0);
  tween(3800, (k) => cam.position.lerpVectors(new THREE.Vector3(110, 90, 120), new THREE.Vector3(phone ? 34 : 44, phone ? 38 : 40, phone ? 46 : 56), k));

  loop((dt, t) => {
    orbit.update(); movePods(dt);
    for (const m of Object.values(mats)) if (m.userData.sh) m.userData.sh.uniforms.uTime.value = t;
    rings.rotation.y = 0; cursor.material.opacity = .18 + .12 * Math.sin(t * 4);
    comp.render(); R.adapt();
  });
}
