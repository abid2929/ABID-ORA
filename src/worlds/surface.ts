/* Surface maps for the Abidora fashion studio, drawn in code as seamless tiles (no downloads, no third-party
   textures). Each kind is a height field modelled on the real material at its real scale: pebbled leather grain
   with domed cells and creased grooves, suede nap, crocodile scales, 2/1 denim twill with slubby threads, plain
   weave, jersey and rib knit loops, honeycomb air mesh with open holes, ripstop grid, rubber stipple, EVA foam
   pores, cork grains and brushed fleece. From the height come three maps: a normal map (relief), a roughness map
   (cavities are rougher and duller) and a cavity occlusion map (dirt and shadow settle in the grooves). */
import * as THREE from 'three';

export type SK = 'leather' | 'suede' | 'croc' | 'twill' | 'weave' | 'knit' | 'rib' | 'mesh' | 'ripstop' | 'rubber' | 'foam' | 'cork' | 'smooth' | 'fleece';

const P32 = (n: number) => { n = (n ^ 61) ^ (n >>> 16); n = Math.imul(n, 9); n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; };
const hash = (x: number, y: number, s = 0) => P32(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s + 1, 83492791));
const wrap = (i: number, p: number) => ((i % p) + p) % p;
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* periodic value noise and fbm (period in cells divides the tile exactly, so tiles join without seams) */
function vnoise(x: number, y: number, per: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(wrap(ix, per), wrap(iy, per), seed), b = hash(wrap(ix + 1, per), wrap(iy, per), seed);
  const c = hash(wrap(ix, per), wrap(iy + 1, per), seed), d = hash(wrap(ix + 1, per), wrap(iy + 1, per), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number, per: number, seed: number, oct = 4) {
  let s = 0, a = .5, f = 1;
  for (let o = 0; o < oct; o++) { s += a * vnoise(x * f, y * f, per * f, seed + o); a *= .5; f *= 2; }
  return s;
}
/* periodic Worley noise: F1, F2 distances in cell units and the id of the nearest cell */
function worley(x: number, y: number, per: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y); let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, wx = wrap(cx, per), wy = wrap(cy, per);
    const px = cx + .1 + .8 * hash(wx, wy, seed), py = cy + .1 + .8 * hash(wy, wx, seed + 7);
    const d = Math.hypot(x - px, y - py);
    if (d < f1) { f2 = f1; f1 = d; id = wx * 977 + wy; } else if (d < f2) f2 = d;
  }
  return [f1, f2, id] as const;
}

function height(kind: SK, W: number): Float32Array {
  const H = new Float32Array(W * W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / W; let h = .5;
    switch (kind) {
      case 'leather': {   // pebble grain: domed cells split by fine creases, plus faint natural wrinkles
        const N = 56, [f1, f2] = worley(u * N, v * N, N, 3);
        const edge = sstep(0, .22, f2 - f1), dome = 1 - f1 * f1 * .55;
        const wr = Math.abs(fbm(u * 6, v * 6, 6, 11, 3) - .5); const wrinkle = 1 - sstep(0, .035, wr) ;
        h = .25 + .6 * edge * dome + .08 * fbm(u * 64, v * 64, 64, 5, 2) - .18 * wrinkle;
        break;
      }
      case 'suede': {     // short brushed nap: fine fuzz stretched along one direction, with soft pile marks
        h = .55 * fbm(u * 256, v * 64, 64, 9, 3) + .3 * fbm(u * 512, v * 512, 512, 4, 2) + .15 * fbm(u * 8, v * 8, 8, 2, 3);
        break;
      }
      case 'fleece': { h = .6 * fbm(u * 160, v * 160, 160, 21, 4) + .4 * fbm(u * 24, v * 24, 24, 22, 3); break; }
      case 'croc': {      // big tiled scales with flat tops, rounded shoulders and deep grooves, small pores
        const N = 7, [f1, f2] = worley(u * N, v * N * 1.4 / 1.4, N, 17);
        const g = f2 - f1; h = sstep(0, .14, g) * (.85 + .15 * (1 - f1)) + .04 * fbm(u * 90, v * 90, 90, 18, 2);
        const [p1] = worley(u * 70, v * 70, 70, 19); h -= .12 * (1 - sstep(.0, .18, p1)) * sstep(.05, .2, g);
        break;
      }
      case 'twill': {     // 2/1 twill: diagonal wales; each warp thread varies in thickness (slub)
        const T = 16, px = x % T, py = y; const d = ((x + y) % (T * 3)) / (T * 3);
        const wale = .5 + .5 * Math.sin(d * Math.PI * 2 * 3);
        const slub = .8 + .2 * vnoise(Math.floor(x / 5), y / 90, W / 5, 31);
        h = wale * slub * (.85 + .15 * Math.sin(px / T * Math.PI)) + .06 * fbm(u * 128, v * 128, 128, 32, 2) + 0 * py;
        break;
      }
      case 'weave': case 'ripstop': {   // plain weave: warp over weft, weft over warp, alternating
        const T = kind === 'ripstop' ? 12 : 16, cx = Math.floor(x / T), cy = Math.floor(y / T), fx = (x % T) / T, fy = (y % T) / T;
        const warpTop = (cx + cy) % 2 === 0;
        const across = warpTop ? Math.sin(fx * Math.PI) : Math.sin(fy * Math.PI);
        const along = warpTop ? .6 + .4 * Math.sin(fy * Math.PI) : .6 + .4 * Math.sin(fx * Math.PI);
        h = across * along * (.85 + .15 * vnoise(cx, y / 40, W / T, 41)) ;
        if (kind === 'ripstop') { const g = 96; const lx = x % g, ly = y % g; if (lx < T * 1.5 || ly < T * 1.5) h = h * .6 + .45; }
        break;
      }
      case 'knit': {      // jersey: columns of V-shaped loops
        const TW = 18, TH = 14, cx = (x % TW) / TW, cy = (y % TH) / TH;
        const leg = cx < .5 ? Math.abs((cx * 2) - (1 - cy) * .55 - .2) : Math.abs(((1 - cx) * 2) - (1 - cy) * .55 - .2);
        h = Math.max(0, 1 - leg * 3.2) * (.8 + .2 * Math.sin(cy * Math.PI)) + .05 * fbm(u * 200, v * 200, 200, 51, 2);
        break;
      }
      case 'rib': {       // 1x1 rib knit: raised columns with loop texture
        const T = 20, fx = (x % T) / T; const col = Math.pow(Math.sin(fx * Math.PI), .7);
        h = col * (.75 + .25 * Math.abs(Math.sin((y / 12) * Math.PI))) + .05 * fbm(u * 200, v * 200, 200, 52, 2);
        break;
      }
      case 'mesh': {      // honeycomb air mesh: round open cells in a raised knit frame
        const N = 22; const rowH = Math.sqrt(3) / 2; const gy = v * N / rowH, row = Math.floor(gy); const off = row % 2 ? .5 : 0;
        const gx = u * N + off; const fx = gx - Math.floor(gx) - .5, fy = (gy - row) - .5;
        const r = Math.hypot(fx, fy * rowH * 2 / Math.sqrt(3));
        h = sstep(.26, .36, r) * (.85 + .15 * fbm(u * 180, v * 180, 180, 61, 2));
        break;
      }
      case 'rubber': {    // vulcanised rubber: fine stipple and moulding marks
        const [f1] = worley(u * 140, v * 140, 140, 71); h = .55 + .25 * (1 - sstep(0, .4, f1)) + .2 * fbm(u * 32, v * 32, 32, 72, 3);
        break;
      }
      case 'foam': {      // EVA foam: smooth skin with small open pores
        const [f1] = worley(u * 90, v * 90, 90, 81); h = .7 + .15 * fbm(u * 20, v * 20, 20, 82, 3) - .35 * (1 - sstep(.05, .2, f1));
        break;
      }
      case 'cork': {
        const [f1, f2, id] = worley(u * 40, v * 40, 40, 91); h = .4 + .4 * hash(id, 3) * sstep(0, .1, f2 - f1) + .2 * fbm(u * 160, v * 160, 160, 92, 2) - .3 * (1 - sstep(0, .12, f1));
        break;
      }
      default: h = .5 + .03 * fbm(u * 40, v * 40, 40, 99, 3);   // smooth: faint orange-peel
    }
    H[y * W + x] = h;
  }
  return H;
}

const STR: Record<SK, [number, number, number]> = {   // normal strength, cavity occlusion, cavity roughness
  leather: [3.2, .55, .35], suede: [1.4, .25, .1], fleece: [1.6, .3, .05], croc: [5, .7, .4], twill: [3, .45, .15], weave: [3.2, .5, .15], ripstop: [2.4, .35, .1],
  knit: [3.4, .55, .1], rib: [3.4, .5, .1], mesh: [5, .9, .2], rubber: [1.6, .3, .15], foam: [2, .45, .2], cork: [3, .5, .2], smooth: [.6, .05, .05],
};

const cache = new Map<string, { normal: THREE.DataTexture; orm: THREE.DataTexture }>();
/* returns shared tiles; materials use .clone() views to set their own repeat */
export function surfaceMaps(kind: SK, size = 1024) {
  const key = kind + ':' + size; const hit = cache.get(key); if (hit) return hit;
  const W = size, Hh = height(kind, W), [k, ao, ro] = STR[kind];
  let mn = 1e9, mx = -1e9; for (const v of Hh) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const span = Math.max(1e-6, mx - mn);
  const n = new Uint8Array(W * W * 4), o = new Uint8Array(W * W * 4);
  const s = k * W / 512;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, h = (Hh[i] - mn) / span;
    const L = Hh[y * W + (x - 1 + W) % W], R = Hh[y * W + (x + 1) % W], U = Hh[((y - 1 + W) % W) * W + x], D = Hh[((y + 1) % W) * W + x];
    let nx = (L - R) / span * s, ny = (D - U) / span * s; const nz = 1, l = Math.hypot(nx, ny, nz); nx /= l; ny /= l;
    n[i * 4] = (nx * .5 + .5) * 255; n[i * 4 + 1] = (ny * .5 + .5) * 255; n[i * 4 + 2] = (nz / l * .5 + .5) * 255; n[i * 4 + 3] = 255;
    const cav = Math.pow(1 - h, 1.6);
    o[i * 4] = (1 - cav * ao) * 255;                          // R: occlusion
    o[i * 4 + 1] = Math.min(1, .82 + cav * ro + (h - .5) * -.04) * 255;   // G: roughness factor
    o[i * 4 + 2] = 0; o[i * 4 + 3] = 255;
  }
  const mk = (d: Uint8Array) => { const t = new THREE.DataTexture(d, W, W, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; };
  const out = { normal: mk(n), orm: mk(o) }; cache.set(key, out); return out;
}
