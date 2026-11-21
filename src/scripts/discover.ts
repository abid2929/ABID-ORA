/* Homepage discovery strip (Wave A, I-7): world of the day, "Guide me" by mood, and "Surprise me".
   Everything is worked out in the browser from the world list the server rendered, plus the visitor's own
   visited list in localStorage. Nothing is sent anywhere. */
import { I18N } from './i18n';
import { visitedSet } from './universe';

const T = I18N.t;
type W = { id: number; name: string; href: string; cat: string; catName: string; color: string };

/* moods → worlds. A world can sit in more than one mood. Ids that are not live yet are ignored, so planned
   worlds can be listed here ahead of time and appear on their own once they open. */
const MOODS: Record<string, number[]> = {
  make: [1, 2, 3, 4, 6, 7, 8, 19, 20, 21, 23, 24, 25, 27, 45, 47, 48, 49, 51, 52, 59, 61],
  learn: [9, 11, 12, 15, 16, 17, 22, 28, 33, 35, 38, 40, 42, 43, 44, 46, 50, 55, 57, 58, 60, 62, 63, 64],
  play: [3, 5, 9, 13, 17, 27, 30, 31, 37, 41, 53, 54, 56, 59, 64],
  earth: [12, 14, 18, 29, 32, 34, 36, 39, 65, 66, 67, 68, 69, 70, 71],
  look: [5, 10, 26, 29, 31, 33, 34, 37, 39, 45, 47, 53, 54, 74],
};

/* small seeded shuffle so "three more" walks through a mood without repeats */
function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; }; }
function shuffle<X>(a: X[], r: () => number) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

export function dayIndex(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }

export function initDiscover() {
  const sec = document.getElementById('discover'); const list = document.querySelector<HTMLElement>('.uv-list'); if (!sec || !list) return;
  const worlds: W[] = [];
  list.querySelectorAll<HTMLElement>('section[data-c]').forEach((s) => {
    const catName = (s.querySelector('h3')?.firstChild?.textContent || '').trim();
    s.querySelectorAll<HTMLLIElement>('li[data-s="live"]').forEach((li) => { const a = li.querySelector('a'); if (a) worlds.push({ id: +li.dataset.id!, name: (a.textContent || '').trim(), href: a.getAttribute('href') || '', cat: s.dataset.c!, catName, color: s.dataset.col || '#e8b46a' }); });
  });
  if (!worlds.length) return;
  const byId = new Map(worlds.map((w) => [w.id, w]));
  const seen = visitedSet();
  const $ = <E extends HTMLElement>(s: string) => sec.querySelector<E>(s)!;

  const h = (tag: string, cls = '', txt = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt) e.textContent = txt; return e; };
  function card(w: W, big = false) {
    const a = h('a', 'dsc-w' + (big ? ' dsc-big' : '')) as HTMLAnchorElement; a.href = w.href; a.style.setProperty('--cc', w.color);
    const top = h('span', 'mono dsc-meta'); top.append(h('b', '', I18N.n(w.id, 3)), document.createTextNode(' · ' + w.catName));
    if (seen.has(w.id)) top.append(h('i', 'dsc-seen', T('dsc.seen')));
    a.append(top, h('strong', '', w.name));
    if (big) { const d = T('wd.' + w.id); if (d && d !== 'wd.' + w.id) a.append(h('p', '', d)); }
    a.append(h('span', 'mono dsc-go', T('dsc.enter') + (I18N.rtl ? ' ←' : ' →')));
    return a;
  }

  /* world of the day: same for everyone on the same date, walks the open worlds in a fixed shuffled order */
  const order = shuffle(worlds, rng(112071));
  const today = order[dayIndex() % order.length];
  $('.dsc-today').replaceChildren(card(today, true));

  /* guide me */
  const out = $('.dsc-picks'); let mood = '', page = 0, pool: W[] = [];
  const more = $<HTMLButtonElement>('.dsc-more');
  function showPicks() {
    const start = (page * 3) % Math.max(1, pool.length), pick = [0, 1, 2].map((k) => pool[(start + k) % pool.length]).filter((w, i, a) => w && a.indexOf(w) === i);
    const ul = h('ul', 'dsc-pl'); pick.forEach((w) => { const li = h('li'); li.append(card(w)); ul.append(li); });
    out.replaceChildren(h('p', 'mono dsc-sub', T('dsc.picks')), ul); out.hidden = false; more.hidden = pool.length <= 3;
  }
  sec.querySelectorAll<HTMLButtonElement>('.dsc-mood').forEach((b) => b.addEventListener('click', () => {
    mood = b.dataset.m!; page = 0;
    sec.querySelectorAll('.dsc-mood').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const ids = (MOODS[mood] || []).filter((id) => byId.has(id));
    /* unvisited first, each group in a fresh order */
    const r = rng(Date.now()); const un = shuffle(ids.filter((id) => !seen.has(id)), r), vis = shuffle(ids.filter((id) => seen.has(id)), r);
    pool = [...un, ...vis].map((id) => byId.get(id)!); showPicks();
  }));
  more.addEventListener('click', () => { page++; showPicks(); (out.querySelector('a') as HTMLElement | null)?.focus(); });

  /* surprise me: an unopened world at random; if all are opened, any world */
  const sOut = $('.dsc-sout'); const sBtn = $<HTMLButtonElement>('.dsc-sbtn'); let lastS = -1;
  sBtn.addEventListener('click', () => {
    /* never repeats in this visit until every candidate has been shown once */
    let shown: number[] = []; try { shown = JSON.parse(sessionStorage.getItem('ab.surp') || '[]'); } catch { /* private mode */ }
    let base = worlds.filter((w) => !seen.has(w.id)); const all = !base.length; if (all) base = worlds;
    let cand = base.filter((w) => !shown.includes(w.id) && w.id !== lastS);
    if (!cand.length) { shown = []; cand = base.filter((w) => w.id !== lastS); if (!cand.length) cand = base; }
    const w = cand[Math.floor(Math.random() * cand.length)]; lastS = w.id;
    shown.push(w.id); try { sessionStorage.setItem('ab.surp', JSON.stringify(shown.slice(-200))); } catch { /* private mode */ }
    sOut.replaceChildren(...(all ? [h('p', 'dsc-sub', T('dsc.allseen'))] : []), card(w, true)); sOut.hidden = false;
    sBtn.textContent = T('dsc.another');
  });

  /* how far the visitor has come */
  const n = worlds.filter((w) => seen.has(w.id)).length, p = $('.dsc-prog');
  p.textContent = T('dsc.progress').replace('{n}', I18N.ng(n)).replace('{t}', I18N.ng(worlds.length));
  p.style.setProperty('--p', String(n / worlds.length));
  sec.hidden = false; /* only shown once it works */
}
