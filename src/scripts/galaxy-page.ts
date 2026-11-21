/* World 74 page: UI first, then the 3D scene is loaded on demand (separate JS chunk).
   If WebGL is unavailable the page shows a real photograph and keeps all text and controls readable. */
import { I18N } from './i18n';
import './common';
import { studio, cursor } from './studio-core';
import type { Shape, GalaxyScene } from './galaxy-scene';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const T = I18N.t;
const R = matchMedia('(prefers-reduced-motion: reduce)').matches;
const calm = R || studio.motion === 'calm';
const cur = cursor();
const canvas = $<HTMLCanvasElement>('gxc'), loader = $('gxl'), msg = $('gxm'), desc = $('gxd'), count = $('gxn');
const shp = $('shp'), armsRow = $('armsRow'), av = $('av'), am = $<HTMLButtonElement>('am'), ap = $<HTMLButtonElement>('ap');
const spin = $<HTMLInputElement>('spin'), pp = $<HTMLButtonElement>('pp');
const names: Record<Shape, string> = { spiral: T('gx.s.spiral'), barred: T('gx.s.barred'), elliptical: T('gx.s.elliptical'), irregular: T('gx.s.irregular') };
const descs: Record<Shape, string> = { spiral: T('gx.d.spiral'), barred: T('gx.d.barred'), elliptical: T('gx.d.elliptical'), irregular: T('gx.d.irregular') };
let shape: Shape = 'spiral', arms = 2, scene: GalaxyScene | null = null;
if (calm) spin.value = '0.35';
if (R) spin.value = '0';

function label() { canvas.setAttribute('aria-label', T('gx.canvas').replace('{shape}', names[shape])); }
function syncArms() { av.textContent = I18N.n(arms); am.disabled = arms <= 2; ap.disabled = arms >= 5; armsRow.hidden = !(shape === 'spiral' || shape === 'barred'); }
function fail(key: string) {
  loader.classList.add('done'); msg.textContent = T(key); msg.hidden = false;
  canvas.hidden = true; ($('gxf') as HTMLImageElement).hidden = false;
  document.querySelectorAll<HTMLButtonElement>('#fly,#rst,#pp,#spin,#am,#ap').forEach((b) => { b.disabled = true; });
}
function webglOK(): boolean { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }

shp.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
  shape = b.dataset.s as Shape;
  shp.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  desc.textContent = descs[shape]; syncArms(); label(); scene?.setShape(shape, arms);
});
am.onclick = () => { arms = Math.max(2, arms - 1); syncArms(); scene?.setShape(shape, arms); };
ap.onclick = () => { arms = Math.min(5, arms + 1); syncArms(); scene?.setShape(shape, arms); };
spin.oninput = () => scene?.setSpin(parseFloat(spin.value));
pp.onclick = () => { const p = pp.getAttribute('aria-pressed') !== 'true'; pp.setAttribute('aria-pressed', String(p)); pp.textContent = T(p ? 'gx.play' : 'gx.pause'); scene?.setPaused(p); };
$('fly').onclick = () => scene?.fly();
$('rst').onclick = () => scene?.reset();
canvas.addEventListener('pointerenter', () => cur.label(T('cur.drag'))); canvas.addEventListener('pointerleave', () => cur.label(''));
syncArms(); label();

if (!webglOK()) fail('gx.nogl');
else {
  import('./galaxy-scene').then(({ createGalaxy }) => {
    scene = createGalaxy(canvas, { calm, reduced: R, rtl: I18N.rtl, spin: parseFloat(spin.value), onError: () => fail('gx.err'), onFly: (inside) => document.querySelector('.gx')?.classList.toggle('inside', inside) });
    count.textContent = T('gx.stars').replace('{n}', I18N.ng(scene.count));
    scene.setShape(shape, arms, true);
    requestAnimationFrame(() => loader.classList.add('done'));
  }).catch(() => fail('gx.err'));
}

/* remember the visit on this device only, for the universe map on the homepage */
try { const v = new Set<number>(JSON.parse(localStorage.getItem('ab.visited') || '[]')); v.add(74); localStorage.setItem('ab.visited', JSON.stringify([...v].slice(-200))); } catch { /* private mode */ }
