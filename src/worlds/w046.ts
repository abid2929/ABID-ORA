/* 046 Photography: Camera School. A real 3D world (Three.js, physically based light) with working tools; see src/worlds/dw/photo.ts.
   The earlier 2D version is kept in the incoming bundle's legacy-2d folder. */
import type { Ctx } from './kit';
import { mountDW } from './dw/stage';

/* helpers kept from the 2D version (tests and other worlds may import them) */
/* ---------- optics (exported for tests); lengths in millimetres ---------- */
export const SENSOR_W = 36, SENSOR_H = 24, COC = .03;
export const evOf = (N: number, t: number, iso: number) => Math.log2(N * N / t) - Math.log2(iso / 100);
/** blur-spot diameter on the sensor (mm) for an object at x when focused at s, focal length f, f-number N */
export const blurSpot = (f: number, N: number, s: number, x: number) => (f * f / (N * (s - f))) * Math.abs(x - s) / x;
export const hyperfocal = (f: number, N: number, c = COC) => f * f / (N * c) + f;
/** near and far limits of acceptable sharpness (mm); far is Infinity beyond the hyperfocal distance */
export function dof(f: number, N: number, s: number, c = COC) {
  const H = hyperfocal(f, N, c), near = s * (H - f) / (H + s - 2 * f), far = s >= H ? Infinity : s * (H - f) / (H - s);
  return { near, far, H };
}
export const airy = (N: number) => 2.44 * .00055 * N; // mm, green light

const STOPS_N = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
const STOPS_T = [1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250, 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2, 1];
const STOPS_ISO = [100, 200, 400, 800, 1600, 3200, 6400, 12800];
const tName = (t: number) => (t >= 1 ? t + ' s' : '1/' + Math.round(1 / t) + ' s');

export default function (ctx: Ctx) { return mountDW(ctx, 'photo', () => import('./dw/photo')); }
