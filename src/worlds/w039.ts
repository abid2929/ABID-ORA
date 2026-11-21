/* 023 · Astronomy World (site world 039). Stand on a dark hilltop beside an observatory and look at
   tonight's real sky. The 1,627 brightest stars (Hipparcos, via d3-celestial), the 88 constellation
   figures, the Milky Way, the Moon with its true phase and the planets are placed with the same
   formulas as world 039 (Astronomical Almanac Sun, truncated lunar theory, JPL planetary elements)
   for any city and time. The sky colour follows the Sun: blue by day, through twilight to night.
   Tap anything and the telescope really slews to it; switch to the eyepiece view to zoom in. */
import type { Ctx } from './kit';
import { jd, sun, moon, planet, altaz, PLANETS, PLACES, bvRGB, gmst } from './w039lab';
import { I18N } from '../scripts/i18n';
import { THREE, stage, sec, para, slider, segs, stats, chips, btns, canvasTex, glowTex, GLSL_NOISE, rng, clamp, noise2 } from './nskit';

const RS = 900; /* sky sphere radius */
const D2R = Math.PI / 180;
interface Sky { s: number[]; n: Record<string, string>; l: Record<string, number[][][]>; c: Record<string, [string, number, number, string]> }
type Obj = { kind: string; name: string; ra: number; dec: number; mag?: number };

export default function (ctx: Ctx) {
  const t = ctx.t;
  const S = stage(ctx, {
    num: t('n', 'World 23 · Space'), title: t('title', 'Astronomy World'), sub: t('sub', 'Tonight\'s real sky over any city. Tap a star, planet or the Moon and the telescope turns to it.'),
    acc: '#8fb8ff', ink: '#03050b', hf: "'Instrument Serif'", fov: 70, near: .05, far: 3000,
    lab: () => import('./w039lab'), labName: t('lab', 'Sky chart (2D)'),
  });
  const { scene, camera, controls, renderer, cv } = S;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  const P = { place: 'dhaka', offH: 0, lines: true, names: true, limit: 5.2 };
  let ms = Date.now(), sky: Sky | null = null;
  const place = () => PLACES.find((p) => p[0] === P.place)!;

  /* ---- camera: stand still and look around; zoom changes the field of view (like a lens) ---- */
  const eye = new THREE.Vector3(0, 1.7, 0);
  controls.target.copy(eye); camera.position.set(0, 1.7, .01);
  controls.enableZoom = false; controls.enablePan = false; controls.rotateSpeed = -.35;
  const lookAt = (alt: number, az: number) => { const d = new THREE.Vector3(Math.cos(alt * D2R) * Math.sin(az * D2R), Math.sin(alt * D2R), -Math.cos(alt * D2R) * Math.cos(az * D2R)); camera.position.copy(eye).addScaledVector(d, -.01); controls.target.copy(eye); };
  let fovT = S.phone ? 78 : 66;
  cv.addEventListener('wheel', (e) => { e.preventDefault(); fovT = clamp(fovT * (1 + e.deltaY * .001), 1.5, 90); }, { passive: false });
  const pts = new Map<number, { x: number; y: number }>(); let pinch0 = 0, fov0 = 0;
  cv.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); fov0 = fovT; } });
  cv.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2 && pinch0) { const [a, b] = [...pts.values()]; fovT = clamp(fov0 * pinch0 / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 1.5, 90); } });
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  /* ---- sky dome: colour from the Sun's altitude ---- */
  const skyU = { uSun: { value: new THREE.Vector3(0, -1, 0) }, uAlt: { value: -30 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(RS * 1.05, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, uniforms: skyU, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 uSun; uniform float uAlt; varying vec3 vD;
      void main(){ float h=clamp(vD.y,0.,1.); float mu=max(dot(vD,uSun),0.);
        float day=smoothstep(-6.,8.,uAlt), tw=smoothstep(-18.,-4.,uAlt)*(1.-smoothstep(2.,14.,uAlt));
        vec3 night=mix(vec3(.012,.018,.04),vec3(.003,.005,.014),pow(h,.5));
        vec3 dayc=mix(vec3(.55,.72,.92),vec3(.13,.32,.72),pow(h,.6));
        vec3 twc=mix(vec3(.95,.45,.2),vec3(.08,.12,.32),pow(h,.35));
        vec3 c=mix(night,dayc,day); c=mix(c,twc,tw*(.35+.65*pow(mu,2.)*(1.-h)));
        c+=vec3(1.,.8,.55)*pow(mu,40.)*day*.8;
        gl_FragColor=vec4(c,1.);
        #include <colorspace_fragment>
      }`,
  }));
  scene.add(dome);

  /* ---- stars, constellation lines, Milky Way, Moon, planets ---- */
  const starGeo = new THREE.BufferGeometry();
  const starU = { uDay: { value: 0 }, uLim: { value: P.limit }, uTex: { value: glowTex(64, [[0, 'rgba(255,255,255,1)'], [.18, 'rgba(255,255,255,.8)'], [.45, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']]) }, uPx: { value: 1 }, uFov: { value: 66 } };
  const starM = new THREE.ShaderMaterial({
    uniforms: starU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aMag; attribute vec3 aCol; uniform float uDay, uLim, uPx, uFov; varying vec3 vC; varying float vA;
      void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
        float zoom=clamp(66./uFov,1.,8.); float b=pow(10.,-.4*(aMag-1.));
        gl_PointSize=clamp((2.4+sqrt(b)*6.)*uPx*sqrt(zoom),1.,48.);
        vA=clamp((uLim+log2(zoom)*1.4-aMag)*.8,0.,1.)*(1.-uDay); vC=aCol; }`,
    fragmentShader: 'uniform sampler2D uTex; varying vec3 vC; varying float vA; void main(){ float m=texture2D(uTex,gl_PointCoord).r; gl_FragColor=vec4(vC*m*vA,m*vA); }',
  });
  const stars = new THREE.Points(starGeo, starM); stars.frustumCulled = false; scene.add(stars);
  const lineGeo = new THREE.BufferGeometry();
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0x6f8fd0, transparent: true, opacity: .35, depthWrite: false })); lines.frustumCulled = false; scene.add(lines);
  /* Milky Way: soft points scattered around the galactic equator (north pole RA 192.86°, Dec 27.13°) */
  const mwN = S.phone ? 26000 : 50000, mwRD = new Float32Array(mwN * 2), mwGeo = new THREE.BufferGeometry();
  {
    const R = rng(12), nz = noise2(3), gp = { ra: 192.86 * D2R, dec: 27.13 * D2R }, lNCP = 122.93 * D2R;
    for (let i = 0; i < mwN; i++) {
      const l = R() * Math.PI * 2, core = Math.exp(-((((l + Math.PI) % (Math.PI * 2)) - Math.PI) ** 2) / 1.2);
      let b = ((R() + R() + R() - 1.5) / 1.5) * (.12 + core * .1) + nz(l * 3, 0) * .04;
      if (nz(l * 6, b * 20) > .35) b += .05; /* dark rifts */
      const sb = Math.sin(b), cb = Math.cos(b), dec = Math.asin(sb * Math.sin(gp.dec) + cb * Math.cos(gp.dec) * Math.cos(lNCP - l));
      const ra = gp.ra + Math.atan2(cb * Math.sin(lNCP - l), Math.cos(gp.dec) * sb - Math.sin(gp.dec) * cb * Math.cos(lNCP - l));
      mwRD[i * 2] = ra / D2R; mwRD[i * 2 + 1] = dec / D2R;
    }
    mwGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(mwN * 3), 3));
  }
  const mwM = new THREE.PointsMaterial({ color: 0xbfc8ff, size: S.phone ? 20 : 28, map: glowTex(64), transparent: true, opacity: .02, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const mw = new THREE.Points(mwGeo, mwM); mw.frustumCulled = false; scene.add(mw);
  /* Moon with a lit phase: a real sphere lit from the Sun's direction */
  const moonMat = new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (g, w, hh) => { const im = g.createImageData(w, hh), n1 = noise2(4), n2 = noise2(5); for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) { const a = x / w * Math.PI * 2, i = (y * w + x) * 4, v = 150 + n1(Math.cos(a) * 2 + y / 60, Math.sin(a) * 2) * 45 - (n2(Math.cos(a) * 1.3, Math.sin(a) * 1.3 + y / 90) > .2 ? 55 : 0); im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }), roughness: 1, emissive: 0x111111 });
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(RS * .0045 * 1.6, 48, 32), moonMat); scene.add(moonMesh);
  const moonLight = new THREE.DirectionalLight(0xffffff, 3.2); scene.add(moonLight, moonLight.target); moonLight.layers.set(1); moonMesh.layers.enable(1);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(128, [[0, 'rgba(220,230,255,.5)'], [.3, 'rgba(200,215,255,.12)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false })); moonGlow.scale.setScalar(60); scene.add(moonGlow);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(128, [[0, 'rgba(255,250,235,1)'], [.12, 'rgba(255,230,180,.9)'], [.4, 'rgba(255,200,120,.15)'], [1, 'rgba(0,0,0,0)']]), blending: THREE.AdditiveBlending, depthWrite: false })); sunSprite.scale.setScalar(110); scene.add(sunSprite);
  const planetSpr = PLANETS.map((n) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(64), color: new THREE.Color(n === 'Mars' ? 0xffb08a : n === 'Venus' ? 0xfff4d8 : n === 'Jupiter' ? 0xfff0d0 : n === 'Saturn' ? 0xffe2a8 : 0xd8e4ff), blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(s); return s; });

  /* ---- the ground: hills, an observatory with an open slit, and a telescope that really points ---- */
  const groundM = new THREE.MeshStandardMaterial({ color: 0x1c2316, roughness: 1, map: canvasTex(512, 512, (g, w) => { const im = g.createImageData(w, w), n1 = noise2(2), R = rng(3); for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = n1(x / 30, y / 30) * .5 + .5, v = 120 + k * 80 + (R() - .5) * 60; im.data[i] = v * .9; im.data[i + 1] = v; im.data[i + 2] = v * .7; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, { repeat: 120 }) });
  const hillsG = new THREE.CylinderGeometry(600, 600, 60, 256, 8, true);
  { const hp = hillsG.attributes.position as THREE.BufferAttribute, nz = noise2(9); for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i), y = hp.getY(i), a = Math.atan2(z, x); const h = (nz(Math.cos(a) * 3, Math.sin(a) * 3) * .5 + .5) * 38 + (nz(Math.cos(a) * 11, Math.sin(a) * 11) * .5 + .5) * 9; hp.setY(i, y > 0 ? -2 + h : -30); } hillsG.computeVertexNormals(); }
  const hills = new THREE.Mesh(hillsG, new THREE.MeshBasicMaterial({ color: 0x020305, side: THREE.BackSide })); scene.add(hills);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(620, 64), groundM); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const metal = new THREE.MeshStandardMaterial({ color: 0xd9dde4, metalness: .85, roughness: .28 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe9ebee, roughness: .45, metalness: .1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: .5, metalness: .4 });
  /* observatory building */
  const obs = new THREE.Group(); obs.position.set(-9, 0, -14);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 3.4, 64), white); wall.position.y = 1.7;
  const domeG = new THREE.SphereGeometry(4.15, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const obsDome = new THREE.Mesh(domeG, metal); obsDome.position.y = 3.4;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4.4, 4.4), dark); slit.position.set(0, 4.5, 1.4); slit.rotation.x = -.5;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, .2), dark); door.position.set(0, 1.1, 3.95);
  const glow = new THREE.PointLight(0xff8a50, 2, 8, 2); glow.position.set(0, 1.5, 4.6);
  obs.add(wall, obsDome, slit, door, glow); obs.traverse((o) => { o.castShadow = o.receiveShadow = true; }); scene.add(obs);
  /* telescope on an alt-az fork mount beside you */
  const scope = new THREE.Group(); scope.position.set(1.6, 0, -2.2);
  const pier = new THREE.Mesh(new THREE.CylinderGeometry(.12, .2, 1.1, 24), dark); pier.position.y = .55;
  const azG = new THREE.Group(); azG.position.y = 1.1;
  const fork = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .12), dark); const armL = new THREE.Mesh(new THREE.BoxGeometry(.06, .5, .1), dark); armL.position.set(-.24, .25, 0); const armR = armL.clone(); armR.position.x = .24;
  const altG = new THREE.Group(); altG.position.y = .42;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, 1.15, 48, 1, true), white); tube.rotation.x = Math.PI / 2;
  const cap = new THREE.Mesh(new THREE.TorusGeometry(.165, .015, 12, 48), metal); cap.position.z = -.58;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .12, 48), dark); back.rotation.x = Math.PI / 2; back.position.z = .55;
  const finder = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .35, 16), dark); finder.rotation.x = Math.PI / 2; finder.position.set(.12, .2, -.1);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.15, 48), new THREE.MeshPhysicalMaterial({ color: 0x223355, metalness: 0, roughness: .05, transmission: 0, clearcoat: 1 })); lens.position.z = -.57; lens.rotation.y = Math.PI;
  altG.add(tube, cap, back, finder, lens); azG.add(fork, armL, armR, altG); scope.add(pier, azG); scope.traverse((o) => { o.castShadow = true; }); scene.add(scope);
  const lamp = new THREE.PointLight(0xff3020, .9, 6, 2); lamp.position.set(1, .4, -1.2); scene.add(lamp); /* a red torch: astronomers keep their night vision */
  const amb = new THREE.HemisphereLight(0x5a74c0, 0x1a1c14, .6);
  const fill = new THREE.DirectionalLight(0x8fa6e0, .7); fill.position.set(-20, 30, 25); scene.add(fill); scene.add(amb);
  const sunDL = new THREE.DirectionalLight(0xfff0dd, 0); sunDL.castShadow = true; scene.add(sunDL, sunDL.target);
  let aim = { alt: 40, az: 180 }, aimNow = { alt: 10, az: 150 };

  /* ---- placing everything for the place and time ---- */
  const tags: { tag: ReturnType<typeof S.tag>; get: () => THREE.Vector3 | null }[] = [];
  const v = (alt: number, az: number, r = RS) => new THREE.Vector3(Math.cos(alt * D2R) * Math.sin(az * D2R) * r, Math.sin(alt * D2R) * r, -Math.cos(alt * D2R) * Math.cos(az * D2R) * r);
  let objs: (Obj & { p: THREE.Vector3; alt: number; az: number })[] = [];
  function J() { return jd(ms + P.offH * 3.6e6); }
  function update() {
    const [, , lat, lon] = place(), j = J();
    /* fast rotation: one sidereal angle and the observer latitude convert RA/Dec to alt/az */
    const conv = (ra: number, dec: number) => altaz(ra, dec, lat, lon, j);
    if (sky) {
      const s = sky.s, n = s.length / 4, pos = starGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < n; i++) { const a = conv(s[i * 4], s[i * 4 + 1]), p = v(a.alt, a.az); pos.setXYZ(i, p.x, p.y, p.z); }
      pos.needsUpdate = true;
      const lp = lineGeo.attributes.position as THREE.BufferAttribute; let k = 0;
      for (const c in sky.l) for (const seg of sky.l[c]) for (let i = 1; i < seg.length; i++) { const a = conv(seg[i - 1][0], seg[i - 1][1]), b = conv(seg[i][0], seg[i][1]); const pa = v(a.alt, a.az, RS * .99), pb = v(b.alt, b.az, RS * .99); lp.setXYZ(k++, pa.x, pa.y, pa.z); lp.setXYZ(k++, pb.x, pb.y, pb.z); }
      lp.needsUpdate = true;
    }
    const mp = mwGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < mwN; i++) { const a = conv(mwRD[i * 2], mwRD[i * 2 + 1]), p = v(a.alt, a.az, RS * 1.01); mp.setXYZ(i, p.x, p.y, p.z); }
    mp.needsUpdate = true;
    const sn = sun(j), sa = conv(sn.ra, sn.dec), sp = v(sa.alt, sa.az, RS * .95);
    sunSprite.position.copy(sp); skyU.uSun.value.copy(sp).normalize(); skyU.uAlt.value = sa.alt;
    const day = clamp((sa.alt + 6) / 10, 0, 1); starU.uDay.value = day; mwM.opacity = .02 * (1 - clamp((sa.alt + 18) / 12, 0, 1)) * (P.limit > 4.5 ? 1 : .2);
    sunDL.intensity = 3 * clamp(sa.alt / 10, 0, 1); sunDL.position.copy(sp).normalize().multiplyScalar(60); amb.intensity = .6 + day * .9;
    const mo = moon(j), ma = conv(mo.ra, mo.dec), mpos = v(ma.alt, ma.az, RS * .9);
    moonMesh.position.copy(mpos); moonGlow.position.copy(mpos); moonGlow.material.opacity = (1 - day) * mo.illum;
    moonLight.position.copy(mpos).add(sp.clone().normalize().multiplyScalar(-RS * 0 + 400).add(sp.clone().sub(mpos).normalize().multiplyScalar(300))); moonLight.target.position.copy(mpos);
    moonLight.position.copy(mpos.clone().add(sp.clone().sub(mpos).normalize().multiplyScalar(100)));
    objs = [{ kind: 'moon', name: t('moon', 'Moon'), ra: mo.ra, dec: mo.dec, p: mpos, alt: ma.alt, az: ma.az }, { kind: 'sun', name: t('sunn', 'Sun'), ra: sn.ra, dec: sn.dec, p: sp, alt: sa.alt, az: sa.az }];
    PLANETS.forEach((n, i) => { const pl = planet(n, j), a = conv(pl.ra, pl.dec), p = v(a.alt, a.az, RS * .93); planetSpr[i].position.copy(p); planetSpr[i].scale.setScalar(clamp(26 - pl.mag * 4, 6, 40)); planetSpr[i].material.opacity = clamp(1 - day * 1.3 + (n === 'Venus' ? .5 : 0), 0, 1); objs.push({ kind: 'planet', name: t('p.' + n, n), ra: pl.ra, dec: pl.dec, mag: pl.mag, p, alt: a.alt, az: a.az }); });
    if (sky) { const s = sky.s; for (const k in sky.n) { const i = +k; const a = conv(s[i * 4], s[i * 4 + 1]); objs.push({ kind: 'star', name: sky.n[k], ra: s[i * 4], dec: s[i * 4 + 1], mag: s[i * 4 + 2], p: v(a.alt, a.az), alt: a.alt, az: a.az }); } }
    /* clock */
    const [, nm, , , tz] = place(); const d = new Date(ms + P.offH * 3.6e6);
    info('time', new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(d));
    info('moon', `${Math.round(mo.illum * 100)}% ${mo.waxing ? t('wax', 'waxing') : t('wan', 'waning')}`);
    info('sun', sa.alt > 0 ? t('day', 'Daytime') : sa.alt > -6 ? t('civil', 'Twilight') : sa.alt > -18 ? t('astro', 'Deep twilight') : t('night', 'Dark night'));
    info('where', nm);
    void gmst;
  }
  function loadSky() {
    fetch(I18N.root + 'assets/sky/sky.json').then((r) => r.json()).then((d: Sky) => {
      sky = d; const n = d.s.length / 4, mag = new Float32Array(n), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { mag[i] = d.s[i * 4 + 2]; const c = bvRGB(d.s[i * 4 + 3]); col.set([c[0] / 255, c[1] / 255, c[2] / 255], i * 3); }
      starGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); starGeo.setAttribute('aMag', new THREE.BufferAttribute(mag, 1)); starGeo.setAttribute('aCol', new THREE.BufferAttribute(col, 3));
      let segsN = 0; for (const c in d.l) for (const s of d.l[c]) segsN += s.length - 1;
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segsN * 6), 3));
      for (const c in d.c) { const [nm, ra, dec, rank] = d.c[c]; if (+rank > 2) continue; const tg = S.tag(t('c.' + c, nm).toUpperCase()); tg.el.style.cssText += ';background:none;border:0;font:500 10px/1 JetBrains Mono,monospace;letter-spacing:.2em;color:rgba(160,185,255,.7)'; tags.push({ tag: tg, get: () => { const [, , lat, lon] = place(); const a = altaz(ra, dec, lat, lon, J()); return a.alt > 3 && P.names ? v(a.alt, a.az, RS * .98) : null; } }); }
      update();
    }).catch(() => S.showHint(t('err', 'Could not load the star catalogue.')));
  }
  PLANETS.forEach((n, i) => { const tg = S.tag(t('p.' + n, n)); tags.push({ tag: tg, get: () => planetSpr[i].position.y > 2 && P.names ? planetSpr[i].position.clone().add(new THREE.Vector3(0, 6, 0)) : null }); });
  { const tg = S.tag(t('moon', 'Moon')); tags.push({ tag: tg, get: () => moonMesh.position.y > 0 && P.names ? moonMesh.position.clone().add(new THREE.Vector3(0, 14, 0)) : null }); }

  /* ---- panel ---- */
  const B = S.body;
  const info = stats(B, [['time', t('time', 'Local time')], ['where', t('where', 'Place')], ['moon', t('moon', 'Moon')], ['sun', t('sky', 'Sky')]], true);
  sec(B, t('s.when', 'Where and when'));
  const sel = document.createElement('select'); sel.className = 'ns-btn'; sel.style.cssText = 'text-align:left;appearance:auto';
  for (const p of PLACES) { const o = document.createElement('option'); o.value = p[0]; o.textContent = t('pl.' + p[0], p[1]); sel.append(o); }
  sel.value = P.place; sel.addEventListener('change', () => { P.place = sel.value; update(); }); B.append(sel);
  slider(B, t('r.hour', 'Hours from now'), { min: -24, max: 24, step: .25, value: 0, fmt: (x) => (x > 0 ? '+' : '') + x + ' h' }, (x) => { P.offH = x; update(); });
  btns(B, [[t('b.now', 'Now'), () => { P.offH = 0; ms = Date.now(); update(); }], [t('b.tonight', 'Tonight 22:00'), () => { const tz = place()[4]; const h = +new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(new Date()); P.offH = ((22 - h) + 24) % 24; update(); }]]);
  sec(B, t('s.see', 'What you see'));
  slider(B, t('r.lim', 'Sky darkness (faintest star)'), { min: 1.5, max: 6.5, step: .1, value: P.limit, fmt: (x) => x < 3 ? t('city', 'city') + ` · ${x.toFixed(1)}` : x < 5 ? t('sub2', 'suburb') + ` · ${x.toFixed(1)}` : t('dark', 'dark site') + ` · ${x.toFixed(1)}` }, (x) => { P.limit = x; starU.uLim.value = x; update(); });
  segs(B, '', [['on', t('lines', 'Figures on')], ['off', t('nolines', 'Figures off')]], 'on', (x) => { P.lines = x === 'on'; lines.visible = P.lines; });
  segs(B, '', [['on', t('names', 'Names on')], ['off', t('nonames', 'Names off')]], 'on', (x) => { P.names = x === 'on'; });
  para(B, t('p.zoom', 'Pinch or scroll to zoom like a telescope. Tap anything in the sky for where it is and when it rises and sets.'));

  /* tap: nearest object to the tap direction */
  S.pick(() => [dome], (hit) => {
    const d = hit.point.clone().normalize(); let best: typeof objs[0] | null = null, bd = .02 * (camera.fov / 66) + .004;
    for (const o of objs) { const c = 1 - o.p.clone().normalize().dot(d); if (c < bd && o.alt > -2) { bd = c; best = o; } }
    if (!best) return;
    aim = { alt: Math.max(best.alt, 3), az: best.az };
    const dist = best.kind === 'planet' ? '' : '';
    S.showCard(best.name, `${t('k.alt', 'Altitude')} ${best.alt.toFixed(1)}° · ${t('k.az', 'Azimuth')} ${best.az.toFixed(1)}°${best.mag !== undefined ? ` · ${t('k.mag', 'magnitude')} ${best.mag.toFixed(1)}` : ''}${dist}. ${t('k.slew', 'The telescope is turning to it.')}`);
  });
  chips(S, [['look', t('c.look', 'Look up')], ['south', t('c.south', 'Due south')], ['scope', t('c.scope', 'Through the telescope')], ['obs', t('c.obs', 'Observatory')]], 'look', (x) => {
    if (x === 'look') { fovT = S.phone ? 78 : 66; lookAt(55, 160); }
    if (x === 'south') { fovT = S.phone ? 78 : 66; lookAt(25, 180); }
    if (x === 'scope') { fovT = 4; lookAt(aim.alt, aim.az); }
    if (x === 'obs') { fovT = S.phone ? 70 : 55; lookAt(6, (Math.atan2(-9, 14) / D2R + 360) % 360); }
  });

  lookAt(28, 165);
  loadSky(); update();
  let acc = 0;
  S.onFrame((dt) => {
    camera.fov += (fovT - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix();
    starU.uFov.value = camera.fov; starU.uPx.value = renderer.getPixelRatio();
    controls.rotateSpeed = -.35 * camera.fov / 66;
    /* telescope slews smoothly to its target */
    aimNow.alt += (aim.alt - aimNow.alt) * Math.min(1, dt * 1.5); let daz = ((aim.az - aimNow.az + 540) % 360) - 180; aimNow.az += daz * Math.min(1, dt * 1.5);
    azG.rotation.y = -aimNow.az * D2R; altG.rotation.x = aimNow.alt * D2R;
    if ((acc += dt) > 2 && !P.offH) { acc = 0; ms = Date.now(); update(); }
    for (const x of tags) { const p = x.get(); x.tag.at(p ?? new THREE.Vector3(), !!p); }
    lines.visible = P.lines && starU.uDay.value < .7;
  });
  S.start();
}
