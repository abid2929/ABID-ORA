/* 099 Prism Lab: a 3D light puzzle. Turn mirrors so laser beams light every crystal; 20 levels,
   each generated from a solved board so every level has a solution. */
import type { Ctx } from './kit';
import { mountGame } from './games/host';

export default function (ctx: Ctx) {
  mountGame(ctx, { label: 'Prism Lab', game: () => import('./games/puzzle.js') });
}
