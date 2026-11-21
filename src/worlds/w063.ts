/* World 063 (Tech & AI batch): the scene lives in ./tech/innovation.js, the shared host and kit in ./tech/host.ts and ./tech/tk.js. */
import type { Ctx } from './kit';
import { mount } from './tech/host';
export default (ctx: Ctx) => mount(ctx, () => import('./tech/innovation.js'));
