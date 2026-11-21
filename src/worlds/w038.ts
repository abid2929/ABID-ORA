/* 022 · Solar System World (site world 038). The Sun and all eight planets, each where it really is
   today. Positions come from JPL's Keplerian elements (the same code that places the planets in
   world 039's live sky), so you can scrub through time and watch the inner planets lap the outer
   ones. Every planet is drawn in code: Earth's continents from Natural Earth (public domain), the
   bands and storms of the giants, Saturn's rings with the Cassini division. Tap a planet to fly
   there; its facts come from Planet Lab (world 038): surface gravity, escape speed and length of
   year worked out from mass, radius and orbit, plus how long its light takes to reach Earth. */
import type { Ctx } from './kit';
import { gravity, vEsc } from './w038lab';
import { helio, jd } from './w039lab';
import { LAND110 } from './land110';
import { THREE, stage, sec, para, slider, segs, stats, chips, btns, canvasTex, glowTex, GLSL_NOISE, rng, clamp, noise2 } from './nskit';

/* NASA planetary fact sheet: mass and radius (Earth = 1), day length (h), axial tilt (°), orbit (AU) */
const PL: { n: string; m: number; r: number; day: number; tilt: number; au: number; col: string }[] = [
  { n: 'Mercury', m: .0553, r: .383, day: 4222.6, tilt: .03, au: .387, col: '#a9a39b' },
  { n: 'Venus', m: .815, r: .949, day: -2802, tilt: 177.4, au: .723, col: '#e8cf9a' },
  { n: 'Earth', m: 1, r: 1, day: 24, tilt: 23.4, au: 1, col: '#5d8fd6' },
  { n: 'Mars', m: .107, r: .532, day: 24.7, tilt: 25.2, au: 1.524, col: '#c86a3e' },
  { n: 'Jupiter', m: 317.8, r: 11.21, day: 9.9, tilt: 3.1, au: 5.2, col: '#d9b38c' },
  { n: 'Saturn', m: 95.2, r: 9.45, day: 10.7, tilt: 26.7, au: 9.58, col: '#e3cf9f' },
  { n: 'Uranus', m: 14.5, r: 4.01, day: -17.2, tilt: 97.8, au: 19.2, col: '#a6dde3' },
  { n: 'Neptune', m: 17.1, r: 3.88, day: 16.1, tilt: 28.3, au: 30.1, col: '#4f74d9' },
];

/* ---------- planet surfaces, painted in code ---------- */
function decodeLand() {
  return LAND110.split(';').map((ring) => { const v = ring.split(',').map(Number), out: [number, number][] = []; let x = 0, y = 0; for (let i = 0; i < v.length; i += 2) { x += v[i]; y += v[i + 1]; out.push([x / 10, y / 10]); } return out; });
}
export function paint(name: string, W: number): THREE.Texture {
  const H = W / 2;
  return canvasTex(W, H, (g) => {
    const im = g.createImageData(W, H), d = im.data, R = rng(name.length * 31), n1 = noise2(name.length), n2 = noise2(name.length + 9), n3 = noise2(name.length + 17);
    let mask: Uint8ClampedArray | null = null;
    if (name === 'Earth') {
      const c = document.createElement('canvas'); c.width = W; c.height = H; const cg = c.getContext('2d')!;
      cg.fillStyle = '#000'; cg.fillRect(0, 0, W, H); cg.fillStyle = '#fff';
      for (const ring of decodeLand()) { cg.beginPath(); ring.forEach(([lo, la], i) => { const x = (lo + 180) / 360 * W, y = (90 - la) / 180 * H; if (i) cg.lineTo(x, y); else cg.moveTo(x, y); }); cg.closePath(); cg.fill(); }
      mask = cg.getImageData(0, 0, W, H).data;
    }
    for (let y = 0; y < H; y++) {
      const lat = 90 - y / H * 180, la = Math.abs(lat);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, u = x / W * 8, v = y / H * 4;
        /* seamless in longitude: sample noise on a cylinder */
        const ang = x / W * Math.PI * 2, cx = Math.cos(ang) * 2.5, cz = Math.sin(ang) * 2.5;
        const f = (n: (a: number, b: number) => number, s: number) => n(cx * s + v * s * .37, cz * s + v * s);
        let r = 0, gg = 0, b = 0;
        if (name === 'Earth') {
          const land = mask![i] > 127, k = f(n1, 1.6) * .5 + .5, k2 = f(n2, 5) * .5 + .5;
          if (la > 78 || (la > 64 && lat < 0 && land)) { r = gg = b = 235 + k2 * 15; }
          else if (land) {
            const dry = clamp(1 - Math.abs(la - 24) / 14, 0, 1) * (.6 + k * .6), north = clamp((la - 50) / 15, 0, 1);
            r = 52 + dry * 140 + k2 * 25 - north * 10; gg = 82 + dry * 85 + k2 * 20 - north * 18; b = 38 + dry * 40 + k2 * 10;
          } else { const sh = k * .4; r = 8 + sh * 10; gg = 34 + sh * 30 + (1 - la / 90) * 14; b = 78 + sh * 40 + (1 - la / 90) * 20; }
        } else if (name === 'Mercury' || name === 'Moon') {
          const k = f(n1, 2) * .5 + .5, k2 = f(n2, 9) * .5 + .5, base = name === 'Moon' ? 120 + k * 60 - (f(n3, 1.2) > .25 ? 45 : 0) : 110 + k * 50;
          r = gg = b = base + k2 * 30; if (name === 'Mercury') { r *= 1.04; b *= .94; }
        } else if (name === 'Venus') {
          const k = f(n1, 1.2 + Math.sin(v * 3) * .2) * .5 + .5, k2 = f(n2, 4) * .5 + .5; r = 215 + k * 30; gg = 180 + k * 30 + k2 * 10; b = 120 + k * 25;
        } else if (name === 'Mars') {
          const k = f(n1, 1.5) * .5 + .5, k2 = f(n2, 6) * .5 + .5, dark = f(n3, 1.1) > .18 && la < 50 ? .55 : 1;
          r = (170 + k * 50 + k2 * 20) * dark; gg = (85 + k * 25 + k2 * 10) * dark; b = (50 + k * 15) * dark; if (la > 80) r = gg = b = 240;
        } else {
          /* giants: latitude bands bent by turbulence */
          const turb = f(n1, 3) * .05 + f(n2, 9) * .012, bl = lat / 90 + turb;
          const band = Math.sin(bl * (name === 'Jupiter' ? 22 : name === 'Saturn' ? 30 : 12)) * .5 + .5, band2 = Math.sin(bl * 61 + 1) * .5 + .5;
          if (name === 'Jupiter') { r = 200 + band * 40 - band2 * 20; gg = 170 + band * 35 - band2 * 25; b = 135 + band * 30 - band2 * 30; if (la > 60) { r *= .85; gg *= .85; b *= .9; } }
          else if (name === 'Saturn') { r = 215 + band * 25; gg = 195 + band * 22; b = 150 + band * 18 - band2 * 8; }
          else if (name === 'Uranus') { r = 160 + band * 12; gg = 215 + band * 10; b = 222 + band * 8; }
          else { r = 60 + band * 25; gg = 95 + band * 35; b = 210 + band * 25; }
          if (name === 'Jupiter') { const dx = Math.min(Math.abs(x / W - .62), 1 - Math.abs(x / W - .62)) * 360, dy = lat + 22; const e = (dx / 11) ** 2 + (dy / 5.5) ** 2; if (e < 1) { const q = 1 - e; r = r * (1 - q) + 200 * q; gg = gg * (1 - q) + 95 * q; b = b * (1 - q) + 70 * q; } }
          if (name === 'Neptune') { const dx = Math.min(Math.abs(x / W - .3), 1 - Math.abs(x / W - .3)) * 360, dy = lat + 20; const e = (dx / 9) ** 2 + (dy / 5) ** 2; if (e < 1) { r *= .55; gg *= .55; b *= .7; } }
        }
        const gr = (R() - .5) * 6; d[i] = clamp(r + gr, 0, 255); d[i + 1] = clamp(gg + gr, 0, 255); d[i + 2] = clamp(b + gr, 0, 255); d[i + 3] = 255;
        void u;
      }
    }
    g.putImageData(im, 0, 0);
  });
}
function cloudsTex(W: number) {
  return canvasTex(W, W / 2, (g) => {
    const H = W / 2, im = g.createImageData(W, H), n1 = noise2(5), n2 = noise2(6);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, ang = x / W * Math.PI * 2, cx = Math.cos(ang) * 3, cz = Math.sin(ang) * 3, v = y / H * 6, lat = Math.abs(90 - y / H * 180);
      let a = n1(cx + v * .3, cz + v) * .6 + n2(cx * 3 + v, cz * 3 + v * 2) * .4;
      a = clamp((a + .05 + (lat > 40 && lat < 65 ? .12 : 0) - (lat < 30 && lat > 12 ? .15 : 0)) * 2.2, 0, 1);
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a * 235;
    }
    g.putImageData(im, 0, 0);
  });
}
function ringTex() {
  return canvasTex(1024, 8, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const r = 1.24 + x / w * (2.27 - 1.24); /* Saturn radii */
      let a = .55 + Math.sin(r * 90) * .12 + Math.sin(r * 233) * .08;
      if (r < 1.52) a *= .35;                       /* C ring: faint */
      if (r > 1.95 && r < 2.03) a *= .06;           /* Cassini division */
      if (r > 2.21 && r < 2.23) a *= .3;            /* Encke gap */
      const c = r < 1.52 ? 150 : r < 1.95 ? 222 : 195;
      for (let y = 0; y < h; y++) { const i = (y * w + x) * 4; im.data[i] = c; im.data[i + 1] = c * .93; im.data[i + 2] = c * .8; im.data[i + 3] = clamp(a, 0, 1) * 255; }
    }
    g.putImageData(im, 0, 0);
  });
}

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 22 · Space'), title: t('title', 'Solar System World'), sub: t('sub', 'Every planet exactly where it is today. Scrub through time, then tap a world to fly there.'),
    acc: '#ffc46b', ink: '#030306', hf: "'Space Grotesk'", fov: 45, near: .01, far: 40000,
    lab: () => import('./w038lab'), labName: t('lab', 'Planet Lab'),
  });
  const { scene, camera, controls, renderer } = S;
  renderer.toneMappingExposure = 1.05;
  scene.background = new THREE.Color(0x020205);
  const TW = S.phone ? 1024 : 2048;
  const P = { compact: true, big: true, speed: 0 };
  let ms = Date.now();

  /* ---- sky ---- */
  {
    const n = 12000, p = new Float32Array(n * 3), c = new Float32Array(n * 3), R = rng(8);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(R() * 2 - 1, R() * 2 - 1, R() * 2 - 1).normalize().multiplyScalar(20000); p.set([v.x, v.y, v.z], i * 3); const w = Math.pow(R(), 3) * .9 + .1; c.set([w, w * .95, w * (.85 + R() * .3)], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false })));
  }

  /* ---- the Sun: boiling granulation, limb darkening, corona ---- */
  const sunU = { uTime: { value: 0 } };
  const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({
    uniforms: sunU,
    vertexShader: 'varying vec3 vN; varying vec3 vP; varying vec3 vV; void main(){ vN=normalize(normalMatrix*normal); vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vP; varying vec3 vV; ${GLSL_NOISE}
      void main(){ float g=fbm(vP*6.+vec3(0.,uTime*.05,0.))*.5+.5; float c=snoise(vP*22.+uTime*.15)*.5+.5;
        float mu=clamp(dot(vN,vV),0.,1.); float limb=pow(mu,.55);
        vec3 col=mix(vec3(1.,.42,.08),vec3(1.,.86,.5),g*.7+c*.3)*limb*2.6; col+=vec3(1.,.6,.2)*pow(1.-mu,3.)*.6;
        gl_FragColor=vec4(col,1.); }`,
  }));
  scene.add(sun);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(256, [[0, 'rgba(255,220,150,1)'], [.18, 'rgba(255,170,80,.55)'], [.45, 'rgba(255,120,40,.12)'], [1, 'rgba(255,90,20,0)']]), blending: THREE.AdditiveBlending, depthWrite: false }));
  sun.add(corona); corona.scale.setScalar(6);
  const light = new THREE.PointLight(0xfff4e6, 3.2, 0, 0); scene.add(light);
  scene.add(new THREE.AmbientLight(0x404050, .12));

  /* ---- planets ---- */
  type Body = { d: typeof PL[0]; g: THREE.Group; mesh: THREE.Mesh; tilt: THREE.Group; orbit: THREE.Line; tag: ReturnType<typeof S.tag>; pos: THREE.Vector3; au: THREE.Vector3; clouds?: THREE.Mesh };
  const bodies: Body[] = [];
  const pickables: THREE.Object3D[] = [];
  for (const d of PL) {
    const g = new THREE.Group(), tilt = new THREE.Group(); tilt.rotation.z = THREE.MathUtils.degToRad(d.tilt); g.add(tilt);
    const mat = new THREE.MeshStandardMaterial({ map: paint(d.n, ['Jupiter', 'Saturn', 'Earth'].includes(d.n) ? TW : TW / 2), roughness: d.n === 'Earth' ? .7 : .9, metalness: 0 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat); mesh.userData.body = d.n; tilt.add(mesh); pickables.push(mesh);
    const b: Body = { d, g, mesh, tilt, orbit: null as unknown as THREE.Line, tag: S.tag(t('p.' + d.n, d.n)), pos: new THREE.Vector3(), au: new THREE.Vector3() };
    if (d.n === 'Earth') {
      const cl = new THREE.Mesh(new THREE.SphereGeometry(1.012, 96, 64), new THREE.MeshStandardMaterial({ map: cloudsTex(TW / 2), transparent: true, depthWrite: false, roughness: 1 })); tilt.add(cl); b.clouds = cl;
      const atm = new THREE.Mesh(new THREE.SphereGeometry(1.05, 64, 48), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
        vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vW,1.); }',
        fragmentShader: 'varying vec3 vN; varying vec3 vW; void main(){ vec3 V=normalize(cameraPosition-vW); float r=pow(1.-abs(dot(vN,V)),2.5); float l=clamp(dot(vN,normalize(-vW))*1.5+.4,0.,1.); gl_FragColor=vec4(vec3(.35,.6,1.)*r*l*1.4,r*l); }' }));
      tilt.add(atm);
      const moon = new THREE.Mesh(new THREE.SphereGeometry(.273, 48, 32), new THREE.MeshStandardMaterial({ map: paint('Moon', TW / 4), roughness: 1 })); moon.name = 'moon'; g.add(moon);
    }
    if (d.n === 'Saturn') {
      const rg = new THREE.RingGeometry(1.24, 2.27, 160, 1), pos = rg.attributes.position as THREE.BufferAttribute, uv = rg.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 1.24) / (2.27 - 1.24), .5); }
      const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ringTex(), transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false })); ring.rotation.x = -Math.PI / 2; tilt.add(ring);
    }
    scene.add(g); bodies.push(b);
  }
  /* asteroid belt between Mars and Jupiter */
  const belt = (() => {
    const n = S.phone ? 2500 : 5000, p = new Float32Array(n * 3), R = rng(4);
    for (let i = 0; i < n; i++) { const a = 2.1 + R() * 1.2, th = R() * 6.283; p.set([Math.cos(th) * a, (R() - .5) * .15, Math.sin(th) * a], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9a8f80, size: 1.5, sizeAttenuation: false, transparent: true, opacity: .55, depthWrite: false })); scene.add(m); return m;
  })();

  /* scale: true distances (AU) or compressed so everything fits; planets enlarged or true size */
  const AU = 60;
  const dist = (au: number) => P.compact ? AU * 1.2 * Math.pow(au, .6) : AU * 2.4 * au;
  const rad = (r: number) => P.big ? .9 + Math.pow(r, .62) * 1.15 : r * 6371 / 149.6e6 * AU * 2.4 * (P.compact ? 400 : 1);
  const sunR = () => P.big ? 7 : 696000 / 149.6e6 * AU * 2.4 * (P.compact ? 40 : 1);
  function orbits() {
    for (const b of bodies) {
      if (b.orbit) { scene.remove(b.orbit); b.orbit.geometry.dispose(); }
      const pts: THREE.Vector3[] = [], T0 = (jd(ms) - 2451545) / 36525, per = Math.sqrt(b.d.au ** 3) / 100;
      for (let i = 0; i <= 256; i++) { const h = helio(b.d.n, T0 + per * i / 256); const r = Math.hypot(h[0], h[1], h[2]), k = dist(r) / r; pts.push(new THREE.Vector3(h[0] * k, h[2] * k, -h[1] * k)); }
      b.orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: new THREE.Color(b.d.col), transparent: true, opacity: .32, depthWrite: false }));
      scene.add(b.orbit);
    }
    const bp = belt.geometry.attributes.position as THREE.BufferAttribute, R = rng(4);
    for (let i = 0; i < bp.count; i++) { const a = 2.1 + R() * 1.2, th = R() * 6.283, k = dist(a); bp.setXYZ(i, Math.cos(th) * k, (R() - .5) * k * .03, Math.sin(th) * k); }
    bp.needsUpdate = true;
  }
  function place() {
    const T = (jd(ms) - 2451545) / 36525;
    for (const b of bodies) {
      const h = helio(b.d.n, T), r = Math.hypot(h[0], h[1], h[2]), k = dist(r) / r;
      b.au.set(h[0], h[1], h[2]); b.pos.set(h[0] * k, h[2] * k, -h[1] * k); b.g.position.copy(b.pos);
      const s = rad(b.d.r); b.tilt.scale.setScalar(s);
      b.mesh.rotation.y = ((ms / 3.6e6) / b.d.day) % 1 * Math.PI * 2;
      if (b.clouds) b.clouds.rotation.y = b.mesh.rotation.y * 1.02;
      const moon = b.g.getObjectByName('moon');
      if (moon) { const mt = (jd(ms) - 2451550.1) / 27.3217 * Math.PI * 2; const md = P.big ? s * 3.2 : s * 60.3; moon.position.set(Math.cos(mt) * md, 0, -Math.sin(mt) * md); moon.scale.setScalar(P.big ? s : 1); }
    }
    sun.scale.setScalar(sunR());
  }

  /* ---- panel ---- */
  const B = S.body;
  const info = stats(B, [['date', t('date', 'Date')], ['ed', t('ed', 'Earth from the Sun')], ['sel', t('sel', 'Selected')], ['lt', t('lt', 'Its light reaches us in')]], true);
  sec(B, t('s.time', 'Time'));
  para(B, t('p.time', 'Positions use JPL\'s orbital elements for this exact date. Speed time up to watch Mercury lap the Sun four times while Earth goes round once.'));
  const speeds: [string, string][] = [['0', t('live', 'Live')], ['1', t('d1', '1 day/s')], ['10', t('d10', '10 days/s')], ['100', t('d100', '100 days/s')]];
  segs(B, '', speeds, '0', (v) => { P.speed = +v; if (!P.speed) ms = Date.now(); });
  slider(B, t('r.jump', 'Jump in years'), { min: -50, max: 50, step: 1, value: 0, fmt: (v) => (v > 0 ? '+' : '') + v }, (v) => { ms = Date.now() + v * 365.25 * 864e5; P.speed = 0; orbits(); });
  sec(B, t('s.scale', 'Scale'));
  para(B, t('p.scale', 'Space is mostly empty. At true size the planets are specks: Earth is 23,000 of its own widths from the Sun.'));
  segs(B, t('r.dist', 'Distances'), [['c', t('compact', 'Compressed')], ['t', t('true', 'True')]], 'c', (v) => { P.compact = v === 'c'; orbits(); place(); });
  segs(B, t('r.size', 'Planet sizes'), [['b', t('big', 'Enlarged')], ['t', t('true', 'True')]], 'b', (v) => { P.big = v === 'b'; place(); });
  const facts = stats(B, [['g', t('f.g', 'Surface gravity')], ['v', t('f.v', 'Escape speed')], ['y', t('f.y', 'Year')], ['d', t('f.d', 'Day')]]);
  btns(B, [[t('b.now', 'Back to today'), () => { ms = Date.now(); P.speed = 0; orbits(); }]]);

  let sel: Body | null = null;
  function select(b: Body, fly = true) {
    sel = b; const d = b.d;
    facts('g', `${gravity(d.m, d.r).toFixed(1)} m/s²`); facts('v', `${vEsc(d.m, d.r).toFixed(1)} km/s`);
    const yr = Math.sqrt(d.au ** 3); facts('y', yr < 1 ? `${Math.round(yr * 365.25)} ${t('days', 'days')}` : `${yr.toFixed(1)} ${t('years', 'years')}`);
    facts('d', Math.abs(d.day) > 48 ? `${(Math.abs(d.day) / 24).toFixed(0)} ${t('days', 'days')}` : `${Math.abs(d.day).toFixed(1)} h`);
    info('sel', t('p.' + d.n, d.n));
    if (fly) {
      const s = rad(d.r), dir = b.pos.clone().normalize();
      const cam = b.pos.clone().add(dir.multiplyScalar(-s * 2.2)).add(new THREE.Vector3(s * 2.6, s * 1.1, s * 3.2).multiplyScalar(S.phone ? 1.4 : 1));
      S.flyTo(cam, b.pos.clone(), 2.8, undefined, s * 4);
      follow = b;
      S.showCard(t('p.' + d.n, d.n), `${gravity(d.m, d.r).toFixed(1)} m/s² · ${t('k.weigh', 'a 60 kg person would weigh')} ${(60 * gravity(d.m, d.r) / 9.81).toFixed(0)} kg · ${b.d.au} AU ${t('k.from', 'from the Sun')}`);
    }
  }
  let follow: Body | null = null;
  S.pick(() => pickables, (hit) => { const b = bodies.find((x) => x.d.n === hit.object.userData.body); if (b) select(b); });
  controls.addEventListener('start', () => { /* keep following the selected planet, but let the user orbit it */ });

  const home = { p: new THREE.Vector3(0, 260, 520), t: new THREE.Vector3(0, 0, 0) };
  if (S.phone) home.p.multiplyScalar(1.5);
  camera.position.set(0, 2600, 5200); S.setHome(home.p, home.t);
  controls.maxDistance = 9000; controls.minDistance = .5;
  chips(S, [['all', t('c.all', 'Whole system')], ['inner', t('c.inner', 'Inner planets')], ['Earth', t('p.Earth', 'Earth')], ['Jupiter', t('p.Jupiter', 'Jupiter')], ['Saturn', t('p.Saturn', 'Saturn')]], 'all', (v) => {
    if (v === 'all') { follow = null; S.flyTo(home.p, home.t, 2.6); }
    else if (v === 'inner') { follow = null; S.flyTo(new THREE.Vector3(0, 110, 170).multiplyScalar(S.phone ? 1.4 : 1), new THREE.Vector3(), 2.6); }
    else { const b = bodies.find((x) => x.d.n === v); if (b) select(b); }
  });

  orbits(); place(); select(bodies[2], false);
  const prev = new THREE.Vector3(); let acc = 0;
  S.onFrame((dt, tm) => {
    sunU.uTime.value = tm;
    if (P.speed) ms += dt * P.speed * 864e5; else if ((acc += dt) > 1) { ms = Date.now(); acc = 0; }
    if (follow) prev.copy(follow.pos);
    place();
    if (follow) { const d = follow.pos.clone().sub(prev); camera.position.add(d); controls.target.add(d); }
    const e = bodies[2].au.length();
    info('date', new Date(ms).toISOString().slice(0, 10)); info('ed', `${e.toFixed(3)} AU`);
    if (sel) { const dx = sel.au.clone().sub(bodies[2].au).length(), min = dx * 149.6e6 / 299792.458 / 60; info('lt', sel === bodies[2] ? '–' : min < 60 ? `${min.toFixed(1)} min` : `${(min / 60).toFixed(1)} h`); }
    for (const b of bodies) b.tag.at(b.pos.clone().add(new THREE.Vector3(0, rad(b.d.r) * 1.3, 0)), camera.position.distanceTo(b.pos) > rad(b.d.r) * 6);
  });
  S.flyTo(home.p, home.t, 4);
  S.start();
}
