/* Garment atelier in 3D, shared by the Clothing and Streetwear worlds: a dress form wearing a garment built in code.
   The body of the garment is a lathe with an oval cross-section sized from a real chest measurement, sleeves are
   tapered tubes with rib cuffs, and the fabric is physically based (weave, twill, knit or silk, with sheen for the
   soft halo cloth has at grazing angles). One texture wraps the whole body, so a print sits on the chest at its real
   width in centimetres. */
import { show3d, floor, normalTex, THREE, type Show } from './show3d';
import type { Ctx } from './kit';

export type Cut = 'tee' | 'long' | 'dress' | 'hoodie';
export type Fabric = 'cotton' | 'denim' | 'silk' | 'wool' | 'linen' | 'jersey';
export const FABRICS: Record<Fabric, { n: 'weave' | 'twill' | 'smooth' | 'knit'; rough: number; sheen: number; sr: number; rep: number; ns: number; aniso: number }> = {
  cotton: { n: 'weave', rough: .88, sheen: .35, sr: .7, rep: 34, ns: .35, aniso: 0 },
  jersey: { n: 'knit', rough: .9, sheen: .4, sr: .6, rep: 40, ns: .3, aniso: 0 },
  denim: { n: 'twill', rough: .82, sheen: .25, sr: .7, rep: 30, ns: .7, aniso: 0 },
  silk: { n: 'smooth', rough: .32, sheen: 1, sr: .3, rep: 8, ns: .1, aniso: .7 },
  wool: { n: 'knit', rough: 1, sheen: .9, sr: .8, rep: 22, ns: .9, aniso: 0 },
  linen: { n: 'weave', rough: .92, sheen: .2, sr: .8, rep: 18, ns: .8, aniso: 0 },
};
/* chest circumference of the garment in cm per size (body plus ease) */
export const SIZES: Record<string, number> = { XS: 90, S: 96, M: 102, L: 108, XL: 116 };

export interface Garment {
  S: Show; group: THREE.Group;
  set(o: Partial<{ cut: Cut; fabric: Fabric; size: string; color: string; pattern: string; pcol: string }>): void;
  print(draw: ((g: CanvasRenderingContext2D, A: number) => void) | null, widthCm?: number): void;
  spotsFor(): { chestY: number; a: number; hemY: number; shoulderY: number };
  tone(wall: string, floorCol: string): void;
}

export function garmentShow(ctx: Ctx, o: { bg: string; acc: string; hint: string; cut: Cut; fabric: Fabric; color: string; room?: boolean }): Garment {
  const S = show3d(ctx, { bg: o.bg, acc: o.acc, hint: o.hint });
  const wallM = new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: .95, side: THREE.BackSide });
  const floorM = new THREE.MeshPhysicalMaterial({ color: 0x1e1915, roughness: .42, clearcoat: .35, clearcoatRoughness: .4 });
  if (o.room) room(); else floor(S, 0, 4, o.acc);
  const st = { cut: o.cut, fabric: o.fabric, size: 'M', color: o.color, pattern: 'solid', pcol: '#f2efe8' };
  let printFn: ((g: CanvasRenderingContext2D, A: number) => void) | null = null, printW = 28;
  const group = new THREE.Group(); S.scene.add(group);
  const form = new THREE.Group(); S.scene.add(form);
  const tex: Record<string, THREE.Texture> = {};
  const cloth = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const rib = new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide });
  const can = document.createElement('canvas'); can.width = 2048; can.height = 1024; const cg = can.getContext('2d')!;
  const map = new THREE.CanvasTexture(can); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; cloth.map = map;
  /* sizes in metres; the dress form's shoulders sit at 1.42 m */
  const SH = 1.42;
  let dims = { a: .18, hemY: .8, top: SH + .05, neck: .07, chestY: 1.22 };

  /* the dress form: linen-covered neck cap, a turned wooden pole and a weighted base */
  const linen = new THREE.MeshStandardMaterial({ color: 0xd9cdb6, roughness: .95 }), wood = new THREE.MeshPhysicalMaterial({ color: 0x5a3b24, roughness: .45, clearcoat: .5 });
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a46b, metalness: 1, roughness: .25 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.052, .06, .12, 40), linen); neck.position.y = SH + .09; neck.scale.z = .85; neck.castShadow = true; form.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.04, .052, .02, 40), wood); cap.position.y = SH + .16; cap.scale.z = .85; form.add(cap);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(.018, 24, 16), brass); knob.position.y = SH + .18; form.add(knob);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, 1, 20), brass); pole.castShadow = true; form.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .035, 64), wood); base.position.y = .0175; base.castShadow = base.receiveShadow = true; form.add(base);

  /* the atelier: a curved backdrop, a polished floor, a travertine plinth, a clothing rail with hung pieces behind,
     and a soft overhead spotlight with a warm pool of light */
  function room() {
    const sc = S.scene; sc.fog = new THREE.Fog(o.bg, 4.5, 11);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 4, 96, 1, true, Math.PI * .55, Math.PI * .9), wallM); wall.position.set(0, 1.93, .6); wall.receiveShadow = true; sc.add(wall);
    const fl = new THREE.Mesh(new THREE.CircleGeometry(5, 96), floorM); fl.rotation.x = -Math.PI / 2; fl.position.y = -.07; fl.receiveShadow = true; sc.add(fl);
    const stone = new THREE.MeshPhysicalMaterial({ color: 0xd9cfbf, roughness: .55, clearcoat: .2, normalMap: normalTex('pebble', 256), normalScale: new THREE.Vector2(.08, .08) });
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(.5, .52, .07, 96), stone); pl.position.y = -.035; pl.castShadow = pl.receiveShadow = true; sc.add(pl);
    const ringM = new THREE.MeshPhysicalMaterial({ color: 0xc9a46b, metalness: 1, roughness: .3 });
    const trim = new THREE.Mesh(new THREE.TorusGeometry(.505, .004, 8, 128), ringM); trim.rotation.x = Math.PI / 2; trim.position.y = .0; sc.add(trim);
    /* rail */
    const rail = new THREE.Group(); rail.position.set(-.2, 0, -2.3); rail.rotation.y = .08; rail.scale.setScalar(.92); sc.add(rail);
    const bar = (len: number, r = .012) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), ringM);
    for (const x of [-1, 1]) { const p = bar(1.75); p.position.set(x * 1.05, .875 - .07, 0); p.castShadow = true; rail.add(p); const f = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .02, 24), ringM); f.position.set(x * 1.05, -.06, 0); rail.add(f); }
    const top = bar(2.16); top.rotation.z = Math.PI / 2; top.position.y = 1.68; rail.add(top);
    const tee = new THREE.Shape(); tee.moveTo(-.2, 0); tee.lineTo(.2, 0); tee.lineTo(.21, .5); tee.lineTo(.36, .4); tee.lineTo(.42, .5); tee.lineTo(.24, .66); tee.lineTo(.07, .7); tee.quadraticCurveTo(0, .64, -.07, .7); tee.lineTo(-.24, .66); tee.lineTo(-.42, .5); tee.lineTo(-.36, .4); tee.lineTo(-.21, .5); tee.closePath();
    const coat = new THREE.Shape(); coat.moveTo(-.25, 0); coat.lineTo(.25, 0); coat.lineTo(.25, .78); coat.lineTo(.3, .2); coat.lineTo(.36, .22); coat.lineTo(.33, .9); coat.lineTo(.08, 1.02); coat.quadraticCurveTo(0, .96, -.08, 1.02); coat.lineTo(-.33, .9); coat.lineTo(-.36, .22); coat.lineTo(-.3, .2); coat.lineTo(-.25, .78); coat.closePath();
    const hang = [[coat, 0x3a3f4a, 'twill'], [tee, 0xe9e2d4, 'weave'], [coat, 0x8a6a4a, 'knit'], [tee, 0x56663f, 'weave'], [coat, 0x1c1c1f, 'twill'], [tee, 0xb8402e, 'knit']] as const;
    hang.forEach(([sh, c, n], i) => {
      const m = new THREE.MeshPhysicalMaterial({ color: c, roughness: .9, sheen: .5, sheenRoughness: .7, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), .3), normalMap: normalTex(n as 'twill', 256), normalScale: new THREE.Vector2(.4, .4) });
      (m.normalMap as THREE.Texture).repeat.set(10, 10);
      const g = new THREE.ExtrudeGeometry(sh as THREE.Shape, { depth: .012, bevelEnabled: true, bevelSize: .014, bevelThickness: .014, bevelSegments: 4, curveSegments: 10 });
      const b = new THREE.Box3(); g.computeBoundingBox(); b.copy(g.boundingBox!); g.translate(0, -b.max.y, -.006);
      const gm = new THREE.Mesh(g, m); gm.castShadow = true; gm.position.set(-.85 + i * .34, 1.6, 0); gm.rotation.y = Math.PI / 2 * .55 + (i % 2 ? .12 : -.1); rail.add(gm);
      const hook = new THREE.Mesh(new THREE.TorusGeometry(.03, .003, 6, 24, Math.PI * 1.4), ringM); hook.position.set(-.85 + i * .34, 1.66, 0); hook.rotation.y = gm.rotation.y; rail.add(hook);
      const hb = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .42, 8), new THREE.MeshPhysicalMaterial({ color: 0x6b4a2e, roughness: .4, clearcoat: .6 })); hb.rotation.z = Math.PI / 2; hb.position.set(-.85 + i * .34, 1.6, 0); hb.rotation.y = gm.rotation.y; rail.add(hb);
    });
    /* overhead spot: soft edged, warm, with shadows */
    const sp = new THREE.SpotLight(0xffe6c4, 26, 6, .42, .85, 1.2); sp.position.set(.4, 3.3, 1.1); sp.target.position.set(0, .9, 0); sp.castShadow = true; sp.shadow.mapSize.set(S.phone ? 1024 : 2048, S.phone ? 1024 : 2048); sp.shadow.bias = -.0003; sp.shadow.radius = 8; sc.add(sp, sp.target);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(1.1, 64), new THREE.MeshBasicMaterial({ color: 0xffd9a8, transparent: true, opacity: .05, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.y = -.069; sc.add(pool);
  }
  function paintMap() {
    const W = can.width, H = can.height; cg.fillStyle = st.color; cg.fillRect(0, 0, W, H);
    cg.fillStyle = st.pcol; cg.strokeStyle = st.pcol;
    if (st.pattern === 'stripe') { const p = 1024 / 18; for (let y = 0; y < H; y += p) cg.fillRect(0, y, W, p * .38); }
    else if (st.pattern === 'gingham') { cg.globalAlpha = .45; const p = 2048 / 64; for (let x = 0; x < W; x += p * 2) cg.fillRect(x, 0, p, H); for (let y = 0; y < H; y += p * 2) cg.fillRect(0, y, W, p); cg.globalAlpha = 1; }
    else if (st.pattern === 'dots') { const p = 2048 / 48; for (let y = p / 2, r = 0; y < H; y += p, r++) for (let x = (r % 2) * p / 2; x < W; x += p) { cg.beginPath(); cg.arc(x, y, p * .16, 0, 7); cg.fill(); } }
    else if (st.pattern === 'pinstripe') { const p = 2048 / 90; for (let x = 0; x < W; x += p) cg.fillRect(x, 0, 2, H); }
    weave(); seams();
    /* the print, centred on the front of the chest (u = 0.5) at its real width */
    if (printFn) {
      /* u is the angle round the body; at the front of the oval one turn spans 2πa of cloth */
      const circ = 2 * Math.PI * dims.a, L = dims.top - dims.hemY, A = (printW / 100) / circ * W;
      cg.save(); cg.translate(W / 2 - A / 2, (.1 / L) * H); cg.scale(1, (H * circ) / (W * L)); printFn(cg, A); cg.restore();
    }
    map.needsUpdate = true;
  }
  /* thread-level detail painted into the colour itself: twill diagonals with white weft for denim, slub streaks for
     linen, fibre speckle for wool, a faint cross weave for cotton, a long soft gradient for silk */
  function weave() {
    const W = can.width, H = can.height, f = st.fabric; let r = 7; const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    cg.save();
    if (f === 'denim') { cg.globalAlpha = .1; cg.strokeStyle = '#ffffff'; cg.lineWidth = 1; for (let x = -H; x < W; x += 3.2) { cg.beginPath(); cg.moveTo(x, H); cg.lineTo(x + H * .55, 0); cg.stroke(); }
      cg.globalAlpha = .06; for (let i = 0; i < 900; i++) { cg.fillStyle = rnd() > .5 ? '#fff' : '#000'; cg.fillRect(rnd() * W, rnd() * H, 30 + rnd() * 120, 1.5); } }
    else if (f === 'linen') { for (let i = 0; i < 1600; i++) { cg.globalAlpha = .05 + rnd() * .06; cg.fillStyle = rnd() > .5 ? '#fff' : '#000'; cg.fillRect(rnd() * W, rnd() * H, 20 + rnd() * 160, 1 + rnd() * 1.5); }
      for (let i = 0; i < 900; i++) { cg.globalAlpha = .04; cg.fillStyle = '#000'; cg.fillRect(rnd() * W, rnd() * H, 1.2, 10 + rnd() * 60); } }
    else if (f === 'wool') { for (let i = 0; i < 26000; i++) { cg.globalAlpha = .05 + rnd() * .05; cg.fillStyle = rnd() > .5 ? '#fff' : '#000'; cg.fillRect(rnd() * W, rnd() * H, 1.5, 1.5); } }
    else if (f === 'silk') { const gr = cg.createLinearGradient(0, 0, W, 0); for (let k = 0; k <= 8; k++) gr.addColorStop(k / 8, k % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)'); cg.fillStyle = gr; cg.fillRect(0, 0, W, H); }
    else { cg.globalAlpha = .045; cg.fillStyle = '#000'; for (let x = 0; x < W; x += 2.4) cg.fillRect(x, 0, .8, H); for (let y = 0; y < H; y += 2.4) cg.fillRect(0, y, W, .8);
      for (let i = 0; i < 5000; i++) { cg.globalAlpha = .04; cg.fillStyle = rnd() > .5 ? '#fff' : '#000'; cg.fillRect(rnd() * W, rnd() * H, 2, 2); } }
    cg.restore();
  }
  /* side seams, a double-needle hem and topstitching round the neck, scaled to real millimetres */
  function seams() {
    const W = can.width, H = can.height, L = dims.top - dims.hemY, mm = H / (L * 1000), dark = 'rgba(0,0,0,.28)';
    const thread = st.fabric === 'denim' ? 'rgba(214,150,60,.85)' : 'rgba(0,0,0,.22)';
    cg.save();
    for (const u of [.25, .75]) { cg.fillStyle = dark; cg.fillRect(u * W - 1.5, 0, 3, H); cg.fillStyle = 'rgba(255,255,255,.08)'; cg.fillRect(u * W + 2, 0, 2, H); }
    cg.strokeStyle = thread; cg.lineWidth = Math.max(1.2, mm * .5); cg.setLineDash([mm * 3, mm * 1.6]);
    for (const d of [12, 18]) { const y = H - d * mm; cg.beginPath(); cg.moveTo(0, y); cg.lineTo(W, y); cg.stroke(); }
    if (st.cut !== 'long' && st.cut !== 'hoodie') { cg.setLineDash([]); cg.fillStyle = 'rgba(0,0,0,.18)'; cg.fillRect(0, H - 2 * mm, W, 2 * mm); }
    cg.setLineDash([mm * 3, mm * 1.6]); const y = 14 * mm; cg.beginPath(); cg.moveTo(0, y); cg.lineTo(W, y); cg.stroke();
    if (st.cut === 'hoodie') {
      /* kangaroo pocket: 40 cm wide at the base, 26 cm at the top, 18 cm tall, sitting on the rib band */
      const cm = mm * 10, circ = 2 * Math.PI * dims.a, ux = W / (circ * 100), x0 = W / 2, yb = H - 9 * cm, yt = yb - 18 * cm;
      const P: [number, number][] = [[x0 - 20 * cm * ux / (H / (L * 100)) * 0 - 20 * ux, yb], [x0 + 20 * ux, yb], [x0 + 13 * ux, yt], [x0 - 13 * ux, yt]];
      cg.setLineDash([]); cg.fillStyle = 'rgba(0,0,0,.10)'; cg.beginPath(); P.forEach(([x, y], k) => (k ? cg.lineTo(x, y) : cg.moveTo(x, y))); cg.closePath(); cg.fill();
      cg.lineWidth = 3; cg.strokeStyle = 'rgba(0,0,0,.35)'; cg.stroke();
      cg.lineWidth = Math.max(1.2, mm * .5); cg.strokeStyle = thread; cg.setLineDash([mm * 3, mm * 1.6]);
      const ins = 6 * mm; cg.beginPath(); cg.moveTo(P[1][0] - ins * .4, P[1][1]); cg.lineTo(P[2][0] - ins * .4, P[2][1] + ins); cg.lineTo(P[3][0] + ins * .4, P[3][1] + ins); cg.lineTo(P[0][0] + ins * .4, P[0][1]); cg.stroke();
      /* hand openings: darker slanted edges */
      cg.setLineDash([]); cg.lineWidth = 5; cg.strokeStyle = 'rgba(0,0,0,.3)';
      for (const sx of [-1, 1]) { cg.beginPath(); cg.moveTo(x0 + sx * 20 * ux, yb - 3 * cm); cg.lineTo(x0 + sx * 13 * ux, yt); cg.stroke(); }
    }
    cg.restore();
  }
  function paintFabric() {
    const F = FABRICS[st.fabric]; const n = (tex[F.n] ??= normalTex(F.n, 512));
    cloth.normalMap = n; cloth.normalScale.set(F.ns, F.ns); n.repeat.set(F.rep, F.rep / 2);
    cloth.roughness = F.rough; cloth.sheen = F.sheen; cloth.sheenRoughness = F.sr; cloth.sheenColor.set(st.color).lerp(new THREE.Color(0xffffff), .35);
    cloth.anisotropy = F.aniso; cloth.needsUpdate = true; paintMap();
    const k = (tex.knit ??= normalTex('knit', 512)); rib.normalMap = k; rib.normalScale.set(.9, .9); rib.roughness = .95; rib.sheen = .5; rib.color.set(st.color).multiplyScalar(.92); rib.needsUpdate = true;
  }

  /* lathe profile: [height above the hem as a share of the body length, radius as a share of the chest half-width] */
  const PROFILE: Record<Cut, [number, number][]> = {
    tee: [[0, 1.0], [.12, .98], [.32, .95], [.55, 1.0], [.72, 1.03], [.84, 1.0], [.91, .92], [.955, .74], [.985, .5], [1, .40]],
    long: [[0, .96], [.06, .92], [.1, .98], [.32, .96], [.55, 1.0], [.72, 1.03], [.84, 1.0], [.91, .92], [.955, .74], [.985, .5], [1, .40]],
    hoodie: [[0, .96], [.06, .92], [.1, 1.02], [.32, 1.0], [.55, 1.03], [.72, 1.05], [.84, 1.02], [.91, .94], [.955, .78], [.985, .54], [1, .44]],
    dress: [[0, 1.55], [.18, 1.32], [.38, 1.06], [.5, .86], [.6, .8], [.76, .98], [.86, .96], [.93, .78], [.98, .55], [1, .5]],
  };
  function lathe(profile: [number, number][], y0: number, y1: number, a: number, zs: number, mat: THREE.Material) {
    const curve = new THREE.SplineCurve(profile.map(([hh, r]) => new THREE.Vector2(r * a, y0 + hh * (y1 - y0))));
    /* sample evenly in height so the texture's v follows height (keeps prints undistorted) */
    const pts: THREE.Vector2[] = []; const N = 90; const raw = curve.getPoints(400);
    for (let i = 0; i <= N; i++) { const y = y0 + (y1 - y0) * i / N; let best = raw[0]; for (const p of raw) if (Math.abs(p.y - y) < Math.abs(best.y - y)) best = p; pts.push(new THREE.Vector2(best.x, y)); }
    const g = new THREE.LatheGeometry(pts, 160, Math.PI, Math.PI * 2);   // seam at the back, front at u = 0.5
    drape(g, y0, y1, a); g.scale(1, 1, zs); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m;
  }
  /* drape: cloth hangs from the shoulders, so folds grow towards the hem; a few deep folds plus finer ripples,
     a slightly uneven hem, and soft pull lines from the underarm towards the waist */
  function drape(g: THREE.BufferGeometry, y0: number, y1: number, a: number) {
    const p = g.attributes.position, v = new THREE.Vector3(), dress = st.cut === 'dress';
    const ribbed = st.cut === 'long' || st.cut === 'hoodie'; const k1 = dress ? 9 : 5, k2 = dress ? 17 : 11, amp = dress ? .085 : ribbed ? .012 : .032, seed = st.size.length * 1.7 + (st.cut.length * .9);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); const r = Math.hypot(v.x, v.z); if (r < 1e-5) continue;
      const phi = Math.atan2(v.x, v.z), hh = (v.y - y0) / (y1 - y0), fall = Math.pow(Math.max(0, 1 - hh / (dress ? .62 : .78)), 1.6);
      let d = fall * amp * (Math.sin(phi * k1 + seed) * .62 + Math.sin(phi * k2 + seed * 2.3) * .26 + Math.sin(phi * 3 + 1.1) * .22);
      /* pull lines at the sides (phi near ±90°) between underarm and waist */
      const side = Math.exp(-Math.pow((Math.abs(phi) - Math.PI / 2) / .35, 2)), band = Math.exp(-Math.pow((hh - .62) / .14, 2));
      d += side * band * .018 * Math.sin((hh * 40) + phi * 6);
      const s2 = 1 + d; v.x *= s2; v.z *= s2;
      if (hh < .02 && !ribbed) v.y += fall * (dress ? .007 : .004) * (Math.sin(phi * k1 + seed + .8) * .7 + Math.sin(phi * 4 + 2) * .3);
      p.setXYZ(i, v.x, v.y, v.z);
    }
  }
  function sleeve(from: THREE.Vector3, dir: THREE.Vector3, len: number, r0: number, r1: number, cuff: boolean) {
    const g = new THREE.CylinderGeometry(r1, r0, len, 72, 48, true); g.translate(0, -len / 2, 0);
    /* a little bend and a flattened section, as cloth hangs */
    const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = -v.y / len, ph = Math.atan2(v.x, v.z);
      /* compression wrinkles: rings that bunch up above the cuff, and long folds down the sleeve */
      const w = 1 + (cuff ? Math.pow(k, 3) * .07 * Math.sin(k * 46 + ph * 2) : 0) + .03 * k * Math.sin(ph * 4 + 1.3);
      v.x *= w; v.z *= w * .82; v.x += Math.sin(k * Math.PI) * .012; p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, cloth); m.castShadow = true; m.position.copy(from); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    /* a rolled shoulder seam that hides the join with the body */
    const capR = new THREE.Mesh(new THREE.TorusGeometry(r0 * .98, .0045, 8, 64), cloth); capR.rotation.x = Math.PI / 2; capR.scale.y = .82; capR.position.y = -.004; m.add(capR);
    if (!cuff) { const hm = new THREE.Mesh(new THREE.TorusGeometry(r1, .003, 6, 64), cloth); hm.rotation.x = Math.PI / 2; hm.scale.y = .82; hm.position.y = -len; m.add(hm); }
    if (cuff) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1 * .92, r1 * .98, .06, 40, 1, true), rib); c.position.y = -len + .025; c.scale.z = .82; m.add(c); }
    return m;
  }
  function build() {
    group.traverse((x) => { const m = x as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); group.clear();
    const C = SIZES[st.size] / 100, zs = .68, a = C / (2 * Math.PI * Math.sqrt((1 + zs * zs) / 2)) / 1.02;
    const len = st.cut === 'dress' ? .98 : st.cut === 'tee' ? .68 : .66, top = SH + .035, hemY = top - len;
    dims = { a, hemY, top, neck: a * .4, chestY: top - .2 };
    const body = lathe(PROFILE[st.cut], hemY, top, a, zs, cloth); group.add(body);
    /* rib collar (crew neck), or a scoop neck with a binding for the dress */
    const nr = a * (st.cut === 'dress' ? .5 : st.cut === 'hoodie' ? .44 : .40);
    const col = new THREE.Mesh(new THREE.TorusGeometry(nr, .011, 12, 96), rib); col.rotation.x = Math.PI / 2; col.scale.y = zs; col.position.y = top - .004; group.add(col);
    const shY = top - .095, shX = a * .74;
    if (st.cut === 'tee') for (const s of [-1, 1]) group.add(sleeve(new THREE.Vector3(s * shX, shY, 0), new THREE.Vector3(s * .62, -1, 0), .22, a * .46, a * .4, false));
    if (st.cut === 'long' || st.cut === 'hoodie') for (const s of [-1, 1]) group.add(sleeve(new THREE.Vector3(s * shX, shY, 0), new THREE.Vector3(s * .22, -1, .04), .6, a * .46, a * .27, true));
    if (st.cut === 'long' || st.cut === 'hoodie') { const hb = new THREE.Mesh(new THREE.CylinderGeometry(a * .97, a * .93, .07, 128, 1, true), rib); hb.scale.z = zs; hb.position.y = hemY + .035; group.add(hb); }
    if (st.cut === 'dress') for (const s of [-1, 1]) { const strap = new THREE.Mesh(new THREE.TorusGeometry(.07, .006, 8, 40, Math.PI), cloth); strap.position.set(s * a * .42, top - .01, 0); strap.rotation.y = Math.PI / 2; group.add(strap); }
    if (st.cut === 'hoodie') {
      /* hood lying on the back, and a kangaroo pocket */
      const hood = new THREE.Mesh(new THREE.TorusGeometry(nr * 1.35, .07, 24, 72, Math.PI * 1.3), cloth);
      hood.rotation.x = Math.PI / 2; hood.rotation.z = Math.PI * 1.125; hood.scale.set(1, zs * 1.15, .55); hood.position.set(0, top + .005, -.012); hood.castShadow = true; group.add(hood);
      /* the kangaroo pocket is sewn flat onto the front, so it is drawn into the cloth with its stitching (see seams) */
      for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, .14, 8), new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: .8 })); d.position.set(s * .03, top - .085, a * zs * .5 + .02); d.rotation.x = .2; group.add(d); }
    }
    /* the pole runs from the base up into the garment */
    pole.scale.y = hemY + .1; pole.position.y = (hemY + .1) / 2;
    paintMap();
  }

  const G: Garment = {
    S, group,
    set(v) { const rebuild = v.cut !== undefined && v.cut !== st.cut || v.size !== undefined && v.size !== st.size; Object.assign(st, v);
      if (rebuild) build(); else paintMap(); if (v.fabric || v.color) paintFabric(); },
    print(fn, w = 28) { printFn = fn; printW = w; paintMap(); },
    tone(w, f) { wallM.color.set(w); floorM.color.set(f); (S.scene.fog as THREE.Fog | null)?.color.set(S.scene.background as THREE.Color); },
    spotsFor() { return { chestY: dims.chestY, a: dims.a, hemY: dims.hemY, shoulderY: dims.top - .055 }; },
  };
  paintFabric(); build();
  S.key.target = group; S.key.position.set(1.2, 2.6, 1.8); const sc = S.key.shadow.camera; sc.left = sc.bottom = -1; sc.right = sc.top = 1.2; sc.far = 8; sc.updateProjectionMatrix();
  return G;
}
