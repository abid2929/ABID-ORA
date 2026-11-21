/* Cursor engine for the Cursor Studio presets. One fixed canvas draws the cursor, its trail,
   particles and click effects. It sleeps when nothing moves, and it never runs on touch screens. */
import type { CursorSpec } from '../data/cursors';

type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: number; k: number };
type Fx = { x: number; y: number; t: number; kind: string; hue: number };

export interface CursorFx { set(spec: CursorSpec | null, preview?: boolean): void; colors(): void; hidden(on: boolean): void }
export function drawShape(g: CanvasRenderingContext2D, s: CursorSpec, size: number, col: string, ang: number, time: number) {
  const r = size / 2, w = s.w ?? 1.5;
  g.save(); g.rotate(ang); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  const poly = (n: number, rr: number, off = -Math.PI / 2) => { g.beginPath(); for (let i = 0; i < n; i++) { const a = off + i * Math.PI * 2 / n; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); };
  const paint = () => (s.f ? g.fill() : g.stroke());
  switch (s.s) {
    case 'dot': g.beginPath(); g.arc(0, 0, r, 0, 7); paint(); break;
    case 'ring': g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); break;
    case 'ringdot': g.beginPath(); g.arc(0, 0, r, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, Math.max(1.6, w * 1.3), 0, 7); g.fill(); break;
    case 'cross': g.beginPath(); g.moveTo(-r, 0); g.lineTo(-r * .25, 0); g.moveTo(r * .25, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, -r * .25); g.moveTo(0, r * .25); g.lineTo(0, r); g.stroke(); break;
    case 'plus': g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.moveTo(0, -r); g.lineTo(0, r); g.stroke(); break;
    case 'square': g.beginPath(); g.rect(-r, -r, size, size); paint(); break;
    case 'diamond': poly(4, r * 1.2, 0); paint(); break;
    case 'tri': poly(3, r * 1.15); paint(); break;
    case 'hex': poly(6, r, 0); paint(); break;
    case 'star': g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); paint(); break;
    case 'bracket': { const k = r * .38; g.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(sx * r, sy * (r - k)); g.lineTo(sx * r, sy * r); g.lineTo(sx * (r - k), sy * r); } g.stroke(); break; }
    case 'blob': g.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = r * (1 + .09 * Math.sin(a * 3 + time * 2.2) + .06 * Math.sin(a * 5 - time * 1.7)); g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); paint(); break;
    case 'beam': g.beginPath(); g.moveTo(0, -r); g.lineTo(0, r); g.stroke(); break;
    case 'glyph': g.font = `${size}px ${getComputedStyle(document.documentElement).getPropertyValue('--sans') || 'sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((s.g ?? '✦') + '︎', 0, size * .04); break;
    case 'orbit': g.beginPath(); g.arc(0, 0, r, 0, 7); g.globalAlpha *= .55; g.stroke(); g.globalAlpha /= .55; g.beginPath(); g.arc(r, 0, Math.max(2.4, w * 2), 0, 7); g.fill(); break;
    case 'reticle': g.beginPath(); g.arc(0, 0, r * .62, 0, 7); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.moveTo(Math.cos(a) * r * .78, Math.sin(a) * r * .78); g.lineTo(Math.cos(a) * r * 1.12, Math.sin(a) * r * 1.12); } g.stroke(); g.beginPath(); g.arc(0, 0, 1.4, 0, 7); g.fill(); break;
  }
  g.restore();
}

export function cursorFx(): CursorFx {
  const cv = document.createElement('canvas'); cv.id = 'curfx'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:99;display:none';
  document.body.appendChild(cv);
  const g = cv.getContext('2d')!;
  let spec: CursorSpec | null = null, W = 0, H = 0, D = 1;
  let tx = -200, ty = -200, x = -200, y = -200, vx = 0, vy = 0, seen = false, inside = true, hov = 0, press = 1, spin = 0, t0 = performance.now(), hide = false;
  let curS = 1;
  let hist: [number, number][] = [], stars: [number, number][] = [], parts: P[] = [], fx: Fx[] = [], raf = 0, last = 0, frame = 0;
  let C = { signal: '#e8b46a', bone: '#ece6dc' };
  const size = () => { D = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * D; cv.height = H * D; };
  size(); addEventListener('resize', size);
  const col = (c: string | undefined, time: number, hue = 0) => c === 'rainbow' ? `hsl(${(time * 70 + hue) % 360} 95% 64%)` : c === 'signal' || !c ? C.signal : c === 'bone' ? C.bone : c;
  const wake = () => { if (!raf && spec) raf = requestAnimationFrame(tick); };
  addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; tx = e.clientX; ty = e.clientY; if (!seen) { x = tx; y = ty; seen = true; } inside = true; wake(); }, { passive: true });
  document.addEventListener('mouseleave', () => { inside = false; wake(); });
  addEventListener('pointerdown', (e) => {
    if (!spec || e.pointerType !== 'mouse') return; press = .72;
    const k = spec.k ?? 'ripple', hue = Math.random() * 360;
    if (k === 'rings') { for (let i = 0; i < 3; i++) fx.push({ x: tx, y: ty, t: -i * 7, kind: 'ring', hue }); }
    else if (k === 'ripple') fx.push({ x: tx, y: ty, t: 0, kind: 'ring', hue });
    else if (k === 'burst') for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; parts.push({ x: tx, y: ty, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, life: 0, max: 26, hue: i * 30, k: 2 }); }
    wake();
  });
  addEventListener('pointerup', () => { press = 1; wake(); });
  const over = (e: Event) => { const el = e.target as Element | null; hov = el && el.closest && el.closest('a,button,input,select,textarea,label,[role=button],[tabindex]:not([tabindex="-1"])') ? 1 : 0; wake(); };
  document.addEventListener('pointerover', over);

  function spawn(sp: CursorSpec, speed: number, time: number) {
    const t = sp.t ?? 'none', n = sp.n ?? 2; if (!['particles', 'sparks', 'rise', 'fall'].includes(t)) return;
    if (speed < .6 && t !== 'rise' && t !== 'fall' && frame % 6) return;
    if ((t === 'rise' || t === 'fall') && frame % 3) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = t === 'sparks' ? 1.5 + Math.random() * 3 : .3 + Math.random() * .9;
      parts.push({ x: x + (Math.random() - .5) * 6, y: y + (Math.random() - .5) * 6, vx: Math.cos(a) * s - vx * .05, vy: Math.sin(a) * s + (t === 'rise' ? -1.1 : t === 'fall' ? 1 : 0), life: 0, max: t === 'sparks' ? 22 : 46 + Math.random() * 30, hue: time * 70 + Math.random() * 90, k: t === 'sparks' ? 1 : t === 'rise' || t === 'fall' ? 3 : 0 });
    }
    if (parts.length > 400) parts.splice(0, parts.length - 400);
  }

  function tick(now: number) {
    raf = 0; if (!spec) { g.clearRect(0, 0, cv.width, cv.height); return; }
    frame++; const time = (now - t0) / 1000, sp = spec, dt = Math.min(3, (now - (last || now)) / 16.7 || 1); last = now;
    const l = sp.l ?? .3, o = sp.o ?? 0;
    if (o > 0) { vx = vx * o + (tx - x) * l; vy = vy * o + (ty - y) * l; x += vx; y += vy; }
    else { const nx = x + (tx - x) * Math.min(1, l * dt), ny = y + (ty - y) * Math.min(1, l * dt); vx = nx - x; vy = ny - y; x = nx; y = ny; }
    const speed = Math.hypot(vx, vy);
    spin += (sp.r ?? 0) * dt;
    const hs = 1 + ((sp.h ?? 1.5) - 1) * hov; curS += (hs * press - curS) * .18; const sc = curS;
    const pulse = sp.p ? 1 + Math.sin(time * 6) * sp.p : 1;
    const tr = sp.t ?? 'none', n = sp.n ?? 20;
    if (tr !== 'none') { hist.unshift([x, y]); if (hist.length > n) hist.length = n; }
    if (tr === 'constellation' && frame % 7 === 0 && speed > .3) { stars.unshift([x, y]); if (stars.length > n) stars.length = n; }
    spawn(sp, speed, time);

    g.setTransform(D, 0, 0, D, 0, 0); g.clearRect(0, 0, W, H);
    const c0 = col(sp.c, time), ac = sp.a ? col(sp.a, time) : c0;
    const vis = inside && seen && !hide ? 1 : 0;
    g.globalAlpha = vis;
    /* trails */
    if (tr === 'line' || tr === 'ribbon') {
      for (let i = 1; i < hist.length; i++) { const k = 1 - i / hist.length; g.strokeStyle = sp.c === 'rainbow' ? col('rainbow', time, i * 8) : ac; g.globalAlpha = vis * k * .9; g.lineWidth = tr === 'ribbon' ? Math.max(.5, (sp.z * .9) * k) : Math.max(.6, (sp.w ?? 1.5) * k * 1.4); g.lineCap = 'round'; g.beginPath(); g.moveTo(hist[i - 1][0], hist[i - 1][1]); g.lineTo(hist[i][0], hist[i][1]); g.stroke(); }
    } else if (tr === 'dots') {
      for (let i = 2; i < hist.length; i += 3) { const k = 1 - i / hist.length; g.globalAlpha = vis * k; g.fillStyle = ac; g.beginPath(); g.arc(hist[i][0], hist[i][1], Math.max(.8, sp.z * .22 * k), 0, 7); g.fill(); }
    } else if (tr === 'comet') {
      for (let i = hist.length - 1; i > 0; i--) { const k = 1 - i / hist.length; g.globalAlpha = vis * k * .55; g.fillStyle = ac; g.beginPath(); g.arc(hist[i][0], hist[i][1], Math.max(.6, sp.z * .5 * k), 0, 7); g.fill(); }
    } else if (tr === 'ghost') {
      const step = Math.max(1, Math.floor(hist.length / 5));
      for (let i = step; i < hist.length; i += step) { const k = 1 - i / hist.length; g.globalAlpha = vis * k * .45; g.save(); g.translate(hist[i][0], hist[i][1]); drawShape(g, { ...sp, f: false }, sp.z * sc * (0.6 + .4 * k), ac, spin * Math.PI / 180, time); g.restore(); }
    } else if (tr === 'constellation') {
      g.strokeStyle = ac; g.lineWidth = .7;
      for (let i = 0; i < stars.length; i++) { const k = 1 - i / stars.length; g.globalAlpha = vis * k * .7; g.fillStyle = ac; g.beginPath(); g.arc(stars[i][0], stars[i][1], 1.6, 0, 7); g.fill(); if (i) { g.beginPath(); g.moveTo(stars[i - 1][0], stars[i - 1][1]); g.lineTo(stars[i][0], stars[i][1]); g.stroke(); } }
    }
    /* particles */
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life += dt; if (p.life > p.max) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.k === 1) p.vy += .18 * dt; if (p.k === 3) p.x += Math.sin((p.life + p.hue) * .15) * .4; if (p.k === 2) { p.vx *= .9; p.vy *= .9; }
      const k = 1 - p.life / p.max; g.globalAlpha = k * (vis || .6); const pc = sp.c === 'rainbow' || p.k === 2 && sp.c === 'rainbow' ? `hsl(${p.hue % 360} 95% 64%)` : ac;
      if (p.k === 1 || p.k === 2) { g.strokeStyle = pc; g.lineWidth = 1.4; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); g.stroke(); }
      else { g.fillStyle = pc; g.beginPath(); g.arc(p.x, p.y, Math.max(.6, (p.k === 3 ? 2.6 : 1.8) * k + .4), 0, 7); g.fill(); }
    }
    /* click rings */
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i]; f.t += dt; if (f.t > 34) { fx.splice(i, 1); continue; } if (f.t < 0) continue;
      const k = f.t / 34; g.globalAlpha = (1 - k) * .9; g.strokeStyle = sp.c === 'rainbow' ? `hsl(${f.hue} 95% 64%)` : c0; g.lineWidth = 1.6 * (1 - k) + .4; g.beginPath(); g.arc(f.x, f.y, 6 + k * 48, 0, 7); g.stroke();
    }
    /* the cursor itself */
    g.globalAlpha = vis; g.save(); g.translate(x, y);
    if (sp.x && speed > .2) { const a = Math.atan2(vy, vx), st = Math.min(1 + speed * sp.x * .05, 2.1); g.rotate(a); g.scale(st, 1 / Math.sqrt(st)); g.rotate(-a); }
    drawShape(g, sp, sp.z * sc * pulse, c0, spin * Math.PI / 180, time); g.restore(); g.globalAlpha = 1;

    const busy = Math.abs(tx - x) + Math.abs(ty - y) > .3 || Math.abs(vx) + Math.abs(vy) > .05 || parts.length || fx.length || (sp.r ?? 0) || sp.p || sp.s === 'blob' || sp.c === 'rainbow' || Math.abs(sc - hs * press) > .01 || (tr !== 'none' && hist.length && Math.hypot(hist[hist.length - 1][0] - x, hist[hist.length - 1][1] - y) > .5);
    if (busy) raf = requestAnimationFrame(tick); else { hist = hist.slice(0, 1); }
  }
  return {
    set(s) {
      spec = s; cv.style.display = s ? 'block' : 'none'; cv.style.mixBlendMode = s && s.b === 'd' ? 'difference' : 'normal';
      hist = []; stars = []; parts = []; fx = []; this.colors(); wake();
    },
    colors() { const cs = getComputedStyle(document.documentElement); C = { signal: cs.getPropertyValue('--signal').trim() || '#e8b46a', bone: document.documentElement.dataset.tone === 'light' && spec?.b === 'd' ? '#ffffff' : cs.getPropertyValue('--bone').trim() || '#ece6dc' }; wake(); },
    hidden(on) { hide = on; wake(); },
  };
}
