/* Abidora Tech & AI worlds: shared render kit.
   Sharp on every screen (phones render at their real pixel density, up to 2.5x), physically based lighting from a
   studio environment drawn in code, bloom, MSAA, a camera that frames the subject above the phone's bottom sheet,
   and an adaptive step that only lowers resolution if a phone really cannot keep up. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const phoneQ = matchMedia('(max-width: 760px)');
export const isPhone = () => phoneQ.matches;
export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- language: every label passes through L(), which looks up wi.<world>.<key> (key = hash of the English text) ---------- */
let tr = null;
export function setLang(fn) { tr = fn; }
export const tkey = (s) => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) >>> 0; return 's' + x.toString(36); };
export function L(s) {
  if (typeof s !== 'string' || !/[A-Za-z]{2}/.test(s)) return s;
  if (window.__tkStrings) window.__tkStrings.set(tkey(s), s);
  return tr ? tr(tkey(s), s) : s;
}
/* links between worlds (World 07 -> 08) */
let goWorld = (id) => { location.hash = id === 89 ? '#design' : '#studio'; };
export function setNav(fn) { goWorld = fn; }
export const openWorld = (id) => goWorld(id);

/* ---------- DOM ---------- */
const TR = new Set(['text', 'placeholder', 'aria-label', 'title']);
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (let [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (TR.has(k)) v = L(v);
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(typeof c === 'string' ? L(c) : c);
  return e;
}
export function css(id, text) { if (document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = text; document.head.append(s); }

/* ---------- textures drawn in code ---------- */
export function cnv(w, hh = w) { const c = document.createElement('canvas'); c.width = w; c.height = hh; return [c, c.getContext('2d')]; }
export function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
export function tex(c, srgb = true, rep = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  if (rep !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t;
}
/** a soft round sprite for glows and particles */
export function dotTex(size = 128) {
  const [c, g] = cnv(size); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return tex(c);
}
/** height-ish noise normal map: fine grain for brushed or blasted metal and painted surfaces */
export function grainNormal(size = 512, amt = .25, streak = 0) {
  const [c, g] = cnv(size); const im = g.createImageData(size, size), d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n1 = hash(x * 12.9 + y * 78.2) - .5, n2 = hash(x * 3.7 + y * 41.3 + 9) - .5, s = streak ? hash(Math.floor(y) * 7.1) - .5 : 0;
    const nx = n1 * amt + s * streak, ny = n2 * amt, l = Math.hypot(nx, ny, 1), i = (y * size + x) * 4;
    d[i] = (nx / l * .5 + .5) * 255; d[i + 1] = (ny / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return tex(c, false, 4);
}

/* ---------- studio light, drawn in code (no downloads) ---------- */
export function studioEnv(renderer, { tint = 0xffffff, bg = 0x050507, warm = 0xffe2c4, cool = 0xc8dcff, strength = 1 } = {}) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: bg, side: THREE.BackSide })); s.add(room);
  const panel = (w, hh, color, k, pos, look) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k * strength), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(...look); s.add(m);
  };
  panel(14, 3, tint, 5, [0, 12, 0], [0, 0, 0]);          // big soft key above
  panel(4, 9, warm, 3.2, [-11, 3, 5], [0, 0, 0]);        // warm strip, left
  panel(4, 9, cool, 2.6, [11, 3, -4], [0, 0, 0]);        // cool strip, right
  panel(9, 1.2, 0xffffff, 6, [0, 4, -12], [0, 0, 0]);   // thin rim behind
  panel(30, 30, 0x1a1a1f, 1, [0, -10, 0], [0, 0, 0]);    // floor bounce
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, .03); pm.dispose(); return rt.texture;
}

/* ---------- renderer, camera, post ---------- */
export function boot(canvas, { fov = 38, near = .05, far = 400, bloom = [.55, .5, .82], exposure = 1, bg = 0x050507, fog = null, tone = THREE.AgXToneMapping } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.toneMapping = tone; renderer.toneMappingExposure = exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg); if (fog) scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false; controls.rotateSpeed = .7; controls.zoomSpeed = .8;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  /* MSAA target: crisp edges without a blurring AA pass */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), bloom[0], bloom[1], bloom[2]);
  composer.addPass(bloomPass); composer.addPass(new OutputPass());

  const phone = isPhone();
  let dprMax = Math.min(devicePixelRatio || 1, phone ? 2.5 : 2), dpr = dprMax;
  const view = { bottom: 0, right: 0 };     // pixels of the canvas covered by UI: the subject is framed in the rest
  function resize() {
    const w = canvas.clientWidth || innerWidth, hh = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(dpr); renderer.setSize(w, hh, false); composer.setPixelRatio(dpr); composer.setSize(w, hh);
    camera.aspect = w / hh;
    /* shift the picture so the subject sits in the middle of what is still visible */
    if (view.bottom || view.right) camera.setViewOffset(w, hh, view.right / 2, view.bottom / 2, w, hh); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas); addEventListener('resize', resize); resize();

  const fns = []; let last = performance.now(), frames = 0, acc = 0, slow = 0, running = true, onScreen = true, dead = false;
  const clock = { t: 0, dt: 0 };
  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, window.__maxDt || 1 / 20); last = now; clock.dt = dt; clock.t += dt;
    for (const f of fns) f(dt, clock.t);
    controls.update(); composer.render();
    /* adaptive: only after 3 slow seconds in a row, and never below 1.5x on phones (owner wants sharp phones) */
    frames++; acc += dt;
    if (acc > 1) { const fps = frames / acc; frames = 0; acc = 0; slow = fps < 42 ? slow + 1 : 0;
      if (slow >= 3 && dpr > (phone ? 1.5 : 1)) { dpr = Math.max(phone ? 1.5 : 1, dpr - .25); slow = 0; resize(); } }
  }
  requestAnimationFrame(frame);
  /* sleep when the tab is hidden or the world is scrolled out of view: no battery spent on a picture nobody sees */
  const wake = () => { const want = !dead && !document.hidden && onScreen; if (want && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); } else if (!want) running = false; };
  document.addEventListener('visibilitychange', wake);
  const io = new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; wake(); }); io.observe(canvas);
  function dispose() { dead = true; running = false; io.disconnect(); document.removeEventListener('visibilitychange', wake); controls.dispose(); composer.dispose?.(); rt.dispose(); renderer.dispose(); renderer.forceContextLoss?.(); }

  /* camera moves */
  let tw = null;
  /* phones are tall: the same shot is taken from further back so the subject still fits across the screen */
  const fitK = () => { const w = canvas.clientWidth || innerWidth, hh = (canvas.clientHeight || innerHeight) - view.bottom; const a = w / Math.max(1, hh); return a < 1.25 ? clamp(1.25 / a, 1, 2.1) : 1; };
  function fly(pos, target, dur = 1.6) {
    const p0 = camera.position.clone(), t0 = controls.target.clone(), t1 = new THREE.Vector3(...target);
    const p1 = new THREE.Vector3(...pos).sub(t1).multiplyScalar(fitK()).add(t1);
    if (calm) { camera.position.copy(p1); controls.target.copy(t1); return; }
    const start = performance.now(); tw = { start, dur, p0, t0, p1, t1 };
  }
  fns.push(() => {
    if (!tw) return; const k = clamp((performance.now() - tw.start) / 1000 / tw.dur, 0, 1), e = ease(k);
    camera.position.lerpVectors(tw.p0, tw.p1, e); controls.target.lerpVectors(tw.t0, tw.t1, e); if (k >= 1) tw = null;
  });
  controls.addEventListener('start', () => { tw = null; });

  /* tap picking (a tap is a short press that did not drag the camera) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(objs, onHit, onMiss) {
    let down = null;
    canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, performance.now()]; });
    canvas.addEventListener('pointerup', (e) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]), dt = performance.now() - down[2]; down = null;
      if (moved > 8 || dt > 500) return;
      const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera); const hits = ray.intersectObjects(typeof objs === 'function' ? objs() : objs, true);
      if (hits.length) onHit(hits[0], e); else onMiss?.(e);
    });
  }
  return { renderer, scene, camera, controls, composer, bloom: bloomPass, view, resize, fly, pick, ray, ndc, onFrame: (f) => fns.push(f), clock,
    stop: () => { running = false; }, dispose };
}

/* ---------- interface: side panel on computers, bottom sheet with snap points on phones ---------- */
export function sheet(root, { title, kicker, theme = 'dark', tabs = [], accent = '#e8b04a', font = "'Inter Tight', system-ui, sans-serif", head = "'Instrument Serif', Georgia, serif" }) {
  css('tk-css', `
  .tk{position:absolute;z-index:20;color:var(--ink);font:400 14px/1.45 var(--font);-webkit-font-smoothing:antialiased}
  .tk *{box-sizing:border-box}
  .tk-p{top:16px;right:16px;bottom:16px;width:min(400px,38%);display:flex;flex-direction:column;border-radius:22px;background:var(--glass);
    border:1px solid var(--line);backdrop-filter:blur(18px) saturate(1.3);-webkit-backdrop-filter:blur(18px) saturate(1.3);box-shadow:0 30px 80px rgba(0,0,0,.35);overflow:hidden}
  .tk-hd{padding:18px 20px 10px}
  .tk-k{font:500 10.5px/1 'JetBrains Mono',ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--acc)}
  .tk-t{font:400 34px/1.02 var(--head);margin:8px 0 0;letter-spacing:-.01em}
  .tk-tabs{display:flex;gap:4px;padding:6px 14px 10px;overflow-x:auto;scrollbar-width:none}
  .tk-tabs::-webkit-scrollbar{display:none}
  .tk-tab{flex:0 0 auto;border:1px solid var(--line);background:transparent;color:var(--ink);opacity:.75;border-radius:999px;padding:9px 14px;min-height:40px;font:500 12.5px var(--font);cursor:pointer}
  .tk-tab[aria-selected=true]{background:var(--ink);color:var(--bgc);opacity:1;border-color:transparent}
  .tk-b{flex:1;overflow-y:auto;padding:4px 20px 22px;overscroll-behavior:contain;scrollbar-width:thin}
  .tk-sec[hidden]{display:none}
  .tk h3{font:600 11px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;opacity:.6;margin:18px 0 10px}
  .tk p{margin:0 0 10px;opacity:.82}
  .tk-row{display:flex;gap:6px;flex-wrap:wrap}
  .tk-btn{border:1px solid var(--line);background:var(--chip);color:var(--ink);border-radius:12px;padding:10px 14px;min-height:44px;font:500 13px var(--font);cursor:pointer;transition:background .2s,transform .1s}
  .tk-btn:active{transform:scale(.97)}
  .tk-btn.pri{background:var(--acc);color:#111;border-color:transparent;font-weight:600}
  .tk-btn[aria-pressed=true]{background:var(--ink);color:var(--bgc)}
  .tk-btn:disabled{opacity:.4;cursor:default}
  .tk-rg{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;margin:8px 0 12px}
  .tk-rg label{font-size:13px;opacity:.85}.tk-rg output{font:500 12px 'JetBrains Mono',monospace;opacity:.8}
  .tk-rg input{grid-column:1/-1;width:100%;accent-color:var(--acc);height:32px}
  .tk-stat{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin:10px 0}
  .tk-stat div{border:1px solid var(--line);border-radius:12px;padding:9px 11px;background:var(--chip)}
  .tk-stat b{display:block;font:500 17px/1.2 'JetBrains Mono',monospace;font-variant-numeric:tabular-nums}
  .tk-stat span{font-size:11px;opacity:.6}
  .tk textarea,.tk input[type=text],.tk select{width:100%;border:1px solid var(--line);background:var(--chip);color:var(--ink);border-radius:12px;padding:11px 12px;font:400 15px var(--font);resize:vertical}
  .tk textarea.code{font:400 13px/1.5 'JetBrains Mono',monospace;min-height:190px}
  .tk-hud{position:absolute;z-index:15;left:20px;top:18px;color:var(--ink);font:500 11px/1.5 'JetBrains Mono',monospace;letter-spacing:.1em;text-transform:uppercase;pointer-events:none;text-shadow:0 1px 8px rgba(0,0,0,.4)}
  .tk-hud b{display:block;font:400 40px/1 var(--head);letter-spacing:0;text-transform:none;margin-top:6px}
  .tk-toast{position:absolute;z-index:40;left:50%;top:18px;transform:translate(-50%,-20px);opacity:0;transition:.35s;background:var(--glass);border:1px solid var(--line);color:var(--ink);
    border-radius:999px;padding:10px 16px;font:500 13px var(--font);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);pointer-events:none;max-width:calc(100% - 32px)}
  .tk-toast.on{opacity:1;transform:translate(-50%,0)}
  .tk-grab{display:none}
  @media (max-width:760px){
    .tk-p{top:auto;left:0;right:0;bottom:0;width:auto;height:var(--sh,46vh);border-radius:22px 22px 0 0;border-left:0;border-right:0;border-bottom:0;
      transition:height .35s cubic-bezier(.2,.8,.2,1);padding-bottom:env(safe-area-inset-bottom,0)}
    .tk-p.drag{transition:none}
    .tk-grab{display:block;height:26px;touch-action:none;cursor:grab;position:relative;flex:0 0 auto}
    .tk-grab:after{content:"";position:absolute;left:50%;top:10px;width:42px;height:5px;margin-left:-21px;border-radius:9px;background:var(--ink);opacity:.35}
    .tk-hd{padding:0 18px 4px;display:flex;align-items:baseline;gap:10px}
    .tk-t{font-size:24px;margin:0}.tk-k{font-size:9.5px}
    .tk-tabs{padding:6px 12px 8px}
    .tk-b{padding:2px 16px 18px}
    .tk-hud{left:16px;top:16px}.tkw.max .tk-hud{top:calc(env(safe-area-inset-top,0px) + 16px)}.tk-hud b{font-size:26px}
    .tk-hd{flex-direction:column;align-items:flex-start;gap:4px}
    .tk-btn{min-height:46px}
    .tkw:not(.max) .tk-p{position:relative;inset:auto;height:auto;width:auto;margin-top:-18px;border-radius:22px 22px 0 0;transition:none;overflow:visible}
    .tkw:not(.max) .tk-grab{display:none}
    .tkw:not(.max) .tk-hd{padding-top:18px}
    .tkw:not(.max) .tk-b{overflow:visible;flex:none;padding-bottom:26px}
  }`);
  const st = root.style;
  const dark = theme === 'dark';
  st.setProperty('--ink', dark ? '#f1ece3' : '#141414'); st.setProperty('--bgc', dark ? '#0b0b0d' : '#f4f1ea');
  st.setProperty('--glass', dark ? 'rgba(14,14,18,.62)' : 'rgba(250,248,243,.72)'); st.setProperty('--line', dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.1)');
  st.setProperty('--chip', dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.035)'); st.setProperty('--acc', accent); st.setProperty('--font', font); st.setProperty('--head', head);

  const tabBtns = [], secs = [];
  const p = h('aside', { class: 'tk tk-p', 'aria-label': title });
  const grab = h('div', { class: 'tk-grab', role: 'button', 'aria-label': 'Resize panel', tabindex: 0 });
  const hd = h('div', { class: 'tk-hd' }, h('div', { class: 'tk-k', text: kicker }), h('h2', { class: 'tk-t', text: title }));
  const tb = h('div', { class: 'tk-tabs', role: 'tablist' });
  const body = h('div', { class: 'tk-b' });
  const listeners = [];
  tabs.forEach((name, i) => {
    const b = h('button', { class: 'tk-tab', role: 'tab', 'aria-selected': String(i === 0), text: name, onclick: () => select(i) });
    tabBtns.push(b); tb.append(b);
    const s = h('section', { class: 'tk-sec', hidden: i !== 0 }); secs.push(s); body.append(s);
  });
  if (tabs.length < 2) tb.hidden = true;
  if (!tabs.length) { const s = h('section', { class: 'tk-sec' }); secs.push(s); body.append(s); }
  let cur = 0;
  function select(i) { cur = i; tabBtns.forEach((b, k) => b.setAttribute('aria-selected', String(k === i))); secs.forEach((s, k) => { s.hidden = k !== i; }); body.scrollTop = 0; listeners.forEach((f) => f(i)); }
  p.append(grab, hd, tb, body); root.append(p);

  /* phone sheet: three snap heights; the 3D view is framed above it */
  const H = () => root.clientHeight || innerHeight;
  const snaps = () => [Math.round(H() * .2), Math.round(H() * .46), Math.round(H() * .86)];
  let snap = 1; const heightCbs = [];
  const setH = (px) => { p.style.setProperty('--sh', px + 'px'); heightCbs.forEach((f) => f(px)); };
  const apply = () => { if (isPhone() && root.classList.contains('max')) setH(snaps()[snap]); else heightCbs.forEach((f) => f(0)); };
  let y0 = 0, h0 = 0, dragging = false;
  grab.addEventListener('pointerdown', (e) => { dragging = true; y0 = e.clientY; h0 = p.getBoundingClientRect().height; p.classList.add('drag'); grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', (e) => { if (dragging) p.style.setProperty('--sh', clamp(h0 + y0 - e.clientY, 90, H() * .92) + 'px'); });
  grab.addEventListener('pointerup', (e) => {
    if (!dragging) return; dragging = false; p.classList.remove('drag'); const hNow = p.getBoundingClientRect().height, s = snaps();
    if (Math.abs(e.clientY - y0) < 6) snap = (snap + 1) % 3; else { let best = 0; s.forEach((v, k) => { if (Math.abs(v - hNow) < Math.abs(s[best] - hNow)) best = k; }); snap = best; }
    apply();
  });
  grab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { snap = (snap + 1) % 3; apply(); } });
  phoneQ.addEventListener('change', apply); addEventListener('resize', apply); new ResizeObserver(apply).observe(root);
  requestAnimationFrame(apply);

  const toastEl = h('div', { class: 'tk tk-toast', role: 'status' }); root.append(toastEl); let tt = 0;
  return {
    el: p, secs, select, onTab: (f) => listeners.push(f), get tab() { return cur; },
    onHeight: (f) => { heightCbs.push(f); },
    setSnap: (k) => { snap = k; apply(); },
    toast(msg, ms = 2600) { toastEl.textContent = L(msg); toastEl.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove('on'), ms); },
  };
}

/* the 3D view keeps its subject visible beside the panel (computer) or above the sheet (phone) */
export function linkView(k, sh) {
  sh.onHeight((px) => {
    if (isPhone()) { k.view.bottom = px; k.view.right = 0; }
    else { const w = k.renderer.domElement.clientWidth || innerWidth; k.view.bottom = 0; k.view.right = Math.min(400, w * .38) + 32; }
    k.resize();
  });
}

/* ---------- controls ---------- */
let uid = 0;
export function range(parent, label, o, on) {
  const id = 'tkr' + (++uid), out = h('output', { for: id }), fmt = o.fmt || ((v) => String(v));
  const inp = h('input', { type: 'range', id, min: o.min, max: o.max, step: o.step ?? 1 }); inp.value = o.value;
  const upd = () => { out.textContent = fmt(+inp.value); };
  inp.addEventListener('input', () => { upd(); on(+inp.value); }); upd();
  parent.append(h('div', { class: 'tk-rg' }, h('label', { for: id, text: label }), out, inp));
  return { inp, set(v) { inp.value = v; upd(); } };
}
export function btn(parent, text, on, cls = '') { const b = h('button', { class: 'tk-btn ' + cls, text, onclick: on }); parent.append(b); return b; }
export function row(parent) { const r = h('div', { class: 'tk-row' }); parent.append(r); return r; }
export function seg(parent, items, value, on) {
  const r = row(parent), bs = items.map(([v, t]) => { const b = btn(r, t, () => { set(v); on(v); }); b.dataset.v = v; return b; });
  const set = (v) => bs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === String(v)))); set(value);
  return { set, buttons: bs };
}
export function stats(parent, items) {
  const g = h('div', { class: 'tk-stat' }), vals = {};
  for (const [k, label] of items) { const b = h('b', { text: '–' }); vals[k] = b; g.append(h('div', {}, b, h('span', { text: label }))); }
  parent.append(g); return (k, v) => { if (vals[k].textContent !== String(v)) vals[k].textContent = v; };
}
export function hud(root, kicker, big) { const b = h('b', { text: big }); const e = h('div', { class: 'tk-hud' }, h('span', { text: kicker }), b); root.append(e); return { el: e, set: (t) => { b.textContent = t; } }; }

/* ---------- local save (per device) ---------- */
export function store(key, def) {
  return { get() { try { const v = JSON.parse(localStorage.getItem('abidora.' + key)); return v ?? def; } catch { return def; } },
    set(v) { try { localStorage.setItem('abidora.' + key, JSON.stringify(v)); } catch { /* private mode */ } } };
}
