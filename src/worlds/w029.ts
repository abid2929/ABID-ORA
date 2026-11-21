/* 029 Forest World: Forest Succession, in 3D. A one-hectare plot grows tree by tree inside an old
   wood. Each tree competes for light with its taller neighbours; pioneers race up in the open,
   shade-tolerant species win in the long run. The forest floor follows the light: grass and ferns
   where the sun gets through, bare leaf litter under a closed canopy. Burn, storm or thin the stand
   and watch it recover; dead wood stays and rots away. Carbon uses the Chave et al. (2014)
   allometric equation. The 2D lab stays available from the toolbar. */
import type { Ctx } from './kit';
import { THREE, stage, daylight, sec, para, slider, segs, stats, chips, btns, el, canvasTex, GLSL_NOISE, rng, clamp, lerp, noise2 } from './nskit';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

interface Sp { n: string; col: string; grow: number; hmax: number; tol: number; life: number; seed: number; wood: number }
/* growth m/yr at full light, max height m, shade tolerance 0..1, lifespan yr, seeds/yr, wood density g/cm³ (same as the 2D lab) */
const SP: Record<string, Sp> = {
  birch: { n: 'Birch (pioneer)', col: '#c9d66b', grow: 1.1, hmax: 24, tol: .1, life: 90, seed: 3, wood: .51 },
  pine: { n: 'Pine', col: '#5f8f5a', grow: .7, hmax: 32, tol: .25, life: 250, seed: 1.6, wood: .42 },
  oak: { n: 'Oak', col: '#7c9a3c', grow: .45, hmax: 30, tol: .45, life: 400, seed: .9, wood: .6 },
  beech: { n: 'Beech (shade-tolerant)', col: '#2f6b4a', grow: .4, hmax: 35, tol: .85, life: 300, seed: 1, wood: .62 },
};
const KEYS = Object.keys(SP);
interface Tree { x: number; y: number; h: number; ph: number; age: number; sp: string; vig: number; li: number; id: number }
interface Dead { x: number; y: number; h: number; kind: 'snag' | 'log' | 'stump'; age: number; rot: number }
const SIZE = 100, LG = 50; /* metres; light grid of 2 m cells */
const crownR = (h: number) => Math.max(.6, h * .22);

class Stand {
  R = rng(11); trees: Tree[] = []; dead: Dead[] = []; year = 0; uid = 0; hist: Record<string, number>[] = [];
  light = new Float32Array(LG * LG).fill(1); burn = new Float32Array(LG * LG);
  reset(kind: string) {
    const R = this.R = rng(kind === 'meadow' ? 11 : kind === 'pine' ? 23 : 37); this.trees = []; this.dead = []; this.year = 0; this.hist.length = 0; this.burn.fill(0);
    const n = kind === 'meadow' ? 40 : 160;
    for (let i = 0; i < n; i++) { const h = kind === 'meadow' ? .5 + R() : 4 + R() * 18; this.trees.push({ x: R() * SIZE, y: R() * SIZE, h, ph: h, age: kind === 'meadow' ? 1 : 10 + R() * 60, sp: kind === 'pine' ? (R() < .85 ? 'pine' : KEYS[Math.floor(R() * 4)]) : KEYS[Math.floor(R() * 4)], vig: 1, li: 1, id: this.uid++ }); }
    this.floor(); this.record();
  }
  lightAt(tr: Tree, grid: Tree[][]) {
    let shade = 0; const r = crownR(tr.h), gx = Math.floor(tr.x / 10), gy = Math.floor(tr.y / 10);
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (const o of grid[((gy + dy + 10) % 10) * 10 + ((gx + dx + 10) % 10)] ?? []) {
      if (o === tr || o.h <= tr.h) continue; const d = Math.hypot(o.x - tr.x, o.y - tr.y), ro = crownR(o.h);
      if (d < r + ro) shade += clamp((r + ro - d) / (2 * Math.min(r, ro)), 0, 1) * Math.min(1, (ro * ro) / (r * r)) * .7;
    }
    return clamp(1 - shade, .02, 1);
  }
  step() {
    const R = this.R; this.year++;
    const grid: Tree[][] = Array.from({ length: 100 }, () => []); for (const tr of this.trees) grid[Math.floor(tr.y / 10) % 10 * 10 + Math.floor(tr.x / 10) % 10].push(tr);
    const born: Tree[] = [];
    for (const tr of this.trees) {
      const s = SP[tr.sp], li = tr.li = this.lightAt(tr, grid), eff = li ** (1.6 - s.tol * 1.4);
      tr.ph = tr.h; tr.h += s.grow * eff * (1 - tr.h / s.hmax); tr.age++; tr.vig = tr.vig * .7 + eff * .3;
      if (tr.h > 3 && R() < s.seed * .08 * li) { const a = R() * 6.283, d = 2 + R() * 18; born.push({ x: (tr.x + Math.cos(a) * d + SIZE) % SIZE, y: (tr.y + Math.sin(a) * d + SIZE) % SIZE, h: .3, ph: 0, age: 0, sp: tr.sp, vig: 1, li: 1, id: this.uid++ }); }
    }
    this.trees = this.trees.filter((tr) => {
      const s = SP[tr.sp], die = (tr.vig < .12 ? .25 : 0) + (tr.age > s.life ? .08 : 0) + .004, dies = R() <= die;
      if (dies && tr.h > 6) this.dead.push({ x: tr.x, y: tr.y, h: tr.h, kind: R() < .5 ? 'snag' : 'log', age: 0, rot: R() * 6.283 });
      return !dies;
    }).concat(born);
    if (this.trees.length > 900) this.trees = this.trees.sort((a, b) => b.h - a.h).slice(0, 900);
    /* dead wood: snags fall over, logs and stumps rot */
    for (const d of this.dead) { d.age++; if (d.kind === 'snag' && d.age > 8 && R() < .08) { d.kind = 'log'; d.age = 0; } }
    this.dead = this.dead.filter((d) => d.age < (d.kind === 'stump' ? 40 : 30));
    for (let i = 0; i < this.burn.length; i++) this.burn[i] *= .86;
    this.floor(); this.record();
  }
  /* light that reaches the forest floor, 2 m cells */
  floor() {
    const L = this.light; L.fill(1);
    for (const tr of this.trees) {
      if (tr.h < 1.5) continue; const r = crownR(tr.h), c = 2, x0 = Math.max(0, Math.floor((tr.x - r) / c)), x1 = Math.min(LG - 1, Math.floor((tr.x + r) / c)), y0 = Math.max(0, Math.floor((tr.y - r) / c)), y1 = Math.min(LG - 1, Math.floor((tr.y + r) / c));
      const k = SP[tr.sp].tol > .5 ? .55 : SP[tr.sp].n.startsWith('Birch') ? .3 : .42; /* beech casts deep shade, birch a light one */
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot((x + .5) * c - tr.x, (y + .5) * c - tr.y); if (d < r) L[y * LG + x] *= 1 - k * (1 - (d / r) ** 2 * .5); }
    }
  }
  carbon() { let kg = 0; for (const tr of this.trees) { const D = Math.max(1, tr.h * 1.3), s = SP[tr.sp]; kg += .0673 * (s.wood * D * D * tr.h) ** .976; } return kg * .47 / 1000; }
  record() { const c: Record<string, number> = {}; for (const k of KEYS) c[k] = 0; for (const tr of this.trees) if (tr.h > 2) c[tr.sp]++; this.hist.push(c); if (this.hist.length > 400) this.hist.shift(); }
  disturb(kind: string) {
    const R = this.R;
    if (kind === 'fire') {
      const cx = R() * SIZE, cy = R() * SIZE, r = 25 + R() * 15;
      this.trees = this.trees.filter((tr) => { const keep = Math.hypot(tr.x - cx, tr.y - cy) > r || R() < .08; if (!keep && tr.h > 4) this.dead.push({ x: tr.x, y: tr.y, h: tr.h * .8, kind: 'snag', age: 0, rot: R() * 6.283 }); return keep; });
      for (let y = 0; y < LG; y++) for (let x = 0; x < LG; x++) { const d = Math.hypot((x + .5) * 2 - cx, (y + .5) * 2 - cy); if (d < r) this.burn[y * LG + x] = Math.max(this.burn[y * LG + x], clamp((r - d) / 4, 0, 1)); }
      return [cx, cy] as const;
    }
    if (kind === 'storm') { this.trees = this.trees.filter((tr) => { const fall = tr.h > 18 && R() < .45; if (fall) this.dead.push({ x: tr.x, y: tr.y, h: tr.h, kind: 'log', age: 0, rot: .7 + (R() - .5) * .5 }); return !fall; }); return null; }
    const sorted = [...this.trees].sort((a, b) => b.h - a.h), cut = new Set(sorted.filter((_, i) => i % 3 === 0 && sorted[i].h > 10));
    for (const tr of cut) this.dead.push({ x: tr.x, y: tr.y, h: tr.h, kind: 'stump', age: 0, rot: 0 });
    this.trees = this.trees.filter((tr) => !cut.has(tr)); return null;
  }
}

/* ---------- ground ---------- */
const nA = noise2(41), nB = noise2(42);
function ground(x: number, z: number) { const r = Math.hypot(x, z); return nB(x / 40, z / 40) * 1.6 + nA(x / 11, z / 11) * .25 + Math.max(0, r - 120) * .06 * (1 + nA(x / 90, z / 90)); }
const toW = (x: number, y: number) => [x - SIZE / 2, y - SIZE / 2] as const;

const PLANT_VS = /* glsl */`
attribute vec3 aP; attribute vec2 aR;
uniform float uT; uniform sampler2D uL; uniform vec3 uSun; uniform vec3 uSunC; uniform vec3 uAmb;
varying vec3 vC;
#include <common>
#include <fog_pars_vertex>
void main(){
  vec2 uv=(aP.xz+50.)/100.; float ins=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  vec4 L=texture2D(uL,uv); float li=mix(.35,L.r,ins), burnt=L.g*ins;
  float grow=smoothstep(.12,.75,li)*(1.-burnt);
  float hg=(.18+.5*aR.y)*grow*(aR.y>.82?1.6:1.);
  float h=position.y, c=cos(aR.x), s=sin(aR.x);
  vec3 p=vec3(position.x*c, h*hg, position.x*s);
  float w=sin(uT*1.2+aP.x*.2+aP.z*.13)*.35+.3;
  vec2 bend=vec2(.5,.2)*w+vec2(-s,c)*(aR.y-.5)*.5; p.xz+=bend*h*h*hg; p.y-=dot(bend,bend)*h*h*hg*.25;
  vec3 wp=aP+p;
  vec4 mvPosition=viewMatrix*vec4(wp,1.); gl_Position=projectionMatrix*mvPosition;
  vec3 tip=mix(vec3(.16,.24,.05),vec3(.28,.36,.08),aR.y);
  if(aR.y>.82) tip=vec3(.10,.22,.06);
  vec3 col=mix(vec3(.02,.035,.01),tip,h);
  float lit=mix(.25,1.,li);
  vC=col*(uAmb+uSunC*lit*(.35+.65*h));
  #include <fog_vertex>
}`;
const PLANT_FS = /* glsl */`
varying vec3 vC;
#include <common>
#include <fog_pars_fragment>
void main(){ gl_FragColor=vec4(vC,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/* crowns get leafy detail and sway in the wind */
function leafy(m: THREE.MeshStandardMaterial, uT: { value: number }, sway: number) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = uT;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; varying vec3 vLP;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vLP=position;
        #ifdef USE_INSTANCING
        vec3 ip=instanceMatrix[3].xyz;
        #else
        vec3 ip=vec3(0.);
        #endif
        float sw=sin(uT*.9+ip.x*.13+ip.z*.11)+.4*sin(uT*2.1+ip.x*.5);
        transformed.xz+=vec2(.6,.25)*sw*${sway.toFixed(3)}*max(position.y+.6,0.);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float lf=snoise(vLP*7.)*.5+snoise(vLP*19.)*.3;
        diffuseColor.rgb*=.72+lf*.5; diffuseColor.rgb*=vec3(.82,.9,.7);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(.88-snoise(vLP*19.)*.1,.6,1.);');
  };
}

function blob(parts: { x: number; y: number; z: number; s: number; sx?: number; sy?: number }[], seed: number, rough: number, top: THREE.Color, bot: THREE.Color) {
  const n = noise2(seed), list: THREE.BufferGeometry[] = [];
  for (const p of parts) { const g = new THREE.IcosahedronGeometry(1, 3); g.scale(p.s * (p.sx ?? 1), p.s * (p.sy ?? 1), p.s * (p.sx ?? 1)); g.translate(p.x, p.y, p.z); list.push(g); }
  const g = mergeVertices(mergeGeometries(list)!, 1e-4), pos = g.attributes.position, c = new Float32Array(pos.count * 3), tc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), d = 1 + n(x * 3 + z * 1.7, y * 3 - z) * rough; pos.setXYZ(i, x * d, y * d, z * d); tc.copy(bot).lerp(top, clamp((y + .5) / 1.1, 0, 1)); c[i * 3] = tc.r; c[i * 3 + 1] = tc.g; c[i * 3 + 2] = tc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
}
/** unit crowns (height 1 from y=-.5 to .5, radius ~.5) per species */
function crownGeo(sp: string) {
  if (sp === 'pine') {
    const list: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) { const g = new THREE.ConeGeometry(.5 - i * .08, .42, 14, 3); const p = g.attributes.position; const n = noise2(60 + i); for (let k = 0; k < p.count; k++) { const x = p.getX(k), z = p.getZ(k), d = 1 + n(x * 9 + i, z * 9) * .18; p.setX(k, x * d); p.setZ(k, z * d); } g.translate(0, -.3 + i * .22, 0); list.push(g.toNonIndexed()); }
    const g = mergeVertices(mergeGeometries(list)!); const pos = g.attributes.position, c = new Float32Array(pos.count * 3); for (let i = 0; i < pos.count; i++) { const k = .55 + .45 * clamp(pos.getY(i) + .5, 0, 1); c[i * 3] = .07 * k; c[i * 3 + 1] = .14 * k; c[i * 3 + 2] = .07 * k; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals(); return g;
  }
  if (sp === 'birch') return blob([{ x: 0, y: .05, z: 0, s: .42, sy: 1.25 }, { x: .12, y: -.15, z: .06, s: .3 }, { x: -.1, y: .22, z: -.05, s: .28 }, { x: -.08, y: -.2, z: -.1, s: .28 }], 71, .3, new THREE.Color(.36, .46, .13), new THREE.Color(.14, .22, .05));
  if (sp === 'oak') return blob([{ x: 0, y: 0, z: 0, s: .4 }, { x: .25, y: -.05, z: .1, s: .3 }, { x: -.25, y: .02, z: -.08, s: .32 }, { x: .05, y: .2, z: -.22, s: .28 }, { x: -.08, y: .15, z: .25, s: .28 }, { x: .2, y: .18, z: -.1, s: .24 }], 72, .26, new THREE.Color(.22, .32, .08), new THREE.Color(.07, .12, .03));
  return blob([{ x: 0, y: 0, z: 0, s: .46, sy: .9 }, { x: .2, y: -.12, z: .15, s: .3 }, { x: -.22, y: -.1, z: -.12, s: .3 }, { x: .02, y: .22, z: 0, s: .3 }], 73, .16, new THREE.Color(.13, .26, .09), new THREE.Color(.04, .1, .04));
}
function barkTex(sp: string) {
  return canvasTex(128, 256, (g, w, h) => {
    const n = noise2(sp.length * 13), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, a = x / w * 6.283, v = n(Math.cos(a) * 2 + y / 60, Math.sin(a) * 2) * .5 + .5, f = n(x / 3, y / 24) * .5 + .5;
      let r: number, gg: number, b: number;
      if (sp === 'birch') { const mark = n(Math.cos(a) * 3, y / 7) > .45 || (n(x / 9, y / 2.5) > .55); const k = mark ? .12 : .82 + v * .12; r = k * 235; gg = k * 230; b = k * 220; }
      else if (sp === 'pine') { const k = .55 + f * .45 * (n(x / 6, y / 10) > -.1 ? 1 : .5); r = 120 * k; gg = 64 * k; b = 40 * k; }
      else if (sp === 'beech') { const k = .75 + v * .25; r = 132 * k; gg = 134 * k; b = 128 * k; }
      else { const ridge = Math.abs(Math.sin(x / w * 6.283 * 7 + n(x / 10, y / 30) * 3)); const k = .35 + ridge * .5 * f; r = 105 * k; gg = 92 * k; b = 76 * k; }
      im.data[i] = r; im.data[i + 1] = gg; im.data[i + 2] = b; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 19 · Forest'), title: t('title', 'Forest World'), sub: t('sub', 'One hectare of woodland grows tree by tree. Pioneers race for the light, patient species take over, and every fire or storm starts the story again.'),
    acc: '#9ccf6a', ink: '#07100a', hf: "'Fraunces'", fov: 45, near: .1, far: 3000,
    lab: () => import('./w029lab'), labName: t('lab', 'Succession lab (2D)'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.shadowMap.enabled = true; renderer.toneMappingExposure = 1.05;
  const SUN = { elev: 24, azim: 140 };
  const L = daylight(S, { elev: SUN.elev, azim: SUN.azim, size: 2500 });
  scene.fog = new THREE.FogExp2(new THREE.Color(.55, .64, .7), .0042);
  const sun = new THREE.DirectionalLight(new THREE.Color(1, .9, .74), 2.6); sun.position.copy(L.sun).multiplyScalar(160); sun.castShadow = true;
  { const c = sun.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 20; c.far = 400; sun.shadow.mapSize.set(S.phone ? 1024 : 2048, S.phone ? 1024 : 2048); sun.shadow.bias = -.0004; sun.shadow.normalBias = .05; }
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xa8c0d8, 0x2a2414, .45));
  scene.environmentIntensity = .4;
  const uT = { value: 0 };

  const st = new Stand(); let start = 'mixed'; st.reset(start);
  const lData = new Uint8Array(LG * LG * 4), lTex = new THREE.DataTexture(lData, LG, LG); lTex.magFilter = lTex.minFilter = THREE.LinearFilter;
  const upFloor = () => { for (let i = 0; i < LG * LG; i++) { lData[i * 4] = Math.round(st.light[i] * 255); lData[i * 4 + 1] = Math.round(st.burn[i] * 255); lData[i * 4 + 3] = 255; } lTex.needsUpdate = true; };
  upFloor();

  /* forest floor: leaf litter in shade, grass in sun, charcoal after fire */
  const TS = 700, tg = new THREE.PlaneGeometry(TS, TS, S.phone ? 150 : 240, S.phone ? 150 : 240); tg.rotateX(-Math.PI / 2);
  { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i))); tg.computeVertexNormals(); }
  const tm = new THREE.MeshStandardMaterial({ roughness: .95 });
  tm.onBeforeCompile = (sh) => {
    sh.uniforms.uL = { value: lTex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW=(modelMatrix*vec4(transformed,1.)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform sampler2D uL;\nfloat hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}')
      .replace('#include <map_fragment>', `
        vec2 uv=(vW.xz+50.)/100.; float ins=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
        vec4 Lt=texture2D(uL,uv); float li=mix(.3,Lt.r,ins), bu=Lt.g*ins;
        float n=vn(vW.xz*.8)*.55+vn(vW.xz*3.1)*.3+vn(vW.xz*11.)*.15;
        vec3 litter=mix(vec3(.13,.075,.035),vec3(.24,.15,.07),n), moss=mix(vec3(.05,.09,.02),vec3(.1,.15,.04),n), grassC=mix(vec3(.09,.14,.03),vec3(.16,.2,.06),n);
        vec3 col=mix(litter,moss,smoothstep(.45,.75,vn(vW.xz*.15))*.6);
        col=mix(col,grassC,smoothstep(.35,.8,li));
        col=mix(col,vec3(.03,.028,.025),bu*.9);
        diffuseColor.rgb*=col;`);
  };
  const terrain = new THREE.Mesh(tg, tm); terrain.receiveShadow = true; scene.add(terrain);

  /* ground plants (grass and ferns) whose height follows the light */
  const blade = new THREE.BufferGeometry();
  { const v: number[] = [], idx: number[] = []; for (let r = 0; r <= 3; r++) { const h = r / 3, w = .04 * (1 - h * .9); v.push(-w, h, 0, w, h, 0); } for (let r = 0; r < 3; r++) { const a = r * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); blade.setIndex(idx); }
  const NP = (globalThis as unknown as { NS_LOW?: boolean }).NS_LOW ? 25000 : S.phone ? 60000 : 160000;
  const pg = new THREE.InstancedBufferGeometry(); pg.index = blade.index; pg.setAttribute('position', blade.attributes.position);
  { const aP = new Float32Array(NP * 3), aR = new Float32Array(NP * 2), R = rng(6); for (let i = 0; i < NP; i++) { const x = (R() * 2 - 1) * 58, z = (R() * 2 - 1) * 58; aP[i * 3] = x; aP[i * 3 + 1] = ground(x, z) - .02; aP[i * 3 + 2] = z; aR[i * 2] = R() * 6.283; aR[i * 2 + 1] = R(); } pg.setAttribute('aP', new THREE.InstancedBufferAttribute(aP, 3)); pg.setAttribute('aR', new THREE.InstancedBufferAttribute(aR, 2)); pg.instanceCount = NP; }
  const pm = new THREE.ShaderMaterial({ vertexShader: PLANT_VS, fragmentShader: PLANT_FS, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uT: { value: 0 }, uL: { value: null }, uSun: { value: new THREE.Vector3() }, uSunC: { value: new THREE.Color(1, .9, .74).multiplyScalar(1.2) }, uAmb: { value: new THREE.Color(.16, .2, .22) } }]) });
  pm.uniforms.uL.value = lTex; pm.uniforms.uT = uT;
  const plants = new THREE.Mesh(pg, pm); plants.frustumCulled = false; scene.add(plants);

  /* trees: one instanced trunk + crown pair per species */
  const MAXT = 900;
  type Kind = { trunk: THREE.InstancedMesh; crown: THREE.InstancedMesh; list: Tree[] };
  const kinds: Record<string, Kind> = {};
  const trunkG = new THREE.CylinderGeometry(.6, 1, 1, 10, 1, true); trunkG.translate(0, .5, 0);
  for (const k of KEYS) {
    const bm = new THREE.MeshStandardMaterial({ map: barkTex(k), roughness: k === 'beech' || k === 'birch' ? .6 : .92 });
    const cm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .75 }); leafy(cm, uT, k === 'pine' ? .03 : .06);
    const trunk = new THREE.InstancedMesh(trunkG, bm, MAXT), crown = new THREE.InstancedMesh(crownGeo(k), cm, MAXT);
    trunk.castShadow = crown.castShadow = true; trunk.receiveShadow = crown.receiveShadow = true; trunk.count = crown.count = 0;
    crown.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXT * 3).fill(1), 3);
    scene.add(trunk, crown); kinds[k] = { trunk, crown, list: [] };
  }
  /* crown proportions per species: [height / tree height, width factor, clear trunk share] */
  const SHAPE: Record<string, [number, number, number]> = { birch: [.55, .8, .4], pine: [.38, .7, .62], oak: [.55, 1.15, .38], beech: [.62, 1.05, .32] };
  /* the old wood around the plot (not simulated, it frames the hectare) */
  {
    const R = rng(9), N = S.phone ? 260 : 480, per: Record<string, THREE.Matrix4[]> = {}; KEYS.forEach((k) => (per[k] = []));
    let guard = 0;
    while (Object.values(per).reduce((a, l) => a + l.length, 0) < N && guard++ < 9000) {
      const x = (R() * 2 - 1) * 230, z = (R() * 2 - 1) * 230; if (Math.abs(x) < 62 && Math.abs(z) < 62) continue;
      const k = R() < .45 ? 'beech' : R() < .6 ? 'oak' : R() < .7 ? 'pine' : 'birch', h = SP[k].hmax * (.7 + R() * .28);
      per[k].push(new THREE.Matrix4().compose(new THREE.Vector3(x, ground(x, z), z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), R() * 6.283), new THREE.Vector3(h, h, h)));
    }
    for (const k of KEYS) {
      const list = per[k], [ch, cw, clear] = SHAPE[k], tr = new THREE.InstancedMesh(trunkG, kinds[k].trunk.material, list.length), cr = new THREE.InstancedMesh(kinds[k].crown.geometry, kinds[k].crown.material, list.length);
      const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), m = new THREE.Matrix4();
      list.forEach((M, i) => { M.decompose(p, q, s); const h = s.x, rad = Math.max(.05, h * .0065 * 2.3); m.compose(p, q, new THREE.Vector3(rad, h * (1 - ch * .5), rad)); tr.setMatrixAt(i, m); const w = crownR(h) * 2 * cw; m.compose(new THREE.Vector3(p.x, p.y + h * (1 - ch * .5) - h * ch * .02, p.z), q, new THREE.Vector3(w, h * ch, w)); cr.setMatrixAt(i, m); void clear; });
      tr.castShadow = cr.castShadow = true; cr.receiveShadow = true; scene.add(tr, cr);
    }
  }
  /* dead wood: snags, logs and stumps */
  const deadM = new THREE.InstancedMesh(new THREE.CylinderGeometry(.75, 1, 1, 8).translate(0, .5, 0), new THREE.MeshStandardMaterial({ map: barkTex('oak'), color: 0x6a5a4c, roughness: .95 }), 1200);
  deadM.castShadow = deadM.receiveShadow = true; deadM.count = 0; scene.add(deadM);
  /* corner posts mark the hectare */
  { const pm2 = new THREE.MeshStandardMaterial({ color: 0xe0e0d8, roughness: .6 }), cap = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: .5 }); for (const [x, z] of [[-50, -50], [50, -50], [50, 50], [-50, 50]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.2, 8), pm2); p.position.set(x, ground(x, z) + .6, z); const c = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .18, 8), cap); c.position.set(x, ground(x, z) + 1.2, z); scene.add(p, c); } }

  /* ---------- per-frame layout of the stand ---------- */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3(), yAx = new THREE.Vector3(0, 1, 0), col = new THREE.Color(), ill = new THREE.Color(.95, .8, .35);
  function layout(k01: number) {
    for (const k of KEYS) kinds[k].list.length = 0;
    for (const tr of st.trees) kinds[tr.sp].list.push(tr);
    for (const k of KEYS) {
      const K = kinds[k], [ch, cw] = SHAPE[k]; let i = 0;
      for (const tr of K.list) {
        if (i >= MAXT) break;
        const h = Math.max(.15, lerp(tr.ph, tr.h, k01)), [x, z] = toW(tr.x, tr.y), y = ground(x, z), rad = Math.max(.02, h * .0065 * 2.3);
        q.setFromAxisAngle(yAx, tr.id * 2.39);
        m4.compose(p3.set(x, y - .1, z), q, sc.set(rad, h * (1 - ch * .5) + .1, rad)); K.trunk.setMatrixAt(i, m4);
        const w = crownR(h) * 2 * cw * (h < 2 ? .7 : 1);
        m4.compose(p3.set(x, y + h * (1 - ch * .5), z), q, sc.set(w, h * ch, w)); K.crown.setMatrixAt(i, m4);
        col.setRGB(1, 1, 1).lerp(ill, clamp(1 - tr.vig * 1.6, 0, .8)); K.crown.setColorAt(i, col);
        i++;
      }
      K.trunk.count = K.crown.count = i; K.trunk.instanceMatrix.needsUpdate = K.crown.instanceMatrix.needsUpdate = true; if (K.crown.instanceColor) K.crown.instanceColor.needsUpdate = true;
      K.trunk.computeBoundingSphere(); K.crown.computeBoundingSphere();
    }
    let j = 0;
    for (const d of st.dead) {
      if (j >= 1200) break;
      const [x, z] = toW(d.x, d.y), y = ground(x, z), rad = Math.max(.05, d.h * .0065 * 2.3) * (1 - d.age / 45);
      if (d.kind === 'snag') { q.setFromAxisAngle(yAx, d.rot); m4.compose(p3.set(x, y - .1, z), q, sc.set(rad, d.h * .75, rad)); }
      else if (d.kind === 'stump') { q.identity(); m4.compose(p3.set(x, y - .05, z), q, sc.set(rad * 1.1, .55, rad * 1.1)); }
      else { q.setFromEuler(new THREE.Euler(0, d.rot, Math.PI / 2 - .02)); const L2 = d.h * .8; m4.compose(p3.set(x, y + rad * .8, z), q, sc.set(rad, L2, rad)); }
      deadM.setMatrixAt(j++, m4);
    }
    deadM.count = j; deadM.instanceMatrix.needsUpdate = true; deadM.computeBoundingSphere();
  }

  /* ---------- panel ---------- */
  const B = S.body;
  sec(B, t('h.stand', 'The hectare'));
  const info = stats(B, [['year', t('year', 'Year')], ['n', t('n', 'Trees over 2 m')], ['tall', t('tall', 'Tallest')], ['c', t('c', 'Carbon stored')]], true);
  const chartBox = el('div', { style: { position: 'relative', height: '130px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)' } });
  const cv = el('canvas', { role: 'img', 'aria-label': t('chart', 'Trees of each species over time'), style: { width: '100%', height: '100%', display: 'block' } }); chartBox.append(cv); B.append(chartBox);
  const legend = el('div', { style: { display: 'flex', gap: '8px 14px', flexWrap: 'wrap', fontSize: '12px', color: 'rgba(255,255,255,.72)' } });
  for (const k of KEYS) legend.append(el('span', {}, el('i', { style: { display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', background: SP[k].col, marginInlineEnd: '6px' } }), t('sp.' + k, SP[k].n)));
  B.append(legend);
  sec(B, t('h.time', 'Time and events'));
  let speed = 3;
  slider(B, t('speed', 'Years per second'), { min: 0, max: 20, step: 1, value: speed, fmt: (v) => v ? String(v) : t('paused', 'paused') }, (v) => { speed = v; });
  btns(B, [[t('fire', 'Wildfire'), () => event('fire')], [t('storm', 'Storm'), () => event('storm')], [t('thin', 'Thin the stand'), () => event('thin')]]);
  segs(B, t('startS', 'Start from'), [['meadow', t('s.meadow', 'Open meadow')], ['mixed', t('s.mixed', 'Mixed wood')], ['pine', t('s.pine', 'Pine plantation')]], start, (v) => { start = v; st.reset(v); upFloor(); layout(1); });
  btns(B, [[t('reset', 'Restart'), () => { st.reset(start); upFloor(); layout(1); }, true]]);
  para(B, t('how', 'Each year every tree grows by how much light reaches its crown past taller neighbours. Birch needs full sun; beech can wait in the shade for a century, then take over. Under a closed canopy the grass dies back to leaf litter. This is ecological succession.'));
  para(B, t('honest', 'A simplified model for learning. Carbon uses the Chave et al. (2014) allometric equation with estimated trunk diameters.'));

  function drawChart() {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1), w = Math.max(10, r.width), h = Math.max(10, r.height);
    if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const g = cv.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
    const H = st.hist, mx = Math.max(10, ...H.map((row) => Math.max(...KEYS.map((k) => row[k]))));
    g.strokeStyle = 'rgba(255,255,255,.06)'; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, h * i / 4); g.lineTo(w, h * i / 4); g.stroke(); }
    for (const k of KEYS) { g.strokeStyle = SP[k].col; g.lineWidth = 2; g.beginPath(); H.forEach((row, i) => { const x = 8 + i / Math.max(1, H.length - 1) * (w - 16), y = h - 10 - row[k] / mx * (h - 22); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  }
  function event(kind: string) {
    const at = st.disturb(kind); upFloor(); layout(1);
    if (kind === 'fire' && at) { const [x, z] = toW(at[0], at[1]); S.flyTo(new THREE.Vector3(x + 40, 32, z + 48), new THREE.Vector3(x, 2, z), 2.2); S.showCard(t('fired.h', 'Wildfire'), t('fired', 'A fire cleared a patch. Birch seeds blow in first; watch the pioneers move in.'), 5000); }
    if (kind === 'storm') S.showCard(t('stormed.h', 'Storm'), t('stormed', 'The wind threw many of the tallest trees. Their logs stay and rot, and the gaps let light down to the young trees.'), 5000);
    if (kind === 'thin') S.showCard(t('thinned.h', 'Thinning'), t('thinned', 'Every third large tree was felled. The stumps rot over the next decades.'), 5000);
  }

  /* ---------- views ---------- */
  const views: Record<string, [THREE.Vector3, THREE.Vector3]> = {
    stand: [new THREE.Vector3(-74, 46, 92), new THREE.Vector3(0, 6, 0)],
    walk: [new THREE.Vector3(-6, 1.7, 22), new THREE.Vector3(4, 4, 0)],
    canopy: [new THREE.Vector3(0, 150, 1), new THREE.Vector3(0, 0, 0)],
  };
  if (S.phone) { views.stand[0].set(-92, 70, 130); views.canopy[0].set(0, 210, 1); }
  function view(v: string) {
    controls.minDistance = v === 'walk' ? .5 : 2;
    if (v === 'tall') {
      const tr = [...st.trees].sort((a, b) => b.h - a.h)[0]; if (!tr) return;
      const [x, z] = toW(tr.x, tr.y), y = ground(x, z);
      S.flyTo(new THREE.Vector3(x + tr.h * .9, y + tr.h * .75, z + tr.h * 1.1), new THREE.Vector3(x, y + tr.h * .6, z), 2.4);
      S.showCard(t('sp.' + tr.sp, SP[tr.sp].n), `${tr.h.toFixed(1)} m · ${tr.age} ${t('yrs', 'years old')} · ${t('light', 'light')} ${Math.round(tr.li * 100)}%`, 5000);
      return;
    }
    const [p, tt] = views[v]; S.flyTo(p, tt, 2.6);
    if (v === 'walk') S.showHint(t('walk.h', 'Drag to look around. Pinch or scroll to step closer.'), 3500);
  }
  chips(S, [['stand', t('c.stand', 'The hectare')], ['walk', t('c.walk', 'Walk in')], ['canopy', t('c.canopy', 'Canopy from above')], ['tall', t('c.tall', 'Tallest tree')]], 'stand', view);
  camera.position.set(-120, 80, 150); controls.target.copy(views.stand[1]); S.setHome(views.stand[0], views.stand[1]);
  controls.maxPolarAngle = Math.PI * .49; controls.maxDistance = 320;

  S.pick(() => KEYS.map((k) => kinds[k].crown), (hit) => {
    const k = KEYS.find((kk) => kinds[kk].crown === hit.object); if (!k || hit.instanceId == null) return;
    const tr = kinds[k].list[hit.instanceId]; if (!tr) return;
    S.showCard(t('sp.' + k, SP[k].n), `${tr.h.toFixed(1)} m · ${tr.age} ${t('yrs', 'years old')} · ${t('light', 'light')} ${Math.round(tr.li * 100)}%`, 4500);
  });

  /* ---------- run ---------- */
  let acc = 0, ui = 1;
  layout(1);
  S.onFrame((dt, time) => {
    uT.value = time;
    acc += dt * speed * (ctx.calm ? .5 : 1); let n = 0; while (acc >= 1 && n < 6) { acc -= 1; st.step(); n++; } if (acc > 1) acc = 1;
    if (n) upFloor();
    layout(acc);
    if ((ui += dt) > .3) {
      ui = 0; info('year', String(st.year)); info('n', String(st.trees.filter((x) => x.h > 2).length)); info('tall', `${Math.max(0, ...st.trees.map((x) => x.h)).toFixed(1)} m`); info('c', `${st.carbon().toFixed(0)} t C`);
      drawChart();
    }
  });
  S.flyTo(views.stand[0], views.stand[1], 3.2);
  S.start();
}
