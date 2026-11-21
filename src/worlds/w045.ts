/* 045 Digital Art: Rooms of Technique. A real 3D world (Three.js, physically based light) with working tools; see src/worlds/dw/art.ts.
   The earlier 2D version is kept in the incoming bundle's legacy-2d folder. */
import type { Ctx } from './kit';
import { mountDW } from './dw/stage';

export default function (ctx: Ctx) { return mountDW(ctx, 'art', () => import('./dw/art')); }
