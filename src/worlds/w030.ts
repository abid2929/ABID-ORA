/* 030 Wildlife Kingdom: Predator and Prey, in 3D. A golden-hour meadow where every hare and fox is
   its own animal with energy. Grass is grazed down and regrows (you can see it in the blades), hares
   graze and breed, foxes hunt them. Populations rise and crash, drawn live next to the textbook
   Lotka–Volterra equations. The foxes are a rigged, animated model (Khronos glTF sample, CC0 model /
   CC BY 4.0 rig); the hares are modelled in code. The 2D lab stays available from the toolbar. */
import type { Ctx } from './kit';
import { THREE, stage, daylight, sec, para, slider, segs, stats, chips, btns, el, loadGLB, rng, clamp, lerp, noise2 } from './nskit';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- the living model (same rules as the 2D lab, with fenced edges instead of wrap-around) ---------- */
const GW = 60, GH = 40, CELL = 1.5; /* 90 m × 60 m meadow */
interface A { x: number; y: number; px: number; py: number; a: number; e: number; age: number; chase: boolean; id: number }
class Meadow {
  P = { regrow: .02, hunt: 1, hareBirth: 6, foxBirth: 12 };
  imm = true; R = rng(3); grass = new Float32Array(GW * GH); hares: A[] = []; foxes: A[] = []; day = 0; uid = 0;
  hist: [number, number][] = []; lv: [number, number][] = []; lvH = 0; lvF = 0;
  mk(x: number, y: number, e: number): A { return { x, y, px: x, py: y, a: this.R() * 6.283, e, age: 0, chase: false, id: this.uid++ }; }
  reset() {
    const R = this.R = rng(3); this.grass.fill(.8); this.hares = []; this.foxes = []; this.day = 0; this.hist.length = 0; this.lv.length = 0;
    for (let i = 0; i < 120; i++) this.hares.push(this.mk(R() * GW, R() * GH, 4 + R() * 4));
    for (let i = 0; i < 14; i++) this.foxes.push(this.mk(R() * GW, R() * GH, 10 + R() * 6));
    this.lvH = 120; this.lvF = 14;
  }
  move(a: A, step: number) {
    a.px = a.x; a.py = a.y; a.x += Math.cos(a.a) * step; a.y += Math.sin(a.a) * step;
    if (a.x < .3 || a.x > GW - .3) { a.a = Math.PI - a.a; a.x = clamp(a.x, .3, GW - .3); }
    if (a.y < .3 || a.y > GH - .3) { a.a = -a.a; a.y = clamp(a.y, .3, GH - .3); }
  }
  tick() {
    const R = this.R, P = this.P, g = this.grass; this.day++;
    for (let i = 0; i < g.length; i++) g[i] = Math.min(1, g[i] + P.regrow * (.3 + g[i]));
    const born: A[] = [];
    for (const r of this.hares) {
      r.a += (R() - .5) * .9; this.move(r, .5); r.age++;
      const gi = Math.floor(r.y) * GW + Math.floor(r.x), bite = Math.min(g[gi], .35); g[gi] -= bite; r.e += bite * 2.6 - .3;
      if (r.e > P.hareBirth && R() < .2) { r.e /= 2; born.push(this.mk(r.x, r.y, r.e)); }
    }
    this.hares = this.hares.filter((r) => r.e > 0 && r.age < 160).concat(born);
    const bucket = new Map<number, A[]>(); for (const r of this.hares) { const k = Math.floor(r.x / 4) + Math.floor(r.y / 4) * 100; (bucket.get(k) ?? bucket.set(k, []).get(k)!).push(r); }
    const eaten = new Set<A>(), cubs: A[] = [];
    for (const f of this.foxes) {
      let best: A | null = null, bd = 4; const bx = Math.floor(f.x / 4), by = Math.floor(f.y / 4);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (const r of bucket.get(bx + dx + (by + dy) * 100) ?? []) { if (eaten.has(r)) continue; const d = Math.hypot(r.x - f.x, r.y - f.y); if (d < bd) { bd = d; best = r; } }
      f.chase = !!best;
      if (best) f.a = Math.atan2(best.y - f.y, best.x - f.x) + (R() - .5) * .3; else f.a += (R() - .5) * .6;
      this.move(f, best ? .75 : .45); f.age++; f.e -= .2;
      if (best && bd < 1.1 && R() < .08 * P.hunt) { eaten.add(best); f.e += 6; }
      if (f.e > P.foxBirth && R() < .06) { f.e /= 2; cubs.push(this.mk(f.x, f.y, f.e)); }
    }
    this.hares = this.hares.filter((r) => !eaten.has(r)); this.foxes = this.foxes.filter((f) => f.e > 0 && f.age < 600).concat(cubs);
    if (this.hares.length > 1500) this.hares.length = 1500;
    if (this.imm) { if (this.hares.length < 20 && R() < .3) this.hares.push(this.mk(.5, R() * GH, 5)); if (this.foxes.length < 2 && R() < .02) this.foxes.push(this.mk(GW - .5, R() * GH, 12)); }
    for (let k = 0; k < 10; k++) { const a = .04, b = .0012, c = .06, d = .00025, dt = .1; const dH = a * this.lvH - b * this.lvH * this.lvF, dF = d * this.lvH * this.lvF - c * this.lvF; this.lvH = Math.max(0, this.lvH + dH * dt); this.lvF = Math.max(0, this.lvF + dF * dt); }
    this.hist.push([this.hares.length, this.foxes.length]); this.lv.push([this.lvH, this.lvF]); if (this.hist.length > 600) { this.hist.shift(); this.lv.shift(); }
  }
}

/* ---------- ground ---------- */
const nA = noise2(21), nB = noise2(22);
const MX = GW * CELL / 2, MZ = GH * CELL / 2;
function ground(x: number, z: number) {
  const r = Math.max(Math.abs(x) / (MX + 14), Math.abs(z) / (MZ + 14));
  const hills = Math.max(0, r - 1) * 3.6 * (1.2 + nA(x / 70, z / 70)) + Math.max(0, r - 2) ** 2 * 3;
  return nB(x / 26, z / 26) * .7 + nA(x / 9, z / 9) * .12 + hills;
}
const toW = (gx: number, gy: number) => [(gx - GW / 2) * CELL, (gy - GH / 2) * CELL] as const;

const GRASS_VS = /* glsl */`
attribute vec3 aP; attribute vec2 aR;
uniform float uT; uniform sampler2D uG; uniform vec4 uM; uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmb; uniform vec2 uWind;
varying vec3 vC;
#include <common>
#include <fog_pars_vertex>
void main(){
  vec2 uv=(aP.xz-uM.xy)/uM.zw;
  float inside=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  float g=mix(1.,texture2D(uG,uv).r,inside);
  float hg=(.26+.5*aR.y)*mix(.14,1.,g);
  float h=position.y, c=cos(aR.x), s=sin(aR.x);
  vec3 p=vec3(position.x*c, h*hg, position.x*s);
  float w=sin(uT*1.5+aP.x*.23+aP.z*.11)*.55+sin(uT*2.9+aP.x*.9+aP.z*.4)*.18+.45;
  vec2 bend=uWind*w*.6+vec2(-s,c)*(aR.y-.5)*.35;
  p.xz+=bend*h*h*hg; p.y-=dot(bend,bend)*h*h*hg*.22;
  vec3 wp=aP+p;
  vec4 mvPosition=viewMatrix*vec4(wp,1.);
  gl_Position=projectionMatrix*mvPosition;
  vec3 root=vec3(.018,.03,.006);
  vec3 tipG=vec3(.26,.36,.06)*(.75+.5*aR.y), tipD=vec3(.55,.42,.17)*(.8+.4*aR.y);
  vec3 tip=mix(tipD,tipG,smoothstep(.2,.9,g));
  vec3 col=mix(root,tip,smoothstep(0.,1.,h));
  vec3 n=normalize(vec3(-s,.35,c));
  float nd=abs(dot(n,uSun))*.7+.3;
  vec3 vd=normalize(wp-cameraPosition);
  float tr=pow(max(dot(vd,uSun),0.),5.)*h*h;
  vC=col*(uAmb+uSunC*nd*(.35+.65*h))+vec3(.55,.62,.15)*uSunC*tr*.8;
  #include <fog_vertex>
}`;
const GRASS_FS = /* glsl */`
varying vec3 vC;
#include <common>
#include <fog_pars_fragment>
void main(){ gl_FragColor=vec4(vC,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/* a European hare, modelled from simple solids and merged into one mesh */
function hareGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, col: THREE.Color, m: THREE.Matrix4) => {
    if (g.index) g = g.toNonIndexed(); g.applyMatrix4(m); g.deleteAttribute('uv');
    const n = g.attributes.position.count, c = new Float32Array(n * 3);
    const pos = g.attributes.position; for (let i = 0; i < n; i++) { const k = .85 + .3 * Math.max(0, pos.getY(i) / .3); c[i * 3] = col.r * k; c[i * 3 + 1] = col.g * k; c[i * 3 + 2] = col.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g);
  };
  const M = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const fur = new THREE.Color(.36, .26, .16), belly = new THREE.Color(.62, .55, .45), dark = new THREE.Color(.08, .06, .05), white = new THREE.Color(.85, .84, .8);
  add(new THREE.SphereGeometry(1, 20, 14), fur, M(0, .17, -.06, .11, .12, .2, -.25));
  add(new THREE.SphereGeometry(1, 16, 12), fur, M(0, .15, -.14, .12, .12, .12));
  add(new THREE.SphereGeometry(1, 14, 10), belly, M(0, .11, .02, .085, .07, .12));
  add(new THREE.SphereGeometry(1, 16, 12), fur, M(0, .28, .13, .065, .07, .085, .3));
  add(new THREE.SphereGeometry(1, 10, 8), dark, M(0, .265, .21, .022, .02, .02));
  for (const s of [-1, 1]) {
    add(new THREE.CapsuleGeometry(1, 2.4, 4, 10), fur, M(s * .03, .41, .09, .018, .055, .01, -.45, s * .15));
    add(new THREE.SphereGeometry(1, 8, 6), dark, M(s * .036, .505, .045, .014, .02, .01, -.45));
    add(new THREE.SphereGeometry(1, 8, 6), dark, M(s * .05, .3, .17, .012, .014, .012));
    add(new THREE.CapsuleGeometry(1, 3, 3, 8), fur, M(s * .07, .05, -.12, .03, .03, .05, 1.2));
    add(new THREE.CapsuleGeometry(1, 2, 3, 8), belly, M(s * .04, .05, .1, .015, .03, .015));
  }
  add(new THREE.SphereGeometry(1, 10, 8), white, M(0, .2, -.27, .035, .035, .03));
  const g = mergeVertices(mergeGeometries(parts)!, 1e-4); g.computeVertexNormals(); return g;
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 18 · Wildlife'), title: t('title', 'Wildlife Kingdom'), sub: t('sub', 'A meadow at golden hour. Every hare and fox lives, eats and breeds by itself, and the populations rise and fall in cycles.'),
    acc: '#f0a04b', ink: '#120c05', hf: "'Fraunces'", fov: 42, near: .1, far: 3000,
    lab: () => import('./w030lab'), labName: t('lab', 'Population lab (2D)'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.shadowMap.enabled = true; renderer.toneMappingExposure = 1.15;
  const SUN = { elev: 9, azim: 235 };
  const L = daylight(S, { elev: SUN.elev, azim: SUN.azim, size: 2500 });
  const sky = (() => { const c = new THREE.Color().copy((L.uniforms.uHor.value as THREE.Color)); return c; })();
  scene.fog = new THREE.FogExp2(new THREE.Color(.78, .55, .36), .0052); void sky;
  const sunC = new THREE.Color(1, .78, .52).multiplyScalar(2.6);
  const sun = new THREE.DirectionalLight(sunC, 1); sun.position.copy(L.sun).multiplyScalar(120); sun.castShadow = true;
  const sc = sun.shadow.camera; sc.left = -60; sc.right = 60; sc.top = 45; sc.bottom = -45; sc.near = 10; sc.far = 300; sun.shadow.mapSize.set(S.phone ? 1024 : 2048, S.phone ? 1024 : 2048); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x3a2c14, .55));
  scene.environmentIntensity = .6;

  const M = new Meadow(); M.reset();
  /* grass state on the GPU: one texel per meadow cell */
  const gData = new Uint8Array(GW * GH * 4), gTex = new THREE.DataTexture(gData, GW, GH); gTex.magFilter = THREE.LinearFilter; gTex.minFilter = THREE.LinearFilter;
  const upGrass = () => { for (let i = 0; i < GW * GH; i++) { const v = Math.round(M.grass[i] * 255); gData[i * 4] = v; gData[i * 4 + 3] = 255; } gTex.needsUpdate = true; };
  upGrass();
  const uM = new THREE.Vector4(-MX, -MZ, MX * 2, MZ * 2);

  /* terrain */
  const TS = 520, tg = new THREE.PlaneGeometry(TS, TS, S.phone ? 160 : 260, S.phone ? 160 : 260); tg.rotateX(-Math.PI / 2);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i))); tg.computeVertexNormals(); }
  const tm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  tm.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uG: { value: gTex }, uM: { value: uM } });
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform sampler2D uG; uniform vec4 uM;\nfloat hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}')
      .replace('#include <map_fragment>', `
        vec2 uv=(vW.xz-uM.xy)/uM.zw; float ins=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        float g=mix(.85,texture2D(uG,uv).r,ins);
        float n=vn(vW.xz*.35)*.6+vn(vW.xz*1.7)*.4, far=vn(vW.xz*.03);
        vec3 lush=mix(vec3(.06,.1,.02),vec3(.11,.14,.035),n), dry=mix(vec3(.2,.16,.07),vec3(.3,.24,.12),n);
        vec3 col=mix(dry,lush,smoothstep(.15,.85,g));
        col=mix(col,vec3(.13,.12,.05),smoothstep(.55,.8,far)*(1.-ins));
        diffuseColor.rgb*=col;`);
  };
  const terrain = new THREE.Mesh(tg, tm); terrain.receiveShadow = true; scene.add(terrain);

  /* grass blades, instanced: denser where it matters */
  const blade = new THREE.BufferGeometry();
  { const v: number[] = [], idx: number[] = []; const rows = 4; for (let r = 0; r <= rows; r++) { const h = r / rows, w = .028 * (1 - h * .92); v.push(-w, h, 0, w, h, 0); } for (let r = 0; r < rows; r++) { const a = r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.setIndex(idx); }
  const NB = (globalThis as unknown as { NS_LOW?: boolean }).NS_LOW ? 30000 : S.phone ? 70000 : 200000, GX = MX + 16, GZ = MZ + 14;
  const ig = new THREE.InstancedBufferGeometry(); ig.index = blade.index; ig.setAttribute('position', blade.attributes.position);
  { const aP = new Float32Array(NB * 3), aR = new Float32Array(NB * 2), R = rng(5); for (let i = 0; i < NB; i++) { const x = (R() * 2 - 1) * GX, z = (R() * 2 - 1) * GZ; aP[i * 3] = x; aP[i * 3 + 1] = ground(x, z) - .02; aP[i * 3 + 2] = z; aR[i * 2] = R() * 6.283; aR[i * 2 + 1] = R(); } ig.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3)); ig.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 2)); ig.instanceCount = NB; }
  const amb = new THREE.Color(.2, .22, .27);
  const gm = new THREE.ShaderMaterial({ vertexShader: GRASS_VS, fragmentShader: GRASS_FS, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uG: { value: null }, uM: { value: uM }, uSun: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color() }, uAmb: { value: amb }, uWind: { value: new THREE.Vector2(.5, .25) } }]) });
  gm.uniforms.uG.value = gTex; gm.uniforms.uSun.value.copy(L.sun); gm.uniforms.uSunC.value.copy(new THREE.Color(1, .74, .45).multiplyScalar(1.6));
  const grass = new THREE.Mesh(ig, gm); grass.frustumCulled = false; scene.add(grass);

  /* woodland edge: broadleaf trees and bushes around the meadow */
  {
    const crownParts: THREE.BufferGeometry[] = [], R0 = rng(8), nn = noise2(31);
    for (let k = 0; k < 7; k++) { const g = new THREE.IcosahedronGeometry(1, 3); const a = k / 7 * 6.283; g.scale(.75, .62, .75); g.translate(Math.cos(a) * .55 * (k ? 1 : 0), (k ? .1 : .45) + R0() * .3, Math.sin(a) * .55 * (k ? 1 : 0)); crownParts.push(g.index ? g.toNonIndexed() : g); }
    const crown = mergeGeometries(crownParts)!; { const p = crown.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = 1 + nn(x * 2.2 + z, y * 2.2) * .22; p.setXYZ(i, x * d, y * d, z * d); const sh = .55 + .45 * clamp(y + .3, 0, 1); c[i * 3] = .1 * sh; c[i * 3 + 1] = .16 * sh; c[i * 3 + 2] = .045 * sh; } crown.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    const crownS = mergeVertices(crown, 1e-3); crownS.computeVertexNormals();
    const trunk = new THREE.CylinderGeometry(.08, .14, 1, 8); trunk.translate(0, .5, 0);
    const N = S.phone ? 150 : 260, cm = new THREE.InstancedMesh(crownS, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85 }), N), trm = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x3b2c20, roughness: .9 }), N);
    cm.castShadow = trm.castShadow = true; cm.receiveShadow = true;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(); let n = 0, guard = 0;
    while (n < N && guard++ < 20000) {
      const a = R0() * 6.283, r = 62 + R0() ** 1.5 * 150, x = Math.cos(a) * r * 1.15, z = Math.sin(a) * r * .9;
      if (Math.abs(x) < MX + 10 && Math.abs(z) < MZ + 10) continue;
      if (nn(x / 40, z / 40) < -.05 && r > 80) continue; /* clumps, with glades between */
      const hgt = 7 + R0() * 9, w = hgt * (.38 + R0() * .15), y = ground(x, z);
      q.setFromEuler(new THREE.Euler(0, R0() * 6.283, 0));
      m4.compose(p3.set(x, y - .2, z), q, s3.set(1 + hgt * .05, hgt * .45, 1 + hgt * .05)); trm.setMatrixAt(n, m4);
      m4.compose(p3.set(x, y + hgt * .52, z), q, s3.set(w, w * 1.05, w)); cm.setMatrixAt(n, m4); n++;
    }
    cm.count = trm.count = n; scene.add(cm, trm);
  }

  /* hares: one instanced mesh */
  const HMAX = 1500, hareM = new THREE.InstancedMesh(hareGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 }), HMAX);
  hareM.castShadow = true; hareM.frustumCulled = false; hareM.count = 0; scene.add(hareM);

  /* foxes: rigged and animated clones */
  const FMAX = S.phone ? 22 : 40;
  type FoxV = { o: THREE.Object3D; mix: THREE.AnimationMixer; act: Record<string, THREE.AnimationAction>; cur: string; yaw: number };
  const foxV: FoxV[] = []; let foxSrc: THREE.Object3D | null = null, clips: THREE.AnimationClip[] = [], foxScale = 1;
  const foxRoot = new THREE.Group(); scene.add(foxRoot);
  loadGLB('fox.glb').then((gl) => {
    foxSrc = gl.scene; clips = gl.animations;
    const box = new THREE.Box3().setFromObject(foxSrc), sz = box.getSize(new THREE.Vector3()); foxScale = 1.25 / Math.max(sz.x, sz.z);
    foxSrc.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; const mt = m.material as THREE.MeshStandardMaterial; mt.roughness = .75; } });
  }).catch(() => S.showHint(t('nofox', 'The fox model could not load; the meadow still runs')));
  function foxFor(i: number) {
    while (foxV.length <= i && foxSrc && foxV.length < FMAX) {
      const o = SkeletonUtils.clone(foxSrc); o.scale.setScalar(foxScale); foxRoot.add(o);
      const mix = new THREE.AnimationMixer(o), act: Record<string, THREE.AnimationAction> = {};
      for (const c of clips) { act[c.name] = mix.clipAction(c); }
      act.Walk?.play(); mix.setTime(Math.random() * 2);
      foxV.push({ o, mix, act, cur: 'Walk', yaw: 0 });
    }
    return foxV[i];
  }

  /* ---------- panel ---------- */
  const B = S.body;
  sec(B, t('h.live', 'Living meadow'));
  const info = stats(B, [['hares', t('hares', 'Hares')], ['foxes', t('foxes', 'Foxes')], ['grass', t('grass', 'Grass cover')], ['day', t('day', 'Day')]], true);
  const chartBox = el('div', { style: { position: 'relative', height: '150px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' } });
  const cv = el('canvas', { role: 'img', 'aria-label': t('chart', 'Population chart: hares and foxes over time, with the Lotka–Volterra model dashed'), style: { width: '100%', height: '100%', display: 'block' } }); chartBox.append(cv); B.append(chartBox);
  const legend = el('div', { style: { display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: 'rgba(255,255,255,.7)' } },
    el('span', {}, el('i', { style: { display: 'inline-block', width: '14px', height: '2px', background: '#f4efe2', verticalAlign: 'middle', marginRight: '6px' } }), t('lg.h', 'Hares')),
    el('span', {}, el('i', { style: { display: 'inline-block', width: '14px', height: '2px', background: '#f0803a', verticalAlign: 'middle', marginRight: '6px' } }), t('lg.f', 'Foxes')),
    el('span', {}, el('i', { style: { display: 'inline-block', width: '14px', height: '0', borderTop: '2px dashed rgba(255,255,255,.5)', verticalAlign: 'middle', marginRight: '6px' } }), t('lg.lv', 'Lotka–Volterra')));
  B.append(legend);
  sec(B, t('h.rules', 'Change the rules'));
  let speed = 5;
  slider(B, t('regrow', 'Grass regrowth'), { min: .002, max: .06, step: .002, value: M.P.regrow, fmt: (n) => (n * 100).toFixed(1) + '% / day' }, (v) => { M.P.regrow = v; });
  slider(B, t('hunt', 'Fox hunting skill'), { min: .2, max: 2, step: .1, value: M.P.hunt, fmt: (n) => '×' + n.toFixed(1) }, (v) => { M.P.hunt = v; });
  slider(B, t('speed', 'Days per second'), { min: 1, max: 30, step: 1, value: speed, fmt: (n) => String(n) }, (v) => { speed = v; });
  segs(B, t('edge', 'Neighbouring land'), [['open', t('edge.open', 'Animals wander in')], ['shut', t('edge.shut', 'Fenced off')]], 'open', (v) => { M.imm = v === 'open'; });
  btns(B, [
    [t('addF', 'Release 10 foxes'), () => { for (let i = 0; i < 10; i++) M.foxes.push(M.mk(M.R() * GW, M.R() * GH, 12)); }],
    [t('addH', 'Release 50 hares'), () => { for (let i = 0; i < 50; i++) M.hares.push(M.mk(M.R() * GW, M.R() * GH, 5)); }],
  ]);
  btns(B, [[t('cull', 'Remove all foxes'), () => { M.foxes = []; }], [t('reset', 'Restart'), () => { M.reset(); upGrass(); }, true]]);
  para(B, t('how', 'Hares gain energy from grass and foxes from hares; both spend it moving. With food to spare they breed. More hares feed more foxes, the foxes eat the hares down and then starve, and the hares recover. Grazed patches turn short and dry, then grow back.'));
  para(B, t('lv', 'The dashed lines are the Lotka–Volterra equations, dH/dt = aH − bHF and dF/dt = dHF − cF. The living meadow adds grass, space and chance, so its cycles are messier, like real ones.'));

  function drawChart() {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const q = cv.getContext('2d')!; q.setTransform(dpr, 0, 0, dpr, 0, 0); q.clearRect(0, 0, w, h);
    const hist = M.hist, lv = M.lv, mxH = Math.max(50, ...hist.map((p) => p[0]), ...lv.map((p) => p[0])), mxF = Math.max(10, ...hist.map((p) => p[1]), ...lv.map((p) => p[1]));
    q.strokeStyle = 'rgba(255,255,255,.06)'; q.lineWidth = 1; for (let i = 1; i < 4; i++) { q.beginPath(); q.moveTo(0, h * i / 4); q.lineTo(w, h * i / 4); q.stroke(); }
    const line = (arr: [number, number][], k: 0 | 1, mx: number, col: string, dash: number[]) => { q.strokeStyle = col; q.setLineDash(dash); q.lineWidth = 1.8; q.beginPath(); arr.forEach((p, i) => { const x = 8 + i / 600 * (w - 16), y = h - 10 - p[k] / mx * (h - 22); i ? q.lineTo(x, y) : q.moveTo(x, y); }); q.stroke(); q.setLineDash([]); };
    line(lv, 0, mxH, 'rgba(244,239,226,.38)', [4, 4]); line(lv, 1, mxF, 'rgba(240,128,58,.5)', [4, 4]);
    line(hist, 0, mxH, '#f4efe2', []); line(hist, 1, mxF, '#f0803a', []);
  }

  /* ---------- camera views ---------- */
  let follow: A | null = null; const lastFollow = new THREE.Vector3();
  const views: Record<string, [THREE.Vector3, THREE.Vector3]> = {
    meadow: [new THREE.Vector3(-9, 12, 47), new THREE.Vector3(0, 0, -6)],
    ground: [new THREE.Vector3(-6, 1.1, 34), new THREE.Vector3(2, .7, 10)],
    above: [new THREE.Vector3(0, 92, 2), new THREE.Vector3(0, 0, 0)],
  };
  if (S.phone) { views.meadow[0].set(-10, 17, 52); views.above[0].set(0, 130, 2); }
  const animalPos = (a: A, k: number, out: THREE.Vector3) => { const [x, z] = toW(lerp(a.px, a.x, k), lerp(a.py, a.y, k)); return out.set(x, ground(x, z), z); };
  let frac = 0;
  function view(v: string) {
    follow = null;
    if (v === 'fox') {
      const f = M.foxes.slice(0, FMAX).sort((a, b) => Math.hypot(a.x - GW / 2, a.y - GH / 2) - Math.hypot(b.x - GW / 2, b.y - GH / 2))[0];
      if (!f) { S.showHint(t('nofoxes', 'There are no foxes right now. Release some from the panel.')); return; }
      const p = animalPos(f, frac, new THREE.Vector3());
      S.flyTo(p.clone().add(new THREE.Vector3(-3.2, 2.1, 4.2)), p.clone().setY(p.y + .4), 2, () => { follow = f; lastFollow.copy(animalPos(f, frac, new THREE.Vector3())); });
      S.showCard(t('fox.h', 'Following a fox'), t('fox.p', 'Watch it hunt. When a hare is within about six metres it gives chase; it needs a catch every few days or it starves.'), 5000);
      return;
    }
    const [p, tt] = views[v]; S.flyTo(p, tt, 2.6);
  }
  const ch = chips(S, [['meadow', t('c.meadow', 'The meadow')], ['fox', t('c.fox', 'Follow a fox')], ['ground', t('c.ground', 'In the grass')], ['above', t('c.above', 'Bird\'s-eye')]], 'meadow', view);
  void ch;
  camera.position.set(-30, 40, 120); controls.target.set(0, 0, 0);
  S.setHome(views.meadow[0], views.meadow[1]);
  controls.maxPolarAngle = Math.PI * .495; controls.minDistance = 1.2; controls.maxDistance = 240;

  S.pick(() => [hareM, foxRoot], (hit) => {
    if (hit.object === hareM && hit.instanceId != null) { const r = M.hares[hit.instanceId]; if (r) S.showCard(t('hare', 'Hare'), `${t('energy', 'Energy')} ${r.e.toFixed(1)} · ${t('age', 'Age')} ${r.age} ${t('days', 'days')}`, 4000); return; }
    let o: THREE.Object3D | null = hit.object; while (o && o.parent !== foxRoot) o = o.parent;
    const i = foxV.findIndex((v) => v.o === o), f = M.foxes[i];
    if (f) { S.showCard(t('fox', 'Fox'), `${t('energy', 'Energy')} ${f.e.toFixed(1)} · ${t('age', 'Age')} ${f.age} ${t('days', 'days')} · ${f.chase ? t('hunting', 'hunting') : t('roaming', 'roaming')}`, 4000); }
  });

  /* ---------- run ---------- */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(1, 1, 1), p3 = new THREE.Vector3(), e3 = new THREE.Euler(), up = new THREE.Vector3();
  let acc = 0, uiAcc = 0, shown = '';
  S.onFrame((dt, time) => {
    gm.uniforms.uT.value = time;
    acc += dt * speed * (ctx.calm ? .4 : 1); let n = 0; while (acc >= 1 && n < 6) { acc -= 1; M.tick(); n++; } if (n) upGrass(); if (acc > 1) acc = 1;
    frac = acc;
    /* hares: hop between their daily positions */
    const H = M.hares, nh = Math.min(H.length, HMAX);
    for (let i = 0; i < nh; i++) {
      const r = H[i]; animalPos(r, frac, p3);
      const hop = Math.abs(Math.sin((frac + r.id * .37) * Math.PI * 3)) * .14;
      const yaw = Math.atan2(r.x - r.px, r.y - r.py);
      p3.y += hop; e3.set(-hop * 1.4, isFinite(yaw) ? yaw : 0, 0); q.setFromEuler(e3);
      s3.setScalar(1.15 + (r.id % 7) * .05 + Math.min(.25, r.age / 300)); m4.compose(p3, q, s3); hareM.setMatrixAt(i, m4);
    }
    hareM.count = nh; hareM.instanceMatrix.needsUpdate = true;
    /* foxes */
    const F = M.foxes, nf = Math.min(F.length, FMAX);
    for (let i = 0; i < nf; i++) {
      const f = F[i], v = foxFor(i); if (!v) break;
      v.o.visible = true; animalPos(f, frac, v.o.position);
      const want = Math.atan2(f.x - f.px, f.y - f.py); let d = want - v.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); v.yaw += d * Math.min(1, dt * 8); v.o.rotation.y = v.yaw;
      const ms = Math.hypot(f.x - f.px, f.y - f.py) * CELL * speed; /* metres per second on screen */
      const clip = ms > 4.5 ? 'Run' : ms > .2 ? 'Walk' : 'Survey';
      if (clip !== v.cur && v.act[clip]) { v.act[clip].reset().play(); v.act[v.cur]?.crossFadeTo(v.act[clip], .3, false); v.cur = clip; }
      v.act[v.cur]?.setEffectiveTimeScale(clip === 'Run' ? clamp(ms / 7, .6, 1.8) : clip === 'Walk' ? clamp(ms / 1.3, .5, 2.5) : 1);
      v.mix.update(dt);
    }
    for (let i = nf; i < foxV.length; i++) foxV[i].o.visible = false;
    /* follow cam: carry the camera along with the fox */
    if (follow) {
      if (!M.foxes.includes(follow)) { follow = null; S.showHint(t('lost', 'That fox has died. Pick "Follow a fox" again.')); }
      else { animalPos(follow, frac, up); const dlt = up.clone().sub(lastFollow); camera.position.add(dlt); controls.target.add(dlt); lastFollow.copy(up); }
    }
    if ((uiAcc += dt) > .25) {
      uiAcc = 0; let gs = 0; for (const v of M.grass) gs += v;
      info('hares', String(H.length)); info('foxes', F.length > FMAX ? `${F.length} (${FMAX} ${t('shown', 'shown')})` : String(F.length)); info('grass', `${Math.round(gs / M.grass.length * 100)}%`); info('day', String(M.day));
      drawChart();
      const msg = !F.length ? 'nofox2' : !H.length ? 'nohare' : '';
      if (msg !== shown) { shown = msg; if (msg === 'nofox2') S.showHint(t('nofox2', 'The foxes died out: hares now boom until the grass runs short'), 4000); if (msg === 'nohare') S.showHint(t('nohare', 'No hares left: the foxes will starve'), 4000); }
    }
  });
  S.flyTo(views.meadow[0], views.meadow[1], 3.2);
  S.start();
}
