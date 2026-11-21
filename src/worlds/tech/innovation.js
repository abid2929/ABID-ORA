/* World 11 · Digital Innovation: Inside the Chip.
   A giant silicon die on a museum plinth, and every part of it works. Flip the switches and the 4-bit adder's gates
   light up as the carry ripples from bit to bit. Load a program and the 8-bit computer runs on the same die: all
   64 bytes of memory are 512 real LEDs, with the program counter, the accumulator and the flags beside them.
   Hamming error correction and Huffman compression from the earlier museum are kept in the Codes tab. */
import * as THREE from 'three';
import { boot, studioEnv, sheet, linkView, h, css, range, btn, row, seg, stats, hud, store, cnv, tex, dotTex, grainNormal, TAU, clamp, lerp, isPhone, calm } from './tk.js';

/* ---------- logic + computer (from world 063, unchanged) ---------- */
export const toSigned = (v) => (v & 0x80 ? v - 256 : v);
export function fullAdder(a, b, c) { const x1 = a ^ b, sum = x1 ^ c, a1 = a & b, a2 = x1 & c, cout = a1 | a2; return { x1, sum, a1, a2, cout }; }
export const OPS = ['HLT', 'LDA', 'STA', 'ADD', 'SUB', 'JMP', 'JZ', 'OUT', 'LDI', 'JC'];
export const MEM = 64;
class AsmError extends Error { constructor(msg, line) { super(msg); this.line = line; } }
export function assemble(src) {
  const mem = new Uint8Array(MEM), labels = new Map(), fix = [], lineOf = new Array(MEM).fill(-1); let pc = 0;
  src.split('\n').forEach((raw, li) => {
    let ln = raw.replace(/;.*/, '').trim(); if (!ln) return;
    const m = ln.match(/^([A-Za-z_]\w*):\s*(.*)$/); if (m) { if (labels.has(m[1].toLowerCase())) throw new AsmError(`label "${m[1]}" used twice`, li + 1); labels.set(m[1].toLowerCase(), pc); ln = m[2].trim(); if (!ln) return; }
    const [opRaw, arg, extra] = ln.split(/\s+/); const op = opRaw.toUpperCase();
    if (extra !== undefined) throw new AsmError('too many words', li + 1);
    const put = (v, need) => {
      if (pc >= MEM) throw new AsmError(`program is longer than ${MEM} bytes`, li + 1);
      if (v === undefined) { if (need) throw new AsmError(`${op} needs a value`, li + 1); return; }
      if (/^-?\d+$/.test(v)) { const n = +v; if (n < -128 || n > 255) throw new AsmError('numbers must fit in one byte (-128 to 255)', li + 1); mem[pc] = n & 255; } else if (/^[A-Za-z_]\w*$/.test(v)) fix.push({ at: pc, name: v.toLowerCase(), line: li + 1 }); else throw new AsmError(`cannot read "${v}"`, li + 1);
      lineOf[pc] = li; pc++;
    };
    if (op === 'DATA') { put(arg, true); return; }
    const code = OPS.indexOf(op); if (code < 0) throw new AsmError(`unknown instruction "${opRaw}"`, li + 1);
    if (pc >= MEM) throw new AsmError(`program is longer than ${MEM} bytes`, li + 1);
    lineOf[pc] = li; mem[pc++] = code;
    if (code === 0 || code === 7) { if (arg !== undefined) throw new AsmError(`${op} takes no value`, li + 1); return; }
    put(arg, true);
  });
  for (const f of fix) { const v = labels.get(f.name); if (v === undefined) throw new AsmError(`no label called "${f.name}"`, f.line); mem[f.at] = v; }
  return { mem, lineOf, size: pc };
}
export const newCPU = (mem) => ({ mem: Uint8Array.from(mem), pc: 0, a: 0, z: true, c: false, halted: false, out: [], steps: 0, touched: -1, err: '' });
export function step(m) {
  if (m.halted) return;
  const op = m.mem[m.pc], arg = m.mem[(m.pc + 1) % MEM], next = (m.pc + (op === 0 || op === 7 ? 1 : 2)) % MEM; m.steps++; m.touched = -1;
  const setA = (v) => { m.c = v > 255 || v < 0; m.a = ((v % 256) + 256) % 256; m.z = m.a === 0; };
  switch (op) {
    case 0: m.halted = true; return;
    case 1: m.a = m.mem[arg % MEM]; m.z = m.a === 0; m.touched = arg % MEM; break;
    case 2: m.mem[arg % MEM] = m.a; m.touched = arg % MEM; break;
    case 3: setA(m.a + m.mem[arg % MEM]); m.touched = arg % MEM; break;
    case 4: setA(m.a - m.mem[arg % MEM]); m.touched = arg % MEM; break;
    case 5: m.pc = arg % MEM; return;
    case 6: if (m.z) { m.pc = arg % MEM; return; } break;
    case 7: m.out.push(m.a); if (m.out.length > 200) m.out.shift(); break;
    case 8: m.a = arg; m.z = m.a === 0; break;
    case 9: if (m.c) { m.pc = arg % MEM; return; } break;
    default: m.halted = true; m.err = `unknown instruction ${op} at ${m.pc}`; return;
  }
  m.pc = next;
}
export const PROGRAMS = {
  count: `; count down from 5 to 0, printing each number\nstart: LDA n\nloop:  OUT\n       SUB one\n       JZ done\n       JMP loop\ndone:  OUT\n       HLT\nn:     DATA 5\none:   DATA 1`,
  mult: `; multiply x by y by adding x, y times\nloop:  LDA y\n       JZ done\n       SUB one\n       STA y\n       LDA total\n       ADD x\n       STA total\n       JMP loop\ndone:  LDA total\n       OUT\n       HLT\nx:     DATA 7\ny:     DATA 6\ntotal: DATA 0\none:   DATA 1`,
  fib: `; Fibonacci numbers until they no longer fit in a byte\n       LDA a\nloop:  OUT\n       LDA a\n       ADD b\n       JC done      ; carry: the sum was over 255\n       STA next\n       LDA b\n       STA a\n       LDA next\n       STA b\n       LDA a\n       JMP loop\ndone:  LDA b        ; b still fits: print it, then stop\n       OUT\n       HLT\na:     DATA 0\nb:     DATA 1\nnext:  DATA 0`,
};
export function hamEncode(d) { const [d1, d2, d3, d4] = d; return [d1 ^ d2 ^ d4, d1 ^ d3 ^ d4, d1, d2 ^ d3 ^ d4, d2, d3, d4]; }
export function hamDecode(c) { const s1 = c[0] ^ c[2] ^ c[4] ^ c[6], s2 = c[1] ^ c[2] ^ c[5] ^ c[6], s3 = c[3] ^ c[4] ^ c[5] ^ c[6], pos = s1 + 2 * s2 + 4 * s3; const fixed = c.slice(); if (pos) fixed[pos - 1] ^= 1; return { pos, fixed, data: [fixed[2], fixed[4], fixed[5], fixed[6]] }; }
export function huffman(text) {
  const chars = Array.from(text), freq = new Map(); for (const ch of chars) freq.set(ch, (freq.get(ch) || 0) + 1);
  let ord = 0; let q = [...freq].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([ch, w]) => ({ w, ch, ord: ord++ }));
  const codes = new Map(); if (q.length === 1) codes.set(q[0].ch, '0');
  while (q.length > 1) { q.sort((a, b) => a.w - b.w || a.ord - b.ord); const l = q.shift(), r = q.shift(); q.push({ w: l.w + r.w, l, r, ord: ord++ }); }
  const walk = (n, p) => { if (!n) return; if (n.ch !== undefined) { if (p) codes.set(n.ch, p); return; } walk(n.l, p + '0'); walk(n.r, p + '1'); };
  if (q.length && q[0].ch === undefined) walk(q[0], '');
  const bits = chars.reduce((s2, ch) => s2 + codes.get(ch).length, 0), bytes = new TextEncoder().encode(text).length;
  return { freq, codes, bits, rawBits: bytes * 8 };
}

/* ---------- textures ---------- */
function dieTex() {
  const S = 2048, [c, g] = cnv(S); g.fillStyle = '#121620'; g.fillRect(0, 0, S, S);
  /* standard-cell rows, metal layers and via fields, drawn at random like a real floor plan */
  for (let y = 0; y < S; y += 16) { g.fillStyle = y % 32 ? 'rgba(90,110,150,.10)' : 'rgba(150,120,90,.08)'; g.fillRect(0, y, S, 7); }
  for (let i = 0; i < 2600; i++) { const x = Math.random() * S, y = Math.random() * S, w = 4 + Math.random() * 60, hh = 2 + Math.random() * 6; g.fillStyle = `rgba(${120 + Math.random() * 80 | 0},${130 + Math.random() * 60 | 0},${170 + Math.random() * 60 | 0},${.06 + Math.random() * .12})`; g.fillRect(x, y, Math.random() < .5 ? w : hh, Math.random() < .5 ? hh : w); }
  for (let i = 0; i < 40; i++) { const x = Math.random() * S, y = Math.random() * S, w = 80 + Math.random() * 260, hh = 80 + Math.random() * 260; g.strokeStyle = 'rgba(180,200,255,.10)'; g.lineWidth = 2; g.strokeRect(x, y, w, hh); }
  g.strokeStyle = 'rgba(232,176,74,.45)'; g.lineWidth = 6; g.strokeRect(24, 24, S - 48, S - 48);
  g.fillStyle = 'rgba(232,176,74,.55)'; for (let i = 0; i < 60; i++) { const t = 60 + i * (S - 120) / 59; g.fillRect(t - 9, 40, 18, 18); g.fillRect(t - 9, S - 58, 18, 18); g.fillRect(40, t - 9, 18, 18); g.fillRect(S - 58, t - 9, 18, 18); }
  g.font = "500 34px 'JetBrains Mono', monospace"; g.fillStyle = 'rgba(232,176,74,.7)'; g.fillText('ABIDORA · A-11 · 4-BIT ALU + 8-BIT CORE', 90, S - 90);
  return tex(c);
}
function gateTex(label) {
  const [c, g] = cnv(256, 128); g.fillStyle = '#1c2230'; g.fillRect(0, 0, 256, 128); g.strokeStyle = 'rgba(232,176,74,.8)'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 122);
  g.fillStyle = '#f1e6d0'; g.font = "600 56px 'JetBrains Mono', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 128, 68); return tex(c);
}
function textSprite(text, size = 60, color = '#f1e6d0', w = 512) {
  const [c, g] = cnv(w, 128); g.fillStyle = color; g.font = `500 ${size}px 'JetBrains Mono', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 64);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(c), transparent: true, depthWrite: false })); s.scale.set(w / 128 * .16, .16, 1); return s;
}

export async function start(canvas, ui) {
  css('i-css', `.i-code{width:100%}.i-err{color:#ff8a7a;font:500 12px 'JetBrains Mono',monospace;min-height:1.2em;margin:6px 0}
  .i-bits{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.i-bits button{width:40px;height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.04);color:inherit;font:600 16px 'JetBrains Mono',monospace;cursor:pointer}
  .i-bits button[aria-pressed=true]{background:#e8b04a;color:#111}
  .i-tab{width:100%;border-collapse:collapse;font:400 12px 'JetBrains Mono',monospace;margin:6px 0}.i-tab td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.08)}`);
  const k = boot(canvas, { fov: 34, bloom: [.5, .45, .93], exposure: 1, bg: 0x060608, fog: new THREE.FogExp2(0x060608, .035) });
  const { scene, camera, controls, renderer } = k;
  const env = studioEnv(renderer, { bg: 0x08080b, warm: 0xffd8a8, cool: 0xb8c8ff }); scene.environment = env; scene.environmentIntensity = .8;
  camera.position.set(0, 6.6, 9.6); controls.target.set(0, 1.2, .2); controls.maxPolarAngle = Math.PI * .47; controls.minDistance = 1.6; controls.maxDistance = 14;

  /* ---------- gallery ---------- */
  scene.add(new THREE.HemisphereLight(0x8090c0, 0x0a0a0c, .25));
  const key = new THREE.SpotLight(0xfff0dc, 70, 20, .42, .65, 1.5); key.position.set(-3, 9, 4); key.target.position.set(0, 1.2, 0); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0003; scene.add(key, key.target);
  const rimL = new THREE.SpotLight(0x8aa4ff, 40, 18, .5, .7, 1.5); rimL.position.set(5, 5, -5); rimL.target.position.set(0, 1, 0); scene.add(rimL, rimL.target);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: .25, metalness: 0, clearcoat: .8, clearcoatRoughness: .12, envMap: env, envMapIntensity: .08 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const plinthM = new THREE.MeshPhysicalMaterial({ color: 0x18181b, roughness: .4, metalness: .2, envMap: env, envMapIntensity: .5 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.0, 5.6), plinthM); plinth.position.y = .5; plinth.receiveShadow = plinth.castShadow = true; scene.add(plinth);
  

  /* ---------- the chip: ceramic package, gold pins and bond wires, silicon die ---------- */
  const chip = new THREE.Group(); chip.position.y = 1.0; scene.add(chip);
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x232327, roughness: .55, metalness: .1, envMap: env, envMapIntensity: .5 });
  const gold = new THREE.MeshPhysicalMaterial({ color: 0xf0c470, roughness: .2, metalness: 1, envMap: env, envMapIntensity: 1.1 });
  const pkg = new THREE.Mesh(new THREE.BoxGeometry(7.2, .18, 5.2), ceramic); pkg.position.y = .09; pkg.castShadow = pkg.receiveShadow = true; chip.add(pkg);
  const pinG = new THREE.BoxGeometry(.07, .03, .26);
  for (let i = 0; i < 40; i++) { const x = -3.4 + i * 6.8 / 39; for (const s of [-1, 1]) { const p = new THREE.Mesh(pinG, gold); p.position.set(x, .2, s * 2.48); chip.add(p); } }
  const DIEX = 6.2, DIEZ = 4.2;
  const die = new THREE.Mesh(new THREE.BoxGeometry(DIEX, .05, DIEZ), new THREE.MeshPhysicalMaterial({ map: dieTex(), roughness: .26, metalness: .35, iridescence: .9, iridescenceIOR: 1.6, iridescenceThicknessMinimum: 250, iridescenceThicknessMaximum: 520, clearcoat: 1, clearcoatRoughness: .05, envMap: env, envMapIntensity: 1 }));
  die.position.y = .205; die.receiveShadow = true; chip.add(die);
  const wireM = new THREE.MeshPhysicalMaterial({ color: 0xf6d38a, metalness: 1, roughness: .15, envMap: env });
  for (let i = 0; i < 30; i++) { const x = -3.0 + i * 6 / 29; for (const s of [-1, 1]) { const a = new THREE.Vector3(x * .96, .23, s * 2.02), b = new THREE.Vector3(x, .21, s * 2.42); const m = a.clone().lerp(b, .5); m.y += .16; chip.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, m, b), 10, .006, 5), wireM)); } }
  const Y = .235;                                       // top of the die, where the exhibits sit

  /* ---------- signals and traces ---------- */
  const ON = new THREE.Color(0xffb84a).multiplyScalar(2.4), OFF = new THREE.Color(0x2a3550);
  const traceMs = new Map();                             // signal name -> material
  const tm = (sig) => { if (!traceMs.has(sig)) traceMs.set(sig, new THREE.MeshBasicMaterial({ color: OFF.clone() })); return traceMs.get(sig); };
  function trace(sig, pts) { for (let i = 0; i < pts.length - 1; i++) { const [x0, z0] = pts[i], [x1, z1] = pts[i + 1], L = Math.hypot(x1 - x0, z1 - z0); const b = new THREE.Mesh(new THREE.BoxGeometry(x0 === x1 ? .022 : L + .022, .008, x0 === x1 ? L + .022 : .022), tm(sig)); b.position.set((x0 + x1) / 2, Y + .004, (z0 + z1) / 2); chip.add(b); } }
  const gateMats = {};
  function gate(label, x, z, sig) {
    const m = [new THREE.MeshPhysicalMaterial({ color: 0x232a38, metalness: .6, roughness: .3, envMap: env }), new THREE.MeshBasicMaterial({ map: gateTex(label) })];
    const g = new THREE.Mesh(new THREE.BoxGeometry(.34, .07, .17), [m[0], m[0], m[1], m[0], m[0], m[0]]); g.position.set(x, Y + .035, z); g.castShadow = true; chip.add(g);
    const pip = new THREE.Mesh(new THREE.SphereGeometry(.022, 12, 8), tm(sig)); pip.position.set(x + .19, Y + .03, z); chip.add(pip);
    gateMats[sig] = m;
  }
  function led(sig, x, z, r = .055) { const l = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 12, 0, TAU, 0, Math.PI / 2), tm(sig)); l.position.set(x, Y, z); chip.add(l); return l; }

  /* switches: A3..A0, B3..B0 and carry-in along the front edge */
  const sw = []; const swM = new THREE.MeshPhysicalMaterial({ color: 0xdedfe2, metalness: 1, roughness: .25, envMap: env });
  const swX = (i) => -2.75 + i * .38;                  // 0..3 = A3..A0, 4..7 = B3..B0, 8 = Cin
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); g.position.set(swX(i) + (i >= 4 ? .14 : 0) + (i === 8 ? .14 : 0), Y, 1.75); chip.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.22, .05, .28), ceramic); base.position.y = .025; g.add(base);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(.08, .2, .08), swM); lever.geometry.translate(0, .1, 0); lever.position.y = .05; g.add(lever); lever.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), new THREE.MeshPhysicalMaterial({ color: i < 4 ? 0xd9604a : i < 8 ? 0x5b84d6 : 0x8a8f99, roughness: .3, clearcoat: 1 })); cap.position.y = .2; lever.add(cap);
    const lb = textSprite(i < 4 ? `A${3 - i}` : i < 8 ? `B${7 - i}` : 'Cin', 64, i < 4 ? '#ff9a85' : i < 8 ? '#9fb8ff' : '#c8ccd6', 256); lb.position.set(0, .02, .3); lb.scale.multiplyScalar(.9); g.add(lb);
    sw.push({ g, lever, base });
  }
  /* four full adders, bit 3 on the left, bit 0 on the right */
  const stageX = (bit) => -2.45 + (3 - bit) * .78;
  for (let b = 0; b < 4; b++) {
    const x = stageX(b), A = swX(3 - b), B = swX(7 - b) + .14;
    gate('XOR', x, .95, `x1${b}`); gate('AND', x + .4, 1.22, `a1${b}`); gate('XOR', x, .55, `s${b}`); gate('AND', x + .4, .55, `a2${b}`); gate('OR', x + .2, .18, `c${b}`);
    trace(`A${b}`, [[A, 1.6], [A, 1.4], [x - .25, 1.4], [x - .25, .98], [x - .17, .98]]); trace(`A${b}`, [[x - .25, 1.25], [x + .23, 1.25]]);
    trace(`B${b}`, [[B, 1.6], [B, 1.32], [x - .3, 1.32], [x - .3, .92], [x - .17, .92]]); trace(`B${b}`, [[x - .3, 1.19], [x + .23, 1.19]]);
    trace(`x1${b}`, [[x + .19, .95], [x + .25, .95], [x + .25, .76], [x - .22, .76], [x - .22, .58], [x - .17, .58]]); trace(`x1${b}`, [[x + .25, .76], [x + .23, .76], [x + .23, .58]]);
    trace(`a1${b}`, [[x + .59, 1.22], [x + .66, 1.22], [x + .66, .2], [x + .37, .2]]);
    trace(`a2${b}`, [[x + .59, .55], [x + .62, .55], [x + .62, .15], [x + .37, .15]]);
    trace(`s${b}`, [[x + .19, .55], [x + .19, .38], [x - .05, .38], [x - .05, -.12]]);
    led(`s${b}`, x - .05, -.2);
    const lb = textSprite(`S${b}`, 60, '#f1e6d0', 256); lb.position.set(x - .05, Y + .05, -.42); lb.scale.multiplyScalar(.8); chip.add(lb);
    /* carry into this stage: from carry-in (bit 0) or the stage to the right */
    const cinSig = b === 0 ? 'cin' : `c${b - 1}`;
    if (b === 0) trace('cin', [[swX(8) + .28, 1.6], [swX(8) + .28, .45], [x + .14, .45], [x + .14, .52]]);
    else { const xr = stageX(b - 1); trace(cinSig, [[xr + .39, .18], [xr + .39, .05], [x + .7, .05], [x + .7, .45], [x - .2, .45], [x - .2, .52]]); }
  }
  trace('c3', [[stageX(3) + .39, .18], [stageX(3) + .39, -.05], [stageX(3) - .35, -.05], [stageX(3) - .35, -.12]]);
  led('c3', stageX(3) - .35, -.2); const cl = textSprite('Cout', 60, '#f1e6d0', 256); cl.position.set(stageX(3) - .35, Y + .05, -.42); cl.scale.multiplyScalar(.8); chip.add(cl);
  const adderLabel = textSprite('4-BIT RIPPLE-CARRY ADDER', 54, '#e8b04a', 1024); adderLabel.position.set(-1.35, Y + .05, -.75); chip.add(adderLabel);

  /* ---------- the computer: 64 bytes x 8 bits = 512 LEDs ---------- */
  const MX = 1.05, MZ = -1.85, CW = .245, CH = .2;     // memory block, top-left corner and cell size
  const ledG = new THREE.BoxGeometry(.022, .012, .1);
  const memLeds = new THREE.InstancedMesh(ledG, new THREE.MeshBasicMaterial({ color: 0xffffff }), 512); memLeds.position.y = Y + .006;
  const dummy = new THREE.Object3D(); const offC = new THREE.Color(0x1f2638), onC = new THREE.Color(0x7fe3cf).multiplyScalar(2.2), pcC = new THREE.Color(0xffb84a).multiplyScalar(2.6), touchC = new THREE.Color(0xff6a8a).multiplyScalar(2.6);
  for (let a = 0; a < 64; a++) for (let bit = 0; bit < 8; bit++) {
    const cx = MX + (a % 8) * CW + bit * .026 + .02, cz = MZ + Math.floor(a / 8) * CH + .05;
    dummy.position.set(cx, 0, cz); dummy.updateMatrix(); memLeds.setMatrixAt(a * 8 + bit, dummy.matrix); memLeds.setColorAt(a * 8 + bit, offC);
  }
  chip.add(memLeds);
  const memLabel = textSprite('MEMORY · 64 BYTES', 54, '#7fe3cf', 1024); memLabel.position.set(MX + 4 * CW, Y + .05, MZ - .22); chip.add(memLabel);
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(CW - .02, .004, CH - .04), new THREE.MeshBasicMaterial({ color: 0xffb84a, transparent: true, opacity: .25 })); cursor.position.y = Y + .003; chip.add(cursor);
  /* registers */
  const regLeds = (name, n, z) => { const arr = []; for (let i = 0; i < n; i++) { arr.push(led(`R${name}${i}`, MX + .5 + (n - 1 - i) * .17, z, .045)); } const l = textSprite(name, 56, '#f1e6d0', 256); l.position.set(MX + .12, Y + .05, z); l.scale.multiplyScalar(.75); chip.add(l); return arr; };
  regLeds('PC', 6, .0); regLeds('A', 8, .35); regLeds('Z', 1, .7); regLeds('C', 1, 1.0);
  const flagL = [textSprite('zero', 44, '#aab', 256), textSprite('carry', 44, '#aab', 256)]; flagL[0].position.set(MX + .95, Y + .05, .7); flagL[1].position.set(MX + .95, Y + .05, 1.0); flagL.forEach((s) => { s.scale.multiplyScalar(.7); chip.add(s); });
  /* output screen standing behind the chip */
  const [oc, og] = cnv(1024, 256); const oTex = tex(oc);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: oTex, toneMapped: false })); screen.position.set(0, 2.9, -2.9); scene.add(screen);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(4.12, 1.12, .06), ceramic); frame.position.set(0, 2.9, -2.94); scene.add(frame);
  const post = new THREE.Mesh(new THREE.BoxGeometry(.08, 1.9, .08), ceramic); post.position.set(0, 1.4, -2.95); scene.add(post);
  function drawScreen(title, big, small) {
    og.fillStyle = '#07090c'; og.fillRect(0, 0, 1024, 256);
    og.fillStyle = '#e8b04a'; og.font = "500 26px 'JetBrains Mono', monospace"; og.fillText(title, 32, 46);
    og.fillStyle = '#f4ead6'; og.font = "400 112px 'Instrument Serif', Georgia, serif"; og.fillText(big, 30, 170);
    og.fillStyle = '#8a93a8'; og.font = "400 24px 'JetBrains Mono', monospace"; og.fillText(small, 32, 226); oTex.needsUpdate = true;
  }

  /* motes in the light */
  const n = isPhone() ? 200 : 400, pg = new THREE.BufferGeometry(), pp = new Float32Array(n * 3); for (let i = 0; i < n; i++) { pp[i * 3] = (Math.random() - .5) * 12; pp[i * 3 + 1] = Math.random() * 6; pp[i * 3 + 2] = (Math.random() - .5) * 10; }
  pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); const motes = new THREE.Points(pg, new THREE.PointsMaterial({ size: .03, map: dotTex(), color: 0xffe0b0, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(motes);

  /* ---------- state ---------- */
  const st = store('w63.cfg3d', { A: 6, B: 7, cin: 0, prog: 'count', src: PROGRAMS.count });
  const cfg = { A: 6, B: 7, cin: 0, prog: 'count', src: PROGRAMS.count, ...st.get() }; const save = () => st.set(cfg);
  let sig = {}, shown = {}, changeT = 0; let cpu = null, asm = null, running = false, rate = 4, acc = 0;
  function compute() {
    const s = { cin: cfg.cin }; let c = cfg.cin;
    for (let b = 0; b < 4; b++) { const a = (cfg.A >> b) & 1, bb = (cfg.B >> b) & 1, r = fullAdder(a, bb, c); Object.assign(s, { [`A${b}`]: a, [`B${b}`]: bb, [`x1${b}`]: r.x1, [`s${b}`]: r.sum, [`a1${b}`]: r.a1, [`a2${b}`]: r.a2, [`c${b}`]: r.cout }); c = r.cout; }
    sig = s; changeT = performance.now();
  }

  /* ---------- interface ---------- */
  const sh = sheet(ui, { title: 'Inside the Chip', kicker: 'World 11 · Digital Innovation', tabs: ['Adder', 'Computer', 'Bits', 'Codes', 'Learn'], accent: '#e8b04a' });
  linkView(k, sh);
  const hd = hud(ui, 'Adder', '6 + 7 = 13');
  const [S0, S1, S2, S3, S4] = sh.secs;
  S0.append(h('p', { text: 'Flip the switches on the chip (or here). Each column is a full adder built from five gates. Watch the carry ripple from bit 0 on the right to bit 3 on the left.' }));
  const aBits = h('div', { class: 'i-bits' }), bBits = h('div', { class: 'i-bits' });
  S0.append(h('h3', { text: 'A' }), aBits, h('h3', { text: 'B' }), bBits);
  const cinB = btn(row(S0), 'Carry in: 0', () => { cfg.cin ^= 1; changed(); });
  const aout = stats(S0, [['a', 'A'], ['b', 'B'], ['s', 'A + B'], ['g', 'Gates lit']]);
  function bitBtns() {
    const mk = (box, key) => box.replaceChildren(...[3, 2, 1, 0].map((b) => h('button', { 'aria-pressed': String(!!((cfg[key] >> b) & 1)), text: String((cfg[key] >> b) & 1), 'aria-label': `${key} bit ${b}`, onclick: () => { cfg[key] ^= 1 << b; changed(); } })));
    mk(aBits, 'A'); mk(bBits, 'B'); cinB.textContent = `Carry in: ${cfg.cin}`;
  }
  function changed() { save(); compute(); bitBtns(); updAdder(); }
  function updAdder() {
    const s = cfg.A + cfg.B + cfg.cin; aout('a', cfg.A); aout('b', cfg.B); aout('s', `${s} = ${s.toString(2).padStart(5, '0')}`);
    aout('g', Object.keys(sig).filter((k2) => /^(x1|a1|a2|s|c)\d$/.test(k2) && sig[k2]).length);
    if (sh.tab !== 1) { hd.el.firstChild.textContent = 'Adder'; hd.set(`${cfg.A} + ${cfg.B}${cfg.cin ? ' + 1' : ''} = ${s}`); drawScreen('4-BIT ADDER  ·  RESULT', `${cfg.A} + ${cfg.B}${cfg.cin ? ' + 1' : ''} = ${s}`, `binary ${s.toString(2).padStart(5, '0')}   ·   carry out ${s > 15 ? 1 : 0}`); }
  }

  S1.append(h('p', { text: 'An 8-bit computer with 64 bytes of memory, all of it on the die: each byte is a row of 8 LEDs. Write assembly, load it, then step or run it.' }));
  const psel = h('select', { 'aria-label': 'Example program' }, ...[['count', 'Count down from 5'], ['mult', 'Multiply 7 x 6'], ['fib', 'Fibonacci numbers']].map(([v, t]) => h('option', { value: v, text: t }))); psel.value = cfg.prog;
  psel.addEventListener('change', () => { cfg.prog = psel.value; cfg.src = PROGRAMS[psel.value]; code.value = cfg.src; save(); load(); });
  S1.append(psel);
  const code = h('textarea', { class: 'code', spellcheck: 'false', 'aria-label': 'Assembly program' }); code.value = cfg.src; S1.append(h('div', { style: { marginTop: '8px' } }, code));
  code.addEventListener('input', () => { cfg.src = code.value; save(); });
  const err = h('div', { class: 'i-err', role: 'alert' }); S1.append(err);
  const r1 = row(S1);
  btn(r1, 'Load to chip', () => load(), 'pri');
  btn(r1, 'Step', () => { if (!cpu) load(); running = false; runB.textContent = '▶ Run'; step(cpu); showCPU(); });
  const runB = btn(r1, '▶ Run', () => { if (!cpu || cpu.halted) load(); running = !running; runB.textContent = running ? '❚❚ Pause' : '▶ Run'; });
  range(S1, 'Speed', { min: 1, max: 60, value: rate, fmt: (v) => `${v} steps/s` }, (v) => { rate = v; });
  const cout = stats(S1, [['pc', 'Program counter'], ['a', 'Accumulator'], ['st', 'Steps'], ['out', 'Output']]);
  S1.append(h('p', { style: { fontSize: '12px', opacity: .65 }, text: 'Instructions: LDA x (load), STA x (store), ADD x, SUB x, LDI n (load number), JMP x, JZ x (jump if zero), JC x (jump if carry), OUT, HLT. Labels end with a colon; DATA n stores a number.' }));
  function load(quiet) {
    try { asm = assemble(code.value); cpu = newCPU(asm.mem); err.textContent = ''; running = false; runB.textContent = '▶ Run'; showCPU(); if (!quiet) { k.fly(...views.mem); sh.toast(`Loaded ${asm.size} bytes into memory.`); } }
    catch (e) { err.textContent = `Line ${e.line}: ${e.message}`; cpu = null; }
  }
  function showCPU() {
    if (!cpu) return;
    for (let a = 0; a < 64; a++) { const v = cpu.mem[a]; for (let bit = 0; bit < 8; bit++) memLeds.setColorAt(a * 8 + bit, (v >> (7 - bit)) & 1 ? (a === cpu.touched ? touchC : onC) : offC); }
    memLeds.instanceColor.needsUpdate = true;
    cursor.position.x = MX + (cpu.pc % 8) * CW + CW / 2 - .01; cursor.position.z = MZ + Math.floor(cpu.pc / 8) * CH + .05;
    for (let i = 0; i < 6; i++) tm(`RPC${i}`).color.copy((cpu.pc >> i) & 1 ? ON : OFF);
    for (let i = 0; i < 8; i++) tm(`RA${i}`).color.copy((cpu.a >> i) & 1 ? ON : OFF);
    tm('RZ0').color.copy(cpu.z ? ON : OFF); tm('RC0').color.copy(cpu.c ? ON : OFF);
    cout('pc', cpu.pc); cout('a', cpu.a); cout('st', cpu.steps); cout('out', cpu.out.slice(-6).join(' ') || '–');
    if (sh.tab === 1) { hd.el.firstChild.textContent = cpu.halted ? 'Computer · halted' : 'Computer · running'; hd.set(`OUT ${cpu.out.length ? cpu.out[cpu.out.length - 1] : '–'}`);
      drawScreen(`8-BIT CORE  ·  ${cpu.halted ? 'HALTED' : 'PC ' + cpu.pc}  ·  STEP ${cpu.steps}`, cpu.out.slice(-7).join('  ') || '…', cpu.err || `A = ${cpu.a}   zero ${cpu.z ? 1 : 0}   carry ${cpu.c ? 1 : 0}`); }
  }

  /* Bits tab */
  S2.append(h('p', { text: 'The same eight switches read as one byte (A is the high half, B the low half). One pattern of bits, many meanings.' }));
  const bout = stats(S2, [['u', 'Unsigned'], ['s', 'Signed'], ['x', 'Hex'], ['c', 'Character']]);
  function updBits() { const v = (cfg.A << 4) | cfg.B; bout('u', v); bout('s', toSigned(v)); bout('x', '0x' + v.toString(16).toUpperCase().padStart(2, '0')); bout('c', v >= 32 && v < 127 ? `"${String.fromCharCode(v)}"` : '–'); }

  /* Codes tab: Hamming and Huffman, kept from the earlier museum */
  S3.append(h('h3', { text: 'Hamming (7,4): fix a flipped bit' }), h('p', { text: 'Four data bits are sent as seven. Flip any bit "in transit": the receiver finds and fixes it.' }));
  let data = [1, 0, 1, 1], flip = -1;
  const hData = h('div', { class: 'i-bits' }), hSent = h('div', { class: 'i-bits' }); const hOut = h('p', {}); S3.append(h('p', { style: { fontSize: '12px', opacity: .6 }, text: 'Data' }), hData, h('p', { style: { fontSize: '12px', opacity: .6 }, text: 'Sent (tap one to flip it)' }), hSent, hOut);
  function updHam() {
    hData.replaceChildren(...data.map((b, i) => h('button', { 'aria-pressed': String(!!b), text: String(b), onclick: () => { data[i] ^= 1; flip = -1; updHam(); } })));
    const c = hamEncode(data), rx = c.slice(); if (flip >= 0) rx[flip] ^= 1; const d = hamDecode(rx);
    hSent.replaceChildren(...rx.map((b, i) => h('button', { 'aria-pressed': String(!!b), style: i === flip ? { outline: '2px solid #ff6a8a' } : {}, text: String(b), title: ['p1', 'p2', 'd1', 'p3', 'd2', 'd3', 'd4'][i], onclick: () => { flip = flip === i ? -1 : i; updHam(); } })));
    hOut.textContent = d.pos ? `Error found at position ${d.pos} and corrected. Data recovered: ${d.data.join('')}` : `No error. Data: ${d.data.join('')}`;
  }
  S3.append(h('h3', { text: 'Huffman: compress your text' }));
  const ht = h('input', { type: 'text', value: 'abracadabra', 'aria-label': 'Text to compress' }); S3.append(ht);
  const hres = h('div', {}); S3.append(hres);
  function updHuff() { const t = ht.value || ' ', r = huffman(t); hres.replaceChildren(h('p', { style: { marginTop: '8px' }, text: `${r.rawBits} bits as plain text → ${r.bits} bits coded (${Math.round(100 - r.bits / r.rawBits * 100)}% smaller)` }), h('table', { class: 'i-tab' }, ...[...r.codes].sort((a, b) => a[1].length - b[1].length).slice(0, 14).map(([ch, cd]) => h('tr', {}, h('td', { text: JSON.stringify(ch) }), h('td', { text: String(r.freq.get(ch)) + '×' }), h('td', { text: cd }))))); }
  ht.addEventListener('input', updHuff);

  S4.append(h('h3', { text: 'From switches to sums' }), h('p', { text: 'A bit is a wire that is on or off. Gates combine wires: XOR is on when exactly one input is, AND when both are, OR when either is. Two XORs, two ANDs and an OR make a full adder; four in a row add two 4-bit numbers, the carry rippling from right to left.' }),
    h('h3', { text: 'A computer in 64 bytes' }), h('p', { text: 'Memory holds both the program and its numbers. The program counter points at the next instruction; the accumulator is the one number the machine is working on. Every LED you see is a real bit of that machine.' }));

  /* ---------- views ---------- */
  const views = { all: [[0, 6.6, 9.6], [0, 1.1, .1]], adder: [[-1.3, 3.6, 3.6], [-1.3, 1.1, .7]], mem: [[2.2, 4.3, 3.3], [2.0, 1.1, -.5]], screen: [[0, 2.9, 2.6], [0, 2.6, -2.9]] };
  const vr = row(S0); [['all', 'Whole chip'], ['adder', 'Adder close-up'], ['screen', 'Screen']].forEach(([v, t]) => btn(vr, t, () => k.fly(...views[v])));
  sh.onTab((i) => { if (i === 0) { k.fly(...views.adder); updAdder(); } if (i === 1) { k.fly(...views.mem); if (!cpu) load(); else showCPU(); } if (i === 2) { k.fly(...views.adder); updBits(); } if (i === 3) updHam(); });

  /* tap a switch on the chip */
  k.pick(() => sw.map((s) => s.g), (hit) => {
    let o = hit.object; while (o.parent && !sw.some((s) => s.g === o)) o = o.parent; const i = sw.findIndex((s) => s.g === o); if (i < 0) return;
    if (i < 4) cfg.A ^= 1 << (3 - i); else if (i < 8) cfg.B ^= 1 << (7 - i); else cfg.cin ^= 1; changed(); updBits();
  });

  /* ---------- frame ---------- */
  k.onFrame((dt, t) => {
    /* the adder ripples: inputs at once, then each stage 0.22 s after the one before */
    const el = (performance.now() - changeT) / 1000;
    for (const [name, v] of Object.entries(sig)) {
      const m = /(\d)$/.exec(name), bit = m ? +m[1] : 0, delay = /^[AB]\d$/.test(name) || name === 'cin' ? 0 : .12 + bit * .22 + (/^(s|c|a2)/.test(name) ? .1 : 0);
      const want = el >= delay ? v : (shown[name] ?? 0); if (shown[name] !== want) { shown[name] = want; tm(name).color.copy(want ? ON : OFF); }
    }
    for (let i = 0; i < 9; i++) { const on = i < 4 ? (cfg.A >> (3 - i)) & 1 : i < 8 ? (cfg.B >> (7 - i)) & 1 : cfg.cin; const goal = on ? -.45 : .45; sw[i].lever.rotation.x += (goal - sw[i].lever.rotation.x) * Math.min(1, dt * 14); }
    if (running && cpu) { acc += dt * rate; let n2 = 0; while (acc >= 1 && n2 < 20) { acc -= 1; n2++; step(cpu); if (cpu.halted) { running = false; runB.textContent = '▶ Run'; sh.toast(cpu.err || `Halted after ${cpu.steps} steps.`); break; } } if (n2) showCPU(); }
    motes.rotation.y += dt * .01;
  });
  compute(); bitBtns(); load(true); updAdder(); updBits(); updHam(); updHuff();
  camera.position.set(-4, 9, 12); k.fly(...views.all, 3);
  return k;
}
