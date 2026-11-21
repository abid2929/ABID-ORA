/* 041 Physics Playground: Demolition Lab, real 3D rigid-body physics (cannon-es) with eight challenges,
   a sandbox and Earth, Moon, Mars or Jupiter gravity; the earlier 2D XPBD playground is kept as a second tab. */
import type { Ctx } from './kit';
import { mountGame } from './games/host';

export default function (ctx: Ctx) {
  mountGame(ctx, {
    label: ctx.t('tab.demo', '3D Demolition Lab'),
    game: () => import('./games/sim.js'),
    tabs: [{ key: '2d', label: ctx.t('tab.2d', '2D Playground'), load: () => import('./legacy/w041') }],
  });
}
