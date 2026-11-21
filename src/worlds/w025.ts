/* 025 Creative Design: The Packaging Studio. A real 3D world (Three.js, physically based light) with working tools; see src/worlds/dw/design.ts.
   The earlier 2D version is kept in the incoming bundle's legacy-2d folder. */
import type { Ctx } from './kit';
import { mountDW } from './dw/stage';

/* helpers kept from the 2D version (tests and other worlds may import them) */
type V3 = [number, number, number];
interface Panel { name: string; poly: [number, number][]; hinge?: { p: V3; d: V3; sign: number }; kids: Panel[]; tone: number }
const SHEETS: Record<string, [number, number]> = { A4: [210, 297], A3: [297, 420], SRA3: [320, 450], B1: [707, 1000] };

function rot(p: V3, o: V3, d: V3, a: number): V3 {
  const [x, y, z] = [p[0] - o[0], p[1] - o[1], p[2] - o[2]], c = Math.cos(a), sn = Math.sin(a), [u, v, w] = d;
  const dot = u * x + v * y + w * z;
  return [o[0] + u * dot * (1 - c) + x * c + (v * z - w * y) * sn, o[1] + v * dot * (1 - c) + y * c + (w * x - u * z) * sn, o[2] + w * dot * (1 - c) + z * c + (u * y - v * x) * sn];
}
export function build(L: number, W: number, D: number) {
  const tuck = Math.min(18, W * .6), glue = Math.min(15, W * .7), dust = W * .8;
  const rect = (x: number, y: number, w: number, hh: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + hh], [x, y + hh]];
  const P = (name: string, poly: [number, number][], tone: number, hinge?: Panel['hinge']): Panel => ({ name, poly, hinge, kids: [], tone });
  /* flat layout, y downwards: glue | front L | side W | back L | side W ; height D from y = 0 */
  const front = P('front', rect(glue, 0, L, D), 1);
  const glueF = P('glue', [[0, 4], [glue, 0], [glue, D], [0, D - 4]], .8, { p: [glue, 0, 0], d: [0, 1, 0], sign: 1 });
  const s1 = P('side', rect(glue + L, 0, W, D), .85, { p: [glue + L, 0, 0], d: [0, 1, 0], sign: -1 });
  const back = P('back', rect(glue + L + W, 0, L, D), .95, { p: [glue + L + W, 0, 0], d: [0, 1, 0], sign: -1 });
  const s2 = P('side', rect(glue + 2 * L + W, 0, W, D), .85, { p: [glue + 2 * L + W, 0, 0], d: [0, 1, 0], sign: -1 });
  /* lid on the back top, tuck on the lid; reverse tuck: bottom closure on the front */
  const bx = glue + L + W;
  const lid = P('lid', rect(bx, -W, L, W), 1.05, { p: [bx, 0, 0], d: [1, 0, 0], sign: -1 });
  const lidTuck = P('tuck', [[bx + 2, -W - tuck + 3], [bx + L - 2, -W - tuck + 3], [bx + L, -W], [bx, -W]], 1.05, { p: [bx, -W, 0], d: [1, 0, 0], sign: -1 });
  const base = P('base', rect(glue, D, L, W), .75, { p: [glue, D, 0], d: [1, 0, 0], sign: 1 });
  const baseTuck = P('tuck', [[glue, D + W], [glue + L, D + W], [glue + L - 2, D + W + tuck - 3], [glue + 2, D + W + tuck - 3]], .75, { p: [glue, D + W, 0], d: [1, 0, 0], sign: 1 });
  const dustT = (x: number): Panel => P('dust', [[x, 0], [x + W, 0], [x + W - 2, -dust * .55], [x + W * .3, -dust], [x + 1, -dust]], .7, { p: [x, 0, 0], d: [1, 0, 0], sign: -1 });
  const dustB = (x: number): Panel => P('dust', [[x, D], [x + W, D], [x + W - 1, D + dust], [x + W * .7, D + dust], [x + 2, D + dust * .55]], .7, { p: [x, D, 0], d: [1, 0, 0], sign: 1 });
  lid.kids.push(lidTuck); base.kids.push(baseTuck);
  const d1t = dustT(glue + L), d2t = dustT(glue + 2 * L + W), d1b = dustB(glue + L), d2b = dustB(glue + 2 * L + W);
  s1.kids.push(back, d1t, d1b); back.kids.push(s2, lid); s2.kids.push(d2t, d2b);
  front.kids.push(glueF, s1, base);
  return { root: front, glue, tuck, dust };
}
function flatten(p: Panel, out: Panel[] = []) { out.push(p); p.kids.forEach((k) => flatten(k, out)); return out; }

export default function (ctx: Ctx) { return mountDW(ctx, 'design', () => import('./dw/design')); }
