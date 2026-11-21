/* Homepage 0.9: the 30-world ring in real 3D (Three.js). A curved gallery of portals around the viewer, a mirror floor,
   a nebula sky that takes the colour of the region, drifting dust, and mouse parallax. Drawn only while on screen.
   Drag or use the arrows to turn it; click a side portal to bring it forward, click the front one to enter. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, PlaneGeometry, ShaderMaterial, TextureLoader, SRGBColorSpace, Color, Vector2, Vector3,
  Raycaster, AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, SphereGeometry, BackSide, ACESFilmicToneMapping, LinearMipmapLinearFilter, type Texture,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import type { P3Item } from './portal30';

interface Hooks { active(i: number): void; enter(i: number, r: DOMRect): void }

const CW = 2.4, CH = 3.2, R = 9, STEP = .27, CZ = 3; /* card size, ring radius, angle between portals (radians) */

const VS = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
/* a portal: the photo with rounded corners, a soft inner vignette, a glass sheen that moves with the angle, a tinted rim
   that lights up when the portal is in front, and a fade for portals leaving the ring */
const CARD_FS = `precision highp float;varying vec2 vUv;uniform sampler2D map;uniform float ready,act,hov,ang,vis,ar,t;uniform vec3 tint;uniform vec2 img;
float sdr(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}
void main(){
 vec2 p=(vUv-.5)*vec2(${CW.toFixed(2)},${CH.toFixed(2)});float d=sdr(p,vec2(${(CW / 2).toFixed(2)},${(CH / 2).toFixed(2)}),.16);
 float aa=fwidth(d);float m=1.-smoothstep(-aa,aa,d);if(m<.01)discard;
 float ia=img.x/img.y,ca=${(CW / CH).toFixed(4)};vec2 uv=vUv-.5;if(ia>ca)uv.x*=ca/ia;else uv.y*=ia/ca;uv=uv*(1.-.06*hov)+.5;
 uv.x+=ang*.03;
 vec3 c=texture2D(map,uv).rgb*ready+(1.-ready)*vec3(.07,.065,.06);
 float v=smoothstep(1.2,.25,length((vUv-.5)*vec2(1.,1.25)));c*=mix(.55,1.,v);
 c=mix(c,c*vec3(.75,.75,.8),.35*(1.-act));
 float s=smoothstep(.3,0.,abs(vUv.x+vUv.y*.35-.65-ang*1.4))*.07;c+=s*(.5+act*.5);
 float rim=smoothstep(-.06,0.,d);c+=tint*rim*(.25+act*.9+hov*.5);
 c+=tint*.06*act*(1.-vUv.y);
 gl_FragColor=vec4(c,m*vis);}`;
const GLOW_FS = `precision highp float;varying vec2 vUv;uniform vec3 tint;uniform float act,vis;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p*vec2(1.,.82));float g=smoothstep(1.,.28,r);gl_FragColor=vec4(tint*g*g*(.18+act*.75)*vis,1.);}`;
const SKY_FS = `precision highp float;varying vec2 vUv;uniform vec3 tint;uniform float t;
float hs(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 q){float s=0.,w=.5;for(int i=0;i<5;i++){s+=w*ns(q);q*=2.02;w*=.5;}return s;}
void main(){vec2 u=vUv;float h=u.y;vec2 q=vec2(u.x*6.,u.y*3.);
 float n=fb(q+vec2(t*.01,0.)+fb(q*1.7-t*.006));float band=smoothstep(.25,.0,abs(h-.52))*n;
 vec3 c=mix(vec3(.012,.011,.01),vec3(.03,.028,.032),smoothstep(.3,.7,h));
 c+=tint*pow(band,2.2)*.55+vec3(.25,.35,.6)*pow(fb(q*2.3+4.),4.)*.12*smoothstep(.35,.8,h);
 gl_FragColor=vec4(c,1.);}`;
const FADE_FS = `precision highp float;varying vec2 vUv;void main(){float r=length((vUv-.5)*vec2(1.,1.6));gl_FragColor=vec4(.03,.028,.026,smoothstep(.06,.5,r)*.92+.08);}`;

export function mountRing(canvas: HTMLCanvasElement, items: P3Item[], hooks: Hooks) {
  let r: WebGLRenderer;
  try { r = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch { return null; }
  const DPR = Math.min(devicePixelRatio || 1, 2);
  r.setPixelRatio(DPR); r.toneMapping = ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = SRGBColorSpace;
  const scene = new Scene(), cam = new PerspectiveCamera(30, 1, .1, 200);
  const tint = new Color(items[0].tint), tintT = new Color(items[0].tint);
  cam.position.set(0, .55, CZ);

  const sky = new Mesh(new SphereGeometry(90, 48, 24), new ShaderMaterial({ vertexShader: VS, fragmentShader: SKY_FS, side: BackSide, depthWrite: false, uniforms: { tint: { value: tint }, t: { value: 0 } } }));
  scene.add(sky);
  /* dust: a few thousand points in a shell around the ring, drifting slowly */
  {
    const n = 2400, a: number[] = [], s: number[] = [];
    for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, rr = 5 + Math.random() * 40, y = (Math.random() - .3) * 16; a.push(Math.sin(th) * rr, y, -Math.cos(th) * rr); s.push(Math.random()); }
    const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(a, 3)); g.setAttribute('s', new Float32BufferAttribute(s, 1));
    const m = new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { t: { value: 0 }, px: { value: DPR } },
      vertexShader: 'attribute float s;uniform float t,px;varying float vA;void main(){vec3 p=position;p.y+=sin(t*.2+s*40.)*.25;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=(1.+s*2.2)*px*(18./-mv.z);vA=(.25+.75*s)*(.6+.4*sin(t*.8+s*90.));}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vec3(1.,.93,.82)*smoothstep(.5,0.,d)*vA,1.);}' });
    const pts = new Points(g, m); pts.name = 'dust'; scene.add(pts);
  }
  /* the mirror floor, with a dark fade over it so the reflection melts into the dark at the edges */
  const floorY = -CH / 2 - .45;
  const mirror = new Reflector(new PlaneGeometry(80, 80), { textureWidth: 1024, textureHeight: 1024, color: new Color(0x4a4744), clipBias: .003 });
  mirror.rotation.x = -Math.PI / 2; mirror.position.set(0, floorY, -R); scene.add(mirror);
  const fade = new Mesh(new PlaneGeometry(80, 80), new ShaderMaterial({ vertexShader: VS, fragmentShader: FADE_FS, transparent: true, depthWrite: false }));
  fade.rotation.x = -Math.PI / 2; fade.position.set(0, floorY + .01, -R + 3); fade.visible = false; scene.add(fade);

  const ring = new Group(); scene.add(ring);
  const loader = new TextureLoader(), maxAniso = r.capabilities.getMaxAnisotropy();
  const geo = new PlaneGeometry(CW, CH), ggeo = new PlaneGeometry(CW * 2.1, CH * 1.7);
  interface C { it: P3Item; g: Group; card: Mesh; glow: Mesh; u: Record<string, { value: number | Color | Texture | Vector2 | null }>; gu: Record<string, { value: number | Color }>; slot: number; vis: number; visT: number; hov: number; hovT: number; act: number }
  const cs: C[] = items.map((it) => {
    const u = { map: { value: null as Texture | null }, ready: { value: 0 }, act: { value: 0 }, hov: { value: 0 }, ang: { value: 0 }, vis: { value: 0 }, ar: { value: 1 }, t: { value: 0 }, tint: { value: new Color(it.tint) }, img: { value: new Vector2(3, 4) } };
    const card = new Mesh(geo, new ShaderMaterial({ vertexShader: VS, fragmentShader: CARD_FS, uniforms: u, transparent: true, extensions: { derivatives: true } as never }));
    const gu = { tint: { value: new Color(it.tint) }, act: { value: 0 }, vis: { value: 0 } };
    const glow = new Mesh(ggeo, new ShaderMaterial({ vertexShader: VS, fragmentShader: GLOW_FS, uniforms: gu, transparent: true, depthWrite: false, blending: AdditiveBlending }));
    glow.position.z = -.12;
    const g = new Group(); g.add(glow); g.add(card); card.userData.i = it.i; ring.add(g);
    return { it, g, card, glow, u, gu, slot: it.i, vis: 0, visT: 1, hov: 0, hovT: 0, act: 0 };
  });
  /* textures: the front portals first, the rest after */
  const load = (c: C) => loader.load(c.it.img, (t) => { t.colorSpace = SRGBColorSpace; t.anisotropy = maxAniso; t.minFilter = LinearMipmapLinearFilter; t.generateMipmaps = true; c.u.map.value = t; const im = t.image as HTMLImageElement; (c.u.img.value as Vector2).set(im.width, im.height); c.u.ready.value = 1; dirty = 1; });
  cs.slice(0, 5).forEach(load); setTimeout(() => cs.slice(5).forEach(load), 900);

  let order = cs.slice(), pos = 0, posT = 0, vel = 0, dirty = 1, cur = -1, mx = 0, my = 0, tmx = 0, tmy = 0, intro = 0;
  const setItems = (ix: number[]) => {
    const keep = new Set(ix); order = ix.map((i) => cs[i]);
    cs.forEach((c) => { c.visT = keep.has(c.it.i) ? 1 : 0; });
    order.forEach((c, k) => { c.slot = k; });
    pos = Math.min(pos, order.length - 1) - .6; posT = 0; cur = -1; dirty = 1;
  };
  setItems(items.map((x) => x.i));
  pos = -3.2; /* the intro: the ring turns into place when first seen */

  const sz = () => { const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.fov = w / h < 1.3 ? 38 : 30; cam.updateProjectionMatrix(); (mirror.getRenderTarget() as { setSize(a: number, b: number): void }).setSize(Math.min(1024, w * DPR * .5), Math.min(1024, h * DPR * .5)); dirty = 1; };
  const ro = new ResizeObserver(sz); ro.observe(canvas); sz();

  /* ---------- input ---------- */
  const ray = new Raycaster(), ndc = new Vector2();
  const pick = (e: PointerEvent): C | null => {
    const b = canvas.getBoundingClientRect(); ndc.set((e.clientX - b.left) / b.width * 2 - 1, -(e.clientY - b.top) / b.height * 2 + 1); ray.setFromCamera(ndc, cam);
    const hit = ray.intersectObjects(order.map((c) => c.card), false)[0]; return hit ? cs[hit.object.userData.i as number] : null;
  };
  let down = false, x0 = 0, p0 = 0, moved = 0, lx = 0, lt = 0, hovered: C | null = null;
  canvas.addEventListener('pointerdown', (e) => { down = true; moved = 0; x0 = lx = e.clientX; lt = performance.now(); p0 = posT; vel = 0; canvas.setPointerCapture(e.pointerId); canvas.classList.add('drag'); });
  canvas.addEventListener('pointermove', (e) => {
    const b = canvas.getBoundingClientRect(); tmx = (e.clientX - b.left) / b.width - .5; tmy = (e.clientY - b.top) / b.height - .5; dirty = 1;
    if (down) {
      const dx = e.clientX - x0; moved = Math.max(moved, Math.abs(dx)); const k = (document.dir === 'rtl' ? 1 : -1) / (b.width * .16);
      posT = Math.max(-.4, Math.min(order.length - .6, p0 + dx * k));
      const now = performance.now(); vel = (e.clientX - lx) * k / Math.max(8, now - lt) * 16; lx = e.clientX; lt = now;
    } else { const h = pick(e); if (h !== hovered) { if (hovered) hovered.hovT = 0; hovered = h; if (h) h.hovT = 1; canvas.style.cursor = h ? 'pointer' : ''; } }
  });
  const up = (e: PointerEvent) => {
    if (!down) return; down = false; canvas.classList.remove('drag');
    if (moved < 6) { const h = pick(e); if (h) { if (h.slot === Math.round(pos) && Math.abs(pos - h.slot) < .2) enter(h); else posT = h.slot; } return; }
    posT = Math.round(Math.max(0, Math.min(order.length - 1, posT + vel * 6)));
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { tmx = tmy = 0; if (hovered) { hovered.hovT = 0; hovered = null; } dirty = 1; });
  /* a trackpad's sideways swipe turns the ring; up-down scrolling is left to the page */
  let wt = 0;
  canvas.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault(); posT = Math.max(0, Math.min(order.length - 1, posT + e.deltaX / 260)); clearTimeout(wt); wt = window.setTimeout(() => { posT = Math.round(posT); }, 140); }, { passive: false });
  function enter(c: C) {
    if (!c.it.href) { posT = c.slot; return; }
    const v = new Vector3(), b = canvas.getBoundingClientRect(); let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { v.set(sx * CW / 2, sy * CH / 2, 0); c.card.localToWorld(v); v.project(cam); const px = b.left + (v.x + 1) / 2 * b.width, py = b.top + (1 - v.y) / 2 * b.height; x1 = Math.min(x1, px); x2 = Math.max(x2, px); y1 = Math.min(y1, py); y2 = Math.max(y2, py); }
    hooks.enter(c.it.i, new DOMRect(x1, y1, x2 - x1, y2 - y1));
  }

  /* ---------- frame ---------- */
  let on = false, raf = 0, last = performance.now(), t = 0;
  const io = new IntersectionObserver((en) => { on = en.some((x) => x.isIntersecting); if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }, { rootMargin: '100px 0px' });
  io.observe(canvas);
  function frame(now: number) {
    raf = 0; if (!on || document.hidden) return; raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
    if (!down) { posT = Math.max(0, Math.min(order.length - 1, posT)); }
    const k = 1 - Math.pow(.0016, dt); pos += (posT - pos) * k * (intro < 1 ? .55 : 1); intro = Math.min(1, intro + dt * .5);
    mx += (tmx - mx) * .05; my += (tmy - my) * .05;
    const a = Math.round(Math.max(0, Math.min(order.length - 1, pos)));
    if (a !== cur && order[a]) { cur = a; hooks.active(order[a].it.i); tintT.set(order[a].it.tint); }
    tint.lerp(tintT, .04);
    for (const c of cs) {
      c.vis += (c.visT - c.vis) * k; c.hov += (c.hovT - c.hov) * k * 1.4;
      const o = c.slot - pos, ao = Math.abs(o); c.act += ((c.visT && ao < .5 ? 1 : 0) - c.act) * k;
      const th = o * STEP * (document.dir === 'rtl' ? -1 : 1), fwd = c.act * .9 + c.hov * .25;
      const rr = R - fwd; c.g.position.set(Math.sin(th) * rr, Math.sin(t * .7 + c.it.i) * .05 + (1 - c.vis) * -2.4, -Math.cos(th) * rr); c.g.rotation.y = -th; c.g.scale.setScalar((.88 + c.act * .14 + c.hov * .03) * (.4 + .6 * c.vis));
      const fadeEdge = Math.max(0, 1 - Math.max(0, ao - 5.5) / 1.5);
      c.u.vis.value = c.vis * fadeEdge; c.gu.vis.value = c.vis * fadeEdge; c.u.act.value = c.act; c.gu.act.value = c.act; c.u.hov.value = c.hov; c.u.ang.value = Math.max(-1, Math.min(1, o * .25)); c.u.t.value = t;
      c.g.visible = c.vis * fadeEdge > .01;
    }
    const ox = cam.aspect > 1.45 ? -1.5 : 0; cam.position.set(mx * 1.1 + ox * .3, .55 - my * .5, CZ + (1 - intro) * 3); cam.lookAt(mx * .4 + ox, .1 - my * .2, -R);
    (sky.material as ShaderMaterial).uniforms.t.value = t;
    ((scene.getObjectByName('dust') as Points).material as ShaderMaterial).uniforms.t.value = t;
    r.render(scene, cam); dirty = 0;
  }
  void dirty;
  const next = (d: number) => { posT = Math.max(0, Math.min(order.length - 1, Math.round(posT) + d)); };
  const go = (k: number) => { posT = Math.max(0, Math.min(order.length - 1, k)); };
  return { setItems, next, go, dispose() { io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); r.dispose(); } };
}
