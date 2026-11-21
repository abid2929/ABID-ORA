/* Abidora image service client (worlds 7 and 8). Talks to the site's own {root}api/image.php, built by the AI thread:
   GET -> {ok, ready, edit, provider, ar}; POST {prompt, mode, ar, images?, style?, seed?} -> {ok, mime, data, w, h, prompt, provider, model, seed}.
   Nothing here ever invents an image: when the service is not connected, callers show that state honestly.
   Creations are kept on this device only (IndexedDB), so World 8 can open what World 7 made. */
const root = () => (window.ABIDORA_ROOT ?? '/');

export async function status() {
  try {
    const r = await fetch(root() + 'api/image.php', { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!r.ok) return { ok: false, ready: false, edit: false, reason: 'http' };
    const j = await r.json(); return { ok: true, ready: !!j.ready, edit: !!j.edit, provider: j.provider || '', ar: j.ar || ['1:1'] };
  } catch { return { ok: false, ready: false, edit: false, reason: 'offline' }; }
}

export const MESSAGES = {
  notready: 'The image service is not switched on yet. The site owner adds a free key in Admin > AI.',
  wait: 'You have used today\'s images on this device. Please come back tomorrow.',
  cap: 'The site has made its images for today. Please try again tomorrow.',
  quota: 'The free image quota is used up for now. Please try again later.',
  safety: 'The image service declined this request. Try different words.',
  big: 'That picture is too large. Use one under 3 MB.',
  gd: 'Editing is not available on this server yet.',
  invalid: 'Something in the request was not valid. Try a shorter prompt.',
  origin: 'This page cannot use the image service from here.',
  down: 'The image service is not answering. Please try again in a minute.',
  key: 'The image service key is not valid. The site owner needs to check it.',
  fail: 'The image could not be made. Please try again.',
  offline: 'The image service cannot be reached from this page.',
};

/** generate or edit; returns {blob, w, h, prompt, seed, provider, model} or throws Error(code) */
export async function make({ prompt, mode = 'generate', ar = '1:1', images, style, seed, raw }) {
  const body = { prompt, mode, ar }; if (images) body.images = images; if (style) body.style = style; if (seed != null) body.seed = seed; if (raw) body.raw = true;
  let r;
  try { r = await fetch(root() + 'api/image.php', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }); }
  catch { throw new Error('offline'); }
  let j = null; try { j = await r.json(); } catch { throw new Error('fail'); }
  if (!j.ok) throw new Error(j.code || 'fail');
  const bin = atob(j.data), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { blob: new Blob([u8], { type: j.mime || 'image/jpeg' }), w: j.w, h: j.h, prompt: j.prompt, seed: j.seed, provider: j.provider, model: j.model };
}

/** a picture as base64 JPEG (no data: prefix), longest side at most `max` px: the server wants refs under 512 px anyway */
export async function toBase64(src, max = 1024) {
  const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .9).split(',')[1];
}

/* ---------- this device's creations ---------- */
function db() { return new Promise((res, rej) => { const q = indexedDB.open('abidora-creations', 1); q.onupgradeneeded = () => q.result.createObjectStore('items', { keyPath: 'id' }); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
export async function saveCreation(item) {
  try { const d = await db(); await new Promise((res, rej) => { const tx = d.transaction('items', 'readwrite'); tx.objectStore('items').put(item); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); } catch { /* private mode: keep it for this visit only */ }
}
export async function listCreations() {
  try { const d = await db(); return await new Promise((res) => { const q = d.transaction('items').objectStore('items').getAll(); q.onsuccess = () => res(q.result.sort((a, b) => b.t - a.t)); q.onerror = () => res([]); }); } catch { return []; }
}
export async function deleteCreation(id) { try { const d = await db(); d.transaction('items', 'readwrite').objectStore('items').delete(id); } catch { /* ignore */ } }
export function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
