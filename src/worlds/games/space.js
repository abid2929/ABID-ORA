/* World 15 · Space Adventure: Starfall Run.
   Fly a scout ship through three sectors toward real neighbouring stars (distances from the old "Journey to the nearest
   star" world): dodge or blast asteroids, collect energy cells to recharge shields, and dive through the jump gate.
   Nebula, stars, planet, ship and rocks are all made in code. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { onKey, makeStage, keys, btn, card, hud, toast, controlsLegend, best, sfx, run, topBar, el, TOUCH, clamp, lerp, damp, rng, noise2, canvasTex } from './gkit.js';

const SECTORS = [
  { name: 'Proxima Centauri', ly: 4.24, len: 2600, rate: 1.1, speed: 120, hue: [.62, .82], cells: .6, note: 'The closest star to the Sun: a small red dwarf with at least two planets.' },
  { name: "Barnard's Star", ly: 5.96, len: 3200, rate: 1.7, speed: 140, hue: [.9, .05], cells: .5, note: 'Moves across our sky faster than any other star: about the Moon’s width every 180 years.' },
  { name: 'Sirius', ly: 8.6, len: 3800, rate: 2.4, speed: 160, hue: [.5, .7], cells: .45, note: 'The brightest star in the night sky, with a white dwarf companion the size of Earth.' },
];
const BX = 26, BY = 14;     // flight box half extents

function nebula(scene, hue) {
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { a: { value: new THREE.Color().setHSL(hue[0], .7, .45) }, b: { value: new THREE.Color().setHSL(hue[1], .8, .35) }, t: { value: 0 } },
    vertexShader: 'varying vec3 vp; void main(){ vp=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z=gl_Position.w; }',
    fragmentShader: `varying vec3 vp; uniform vec3 a; uniform vec3 b; uniform float t;
      float h(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float s=0., w=.5; for(int i=0;i<6;i++){ s+=n(p)*w; p*=2.03; w*=.5; } return s; }
      void main(){ vec3 p=vp*2.4; float q=fbm(p+vec3(0.,0.,t*.01)); float r=fbm(p*1.7+q*2.2);
        float band=exp(-pow(vp.y*2.2+sin(vp.x*2.)*.35,2.));
        vec3 c=mix(a,b,r)*pow(r,2.6)*2.4*(.35+band); c+=vec3(.9,.8,1.)*pow(fbm(p*6.),9.)*.6;
        float dust=smoothstep(.55,.75,fbm(p*3.+5.)); c*=1.-dust*.55*band;
        gl_FragColor=vec4(c,1.); }` });
  const s = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 32), m); scene.add(s); return m;
}
function stars(scene, n) {
  const r = rng(5), p = new Float32Array(n * 3), c = new Float32Array(n * 3), col = new THREE.Color();
  for (let i = 0; i < n; i++) { const u = r() * 2 - 1, a = r() * 6.283, s = Math.sqrt(1 - u * u), d = 1500 + r() * 1000; p.set([Math.cos(a) * s * d, u * d, Math.sin(a) * s * d], i * 3); col.setHSL(r() < .3 ? .6 : .08, .5, .6 + r() * .4).multiplyScalar(.6 + r() * 2.2); c.set([col.r, col.g, col.b], i * 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  const dot = canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 6, map: dot, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(pts); return pts;
}
function planet(scene, sun) {
  const n = noise2(17);
  const tex = canvasTex(1024, 512, (g, w, h) => {
    const im = g.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const a = x / w * 6.283, b = (y / h - .5) * 3.1416, X = Math.cos(a) * Math.cos(b), Y = Math.sin(b), Z = Math.sin(a) * Math.cos(b);
      const v = n.fbm(X * 2 + Y * 4, Z * 2 + Y * 9, 6), band = Math.sin(Y * 18 + v * 6) * .5 + .5, i = (y * w + x) * 4;
      d[i] = 150 + band * 80 + v * 40; d[i + 1] = 110 + band * 60 + v * 30; d[i + 2] = 90 + band * 40; d[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  });
  const p = new THREE.Mesh(new THREE.SphereGeometry(420, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }));
  p.position.set(-1250, 380, -2500); scene.add(p);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(436, 96, 64), new THREE.ShaderMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, uniforms: { s: { value: sun } },
    vertexShader: 'varying vec3 vn; varying vec3 vv; void main(){ vn=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vv=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 vn; varying vec3 vv; uniform vec3 s; void main(){ float f=pow(1.-max(dot(vn,vv),0.),3.); float l=clamp(dot(vn,normalize((viewMatrix*vec4(s,0.)).xyz))*.8+.4,0.,1.); gl_FragColor=vec4(vec3(1.,.62,.35)*f*l*2.,f*l); }' }));
  atm.position.copy(p.position); scene.add(atm);
  /* thin ring */
  const ringT = canvasTex(512, 8, (g, w) => { const rn = noise2(23); for (let x = 0; x < w; x++) { const a = (rn.fbm(x / 9, .5, 4) * .9 + .45 + Math.sin(x * .021) * .2) * (x > 40 && x < 470 ? 1 : 0) * (x > 300 && x < 318 ? .1 : 1); g.fillStyle = `rgba(230,205,170,${clamp(a, 0, 1) * .7})`; g.fillRect(x, 0, 1, 8); } });
  const rg = new THREE.RingGeometry(520, 820, 128, 1); const uv = rg.attributes.uv, pp = rg.attributes.position; for (let i = 0; i < uv.count; i++) { const rr = Math.hypot(pp.getX(i), pp.getY(i)); uv.setXY(i, (rr - 520) / 300, .5); }
  const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ringT, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
  ring.position.copy(p.position); ring.rotation.x = -1.2; ring.rotation.y = .3; scene.add(ring);
  return p;
}
function rockGeos() {
  const out = [];
  for (let k = 0; k < 4; k++) {
    const g = new THREE.IcosahedronGeometry(1, TOUCH ? 3 : 4), n = noise2(30 + k), p = g.attributes.position, v = new THREE.Vector3();
    const sx = .8 + k * .12, sy = .7 + (k % 2) * .25;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const d = 1 + n.fbm(v.x * 1.6 + k, v.y * 1.6 + v.z * 1.3, 5) * .45 - Math.max(0, n(v.x * 3, v.z * 3) - .45) * .5; v.multiplyScalar(d); p.setXYZ(i, v.x * sx, v.y * sy, v.z); }
    g.computeVertexNormals(); out.push(g);
  }
  return out;
}
function rockTex() {
  const r = rng(8), n = noise2(4);
  const map = canvasTex(512, 512, (g, w, h) => { const im = g.createImageData(w, h), d = im.data; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = n.fbm(x / 40, y / 40, 5) * .5 + .5, s = r() * .15, i = (y * w + x) * 4; const c = 60 + v * 90 + s * 60; d[i] = c * 1.02; d[i + 1] = c * .95; d[i + 2] = c * .88; d[i + 3] = 255; } g.putImageData(im, 0, 0); });
  map.wrapS = map.wrapT = THREE.RepeatWrapping; return map;
}
function shipMesh() {
  const g = new THREE.Group();
  const hull = new THREE.MeshPhysicalMaterial({ color: 0xd9d4cb, metalness: .55, roughness: .3, clearcoat: .8, clearcoatRoughness: .1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1c21, metalness: .7, roughness: .35 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xe8b46a, metalness: .9, roughness: .25 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1420, metalness: .2, roughness: .03, clearcoat: 1, envMapIntensity: 2.5 });
  const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fd4ff).multiplyScalar(2.2) });
  /* fuselage: a lathe profile, nose toward -Z */
  const prof = [[0, 3.6], [.32, 3.0], [.62, 1.8], [.82, .4], [.86, -1.2], [.74, -2.2], [.55, -2.6], [0, -2.6]].map(([r, y]) => new THREE.Vector2(r, y));
  const fus = new THREE.LatheGeometry(prof, 40); fus.rotateX(-Math.PI / 2); fus.scale(1, .72, 1);
  const f = new THREE.Mesh(fus, hull); f.castShadow = true; g.add(f);
  const can = new THREE.Mesh(new THREE.SphereGeometry(.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass); can.scale.set(1, .8, 2.2); can.position.set(0, .42, -.9); g.add(can);
  /* wings: swept, extruded */
  const ws = new THREE.Shape(); ws.moveTo(0, 1.2); ws.lineTo(3.6, -1.2); ws.lineTo(3.8, -2.1); ws.lineTo(3.0, -2.2); ws.lineTo(0, -1.9); ws.closePath();
  const wg = new THREE.ExtrudeGeometry(ws, { depth: .12, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 2 }); wg.rotateX(Math.PI / 2); wg.translate(0, .06, 0);
  for (const s of [1, -1]) { const w = new THREE.Mesh(wg, hull); w.scale.x = s; w.position.x = s * .5; w.rotation.z = s * -.08; w.castShadow = true; g.add(w);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(.12, .5, 1.4), dark); tip.position.set(s * 3.78, .1, -1.7); g.add(tip);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.2, .02, .16), accent); stripe.position.set(s * 2.3, .14, .4); stripe.rotation.y = s * .58; g.add(stripe);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.6, 10), dark); gun.rotation.x = Math.PI / 2; gun.position.set(s * 2.2, -.05, -.6); g.add(gun);
    const nac = new THREE.Mesh(new THREE.CylinderGeometry(.42, .5, 2.2, 28), dark); nac.rotation.x = Math.PI / 2; nac.position.set(s * 1.25, -.12, 1.9); g.add(nac);
    const ex = new THREE.Mesh(new THREE.CircleGeometry(.36, 28), glow); ex.position.set(s * 1.25, -.12, 3.01); g.add(ex); }
  const fin = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.1, 1.6), hull); fin.position.set(0, .8, 1.9); fin.rotation.x = .35; g.add(fin);
  /* engine flames: additive cones that grow with boost */
  const flameM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x66c8ff).multiplyScalar(1.6), transparent: true, opacity: .4, blending: THREE.AdditiveBlending, depthWrite: false });
  const flames = [1, -1].map((s) => { const c = new THREE.Mesh(new THREE.ConeGeometry(.33, 2.4, 20, 1, true), flameM); c.rotation.x = -Math.PI / 2; c.position.set(s * 1.25, -.12, 4.2); g.add(c); return c; });
  g.userData.flames = flames;
  return g;
}

export async function start(canvas, ui) {
  const S = makeStage(canvas, { exposure: 1, fov: 62, far: 7000, bloom: { strength: .85, radius: .55, threshold: 1 } });
  const { scene, camera } = S;
  const sunDir = new THREE.Vector3(1, .6, .4).normalize();
  const key = new THREE.DirectionalLight(0xfff0e0, 3.2); key.position.copy(sunDir).multiplyScalar(100); scene.add(key);
  const rim = new THREE.DirectionalLight(0x6fa8ff, 1.4); rim.position.set(-1, -.3, -1).multiplyScalar(100); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x404a66, .35));
  /* a small studio environment for reflections on the ship */
  { const pm = new THREE.PMREMGenerator(S.renderer), es = new THREE.Scene(); es.background = new THREE.Color(0x05060a);
    const add = (c, i, x, y, z, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    add(0xfff0e0, 6, 6, 4, 2, 4, 4); add(0x6fa8ff, 2, -6, -1, -4, 6, 3); add(0xffb37a, 1, 0, -6, 0, 10, 10);
    scene.environment = pm.fromScene(es, .04).texture; }
  const neb = nebula(scene, SECTORS[0].hue); const starPts = stars(scene, TOUCH ? 3500 : 6000); planet(scene, sunDir);
  /* speed streaks */
  const SN = 260, sp = new Float32Array(SN * 6), sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const streaks = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x9ccfff, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(streaks);
  const sr = rng(3); const sx = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) { sx[i * 3] = (sr() - .5) * 140; sx[i * 3 + 1] = (sr() - .5) * 90; sx[i * 3 + 2] = -sr() * 600; }

  /* pools */
  const RG = rockGeos(), rockM = new THREE.MeshStandardMaterial({ map: rockTex(), roughness: .95, metalness: .05, color: 0xbab0a4 });
  const MAXR = 70; const rockI = RG.map((g) => { const m = new THREE.InstancedMesh(g, rockM, MAXR); m.count = 0; m.frustumCulled = false; scene.add(m); return m; });
  const rocks = [];
  const cellG = new THREE.IcosahedronGeometry(1, 0), cellM = new THREE.MeshStandardMaterial({ color: 0x55ffc8, emissive: 0x2bffb0, emissiveIntensity: 2.6, roughness: .2, metalness: .3 });
  const ringG = new THREE.TorusGeometry(1.8, .08, 8, 40), ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x55ffc8).multiplyScalar(2.5) });
  const cells = [];
  const laserG = new THREE.CylinderGeometry(.09, .09, 7, 8); laserG.rotateX(Math.PI / 2);
  const laserM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffb35c).multiplyScalar(8) });
  const lasers = [];
  /* explosion particles */
  const PN = 900, pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3), pl = new Float32Array(PN), pc = new Float32Array(PN * 3);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
  const sparkT = canvasTex(64, 64, (x, w, h) => { const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(.3, 'rgba(255,200,140,.7)'); gr.addColorStop(1, 'rgba(255,120,40,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
  const parts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1.6, map: sparkT, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); parts.frustumCulled = false; scene.add(parts);
  let pk = 0;
  const burst = (x, y, z, n, col, spd) => { const c = new THREE.Color(col); for (let i = 0; i < n; i++) { const k = pk = (pk + 1) % PN; const u = Math.random() * 2 - 1, a = Math.random() * 6.28, s = Math.sqrt(1 - u * u), v = spd * (.3 + Math.random()); pp.set([x, y, z], k * 3); pv.set([Math.cos(a) * s * v, u * v, Math.sin(a) * s * v], k * 3); pl[k] = .6 + Math.random() * .8; pc.set([c.r * 3, c.g * 3, c.b * 3], k * 3); } };
  const flash = new THREE.PointLight(0xffa860, 0, 80, 1.6); scene.add(flash);
  /* jump gate */
  const gate = new THREE.Group(); scene.add(gate);
  const gateM = new THREE.MeshStandardMaterial({ color: 0x2a2c33, metalness: .9, roughness: .3 });
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(30, 2.4, 24, 96), gateM));
  const gateGlow = new THREE.Mesh(new THREE.TorusGeometry(27.4, .5, 12, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8b46a).multiplyScalar(5) })); gate.add(gateGlow);
  for (let i = 0; i < 8; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 8, 5), gateM); const a = i / 8 * 6.283; b.position.set(Math.cos(a) * 31, Math.sin(a) * 31, 0); b.rotation.z = a; gate.add(b); const l = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 5.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x7fd4ff).multiplyScalar(4) })); l.position.copy(b.position).multiplyScalar(1.05); l.rotation.z = a; gate.add(l); }
  const portal = new THREE.Mesh(new THREE.CircleGeometry(27, 64), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec2 vu; void main(){ vu=uv-.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec2 vu; uniform float t; void main(){ float r=length(vu)*2.; float a=atan(vu.y,vu.x); float s=sin(a*6.+t*3.-r*14.)*.5+.5; gl_FragColor=vec4(vec3(1.,.75,.45)*s*(1.-r)*.9+vec3(.4,.7,1.)*pow(1.-r,4.),(1.-r)*.8); }' }));
  gate.add(portal); gate.visible = false;

  const ship = shipMesh(); scene.add(ship);
  const shipLight = new THREE.PointLight(0x7fd4ff, 3, 10, 2); shipLight.position.set(0, -.5, 3.5); ship.add(shipLight);

  /* --- UI --- */
  const css = el('style', '', `
  .sp-top{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 62px);width:min(520px,calc(100vw - 32px));text-align:center}
  .sp-prog{height:4px;border-radius:4px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:8px}.sp-prog i{display:block;height:100%;background:linear-gradient(90deg,#e8b46a,#ffe2b0)}
  .sp-row{display:flex;justify-content:space-between;gap:8px}.sp-row b{color:#e8b46a;font-weight:700}
  .sp-sh{position:fixed;left:calc(env(safe-area-inset-left,0px) + 16px);bottom:calc(env(safe-area-inset-bottom,0px) + 18px);width:min(220px,46vw);white-space:nowrap}
  .sp-sh .bar{height:6px;border-radius:6px;background:rgba(255,255,255,.15);overflow:hidden;margin-top:6px}.sp-sh .bar i{display:block;height:100%;background:linear-gradient(90deg,#4de2b5,#9ff5da);transition:width .2s}
  .sp-sh.low .bar i{background:linear-gradient(90deg,#ff5c5c,#ffa0a0)}
  .sp-ret{position:fixed;width:44px;height:44px;margin:-22px 0 0 -22px;border:1.5px solid rgba(255,214,160,.7);border-radius:50%;pointer-events:none!important;z-index:15}
  .sp-ret::after{content:'';position:absolute;left:50%;top:50%;width:4px;height:4px;margin:-2px 0 0 -2px;background:#ffd6a0;border-radius:50%}
  .sp-hit{position:fixed;inset:0;pointer-events:none!important;box-shadow:inset 0 0 160px rgba(255,60,40,.0);transition:box-shadow .25s;z-index:12}
  .sp-hit.on{box-shadow:inset 0 0 160px rgba(255,60,40,.65)}
  .gk-btn.fire{right:calc(env(safe-area-inset-right,0px) + 18px);bottom:calc(env(safe-area-inset-bottom,0px) + 24px);width:84px;height:84px}
  .gk-btn.boost{right:calc(env(safe-area-inset-right,0px) + 116px);bottom:calc(env(safe-area-inset-bottom,0px) + 30px)}
  .sp-pad{position:fixed;left:0;bottom:0;width:62%;height:65%;touch-action:none;z-index:19}
  @media (pointer:fine){.sp-pad{display:none}}
  `); ui.append(css);
  let pause = () => {};
  topBar(ui, () => pause());
  const top = hud(ui, 'sp-top'), sh = hud(ui, 'sp-sh'), ret = el('div', 'sp-ret'), hit = el('div', 'sp-hit'); ui.append(ret, hit);
  const pad = el('div', 'sp-pad'); ui.append(pad);
  const bF = btn(ui, 'Fire', 'touch fire'), bB = btn(ui, 'Boost', 'touch boost');
  const touchEls = [pad, bF.el, bB.el]; const showTouch = (on) => { touchEls.forEach((e) => (e.hidden = !on || !TOUCH)); ret.hidden = !on; };
  showTouch(false);
  const K = keys();
  /* steering: mouse aims on desktop; on phones the left thumb drags the ship (relative, like a trackpad) */
  const aim = { x: 0, y: 0 }; let mouseOn = false;
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; mouseOn = true; aim.x = clamp((e.clientX / S.w - .5) * 2.4, -1, 1) * BX; aim.y = clamp(-(e.clientY / S.h - .5) * 2.4, -1, 1) * BY; });
  let mdown = false; canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') mdown = true; }); addEventListener('pointerup', () => (mdown = false));
  let pid = null, px = 0, py = 0;
  pad.addEventListener('pointerdown', (e) => { pid = e.pointerId; px = e.clientX; py = e.clientY; pad.setPointerCapture(pid); });
  pad.addEventListener('pointermove', (e) => { if (e.pointerId !== pid) return; const k = 52 / Math.min(S.w, 520); aim.x = clamp(aim.x + (e.clientX - px) * k * 1.2, -BX, BX); aim.y = clamp(aim.y - (e.clientY - py) * k * 1.2, -BY, BY); px = e.clientX; py = e.clientY; });
  const pend = (e) => { if (e.pointerId === pid) pid = null; }; pad.addEventListener('pointerup', pend); pad.addEventListener('pointercancel', pend);

  /* --- game state --- */
  const st = { phase: 'menu', sector: 0, dist: 0, shield: 100, cells: 0, score: 0, spawnT: 0, cellT: 0, fireT: 0, boost: 0, inv: 0, x: 0, y: 0, vx: 0, vy: 0, bank: 0, autoFire: TOUCH };
  const clearField = () => { rocks.length = 0; cells.forEach((c) => scene.remove(c.g)); cells.length = 0; lasers.forEach((l) => scene.remove(l.m)); lasers.length = 0; pl.fill(0); };
  const startSector = (i) => {
    st.sector = i; st.dist = 0; st.phase = 'fly'; gate.visible = false; clearField();
    neb.uniforms.a.value.setHSL(SECTORS[i].hue[0], .7, .45); neb.uniforms.b.value.setHSL(SECTORS[i].hue[1], .8, .35);
    toast(ui, `Sector ${i + 1} · ${SECTORS[i].name}`, 2400); showTouch(true);
  };
  const newRun = () => { Object.assign(st, { shield: 100, cells: 0, score: 0, x: 0, y: 0, vx: 0, vy: 0 }); aim.x = aim.y = 0; startSector(0); };
  const menu = async () => {
    st.phase = 'menu'; showTouch(false); const b = best.get('space');
    await card(ui, { kicker: 'World 15 · Space Adventure', title: 'Starfall Run', side: true,
      body: `<p>Fly the scout ship Abidora One through three sectors toward real neighbouring stars. Blast or dodge asteroids, collect green energy cells to recharge your shield, and dive through each jump gate.</p>
      ${controlsLegend([['Mouse', 'Steer'], ['Click / Space', 'Fire'], ['W A S D', 'Steer (keys)'], ['Shift', 'Boost']], [['Left thumb', 'Drag anywhere to steer'], ['Fire', 'Lasers (auto-fire is on)'], ['Boost', 'Faster, worth more points']])}
      <p class="mono" style="font-size:11px;color:#9a9387;margin-top:12px">BEST SCORE ${b ? b.toLocaleString() : '—'}</p>`, buttons: ['Launch'] });
    newRun();
  };
  const loopR = run(frame);
  pause = async () => { if (st.phase !== 'fly' && st.phase !== 'gate') return; loopR.pause(true); showTouch(false); thr.stop(); const c = await card(ui, { kicker: 'Paused', title: 'Holding position', buttons: ['Resume', 'Restart'] }); loopR.pause(false); if (c === 1) newRun(); else showTouch(true); };
  onKey((e) => { if (e.code === 'Escape' || e.code === 'KeyP') pause(); });
  const thr = sfx.hum('sawtooth', 380);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e3 = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let now = 0;

  const gameOver = async () => {
    st.phase = 'over'; showTouch(false); thr.stop(); burst(st.x, st.y, 0, 220, 0xffa860, 40); ship.visible = false; sfx.noise(1.2, .5, 600);
    const b = best.get('space') ?? 0; if (st.score > b) best.set('space', st.score);
    await new Promise((r) => setTimeout(r, 1400));
    const c = await card(ui, { kicker: `Lost in sector ${st.sector + 1}`, title: 'Ship destroyed', body: `<div class="gk-stats"><div><small>Score</small><b>${st.score.toLocaleString()}</b></div><div><small>Cells</small><b>${st.cells}</b></div><div><small>Best</small><b>${Math.max(b, st.score).toLocaleString()}</b></div></div>`, buttons: ['Fly again', 'Menu'] });
    ship.visible = true; if (c === 0) newRun(); else menu();
  };
  const sectorDone = async () => {
    st.phase = 'jump'; showTouch(false); thr.stop(); sfx.blip(220, 1.2, 'sine', .3, 4);
    const s = SECTORS[st.sector]; st.score += 1000 + Math.round(st.shield) * 10;
    await new Promise((r) => setTimeout(r, 1200));
    if (st.sector === 2) {
      const b = best.get('space') ?? 0; if (st.score > b) best.set('space', st.score);
      const c = await card(ui, { kicker: 'All three sectors', title: 'Arrived at Sirius', body: `<p>${s.note}</p><div class="gk-stats"><div><small>Score</small><b>${st.score.toLocaleString()}</b></div><div><small>Shield</small><b>${Math.round(st.shield)}%</b></div><div><small>Best</small><b>${Math.max(b, st.score).toLocaleString()}</b></div></div>`, buttons: ['Fly again', 'Menu'] });
      if (c === 0) newRun(); else menu(); return;
    }
    await card(ui, { kicker: `Sector ${st.sector + 1} clear`, title: s.name, body: `<p>${s.note}</p><p>Real distance from the Sun: ${s.ly} light years. Light takes ${s.ly} years to make this trip.</p><div class="gk-stats"><div><small>Score</small><b>${st.score.toLocaleString()}</b></div><div><small>Shield</small><b>${Math.round(st.shield)}%</b></div><div><small>Cells</small><b>${st.cells}</b></div></div>`, buttons: ['Next jump'] });
    st.shield = Math.min(100, st.shield + 25); startSector(st.sector + 1);
  };

  function frame(dt) {
    now += dt; S.watch(dt); neb.uniforms.t.value = now; portal.material.uniforms.t.value = now;
    const sec = SECTORS[st.sector], fly = st.phase === 'fly' || st.phase === 'gate';
    /* input */
    let kx = (K.has('KeyD', 'ArrowRight') ? 1 : 0) - (K.has('KeyA', 'ArrowLeft') ? 1 : 0), ky = (K.has('KeyW', 'ArrowUp') ? 1 : 0) - (K.has('KeyS', 'ArrowDown') ? 1 : 0);
    if (kx || ky) { mouseOn = false; aim.x = clamp(aim.x + kx * 60 * dt, -BX, BX); aim.y = clamp(aim.y + ky * 40 * dt, -BY, BY); }
    const boosting = fly && (K.has('ShiftLeft', 'ShiftRight') || bB.down);
    st.boost = damp(st.boost, boosting ? 1 : 0, 4, dt);
    const speed = (st.phase === 'menu' ? 60 : sec.speed) * (1 + st.boost * .6) * (st.phase === 'jump' ? 4 : 1);
    if (fly) {
      st.vx = damp(st.vx, (aim.x - st.x) * 4, 8, dt); st.vy = damp(st.vy, (aim.y - st.y) * 4, 8, dt);
      st.x = clamp(st.x + st.vx * dt, -BX, BX); st.y = clamp(st.y + st.vy * dt, -BY, BY);
      st.dist += speed * dt; st.score += Math.round(speed * dt * (1 + st.boost) * .2);
    }
    st.bank = damp(st.bank, -st.vx * .025, 6, dt);
    ship.position.set(st.x, st.y + (st.phase === 'menu' ? Math.sin(now) * .4 : 0), st.phase === 'jump' ? ship.position.z - dt * 300 : 0);
    ship.rotation.set(st.vy * .015, st.phase === 'menu' ? Math.sin(now * .3) * .25 : -st.vx * .006, st.bank);
    ship.userData.flames.forEach((f) => { f.scale.set(1, .7 + st.boost * 1.6 + Math.sin(now * 40) * .08, 1); });
    if (fly) thr.set(70 + st.boost * 40, .05 + st.boost * .05);
    /* camera rides behind, leaning into turns */
    const cz = st.phase === 'menu' ? 17 : 16 - st.boost * 2;
    camera.position.set(st.x * .7 + (st.phase === 'menu' ? Math.sin(now * .2) * 6 : 0), st.y * .7 + 4.4, cz);
    camera.lookAt(st.x * .85, st.y * .85 + .6, -30); camera.rotation.z += st.bank * .3;
    camera.fov = damp(camera.fov, 62 + st.boost * 12, 4, dt); camera.updateProjectionMatrix();
    if (st.phase === 'menu' && S.w >= 900) camera.setViewOffset(S.w, S.h, -S.w * .2, 0, S.w, S.h); else if (camera.view) camera.clearViewOffset();
    starPts.position.z = (starPts.position.z + speed * dt * .02) % 200;
    /* streaks */
    for (let i = 0; i < SN; i++) { let z = sx[i * 3 + 2] + speed * dt * 1.4; if (z > 20) { z -= 620; sx[i * 3] = (Math.random() - .5) * 140; sx[i * 3 + 1] = (Math.random() - .5) * 90; } sx[i * 3 + 2] = z; const L = 2 + speed * .05 * (1 + st.boost * 2); sp.set([sx[i * 3], sx[i * 3 + 1], z, sx[i * 3], sx[i * 3 + 1], z - L], i * 6); }
    sg.attributes.position.needsUpdate = true; streaks.material.opacity = .15 + st.boost * .4;
    /* spawning */
    if (st.phase === 'fly') {
      st.spawnT -= dt * sec.rate * (1 + st.dist / sec.len * .8) * speed / sec.speed;
      while (st.spawnT < 0) {
        st.spawnT += .32;
        if (rocks.length < MAXR * 3) { const big = Math.random() < .18; const r = big ? 5 + Math.random() * 5 : 1.4 + Math.random() * 2.8;
          rocks.push({ x: (Math.random() - .5) * (BX * 2 + 30), y: (Math.random() - .5) * (BY * 2 + 16), z: -700 - Math.random() * 100, r, k: (Math.random() * 4) | 0, rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - .5) * 1.4, sy: (Math.random() - .5) * 1.4, vx: (Math.random() - .5) * 4, vy: (Math.random() - .5) * 3, hp: big ? 4 : 1, sc: [1, .8 + Math.random() * .4, 1] }); }
        /* aimed rocks keep the player honest */
        if (Math.random() < .25) rocks.push({ x: st.x + (Math.random() - .5) * 6, y: st.y + (Math.random() - .5) * 4, z: -700, r: 2 + Math.random() * 2, k: (Math.random() * 4) | 0, rx: 0, ry: 0, sx: 1, sy: .7, vx: 0, vy: 0, hp: 1, sc: [1, 1, 1] });
      }
      st.cellT -= dt * sec.cells; if (st.cellT < 0) { st.cellT = 1 + Math.random(); const g = new THREE.Group(); const m = new THREE.Mesh(cellG, cellM); g.add(m); const rr = new THREE.Mesh(ringG, ringM); g.add(rr); g.position.set((Math.random() - .5) * BX * 1.8, (Math.random() - .5) * BY * 1.8, -700); scene.add(g); cells.push({ g, rr }); }
      if (st.dist >= sec.len) { st.phase = 'gate'; gate.visible = true; gate.position.set(0, 0, -900); }
    }
    if (st.phase === 'gate') { gate.position.z += speed * dt; gate.rotation.z += dt * .2; if (gate.position.z > -2) sectorDone(); }
    if (st.phase === 'jump') { gate.position.z += speed * dt; }
    /* firing */
    st.fireT -= dt;
    const firing = fly && (K.has('Space') || mdown || bF.down || (st.autoFire && TOUCH));
    if (firing && st.fireT <= 0) {
      st.fireT = .11;
      for (const s of [1, -1]) { const m = new THREE.Mesh(laserG, laserM); m.position.set(st.x + s * 2.2 * Math.cos(st.bank), st.y - .05 + s * 2.2 * Math.sin(st.bank), -2); scene.add(m); lasers.push({ m, vx: st.vx * .2, vy: st.vy * .2 }); }
      sfx.blip(900, .06, 'square', .05, .4);
    }
    for (let i = lasers.length - 1; i >= 0; i--) { const l = lasers[i]; l.m.position.z -= 520 * dt; l.m.position.x += l.vx * dt; l.m.position.y += l.vy * dt; if (l.m.position.z < -650) { scene.remove(l.m); lasers.splice(i, 1); } }
    /* rocks: move, collide, draw */
    const cnt = [0, 0, 0, 0];
    for (let i = rocks.length - 1; i >= 0; i--) {
      const r = rocks[i]; r.z += speed * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.rx += r.sx * dt; r.ry += r.sy * dt;
      let dead = r.z > 30;
      for (let j = lasers.length - 1; j >= 0 && !dead; j--) { const l = lasers[j].m.position; if (Math.abs(l.z - r.z) < r.r + 4 && (l.x - r.x) ** 2 + (l.y - r.y) ** 2 < (r.r + .4) ** 2) { scene.remove(lasers[j].m); lasers.splice(j, 1); r.hp--; burst(l.x, l.y, r.z + r.r, 8, 0xffc080, 10); if (r.hp <= 0) { dead = true; st.score += Math.round(50 * r.r); burst(r.x, r.y, r.z, Math.min(90, 20 + r.r * 10), 0xffa060, 10 + r.r * 3); flash.position.set(r.x, r.y, r.z); flash.intensity = 40 + r.r * 20; sfx.noise(.35, .25, 700); } } }
      if (!dead && fly && st.inv <= 0 && Math.abs(r.z) < r.r + 2 && (r.x - st.x) ** 2 + ((r.y - st.y) * 1.4) ** 2 < (r.r + 2.2) ** 2) {
        dead = true; st.shield -= 14 + r.r * 4; st.inv = .6; burst(r.x, r.y, r.z, 50, 0xff7040, 18); sfx.noise(.5, .5, 400); hit.classList.add('on'); setTimeout(() => hit.classList.remove('on'), 260);
        if (st.shield <= 0) { st.shield = 0; gameOver(); }
      }
      if (dead) { rocks.splice(i, 1); continue; }
      const k = cnt[r.k]++; if (k >= MAXR) continue;
      e3.set(r.rx, r.ry, 0); q.setFromEuler(e3); v3.set(r.x, r.y, r.z); s3.set(r.r * r.sc[0], r.r * r.sc[1], r.r * r.sc[2]); m4.compose(v3, q, s3); rockI[r.k].setMatrixAt(k, m4);
    }
    rockI.forEach((m, i) => { m.count = Math.min(cnt[i], MAXR); m.instanceMatrix.needsUpdate = true; });
    st.inv -= dt; ship.visible = st.phase === 'over' ? false : st.inv > 0 ? Math.sin(now * 40) > 0 : true;
    flash.intensity *= Math.exp(-dt * 10);
    /* energy cells */
    for (let i = cells.length - 1; i >= 0; i--) { const c = cells[i]; c.g.position.z += speed * dt; c.g.rotation.y += dt * 2; c.rr.rotation.x += dt * 3;
      const d2 = (c.g.position.x - st.x) ** 2 + (c.g.position.y - st.y) ** 2;
      if (fly && Math.abs(c.g.position.z) < 3 && d2 < 16) { st.cells++; st.shield = Math.min(100, st.shield + 12); st.score += 250; burst(c.g.position.x, c.g.position.y, 0, 40, 0x55ffc8, 12); sfx.blip(880, .2, 'sine', .25, 1.5); scene.remove(c.g); cells.splice(i, 1); continue; }
      if (c.g.position.z > 30) { scene.remove(c.g); cells.splice(i, 1); } }
    /* particles */
    for (let i = 0; i < PN; i++) { if (pl[i] <= 0) { pp[i * 3 + 2] = 9999; continue; } pl[i] -= dt; pp[i * 3] += pv[i * 3] * dt; pp[i * 3 + 1] += pv[i * 3 + 1] * dt; pp[i * 3 + 2] += pv[i * 3 + 2] * dt + speed * dt * .5; const f = Math.max(0, pl[i]); pc[i * 3] *= .985; pc[i * 3 + 1] *= .975; pc[i * 3 + 2] *= .96; if (f <= 0) pp[i * 3 + 2] = 9999; }
    pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
    /* HUD */
    if (st.phase !== 'menu') {
      const pr = st.phase === 'fly' ? st.dist / sec.len : 1;
      top.innerHTML = `<div class="sp-row"><span>Sector<b> ${st.sector + 1}/3</b></span><span>${sec.name} · ${sec.ly} ly</span><span><b>${st.score.toLocaleString()}</b></span></div><div class="sp-prog"><i style="width:${(pr * 100).toFixed(1)}%"></i></div>`;
      sh.innerHTML = `Shield ${Math.round(st.shield)}% · Cells ${st.cells}<div class="bar"><i style="width:${st.shield}%"></i></div>`; sh.classList.toggle('low', st.shield < 30);
      v3.set(st.x, st.y, -60).project(camera); ret.style.left = ((v3.x + 1) / 2 * S.w) + 'px'; ret.style.top = ((1 - v3.y) / 2 * S.h) + 'px';
    } else { top.innerHTML = ''; sh.innerHTML = ''; }
    S.render();
  }
  menu();
}
