/* Cursor Studio: 104 presets (hover a card to try it, click to keep it) plus a builder for your own cursor. */
import { I18N } from './i18n';
import './common';
import { studio, saveStudio, applyStudio, cursor, grain, previewCursor, presetSpec, FINE } from './studio-core';
import { CURSORS, cursorById, type CursorSpec, type Shape, type Trail, type Click } from '../data/cursors';
import { drawShape } from './cursor-fx';

cursor(); grain();
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const grid = $('#cgrid'), cnt = $('#ccnt'), form = $<HTMLFormElement>('#bform'), msg = $('#bmsg');
if (!FINE) $('#touch').hidden = false;
const famName: Record<string, string> = {};
document.querySelectorAll<HTMLButtonElement>('#cfams button').forEach((b) => { famName[b.dataset.f ?? ''] = b.textContent ?? ''; });
const cs = getComputedStyle(document.documentElement);
const resolve = (c?: string) => c === 'signal' || !c ? cs.getPropertyValue('--signal').trim() : c === 'bone' ? cs.getPropertyValue('--bone').trim() : c === 'rainbow' ? '#ff5ce1' : c;

function thumb(spec: CursorSpec, cv: HTMLCanvasElement) {
  const d = Math.min(2, devicePixelRatio || 1), s = 84; cv.width = cv.height = s * d; cv.style.width = cv.style.height = s + 'px';
  const g = cv.getContext('2d')!; g.scale(d, d); g.translate(s / 2, s / 2);
  const z = Math.min(spec.z, 46);
  if (spec.t && spec.t !== 'none') { g.globalAlpha = .35; for (let i = 1; i < 6; i++) { g.save(); g.translate(-i * 6, i * 3); g.globalAlpha = .35 * (1 - i / 6); drawShape(g, { ...spec, f: true, s: spec.t === 'ghost' ? spec.s : 'dot' }, Math.max(2, z * (spec.t === 'ghost' ? .8 : .25)), resolve(spec.c), 0, 0); g.restore(); } g.globalAlpha = 1; }
  drawShape(g, spec, z, resolve(spec.c), 0, 0);
}
function label(id: string) { const r = cursorById(id); return r ? r[1] : id === 'custom' ? I18N.t('cu.custom') : id === 'native' ? I18N.t('cu.system') : I18N.t('cu.lens'); }

const items = CURSORS.map(([id, name, fam, spec]) => {
  const li = document.createElement('li'); li.dataset.f = fam;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'cc'; b.dataset.id = id; b.setAttribute('aria-pressed', 'false');
  const cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true'); thumb(spec, cv);
  const n = document.createElement('span'); n.className = 'cn2'; n.textContent = name;
  const f = document.createElement('span'); f.className = 'mono cf2'; f.textContent = famName[fam] ?? fam;
  const ok = document.createElement('span'); ok.className = 'mono ok'; ok.textContent = I18N.t('th.applied');
  b.append(cv, n, f, ok);
  b.addEventListener('pointerenter', () => previewCursor(spec)); b.addEventListener('focus', () => previewCursor(spec));
  b.addEventListener('pointerleave', () => previewCursor(null)); b.addEventListener('blur', () => previewCursor(null));
  b.addEventListener('click', () => choose(id));
  li.appendChild(b); grid.appendChild(li); return li;
});
function paint() {
  $('#cn').textContent = label(studio.cursor);
  const r = cursorById(studio.cursor); $('#cf').textContent = r ? famName[r[2]] ?? r[2] : '';
  grid.querySelectorAll<HTMLButtonElement>('.cc').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === studio.cursor)));
  $('#sys').setAttribute('aria-pressed', String(studio.cursor === 'native')); $('#lens').setAttribute('aria-pressed', String(studio.cursor === 'lens'));
}
function choose(id: string) { studio.cursor = id; applyStudio(studio); saveStudio(); paint(); }
$('#sys').addEventListener('click', () => choose('native'));
$('#lens').addEventListener('click', () => choose('lens'));
$('#crnd').addEventListener('click', () => { const r = CURSORS[(Math.random() * CURSORS.length) | 0]; choose(r[0]); });

let fam = '';
function run() { let n = 0; items.forEach((li) => { li.hidden = !!fam && li.dataset.f !== fam; if (!li.hidden) n++; }); cnt.textContent = I18N.t('cu.count').replace('{n}', I18N.ng(n)).replace('{t}', I18N.ng(CURSORS.length)); }
$('#cfams').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return; fam = b.dataset.f ?? '';
  $('#cfams').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String((x as HTMLButtonElement).dataset.f === fam))); run();
});

/* builder */
function readForm(): CursorSpec {
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement);
  const cm = v('cm').value;
  return { s: v('s').value as Shape, t: v('t').value as Trail, k: v('k').value as Click, c: cm === 'custom' ? v('c').value : cm, z: +v('z').value, l: +v('l').value / 100, o: +v('o').value / 100, r: +v('r').value, f: v('f').checked, b: v('b').checked ? 'd' : 'n', w: 1.6, n: 26, h: 1.6 };
}
function fill(sp: CursorSpec) {
  const v = (n: string) => (form.elements.namedItem(n) as HTMLInputElement);
  v('s').value = sp.s; v('t').value = sp.t ?? 'none'; v('k').value = sp.k ?? 'ripple'; v('z').value = String(sp.z); v('l').value = String(Math.round((sp.l ?? .3) * 100));
  v('o').value = String(Math.round((sp.o ?? 0) * 100)); v('r').value = String(sp.r ?? 0); v('f').checked = !!sp.f; v('b').checked = sp.b === 'd';
  const c = sp.c ?? 'signal'; if (c === 'signal' || c === 'bone' || c === 'rainbow') v('cm').value = c; else { v('cm').value = 'custom'; v('c').value = c; }
}
let building = false;
form.addEventListener('submit', (e) => e.preventDefault());
form.addEventListener('input', () => { building = true; previewCursor(readForm()); msg.textContent = I18N.t('cu.build.live'); });
form.addEventListener('pointerleave', () => { if (building) previewCursor(readForm()); });
$('#bsave').addEventListener('click', () => { studio.cc = readForm(); choose('custom'); building = false; msg.textContent = I18N.t('cu.build.saved'); });
$('#bfrom').addEventListener('click', () => { const sp = presetSpec(studio); if (sp) { fill(sp); previewCursor(readForm()); msg.textContent = I18N.t('cu.build.live'); } });
if (studio.cc) fill(studio.cc);
document.querySelector('.builder')?.addEventListener('pointerleave', () => { if (building) { building = false; previewCursor(null); msg.textContent = I18N.t('cu.build.unsaved'); } });

paint(); run();
