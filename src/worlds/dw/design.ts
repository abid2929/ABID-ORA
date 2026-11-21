// @ts-nocheck
/* World 30 · Creative Design. A packaging studio on a designer's desk. Enter the product's size and get a
   print-ready reverse tuck-end box dieline at true millimetre scale; design the artwork (colour, pattern,
   brand name, tagline); then watch the real 3D box fold up from the flat sheet, panel by panel, about its
   true fold lines. Fold lines are found by matching shared panel edges. Download the dieline (SVG, mm) and the
   printed artwork (PNG). Units: box geometry in mm; the scene is 1 unit = 100 mm. */
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { THREE, OrbitControls, renderer, panel, range, chips, buttons, note, toast, loop, fit, el, tween,
  cv, tex, noise2, fbm, rng, clamp, lerp, store, download, panelEnv, TAU } from './akit';

const SHEETS = { A4: [210, 297], A3: [297, 420], SRA3: [320, 450], B1: [707, 1000] };
const PALETTES = { tomato: ['#e0482c', '#fff4e6', '#1d1a17'], ink: ['#1f2a44', '#f3e9d2', '#e3b26b'], sage: ['#a9bfa3', '#24301f', '#f7f2e8'], blush: ['#f4c7c0', '#5a1f2b', '#ffffff'], kraft: ['#c9a27a', '#2b2018', '#f5efe4'], noir: ['#141414', '#f2efe9', '#d4af37'] };
const PATTERNS = ['plain', 'stripes', 'dots', 'waves', 'grid', 'confetti'];

/* ---------- the dieline: a reverse tuck-end box (same geometry as the site's World 25 tool) ---------- */
export function build(L, W, D) {
  const tuck = Math.min(18, W * .6), glue = Math.min(15, W * .7), dust = W * .8;
  const rect = (x, y, w, hh) => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  const P = (name, poly, tone, hinge) => ({ name, poly, hinge, kids: [], tone });
  const front = P('front', rect(glue, 0, L, D), 1);
  const glueF = P('glue', [[0, 4], [glue, 0], [glue, D], [0, D - 4]], .8, { p: [glue, 0, 0], d: [0, 1, 0], sign: 1 });
  const s1 = P('side', rect(glue + L, 0, W, D), .85, { p: [glue + L, 0, 0], d: [0, 1, 0], sign: -1 });
  const back = P('back', rect(glue + L + W, 0, L, D), .95, { p: [glue + L + W, 0, 0], d: [0, 1, 0], sign: -1 });
  const s2 = P('side2', rect(glue + 2 * L + W, 0, W, D), .85, { p: [glue + 2 * L + W, 0, 0], d: [0, 1, 0], sign: -1 });
  const bx = glue + L + W;
  const lid = P('lid', rect(bx, -W, L, W), 1.05, { p: [bx, 0, 0], d: [1, 0, 0], sign: -1 });
  const lidTuck = P('tuck', [[bx + 2, -W - tuck + 3], [bx + L - 2, -W - tuck + 3], [bx + L, -W], [bx, -W]], 1.05, { p: [bx, -W, 0], d: [1, 0, 0], sign: -1 });
  const base = P('base', rect(glue, D, L, W), .75, { p: [glue, D, 0], d: [1, 0, 0], sign: 1 });
  const baseTuck = P('tuck', [[glue, D + W], [glue + L, D + W], [glue + L - 2, D + W + tuck - 3], [glue + 2, D + W + tuck - 3]], .75, { p: [glue, D + W, 0], d: [1, 0, 0], sign: 1 });
  const dustT = (x) => P('dust', [[x, 0], [x + W, 0], [x + W - 2, -dust * .55], [x + W * .3, -dust], [x + 1, -dust]], .7, { p: [x, 0, 0], d: [1, 0, 0], sign: -1 });
  const dustB = (x) => P('dust', [[x, D], [x + W, D], [x + W - 1, D + dust], [x + W * .7, D + dust], [x + 2, D + dust * .55]], .7, { p: [x, D, 0], d: [1, 0, 0], sign: 1 });
  lid.kids.push(lidTuck); base.kids.push(baseTuck);
  const d1t = dustT(glue + L), d2t = dustT(glue + 2 * L + W), d1b = dustB(glue + L), d2b = dustB(glue + 2 * L + W);
  s1.kids.push(back, d1t, d1b); back.kids.push(s2, lid); s2.kids.push(d2t, d2b);
  front.kids.push(glueF, s1, base);
  return { root: front, glue, tuck, dust };
}
const flatten = (p, out = []) => { out.push(p); p.kids.forEach((k) => flatten(k, out)); return out; };
/* the order panels close in, like folding a real carton: sides first, then glue, dust flaps, base, lid */
const ORDER = { side: 0, back: 1, side2: 2, glue: 3, dust: 4, base: 5, lid: 6, tuck: 7 };

function bounds(all) { const xs = all.flatMap((p) => p.poly.map((q) => q[0])), ys = all.flatMap((p) => p.poly.map((q) => q[1])); const x0 = Math.min(...xs), y0 = Math.min(...ys); return { x0, y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; }
function edges(all) {
  const key = (a, b) => { const k1 = `${a[0].toFixed(2)},${a[1].toFixed(2)}`, k2 = `${b[0].toFixed(2)},${b[1].toFixed(2)}`; return k1 < k2 ? k1 + '|' + k2 : k2 + '|' + k1; };
  const count = new Map(); for (const p of all) p.poly.forEach((a, i) => { const k = key(a, p.poly[(i + 1) % p.poly.length]); count.set(k, (count.get(k) ?? 0) + 1); });
  const out = [], done = new Set(); for (const p of all) p.poly.forEach((a, i) => { const b = p.poly[(i + 1) % p.poly.length], k = key(a, b); if (done.has(k)) return; done.add(k); out.push({ a, b, fold: count.get(k) > 1 }); });
  return out;
}

/* ---------- artwork, drawn over the whole flat sheet ---------- */
function artwork(model, all, A, L, W, D, pxmm = 6) {
  const B = bounds(all), [c, g] = cv(Math.ceil(B.w * pxmm), Math.ceil(B.h * pxmm)); const [bg, ink, acc] = PALETTES[A.pal];
  g.scale(pxmm, pxmm); g.translate(-B.x0, -B.y0);
  g.fillStyle = bg; g.fillRect(B.x0, B.y0, B.w, B.h);
  const R = rng(A.seed);
  g.save(); g.globalAlpha = .9;
  if (A.pat === 'stripes') { g.strokeStyle = acc; g.lineWidth = 4; for (let x = B.x0 - B.h; x < B.x0 + B.w; x += 11) { g.beginPath(); g.moveTo(x, B.y0); g.lineTo(x + B.h, B.y0 + B.h); g.stroke(); } }
  if (A.pat === 'dots') { g.fillStyle = acc; for (let y = B.y0; y < B.y0 + B.h; y += 9) for (let x = B.x0 + ((y / 9) % 2) * 4.5; x < B.x0 + B.w; x += 9) { g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); } }
  if (A.pat === 'waves') { g.strokeStyle = acc; g.lineWidth = 1.6; for (let y = B.y0; y < B.y0 + B.h; y += 7) { g.beginPath(); for (let x = B.x0; x <= B.x0 + B.w; x += 2) g.lineTo(x, y + Math.sin(x / 9 + y / 15) * 2.4); g.stroke(); } }
  if (A.pat === 'grid') { g.strokeStyle = acc; g.lineWidth = .5; for (let x = B.x0; x < B.x0 + B.w; x += 6) { g.beginPath(); g.moveTo(x, B.y0); g.lineTo(x, B.y0 + B.h); g.stroke(); } for (let y = B.y0; y < B.y0 + B.h; y += 6) { g.beginPath(); g.moveTo(B.x0, y); g.lineTo(B.x0 + B.w, y); g.stroke(); } }
  if (A.pat === 'confetti') { for (let i = 0; i < B.w * B.h / 60; i++) { g.fillStyle = [acc, ink, '#ffffff'][Math.floor(R() * 3)]; g.save(); g.translate(B.x0 + R() * B.w, B.y0 + R() * B.h); g.rotate(R() * TAU); g.fillRect(-2.2, -.7, 4.4, 1.4); g.restore(); } }
  g.restore();
  const panelOf = (n) => all.find((p) => p.name === n), box = (p) => { const xs = p.poly.map((q) => q[0]), ys = p.poly.map((q) => q[1]); return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }; };
  /* front and back: a label band with the brand */
  for (const n of ['front', 'back']) {
    const b = box(panelOf(n)), bh = Math.min(b.h * .42, b.w * .9);
    g.fillStyle = bg; g.fillRect(b.x + b.w * .08, b.y + b.h * .3, b.w * .84, bh);
    g.strokeStyle = ink; g.lineWidth = .5; g.strokeRect(b.x + b.w * .11, b.y + b.h * .3 + b.w * .03, b.w * .78, bh - b.w * .06);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = b.w * .2; g.font = `400 ${fs}px "Instrument Serif", Georgia, serif`; while (g.measureText(A.brand).width > b.w * .7 && fs > 3) { fs *= .92; g.font = `400 ${fs}px "Instrument Serif", Georgia, serif`; }
    g.fillText(A.brand, b.x + b.w / 2, b.y + b.h * .3 + bh * .42);
    g.font = `500 ${Math.max(2, b.w * .055)}px "Inter Tight", sans-serif`; g.fillStyle = ink; g.fillText(A.tag.toUpperCase(), b.x + b.w / 2, b.y + b.h * .3 + bh * .72);
    g.fillStyle = acc; g.beginPath(); g.arc(b.x + b.w / 2, b.y + b.h * .3 + bh * .14, Math.max(1.2, b.w * .03), 0, TAU); g.fill();
    g.font = `500 ${Math.max(2, b.w * .05)}px "JetBrains Mono", monospace`; g.fillStyle = ink; g.fillText(`${(L * W * D / 1000).toFixed(0)} ml`, b.x + b.w / 2, b.y + b.h * .9);
  }
  /* side: ingredients-style text and a barcode */
  { const b = box(panelOf('side')); g.save(); g.translate(b.x + b.w / 2, b.y + b.h / 2); g.rotate(-Math.PI / 2); g.fillStyle = ink; g.textAlign = 'center'; g.font = `500 ${Math.max(2, b.w * .14)}px "JetBrains Mono", monospace`; g.fillText(A.brand.toUpperCase(), 0, -b.w * .12); g.font = `400 ${Math.max(1.6, b.w * .08)}px "Inter Tight", sans-serif`; g.fillText('Designed in Abidora · Made with care', 0, b.w * .12); g.restore();
    const bc = box(panelOf('side2')); g.fillStyle = '#fff'; const bw = bc.w * .7, bh = Math.min(bc.h * .14, bw * .6), bx = bc.x + (bc.w - bw) / 2, by = bc.y + bc.h * .78; g.fillRect(bx - 1, by - 1, bw + 2, bh + 4); g.fillStyle = '#111';
    let x = bx + 1; const Rb = rng(A.brand.length * 31 + 7); while (x < bx + bw - 1) { const w = .25 + Rb() * .7; g.fillRect(x, by, w, bh - 1); x += w + .25 + Rb() * .5; } }
  /* lid: a monogram seal */
  { const b = box(panelOf('lid')); g.fillStyle = acc; g.beginPath(); g.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * .32, 0, TAU); g.fill(); g.fillStyle = bg; g.font = `400 ${Math.min(b.w, b.h) * .34}px "Instrument Serif", serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((A.brand[0] || 'A').toUpperCase(), b.x + b.w / 2, b.y + b.h / 2 + 1); }
  return { canvas: c, B };
}

/* ---------- the desk ---------- */
function cuttingMat() {
  const [c, g] = cv(2048, 1400); g.fillStyle = '#2f5b4a'; g.fillRect(0, 0, 2048, 1400);
  for (let i = 0; i <= 60; i++) { const x = i * 2048 / 60; g.strokeStyle = i % 5 ? 'rgba(220,240,230,.22)' : 'rgba(230,250,240,.55)'; g.lineWidth = i % 5 ? 1 : 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1400); g.stroke(); }
  for (let j = 0; j <= 41; j++) { const y = j * 1400 / 41; g.strokeStyle = j % 5 ? 'rgba(220,240,230,.22)' : 'rgba(230,250,240,.55)'; g.lineWidth = j % 5 ? 1 : 2; g.beginPath(); g.moveTo(0, y); g.lineTo(2048, y); g.stroke(); }
  g.strokeStyle = 'rgba(240,250,245,.35)'; g.lineWidth = 2; for (const a of [30, 45, 60]) { g.beginPath(); g.moveTo(0, 1400); g.lineTo(Math.cos(a * Math.PI / 180) * 1600, 1400 - Math.sin(a * Math.PI / 180) * 1600); g.stroke(); }
  g.fillStyle = 'rgba(230,250,240,.6)'; g.font = '22px monospace'; for (let i = 0; i <= 60; i += 5) g.fillText(String(i), i * 2048 / 60 + 4, 24);
  return c;
}
function walnutTop() {
  const n = noise2(4), W = 1024, [c, g] = cv(W, W / 2); const im = g.createImageData(W, W / 2);
  for (let y = 0; y < W / 2; y++) for (let x = 0; x < W; x++) { const v = fbm(n, x / 260, y / 6 + Math.sin(x / 140) * 2, 4), ring = Math.sin(v * 30) * .5 + .5, k = .7 + ring * .14 + v * .3, p = (y * W + x) * 4; im.data[p] = 120 * k; im.data[p + 1] = 82 * k; im.data[p + 2] = 56 * k; im.data[p + 3] = 255; }
  g.putImageData(im, 0, 0); return c;
}

export async function start(canvas, ui) {
  const R = renderer(canvas, { tone: THREE.ACESFilmicToneMapping, exposure: 1.05, keep: true });
  const phone = R.phone;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe9e2d6);
  const cam = new THREE.PerspectiveCamera(phone ? 50 : 38, 1, .05, 100);
  fit(R, cam, canvas);
  scene.environment = panelEnv(R, [{ w: 8, h: 5, p: [-4, 6, 3], i: 3.2, c: 0xfff4e4 }, { w: 6, h: 6, p: [5, 3, -2], i: 1.1, c: 0xe2ecff }, { w: 10, h: 10, p: [0, 10, 0], i: 1 }], 0xb8ad9c);
  scene.environmentIntensity = .7;
  const key = new THREE.DirectionalLight(0xfff1de, 3); key.position.set(-3, 7, 4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.bias = -.0003;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .5, far: 20 }); scene.add(key);
  scene.add(new THREE.HemisphereLight(0xfff8ef, 0x7a6450, .5));

  /* desk, cutting mat, ruler, pencil, knife, a coffee cup */
  const wt = tex(walnutTop()); const desk = new THREE.Mesh(new RoundedBoxGeometry(14, .3, 8, 3, .04), new THREE.MeshPhysicalMaterial({ map: wt, roughness: .45, clearcoat: .4, clearcoatRoughness: .25 }));
  desk.position.y = -.15; desk.receiveShadow = true; scene.add(desk);
  const mat = new THREE.Mesh(new RoundedBoxGeometry(6, .02, 4.1, 2, .008), new THREE.MeshStandardMaterial({ map: tex(cuttingMat()), roughness: .75 })); mat.position.y = .01; mat.receiveShadow = true; scene.add(mat);
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd8dade, metalness: 1, roughness: .22 });
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(4.5, .02, .35), steel); ruler.position.set(.3, .03, 1.75); ruler.rotation.y = .03; ruler.castShadow = ruler.receiveShadow = true; scene.add(ruler);
  { const p = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.6, 6), new THREE.MeshStandardMaterial({ color: 0xf2b830, roughness: .5 })); body.rotation.z = Math.PI / 2; body.castShadow = true; p.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.035, .16, 6), new THREE.MeshStandardMaterial({ color: 0xe8d2b0, roughness: .8 })); tip.rotation.z = -Math.PI / 2; tip.position.x = .88; p.add(tip); p.position.set(3.5, .05, .7); p.rotation.y = -.5; scene.add(p); }
  { const k = new THREE.Group(); const h = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x1f1f22, metalness: .5, roughness: .4 })); h.rotation.z = Math.PI / 2; h.castShadow = true; k.add(h);
    const bl = new THREE.Mesh(new THREE.ConeGeometry(.05, .26, 3), steel); bl.rotation.z = -Math.PI / 2; bl.position.x = .73; k.add(bl); k.position.set(3.6, .06, -1.1); k.rotation.y = .4; scene.add(k); }
  { const cup = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(.42, .36, .9, 48, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: .25, clearcoat: .8, side: THREE.DoubleSide })); body.position.y = .45; body.castShadow = true; cup.add(body);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(.36, 48), body.material); bottom.rotation.x = -Math.PI / 2; bottom.position.y = .02; cup.add(bottom);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(.4, 48), new THREE.MeshPhysicalMaterial({ color: 0x3a2214, roughness: .1, clearcoat: 1 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = .78; cup.add(coffee);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.2, .05, 12, 32, Math.PI), body.material); handle.position.set(.45, .48, 0); handle.rotation.z = -Math.PI / 2; cup.add(handle); cup.position.set(-4.4, 0, -1.6); scene.add(cup); }

  /* ---------- the box ---------- */
  const st0 = store('w30.box', { L: 70, W: 40, D: 120, sheet: 'A3', pal: 'tomato', pat: 'stripes', brand: 'Abidora', tag: 'Small batch tea', seed: 7 });
  const S = { ...st0.get() };
  const MM = .01;                                             // scene units per millimetre
  const holder = new THREE.Group(); holder.scale.set(MM, -MM, MM); holder.rotation.x = -Math.PI / 2; scene.add(holder);   // flat sheet lies on the mat, printed side up
  const printM = new THREE.MeshStandardMaterial({ roughness: .55, side: THREE.FrontSide });
  const boardM = new THREE.MeshStandardMaterial({ color: 0xe9e1d2, roughness: .9, side: THREE.BackSide });
  const edgeM = new THREE.MeshStandardMaterial({ color: 0xd9cdb8, roughness: .9 });
  const cutM = new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: .8 }), foldM = new THREE.LineDashedMaterial({ color: 0xe0312b, dashSize: 2, gapSize: 1.5, transparent: true, opacity: .9 });
  let model, all, nodes = [], art, dieSvg = '';
  let fold = 0, foldTo = 0;

  function rebuild() {
    holder.clear(); nodes = [];
    model = build(S.L, S.W, S.D); all = flatten(model.root);
    art = artwork(model, all, S, S.L, S.W, S.D, phone ? 5 : 7);
    printM.map?.dispose(); printM.map = tex(art.canvas); printM.needsUpdate = true;
    const B = art.B, uvOf = (x, y) => [(x - B.x0) / B.w, 1 - (y - B.y0) / B.h];
    const E = edges(all);
    const make = (p, parentOrigin) => {
      const o = p.hinge ? p.hinge.p : [0, 0, 0];
      const grp = new THREE.Group(); grp.position.set(o[0] - parentOrigin[0], o[1] - parentOrigin[1], o[2] - parentOrigin[2]);
      const sh = new THREE.Shape(p.poly.map(([x, y]) => new THREE.Vector2(x - o[0], y - o[1])));
      /* the board: printed face, plain inside face, and its cut edge */
      const g = new THREE.ShapeGeometry(sh); const uv = g.attributes.uv, pos = g.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, ...uvOf(pos.getX(i) + o[0], pos.getY(i) + o[1]));
      const face = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: printM.map, roughness: .5, side: THREE.DoubleSide })); face.position.z = .32; face.castShadow = true; face.receiveShadow = true;
      const inner = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xece4d4, roughness: .92, side: THREE.DoubleSide })); inner.position.z = -.32; inner.receiveShadow = true; inner.castShadow = true;
      const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: .5, bevelEnabled: false }), edgeM); rim.position.z = -.25; rim.castShadow = true;
      grp.add(face, inner, rim);
      /* cut and fold lines on this panel's edges, shown while the sheet is flat */
      const mine = E.filter((e) => p.poly.some((q) => q[0] === e.a[0] && q[1] === e.a[1]) && p.poly.some((q) => q[0] === e.b[0] && q[1] === e.b[1]));
      const cutP = [], foldP = []; for (const e of mine) (e.fold ? foldP : cutP).push(e.a[0] - o[0], e.a[1] - o[1], .45, e.b[0] - o[0], e.b[1] - o[1], .45);
      const lines = new THREE.Group(); grp.add(lines);
      if (cutP.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(cutP, 3)); lines.add(new THREE.LineSegments(lg, cutM)); }
      if (foldP.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(foldP, 3)); const ls = new THREE.LineSegments(lg, foldM); ls.computeLineDistances(); lines.add(ls); }
      const node = { p, grp, lines }; nodes.push(node);
      p.kids.forEach((k) => grp.add(make(k, o)));
      return grp;
    };
    const root = make(model.root, [0, 0, 0]);
    /* centre the flat sheet on the mat */
    root.position.set(-(B.x0 + B.w / 2), -(B.y0 + B.h / 2), 0); holder.add(root); holder.userData.root = root;
    dieline(); applyFold(); st0.set(S);
  }
  /* Like a real carton: the printed sheet is flipped face down, each hinge turns in its own slice of the fold so
     the panels close in order, then the finished box is stood up on its base. */
  const ax = new THREE.Vector3(), q = new THREE.Quaternion(), sm = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  function applyFold() {
    const flip = sm(fold / .12), kf = clamp((fold - .12) / .58, 0, 1), up = sm((fold - .72) / .28), steps = 8;
    for (const n of nodes) { const h = n.p.hinge; n.lines.visible = fold < .01; if (!h) continue;
      const i = ORDER[n.p.name] ?? 0, k = clamp(kf * steps - i * .82, 0, 1), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const ang = -h.sign * e * Math.PI / 2 * (n.p.name === 'tuck' || n.p.name === 'glue' ? .98 : 1);
      ax.set(h.d[0], h.d[1], h.d[2]); n.grp.quaternion.copy(q.setFromAxisAngle(ax, ang)); }
    const root = holder.userData.root, B = art.B, cb = sm(kf * 1.4);
    root.position.set(-lerp(B.x0 + B.w / 2, model.glue + S.L / 2, cb), -lerp(B.y0 + B.h / 2, S.D / 2, cb), 0);
    holder.rotation.x = -Math.PI / 2 + flip * Math.PI - up * Math.PI / 2;
    holder.position.y = .03 + Math.sin(flip * Math.PI) * .9 + up * (S.D / 2 * MM);
    holder.position.z = up * (S.W / 2 * MM);
  }

  /* dieline as SVG (true mm) and the facts a printer asks for */
  function dieline() {
    const B = bounds(all), pad = 5, E = edges(all);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${(B.w + 2 * pad).toFixed(1)}mm" height="${(B.h + 2 * pad).toFixed(1)}mm" viewBox="${B.x0 - pad} ${B.y0 - pad} ${B.w + 2 * pad} ${B.h + 2 * pad}">`;
    for (const e of E) svg += `<line x1="${e.a[0]}" y1="${e.a[1]}" x2="${e.b[0]}" y2="${e.b[1]}" stroke="${e.fold ? '#e0312b' : '#111'}" stroke-width="${e.fold ? .4 : .5}"${e.fold ? ' stroke-dasharray="2 1.5"' : ''}/>`;
    dieSvg = svg + '</svg>';
    const [sw, sh] = SHEETS[S.sheet], m = 10, fitN = (a, b) => Math.floor((sw - m) / (a + 4)) * Math.floor((sh - m) / (b + 4));
    let area = 0; for (const p of all) { let a = 0; p.poly.forEach((qq, i) => { const r = p.poly[(i + 1) % p.poly.length]; a += qq[0] * r[1] - r[0] * qq[1]; }); area += Math.abs(a) / 2; }
    const per = Math.max(fitN(B.w, B.h), fitN(B.h, B.w));
    sv.flat.textContent = `${Math.round(B.w)} × ${Math.round(B.h)} mm`; sv.area.textContent = `${(area / 100).toFixed(0)} cm²`; sv.fit.textContent = per ? `${per} on ${S.sheet}` : 'too big'; sv.vol.textContent = `${(S.L * S.W * S.D / 1000).toFixed(0)} ml`;
    sv.fit.style.color = per ? '' : '#c0392b';
  }

  /* ---------- UI ---------- */
  const P = panel(ui, { kicker: 'World 30 · Creative Design', title: 'The Packaging Studio', lede: 'Size a box for your product, design its print, and watch the real dieline fold into a 3D carton on the desk. Download the dieline and artwork for a printer.' });
  const sBox = P.section('Box');
  range(sBox, 'Length', { min: 20, max: 250, value: S.L, fmt: (n) => n + ' mm' }, (v) => { S.L = v; rebuild(); });
  range(sBox, 'Width', { min: 15, max: 150, value: S.W, fmt: (n) => n + ' mm' }, (v) => { S.W = v; rebuild(); });
  range(sBox, 'Height', { min: 20, max: 300, value: S.D, fmt: (n) => n + ' mm' }, (v) => { S.D = v; rebuild(); });
  chips(sBox, 'Print sheet', Object.keys(SHEETS).map((k) => [k, k]), S.sheet, (v) => { S.sheet = v; dieline(); st0.set(S); });
  const sv = P.stats(sBox, [['flat', 'Flat size'], ['area', 'Board area'], ['fit', 'Per sheet'], ['vol', 'Volume']]);
  const sArt = P.section('Artwork');
  const brandI = el('input', { type: 'text', value: S.brand, maxlength: 18, 'aria-label': 'Brand name' }); const tagI = el('input', { type: 'text', value: S.tag, maxlength: 28, 'aria-label': 'Tagline' });
  let tmr = 0; const upd = () => { clearTimeout(tmr); tmr = setTimeout(() => { S.brand = brandI.value.trim() || 'Abidora'; S.tag = tagI.value.trim(); rebuild(); }, 250); };
  brandI.addEventListener('input', upd); tagI.addEventListener('input', upd);
  sArt.append(el('label', { class: 'c-r' }, el('span', { class: 'c-lab' }, el('span', { text: 'Brand name' })), brandI), el('label', { class: 'c-r' }, el('span', { class: 'c-lab' }, el('span', { text: 'Tagline' })), tagI));
  chips(sArt, 'Colours', Object.entries(PALETTES).map(([k, v]) => [k, k[0].toUpperCase() + k.slice(1), v[0]]), S.pal, (v) => { S.pal = v; rebuild(); });
  chips(sArt, 'Pattern', PATTERNS.map((k) => [k, k[0].toUpperCase() + k.slice(1)]), S.pat, (v) => { S.pat = v; S.seed = (Math.random() * 1e6) | 0; rebuild(); });
  const sFold = P.section('Fold & export');
  const fr = range(sFold, 'Fold', { min: 0, max: 100, value: 0, fmt: (v) => v + '%' }, (v) => { stopF?.(); fold = foldTo = v / 100; applyFold(); });
  let stopF = null;
  const playFold = (to) => { stopF?.(); const f0 = fold; stopF = tween(Math.abs(to - f0) * 5200 + 200, (k) => { fold = lerp(f0, to, k); fr.set(Math.round(fold * 100)); applyFold(); }, () => (stopF = null)); };
  buttons(sFold, [['Fold it up', () => playFold(1), true], ['Lay it flat', () => playFold(0)]]);
  buttons(sFold, [['Dieline (SVG, mm)', () => download(`abidora-box-${S.L}x${S.W}x${S.D}.svg`, URL.createObjectURL(new Blob([dieSvg], { type: 'image/svg+xml' })))], ['Artwork (PNG)', () => { const a = artwork(model, all, S, S.L, S.W, S.D, 12); download(`abidora-box-art-${S.L}x${S.W}x${S.D}.png`, a.canvas.toDataURL('image/png')); }]]);
  note(sFold, 'A reverse tuck-end box: the lid tucks in at the back top, the base tucks in at the front bottom. In the dieline, solid black lines are cuts and red dashed lines are folds. Add about 1 mm per side for board thickness before production.');

  const orbit = new OrbitControls(cam, canvas); orbit.enableDamping = true; orbit.maxPolarAngle = Math.PI * .46; orbit.minDistance = 1.2; orbit.maxDistance = 14; orbit.target.set(0, .4, 0);
  const fab = el('div', { class: 'fab' });
  const bF = el('button', { 'aria-pressed': 'false', text: 'Fold it up', onclick: () => { const to = fold > .5 ? 0 : 1; playFold(to); bF.textContent = to ? 'Lay it flat' : 'Fold it up'; } });
  fab.append(bF); ui.append(fab);
  ui.append(el('div', { class: 'hint', text: phone ? 'Drag to turn · pinch to zoom' : 'Drag to turn · scroll to zoom' }));

  rebuild();
  cam.position.set(1.3, phone ? 4.2 : 2.7, phone ? 4.6 : 3.3); orbit.target.set(0, .45, 0);
  if (!/noauto/.test(location.search)) setTimeout(() => { playFold(1); bF.textContent = 'Lay it flat'; }, 1800);
  loop(() => { orbit.update(); R.render(scene, cam); R.adapt(); });
}
