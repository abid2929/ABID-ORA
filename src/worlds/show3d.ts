/* Shared 3D showroom for the product worlds (Sneaker, Bags, Clothing, ...): one WebGL stage with physically based
   light, soft shadows, orbit controls, named camera views and a control rail. Each world adds its own object.
   The stage sleeps when it is off screen, lowers its resolution on phones, and frees the GPU when the world closes. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { h, type Ctx } from './kit';

export { THREE };
export type View = { name: string; pos: [number, number, number] };
export interface Show {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; controls: OrbitControls;
  stage: HTMLElement; rail: HTMLElement; key: THREE.DirectionalLight; rim: THREE.DirectionalLight; phone: boolean;
  frame(target: THREE.Vector3, views: View[]): void; go(name: string): void;
  onTick(f: (dt: number, now: number) => void): void; setLoading(text: string | null): void;
  group(label: string): HTMLElement; chips(p: HTMLElement, items: [string, string][], value: string, on: (v: string) => void): (v: string) => void;
  swatches(p: HTMLElement, items: [string, string, string][], value: string, on: (v: string) => void): (v: string) => void;
  spots(list: { label: string; text: string; at: THREE.Vector3 }[]): void;
}

const CSS = `
.s3-count{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:4;margin:0;padding:8px 16px;border-radius:999px;background:rgba(16,15,13,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(236,230,220,.14);color:#efe9df;font:500 13px/1.2 var(--sans,Inter,sans-serif);white-space:nowrap;max-width:70%;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.s3-arw{position:absolute;top:50%;z-index:4;width:56px;height:56px;margin-top:-28px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:rgba(16,15,13,.6);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(236,230,220,.22);color:#efe9df;transition:background .2s,color .2s}
.s3-arw:hover{background:#ece6dc;color:#111}.s3-arw svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8}
.s3-arw-l{left:16px}.s3-arw-r{right:calc(min(330px,30%) + 20px)}
.s3-vw{position:absolute;bottom:16px;left:50%;transform:translateX(calc(-50% - 150px));z-index:4;display:flex;gap:6px;padding:5px;border-radius:999px;background:rgba(16,15,13,.66);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(236,230,220,.14)}
.s3-vw button{border:0;background:none;color:#cfc8bc;font:500 12px/1 var(--sans,Inter,sans-serif);padding:9px 14px;border-radius:999px;cursor:pointer}
.s3-vw button[aria-pressed=true]{background:#ece6dc;color:#111}
.s3-vw button:focus:not(:focus-visible),.s3-chip:focus:not(:focus-visible),.s3-tab:focus:not(:focus-visible),.s3-arw:focus:not(:focus-visible),.s3-x:focus:not(:focus-visible){outline:none}
.s3-vw button:focus-visible,.s3-chip:focus-visible,.s3-tab:focus-visible,.s3-arw:focus-visible{outline:2px solid #e8b46a;outline-offset:2px}
.s3-gal{margin:14px 0 6px}
.s3-galh{display:flex;align-items:baseline;gap:14px;padding:0 4px 10px}.s3-galh b{font:500 18px/1.2 var(--sans,Inter,sans-serif);color:#efe9df}.s3-galh span{font-size:12px;color:#9a9387}
.s3-galr{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 2px 10px;scrollbar-width:thin}
.s3-card{flex:none;width:150px;scroll-snap-align:start;display:grid;gap:8px;padding:6px 6px 10px;border-radius:16px;border:1px solid rgba(236,230,220,.12);background:#16150f;color:#d9d2c6;cursor:pointer;text-align:left;font:500 12px/1.3 var(--sans,Inter,sans-serif);transition:border-color .2s,transform .2s}
.s3-card:hover{transform:translateY(-2px);border-color:rgba(236,230,220,.35)}
.s3-card[aria-pressed=true]{border-color:#e8b46a;box-shadow:0 0 0 1px #e8b46a}
.s3-card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:11px;background:#111113;display:block}
.s3-card span{padding:0 4px;min-height:2.6em}
@media (max-width:860px){.s3-arw{width:46px;height:46px;margin-top:-23px}.s3-arw-r{right:12px}.s3-arw-l{left:12px}.s3-vw{transform:translateX(-50%);bottom:auto;top:58px}.s3-card{width:118px}.s3-count{font-size:12px}}

.s3{position:relative;margin:0 0 28px;border-radius:22px;overflow:hidden;background:var(--s3bg,#0f0e0c);isolation:isolate;
  display:grid;grid-template-columns:minmax(0,1fr) 300px;height:min(82vh,760px);min-height:520px;grid-template-rows:minmax(0,1fr)}
.s3 canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none}
.s3-rail{position:relative;z-index:2;grid-column:2;margin:14px;padding:18px;border-radius:16px;background:rgba(14,13,11,.62);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid rgba(236,230,220,.12);display:flex;flex-direction:column;gap:16px;align-self:start;max-height:calc(100% - 28px);overflow:auto}
.s3-g .l{display:flex;justify-content:space-between;align-items:baseline;gap:14px;font:500 10px var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:#a49d91;margin-bottom:8px}
.s3-g .l b{font-weight:500;color:#ece6dc;letter-spacing:.06em;text-transform:none;font-family:var(--sans,sans-serif);font-size:12px;text-align:right;min-width:0}
.s3-row{display:flex;flex-wrap:wrap;gap:6px}
.s3-chip{border:1px solid rgba(236,230,220,.2);background:none;color:#ece6dc;border-radius:999px;padding:7px 12px;font:500 12px var(--sans,sans-serif);cursor:pointer}
.s3-chip[aria-pressed=true]{background:#ece6dc;color:#111;border-color:#ece6dc}
.s3-sw{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,255,255,.25);cursor:pointer;padding:0;outline-offset:3px}
.s3-sw[aria-pressed=true]{box-shadow:0 0 0 2px #0f0e0c,0 0 0 3.5px var(--acc,#e8b46a)}
.s3-hint{position:absolute;left:18px;bottom:14px;z-index:2;font:500 10px var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:rgba(236,230,220,.55);pointer-events:none}
.s3-load{position:absolute;inset:0;z-index:3;display:grid;place-items:center;font:500 11px var(--mono,monospace);letter-spacing:.18em;text-transform:uppercase;color:#a49d91;background:var(--s3bg,#0f0e0c);transition:opacity .6s}
.s3-load.done{opacity:0;pointer-events:none}
.s3-spot{position:absolute;left:0;top:0;z-index:2;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;border:1px solid rgba(255,255,255,.7);background:rgba(14,13,11,.55);color:#fff;font:600 11px var(--sans,sans-serif);cursor:pointer;transition:opacity .3s}
.s3-spot:hover,.s3-spot:focus-visible{background:var(--acc,#e8b46a);color:#111}
.s3-tip{position:absolute;z-index:4;max-width:240px;padding:12px 14px;border-radius:12px;background:rgba(14,13,11,.92);color:#ece6dc;font:400 13px/1.5 var(--sans,sans-serif);pointer-events:none}
.s3-tip b{display:block;font-weight:600;margin-bottom:4px;color:var(--acc,#e8b46a)}
.s3-note{font:400 12px/1.5 var(--sans,sans-serif);color:#a49d91;margin:0}
@media (max-width:860px){.s3:has(.s3-count) .s3-hint{display:none}}
@media (min-width:861px){.s3-gal{display:none}}
.s3-pick{max-height:150px;overflow-y:auto;overscroll-behavior:contain;padding-right:4px;scrollbar-width:thin}
.s3-ppick{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:min(430px,52vh)}
.s3-pc{display:grid!important;gap:4px;padding:4px 4px 6px!important;border-radius:12px!important;text-align:center;font-size:10.5px!important;line-height:1.2!important;align-content:start}
.s3-pc img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:9px;background:#0e0e10;display:block}
.s3-pc span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4em}
.s3-pc[aria-pressed=true]{background:rgba(232,180,106,.14)!important;color:#efe9df!important;border-color:#e8b46a!important;box-shadow:0 0 0 1px #e8b46a}
.s3-more>.s3-g[data-off]{display:block!important}
.s3-more{display:flex;flex-direction:column;gap:14px}.s3-more>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border-radius:999px;border:1px solid rgba(236,230,220,.22);font:500 13px var(--sans,sans-serif);color:#ece6dc}.s3-more>summary::-webkit-details-marker{display:none}.s3-more>summary::after{content:'+';font-size:16px}.s3-more[open]>summary::after{content:'−'}.s3-more:not([open])>:not(summary){display:none}.s3-more>summary:focus-visible{outline:2px solid #e8a45c;outline-offset:2px}
.s3-zoom{position:absolute;z-index:3;left:18px;bottom:40px;display:flex;flex-direction:column;gap:8px}
.s3-zb{width:40px;height:40px;border-radius:50%;border:1px solid rgba(236,230,220,.28);background:rgba(14,13,11,.6);color:#ece6dc;font:400 22px/1 var(--sans,sans-serif);cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
.s3-zb:hover,.s3-zb:focus-visible{background:var(--acc,#e8b46a);color:#111}
html.cz .s3 canvas{cursor:none}
.s3-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 0}
.s3-tab{border:0;background:rgba(236,230,220,.08);color:#cfc8bb;border-radius:999px;padding:7px 12px;font:600 12px var(--sans,sans-serif);cursor:pointer}
.s3-tab[aria-selected=true]{background:var(--acc,#e8b46a);color:#111}
.s3-g[data-off]{display:none}
@media (max-width:860px){
  .s3{display:block;min-height:0;height:min(68vh,560px);border-radius:16px}
  .s3 canvas{height:100%}
  .s3-hint{bottom:auto;top:12px;left:14px;right:14px}
  .s3-zoom{left:auto;right:12px;bottom:12px}
  .s3-zb{width:44px;height:44px}
  .s3-spot{width:34px;height:34px;margin:-17px 0 0 -17px;font-size:13px}
}
/* phone editor: the controls live in a bottom sheet (owner, 21 Nov: "Edit" from below, slides away to see the whole model, comes back to edit more) */
.s3-edit{position:absolute;z-index:3;left:12px;bottom:12px;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 18px 0 14px;border-radius:999px;border:0;
  background:var(--acc,#e8b46a);color:#111;font:700 14px var(--sans,sans-serif);letter-spacing:.02em;cursor:pointer;box-shadow:0 10px 30px -10px rgba(0,0,0,.7)}
.s3-edit svg{width:18px;height:18px}
.s3-sheet{position:fixed;left:0;right:0;bottom:0;z-index:80;margin:0;max-height:min(56vh,500px);overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:0;
  padding:0 0 calc(18px + env(safe-area-inset-bottom));border-radius:20px 20px 0 0;border:0;border-top:1px solid rgba(236,230,220,.14);background:#14130f;color:#ece6dc;
  box-shadow:0 -24px 60px -20px rgba(0,0,0,.75);transform:translateY(110%);visibility:hidden;transition:transform .38s cubic-bezier(.16,1,.3,1),visibility 0s .38s}
.s3-sheet.on{transform:none;visibility:visible;transition:transform .38s cubic-bezier(.16,1,.3,1)}
html.f40 .s3-sheet{background:color-mix(in srgb,#14130f 90%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.3);backdrop-filter:blur(18px) saturate(1.3)}
.s3-grab{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;padding:10px 10px 4px 18px;background:inherit;touch-action:none;cursor:grab}
.s3-grab::before{content:"";position:absolute;left:50%;top:7px;width:40px;height:4px;margin-left:-20px;border-radius:4px;background:rgba(236,230,220,.3)}
.s3-grab span{font:500 11px var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:#a49d91;padding-top:10px}
.s3-x{width:44px;height:44px;border:0;border-radius:50%;background:rgba(236,230,220,.08);color:#ece6dc;font:400 22px/1 var(--sans,sans-serif);cursor:pointer}
.s3-x{width:40px;height:40px;flex:none;display:grid;place-items:center;padding:0;border:1px solid rgba(236,230,220,.16);font-size:20px;margin-inline-end:4px}
.s3-x:focus{outline:none}.s3-x:focus-visible{outline:2px solid #e8b46a;outline-offset:2px}
.s3-sheet>.s3-grab,.s3-sheet>.s3-tabs,.s3-sheet>.s3-g,.s3-sheet>.s3-note{flex-shrink:0}
.s3-sheet .s3-ppick{max-height:none;overflow:visible}
.s3-sheet .s3-tabs{display:flex;flex-wrap:nowrap;margin:0;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 14px 12px;position:sticky;top:58px;z-index:2;background:#14130f;border-bottom:1px solid rgba(236,230,220,.08)}
.s3-sheet .s3-tabs::-webkit-scrollbar{display:none}
.s3-sheet .s3-tab{flex:none;padding:10px 16px;font-size:13px;min-height:42px}
.s3-sheet .s3-g{padding:16px 16px 4px}
.s3-sheet .s3-g .l{font-size:11px}
.s3-sheet .s3-chip:not(.s3-pc){padding:11px 16px;font-size:14px;min-height:44px}
.s3-sheet .s3-sw{width:40px;height:40px}
.s3-sheet .s3-row{gap:9px}
.s3-sheet .s3-note{padding:12px 16px 0}
html.s3-open .wact{transform:translateY(140%);transition:transform .3s}
@media (min-width:861px){.s3-edit{display:none}}
@media (prefers-reduced-motion:reduce){.s3-sheet,.s3-sheet.on{transition:none}}`;

export function leatherTex(color: string, grain = 1, seed = 1) {
  const W = 512, c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, W, W);
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 9000 * grain; i++) { const x = rnd() * W, y = rnd() * W, s = 1 + rnd() * 3 * grain; g.fillStyle = `rgba(0,0,0,${rnd() * .07})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); }
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .03})`; g.fillRect(rnd() * W, rnd() * W, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
/* normal maps drawn in code: pebbled leather, crocodile scales, twill (denim), plain weave (cotton), knit */
export function normalTex(kind: 'pebble' | 'croc' | 'twill' | 'weave' | 'knit' | 'smooth', size = 512) {
  const W = size, hgt = new Float32Array(W * W);
  const hsh = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    let v = 0;
    if (kind === 'pebble') { const cx = Math.floor(x / 9), cy = Math.floor(y / 9); let d = 9; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const px = (cx + i + hsh(cx + i, cy + j)) * 9, py = (cy + j + hsh(cy + j, cx + i)) * 9; d = Math.min(d, Math.hypot(x - px, y - py)); } v = Math.min(1, d / 6); v = 1 - v * v; }
    else if (kind === 'croc') { const row = Math.floor(y / 26), off = (row % 2) * 17, cx = (x + off) % 34, cy = y % 26; v = Math.min(cx, 34 - cx, cy, 26 - cy) / 6; v = Math.min(1, v); }
    else if (kind === 'twill') v = .5 + .5 * Math.sin((x + y) * .9) * (.7 + .3 * hsh(Math.floor((x - y) / 3), 0));
    else if (kind === 'weave') { const a = Math.sin(x * 1.1) * .5 + .5, b = Math.sin(y * 1.1) * .5 + .5; v = ((Math.floor(x / 3) + Math.floor(y / 3)) % 2) ? a : b; }
    else if (kind === 'knit') { const cx = x % 8, cy = y % 10; v = 1 - Math.abs(cx - 4 + (cy - 5) * .5 * (cx < 4 ? 1 : -1)) / 5; }
    else v = .5 + (hsh(x, y) - .5) * .05;
    hgt[y * W + x] = v;
  }
  const c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d')!, im = g.createImageData(W, W), d = im.data;
  const k = kind === 'smooth' ? .5 : 2.2;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const L = hgt[y * W + (x - 1 + W) % W], R = hgt[y * W + (x + 1) % W], U = hgt[((y - 1 + W) % W) * W + x], D = hgt[((y + 1) % W) * W + x];
    let nx = (L - R) * k, ny = (U - D) * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * W + x) * 4; d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = (nz * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function show3d(ctx: Ctx, o: { bg?: string; acc?: string; hint?: string; tabs?: boolean } = {}): Show {
  if (!document.getElementById('s3css')) { const st = document.createElement('style'); st.id = 's3css'; st.textContent = CSS; document.head.append(st); }
  const phone = matchMedia('(max-width: 860px)').matches || /Android|iPhone|iPad/.test(navigator.userAgent);
  const cv = h('canvas', { 'aria-label': ctx.t('s3.canvas', 'Interactive 3D view. Drag to turn, scroll or pinch to zoom.'), role: 'img', tabindex: '0' });
  const rail = h('div', { class: 's3-rail' });
  const load = h('div', { class: 's3-load', text: ctx.t('s3.load', 'Building the 3D showroom…') });
  const tip = h('div', { class: 's3-tip', hidden: true });
  const stage = h('section', { class: 's3', 'aria-label': ctx.t('s3.label', '3D showroom') }, cv, h('p', { class: 's3-hint', text: phone ? ctx.t('s3.hintp', 'Swipe sideways to turn · pinch to zoom') : ctx.t('s3.hintd', 'Drag to turn · scroll or + / − to zoom') }), rail, tip, load);
  const zoomBox = h('div', { class: 's3-zoom' });
  stage.append(zoomBox);
  if (o.bg) stage.style.setProperty('--s3bg', o.bg); if (o.acc) stage.style.setProperty('--acc', o.acc);
  ctx.root.prepend(stage);

  const renderer = new THREE.WebGLRenderer({ canvas: cv as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, phone ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;   /* Khronos PBR Neutral: keeps product colours true */ renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(o.bg ?? '#0f0e0c');
  const pm = new THREE.PMREMGenerator(renderer); const envRT = pm.fromScene(new RoomEnvironment(), .04); scene.environment = envRT.texture; pm.dispose();
  const camera = new THREE.PerspectiveCamera(30, 1, .01, 100);
  const controls = new OrbitControls(camera, cv as HTMLCanvasElement); controls.enableDamping = true; controls.dampingFactor = .07; controls.enablePan = false;
  /* owner, 20 Nov: "mouse didn't work". A plain mouse wheel over the big 3D stage was taken for zoom, so the page would not scroll.
     Now the wheel scrolls the page; it zooms only with Ctrl/⌘ held or after you click into the 3D (until the mouse leaves it).
     Pinch still zooms on phones, and the + / − buttons zoom for everyone. */
  let engaged = false; controls.enableZoom = false;
  cv.addEventListener('pointerdown', () => { engaged = true; controls.enableZoom = true; }, { capture: true });
  cv.addEventListener('pointerleave', (e) => { if ((e as PointerEvent).pointerType === 'mouse') { engaged = false; controls.enableZoom = false; } });
  /* owner, 21 Nov: "mouse doesn't work" again. The wheel now zooms whenever the 3D stage is (almost) fully on screen, so you are clearly looking at it;
     while the stage is only partly visible the wheel keeps scrolling the page, so you are never stuck. */
  cv.addEventListener('wheel', (e) => { const r = stage.getBoundingClientRect(), vis = (Math.min(innerHeight, r.bottom) - Math.max(0, r.top)) / Math.max(1, Math.min(r.height, innerHeight));
    controls.enableZoom = engaged || e.ctrlKey || e.metaKey || vis > .82; }, { capture: true, passive: true });
  if (phone) (cv as HTMLCanvasElement).style.touchAction = 'pan-y';   /* owner, 21 Nov: scrolling past the 3D spun it to a weird top-down angle; one-finger up/down now scrolls, sideways turns, pinch zooms */
  controls.maxPolarAngle = Math.PI * .56;
  controls.autoRotate = !ctx.calm; controls.autoRotateSpeed = .7; controls.addEventListener('start', () => { controls.autoRotate = false; });
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(.8, 1.6, .9); key.castShadow = true;
  key.shadow.mapSize.set(phone ? 1024 : 2048, phone ? 1024 : 2048); key.shadow.radius = 6; key.shadow.bias = -.0004; scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(o.acc ? new THREE.Color(o.acc) : 0xe8b46a, 1.1); rim.position.set(-1, .7, -.9); scene.add(rim);

  let tabs: HTMLElement | null = null; const groups: HTMLElement[] = [];
  let views: View[] = [], target = new THREE.Vector3(), scale = 1, tw: { a: THREE.Vector3; b: THREE.Vector3; t: number } | null = null;
  let lift = 0; /* phone: while the editor sheet covers the bottom of the stage, the picture moves up into the part you can see */
  const fit = () => { const r = stage.getBoundingClientRect(), w = Math.max(1, r.width), hh = Math.max(1, r.height);
    renderer.setSize(w, hh, false); camera.aspect = w / hh;
    /* the object sits left of the rail on wide screens */
    if (w > 860) camera.setViewOffset(w, hh, Math.min(150, w * .11), 0, w, hh); else if (lift > 0) camera.setViewOffset(w, hh, 0, lift, w, hh); else camera.clearViewOffset();
    scale = Math.max(1, .95 / camera.aspect * (w > 860 ? 1 : .92)); camera.updateProjectionMatrix(); };
  const ro = new ResizeObserver(fit); ro.observe(stage); fit();

  const ticks: ((dt: number, now: number) => void)[] = [];
  let on = true; const io = new IntersectionObserver((e) => { on = e[0].isIntersecting; }); io.observe(stage);
  const spotEls: { el: HTMLElement; at: THREE.Vector3 }[] = []; const v3 = new THREE.Vector3();
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    if (!on || document.hidden) { last = now; return; }
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (tw) { tw.t = Math.min(1, tw.t + dt / .9); const e = 1 - Math.pow(1 - tw.t, 3); camera.position.lerpVectors(tw.a, tw.b, e); if (tw.t >= 1) tw = null; }
    for (const f of ticks) f(dt, now);
    controls.update(); renderer.render(scene, camera);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    for (const s of spotEls) { v3.copy(s.at).project(camera); const vis = v3.z < 1 && Math.abs(v3.x) < .95 && Math.abs(v3.y) < .95;
      s.el.style.opacity = vis ? '1' : '0'; s.el.style.pointerEvents = vis ? 'auto' : 'none'; s.el.style.transform = `translate(${((v3.x * .5 + .5) * cw).toFixed(1)}px,${((-v3.y * .5 + .5) * ch).toFixed(1)}px)`; }
  });
  ctx.onDispose(() => { renderer.setAnimationLoop(null); ro.disconnect(); io.disconnect(); controls.dispose(); envRT.dispose();
    scene.traverse((x) => { const m = x as THREE.Mesh; if (m.geometry) m.geometry.dispose(); const mt = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mt) ? mt : mt ? [mt] : []).forEach((q) => q.dispose()); });
    renderer.dispose(); });

  const zoomBy = (k: number) => { controls.autoRotate = false; const d = camera.position.clone().sub(controls.target); const L = Math.min(controls.maxDistance, Math.max(controls.minDistance, d.length() * k));
    tw = { a: camera.position.clone(), b: controls.target.clone().add(d.setLength(L)), t: 0 }; };
  for (const [txt, k, lab] of [['+', .78, ctx.t('s3.zin', 'Zoom in')], ['−', 1.28, ctx.t('s3.zout', 'Zoom out')]] as [string, number, string][]) {
    const b = h('button', { type: 'button', class: 's3-zb', text: txt, 'aria-label': lab, title: lab }); b.onclick = () => zoomBy(k); zoomBox.append(b); }
  { const lab = ctx.t('s3.reset', 'Reset view'); const b = h('button', { type: 'button', class: 's3-zb', text: '⟲', 'aria-label': lab, title: lab }); b.onclick = () => { if (views[0]) S.go(views[0].name); }; zoomBox.prepend(b); }
  if (phone) {
    /* the rail becomes a bottom sheet on the page itself (so no transformed parent can trap it) */
    const sheet = rail; sheet.classList.add('s3-sheet'); sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', ctx.t('s3.editor', 'Editor'));
    if (o.acc) sheet.style.setProperty('--acc', o.acc);
    const x = h('button', { type: 'button', class: 's3-x', text: '×', 'aria-label': ctx.t('s3.close', 'Close editor') });
    const grab = h('div', { class: 's3-grab' }, h('span', { text: ctx.t('s3.edit', 'Edit') }), x); sheet.prepend(grab);
    const ed = h('button', { type: 'button', class: 's3-edit', 'aria-expanded': 'false' }); ed.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/></svg>';
    ed.append(document.createTextNode(ctx.t('s3.edit', 'Edit'))); stage.append(ed); document.body.append(sheet);
    const relift = () => { if (!sheet.classList.contains('on')) { lift = 0; fit(); return; }
      const sr = stage.getBoundingClientRect(), top = innerHeight - sheet.getBoundingClientRect().height, vis = Math.max(120, top - Math.max(0, sr.top)); lift = Math.max(0, Math.min(sr.height * .3, (sr.height - vis) / 2)); fit(); };
    const open = () => { sheet.style.transform = ''; sheet.classList.add('on'); document.documentElement.classList.add('s3-open'); ed.setAttribute('aria-expanded', 'true'); ed.hidden = true;
      const t0 = stage.getBoundingClientRect().top; if (Math.abs(t0 - 60) > 8) scrollTo({ top: scrollY + t0 - 60, behavior: ctx.calm ? 'auto' : 'smooth' });
      setTimeout(relift, 420); x.focus({ preventScroll: true }); };
    const close = () => { sheet.style.transform = ''; sheet.classList.remove('on'); document.documentElement.classList.remove('s3-open'); ed.setAttribute('aria-expanded', 'false'); ed.hidden = false; lift = 0; fit(); };
    ed.onclick = open; x.onclick = () => { close(); ed.focus({ preventScroll: true }); };
    /* tap anywhere outside the sheet and the 3D picture closes it; turning the model while editing is fine */
    const outside = (e: PointerEvent) => { if (!sheet.classList.contains('on')) return; const tg = e.target as Node; if (sheet.contains(tg) || cv.contains(tg) || zoomBox.contains(tg)) return; close(); };
    document.addEventListener('pointerdown', outside, true);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && sheet.classList.contains('on')) close(); }; document.addEventListener('keydown', esc);
    /* swipe the sheet down to put it away */
    let y0 = -1, dy = 0;
    sheet.addEventListener('touchstart', (e) => { const fromGrab = grab.contains(e.target as Node); y0 = (fromGrab || sheet.scrollTop <= 0) ? e.touches[0].clientY : -1; dy = 0; }, { passive: true });
    sheet.addEventListener('touchmove', (e) => { if (y0 < 0) return; dy = e.touches[0].clientY - y0; if (dy > 0) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy}px)`; } }, { passive: true });
    sheet.addEventListener('touchend', () => { if (y0 < 0) return; sheet.style.transition = ''; if (dy > 70) close(); else sheet.style.transform = ''; y0 = -1; });
    ctx.onDispose(() => { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc); document.documentElement.classList.remove('s3-open'); sheet.remove(); });
  }
  const S: Show = {
    scene, camera, renderer, controls, stage, rail, key, rim, phone,
    frame(t, v) { target = t.clone(); views = v; controls.target.copy(target); const p = v[0].pos; camera.position.set(p[0], p[1], p[2]).multiplyScalar(scale).add(target);
      const r = Math.hypot(...p); controls.minDistance = r * .35; controls.maxDistance = r * 2.2 * scale; },
    go(name) { const v = views.find((x) => x.name === name); if (!v) return; controls.autoRotate = false;
      tw = { a: camera.position.clone(), b: new THREE.Vector3(...v.pos).multiplyScalar(scale).add(target), t: 0 }; if (ctx.calm) { camera.position.copy(tw.b); tw = null; } },
    onTick(f) { ticks.push(f); },
    setLoading(text) { if (text === null) load.classList.add('done'); else { load.classList.remove('done'); load.textContent = text; } },
    group(label) { const g = h('div', { class: 's3-g' }, h('div', { class: 'l' }, h('span', { text: label }), h('b')));
      /* on phones the groups become tabs: one short panel at a time, big touch targets, the 3D stays in view */
      if (phone || o.tabs) { if (!tabs) { tabs = h('div', { class: 's3-tabs', role: 'tablist' }); const gb = rail.querySelector(':scope > .s3-grab'); if (gb) gb.after(tabs); else rail.prepend(tabs); }
        const tb = h('button', { class: 's3-tab', type: 'button', role: 'tab', text: label, 'aria-selected': String(!groups.length) });
        if (groups.length) g.setAttribute('data-off', '');
        const gi = groups.length; groups.push(g); tabs.append(tb);
        tb.onclick = () => { groups.forEach((x, i) => { x.toggleAttribute('data-off', i !== gi); }); tabs!.querySelectorAll('.s3-tab').forEach((x, i) => x.setAttribute('aria-selected', String(i === gi))); tb.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); };
        (gi ? groups[gi - 1] : tabs).after(g); return g; }
      const firstNote = rail.querySelector(':scope > .s3-note'); if (firstNote) firstNote.before(g); else rail.append(g); return g; },
    chips(p, items, value, cb) {
      const row = h('div', { class: 's3-row' }); p.append(row); const bs = items.map(([v, l]) => { const b = h('button', { class: 's3-chip', type: 'button', text: l, 'aria-pressed': String(v === value) }); b.onclick = () => { set(v); cb(v); }; row.append(b); return [v, b, l] as const; });
      const set = (v: string) => { bs.forEach(([k, b, l]) => { b.setAttribute('aria-pressed', String(k === v)); if (k === v) { const lb = p.querySelector('.l b'); if (lb) lb.textContent = l; } }); };
      set(value); return set; },
    swatches(p, items, value, cb) {
      const row = h('div', { class: 's3-row' }); p.append(row); const bs = items.map(([v, css, l]) => { const b = h('button', { class: 's3-sw', type: 'button', title: l, 'aria-label': l, 'aria-pressed': String(v === value) }); b.style.background = css; b.onclick = () => { set(v); cb(v); }; row.append(b); return [v, b, l] as const; });
      const set = (v: string) => { bs.forEach(([k, b, l]) => { b.setAttribute('aria-pressed', String(k === v)); if (k === v) { const lb = p.querySelector('.l b'); if (lb) lb.textContent = l; } }); };
      set(value); return set; },
    spots(list) {
      for (const el of spotEls) el.el.remove(); spotEls.length = 0;
      list.forEach((s, i) => { const el = h('button', { class: 's3-spot', type: 'button', text: String(i + 1), 'aria-label': s.label });
        const show = () => { tip.innerHTML = ''; tip.append(h('b', { text: s.label }), document.createTextNode(s.text)); tip.hidden = false;
          const r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect(); tip.style.left = Math.min(sr.width - 250, r.right - sr.left + 8) + 'px'; tip.style.top = Math.max(8, r.top - sr.top - 8) + 'px'; };
        el.onmouseenter = show; el.onfocus = show; el.onclick = show; el.onmouseleave = () => { tip.hidden = true; }; el.onblur = () => { tip.hidden = true; };
        stage.append(el); spotEls.push({ el, at: s.at }); });
    },
  };
  return S;
}

/* a soft shadow-catching floor and a faint pool of light */
export function floor(S: Show, y = 0, size = 4, col?: string) {
  const f = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.ShadowMaterial({ opacity: .38 })); f.rotation.x = -Math.PI / 2; f.position.y = y; f.receiveShadow = true; S.scene.add(f);
  if (col) { const p = new THREE.Mesh(new THREE.CircleGeometry(size * .14, 64), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .07, depthWrite: false })); p.rotation.x = -Math.PI / 2; p.position.y = y + .0005; S.scene.add(p); }
  return f;
}
