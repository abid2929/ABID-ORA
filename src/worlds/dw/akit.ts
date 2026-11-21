// @ts-nocheck
/* Abidora worlds 25-30: shared renderer, camera, UI and phone helpers for the preview.
   Every world builds its own scene, look and tools on top of this. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export { THREE, OrbitControls };

/* One world runs at a time. Everything it starts (frame loop, window listeners, the GPU context) registers an
   ending here, so the host page can close the world cleanly. `host.el` is the stage element when the world runs
   inside a page; without it the world fills the window. `host.paused` stops drawing while the stage is off screen. */
export const host = { el: null, paused: false, wid: 0 };
const ends = new Set();
export function onEnd(f) { ends.add(f); return f; }
export function endAll() { for (const f of [...ends]) { try { f(); } catch (e) { console.warn(e); } } ends.clear(); }
export function on(t, type, fn, opt) { t.addEventListener(type, fn, opt); onEnd(() => t.removeEventListener(type, fn, opt)); }
export function viewSize() { const e = host.el; return e ? [e.clientWidth || 1, e.clientHeight || 1] : [innerWidth, innerHeight]; }
export let MODEL_BASE = 'assets/models/dw/';
let MODEL_EXT = '';
export function setModelBase(u, ext = '') { MODEL_BASE = u; MODEL_EXT = ext; }
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function rng(seed = 1) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

export function isPhone() { return matchMedia('(max-width: 760px)').matches || (matchMedia('(pointer: coarse)').matches && Math.min(innerWidth, innerHeight) < 820); }

/* Sharp on phones: render at the screen's real pixel density (up to 2x). If the frame rate falls, step down a little, never below 1.25x. */
export function renderer(canvas, opt = {}) {
  const phone = isPhone();
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opt.keep, alpha: false });
  let dpr = Math.min(devicePixelRatio || 1, 2);
  r.setPixelRatio(dpr);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = opt.tone ?? THREE.AgXToneMapping;
  r.toneMappingExposure = opt.exposure ?? 1;
  r.shadowMap.enabled = opt.shadows !== false;
  r.shadowMap.type = THREE.PCFShadowMap;
  const st = { frames: 0, t0: performance.now(), dpr, min: Math.min(1.25, dpr) };
  r.adapt = () => {          // call once per frame
    st.frames++;
    const t = performance.now();
    if (t - st.t0 > 2000) {
      const fps = st.frames * 1000 / (t - st.t0); st.frames = 0; st.t0 = t;
      if (fps < 40 && st.dpr > st.min) { st.dpr = Math.max(st.min, st.dpr - .25); r.setPixelRatio(st.dpr); r.onDpr?.(); }
    }
  };
  r.phone = phone;
  onEnd(() => { r.dispose(); r.forceContextLoss?.(); });
  return r;
}

export function roomEnv(r, blur = .04) { const pm = new THREE.PMREMGenerator(r); const t = pm.fromScene(new RoomEnvironment(), blur).texture; pm.dispose(); return t; }

/* an environment map from glowing panels: soft studio or sky light for reflections */
export function panelEnv(r, panels, bg = 0x000000) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  for (const p of panels) {
    const g = p.sphere ? new THREE.SphereGeometry(p.w, 16, 8) : new THREE.PlaneGeometry(p.w, p.h);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.c ?? 0xffffff).multiplyScalar(p.i), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...p.p); m.lookAt(0, 0, 0); s.add(m);
  }
  const pm = new THREE.PMREMGenerator(r); const rt = pm.fromScene(s, .02); pm.dispose(); return rt.texture;
}

/* sky gradient dome, used as background and in the environment map */
export function skyDome(top, mid, bottom, radius = 400) {
  const g = new THREE.SphereGeometry(radius, 32, 16);
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bottom) }, sun: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(0xfff1d6) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 top, mid, bot, sun, sunCol; varying vec3 vP;
      void main(){ float y = vP.y; vec3 c = y > 0. ? mix(mid, top, pow(y, .6)) : mix(mid, bot, pow(-y, .4));
        float s = max(dot(normalize(vP), normalize(sun)), 0.); c += sunCol * (pow(s, 900.) * 6. + pow(s, 12.) * .35);
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const o = new THREE.Mesh(g, m); o.renderOrder = -10; return o;
}

/* canvas textures */
export function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
export function tex(c, srgb = true, rep = 1) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8;
  if (rep !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } return t;
}
/* normal map from a height function drawn into a canvas (grayscale) */
export function normalFromHeight(hc, strength = 2) {
  const w = hc.width, hh = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, hh).data;
  const [c, g] = cv(w, hh); const im = g.createImageData(w, hh), d = im.data;
  const H = (x, y) => src[(((y + hh) % hh) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * .5 + .5) * 255; d[i + 1] = (dy / l * .5 + .5) * 255; d[i + 2] = (1 / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); return c;
}
/* smooth value noise for procedural materials */
export function noise2(seed = 1) {
  const P = new Uint8Array(512), R = rng(seed); for (let i = 0; i < 256; i++) P[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const f = (t) => t * t * (3 - 2 * t);
  return (x, y) => { const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const a = P[P[X] + Y] / 255, b = P[P[X + 1] + Y] / 255, c = P[P[X] + Y + 1] / 255, d = P[P[X + 1] + Y + 1] / 255, u = f(xf), v = f(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
}
export function fbm(n, x, y, o = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); a *= .5; f *= 2; } return s; }

export function tween(ms, set, done) {
  const ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); const t0 = performance.now(); let raf = 0;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); set(ease(k)); if (k < 1) raf = requestAnimationFrame(step); else done?.(); };
  raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
}

/* ---------- UI ---------- */
export function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v); else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null) e.append(c);
  return e;
}

/* The control surface: a side panel on a laptop, a bottom sheet on a phone that can be pulled up or tucked away.
   Each world adds sections (tabs on a phone). */
export function panel(ui, o) {
  const root = el('aside', { class: 'pn', 'data-open': isPhone() ? '0' : '1' });
  const head = el('header', { class: 'pn-h' },
    el('div', { class: 'pn-k', text: o.kicker }),
    el('h2', { class: 'pn-t', text: o.title }),
    o.lede ? el('p', { class: 'pn-l', text: o.lede }) : null);
  const grip = el('button', { class: 'pn-grip', 'aria-label': 'Show or hide controls', onclick: () => root.dataset.open = root.dataset.open === '1' ? '0' : '1' }, el('span'));
  const tabs = el('nav', { class: 'pn-tabs', role: 'tablist' });
  const body = el('div', { class: 'pn-b' });
  root.append(grip, head, tabs, body); ui.append(root);
  const secs = [];
  const api = {
    root, body,
    section(name) {
      const s = el('section', { class: 'pn-s' }, el('h2', { text: name }));
      const b = el('button', { class: 'pn-tab', role: 'tab', text: name, onclick: () => api.show(secs.indexOf(s)) });
      tabs.append(b); body.append(s); secs.push(s); if (secs.length === 1) api.show(0, false); return s;
    },
    show(i, open = true) { secs.forEach((s, k) => s.toggleAttribute('data-on', k === i)); [...tabs.children].forEach((b, k) => b.setAttribute('aria-selected', String(k === i))); if (open) root.dataset.open = '1'; },
    stats(p, rows) {
      const box = el('dl', { class: 'pn-st' }); const out = {};
      for (const [k, label] of rows) { const v = el('dd', { text: '–' }); box.append(el('div', {}, el('dt', { text: label }), v)); out[k] = v; }
      p.append(box); return out;
    },
  };
  return api;
}
export function range(p, label, o, on) {
  const out = el('output', { text: o.fmt ? o.fmt(o.value) : String(o.value) });
  const inp = el('input', { type: 'range', min: o.min, max: o.max, step: o.step ?? 1, value: o.value });
  inp.addEventListener('input', () => { const v = +inp.value; out.textContent = o.fmt ? o.fmt(v) : String(v); on(v); });
  const w = el('label', { class: 'c-r' }, el('span', { class: 'c-lab' }, el('span', { text: label }), out), inp); p.append(w);
  return { input: inp, set(v) { inp.value = v; out.textContent = o.fmt ? o.fmt(+v) : String(v); } };
}
export function chips(p, label, opts, value, on, cls = '') {
  const w = el('div', { class: 'c-ch ' + cls, role: 'radiogroup', 'aria-label': label }); const btns = [];
  for (const [v, t, sw] of opts) {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(v === value), 'data-v': v, onclick: () => { set(v); on(v); } });
    if (sw) b.append(el('i', { style: { background: sw } })); b.append(el('span', { text: t })); btns.push(b); w.append(b);
  }
  const set = (v) => btns.forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)));
  p.append(label ? el('div', { class: 'c-g' }, el('div', { class: 'c-lab' }, el('span', { text: label })), w) : w); return { set };
}
export function buttons(p, list) {
  const w = el('div', { class: 'c-b' });
  const out = list.map(([t, f, primary]) => { const b = el('button', { type: 'button', class: primary ? 'pri' : '', text: t, onclick: f }); w.append(b); return b; });
  p.append(w); return out;
}
export function note(p, text) { const e = el('p', { class: 'c-n', text }); p.append(e); return e; }
export function toast(ui, text) {
  let t = ui.querySelector('.toast'); if (!t) { t = el('div', { class: 'toast', role: 'status' }); ui.append(t); }
  t.textContent = text; t.dataset.on = '1'; clearTimeout(t._h); t._h = setTimeout(() => (t.dataset.on = '0'), 2200);
}
export function download(name, url) { const a = el('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove(); }
/* saved per world on this device; inside the site the key follows the page's world id, so its Reset button finds it */
export const store = (key, fallback) => { const k = 'abidora.' + (host.wid ? key.replace(/^w\d+\./, `w${host.wid}.`) : key); return {
  get() { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? fallback; } catch { return fallback; } },
  set(v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
}; };

/* On-screen thumb stick for walking on a phone; WASD/arrows on a keyboard. Returns a vector (x: strafe, y: forward). */
export function walkInput(ui) {
  const v = { x: 0, y: 0 }, keys = new Set();
  const stick = el('div', { class: 'stick', 'aria-hidden': 'true' }, el('i'));
  ui.append(stick);
  let id = null, cx = 0, cy = 0; const knob = stick.firstChild, R = 44;
  stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); });
  const move = (e) => { if (e.pointerId !== id) return; let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l; } knob.style.transform = `translate(${dx}px,${dy}px)`; v.x = dx / R; v.y = -dy / R; };
  stick.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== id) return; id = null; v.x = v.y = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  const kd = (e) => { if (e.target.closest('input,select,textarea')) return; keys.add(e.key.toLowerCase()); }, ku = (e) => keys.delete(e.key.toLowerCase());
  on(window, 'keydown', kd); on(window, 'keyup', ku);
  return {
    el: stick, show(on) { stick.hidden = !on || !matchMedia('(pointer: coarse)').matches; },
    read() {
      if (id !== null) return v;
      const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
      return { x: k('d', 'arrowright') - k('a', 'arrowleft'), y: k('w', 'arrowup') - k('s', 'arrowdown') };
    },
  };
}

/* Look around by dragging (first person). */
export function lookInput(dom, cam, o = {}) {
  const st = { yaw: o.yaw ?? 0, pitch: o.pitch ?? 0, on: true };
  let id = null, px = 0, py = 0;
  dom.addEventListener('pointerdown', (e) => { if (!st.on || id !== null) return; id = e.pointerId; px = e.clientX; py = e.clientY; });
  on(window, 'pointermove', (e) => { if (e.pointerId !== id) return; st.yaw -= (e.clientX - px) * .0045; st.pitch = clamp(st.pitch - (e.clientY - py) * .0045, -1.2, 1.2); px = e.clientX; py = e.clientY; });
  on(window, 'pointerup', (e) => { if (e.pointerId === id) id = null; }); on(window, 'pointercancel', (e) => { if (e.pointerId === id) id = null; });
  st.apply = () => { cam.rotation.set(st.pitch, st.yaw, 0, 'YXZ'); };
  return st;
}

/* frame loop that pauses in a background tab */
export function loop(fn) { let last = performance.now(), raf = 0; const f = (t) => { const dt = Math.min(.05, (t - last) / 1000); last = t; if (!host.paused) fn(dt, t / 1000); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return onEnd(() => cancelAnimationFrame(raf)); }

/* the visible part of the stage is left of the side panel on a laptop, above the closed sheet on a phone:
   shift the camera's centre there so the subject is not hidden behind the controls */
export function fit(r, cam, canvas, extra) {
  const go = () => {
    const [w, h] = viewSize(); r.setSize(w, h, false); cam.aspect = w / h;
    if (cam.isPerspectiveCamera && !fit.noOffset) { if (w > 760) cam.setViewOffset(w + 360, h, 360, 0, w, h); else cam.setViewOffset(w, h + 100, 0, 100, w, h); }
    cam.updateProjectionMatrix(); extra?.(w, h);
  };
  on(window, 'resize', go); if (host.el && window.ResizeObserver) { const ro = new ResizeObserver(() => go()); ro.observe(host.el); onEnd(() => ro.disconnect()); }
  go(); r.onDpr = go; return go;
}

/* the sun, from latitude, day of year and solar hour (degrees; azimuth from north, clockwise) */
export function sunPos(latDeg, day, hour) {
  const RAD = Math.PI / 180;
  const dec = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10)) * RAD, lat = latDeg * RAD, H = 15 * (hour - 12) * RAD;
  const elv = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
  return { el: elv / RAD, az: ((az / RAD) + 360) % 360 };
}
/* scene axes: -Z is north, +X is east */
export function sunDir(el, az) { const e = el * Math.PI / 180, a = az * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); }

/* Foliage: thousands of small leaf cards around a few clusters, one draw call, with colour variation.
   Looks like a real canopy instead of a faceted ball. */
let _leafTex = null;
export function leafTexture() {
  if (_leafTex) return _leafTex;
  const [c, g] = cv(128, 128); g.clearRect(0, 0, 128, 128);
  for (const [x, y, a, s] of [[64, 70, -.2, 1], [38, 42, -.9, .75], [92, 40, .8, .75]]) {
    g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
    const gr = g.createLinearGradient(-14, 0, 14, 0); gr.addColorStop(0, '#9aa98a'); gr.addColorStop(.5, '#ffffff'); gr.addColorStop(1, '#b8c4a6');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -46); g.quadraticCurveTo(22, -10, 0, 40); g.quadraticCurveTo(-22, -10, 0, -46); g.fill();
    g.strokeStyle = 'rgba(80,90,60,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -42); g.lineTo(0, 38); g.stroke(); g.restore();
  }
  _leafTex = tex(c); return _leafTex;
}
export function foliage(o) {
  const R = rng(o.seed ?? 7), n = o.count ?? 1400, size = o.size ?? .32;
  const g = new THREE.PlaneGeometry(size, size); g.translate(0, size * .4, 0);
  const m = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: .45, side: THREE.DoubleSide, roughness: .75, color: 0xffffff });
  const im = new THREE.InstancedMesh(g, m, n); im.castShadow = true; im.receiveShadow = true;
  const d = new THREE.Object3D(), col = new THREE.Color(), base = new THREE.Color(o.color ?? 0x55704a), clusters = o.clusters;
  for (let i = 0; i < n; i++) {
    const c = clusters[Math.floor(R() * clusters.length)];
    const u = R() * 2 - 1, th = R() * TAU, rr = Math.cbrt(.35 + R() * .65) * c[3], s = Math.sqrt(1 - u * u);
    d.position.set(c[0] + s * Math.cos(th) * rr, c[1] + u * rr * (o.squash ?? .8), c[2] + s * Math.sin(th) * rr);
    d.rotation.set(R() * TAU, R() * TAU, R() * TAU); const k = .7 + R() * .6; d.scale.set(k, k, k); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
    const outer = rr / c[3]; col.copy(base).multiplyScalar(.55 + outer * .55 + (R() - .5) * .25); col.offsetHSL((R() - .5) * .04, 0, 0); im.setColorAt(i, col);
  }
  return im;
}

/* Load an optimised .glb (quantised geometry, WebP textures; no decoder needed). Resolves with the scene,
   shadows switched on, or null when the file cannot load so callers keep their procedural fallback. */
const glbCache = new Map();
export function loadGLB(name) {
  const url = MODEL_BASE + name + MODEL_EXT;
  if (!glbCache.has(url)) glbCache.set(url, new GLTFLoader().loadAsync(url).then((g) => g.scene, (e) => { console.warn('model failed', url, e); return null; }));
  return glbCache.get(url).then((s) => { if (!s) return null; const c = s.clone(true); c.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } }); return c; });
}
