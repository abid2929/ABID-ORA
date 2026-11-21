/* 019 Architecture: The Stone Pavilion. A real 3D world (Three.js, physically based light) with working tools; see src/worlds/dw/architecture.ts.
   The earlier 2D version is kept in the incoming bundle's legacy-2d folder. */
import type { Ctx } from './kit';
import { mountDW } from './dw/stage';

/* helpers kept from the 2D version (tests and other worlds may import them) */
const RAD = Math.PI / 180;
export function sun(latDeg: number, day: number, hour: number) {
  const dec = -23.44 * Math.cos(2 * Math.PI / 365 * (day + 10)) * RAD, lat = latDeg * RAD, H = 15 * (hour - 12) * RAD;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(-Math.sin(H), Math.tan(dec) * Math.cos(lat) - Math.sin(lat) * Math.cos(H));
  return { el: el / RAD, az: ((az / RAD) + 360) % 360 };
}
export function catenaryA(span: number, rise: number) { let lo = 1e-3, hi = 1e6; for (let i = 0; i < 200; i++) { const a = Math.sqrt(lo * hi); (a * (Math.cosh(span / 2 / a) - 1) > rise ? lo = a : hi = a); } return Math.sqrt(lo * hi); }
const CITIES: [string, number][] = [['Dhaka', 23.8], ['Singapore', 1.35], ['Cairo', 30], ['Tokyo', 35.7], ['New York', 40.7], ['London', 51.5], ['Reykjavík', 64.1], ['Sydney', -33.9], ['Buenos Aires', -34.6]];
const RATIOS: [string, number, string][] = [['phi', 1.618, 'Golden 1 : 1.618'], ['two', 2, 'Double square 1 : 2'], ['root2', Math.SQRT2, 'Paper 1 : √2'], ['four3', 4 / 3, 'Classic 3 : 4']];

export default function (ctx: Ctx) { return mountDW(ctx, 'architecture', () => import('./dw/architecture')); }
