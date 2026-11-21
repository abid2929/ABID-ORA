/* 082 Isle of Abidora: open-world 3D island made in code (terrain, forests, a living sea, landmarks).
   Fly a drone anywhere and find eight light shards. */
import type { Ctx } from './kit';
import { mountGame } from './games/host';

export default function (ctx: Ctx) {
  mountGame(ctx, { label: 'Isle of Abidora', game: () => import('./games/explore.js') });
}
