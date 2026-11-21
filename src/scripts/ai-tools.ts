/* Abidora AI chat: what the server's tools send back, shown inside the answer bubble.
   - web search: "searching" line, numbered source cards, [1] citations as links
   - crypto: a live market card with a 7-day line (CoinGecko)
   - images: progress while the picture is made, the picture itself, Download / Open / prompt
   Generated pictures are kept only in this browser (IndexedDB), with a small thumbnail in the chat history. */
import { I18N } from './i18n';

const T = I18N.t;
export type Src = { t: string; u: string; d: string; dt: string | null };
export type Coin = { id: string; sym: string; name: string; usd: number; bdt: number | null; ch24: number | null; ch7: number | null; cap: number; rank: number; vol: number; hi: number; lo: number; spark: number[]; upd: number };
export type Cr = { coins: Coin[]; at: number; stale?: boolean };
export type ImgRef = { id: string; w: number; h: number; p: string; mime: string; th: string; edit?: boolean; model?: string };
type M = { role: 'user' | 'assistant'; content: string; err?: string; src?: Src[]; srcAt?: number; chip?: string; cr?: Cr; img?: ImgRef };

/* ---------- picture store (this browser only) ---------- */
const DB = 'abidora-ai', ST = 'img';
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  return dbp ??= new Promise((ok) => {
    try { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch { ok(null); }
  });
}
async function put(id: string, b: Blob) { const d = await db(); if (!d) return; await new Promise((ok) => { try { const tx = d.transaction(ST, 'readwrite'); tx.objectStore(ST).put(b, id); tx.oncomplete = tx.onerror = () => ok(0); } catch { ok(0); } }); }
async function get(id: string): Promise<Blob | null> { const d = await db(); if (!d) return null; return new Promise((ok) => { try { const r = d.transaction(ST).objectStore(ST).get(id); r.onsuccess = () => ok((r.result as Blob) || null); r.onerror = () => ok(null); } catch { ok(null); } }); }
const urls = new Map<string, string>();
async function urlOf(id: string): Promise<string | null> { if (urls.has(id)) return urls.get(id)!; const b = await get(id); if (!b) return null; const u = URL.createObjectURL(b); urls.set(id, u); return u; }
const b64blob = (b64: string, mime: string) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new Blob([u], { type: mime }); };
async function thumb(blob: Blob, max = 160, q = .7): Promise<string> {
  try { const bmp = await createImageBitmap(blob); const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k)); c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.(); return c.toDataURL('image/jpeg', q); } catch { return ''; }
}
/** the picture as base64 JPEG (longest side <= max), to send it back for "change it" requests */
async function asJpeg(blob: Blob, max = 1024): Promise<string> { const d = await thumb(blob, max, .88); return d.slice(d.indexOf(',') + 1); }

/* ---------- small helpers ---------- */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
const tfmt = (ts: number) => { try { return new Intl.DateTimeFormat(I18N.loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ts); } catch { return new Date(ts).toISOString().slice(0, 16).replace('T', ' '); } };
const dfmt = (d: string) => { try { return new Intl.DateTimeFormat(I18N.loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(d + 'T12:00:00Z')); } catch { return d; } };
function money(v: number, cur: 'USD' | 'BDT', compact = false): string {
  try { return new Intl.NumberFormat(I18N.lang === 'ar' ? 'ar-u-nu-latn' : compact && /^(bn|hi)/.test(I18N.lang) ? 'en-US' : I18N.loc, { style: 'currency', currency: cur, notation: compact ? 'compact' : 'standard', maximumFractionDigits: compact ? 2 : v >= 100 ? 0 : v >= 1 ? 2 : 6 }).format(v); } catch { return cur + ' ' + v; }
}
const pct = (v: number | null) => v == null ? '–' : (v > 0 ? '+' : '') + v.toFixed(2) + '%';
const AR: Record<string, string> = { '1:1': '1 / 1', '4:3': '4 / 3', '3:4': '3 / 4', '16:9': '16 / 9', '9:16': '9 / 16' };

/* ---------- inside a finished (or streaming) answer ---------- */
function cite(body: HTMLElement, src: Src[]) {
  const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('code,pre,a') ? NodeFilter.FILTER_REJECT : /\[\d{1,2}\]/.test(n.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP) });
  const nodes: Text[] = []; while (w.nextNode()) nodes.push(w.currentNode as Text);
  for (const n of nodes) {
    const f = document.createDocumentFragment();
    (n.nodeValue || '').split(/(\[\d{1,2}\])/).forEach((part) => {
      const m = part.match(/^\[(\d{1,2})\]$/); const s = m ? src[+m[1] - 1] : null;
      if (!s) { f.append(part); return; }
      const a = el('a', 'aicite', m![1]); a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.title = s.t + ' · ' + s.d; f.append(a);
    });
    n.replaceWith(f);
  }
}
function sources(m: M): HTMLElement {
  const box = el('div', 'aisrc'); const h = el('p', 'mono aisrch');
  h.textContent = T('ai.src') + (m.srcAt ? ' · ' + T('ai.src.at').split('{t}').join(tfmt(m.srcAt * 1000)) : ''); box.append(h);
  const ol = el('ol');
  m.src!.forEach((s, i) => {
    const li = el('li'); const a = el('a'); a.href = s.u; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
    const n = el('span', 'mono aisrcn', String(i + 1)); const t = el('b', '', s.t); const sm = el('small', 'mono', s.d + ' · ' + (s.dt ? dfmt(s.dt) : T('ai.nodate')));
    a.append(n, t, sm); li.append(a); ol.append(li);
  });
  box.append(ol);
  if (m.chip) { const f = el('iframe', 'aichip'); f.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox'); f.srcdoc = '<base target="_blank">' + m.chip; f.title = T('ai.src'); box.append(f); }
  return box;
}
function spark(v: number[], up: boolean): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 200 48'); s.setAttribute('preserveAspectRatio', 'none'); s.setAttribute('class', 'aispark ' + (up ? 'up' : 'dn')); s.setAttribute('aria-hidden', 'true');
  if (v.length > 1) {
    const lo = Math.min(...v), hi = Math.max(...v), r = hi - lo || 1;
    const pts = v.map((x, i) => `${(i / (v.length - 1) * 200).toFixed(1)},${(46 - (x - lo) / r * 44).toFixed(1)}`).join(' ');
    const a = document.createElementNS(NS, 'polygon'); a.setAttribute('points', `0,48 ${pts} 200,48`); a.setAttribute('class', 'ar');
    const l = document.createElementNS(NS, 'polyline'); l.setAttribute('points', pts); s.append(a, l);
  }
  return s;
}
function crypto(c: Cr): HTMLElement {
  const box = el('div', 'aicr');
  for (const x of c.coins) {
    const card = el('div', 'aicrc'); const up = (x.ch7 ?? x.ch24 ?? 0) >= 0;
    const top = el('div', 'aicrt');
    const nm = el('b', '', x.name); const sy = el('span', 'mono', x.sym + (x.rank ? ' · #' + x.rank : ''));
    const pr = el('strong', 'aicrp', money(x.usd, 'USD')); const ch = el('span', 'mono aicrch ' + ((x.ch24 ?? 0) >= 0 ? 'up' : 'dn'), pct(x.ch24) + ' · 24h');
    top.append(nm, sy, pr, ch);
    if (x.bdt) top.append(el('span', 'mono aicrbdt', '≈ ' + money(x.bdt, 'BDT')));
    card.append(top, spark(x.spark, up));
    const dl = el('dl', 'mono');
    const row = (k: string, v: string) => { dl.append(el('dt', '', T(k)), el('dd', '', v)); };
    row('ai.cr.ch7', pct(x.ch7)); row('ai.cr.hl', money(x.hi, 'USD') + ' / ' + money(x.lo, 'USD')); row('ai.cr.cap', money(x.cap, 'USD', true)); row('ai.cr.vol', money(x.vol, 'USD', true));
    card.append(dl); box.append(card);
  }
  const ft = el('p', 'mono aicrf');
  ft.append(T('ai.cr.upd').split('{t}').join(tfmt(c.at * 1000)) + ' · ' + (c.stale ? T('ai.cr.stale') + ' · ' : ''));
  const a = el('a', '', T('ai.cr.src')); a.href = 'https://www.coingecko.com/'; a.target = '_blank'; a.rel = 'noopener noreferrer'; ft.append(a, ' · ' + T('ai.cr.nfa'));
  box.append(ft);
  return box;
}
function figure(img: ImgRef): HTMLElement {
  const f = el('figure', 'aiimg'); f.style.aspectRatio = `${img.w} / ${img.h}`; f.style.maxWidth = `min(560px, 100%, calc(68vh * ${(img.w / img.h).toFixed(3)}))`;
  const im = el('img'); im.alt = T('ai.img.alt') + ': ' + img.p.slice(0, 160); im.decoding = 'async'; im.width = img.w; im.height = img.h;
  if (urls.has(img.id)) im.src = urls.get(img.id)!;
  else { if (img.th) im.src = img.th; void urlOf(img.id).then((u) => { if (u) im.src = u; else { f.classList.add('gone'); f.title = T('ai.img.gone'); } }); }
  im.onclick = () => { void openImg(img); };
  const cap = el('figcaption', 'mono', T('ai.img.ai') + (img.edit ? ' · ' + T('ai.img.edited') : ''));
  f.append(im, cap);
  return f;
}
async function openImg(img: ImgRef) { const u = await urlOf(img.id); if (u) window.open(u, '_blank', 'noopener'); }
async function download(img: ImgRef) {
  const u = await urlOf(img.id); if (!u) { alert(T('ai.img.gone')); return; }
  const a = document.createElement('a'); a.href = u; a.download = 'abidora-ai-' + img.id + (img.mime === 'image/png' ? '.png' : '.jpg'); document.body.append(a); a.click(); a.remove();
}

/* ---------- live progress inside the bubble while a tool runs ---------- */
function live(out: M, body: HTMLElement, scroll: (force?: boolean) => void) {
  const box = el('div', 'aitool'); box.setAttribute('role', 'status'); let ph: HTMLElement | null = null, t0 = 0, timer = 0, stage = '';
  const show = (txt: string, spin = true) => { box.replaceChildren(); if (spin) box.append(el('span', 'aispin')); box.append(el('span', '', txt)); keep(); };
  function keep() { if (box.textContent || ph) { if (ph && !out.img && !ph.isConnected) body.prepend(ph); if (box.textContent && !box.isConnected) body.prepend(box); } }
  function tick() {
    if (!ph) return; const s = Math.round((performance.now() - t0) / 1000);
    const bar = ph.querySelector<HTMLElement>('i'); if (bar) bar.style.width = Math.min(92, 100 * (1 - Math.exp(-s / 7))).toFixed(0) + '%';   // an estimate: the service does not report progress
    const tx = ph.querySelector<HTMLElement>('span'); if (tx) tx.textContent = T(stage) + ' · ' + s + ' s';
  }
  return {
    keep,
    async event(ev: string, j: any) {
      if (ev === 'tool') {
        if (j.st === 'off') { show(T('ai.t.off'), false); return; }
        if (j.k === 'search') show(j.st === 'start' ? T('ai.t.search') + (j.q ? ': “' + j.q + '”' : '') : j.st === 'fail' ? T('ai.t.sfail') : T('ai.t.searched').split('{n}').join(String(j.n || 0)), j.st === 'start');
        else if (j.k === 'crypto') show(j.st === 'start' ? T('ai.t.crypto') : j.st === 'fail' ? T('ai.t.cfail') : T('ai.t.crypto2'), j.st === 'start');
        else if (j.k === 'image') {
          if (j.st === 'fail') { clearInterval(timer); ph?.remove(); ph = null; box.replaceChildren(); return; }
          box.replaceChildren();
          if (!ph) { ph = el('div', 'aiimgph'); ph.style.aspectRatio = AR[j.ar] || '1 / 1'; ph.append(el('span', 'mono'), el('b')); ph.querySelector('b')!.append(el('i')); t0 = performance.now(); timer = window.setInterval(tick, 500); }
          stage = j.st === 'start' ? 'ai.t.img1' : j.edit ? 'ai.t.edit2' : 'ai.t.img2';
          if (j.ar) { ph.style.aspectRatio = AR[j.ar] || '1 / 1'; const [a, b] = String(j.ar).split(':').map(Number); if (a && b) ph.style.maxWidth = `min(560px, 100%, calc(68vh * ${(a / b).toFixed(3)}))`; }
          tick(); keep();
        }
        scroll(j.st === 'start' || j.st === 'render'); return;
      }
      if (ev === 'sources') { out.src = (j.items || []).slice(0, 8); out.srcAt = j.at; if (j.chip) out.chip = String(j.chip); return; }
      if (ev === 'crypto') { out.cr = { coins: j.coins || [], at: j.at, stale: !!j.stale }; body.prepend(crypto(out.cr)); keep(); scroll(); return; }
      if (ev === 'image') {
        const blob = b64blob(j.data, j.mime || 'image/png'); const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        await put(id, blob); urls.set(id, URL.createObjectURL(blob));
        out.img = { id, w: j.w || 1024, h: j.h || 1024, p: String(j.prompt || ''), mime: j.mime || 'image/png', th: await thumb(blob), edit: !!j.edit, model: j.model };
        clearInterval(timer); ph?.remove(); ph = null; box.replaceChildren();
        body.replaceChildren(); decorate(body, out); scroll();
      }
    },
    end() { clearInterval(timer); ph?.remove(); ph = null; box.remove(); },
  };
}

/** adds tool results to an answer body (after the Markdown was rendered) */
export function decorate(body: HTMLElement, m: M) {
  if (m.src?.length) { cite(body, m.src); body.append(sources(m)); }
  if (m.cr?.coins?.length) body.prepend(crypto(m.cr));
  if (m.img) body.prepend(figure(m.img));
}

export const tools = {
  decorate, live,
  /** what the server sees of an earlier answer: its text, plus a note when it was a picture */
  histText(m: M): string { return m.img ? (m.content + `\n[The site's image tool made a picture for this answer from the prompt: ${m.img.p.slice(0, 500)}]`).trim() : m.content; },
  /** extra request fields: the chosen picture shape, and the last picture (for "make it blue") */
  async extra(msgs: M[]): Promise<Record<string, string>> {
    const o: Record<string, string> = {}; const ar = document.querySelector<HTMLSelectElement>('#aiar')?.value || ''; if (ar && AR[ar]) o.ar = ar;
    const prev = msgs.slice(0, -2).reverse().find((x) => x.role === 'assistant');
    if (prev?.img) { const b = await get(prev.img.id); if (b) o.previmg = await asJpeg(b); }
    return o;
  },
  imgActs(m: M, btn: (k: string, fn: () => void, cls?: string) => HTMLButtonElement): HTMLButtonElement[] {
    return [btn('ai.img.dl', () => void download(m.img!)), btn('ai.img.open', () => void openImg(m.img!)), btn('ai.img.prompt', () => alert(m.img!.p))];
  },
  imgErr(code: string): string { const w = code.slice(4); return 'img.' + (['notready', 'quota', 'wait', 'cap', 'safety', 'key', 'gd', 'lite'].includes(w) ? w : 'other'); },
  /** forget stored pictures that no saved chat uses any more */
  prune(chats: { msgs: M[] }[]) {
    const keep = new Set<string>(); chats.forEach((c) => c.msgs.forEach((m) => { if (m.img) keep.add(m.img.id); }));
    void db().then((d) => { if (!d) return; try { const st = d.transaction(ST, 'readwrite').objectStore(ST); const r = st.getAllKeys(); r.onsuccess = () => { (r.result as string[]).forEach((k) => { if (!keep.has(k) && Date.now() - parseInt(k.slice(0, 8), 36) > 60e3) st.delete(k); }); }; } catch { /* */ } });
  },
};
