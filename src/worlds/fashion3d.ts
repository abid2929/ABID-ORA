/* Abidora fashion studio engine, shared by Clothing and Shoes.
   Loads real 3D models (GLB built in Blender, see tools/blender) whose parts are separate named material zones
   (zone_upper, zone_sole, zone_hood ...), and lets the visitor change every zone live: colour, material (each with its
   own physically based surface relief, roughness and sheen), finish, pattern, plus logos, prints and shape variants.
   Around the 3D stage: undo / redo / reset, before-after, saved designs, PNG / spec / GLB export, and a design library
   with 3D-rendered previews, categories, search, sorting, favourites and side-by-side compare.
   Nothing here is simulated: every control changes the 3D model or the saved data. */
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { show3d, floor, THREE, type Show } from './show3d';
import { surfaceMaps, type SK } from './surface';
import { h, type Ctx, store, download } from './kit';

export type MatKey = 'leather' | 'suede' | 'nubuck' | 'knit' | 'mesh' | 'canvas' | 'patent' | 'croc' | 'rubber' | 'foam' | 'metal' | 'cork'
  | 'cotton' | 'jersey' | 'denim' | 'twill' | 'wool' | 'fleece' | 'silk' | 'linen' | 'satin' | 'nylon' | 'rib';
export type Finish = 'matte' | 'satin' | 'gloss' | 'metallic';
export type Pattern = 'solid' | 'check' | 'gingham' | 'stripe' | 'pinstripe' | 'dots' | 'camo' | 'perf' | 'speckle' | 'herring' | 'houndstooth' | 'paisley';
export interface ZoneState { c: string; m: MatKey; f: Finish; p: Pattern; pc: string }
export interface PrintState { on: boolean; text: string; art: string; ink: string; img?: string }
export interface DesignState { model: string; variant: string; size: string; zones: Record<string, ZoneState>; show: Record<string, boolean>; prints: Record<string, PrintState>; wear?: number }
export interface ModelDef { name: string; variants: [string, string][]; file: (variant: string, lod: 'hi' | 'lo') => string; note: string }
export interface ZoneDef { label: string; mats: MatKey[]; patterns?: boolean }
export interface Design { id: string; name: string; cat: string[]; tags: string[]; note: string; state: DesignState }
export interface StudioConfig {
  key: string; bg: string; acc: string; hint: string;
  models: Record<string, ModelDef>;
  zones: Record<string, ZoneDef>;
  base: string[];                          // zones set by "Base colour"
  categories: [string, string][];
  designs: Design[];
  sizes: [string, string][]; sizeScale: (size: string) => number; sizeNote: (size: string) => string;
  views: [string, string, [number, number, number]][]; dist?: number;   // id, label, direction (scaled by the model's size)
  lift?: number;                           // camera target height as a share of the model's height
  shows: [string, string, string[]][];     // toggle id, label, node-name prefixes
  prints: [string, string, number, string?][];   // node name, label, aspect (width / height), opaque: background zone
  thumbView: [number, number, number];
  credit: string;
}

/* ---------- materials: every one physically based, with relief drawn in code at real scale ---------- */
type NK = SK;
const MATS: Record<MatKey, { n: NK; tile: number; ns: number; rough: number; sheen?: number; sr?: number; cc?: number; metal?: number; label: string }> = {
  leather: { n: 'leather', tile: 7, ns: 1, rough: .6, cc: .04, sheen: .25, sr: .55, label: 'Full-grain leather' },
  suede: { n: 'suede', tile: 2.5, ns: .6, rough: .96, sheen: 1, sr: .45, label: 'Suede' },
  nubuck: { n: 'suede', tile: 4, ns: .4, rough: .88, sheen: .6, sr: .6, label: 'Nubuck' },
  knit: { n: 'knit', tile: 11, ns: 1, rough: .86, sheen: .35, sr: .6, label: 'Engineered knit' },
  mesh: { n: 'mesh', tile: 5, ns: 1.2, rough: .78, sheen: .2, label: 'Air mesh' },
  canvas: { n: 'weave', tile: 7, ns: .8, rough: .9, sheen: .15, label: 'Cotton canvas' },
  patent: { n: 'smooth', tile: 30, ns: .15, rough: .06, cc: 1, label: 'Patent leather' },
  croc: { n: 'croc', tile: 16, ns: 1, rough: .38, cc: .45, label: 'Croc-embossed leather' },
  rubber: { n: 'rubber', tile: 20, ns: .6, rough: .82, label: 'Rubber' },
  foam: { n: 'foam', tile: 8, ns: .6, rough: .62, sheen: .2, sr: .7, label: 'EVA foam' },
  cork: { n: 'cork', tile: 3, ns: 1, rough: .9, label: 'Cork' },
  metal: { n: 'smooth', tile: 30, ns: 0, rough: .28, metal: 1, label: 'Metal' },
  cotton: { n: 'weave', tile: 3, ns: .6, rough: .9, sheen: .35, sr: .7, label: 'Cotton' },
  jersey: { n: 'knit', tile: 7, ns: .7, rough: .9, sheen: .4, sr: .6, label: 'Cotton jersey' },
  denim: { n: 'twill', tile: 5, ns: 1, rough: .84, sheen: .25, sr: .7, label: 'Denim twill' },
  twill: { n: 'twill', tile: 4, ns: .7, rough: .8, sheen: .3, sr: .6, label: 'Chino twill' },
  wool: { n: 'knit', tile: 14, ns: 1.2, rough: 1, sheen: .9, sr: .8, label: 'Wool' },
  fleece: { n: 'fleece', tile: 2, ns: .8, rough: 1, sheen: 1, sr: .9, label: 'Brushed fleece' },
  silk: { n: 'smooth', tile: 30, ns: .1, rough: .3, sheen: 1, sr: .25, label: 'Silk' },
  linen: { n: 'weave', tile: 6, ns: 1, rough: .93, sheen: .2, sr: .8, label: 'Linen' },
  satin: { n: 'smooth', tile: 30, ns: .1, rough: .22, sheen: .8, sr: .3, cc: .2, label: 'Satin' },
  nylon: { n: 'ripstop', tile: 5, ns: .7, rough: .45, sheen: .3, sr: .5, label: 'Ripstop nylon' },
  rib: { n: 'rib', tile: 5, ns: 1, rough: .92, sheen: .45, sr: .6, label: 'Rib knit' },
};
export const MAT_LABEL = (k: MatKey) => MATS[k].label;
const PATTERNS: [Pattern, string][] = [['solid', 'Solid'], ['check', 'Check'], ['gingham', 'Gingham'], ['stripe', 'Stripe'], ['pinstripe', 'Pinstripe'], ['dots', 'Dots'],
  ['herring', 'Herringbone'], ['houndstooth', 'Houndstooth'], ['camo', 'Camo'], ['paisley', 'Paisley'], ['perf', 'Perforated'], ['speckle', 'Speckle']];
/* tile size of each pattern in cm (models use 1 UV unit = 10 cm) */
const PTILE: Record<Pattern, number> = { solid: 10, check: 5, gingham: 2.4, stripe: 3, pinstripe: 2, dots: 2.4, herring: 2, houndstooth: 1.6, camo: 26, paisley: 12, perf: 1.2, speckle: 8 };

const texCache = new Map<string, THREE.Texture>();
const TEX = typeof innerWidth === 'number' && innerWidth < 700 ? 512 : 1024;
function patternTex(p: Pattern, c: string, pc: string) {
  const key = `p:${p}:${c}:${pc}`; const hit = texCache.get(key); if (hit) return hit;
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d')!;
  let r = 9; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  g.fillStyle = c; g.fillRect(0, 0, S, S); g.fillStyle = pc; g.strokeStyle = pc;
  if (p === 'check') { g.fillRect(0, 0, S / 2, S / 2); g.fillRect(S / 2, S / 2, S / 2, S / 2); }
  else if (p === 'gingham') { g.globalAlpha = .5; g.fillRect(0, 0, S / 2, S); g.fillRect(0, 0, S, S / 2); g.globalAlpha = 1; g.fillRect(0, 0, S / 2, S / 2); }
  else if (p === 'stripe') g.fillRect(0, 0, S, S * .4);
  else if (p === 'pinstripe') g.fillRect(0, 0, S * .05, S);
  else if (p === 'dots') { for (const [x, y] of [[.25, .25], [.75, .75]]) { g.beginPath(); g.arc(x * S, y * S, S * .1, 0, 7); g.fill(); } }
  else if (p === 'perf') { g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(S / 2, S / 2, S * .16, 0, 7); g.fill(); }
  else if (p === 'speckle') { for (let i = 0; i < 900; i++) { g.globalAlpha = .5 + rnd() * .5; g.beginPath(); g.arc(rnd() * S, rnd() * S, 1 + rnd() * 3.5, 0, 7); g.fill(); } g.globalAlpha = 1; }
  else if (p === 'herring') { g.lineWidth = S * .07; for (let k = -1; k < 5; k++) { const y = k * S / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(S / 2, y + S / 4); g.lineTo(S, y); g.stroke(); } }
  else if (p === 'houndstooth') { const u = S / 4; g.fillRect(0, 0, S / 2, S / 2); g.beginPath(); g.moveTo(S / 2, 0); g.lineTo(S / 2 + u, 0); g.lineTo(S / 2, u); g.fill(); g.beginPath(); g.moveTo(0, S / 2); g.lineTo(0, S / 2 + u); g.lineTo(u, S / 2); g.fill();
    g.beginPath(); g.moveTo(S / 2, S / 2); g.lineTo(S, 0); g.lineTo(S, u); g.lineTo(S / 2 + u, S / 2); g.fill(); }
  else if (p === 'camo') { const cs = [pc, shadeHex(c, -.35), shadeHex(pc, .3)];
    for (let i = 0; i < 70; i++) { g.fillStyle = cs[i % 3]; const x = rnd() * S, y = rnd() * S, rr = 20 + rnd() * 50; g.beginPath(); for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, q = rr * (.6 + rnd() * .6); g.lineTo(x + Math.cos(ang) * q, y + Math.sin(ang) * q); } g.closePath(); g.fill();
      for (const [dx, dy] of [[S, 0], [-S, 0], [0, S], [0, -S]]) { g.save(); g.translate(dx, dy); g.fill(); g.restore(); } } }
  else if (p === 'paisley') { g.lineWidth = 6; for (const [x, y, s, a] of [[.28, .3, 1, .4], [.74, .72, .9, 3.4], [.75, .22, .6, 2], [.24, .78, .65, 5]]) {
      g.save(); g.translate(x * S, y * S); g.rotate(a); g.scale(s, s); g.beginPath(); g.moveTo(0, -70); g.bezierCurveTo(60, -40, 60, 50, 0, 60); g.bezierCurveTo(-50, 55, -45, 0, 0, 0); g.bezierCurveTo(30, -20, 10, -60, 0, -70); g.fill();
      g.fillStyle = c; g.beginPath(); g.arc(2, 28, 14, 0, 7); g.fill(); g.fillStyle = pc; g.restore(); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  texCache.set(key, t); return t;
}
function shadeHex(hx: string, k: number) { const c = new THREE.Color(hx); const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + k * (k > 0 ? 1 - hsl.l : hsl.l)))); return '#' + c.getHexString(); }

/* condition of the product: 0 new, 1 well worn. Dirt settles where the baked occlusion is deep (creases, seams,
   round eyelets, between lugs) and the surface turns duller, as on a real worn shoe or garment. */
export const WEAR = { value: 0 };
function wearShader(m: THREE.MeshPhysicalMaterial) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWear = WEAR;
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uWear;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n#ifdef USE_COLOR\n  float dirt = clamp((1.0 - vColor.r) * uWear * 2.4 + uWear * .1, 0.0, .85);\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.29, .25, .2) * (.6 + .4 * dot(diffuseColor.rgb, vec3(.33))), dirt);\n#endif')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = min(1.0, roughnessFactor + uWear * .22);');
  };
  m.customProgramCacheKey = () => 'fxwear';
}
export function makeMaterial(z: ZoneState, vertexAO = false) {
  const M = MATS[z.m] ?? MATS.leather, m = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const rep = 10 / M.tile, S = surfaceMaps(M.n, TEX);
  /* the surface tiles are shared; each material gets its own view with the repeat for the material's real scale */
  const nn = S.normal.clone(); nn.repeat.set(rep, rep); m.normalMap = nn; m.normalScale.set(M.ns, M.ns);
  const orm = S.orm.clone(); orm.repeat.set(rep, rep); m.roughnessMap = orm; m.aoMap = orm; m.aoMapIntensity = 1;
  m.vertexColors = vertexAO;   /* baked contact shadows from Blender (ambient occlusion) */
  if (vertexAO) wearShader(m);
  if (z.p && z.p !== 'solid') { const pt = patternTex(z.p, z.c, z.pc).clone(); pt.needsUpdate = true; const pr = 10 / PTILE[z.p]; pt.repeat.set(pr, pr); m.map = pt; m.color.set('#ffffff'); }
  else m.color.set(z.c);
  m.roughness = Math.min(1, M.rough / .88); m.metalness = M.metal ?? 0; m.clearcoat = M.cc ?? 0; m.clearcoatRoughness = .25;
  if (M.sheen) { m.sheen = M.sheen; m.sheenRoughness = M.sr ?? .5; m.sheenColor.set(z.c).lerp(new THREE.Color('#ffffff'), .35); }
  if (z.f === 'matte') { m.roughness = Math.min(1, m.roughness + .25); m.clearcoat *= .3; }
  if (z.f === 'gloss') { m.normalScale.multiplyScalar(.45); m.roughness *= .6; m.clearcoat = Math.max(m.clearcoat, .4); m.clearcoatRoughness = .2; }   /* polished, never plastic */
  if (z.f === 'metallic') { m.metalness = .75; m.roughness = Math.min(m.roughness, .32); }
  return m;
}

/* ---------- original artwork for prints (drawn in code, no third-party marks) ---------- */
export const ARTS: [string, string][] = [['none', 'No artwork'], ['star', 'Abidora star'], ['wave', 'Wave'], ['sun', 'Sunburst'], ['leaf', 'Leaf'], ['mono', 'A monogram'], ['grid', 'Grid'], ['upload', 'Your image']];
export function drawPrint(cv: HTMLCanvasElement, p: PrintState, imgs: Map<string, HTMLImageElement>, bg?: string) {
  const g = cv.getContext('2d')!, W = cv.width, H = cv.height; g.clearRect(0, 0, W, H);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, W, H); }
  if (!p.on) return;
  g.fillStyle = p.ink; g.strokeStyle = p.ink; const cx = W / 2, hasText = !!p.text.trim(), cy = hasText && p.art !== 'none' ? H * .4 : H / 2, R = Math.min(W, H) * (hasText && p.art !== 'none' ? .3 : .4);
  g.save(); g.translate(cx, cy); g.lineWidth = R * .08; g.lineJoin = 'round'; g.lineCap = 'round';
  if (p.art === 'star') { g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 - Math.PI / 2, q = i % 2 ? R * .42 : R; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); g.fill(); }
  else if (p.art === 'wave') { for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = -R; x <= R; x += 2) g.lineTo(x, Math.sin(x / R * Math.PI * 1.5) * R * .22 + (k - 1) * R * .34); g.stroke(); } }
  else if (p.art === 'sun') { g.beginPath(); g.arc(0, 0, R * .42, 0, 7); g.fill(); for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * R * .55, Math.sin(a) * R * .55); g.lineTo(Math.cos(a) * R, Math.sin(a) * R); g.stroke(); } }
  else if (p.art === 'leaf') { g.beginPath(); g.moveTo(0, R); g.bezierCurveTo(R * .9, R * .2, R * .6, -R * .8, 0, -R); g.bezierCurveTo(-R * .6, -R * .8, -R * .9, R * .2, 0, R); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = R * .04; g.beginPath(); g.moveTo(0, R); g.lineTo(0, -R * .8); g.stroke(); }
  else if (p.art === 'mono') { g.font = `700 ${R * 1.9}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A', 0, R * .08); g.lineWidth = R * .05; g.beginPath(); g.arc(0, 0, R * 1.02, 0, 7); g.stroke(); }
  else if (p.art === 'grid') { const n = 4, s = R * 2 / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) g.fillRect(-R + i * s, -R + j * s, s * .92, s * .92); }
  else if (p.art === 'upload' && p.img) { const im = imgs.get(p.img); if (im && im.complete && im.naturalWidth) { const k = Math.min(R * 2 / im.naturalWidth, R * 2 / im.naturalHeight); g.drawImage(im, -im.naturalWidth * k / 2, -im.naturalHeight * k / 2, im.naturalWidth * k, im.naturalHeight * k); } }
  g.restore();
  if (hasText) { const txt = p.text.trim().slice(0, 24); let fs = H * (p.art === 'none' ? .42 : .2); g.font = `700 ${fs}px "Helvetica Neue", Arial, sans-serif`;
    while (g.measureText(txt).width > W * .92 && fs > 8) { fs -= 2; g.font = `700 ${fs}px "Helvetica Neue", Arial, sans-serif`; }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, W / 2, p.art === 'none' ? H / 2 : H * .84); }
}

/* ---------- model loading (cached; meshopt-compressed GLB) ---------- */
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glbCache = new Map<string, Promise<GLTF>>();
function loadGLB(url: string) { if (!glbCache.has(url)) glbCache.set(url, loader.loadAsync(url)); return glbCache.get(url)!; }
const zoneOf = (m: THREE.Material) => (m.name || '').replace(/^zone_/, '').replace(/\.\d+$/, '');

/* a second, small renderer draws the library previews from the same 3D models */
let thumbR: { r: THREE.WebGLRenderer; scene: THREE.Scene; cam: THREE.PerspectiveCamera; cv: HTMLCanvasElement } | null = null;
function thumbRenderer(bg: string) {
  if (thumbR) { (thumbR.scene.background as THREE.Color).set(bg); return thumbR; }
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true }); r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.05; r.setPixelRatio(1);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; pm.dispose();
  const k = new THREE.DirectionalLight(0xffffff, 1.8); k.position.set(1, 2, 1.5); scene.add(k);
  const cam = new THREE.PerspectiveCamera(26, 4 / 3, .01, 50);
  thumbR = { r, scene, cam, cv }; return thumbR;
}

export function studio(ctx: Ctx, root: string, C: StudioConfig) {
  const t = ctx.t;
  const S: Show = show3d(ctx, { bg: C.bg, acc: C.acc, hint: C.hint, tabs: true });
  S.stage.classList.add('fx-stage');
  injectCSS();
  floor(S, 0, 6, C.acc);
  const lod: 'hi' | 'lo' = S.phone ? 'lo' : 'hi';
  const imgs = new Map<string, HTMLImageElement>();
  const fav = store<string[]>(ctx.id, 'fx.fav', [], Array.isArray);
  const mine = store<{ id: string; name: string; state: DesignState; thumb: string; at: number }[]>(ctx.id, 'fx.mine', [], Array.isArray);
  const draft = store<DesignState | null>(ctx.id, 'fx.draft', null);
  let current = C.designs[0];
  let st: DesignState = structuredClone(draft.get() ?? current.state);
  let original: DesignState = structuredClone(current.state);
  let showingBefore = false;
  const hist: string[] = [JSON.stringify(st)]; let hi = 0;
  let model: THREE.Object3D | null = null, modelKey = '';
  const zoneMats = new Map<string, THREE.MeshPhysicalMaterial>();
  const printCv = new Map<string, { cv: HTMLCanvasElement; tex: THREE.CanvasTexture }>();
  let selZone = C.base[0]; let flash = 0;

  /* ---------- toolbar on the stage ---------- */
  const bar = h('div', { class: 'fx-bar', role: 'toolbar', 'aria-label': t('fx.tools', 'Design tools') });
  const bUndo = btn(t('fx.undo', 'Undo'), '↶', () => stepHist(-1)), bRedo = btn(t('fx.redo', 'Redo'), '↷', () => stepHist(1));
  const bReset = btn(t('fx.reset', 'Reset to the original design'), '⟲', () => { setState(structuredClone(original), true); });
  const bBA = h('button', { type: 'button', class: 'fx-b fx-ba', text: t('fx.before', 'Before / after'), 'aria-pressed': 'false' });
  bBA.onclick = () => { showingBefore = !showingBefore; bBA.setAttribute('aria-pressed', String(showingBefore)); baTag.hidden = !showingBefore; void apply(showingBefore ? original : st); };
  bar.append(bUndo, bRedo, bReset, bBA);
  const baTag = h('div', { class: 'fx-tag', text: t('fx.beforeTag', 'Before: the original design'), hidden: true });
  const nameTag = h('div', { class: 'fx-name' });
  S.stage.append(bar, baTag, nameTag);
  function btn(label: string, icon: string, fn: () => void) { const b = h('button', { type: 'button', class: 'fx-b', 'aria-label': label, title: label, text: icon }); b.onclick = fn; return b; }

  /* ---------- rail ---------- */
  const gPart = S.group(t('fx.parts', 'Parts'));
  const gShape = S.group(t('fx.shape', 'Shape & size'));
  const gLogo = S.group(t('fx.logo', C.prints.length > 1 ? 'Graphics' : 'Logo'));
  const gView = S.group(t('view', 'View'));
  const gLight = S.group(t('light', 'Light'));
  const gSave = S.group(t('fx.save', 'Save & export'));

  /* parts: pick a part, then its colour, material, finish and pattern */
  const partRow = h('div', { class: 's3-row' }); gPart.append(partRow);
  const baseRow = h('div', { class: 'fx-sub' });
  const zc = h('div', { class: 'fx-sub' }), zm = h('div', { class: 'fx-sub' }), zf = h('div', { class: 'fx-sub' }), zp = h('div', { class: 'fx-sub' });
  gPart.append(baseRow, zc, zm, zf, zp);
  const PAL: [string, string][] = [['#f4f2ee', 'Chalk'], ['#d9cfbf', 'Bone'], ['#c9a46b', 'Sand'], ['#8a5a34', 'Tan'], ['#4a2c1c', 'Chocolate'], ['#1c1c1e', 'Black'], ['#55585e', 'Graphite'],
    ['#9aa3ad', 'Fog'], ['#24324a', 'Navy'], ['#2f5f8f', 'Cobalt'], ['#7fb3d5', 'Sky'], ['#3f5e3a', 'Forest'], ['#8b9a5b', 'Olive'], ['#c43b2f', 'Red'], ['#7a1f2b', 'Burgundy'],
    ['#e07a3f', 'Orange'], ['#e8c14a', 'Mustard'], ['#d8a7b1', 'Rose'], ['#6b4f8a', 'Plum'], ['#e9e2c8', 'Cream']];
  function swRow(p: HTMLElement, value: string, on: (v: string) => void, label: string) {
    p.replaceChildren(h('div', { class: 'l' }, h('span', { text: label }), h('b', { text: '' })));
    const row = h('div', { class: 's3-row' }); p.append(row);
    const set = (v: string) => { row.querySelectorAll('.s3-sw').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.v === v.toLowerCase()))); const hit = PAL.find(([c]) => c === v.toLowerCase()); (p.querySelector('.l b') as HTMLElement).textContent = hit ? t('c.' + hit[1].toLowerCase(), hit[1]) : v; };
    for (const [c, n] of PAL) { const b = h('button', { type: 'button', class: 's3-sw', title: t('c.' + n.toLowerCase(), n), 'aria-label': t('c.' + n.toLowerCase(), n) }); b.dataset.v = c; b.style.background = c; b.onclick = () => { set(c); on(c); commit(); }; row.append(b); }
    const pick = h('input', { type: 'color', value: value, class: 'fx-pick', 'aria-label': t('fx.any', 'Any colour') }) as HTMLInputElement;
    pick.oninput = () => { set(pick.value); on(pick.value); }; pick.onchange = () => commit(); row.append(pick);
    set(value); return { set: (v: string) => { set(v); pick.value = v; } };
  }
  function chipRow(p: HTMLElement, label: string, items: [string, string][], value: string, on: (v: string) => void) {
    p.replaceChildren(h('div', { class: 'l' }, h('span', { text: label }), h('b')));
    S.chips(p, items, value, (v) => { on(v); commit(); });
  }
  function renderParts() {
    const zones = Object.keys(st.zones).filter((z) => C.zones[z] && modelZones.has(z));
    partRow.replaceChildren(...zones.map((z) => { const b = h('button', { type: 'button', class: 's3-chip fx-zone', text: t('z.' + z, C.zones[z].label), 'aria-pressed': String(z === selZone) });
      const dot = h('i', { class: 'fx-dot' }); dot.style.background = st.zones[z].c; b.prepend(dot); b.onclick = () => { selZone = z; flash = 1; renderParts(); }; return b; }));
    swRow(baseRow, st.zones[C.base[0]]?.c ?? '#888888', (v) => { for (const z of C.base) if (st.zones[z]) st.zones[z].c = v; liveZones(C.base); }, t('fx.base', 'Base colour (all main parts)'));
    const Z = st.zones[selZone]; if (!Z) return;
    const D = C.zones[selZone];
    swRow(zc, Z.c, (v) => { Z.c = v; liveZones([selZone]); }, t('fx.colourOf', 'Colour of') + ' ' + t('z.' + selZone, D.label).toLowerCase());
    chipRow(zm, t('fx.material', 'Material'), D.mats.map((m) => [m, t('m.' + m, MATS[m].label)]), Z.m, (v) => { Z.m = v as MatKey; liveZones([selZone]); });
    chipRow(zf, t('fx.finish', 'Finish'), [['matte', t('f.matte', 'Matte')], ['satin', t('f.satin', 'Satin')], ['gloss', t('f.gloss', 'Gloss')], ['metallic', t('f.metal', 'Metallic')]], Z.f, (v) => { Z.f = v as Finish; liveZones([selZone]); });
    if (D.patterns) {
      chipRow(zp, t('fx.pattern', 'Pattern'), PATTERNS.map(([k, l]) => [k, t('p.' + k, l)]), Z.p, (v) => { Z.p = v as Pattern; liveZones([selZone]); });
      const pcBox = h('div', { class: 'fx-sub', style: { padding: '8px 0 0' } }); zp.append(pcBox);
      swRow(pcBox, Z.pc, (v) => { Z.pc = v; liveZones([selZone]); }, t('fx.pcolour', 'Pattern colour'));
      pcBox.hidden = Z.p === 'solid';
    } else zp.replaceChildren();
  }
  /* shape variants and size */
  const shapeBox = h('div'), sizeBox = h('div', { class: 'fx-sub' }), sizeNote = h('p', { class: 's3-note' }); gShape.append(shapeBox, sizeBox, sizeNote);
  function renderShape() {
    const M = C.models[st.model];
    shapeBox.replaceChildren();
    if (Object.keys(C.models).length > 1) { const tb = h('div', { class: 'fx-sub' }); shapeBox.append(tb);
      chipRow(tb, t('fx.type', 'Type'), Object.entries(C.models).map(([k, m]) => [k, t('m.' + k, m.name)] as [string, string]), st.model, (k) => {
        if (k === st.model) return; const ref = C.designs.find((d) => d.state.model === k)?.state;
        st.model = k; st.variant = C.models[k].variants[0][0];
        for (const z of Object.keys(C.zones)) if (!st.zones[z] && ref?.zones[z]) st.zones[z] = structuredClone(ref.zones[z]);
        if (ref) for (const [id] of C.shows) if (st.show[id] === undefined && ref.show[id] !== undefined) st.show[id] = ref.show[id];
        commit(); refreshAll(); }); }
    shapeBox.append(h('div', { class: 'l' }, h('span', { text: M.name }), h('b')));
    S.chips(shapeBox, M.variants.map(([k, l]) => [k, t('v.' + k, l)]), st.variant, (v) => { st.variant = v; commit(); void apply(st); });
    shapeBox.append(h('p', { class: 's3-note', text: t('fx.mnote.' + st.model, M.note), style: { marginTop: '8px' } }));
    chipRow(sizeBox, t('size', 'Size'), C.sizes, st.size, (v) => { st.size = v; placeModel(); sizeNote.textContent = C.sizeNote(v); });
    sizeNote.textContent = C.sizeNote(st.size);
  }
  /* logos, graphics and prints */
  function renderLogo() {
    gLogo.replaceChildren(h('div', { class: 'l' }, h('span', { text: C.prints.length > 1 ? t('fx.logo2', 'Graphics') : t('fx.logo', 'Logo') }), h('b')));
    for (const [id, label] of C.shows) {
      const b = h('button', { type: 'button', class: 's3-chip', text: t('sh.' + id, label), 'aria-pressed': String(st.show[id] !== false) });
      b.onclick = () => { st.show[id] = st.show[id] === false; b.setAttribute('aria-pressed', String(st.show[id] !== false)); liveShows(); commit(); };
      gLogo.append(b); b.style.margin = '0 6px 6px 0';
    }
    for (const [node, label] of C.prints) {
      const P = st.prints[node] ??= { on: false, text: '', art: 'none', ink: '#1c1c1e' };
      const box = h('div', { class: 'fx-print' });
      const on = h('button', { type: 'button', class: 's3-chip', text: t('pr.' + node, label), 'aria-pressed': String(P.on) });
      on.onclick = () => { P.on = !P.on; on.setAttribute('aria-pressed', String(P.on)); body.hidden = !P.on; livePrints(); commit(); };
      const body = h('div', { hidden: !P.on });
      const txt = h('input', { type: 'text', class: 'fx-in', maxlength: '24', value: P.text, placeholder: t('fx.text', 'Text or initials'), 'aria-label': t('fx.text', 'Text or initials') }) as HTMLInputElement;
      txt.oninput = () => { P.text = txt.value; livePrints(); }; txt.onchange = () => commit();
      const art = h('select', { class: 'fx-in', 'aria-label': t('fx.art', 'Artwork') }) as HTMLSelectElement;
      for (const [k, l] of ARTS) art.append(h('option', { value: k, text: t('art.' + k, l), selected: k === P.art }));
      const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', hidden: true }) as HTMLInputElement;
      art.onchange = () => { if (art.value === 'upload') file.click(); else { P.art = art.value; livePrints(); commit(); } };
      file.onchange = () => { const f = file.files?.[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { shrink(String(rd.result), (d) => { P.img = d; P.art = 'upload'; livePrints(); commit(); }); }; rd.readAsDataURL(f); };
      const ink = h('div', { class: 'fx-sub' }); swRow(ink, P.ink, (v) => { P.ink = v; livePrints(); }, t('fx.ink', 'Print colour'));
      body.append(txt, art, file, ink, h('p', { class: 's3-note', text: t('fx.upnote', 'Your own image stays in this browser. It is not uploaded anywhere.') }));
      box.append(on, body); gLogo.append(box);
    }
  }
  function shrink(src: string, done: (d: string) => void) { const im = new Image(); im.onload = () => { const k = Math.min(1, 512 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); done(c.toDataURL('image/png')); }; im.src = src; }
  /* view + light */
  S.chips(gView, C.views.map(([k, l]) => [k, t('vw.' + k, l)]), C.views[0][0], (v) => S.go(v));
  const wearBox = h('div', { class: 'fx-sub' }); gView.append(wearBox);
  function renderWear() { wearBox.replaceChildren(); chipRow(wearBox, t('fx.cond', 'Condition'), [['0', t('fx.new', 'New')], ['0.45', t('fx.worn', 'Worn')], ['1', t('fx.aged', 'Well worn')]], String(st.wear ?? 0), (v) => { st.wear = +v; WEAR.value = st.wear; commit(); }); }
  renderWear();
  const LIGHT: Record<string, [number, number, number, string]> = { studio: [1.1, 1, 2.2, C.bg], daylight: [1.15, 1.25, 2.8, '#d8d4cc'], evening: [.95, .45, 2.4, '#140f0c'] };
  S.chips(gLight, [['studio', t('l.studio', 'Studio')], ['daylight', t('l.day', 'Daylight')], ['evening', t('l.eve', 'Evening')]], 'studio', (n) => { const [e, env, k, bg] = LIGHT[n]; S.renderer.toneMappingExposure = e; S.scene.environmentIntensity = env; S.key.intensity = k; (S.scene.background as THREE.Color).set(bg); });
  /* save + export */
  const nameIn = h('input', { type: 'text', class: 'fx-in', maxlength: '40', 'aria-label': t('fx.name', 'Design name') }) as HTMLInputElement;
  const msg = h('p', { class: 's3-note', 'aria-live': 'polite' });
  const acts: [string, () => void][] = [
    [t('fx.saveb', 'Save to My designs'), () => { const list = mine.get(); const d = { id: 'm' + Date.now().toString(36), name: nameIn.value.trim() || current.name, state: structuredClone(st), thumb: snap(320), at: Date.now() };
      list.unshift(d); while (list.length > 30) list.pop(); msg.textContent = mine.set(list) ? t('fx.saved', 'Saved. Find it under My designs in the library below.') : t('fx.full', 'This browser is out of storage. Delete an older design first.'); lib.refresh(); }],
    [t('fx.png', 'Download image (PNG)'), () => { const c = document.createElement('canvas'); const d = snap(1600, true); const im = new Image(); im.onload = () => { c.width = im.width; c.height = im.height; c.getContext('2d')!.drawImage(im, 0, 0); download(c, `abidora-${C.key}-${slug()}.png`); }; im.src = d; }],
    [t('fx.spec', 'Download spec sheet (JSON)'), () => download(new Blob([JSON.stringify({ design: nameIn.value || current.name, model: C.models[st.model].name, variant: st.variant, size: st.size, parts: Object.fromEntries(Object.entries(st.zones).filter(([z]) => modelZones.has(z)).map(([z, v]) => [C.zones[z]?.label ?? z, { colour: v.c, material: MATS[v.m].label, finish: v.f, pattern: v.p, patternColour: v.p !== 'solid' ? v.pc : undefined }])), logo: st.show, prints: Object.fromEntries(Object.entries(st.prints).map(([k, p]) => [k, { ...p, img: p.img ? '(your image)' : undefined }])), made: new Date().toISOString(), by: 'Abidora studio' }, null, 2)], { type: 'application/json' }), `abidora-${C.key}-${slug()}.json`)],
    [t('fx.glb', 'Download 3D model (GLB)'), () => { if (!model) return; msg.textContent = t('fx.glbing', 'Preparing the 3D file…'); const undo = exportable(model); new GLTFExporter().parse(model, (r) => { undo(); download(new Blob([r as ArrayBuffer], { type: 'model/gltf-binary' }), `abidora-${C.key}-${slug()}.glb`); msg.textContent = t('fx.glbok', 'Your 3D model is downloading. It opens in Blender and most 3D viewers.'); }, (e) => { undo(); console.error('fx glb', e); msg.textContent = t('fx.glbfail', 'The 3D file could not be made in this browser.'); }, { binary: true }); }],
  ];
  gSave.append(nameIn, ...acts.map(([l, f]) => { const b = h('button', { type: 'button', class: 's3-chip fx-act', text: l }); b.onclick = f; return b; }), msg);
  const slug = () => (nameIn.value || current.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  S.rail.append(h('p', { class: 's3-note', text: C.credit }));

  /* ---------- applying a design to the 3D model ---------- */
  let modelZones = new Set<string>();
  let loadTok = 0;
  async function apply(s: DesignState) {
    const key = s.model + '/' + s.variant;
    if (key !== modelKey) {
      const tok = ++loadTok; S.setLoading(t('fx.loading', 'Loading the 3D model…'));
      let g: GLTF; try { g = await loadGLB(root + C.models[s.model].file(s.variant, lod)); } catch { S.setLoading(t('s3.fail', 'The 3D model could not load. Please refresh the page.')); return; }
      if (tok !== loadTok) return;
      if (model) S.scene.remove(model);
      model = g.scene.clone(true); modelKey = key; zoneMats.clear(); printCv.clear(); modelZones = new Set();
      model.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true; const z = zoneOf(m.material as THREE.Material); m.userData.zone = z; modelZones.add(z); });
      S.scene.add(model); placeModel(true); S.setLoading(null); renderParts();
    }
    WEAR.value = s.wear ?? 0;
    for (const z of modelZones) setZone(z, s);
    liveShows(s); livePrints(s);
  }
  function setZone(z: string, s: DesignState) {
    const Z = s.zones[z]; if (!Z || !model) return;
    let vc = false; model.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && me.userData.zone === z && me.geometry.attributes.color) vc = true; });
    const m = makeMaterial(Z, vc); const old = zoneMats.get(z); zoneMats.set(z, m);
    model.traverse((o) => { const me = o as THREE.Mesh; if (me.isMesh && me.userData.zone === z && !me.userData.print) me.material = m; });
    old?.dispose();
  }
  function liveZones(zs: string[]) { if (showingBefore) { showingBefore = false; bBA.setAttribute('aria-pressed', 'false'); baTag.hidden = true; void apply(st); return; } for (const z of zs) setZone(z, st); if (C.prints.some(([, , , op]) => op && zs.includes(op))) livePrints(); updateDots(); saveDraft(); }
  function updateDots() { partRow.querySelectorAll('.fx-zone').forEach((b, i) => { const z = Object.keys(st.zones).filter((k) => C.zones[k] && modelZones.has(k))[i]; const d = b.querySelector('.fx-dot') as HTMLElement | null; if (d && st.zones[z]) d.style.background = st.zones[z].c; }); }
  function liveShows(s: DesignState = st) { if (!model) return; for (const [id, , prefixes] of C.shows) { const on = s.show[id] !== false; model.traverse((o) => { if (prefixes.some((p) => o.name.startsWith(p))) o.visible = on; }); } }
  function livePrints(s: DesignState = st) {
    if (!model) return;
    for (const [node, , aspect, opaque] of C.prints) {
      const P = s.prints[node]; let obj: THREE.Mesh | null = null;
      model.traverse((o) => { if (!obj && o.name.startsWith(node) && (o as THREE.Mesh).isMesh) obj = o as THREE.Mesh; });
      if (!obj) continue; const me = obj as THREE.Mesh;
      let pc = printCv.get(node);
      if (!pc) { const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 / aspect); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; pc = { cv, tex }; printCv.set(node, pc);
        me.userData.print = true; me.material = opaque ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: .7, sheen: .4, sheenRoughness: .6 }) : new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, roughness: .6, sheen: .3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); }
      if (P?.img && !imgs.has(P.img)) { const im = new Image(); im.onload = () => livePrints(); im.src = P.img; imgs.set(P.img, im); }
      drawPrint(pc.cv, P ?? { on: false, text: '', art: 'none', ink: '#000' }, imgs, opaque ? s.zones[opaque]?.c : undefined); pc.tex.needsUpdate = true; me.visible = opaque ? true : !!P?.on;
    }
    saveDraft();
  }
  let box = new THREE.Box3();
  function placeModel(reframe = false) {
    if (!model) return; model.scale.setScalar(C.sizeScale(st.size)); model.position.set(0, 0, 0); model.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(model); const c = box.getCenter(new THREE.Vector3()); model.position.x -= c.x; model.position.z -= c.z; model.position.y -= box.min.y; model.updateMatrixWorld(true);
    box.setFromObject(model);
    if (reframe) { const sz = box.getSize(new THREE.Vector3()), d = Math.max(sz.x, sz.y, sz.z), dv = d * (C.dist ?? 2.1);
      S.key.target = model; const sc = S.key.shadow.camera; sc.left = sc.bottom = -d; sc.right = sc.top = d; sc.far = d * 10; sc.updateProjectionMatrix(); S.key.position.set(d * 1.2, d * 2.4, d * 1.6);
      S.frame(new THREE.Vector3(0, sz.y * (C.lift ?? .45), 0), C.views.map(([k, , v]) => ({ name: k, pos: [v[0] * dv, v[1] * dv, v[2] * dv] as [number, number, number] }))); }
  }
  S.onTick((dt) => { if (flash > 0) { flash = Math.max(0, flash - dt * 1.4); const m = zoneMats.get(selZone); if (m) { m.emissive.set(C.acc); m.emissiveIntensity = Math.sin(flash * Math.PI) * .35; } } });

  /* ---------- history, state, snapshots ---------- */
  function commit() { const j = JSON.stringify(st); if (j === hist[hi]) return; hist.splice(hi + 1); hist.push(j); if (hist.length > 80) hist.shift(); hi = hist.length - 1; syncBar(); saveDraft(); }
  function stepHist(d: number) { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; st = JSON.parse(hist[hi]); refreshAll(); syncBar(); }
  function syncBar() { bUndo.disabled = hi <= 0; bRedo.disabled = hi >= hist.length - 1; }
  function setState(s: DesignState, record: boolean) { st = s; if (record) commit(); refreshAll(); }
  function refreshAll() { showingBefore = false; bBA.setAttribute('aria-pressed', 'false'); baTag.hidden = true; if (!st.zones[selZone]) selZone = C.base[0]; renderShape(); renderLogo(); renderWear(); void apply(st).then(() => { renderParts(); placeModel(); }); saveDraft(); }
  let dt0 = 0; function saveDraft() { clearTimeout(dt0); dt0 = window.setTimeout(() => draft.set(st), 400); }
  function snap(w: number, hiQ = false) { const cv = S.renderer.domElement; S.renderer.render(S.scene, S.camera); if (!hiQ && cv.width > w) { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(cv.height * w / cv.width); c.getContext('2d')!.drawImage(cv, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .82); } return cv.toDataURL('image/png'); }
  function openDesign(d: Design | { name: string; state: DesignState }, scroll = true) {
    current = 'id' in d && 'cat' in d ? d as Design : { ...C.designs[0], name: d.name, state: d.state };
    original = structuredClone(d.state); nameTag.textContent = d.name; nameIn.value = d.name;
    hist.splice(0); hist.push(JSON.stringify(d.state)); hi = 0; syncBar();
    setState(structuredClone(d.state), false);
    if (scroll) S.stage.scrollIntoView({ behavior: ctx.calm ? 'auto' : 'smooth', block: 'start' });
  }

  /* ---------- library previews ---------- */
  const thumbMem = new Map<string, string>();
  const queue: { s: DesignState; key: string; done: (u: string) => void }[] = []; let busy = false;
  function thumb(s: DesignState, key: string, done: (u: string) => void) {
    const k = 'abidora.fx.thumb.v2.' + C.key + '.' + key;
    const mem = thumbMem.get(k); if (mem) { done(mem); return; }
    try { const v = sessionStorage.getItem(k); if (v) { thumbMem.set(k, v); done(v); return; } } catch { /* */ }
    queue.push({ s, key: k, done }); pump();
  }
  async function pump() {
    if (busy) return; const job = queue.shift(); if (!job) return; busy = true;
    try {
      const TR = thumbRenderer(C.bg);
      const g = await loadGLB(root + C.models[job.s.model].file(job.s.variant, 'lo'));
      const o = g.scene.clone(true); const made: THREE.Material[] = [];
      const ms = new Map<string, THREE.Material>();
      o.traverse((x) => { const me = x as THREE.Mesh; if (!me.isMesh) return; const z = zoneOf(me.material as THREE.Material);
        for (const [id, , pre] of C.shows) if (pre.some((p) => x.name.startsWith(p))) x.visible = job.s.show[id] !== false;
        if (C.prints.some(([n, , , op]) => !op && x.name.startsWith(n))) { x.visible = false; return; }
        const Z = job.s.zones[z]; if (!Z) return; if (!ms.has(z)) { const m = makeMaterial(Z, !!me.geometry.attributes.color); made.push(m); ms.set(z, m); } me.material = ms.get(z)!; });
      TR.scene.add(o); const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3()), sz = b.getSize(new THREE.Vector3()), d = Math.max(sz.x, sz.y, sz.z);
      const v = new THREE.Vector3(...C.thumbView).normalize().multiplyScalar(d * 2.25); TR.cam.position.copy(c).add(v); TR.cam.lookAt(c.x, c.y - sz.y * .04, c.z);
      const w0 = WEAR.value; WEAR.value = job.s.wear ?? 0; TR.r.render(TR.scene, TR.cam); WEAR.value = w0; const url = TR.cv.toDataURL('image/webp', .86);
      TR.scene.remove(o); made.forEach((m) => m.dispose());
      thumbMem.set(job.key, url); try { sessionStorage.setItem(job.key, url); } catch { /* */ } job.done(url);
    } catch (e) { console.warn('fx thumb', e); job.done(''); }
    busy = false; setTimeout(pump, 30);
  }

  /* ---------- the design library ---------- */
  const lib = library(ctx, C, { thumb, open: openDesign, fav, mine, snapCurrent: () => ({ name: nameIn.value || current.name, state: structuredClone(st) }) });
  ctx.root.append(lib.el);

  /* start: the visitor's last draft, or the first design */
  nameTag.textContent = current.name; nameIn.value = current.name;
  if (draft.get()) { nameTag.textContent = t('fx.draft', 'Your last design'); }
  syncBar(); renderShape(); renderLogo(); void apply(st).then(() => { renderParts(); });
  return { S, open: openDesign };
}

/* ---------- library UI: categories, search, sort, favourites, my designs, compare ---------- */
function library(ctx: Ctx, C: StudioConfig, o: {
  thumb: (s: DesignState, key: string, done: (u: string) => void) => void; open: (d: Design | { name: string; state: DesignState }, scroll?: boolean) => void;
  fav: { get(): string[]; set(v: string[]): boolean }; mine: { get(): { id: string; name: string; state: DesignState; thumb: string; at: number }[]; set(v: { id: string; name: string; state: DesignState; thumb: string; at: number }[]): boolean };
  snapCurrent: () => { name: string; state: DesignState };
}) {
  const t = ctx.t;
  let cat = 'all', q = '', sort = 'featured'; const cmp: string[] = [];
  const el = h('section', { class: 'fx-lib', 'aria-label': t('fx.library', 'Design library') });
  const head = h('div', { class: 'fx-head' }, h('h2', { class: 'fx-h', text: t('fx.libh', 'Design library') }), h('p', { class: 'fx-lead', text: t('fx.libp', 'Every design opens in the 3D studio above, where each part can be changed.') }));
  const nav = h('div', { class: 'fx-nav', role: 'tablist', 'aria-label': t('fx.cats', 'Categories') });
  const search = h('input', { type: 'search', class: 'fx-in fx-search', placeholder: t('fx.search', 'Search designs, materials, colours'), 'aria-label': t('fx.search', 'Search designs') }) as HTMLInputElement;
  const sortSel = h('select', { class: 'fx-in fx-sort', 'aria-label': t('fx.sort', 'Sort') }) as HTMLSelectElement;
  for (const [k, l] of [['featured', t('fx.s.feat', 'Featured')], ['name', t('fx.s.name', 'Name A–Z')], ['model', t('fx.s.model', 'By model')], ['colour', t('fx.s.col', 'By colour')]]) sortSel.append(h('option', { value: k, text: l }));
  const count = h('span', { class: 'fx-count', 'aria-live': 'polite' });
  const tools = h('div', { class: 'fx-tools' }, search, sortSel, count);
  const grid = h('div', { class: 'fx-grid' });
  const tray = h('div', { class: 'fx-tray', hidden: true });
  const cmpBox = h('div', { class: 'fx-cmp', hidden: true });
  el.append(head, nav, tools, grid, tray, cmpBox);
  const cats: [string, string][] = [['all', t('fx.all', 'All')], ...C.categories.map(([k, l]) => [k, t('cat.' + k, l)] as [string, string]), ['fav', '♥ ' + t('fx.favs', 'Favourites')], ['mine', t('fx.mine', 'My designs')]];
  for (const [k, l] of cats) { const b = h('button', { type: 'button', role: 'tab', class: 'fx-cat', text: l, 'aria-selected': String(k === cat) }); b.dataset.k = k; b.onclick = () => { cat = k; nav.querySelectorAll('.fx-cat').forEach((x) => x.setAttribute('aria-selected', String((x as HTMLElement).dataset.k === k))); render(); }; nav.append(b); }
  search.oninput = () => { q = search.value.trim().toLowerCase(); render(); };
  sortSel.onchange = () => { sort = sortSel.value; render(); };
  const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { const f = (e.target as HTMLElement & { _load?: () => void })._load; if (f) { f(); delete (e.target as HTMLElement & { _load?: () => void })._load; } io.unobserve(e.target); } }, { rootMargin: '300px' });
  ctx.onDispose(() => io.disconnect());
  const hue = (c: string) => { const x = new THREE.Color(c), hs = { h: 0, s: 0, l: 0 }; x.getHSL(hs); return hs.s < .12 ? 2 + hs.l : hs.h; };
  function card(d: Design | null, m: { id: string; name: string; state: DesignState; thumb: string } | null) {
    const name = d ? t('d.' + d.id, d.name) : m!.name, s = d ? d.state : m!.state, id = d ? d.id : m!.id;
    const img = h('img', { alt: name, loading: 'lazy', class: 'fx-img' }) as HTMLImageElement;
    const fig = h('button', { type: 'button', class: 'fx-fig', 'aria-label': t('fx.open', 'Open in the 3D studio') + ': ' + name }, img);
    fig.onclick = () => o.open(d ?? { name, state: s });
    const isFav = o.fav.get().includes(id);
    const fv = h('button', { type: 'button', class: 'fx-fav', 'aria-pressed': String(isFav), 'aria-label': t('fx.fav', 'Save to favourites'), text: isFav ? '♥' : '♡' });
    fv.onclick = () => { const f = o.fav.get(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); o.fav.set(f); const on = i < 0; fv.setAttribute('aria-pressed', String(on)); fv.textContent = on ? '♥' : '♡'; if (cat === 'fav') render(); };
    const cb = h('label', { class: 'fx-cb' }, h('input', { type: 'checkbox', checked: cmp.includes(id) }), h('span', { text: t('fx.cmp', 'Compare') }));
    (cb.firstChild as HTMLInputElement).onchange = (e) => { const on = (e.target as HTMLInputElement).checked; const i = cmp.indexOf(id); if (on && i < 0) { if (cmp.length >= 3) { (e.target as HTMLInputElement).checked = false; return; } cmp.push(id); } if (!on && i >= 0) cmp.splice(i, 1); renderTray(); };
    const M = C.models[s.model]; const vlabel = M.variants.find(([k]) => k === s.variant)?.[1] ?? '';
    const edit = h('button', { type: 'button', class: 'fx-edit', text: t('fx.edit', 'Edit in 3D') }); edit.onclick = () => o.open(d ?? { name, state: s });
    const extra: HTMLElement[] = [];
    if (m) { const del = h('button', { type: 'button', class: 'fx-del', text: t('fx.del', 'Delete') }); del.onclick = () => { o.mine.set(o.mine.get().filter((x) => x.id !== id)); render(); }; extra.push(del); }
    const c = h('article', { class: 'fx-card' }, fig, fv,
      h('div', { class: 'fx-meta' }, h('h3', { text: name }), h('p', { class: 'fx-sub2', text: `${t('mdl.' + s.model, M.name)} · ${t('v.' + s.variant, vlabel)}` }),
        d ? h('p', { class: 'fx-note', text: t('dn.' + d.id, d.note) }) : null,
        h('div', { class: 'fx-sw' }, ...Object.values(s.zones).slice(0, 6).map((z) => { const i = h('i'); i.style.background = z.c; i.title = MATS[z.m].label; return i; })),
        h('div', { class: 'fx-row' }, edit, cb, ...extra)));
    if (m && m.thumb) img.src = m.thumb; else { (c as HTMLElement & { _load?: () => void })._load = () => o.thumb(s, id + ':' + hash(JSON.stringify(s)), (u) => { if (u) img.src = u; else img.alt = name + ' (' + t('fx.nothumb', 'preview unavailable') + ')'; }); io.observe(c); }
    return c;
  }
  function list() {
    if (cat === 'mine') return o.mine.get().map((m) => ({ d: null as Design | null, m }));
    let ds = C.designs.filter((d) => cat === 'all' || (cat === 'fav' ? o.fav.get().includes(d.id) : d.cat.includes(cat)));
    if (q) ds = ds.filter((d) => [d.name, d.note, ...d.tags, ...d.cat, C.models[d.state.model].name, ...Object.values(d.state.zones).map((z) => MATS[z.m].label)].join(' ').toLowerCase().includes(q));
    if (sort === 'name') ds = [...ds].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'model') ds = [...ds].sort((a, b) => (a.state.model + a.state.variant).localeCompare(b.state.model + b.state.variant));
    if (sort === 'colour') ds = [...ds].sort((a, b) => hue(Object.values(a.state.zones)[0].c) - hue(Object.values(b.state.zones)[0].c));
    return ds.map((d) => ({ d, m: null }));
  }
  function render() {
    const L = list(); grid.replaceChildren(...L.map(({ d, m }) => card(d, m)));
    if (!L.length) grid.append(h('p', { class: 'fx-empty', text: cat === 'mine' ? t('fx.nomine', 'No saved designs yet. Change a design in the studio and press Save to My designs.') : cat === 'fav' ? t('fx.nofav', 'No favourites yet. Tap ♡ on any design.') : t('fx.none', 'No design matches. Try another word or category.') }));
    count.textContent = t('fx.n', '{n} designs').replace('{n}', String(L.length));
  }
  function find(id: string) { const d = C.designs.find((x) => x.id === id); if (d) return { name: d.name, state: d.state, d }; const m = o.mine.get().find((x) => x.id === id); return m ? { name: m.name, state: m.state, d: null } : null; }
  function renderTray() {
    tray.hidden = !cmp.length;
    tray.replaceChildren(h('span', { text: t('fx.cmpn', 'Compare: {n} of 3 selected').replace('{n}', String(cmp.length)) }));
    const go = h('button', { type: 'button', class: 'fx-edit', text: t('fx.cmpgo', 'Compare side by side') }); go.disabled = cmp.length < 2; go.onclick = renderCompare;
    const addCur = h('button', { type: 'button', class: 'fx-cat', text: t('fx.cmpcur', '+ Add my current design') }); addCur.onclick = () => { if (cmp.length >= 3) return; const c = o.snapCurrent(); const list = o.mine.get(); const id = 'c' + Date.now().toString(36); list.unshift({ id, name: c.name + ' (' + t('fx.cur', 'current') + ')', state: c.state, thumb: '', at: Date.now() }); o.mine.set(list); cmp.push(id); renderTray(); };
    const clr = h('button', { type: 'button', class: 'fx-cat', text: t('fx.clear', 'Clear') }); clr.onclick = () => { cmp.splice(0); cmpBox.hidden = true; render(); renderTray(); };
    tray.append(go, addCur, clr);
  }
  function renderCompare() {
    const items = cmp.map(find).filter(Boolean) as { name: string; state: DesignState; d: Design | null }[];
    const zones = [...new Set(items.flatMap((i) => Object.keys(i.state.zones)))].filter((z) => C.zones[z]);
    const head = h('tr', {}, h('th', { text: '' }), ...items.map((i) => { const im = h('img', { alt: i.name, class: 'fx-cimg' }) as HTMLImageElement; o.thumb(i.state, (i.d?.id ?? 'x') + ':' + hash(JSON.stringify(i.state)), (u) => { if (u) im.src = u; }); return h('th', {}, im, h('div', { text: i.name })); }));
    const row = (label: string, f: (s: DesignState) => string, sw = false) => { const vals = items.map((i) => f(i.state)); const diff = new Set(vals).size > 1;
      return h('tr', { class: diff ? 'diff' : '' }, h('th', { text: label }), ...vals.map((v) => h('td', {}, sw && v.startsWith('#') ? h('i', { class: 'fx-dot', style: { background: v.split(' ')[0] } }) : null, document.createTextNode(v)))); };
    const rows = [row(t('fx.model', 'Model'), (s) => `${C.models[s.model].name} · ${C.models[s.model].variants.find(([k]) => k === s.variant)?.[1] ?? s.variant}`),
      ...zones.map((z) => row(C.zones[z].label, (s) => s.zones[z] ? `${s.zones[z].c} ${MATS[s.zones[z].m].label}${s.zones[z].p !== 'solid' ? ' · ' + s.zones[z].p : ''}` : '—', true))];
    cmpBox.hidden = false;
    cmpBox.replaceChildren(h('h3', { class: 'fx-h3', text: t('fx.cmph', 'Side-by-side compare') }), h('p', { class: 'fx-lead', text: t('fx.cmpp', 'Rows where the designs differ are highlighted.') }),
      h('div', { class: 'fx-tw' }, h('table', { class: 'fx-table' }, h('thead', {}, head), h('tbody', {}, ...rows))));
    cmpBox.scrollIntoView({ behavior: ctx.calm ? 'auto' : 'smooth', block: 'start' });
  }
  render();
  return { el, refresh: render };
}
function hash(s: string) { let x = 0; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return (x >>> 0).toString(36); }

function injectCSS() {
  if (document.getElementById('fxcss')) return;
  const st = document.createElement('style'); st.id = 'fxcss'; st.textContent = `
.fx-bar{position:absolute;z-index:3;top:14px;left:18px;display:flex;gap:6px;flex-wrap:wrap}
.fx-b{min-width:40px;height:40px;border-radius:999px;border:1px solid rgba(236,230,220,.25);background:rgba(14,13,11,.6);color:#ece6dc;font:500 18px/1 var(--sans,sans-serif);cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:0 12px}
.fx-b:disabled{opacity:.35;cursor:default}.fx-b:not(:disabled):hover,.fx-b:focus-visible{background:var(--acc,#e8b46a);color:#111}
.fx-ba{font-size:12px;font-weight:600}.fx-ba[aria-pressed=true]{background:var(--acc,#e8b46a);color:#111}
.fx-tag{position:absolute;z-index:3;top:62px;left:18px;padding:6px 12px;border-radius:999px;background:var(--acc,#e8b46a);color:#111;font:600 12px var(--sans,sans-serif)}
@media (min-width:861px){.s3.fx-stage{height:min(84vh,760px);min-height:560px;grid-template-rows:minmax(0,1fr)}}
.fx-img:not([src]){visibility:hidden}
.fx-name{position:absolute;z-index:2;left:78px;bottom:44px;font:400 26px/1.1 var(--serif,Georgia,serif);color:#ece6dc;max-width:40%;pointer-events:none;text-shadow:0 1px 12px rgba(0,0,0,.5)}
.fx-stage .s3-hint{bottom:14px}
.fx-sub{padding-top:12px}.fx-sub .l{display:flex;justify-content:space-between;font:500 10px var(--mono,monospace);letter-spacing:.16em;text-transform:uppercase;color:#a49d91;margin-bottom:8px}
.fx-sub .l b{font-weight:500;color:#ece6dc;letter-spacing:.04em;text-transform:none;font-family:var(--sans,sans-serif);font-size:12px}
.fx-zone{display:inline-flex;align-items:center;gap:7px}.fx-dot{display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid rgba(255,255,255,.35);vertical-align:middle;margin-inline-end:6px}
.fx-zone .fx-dot{margin:0}
.fx-pick{width:30px;height:30px;border:0;padding:0;background:none;cursor:pointer;border-radius:50%}
.fx-in{width:100%;box-sizing:border-box;margin:0 0 8px;padding:9px 11px;border-radius:10px;border:1px solid rgba(236,230,220,.2);background:rgba(0,0,0,.25);color:#ece6dc;font:400 13px var(--sans,sans-serif)}
.fx-act{display:block;width:100%;text-align:start;margin:0 0 6px}
.fx-print{margin:8px 0}.fx-print>div{padding-top:8px}
.fx-lib{margin:8px 0 40px}.fx-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px;margin-bottom:14px}
.fx-h{margin:0;font:400 clamp(28px,4vw,44px)/1.05 var(--serif,Georgia,serif);color:var(--bone,#ece6dc)}.fx-lead{margin:0;color:var(--mute,#a49d91);font-size:14px;max-width:60ch}
.fx-nav{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 12px;position:sticky;top:0;z-index:4;background:var(--ink,#0f0e0c)}
.fx-nav::-webkit-scrollbar{display:none}
.fx-cat{flex:none;border:1px solid var(--line,rgba(236,230,220,.18));background:none;color:var(--bone,#ece6dc);border-radius:999px;padding:9px 14px;font:500 13px var(--sans,sans-serif);cursor:pointer;min-height:40px}
.fx-cat[aria-selected=true]{background:var(--bone,#ece6dc);color:var(--ink,#111);border-color:var(--bone,#ece6dc)}
.fx-tools{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;margin:4px 0 18px}
.fx-tools .fx-in{margin:0;background:transparent;border-color:var(--line,rgba(236,230,220,.18));color:var(--bone,#ece6dc)}.fx-sort{width:auto}
.fx-count{font:500 11px var(--mono,monospace);letter-spacing:.12em;color:var(--mute,#a49d91);white-space:nowrap}
.fx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:18px}
.fx-card{position:relative;border:1px solid var(--line,rgba(236,230,220,.14));border-radius:18px;overflow:hidden;background:color-mix(in srgb,var(--bone,#ece6dc) 3%,transparent);display:flex;flex-direction:column}
.fx-fig{display:block;border:0;padding:0;margin:0;background:#17161a;cursor:pointer;aspect-ratio:4/3;width:100%}
.fx-img{display:block;width:100%;height:100%;object-fit:cover;background:linear-gradient(110deg,#1b1a1e 30%,#26252a 50%,#1b1a1e 70%);background-size:200% 100%;animation:fxsh 1.4s linear infinite}
.fx-img[src]{animation:none}
@keyframes fxsh{to{background-position:-200% 0}}
.fx-fav{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:50%;border:0;background:rgba(14,13,11,.55);color:#fff;font-size:18px;cursor:pointer}
.fx-fav[aria-pressed=true]{color:#ff7a8a}
.fx-meta{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.fx-meta h3{margin:0;font:400 21px/1.15 var(--serif,Georgia,serif);color:var(--bone,#ece6dc)}
.fx-sub2{margin:0;font:500 10px var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--mute,#a49d91)}
.fx-note{margin:0;font-size:13px;line-height:1.5;color:var(--bone2,#cfc8bb)}
.fx-sw{display:flex;gap:4px;margin-top:2px}.fx-sw i{width:16px;height:16px;border-radius:50%;border:1px solid rgba(255,255,255,.2)}
.fx-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:auto;padding-top:8px}
.fx-edit{border:0;border-radius:999px;padding:10px 16px;background:var(--bone,#ece6dc);color:var(--ink,#111);font:600 13px var(--sans,sans-serif);cursor:pointer;min-height:40px}
.fx-edit:disabled{opacity:.4}
.fx-cb{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--bone2,#cfc8bb);cursor:pointer}
.fx-del{border:0;background:none;color:#ff8f8f;font-size:13px;cursor:pointer;text-decoration:underline}
.fx-empty{color:var(--mute,#a49d91);padding:30px 0}
.fx-tray{position:sticky;bottom:12px;z-index:5;margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 12px;border-radius:16px;background:rgba(20,19,15,.92);border:1px solid var(--line,rgba(236,230,220,.18));color:var(--bone,#ece6dc);font-size:13px;backdrop-filter:blur(10px)}
.fx-cmp{margin-top:26px}.fx-h3{margin:0 0 4px;font:400 28px var(--serif,Georgia,serif);color:var(--bone,#ece6dc)}
.fx-tw{overflow-x:auto;margin-top:12px}.fx-table{border-collapse:collapse;width:100%;min-width:560px;font-size:13px;color:var(--bone2,#cfc8bb)}
.fx-table th,.fx-table td{border-bottom:1px solid var(--line,rgba(236,230,220,.14));padding:9px 10px;text-align:start;vertical-align:middle}
.fx-table thead th{vertical-align:top;font-weight:500;color:var(--bone,#ece6dc)}.fx-cimg{width:100%;max-width:220px;border-radius:12px;display:block;margin-bottom:6px;aspect-ratio:4/3;background:#1b1a1e}
.fx-table tr.diff td{background:color-mix(in srgb,var(--acc,#e8b46a) 12%,transparent);color:var(--bone,#ece6dc)}
@media (max-width:860px){.fx-bar{left:12px;bottom:auto;top:calc(min(62vh,520px) - 52px)}.fx-name{display:none}.fx-tag{top:12px;left:auto;right:12px}
  .fx-tools{grid-template-columns:1fr auto}.fx-count{grid-column:1/-1}.fx-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}
  .fx-meta{padding:10px 12px 12px}.fx-meta h3{font-size:17px}.fx-note{display:none}}
@media (prefers-reduced-motion:reduce){.fx-img{animation:none}}`;
  document.head.append(st);
}

/* GLTFExporter can only draw images/canvases: swap the generated DataTextures (surface.ts) for canvas copies while exporting */
function exportable(root: THREE.Object3D): () => void {
  const back: [Record<string, unknown>, string, THREE.Texture][] = []; const made = new Map<THREE.Texture, THREE.Texture>();
  root.traverse((o) => { const m = (o as THREE.Mesh).material; if (!m) return; for (const mt of (Array.isArray(m) ? m : [m]) as unknown as Record<string, unknown>[]) for (const k of Object.keys(mt)) {
    const tx = mt[k] as THREE.Texture; if (!(tx instanceof THREE.DataTexture)) continue;
    let c = made.get(tx); if (!c) { const im = tx.image as { data: Uint8Array; width: number; height: number }; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
      const id = new ImageData(im.width, im.height); id.data.set(im.data.subarray(0, im.width * im.height * 4)); cv.getContext('2d')!.putImageData(id, 0, 0);
      c = new THREE.CanvasTexture(cv); c.wrapS = tx.wrapS; c.wrapT = tx.wrapT; c.repeat.copy(tx.repeat); c.offset.copy(tx.offset); c.colorSpace = tx.colorSpace; c.channel = tx.channel; made.set(tx, c); }
    back.push([mt, k, tx]); mt[k] = c; } });
  return () => { for (const [mt, k, tx] of back) mt[k] = tx; made.forEach((c) => c.dispose()); };
}
