/* 021 · Galaxy World (site world 037). Fly through a galaxy you build yourself. Up to 220,000 stars
   move on the GPU with the Galaxy Forge maths of world 037: every orbit is a slightly oval loop turned
   a little more at each radius, stars crowd where the ovals meet, and those crowds line up into spiral
   arms that keep their shape while the stars stream through (the density-wave idea). Switch to
   "material arms" to watch the winding problem happen. Young blue stars and pink star-forming
   nebulae trace the arms, dark dust lanes sit along them, old yellow stars fill the bulge,
   and a Hubble-sequence label (E0–E7, S0, Sa–Sc, SBa–SBc) follows your settings. */
import type { Ctx } from './kit';
import { hubble, omega, type Gal } from './w037lab';
import { THREE, stage, sec, para, slider, segs, stats, chips, btns, glowTex, rng, clamp } from './nskit';

const R0 = 100; /* galaxy radius in scene units (about 50,000 light-years) */

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 21 · Space'), title: t('title', 'Galaxy World'), sub: t('sub', 'Two hundred thousand stars on real orbits. Shape the arms, then fly in to find our Sun.'),
    acc: '#b9a6ff', ink: '#020208', hf: "'Instrument Serif'", fov: 55, near: .1, far: 20000,
    lab: () => import('./w037lab'), labName: t('lab', 'Galaxy Forge (2D)'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.toneMappingExposure = 1.1;
  scene.background = new THREE.Color(0x020208);
  const G: Gal & { mode: 'wave' | 'material'; flat: boolean; speed: number; seed: number } =
    { kind: 'spiral', twist: 1.4, bulge: .25, bar: .3, ell: .3, arms: 2, mode: 'wave', flat: true, speed: 1, seed: 7 };
  const NS = S.phone ? 110000 : 220000;
  let time = 0;

  /* ---- star attributes; positions are computed in the vertex shader every frame ---- */
  const geo = new THREE.BufferGeometry();
  const aOrb = new Float32Array(NS * 4), aMisc = new Float32Array(NS * 4);
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NS * 3), 3));
  geo.setAttribute('aOrb', new THREE.BufferAttribute(aOrb, 4));   /* a, e, ph, th0 */
  geo.setAttribute('aMisc', new THREE.BufferAttribute(aMisc, 4)); /* arm, kind, z, size seed */
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R0 * 2);
  function build() {
    const R = rng(G.seed);
    for (let i = 0; i < NS; i++) {
      const u = R(), o = i * 4, zz = (R() + R() + R() - 1.5) / 1.5;
      if (G.kind === 'elliptical' || u < G.bulge * .55) {
        const a = (G.kind === 'elliptical' ? .95 : .35) * Math.pow(R(), 2.2) + .01;
        aOrb.set([a, R() * .5, R() * 6.283, R() * 6.283], o);
        aMisc.set([-1, 0, zz * (G.kind === 'elliptical' ? 1.4 : .8), R()], o);
      } else {
        const a = .06 + Math.pow(R(), .85) * .94, arm = Math.floor(R() * G.arms);
        const young = R() < .45, hii = young && R() < .035, dust = !young && R() < .22;
        aOrb.set([a, .1 + R() * .06, R() * 6.283, arm / G.arms * Math.PI * 2 + (R() - .5) * .5], o);
        aMisc.set([arm, hii ? 2 : dust ? 3 : young ? 1 : 0, zz * (dust ? .018 : young ? .025 : .05) * (1.4 - a * .6), R()], o);
      }
    }
    geo.attributes.aOrb.needsUpdate = true; geo.attributes.aMisc.needsUpdate = true; time = 0;
  }
  const mkU = (dust: number) => ({
    uTime: { value: 0 }, uTwist: { value: G.twist }, uArms: { value: G.arms }, uBar: { value: G.bar }, uEll: { value: G.ell }, uKind: { value: 0 },
    uMode: { value: 0 }, uFlat: { value: 1 }, uR: { value: R0 }, uPx: { value: 1 }, uTex: { value: glowTex(64) }, uDust: { value: dust },
  });
  const U = mkU(0), DU = mkU(1);
  const VS = /* glsl */`
uniform float uTime, uTwist, uArms, uBar, uEll, uKind, uMode, uFlat, uR, uPx, uDust;
attribute vec4 aOrb; attribute vec4 aMisc;
varying vec3 vC; varying float vA;
float om(float r){ r=max(r,.05); return uFlat>.5 ? 1./r : pow(r,-1.5); }
void main(){
  float a=aOrb.x, e=aOrb.y, ph=aOrb.z, th0=aOrb.w, arm=aMisc.x, kind=aMisc.y, z=aMisc.z, sd=aMisc.w;
  bool dust = kind>2.5;
  if((uDust>.5)!=dust){ gl_Position=vec4(2.,2.,2.,1.); gl_PointSize=0.; return; }
  float pattern=uTime*.04, armW=1., x, y;
  if(uKind>.5){ float th=th0+uTime*om(a+.2)*.3; x=cos(th)*a; y=sin(th)*a*(1.-uEll); armW=0.; }
  else if(arm<0. || uMode<.5){
    float m=uArms; bool inBar=arm>=0. && a<uBar*.45; bool bulge=arm<0.;
    float orient=inBar ? pattern : a*uTwist*3.2+pattern;
    float M=ph+uTime*om(a)*.25-pattern;
    float k=bulge ? .05 : (inBar ? .38 : .4); float mm=inBar ? 2. : m;
    float E=M; for(int i=0;i<4;i++){ E-=(E-(2.*k/mm)*sin(mm*E)-M)/(1.-2.*k*cos(mm*E)); }
    float ee=bulge ? e*.3 : (inBar ? .5 : e);
    float rr=a*(1.+ee*cos(mm*E))/(1.+ee);
    armW=bulge ? 0. : max(0.,cos(mm*E));
    float ang=E+orient; x=cos(ang)*rr; y=sin(ang)*rr;
  } else {
    float th=th0+a*uTwist*3.2+uTime*om(a)*.25+ph*.02; x=cos(th)*a; y=sin(th)*a; armW=1.;
  }
  float zz=z*(uKind>.5 ? a : (arm<0. ? a*.9 : 1.));
  vec3 p=vec3(x,zz,y)*uR;
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  vec3 old=mix(vec3(1.,.78,.52),vec3(1.,.9,.75),sd); vec3 yng=mix(vec3(.55,.7,1.),vec3(.78,.87,1.),sd);
  float sz; float al;
  if(kind<.5){ vC=old; sz=.9+sd*1.; al=.45*(arm<0.?1.:.35+.8*armW); if(arm<0.) vC=mix(vec3(1.,.7,.4),old,clamp(a*2.,0.,1.)); }
  else if(kind<1.5){ vC=yng; sz=1.+sd*1.6; al=1.*smoothstep(.25,.9,armW); }
  else if(kind<2.5){ vC=vec3(1.,.36,.6); sz=7.+sd*9.; al=.32*smoothstep(.55,.95,armW); }
  else { vC=vec3(.05,.03,.02); sz=9.+sd*10.; al=.5*smoothstep(.3,.8,armW)*smoothstep(.1,.3,a); }
  float d=max(-mv.z,.01);
  float ps=sz*uPx*150./d;
  gl_PointSize=clamp(ps,1.,(dust||kind>1.5) ? 160. : 7.);
  vA=al*min(1.,ps); if(dust||kind>1.5) vA*=smoothstep(3.,14.,d);              /* stars smaller than a pixel fade instead of popping */
}`;
  const FS = /* glsl */`uniform sampler2D uTex; varying vec3 vC; varying float vA;
void main(){ float m=texture2D(uTex,gl_PointCoord).r; gl_FragColor=vec4(vC*m*vA*1.5,m*vA);
#include <colorspace_fragment>
}`;
  const starM = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const dustM = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ float m=texture2D(uTex,gl_PointCoord).r; gl_FragColor=vec4(vC,m*vA*.5); }', uniforms: DU, transparent: true, depthWrite: false });
  const stars = new THREE.Points(geo, starM), dust = new THREE.Points(geo, dustM);
  dust.renderOrder = 2; stars.renderOrder = 3; stars.frustumCulled = dust.frustumCulled = false;
  scene.add(dust, stars);
  /* core glow and the milky disc haze */
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(256, [[0, 'rgba(255,232,195,1)'], [.12, 'rgba(255,205,150,.6)'], [.45, 'rgba(255,170,110,.12)'], [1, 'rgba(255,160,100,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.renderOrder = 1; scene.add(core);
  const hazeM = new THREE.MeshBasicMaterial({ map: glowTex(256, [[0, 'rgba(255,220,180,.3)'], [.35, 'rgba(170,170,230,.1)'], [1, 'rgba(120,120,200,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(R0 * 2.4, R0 * 2.4), hazeM); haze.rotation.x = -Math.PI / 2; haze.renderOrder = 1; scene.add(haze);
  /* background sky: distant stars and two far galaxies */
  {
    const n = 9000, p = new Float32Array(n * 3), c = new Float32Array(n * 3), R = rng(3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(6000 + R() * 2000); p.set([v.x, v.y, v.z], i * 3); const w = .4 + R() * .6; c.set([w, w * (.85 + R() * .15), w * (.8 + R() * .25)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: .75, depthWrite: false })));
    for (const [x, y, z, s, rot] of [[-3800, 1400, -4200, 600, .6], [4200, -900, -3000, 380, 1.9]] as const) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(128, [[0, 'rgba(255,235,210,.7)'], [.3, 'rgba(200,190,255,.18)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, rotation: rot }));
      sp.position.set(x, y, z); sp.scale.set(s, s * .35, 1); scene.add(sp);
    }
  }
  /* the Sun, about 26,000 light-years out */
  const sunM = new THREE.Mesh(new THREE.SphereGeometry(.15, 20, 14), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(128, [[0, 'rgba(255,240,200,1)'], [.2, 'rgba(255,220,150,.5)'], [1, 'rgba(255,200,120,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  sunGlow.scale.setScalar(2); sunM.add(sunGlow); scene.add(sunM);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.55, .6, 64), new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false })); scene.add(ring);
  const sunTag = S.tag(t('sun', 'You are here · the Sun'));
  const sunA = .52, sunTh = 2.2;

  /* ---- panel ---- */
  const B = S.body;
  const info = stats(B, [['type', t('type', 'Hubble type')], ['stars', t('stars', 'Stars')], ['orbits', t('orbits', 'Orbits so far')], ['wind', t('wind', 'Arm winding')]], true);
  sec(B, t('s.shape', 'Shape the galaxy'));
  const kindSeg = segs(B, '', [['spiral', t('spiral', 'Spiral')], ['elliptical', t('ell', 'Elliptical')]], G.kind, (v) => { G.kind = v as Gal['kind']; build(); push(); });
  slider(B, t('r.arms', 'Spiral arms'), { min: 1, max: 4, step: 1, value: G.arms }, (v) => { G.arms = v; build(); push(); });
  slider(B, t('r.twist', 'Arm winding'), { min: 0, max: 3, step: .1, value: G.twist, fmt: (v) => v.toFixed(1) }, (v) => { G.twist = v; push(); });
  slider(B, t('r.bulge', 'Central bulge'), { min: .05, max: .9, step: .05, value: G.bulge, fmt: (v) => Math.round(v * 100) + '%' }, (v) => { G.bulge = v; build(); push(); });
  slider(B, t('r.bar', 'Central bar'), { min: 0, max: 1, step: .05, value: G.bar, fmt: (v) => Math.round(v * 100) + '%' }, (v) => { G.bar = v; push(); });
  slider(B, t('r.ell', 'Flattening (elliptical)'), { min: 0, max: .7, step: .05, value: G.ell, fmt: (v) => 'E' + Math.round(v * 10) }, (v) => { G.ell = v; push(); });
  sec(B, t('s.phys', 'The physics'));
  para(B, t('p.phys', 'Spiral arms are traffic jams of stars, not fixed chains of stars. Try material arms to see why: the inside turns faster, so the arms wind up within a few turns.'));
  segs(B, t('r.mode', 'Arms are'), [['wave', t('wave', 'Density waves')], ['material', t('mat', 'Material arms')]], G.mode, (v) => { G.mode = v as 'wave'; time = 0; push(); });
  segs(B, t('r.curve', 'Rotation'), [['flat', t('flat', 'Flat (dark matter)')], ['kep', t('kep', 'Visible mass only')]], 'flat', (v) => { G.flat = v === 'flat'; push(); });
  slider(B, t('r.speed', 'Time speed'), { min: 0, max: 4, step: .1, value: G.speed, fmt: (v) => v.toFixed(1) + '×' }, (v) => { G.speed = v; });
  btns(B, [[t('b.mw', 'Milky Way'), () => preset({ kind: 'spiral', arms: 2, twist: 1.6, bulge: .3, bar: .45 })], [t('b.m51', 'Whirlpool'), () => preset({ kind: 'spiral', arms: 2, twist: 1.1, bulge: .2, bar: 0 })], [t('b.e', 'Elliptical'), () => preset({ kind: 'elliptical', ell: .3, bulge: .9 })]]);
  function preset(p: Partial<typeof G>) { Object.assign(G, p); kindSeg.set(G.kind); build(); push(); }

  function push() {
    for (const u of [U, DU]) { u.uTwist.value = G.twist; u.uArms.value = G.arms; u.uBar.value = G.bar; u.uEll.value = G.ell; u.uKind.value = G.kind === 'elliptical' ? 1 : 0; u.uMode.value = G.mode === 'wave' ? 0 : 1; u.uFlat.value = G.flat ? 1 : 0; }
    haze.visible = G.kind === 'spiral'; core.scale.setScalar(R0 * (G.kind === 'spiral' ? .3 + G.bulge * .6 : 1.3)); upd();
  }
  function upd() {
    info('type', hubble(G)); info('stars', NS.toLocaleString(ctx.lang));
    info('orbits', (time * omega(.5, G.flat) * .25 / (Math.PI * 2)).toFixed(1));
    if (G.mode === 'material' && G.kind === 'spiral') info('wind', `${(time * .25 * (omega(.2, G.flat) - omega(.9, G.flat)) / (Math.PI * 2)).toFixed(1)} ${t('turns', 'turns')}`);
    else info('wind', G.kind === 'spiral' ? t('steady', 'steady') : '–');
  }

  /* ---- camera ---- */
  const home = { p: new THREE.Vector3(0, 125, 170), t: new THREE.Vector3(0, -10, 0) };
  if (S.phone) home.p.multiplyScalar(1.45);
  camera.position.set(0, 900, 1400); controls.target.copy(home.t); S.setHome(home.p, home.t);
  controls.maxDistance = 1600; controls.minDistance = .6;
  chips(S, [['over', t('c.over', 'Above')], ['edge', t('c.edge', 'Edge-on')], ['sun', t('c.sun', 'Fly to the Sun')], ['core', t('c.core', 'Into the core')]], 'over', (v) => {
    if (v === 'over') S.flyTo(home.p, home.t, 2.6);
    if (v === 'edge') S.flyTo(new THREE.Vector3(0, 5, S.phone ? 300 : 210), new THREE.Vector3(0, 0, 0), 2.6);
    if (v === 'sun') { const p = sunM.position; S.flyTo(p.clone().add(new THREE.Vector3(2.5, 1.8, 4.5)), p.clone(), 3.4, () => S.showCard(t('k.sun', 'Our Sun'), t('k.sunt', 'About 26,000 light-years from the centre, between two arms. The Sun takes about 230 million years to go round once: the last time it was here, the first dinosaurs were appearing.')), 30); followSun = true; }
    else followSun = false;
    if (v === 'core') S.flyTo(new THREE.Vector3(9, 3, 12), new THREE.Vector3(0, 0, 0), 3, undefined, 20);
  });
  let followSun = false;

  S.onResize(() => { U.uPx.value = DU.uPx.value = renderer.getPixelRatio() * clamp(S.size.h / 800, .6, 1.4); });
  build(); push();
  const prev = new THREE.Vector3();
  S.onFrame((dt) => {
    time += dt * G.speed * .35 * (ctx.calm ? .4 : 1);
    U.uTime.value = DU.uTime.value = time;
    prev.copy(sunM.position);
    const th = sunTh + time * omega(sunA, G.flat) * .25;
    sunM.position.set(Math.cos(th) * sunA * R0, .2, Math.sin(th) * sunA * R0);
    if (followSun) { const d = sunM.position.clone().sub(prev); camera.position.add(d); controls.target.add(d); }
    sunM.visible = ring.visible = G.kind === 'spiral';
    ring.position.copy(sunM.position); ring.lookAt(camera.position); ring.visible = sunM.visible && camera.position.distanceTo(sunM.position) < 60;
    sunTag.at(sunM.position, sunM.visible && camera.position.distanceTo(sunM.position) < 140);
    if (Math.random() < .05) upd();
  });
  controls.addEventListener('start', () => { followSun = false; });
  S.flyTo(home.p, home.t, 4);
  S.start();
}
