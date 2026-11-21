/* World 8 · AI Image & Design: The Design Desk.
   Open a photo (or a creation from World 7), edit it for real on your device with a GPU pipeline (exposure, contrast,
   colour, film looks, crop, rotate, grain, vignette, your own headline), and see it live on 3D mockups on a sunlit
   designer's desk: a framed poster, a phone, a mug and a gallery canvas. Ask the AI for bigger changes ("make the
   background a beach") through the site's image service; every AI edit can be undone. Download the finished picture. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { boot, studioEnv, sheet, linkView, h, css, range, btn, row, seg, hud, store, cnv, tex, grainNormal, TAU, clamp, isPhone, calm } from './tk.js';
import { status, make, MESSAGES, saveCreation, listCreations, download, toBase64 } from './aiimg.js';

const LOOKS = [['none', 'Natural'], ['film', 'Film'], ['noir', 'Noir'], ['teal', 'Teal & orange'], ['fade', 'Faded'], ['vivid', 'Vivid'], ['warm', 'Golden hour'], ['cool', 'Nordic']];
const LOOK_ID = Object.fromEntries(LOOKS.map(([k], i) => [k, i]));
const AI_IDEAS = ['Make the background a beach at sunset', 'Turn it into a watercolour painting', 'Make it night with neon lights and rain', 'Remove the background and use plain white', 'Add soft morning fog', 'Make it look like a 1970s film photo'];

/* the edit itself: one fragment shader, applied at full resolution into a render target */
const EDIT_FS = `
precision highp float;
uniform sampler2D uSrc, uText; uniform vec2 uScale, uOff; uniform float uRot, uFlip;
uniform float uExp, uCon, uSat, uWarm, uTint, uVig, uGrain, uFade, uLook, uSharp, uSrcAspect, uOutAspect, uHasText; uniform vec2 uTexel;
varying vec2 vUv;
vec3 sat(vec3 c, float s){ float l = dot(c, vec3(.2126,.7152,.0722)); return mix(vec3(l), c, s); }
float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
vec3 look(vec3 c, float id){
  if (id < .5) return c;
  if (id < 1.5) { c = pow(c, vec3(1.05,1.0,.95)); c = mix(c, smoothstep(0.,1.,c), .5); return c * vec3(1.03,1.0,.94) + vec3(.02,.015,.03); }      // film
  if (id < 2.5) { float l = dot(c, vec3(.3,.59,.11)); l = smoothstep(.02,.98,l); return vec3(pow(l, 1.1)); }                                       // noir
  if (id < 3.5) { float l = dot(c, vec3(.2126,.7152,.0722)); vec3 sh = vec3(.0,.35,.45), hi = vec3(1.,.62,.32); return mix(c, mix(sh, hi, l) * (l*1.4+.2), .35); }  // teal & orange
  if (id < 4.5) { c = mix(vec3(.12,.11,.13), vec3(.93,.9,.86), c); return sat(c, .75); }                                                          // faded
  if (id < 5.5) { c = sat(c, 1.35); return mix(c, smoothstep(0.,1.,c), .45); }                                                                     // vivid
  if (id < 6.5) { return sat(c * vec3(1.1,1.0,.82), 1.1) + vec3(.03,.01,0.); }                                                                      // golden
  return sat(c * vec3(.92,1.0,1.08), .85);                                                                                                         // nordic
}
void main(){
  /* crop to the output shape, then zoom, pan, rotate and flip */
  vec2 p = vUv - .5;
  if (uFlip > .5) p.x = -p.x;
  float c = cos(uRot), s = sin(uRot);
  p.x *= uOutAspect; p = vec2(c*p.x - s*p.y, s*p.x + c*p.y); p.x /= uOutAspect;
  vec2 fit = uOutAspect > uSrcAspect ? vec2(1., uSrcAspect / uOutAspect) : vec2(uOutAspect / uSrcAspect, 1.);
  vec2 uv = p * fit / uScale + .5 + uOff;
  vec3 col = texture2D(uSrc, uv).rgb;
  if (uSharp > 0.) { vec3 b = (texture2D(uSrc, uv + vec2(uTexel.x,0)).rgb + texture2D(uSrc, uv - vec2(uTexel.x,0)).rgb + texture2D(uSrc, uv + vec2(0,uTexel.y)).rgb + texture2D(uSrc, uv - vec2(0,uTexel.y)).rgb) * .25; col += (col - b) * uSharp * 2.; }
  if (uv.x < 0. || uv.x > 1. || uv.y < 0. || uv.y > 1.) col = vec3(.08);
  col *= exp2(uExp);
  col = (col - .5) * (1. + uCon) + .5;
  col += vec3(uWarm * .08, uTint * .06, -uWarm * .08);
  col = sat(col, 1. + uSat);
  col = look(clamp(col, 0., 1.), uLook);
  col = mix(col, col * .85 + .1, uFade);
  float d = length((vUv - .5) * vec2(uOutAspect, 1.) / max(uOutAspect, 1.)); col *= 1. - uVig * smoothstep(.25, .85, d);
  col += (hh(vUv * 1000. + 3.1) - .5) * uGrain * .18;
  if (uHasText > .5) { vec4 t = texture2D(uText, vUv); col = mix(col, t.rgb, t.a); }
  gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
}`;

/* the opening design, drawn in code so the desk is not empty: clearly a design, not a photo */
function starter() {
  const W = 1200, H = 1500, [c, g] = cnv(W, H);
  const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0f1630'); gr.addColorStop(.55, '#3a1f4a'); gr.addColorStop(1, '#e08a3c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 700; i++) { const x = Math.random() * W, y = Math.random() * H * .7, r = Math.random() * 1.8; g.fillStyle = `rgba(255,255,255,${Math.random() * .8})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  g.strokeStyle = 'rgba(255,214,150,.9)'; g.lineWidth = 10; g.beginPath(); g.ellipse(W / 2, H * .46, 330, 330, 0, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(255,214,150,.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W / 2, H * .46, 480, 140, -.35, 0, TAU); g.stroke();
  const sun = g.createRadialGradient(W / 2, H * .46, 10, W / 2, H * .46, 300); sun.addColorStop(0, 'rgba(255,230,190,.95)'); sun.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = sun; g.beginPath(); g.arc(W / 2, H * .46, 300, 0, TAU); g.fill();
  g.fillStyle = '#1a0f12'; g.beginPath(); g.moveTo(0, H); g.lineTo(0, H * .78); for (let x = 0; x <= W; x += 40) g.lineTo(x, H * .8 - Math.abs(Math.sin(x * .007)) * 160 - Math.sin(x * .02) * 30); g.lineTo(W, H); g.fill();
  return c;
}

export async function start(canvas, ui) {
  css('d-css', `.d-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.d-chips .tk-btn{min-height:38px;padding:7px 12px;border-radius:999px;font-size:12.5px}
  .d-file{display:none}.d-hist{font:500 12px 'JetBrains Mono',monospace;opacity:.7;margin:6px 0}
  .d-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:6px;margin:6px 0}.d-grid button{aspect-ratio:1;border:0;border-radius:10px;overflow:hidden;padding:0;cursor:pointer}.d-grid img{width:100%;height:100%;object-fit:cover;display:block}`);
  const k = boot(canvas, { fov: 38, bloom: [.12, .4, .98], exposure: 1, bg: 0xd9d2c6, tone: THREE.NeutralToneMapping });
  const { scene, camera, controls, renderer } = k;
  const env = studioEnv(renderer, { bg: 0xcfc8bc, warm: 0xffecd2, cool: 0xe4ecff, strength: 1.1 }); scene.environment = env; scene.environmentIntensity = .55;
  controls.minDistance = .5; controls.maxDistance = 6; controls.maxPolarAngle = Math.PI * .5;

  /* ---------- edit pipeline ---------- */
  const srcTex = new THREE.Texture(); srcTex.colorSpace = THREE.NoColorSpace; srcTex.generateMipmaps = true; srcTex.minFilter = THREE.LinearMipmapLinearFilter;
  const [tc, tg] = cnv(1024, 1024); const textTex = new THREE.CanvasTexture(tc); textTex.colorSpace = THREE.NoColorSpace;
  const U = {
    uSrc: { value: srcTex }, uText: { value: textTex }, uScale: { value: new THREE.Vector2(1, 1) }, uOff: { value: new THREE.Vector2() }, uRot: { value: 0 }, uFlip: { value: 0 },
    uExp: { value: 0 }, uCon: { value: 0 }, uSat: { value: 0 }, uWarm: { value: 0 }, uTint: { value: 0 }, uVig: { value: 0 }, uGrain: { value: 0 }, uFade: { value: 0 }, uLook: { value: 0 }, uSharp: { value: 0 },
    uSrcAspect: { value: 1 }, uOutAspect: { value: 1 }, uHasText: { value: 0 }, uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
  };
  const editMat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }', fragmentShader: EDIT_FS, depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), editMat), qScene = new THREE.Scene(), qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); qScene.add(quad);
  const MAXS = isPhone() ? 1400 : 2048;
  let out = new THREE.WebGLRenderTarget(4, 4, { colorSpace: THREE.SRGBColorSpace, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter }); out.texture.anisotropy = 8;
  out.texture.colorSpace = THREE.SRGBColorSpace;
  let outW = 4, outH = 4, dirty = true;
  function sizeOut() { const a = U.uOutAspect.value; outW = Math.round(a >= 1 ? MAXS : MAXS * a); outH = Math.round(a >= 1 ? MAXS / a : MAXS); out.setSize(outW, outH); tc.width = outW; tc.height = outH; drawText(); dirty = true; }
  function renderEdit() { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(out); renderer.render(qScene, qCam); renderer.setRenderTarget(prev); dirty = false; }

  /* ---------- the desk scene ---------- */
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0xb8a890, 1.0));
  const sun = new THREE.DirectionalLight(0xffe9cc, 3); sun.position.set(-2.5, 3.5, 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: .5, far: 10 }); sun.shadow.radius = 4; sun.shadow.bias = -.0002; sun.shadow.normalBias = .01; scene.add(sun);
  /* window light shape on the wall (soft bars of light) */
  const wallM = new THREE.MeshStandardMaterial({ color: 0xebe4d8, roughness: .95, envMap: env, envMapIntensity: .3 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), wallM); wall.position.set(0, 2, -.75); wall.receiveShadow = true; scene.add(wall);
  const [wc, wg] = cnv(64, 1024); const wgr = wg.createLinearGradient(0, 0, 0, 1024); wgr.addColorStop(0, '#5a3e28'); wgr.addColorStop(1, '#3d2a1c'); wg.fillStyle = wgr; wg.fillRect(0, 0, 64, 1024);
  for (let i = 0; i < 300; i++) { wg.strokeStyle = `rgba(20,10,4,${Math.random() * .25})`; wg.beginPath(); const x = Math.random() * 64; wg.moveTo(x, 0); wg.bezierCurveTo(x + 6, 300, x - 6, 700, x + 3, 1024); wg.stroke(); }
  const woodT = tex(wc); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(10, 1); woodT.rotation = Math.PI / 2;
  const desk = new THREE.Mesh(new THREE.BoxGeometry(4.2, .06, 1.6), new THREE.MeshPhysicalMaterial({ map: woodT, roughness: .45, clearcoat: .5, clearcoatRoughness: .3, normalMap: grainNormal(512, .1, .6), normalScale: new THREE.Vector2(.3, .3), envMap: env, envMapIntensity: .5 }));
  desk.position.set(0, .72, .05); desk.receiveShadow = desk.castShadow = true; scene.add(desk);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ color: 0x8f8476, roughness: .8 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const DT = .75;                                                          // desk top height

  const designMat = () => new THREE.MeshStandardMaterial({ map: out.texture, roughness: .55, envMap: env, envMapIntensity: .3 });
  /* 1. framed poster on the wall */
  const poster = new THREE.Group(); poster.position.set(-.55, 1.75, -.72); scene.add(poster);
  const pFrame = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .04), new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, roughness: .4, clearcoat: .7, envMap: env })); pFrame.castShadow = true; poster.add(pFrame);
  const pMat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xfbfaf6, roughness: .95 })); pMat.position.z = .021; poster.add(pMat);
  const pArt = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), designMat()); pArt.position.z = .022; poster.add(pArt);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .02, transmission: 0, transparent: true, opacity: .06, envMap: env, envMapIntensity: 1.2 })); glass.position.z = .024; poster.add(glass);
  /* 2. a phone on the desk */
  const phone = new THREE.Group(); phone.position.set(.55, DT + .006, .45); phone.rotation.set(-Math.PI / 2, 0, .35); scene.add(phone);
  const body = new THREE.Mesh(new RoundedBoxGeometry(.36, .74, .02, 6, .045), new THREE.MeshPhysicalMaterial({ color: 0x1c1c1e, roughness: .25, metalness: .6, clearcoat: 1, envMap: env })); body.castShadow = true; phone.add(body);
  const screenM = new THREE.MeshBasicMaterial({ map: out.texture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.33, .71), screenM); screen.position.z = .0105; phone.add(screen);
  /* 3. a mug, the design wrapped round its front */
  const mug = new THREE.Group(); mug.position.set(1.35, DT + .003, .1); scene.add(mug);
  const cer = new THREE.MeshPhysicalMaterial({ color: 0xf7f5f0, roughness: .2, clearcoat: .8, envMap: env, envMapIntensity: .7 });
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(.11, .1, .26, 64, 1, true), cer); mugBody.position.y = .13; mugBody.castShadow = true; mug.add(mugBody);
  const mugIn = new THREE.Mesh(new THREE.CylinderGeometry(.103, .095, .25, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xece8e0, roughness: .3, side: THREE.BackSide })); mugIn.position.y = .135; mug.add(mugIn);
  const mugBase = new THREE.Mesh(new THREE.CircleGeometry(.1, 48), cer); mugBase.rotation.x = -Math.PI / 2; mugBase.position.y = .01; mug.add(mugBase);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(.1, 48), new THREE.MeshPhysicalMaterial({ color: 0x3a2212, roughness: .1, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .22; mug.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(.065, .014, 16, 40, Math.PI * 1.15), cer); handle.position.set(.11, .14, 0); handle.rotation.z = -Math.PI * .57; handle.castShadow = true; mug.add(handle);
  const wrapM = new THREE.MeshStandardMaterial({ map: out.texture, roughness: .25, transparent: false, envMap: env, envMapIntensity: .4 });
  let wrap = null;
  function buildWrap() {
    if (wrap) mug.remove(wrap); const a = U.uOutAspect.value, hgt = .17, arc = clamp(hgt * a / .112, .6, Math.PI * 1.35);
    wrap = new THREE.Mesh(new THREE.CylinderGeometry(.1115, .1015, hgt, 64, 1, true, -arc / 2 - Math.PI / 2 + Math.PI, arc), wrapM); wrap.position.y = .13; wrap.rotation.y = -Math.PI / 2; mug.add(wrap);
  }
  mug.rotation.y = -.95;
  /* 4. a stretched canvas leaning on the wall */
  const cnvG = new THREE.Group(); cnvG.position.set(-1.55, DT + .38, -.55); cnvG.rotation.x = -.12; scene.add(cnvG);
  const cnvBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, .05), [new THREE.MeshStandardMaterial({ color: 0xf1ece2, roughness: .9 }), new THREE.MeshStandardMaterial({ color: 0xf1ece2 }), new THREE.MeshStandardMaterial({ color: 0xf1ece2 }), new THREE.MeshStandardMaterial({ color: 0xf1ece2 }), new THREE.MeshStandardMaterial({ map: out.texture, roughness: .75, envMap: env, envMapIntensity: .2 }), new THREE.MeshStandardMaterial({ color: 0xc9b89a })]);
  cnvBox.castShadow = true; cnvG.add(cnvBox);
  /* props: a pencil and a little plant pot */
  const pencil = new THREE.Mesh(new THREE.CylinderGeometry(.007, .007, .19, 6), new THREE.MeshStandardMaterial({ color: 0xe0a83a, roughness: .5 })); pencil.rotation.set(Math.PI / 2, 0, .9); pencil.position.set(.1, DT + .01, .5); pencil.castShadow = true; scene.add(pencil);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.07, .055, .12, 32), new THREE.MeshStandardMaterial({ color: 0xb8643e, roughness: .8 })); pot.position.set(1.7, DT + .06, -.45); pot.castShadow = true; scene.add(pot);
  for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), new THREE.MeshStandardMaterial({ color: 0x3f7a45, roughness: .6 })); lf.scale.set(.5, 1.6, .25); const a = i / 9 * TAU; lf.position.set(1.7 + Math.cos(a) * .04, DT + .19 + (i % 3) * .03, -.45 + Math.sin(a) * .04); lf.rotation.set(Math.cos(a) * .5, 0, Math.sin(a) * .5); lf.castShadow = true; scene.add(lf); }

  function layoutMockups() {
    const a = U.uOutAspect.value, pw = a >= 1 ? .95 : .95 * a, ph = a >= 1 ? .95 / a : .95;
    pFrame.scale.set(pw + .12, ph + .12, 1); pMat.scale.set(pw + .06, ph + .06, 1); pArt.scale.set(pw, ph, 1); glass.scale.set(pw + .06, ph + .06, 1);
    const cw = a >= 1 ? .8 : .8 * a, chh = a >= 1 ? .8 / a : .8; cnvBox.scale.set(cw, chh, 1); cnvG.position.y = DT + chh / 2 + .01;
    /* the phone screen shows the picture filled to its tall shape (centre-cropped), like a wallpaper */
    const sa = .33 / .71; screenM.map = out.texture; screen.material.needsUpdate = true;
    const t = screenM.map; // share texture, crop through UVs of the screen geometry
    const uv = screen.geometry.attributes.uv; const cropX = a > sa ? sa / a : 1, cropY = a > sa ? 1 : a / sa;
    uv.setXY(0, .5 - cropX / 2, .5 + cropY / 2); uv.setXY(1, .5 + cropX / 2, .5 + cropY / 2); uv.setXY(2, .5 - cropX / 2, .5 - cropY / 2); uv.setXY(3, .5 + cropX / 2, .5 - cropY / 2); uv.needsUpdate = true;
    buildWrap(); void t;
  }

  /* ---------- state ---------- */
  const DEF = { exp: 0, con: 0, sat: 0, warm: 0, tint: 0, vig: 0, grain: 0, fade: 0, sharp: 0, look: 'none', ar: 'orig', zoom: 1, ox: 0, oy: 0, rot: 0, flip: 0, text: '', sub: '', pos: 'bottom', font: 'serif', ink: '#ffffff' };
  const st = store('w89.edit', DEF); const E = { ...DEF, ...st.get() }; const save = () => st.set(E);
  let srcImg = null, srcName = 'design', history = [];
  function apply() {
    U.uExp.value = E.exp; U.uCon.value = E.con; U.uSat.value = E.sat; U.uWarm.value = E.warm; U.uTint.value = E.tint; U.uVig.value = E.vig; U.uGrain.value = E.grain; U.uFade.value = E.fade; U.uSharp.value = E.sharp;
    U.uLook.value = LOOK_ID[E.look] ?? 0; U.uScale.value.set(E.zoom, E.zoom); U.uOff.value.set(E.ox, E.oy); U.uRot.value = E.rot * Math.PI / 180; U.uFlip.value = E.flip;
    const want = E.ar === 'orig' ? U.uSrcAspect.value : { '1:1': 1, '4:5': .8, '3:4': .75, '16:9': 16 / 9, '9:16': 9 / 16 }[E.ar] || 1;
    if (Math.abs(want - U.uOutAspect.value) > 1e-4 || outW < 8) { U.uOutAspect.value = want; sizeOut(); layoutMockups(); }
    drawText(); dirty = true; save();
  }
  function drawText() {
    tg.clearRect(0, 0, tc.width, tc.height); U.uHasText.value = E.text || E.sub ? 1 : 0; if (!U.uHasText.value) { textTex.needsUpdate = true; return; }
    const W = tc.width, H = tc.height, fam = { serif: "'Instrument Serif', Georgia, serif", sans: "'Inter Tight', system-ui, sans-serif", grotesk: "'Space Grotesk', system-ui, sans-serif" }[E.font];
    const size = Math.round(Math.min(W, H) * .11), y0 = E.pos === 'top' ? H * .14 : E.pos === 'middle' ? H * .48 : H * .8;
    if (E.pos === 'bottom') { const g2 = tg.createLinearGradient(0, H * .55, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.45)'); tg.fillStyle = g2; tg.fillRect(0, H * .55, W, H * .45); }
    tg.fillStyle = E.ink; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.shadowColor = 'rgba(0,0,0,.35)'; tg.shadowBlur = size * .25;
    tg.font = `${E.font === 'serif' ? 400 : 600} ${size}px ${fam}`; let fs = size; while (tg.measureText(E.text).width > W * .88 && fs > 12) { fs -= 4; tg.font = `${E.font === 'serif' ? 400 : 600} ${fs}px ${fam}`; }
    tg.fillText(E.text, W / 2, y0);
    tg.font = `500 ${Math.round(size * .3)}px 'JetBrains Mono', monospace`; tg.fillText(E.sub.toUpperCase(), W / 2, y0 + fs * .75);
    /* the text canvas is drawn top-down; the shader samples it with GL's bottom-up UVs */
    textTex.flipY = true; textTex.needsUpdate = true;
  }
  async function setSource(img, name, keepEdits = true) {
    srcImg = img; srcName = name; srcTex.image = img; srcTex.needsUpdate = true; srcTex.colorSpace = THREE.NoColorSpace;
    U.uSrcAspect.value = img.width / img.height; U.uTexel.value.set(1 / img.width, 1 / img.height);
    if (!keepEdits) Object.assign(E, { ...DEF, text: E.text, sub: E.sub, pos: E.pos, font: E.font, ink: E.ink });
    U.uOutAspect.value = 0; apply(); syncUI();
  }
  const fromBlob = async (b) => { const bm = await createImageBitmap(b, { imageOrientation: 'from-image' }); const c = document.createElement('canvas'); const s = Math.min(1, 3000 / Math.max(bm.width, bm.height)); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return c; };

  /* ---------- interface ---------- */
  const sh = sheet(ui, { title: 'AI Image & Design', kicker: 'World 08 · Technology & AI', tabs: ['Photo', 'Adjust', 'Text', 'AI edit', 'Mockups'], theme: 'light', accent: '#c9822e' });
  linkView(k, sh);
  const top = hud(ui, 'The Design Desk', 'Your design, everywhere'); top.el.style.color = '#1a1a1a'; top.el.style.textShadow = 'none';
  const [P0, P1, P2, P3, P4] = sh.secs;
  /* Photo */
  const file = h('input', { type: 'file', accept: 'image/*', class: 'd-file' }); P0.append(file);
  P0.append(h('p', { text: 'Open a photo from your device, or one you made in World 07. Everything here runs on your device; nothing is uploaded unless you use AI edit.' }));
  const r0 = row(P0); btn(r0, 'Open a photo', () => file.click(), 'pri'); btn(r0, 'Download PNG', () => exportPNG());
  btn(row(P0), 'Save to my creations', async () => { const b = await outBlob('image/jpeg'); await saveCreation({ id: Date.now().toString(36), t: Date.now(), prompt: 'Edited in the Design Desk', blob: b, w: outW, h: outH, provider: 'edit' }); sh.toast('Saved. It also appears in World 07\'s gallery.'); });
  file.addEventListener('change', async () => { const f = file.files?.[0]; if (!f) return; if (!f.type.startsWith('image/')) { sh.toast('That is not a picture.'); return; } history = []; await setSource(await fromBlob(f), f.name.replace(/\.\w+$/, ''), false); updHist(); sh.toast('Photo opened.'); file.value = ''; });
  P0.append(h('h3', { text: 'From World 07' }));
  const cg = h('div', { class: 'd-grid' }); P0.append(cg);
  async function listMine() { const items = await listCreations(); cg.replaceChildren(...items.slice(0, 12).map((it) => { const u = URL.createObjectURL(it.blob); return h('button', { 'aria-label': it.prompt, onclick: async () => { history = []; await setSource(await fromBlob(it.blob), 'creation-' + it.id, false); updHist(); } }, h('img', { src: u, alt: it.prompt })); })); if (!items.length) cg.append(h('p', { style: { gridColumn: '1/-1', fontSize: '13px' }, text: 'Nothing yet. Make a picture in World 07 and it shows up here.' })); }
  P0.append(h('h3', { text: 'Shape' }));
  const arS = seg(P0, [['orig', 'Original'], ['1:1', '1:1'], ['4:5', '4:5'], ['3:4', '3:4'], ['16:9', '16:9'], ['9:16', '9:16']], E.ar, (v) => { E.ar = v; apply(); });
  /* Adjust */
  const R = {};
  const mk = (sec, key, label, o) => { R[key] = range(sec, label, o, (v) => { E[key] = v; apply(); }); };
  P1.append(h('h3', { text: 'Look' }));
  const lookS = seg(P1, LOOKS, E.look, (v) => { E.look = v; apply(); });
  P1.append(h('h3', { text: 'Light and colour' }));
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100);
  mk(P1, 'exp', 'Exposure', { min: -2, max: 2, step: .05, value: E.exp, fmt: (v) => (v > 0 ? '+' : '') + v.toFixed(2) + ' EV' });
  mk(P1, 'con', 'Contrast', { min: -.6, max: .8, step: .01, value: E.con, fmt: pct });
  mk(P1, 'sat', 'Saturation', { min: -1, max: 1, step: .01, value: E.sat, fmt: pct });
  mk(P1, 'warm', 'Warmth', { min: -1, max: 1, step: .01, value: E.warm, fmt: pct });
  mk(P1, 'tint', 'Tint', { min: -1, max: 1, step: .01, value: E.tint, fmt: pct });
  P1.append(h('h3', { text: 'Finish' }));
  mk(P1, 'sharp', 'Sharpen', { min: 0, max: 1, step: .01, value: E.sharp, fmt: pct });
  mk(P1, 'fade', 'Fade', { min: 0, max: 1, step: .01, value: E.fade, fmt: pct });
  mk(P1, 'vig', 'Vignette', { min: 0, max: 1, step: .01, value: E.vig, fmt: pct });
  mk(P1, 'grain', 'Film grain', { min: 0, max: 1, step: .01, value: E.grain, fmt: pct });
  P1.append(h('h3', { text: 'Crop' }));
  mk(P1, 'zoom', 'Zoom', { min: 1, max: 3, step: .01, value: E.zoom, fmt: (v) => v.toFixed(2) + '×' });
  mk(P1, 'ox', 'Move left / right', { min: -.5, max: .5, step: .005, value: E.ox, fmt: pct });
  mk(P1, 'oy', 'Move down / up', { min: -.5, max: .5, step: .005, value: E.oy, fmt: pct });
  mk(P1, 'rot', 'Straighten', { min: -45, max: 45, step: .5, value: E.rot, fmt: (v) => v + '°' });
  const r1 = row(P1); btn(r1, 'Flip', () => { E.flip = E.flip ? 0 : 1; apply(); }); btn(r1, 'Reset all', () => { Object.assign(E, { ...DEF, text: E.text, sub: E.sub, pos: E.pos, font: E.font, ink: E.ink, ar: E.ar }); apply(); syncUI(); });
  /* Text */
  P2.append(h('p', { text: 'Add a headline to turn the picture into a poster. It is drawn into the picture at full resolution.' }));
  const tIn = h('input', { type: 'text', maxlength: 60, placeholder: 'Headline', value: E.text, 'aria-label': 'Headline' }); const sIn = h('input', { type: 'text', maxlength: 80, placeholder: 'Small line under it', value: E.sub, 'aria-label': 'Small line', style: { marginTop: '8px' } });
  tIn.addEventListener('input', () => { E.text = tIn.value; apply(); }); sIn.addEventListener('input', () => { E.sub = sIn.value; apply(); }); P2.append(tIn, sIn);
  P2.append(h('h3', { text: 'Place' })); const posS = seg(P2, [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], E.pos, (v) => { E.pos = v; apply(); });
  P2.append(h('h3', { text: 'Typeface' })); const fontS = seg(P2, [['serif', 'Serif'], ['sans', 'Sans'], ['grotesk', 'Grotesk']], E.font, (v) => { E.font = v; apply(); });
  P2.append(h('h3', { text: 'Colour' })); const inkS = seg(P2, [['#ffffff', 'White'], ['#111111', 'Black'], ['#e8b04a', 'Amber'], ['#ff6a4d', 'Coral']], E.ink, (v) => { E.ink = v; apply(); });
  /* AI edit */
  P3.append(h('p', { text: 'Describe the change. The picture as you see it now is sent to the Abidora server and edited by Cloudflare\'s FLUX model (free tier). You can undo every AI edit.' }));
  const aiIn = h('textarea', { rows: 3, maxlength: 1500, placeholder: 'For example: make the sky stormy', 'aria-label': 'AI edit instruction' }); P3.append(aiIn);
  const chips = h('div', { class: 'd-chips' }); AI_IDEAS.forEach((t) => chips.append(h('button', { class: 'tk-btn', text: t, onclick: () => { aiIn.value = t; } }))); P3.append(chips);
  const r3 = row(P3); const aiB = btn(r3, 'Edit with AI', () => aiEdit(), 'pri'); const undoB = btn(r3, 'Undo', () => undo());
  const hist = h('div', { class: 'd-hist' }); const aiSt = h('p', { style: { fontSize: '12.5px' } }); P3.append(hist, aiSt);
  function updHist() { undoB.disabled = !history.length; hist.textContent = history.length ? `${history.length} AI edit${history.length > 1 ? 's' : ''} so far` : ''; }
  /* Mockups */
  P4.append(h('p', { text: 'Your picture, live on real objects. Every change you make appears on all of them at once.' }));
  const views = { desk: [[.1, 2.05, 4.1], [.1, 1.1, -.1]], poster: [[-.5, 1.75, 1.15], [-.55, 1.72, -.72]], phone: [[.62, 1.55, .78], [.55, .75, .42]], mug: [[1.15, 1.02, .75], [1.35, .88, .1]], canvas: [[-1.25, 1.3, .9], [-1.55, 1.15, -.55]] };
  const r4 = row(P4); [['desk', 'The desk'], ['poster', 'Poster'], ['phone', 'Phone'], ['mug', 'Mug'], ['canvas', 'Canvas']].forEach(([v, t]) => btn(r4, t, () => k.fly(...views[v])));
  btn(row(P4), 'Save a photo of this view', () => { requestAnimationFrame(() => { k.composer.render(); canvas.toBlob((b) => b && download(b, 'abidora-mockup.png')); }); });

  function syncUI() { for (const key in R) R[key].set(E[key]); lookS.set(E.look); arS.set(E.ar); posS.set(E.pos); fontS.set(E.font); inkS.set(E.ink); tIn.value = E.text; sIn.value = E.sub; }

  /* ---------- export ---------- */
  async function outBlob(type = 'image/png') {
    if (dirty) renderEdit(); const px = new Uint8Array(outW * outH * 4); renderer.readRenderTargetPixels(out, 0, 0, outW, outH, px);
    const c = document.createElement('canvas'); c.width = outW; c.height = outH; const g = c.getContext('2d'), im = g.createImageData(outW, outH);
    for (let y = 0; y < outH; y++) im.data.set(px.subarray((outH - 1 - y) * outW * 4, (outH - y) * outW * 4), y * outW * 4);
    g.putImageData(im, 0, 0); return new Promise((res) => c.toBlob(res, type, .92));
  }
  async function exportPNG() { const b = await outBlob(); download(b, `abidora-${srcName}.png`); sh.toast(`Saved ${outW} × ${outH} px.`); }

  /* ---------- AI edit ---------- */
  let ready = false, canEdit = false;
  async function aiEdit() {
    const p = aiIn.value.trim(); if (!p) { sh.toast('Describe the change first.'); return; }
    if (!ready || !canEdit) { sh.toast(ready ? MESSAGES.gd : MESSAGES.notready); return; }
    aiB.disabled = true; aiB.textContent = 'Editing…'; aiSt.textContent = 'This takes about 3 to 12 seconds.';
    try {
      const cur = await outBlob('image/jpeg'); const b64 = await toBase64(cur, 1024);
      const ars = ['1:1', '4:3', '3:4', '16:9', '9:16'], a = U.uOutAspect.value, ar = ars.reduce((best, x) => { const [w, hh] = x.split(':').map(Number); return Math.abs(Math.log(w / hh / a)) < Math.abs(Math.log(eval0(best) / a)) ? x : best; }, '1:1');
      const r = await make({ prompt: p, mode: 'edit', images: [b64], ar });
      history.push({ img: srcImg, E: { ...E } }); if (history.length > 10) history.shift();
      await setSource(await fromBlob(r.blob), srcName + '-ai', false); updHist(); aiSt.textContent = `Done (${r.provider}). Undo brings back the picture before this edit.`;
      saveCreation({ id: Date.now().toString(36), t: Date.now(), prompt: p, blob: r.blob, w: r.w, h: r.h, provider: r.provider, model: r.model });
    } catch (e) { aiSt.textContent = MESSAGES[e.message] || MESSAGES.fail; }
    finally { aiB.disabled = false; aiB.textContent = 'Edit with AI'; }
  }
  const eval0 = (x) => { const [w, hh] = x.split(':').map(Number); return w / hh; };
  async function undo() { const h0 = history.pop(); if (!h0) return; Object.assign(E, h0.E); await setSource(h0.img, srcName, true); syncUI(); updHist(); }

  /* ---------- frame ---------- */
  k.onFrame(() => { if (dirty) renderEdit(); });
  k.pick(() => [poster, phone, mug, cnvG], (hit) => { let o = hit.object; while (o.parent && o.parent !== scene) o = o.parent; const v = o === poster ? 'poster' : o === phone ? 'phone' : o === mug ? 'mug' : 'canvas'; k.fly(...views[v]); });
  sh.onTab((i) => { if (i === 4) k.fly(...views.desk); if (i === 0) listMine(); });

  /* ---------- start ---------- */
  let opened = false;
  try { const id = localStorage.getItem('abidora.w89.open'); if (id) { localStorage.removeItem('abidora.w89.open'); const it = (await listCreations()).find((x) => x.id === id); if (it) { await setSource(await fromBlob(it.blob), 'creation-' + id, false); opened = true; } } } catch { /* ignore */ }
  if (!opened) await setSource(starter(), 'design', true);
  updHist(); listMine();
  const s = await status(); ready = s.ready; canEdit = s.edit;
  aiSt.textContent = s.ready ? (s.edit ? 'AI editing is ready.' : MESSAGES.gd) : s.ok ? MESSAGES.notready : 'The Abidora image service cannot be reached right now, so AI edit is off. All the other tools work.';
  camera.position.set(.1, 2.8, 5.6); k.fly(...views.desk, 2.4);
  return k;
}
