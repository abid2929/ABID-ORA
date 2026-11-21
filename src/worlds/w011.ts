/* 011 Racing: Abidora Circuit, a 3D race (three laps against three rivals, real car physics, real 3D car models).
   The old Performance Lab tab (flat drawn cars) was removed on the owner's order, 21 Nov; its code stays in legacy/w011.ts. */
import type { Ctx } from './kit';
import { mountGame } from './games/host';

export default function (ctx: Ctx) {
  mountGame(ctx, {
    label: ctx.t('tab.race', 'Race in 3D'),
    game: () => import('./games/racing.js'),
  });
}
