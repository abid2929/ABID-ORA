/* Abidora AI call avatar: a 2D animated character drawn on a canvas.
   A luminous head with eyes that blink and look around, a mouth that opens with the real loudness of the voice
   (when the browser lets us measure it) and a ring of bars around it that shows the live sound level.
   States: listen, think, speak, idle (paused), muted. Nothing here records anything: it only draws numbers it is given. */
export type AvState = 'listen' | 'think' | 'speak' | 'idle' | 'muted';
export interface Avatar { set(s: AvState): void; level(v: number): void; stop(): void; photo(p: Photo | null): void }
/* a portrait for the live voice: the image, and where the lips meet (x, y) and the mouth width, as 0..1 of the image */
export type Photo = { src: string; x: number; y: number; w: number };

export function avatar(cv: HTMLCanvasElement): Avatar {
  const g = cv.getContext('2d')!;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let st: AvState = 'idle', lv = 0, sm = 0, raf = 0, alive = true;
  const bars = new Float32Array(64);
  let blink = 0, nextBlink = performance.now() + 2200, look = 0, lookT = 0;
  const t0 = performance.now();
  let ph: Photo | null = null, img: HTMLImageElement | null = null, oc: HTMLCanvasElement | null = null;
  const draw = (now: number) => {
    if (!alive) return;
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (w && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; }
    const t = calm ? 0 : (now - t0) / 1000, cx = w / 2, cy = h / 2, R = Math.min(w, h) * .27;
    const cs = getComputedStyle(cv), sig = cs.getPropertyValue('--signal').trim() || '#e8b46a', bone = cs.getPropertyValue('--bone').trim() || '#ece6dc';
    sm += (lv - sm) * (lv > sm ? .45 : .12);
    g.clearRect(0, 0, w, h);

    /* halo */
    const halo = g.createRadialGradient(cx, cy, R * .6, cx, cy, R * 2.2);
    halo.addColorStop(0, sig + (st === 'speak' ? '66' : st === 'listen' ? '44' : '22')); halo.addColorStop(1, sig + '00');
    g.fillStyle = halo; g.globalAlpha = .55 + sm * .45; g.fillRect(0, 0, w, h); g.globalAlpha = 1;

    /* sound ring: 64 bars, live level shaped by a moving wave */
    const n = bars.length;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const wave = .55 + .45 * Math.sin(a * 3 + t * 4) * Math.sin(a * 5 - t * 2.3);
      const target = st === 'muted' || st === 'idle' ? .04 : st === 'think' ? .08 + .06 * Math.sin(a * 2 + t * 6) : .05 + sm * wave;
      bars[i] += (target - bars[i]) * .25;
      const r0 = R * 1.34, r1 = r0 + R * .55 * Math.max(.02, bars[i]);
      g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.strokeStyle = st === 'listen' ? bone : sig; g.globalAlpha = .35 + bars[i]; g.lineWidth = Math.max(1.5, R * .045); g.lineCap = 'round'; g.stroke();
    }
    g.globalAlpha = 1;

    /* head: soft sphere with rim light, breathing a little (or the voice's portrait) */
    const br = 1 + (calm ? 0 : Math.sin(t * 1.6) * .012) + sm * .03;
    const hx = cx, hy = cy + (st === 'think' ? Math.sin(t * 2) * R * .02 : 0), HR = R * br;
    if (img && img.complete && img.naturalWidth && ph) {
      /* the portrait, gently alive: a slow breath and a small nod with the voice; while it speaks the jaw drops with
         the real loudness (the part of the face below the lips moves down and the mouth opens dark between) */
      const D = HR * 2, x0 = hx - HR, nod = calm ? 0 : sm * HR * .02 + Math.sin(t * 1.3) * HR * .006, y0 = hy - HR + nod;
      const iw = img.naturalWidth, ih = img.naturalHeight, ly = ph.y * ih;
      const drop = 0;   // mouth movement switched off at the owner's request (20 Nov); the photo stays still, the ring still shows the voice
      g.save(); g.beginPath(); g.arc(hx, hy, HR, 0, Math.PI * 2); g.clip();
      g.drawImage(img, x0, y0, D, D);
      if (drop > .4) {
        const mx = x0 + ph.x * D, my = y0 + ph.y * D, mw = ph.w * D / 2;
        /* the open mouth: a soft dark shape between the lips */
        const mg = g.createRadialGradient(mx, my + drop * .5, 0, mx, my + drop * .5, mw * .9);
        mg.addColorStop(0, 'rgba(26,10,9,.95)'); mg.addColorStop(.7, 'rgba(40,14,12,.8)'); mg.addColorStop(1, 'rgba(40,14,12,0)');
        g.save(); g.translate(mx, my + drop * .5); g.scale(1, Math.min(.5, Math.max(.12, drop * 1.1 / mw))); g.translate(-mx, -(my + drop * .5));
        g.fillStyle = mg; g.beginPath(); g.arc(mx, my + drop * .5, mw * .9, 0, Math.PI * 2); g.fill(); g.restore();
        /* the lower lip and chin move down: a feathered patch, so no hard edge shows on the cheeks or the hand */
        const ow = Math.ceil(D);
        if (!oc || oc.width !== ow) { oc = document.createElement('canvas'); oc.width = oc.height = ow; }
        const o = oc.getContext('2d')!; o.clearRect(0, 0, ow, ow); o.globalCompositeOperation = 'source-over';
        const sy = ly + ih * .002, ty = (sy / ih) * D + drop;
        o.drawImage(img, 0, sy, iw, ih - sy, 0, ty, D, ((ih - sy) / ih) * D);
        const px = ph.x * D, py = ph.y * D + drop + mw * .55, rx = mw * 1.75, ry = mw * 1.45;
        const fg = o.createRadialGradient(px, py, 0, px, py, rx);
        fg.addColorStop(0, 'rgba(0,0,0,1)'); fg.addColorStop(.55, 'rgba(0,0,0,1)'); fg.addColorStop(1, 'rgba(0,0,0,0)');
        o.globalCompositeOperation = 'destination-in'; o.save(); o.translate(px, py); o.scale(1, ry / rx); o.translate(-px, -py);
        o.fillStyle = fg; o.fillRect(0, 0, ow, ow * 3); o.restore(); o.globalCompositeOperation = 'source-over';
        g.drawImage(oc, x0, y0);
      }
      g.restore();
      g.lineWidth = Math.max(2, HR * .045); g.strokeStyle = bone; g.globalAlpha = .9; g.beginPath(); g.arc(hx, hy, HR, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
      if (st === 'muted' || st === 'idle') { g.fillStyle = 'rgba(10,8,6,.35)'; g.beginPath(); g.arc(hx, hy, HR, 0, Math.PI * 2); g.fill(); }
    } else {
    const body = g.createRadialGradient(hx - HR * .35, hy - HR * .45, HR * .1, hx, hy, HR);
    body.addColorStop(0, '#3a2f22'); body.addColorStop(.7, '#1b1612'); body.addColorStop(1, '#0f0c0a');
    g.beginPath(); g.arc(hx, hy, HR, 0, Math.PI * 2); g.fillStyle = body; g.fill();
    g.lineWidth = Math.max(2, HR * .06); g.strokeStyle = bone; g.globalAlpha = .9; g.stroke(); g.globalAlpha = 1;
    const rim = g.createLinearGradient(hx - HR, hy - HR, hx + HR, hy + HR); rim.addColorStop(0, sig + 'aa'); rim.addColorStop(.5, sig + '00');
    g.beginPath(); g.arc(hx, hy, HR * .93, Math.PI * 1.05, Math.PI * 1.6); g.strokeStyle = rim; g.lineWidth = HR * .05; g.stroke();

    /* eyes: blink, look around, squint while thinking, close when muted */
    if (now > nextBlink) { blink = 1; nextBlink = now + 2400 + Math.random() * 2600; }
    blink = Math.max(0, blink - .12);
    if (now > lookT) { look = st === 'think' ? -.6 : (Math.random() - .5) * .5; lookT = now + 1200 + Math.random() * 1800; }
    const ex = HR * .34, ey = hy - HR * .14, ew = HR * .13;
    const open = st === 'muted' ? .12 : st === 'idle' ? .55 : st === 'think' ? .6 : st === 'listen' ? 1.12 : 1;
    const eh = ew * 1.55 * open * (1 - (blink > .5 ? (1 - blink) * 2 : blink) * .95);
    const lx = look * HR * .08, ly = st === 'think' ? -HR * .05 : 0;
    g.fillStyle = bone;
    for (const s of [-1, 1]) { const x = hx + s * ex + lx; g.beginPath(); g.ellipse(x, ey + ly, ew, Math.max(1.5, eh), 0, 0, Math.PI * 2); g.fill(); }

    /* mouth: opens with the voice level while speaking; a small smile otherwise */
    const my = hy + HR * .36, mw = HR * (.26 + sm * .06);
    if (st === 'speak') {
      const mo = Math.max(.06, sm) * HR * .26;
      g.beginPath(); g.ellipse(hx, my, mw, mo, 0, 0, Math.PI * 2); g.fillStyle = '#0a0806'; g.fill(); g.lineWidth = Math.max(2, HR * .045); g.strokeStyle = bone; g.stroke();
    } else {
      g.beginPath(); g.moveTo(hx - mw, my); g.quadraticCurveTo(hx, my + HR * (st === 'listen' ? .12 : .07), hx + mw, my);
      g.strokeStyle = bone; g.lineWidth = Math.max(2, HR * .05); g.lineCap = 'round'; g.stroke();
    }

    }

    /* the Abidora moon: orbits while thinking, rests top-right otherwise */
    const ma = st === 'think' ? -Math.PI / 4 + t * 3 : -Math.PI / 4 + Math.sin(t * .7) * .1;
    g.beginPath(); g.arc(hx + Math.cos(ma) * HR * 1.06, hy + Math.sin(ma) * HR * 1.06, HR * .17, 0, Math.PI * 2); g.fillStyle = sig; g.fill();

    /* muted: a small slashed microphone under the chin */
    if (st === 'muted') {
      const mx = hx, mY = hy + HR * 1.75, s = HR * .14; g.strokeStyle = bone; g.lineWidth = Math.max(1.5, s * .22); g.globalAlpha = .8;
      g.beginPath(); g.roundRect?.(mx - s * .45, mY - s, s * .9, s * 1.5, s * .45); g.stroke();
      g.beginPath(); g.moveTo(mx - s, mY - s * 1.1); g.lineTo(mx + s, mY + s * .9); g.stroke(); g.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  return {
    set(s) { st = s; if (s !== 'speak' && s !== 'listen') lv = 0; },
    level(v) { lv = Math.max(0, Math.min(1, v)); },
    stop() { alive = false; cancelAnimationFrame(raf); },
    photo(p) { ph = p; if (!p) { img = null; return; } const i = new Image(); i.decoding = 'async'; i.src = p.src; img = i; },
  };
}
