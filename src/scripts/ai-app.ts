/* Abidora AI as an app: installing, working offline, Data Saver, and deleting everything from this device.
   The service worker (public/sw.js) keeps a copy of this page so it opens without internet. Chats are never sent
   anywhere by this file: they stay in this browser (localStorage + IndexedDB) as before. */
import { I18N } from './i18n';

const T = I18N.t;
const $ = <E extends HTMLElement>(id: string) => document.getElementById(id) as E | null;
const ROOT = new URL(I18N.root || './', location.href);
const LK = 'abidora.ai.lite';
const conn = (navigator as any).connection as { saveData?: boolean } | undefined;

/* ---------- Data Saver ---------- */
let lite = (() => { try { const v = localStorage.getItem(LK); if (v !== null) return v === '1'; } catch { /* blocked */ } return !!conn?.saveData; })();
const liteFns: ((on: boolean) => void)[] = [];
function applyLite() {
  document.documentElement.classList.toggle('lite', lite);
  const box = $<HTMLInputElement>('ailite'); if (box) box.checked = lite;
  const pill = $('ailitep'); if (pill) pill.hidden = !lite;
  navigator.serviceWorker?.controller?.postMessage({ t: 'lite', on: lite });
  liteFns.forEach((f) => f(lite));
}

/* ---------- connection ---------- */
let down = false;   // the last request failed for network reasons, even if the browser still says "online"
const netFns: (() => void)[] = [];
addEventListener('online', () => { down = false; netFns.forEach((f) => f()); });
addEventListener('offline', () => netFns.forEach((f) => f()));

export const app = {
  lite: () => lite,
  onLite(f: (on: boolean) => void) { liteFns.push(f); },
  setLite(on: boolean) { lite = on; try { localStorage.setItem(LK, on ? '1' : '0'); } catch { /* blocked */ } applyLite(); },
  online: () => navigator.onLine && !down,
  markDown() { if (!down) { down = true; netFns.forEach((f) => f()); } },
  markUp() { if (down) { down = false; netFns.forEach((f) => f()); } },
  onNet(f: () => void) { netFns.push(f); },
  /** the bar above the chat: offline, waiting messages, sending */
  status(pend: number, syncing: boolean) {
    const el = $('aioff'); if (!el) return;
    const off = !app.online();
    el.hidden = !off && !syncing;
    el.classList.toggle('sync', !off && syncing);
    if (off) el.textContent = T('ai.off') + (pend ? ' ' + T('ai.off.n').split('{n}').join(I18N.n ? I18N.n(pend) : String(pend)) : '');
    else if (syncing) el.textContent = T('ai.sync').split('{n}').join(I18N.n ? I18N.n(pend) : String(pend));
  },
};

/* ---------- service worker: offline copy of this page ---------- */
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register(new URL('sw.js', ROOT).href, { scope: ROOT.href, updateViaCache: 'none' }).then(async (reg) => {
    await navigator.serviceWorker.ready;
    const send = () => {
      const w = reg.active; if (!w) return;
      const urls = new Set<string>();
      performance.getEntriesByType('resource').forEach((e) => urls.add(e.name));
      document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel=stylesheet][href],link[rel=modulepreload][href],link[rel=preload][as=style][href]')
        .forEach((x) => urls.add((x as HTMLScriptElement).src || (x as HTMLLinkElement).href));
      w.postMessage({ t: 'lite', on: lite });
      w.postMessage({ t: 'save', page: location.href, urls: [...urls] });
    };
    if (document.readyState === 'complete') setTimeout(send, 1500); else addEventListener('load', () => setTimeout(send, 1500));
    /* a new worker took over while this page was open: offer a reload instead of mixing versions */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had) return;
      const u = $('aiupd'); if (u) u.hidden = false;
    });
    setInterval(() => { if (app.online() && !lite) void reg.update().catch(() => {}); }, 3600e3);
  }).catch(() => { /* not allowed here (private window, old browser): the page still works online */ });
}
$('aiupdb')?.addEventListener('click', () => location.reload());
if (standalone()) void navigator.storage?.persist?.().catch(() => false);   // an installed app asks the browser not to clear its chats

/* ---------- install ---------- */
let deferred: any = null;
const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function renderInstall() {
  const b = $<HTMLButtonElement>('aiinst'), iosP = $('aiios'), menu = $('aimenuh'), done = $('aiinsted'), p = $('aiinstp');
  if (!b || !iosP || !menu || !done || !p) return;
  const inst = standalone();
  done.hidden = !inst; p.hidden = inst;
  b.hidden = inst || !deferred;
  iosP.hidden = inst || !!deferred || !ios;
  menu.hidden = inst || !!deferred || ios;
}
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; renderInstall(); });
addEventListener('appinstalled', () => { deferred = null; renderInstall(); void navigator.storage?.persist?.().catch(() => false); });
$('aiinst')?.addEventListener('click', async () => {
  if (!deferred) return;
  const d = deferred; deferred = null;
  try { await d.prompt(); await d.userChoice; } catch { /* closed */ }
  renderInstall();
});

/* ---------- what is stored here, and deleting it ---------- */
async function renderUse(chatCount: () => number) {
  const el = $('aiuse'); if (!el) return;
  let pics = 0;
  try {
    pics = await new Promise<number>((ok) => {
      const r = indexedDB.open('abidora-ai', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('img');
      r.onsuccess = () => { try { const q = r.result.transaction('img').objectStore('img').count(); q.onsuccess = () => { ok(q.result); r.result.close(); }; q.onerror = () => ok(0); } catch { ok(0); } };
      r.onerror = () => ok(0);
    });
  } catch { pics = 0; }
  let mb = 0; try { const e = await navigator.storage?.estimate?.(); mb = e?.usage ? e.usage / 1048576 : 0; } catch { /* unknown */ }
  const n = (x: number) => (I18N.n ? I18N.n(x) : String(x));
  el.textContent = T('ai.app.store').split('{c}').join(n(chatCount())).split('{p}').join(n(pics)).split('{mb}').join(mb ? (mb < 1 ? '<1' : n(Math.round(mb))) : '0');
}
async function wipe() {
  if (!confirm(T('ai.app.wipeq'))) return;
  try { Object.keys(localStorage).filter((k) => k.startsWith('abidora.ai.')).forEach((k) => localStorage.removeItem(k)); } catch { /* blocked */ }
  try { sessionStorage.removeItem('abidora.ai.draft'); } catch { /* blocked */ }
  await new Promise<void>((ok) => { try { const r = indexedDB.deleteDatabase('abidora-ai'); r.onsuccess = r.onerror = r.onblocked = () => ok(); } catch { ok(); } });
  try { for (const k of await caches.keys()) if (k.startsWith('abidora-ai-')) await caches.delete(k); } catch { /* none */ }
  location.reload();
}

export function initApp(opts: { chats: () => number; beforeWipe: () => void }) {
  const box = $<HTMLInputElement>('ailite');
  if (box) box.onchange = () => app.setLite(box.checked);
  $('aiwipe')?.addEventListener('click', () => { opts.beforeWipe(); void wipe(); });
  /* the panel is opened by the shared [data-panel] buttons; refresh its numbers when it opens */
  document.querySelectorAll<HTMLButtonElement>('[data-panel="aiappp"]').forEach((b) => b.addEventListener('click', () => { renderInstall(); void renderUse(opts.chats); }));
  applyLite(); renderInstall();
}
