/* Homepage: preloader, WebGL hero, manifesto reveal, world index, reel, Studio preview, contact. */
import Lenis from 'lenis';
import { I18N } from './i18n';
import { homeMusic } from './music';
import './common';
import { studio, applyStudio, saveStudio, calm, handCalm, choseMotion, grain, cursor, FINE, type Studio } from './studio-core';
import { contactForm } from './contact';
import { parallax } from './portrait';
import { initUniverse } from './universe';
import { initDiscover } from './discover';
import { initPortal30 } from './portal30';

const $ = <T extends HTMLElement = HTMLElement>(s: string, c: ParentNode = document) => c.querySelector(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, c: ParentNode = document) => Array.from(c.querySelectorAll(s)) as T[];
const T = I18N.t, NF = I18N.n, ROOT = I18N.root;
const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
let MOB = innerWidth < 820;

/* smooth scrolling, only when the visitor wants full motion */
if (!R && studio.motion === 'full' && matchMedia('(hover:hover) and (pointer:fine)').matches && document.documentElement.dataset.q !== 'low') {
  const lenis = new Lenis({ anchors: true, lerp: 0.11 });
  /* velocity type (Wave A, I-6): display headings stretch up to 3 % with scroll speed and settle when it stops */
  /* written straight onto the few headings (not a page-wide variable, which would restyle the whole page every frame),
     and only while the value is moving */
  const heads = Array.from(document.querySelectorAll<HTMLElement>('.uv-head h2,.dsc-head h2,.atlas .sh h2,.studio h2,.cth h2'));
  heads.forEach((e) => { e.style.transformOrigin = '50% 100%'; });
  let vt = 0, vc = 0, shown = 0;
  lenis.on('scroll', (l: { velocity: number }) => { vt = Math.max(-1, Math.min(1, l.velocity / 60)); });
  const raf = (time: number) => {
    lenis.raf(time);
    vc += (vt - vc) * .12; vt *= .9; if (Math.abs(vc) < 2e-3 && Math.abs(vt) < 2e-3) vc = vt = 0;
    const q = Math.round(vc * 200) / 200;
    if (q !== shown) { shown = q; const tf = q ? `scaleY(${(1 + Math.abs(q) * .03).toFixed(4)}) skewY(${(-q * 1.2).toFixed(3)}deg)` : ''; heads.forEach((e) => { e.style.transform = tf; }); }
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

interface W { k: string; img: string; t?: string; m?: string; c?: string; o?: string; live?: string }
const H: W[] = [{ k: 'cosmos', img: 'cosmos-nebula' }, { k: 'neon', img: 'neon-street' }, { k: 'abyss', img: 'octopus' }, { k: 'aurora', img: 'aurora' }, { k: 'stride', img: 'sneaker-studio' }, { k: 'mesa', img: 'desert' }, { k: 'velocity', img: 'car-night' }, { k: 'orbit', img: 'earth-orbit' }];
H.forEach((w) => { w.t = T('w.' + w.k); w.m = T('hm.' + w.k); });
/* the 12 regions; "live" points at a finished world, the others open the roadmap filtered to their category */
const A: W[] = [{ k: 'cosmos', img: 'milkyway', live: 'galaxy', o: 'E' }, { k: 'metropolis', img: 'city-dawn', o: 'C' }, { k: 'abyss', img: 'diver', o: 'D' }, { k: 'wildwood', img: 'forest-mist', o: 'D' }, { k: 'stride', img: 'sneaker-studio', o: 'A' }, { k: 'chronos', img: 'watch-gears', o: 'A' }, { k: 'velocity', img: 'car-night', o: 'B' }, { k: 'ember', img: 'food', o: 'H' }, { k: 'sentient', img: 'robot', o: 'G' }, { k: 'gallery', img: 'art-abstract', o: 'F' }, { k: 'atelier', img: 'fashion', o: 'A' }, { k: 'dwell', img: 'interior', o: 'C' }];
A.forEach((w) => { w.t = T('w.' + w.k); w.c = T('c.' + w.k); });
const REEL: W[] = [{ k: 'stride', img: 'sneaker-studio', o: 'l' }, { k: 'wildwood', img: 'forest-mist', o: 'p' }, { k: 'chronos', img: 'watch-gears', o: 'l' }, { k: 'atelier', img: 'fashion', o: 'p' }, { k: 'abyss', img: 'diver', o: 'l' }, { k: 'fortress', img: 'castle-mist', o: 'p' }, { k: 'ember', img: 'food', o: 'l' }, { k: 'sentient', img: 'robot', o: 'p' }, { k: 'falls', img: 'waterfall', o: 'l' }, { k: 'drift', img: 'star-sea', o: 'p' }];
REEL.forEach((w) => { w.t = T('w.' + w.k); w.c = T('r.' + w.k); });
const src = (n: string, s?: boolean) => `${ROOT}assets/home/${n}${s ? '-s' : ''}.jpg`;

grain();
const cur = cursor();

/* ---------- preloader: flash the worlds, then open into the hero ---------- */
const pre = $('#pre'), pw = $('#pwin'), pc = $('#pcnt');
/* the first frame is already in the HTML (fast first paint); the rest are added here */
/* 0.9.14 speed: intro frames are WebP (about 40% smaller); phones and light mode flash the 8 hero worlds only (was 14 photos) */
const LITE0 = document.documentElement.dataset.q === 'low' || matchMedia('(hover:none)').matches;
(LITE0 ? H : H.concat(A.slice(0, 6))).forEach((w, k) => { if (k === 0 && pw.querySelector('img')) return; const i = new Image(); i.decoding = 'async'; i.src = `${ROOT}assets/home/${w.img}-s.webp`; i.alt = ''; pw.appendChild(i); });
const pimgs = $$('img', pw); let pi = 0, pv = 0;
const PORTRAIT0 = matchMedia('(max-width:760px) and (orientation:portrait)').matches;   /* intro's last frame = the hero photo the phone will show (same file, one download) */
const last = document.createElement('img'); last.src = PORTRAIT0 ? `${ROOT}assets/home/${H[0].img}-p.jpg` : src(H[0].img); last.alt = ''; pw.appendChild(last);
function step() {
  pimgs.forEach((im, k) => im.classList.toggle('on', k === pi % pimgs.length)); pi++;
  pv = Math.min(100, pv + Math.ceil(Math.random() * 11) + 3); pc.textContent = NF(pv);
  if (pv < 100) { setTimeout(step, R ? 0 : 85); return; }
  pimgs.forEach((im) => im.classList.remove('on')); last.style.opacity = '1';
  setTimeout(() => { pre.classList.add('go'); setTimeout(() => { pre.classList.add('done'); startHero(); }, R ? 0 : 1100); }, R ? 0 : 250);
}

/* ---------- hero WebGL: noise-displacement transitions + pointer lens ---------- */
const cv = $<HTMLCanvasElement>('#gl');
let gl: WebGLRenderingContext | null = null, prog: WebGLProgram | null = null;
const tex: ({ t: WebGLTexture; w: number; h: number } | undefined)[] = [];
const pan = [0, 0];
let cur_ = 0, nxt = 0, progT = 1, anim = 0, mx = .5, my = .5, tmx = .5, tmy = .5, hov = 0, thov = 0, heroOn = true;
let timer: ReturnType<typeof setTimeout> | undefined;
const dur = 6500, start = performance.now();
/* 0.9.13 speed: phones and tablets (and light mode) show the hero as plain photos with a soft fade and slow zoom.
   The WebGL liquid effect stays on computers, and on a phone when its owner picks Quality: High. */
const D_ = document.documentElement.dataset;
const IMG_HERO = D_.q === 'low' || (matchMedia('(hover:none)').matches && D_.qc !== 'high');
const PORTRAIT = matchMedia('(max-width:760px) and (orientation:portrait)').matches;
const psrc = (n: string) => PORTRAIT ? `${ROOT}assets/home/${n}-p.jpg` : src(n);
if (IMG_HERO) { cv.style.display = 'none'; document.documentElement.classList.add('imghero'); }
else { try { gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false }); } catch { gl = null; } }
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}';
const FS = `precision highp float;varying vec2 v;uniform sampler2D a,b;uniform vec2 r,sa,sb,m,o;uniform float t,p,h,z,f;
float hs(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1,0)),f.x),mix(hs(i+vec2(0,1)),hs(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 q){float s=0.,w=.5;for(int i=0;i<5;i++){s+=w*ns(q);q*=2.03;w*=.5;}return s;}
vec2 cov(vec2 u,vec2 s,float k){float ra=r.x/r.y,ri=s.x/s.y;vec2 c=ra>ri?vec2(1.,ri/ra):vec2(ra/ri,1.);return (u-.5)*c*k+.5;}
/* 0.9.6 phones (owner, 21 Nov: the whole photo must be seen): the photo fits the screen width (a little zoom), sits in the
   upper middle, and a blurred, darker copy of the same photo fills the space above and below, so no subject is cut. */
vec3 fitc(sampler2D tx,vec2 u,vec2 s,float k){float ra=r.x/r.y,ri=s.x/s.y,Z=1.12/k,hh=Z*ra/ri;
 vec2 iu=vec2((u.x-.5)/Z+.5,(u.y-.56)/hh+.5);
 vec2 cu=cov(u,s,.9);vec3 bg=vec3(0.);for(int i=0;i<12;i++){float an=float(i)*2.39996;vec2 d=vec2(cos(an),sin(an))*(.02+.006*float(i))*vec2(1.,ra);bg+=texture2D(tx,cu+d).rgb;}
 bg=bg/12.*.5;float e=smoothstep(0.,.16,iu.y)*smoothstep(1.,.86,iu.y);
 vec3 fg=texture2D(tx,clamp(iu,0.,1.)).rgb;return mix(bg,fg,e);}
void main(){vec2 u=v;vec2 asp=vec2(r.x/r.y,1.);
 float d=distance(u*asp,m*asp);float lens=smoothstep(.32,0.,d)*h;u+=(u-m)*lens*-.09;
 float n=fb(u*3.+t*.04);float e=p*1.5-.25;float k=smoothstep(e-.18,e+.18,n);
 float amp=sin(p*3.14159)*.22;vec2 da=vec2(n-.5,n-.5)*amp*(1.-k);vec2 db=-vec2(n-.5)*amp*k;
 vec2 ua=cov(u+da,sa,z*.96)+o,ub=cov(u+db,sb,.96)+o;
 vec3 A,B;if(f>.5){A=fitc(a,u+da,sa,z);B=fitc(b,u+db,sb,1.);}else{
 float ca=lens*.006+amp*.02;
 A=vec3(texture2D(a,ua+vec2(ca,0)).r,texture2D(a,ua).g,texture2D(a,ua-vec2(ca,0)).b);
 B=vec3(texture2D(b,ub+vec2(ca,0)).r,texture2D(b,ub).g,texture2D(b,ub-vec2(ca,0)).b);}
 vec3 col=mix(B,A,k);float vg=smoothstep(1.25,.35,length((v-.5)*vec2(1.,.8)));col*=mix(.55,1.,vg);gl_FragColor=vec4(col,1.);}`;
const U: Record<string, WebGLUniformLocation | null> = {};
function initGL(): boolean {
  if (!gl) return false; const g = gl;
  const sh = (type: number, s: string) => { const o = g.createShader(type)!; g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o) ?? 'shader'); return o; };
  try { prog = g.createProgram()!; g.attachShader(prog, sh(g.VERTEX_SHADER, VS)); g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS)); g.linkProgram(prog); g.useProgram(prog); } catch { gl = null; return false; }
  const bf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, bf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);
  const l = g.getAttribLocation(prog, 'p'); g.enableVertexAttribArray(l); g.vertexAttribPointer(l, 2, g.FLOAT, false, 0, 0);
  ['a', 'b', 'r', 'sa', 'sb', 'm', 'o', 't', 'p', 'h', 'z', 'f'].forEach((k) => { U[k] = g.getUniformLocation(prog!, k); });
  g.uniform1i(U.a, 0); g.uniform1i(U.b, 1); return true;
}
const texP: Promise<void>[] = [];
function loadTex(i: number): Promise<void> {
  return texP[i] ??= new Promise((res) => {
    const g = gl; if (!g) return res();
    const im = new Image();
    /* decode off the main thread first, so the upload to the GPU does not freeze the page */
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => {
      const t = g.createTexture()!; g.bindTexture(g.TEXTURE_2D, t); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true); g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      tex[i] = { t, w: im.naturalWidth, h: im.naturalHeight }; res();
    });
    im.onerror = () => res();
    /* 0.9: sharp on phones too. A tall screen gets a tall photo cut for it (1100 x 2200), so nothing is stretched;
       a big or high-density wide screen gets the 2560 px photo */
    const W = cv.clientWidth * DPR, Hh = cv.clientHeight * DPR;
    im.src = Hh > W * 1.15 ? `${ROOT}assets/home/${H[i].img}-p.jpg` : W > 1700 || Hh > 1000 ? `${ROOT}assets/home/${H[i].img}-xl.jpg` : src(H[i].img);   /* 0.9.13: phones get a portrait cut (about 150 KB) instead of the 2560 px photo */
  });
}
const DPR = Math.min(matchMedia('(max-width:760px)').matches ? 1.25 : 2, devicePixelRatio || 1);   /* the hero is a soft photo: 1.25x looks the same on a phone and costs far less */
function rs() { cv.width = cv.clientWidth * DPR; cv.height = cv.clientHeight * DPR; gl?.viewport(0, 0, cv.width, cv.height); }
addEventListener('resize', rs);
let slideStart = performance.now();
function draw(now: number) {
  const g = gl, F = tex[cur_]; if (!g || !F) return;
  mx += (tmx - mx) * .06; my += (tmy - my) * .06; hov += (thov - hov) * .05;
  const B = tex[nxt] ?? F;
  g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, F.t); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, B.t);
  g.uniform2f(U.r, cv.width, cv.height); g.uniform2f(U.sa, F.w, F.h); g.uniform2f(U.sb, B.w, B.h);
  g.uniform2f(U.m, mx, 1 - my); g.uniform2f(U.o, pan[0] * -.04, pan[1] * .04); g.uniform1f(U.t, (now - start) / 1000); g.uniform1f(U.p, progT < 1 ? progT : 0); g.uniform1f(U.h, handCalm() ? 0 : hov);
  g.uniform1f(U.f, cv.height > cv.width * 1.15 ? 1 : 0);
  g.uniform1f(U.z, calm() ? 1 : 1 - Math.min(1, (now - slideStart) / (dur + 1600)) * .06);
  g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
}
/* full frame rate during a slide change or while the pointer moves the lens; the slow drift in between is drawn
   at about 30 fps, which looks the same and halves the work on phones and laptops on battery */
let lastDraw = 0;
/* 0.9.13: the slow drift between slides is drawn at ~8 fps on phones and in light mode (it moves a few pixels a second, so it looks the same) */
const IDLE_MS = matchMedia('(hover:none)').matches || document.documentElement.dataset.q === 'low' ? 120 : 30;
function loop(now: number) {
  requestAnimationFrame(loop);
  if (!heroOn && progT >= 1) return;
  const busy = progT < 1 || Math.abs(tmx - mx) + Math.abs(tmy - my) + Math.abs(thov - hov) > .002;
  if (!busy && now - lastDraw < IDLE_MS) return;
  lastDraw = now; draw(now);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) lastDraw = 0; });

/* title animation */
const ht = $('#htitle');
function setTitle(w: W, first?: boolean) {
  const html = I18N.chars(w.t ?? '').map((c, i) => `<span class="ch" style="transition-delay:${i * 35}ms">${c}</span>`).join('');
  const put = () => { ht.innerHTML = html; ht.setAttribute('aria-label', w.t ?? ''); requestAnimationFrame(() => requestAnimationFrame(() => $$('.ch', ht).forEach((c) => c.classList.add('in')))); };
  const old = $$('.ch', ht);
  if (!first && old.length && !calm()) { old.forEach((c, i) => { c.style.transitionDelay = (i * 20) + 'ms'; c.classList.add('out'); }); setTimeout(put, 420); } else put();
  $('#hmeta').textContent = w.m ?? ''; $('#hnum').textContent = NF(H.indexOf(w) + 1, 2);
}
$('#htot').textContent = NF(H.length, 2);
const dots = $('#dots');
H.forEach((w, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', w.t ?? ''); b.innerHTML = '<i></i>'; b.onclick = () => go(i); dots.appendChild(b); });
function markDots() { $$('#dots button').forEach((b, i) => { b.classList.remove('on'); b.setAttribute('aria-selected', String(i === cur_)); void b.offsetWidth; if (i === cur_) { b.style.setProperty('--dur', dur + 'ms'); b.classList.add('on'); } }); }
let want = -1, goTok = 0;   // the slide the visitor asked for, so quick clicks step on instead of repeating
function go(i: number) {
  i = (i + H.length) % H.length; if (i === cur_ && progT >= 1 && want === i) return; clearTimeout(timer);
  want = i; const tok = ++goTok;
  const w = H[i]; setTitle(w);
  if (!gl) { const fb = $<HTMLImageElement>('#fallback'); const nu = psrc(w.img); cur_ = i; markDots(); sched();
    const pre = new Image(); pre.src = nu;
    const swap = () => { if (tok !== goTok) return; fb.classList.add('fo'); setTimeout(() => { if (tok !== goTok) return; fb.parentElement?.querySelector('source')?.remove(); fb.src = nu; fb.classList.remove('fo'); fb.style.animation = 'none'; void fb.offsetWidth; fb.style.animation = ''; }, calm() ? 0 : 380); };
    (pre.decode ? pre.decode() : Promise.resolve()).then(swap, swap); return; }
  /* textures load one slide ahead instead of all at once */
  (tex[i] ? Promise.resolve() : loadTex(i)).then(() => { if (tok !== goTok) return; const n = (i + 1) % H.length; if (!tex[n]) setTimeout(() => loadTex(n), 600);
    nxt = i; const t0 = performance.now(), D = calm() ? 500 : 1700;
    cancelAnimationFrame(anim);
    const a = (now: number) => {
      const x = Math.min(1, (now - t0) / D); progT = x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
      if (x < 1) anim = requestAnimationFrame(a); else { cur_ = i; progT = 1; slideStart = performance.now(); markDots(); sched(); }
    };
    a(t0);
  });
}
function sched() { clearTimeout(timer); timer = setTimeout(() => { if (heroOn && document.visibilityState === 'visible') go(cur_ + 1); else sched(); }, dur); }
const at = () => (want >= 0 ? want : cur_);
{ const nx = $('#next'), pv = $('#prev'); if (nx) nx.onclick = () => go(at() + 1); if (pv) pv.onclick = () => go(at() - 1); }
addEventListener('keydown', (e) => {
  if (scrollY > innerHeight * .5) return; const t = e.target as HTMLElement; if (t.closest('input,textarea,#lgm,#mnu')) return;
  if (e.key === (I18N.rtl ? 'ArrowLeft' : 'ArrowRight')) go(at() + 1);
  if (e.key === (I18N.rtl ? 'ArrowRight' : 'ArrowLeft')) go(at() - 1);
});
const hero = $('.hero');
hero.addEventListener('pointermove', (e) => { tmx = e.clientX / innerWidth; tmy = e.clientY / innerHeight; thov = 1; });
hero.addEventListener('pointerleave', () => { thov = 0; });
/* whole-photo parallax: the photo follows the mouse (works with WebGL and with the image fallback) */
{
  let px = 0, py = 0, qx = 0, qy = 0, run = false;
  const st = hero.style;
  const step = () => {
    px += (qx - px) * .07; py += (qy - py) * .07; pan[0] = px; pan[1] = py;
    st.setProperty('--hx', (px * 3.2).toFixed(3) + '%'); st.setProperty('--hy', (py * 3.2).toFixed(3) + '%');
    st.setProperty('--tx', (px * -14).toFixed(2) + 'px'); st.setProperty('--ty', (py * -10).toFixed(2) + 'px');
    if (Math.abs(qx - px) > .0005 || Math.abs(qy - py) > .0005) requestAnimationFrame(step); else run = false;
  };
  const kick = () => { if (!run) { run = true; requestAnimationFrame(step); } };
  hero.addEventListener('pointermove', (e) => { if (handCalm() || e.pointerType !== 'mouse') return; qx = e.clientX / innerWidth - .5; qy = e.clientY / innerHeight - .5; kick(); });
  hero.addEventListener('pointerleave', () => { qx = 0; qy = 0; kick(); });
  /* phones: the same feel by touch (the lens follows the finger, the photo leans with it) and by tilting the phone */
  hero.addEventListener('touchmove', (e) => {
    if (handCalm()) return; const t = e.touches[0]; if (!t) return;
    tmx = t.clientX / innerWidth; tmy = t.clientY / innerHeight; thov = 1; qx = tmx - .5; qy = tmy - .5; kick();
  }, { passive: true });
  hero.addEventListener('touchend', () => { thov = 0; if (!tilt) { qx = 0; qy = 0; kick(); } }, { passive: true });
  let tilt = false, b0: number | null = null;
  const onTilt = (e: DeviceOrientationEvent) => {
    if (handCalm() || !heroOn || e.gamma === null || e.beta === null) return;
    if (b0 === null) b0 = e.beta;
    tilt = true; qx = Math.max(-.5, Math.min(.5, e.gamma / 50)); qy = Math.max(-.5, Math.min(.5, (e.beta - b0) / 60)); kick();
  };
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (matchMedia('(pointer:coarse)').matches && DOE) {
    if (typeof DOE.requestPermission === 'function') {
      /* iPhone asks once, after a tap on the photo */
      hero.addEventListener('click', () => { DOE.requestPermission!().then((r) => { if (r === 'granted') addEventListener('deviceorientation', onTilt); }).catch(() => {}); }, { once: true });
    } else addEventListener('deviceorientation', onTilt);
  }
}
let sx: number | null = null;
hero.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
hero.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) go(at() + ((I18N.rtl ? -dx : dx) < 0 ? 1 : -1)); sx = null; });
new IntersectionObserver((e) => { heroOn = e[0].isIntersecting; }).observe(hero);
function startHero() {
  setTitle(H[0], true); markDots();
  if (initGL()) { rs(); loadTex(0).then(() => { $('#fallback').style.display = 'none'; requestAnimationFrame(loop); sched(); loadTex(1); }); }
  else sched();
}
/* the intro plays once per visit; coming back to the home page in the same visit opens straight to the hero */
let seen = false; try { seen = sessionStorage.getItem('abidora.intro') === '1'; sessionStorage.setItem('abidora.intro', '1'); } catch { /* private mode */ }
if (I18N.keep || seen) { pre.classList.add('done'); pre.style.display = 'none'; startHero(); } else step();

/* ---------- numbers row: count up once when it comes into view (shown at once with calm motion) ---------- */
const nums = $$<HTMLElement>('.nums dd');
nums.forEach((d) => { d.textContent = NF(+(d.dataset.n ?? 0)); });
if (nums.length && !calm()) {
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting)) return; io.disconnect();
    const t0 = performance.now(), D = 1400;
    const tick = (now: number) => {
      const x = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - x, 3);
      nums.forEach((d) => { d.textContent = NF(Math.round(+(d.dataset.n ?? 0) * e)); });
      if (x < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { threshold: .4 });
  io.observe(nums[0].closest('.nums')!);
}

/* ---------- manifesto: words light up with scroll ---------- */
const mp = $('#mp');
{
  const out: Node[] = [];
  Array.from(mp.childNodes).forEach((n) => {
    if (n.nodeType !== 3) { out.push(n); return; }
    I18N.words(n.textContent ?? '').forEach((w) => {
      if (!w) return;
      if (/^\s+$/.test(w)) out.push(document.createTextNode(w));
      else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; out.push(s); }
    });
  });
  mp.innerHTML = ''; out.forEach((n) => mp.appendChild(n));
}
const mw = $$('.w,.pill', mp);
function lit() {
  /* pinned statement (Wave A, I-6): on wide screens the manifesto stays in place while its words light up,
     so progress comes from the whole section; elsewhere it scrolls normally */
  const box = mp.parentElement as HTMLElement, pin = getComputedStyle(mp).position === 'sticky';
  const r = pin ? box.getBoundingClientRect() : mp.getBoundingClientRect();
  const pr = pin ? (innerHeight * .25 - r.top) / Math.max(1, r.height - innerHeight * .75) : (innerHeight * .8 - r.top) / (r.height + innerHeight * .15);
  const n = Math.floor(Math.max(0, Math.min(1, pr)) * mw.length * 1.1);
  mw.forEach((w, i) => w.classList.toggle('lit', calm() || i < n));
}

/* ---------- index list ---------- */
const idx = $('#idx');
A.forEach((w, i) => {
  const li = document.createElement('li');
  const href = w.live ? I18N.url(w.live) : `${I18N.url('worlds')}#cat-${w.o}`;
  li.innerHTML = `<a href="${href}" data-img="${w.img}"${w.live ? ' class="live"' : ''}><span class="n mono">${NF(i + 1, 2)}</span><span class="t">${w.t}</span><span class="c mono">${w.c}</span><span class="g mono">${w.live ? T('live') : T('soon')}</span><img class="th" src="${ROOT}assets/home/${w.img}-t.jpg" alt="" loading="lazy" width="160" height="160"></a>`;
  idx.appendChild(li);
});
const fl = document.createElement('div'); fl.id = 'float'; fl.setAttribute('aria-hidden', 'true');
fl.innerHTML = '<div class="ph"></div><div class="cap mono"><span class="cn"></span><span class="ct"></span><span class="cc"></span></div>';
document.body.appendChild(fl);
const fph = $('.ph', fl), fcn = $('.cn', fl), fct = $('.ct', fl), fcc = $('.cc', fl);
let fx = 0, fy = 0, ftx = 0, fty = 0, warmed = false;
/* full-resolution previews: warm the cache once the index is near, so the first hover is already sharp */
function warm() { if (warmed || MOB) return; warmed = true; $$<HTMLAnchorElement>('#idx a').forEach((a) => { const i = new Image(); i.decoding = 'async'; i.src = src(a.dataset.img ?? ''); }); }
new IntersectionObserver((e, o) => { if (e[0].isIntersecting) { warm(); o.disconnect(); } }, { rootMargin: '400px' }).observe(idx);
$$<HTMLAnchorElement>('#idx a').forEach((a) => {
  a.addEventListener('pointerenter', () => {
    if (MOB) return; warm();
    const im = document.createElement('img'); im.src = src(a.dataset.img ?? ''); im.alt = ''; im.decoding = 'async'; fph.appendChild(im);
    requestAnimationFrame(() => requestAnimationFrame(() => im.classList.add('in')));
    const olds = $$('img', fph); if (olds.length > 3) olds[0].remove();
    fcn.textContent = $('.n', a)?.textContent ?? ''; fct.textContent = $('.t', a)?.textContent ?? ''; fcc.textContent = $('.c', a)?.textContent ?? '';
    fl.classList.add('on'); cur.label(T(a.classList.contains('live') ? 'live' : 'cur.look'));
  });
  a.addEventListener('pointerleave', () => { fl.classList.remove('on'); cur.label(''); });
});
addEventListener('pointermove', (e) => { ftx = e.clientX; fty = e.clientY; flKick(); });

/* ---------- reel: vertical scroll drives the horizontal track ---------- */
const track = $('#track');
REEL.forEach((w, i) => {
  const d = document.createElement('article'); d.className = `card ${w.o} rv`;
  d.innerHTML = `<div class="ph"><img src="${src(w.img, true)}" srcset="${src(w.img, true)} 720w, ${src(w.img)} 1600w" sizes="${w.o === 'p' ? '(max-width:800px) 64vw, 28vw' : '(max-width:800px) 84vw, min(52vw, 760px)'}" alt="${(w.t ?? '').replace(/"/g, '&quot;')}: ${(w.c ?? '').replace(/"/g, '&quot;')}" loading="lazy"></div><div class="cap"><b>${w.t}</b><span class="mono">${NF(i + 1, 2)}<br>${w.c}</span></div>`;
  d.addEventListener('pointerenter', () => cur.label(T('soon'))); d.addEventListener('pointerleave', () => cur.label(''));
  track.appendChild(d);
});
const reel = $('#reel'), rimgs = $$('.card .ph img');
/* phones swipe the reel sideways: keep the counter in step with the card nearest the middle */
track.addEventListener('scroll', () => {
  if (!MOB) return;
  const mid = innerWidth / 2; let best = 0, bd = 1e9;
  $$('.card', track).forEach((c, i) => { const b = c.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
  $('#rc').textContent = NF(best + 1, 2) + ' / ' + NF(REEL.length, 2);
}, { passive: true });
function reelMove() {
  if (MOB) return;
  const r = reel.getBoundingClientRect(), tot = reel.offsetHeight - innerHeight, p = Math.max(0, Math.min(1, -r.top / tot)), max = track.scrollWidth - innerWidth;
  track.style.transform = `translate3d(${(I18N.rtl ? 1 : -1) * p * max}px,0,0)`; $('#rbar').style.width = (p * 100) + '%';
  $('#rc').textContent = NF(Math.min(REEL.length, Math.floor(p * REEL.length) + 1), 2) + ' / ' + NF(REEL.length, 2);
  if (!calm()) rimgs.forEach((im) => { const b = (im.parentNode as HTMLElement).getBoundingClientRect(), c = (b.left + b.width / 2 - innerWidth / 2) / innerWidth; im.style.transform = `scale(1.18) translateX(${c * -8}%)`; });
}

/* ---------- studio: live customisation preview ---------- */
const MOODS: Record<string, [string, string]> = { natural: ['none', ''], noir: ['grayscale(1) contrast(1.2) brightness(.9)', ''], dusk: ['saturate(1.1) contrast(1.05)', '#ff6a3d'], arctic: ['saturate(.7) brightness(1.08)', '#5fb7ff'], neon: ['saturate(1.4) contrast(1.1)', '#ff2bd6'] };
function apply() {
  const m = MOODS[studio.mood] ?? MOODS.natural, f = m[0] === 'none' ? '' : m[0];
  $('#fimg').style.filter = m[0]; const d = $('#fduo'); d.style.background = m[1] || 'transparent'; d.style.opacity = m[1] ? '.45' : '0';
  $('#fallback').style.filter = m[0]; cv.style.filter = f;
  $$('.card .ph img,#float .ph').forEach((e) => { e.style.filter = f; });
  $('#fmood').textContent = T('moodlbl').replace('{mood}', T('mood.' + studio.mood));
  applyStudio(studio);
  { /* the preview photo: which picture, which side, how big */
    const X = studio as unknown as Record<string, string>; const fi = $<HTMLImageElement>('#fimg'), sec = $('#studio');
    const pic = X.fpic || 'castle-mist'; if (!fi.src.includes('/' + pic + '.jpg') && !fi.src.includes('/' + pic + '-s.jpg')) { fi.srcset = `${ROOT}assets/home/${pic}-s.jpg 720w, ${ROOT}assets/home/${pic}.jpg 1600w`; fi.src = `${ROOT}assets/home/${pic}.jpg`; }
    sec.classList.toggle('st-r', X.fside === 'r'); sec.dataset.zoom = X.fzoom || 'm';
  }
  $$('.seg').forEach((g) => $$<HTMLButtonElement>('button', g).forEach((b) => b.setAttribute('aria-pressed', String(String((studio as unknown as Record<string, string>)[g.dataset.k ?? '']) === b.dataset.v))));
  saveStudio(); lit();
}
$$('.seg').forEach((g) => g.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
  if (g.dataset.k === 'motion') choseMotion();
  (studio as unknown as Record<string, string | number>)[g.dataset.k as keyof Studio] = g.dataset.k === 'scale' ? +(b.dataset.v ?? 100) : b.dataset.v ?? ''; apply();
}));
const frame = $('#fimg').parentNode as HTMLElement;
frame.addEventListener('pointerenter', () => cur.label(T('cur.studio'))); frame.addEventListener('pointerleave', () => cur.label(''));

/* ---------- sound: off by default; calm music (public domain) only after the visitor turns it on ---------- */
const snd = $<HTMLButtonElement>('#snd');
if (snd) { let tog: ((on: boolean) => void) | null = null; snd.onclick = () => {
  const on = snd.getAttribute('aria-pressed') !== 'true'; snd.setAttribute('aria-pressed', String(on)); snd.textContent = on ? T('sound.on') : T('sound.off');
  tog ??= homeMusic(); tog(on);
}; }

contactForm();
const cats = A.map((w) => w.c).join(' ✦ ') + ' ✦ ';
$('#mqt').innerHTML = `<span>${cats}</span><span>${cats}</span>`;

hero.addEventListener('pointerenter', () => cur.label(T('cur.drag'))); hero.addEventListener('pointerleave', () => cur.label(''));
let drag: number | null = null;
hero.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') drag = e.clientX; });
addEventListener('pointerup', (e) => { if (drag === null) return; const dx = e.clientX - drag; if (Math.abs(dx) > 60) go(at() + ((I18N.rtl ? -dx : dx) < 0 ? 1 : -1)); drag = null; });

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); } }), { threshold: .15 });
$$('.rv').forEach((e) => io.observe(e));
parallax();

/* the floating preview follows the pointer only while it is catching up; once it has arrived the loop stops,
   so an idle page does no work every frame (audit: it used to restyle the page 60 times a second forever) */
let flRun = false;
function flTick() {
  fx += (ftx - fx) * .12; fy += (fty - fy) * .12; fl.style.left = fx + 'px'; fl.style.top = fy + 'px'; fl.style.rotate = ((ftx - fx) * .04) + 'deg';
  if (Math.abs(ftx - fx) + Math.abs(fty - fy) > .3) requestAnimationFrame(flTick); else flRun = false;
}
function flKick() { if (!flRun) { flRun = true; requestAnimationFrame(flTick); } }
let ticking = false;
addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; lit(); reelMove(); }); }, { passive: true });
addEventListener('resize', () => { MOB = innerWidth < 820; reelMove(); });
void FINE;
apply(); reelMove();

/* the old 3D universe map (code-drawn shapes) was replaced on 21 Nov by a photo mosaic of the 7 world families (#sky);
   initUniverse() returns at once when #universe is absent. The A to Z list toggle stays. */
initUniverse();
{ const lb = document.querySelector<HTMLButtonElement>('#sky .uv-listbtn'), ls = document.getElementById('uv-list');
  if (lb && ls) lb.addEventListener('click', () => { const on = ls.hidden; ls.hidden = !on; lb.setAttribute('aria-expanded', String(on)); lb.textContent = on ? lb.dataset.hide! : lb.dataset.show!; }); }
initDiscover();
initPortal30();
