/* World 9 · Future Technology: The Quantum Chamber.
   A dilution refrigerator (the gold "chandelier" real quantum computers hang in) holds a chip whose qubits glow with
   their chance of reading 1. Every qubit has its own glass Bloch sphere, and the outcome bars stand on the floor.
   The physics is the exact state-vector simulator of the earlier world (up to five qubits), unchanged. */
import * as THREE from 'three';
import { boot, studioEnv, sheet, linkView, h, css, range, btn, row, seg, stats, hud, store, cnv, tex, dotTex, grainNormal, TAU, clamp, lerp, isPhone, calm } from './tk.js';

/* ---------- simulator (from world 057, unchanged) ---------- */
const R2 = Math.SQRT1_2;
export const GATES = {
  H: [[R2, 0], [R2, 0], [R2, 0], [-R2, 0]], X: [[0, 0], [1, 0], [1, 0], [0, 0]], Y: [[0, 0], [0, -1], [0, 1], [0, 0]],
  Z: [[1, 0], [0, 0], [0, 0], [-1, 0]], S: [[1, 0], [0, 0], [0, 0], [0, 1]], T: [[1, 0], [0, 0], [0, 0], [R2, R2]],
};
export class State {
  constructor(n) { this.n = n; this.re = new Float64Array(1 << n); this.im = new Float64Array(1 << n); this.re[0] = 1; }
  apply(g, t, cmask = 0) {
    const U = GATES[g]; if (!U) return; const b = 1 << t, re = this.re, im = this.im;
    for (let i = 0; i < re.length; i++) {
      if (i & b || (i & cmask) !== cmask) continue; const j = i | b;
      const ar = re[i], ai = im[i], br = re[j], bi = im[j];
      re[i] = U[0][0] * ar - U[0][1] * ai + U[1][0] * br - U[1][1] * bi; im[i] = U[0][0] * ai + U[0][1] * ar + U[1][0] * bi + U[1][1] * br;
      re[j] = U[2][0] * ar - U[2][1] * ai + U[3][0] * br - U[3][1] * bi; im[j] = U[2][0] * ai + U[2][1] * ar + U[3][0] * bi + U[3][1] * br;
    }
  }
  probs() { const p = new Float64Array(this.re.length); for (let i = 0; i < p.length; i++) p[i] = this.re[i] ** 2 + this.im[i] ** 2; return p; }
  bloch(k) {
    const b = 1 << k; let r01r = 0, r01i = 0, p0 = 0, p1 = 0;
    for (let i = 0; i < this.re.length; i++) { if (i & b) continue; const j = i | b; r01r += this.re[i] * this.re[j] + this.im[i] * this.im[j]; r01i += this.im[i] * this.re[j] - this.re[i] * this.im[j]; p0 += this.re[i] ** 2 + this.im[i] ** 2; p1 += this.re[j] ** 2 + this.im[j] ** 2; }
    return [2 * r01r, -2 * r01i, p0 - p1];
  }
}
export function run(c, upto = Infinity) {
  const n = c.length, s = new State(n), cols = c[0]?.length ?? 0;
  for (let k = 0; k < Math.min(cols, upto); k++) {
    let cm = 0; for (let q = 0; q < n; q++) if (c[q][k] === '•') cm |= 1 << q;
    for (let q = 0; q < n; q++) { const g = c[q][k]; if (g && g !== '•') s.apply(g, q, cm); }
  }
  return s;
}
export function shots(p, n, R) { const out = new Uint32Array(p.length); for (let k = 0; k < n; k++) { let r = R(), i = 0; for (; i < p.length - 1; i++) { r -= p[i]; if (r <= 0) break; } out[i]++; } return out; }
export const COLS = 18;
const blank = (n) => Array.from({ length: n }, () => Array(COLS).fill(''));
export function preset(name) {
  const put = (n, cols) => { const c = blank(n); cols.forEach((col, k) => col.forEach(([q, g]) => { c[q][k] = g; })); return c; };
  const all = (n, g) => Array.from({ length: n }, (_, q) => [q, g]);
  if (name === 'super') return put(1, [[[0, 'H']]]);
  if (name === 'interf') return put(1, [[[0, 'H']], [[0, 'Z']], [[0, 'H']]]);
  if (name === 'bell') return put(2, [[[0, 'H']], [[0, '•'], [1, 'X']]]);
  if (name === 'ghz') return put(3, [[[0, 'H']], [[0, '•'], [1, 'X']], [[1, '•'], [2, 'X']]]);
  if (name === 'phase') return put(1, [[[0, 'H']], [[0, 'T']], [[0, 'T']], [[0, 'S']], [[0, 'H']]]);
  const oracle = [[[1, 'X']], [[0, '•'], [1, '•'], [2, 'Z']], [[1, 'X']]];
  const diffusion = [all(3, 'H'), all(3, 'X'), [[0, '•'], [1, '•'], [2, 'Z']], all(3, 'X'), all(3, 'H')];
  return put(3, [all(3, 'H'), ...oracle, ...diffusion, ...oracle, ...diffusion]);
}
export const ket = (i, n) => `|${i.toString(2).padStart(n, '0')}⟩`;
const GCOL = { H: '#e0b05a', X: '#e07a5f', Y: '#c77dba', Z: '#5fb3a1', S: '#6fa8dc', T: '#8e7cc3' };

/* ---------- labels ---------- */
function label(text, { size = 64, color = '#dfe6ff', font = "500 {s}px 'JetBrains Mono', monospace", w = 512 } = {}) {
  const [c, g] = cnv(w, 128); g.font = font.replace('{s}', size); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 64);
  const m = new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false }); const s = new THREE.Sprite(m); s.scale.set(w / 128 * .18, .18, 1); return s;
}

export async function start(canvas, ui) {
  css('q-css', `.q-grid{overflow-x:auto;margin:6px -4px 4px;padding:4px;scrollbar-width:thin}
  .q-g{display:grid;gap:3px;width:max-content}
  .q-c{width:38px;height:38px;border-radius:9px;border:1px solid rgba(160,180,255,.18);background:rgba(160,180,255,.05);color:#0d1020;font:700 15px 'Inter Tight',sans-serif;cursor:pointer;position:relative;padding:0}
  .q-c:before{content:"";position:absolute;left:-2px;right:-2px;top:50%;height:1px;background:rgba(190,205,255,.28);z-index:-1}
  .q-c.f{border-color:transparent}.q-c.cur{outline:2px solid #e8b04a;outline-offset:1px}
  .q-c.dim{opacity:.38}
  .q-l{font:500 12px 'JetBrains Mono',monospace;color:#aab4dd;display:grid;place-items:center;width:30px}
  .q-pal .tk-btn{min-width:46px;font-weight:700}`);

  const k = boot(canvas, { fov: 34, bloom: [.42, .5, .9], exposure: 1, bg: 0x04050b, fog: new THREE.FogExp2(0x04050b, .028) });
  const { scene, camera, controls, renderer } = k;
  scene.environment = studioEnv(renderer, { bg: 0x05060c, warm: 0xffd59a, cool: 0x9fb6ff, strength: 1.1 });
  scene.environmentIntensity = .9;
  camera.position.set(0, 3.3, 12.5); controls.target.set(0, 2.15, .6); controls.minDistance = 2.2; controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * .52;

  /* ---------- lights ---------- */
  const key = new THREE.SpotLight(0xfff1dc, 70, 18, .32, .8, 1.6); key.position.set(2.5, 8, 4); key.target.position.set(0, 1.5, 0); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.radius = 6; scene.add(key, key.target);
  const rim = new THREE.PointLight(0x6f8cff, 30, 12, 1.8); rim.position.set(-3.5, 3.2, -3); scene.add(rim);
  const under = new THREE.PointLight(0x7aa0ff, 4, 4, 2); under.position.set(0, 1.0, 0); scene.add(under);
  scene.add(new THREE.HemisphereLight(0x4a5a8a, 0x05060c, .35));

  /* ---------- floor: polished dark resin with a fine grain ---------- */
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshPhysicalMaterial({ color: 0x05060a, roughness: .3, metalness: 0, envMap: scene.environment, envMapIntensity: .05, clearcoat: .5, clearcoatRoughness: .1, normalMap: grainNormal(512, .08), normalScale: new THREE.Vector2(.25, .25) }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  /* an inlaid ring of light on the floor under the cryostat */
  const ringG = new THREE.RingGeometry(1.18, 1.22, 128); ringG.rotateX(-Math.PI / 2);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fb0ff).multiplyScalar(2.2) })); ring.position.y = .003; scene.add(ring);

  /* ---------- the dilution refrigerator ---------- */
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf2c46e, metalness: 1, roughness: .17, clearcoat: .3, normalMap: grainNormal(512, .05, .25), normalScale: new THREE.Vector2(.25, .25) });
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xe39a6e, metalness: 1, roughness: .26 });
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9ccd2, metalness: 1, roughness: .28 });
  const cable = new THREE.MeshPhysicalMaterial({ color: 0xb8bcc6, metalness: 1, roughness: .2 });
  const fridge = new THREE.Group(); fridge.position.y = .25; scene.add(fridge);
  const plates = [[1.05, 4.75, .07], [.95, 4.0, .06], [.84, 3.3, .055], [.74, 2.65, .05], [.62, 2.05, .05], [.5, 1.55, .045]];
  plates.forEach(([r, y, th], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 96), gold); p.position.y = y; p.castShadow = p.receiveShadow = true; fridge.add(p);
    /* a stepped lip on each plate */
    const lip = new THREE.Mesh(new THREE.TorusGeometry(r - .02, .018, 10, 120), gold); lip.rotation.x = Math.PI / 2; lip.position.y = y + th / 2; fridge.add(lip);
    /* bolts round the rim */
    const boltG = new THREE.CylinderGeometry(.018, .018, .02, 10);
    for (let b = 0; b < 16; b++) { const a = b / 16 * TAU, bo = new THREE.Mesh(boltG, steel); bo.position.set(Math.cos(a) * (r - .07), y + th / 2 + .01, Math.sin(a) * (r - .07)); fridge.add(bo); }
    /* posts to the plate below */
    if (i < plates.length - 1) {
      const [r2, y2] = plates[i + 1], n = 4, len = y - y2;
      for (let j = 0; j < n; j++) { const a = j / n * TAU + .4, rr = Math.min(r, r2) * .78;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, len, 16), j % 2 ? gold : copper); post.position.set(Math.cos(a) * rr, y2 + len / 2, Math.sin(a) * rr); post.castShadow = true; fridge.add(post); }
      /* a heat exchanger can between the stages */
      if (i % 2 === 1) { const can = new THREE.Mesh(new THREE.CylinderGeometry(.14, .14, len * .55, 40), copper); can.position.set(.22, y2 + len / 2, -.12); can.castShadow = true; fridge.add(can); }
    }
  });
  /* coaxial lines spiral down from the top plate to the chip */
  for (let c = 0; c < 9; c++) {
    const pts = [], a0 = c / 9 * TAU;
    for (let s = 0; s <= 24; s++) { const t = s / 24, y = lerp(4.95, 1.25, t), r = lerp(.62, .14, Math.pow(t, .8)) + .05 * Math.sin(t * 9 + c), a = a0 + t * 1.2; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, .011, 8), c % 3 ? cable : copper); tube.castShadow = true; fridge.add(tube);
  }
  /* top flange and the rod that holds everything */
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 4, 24), steel); rod.position.y = 6.8; fridge.add(rod);
  /* the chip package at the bottom */
  const pkg = new THREE.Group(); pkg.position.y = 1.18; fridge.add(pkg);
  const board = new THREE.Mesh(new THREE.BoxGeometry(.62, .05, .62), gold); board.castShadow = true; pkg.add(board);
  const [cc, cg] = cnv(512); cg.fillStyle = '#0b1230'; cg.fillRect(0, 0, 512, 512); cg.strokeStyle = 'rgba(140,170,255,.55)'; cg.lineWidth = 3;
  for (let i = 0; i < 26; i++) { cg.beginPath(); const x = 30 + i * 18; cg.moveTo(x, 20); cg.lineTo(x, 80 + (i % 5) * 30); cg.lineTo(256 + (i - 13) * 6, 220); cg.stroke(); }
  cg.strokeRect(150, 150, 212, 212);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(.34, .025, .34), new THREE.MeshPhysicalMaterial({ map: tex(cc), roughness: .25, metalness: .4, clearcoat: 1 }));
  chip.position.y = -.035; pkg.add(chip);
  const qDots = []; const dotM = (c) => new THREE.MeshBasicMaterial({ color: c });
  for (let q = 0; q < 5; q++) { const d = new THREE.Mesh(new THREE.SphereGeometry(.022, 16, 12), dotM(0x223060)); d.position.set((q - 2) * .06, -.052, 0); pkg.add(d); qDots.push(d); }
  const chipGlow = new THREE.PointLight(0x9fb8ff, 0, 1.6, 2); chipGlow.position.y = -.15; pkg.add(chipGlow);

  /* soft beams of light from above, and dust in the air */
  const beamM = new THREE.MeshBasicMaterial({ color: 0x8aa2ff, transparent: true, opacity: .018, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.ConeGeometry(1.9, 7, 64, 1, true), beamM); beam.position.y = 3.5; scene.add(beam);
  const dustN = isPhone() ? 260 : 520, dg = new THREE.BufferGeometry(), dp = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dp[i * 3] = (Math.random() - .5) * 9; dp[i * 3 + 1] = Math.random() * 6; dp[i * 3 + 2] = (Math.random() - .5) * 9; }
  dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ size: .035, map: dotTex(), transparent: true, opacity: .55, color: 0xaebfff, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  /* ---------- Bloch spheres ---------- */
  const blochs = [];
  const shellM = new THREE.MeshPhysicalMaterial({ color: 0xbfd0ff, roughness: .05, metalness: 0, transparent: true, opacity: .14, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
  const lineM = new THREE.LineBasicMaterial({ color: 0x9fb3ff, transparent: true, opacity: .45 });
  function circle(r, plane) { const pts = []; for (let i = 0; i <= 96; i++) { const a = i / 96 * TAU; pts.push(plane === 'xz' ? new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r) : plane === 'xy' ? new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0) : new THREE.Vector3(0, Math.cos(a) * r, Math.sin(a) * r)); } return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineM); }
  for (let q = 0; q < 5; q++) {
    const g = new THREE.Group(), R = .36;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), shellM), circle(R, 'xz'), circle(R, 'xy'), circle(R, 'yz'));
    const ax = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -R, 0), new THREE.Vector3(0, R, 0)]), lineM); g.add(ax);
    const arrM = new THREE.MeshPhysicalMaterial({ color: 0x7fe3cf, emissive: 0x7fe3cf, emissiveIntensity: .9, metalness: .2, roughness: .3 });
    const arrow = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1, 12), arrM); shaft.position.y = .5;
    const head = new THREE.Mesh(new THREE.ConeGeometry(.035, .09, 20), arrM); arrow.add(shaft, head); g.add(arrow);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(.02, 12, 8), arrM); g.add(tip);
    const l0 = label('|0⟩', { size: 54 }); l0.position.y = R + .12; l0.scale.multiplyScalar(.8); g.add(l0);
    const l1 = label('|1⟩', { size: 54 }); l1.position.y = -R - .12; l1.scale.multiplyScalar(.8); g.add(l1);
    const nm = label('q' + q, { size: 70, color: '#e8b04a' }); nm.position.y = -R - .32; g.add(nm);
    scene.add(g); blochs.push({ g, arrow, shaft, head, tip, arrM, R, cur: new THREE.Vector3(0, 1, 0), len: 1 });
  }

  /* ---------- outcome bars on the floor ---------- */
  const bars = new THREE.Group(); bars.position.set(0, 0, 2.3); scene.add(bars);
  let barObjs = [];
  function buildBars(n) {
    bars.clear(); barObjs = [];
    const N = 1 << n, span = Math.min(4.6, .36 * N), w = span / N * .72;
    for (let i = 0; i < N; i++) {
      const x = -span / 2 + (i + .5) * span / N;
      const m = new THREE.MeshPhysicalMaterial({ color: 0x7fe3cf, emissive: 0x7fe3cf, emissiveIntensity: .22, roughness: .15, metalness: .1, transparent: true, opacity: .92, clearcoat: 1 });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1, w), m); b.position.set(x, 0, 0); b.castShadow = true; bars.add(b);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, .012, w * 1.04), new THREE.MeshBasicMaterial({ color: 0x1b2240 })); slot.position.set(x, .006, 0); bars.add(slot);
      const shot = new THREE.Mesh(new THREE.BoxGeometry(w * 1.3, .012, w * 1.3), new THREE.MeshBasicMaterial({ color: 0xffffff })); shot.visible = false; shot.position.x = x; bars.add(shot);
      const lb = label(i.toString(2).padStart(n, '0'), { size: N > 16 ? 50 : 58, color: '#aab4dd' }); lb.position.set(x, -.001, .34); lb.scale.multiplyScalar(N > 16 ? .55 : .75);
      lb.material.depthTest = true; bars.add(lb);
      barObjs.push({ b, m, shot, h: 0, target: 0, hs: 0 });
    }
  }

  /* ---------- state + interface ---------- */
  const st = store('w57.cfg3d', { c: preset('bell'), gate: 'H' });
  const cfg = st.get(); if (!Array.isArray(cfg.c) || !cfg.c.length) cfg.c = preset('bell');
  const save = () => st.set(cfg);
  let upto = COLS, hist = null, seed = 7; const R = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  seed = Date.now() % 2147483647 || 7;

  const sh = sheet(ui, { title: 'Quantum Chamber', kicker: 'World 09 · Future Technology', tabs: ['Circuit', 'Measure', 'Views', 'Learn'], accent: '#e8b04a' });
  linkView(k, sh);
  const top = hud(ui, 'Most likely outcome', '|00⟩');
  const [S0, S1, S2, S3] = sh.secs;

  /* Circuit tab */
  S0.append(h('p', { text: 'Pick a gate, then tap a square on a qubit\'s wire. A • control makes the other gates in its column act only when that qubit is 1.' }));
  const gateSeg = seg(S0, [['H', 'H'], ['X', 'X'], ['Y', 'Y'], ['Z', 'Z'], ['S', 'S'], ['T', 'T'], ['•', '• ctrl'], ['', 'Erase']], cfg.gate, (v) => { cfg.gate = v; save(); });
  gateSeg.buttons[0].parentElement.classList.add('q-pal');
  gateSeg.buttons.forEach((b) => { const c = GCOL[b.dataset.v]; if (c) b.style.boxShadow = `inset 0 -3px 0 ${c}`; });
  const gridBox = h('div', { class: 'q-grid' }); S0.append(gridBox);
  const qR = range(S0, 'Qubits', { min: 1, max: 5, value: cfg.c.length }, (v) => { const c = blank(v); for (let q = 0; q < Math.min(v, cfg.c.length); q++) c[q] = cfg.c[q].slice(); cfg.c = c; changed(true); });
  const r2 = row(S0);
  btn(r2, 'Clear circuit', () => { cfg.c = blank(cfg.c.length); changed(); });
  const sel = h('select', { 'aria-label': 'Start from an example' },
    ...[['', 'Start from an example…'], ['super', 'Superposition (one H)'], ['interf', 'Interference: H Z H'], ['phase', 'Phase turns: H T T S H'], ['bell', 'Bell pair (entanglement)'], ['ghz', 'GHZ, three qubits'], ['grover', 'Grover search for 101']].map(([v, t]) => h('option', { value: v, text: t })));
  sel.addEventListener('change', () => { if (!sel.value) return; cfg.c = preset(sel.value); qR.set(cfg.c.length); upto = COLS; stepR.set(COLS); changed(true); sel.value = ''; sh.toast('Example loaded. Press Play in Measure to watch it run.'); });
  S0.append(h('div', { style: { marginTop: '10px' } }, sel));

  function drawGrid() {
    const n = cfg.c.length, g = h('div', { class: 'q-g', style: { gridTemplateColumns: `30px repeat(${COLS}, 38px)` } });
    for (let q = 0; q < n; q++) {
      g.append(h('div', { class: 'q-l', text: 'q' + q }));
      for (let c = 0; c < COLS; c++) {
        const v = cfg.c[q][c], b = h('button', { class: 'q-c' + (v ? ' f' : '') + (c >= upto ? ' dim' : '') + (c === upto - 1 && upto < COLS ? ' cur' : ''), 'aria-label': `qubit ${q}, column ${c + 1}${v ? ', ' + v : ''}`, text: v });
        if (v && v !== '•') b.style.background = GCOL[v]; if (v === '•') { b.style.color = '#c9d4ff'; b.style.fontSize = '24px'; }
        b.onclick = () => { cfg.c[q][c] = cfg.c[q][c] === cfg.gate ? '' : cfg.gate; changed(); };
        g.append(b);
      }
    }
    gridBox.replaceChildren(g);
  }

  /* Measure tab */
  S1.append(h('p', { text: 'Step through the circuit column by column, or measure it 1,000 times: white lines show how often each outcome really came up.' }));
  const stepR = range(S1, 'Show the state after column', { min: 0, max: COLS, value: COLS, fmt: (v) => (v >= COLS ? 'the end' : String(v)) }, (v) => { upto = v; hist = null; refresh(); });
  const r3 = row(S1);
  let playing = 0;
  const playB = btn(r3, '▶ Play', () => {
    if (playing) { clearInterval(playing); playing = 0; playB.textContent = '▶ Play'; return; }
    upto = 0; hist = null; stepR.set(0); refresh(); playB.textContent = '❚❚ Pause';
    const last = lastCol();
    playing = setInterval(() => { upto++; stepR.set(upto >= last ? COLS : upto); if (upto >= last) { upto = COLS; clearInterval(playing); playing = 0; playB.textContent = '▶ Play'; } refresh(); }, 650);
  }, 'pri');
  btn(r3, 'Measure 1,000 times', () => { hist = shots(run(cfg.c, upto).probs(), 1000, R); refresh(); k.fly(...views.out); sh.toast('1,000 shots measured. White lines = what really came up.'); });
  const out = stats(S1, [['top', 'Most likely'], ['ent', 'Entangled?'], ['gates', 'Gates'], ['dep', 'Depth']]);
  S1.append(h('p', { style: { fontSize: '12px', opacity: .6 }, text: 'Outcomes are written last qubit first, |q2 q1 q0⟩, as in most quantum software. Bar height is probability, colour is the phase of the amplitude.' }));

  /* Views tab */
  const views = { all: [[0, 3.3, 12.5], [0, 2.15, .6]], chip: [[1.3, 1.6, 2.1], [0, 1.38, 0]], bloch: [[0, 1.7, 5.4], [0, 1.45, 0]], out: [[0, 2.2, 5.6], [0, .45, 2.3]], top: [[.01, 9.5, .6], [0, 2, 0]] };
  S2.append(h('p', { text: 'Fly the camera. Drag to look around; pinch or scroll to zoom.' }));
  const r4 = row(S2);
  [['all', 'Whole chamber'], ['chip', 'The chip'], ['bloch', 'Bloch spheres'], ['out', 'Outcome bars'], ['top', 'From above']].forEach(([v, t]) => btn(r4, t, () => k.fly(...views[v])));
  let spin = true; const r5 = row(S2); const spinB = btn(r5, 'Slow turn: on', () => { spin = !spin; spinB.textContent = 'Slow turn: ' + (spin ? 'on' : 'off'); });

  /* Learn tab */
  S3.append(
    h('h3', { text: 'What you are looking at' }),
    h('p', { text: 'Real quantum computers hang their chip at the bottom of a dilution refrigerator: gold-plated stages, each colder than the one above, down to about 0.01 degrees above absolute zero. The coaxial lines carry microwave pulses, which are the gates.' }),
    h('h3', { text: 'The glass spheres' }),
    h('p', { text: 'Each sphere is one qubit\'s Bloch sphere. The arrow points up for 0, down for 1, and round the equator for an even mix with a phase. When a qubit is entangled, it has no state of its own: the arrow shrinks and turns amber.' }),
    h('h3', { text: 'Is this real?' }),
    h('p', { text: 'Yes. Every amplitude is computed exactly with a state-vector simulator (32 complex numbers for five qubits). The 1,000 shots use random numbers, just as a real machine gives a different answer each run.' }));

  /* ---------- update ---------- */
  function lastCol() { let m = 0; for (const w of cfg.c) w.forEach((v, i) => { if (v) m = Math.max(m, i + 1); }); return Math.max(1, m); }
  let nBuilt = -1;
  function changed(rebuild) { hist = null; save(); if (rebuild) drawGrid(); refresh(); }
  function refresh() {
    const n = cfg.c.length; if (n !== nBuilt) { buildBars(n); nBuilt = n; }
    drawGrid();
    const s = run(cfg.c, upto), p = s.probs(), N = p.length;
    let best = 0; for (let i = 1; i < N; i++) if (p[i] > p[best]) best = i;
    for (let i = 0; i < N; i++) {
      const o = barObjs[i]; o.target = p[i];
      const ph = Math.atan2(s.im[i], s.re[i]), col = new THREE.Color().setHSL((((ph / TAU) + 1) % 1 + .47) % 1, .65, .6);
      if (p[i] < 1e-9) col.setHSL(.62, .2, .3);
      o.m.color.copy(col); o.m.emissive.copy(col);
      o.hs = hist ? hist[i] / 1000 : 0; o.shot.visible = !!hist;
    }
    /* Bloch arrows + qubit dots */
    let ent = false;
    blochs.forEach((B, q) => {
      B.g.visible = q < n; if (q >= n) return;
      const [x, y, z] = s.bloch(q), len = Math.hypot(x, y, z); if (len < .99) ent = true;
      /* physics axes (x, y, z) → scene (x, z up): |0⟩ at the top */
      B.goal = new THREE.Vector3(x, z, -y); B.goalLen = len;
      B.arrM.color.set(len < .99 ? 0xe8b04a : 0x7fe3cf); B.arrM.emissive.copy(B.arrM.color);
      const p1 = (1 - z) / 2; qDots[q].material.color.setRGB(.13 + p1 * 1.6, .19 + p1 * 1.7, .38 + p1 * 2.2);
    });
    qDots.forEach((d, q) => { d.visible = q < n; d.position.x = (q - (n - 1) / 2) * .06; });
    /* place spheres in an arc around the chip */
    blochs.forEach((B, q) => { if (q >= n) return; const a = n === 1 ? 0 : lerp(-.75, .75, q / (n - 1)); B.g.position.set(Math.sin(a) * 1.9, 1.1 + Math.abs(Math.sin(a)) * .35, Math.cos(a) * 1.1 + .4); });
    let gates = 0; for (const w of cfg.c) for (const v of w.slice(0, upto)) if (v && v !== '•') gates++;
    out('top', `${ket(best, n)} ${Math.round(p[best] * 100)}%`); out('ent', ent ? 'Yes' : 'No'); out('gates', gates); out('dep', Math.min(upto, lastCol()));
    top.set(`${ket(best, n)}  ${Math.round(p[best] * 100)}%`);
    chipGlow.intensity = 1.5 + 4 * (1 - p[0]);
  }
  refresh();

  /* ---------- frame ---------- */
  const tmp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  k.onFrame((dt, t) => {
    if (spin && !calm) fridge.rotation.y += dt * .08;
    dust.rotation.y += dt * .01; beamM.opacity = .016 + .006 * Math.sin(t * .7);
    for (const o of barObjs) {
      o.h += (o.target - o.h) * Math.min(1, dt * 6); const hh = Math.max(.004, o.h * 1.7);
      o.b.scale.y = hh; o.b.position.y = hh / 2; o.shot.position.y = o.hs * 1.7 + .01;
    }
    for (const B of blochs) {
      if (!B.goal || !B.g.visible) continue;
      const g = tmp.copy(B.goal); const gl = g.length() || 1e-6; g.divideScalar(gl);
      B.cur.lerp(g, Math.min(1, dt * 5)).normalize(); B.len += (B.goalLen - B.len) * Math.min(1, dt * 5);
      const L = Math.max(.02, B.len * B.R);
      B.arrow.quaternion.setFromUnitVectors(up, B.cur); B.shaft.scale.y = L - .07; B.shaft.position.y = (L - .07) / 2; B.head.position.y = L - .045;
      B.tip.position.copy(B.cur).multiplyScalar(L);
      B.g.rotation.y = Math.sin(t * .3 + B.g.position.x) * .05;
    }
  });
  /* tap the chip or a sphere to fly there */
  k.pick(() => [pkg, ...blochs.map((b) => b.g), bars], (hit) => {
    let o = hit.object; while (o.parent && o.parent !== scene && o.parent !== fridge) o = o.parent;
    if (o === pkg || hit.object.parent === pkg) k.fly(...views.chip);
    else if (o === bars) k.fly(...views.out);
    else { const B = blochs.find((b) => b.g === o); if (B) { const p = B.g.position; k.fly([p.x * 1.9, p.y + .35, p.z + 1.9], [p.x, p.y, p.z]); sh.toast(`Qubit ${blochs.indexOf(B)}: ${B.goalLen < .99 ? 'entangled, so its arrow is short' : 'a pure state on the sphere'}`); } }
  });
  /* opening shot */
  camera.position.set(0, 6.5, 13); k.fly(...views.all, 3.2);
  k.floor = floor; return k;
}
