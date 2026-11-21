/* Abidora AI app: service worker.
   It only looks after the Abidora AI page (every language) and the files that page needs, so the app opens without
   internet and old chats stay readable. Every other page of the site goes straight to the network, untouched.
   - AI page: network first (new versions arrive by themselves); the saved copy is used when offline or very slow.
   - Built files (_astro/, names change with every build): saved copy first.
   - Google Fonts: saved copy first. With Data Saver on, a font that is not saved yet is skipped (the system font is used).
   - Never stored: api/ requests, chats, answers, pictures. Chats live in the browser's own storage, not here.
   Change V when this file's logic changes; the browser then installs the new worker on its own. */
const V = 'ab-ai-sw-1';
const SHELL = 'abidora-ai-shell';
const FLAGS = 'abidora-ai-flags';
const SCOPE = self.registration.scope;                        // e.g. https://site/abidora/
const isAiPage = (rel) => /^(?:[a-z]{2}\/)?ai\/(?:index\.html)?$/.test(rel);
const relOf = (href) => (href.startsWith(SCOPE) ? href.slice(SCOPE.length) : null);
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

let lite = null;   // Data Saver, read once from the flags cache, then kept up to date by the page
async function liteOn() {
  if (lite === null) { try { const r = await (await caches.open(FLAGS)).match(SCOPE + '__lite'); lite = r ? (await r.text()) === '1' : false; } catch { lite = false; } }
  return lite;
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('abidora-ai-') && k !== SHELL && k !== FLAGS) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('message', (e) => {
  const m = e.data || {};
  if (m.t === 'v') e.source?.postMessage({ t: 'v', v: V });
  if (m.t === 'lite') { lite = !!m.on; e.waitUntil(caches.open(FLAGS).then((c) => c.put(SCOPE + '__lite', new Response(lite ? '1' : '0')))); }
  if (m.t === 'save' && Array.isArray(m.urls) && typeof m.page === 'string') e.waitUntil(save(m.page, m.urls));
});

/* the page tells us which files it used, so the first visit (before this worker was in charge) is saved too.
   Built files that no saved AI page uses any more are removed, so old builds do not pile up. */
async function save(page, urls) {
  const c = await caches.open(SHELL);
  const pageUrl = new URL(page, SCOPE); pageUrl.search = ''; pageUrl.hash = '';
  if (!isAiPage(relOf(pageUrl.href) || '-')) return;
  const keep = urls.map((u) => { try { return new URL(u, SCOPE).href; } catch { return ''; } })
    .filter((u) => { const r = relOf(u); return (r !== null && r.startsWith('_astro/')) || FONT_HOSTS.includes(new URL(u).hostname); }).slice(0, 80);
  if (!(await c.match(pageUrl.href))) { try { const r = await fetch(pageUrl.href, { credentials: 'same-origin' }); if (r.ok) await c.put(pageUrl.href, r); } catch { /* offline: next time */ } }
  for (const u of keep) {
    if (await c.match(u)) continue;
    try { const r = await fetch(u, FONT_HOSTS.includes(new URL(u).hostname) ? { mode: 'cors' } : { credentials: 'same-origin' }); if (r.ok) await c.put(u, r); } catch { /* skip */ }
  }
  const idxKey = SCOPE + '__index';
  let idx = {}; try { const r = await c.match(idxKey); if (r) idx = await r.json(); } catch { idx = {}; }
  idx[pageUrl.href] = keep; await c.put(idxKey, new Response(JSON.stringify(idx), { headers: { 'Content-Type': 'application/json' } }));
  const used = new Set(Object.values(idx).flat());
  for (const req of await c.keys()) { const r = relOf(req.url); if (r !== null && r.startsWith('_astro/') && !used.has(req.url)) await c.delete(req); }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const rel = relOf(url.origin + url.pathname);
  if (req.mode === 'navigate' && rel !== null && isAiPage(rel)) { e.respondWith(page(req, url)); return; }
  if (rel !== null && rel.startsWith('_astro/')) { e.respondWith(built(e)); return; }
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(font(e)); return; }
  /* anything else (other pages, api/, images, worlds): not touched */
});

async function fromAiPage(e) {
  if (!e.clientId) return false;
  const cl = await self.clients.get(e.clientId); const r = cl ? relOf(new URL(cl.url).origin + new URL(cl.url).pathname) : null;
  return r !== null && isAiPage(r);
}

async function page(req, url) {
  const c = await caches.open(SHELL);
  const key = url.origin + url.pathname;
  const net = fetch(req).then((r) => { if (r.ok && r.type === 'basic') void c.put(key, r.clone()); return r; });
  const hit = (await c.match(key)) || (await anyAiPage(c));
  if (!hit) return net.catch(() => offlinePage());
  /* the saved copy wins only when the network fails or is very slow */
  const wait = (await liteOn()) ? 2500 : 4500;
  return Promise.race([net.catch(() => hit), new Promise((res) => setTimeout(() => res(hit), wait))]);
}
async function anyAiPage(c) {
  for (const req of await c.keys()) { const r = relOf(req.url); if (r !== null && isAiPage(r)) return c.match(req); }
  return undefined;
}
async function built(e) {
  const c = await caches.open(SHELL);
  const hit = await c.match(e.request); if (hit) return hit;
  const r = await fetch(e.request);
  if (r.ok && (await fromAiPage(e))) void c.put(e.request, r.clone());
  return r;
}
async function font(e) {
  const c = await caches.open(SHELL);
  const hit = await c.match(e.request.url); if (hit) return hit;
  const ai = await fromAiPage(e);
  if (ai && (await liteOn())) return new Response(e.request.destination === 'style' || /fonts\.googleapis/.test(e.request.url) ? '/* Data Saver: system font */' : '', { status: 200, headers: { 'Content-Type': /googleapis/.test(e.request.url) ? 'text/css' : 'font/woff2' } });
  const r = await fetch(e.request);
  if (ai && (r.ok || r.type === 'opaque')) void c.put(e.request.url, r.clone());
  return r;
}
function offlinePage() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abidora AI</title>'
    + '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0c0b;color:#ece6dc;font:16px/1.6 system-ui,sans-serif;text-align:center;padding:24px">'
    + '<div><p style="font-size:20px;margin:0 0 8px">You are offline.</p><p style="margin:0 0 16px;opacity:.8">Open Abidora AI once with internet, then it also opens offline.</p>'
    + '<p lang="bn" style="margin:0 0 16px;opacity:.8">আপনি এখন অফলাইনে। একবার ইন্টারনেট থাকা অবস্থায় Abidora AI খুলুন, তারপর অফলাইনেও খুলবে।</p>'
    + '<button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:999px;border:1px solid #ece6dc55;background:none;color:inherit">Try again · আবার চেষ্টা</button></div></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}
