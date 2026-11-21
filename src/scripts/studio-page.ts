/* Personal Universe Studio hub: every setting in one place, curated presets, saved universes,
   saved worlds, share codes and file import/export. Everything stays in the visitor's browser. */
import { I18N } from './i18n';
import './common';
import { studio, saveStudio, applyStudio, cursor, grain, choseMotion, DEFAULTS, sanitize, encodeStudio, decodeStudio, favs, setFav, type Studio } from './studio-core';
import { theme, TYPE } from '../data/themes';
import { cursorById } from '../data/cursors';

cursor(); grain();
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const T = (k: string) => I18N.t(k);
const ctrls = $<HTMLFormElement>('#ctrls');
const el = <T extends HTMLElement>(n: string) => ctrls.elements.namedItem(n) as unknown as T;

/* ---- curated universes ---- */
const PRESETS: { id: string; s: Partial<Studio> }[] = [
  { id: 'night-gallery', s: { theme: 'abidora-night', type: 'auto', cursor: 'lens', mood: 'natural', motion: 'full', grain: 'on' } },
  { id: 'paper-reader', s: { theme: 'sepia-folio', type: 'classic', cursor: 'native', mood: 'natural', motion: 'calm', grain: 'off', scale: 110 } },
  { id: 'neon-arcade', s: { theme: 'shinjuku', type: 'neo', cursor: 'neon-ring', mood: 'natural', motion: 'full', grain: 'on' } },
  { id: 'calm-focus', s: { theme: 'birch', type: 'soft', cursor: 'micro', mood: 'natural', motion: 'calm', grain: 'off' } },
  { id: 'deep-ocean', s: { theme: 'abyss', type: 'tech', cursor: 'bubbles', mood: 'natural', motion: 'full', grain: 'on' } },
  { id: 'desert-road', s: { theme: 'sahara-dusk', type: 'elegant', cursor: 'ember', mood: 'natural', motion: 'full', grain: 'on' } },
  { id: 'swiss-precision', s: { theme: 'helvetica-red', type: 'grotesk', cursor: 'crosshair', mood: 'natural', motion: 'full', grain: 'off' } },
  { id: 'cosmic-drift', s: { theme: 'nebula', type: 'neo', cursor: 'constellation', mood: 'natural', motion: 'full', grain: 'on' } },
];

function apply(p: Partial<Studio>, motionTouched = true) {
  const ok = sanitize(p) ?? {};
  Object.assign(studio, { ...DEFAULTS, cc: studio.cc, ...ok });
  if (motionTouched && ok.motion) choseMotion();
  applyStudio(studio); saveStudio(); paint();
}
function curName(id: string) { return id === 'lens' ? T('cu.lens') : id === 'native' ? T('cu.system') : id === 'custom' ? T('cu.custom') : id === 'dot' ? 'Dot' : cursorById(id)?.[1] ?? id; }
function paint() {
  const th = theme(studio.theme);
  $('#uct').textContent = th.name;
  $('#ucy').textContent = TYPE[studio.type === 'auto' ? th.type : studio.type]?.n ?? '';
  $('#ucc').textContent = curName(studio.cursor);
  $('#ucm').textContent = T('mood.' + studio.mood);
  $('#ucv').textContent = studio.motion === 'calm' ? T('us.calm') : T('us.full');
  $('#ucg').textContent = studio.grain === 'on' ? T('us.on') : T('us.off');
  $('#ucs').textContent = I18N.n(studio.scale) + '%';
  $('#ucf').textContent = I18N.ng(favs().length);
  $('#ucsw').innerHTML = [th.ink, th.ink2, th.bone, th.mute, th.signal].map((c) => `<i style="background:${c}"></i>`).join('');
  el<HTMLSelectElement>('theme').value = studio.theme; el<HTMLSelectElement>('type').value = studio.type;
  const cs = el<HTMLSelectElement>('cursor'); cs.value = studio.cursor; if (cs.value !== studio.cursor) cs.value = 'lens';
  (cs.querySelector('option[value=custom]') as HTMLOptionElement).disabled = !studio.cc;
  el<HTMLSelectElement>('mood').value = studio.mood;
  ctrls.querySelectorAll<HTMLInputElement>('input[name=motion]').forEach((r) => { r.checked = r.value === studio.motion; });
  ctrls.querySelectorAll<HTMLInputElement>('input[name=grain]').forEach((r) => { r.checked = r.value === studio.grain; });
  el<HTMLInputElement>('scale').value = String(studio.scale); $('#szo').textContent = I18N.n(studio.scale) + '%';
  ($('#code') as HTMLTextAreaElement).value = encodeStudio(studio);
  document.querySelectorAll<HTMLButtonElement>('#presets button').forEach((b) => { const p = PRESETS.find((x) => x.id === b.dataset.id)!.s; b.setAttribute('aria-pressed', String(Object.entries(p).every(([k, v]) => (studio as unknown as Record<string, unknown>)[k] === v))); });
  renderFavs();
}
ctrls.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement; const n = t.name; if (!n) return;
  const patch: Record<string, unknown> = { ...studio }; patch[n] = n === 'scale' ? +t.value : t.value;
  apply(patch, n === 'motion');
});
el<HTMLInputElement>('scale').addEventListener('input', (e) => { $('#szo').textContent = I18N.n(+(e.target as HTMLInputElement).value) + '%'; });

/* presets */
const pl = $('#presets');
PRESETS.forEach((p) => {
  const th = theme(p.s.theme!);
  const li = document.createElement('li'); const b = document.createElement('button'); b.type = 'button'; b.className = 'pz'; b.dataset.id = p.id;
  b.style.cssText = `--c-ink:${th.ink};--c-bone:${th.bone};--c-mute:${th.mute};--c-signal:${th.signal};--c-line:${th.line}`;
  b.innerHTML = '<span class="pn"></span><span class="pd"></span><span class="pm mono"></span>';
  (b.querySelector('.pn') as HTMLElement).textContent = T('us.p.' + p.id);
  (b.querySelector('.pd') as HTMLElement).textContent = T('us.p.' + p.id + '.d');
  (b.querySelector('.pm') as HTMLElement).textContent = `${th.name} · ${curName(p.s.cursor!)}`;
  b.addEventListener('click', () => apply({ ...p.s }));
  li.appendChild(b); pl.appendChild(li);
});

/* my universes */
type Saved = { n: string; s: string; at: number };
const KEY = 'abidora.universes';
const mine = (): Saved[] => { try { const a = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(a) ? a.filter((x) => x && typeof x.n === 'string' && typeof x.s === 'string').slice(0, 12) : []; } catch { return []; } };
const store = (a: Saved[]) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 12))); return true; } catch { return false; } };
function renderMine() {
  const ul = $('#mine'); ul.innerHTML = ''; const a = mine();
  if (!a.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = T('us.mine.empty'); ul.appendChild(li); return; }
  a.forEach((x, i) => {
    const s = decodeStudio(x.s); if (!s) return; const th = theme(s.theme ?? DEFAULTS.theme);
    const li = document.createElement('li');
    li.innerHTML = `<span class="sw mini" aria-hidden="true">${[th.ink, th.bone, th.signal].map((c) => `<i style="background:${c}"></i>`).join('')}</span><span class="mn"></span><span class="mono md"></span><button type="button" class="pill2 mono ap"></button><button type="button" class="pill2 mono rm"></button>`;
    (li.querySelector('.mn') as HTMLElement).textContent = x.n;
    (li.querySelector('.md') as HTMLElement).textContent = `${th.name} · ${new Date(x.at).toLocaleDateString(I18N.loc)}`;
    const ap = li.querySelector('.ap') as HTMLButtonElement, rm = li.querySelector('.rm') as HTMLButtonElement;
    ap.textContent = T('us.mine.apply'); rm.textContent = T('us.mine.delete'); rm.setAttribute('aria-label', `${T('us.mine.delete')}: ${x.n}`);
    ap.addEventListener('click', () => { apply(s); $('#mymsg').textContent = T('us.mine.applied').replace('{n}', x.n); });
    rm.addEventListener('click', () => { const b = mine(); b.splice(i, 1); store(b); renderMine(); $('#mymsg').textContent = T('us.mine.deleted'); });
    ul.appendChild(li);
  });
}
$('#saveu').addEventListener('submit', (e) => {
  e.preventDefault(); const inp = $<HTMLInputElement>('#uname'); const n = inp.value.trim().slice(0, 40) || theme(studio.theme).name;
  const a = mine(); if (a.length >= 12) { $('#mymsg').textContent = T('us.mine.full'); return; }
  a.unshift({ n, s: encodeStudio(studio), at: Date.now() }); $('#mymsg').textContent = store(a) ? T('us.mine.saved').replace('{n}', n) : T('us.err.storage'); inp.value = ''; renderMine();
});

/* saved worlds */
function renderFavs() {
  const ul = $('#favs'); ul.innerHTML = ''; const f = favs();
  if (!f.length) { const li = document.createElement('li'); li.className = 'empty'; li.innerHTML = T('us.favs.empty').replace('{a}', `<a href="${I18N.url('worlds')}">`).replace('{/a}', '</a>'); ul.appendChild(li); return; }
  f.forEach((id) => {
    const li = document.createElement('li'); const a = document.createElement('a'); a.href = worldUrl(id);
    a.innerHTML = `<span class="mono">${String(id).padStart(3, '0')}</span><span></span>`; (a.lastChild as HTMLElement).textContent = T('x.' + id);
    const rm = document.createElement('button'); rm.type = 'button'; rm.className = 'pill2 mono'; rm.textContent = T('us.mine.delete'); rm.addEventListener('click', () => { setFav(id, false); paint(); });
    li.append(a, rm); ul.appendChild(li);
  });
}
function worldUrl(id: number) { const w = I18N.url('world'); return w && w !== I18N.root ? `${w}?w=${id}` : I18N.url('worlds'); }

/* share codes, links and files */
const shmsg = $('#shmsg');
async function copy(text: string, ok: string) { try { await navigator.clipboard.writeText(text); shmsg.textContent = ok; } catch { ($('#code') as HTMLTextAreaElement).select(); shmsg.textContent = T('us.share.manual'); } }
$('#copy').addEventListener('click', () => copy(encodeStudio(studio), T('us.share.copied')));
$('#copyl').addEventListener('click', () => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('u', encodeStudio(studio)); copy(u.toString(), T('us.share.linkok')); });
$('#dl').addEventListener('click', () => {
  const data = { app: 'abidora', kind: 'universe', version: 1, settings: JSON.parse(JSON.stringify(sanitize(studio))), universes: mine(), favs: favs() };
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' })); a.download = 'my-abidora-universe.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  shmsg.textContent = T('us.share.dlok');
});
$('#impb').addEventListener('click', () => { const s = decodeStudio(($('#imp') as HTMLTextAreaElement).value); if (s?.theme) { apply(s); shmsg.textContent = T('us.import.ok'); } else shmsg.textContent = T('us.import.bad'); });
$<HTMLInputElement>('#impf').addEventListener('change', async (e) => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
  if (f.size > 200_000) { shmsg.textContent = T('us.import.bad'); return; }
  try {
    const d = JSON.parse(await f.text()); const s = sanitize(d?.settings);
    if (!s?.theme) throw new Error('bad');
    if (Array.isArray(d.universes)) store([...d.universes.filter((x: Saved) => x && typeof x.n === 'string' && typeof x.s === 'string' && decodeStudio(x.s)).map((x: Saved) => ({ n: x.n.slice(0, 40), s: x.s, at: Number(x.at) || Date.now() })), ...mine()]);
    if (Array.isArray(d.favs)) d.favs.slice(0, 200).reverse().forEach((n: unknown) => { if (Number.isInteger(n) && (n as number) > 0 && (n as number) < 1000) setFav(n as number, true); });
    apply(s); renderMine(); shmsg.textContent = T('us.import.ok');
  } catch { shmsg.textContent = T('us.import.bad'); }
  (e.target as HTMLInputElement).value = '';
});
/* a shared link: ask before changing anything */
const shared = new URLSearchParams(location.search).get('u');
if (shared) {
  const s = decodeStudio(shared);
  if (s?.theme) {
    $('#shared').hidden = false; $('#sharedd').textContent = `${theme(s.theme ?? studio.theme).name} · ${curName(s.cursor ?? studio.cursor)}`;
    $('#shy').addEventListener('click', () => { apply(s); $('#shared').hidden = true; history.replaceState(null, '', location.pathname); });
    $('#shn').addEventListener('click', () => { $('#shared').hidden = true; history.replaceState(null, '', location.pathname); });
  }
}
$('#rsall').addEventListener('click', () => {
  if (!confirm(T('us.reset.confirm'))) return;
  try { ['abidora.studio', KEY, 'abidora.favs'].forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ }
  delete studio.cc; Object.assign(studio, DEFAULTS); applyStudio(studio); renderMine(); paint(); shmsg.textContent = T('us.reset.done');
});
addEventListener('storage', (e) => { if (e.key === 'abidora.favs' || e.key === KEY) { renderMine(); paint(); } });
renderMine(); paint();
