/* 036 Space Explorer: Starfall Run, a 3D flight through three sectors toward real neighbouring stars,
   with the earlier journey simulator (The Long Way Out, real distances and scale model) kept as a second tab. */
import type { Ctx } from './kit';
import { mountGame } from './games/host';

export default function (ctx: Ctx) {
  mountGame(ctx, {
    label: ctx.t('tab.fly', 'Fly in 3D'),
    game: () => import('./games/space.js'),
    tabs: [{ key: 'journey', label: ctx.t('tab.journey', 'Journey to the stars'), load: () => import('./legacy/w036') }],
  });
}
