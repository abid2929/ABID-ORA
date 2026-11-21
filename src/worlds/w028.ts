/* 017 · Ocean World (site world 028). A real open ocean you can sail over and dive into.
   The sea surface is a sum of Gerstner waves whose wavelength and speed come from the linear
   dispersion relation ω² = g·k·tanh(k·h) (the Wave Lab maths of world 028), so changing the period,
   height, water depth or the wind really reshapes the sea. A buoy rides the swell and draws the
   circular orbit a water particle follows. Dive below and the light changes the way it does in real
   water: each colour fades with depth by the Beer–Lambert law (world 033's measured coefficients),
   caustics dance on the sand, a school of barramundi circles the reef, and a gauge shows pressure,
   temperature, ocean zone and how much red, green and blue light is left.
   Fish model: Barramundi Fish by Microsoft (CC0), via the Khronos glTF Sample Assets. */
import type { Ctx } from './kit';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { waveNumber, windWaves } from './w028lab';
import { WATER, transmit, pressure, tempAt } from './w033';
import { THREE, stage, daylight, sec, para, slider, segs, stats, chips, btns, canvasTex, GLSL_NOISE, loadGLB, rng, clamp, lerp, noise2 } from './nskit';

const G = 9.81, NW = 8;

/* the wave set: one dominant swell from the physics, plus seven shorter wind waves around it */
function waveSet(T: number, H: number, depth: number, dir: number) {
  const R = rng(11), out: { dx: number; dz: number; k: number; A: number; w: number; Q: number; ph: number }[] = [];
  const fr = [1, .78, .62, .5, .41, .33, .27, .21], am = [1, .42, .3, .22, .15, .1, .07, .05], an = [0, .45, -.55, .9, -1.05, .25, -.3, 1.3];
  let sumA = 0;
  for (let i = 0; i < NW; i++) {
    const Ti = T * fr[i], k = waveNumber(Ti, depth), w = 2 * Math.PI / Ti, A = H / 2 * am[i] * (i ? .9 : 1);
    const a = dir + an[i];
    out.push({ dx: Math.cos(a), dz: Math.sin(a), k, A, w, Q: 0, ph: R() * 6.283 }); sumA += k * A;
  }
  /* steepness: as sharp as possible without loops (Σ Q·k·A < 1) */
  const q = Math.min(.82, .9 / Math.max(sumA, 1e-6));
  out.forEach((o) => { o.Q = q; });
  return out;
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 17 · Nature'), title: t('title', 'Ocean World'), sub: t('sub', 'A living sea built from real wave physics. Sail the swell, then dive to the reef.'),
    acc: '#5fd4e6', ink: '#020b14', hf: "'Fraunces'", fov: 50, near: .1, far: 6000,
    lab: () => import('./w028lab'), labName: t('lab', 'Wave Lab (side view)'),
  });
  const { scene, camera, controls, renderer } = S;
  
  const P = { mode: 'swell', T: 8, H: 1.6, depth: 30, U: 14, fetch: 120, sun: 30, dir: .35 };

  /* ---- light ---- */
  const day = daylight(S, { elev: P.sun, azim: 150, size: 5000 });
  const sunL = new THREE.DirectionalLight(0xfff2dc, 3.2); scene.add(sunL, sunL.target);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x0b2a3a, .35); scene.add(hemi);

  /* ---- ocean surface: dense near the camera, sparse to the horizon ---- */
  const N = S.phone ? 220 : 320, R0 = 2600;
  const geo = new THREE.PlaneGeometry(2, 2, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2.6) * R0; pos.setXYZ(i, f(x), 0, f(z)); }
  geo.computeBoundingSphere(); geo.boundingSphere!.radius = R0 * 2;
  const uniforms = { uTime: { value: 0 }, uA: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uB: { value: Array.from({ length: NW }, () => new THREE.Vector4()) }, uUnder: { value: 0 } };
  /* tileable ripple normals (integer frequencies so the tile repeats seamlessly) */
  const nrm = canvasTex(512, 512, (g, w) => {
    const R = rng(5), waves = Array.from({ length: 26 }, () => ({ fx: Math.round((R() - .5) * 18), fy: Math.round((R() - .5) * 18), p: R() * 6.28, a: .4 + R() })).filter((v) => v.fx || v.fy);
    const hgt = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { let s = 0; for (const v of waves) s += Math.sin((v.fx * x + v.fy * y) / w * 6.2832 + v.p) * v.a / Math.hypot(v.fx, v.fy); hgt[y * w + x] = s; }
    const im = g.createImageData(w, w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
      const hx = hgt[y * w + (x + 1) % w] - hgt[y * w + (x + w - 1) % w], hy = hgt[((y + 1) % w) * w + x] - hgt[((y + w - 1) % w) * w + x];
      const nx = -hx * 3, ny = -hy * 3, nz = 1, l = Math.hypot(nx, ny, nz), i = (y * w + x) * 4;
      im.data[i] = (nx / l * .5 + .5) * 255; im.data[i + 1] = (ny / l * .5 + .5) * 255; im.data[i + 2] = (nz / l * .5 + .5) * 255; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, { srgb: false });
  nrm.wrapS = nrm.wrapT = THREE.RepeatWrapping; nrm.repeat.set(90, 90);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x032a3d, envMapIntensity: .7, roughness: .15, metalness: 0, ior: 1.333, specularIntensity: 1, normalMap: nrm, normalScale: new THREE.Vector2(.22, .22), side: THREE.DoubleSide });
  water.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec4 uA[${NW}]; uniform vec4 uB[${NW}];
varying float vFoam; varying float vH; varying vec3 vWP;
void gerst(vec3 p, out vec3 off, out vec3 n, out float jac){
  off=vec3(0.); vec3 nn=vec3(0.,1.,0.); jac=1.;
  for(int i=0;i<${NW};i++){ vec4 a=uA[i]; vec4 b=uB[i];
    float ph=a.z*(a.x*p.x+a.y*p.z)-b.x*uTime+b.z; float c=cos(ph), s=sin(ph);
    off.x+=b.y*a.w*a.x*c; off.z+=b.y*a.w*a.y*c; off.y+=a.w*s;
    nn.x-=a.x*a.z*a.w*c; nn.z-=a.y*a.z*a.w*c; nn.y-=b.y*a.z*a.w*s; jac-=b.y*a.z*a.w*s; }
  n=normalize(nn);
}`).replace('#include <beginnormal_vertex>', `vec3 wp0=(modelMatrix*vec4(position,1.)).xyz; vec3 gOff; vec3 gN; float gJ;
  float fade=1.-smoothstep(900.,2400.,length(wp0.xz-cameraPosition.xz));
  gerst(wp0,gOff,gN,gJ); gOff*=fade; gN=normalize(mix(vec3(0.,1.,0.),gN,fade));
  vec3 objectNormal=gN;
  #ifdef USE_TANGENT
  vec3 objectTangent=vec3(tangent.xyz);
  #endif`).replace('#include <begin_vertex>', `vec3 transformed=position+gOff; vFoam=clamp(1.-gJ,0.,1.)*fade; vH=gOff.y; vWP=wp0+gOff;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform float uUnder; varying float vFoam; varying float vH; varying vec3 vWP;
${GLSL_NOISE}`).replace('#include <color_fragment>', `#include <color_fragment>
  float crest=smoothstep(.45,.95,vFoam);
  float fn=snoise(vec3(vWP.xz*.35,uTime*.25))*.5+.5; float fn2=snoise(vec3(vWP.xz*1.7,uTime*.4))*.5+.5;
  float foam=crest*smoothstep(.35,.75,fn*.7+fn2*.5);
  /* light through thin crests turns them green-blue */
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.03,.32,.36),clamp(vH*.22+.1,0.,.55));
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.92,.94),foam*.85);`).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor=mix(roughnessFactor,.7,foam);`).replace('#include <opaque_fragment>', `
  if(!gl_FrontFacing){ /* seen from below: the bright Snell window and total internal reflection */
    vec3 V=normalize(cameraPosition-vWP); float up=clamp(-V.y,0.,1.);
    outgoingLight=mix(vec3(.02,.17,.24),vec3(.55,.85,.92),smoothstep(.62,.8,up))*(.6+.4*fn);
  }
  #include <opaque_fragment>`);
  };
  const sea = new THREE.Mesh(geo, water); sea.frustumCulled = false; scene.add(sea);

  /* ---- buoy that rides one water particle, and the orbit it draws ---- */
  const buoy = new THREE.Group();
  const bodyM = new THREE.MeshStandardMaterial({ color: 0xff4a2a, roughness: .45, metalness: .05 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: .5 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: .4, metalness: .7 });
  const b1 = new THREE.Mesh(new THREE.SphereGeometry(.9, 48, 24, 0, Math.PI * 2, 0, Math.PI * .62), bodyM); b1.rotation.x = Math.PI; b1.position.y = .25;
  const b2 = new THREE.Mesh(new THREE.CylinderGeometry(.9, .9, .35, 48), whiteM); b2.position.y = .38;
  const b3 = new THREE.Mesh(new THREE.CylinderGeometry(.14, .2, 2.2, 16), bodyM); b3.position.y = 1.6;
  const b4 = new THREE.Mesh(new THREE.ConeGeometry(.35, .6, 24), darkM); b4.position.y = 2.9;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe2a0 })); lamp.position.y = 3.3;
  buoy.add(b1, b2, b3, b4, lamp); buoy.traverse((o) => { o.castShadow = true; }); scene.add(buoy);
  const orbitPts = new Float32Array(128 * 3), orbitGeo = new THREE.BufferGeometry(); orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPts, 3));
  const orbit = new THREE.Line(orbitGeo, new THREE.LineBasicMaterial({ color: 0xfff1c7, transparent: true, opacity: .8 })); scene.add(orbit);

  /* CPU copy of the shader's wave sum (for the buoy and for knowing when the camera is under water) */
  let W = waveSet(P.T, P.H, P.depth, P.dir);
  function surf(x: number, z: number, tm: number) {
    let ox = 0, oy = 0, oz = 0, nx = 0, ny = 1, nz = 0;
    for (const w of W) { const ph = w.k * (w.dx * x + w.dz * z) - w.w * tm + w.ph, c = Math.cos(ph), s = Math.sin(ph); ox += w.Q * w.A * w.dx * c; oz += w.Q * w.A * w.dz * c; oy += w.A * s; nx -= w.dx * w.k * w.A * c; nz -= w.dz * w.k * w.A * c; ny -= w.Q * w.k * w.A * s; }
    return { x: x + ox, y: oy, z: z + oz, n: new THREE.Vector3(nx, ny, nz).normalize() };
  }
  /* height of the surface above a fixed point (one fixed-point step backwards for the horizontal shift) */
  function heightAt(x: number, z: number, tm: number) { let p = surf(x, z, tm); p = surf(x - (p.x - x), z - (p.z - z), tm); return p.y; }
  function pushWaves() { W.forEach((w, i) => { uniforms.uA.value[i].set(w.dx, w.dz, w.k, w.A); uniforms.uB.value[i].set(w.w, w.Q, w.ph, 0); }); }
  pushWaves();

  /* ---- under water ---- */
  const under = new THREE.Group(); scene.add(under);
  const caustU = { uTime: uniforms.uTime, uDepthK: { value: new THREE.Vector3(...WATER.ocean) } };
  function caustics(m: THREE.MeshStandardMaterial, vtx = '') {
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, caustU);
      if (vtx) sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', vtx);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vCW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCW=(modelMatrix*vec4(transformed,1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform float uTime; uniform vec3 uDepthK; varying vec3 vCW;
${GLSL_NOISE}
float caus(vec2 p,float t){ float a=snoise(vec3(p*.55,t*.6)); float b=snoise(vec3(p*.55+3.1,t*.6+7.)); return pow(1.-abs(a),7.)+pow(1.-abs(b),7.)*.7; }`)
        .replace('#include <opaque_fragment>', `
  float d=max(0.,-vCW.y); vec3 tr=exp(-uDepthK*d);
  float up=clamp(normal.y*.5+.5,0.,1.);
  vec3 c=vec3(caus(vCW.xz,uTime),caus(vCW.xz+.06,uTime),caus(vCW.xz+.12,uTime));
  outgoingLight=outgoingLight*tr*1.5+c*tr*2.2*smoothstep(.45,1.,up)*diffuseColor.rgb;
  #include <opaque_fragment>`);
    };
    return m;
  }
  /* sand: dunes and ripples */
  const nz = noise2(3), sandSize = 420;
  const sandGeo = new THREE.PlaneGeometry(sandSize, sandSize, S.phone ? 160 : 240, S.phone ? 160 : 240); sandGeo.rotateX(-Math.PI / 2);
  const sp = sandGeo.attributes.position as THREE.BufferAttribute;
  const bedY = (x: number, z: number) => nz(x * .012, z * .012) * 4 + nz(x * .05, z * .05) * .8 + Math.sin(x * .9 + nz(x * .03, z * .03) * 4) * .08;
  for (let i = 0; i < sp.count; i++) sp.setY(i, bedY(sp.getX(i), sp.getZ(i)));
  sandGeo.computeVertexNormals();
  const sandTex = canvasTex(1024, 1024, (g, w) => {
    const im = g.createImageData(w, w), R = rng(9), n1 = noise2(4);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = n1(x / 60, y / 60) * .5 + .5, gr = R(); const v = 168 + n * 40 + (gr - .5) * 46 + (gr > .985 ? 50 : 0); im.data[i] = v; im.data[i + 1] = v * .93; im.data[i + 2] = v * .78; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0);
  }, { repeat: 40 });
  const sand = new THREE.Mesh(sandGeo, caustics(new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 })));
  sand.receiveShadow = true; under.add(sand);
  /* rocks and reef */
  const rockTex = canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w), n1 = noise2(8), n2 = noise2(9); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, a = n1(x / 40, y / 40) * .5 + .5, b = n2(x / 9, y / 9) * .5 + .5, v = 70 + a * 70 + b * 40; im.data[i] = v * 1.02; im.data[i + 1] = v * .98; im.data[i + 2] = v * .88; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: 2 });
  const rockM = caustics(new THREE.MeshStandardMaterial({ map: rockTex, color: 0xb8ad98, roughness: .95 }));
  const R = rng(21), rocks: THREE.Mesh[] = [];
  function rockGeo(seed: number, r: number) {
    const gg = new THREE.IcosahedronGeometry(r, S.phone ? 4 : 5), q = gg.attributes.position as THREE.BufferAttribute, nn = noise2(seed);
    for (let i = 0; i < q.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(q, i), d = 1 + nn(v.x * .8 + seed, v.y * .8 + v.z * .5) * .35 + nn(v.x * 3, v.z * 3 + v.y) * .08; v.multiplyScalar(d); v.y *= .62; q.setXYZ(i, v.x, v.y, v.z); }
    const mg = mergeVertices(gg); mg.computeVertexNormals(); return mg;
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * 6.283, d = 8 + R() * 70, x = Math.cos(a) * d, z = Math.sin(a) * d, r = 1 + R() * 3.8;
    const m = new THREE.Mesh(rockGeo(i * 7 + 1, r), rockM); m.position.set(x, bedY(x, z) + r * .15, z); m.rotation.y = R() * 6; m.castShadow = m.receiveShadow = true; under.add(m); rocks.push(m);
  }
  /* branching corals: each branch a tapered tube, merged per colony, coloured per vertex */
  const coralM = caustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8 }));
  const COLS = [0xff7a59, 0xf2a0c9, 0xb48cff, 0xffc36b, 0xe8604c, 0x9de0c8];
  async function makeCorals() {
    for (let c = 0; c < (S.phone ? 22 : 34); c++) {
      const parts: THREE.BufferGeometry[] = [], col = new THREE.Color(COLS[c % COLS.length]), cr = rng(c + 100);
      const grow = (p: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, lvl: number) => {
        const end = p.clone().addScaledVector(dir, len);
        const g2 = new THREE.CylinderGeometry(rad * .7, rad, len, 7, 1); g2.translate(0, len / 2, 0);
        g2.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)); g2.translate(p.x, p.y, p.z);
        const cc = col.clone().offsetHSL(0, 0, (lvl - 2) * .04); const n = g2.attributes.position.count, arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) cc.toArray(arr, i * 3);
        g2.setAttribute('color', new THREE.BufferAttribute(arr, 3)); parts.push(g2.toNonIndexed());
        if (lvl > 0) for (let k = 0; k < 2 + (cr() > .5 ? 1 : 0); k++) { const nd = dir.clone().add(new THREE.Vector3((cr() - .5) * 1.3, cr() * .3, (cr() - .5) * 1.3)).normalize(); grow(end, nd, len * (.7 + cr() * .15), rad * .72, lvl - 1); }
        else { const tip = new THREE.SphereGeometry(rad * 1.1, 8, 6); tip.translate(end.x, end.y, end.z); const n2 = tip.attributes.position.count, a2 = new Float32Array(n2 * 3); for (let i = 0; i < n2; i++) col.clone().offsetHSL(0, .05, .12).toArray(a2, i * 3); tip.setAttribute('color', new THREE.BufferAttribute(a2, 3)); parts.push(tip.toNonIndexed()); }
      };
      grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), .5 + cr() * .4, .12, 4);
      const merged = mergeGeometries(parts.map((p) => { p.deleteAttribute('uv'); return p; })); parts.forEach((p) => p.dispose());
      const m = new THREE.Mesh(merged, coralM);
      const a = cr() * 6.283, d = 4 + cr() * 38, x = Math.cos(a) * d, z = Math.sin(a) * d, sc = .8 + cr() * 1.6;
      m.position.set(x, bedY(x, z) - .1, z); m.scale.setScalar(sc); m.rotation.y = cr() * 6; m.castShadow = true; under.add(m);
    }
  }
  /* kelp: tall ribbons that sway with the swell */
  const kelpU = { uTime: uniforms.uTime };
  const kelpM = new THREE.MeshStandardMaterial({ color: 0x5f7a2a, roughness: .7, side: THREE.DoubleSide, transparent: true, opacity: .95 });
  kelpM.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, kelpU); sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace('#include <begin_vertex>', `vec3 transformed=position; float hh=position.y; vec4 iw=instanceMatrix[3]; float s=sin(uTime*.8+iw.x*.3+hh*.25)*hh*.06+sin(uTime*1.7+iw.z*.2+hh*.5)*hh*.02; transformed.x+=s; transformed.z+=s*.6;`); };
  const kelpG = new THREE.PlaneGeometry(1.1, 14, 1, 40); kelpG.translate(0, 7, 0);
  { const kp = kelpG.attributes.position as THREE.BufferAttribute; for (let i = 0; i < kp.count; i++) { const y = kp.getY(i); kp.setX(i, kp.getX(i) * (1 + Math.sin(y * 2.3) * .5) * (1 - y / 16)); } }
  const kelp = new THREE.InstancedMesh(kelpG, kelpM, S.phone ? 90 : 160); { const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); for (let i = 0; i < kelp.count; i++) { const a = R() * 6.283, d = 30 + R() * 60, x = Math.cos(a) * d - 20, z = Math.sin(a) * d - 30; q.setFromEuler(new THREE.Euler(0, R() * 6, 0)); m4.compose(new THREE.Vector3(x, bedY(x, z), z), q, new THREE.Vector3(1, .6 + R() * .9, 1)); kelp.setMatrixAt(i, m4); } }
  under.add(kelp);
  /* light shafts */
  const shaftTex = canvasTex(64, 256, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh); const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, hh); });
  const shaftM = new THREE.MeshBasicMaterial({ map: shaftTex, color: 0x9fe6ff, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const shafts = new THREE.Group(); for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2 + R() * 5, 46), shaftM); m.position.set((R() - .5) * 60, -23, (R() - .5) * 60); m.rotation.set(0, R() * 3, .18); shafts.add(m); } under.add(shafts);
  /* marine snow */
  const snowN = 2500, snowP = new Float32Array(snowN * 3); for (let i = 0; i < snowN; i++) { snowP[i * 3] = (R() - .5) * 80; snowP[i * 3 + 1] = R() * 40; snowP[i * 3 + 2] = (R() - .5) * 80; }
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(snowP, 3));
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ color: 0xcfefff, size: .06, transparent: true, opacity: .55, depthWrite: false })); under.add(snow);

  /* fish school: instanced barramundi, steered as a boids flock around a wandering point */
  let fish: THREE.InstancedMesh | null = null; const FN = S.phone ? 46 : 80;
  const fp = Array.from({ length: FN }, () => ({ p: new THREE.Vector3((R() - .5) * 10, 7 + (R() - .5) * 4, (R() - .5) * 10), v: new THREE.Vector3(R() - .5, 0, R() - .5).normalize().multiplyScalar(2), s: .9 + R() * .5 }));
  loadGLB('fish.glb').then((gl) => {
    let src: THREE.Mesh | null = null; gl.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && !src) src = o as THREE.Mesh; });
    if (!src) return; const sm = src as THREE.Mesh;
    const g2 = sm.geometry.clone(); g2.applyMatrix4(sm.matrixWorld); g2.center(); g2.scale(2.2, 2.2, 2.2);
    const m = (sm.material as THREE.MeshStandardMaterial).clone();
    caustics(m as THREE.MeshStandardMaterial, `vec3 transformed=position; float tl=smoothstep(.15,-.75,position.z); vec4 iw=instanceMatrix[3]; transformed.x+=sin(uTime*9.+position.z*5.+iw.x*1.7+iw.z)*.12*tl;`);
    fish = new THREE.InstancedMesh(g2, m, FN); fish.castShadow = true; fish.frustumCulled = false; under.add(fish);
  }).catch(() => { /* the reef still works without the fish */ });
  const goal = new THREE.Vector3(), tmp = new THREE.Vector3(), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), zAx = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3();
  function flock(dt: number, tm: number) {
    if (!fish) return;
    goal.set(Math.sin(tm * .11) * 16, Math.min(P.depth - 3, 6 + Math.sin(tm * .23) * 2.5), Math.cos(tm * .09) * 12);
    for (let i = 0; i < FN; i++) {
      const f = fp[i]; tmp.copy(goal).sub(f.p).multiplyScalar(.12); f.v.addScaledVector(tmp, dt);
      for (let j = 0; j < FN; j += 3) { if (j === i) continue; tmp.copy(f.p).sub(fp[j].p); const d = tmp.length(); if (d < 1.4 && d > 0) f.v.addScaledVector(tmp, (1.4 - d) * 2.2 * dt / d); }
      const sp2 = f.v.length(), tgt = 2.4 * f.s; f.v.multiplyScalar(lerp(1, tgt / Math.max(sp2, .01), .05));
      f.p.addScaledVector(f.v, dt);
      const by = bedY(f.p.x, f.p.z) + 1.5; if (f.p.y < by) f.p.y = by;
      qq.setFromUnitVectors(zAx, tmp.copy(f.v).normalize()); sc.setScalar(f.s); m4.compose(f.p, qq, sc); fish.setMatrixAt(i, m4);
    }
    fish.instanceMatrix.needsUpdate = true;
  }

  /* ---- panel ---- */
  const B = S.body;
  const info = stats(B, [['L', t('L', 'Wavelength')], ['c', t('c', 'Wave speed')], ['H', t('H', 'Wave height')], ['T', t('T', 'Period')]], true);
  sec(B, t('s.waves', 'The sea'));
  para(B, t('p.waves', 'Every wave here obeys ω² = g·k·tanh(k·h). Longer periods make longer, faster waves; shallow water slows them down.'));
  const modeSeg = segs(B, '', [['swell', t('swell', 'Ocean swell')], ['wind', t('wind', 'Wind sea')]], P.mode, (v) => { P.mode = v; showRows(); rebuild(); });
  const swellBox = document.createElement('div'), windBox = document.createElement('div');
  swellBox.style.cssText = windBox.style.cssText = 'display:flex;flex-direction:column;gap:12px';
  const sT = slider(swellBox, t('r.T', 'Wave period'), { min: 3, max: 18, step: .5, value: P.T, fmt: (v) => v.toFixed(1) + ' s' }, (v) => { P.T = v; rebuild(); });
  const sH = slider(swellBox, t('r.H', 'Wave height'), { min: .2, max: 6, step: .1, value: P.H, fmt: (v) => v.toFixed(1) + ' m' }, (v) => { P.H = v; rebuild(); });
  slider(windBox, t('r.U', 'Wind speed'), { min: 3, max: 30, step: 1, value: P.U, fmt: (v) => `${v} m/s · ${Math.round(v * 3.6)} km/h` }, (v) => { P.U = v; rebuild(); });
  slider(windBox, t('r.F', 'Fetch (open water upwind)'), { min: 5, max: 800, step: 5, value: P.fetch, fmt: (v) => v + ' km' }, (v) => { P.fetch = v; rebuild(); });
  B.append(swellBox, windBox);
  const sD = slider(B, t('r.D', 'Water depth'), { min: 4, max: 60, step: 1, value: P.depth, fmt: (v) => v + ' m' }, (v) => { P.depth = v; rebuild(); placeBed(); });
  const showRows = () => { swellBox.style.display = P.mode === 'swell' ? 'flex' : 'none'; windBox.style.display = P.mode === 'wind' ? 'flex' : 'none'; };
  showRows();
  const info2 = stats(B, [['cg', t('cg', 'Energy speed')], ['type', t('type', 'Water is')]]);
  sec(B, t('s.sun', 'Sun'));
  slider(B, t('r.sun', 'Sun height'), { min: 1, max: 70, step: 1, value: P.sun, fmt: (v) => v + '°' }, (v) => { P.sun = v; setSun(); });
  sec(B, t('s.dive', 'Dive'));
  para(B, t('p.dive', 'Water swallows red light first, then orange and green. Only blue reaches the deep.'));
  const sDive = slider(B, t('r.dive', 'Your depth'), { min: 0, max: 60, step: 1, value: 0, fmt: (v) => v + ' m' }, (v) => { diveTo(v); });
  const gauge = stats(B, [['p', t('g.p', 'Pressure')], ['tC', t('g.t', 'Water temperature')], ['rgb', t('g.rgb', 'Red · green · blue left')], ['zone', t('g.zone', 'Zone')]]);
  btns(B, [[t('b.calm', 'Calm morning'), () => preset(6, .5, 8)], [t('b.storm', 'Storm swell'), () => preset(14, 5.5, 4)], [t('b.shallow', 'Shallow bay'), () => { sD.set(6, true); }]]);
  function preset(T: number, H: number, sun: number) { P.mode = 'swell'; modeSeg.set('swell'); showRows(); sT.set(T); sH.set(H); P.T = T; P.H = H; P.sun = sun; setSun(); rebuild(); }

  function rebuild() {
    const wp = P.mode === 'wind' ? windWaves(P.U, P.fetch) : { tp: P.T, hs: P.H };
    const T = wp.tp, H = wp.hs, k = waveNumber(T, P.depth), Lw = 2 * Math.PI / k, c = Lw / T, n = .5 * (1 + 2 * k * P.depth / Math.sinh(2 * k * P.depth));
    W = waveSet(T, H, P.depth, P.dir); pushWaves();
    info('L', `${Lw.toFixed(0)} m`); info('c', `${(c * 3.6).toFixed(0)} km/h`); info('H', `${H.toFixed(1)} m`); info('T', `${T.toFixed(1)} s`);
    info2('cg', `${(c * n).toFixed(1)} m/s`); const r = P.depth / Lw; info2('type', r > .5 ? t('deep', 'deep') : r < .05 ? t('shallow', 'shallow') : t('inter', 'in between'));
  }
  function setSun() {
    day.set(P.sun, 150); const s = day.sun; sunL.position.copy(s).multiplyScalar(300); sunL.intensity = 3 * clamp(P.sun / 12, .25, 1);
    sunL.color.setHSL(.09, clamp(1 - P.sun / 40, .2, .9), .6 + clamp(P.sun / 120, 0, .3));
    renderer.toneMappingExposure = .85;
  }
  function placeBed() { under.position.y = -P.depth; shafts.position.y = P.depth; }
  rebuild(); setSun(); placeBed();

  /* ---- camera states ---- */
  const surfCam = { p: new THREE.Vector3(-30, 7, 40), t: new THREE.Vector3(6, 5, 0) };
  camera.position.set(-120, 60, 160); controls.target.copy(surfCam.t);
  S.setHome(surfCam.p, surfCam.t);
  controls.maxDistance = 600; controls.minDistance = 4;
  function diveTo(d: number) {
    if (d <= 0) { S.flyTo(surfCam.p, surfCam.t, 2.2); return; }
    const y = -Math.min(d, P.depth - 1.5);
    S.flyTo(new THREE.Vector3(-14, y + 1.5, 20), new THREE.Vector3(2, y - (d > P.depth - 6 ? 1 : 3), 0), 2.6);
  }
  chips(S, [['surface', t('c.surface', 'Surface')], ['dive', t('c.dive', 'Dive')], ['reef', t('c.reef', 'Reef floor')], ['buoy', t('c.buoy', 'Follow the buoy')]], 'surface', (v) => {
    follow = v === 'buoy';
    if (v === 'surface') { sDive.set(0); diveTo(0); }
    if (v === 'dive') { sDive.set(12); diveTo(12); }
    if (v === 'reef') { sDive.set(P.depth); diveTo(P.depth); }
    if (v === 'buoy') S.flyTo(new THREE.Vector3(9, 5, 12), new THREE.Vector3(0, 1, 0), 1.8);
  });
  let follow = false;

  /* ---- frame ---- */
  const col = new THREE.Color(), fogC = new THREE.Color(), skyFog = new THREE.FogExp2(0xa9c6d6, .00055), waterFog = new THREE.FogExp2(0x0a4a60, .04);
  scene.fog = skyFog; let wasUnder = false; let lastGauge = -1;
  S.onFrame((dt, tm) => {
    const time = tm * (ctx.calm ? .4 : 1); uniforms.uTime.value = time;
    nrm.offset.x = time * .004; nrm.offset.y = time * .0025;
    sea.position.set(Math.round(camera.position.x / 8) * 8, 0, Math.round(camera.position.z / 8) * 8);
    /* buoy rides the particle that rests at (0,0) */
    const b = surf(0, 0, time); buoy.position.set(b.x, b.y - .1, b.z); buoy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.n);
    for (let i = 0; i < 128; i++) { const q = surf(0, 0, time - i / 127 * (2 * Math.PI / W[0].w)); orbitPts.set([q.x, q.y + .25, q.z], i * 3); }
    orbitGeo.attributes.position.needsUpdate = true;
    if (follow) controls.target.lerp(buoy.position, .08);
    /* surface or under water? */
    const wl = heightAt(camera.position.x, camera.position.z, time), uw = camera.position.y < wl - .05, depth = Math.max(0, wl - camera.position.y);
    if (uw !== wasUnder) { wasUnder = uw; scene.fog = uw ? waterFog : skyFog; day.sky.visible = !uw; orbit.visible = !uw; uniforms.uUnder.value = uw ? 1 : 0; }
    under.visible = uw;
    if (uw) {
      const tr = transmit(WATER.ocean, depth + 2), sunK = clamp(P.sun / 30, .25, 1);
      col.setRGB(.10 * tr[0] + .005, .42 * tr[1] + .02, .55 * tr[2] + .04).multiplyScalar(sunK);
      waterFog.color.copy(col); waterFog.density = .017 + depth * .0003; scene.background = col;
      shaftM.opacity = .14 * clamp(1 - depth / 45, 0, 1) * sunK; shafts.children.forEach((m, i) => { (m as THREE.Mesh).position.x += Math.sin(time * .3 + i) * dt * .3; });
      hemi.intensity = 1.1 * sunK; hemi.color.copy(col).multiplyScalar(2.5);
    } else { scene.background = null; hemi.intensity = .35; hemi.color.set(0xbfe3ff); fogC.copy(skyFog.color); }
    snow.position.set(Math.round(camera.position.x / 40) * 40, 0, Math.round(camera.position.z / 40) * 40);
    snow.rotation.y = time * .01;
    if (under.visible) flock(dt * (ctx.calm ? .4 : 1), time);
    const dRound = Math.round(depth);
    if (dRound !== lastGauge) {
      lastGauge = dRound; const tr = transmit(WATER.ocean, depth);
      gauge('p', `${pressure(depth).toFixed(2)} bar`); gauge('tC', `${tempAt(depth, 27).toFixed(1)} °C`);
      gauge('rgb', `${Math.round(tr[0] * 100)}% · ${Math.round(tr[1] * 100)}% · ${Math.round(tr[2] * 100)}%`);
      gauge('zone', depth < 1 ? t('z.s', 'Surface') : depth < 200 ? t('z.sun', 'Sunlight zone') : t('z.tw', 'Twilight zone'));
    }
  });

  makeCorals().then(() => S.start());
  S.flyTo(surfCam.p, surfCam.t, 3.2, undefined, 20);
  S.pick(() => [buoy], () => S.showCard(t('k.buoy', 'The buoy shows the water'), t('k.buoyt', 'Waves move energy, not water. The buoy only circles: forward on the crest, back in the trough. The bright loop is its path over one wave period.')));
  return () => {};
}
