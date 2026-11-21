/* Digital Galaxy scene: one Points cloud drawn by a custom GLSL shader.
   Every star stores where it is now and where it is going; changing the shape tweens a single uniform,
   so morphing 180,000 stars costs one number per frame. Inner stars complete their orbits sooner
   (differential rotation), which makes the arms wind as you watch. */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Clock, Color, PerspectiveCamera, Plane, Points, Raycaster, Scene, ShaderMaterial, Vector2, Vector3, WebGLRenderer } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';

export type Shape = 'spiral' | 'barred' | 'elliptical' | 'irregular';
export interface GalaxyScene { count: number; setShape(s: Shape, arms: number, instant?: boolean): void; setSpin(v: number): void; setPaused(p: boolean): void; fly(): void; reset(): void }
interface Opts { calm: boolean; reduced: boolean; rtl: boolean; spin: number; onError: () => void; onFly?: (inside: boolean) => void }

/* deterministic random, so a shape looks the same every visit */
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function gauss(r: () => number) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

const CORE = new Color('#ffdcae'), ARM = new Color('#86b4ff'), HII = new Color('#ff7aa8'), OLD = new Color('#ffb27a'), DUST = new Color('#c9d6ff');

/** fills pos (xyz) and col (rgb) for N stars of a given shape */
function build(shape: Shape, arms: number, N: number, pos: Float32Array, col: Float32Array) {
  const r = rng(shape.length * 977 + arms * 131);
  const c = new Color();
  for (let i = 0; i < N; i++) {
    let x = 0, y = 0, z = 0;
    const k = r();
    if (shape === 'elliptical') {
      const rad = Math.pow(r(), 2.2) * 4.2;
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      x = rad * Math.sin(ph) * Math.cos(th) * 1.0; y = rad * Math.cos(ph) * 0.62; z = rad * Math.sin(ph) * Math.sin(th) * 0.8;
      c.copy(OLD).lerp(CORE, Math.max(0, 1 - rad / 2.2)).multiplyScalar(0.75 + r() * 0.4);
    } else if (shape === 'irregular') {
      const cl = Math.floor(r() * 7); const cr = rng(cl * 71 + 3);
      const cx = (cr() - .5) * 6, cz = (cr() - .5) * 4.5, cy = (cr() - .5) * .8, sz = .35 + cr() * 1.1;
      x = cx + gauss(r) * sz; y = cy + gauss(r) * sz * .35; z = cz + gauss(r) * sz * .8;
      c.copy(k < .08 ? HII : ARM).lerp(DUST, r() * .5).multiplyScalar(0.7 + r() * 0.5);
    } else {
      const barred = shape === 'barred';
      if (k < (barred ? .14 : .16)) { /* bulge */
        const rad = Math.pow(r(), 1.8) * .9;
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        x = rad * Math.sin(ph) * Math.cos(th); y = rad * Math.cos(ph) * .55; z = rad * Math.sin(ph) * Math.sin(th);
        c.copy(CORE).multiplyScalar(0.85 + r() * 0.4);
      } else if (barred && k < .30) { /* bar */
        x = (r() * 2 - 1) * 2.0; z = gauss(r) * .22; y = gauss(r) * .08;
        c.copy(CORE).lerp(OLD, Math.abs(x) / 2).multiplyScalar(0.8 + r() * 0.3);
      } else if (k < (barred ? .42 : .34)) { /* diffuse disc between the arms */
        const rad = .5 + Math.pow(r(), .9) * 4.8, ang = r() * Math.PI * 2;
        x = Math.cos(ang) * rad; z = Math.sin(ang) * rad; y = gauss(r) * .07;
        c.copy(CORE).lerp(DUST, Math.min(1, rad / 4)).multiplyScalar(0.28 + r() * 0.25);
      } else { /* arms */
        const a = Math.floor(r() * arms);
        const start = barred ? 2.0 : 0.35;
        const rad = start + Math.pow(r(), 1.35) * (5.2 - start);
        const twist = barred ? 1.05 : 1.25;
        const spread = Math.pow(r(), 1.9) * (0.45 + rad * .2) * (r() < .5 ? -1 : 1);
        const ang = (a / arms) * Math.PI * 2 + (rad - start) * twist + spread / Math.max(rad, .6);
        const scatter = gauss(r) * .12 * rad * .25;
        x = Math.cos(ang) * rad + scatter; z = Math.sin(ang) * rad + gauss(r) * .12 * rad * .25;
        y = gauss(r) * (.05 + .1 / (1 + rad));
        const t = Math.min(1, (rad - .3) / 3.2);
        c.copy(CORE).lerp(ARM, t);
        if (Math.abs(spread) < .08 && r() < .06) c.copy(HII);
        c.multiplyScalar(0.65 + r() * 0.55);
      }
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
}

const VS = /* glsl */`
uniform float uMix, uTime, uPx, uStir;
uniform vec3 uMouse;
attribute vec3 aTo; attribute vec3 aCol; attribute vec3 aColTo; attribute float aSeed; attribute float aSize;
varying vec3 vCol; varying float vA;
void main(){
  float m = clamp(uMix * 1.5 - aSeed * .5, 0., 1.); m = m * m * (3. - 2. * m);
  vec3 p = mix(position, aTo, m);
  float r = length(p.xz);
  float a = uTime / (.35 + r * .55);
  float s = sin(a), c = cos(a);
  p.xz = mat2(c, -s, s, c) * p.xz;
  vec2 d = p.xz - uMouse.xz; float dl = length(d);
  float f = exp(-dl * dl * 1.6) * uStir;
  p.xz += normalize(d + 1e-4) * f * .55; p.y += f * .25 * sin(aSeed * 40. + uTime * 3.);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uPx * (26. / -mv.z), 7. * uPx);
  vCol = mix(aCol, aColTo, m) * (.55 + f * .6);
  vA = clamp(1.2 - (-mv.z) * .015, .35, 1.) * smoothstep(.15, 1.6, -mv.z);
}`;
const FS = /* glsl */`
varying vec3 vCol; varying float vA;
void main(){ float d = length(gl_PointCoord - .5); float a = pow(smoothstep(.5, 0., d), 1.7) * vA; if (a < .01) discard; gl_FragColor = vec4(vCol * a, a); }`;

export function createGalaxy(canvas: HTMLCanvasElement, o: Opts): GalaxyScene {
  const mob = innerWidth < 820 || matchMedia('(pointer:coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const N = o.calm ? 50000 : mob ? 70000 : cores >= 8 ? 180000 : 120000;
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  const px = Math.min(devicePixelRatio || 1, mob ? 1.5 : 1.75);
  renderer.setPixelRatio(px);
  const scene = new Scene();
  const camera = new PerspectiveCamera(55, 1, .05, 200);
  const HOME = new Vector3(0, 4.2, mob ? 11.5 : 9);
  camera.position.copy(HOME);

  const g = new BufferGeometry();
  const pos = new Float32Array(N * 3), to = new Float32Array(N * 3), col = new Float32Array(N * 3), colTo = new Float32Array(N * 3);
  const seed = new Float32Array(N), size = new Float32Array(N);
  const rr = rng(7);
  for (let i = 0; i < N; i++) { seed[i] = rr(); size[i] = .6 + Math.pow(rr(), 6) * 3.2; }
  build('spiral', 2, N, pos, col); to.set(pos); colTo.set(col);
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('aTo', new BufferAttribute(to, 3));
  g.setAttribute('aCol', new BufferAttribute(col, 3));
  g.setAttribute('aColTo', new BufferAttribute(colTo, 3));
  g.setAttribute('aSeed', new BufferAttribute(seed, 1));
  g.setAttribute('aSize', new BufferAttribute(size, 1));
  const U = { uMix: { value: 1 }, uTime: { value: 0 }, uPx: { value: px * (mob ? 1.15 : 1) }, uStir: { value: 0 }, uMouse: { value: new Vector3(99, 0, 99) } };
  const mat = new ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false, blending: AdditiveBlending });
  const stars = new Points(g, mat); stars.frustumCulled = false; scene.add(stars);

  /* distant background stars */
  const BN = mob ? 1800 : 3500, bp = new Float32Array(BN * 3), bc = new Float32Array(BN * 3), bs = new Float32Array(BN), bseed = new Float32Array(BN);
  const br = rng(99);
  for (let i = 0; i < BN; i++) {
    const th = br() * Math.PI * 2, ph = Math.acos(2 * br() - 1), R = 60 + br() * 30;
    bp[i * 3] = R * Math.sin(ph) * Math.cos(th); bp[i * 3 + 1] = R * Math.cos(ph); bp[i * 3 + 2] = R * Math.sin(ph) * Math.sin(th);
    const v = .35 + br() * .5; bc[i * 3] = v; bc[i * 3 + 1] = v; bc[i * 3 + 2] = v * 1.1; bs[i] = 3 + br() * 9; bseed[i] = 1;
  }
  const bg = new BufferGeometry();
  bg.setAttribute('position', new BufferAttribute(bp, 3)); bg.setAttribute('aTo', new BufferAttribute(bp, 3));
  bg.setAttribute('aCol', new BufferAttribute(bc, 3)); bg.setAttribute('aColTo', new BufferAttribute(bc, 3));
  bg.setAttribute('aSeed', new BufferAttribute(bseed, 1)); bg.setAttribute('aSize', new BufferAttribute(bs, 1));
  const bmat = new ShaderMaterial({ vertexShader: VS.replace('float a = uTime / (.35 + r * .55);', 'float a = 0.;'), fragmentShader: FS, uniforms: { ...U, uMix: { value: 1 }, uStir: { value: 0 }, uMouse: { value: new Vector3(999, 0, 999) } }, transparent: true, depthWrite: false, blending: AdditiveBlending });
  const sky = new Points(bg, bmat); sky.frustumCulled = false; scene.add(sky);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06; controls.enablePan = false;
  controls.minDistance = 1.6; controls.maxDistance = 24; controls.rotateSpeed = .6;

  /* keyboard: arrows orbit, + / - zoom (canvas must have focus) */
  canvas.addEventListener('keydown', (e) => {
    const off = camera.position.clone(); const sph = { r: off.length(), th: Math.atan2(off.x, off.z), ph: Math.acos(off.y / off.length()) };
    let used = true;
    if (e.key === 'ArrowLeft') sph.th -= .12; else if (e.key === 'ArrowRight') sph.th += .12;
    else if (e.key === 'ArrowUp') sph.ph = Math.max(.15, sph.ph - .1); else if (e.key === 'ArrowDown') sph.ph = Math.min(Math.PI - .15, sph.ph + .1);
    else if (e.key === '+' || e.key === '=') sph.r = Math.max(controls.minDistance, sph.r * .88); else if (e.key === '-' || e.key === '_') sph.r = Math.min(controls.maxDistance, sph.r * 1.12);
    else used = false;
    if (!used) return; e.preventDefault();
    camera.position.set(sph.r * Math.sin(sph.ph) * Math.sin(sph.th), sph.r * Math.cos(sph.ph), sph.r * Math.sin(sph.ph) * Math.cos(sph.th));
  });

  /* pointer stirs the stars: project onto the galaxy plane */
  const ray = new Raycaster(), plane = new Plane(new Vector3(0, 1, 0), 0), ndc = new Vector2(), hit = new Vector3();
  let stirTarget = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (o.reduced) return;
    const b = canvas.getBoundingClientRect(); ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      /* undo the rotation the shader will apply at this radius, so the stir sits under the pointer */
      const r = Math.hypot(hit.x, hit.z), a = -U.uTime.value / (.35 + r * .55), s = Math.sin(a), c = Math.cos(a);
      U.uMouse.value.set(c * hit.x - s * hit.z, 0, s * hit.x + c * hit.z); stirTarget = 1;
    }
  });
  canvas.addEventListener('pointerleave', () => { stirTarget = 0; });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    /* on wide screens shift the galaxy away from the title, towards the open side of the screen */
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); resize();

  let spin = o.spin, paused = false, visible = true, onScreen = true, t = 0;
  const clock = new Clock();
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; clock.getDelta(); });
  new IntersectionObserver((e) => { onScreen = e[0].isIntersecting; clock.getDelta(); }).observe(canvas);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); o.onError(); });

  renderer.setAnimationLoop(() => {
    if (!visible || !onScreen) return;
    const dt = Math.min(clock.getDelta(), .05);
    if (!paused) t += dt * spin * .35;
    U.uTime.value = t;
    U.uStir.value += (stirTarget - U.uStir.value) * .06;
    controls.update();
    try { renderer.render(scene, camera); } catch { renderer.setAnimationLoop(null); o.onError(); }
  });

  let morph: gsap.core.Tween | null = null;
  return {
    count: N,
    setShape(s, arms, instant) {
      /* current visual position becomes the new start, then tween to the new target */
      const m = U.uMix.value;
      const P = g.getAttribute('position') as BufferAttribute, TO = g.getAttribute('aTo') as BufferAttribute;
      const C = g.getAttribute('aCol') as BufferAttribute, CT = g.getAttribute('aColTo') as BufferAttribute;
      if (m < 1) for (let i = 0; i < N; i++) {
        let k = Math.min(1, Math.max(0, m * 1.5 - seed[i] * .5)); k = k * k * (3 - 2 * k);
        for (let j = 0; j < 3; j++) { const q = i * 3 + j; pos[q] += (to[q] - pos[q]) * k; col[q] += (colTo[q] - col[q]) * k; }
      } else { pos.set(to); col.set(colTo); }
      build(s, arms, N, to, colTo);
      P.needsUpdate = TO.needsUpdate = C.needsUpdate = CT.needsUpdate = true;
      morph?.kill();
      if (instant || o.reduced) { U.uMix.value = 1; return; }
      U.uMix.value = 0; morph = gsap.to(U.uMix, { value: 1, duration: o.calm ? 1.2 : 2.6, ease: 'power2.inOut' });
    },
    setSpin(v) { spin = v; },
    setPaused(p) { paused = p; },
    fly() {
      const d = o.reduced ? 0 : 2.4;
      o.onFly?.(true);
      gsap.to(camera.position, { x: 1.4, y: 1.1, z: 3.4, duration: d, ease: 'power3.inOut', onUpdate: () => camera.lookAt(0, 0, 0) });
    },
    reset() { o.onFly?.(false); gsap.to(camera.position, { x: HOME.x, y: HOME.y, z: HOME.z, duration: o.reduced ? 0 : 1.6, ease: 'power3.inOut' }); },
  };
}
