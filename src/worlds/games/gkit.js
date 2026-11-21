/* Abidora Games kit: renderer, sky + environment light, bloom, adaptive quality that keeps phones sharp,
   keyboard + touch input (virtual stick, buttons, drag-look), menus, HUD and a small synth for sound. */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
/* host hooks (set by host.ts on the site): translation, whether keys belong to the game, whether the stage is on screen */
export let tr = (k, en) => en;
let gate = () => true, shown = () => true;
/* engaged(): the visitor has clicked or touched the game, so the mouse wheel may zoom instead of scrolling the page */
export let engaged = () => true;
/* where downloadable assets (3D models) live: next to the page in the preview, assets/games/ on the site */
export let assetBase = '';
export function setHost(o) { if (o.t) tr = o.t; if (o.gate) gate = o.gate; if (o.shown) shown = o.shown; if (o.engaged) engaged = o.engaged; if (o.assetBase != null) assetBase = o.assetBase; }
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* 2D value-gradient noise + fbm */
export function noise2(seed = 1) {
  const r = rng(seed), p = new Uint8Array(512), perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const gr = (h, x, y) => { const a = (h & 15) * Math.PI / 8; return Math.cos(a) * x + Math.sin(a) * y; };
  const f = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const n = (x, y) => {
    const X = Math.floor(x), Y = Math.floor(y), xf = x - X, yf = y - Y, xi = X & 255, yi = Y & 255, u = f(xf), v = f(yf);
    return lerp(lerp(gr(p[p[xi] + yi], xf, yf), gr(p[p[xi + 1] + yi], xf - 1, yf), u), lerp(gr(p[p[xi] + yi + 1], xf, yf - 1), gr(p[p[xi + 1] + yi + 1], xf - 1, yf - 1), u), v) * 1.41;
  };
  n.fbm = (x, y, o = 5) => { let s = 0, a = .5, fq = 1, m = 0; for (let i = 0; i < o; i++) { s += n(x * fq, y * fq) * a; m += a; a *= .5; fq *= 2.03; } return s / m; };
  return n;
}
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = 8; return t;
}

/* ---------- renderer + adaptive quality ----------
   Phones keep a high pixel ratio (sharp edges and text); when a device struggles we drop bloom resolution
   and shadow size first, and only then the pixel ratio, never below 1.5 on a high-density screen. */
export function makeStage(canvas, o = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  const maxDpr = Math.min(devicePixelRatio || 1, TOUCH ? 3 : 2);
  const minDpr = Math.min(maxDpr, (devicePixelRatio || 1) >= 2 ? 1.5 : 1);
  let dpr = Math.min(maxDpr, TOUCH ? 2.4 : 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure ?? 1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = o.shadows !== false; renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(o.fov ?? 55, 1, o.near ?? .1, o.far ?? 4000);
  let composer = null, bloom = null;
  if (o.bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), o.bloom.strength ?? .6, o.bloom.radius ?? .5, o.bloom.threshold ?? .85);
    composer.addPass(bloom); composer.addPass(new OutputPass());
  }
  const S = { renderer, scene, camera, composer, bloom, w: 1, h: 1, quality: 2, onResize: [] };
  const fit = () => {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    S.w = w; S.h = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); bloom.resolution.set(w * (S.quality > 1 ? .5 : .35), h * (S.quality > 1 ? .5 : .35)); }
    S.onResize.forEach((f) => f(w, h));
  };
  new ResizeObserver(fit).observe(canvas); addEventListener('resize', fit); fit();
  /* fps watch: after warm-up, step quality down if frames are slow */
  let acc = 0, n = 0, warm = 1.5;
  S.watch = (dt) => {
    if (warm > 0) { warm -= dt; return; }
    acc += dt; n++;
    if (acc > 2) {
      const fps = n / acc; acc = 0; n = 0;
      if (fps < 42 && S.quality > 0) {
        S.quality--;
        if (S.quality === 1) { renderer.shadowMap.type = THREE.PCFShadowMap; if (bloom) bloom.strength *= .85; }
        if (S.quality === 0) { dpr = Math.max(minDpr, dpr * .8); }
        fit(); o.onQuality?.(S.quality);
      }
    }
  };
  S.render = () => { if (composer && S.quality >= 0) composer.render(); else renderer.render(scene, camera); };
  S.dpr = () => dpr;
  return S;
}

/* physically based sky + matching image-based light */
export function skyEnv(S, o = {}) {
  const sky = new Sky(); sky.scale.setScalar(o.scale ?? 3000);
  /* the sky is HDR; cap it so the bloom pass only catches the sun disc and real light sources, never the whole sky */
  sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( min( texColor, vec3( ' + (o.cap ?? 1.6).toFixed(2) + ' ) ), 1.0 );');
  const u = sky.material.uniforms;
  u.turbidity.value = o.turbidity ?? 6; u.rayleigh.value = o.rayleigh ?? 1.6; u.mieCoefficient.value = o.mie ?? .005; u.mieDirectionalG.value = o.mieG ?? .82;
  const sun = new THREE.Vector3();
  const pmrem = new THREE.PMREMGenerator(S.renderer); let rt = null;
  const envScene = new THREE.Scene(); const envSky = new Sky(); envSky.scale.setScalar(100); envScene.add(envSky);
  const set = (elev, azim) => {
    sun.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
    u.sunPosition.value.copy(sun);
    Object.keys(u).forEach((k) => { if (envSky.material.uniforms[k] && k !== 'sunPosition') envSky.material.uniforms[k].value = u[k].value; });
    envSky.material.uniforms.sunPosition.value.copy(sun);
    if (rt) rt.dispose(); rt = pmrem.fromScene(envScene, .02);
    S.scene.environment = rt.texture;
  };
  S.scene.add(sky); set(o.elev ?? 12, o.azim ?? 200);
  return { sky, sun, set };
}

/* ---------- input ---------- */
export function keys() {
  const k = new Set();
  const dn = (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || !gate()) return; k.add(e.code); if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); };
  const up = (e) => k.delete(e.code);
  addEventListener('keydown', dn); addEventListener('keyup', up); addEventListener('blur', () => k.clear());
  return { has: (...c) => c.some((x) => k.has(x)), set: k };
}
/* virtual stick: x, y in [-1, 1]; appears where the thumb lands inside its zone */
export function stick(ui, o = {}) {
  const zone = el('div', 'gk-zone ' + (o.side ?? 'left')); ui.append(zone);
  const base = el('div', 'gk-stick'); const knob = el('div', 'gk-knob'); base.append(knob); zone.append(base);
  const R = 52, st = { x: 0, y: 0, on: false }; let id = null, ox = 0, oy = 0;
  const rest = () => { base.style.left = ''; base.style.top = ''; base.classList.remove('on'); };
  zone.addEventListener('pointerdown', (e) => {
    if (id !== null) return; id = e.pointerId; zone.setPointerCapture(id);
    const r = zone.getBoundingClientRect(); ox = e.clientX; oy = e.clientY;
    base.style.left = (e.clientX - r.left) + 'px'; base.style.top = (e.clientY - r.top) + 'px'; base.classList.add('on'); st.on = true; mv(e);
  });
  const mv = (e) => {
    if (e.pointerId !== id) return; let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px,${dy}px)`; st.x = dx / R; st.y = dy / R;
  };
  const end = (e) => { if (e.pointerId !== id) return; id = null; st.x = st.y = 0; st.on = false; knob.style.transform = ''; rest(); };
  zone.addEventListener('pointermove', mv); zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  st.el = zone; return st;
}
/* hold button: .down while pressed, .tap() fires once per press */
export function btn(ui, label, cls = '', onTap) {
  const b = el('button', 'gk-btn ' + cls); b.type = 'button'; b.innerHTML = label; ui.append(b);
  const st = { down: false, el: b };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); st.down = true; b.classList.add('on'); onTap?.(); try { b.setPointerCapture(e.pointerId); } catch { /* */ } });
  const up = () => { st.down = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('click', (e) => { if (e.detail === 0) onTap?.(); });   // keyboard activation
  return st;
}
/* drag-to-look on an element: accumulates dx, dy (pixels) */
export function dragLook(target, o = {}) {
  const st = { dx: 0, dy: 0, wheel: 0 }; const pts = new Map(); let pinch = 0;
  target.addEventListener('pointerdown', (e) => { if (o.ignore?.(e)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); } });
  target.addEventListener('pointermove', (e) => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) { pts.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) st.wheel += (pinch - d) * 2; pinch = d; return; }
    st.dx += e.clientX - p[0]; st.dy += e.clientY - p[1]; p[0] = e.clientX; p[1] = e.clientY;
  });
  const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
  target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
  target.addEventListener('wheel', (e) => { if (!engaged()) return; e.preventDefault(); st.wheel += e.deltaY; }, { passive: false });
  st.take = () => { const r = [st.dx, st.dy, st.wheel]; st.dx = st.dy = st.wheel = 0; return r; };
  return st;
}

/* ---------- UI ---------- */
export function el(tag, cls = '', html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
/* centred card: title, body, buttons. Returns a promise of the chosen button index. */
export function card(ui, o) {
  const wrap = el('div', 'gk-card-wrap' + (o.side ? ' side' : '')); const c = el('div', 'gk-card ' + (o.cls ?? ''));
  c.innerHTML = `${o.kicker ? `<p class="gk-kick">${o.kicker}</p>` : ''}<h2 class="gk-h">${o.title}</h2>${o.body ? `<div class="gk-body">${o.body}</div>` : ''}`;
  const row = el('div', 'gk-row'); c.append(row); wrap.append(c); ui.append(wrap);
  return new Promise((res) => {
    (o.buttons ?? [tr('play', 'Play')]).forEach((t, i) => {
      const b = el('button', 'gk-cbtn' + (i === 0 ? ' pri' : ''), t); b.type = 'button';
      b.onclick = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 350); res(i); };
      row.append(b); if (i === 0) setTimeout(() => b.focus({ preventScroll: true }), 50);
    });
  });
}
export function hud(ui, cls = '') { const h = el('div', 'gk-hud ' + cls); ui.append(h); return h; }
export function toast(ui, text, ms = 1600) {
  const t = el('div', 'gk-toast', text); ui.append(t);
  requestAnimationFrame(() => t.classList.add('in')); setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, ms);
}
export function controlsLegend(desk, phone) { return `<div class="gk-legend">${(TOUCH ? phone : desk).map(([k, v]) => `<div><b>${k}</b><span>${v}</span></div>`).join('')}</div>`; }
export const best = {
  get(k) { try { return JSON.parse(localStorage.getItem('abidora.games.' + k) ?? 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('abidora.games.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};
export function fmtTime(s) { if (s == null || !isFinite(s)) return '—'; const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`; }

/* ---------- sound: small synth, starts on first gesture, mutable ---------- */
export const sfx = (() => {
  let ac = null, master = null, muted = best.get('mute') === true;
  const init = () => { if (ac) return ac; try { ac = new AudioContext(); master = ac.createGain(); master.gain.value = muted ? 0 : .5; master.connect(ac.destination); } catch { ac = null; } return ac; };
  addEventListener('pointerdown', init, { once: true }); addEventListener('keydown', init, { once: true });
  const blip = (f = 600, d = .12, type = 'sine', vol = .3, slide = 0) => {
    if (!init() || muted) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + d); o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
  };
  const noise = (d = .3, vol = .3, f = 900) => {
    if (!init() || muted) return; const t = ac.currentTime, b = ac.createBuffer(1, ac.sampleRate * d, ac.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < x.length; i++) x[i] = (Math.random() * 2 - 1) * (1 - i / x.length);
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = f; g.gain.value = vol;
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t);
  };
  /* continuous voice (engine, thruster): set(freq, vol) every frame */
  const hum = (type = 'sawtooth', cutoff = 700) => {
    let o, o2, g, fl;
    return {
      set(f, v) {
        if (!init()) return;
        if (!o) { o = ac.createOscillator(); o2 = ac.createOscillator(); g = ac.createGain(); fl = ac.createBiquadFilter(); o.type = type; o2.type = 'square'; fl.type = 'lowpass'; fl.frequency.value = cutoff; g.gain.value = 0; o.connect(fl); o2.connect(fl); fl.connect(g); g.connect(master); o.start(); o2.start(); }
        const t = ac.currentTime; o.frequency.setTargetAtTime(f, t, .05); o2.frequency.setTargetAtTime(f * .501, t, .05); g.gain.setTargetAtTime(muted ? 0 : v, t, .08);
      },
      stop() { if (g) g.gain.setTargetAtTime(0, ac.currentTime, .05); },
    };
  };
  return { blip, noise, hum, get muted() { return muted; }, toggle() { muted = !muted; best.set('mute', muted); if (master) master.gain.value = muted ? 0 : .5; return muted; } };
})();

/* frame loop that pauses in a hidden tab */
export function run(fn) {
  let last = 0, raf = 0, paused = false;
  const tick = (now) => { raf = requestAnimationFrame(tick); if (!shown()) { last = 0; return; } const dt = Math.min(.05, last ? (now - last) / 1000 : 1 / 60); last = now; if (!paused) fn(dt, now / 1000); };
  raf = requestAnimationFrame(tick);
  document.addEventListener('visibilitychange', () => { last = 0; });
  return { pause(v = true) { paused = v; last = 0; }, get paused() { return paused; }, stop() { cancelAnimationFrame(raf); } };
}

/* top-right buttons: pause and sound */
export function topBar(ui, onPause) {
  const bar = el('div', 'gk-top'); ui.append(bar);
  const p = el('button', 'gk-ic', '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>'); p.type = 'button'; p.setAttribute('aria-label', tr('pause', 'Pause')); p.onclick = onPause;
  const s = el('button', 'gk-ic', ''); s.type = 'button';
  const draw = () => { s.innerHTML = sfx.muted ? '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l4 6M21 9l-4 6"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4zM17 8a5 5 0 0 1 0 8M19.5 5.5a8.5 8.5 0 0 1 0 13"/></svg>'; s.setAttribute('aria-label', sfx.muted ? tr('soundon', 'Sound on') : tr('mute', 'Mute')); };
  s.onclick = () => { sfx.toggle(); draw(); }; draw();
  bar.append(s, p); return bar;
}

/* game shortcut keys that respect the host gate */
export function onKey(f) { addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || !gate()) return; f(e); }); }
