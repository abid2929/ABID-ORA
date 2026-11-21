/* World 7 · AI Creation Studio: The Atelier of Light.
   A white gallery with a curved wall of frames. Describe a picture in any language, pick a style and a shape, and the
   site's image service (Cloudflare FLUX, free tier) paints it: the new canvas dissolves into being on the easel at the
   centre, then takes its place on the wall. Your creations stay on this device and can be opened in World 8 to edit.
   When the service is not switched on, the studio says so; it never shows a stock picture as if AI made it. */
import * as THREE from 'three';
import { boot, studioEnv, sheet, linkView, h, css, btn, row, seg, stats, hud, store, cnv, tex, dotTex, grainNormal, TAU, clamp, lerp, isPhone, calm, openWorld } from './tk.js';
import { status, make, MESSAGES, saveCreation, listCreations, deleteCreation, download } from './aiimg.js';

const STYLES = [
  ['', 'No style'], ['photorealistic, natural light, 50mm lens, high detail', 'Photo'], ['cinematic film still, dramatic lighting, anamorphic, rich colour grade', 'Cinematic'],
  ['studio product photography, seamless background, soft shadows, premium', 'Product'], ['detailed watercolour painting on textured paper', 'Watercolour'],
  ['soft 3D render, clay materials, global illumination', '3D render'], ['anime illustration, clean line art, vivid colours', 'Anime'],
  ['oil painting, visible brush strokes, museum quality', 'Oil paint'], ['minimal flat vector poster, bold shapes, limited palette', 'Poster'],
];
const IDEAS = [
  'A lighthouse on a cliff during a storm at blue hour', 'Rickshaw art patterns on a futuristic electric car, studio shot',
  'A tea garden in Sylhet at sunrise with mist between the hills', 'A glass watch with visible gears floating above black water',
  'সুন্দরবনের নদীতে ভোরের আলোয় একটি নৌকা', 'A cosy reading corner in a treehouse, warm lamp light, rain outside',
  'A jellyfish made of light drifting through a nebula', 'Old Dhaka street at night with neon signs in Bengali, rain reflections',
];

/* a canvas that dissolves into view from the middle, with a warm glowing edge */
function revealMat() {
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  m.userData.p = { value: 1 };
  m.onBeforeCompile = (s) => {
    s.uniforms.uP = m.userData.p;
    s.fragmentShader = s.fragmentShader.replace('void main() {', `uniform float uP;
      float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(hh(i), hh(i+vec2(1,0)), f.x), mix(hh(i+vec2(0,1)), hh(i+vec2(1,1)), f.x), f.y); }
      void main() {`).replace('#include <map_fragment>', `#include <map_fragment>
      #ifdef USE_MAP
      float n = vn(vMapUv * 7.0) * .65 + vn(vMapUv * 23.0) * .35;
      float e = uP * 1.55 - (n * .55 + length(vMapUv - .5) * 1.1);
      if (e < 0.0) discard;
      diffuseColor.rgb += vec3(1.0, .62, .25) * smoothstep(.06, 0.0, e) * 2.2;
      #endif`);
  };
  return m;
}
function planks() {
  const [c, g] = cnv(1024); for (let r = 0; r < 8; r++) { let x = -Math.random() * 400; while (x < 1024) { const w = 300 + Math.random() * 380, l = 70 + Math.random() * 22 | 0;
    g.fillStyle = `rgb(${l + 24},${l},${l - 22})`; g.fillRect(x, r * 128, w, 128);
    for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(30,18,8,${Math.random() * .12})`; g.lineWidth = 1 + Math.random() * 2; const y = r * 128 + Math.random() * 128; g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + w * .3, y + 6, x + w * .6, y - 6, x + w, y + 2); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, r * 128, 2, 128); x += w; } g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, r * 128, 1024, 2); }
  return tex(c, true, 16);
}
function linen(text) {
  const [c, g] = cnv(512); g.fillStyle = '#ece8e0'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 512; i += 2) { g.fillStyle = `rgba(120,110,95,${.04 + Math.random() * .04})`; g.fillRect(i, 0, 1, 512); g.fillRect(0, i, 512, 1); }
  if (text) { g.fillStyle = 'rgba(80,72,60,.55)'; g.font = "italic 400 38px 'Instrument Serif', Georgia, serif"; g.textAlign = 'center'; g.fillText(text, 256, 262); }
  return tex(c);
}
function plaque(lines) {
  const [c, g] = cnv(512, 160); g.fillStyle = '#f6f3ee'; g.fillRect(0, 0, 512, 160);
  g.fillStyle = '#1a1a1a'; g.font = "400 34px 'Instrument Serif', Georgia, serif"; g.fillText(lines[0].slice(0, 30), 24, 58);
  g.fillStyle = '#6b655c'; g.font = "500 18px 'JetBrains Mono', monospace"; (lines.slice(1)).forEach((l, i) => g.fillText(l.slice(0, 44), 24, 96 + i * 26));
  return tex(c);
}

export async function start(canvas, ui) {
  css('s-css', `.s-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 4px}
  .s-chips .tk-btn{min-height:38px;padding:7px 12px;font-size:12.5px;border-radius:999px}
  .s-status{font:500 12.5px 'Inter Tight',sans-serif;padding:10px 12px;border-radius:12px;background:rgba(0,0,0,.05);margin:10px 0;display:flex;gap:8px;align-items:flex-start}
  .s-status i{width:9px;height:9px;border-radius:50%;background:#bbb;flex:0 0 auto;margin-top:5px}
  .s-status.ok i{background:#2fae74}.s-status.off i{background:#e0a43a}.s-status.bad i{background:#d9604a}
  .s-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;margin:8px 0}
  .s-grid button{aspect-ratio:1;border-radius:12px;border:0;padding:0;overflow:hidden;cursor:pointer;background:#ddd}
  .s-grid img{width:100%;height:100%;object-fit:cover;display:block}
  .s-idea{display:block;width:100%;text-align:start;margin:0 0 6px}
  .s-prog{height:4px;border-radius:4px;background:rgba(0,0,0,.08);overflow:hidden;margin:8px 0}.s-prog b{display:block;height:100%;width:0;background:var(--acc);transition:width .3s}`);
  const k = boot(canvas, { fov: 40, bloom: [.15, .4, .98], exposure: 1, bg: 0xe4ded4, fog: new THREE.Fog(0xe4ded4, 16, 36), tone: THREE.NeutralToneMapping });
  const { scene, camera, controls, renderer } = k;
  const env = studioEnv(renderer, { bg: 0xd8d4cc, warm: 0xfff0dc, cool: 0xe6eeff, strength: 1.2 }); scene.environment = env; scene.environmentIntensity = .6;
  camera.position.set(0, 1.7, 6.2); controls.target.set(0, 1.55, 0); controls.minDistance = 1.5; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * .56;
  controls.minAzimuthAngle = -1.1; controls.maxAzimuthAngle = 1.1;

  /* ---------- the gallery ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xcfc6b8, 1.1));
  const sun = new THREE.DirectionalLight(0xfff3e2, 2.2); sun.position.set(-3, 8, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -3, near: 1, far: 25 }); sun.shadow.radius = 5; sun.shadow.bias = -.0003; scene.add(sun);
  const floorMat = new THREE.MeshPhysicalMaterial({ map: planks(), color: 0xffffff, roughness: .38, metalness: 0, clearcoat: .5, clearcoatRoughness: .25, normalMap: grainNormal(512, .12), normalScale: new THREE.Vector2(.2, .2), envMap: env, envMapIntensity: .35 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), floorMat); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  /* curved wall: an arc of plaster, frames hang on its inside */
  const R = 6.2, ARC = 2.3;
  const wallM = new THREE.MeshStandardMaterial({ color: 0xf3efe8, roughness: .92, side: THREE.BackSide, envMap: env, envMapIntensity: .4 });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 5.2, 128, 1, true, Math.PI - ARC / 2, ARC), wallM); wall.position.set(0, 2.6, 0); wall.receiveShadow = true; scene.add(wall);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R - .02, R - .02, .12, 128, 1, true, Math.PI - ARC / 2, ARC), new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: .5, side: THREE.BackSide })); base.position.y = .06; scene.add(base);
  /* a skylight slot in the ceiling: light falls on the easel */
  const easelLight = new THREE.SpotLight(0xfff2dd, 30, 9, .38, .6, 1.3); easelLight.position.set(0, 5.5, 3.2); easelLight.target.position.set(0, 1.6, .2); easelLight.castShadow = true; easelLight.shadow.mapSize.set(1024, 1024); scene.add(easelLight, easelLight.target);

  /* ---------- the easel at the centre ---------- */
  const easel = new THREE.Group(); easel.position.set(0, 0, .2); scene.add(easel);
  const oak = new THREE.MeshPhysicalMaterial({ color: 0x8a5a36, roughness: .55, clearcoat: .3, normalMap: grainNormal(256, .2, .8), envMap: env, envMapIntensity: .5 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xd9b26a, metalness: 1, roughness: .25, envMap: env });
  const legG = new THREE.BoxGeometry(.06, 2.9, .06);
  [[-.55, .12, .1], [.55, -.12, .1], [0, 0, -.32]].forEach(([x, rz, rx]) => { const l = new THREE.Mesh(legG, oak); l.position.set(x, 1.4, rx < 0 ? -.55 : 0); l.rotation.set(rx < 0 ? -.33 : 0, 0, rz); l.castShadow = true; easel.add(l); });
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(1.5, .05, .14), oak); ledge.position.set(0, .62, .06); ledge.castShadow = true; easel.add(ledge);
  const art = new THREE.Group(); art.position.set(0, 1.62, .08); easel.add(art);
  const canvasMat = revealMat(); canvasMat.map = linen('Describe a picture to begin'); canvasMat.userData.p.value = 1;
  const artPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), canvasMat); artPlane.position.z = .025; art.add(artPlane);
  const stretcher = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, .04), new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: .9 })); stretcher.castShadow = true; art.add(stretcher);
  const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(.12, .05, .08), brass); art.add(clamp1);
  function setArtSize(w, hh) { const s = 1.9 / Math.max(w, hh); const W = w * s, H = hh * s; artPlane.scale.set(W, H, 1); stretcher.scale.set(W, H, 1); art.position.y = .66 + H / 2; clamp1.position.y = H / 2 + .02; }
  setArtSize(1, 1);

  /* ---------- frames on the wall ---------- */
  const FR = 7, frames = [];
  const frameM = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: .35, metalness: .3, clearcoat: .6, envMap: env, envMapIntensity: .6 });
  for (let i = 0; i < FR; i++) {
    const a = Math.PI + (i - (FR - 1) / 2) * (ARC / (FR + .2)), x = Math.sin(a) * (R - .06), z = Math.cos(a) * (R - .06);
    const g = new THREE.Group(); g.position.set(x, 2.15, z); g.lookAt(0, 2.15, 0); scene.add(g);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1.24, .06), frameM); fr.castShadow = true; g.add(fr);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 1.14), new THREE.MeshStandardMaterial({ color: 0xfbfaf7, roughness: .95 })); mat.position.z = .032; g.add(mat);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(.92, .92), new THREE.MeshStandardMaterial({ map: linen(''), roughness: .7 })); pic.position.z = .034; g.add(pic);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(.42, .13), new THREE.MeshStandardMaterial({ map: plaque(['Empty frame', 'your next creation']), roughness: .6 })); pl.position.set(.42, -.86, .01); g.add(pl);
    const spot = new THREE.SpotLight(0xfff0dc, 9, 5, .42, .7, 1.4); spot.position.set(0, 1.9, 1.2); spot.target = pic; g.add(spot);
    frames.push({ g, pic, pl, item: null });
  }

  /* ---------- a real bronze sculpture on a plinth (scanned model, loaded after the room is on screen) ---------- */
  const plinth = new THREE.Group(); plinth.position.set(-1.35, 0, 2.2); plinth.rotation.y = .4; scene.add(plinth);
  const stone = new THREE.MeshPhysicalMaterial({ color: 0xece7df, roughness: .55, clearcoat: .25, clearcoatRoughness: .4, envMap: env, envMapIntensity: .5 });
  const block = new THREE.Mesh(new THREE.BoxGeometry(.72, .95, .72), stone); block.position.y = .475; block.castShadow = block.receiveShadow = true; plinth.add(block);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(.78, .04, .78), stone); cap.position.y = .97; cap.castShadow = true; plinth.add(cap);
  const credit = new THREE.Mesh(new THREE.PlaneGeometry(.42, .13), new THREE.MeshStandardMaterial({ map: plaque(['Bronze Ray', 'Console Art Cybernetic']), roughness: .6 }));
  credit.position.set(0, .72, .362); plinth.add(credit);
  const plSpot = new THREE.SpotLight(0xfff0dc, 14, 6, .35, .7, 1.4); plSpot.position.set(-1.4, 4.2, 3.2); plSpot.target = plinth; plSpot.castShadow = true; plSpot.shadow.mapSize.set(1024, 1024); scene.add(plSpot);
  import('three/addons/loaders/GLTFLoader.js').then(({ GLTFLoader }) => new GLTFLoader().loadAsync((window.ABIDORA_ROOT ?? '/') + 'assets/models/bronze-ray.glb')).then((g) => {
    const m = g.scene; const box = new THREE.Box3().setFromObject(m), size = box.getSize(new THREE.Vector3()), s = .74 / Math.max(size.x, size.z);
    m.scale.setScalar(s); box.setFromObject(m); const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x, .99 - box.min.y, -c.z);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.envMap = env; o.material.envMapIntensity = 1.1; } });
    plinth.add(m);
  }).catch(() => { /* the gallery is complete without it */ });

  /* ---------- particles that gather while the image is being made ---------- */
  const PN = isPhone() ? 700 : 1400, pg = new THREE.BufferGeometry(), pp = new Float32Array(PN * 3), seeds = new Float32Array(PN);
  for (let i = 0; i < PN; i++) { seeds[i] = Math.random(); pp[i * 3] = 0; pp[i * 3 + 1] = 1.6; pp[i * 3 + 2] = 0; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: .035, map: dotTex(), color: 0xffb35a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); pts.position.z = .3; scene.add(pts);
  let working = false, workT = 0;

  /* ---------- interface ---------- */
  const sh = sheet(ui, { title: 'AI Creation Studio', kicker: 'World 07 · Technology & AI', tabs: ['Create', 'My gallery', 'Ideas', 'About'], theme: 'light', accent: '#c9822e' });
  linkView(k, sh);
  const top = hud(ui, 'Atelier of Light', 'Make something'); top.el.style.color = '#1a1a1a'; top.el.style.textShadow = 'none';
  const [S0, S1, S2, S3] = sh.secs;
  const prompt = h('textarea', { rows: 3, maxlength: 1500, placeholder: 'Describe your picture, in English or বাংলা…', 'aria-label': 'Describe your picture' });
  const st = store('w92.cfg', { style: 1, ar: '1:1', last: '' }); const cfg = { style: 1, ar: '1:1', last: '', ...st.get() }; prompt.value = cfg.last;
  S0.append(prompt);
  S0.append(h('h3', { text: 'Style' }));
  const chips = h('div', { class: 's-chips' }); S0.append(chips);
  const chipBs = STYLES.map(([, t], i) => { const b = h('button', { class: 'tk-btn', text: t, 'aria-pressed': String(i === cfg.style), onclick: () => { cfg.style = i; st.set(cfg); chipBs.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); } }); chips.append(b); return b; });
  S0.append(h('h3', { text: 'Shape' }));
  const arSeg = seg(S0, [['1:1', 'Square'], ['4:3', 'Landscape'], ['3:4', 'Portrait'], ['16:9', 'Wide'], ['9:16', 'Phone']], cfg.ar, (v) => { cfg.ar = v; st.set(cfg); const [w, hh] = v.split(':').map(Number); if (!busy) setArtSize(w, hh); });
  const r0 = row(S0); r0.style.marginTop = '12px';
  const goB = btn(r0, 'Create image', () => create(), 'pri'); goB.style.flex = '1';
  btn(r0, 'Surprise me', () => { prompt.value = IDEAS[Math.floor(Math.random() * IDEAS.length)]; });
  const prog = h('div', { class: 's-prog', hidden: true }, h('b')); S0.append(prog);
  const stEl = h('div', { class: 's-status', role: 'status' }, h('i'), h('span', { text: 'Checking the image service…' })); S0.append(stEl);
  const used = h('p', { style: { fontSize: '12px', opacity: .65 } }); S0.append(used);
  function setStatus(kind, text) { stEl.className = 's-status ' + kind; stEl.lastChild.textContent = text; }

  S1.append(h('p', { text: 'Pictures you make are kept on this device only. Tap one to hang it on the easel.' }));
  const grid = h('div', { class: 's-grid' }); S1.append(grid);
  const r1 = row(S1);
  const dlB = btn(r1, 'Download', () => { if (current) download(current.blob, `abidora-creation-${current.id}.jpg`); });
  const edB = btn(r1, 'Edit in World 08', () => { if (!current) return; try { localStorage.setItem('abidora.w89.open', current.id); } catch { /* ignore */ } openWorld(89); });
  let delArm = 0; const delB = btn(r1, 'Delete', async () => { if (!current) return; if (!delArm) { delArm = setTimeout(() => { delArm = 0; delB.textContent = 'Delete'; }, 3000); delB.textContent = 'Tap again to delete'; return; } clearTimeout(delArm); delArm = 0; delB.textContent = 'Delete'; await deleteCreation(current.id); current = null; await refreshGallery(); showEmpty(); });
  const r1b = h('p', { style: { fontSize: '12px', opacity: .65 } }); S1.append(r1b);

  S2.append(h('p', { text: 'Tap an idea to use it. You can write in Bengali or Banglish too: the service turns it into an English prompt first.' }));
  IDEAS.forEach((t) => { const b = h('button', { class: 'tk-btn s-idea', text: t, onclick: () => { prompt.value = t; sh.select(0); } }); S2.append(b); });

  S3.append(h('h3', { text: 'The sculpture' }), h('p', { text: 'The bronze ray on the plinth is a real 3D scan: "Bronze Ray Statue" by Console Art Cybernetic on Sketchfab, used under the Sketchfab Standard licence.' }));
  S3.append(h('h3', { text: 'How it works' }), h('p', { text: 'Your words go to the Abidora server, which asks Cloudflare\'s FLUX image model to paint them (free tier, no payment). The picture comes straight back to you; nothing is kept on the server.' }),
    h('h3', { text: 'Limits' }), h('p', { text: 'Each visitor can make up to 15 pictures a day, and the whole site up to 120, so the free tier lasts. A picture takes about 3 to 12 seconds.' }),
    h('h3', { text: 'Honesty' }), h('p', { text: 'Every picture on the easel and the wall here was made by the AI for you. If the service is off, the studio says so and stays empty: it never shows a stock photo as AI art.' }));

  /* ---------- gallery ---------- */
  let current = null, busy = false, ready = false;
  const urlOf = new Map(); const imgURL = (it) => { if (!urlOf.has(it.id)) urlOf.set(it.id, URL.createObjectURL(it.blob)); return urlOf.get(it.id); };
  const loader = new THREE.TextureLoader();
  const texOf = (it) => new Promise((res) => loader.load(imgURL(it), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t); }));
  async function refreshGallery() {
    const items = await listCreations();
    grid.replaceChildren(...items.map((it) => h('button', { 'aria-label': it.prompt, onclick: () => showOnEasel(it, false) }, h('img', { src: imgURL(it), alt: it.prompt, loading: 'lazy' }))));
    if (!items.length) grid.append(h('p', { style: { gridColumn: '1/-1' }, text: 'Nothing yet. Your first creation will appear here.' }));
    for (let i = 0; i < FR; i++) {
      const f = frames[i], it = items[i];
      if (it && f.item?.id !== it.id) { f.item = it; const t = await texOf(it); const a = it.w / it.h; f.pic.material.map = t; f.pic.material.needsUpdate = true; f.pic.scale.set(a >= 1 ? 1 : a, a >= 1 ? 1 / a : 1, 1);
        f.pl.material.map = plaque([it.prompt.split(' ').slice(0, 5).join(' '), `${it.provider || 'AI'} · ${new Date(it.t).toLocaleDateString()}`]); f.pl.material.needsUpdate = true; }
    }
    [dlB, edB, delB].forEach((b) => { b.disabled = !current; });
    r1b.textContent = items.length ? `${items.length} picture${items.length > 1 ? 's' : ''} on this device.` : '';
    return items;
  }
  function showEmpty() { canvasMat.map = linen('Describe a picture to begin'); canvasMat.needsUpdate = true; setArtSize(1, 1); [dlB, edB, delB].forEach((b) => { b.disabled = true; }); top.set('Make something'); }
  let revealT = -1;
  async function showOnEasel(it, animate) {
    current = it; const t = await texOf(it); canvasMat.map = t; canvasMat.needsUpdate = true; setArtSize(it.w, it.h);
    canvasMat.userData.p.value = animate && !calm ? 0 : 1; revealT = animate && !calm ? 0 : -1;
    top.set(it.prompt.length > 42 ? it.prompt.slice(0, 40) + '…' : it.prompt); [dlB, edB, delB].forEach((b) => { b.disabled = false; });
    k.fly([0, 1.75, 4.2], [0, 1.65, 0]);
  }

  /* ---------- create ---------- */
  async function create() {
    const p = prompt.value.trim(); if (!p) { sh.toast('Describe your picture first.'); prompt.focus(); return; }
    if (!ready) { sh.toast(MESSAGES.notready); return; }
    if (busy) return; busy = true; goB.disabled = true; goB.textContent = 'Painting…'; cfg.last = p; st.set(cfg);
    prog.hidden = false; const bar = prog.firstChild; bar.style.width = '6%'; let pct = 6; const tick = setInterval(() => { pct = Math.min(92, pct + (92 - pct) * .08); bar.style.width = pct + '%'; }, 300);
    working = true; workT = 0; k.fly([0, 1.8, 4.6], [0, 1.65, 0]);
    try {
      const r = await make({ prompt: p, ar: cfg.ar, style: STYLES[cfg.style][0] || undefined });
      const it = { id: Date.now().toString(36), t: Date.now(), prompt: p, used: r.prompt, blob: r.blob, w: r.w, h: r.h, provider: r.provider, model: r.model, seed: r.seed };
      await saveCreation(it); bar.style.width = '100%'; await showOnEasel(it, true); await refreshGallery(); sh.toast('Done. It is saved on this device.');
    } catch (e) { const code = e.message; sh.toast(MESSAGES[code] || MESSAGES.fail, 4200); if (code === 'notready') { ready = false; setStatus('off', MESSAGES.notready); } }
    finally { clearInterval(tick); setTimeout(() => { prog.hidden = true; bar.style.width = '0'; }, 600); busy = false; goB.disabled = false; goB.textContent = 'Create image'; working = false; }
  }

  /* ---------- frame ---------- */
  k.onFrame((dt, t) => {
    if (revealT >= 0) { revealT += dt / 2.2; canvasMat.userData.p.value = Math.min(1, revealT); if (revealT >= 1) revealT = -1; }
    workT = working ? Math.min(1, workT + dt) : Math.max(0, workT - dt * 1.5);
    pts.material.opacity = workT * .9; pts.visible = workT > 0;
    if (pts.visible) {
      const a = pg.attributes.position.array;
      for (let i = 0; i < PN; i++) { const s = seeds[i], ang = s * TAU * 7 + t * (.6 + s), r = .25 + 1.1 * ((s * 13.7 + t * .25) % 1); a[i * 3] = Math.cos(ang) * r * .85; a[i * 3 + 1] = 1.62 + Math.sin(ang * 1.3) * r * .55; a[i * 3 + 2] = Math.sin(ang) * .25; }
      pg.attributes.position.needsUpdate = true;
    }
    art.rotation.y = Math.sin(t * .25) * .015;
  });
  k.pick(() => frames.map((f) => f.g), (hit) => { const f = frames.find((x) => x.g === hit.object.parent); if (f?.item) showOnEasel(f.item, true); else sh.toast('This frame is waiting for your next creation.'); });

  /* ---------- start ---------- */
  const s = await status(); ready = s.ready;
  if (s.ready) setStatus('ok', `Image service ready (${s.provider === 'cloudflare' ? 'Cloudflare FLUX, free' : s.provider}).`);
  else if (s.ok) setStatus('off', MESSAGES.notready);
  else setStatus('bad', 'The Abidora image service cannot be reached right now, so no pictures can be made. Please try again later.');
  const items = await refreshGallery(); if (items[0]) showOnEasel(items[0], false);
  camera.position.set(0, 3.2, 10); k.fly([0, 1.8, 6.6], [0, 1.6, 0], 2.6);
  return k;
}
