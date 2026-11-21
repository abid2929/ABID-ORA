/* Theme Studio: browse, filter and apply 104 themes. The choice is saved in the visitor's browser
   (Studio settings) and every page of the site applies it on load. */
import { I18N } from './i18n';
import './common';
import { studio, saveStudio, applyStudio, cursor, grain, DEFAULTS } from './studio-core';
import { THEMES, FAMILIES, TYPE, theme } from '../data/themes';

cursor(); grain();
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const grid = $('#grid'), q = $<HTMLInputElement>('#q'), cnt = $('#cnt'), none = $('#none'), tp = $<HTMLSelectElement>('#tp');
const famName: Record<string, string> = {};
document.querySelectorAll<HTMLButtonElement>('#fams button').forEach((b) => { famName[b.dataset.f ?? ''] = b.textContent ?? ''; });
let fam = '', tone = '';

/* cards */
const cards = THEMES.map((r) => {
  const th = theme(r[0]);
  const li = document.createElement('li');
  li.dataset.f = th.family; li.dataset.t = th.light ? 'l' : 'd'; li.dataset.k = (th.name + ' ' + th.id + ' ' + (famName[th.family] ?? '') + ' ' + FAMILIES.find((f) => f[0] === th.family)?.[1]).toLowerCase();
  const b = document.createElement('button'); b.type = 'button'; b.className = 'tc'; b.dataset.id = th.id;
  b.style.cssText = `--c-ink:${th.ink};--c-ink2:${th.ink2};--c-bone:${th.bone};--c-mute:${th.mute};--c-signal:${th.signal};--c-line:${th.line}`;
  b.setAttribute('aria-pressed', 'false');
  b.innerHTML = `<span class="tn"></span><span class="tf"></span><span class="bar3" aria-hidden="true"><i style="background:${th.ink2}"></i><i style="background:${th.bone}"></i><i style="background:${th.mute}"></i><i style="background:${th.signal}"></i></span><span class="lines" aria-hidden="true"><i></i><i></i><i></i></span><span class="ft"><span class="dot" aria-hidden="true"></span><span class="ok">${I18N.t('th.applied')}</span></span>`;
  (b.querySelector('.tn') as HTMLElement).textContent = th.name;
  (b.querySelector('.tf') as HTMLElement).textContent = `${famName[th.family] ?? th.family} · ${th.light ? I18N.t('th.light') : I18N.t('th.dark')} · ${TYPE[th.type].n}`;
  b.addEventListener('click', () => pick(th.id));
  li.appendChild(b); grid.appendChild(li); return li;
});

function paintSpec() {
  const th = theme(studio.theme);
  $('#sn').textContent = th.name;
  $('#sf').textContent = `${famName[th.family] ?? th.family} · ${th.light ? I18N.t('th.light') : I18N.t('th.dark')}`;
  $('#sw').innerHTML = [th.ink, th.ink2, th.bone, th.mute, th.signal].map((c) => `<i style="background:${c}" title="${c}"></i>`).join('');
  $('#stp').textContent = TYPE[studio.type === 'auto' ? th.type : studio.type]?.n ?? '';
  grid.querySelectorAll<HTMLButtonElement>('.tc').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === th.id)));
}
function pick(id: string) { studio.theme = id; applyStudio(studio); saveStudio(); paintSpec(); }

function run() {
  const term = q.value.trim().toLowerCase(); let n = 0;
  cards.forEach((li) => { const ok = (!fam || li.dataset.f === fam) && (!tone || li.dataset.t === tone) && (!term || (li.dataset.k ?? '').includes(term)); li.hidden = !ok; if (ok) n++; });
  none.hidden = n > 0;
  cnt.textContent = I18N.t('th.count').replace('{n}', I18N.ng(n)).replace('{t}', I18N.ng(THEMES.length));
}
function chips(sel: string, attr: string, set: (v: string) => void) {
  const g = $(sel);
  g.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!b) return;
    const v = b.dataset[attr] ?? ''; set(v);
    g.querySelectorAll<HTMLButtonElement>('button').forEach((x) => x.setAttribute('aria-pressed', String((x.dataset[attr] ?? '') === v))); run();
  });
}
chips('#fams', 'f', (v) => { fam = v; }); chips('#tones', 't', (v) => { tone = v; });
q.addEventListener('input', run);
tp.value = studio.type in TYPE ? studio.type : 'auto';
tp.addEventListener('change', () => { studio.type = tp.value; applyStudio(studio); saveStudio(); paintSpec(); });
$('#rnd').addEventListener('click', () => {
  const vis = cards.filter((li) => !li.hidden); const pool = vis.length ? vis : cards;
  let li = pool[(Math.random() * pool.length) | 0]; if (pool.length > 1) while (li.querySelector('.tc')?.getAttribute('aria-pressed') === 'true') li = pool[(Math.random() * pool.length) | 0];
  const id = (li.querySelector('.tc') as HTMLElement).dataset.id ?? ''; pick(id);
  li.querySelector<HTMLElement>('.tc')?.focus({ preventScroll: true }); li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
$('#rst').addEventListener('click', () => { studio.type = DEFAULTS.type; tp.value = 'auto'; pick(DEFAULTS.theme); });
/* arrow keys move between cards */
grid.addEventListener('keydown', (e) => {
  const k = e.key; if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(k)) return;
  const vis = Array.from(grid.querySelectorAll<HTMLButtonElement>('li:not([hidden]) .tc')); const i = vis.indexOf(document.activeElement as HTMLButtonElement); if (i < 0) return;
  const cols = Math.max(1, Math.round(grid.clientWidth / (vis[0].parentElement!.clientWidth + 14)));
  const d = (k === 'ArrowRight' ? 1 : k === 'ArrowLeft' ? -1 : k === 'ArrowDown' ? cols : -cols) * (I18N.rtl && (k === 'ArrowRight' || k === 'ArrowLeft') ? -1 : 1);
  const j = Math.max(0, Math.min(vis.length - 1, i + d)); vis[j].focus(); e.preventDefault();
});
paintSpec(); run();
