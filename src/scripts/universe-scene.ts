/* Abidora Universe (Wave A, I-1 and I-4): the homepage map of all 112 worlds.
   The ora ring sits at the centre; the 12 categories are systems on one slow orbit, each with its own small
   procedural emblem (no downloaded models); every world is a star circling its system. Live worlds shine,
   planned ones are faint, and worlds you have visited carry a white core (device storage only).
   One Points draw call for all 112 stars (positions computed on the GPU from 12 system centres), 12 emblems,
   one ring, one background starfield. Rendering stops when the section is off-screen or the tab is hidden;
   reduced motion / Calm render on demand only. */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, DodecahedronGeometry, Group, IcosahedronGeometry, Mesh,
  OctahedronGeometry, PerspectiveCamera, Points, Scene, ShaderMaterial, SphereGeometry, TetrahedronGeometry, TorusGeometry,
  TorusKnotGeometry, BoxGeometry, CapsuleGeometry, Vector3, WebGLRenderer, MathUtils, Sphere,
} from 'three';
import type { Tier } from './tier';

export interface UStar { id: number; cat: number; live: boolean; visited: boolean }
export interface UOpts { canvas: HTMLCanvasElement; cats: { id: string; color: string }[]; stars: UStar[]; tier: Tier; still: boolean; rtl: boolean; onFrame: (proj: { sys: { x: number; y: number; z: number; vis: boolean }[] }) => void }
export interface Universe { focus(i: number | null): void; pickStar(x: number, y: number): number | null; pickSystem(x: number, y: number): number | null; drag(dx: number): void; resize(): void; setActive(on: boolean): void; highlight(id: number | null): void; dispose(): void; focused(): number | null }

function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const RIM_V = `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`;
const RIM_F = `uniform vec3 uCol; uniform float uGlow; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1. - max(dot(vN, vV), 0.), 2.2); float l = .18 + .55*max(dot(vN, normalize(vec3(.4,.8,.5))),0.);
  vec3 c = uCol*(l*.55) + uCol*f*(1.1+uGlow) + vec3(1.)*f*f*.35*(1.+uGlow); gl_FragColor = vec4(c, 1.); }`;

const STAR_V = `attribute float aSys; attribute float aR; attribute float aA; attribute float aSp; attribute float aY; attribute vec3 aCol; attribute float aSize; attribute float aState;
uniform vec3 uC[12]; uniform float uT; uniform float uPx; uniform float uHi; varying vec3 vCol; varying float vState; varying float vHi;
void main(){ int s = int(aSys + .5); vec3 c = uC[0]; for(int i=0;i<12;i++){ if(i==s) c = uC[i]; }
  float a = aA + uT*aSp; vec3 p = c + vec3(cos(a)*aR, aY, sin(a)*aR);
  vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
  vHi = step(abs(aState - uHi), .5) * step(.5, uHi);
  gl_PointSize = aSize*uPx*(1. + vHi*1.4)*(12./-mv.z); vCol = aCol; vState = aState; }`;
const STAR_F = `varying vec3 vCol; varying float vState; varying float vHi;
void main(){ vec2 q = gl_PointCoord - .5; float d = length(q); if(d > .5) discard;
  float core = smoothstep(.5, 0., d); float glow = pow(core, 2.4);
  float visited = step(.5, fract(vState) * 2.); /* fractional .5 marks visited */
  vec3 c = vCol*glow*1.4 + vec3(1.)*pow(core, 7.)*(.6 + visited*1.6 + vHi*2.);
  gl_FragColor = vec4(c, glow); }`;

export function createUniverse(o: UOpts): Universe {
  const r = new WebGLRenderer({ canvas: o.canvas, antialias: o.tier === 'full', alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(devicePixelRatio || 1, o.tier === 'full' ? 2 : 1.5); r.setPixelRatio(dpr);
  const scene = new Scene(), cam = new PerspectiveCamera(42, 1, .1, 200);
  const world = new Group(); scene.add(world);
  const N = o.cats.length, R = 9;

  /* background starfield: fixed, faint */
  { const n = o.tier === 'low' ? 600 : 1800, g = new BufferGeometry(), p = new Float32Array(n * 3), rr = rng(7);
    for (let i = 0; i < n; i++) { const th = rr() * Math.PI * 2, ph = Math.acos(2 * rr() - 1), d = 60 + rr() * 60; p[i * 3] = d * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = d * Math.cos(ph) * .6; p[i * 3 + 2] = d * Math.sin(ph) * Math.sin(th); }
    g.setAttribute('position', new BufferAttribute(p, 3));
    const m = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uPx: { value: dpr } },
      vertexShader: `uniform float uPx; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); gl_Position = projectionMatrix*mv; gl_PointSize = 1.6*uPx; }`,
      fragmentShader: `void main(){ float d = length(gl_PointCoord-.5); gl_FragColor = vec4(vec3(.85,.88,1.)*(.5-d)*1.3, 1.); }` });
    scene.add(new Points(g, m)); }

  /* the ora ring at the centre, with its small orbiting dot */
  const ringMat = new ShaderMaterial({ vertexShader: RIM_V, fragmentShader: RIM_F, uniforms: { uCol: { value: new Color('#e8b46a') }, uGlow: { value: .4 } } });
  const ring = new Mesh(new TorusGeometry(2.1, .07, 16, 160), ringMat); ring.rotation.x = Math.PI / 2; world.add(ring);
  const dot = new Mesh(new SphereGeometry(.38, 24, 16), new ShaderMaterial({ vertexShader: RIM_V, fragmentShader: RIM_F, uniforms: { uCol: { value: new Color('#f0e6d6') }, uGlow: { value: .6 } } })); world.add(dot);

  /* 12 systems with procedural emblems */
  const geos = [
    () => new TorusKnotGeometry(.45, .14, 96, 12, 2, 3),          // A fashion: a knotted ribbon
    () => new CapsuleGeometry(.28, .8, 6, 16),                    // B automotive: a streamlined capsule
    () => new BoxGeometry(.55, 1.1, .55),                          // C architecture: a tower
    () => new ConeGeometry(.5, 1.1, 7),                            // D nature: a pine
    () => new SphereGeometry(.48, 32, 20),                         // E space: a planet (with ring below)
    () => new DodecahedronGeometry(.58),                           // F art: a faceted gem
    () => new OctahedronGeometry(.62),                             // G technology: a crystal chip
    () => new IcosahedronGeometry(.6, 1),                          // H travel: a globe
    () => new TorusGeometry(.42, .16, 16, 48),                     // I interactive: a loop
    () => new TetrahedronGeometry(.7),                             // J tools: a tool point
    () => new TorusKnotGeometry(.38, .1, 96, 10, 3, 5),           // K experimental: a strange knot
    () => new TorusGeometry(.48, .05, 12, 64),                     // X originals: a little ora
  ];
  const emblems: Mesh[] = [], mats: ShaderMaterial[] = [], centers: Vector3[] = [];
  o.cats.forEach((c, i) => {
    const m = new ShaderMaterial({ vertexShader: RIM_V, fragmentShader: RIM_F, uniforms: { uCol: { value: new Color(c.color) }, uGlow: { value: 0 } } });
    const e = new Mesh(geos[i % geos.length](), m);
    if (i === 4) { const rg = new Mesh(new TorusGeometry(.8, .025, 8, 64), m); rg.rotation.x = Math.PI / 2.4; e.add(rg); }
    world.add(e); emblems.push(e); mats.push(m); centers.push(new Vector3());
  });

  /* stars: one Points for every world */
  const S = o.stars.length, sg = new BufferGeometry(), rs = rng(42);
  const aSys = new Float32Array(S), aR = new Float32Array(S), aA = new Float32Array(S), aSp = new Float32Array(S), aY = new Float32Array(S), aCol = new Float32Array(S * 3), aSize = new Float32Array(S), aState = new Float32Array(S);
  const perCat: number[] = Array(N).fill(0), seen: number[] = Array(N).fill(0);
  o.stars.forEach((s) => perCat[s.cat]++);
  o.stars.forEach((s, i) => {
    const k = seen[s.cat]++, n = perCat[s.cat];
    aSys[i] = s.cat; aR[i] = 1.25 + (k % 3) * .38 + rs() * .12; aA[i] = (k / n) * Math.PI * 2 + rs() * .3; aSp[i] = (.22 + rs() * .1) / aR[i]; aY[i] = (rs() - .5) * .35;
    const c = new Color(o.cats[s.cat].color); if (!s.live) c.multiplyScalar(.32);
    aCol.set([c.r, c.g, c.b], i * 3); aSize[i] = s.live ? 7 : 4.2; aState[i] = s.id + (s.visited ? .5 : 0);
  });
  sg.setAttribute('position', new BufferAttribute(new Float32Array(S * 3), 3));
  for (const [n, a, d] of [['aSys', aSys, 1], ['aR', aR, 1], ['aA', aA, 1], ['aSp', aSp, 1], ['aY', aY, 1], ['aCol', aCol, 3], ['aSize', aSize, 1], ['aState', aState, 1]] as [string, Float32Array, number][]) sg.setAttribute(n, new BufferAttribute(a, d));
  sg.boundingSphere = new Sphere(new Vector3(), 80); /* positions come from the shader; a fixed sphere keeps three.js happy */
  const su = { uC: { value: centers }, uT: { value: 0 }, uPx: { value: dpr }, uHi: { value: 0 } };
  const stars = new Points(sg, new ShaderMaterial({ vertexShader: STAR_V, fragmentShader: STAR_F, uniforms: su, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  stars.frustumCulled = false; world.add(stars);

  /* state */
  let yaw = 0, yawV = 0, t = 0, active = false, raf = 0, last = 0, focus: number | null = null;
  const camPos = new Vector3(0, 9.5, 21), camLook = new Vector3(), camPosT = camPos.clone(), camLookT = camLook.clone();
  const tmp = new Vector3(), proj = { sys: Array.from({ length: N }, () => ({ x: 0, y: 0, z: 0, vis: true })) };
  const auto = !o.still && o.tier !== 'low';
  let far = 1, narrow = false, tall = false, off = 0; /* far: pull back on tall screens so the whole ring fits; narrow: phone layout, panel sits at the bottom */
  const fpsCap = o.tier === 'mid' ? 1000 / 31 : 0;

  function layoutSystems() {
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + yaw, rad = R + (i % 2) * 1.6;
      centers[i].set(Math.cos(a) * rad, Math.sin(a * 2 + i) * .6, Math.sin(a) * rad);
      emblems[i].position.copy(centers[i]); emblems[i].rotation.y = t * .3 + i; emblems[i].rotation.x = Math.sin(t * .2 + i) * .3;
    }
    dot.position.set(Math.cos(t * .5) * 2.1, 0, Math.sin(t * .5) * 2.1);
  }
  function frame(now: number) {
    raf = 0; const dt = Math.min(.05, last ? (now - last) / 1000 : .016);
    if (fpsCap && last && now - last < fpsCap) { if (active) raf = requestAnimationFrame(frame); return; }
    last = now;
    if (auto) { t += dt; if (focus === null) yaw += dt * .035; }
    yaw += yawV; yawV *= .9; if (Math.abs(yawV) < 1e-5) yawV = 0;
    layoutSystems(); su.uT.value = t;
    if (focus !== null) { const c = centers[focus]; camLookT.copy(c); camPosT.set(c.x * 1.45, c.y + 3.2, c.z * 1.45 + 0.01).add(tmp.copy(c).normalize().multiplyScalar(2.5)); }
    else { camLookT.set(0, tall ? 0 : -1.3, 0); if (tall) camPosT.set(0, 17, 12).multiplyScalar(far); else camPosT.set(0, 9.5, 21).multiplyScalar(far); }
    const k = o.still ? 1 : 1 - Math.pow(.0015, dt); camPos.lerp(camPosT, k); camLook.lerp(camLookT, k);
    cam.position.copy(camPos); cam.lookAt(camLook);
    /* on phones the card covers the lower part, so the focused system is drawn higher up */
    const offT = narrow && focus !== null ? .24 : 0; off += (offT - off) * k; if (Math.abs(offT - off) < 1e-3) off = offT;
    const w0 = o.canvas.clientWidth, h0 = o.canvas.clientHeight; if (off > 0) cam.setViewOffset(w0, h0, 0, h0 * off, w0, h0); else cam.clearViewOffset();
    r.render(scene, cam);
    const w = o.canvas.clientWidth, h = o.canvas.clientHeight;
    for (let i = 0; i < N; i++) { tmp.copy(centers[i]).project(cam); proj.sys[i].x = (tmp.x * .5 + .5) * w; proj.sys[i].y = (-tmp.y * .5 + .5) * h; proj.sys[i].z = tmp.z; proj.sys[i].vis = tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15; }
    o.onFrame(proj);
    const moving = auto || yawV !== 0 || camPos.distanceToSquared(camPosT) > 1e-4 || off !== (narrow && focus !== null ? .24 : 0);
    if (active && moving) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  function resize() {
    const w = o.canvas.clientWidth, h = o.canvas.clientHeight; if (!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w < h ? 58 : 42;
    const half = Math.atan(Math.tan(MathUtils.degToRad(cam.fov / 2)) * cam.aspect); tall = h > w * 1.1; far = Math.max(1, (R + 3.2) / Math.tan(half) / (tall ? 20.8 : 22.9) * (tall ? .98 : 1.04)); if (!tall) far = Math.max(1.12, far);
    narrow = w <= 800; cam.updateProjectionMatrix(); kick();
  }
  function starScreen(i: number) {
    const s = o.stars[i], a = aA[i] + t * aSp[i], c = centers[s.cat];
    tmp.set(c.x + Math.cos(a) * aR[i], c.y + aY[i], c.z + Math.sin(a) * aR[i]).project(cam);
    return { x: (tmp.x * .5 + .5) * o.canvas.clientWidth, y: (-tmp.y * .5 + .5) * o.canvas.clientHeight, z: tmp.z };
  }
  resize();
  return {
    focus(i) { focus = i; mats.forEach((m, j) => { m.uniforms.uGlow.value = i === j ? 1 : 0; }); kick(); },
    focused: () => focus,
    pickSystem(x, y) { let best: number | null = null, bd = 46; proj.sys.forEach((p, i) => { if (!p.vis) return; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }); return best; },
    pickStar(x, y) { let best: number | null = null, bd = 22; o.stars.forEach((s, i) => { if (focus !== null && s.cat !== focus) return; const p = starScreen(i); if (p.z > 1) return; const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } }); return best; },
    drag(dx) { yawV = MathUtils.clamp(dx * .0035 * (o.rtl ? -1 : 1), -.08, .08); kick(); },
    resize, highlight(id) { su.uHi.value = id ?? 0; kick(); },
    setActive(on) { active = on; if (on) { last = 0; kick(); } else if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    dispose() { cancelAnimationFrame(raf); r.dispose(); },
  };
}
