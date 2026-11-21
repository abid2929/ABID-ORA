// @ts-nocheck
/* Shared watch builder, ported from the approved Watches previews (prev/watches/kit.js). */
/* Abidora Watches: a procedural, physically based watch (1 unit = 1 mm).
   Dial faces +Y, 12 o'clock is -Z, 3 o'clock (crown, date) is +X. Nothing here is a picture: every part is geometry. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;

/* ---------- textures drawn in code ---------- */
function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }

/* sunburst: fine radial brushing; each thin angular sector tilts the surface a little, so light fans across the dial */
function sunburstNormal(size = 1024) {
  const [c, g] = canvas(size); const im = g.createImageData(size, size); const d = im.data; const h = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - h, dy = y - h, r = Math.hypot(dx, dy) + 1e-6, a = Math.atan2(dy, dx);
    const k = Math.floor((a / TAU + .5) * 2400), n = (hash(k) - .5) * .5 + (hash(k * 3.1 + Math.floor(r / 9)) - .5) * .12;
    const tx = -dy / r, ty = dx / r;                       // tangent of the circle: grooves run radially, so they tilt sideways
    const nx = tx * n, ny = ty * n, nz = 1; const l = Math.hypot(nx, ny, nz);
    const i = (y * size + x) * 4; d[i] = (nx / l * .5 + .5) * 255; d[i + 1] = (ny / l * .5 + .5) * 255; d[i + 2] = (nz / l * .5 + .5) * 255; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.anisotropy = 8; return t;
}

/* circular graining (perlage) for the movement plate */
function perlageNormal(size = 512) {
  const [c, g] = canvas(size); g.fillStyle = 'rgb(128,128,255)'; g.fillRect(0, 0, size, size);
  const R = size / 14;
  for (let j = 0; j < 22; j++) for (let i = 0; i < 22; i++) {
    const cx = i * R * .72 + (j % 2) * R * .36, cy = j * R * .66;
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * TAU; g.strokeStyle = `rgb(${128 + Math.cos(a) * 70 | 0},${128 + Math.sin(a) * 70 | 0},230)`;
      g.lineWidth = 1.2; g.beginPath(); g.arc(cx, cy, R * (.15 + k / 18 * .85), a, a + 1.2); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* Côtes de Genève: parallel waves across the bridges */
function stripesNormal(size = 512) {
  const [c, g] = canvas(size); const im = g.createImageData(size, size); const d = im.data;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = (x / size * 9) % 1, s = Math.sin(p * Math.PI) , nx = Math.cos(p * Math.PI) * .55, l = Math.hypot(nx, 1);
    const i = (y * size + x) * 4; d[i] = (nx / l * .5 + .5) * 255; d[i + 1] = 128; d[i + 2] = (1 / l * .5 + .5) * 255 * (.9 + s * .1); d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/* leather: pores + creases, plus a colour map with a stitch line along both edges */
function leatherMaps(color = '#4a2a17') {
  const W = 256, H = 1024;
  const [cn, gn] = canvas(W, H); const im = gn.createImageData(W, H); const d = im.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = hash(x * 13.7 + y * 7.3), q = hash(Math.floor(x / 5) * 3.3 + Math.floor(y / 5) * 9.1);
    const nx = (p - .5) * .35 + (q - .5) * .25, ny = (hash(x * 3.1 + y * 17.9) - .5) * .35;
    const i = (y * W + x) * 4; d[i] = (nx * .5 + .5) * 255; d[i + 1] = (ny * .5 + .5) * 255; d[i + 2] = 240; d[i + 3] = 255;
  }
  gn.putImageData(im, 0, 0);
  const [cc, gc] = canvas(W, H); gc.fillStyle = color; gc.fillRect(0, 0, W, H);
  for (let k = 0; k < 2600; k++) { gc.fillStyle = `rgba(0,0,0,${Math.random() * .08})`; gc.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  gc.fillStyle = '#d9c7a8';
  for (let y = 6; y < H; y += 14) { gc.fillRect(18, y, 3, 8); gc.fillRect(W - 21, y, 3, 8); }
  const n = new THREE.CanvasTexture(cn); n.colorSpace = THREE.NoColorSpace; n.wrapS = n.wrapT = THREE.RepeatWrapping;
  const m = new THREE.CanvasTexture(cc); m.colorSpace = THREE.SRGBColorSpace; m.wrapS = m.wrapT = THREE.RepeatWrapping;
  return { map: m, normalMap: n };
}

/* dial print: brand, line of text, and the minute track (printed on the dial, not the flange) */
function dialPrint(ink) {
  const S = 2048, [c, g] = canvas(S), h = S / 2, k = S / 32;    // dial is 32 mm across -> k px per mm
  g.clearRect(0, 0, S, S); g.fillStyle = ink; g.strokeStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * TAU, r1 = 15.4 * k, r0 = (i % 5 ? 14.7 : 14.2) * k;
    g.lineWidth = i % 5 ? 2.2 : 4.4; g.beginPath(); g.moveTo(h + Math.sin(a) * r0, h - Math.cos(a) * r0); g.lineTo(h + Math.sin(a) * r1, h - Math.cos(a) * r1); g.stroke();
  }
  g.font = `400 ${1.9 * k}px "Instrument Serif", "Cormorant Garamond", Georgia, serif`; g.fillText('Abidora', h, h - 5.6 * k);
  g.font = `500 ${.62 * k}px "JetBrains Mono", "IBM Plex Mono", ui-monospace, monospace`;
  g.fillText('AUTOMATIC  ·  CAL. A-01', h, h + 5.4 * k);
  g.font = `500 ${.5 * k}px "JetBrains Mono", ui-monospace, monospace`; g.globalAlpha = .7;
  g.fillText('28 800 VPH  ·  100 M', h, h + 6.5 * k);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function dateTex(day, dark) {
  const [c, g] = canvas(128, 96); g.fillStyle = dark ? '#f3efe6' : '#141414'; g.fillRect(0, 0, 128, 96);
  g.fillStyle = dark ? '#111' : '#eee'; g.font = '600 64px "Inter Tight", "Inter", Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(day), 64, 52); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ---------- materials ---------- */
export function materials() {
  const M = {
    brushed: new THREE.MeshPhysicalMaterial({ color: 0xd9dadd, metalness: 1, roughness: .3, anisotropy: .85 }),
    polished: new THREE.MeshPhysicalMaterial({ color: 0xe6e7ea, metalness: 1, roughness: .06 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xe9c47c, metalness: 1, roughness: .18 }),
    rose: new THREE.MeshPhysicalMaterial({ color: 0xe7b394, metalness: 1, roughness: .2 }),
    blued: new THREE.MeshPhysicalMaterial({ color: 0x2a4fb8, metalness: 1, roughness: .22 }),
    lume: new THREE.MeshPhysicalMaterial({ color: 0xeef2e4, roughness: .55, emissive: 0x7dffb0, emissiveIntensity: .05 }),
    red: new THREE.MeshPhysicalMaterial({ color: 0xd8462e, roughness: .35, clearcoat: 1 }),
    ruby: new THREE.MeshPhysicalMaterial({ color: 0xff2b55, roughness: .02, transmission: .9, thickness: .6, ior: 1.77, attenuationColor: new THREE.Color(0x9a0628), attenuationDistance: .4 }),
    crystal: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transmission: 1, thickness: .5, ior: 1.77,
      iridescence: .35, iridescenceIOR: 1.35, iridescenceThicknessRange: [180, 420], specularIntensity: 1 }),
    plate: new THREE.MeshPhysicalMaterial({ color: 0xc9cbcf, metalness: 1, roughness: .38, normalMap: perlageNormal(), normalScale: new THREE.Vector2(.5, .5) }),
    bridge: new THREE.MeshPhysicalMaterial({ color: 0xd3d5d8, metalness: 1, roughness: .24, normalMap: stripesNormal(), normalScale: new THREE.Vector2(.35, .35) }),
    dial: new THREE.MeshPhysicalMaterial({ color: 0x0f1f47, metalness: .55, roughness: .3, clearcoat: .8, clearcoatRoughness: .08, normalMap: sunburstNormal(), normalScale: new THREE.Vector2(.9, .9) }),
    print: new THREE.MeshBasicMaterial({ alphaTest: .35, polygonOffset: true, polygonOffsetFactor: -2 }),   // opaque pass, so it shows through the sapphire
  };
  M.plate.normalMap.repeat.set(3, 3);
  return M;
}

/* ---------- small geometry helpers ---------- */
function lathe(pts, seg = 160) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function mesh(g, m, cast = true) { const o = new THREE.Mesh(g, m); o.castShadow = cast; o.receiveShadow = true; return o; }

function handShape(len, w, tail, kind) {
  const s = new THREE.Shape();
  if (kind === 'sec') { s.moveTo(-.12, -tail); s.lineTo(.12, -tail); s.lineTo(.07, len); s.lineTo(-.07, len); s.closePath(); return s; }
  const tip = kind === 'hour' ? .55 : .4;
  s.moveTo(-w * .32, -tail); s.lineTo(w * .32, -tail); s.lineTo(w * .5, len * .12); s.lineTo(w * tip, len * .88); s.lineTo(0, len); s.lineTo(-w * tip, len * .88); s.lineTo(-w * .5, len * .12); s.closePath();
  return s;
}
function hand(shape, depth, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .08, bevelSize: .08, bevelSegments: 2, curveSegments: 4 });
  g.rotateX(-Math.PI / 2); return mesh(g, mat);
}

/* gear outline with teeth and spokes */
export function gearGeo(teeth, r, h, hole = .35) {
  const s = new THREE.Shape(), ro = r, ri = r * (1 - 2.3 / teeth * 1.6);
  for (let i = 0; i < teeth; i++) {
    const a0 = i / teeth * TAU, a1 = (i + .25) / teeth * TAU, a2 = (i + .5) / teeth * TAU, a3 = (i + .75) / teeth * TAU;
    const P = (a, rr) => [Math.cos(a) * rr, Math.sin(a) * rr];
    const p0 = P(a0, ri), p1 = P(a1, ro), p2 = P(a2, ro), p3 = P(a3, ri);
    if (!i) s.moveTo(...p0); else s.lineTo(...p0); s.lineTo(...p1); s.lineTo(...p2); s.lineTo(...p3);
  }
  s.closePath();
  if (r > 2.2) for (let k = 0; k < 4; k++) {          // four windows between the spokes
    const p = new THREE.Path(), a = k / 4 * TAU, w = TAU / 4 - .55, r1 = r * .3, r2 = ri * .82;
    p.absarc(0, 0, r2, a + .27, a + .27 + w, false); p.absarc(0, 0, r1, a + .27 + w, a + .27, true); s.holes.push(p);
  }
  const hp = new THREE.Path(); hp.absarc(0, 0, hole, 0, TAU, true); s.holes.push(hp);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g;
}

/* a strap or bracelet path: lug (12 o'clock) down round a pillow and back to the other lug, in the YZ plane */
export function strapCurve() {
  const half = [[-23.6, -2.3], [-23.4, -6.8], [-22.4, -12], [-22, -17.5], [-21.2, -24.6], [-18.6, -28.7], [-14.6, -31.2], [-7, -32.2], [0, -32.3]];
  const pts = half.concat(half.slice(0, -1).reverse().map(([z, y]) => [-z, y])).map(([z, y]) => new THREE.Vector3(0, y, z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

/* a band with a rounded-rectangle cross-section that follows a curve; u goes across the band, v along it */
export function bandGeo(curve, width, thick, n = 240) {
  const sec = [], r = Math.min(thick / 2 - .05, 1.1), hw = width / 2, ht = thick / 2;
  const corner = (cx, cy, a0) => { for (let k = 0; k <= 4; k++) { const a = a0 + k / 4 * Math.PI / 2; sec.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } };
  corner(hw - r, ht - r, 0); corner(-hw + r, ht - r, Math.PI / 2); corner(-hw + r, -ht + r, Math.PI); corner(hw - r, -ht + r, Math.PI * 1.5);
  const m = sec.length, lens = [0]; for (let k = 1; k <= m; k++) { const a = sec[k - 1], b = sec[k % m]; lens.push(lens[k - 1] + Math.hypot(a[0] - b[0], a[1] - b[1])); }
  const pos = [], uv = [], idx = [], X = new THREE.Vector3(1, 0, 0), T = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3();
  const L = curve.getLength();
  for (let i = 0; i <= n; i++) {
    const u = i / n; curve.getPointAt(u, P); curve.getTangentAt(u, T); N.crossVectors(X, T).normalize();
    for (let k = 0; k <= m; k++) { const [sx, sn] = sec[k % m]; pos.push(P.x + sx, P.y + N.y * sn, P.z + N.z * sn);
      /* the outer face (top edge of the section, k from 5 to 9) gets u 0..1; everything else shares the edges */
      uv.push(((-sx / width) + .5), u * L / 26); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < m; k++) { const a = i * (m + 1) + k, b = a + 1, c = a + m + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ---------- the watch ---------- */
export function buildWatch(M, opt = {}) {
  const W = new THREE.Group(); W.name = 'watch';
  const parts = {};                                               // named groups, used by the exploded view

  /* case middle, brushed flanks */
  const mid = new THREE.Group(); parts.case = mid; W.add(mid);
  mid.add(mesh(lathe([[16.2, -4.2], [17.8, -4.3], [19.3, -3.9], [20.1, -2.6], [20.35, 0], [20.15, 2.2], [19.6, 3.0], [16.9, 3.0]]), M.brushed));
  /* lugs: a curved side profile that grows out of the case and bends down towards the wrist */
  const ls = new THREE.Shape(); ls.moveTo(14, -3.9); ls.lineTo(14, 2.6); ls.bezierCurveTo(18, 2.7, 21.5, 1.9, 24.2, -.6); ls.quadraticCurveTo(24.9, -1.5, 24.4, -2.6);
  ls.bezierCurveTo(22.6, -3.4, 20, -3.6, 17.5, -3.95); ls.closePath();
  const lugG = new THREE.ExtrudeGeometry(ls, { depth: 3.2, bevelEnabled: true, bevelThickness: .45, bevelSize: .45, bevelSegments: 4, curveSegments: 16 });
  lugG.translate(0, 0, -1.6); lugG.rotateY(-Math.PI / 2);          /* profile now lies in the ZY plane, pointing to -Z after the flip below */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = mesh(lugG, M.brushed); l.position.x = sx * 11.6; l.scale.z = -sz; if (sz < 0) l.scale.z = 1; l.rotation.y = sz > 0 ? Math.PI : 0; l.scale.z = 1; mid.add(l);
  }
  /* crown with knurled edge, at 3 o'clock */
  const crown = new THREE.Group(); crown.position.set(21.2, -.2, 0); mid.add(crown);
  const cg = new THREE.CylinderGeometry(3, 3, 3.2, 64, 1); cg.rotateZ(Math.PI / 2); const cm = mesh(cg, M.polished); cm.position.x = 1.9; crown.add(cm);
  const tube = new THREE.CylinderGeometry(1.4, 1.4, 1.6, 24); tube.rotateZ(Math.PI / 2); crown.add(mesh(tube, M.brushed));
  const knG = new THREE.BoxGeometry(3.1, .45, .35);
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU, k = mesh(knG, M.polished, false); k.position.set(1.9, Math.cos(a) * 3, Math.sin(a) * 3); k.rotation.x = -a; crown.add(k); }
  parts.crown = crown;

  /* bezel, mirror polished */
  const bezel = mesh(lathe([[16.7, 3.0], [19.55, 3.0], [19.5, 3.7], [18.8, 4.35], [17.4, 4.6], [16.7, 4.45]]), M.polished); parts.bezel = bezel; W.add(bezel);

  /* dial */
  const dial = new THREE.Group(); parts.dial = dial; W.add(dial);
  const dg = new THREE.CircleGeometry(16.4, 128); dg.rotateX(-Math.PI / 2); const dm = mesh(dg, M.dial, false); dm.position.y = 2.0; dial.add(dm);
  const rehaut = mesh(new THREE.CylinderGeometry(16.7, 16.2, 1.0, 128, 1, true), M.brushed, false); rehaut.position.y = 2.6; dial.add(rehaut);
  const pg = new THREE.PlaneGeometry(32, 32); pg.rotateX(-Math.PI / 2); const pm = new THREE.Mesh(pg, M.print); pm.position.y = 2.03; pm.renderOrder = 2; dial.add(pm);
  const ink = () => (M.dial.color.getHSL({}).l > .5 ? '#16171a' : '#efeae0');
  const setPrint = () => { M.print.map?.dispose(); M.print.map = dialPrint(ink()); M.print.needsUpdate = true; };
  setPrint();
  /* applied indices: faceted bars with a lume insert; 12 o'clock is doubled, 3 is the date */
  const idxG = new RoundedBoxGeometry(1.15, .7, 3.4, 2, .2), lumG = new THREE.BoxGeometry(.55, .1, 2.6);
  for (let i = 0; i < 12; i++) {
    if (i === 3) continue;
    const a = i / 12 * TAU, xs = i === 0 ? [-1.1, 1.1] : [0];
    for (const off of xs) {
      const g = new THREE.Group(); g.rotation.y = -a; dial.add(g);
      const b = mesh(idxG, M.polished); b.position.set(off, 2.35, -11.9); g.add(b);
      const l = mesh(lumG, M.lume, false); l.position.set(off, 2.72, -11.9); g.add(l);
    }
  }
  /* date window at 3 o'clock, framed */
  const dw = new THREE.Group(); dw.position.set(11.4, 2.05, 0); dial.add(dw);
  const frame = mesh(new RoundedBoxGeometry(3.6, .5, 2.9, 2, .2), M.polished); frame.position.y = .15; dw.add(frame);
  const dpg = new THREE.PlaneGeometry(3.0, 2.3); dpg.rotateX(-Math.PI / 2); dpg.rotateY(-Math.PI / 2);
  const dmat = new THREE.MeshBasicMaterial({ map: dateTex(new Date().getDate(), true) }); const dpm = new THREE.Mesh(dpg, dmat); dpm.position.y = .42; dw.add(dpm);

  /* hands, stacked like a real movement: hour, minute, then seconds */
  const hands = new THREE.Group(); parts.hands = hands; W.add(hands);
  const hH = hand(handShape(8.6, 1.9, 1.6, 'hour'), .32, M.polished); hH.position.y = 3.0;
  const hM = hand(handShape(13.4, 1.45, 1.8, 'min'), .3, M.polished); hM.position.y = 3.45;
  const hS = hand(handShape(14.6, .25, 4.2, 'sec'), .14, M.red); hS.position.y = 3.95;
  const lumeH = hand(handShape(6.4, .9, -1.2, 'hour'), .08, M.lume); lumeH.position.y = .34; hH.add(lumeH);
  const lumeM = hand(handShape(10.8, .62, -1.6, 'min'), .08, M.lume); lumeM.position.y = .32; hM.add(lumeM);
  const cap = mesh(new THREE.CylinderGeometry(.75, .75, .5, 32), M.red); cap.position.y = 4.2;
  const cw = mesh(new THREE.CylinderGeometry(.55, .55, .14, 24), M.red); cw.position.set(0, .07, 3.7); hS.add(cw);
  hands.add(hH, hM, hS, cap);

  /* domed sapphire crystal with a blue anti-reflective bloom */
  const R = 120, th = Math.asin(16.9 / R), cg2 = new THREE.SphereGeometry(R, 96, 8, 0, TAU, 0, th);
  const crystal = mesh(cg2, M.crystal, false); crystal.position.y = 4.35 - R * Math.cos(th); parts.crystal = crystal; W.add(crystal);

  /* caseback with exhibition window, and the movement behind it */
  const back = new THREE.Group(); parts.back = back; W.add(back);
  const bc = mesh(new THREE.CylinderGeometry(12.2, 12.2, .5, 96), M.crystal, false); bc.position.y = -5.3; back.add(bc);
  back.add(mesh(lathe([[12.2, -5.75], [15.4, -5.55], [17.6, -4.95], [17.9, -4.3], [16.2, -4.3], [12.2, -4.6]]), M.brushed));

  const mv = movement(M); mv.group.position.y = -1.6; mv.group.rotation.x = Math.PI;   // bridges and rotor face the caseback
  parts.movement = mv.group; W.add(mv.group);

  /* time */
  const zone = { tz: opt.tz || undefined };
  const update = (now = Date.now(), dt = 0, tilt = null) => {
    let h, m, s;
    if (zone.tz) {
      const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone.tz, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(now));
      h = +p.find((x) => x.type === 'hour').value; m = +p.find((x) => x.type === 'minute').value; s = +p.find((x) => x.type === 'second').value;
    } else { const d = new Date(now); h = d.getHours(); m = d.getMinutes(); s = d.getSeconds(); }
    const frac = Math.floor((now % 1000) / 125) * .125;                     // 8 beats per second, like a 28,800 vph movement
    const sec = s + frac, min = m + sec / 60, hr = (h % 12) + min / 60;
    hS.rotation.y = -sec / 60 * TAU; hM.rotation.y = -min / 60 * TAU; hH.rotation.y = -hr / 12 * TAU;
    mv.tick(now, dt, sec, tilt);
  };
  return {
    group: W, parts, update, zone, mv,
    setDial(hex) { M.dial.color.set(hex); setPrint(); dmat.map.dispose(); dmat.map = dateTex(new Date().getDate(), true); },
    setCase(kind) { const c = kind === 'gold' ? 0xe9c47c : kind === 'rose' ? 0xe7b394 : 0xd9dadd; M.brushed.color.set(c); M.polished.color.set(c === 0xd9dadd ? 0xe6e7ea : c); },
  };
}

/* the automatic movement: plate, bridges, gear train, balance, rotor; all parts move at their true rates */
function movement(M) {
  const G = new THREE.Group();
  const plate = mesh(new THREE.CylinderGeometry(15.2, 15.2, 1.4, 96), M.plate); plate.position.y = 0; G.add(plate);
  const top = .7;
  /* gear train: centre wheel (1 turn per hour), third, fourth (1 turn per minute), escape wheel */
  const train = [
    { x: 0, z: 0, t: 80, r: 6.4, rate: 1 / 3600 },
    { x: -6.2, z: -5.6, t: 75, r: 4.6, rate: -1 / 450 },
    { x: -2.2, z: -10.4, t: 70, r: 4.2, rate: 1 / 60 },
    { x: 3.6, z: -9.6, t: 20, r: 2.4, rate: -1 / 10 },
  ];
  const wheels = train.map((w) => { const m = mesh(gearGeo(w.t, w.r, .3), M.gold); m.position.set(w.x, top + .1, w.z); G.add(m); return m; });
  /* bridges with Côtes de Genève */
  const bShape = new THREE.Shape(); bShape.moveTo(-14.5, 1.8); bShape.lineTo(1.5, 1.8); bShape.lineTo(7.5, -4.5); bShape.lineTo(10.5, -11.5); bShape.lineTo(6, -12.7);
  bShape.lineTo(-1, -6); bShape.lineTo(-9, -4.2); bShape.lineTo(-14.8, -.8); bShape.closePath();
  const bg = new THREE.ExtrudeGeometry(bShape, { depth: .9, bevelEnabled: true, bevelThickness: .15, bevelSize: .2, bevelSegments: 2 }); bg.rotateX(-Math.PI / 2);
  const bridge = mesh(bg, M.bridge); bridge.position.y = top + .55; bridge.scale.z = -1; G.add(bridge);
  /* jewels and blued screws on the bridge */
  for (const [x, z] of [[0, 0], [-6.2, -5.6], [-2.2, -10.4], [3.6, -9.6]]) {
    const j = mesh(new THREE.SphereGeometry(.55, 24, 12, 0, TAU, 0, Math.PI / 2), M.ruby, false); j.position.set(x, top + 1.7, z); G.add(j);
  }
  for (const [x, z] of [[-12.5, 0], [5, -6], [8.6, -10.8], [-7.5, -2.5]]) {
    const s = mesh(new THREE.CylinderGeometry(.75, .75, .35, 24), M.blued); s.position.set(x, top + 1.7, z); G.add(s);
    const sl = mesh(new THREE.BoxGeometry(1.5, .2, .22), M.plate, false); sl.position.set(x, top + 1.86, z); sl.rotation.y = hash(x * z) * 3; G.add(sl);
  }
  /* balance wheel with hairspring, beating at 4 Hz */
  const bal = new THREE.Group(); bal.position.set(8.4, top + .4, 3.6); G.add(bal);
  const rim = mesh(new THREE.TorusGeometry(4.2, .38, 12, 64), M.gold); rim.rotation.x = Math.PI / 2; bal.add(rim);
  for (let i = 0; i < 3; i++) { const sp = mesh(new THREE.BoxGeometry(8.2, .3, .5), M.gold); sp.rotation.y = i / 3 * Math.PI; bal.add(sp); }
  for (let i = 0; i < 8; i++) { const sw = mesh(new THREE.CylinderGeometry(.35, .35, .5, 12), M.gold); const a = i / 8 * TAU; sw.position.set(Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6); bal.add(sw); }
  const spiral = []; for (let i = 0; i <= 260; i++) { const a = i / 260 * TAU * 9, r = .7 + i / 260 * 2.6; spiral.push(new THREE.Vector3(Math.cos(a) * r, .45, Math.sin(a) * r)); }
  const hs = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiral), 600, .045, 4), M.blued, false); bal.add(hs);
  const cock = mesh(new RoundedBoxGeometry(2.6, .9, 9, 2, .3), M.bridge); cock.position.set(8.4, top + 1.6, 3.6); cock.rotation.y = .9; G.add(cock);
  /* winding rotor: a half disc that swings with gravity as the watch moves */
  const rotor = new THREE.Group(); rotor.position.y = 2.75; G.add(rotor);
  const rs = new THREE.Shape(); rs.absarc(0, 0, 14.6, 0, Math.PI, false); rs.lineTo(-3, 0); rs.absarc(0, 0, 3, Math.PI, 0, true); rs.closePath();
  const rg = new THREE.ExtrudeGeometry(rs, { depth: .8, bevelEnabled: true, bevelThickness: .12, bevelSize: .12, bevelSegments: 2, curveSegments: 48 }); rg.rotateX(Math.PI / 2);
  const rotorM = mesh(rg, M.rose); rotor.add(rotorM);
  const hub = mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.1, 32), M.polished); hub.position.y = -.4; rotor.add(hub);
  let ra = 1.2, rv = 0;
  return {
    group: G, rotor, balance: bal,
    tick(now, dt, sec, tilt) {
      const t = now / 1000;
      wheels.forEach((w, i) => { w.rotation.y = -t * train[i].rate * TAU; });
      wheels[2].rotation.y = -sec / 60 * TAU;                               // fourth wheel carries the seconds
      bal.rotation.y = Math.sin(t * TAU * 4) * 3.8;                        // ~ +/-220 degrees, 4 Hz
      if (dt > 0) {                                                        // rotor: pendulum under gravity, with bearing friction
        const g = tilt || new THREE.Vector2(0, -1);
        const target = Math.atan2(g.x, -g.y), strength = Math.min(1, g.length());
        rv += (-Math.sin(ra - target) * 9 * strength - rv * 1.4) * dt; ra += rv * dt;
      }
      rotor.rotation.y = ra;
    },
    swing(v) { rv += v; },
  };
}

/* ---------- studio lighting built from light panels, rendered into an environment map ---------- */
export function studioEnv(renderer, panels, bg = 0x000000) {
  const s = new THREE.Scene(); s.background = new THREE.Color(bg);
  for (const p of panels) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.c ?? 0xffffff).multiplyScalar(p.i), side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(...p.p); m.lookAt(0, 0, 0); s.add(m);
  }
  const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(s, .02); pm.dispose(); return rt.texture;
}

/* ---------- helpers for pages ---------- */
export function tier() {
  const phone = matchMedia('(max-width: 760px)').matches || /Android|iPhone|iPad/.test(navigator.userAgent);
  return { phone, dpr: Math.min(devicePixelRatio || 1, phone ? 1.6 : 2) };
}
export function tween(from, to, ms, set, ease = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)) {
  const t0 = performance.now(); let raf = 0;
  const step = () => { const k = Math.min(1, (performance.now() - t0) / ms); set(ease(k)); if (k < 1) raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
}
export { leatherMaps, RoundedBoxGeometry, THREE };
