/* World page: one shell for every world, chosen by ?w=<id>. Each world is its own module
   (src/worlds/wNNN.ts), loaded on demand so a visitor downloads only the world they open. */
import { I18N } from './i18n';
import './common';
import { music } from './music';
import { P30 } from '../data/worlds30';
import { cursor, grain, calm, favs, setFav } from './studio-core';
import catalog from '../../public/_abidora/data/experiences.json';
import type { Ctx } from '../worlds/kit';

cursor(); grain();
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.getElementById(s) as T;
const T = (k: string) => I18N.t(k);
const mods = import.meta.glob<{ default: (c: Ctx) => void | (() => void) }>('../worlds/w[0-9][0-9][0-9].ts');
const built = new Map<number, () => Promise<{ default: (c: Ctx) => void | (() => void) }>>();
for (const [p, f] of Object.entries(mods)) { const m = /w(\d{3})\.ts$/.exec(p); if (m) built.set(+m[1], f); }
const ids = [...built.keys()].sort((a, b) => a - b);
const items = (catalog as { items: { id: number; cat: string }[] }).items;

const raw = new URLSearchParams(location.search).get('w') ?? '';
const id = /^\d{1,3}$/.test(raw) ? +raw : 0;
// Background music on 3D worlds; worlds with their own sound (games, bird song, heart, Chladni, rain) stay quiet.
if (id === 1) document.getElementById('main')?.classList.add('wfz');   // Fashion World: the 3D studio comes first, no mood photo
if (built.has(id) && ![11, 31, 36, 41, 43, 53, 82, 99, 113].includes(id)) music();
/* 0.9.6: the fashion worlds are one world now (owner: "do each thing once"); old links open the right tab */
const FASHION_MOVED: Record<number, string> = { 2: 'clothes', 3: 'shoes', 4: 'watches', 5: 'watches', 6: 'bags', 7: 'clothes', 8: 'clothes', 9: 'clothes', 10: 'clothes' };
if (FASHION_MOVED[id]) location.replace(location.pathname + '?w=1#' + FASHION_MOVED[id]);
const item = items.find((x) => x.id === id);
const stage = $('wstage'), load = $('wload'), err = $('werr');
const name = item ? T('x.' + id) : '';
const url = (n: number) => `${I18N.url('world')}?w=${n}`;

/* every world shares one HTML file, so the canonical and language links (with ?w=N) are added here;
   a missing or planned world is kept out of search results */
function seo(ok: boolean) {
  const add = (attrs: Record<string, string>, tag = 'link') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); document.head.appendChild(e); };
  if (!ok) { add({ name: 'robots', content: 'noindex' }, 'meta'); return; }
  if (document.querySelector('link[rel=canonical]')) return;      // already written on the server (world-page.php)
  const boot = (window as unknown as { I18N_BOOT: { lang: string; alts: Record<string, string>; hl?: Record<string, string> } }).I18N_BOOT;
  const abs = (u: string) => { const x = new URL(u, location.href); x.search = '?w=' + id; x.hash = ''; return x.toString(); };
  const me = abs(location.pathname);
  add({ rel: 'canonical', href: me }); add({ property: 'og:url', content: me }, 'meta');
  for (const l in boot.alts) add({ rel: 'alternate', hreflang: boot.hl?.[l] ?? l, href: abs(boot.alts[l]) });
  if (boot.alts.en) add({ rel: 'alternate', hreflang: 'x-default', href: abs(boot.alts.en) });
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title);
}

/* the stage stays invisible until the header text is in place, so filling the title and description does not push it down (layout shift) */
const ready = () => document.querySelector('main.wo')?.classList.add('ready');
function fail(msg: string) { load.remove(); stage.hidden = true; err.hidden = false; err.innerHTML = msg; stage.setAttribute('aria-busy', 'false'); }

if (!item) {
  seo(false);
  $('wname').textContent = T('wo.nf.h');
  fail(T('wo.nf.t').replace('{a}', `<a href="${I18N.url('worlds')}">`).replace('{/a}', '</a>'));
  ready();
} else {
  $('wname').textContent = name;
  $('wnum').textContent = I18N.n(id, 3);
  $('wcat').textContent = T('cat.' + item.cat);
  $('wdesc').textContent = built.has(id) ? T('wd.' + id) : '';
  document.title = `${name} · ${I18N.brand}`;
  const md = document.querySelector('meta[name=description]'); if (md && built.has(id)) md.setAttribute('content', T('wd.' + id));
  seo(built.has(id));
  if (!built.has(id)) {
    fail(T('wo.planned').replace('{n}', name).replace('{a}', `<a href="${I18N.url('worlds')}">`).replace('{/a}', '</a>')); ready();
  } else {
    $('whow').textContent = T('wh.' + id);
    /* the fashion worlds (001-010) open as showrooms: a real photograph beside the title, each world in its own accent.
       Photos: Unsplash License, logo-free, credited on the photo and on the Credits page. */
    const SHOW: Record<number, [string, string, string]> = {
      1: ['fabric-rolls', '#e07a4f', 'Felicia Varzari'], 2: ['boutique', '#cfa86c', 'Clark Street Mercantile'],
      3: ['sneakers-white', '#9fc3e8', 'Stephen Murphy'], 4: ['', '#d7a54a', ''],   /* owner, 21 Nov: no photo on the watch page, the live watch is the picture */
      5: ['ring-box', '#e9c873', 'sina rezakhani'], 6: ['leather-bag', '#c8834a', 'personalgraphic.com'],
      7: ['hoodie', '#e0503f', 'Nicolas Chonville'], 8: ['swatches', '#ef7a4a', 'Jonathan Borba'],
      9: ['silk-metal', '#9cb0f0', 'Am'], 10: ['vintage-shop', '#d2b08e', 'Judy Beth Morris'],
    };
    const sh = SHOW[id];
    if (sh) {
      const main = document.querySelector<HTMLElement>('main.wo')!, base = `${I18N.root}assets/show/${sh[0]}`;
      main.classList.add('wshow'); main.style.setProperty('--acc', sh[1]);
      $('wcat').textContent = T('cat.' + item.cat) + ' · ' + T('wo.show');
      if (sh[0]) {
      const fig = document.createElement('figure'); fig.className = 'wfig';
      const im = document.createElement('img'); im.alt = ''; im.decoding = 'async'; im.setAttribute('fetchpriority', 'high');
      im.src = base + '-s.jpg'; im.srcset = `${base}-s.jpg 900w, ${base}.jpg 1800w`; im.sizes = '(max-width: 900px) 100vw, 44vw';
      im.onload = () => fig.classList.add('in');
      const cap = document.createElement('figcaption'); cap.className = 'mono'; cap.textContent = T('wo.photo').replace('{by}', sh[2]);
      fig.append(im, cap); document.querySelector('.woh')!.append(fig);
      }
    }
    /* remember the visit on this device only, for the universe map on the homepage */
    try { const v = new Set<number>(JSON.parse(localStorage.getItem('ab.visited') || '[]')); v.add(id); localStorage.setItem('ab.visited', JSON.stringify([...v].slice(-200))); } catch { /* private mode */ }
    /* favourite */
    const fb = $('wfav'); fb.hidden = false;
    const pf = () => { const on = favs().includes(id); fb.setAttribute('aria-pressed', String(on)); fb.querySelector('.hrt')!.textContent = on ? '♥' : '♡'; $('wfavt').textContent = T(on ? 'wo.faved' : 'wo.fav'); };
    fb.addEventListener('click', () => { setFav(id, !favs().includes(id)); pf(); }); pf();
    /* full screen */
    const fs = $('wfull');
    if (document.fullscreenEnabled) {
      fs.hidden = false;
      fs.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else stage.requestFullscreen().catch(() => {}); });
      document.addEventListener('fullscreenchange', () => { $('wfullt').textContent = T(document.fullscreenElement ? 'wo.exitfull' : 'wo.full'); });
    }
    /* world bar (Wave A, I-5): how-to, share, reset. Each button only appears when it can really work. */
    const hb = $('whelp'), how = $('whow'); hb.hidden = false;
    const phone = matchMedia('(max-width: 700px)');
    const setHow = (open: boolean) => { hb.setAttribute('aria-expanded', String(open)); how.classList.toggle('open', open); };
    setHow(!phone.matches); phone.addEventListener('change', () => setHow(!phone.matches));
    hb.addEventListener('click', () => { const open = hb.getAttribute('aria-expanded') !== 'true'; setHow(open); if (open && phone.matches) how.scrollIntoView({ block: 'nearest', behavior: calm() ? 'auto' : 'smooth' }); });
    const sb = $('wshare'), st = $('wsharet');
    if (navigator.share || navigator.clipboard) {
      sb.hidden = false;
      sb.addEventListener('click', async () => {
        const link = location.href.split('#')[0];
        try {
          if (navigator.share) { await navigator.share({ title: document.title, url: link }); return; }
          await navigator.clipboard.writeText(link); st.textContent = T('wb.copied'); setTimeout(() => { st.textContent = T('wb.share'); }, 2200);
        } catch { /* the visitor closed the share sheet */ }
      });
    }
    const pre = `abidora.w${id}.`, mine = () => { const k: string[] = []; try { for (let j = 0; j < localStorage.length; j++) { const n = localStorage.key(j); if (n && n.startsWith(pre)) k.push(n); } } catch { /* private mode */ } return k; };
    const rb = $('wreset'); const showReset = () => { rb.hidden = !mine().length; };
    showReset(); addEventListener('storage', showReset); setInterval(showReset, 4000);
    rb.addEventListener('click', () => { if (!confirm(T('wb.resetq').replace('{n}', name))) return; mine().forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); location.reload(); });
    /* previous / next among the worlds that are built */
    /* the main worlds step through each other in home-page order; other worlds step through the rest (worlds 2-10 now open Fashion World, so they are skipped) */
    const MAIN = [...new Set(P30.map((w) => w.w).filter((w): w is number => typeof w === 'number' && w > 0))].filter((w) => ids.includes(w));
    const seq = MAIN.includes(id) ? MAIN : ids.filter((w) => !MAIN.includes(w) && !(w >= 2 && w <= 10));
    const list = seq.includes(id) ? seq : ids;
    const i = list.indexOf(id), prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
    if (list.length > 1) {
      $('wnav').hidden = false;
      const pa = $<HTMLAnchorElement>('wprev'), na = $<HTMLAnchorElement>('wnext');
      pa.href = url(prev); pa.querySelector('b')!.textContent = T('x.' + prev);
      na.href = url(next); na.querySelector('b')!.textContent = T('x.' + next);
      const p2 = $<HTMLAnchorElement>('wprev2'), n2 = $<HTMLAnchorElement>('wnext2');
      p2.href = url(prev); p2.title = T('x.' + prev); p2.hidden = false;
      n2.href = url(next); n2.title = T('x.' + next); n2.hidden = false;
    }
    { const bk = $<HTMLAnchorElement>('wback');
      let same = false; try { same = !!document.referrer && new URL(document.referrer).origin === location.origin && !/[?&]w=/.test(new URL(document.referrer).search); } catch { /* no referrer */ }
      for (const b of [bk, $<HTMLAnchorElement>('wback2')]) b.addEventListener('click', (e) => { if (same && history.length > 1) { e.preventDefault(); history.back(); } }); }
    ready();
    /* mount the world */
    const disposers: (() => void)[] = [];
    const ctx: Ctx = {
      id, root: stage, calm: calm(), lang: I18N.lang, rtl: I18N.rtl,
      t: (k, en) => { const v = I18N.t(`wi.${id}.${k}`); return v === `wi.${id}.${k}` ? en : v; },
      onDispose: (f) => disposers.push(f),
    };
    built.get(id)!().then((m) => {
      load.remove(); stage.setAttribute('aria-busy', 'false');
      const d = m.default(ctx); if (typeof d === 'function') disposers.push(d);
    }).catch((e) => { console.error(e); fail(T('wo.err')); });
    addEventListener('pagehide', () => disposers.forEach((f) => { try { f(); } catch { /* ignore */ } }));
  }
}
