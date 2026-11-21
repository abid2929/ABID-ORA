/* World 14 · Puzzle: Prism Lab.
   Guide laser light into crystals by turning mirrors. Twenty levels, generated from a solved board so every one has a
   solution; later levels add more crystals, stone blocks, fixed mirrors and colour (a crystal only wakes for its own colour).
   Tap or click a mirror to turn it. Fewest turns earns three stars. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { onKey, makeStage, card, hud, toast, best, sfx, run, topBar, el, TOUCH, clamp, lerp, damp, rng, canvasTex } from './gkit.js';

const COLORS = [[0xffb35c, '#ffb35c'], [0x5cc8ff, '#5cc8ff'], [0xff5c9a, '#ff5c9a']];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const reflect = (m, [dx, dz]) => (m === 0 ? [-dz, -dx] : [dz, dx]);   // 0 = '/', 1 = '\'

/* ---------- level generator: build a solved board, then scramble the movable mirrors ---------- */
export function makeLevel(n) {
  const size = n < 3 ? 5 : n < 8 ? 6 : n < 14 ? 7 : 8;
  const beams = n < 4 ? 1 : n < 13 ? 2 : 3;
  const colored = n >= 7;
  const r = rng(1000 + n * 7919);
  for (let attempt = 0; attempt < 20000; attempt++) {
    const cell = Array.from({ length: size }, () => Array(size).fill(null));
    const used = new Set(), emit = [];
    let ok = true;
    for (let b = 0; b < beams && ok; b++) {
      const color = colored ? b % 3 : 0;
      /* emitter on a random border, pointing in */
      let side = (r() * 4) | 0, k = (r() * size) | 0, x, z, d;
      if (side === 0) { x = -1; z = k; d = [1, 0]; } else if (side === 1) { x = size; z = k; d = [-1, 0]; } else if (side === 2) { x = k; z = -1; d = [0, 1]; } else { x = k; z = size; d = [0, -1]; }
      if (emit.some((e) => e.x === x && e.z === z)) { ok = false; break; }
      const turns = 2 + ((r() * (1 + Math.min(4, n / 3))) | 0), path = [];
      let t = 0, steps = 0;
      while (steps++ < 60) {
        x += d[0]; z += d[1];
        if (x < 0 || z < 0 || x >= size || z >= size) { ok = false; break; }
        const key = x + ',' + z;
        if (cell[z][x] && cell[z][x].type !== 'cross') { ok = false; break; }
        path.push(key);
        const runLen = path.length;
        if (t >= turns && runLen > 2 && !cell[z][x] && r() < .45) { cell[z][x] = { type: 'target', color }; used.add(key); break; }
        if (t < turns + 1 && !cell[z][x] && runLen > 1 && r() < .42) {
          const m = r() < .5 ? 0 : 1, nd = reflect(m, d), nx = x + nd[0], nz = z + nd[1];
          if (nx >= 0 && nz >= 0 && nx < size && nz < size) { cell[z][x] = { type: 'mirror', m, sol: m, fixed: false }; used.add(key); d = nd; t++; continue; }
        }
        if (!used.has(key)) { cell[z][x] = { type: 'cross' }; }
      }
      if (!ok || !path.length || cell[z]?.[x]?.type !== 'target') { ok = false; break; }
      emit.push({ ...origin(path[0], size, side), color });
    }
    if (!ok) continue;
    /* clear path markers, add decoys and blocks on unused cells */
    let decoys = 0, blocks = 0;
    const wantDecoy = Math.min(2 + n, size * size / 4), wantBlock = n < 2 ? 0 : Math.min(1 + (n >> 1), size);
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      if (cell[z][x]?.type === 'cross') cell[z][x] = { type: 'pass' };
    }
    const free = []; for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) if (!cell[z][x]) free.push([x, z]);
    for (let i = free.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [free[i], free[j]] = [free[j], free[i]]; }
    for (const [x, z] of free) {
      if (decoys < wantDecoy) { cell[z][x] = { type: 'mirror', m: r() < .5 ? 0 : 1, sol: null, fixed: false }; decoys++; }
      else if (blocks < wantBlock) { cell[z][x] = { type: 'block' }; blocks++; }
    }
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) if (cell[z][x]?.type === 'pass') cell[z][x] = null;
    /* some solution mirrors become fixed hints in harder levels */
    let par = 0;
    for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
      const c = cell[z][x]; if (c?.type !== 'mirror' || c.sol === null) continue;
      if (n >= 5 && r() < .22) { c.fixed = true; continue; }
      if (r() < .75) { c.m = 1 - c.sol; par++; }
    }
    const lv = { n, size, cell, emit, par };
    if (par === 0 || trace(lv).solved) continue;
    /* a decoy must never be needed; check solution actually solves */
    const test = JSON.parse(JSON.stringify(lv)); for (const row of test.cell) for (const c of row) if (c?.type === 'mirror' && c.sol !== null) c.m = c.sol;
    if (!trace(test).solved) continue;
    return lv;
  }
  throw new Error('level ' + n);
}
function origin(key, size, side) {
  const [x, z] = key.split(',').map(Number);
  if (side === 0) return { x: -1, z, d: [1, 0] }; if (side === 1) return { x: size, z, d: [-1, 0] };
  if (side === 2) return { x, z: -1, d: [0, 1] }; return { x, z: size, d: [0, -1] };
}

/* trace every beam; returns segments and which targets are lit */
export function trace(lv) {
  const segs = [], lit = new Set(); let solved = true;
  for (const e of lv.emit) {
    let x = e.x, z = e.z, d = e.d, sx = x, sz = z, guard = 0;
    while (guard++ < 200) {
      const nx = x + d[0], nz = z + d[1];
      if (nx < 0 || nz < 0 || nx >= lv.size || nz >= lv.size) { segs.push([sx, sz, nx - d[0] * .5, nz - d[1] * .5, e.color]); break; }
      const c = lv.cell[nz][nx]; x = nx; z = nz;
      if (!c) continue;
      if (c.type === 'block') { segs.push([sx, sz, x - d[0] * .42, z - d[1] * .42, e.color]); break; }
      if (c.type === 'target') { segs.push([sx, sz, x, z, e.color]); if (c.color === e.color) lit.add(x + ',' + z); break; }
      if (c.type === 'mirror') { segs.push([sx, sz, x, z, e.color]); sx = x; sz = z; d = reflect(c.m, d); }
    }
  }
  for (let z = 0; z < lv.size; z++) for (let x = 0; x < lv.size; x++) if (lv.cell[z][x]?.type === 'target' && !lit.has(x + ',' + z)) solved = false;
  return { segs, lit, solved };
}

export async function start(canvas, ui) {
  const S = makeStage(canvas, { exposure: 1, fov: 38, bloom: { strength: .9, radius: .45, threshold: 1.1 } });
  const { scene, camera, renderer } = S;
  scene.background = new THREE.Color(0x0b0b0e);
  /* studio light: a soft environment made from glowing panels, plus a key spot with shadows */
  const pm = new THREE.PMREMGenerator(renderer); const envS = new THREE.Scene();
  envS.background = new THREE.Color(0x050506);
  const panel = (w, h, x, y, z, c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); envS.add(m); };
  panel(8, 3, 0, 8, 2, 0xfff4e6, 4); panel(3, 6, -7, 3, 0, 0xe8b46a, 1.2); panel(3, 6, 7, 3, -2, 0xbfd4ff, 1.4); panel(10, 1, 0, 2, -8, 0xffffff, 1);
  scene.environment = pm.fromScene(envS, .03).texture; scene.environmentIntensity = .9;
  const key = new THREE.SpotLight(0xfff0dc, 260, 40, .55, .6, 1.6); key.position.set(3, 11, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0002; key.shadow.radius = 4; scene.add(key, key.target);
  scene.add(new THREE.AmbientLight(0xffffff, .08));
  /* floor with a soft vignette */
  const floorT = canvasTex(512, 512, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, '#2a2826'); gr.addColorStop(1, '#0b0b0e'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ map: floorT, roughness: .7, metalness: .1 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -.62; floor.receiveShadow = true; scene.add(floor);

  /* materials */
  const M = {
    board: new THREE.MeshPhysicalMaterial({ color: 0x141416, roughness: .28, metalness: .2, clearcoat: 1, clearcoatRoughness: .08 }),
    tile: new THREE.MeshPhysicalMaterial({ color: 0x1d1d21, roughness: .45, metalness: .1, clearcoat: .6 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc8a165, metalness: 1, roughness: .26 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xeef2f6, metalness: 1, roughness: .03 }),
    back: new THREE.MeshStandardMaterial({ color: 0x2a2b30, metalness: .6, roughness: .4 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x6d655c, roughness: .92 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x3a3c42, metalness: .9, roughness: .3 }),
    lock: new THREE.MeshStandardMaterial({ color: 0x8a8f99, metalness: .9, roughness: .35 }),
  };
  const tileG = new RoundedBoxGeometry(.94, .16, .94, 3, .05);
  const mirrorG = new RoundedBoxGeometry(.86, .5, .05, 2, .02), mirrorBackG = new RoundedBoxGeometry(.9, .54, .03, 2, .012);
  const baseG = new THREE.CylinderGeometry(.3, .34, .09, 40);
  const blockG = new RoundedBoxGeometry(.86, .7, .86, 3, .06);
  const gemG = new THREE.OctahedronGeometry(.27, 0);

  let lv, idx = 0, moves = 0, board = null, objs = [], beamGroup = null, gems = [], won = false, tween = [];
  const level = best.get('puzzle') ?? { at: 0, stars: {} };
  const css = el('style', '', `
  .pz-top{left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 62px);display:flex;gap:8px;align-items:center}
  .pz-top span{padding:8px 12px;border-radius:999px;background:rgba(10,10,12,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.12)}.pz-top b{color:#e8b46a;margin-left:6px}
  .pz-bot{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;gap:8px;z-index:20}
  .pz-bot button{min-height:46px;padding:0 18px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(12,12,16,.6);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#ece6dc;font:500 11px 'JetBrains Mono',monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
  .pz-bot button:disabled{opacity:.35}
  .pz-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:12px}
  .pz-grid button{aspect-ratio:1;border-radius:12px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.03);color:#ece6dc;font:400 20px 'Instrument Serif',serif;cursor:pointer;display:grid;place-items:center;padding:4px 0 2px}
  .pz-grid button small{display:block;font:500 9px 'JetBrains Mono',monospace;color:#e8b46a;letter-spacing:.1em}
  .pz-grid button:disabled{opacity:.3;cursor:default}.pz-grid button.cur{border-color:#e8b46a}
  .pz-stars{font-size:30px;letter-spacing:6px;color:#e8b46a;margin:4px 0 8px}
  `); ui.append(css);
  let pause = () => {};
  topBar(ui, () => pause());
  const top = hud(ui, 'pz-top');
  const bot = el('div', 'pz-bot'); ui.append(bot);
  const bUndo = el('button', '', 'Undo'), bReset = el('button', '', 'Reset'), bLv = el('button', '', 'Levels'), bHint = el('button', '', 'Hint');
  [bUndo, bReset, bHint, bLv].forEach((b) => { b.type = 'button'; bot.append(b); });
  const history = [];

  const W = (x, size) => x - (size - 1) / 2;   // grid to world
  const build = (n) => {
    if (board) scene.remove(board); objs = []; gems = []; history.length = 0; moves = 0; won = false;
    idx = n; lv = makeLevel(n); board = new THREE.Group(); scene.add(board);
    const sz = lv.size;
    const slab = new THREE.Mesh(new RoundedBoxGeometry(sz + .9, .5, sz + .9, 4, .14), M.board); slab.position.y = -.33; slab.castShadow = slab.receiveShadow = true; board.add(slab);
    /* a thin brass inlay around the play area */
    const inlay = new THREE.Mesh(new THREE.BoxGeometry(sz + .5, .02, sz + .5), M.brass); inlay.position.y = -.07; board.add(inlay);
    const inner = new THREE.Mesh(new THREE.BoxGeometry(sz + .38, .03, sz + .38), M.board); inner.position.y = -.065; board.add(inner);
    for (let z = 0; z < sz; z++) for (let x = 0; x < sz; x++) {
      const t = new THREE.Mesh(tileG, M.tile); t.position.set(W(x, sz), 0, W(z, sz)); t.receiveShadow = true; board.add(t);
      const c = lv.cell[z][x]; if (!c) continue;
      const g = new THREE.Group(); g.position.set(W(x, sz), .08, W(z, sz)); board.add(g);
      if (c.type === 'mirror') {
        const base = new THREE.Mesh(baseG, c.fixed ? M.lock : M.brass); base.position.y = .045; base.castShadow = true; g.add(base);
        const piv = new THREE.Group(); piv.position.y = .34; g.add(piv);
        const mm = new THREE.Mesh(mirrorG, M.mirror); mm.castShadow = true; piv.add(mm);
        const mb = new THREE.Mesh(mirrorBackG, M.back); mb.position.z = -.04; piv.add(mb);
        piv.rotation.y = c.m === 0 ? Math.PI / 4 : -Math.PI / 4;
        if (c.fixed) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .62, 10), M.lock); pin.position.set(.32, .3, 0); g.add(pin); }
        objs.push({ g, piv, c, x, z });
      } else if (c.type === 'block') {
        const b = new THREE.Mesh(blockG, M.stone); b.position.y = .35; b.castShadow = b.receiveShadow = true; g.add(b);
      } else if (c.type === 'target') {
        const col = COLORS[c.color][0];
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(.22, .3, .2, 32), M.steel); ped.position.y = .1; ped.castShadow = true; g.add(ped);
        const gm = new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: .15, roughness: .05, metalness: 0, transmission: .6, thickness: .5, ior: 1.7, clearcoat: 1 });
        const gem = new THREE.Mesh(gemG, gm); gem.scale.y = 1.5; gem.position.y = .58; gem.castShadow = true; g.add(gem);
        const pl = new THREE.PointLight(col, 0, 3, 2); pl.position.y = .6; g.add(pl);
        gems.push({ key: x + ',' + z, gem, gm, pl, on: 0 });
      }
    }
    for (const e of lv.emit) {
      const col = COLORS[e.color][0], g = new THREE.Group(); g.position.set(W(e.x, sz), .25, W(e.z, sz)); board.add(g);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.24, .28, .62, 32), M.steel); body.rotation.z = Math.PI / 2; body.castShadow = true; g.add(body);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(.25, .035, 12, 40), M.brass); ring.rotation.y = Math.PI / 2; ring.position.x = .2; g.add(ring);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.17, 32), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 4 })); lens.rotation.y = Math.PI / 2; lens.position.x = .32; g.add(lens);
      g.rotation.y = Math.atan2(-e.d[1], e.d[0]);
    }
    beamGroup = new THREE.Group(); board.add(beamGroup);
    frameCam(true); update(true);
    level.at = Math.max(level.at, n); best.set('puzzle', level);
  };
  /* beams: a bright core + soft glow */
  const coreG = new THREE.CylinderGeometry(.028, .028, 1, 10, 1, true); coreG.rotateZ(Math.PI / 2);
  const glowG = new THREE.CylinderGeometry(.09, .09, 1, 12, 1, true); glowG.rotateZ(Math.PI / 2);
  const coreM = COLORS.map(([c]) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(5) }));
  const glowM = COLORS.map(([c]) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.4), transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  function update(silent) {
    const res = trace(lv), sz = lv.size;
    beamGroup.clear();
    for (const [x0, z0, x1, z1, c] of res.segs) {
      const a = new THREE.Vector3(W(x0, sz), .42, W(z0, sz)), b = new THREE.Vector3(W(x1, sz), .42, W(z1, sz)), len = a.distanceTo(b); if (len < .01) continue;
      for (const [g, m] of [[coreG, coreM[c]], [glowG, glowM[c]]]) { const s = new THREE.Mesh(g, m); s.scale.x = len; s.position.copy(a).add(b).multiplyScalar(.5); s.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); beamGroup.add(s); }
    }
    gems.forEach((g) => (g.target = res.lit.has(g.key) ? 1 : 0));
    top.innerHTML = `<span>Level<b>${idx + 1}</b></span><span>Turns<b>${moves}</b></span><span>Par<b>${lv.par}</b></span><span>Crystals<b>${res.lit.size}/${gems.length}</b></span>`;
    bUndo.disabled = !history.length;
    if (res.solved && !silent && !won) { won = true; setTimeout(winCard, 900); sfx.blip(523, .5, 'sine', .25); setTimeout(() => sfx.blip(659, .5, 'sine', .25), 120); setTimeout(() => sfx.blip(784, .7, 'sine', .25), 240); }
  }
  const turn = (o, rec = true) => {
    if (o.c.fixed || won) { if (o.c.fixed) { sfx.blip(180, .12, 'square', .1); toast(ui, 'This mirror is locked'); } return; }
    o.c.m = 1 - o.c.m; if (rec) { history.push(o); moves++; }
    tween.push({ piv: o.piv, to: o.c.m === 0 ? Math.PI / 4 : -Math.PI / 4 });
    sfx.blip(rec ? 520 : 400, .08, 'triangle', .2); update();
  };
  bUndo.onclick = () => { const o = history.pop(); if (o) { moves--; turn(o, false); } };
  bReset.onclick = () => build(idx);
  bHint.onclick = () => {
    const wrong = objs.filter((o) => o.c.sol !== null && !o.c.fixed && o.c.m !== o.c.sol);
    if (!wrong.length) { toast(ui, 'Turn the extra mirrors out of the way'); return; }
    const o = wrong[0]; tween.push({ pulse: o.g, t: 0 }); toast(ui, 'Try this mirror'); moves += 1; update(true);
  };
  const levelsCard = async () => {
    const st = level.stars;
    const body = `<div class="pz-grid">${Array.from({ length: 20 }, (_, i) => `<button type="button" data-l="${i}" class="${i === idx ? 'cur' : ''}" ${i > level.at ? 'disabled' : ''}>${i + 1}<small>${'★'.repeat(st[i] ?? 0) || '&nbsp;'}</small></button>`).join('')}</div>`;
    const p = card(ui, { kicker: 'World 14 · Puzzle', title: 'Choose a level', body, buttons: ['Close'] });
    ui.querySelectorAll('.pz-grid button').forEach((b) => (b.onclick = () => { ui.querySelector('.gk-card-wrap .gk-cbtn').click(); build(+b.dataset.l); }));
    await p;
  };
  bLv.onclick = levelsCard;
  const winCard = async () => {
    const stars = moves <= lv.par ? 3 : moves <= lv.par + 3 ? 2 : 1;
    level.stars[idx] = Math.max(level.stars[idx] ?? 0, stars); level.at = Math.max(level.at, idx + 1); best.set('puzzle', level);
    const c = await card(ui, { kicker: `Level ${idx + 1} solved`, title: ['', 'Lit up', 'Brilliant', 'Perfect light'][stars],
      body: `<div class="pz-stars">${'★'.repeat(stars)}<span style="opacity:.25">${'★'.repeat(3 - stars)}</span></div><div class="gk-stats"><div><small>Turns</small><b>${moves}</b></div><div><small>Par</small><b>${lv.par}</b></div><div><small>Crystals</small><b>${gems.length}</b></div></div>`,
      buttons: idx < 19 ? ['Next level', 'Replay'] : ['Play again', 'Replay'] });
    build(c === 0 ? (idx < 19 ? idx + 1 : 0) : idx);
  };
  pause = levelsCard;

  /* camera: fit the board, drag to tilt and orbit a little */
  let yaw = 0, pitch = 1.0, ty = 0, tp = 1.0, dist = 10;
  const frameCam = (snap) => {
    const sz = lv.size + 2.2, asp = S.w / S.h, f = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    dist = Math.max(sz / 2 / f / Math.min(asp, 1) * 1.05, sz / 2 / f * .95) + 1.2;
    if (snap) { yaw = ty; pitch = tp; }
  };
  S.onResize.push(() => lv && frameCam());
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, ty, tp, moved: 0 }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) { hover(e); return; }
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved = Math.max(down.moved, Math.hypot(dx, dy));
    if (down.moved > 10) { ty = clamp(down.ty - dx * .004, -.6, .6); tp = clamp(down.tp + dy * .004, .55, 1.35); }
  });
  canvas.addEventListener('pointerup', (e) => { if (down && down.moved < 10) pick(e); down = null; });
  const objAt = (e) => {
    const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    /* hit the board plane, then take the cell: generous targets for thumbs */
    const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -.35), p)) return null;
    const sz = lv.size, x = Math.round(p.x + (sz - 1) / 2), z = Math.round(p.z + (sz - 1) / 2);
    return objs.find((o) => o.x === x && o.z === z) ?? null;
  };
  const pick = (e) => { const o = objAt(e); if (o) turn(o); };
  const hover = (e) => { if (e.pointerType !== 'mouse') return; canvas.style.cursor = objAt(e) && !objAt(e).c.fixed ? 'pointer' : 'default'; };
  onKey((e) => { if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') bUndo.onclick(); if (e.code === 'KeyR') bReset.onclick(); });

  let now = 0;
  run((dt) => {
    now += dt; S.watch(dt);
    yaw = damp(yaw, ty, 6, dt); pitch = damp(pitch, tp, 6, dt);
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(0, -.1, 0);
    for (let i = tween.length - 1; i >= 0; i--) {
      const t = tween[i];
      if (t.piv) { t.piv.rotation.y = damp(t.piv.rotation.y, t.to, 16, dt); if (Math.abs(t.piv.rotation.y - t.to) < .002) { t.piv.rotation.y = t.to; tween.splice(i, 1); } }
      else if (t.pulse) { t.t += dt; t.pulse.position.y = .08 + Math.abs(Math.sin(t.t * 8)) * .25 * (1 - t.t / 1.2); if (t.t > 1.2) { t.pulse.position.y = .08; tween.splice(i, 1); } }
    }
    for (const g of gems) {
      g.on = damp(g.on, g.target ?? 0, 6, dt);
      g.gm.emissiveIntensity = .15 + g.on * (3.5 + Math.sin(now * 4) * .5); g.pl.intensity = g.on * 4;
      g.gem.rotation.y += dt * (.4 + g.on * 2); g.gem.position.y = .58 + g.on * (.12 + Math.sin(now * 3) * .04);
    }
    S.render();
  });
  build(Math.min(level.at, 19));
  if (!best.get('puzzle.seen')) {
    await card(ui, { kicker: 'World 14 · Puzzle', title: 'Prism Lab', body: `<p>Light leaves each emitter in a straight line. Mirrors turn it by 90°. Light every crystal to finish a level; from level 8 a crystal only wakes for light of its own colour.</p><p>${TOUCH ? 'Tap a mirror to turn it.' : 'Click a mirror to turn it.'}</p><p>Brass mirrors turn, silver ones with a pin are locked. Drag to tilt the board.</p>`, buttons: ['Start'] });
    best.set('puzzle.seen', true);
  }
}
