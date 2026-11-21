/* Real 3D scans studio, shared by the Shoes and Clothing worlds. Each piece is a licensed 3D scan or cloth
   simulation from Sketchfab (CC BY 4.0), compressed for the web (tools/scan). Every piece can be recoloured part by
   part: a scan with a zone map (tools/scan/zones.py) splits its one photographic texture into named parts; a model
   built from several materials uses those materials as its parts. Recolouring keeps each texel's own brightness, so
   the real grain, creases, stitching and shading stay; only the colour and finish change. */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { show3d, floor, THREE } from './show3d';
import { h, type Ctx } from './kit';
import { loadZones, attachZones, type ZonePack, type ZoneLook } from './scanzones';

export interface ScanItem {
  id: string; name: string; kind: 'shoe' | 'garment' | 'object';   /* object: bags, watches, jewellery, glasses (size = its largest side) */
  size: number;               // metres: a shoe's length, a garment's height, shown at true size
  zones?: boolean;            // a zone map exists in the item's folder
  mats?: [string, string][];  // material name pattern -> part label, for models built from several materials
  credit: [string, string, string];   // title, author, source URL
  changes: string;            // what Abidora changed (CC BY asks for this)
  nd?: boolean;               // CC BY-ND: shown exactly as made, so the colour editor is switched off
}

const LIGHTS: Record<string, { exp: number; env: number; key: number; ki: number; rim: number; ri: number; bg: number }> = {
  studio: { exp: 1.18, env: 1.2, key: 0xffffff, ki: 2.6, rim: 0xd9e4f2, ri: 1, bg: 0x111113 },
  daylight: { exp: 1.15, env: 1.25, key: 0xfff3e2, ki: 2.8, rim: 0xb9d2ff, ri: .6, bg: 0x1a1b1e },
  sunset: { exp: 1.05, env: .7, key: 0xffb27a, ki: 3, rim: 0x7aa2ff, ri: 1.5, bg: 0x1a0f0b },
  night: { exp: .9, env: .35, key: 0x9fb8ff, ki: 1.6, rim: 0xff5fa2, ri: 2.4, bg: 0x07080d },
};
const PAL: [string, string][] = [['#f4f2ee', 'Chalk'], ['#1c1c1e', 'Black'], ['#8c8f94', 'Grey'], ['#24324a', 'Navy'], ['#2f93c9', 'Blue'], ['#7fb3d5', 'Sky'], ['#2f4a35', 'Forest'], ['#6f8f6a', 'Olive'], ['#c9a46b', 'Sand'], ['#8a5a34', 'Brown'], ['#5a2a1c', 'Oxblood'], ['#c43b2f', 'Red'], ['#e07a3f', 'Orange'], ['#e8c547', 'Yellow'], ['#e7c3c1', 'Blush'], ['#7b4fa0', 'Purple']];
const MAIN = ['Chalk', 'Black', 'Grey', 'Navy', 'Brown', 'Red', 'Sand', 'Blush'];
const ROUGH = { factory: 0, matte: .3, satin: -.08, gloss: -.35 };

/* mean linear luminance of a texture (for parts that are a whole material) */
const lumCache = new WeakMap<object, number>();
function texLum(tex: THREE.Texture): number {
  const img = tex.image as CanvasImageSource & { width: number; height: number }; const hit = lumCache.get(img); if (hit !== undefined) return hit;
  let v = .2;
  try { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0, 64, 64);
    const d = g.getImageData(0, 0, 64, 64).data; let s = 0, n = 0; const lin = (x: number) => { x /= 255; return x <= .04045 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); };
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 8) continue; s += .2126 * lin(d[i]) + .7152 * lin(d[i + 1]) + .0722 * lin(d[i + 2]); n++; } if (n) v = s / n; } catch { /* keep default */ }
  lumCache.set(img, v); return v;
}
let blankZone: THREE.DataTexture | null = null;
function wholePack(tex: THREE.Texture, label: string): ZonePack {
  if (!blankZone) { blankZone = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blankZone.needsUpdate = true; }
  return { tex: blankZone, zones: [{ id: 'all', label, texels: 1, lum: [texLum(tex)], hex: ['#808080'] }] };
}

interface Part { label: string; dot: string; look: ZoneLook }

export function scanStudio(ctx: Ctx, root: string, items: ScanItem[], opts: { title: string; acc?: string }) {
  const t = ctx.t;
  const S = show3d(ctx, { bg: '#111113', acc: opts.acc ?? '#d9c7a8', hint: t('sc.hint', 'Drag to turn · pinch, Ctrl + scroll or + / − to zoom') });
  const { scene, renderer, key, rim } = S;
  floor(S, 0, 4, opts.acc ?? '#d9c7a8');
  /* showroom plinth light: two hairline rings on the floor, sized to each piece in show() */
  const ringM = new THREE.MeshBasicMaterial({ color: opts.acc ?? '#d9c7a8', transparent: true, opacity: .55, depthWrite: false, toneMapped: false });
  const ringM2 = new THREE.MeshBasicMaterial({ color: '#8fd8ff', transparent: true, opacity: .22, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 160), ringM), ring2 = new THREE.Mesh(new THREE.RingGeometry(.994, 1, 160), ringM2);
  for (const r of [ring, ring2]) { r.rotation.x = -Math.PI / 2; r.position.y = .0008; r.renderOrder = 2; scene.add(r); }
  ctx.onDispose(() => { ring.geometry.dispose(); ring2.geometry.dispose(); ringM.dispose(); ringM2.dispose(); });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const base = root + 'assets/models/scans/';
  const cache = new Map<string, Promise<{ scene: THREE.Group; pack: ZonePack | null }>>();
  const loadItem = (it: ScanItem) => { let p = cache.get(it.id); if (!p) { p = Promise.all([loader.loadAsync(base + it.id + '/model.glb'), it.zones ? loadZones(base + it.id + '/').catch(() => null) : Promise.resolve(null)]).then(([g, pack]) => ({ scene: g.scene, pack })); cache.set(it.id, p); } return p; };

  /* the piece hangs on a pivot at its centre so the Sole view can tip a shoe over and show the tread */
  const pivot = new THREE.Group(); scene.add(pivot); let tilt = 0, tiltTo = 0, lift = 0;
  S.onTick((dt) => { if (Math.abs(tiltTo - tilt) < 1e-4) return; tilt += (tiltTo - tilt) * Math.min(1, dt * (ctx.calm ? 60 : 5)); pivot.rotation.x = tilt; pivot.position.y = pc.y + lift * (tilt / -Math.PI * 2); });
  const pc = new THREE.Vector3();
  let cur: ScanItem = items[0]; let obj: THREE.Group | null = null; let pack: ZonePack | null = null;
  let zoneMat: THREE.Material | null = null; let parts: Part[] = []; let matPart = new Map<THREE.Material, number>(); let zoneParts: number[] = [];
  const meshes: { m: THREE.Mesh; orig: THREE.MeshStandardMaterial }[] = [];
  let sel = 0; let showOrig = false; let token = 0;

  const gM = S.group(t('sc.model', 'Piece')); const gP = S.group(t('parts', 'Parts')); const gV = S.group(t('view', 'View')); const gL = S.group(t('light', 'Light'));
  const info = h('p', { class: 's3-note' }); const credit = h('p', { class: 's3-note' });
  /* 0.9.6 (owner: "keep only what is really needed"): piece, part and 8 main colours stay in view; the rest sits under More */
  const moreP = h('div', { class: 's3-g' });
  const more = h('details', { class: 's3-more' }, h('summary', { text: t('sc.more', 'More options') }), moreP, gV, gL, info);
  S.rail.append(more, credit);
  /* phone sheet: only Piece and Parts get tabs; View and Light live under More */
  for (const g of [gV, gL]) { const lbl = g.querySelector('.l span, .l')?.firstChild?.textContent?.trim(); S.rail.querySelectorAll('.s3-tab').forEach((tb) => { if (tb.textContent === lbl) tb.remove(); }); }

  function apply() {
    for (const { m, orig } of meshes) {
      const prev = m.material as THREE.Material; if (prev !== orig) prev.dispose();
      if (showOrig) { m.material = orig; continue; }
      const mt = orig.clone();
      if (pack && orig === zoneMat) attachZones(mt, pack, zoneParts.map((pi) => parts[pi].look));
      else {
        const L = parts[matPart.get(orig) ?? 0]?.look;
        if (L) {
          if (mt.map) attachZones(mt, wholePack(mt.map, ''), [L]);
          else { if (L.color) mt.color.set(L.color); mt.roughness = Math.min(1, Math.max(.04, mt.roughness + ROUGH[L.finish])); }
        }
      }
      m.material = mt;
    }
  }

  const partBox = h('div'); gP.append(partBox);
  function renderParts() {
    partBox.innerHTML = '';
    if (cur.nd) { moreP.replaceChildren(); partBox.append(h('p', { class: 's3-note', text: t('sc.nd', 'The maker asks that this model is shown exactly as made, so its colours can’t be changed. You can still turn it, zoom and change the light.') })); return; }
    if (!parts.length) return;
    const zr = h('div', { class: 's3-row' });
    parts.forEach((p, i) => { const dot = h('span', { class: 'fx-dot', style: { background: p.look.color ?? p.dot, display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', border: '1px solid #fff4' } });
      const b = h('button', { type: 'button', class: 's3-chip', 'aria-pressed': String(i === sel) }, dot, document.createTextNode(' ' + p.label)); b.onclick = () => { sel = i; renderParts(); }; zr.append(b); });
    const L = parts[sel].look;
    const row = h('div', { class: 's3-row' });
    const orig = h('button', { type: 'button', class: 's3-chip', text: t('p.orig', 'Original'), 'aria-pressed': String(!L.color) }); orig.onclick = () => { L.color = null; apply(); renderParts(); }; row.append(orig);
    for (const [c, n] of PAL.filter(([, n]) => MAIN.includes(n))) { const b = h('button', { type: 'button', class: 's3-sw', title: t('c.' + n.toLowerCase(), n), 'aria-label': t('c.' + n.toLowerCase(), n), 'aria-pressed': String(L.color === c) }); b.style.background = c; b.onclick = () => { L.color = c; showOrig = false; apply(); renderParts(); }; row.append(b); }
    const pick = h('input', { type: 'color', value: L.color ?? '#8a5a34', 'aria-label': t('p.own', 'Pick your own colour'), style: { width: '100%', height: '30px', marginTop: '8px', background: 'none', border: '0', cursor: 'pointer' } }) as HTMLInputElement;
    pick.oninput = () => { L.color = pick.value; showOrig = false; apply(); }; pick.onchange = () => renderParts();
    const fin = h('div', { class: 's3-row' });
    for (const [k, l] of [['factory', t('f.fac', 'Factory')], ['matte', t('f.matte', 'Matte')], ['satin', t('f.satin', 'Satin')], ['gloss', t('f.gloss', 'Gloss')]] as [ZoneLook['finish'], string][]) { const b = h('button', { type: 'button', class: 's3-chip', text: l, 'aria-pressed': String(L.finish === k) }); b.onclick = () => { L.finish = k; showOrig = false; apply(); renderParts(); }; fin.append(b); }
    const ba = h('div', { class: 's3-row' });
    for (const [k, l] of [['0', t('sc.edit', 'Your version')], ['1', t('sc.orig', 'Original scan')]]) { const b = h('button', { type: 'button', class: 's3-chip', text: l, 'aria-pressed': String(showOrig === (k === '1')) }); b.onclick = () => { showOrig = k === '1'; apply(); renderParts(); }; ba.append(b); }
    const all = h('button', { type: 'button', class: 's3-chip', text: t('p.reset', 'All parts back to original') }); all.onclick = () => { parts.forEach((p) => { p.look.color = null; p.look.finish = 'factory'; }); apply(); renderParts(); };
    const more2 = h('div', { class: 's3-row' });
    for (const [c, n] of PAL.filter(([, n]) => !MAIN.includes(n))) { const b = h('button', { type: 'button', class: 's3-sw', title: t('c.' + n.toLowerCase(), n), 'aria-label': t('c.' + n.toLowerCase(), n), 'aria-pressed': String(L.color === c) }); b.style.background = c; b.onclick = () => { L.color = c; showOrig = false; apply(); renderParts(); }; more2.append(b); }
    partBox.append(parts.length > 1 ? zr : '', row);
    moreP.replaceChildren(more2, pick, fin, ba, h('div', { class: 's3-row' }, all));
  }

  async function show(it: ScanItem) {
    const my = ++token; cur = it; mark(); S.setLoading(t('sc.loading', 'Loading the 3D scan…'));
    let got; try { got = await loadItem(it); } catch { if (my === token) S.setLoading(t('s3.fail', 'The 3D model could not load. Please refresh the page.')); return; }
    if (my !== token) return;
    if (obj) { pivot.remove(obj); for (const { m, orig } of meshes) { if (m.material !== orig) (m.material as THREE.Material).dispose(); m.material = orig; } }
    meshes.length = 0; obj = got.scene; pack = got.pack; zoneMat = null; matPart = new Map(); parts = []; zoneParts = []; sel = 0; showOrig = false;
    obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0); obj.scale.setScalar(1);
    /* parts: zones of the scan texture first, then any other materials */
    const area = new Map<THREE.MeshStandardMaterial, number>();
    obj.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh) return; m.castShadow = m.receiveShadow = true;
      const mt = (m.userData.orig ?? m.material) as THREE.MeshStandardMaterial; m.userData.orig = mt; meshes.push({ m, orig: mt });
      const n = (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; area.set(mt, (area.get(mt) ?? 0) + n); });
    const mats = [...area.keys()].sort((a, b) => area.get(b)! - area.get(a)!);
    if (pack) { zoneMat = mats.find((x) => x.map) ?? mats[0]; pack.zones.forEach((z, i) => { parts.push({ label: t('zn.' + z.id, z.label), dot: z.hex[0] ?? '#888', look: { color: null, finish: 'factory' } }); zoneParts.push(i); }); }
    const byLabel = new Map<string, number>();
    for (const mt of mats) { if (mt === zoneMat) continue;
      let label = it.mats?.find(([re]) => new RegExp(re, 'i').test(mt.name))?.[1] ?? (mt === mats[0] ? (it.kind === 'shoe' ? 'Shoe' : it.kind === 'object' ? 'Body' : 'Fabric') : 'Details');
      label = t('pt.' + label.toLowerCase().replace(/\W+/g, '-'), label);
      let pi = byLabel.get(label); if (pi === undefined) { pi = parts.length; byLabel.set(label, pi); parts.push({ label, dot: '#' + mt.color.getHexString(), look: { color: null, finish: 'factory' } }); }
      matPart.set(mt, pi); }
    /* start on the part that covers the most of the piece (not the one with the most triangles, e.g. buttons) */
    if (!pack && parts.length > 1) { const ext = new Map<number, number>(); obj.updateMatrixWorld(true);
      for (const { m, orig } of meshes) { const pi = matPart.get(orig as THREE.MeshStandardMaterial); if (pi === undefined) continue; const z = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3()); ext.set(pi, (ext.get(pi) ?? 0) + z.x * z.y + z.y * z.z + z.x * z.z); }
      let best = -1; ext.forEach((v, k) => { if (best < 0 || v > ext.get(best)!) best = k; }); if (best >= 0) sel = best; }
    /* true size: shoes by length (long axis turned to X), garments by height, lifted a little off the floor */
    const b0 = new THREE.Box3().setFromObject(obj), s0 = b0.getSize(new THREE.Vector3());
    if (it.kind === 'shoe') { if (s0.z > s0.x) obj.rotation.y = Math.PI / 2; obj.scale.setScalar(it.size / Math.max(s0.x, s0.z)); }
    else if (it.kind === 'object') { if (s0.y < .15 * Math.max(s0.x, s0.z) || (it.id.startsWith('watch-') && s0.y < Math.max(s0.x, s0.z))) obj.rotation.x = Math.PI / 2;   /* watches stand up with the dial to the front */
        /* a brooch lying flat is stood up to face the camera */
      obj.scale.setScalar(Math.max(it.size, .2) / Math.max(s0.x, s0.y, s0.z)); }   /* rings and brooches are shown enlarged, so they can be seen */
    else obj.scale.setScalar(it.size / s0.y);
    obj.updateMatrixWorld(true); const b1 = new THREE.Box3().setFromObject(obj), c1 = b1.getCenter(new THREE.Vector3());
    obj.position.set(-c1.x, -b1.min.y + (it.kind === 'garment' ? it.size * .04 : 0), -c1.z);
    obj.updateMatrixWorld(true); { const bb = new THREE.Box3().setFromObject(obj); bb.getCenter(pc); const sz = bb.getSize(new THREE.Vector3()); lift = Math.max(0, sz.z / 2 - sz.y / 2) + sz.y * .15; }
    obj.position.sub(pc); pivot.position.copy(pc); tilt = tiltTo = 0; pivot.rotation.x = 0;
    pivot.add(obj); pivot.updateMatrixWorld(true); apply();   /* world matrices first, so the camera aims at the real middle of the piece */
    { const bb = new THREE.Box3().setFromObject(obj), sz = bb.getSize(new THREE.Vector3()), r0 = Math.max(sz.x, sz.z) * (it.kind === 'shoe' ? .48 : .5) + it.size * .03; ring.scale.setScalar(r0); ring2.scale.setScalar(r0 * 1.12); }
    const b = new THREE.Box3().setFromObject(obj), c = b.getCenter(new THREE.Vector3()), bs = b.getSize(new THREE.Vector3()), d = it.kind === 'shoe' ? 1.3 * Math.max(bs.x, bs.z, bs.y * 1.6) : it.kind === 'object' ? 1.55 * Math.max(bs.x, bs.y, bs.z) : Math.max(it.size, bs.x * 1.15, bs.z * 1.15);
    const sh = key.shadow.camera; sh.left = sh.bottom = -d * .9; sh.right = sh.top = d * .9; sh.near = .01; sh.far = d * 8; sh.updateProjectionMatrix();
    key.position.set(d * 1.2, d * 2.4, d * 1.5); key.target.position.copy(c); rim.position.set(-d * 1.6, d * 1.2, -d * 1.4);
    const V = it.kind === 'object'
      ? [{ name: '3/4', pos: [d * 1.1, d * .55, d * 1.6] }, { name: 'front', pos: [0, d * .25, d * 2] }, { name: 'side', pos: [d * 2, d * .25, 0] }, { name: 'back', pos: [0, d * .3, -d * 2] }, { name: 'top', pos: [.01, d * 2.1, .02] }, { name: 'close', pos: [d * .45, d * .35, d * .95] }]
      : it.kind === 'shoe'
      ? [{ name: '3/4', pos: [d * 1.2, d * .65, d * 1.3] }, { name: 'side', pos: [0, d * .3, d * 1.85] }, { name: 'front', pos: [d * 1.85, d * .35, 0] }, { name: 'back', pos: [-d * 1.85, d * .45, 0] }, { name: 'top', pos: [.01, d * 1.95, .02] }, { name: 'sole', pos: [d * .15, d * .35, d * 2.7] }]
      : [{ name: '3/4', pos: [d * 1.45, d * .2, d * 2.55] }, { name: 'front', pos: [0, d * .12, d * 2.95] }, { name: 'side', pos: [d * 2.95, d * .12, 0] }, { name: 'back', pos: [0, d * .15, -d * 2.95] }, { name: 'close', pos: [d * .45, d * .2, d * 1.15] }];
    S.controls.minPolarAngle = it.kind === 'garment' ? .35 : 0;   /* garments: never the odd straight-down view */
    S.frame(c, V as { name: string; pos: [number, number, number] }[]);
    setView('3/4'); markViews('3/4');
    info.textContent = (it.kind === 'object' ? (it.size < .2 ? t('sc.big', 'Shown {x}× larger than life. Real size: {cm} cm across.').replace('{x}', String(Math.round(.2 / it.size))) : t('sc.sz', 'Shown at true size: {cm} cm across.')) : it.kind === 'shoe' ? t('sc.len', 'Shown at true size: {cm} cm long.') : t('sc.h', 'Shown at true size: {cm} cm from collar to hem.')).replace('{cm}', String(Math.round(it.size * 100)));
    credit.innerHTML = ''; credit.append(document.createTextNode(t('sc.by', '3D model') + ': “' + it.credit[0] + '” ' + t('sc.author', 'by') + ' ' + it.credit[1] + ', '),
      h('a', { href: it.credit[2], target: '_blank', rel: 'noopener', text: 'Sketchfab' }), document.createTextNode(', '),
      h('a', { href: it.nd ? 'https://creativecommons.org/licenses/by-nd/4.0/' : 'https://creativecommons.org/licenses/by/4.0/', target: '_blank', rel: 'noopener', text: it.nd ? 'CC BY-ND 4.0' : 'CC BY 4.0' }), document.createTextNode('. ' + t('sc.changed', 'Changed by Abidora') + ': ' + it.changes));
    renderParts(); S.setLoading(null);
  }

  /* piece picker */
  /* every piece as a photo of the real model (taken from the 3D file), name under it */
  const pick = h('div', { class: 's3-row s3-pick s3-ppick' }); gM.append(pick);
  const pbs = items.map((it) => { const pi = h('img', { src: root + 'assets/thumbs/' + it.id + '.webp', alt: '', loading: 'lazy', width: '96', height: '96' }) as HTMLImageElement; pi.onerror = () => pi.remove();
    const b = h('button', { type: 'button', class: 's3-chip s3-pc', title: t('sc.n.' + it.id, it.name), 'aria-pressed': String(it === cur) }, pi, h('span', { text: t('sc.n.' + it.id, it.name) })); b.onclick = () => { pbs.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); const lb = gM.querySelector('.l b'); if (lb) lb.textContent = t('sc.n.' + it.id, it.name); void show(it); const pt = b.getBoundingClientRect().top - pick.getBoundingClientRect().top + pick.scrollTop; if (pt < pick.scrollTop || pt + b.offsetHeight > pick.scrollTop + pick.clientHeight) pick.scrollTo({ top: pt - 8, behavior: ctx.calm ? 'auto' : 'smooth' }); }; pick.append(b); return b; });
  const lb0 = gM.querySelector('.l b'); if (lb0) lb0.textContent = t('sc.n.' + cur.id, cur.name);

  const setView = S.chips(gV, ([['3/4', '3/4'], ['front', t('vw.front', 'Front')], ['side', t('vw.side', 'Side')], ['back', t('vw.back', 'Back')], ['top', t('vw.top', 'Top')], ['close', t('vw.close', 'Close-up')], ['sole', t('vw.sole', 'Sole')]] as [string, string][]).filter(([k]) => k !== 'sole' || items.some((i) => i.kind === 'shoe')).filter(([k]) => k !== 'top' || items.some((i) => i.kind !== 'garment')).filter(([k]) => k !== 'close' || items.some((i) => i.kind !== 'shoe')), '3/4', (v) => onView(v));
  /* one place that moves the camera, used by the editor chips AND the buttons on the stage (the stage buttons used to only light up) */
  function onView(v: string) { tiltTo = v === 'sole' && cur.kind === 'shoe' ? -Math.PI / 2 : 0; S.go(v); markViews(v); }
  function markViews(v: string) { const vw = S.stage.querySelector('.s3-vw'); if (vw) vw.querySelectorAll('button').forEach((x, i) => x.setAttribute('aria-pressed', String(['3/4', 'front', 'side', 'back'][i] === v))); }
  function setLight(n: string) { const L = LIGHTS[n]; renderer.toneMappingExposure = L.exp; scene.environmentIntensity = L.env; key.color.set(L.key); key.intensity = L.ki; rim.color.set(L.rim); rim.intensity = L.ri; (scene.background as THREE.Color).set(L.bg); }
  S.chips(gL, [['studio', t('l.studio', 'Studio')], ['daylight', t('l.day', 'Daylight')], ['sunset', t('l.sunset', 'Sunset')], ['night', t('l.night', 'Night')]], 'studio', setLight);
  setLight('studio');

  /* gallery: every piece as a photo card under the stage (photos taken from the 3D models themselves),
     big arrows and a counter on the stage, and the main views as buttons on the stage */
  const n = items.length;
  const go = (d: number) => pbs[(items.indexOf(cur) + d + n) % n].click();
  const count = h('p', { class: 's3-count' });
  const prevB = h('button', { type: 'button', class: 's3-arw s3-arw-l', 'aria-label': t('sc.prev', 'Previous piece') }); prevB.innerHTML = '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>'; prevB.onclick = () => go(-1);
  const nextB = h('button', { type: 'button', class: 's3-arw s3-arw-r', 'aria-label': t('sc.next', 'Next piece') }); nextB.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'; nextB.onclick = () => go(1);
  const views = h('div', { class: 's3-vw' });
  for (const [v, lab] of ([['3/4', '3/4'], ['front', t('vw.front', 'Front')], ['side', t('vw.side', 'Side')], ['back', t('vw.back', 'Back')]] as [string, string][])) {
    const b = h('button', { type: 'button', text: lab }); b.setAttribute('aria-pressed', String(v === '3/4')); b.onclick = () => { setView(v); onView(v); }; views.append(b); }
  S.stage.append(count, prevB, nextB, views);
  const gal = h('div', { class: 's3-gal' });
  const row = h('div', { class: 's3-galr' });
  const cards = items.map((it, i) => {
    const img = h('img', { src: root + 'assets/thumbs/' + it.id + '.webp', alt: '', loading: 'lazy', width: '150', height: '150' }) as HTMLImageElement;
    img.onerror = () => img.remove();
    const b = h('button', { type: 'button', class: 's3-card', 'aria-pressed': 'false' }, img, h('span', { text: t('sc.n.' + it.id, it.name) }));
    b.onclick = () => pbs[i].click(); row.append(b); return b; });
  gal.append(h('div', { class: 's3-galh' }, h('b', { text: t('sc.all', 'All {n} pieces').replace('{n}', String(n)) }), h('span', { text: t('sc.galhint', 'Tap a picture to see it in 3D') })), row);
  S.stage.after(gal);
  function mark() {
    if (!cards) return; const i = items.indexOf(cur);
    cards.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
    count.textContent = `${i + 1} / ${n} · ${t('sc.n.' + cur.id, cur.name)}`;
    views.querySelectorAll('button').forEach((x, k) => x.setAttribute('aria-pressed', String(k === 0)));
    const c = cards[i]; row.scrollTo({ left: c.offsetLeft - row.clientWidth / 2 + c.clientWidth / 2, behavior: ctx.calm ? 'auto' : 'smooth' });
  }
  void show(cur);
  return { show: (id: string) => { const i = items.findIndex((x) => x.id === id); if (i >= 0) pbs[i].click(); } };
}

/* ---------- the pieces ---------- */
const SF = 'https://sketchfab.com/3d-models/';
export const SCAN_SHOES: ScanItem[] = [
  { id: 'oxford-old', name: 'Worn leather slip-on', kind: 'shoe', size: .29, zones: true, credit: ['Old Oxford Shoe', 'inciprocal', SF + 'old-oxford-shoe-29a5ed053eab46a7af308215600985a2'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'riding-boot', name: 'Quilted riding boot', kind: 'shoe', size: .27, zones: true, credit: ['Coraline Riding Boot', 'inciprocal', SF + 'coraline-riding-boot-e0aec450be8e45ab888613b3a44d26a6'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'snow-boot', name: 'Padded snow boot', kind: 'shoe', size: .26, zones: true, credit: ['Pink Winter Boot', 'inciprocal', SF + 'pink-winter-boot-89783e744f7249ffa9eedcee69c760ee'], changes: 'maker’s logo removed from the strap tabs, compressed for the web, part map added for recolouring.' },
  { id: 'chelsea-buckle', name: 'Buckled Chelsea boot', kind: 'shoe', size: .27, credit: ['Womens chelsea boot black', 'victorn8c', SF + 'womens-chelsea-boot-black-459c0864e8cc441cb12cd50566479844'], changes: 'compressed for the web.' },
  { id: 'chelsea-gloss', name: 'Glossy Chelsea boots', kind: 'shoe', size: .29, credit: ['Simple Chelsea Boots For Ray II', 'ChamberSu1996', SF + 'simple-chelsea-boots-for-ray-ii-9e6361a32454492e9104c77b772f9cdd'], changes: 'compressed and simplified for the web.' },
  { id: 'heels-strappy', name: 'Two-tone stiletto', kind: 'shoe', size: .25, mats: [['Absatz', 'Heel'], ['Band', 'Straps'], ['Punkte', 'Dots'], ['Gummi', 'Sole'], ['SohleStoff', 'Insole'], ['Kunstfaser', 'Upper']], credit: ['High Heels', 'cebraVFX', SF + 'high-heels-1561c09fc45349d680e48e3e007b64e0'], changes: 'brand name removed from the insole, compressed for the web.' },
  { id: 'heels-chain', name: 'Chain-strap sandal', kind: 'shoe', size: .25, mats: [['sole', 'Shoe'], ['silver', 'Chain']], credit: ['Chain Strap High Heels', 'hiirusama', SF + 'chain-strap-high-heels-87849936a0354a208cbbf80fbb2ccbe6'], changes: 'compressed and simplified for the web.' },
  { id: 'hitop-bolt', name: 'Lightning high-top', kind: 'shoe', size: .3, credit: ['Basketball Shoe', 'Yacine3Dz', SF + 'basketball-shoe-a26353e45737402c9ca5c74a72f213a0'], changes: 'compressed and simplified for the web.' },
  { id: 'flats-black', name: 'Black stitched flats', kind: 'shoe', size: .25, credit: ['Shoes (Israel Lopez)', 'MDPLS Digital Collections', SF + 'shoes-israel-lopez-27ba49bd7fcf45f2a76a015ebe5f63e1'], changes: 'compressed and simplified for the web.' },
  { id: 'heels-pastel', name: 'Pastel pointed pumps', kind: 'shoe', size: 0.24, credit: ['shoes-high heels', 'SHINING 3D', SF + 'shoes-high-heels-4dcc59ff3a064021bd4a72e53596c9f9'], changes: 'compressed and simplified for the web.' },
  { id: 'hitop-white', name: 'White sculpted high-top', kind: 'shoe', size: 0.3, credit: ['Basketball shoes', 'Thunk3D scanner', SF + 'basketball-shoes-6fb1a61472d949d98fe456913ec9528a'], changes: 'compressed and simplified for the web.' },
];
export const SCAN_CLOTHES: ScanItem[] = [
  { id: 'coat-brown', name: 'Brown leather trench', kind: 'garment', size: 1.25, credit: ['Coat Full Body Brown leather 3d model free', 'iGauravRajput', SF + 'coat-full-body-brown-leather-3d-model-free-e1959367d23545b4ad0ca2b2c34ff6e0'], changes: 'compressed for the web.' },
  { id: 'coat-black', name: 'Black leather coat', kind: 'garment', size: 1.3, zones: true, credit: ['Black Leather Coat 3d Model', 'iGauravRajput', SF + 'black-leather-coat-3d-model-6f0529b7cbd34303befa7aecd88d37d2'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'coat-long', name: 'Long leather coat', kind: 'garment', size: 1.3, credit: ['Coat Leather Jacket 3d Model Free', 'iGauravRajput', SF + 'coat-leather-jacket-3d-model-free-f7a2fa35aec340b39558a61fd578f3eb'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'coat-buckle', name: 'Buckled two-tone coat', kind: 'garment', size: 1.3, zones: true, credit: ['Coat Full Body Cloth 3d model free', 'iGauravRajput', SF + 'coat-full-body-cloth-3d-model-free-7a390c778e904ebc9506ff091b4cc3fc'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'top-offshoulder', name: 'Off-shoulder top', kind: 'garment', size: .42, credit: ['Off Shoulder Top', 'DaaGHrii', SF + 'off-shoulder-top-5dac7be571c7464e802cc5aaa08a15c0'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'dress-qipao', name: 'Brocade qipao dress', kind: 'garment', size: .95, zones: true, credit: ['Chinese Dragon Dress', 'GangsterKitty', SF + 'chinese-dragon-dress-6edcfbd811584d3e8f9dc7d024c30e84'], changes: 'compressed for the web, part map added for recolouring.' },
  { id: 'dress-denim', name: 'Denim pinafore dress', kind: 'garment', size: 1.2, mats: [['uniform', 'Denim'], ['snap', 'Snap buttons'], ['ring', 'Strap rings']], credit: ['Black Denim Overall Dress', 'Style3D CG', SF + 'black-denim-overall-dress-09c6f4cdafee4ed2a566affa4cbebf66'], changes: 'compressed for the web.' },
  { id: 'dress-tiered', name: 'Tiered slip dress', kind: 'garment', size: 1.35, mats: [['uniform', 'Fabric']], credit: ['Black Dress', 'Style3D CG', SF + 'black-dress-b0b0e79eca3d4927b9bb25ded81221ec'], changes: 'compressed for the web.' },
  { id: 'dress-mesh', name: 'Mesh layered dress', kind: 'garment', size: 1.4, mats: [['uniform', 'Fabric'], ['button', 'Buttons']], credit: ['Black Mesh Dress', 'Style3D CG', SF + 'black-mesh-dress-62b23d393c16485fae3e4b03608bf267'], changes: 'compressed for the web.' },
  { id: 'dress-mini', name: 'Mini dress with pearls', kind: 'garment', size: .95, mats: [['008', 'Dress'], ['004', 'Pearls'], ['001', 'Pendant']], credit: ['Black Mini Dress', 'GangsterKitty', SF + 'black-mini-dress-4277ed4d81ac4b64aeeab3a25c82648a'], changes: 'compressed for the web.' },
  { id: 'dress-smocked', name: 'Smocked maxi dress', kind: 'garment', size: 1.3, mats: [['material_0', 'Fabric']], credit: ['Free Download Marvelous Designer - Casual Outfit', 'Cau Hi', SF + 'free-download-marvelous-designer-casual-outfit-2f5b4e1123234e2091a5e13045aeef11'], changes: 'compressed and simplified for the web.' },
  { id: 'saree', name: 'Saree with red blouse', kind: 'garment', size: 1.45, mats: [['FABRIC_1', 'Fabric A'], ['FABRIC_2', 'Fabric B'], ['FABRIC_3', 'Fabric C'], ['FABRIC_4', 'Fabric D'], ['FABRIC_5', 'Fabric E']], credit: ['Traditional Saree', 'Mobin Mithun', SF + 'traditional-saree-c70eeeafd37c4d8aa138b61a45821c25'], changes: 'compressed for the web.' },
  { id: 'denim-vest', name: 'Denim vest over a tee', kind: 'garment', size: .7, mats: [['Tshirt', 'T-shirt'], ['Jersey', 'Denim vest']], credit: ['Denim Jacket Sleeveless With White T-Shirt', 'True Singh Studios', SF + 'denim-jacket-sleeveless-with-white-t-shirt-fb4c7454e1724d7bbac18cfad5984448'], changes: 'compressed for the web.' },
  { id: 'kilt-leather', name: 'Leather warrior kilt', kind: 'garment', size: .7, credit: ['a leather warrior kilt cloth 3d model free', 'iGauravRajput', SF + 'a-leather-warrior-kilt-cloth-3d-model-free-a61be83bfc7044848e644081fa7fb4c2'], changes: 'compressed for the web.' },
  { id: 'gagra-saree', name: 'Gagra saree dress', kind: 'garment', size: 1.45, mats: [['006', 'Skirt'], ['010', 'Border'], ['018', 'Blouse'], ['016', 'Dupatta']], credit: ['Gagra Saree Dress', 'munjeticharan6317', SF + 'gagra-saree-dress-c26f9547ef4e455db4b6738305da922d'], changes: 'display floor removed, compressed for the web.' },
  { id: 'blazer-pinstripe', name: 'Double-breasted pinstripe blazer', kind: 'garment', size: .8, mats: [['Black_Cloth', 'Jacket'], ['Top_BlackPart', 'Lapels'], ['Top_part', 'Collar'], ['Inside', 'Lining'], ['Button', 'Buttons'], ['blinn', 'Details']], credit: ['Double-Breasted Formal Blazer', 'SathwikBannu', SF + 'double-breasted-formal-blazer-9e19a3739042402ca7c27b7384923c22'], changes: 'compressed for the web.' },
  { id: 'jacket-suede', name: 'Suede trucker jacket', kind: 'garment', size: .7, credit: ['Designer Jacket', 'urbanmasque', SF + 'designer-jacket-6073f5108e7440ae8658a69622031f06'], changes: 'compressed for the web.' },
  { id: 'denim-jacket-blue', name: 'Blue denim jacket', kind: 'garment', size: .7, mats: [['Denim', 'Denim'], ['button', 'Buttons']], credit: ['Denim Jacket', 'k_Helferty99', SF + 'denim-jacket-1f11ec52bd8c4421abc18f45197c198e'], changes: 'compressed for the web.' },
  { id: 'denim-jacket-black', name: 'Black denim jacket', kind: 'garment', size: .7, credit: ['Denim Jacket', 'MiguelAMartinez', SF + 'denim-jacket-c7f661c667c8432ab78bf6c3d9511f25'], changes: 'compressed for the web.' },
  { id: 'saree-red', name: 'Red saree with blouse', kind: 'garment', size: 1.5, mats: [['shari', 'Saree'], ['blaus', 'Blouse'], ['buttam', 'Petticoat'], ['shuta', 'Border']], credit: ['Mom dress (saree and blouse)', 'Habib Siddick', SF + 'mom-dress-saree-and-blouse-e5eeac0236714098a27fdbe13aedcb09'], changes: 'compressed for the web.' },
  { id: 'polo-striped', name: 'Striped polo shirt', kind: 'garment', size: .75, credit: ['T-shirt', 'Hyperrealitystudio', SF + 't-shirt-7c8a4dede482474fa5a74f24c6fc5e81'], changes: 'compressed for the web.' },
  { id: 'tee-raglan', name: 'Raglan T-shirt', kind: 'garment', size: .7, credit: ['T-shirt', 'Sirenko', SF + 't-shirt-00daf5abf6d44db9a310b8264ad0e834'], changes: 'compressed for the web.' },
  { id: 'tee-longsleeve', name: 'Long-sleeve T-shirt (7 panels)', kind: 'garment', size: .7, mats: [['^Back', 'Back'], ['^Collar', 'Collar'], ['^Front', 'Front'], ['^Lower_Left', 'Left cuff'], ['^Lower_Right', 'Right cuff'], ['^Upper_Left', 'Left sleeve'], ['^Upper_Right', 'Right sleeve']], credit: ['T-shirt - Lengan Panjang', 'Ikal.Ichwan', SF + 't-shirt-lengan-panjang-86d4292baa6c489ab5fab374bf803106'], changes: 'compressed for the web.' },
  { id: 'shorts-denim', name: 'Lace-up denim shorts', kind: 'garment', size: .3, credit: ['Jeans Hotpants', 'DaaGHrii', SF + 'jeans-hotpants-0b6d7b161eae4439a801c5e753333fbe'], changes: 'compressed for the web.' },
  { id: 'sweatpants-velour', name: 'Velour sweatpants', kind: 'garment', size: 1.0, credit: ['womens Velvour Sweatpants', 'Stacy-Cola-P51', SF + 'womens-velvour-sweatpants-9895697b08c64e3590df260761435440'], changes: 'compressed for the web.' },
  { id: 'blazer-skirt', name: 'Wide-shoulder blazer and skirt', kind: 'garment', size: 1.05, mats: [['^uniform_1001', 'Blazer'], ['^uniform_1002', 'Skirt'], ['^uniform_100[34]', 'Lining'], ['Button', 'Buttons'], ['Puller', 'Zip']], credit: ['Wide-Shoulder Blazer and Skirt Ensemble', 'Style3D CG', SF + 'wide-shoulder-blazer-and-skirt-ensemble-5fb3cf3e06dc4f13bec0e3b4060c43ff'], changes: 'compressed for the web.' },
  { id: 'suit-navy', name: 'Navy suit with white jeans', kind: 'garment', size: 1.5, mats: [['uniform', 'Suit'], ['Button', 'Buttons']], credit: ['Navy Blue Casual Suit With White Jeans', 'Style3D CG', SF + 'navy-blue-casual-suit-with-white-jeans-aa74542541a14138b71e0a4f6f0bb040'], changes: 'compressed for the web.' },
  { id: 'tracksuit', name: 'Tracksuit', kind: 'garment', size: 1.5, credit: ['Tracksuit', 'mitalibera', SF + 'tracksuit-15fff609e9824abf8bec685f297f9994'], changes: 'compressed for the web.' },
  { id: 'hoodie-sport', name: 'Sport hoodie and pants', kind: 'garment', size: 1.5, credit: ['New Style Sport Hoodie Pants', 'Wearable3D', SF + 'new-style-sport-hoodie-pants-fb9d722d5c3642e1b0e659baf9e38498'], changes: 'compressed for the web.' },
  { id: 'tee-women', name: "Women's fitted T-shirt", kind: 'garment', size: .6, credit: ['T-Shirt for Female', 'DaaGHrii', SF + 't-shirt-for-female-fbd56879e5c54b53b3d75d987342c8f8'], changes: 'compressed for the web.' },
  { id: 'tee-men', name: "Men's T-shirts (pair)", kind: 'garment', size: .75, mats: [['Manches_et_dos', 'Sleeves and back'], ['Face_T', 'Front'], ['manches_longues', 'Long-sleeve tee'], ['Boutons', 'Buttons']], credit: ['T-shirts homme', 'newmag2207', SF + 't-shirts-homme-40f97ee4740140528ad83173fba68f3c'], changes: 'hangers removed, compressed for the web.' },
  { id: 'jeans-oversized', name: 'Oversized baggy jeans', kind: 'garment', size: 1.05, mats: [['Pants', 'Jeans']], credit: ['Oversized Baggy Custom Jeans', 'SKVORSOW', SF + 'oversized-baggy-custom-jeans-a663bab1b858417da8c1b1765793309d'], changes: 'display body removed, compressed for the web.' },
  { id: 'hoodie-flame', name: 'Black hoodie with flame stitching', kind: 'garment', size: 0.75, credit: ['Classic Black Flame Hoodie', 'kril', SF + 'classic-black-flame-hoodie-0fd0effa321e456cb2a7467e2899b658'], changes: 'compressed for the web.' },
  { id: 'hoodie-plain', name: 'Grey pullover hoodie', kind: 'garment', size: 0.75, credit: ['Hoodie', 'yogaminggames', SF + 'hoodie-2c674228f1e946b5b8f508f8f818e130'], changes: 'compressed for the web.' },
];

/* bags (0.9.6): real scans from the owner's Drive folder, CC BY 4.0 */
export const SCAN_BAGS: ScanItem[] = [
  { id: 'bag-backpack-scan', name: 'Canvas day backpack', kind: 'object', size: 0.45, credit: ['Backpack Photoscan', 'alitural', SF + 'backpack-photoscan-bbbb1521eb0a4c0296cf515503efb5ca'], changes: 'compressed for the web.' },
  { id: 'bag-crochet', name: 'Crochet tote', kind: 'object', size: 0.5, credit: ['Crochet Tote Bag', 'eeelabvisual', SF + 'crochet-tote-bag-d76511a43def48d38dd18849fddc8e4d'], changes: 'compressed for the web.' },
  { id: 'bag-hand-lk', name: 'Black leather handbag', kind: 'object', size: 0.38, credit: ['Handbag', 'Lassi Kaukonen', SF + 'handbag-3c225122b8124e578f92acbce5cddba3'], changes: 'compressed for the web.' },
  { id: 'bag-hand-rf', name: 'Red leather work bag', kind: 'object', size: 0.42, credit: ['Handbag', 'robotikfoto', SF + 'handbag-8f53925a17bb4c30bb6f72994a201c83'], changes: 'compressed for the web.' },
  { id: 'bag-worn', name: 'Worn leather doctor bag', kind: 'object', size: 0.4, credit: ['Worn leather handbag', 'Lassi Kaukonen', SF + 'worn-leather-handbag-0732e0dfee7747e49cef95f3d179d880'], changes: 'compressed for the web.' },
  { id: 'bag-leather-pbr', name: 'Small crossbody bag', kind: 'object', size: 1.1, credit: ['Leather bag PBR MR', 'SetZar', SF + 'leather-bag-pbr-mr-7fccbb1074a64a079cd58003f84402ee'], changes: 'compressed for the web.' },
  { id: 'bag-guitar', name: 'Adventure guitar backpack', kind: 'object', size: 0.95, credit: ['Survival Guitar Backpack', 'Berk Gedik', SF + 'survival-guitar-backpack-799f8c4511f84fab8c3f12887f7e6b36'], changes: 'compressed for the web.' },
  { id: 'bag-teen', name: 'Cat-print mini backpack', kind: 'object', size: 0.32, nd: true, credit: ['Teen Handbag', 'Qlone', SF + 'teen-handbag-3f742027ff7640fc8d8eac2a45366bb3'], changes: 'compressed for the web only (no other change).' },
];
/* watches, jewellery and glasses (0.9.6): real models from the owner's Drive folder */
export const SCAN_JEWEL: ScanItem[] = [
  { id: 'watch-chrono', name: 'Green chronograph, leather strap', kind: 'object', size: 0.24, credit: ['Sea-Gull 1963 Chronograph Watch (38mm)', 'jb', SF + 'sea-gull-1963-chronograph-watch-38mm-20dd01bf520c43b09ea1f405629089db'], changes: 'maker’s name removed from the dial, compressed for the web.' },
  { id: 'watch-titan', name: 'Titanium diver watch', kind: 'object', size: 0.22, credit: ['BOCCIA Titanium Wrist Watch | animatable', 'BlackCube', SF + 'boccia-titanium-wrist-watch-animatable-8136799785b0440e8507b46574de282b'], changes: 'maker’s name removed from the dial, compressed for the web.' },
  { id: 'watch-wrist', name: 'Black steel automatic', kind: 'object', size: 0.22, credit: ['Wrist Watch', 'Dinesh Naidu', SF + 'wrist-watch-cd471b55a205468ba87a2e8494a99746'], changes: 'maker’s name removed from the dial, compressed for the web.' },
  { id: 'watch-oil', name: 'Skeleton watch, black strap', kind: 'object', size: 0.25, credit: ['Black Derrick Wrist Watch Oil', 'dazstacey', SF + 'black-derrick-wrist-watch-oil-c4a5b06a95874eddb666381ecccde127'], changes: 'maker’s name removed from the strap ring, compressed for the web.' },
  { id: 'watch-ly', name: 'Silver chronograph bracelet watch', kind: 'object', size: 0.22, credit: ['Light Yagami’s Wrist watch', '1user', SF + 'light-yagamis-wrist-watch-238930a5e57e49109dbb3350c316db62'], changes: 'compressed for the web.' },
  { id: 'watch-mk', name: 'Gold bracelet watch', kind: 'object', size: 0.2, credit: ['Watch', 'Munawar-Khan', SF + 'watch-bcde19f632744b4481d26f63d54f2377'], changes: 'compressed for the web.' },
  { id: 'jw-diamond', name: 'Diamond ring', kind: 'object', size: 0.024, credit: ['Diamond Ring | 3D Model', 'Zaara Nakhwa', SF + 'diamond-ring-3d-model-b01aec45aa754f50b4c8677fce899870'], changes: 'compressed for the web.' },
  { id: 'jw-item', name: 'Carved pearl ring', kind: 'object', size: 0.024, credit: ['Jewelry_item', 'offshoreclipping', SF + 'jewelry-item-cb5e918f99094490853527781d72e489'], changes: 'compressed for the web.' },
  { id: 'jw-placement', name: 'Pink stone bracelet', kind: 'object', size: 0.075, credit: ['Jewelry product placement', '3DbyL1ndo', SF + 'jewelry-product-placement-9747776bbc194f5a921d508cb02d19d8'], changes: 'compressed for the web.' },
  { id: 'jw-set', name: 'Gold pendant necklace', kind: 'object', size: 0.45, credit: ['jewelry', 'Mrhigh', SF + 'jewelry-19b0f1e81d844c4fba7eca5bfbd67c1a'], changes: 'compressed for the web.' },
  { id: 'jw-elebrith', name: 'Enamel butterfly brooch', kind: 'object', size: 0.07, credit: ['Jewelry Elebrith C', 'pocolov', SF + 'jewelry-elebrith-c-63d28d885a004ab181a7a6c4be11556c'], changes: 'compressed for the web.' },
  { id: 'jw-spear', name: 'Carved spear pendant', kind: 'object', size: 0.05, credit: ['Jewelry - Spear', 'VitaliyBurovArt', SF + 'jewelry-spear-cc29cf51679b4655adbeea719e76795e'], changes: 'compressed for the web.' },
  { id: 'jw-cross', name: 'Cross on a chain', kind: 'object', size: 0.5, credit: ['Jewelry Christian Cross', 'TECKNO', SF + 'jewelry-christian-cross-77bd1f3c89124fcfbea03abcc942fa74'], changes: 'compressed for the web.' },
  { id: 'jw-stylized', name: 'Winged jewellery set', kind: 'object', size: 0.3, credit: ['Stylized Jewelry', 'Truogannn', SF + 'stylized-jewelry-c1a87c0572934b0c8557bfbea85934e4'], changes: 'compressed for the web.' },
  { id: 'gl-aviator', name: 'Gold aviator sunglasses', kind: 'object', size: 0.14, credit: ['Aviator sunglasses', 'Kimppo', SF + 'aviator-sunglasses-00d1cb5aa82745228a3b764c97f867de'], changes: 'compressed for the web.' },
  { id: 'gl-sunnies', name: 'Red-lens square sunglasses', kind: 'object', size: 0.14, credit: ['sunnies studios sunglasses', 'Amine GND', SF + 'sunnies-studios-sunglasses-6fc6fc38ebad42488155a2917520a1a1'], changes: 'compressed for the web.' },
  { id: 'gl-cat', name: 'Black cat-eye sunglasses', kind: 'object', size: 0.15, credit: ['GOTHAM CAT SUNGLASSES', 'Ahmad Riazi', SF + 'gotham-cat-sunglasses-e14cbe04d57c4245b7b43a3fc09d1331'], changes: 'compressed for the web.' },
  { id: 'gl-simple', name: 'Oversized round sunglasses', kind: 'object', size: 0.145, credit: ['Sunglasses', 'photon (that one larry)', SF + 'sunglasses-158b197af97a40f599ed9d3759bc7dae'], changes: 'compressed for the web.' },
  { id: 'gl-mech', name: 'Round metal sunglasses', kind: 'object', size: 0.14, credit: ['Sunglasses: mechanics of the object homework', 'necrodream', SF + 'sunglasses-mechanics-of-the-object-homework-71ca2ea2b6334461bc48afe8da0ba3b3'], changes: 'compressed for the web.' },
];
