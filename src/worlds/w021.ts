/* 021 Future City: The 15-Minute City. A real 3D world (Three.js, physically based light) with working tools; see src/worlds/dw/city.ts.
   The earlier 2D version is kept in the incoming bundle's legacy-2d folder. */
import type { Ctx } from './kit';
import { mountDW } from './dw/stage';

/* helpers kept from the 2D version (tests and other worlds may import them) */
const G = 24, CELL_M = 100, WALK = 80; /* metres per cell, metres per minute */
const Z = ['empty', 'home', 'shop', 'work', 'park', 'transit'] as const;
type Zone = typeof Z[number];
const COL: Record<Zone, string> = { empty: '#1a1d2a', home: '#7aa2ff', shop: '#ff7ad9', work: '#ffd36e', park: '#53e0a1', transit: '#7af0ff' };
const NAME: Record<Zone, string> = { empty: 'Clear', home: 'Homes', shop: 'Shops', work: 'Offices', park: 'Parks', transit: 'Transit stop' };
const NEED: Zone[] = ['shop', 'work', 'park', 'transit'];

export function walkMinutes(grid: Uint8Array, target: number) {
  /* multi-source BFS over the grid (4-neighbour streets) */
  const d = new Int32Array(G * G).fill(-1), q: number[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i] === target) { d[i] = 0; q.push(i); }
  for (let h0 = 0; h0 < q.length; h0++) { const i = q[h0], x = i % G, y = (i / G) | 0; for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue; const j = ny * G + nx; if (d[j] < 0) { d[j] = d[i] + 1; q.push(j); } } }
  return Array.from(d, (v) => v < 0 ? Infinity : v * CELL_M / WALK);
}

export default function (ctx: Ctx) { return mountDW(ctx, 'city', () => import('./dw/city')); }
