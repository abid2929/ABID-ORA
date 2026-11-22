/* Abidora AI page: chat with streaming, history in this browser, voice in (Web Speech API) and voice out
   (speechSynthesis). The AI itself runs on the server (api/ai.php), which holds the provider key. */
import { I18N } from './i18n';
import { md, speakable, chunks, quickStart } from './md';
import { avatar } from './call-avatar';
import { startLive, type Live } from './live';
import { tools, type Src, type Cr, type ImgRef } from './ai-tools';
import { app, initApp } from './ai-app';

const T = I18N.t;
const $ = <E extends HTMLElement>(s: string) => document.querySelector<E>(s)!;
type FileTag = { n: string; k: 'image' | 'pdf' | 'text'; th?: string };
type Msg = { role: 'user' | 'assistant'; content: string; err?: string; files?: FileTag[]; src?: Src[]; srcAt?: number; chip?: string; cr?: Cr; img?: ImgRef; cid?: string; q?: 'p' | 's'; qt?: number };
type Att = FileTag & { mime: string; data?: string; text?: string };
type Chat = { id: string; title: string; ts: number; msgs: Msg[] };
const API = I18N.root + 'api/ai.php';
const LOC: Record<string, string> = { en: 'en-US', bn: 'bn-BD', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', ar: 'ar-SA', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', hi: 'hi-IN' };
const LNAME: Record<string, string> = { en: 'English', bn: 'বাংলা', es: 'Español', fr: 'Français', de: 'Deutsch', ar: 'العربية', zh: '中文', ja: '日本語', ko: '한국어', hi: 'हिन्दी' };

/* ---------- storage (this browser only) ---------- */
const store = {
  get<X>(k: string, d: X): X { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as X : d; } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } },
};
const K = { chats: 'abidora.ai.chats', mem: 'abidora.ai.mem', voice: 'abidora.ai.voice' };
let chats: Chat[] = store.get<Chat[]>(K.chats, []).filter((c) => c && Array.isArray(c.msgs));
chats.forEach((c) => c.msgs.forEach((m) => { if (m.q) m.q = 'p'; }));   // was sending when the page closed: waits again
let mem = store.get<{ call: string; items: string[] }>(K.mem, { call: '', items: [] });
const vs = Object.assign({ mode: false, voice: '', live: 'm' as 'm' | 'f', lang: I18N.lang, langSet: false, rate: 1, pitch: 1, vol: 1 }, store.get(K.voice, {}));
const saveChats = () => { chats.sort((a, b) => b.ts - a.ts); chats = chats.slice(0, 60); store.set(K.chats, chats); tools.prune(chats); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
let cur: Chat | null = null;
let ttsOn = false, handsFree = false, callOn = false;   // handsFree: a spoken question in voice mode, so listen again after answering

/* ---------- elements ---------- */
const list = $('#aimsgs'), input = $<HTMLTextAreaElement>('#aiin'), send = $<HTMLButtonElement>('#aisend'), micB = $<HTMLButtonElement>('#aimic');
const stat = $('#aistat'), side = $('#aiside'), clist = $('#aichats'), banner = $('#aiban');
const vSel = $<HTMLSelectElement>('#aivoice'), vLang = $<HTMLSelectElement>('#aivlang');
const say = (el: HTMLElement, k: string) => { el.textContent = T(k); };

/* ---------- the orb: ring + moon, four states ---------- */
type St = 'idle' | 'listen' | 'think' | 'speak';
let state: St = 'idle', amp = 0;
function setState(s: St) {
  state = s; document.body.dataset.ai = s;
  stat.textContent = T({ idle: 'ai.st.ready', listen: 'ai.st.listen', think: 'ai.st.think', speak: 'ai.st.speak' }[s]);
  callState();
}
function orb(cv: HTMLCanvasElement) {
  const g = cv.getContext('2d'); if (!g) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t0 = performance.now();
  const draw = (now: number) => {
    const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); const w = Math.round(r.width * d), h = Math.round(r.height * d);
    if (!w) { requestAnimationFrame(draw); return; }
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const t = calm || app.lite() ? 0 : (now - t0) / 1000, cx = w / 2, cy = h / 2, R = Math.min(w, h) * .3;
    const cs = getComputedStyle(cv), bone = cs.getPropertyValue('--bone').trim() || '#ece6dc', sig = cs.getPropertyValue('--signal').trim() || '#e8b46a';
    g.clearRect(0, 0, w, h);
    amp += ((state === 'speak' ? .55 + .45 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1)) : state === 'listen' ? .45 + .25 * Math.sin(t * 4) : state === 'think' ? .25 : .1) - amp) * .12;
    const glow = g.createRadialGradient(cx, cy, R * .2, cx, cy, Math.min(w, h) * .49); glow.addColorStop(0, sig + '55'); glow.addColorStop(1, sig + '00');
    g.fillStyle = glow; g.globalAlpha = .35 + amp * .6; g.fillRect(0, 0, w, h); g.globalAlpha = 1;
    /* the ring, wobbling with the voice */
    g.beginPath();
    for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 2; const wob = 1 + amp * .09 * Math.sin(a * 5 + t * 3) + amp * .05 * Math.sin(a * 9 - t * 5);
      const x = cx + Math.cos(a) * R * wob, y = cy + Math.sin(a) * R * wob; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = bone; g.lineWidth = Math.max(2, R * .16); g.stroke();
    if (state === 'listen') for (let k = 0; k < 2; k++) { const p = ((t * .8 + k * .5) % 1); g.beginPath(); g.arc(cx, cy, R * (1.15 + p * .7), 0, Math.PI * 2); g.strokeStyle = bone; g.globalAlpha = (1 - p) * .5; g.lineWidth = d * 1.5; g.stroke(); g.globalAlpha = 1; }
    /* the moon: sits top-right, orbits while thinking */
    const ma = state === 'think' ? -Math.PI / 4 + t * 3.2 : -Math.PI / 4 + Math.sin(t * .6) * .08;
    g.beginPath(); g.arc(cx + Math.cos(ma) * R * 1.02, cy + Math.sin(ma) * R * 1.02, R * (.26 + amp * .08), 0, Math.PI * 2); g.fillStyle = sig; g.fill();
    if (app.lite()) { setTimeout(() => requestAnimationFrame(draw), 500); return; }   /* Data Saver: a still orb, redrawn twice a second */
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
}
document.querySelectorAll<HTMLCanvasElement>('canvas.orb').forEach(orb);

/* ---------- rendering ---------- */
const tsFmt = (ts: number) => { try { return new Intl.DateTimeFormat(I18N.loc, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ts); } catch { return ''; } };
const hq = $<HTMLInputElement>('#aihq');
hq.oninput = () => renderList();
function renderList() {
  clist.replaceChildren();
  if (!chats.length) { const p = document.createElement('p'); p.className = 'mono aiempty'; say(p, 'ai.empty'); clist.append(p); hq.hidden = true; return; }
  hq.hidden = chats.length < 4 && !hq.value;
  const q = hq.value.trim().toLocaleLowerCase();
  const shown = q ? chats.filter((c) => c.title.toLocaleLowerCase().includes(q) || c.msgs.some((m) => m.content.toLocaleLowerCase().includes(q))) : chats;
  if (!shown.length) { const p = document.createElement('p'); p.className = 'mono aiempty'; say(p, 'ai.nohit'); clist.append(p); return; }
  for (const c of shown) {
    const li = document.createElement('li'); if (cur && c.id === cur.id) li.className = 'on';
    const a = document.createElement('button'); a.type = 'button'; a.className = 'aic'; a.innerHTML = '<b></b><small class="mono"></small>';
    a.querySelector('b')!.textContent = c.title; a.querySelector('small')!.textContent = tsFmt(c.ts);
    a.onclick = () => { open(c.id); side.classList.remove('open'); };
    const del = document.createElement('button'); del.type = 'button'; del.className = 'aidel'; del.setAttribute('aria-label', T('ai.del') + ': ' + c.title); del.textContent = '×';
    del.onclick = () => { if (!confirm(T('ai.delq'))) return; chats = chats.filter((x) => x.id !== c.id); if (cur?.id === c.id) cur = null; saveChats(); renderList(); renderChat(); };
    const ren = document.createElement('button'); ren.type = 'button'; ren.className = 'aidel airen'; ren.setAttribute('aria-label', T('ai.ren') + ': ' + c.title); ren.textContent = '✎';
    ren.onclick = () => {
      const inp = document.createElement('input'); inp.className = 'aicren'; inp.value = c.title; inp.maxLength = 80; inp.setAttribute('aria-label', T('ai.ren'));
      let done = false;
      const fin = (keep: boolean) => { if (done) return; done = true; const v = inp.value.replace(/\s+/g, ' ').trim(); if (keep && v) { c.title = v.slice(0, 80); saveChats(); } renderList(); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); fin(false); } };
      inp.onblur = () => fin(true);
      a.replaceWith(inp); ren.hidden = true; inp.focus(); inp.select();
    };
    li.append(a, ren, del); clist.append(li);
  }
}
function actBtn(k: string, fn: () => void, cls = '') { const b = document.createElement('button'); b.type = 'button'; b.className = 'mono aib ' + cls; say(b, k); b.onclick = fn; return b; }
function msgEl(m: Msg, i: number, last: boolean): HTMLElement {
  const el = document.createElement('article'); el.className = 'aim ' + (m.role === 'user' ? 'u' : 'a') + (m.err ? ' err' : '');
  const body = document.createElement('div'); body.className = 'aibody';
  if (m.role === 'user') { body.textContent = m.content; if (m.files?.length) body.prepend(fileRow(m.files)); } else { body.innerHTML = m.err ? '' : md(m.content); tools.decorate(body, m); }
  const bnc = (m.content.match(/[\u0980-\u09FF]/g) || []).length;           // mark Bengali text so lists, fonts and screen readers use Bengali
  if (bnc > 20 && bnc > m.content.length * .3) body.lang = 'bn';
  if (m.err) { const p = document.createElement('p'); say(p, 'ai.err.' + m.err); body.append(p); }
  el.append(body);
  if (m.role === 'user' && m.q) {
    el.classList.add('wait');
    const q = document.createElement('p'); q.className = 'mono aiq'; q.setAttribute('role', 'status');
    const t = document.createElement('span'); say(t, m.q === 's' ? 'ai.q.send' : 'ai.q.wait'); q.append(t);
    if (m.q === 'p') q.append(actBtn('ai.q.cancel', () => cancelWaiting(m)));
    el.append(q);
  }
  if (m.role === 'assistant') {
    const bar = document.createElement('div'); bar.className = 'aiacts';
    if (!m.err) {
      bar.append(actBtn('ai.copy', () => copy(m.content, bar.firstChild as HTMLElement)));
      if (m.img) bar.append(...tools.imgActs(m, actBtn));
      if ('speechSynthesis' in window || ttsOn) bar.append(actBtn('ai.speak', () => speak(m.content, true)));
    }
    if (last) bar.append(actBtn(m.err ? 'ai.retry' : 'ai.regen', regenerate));
    el.append(bar);
  }
  wireCode(el); void i;
  return el;
}
function fileRow(fs: FileTag[], rm?: (i: number) => void): HTMLElement {
  const row = document.createElement('div'); row.className = 'aifl';
  fs.forEach((f, i) => {
    const c = document.createElement('span'); c.className = 'aifc';
    if (f.th) { const im = document.createElement('img'); im.src = f.th; im.alt = ''; c.append(im); } else { const ic = document.createElement('b'); ic.className = 'mono'; ic.textContent = f.k === 'pdf' ? 'PDF' : 'TXT'; c.append(ic); }
    const nm = document.createElement('span'); nm.textContent = f.n; c.append(nm);
    if (rm) { const x = document.createElement('button'); x.type = 'button'; x.className = 'aifx'; x.textContent = '×'; x.setAttribute('aria-label', T('ai.rmfile') + ': ' + f.n); x.onclick = () => rm(i); c.append(x); }
    row.append(c);
  });
  return row;
}
function wireCode(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('[data-cpy]').forEach((b) => { say(b, 'ai.copy'); b.onclick = () => copy(b.closest('.code')!.querySelector('code')!.textContent || '', b); });
}
async function copy(text: string, b: HTMLElement) {
  const done = () => { const o = b.textContent; b.textContent = T('ai.copied'); setTimeout(() => { b.textContent = o; }, 1400); };
  try { await navigator.clipboard.writeText(text); done(); } catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch { /* nothing more we can do */ } ta.remove();
  }
}
function renderChat() {
  list.replaceChildren();
  const welcome = $('#aiwel'); welcome.hidden = !!(cur && cur.msgs.length);
  if (!cur) return;
  cur.msgs.forEach((m, i) => list.append(msgEl(m, i, i === cur!.msgs.length - 1)));
  list.scrollTop = list.scrollHeight;
}
function open(id: string) { cur = chats.find((c) => c.id === id) || null; renderList(); renderChat(); stopSpeak(); }
function newChat() { cur = null; abort?.abort(); stopSpeak(); renderList(); renderChat(); input.focus(); side.classList.remove('open'); }

/* ---------- talking to the server ---------- */
let abort: AbortController | null = null, busy = false, noServer = false;
function setBusy(b: boolean) { busy = b; send.dataset.stop = b ? '1' : ''; send.setAttribute('aria-label', T(b ? 'ai.stop' : 'ai.send')); say(send.querySelector('span')!, b ? 'ai.stop' : 'ai.send'); }
type Sent = 'ok' | 'net' | 'hold' | 'fail';
/** answers the user message at index `at` of chat `c`; the answer goes right after it.
    'net': no connection (the message goes back to waiting) · 'hold': the server asked us to wait (limits, same message already running) */
async function ask(c: Chat | null = cur, at = (c?.msgs.length ?? 0) - 1, queued = false): Promise<Sent> {
  if (!c) return 'fail';
  const target = c.msgs[at];
  if (!target || target.role !== 'user') return 'fail';
  let hist = c.msgs.slice(0, at + 1).filter((m, i) => !m.err && (!m.q || i === at));
  if (app.lite()) hist = hist.slice(-8);                         /* Data Saver: a shorter request */
  const msgs = hist.map((m) => ({ role: m.role, content: tools.histText(m) }));
  const att = sent.get(target);
  if (target.files?.length && !att && !queued) flash(T('ai.f.gone'));
  const files = (att || []).map(({ n, mime, data, text }) => ({ name: n, mime, data, text }));
  if (!target.cid) target.cid = uid() + uid();
  const out: Msg = { role: 'assistant', content: '' }; c.msgs.splice(at + 1, 0, out);
  const shown = () => c === cur;
  const el = msgEl(out, at + 1, false); el.classList.add('live');
  if (shown()) { const after = list.children[at]; if (after) after.after(el); else list.append(el); }
  el.querySelector('.aiacts')?.remove();      /* Copy / Read aloud appear once the answer is complete */
  const body = el.querySelector('.aibody') as HTMLElement;
  body.innerHTML = '<span class="aidots" aria-hidden="true"><i></i><i></i><i></i></span>'; if (shown()) list.scrollTop = list.scrollHeight;
  setBusy(true); setState('think'); abort = new AbortController();
  const tType = performance.now(); if (!callOn) chime('send');   /* 0.9.17 (owner): Messenger feel, a soft sound and about a second of typing dots */
  const tl = tools.live(out, body, (force?: boolean) => { if (shown() && (force || list.scrollHeight - list.scrollTop - list.clientHeight < 200)) list.scrollTop = list.scrollHeight; });   /* search / crypto / image progress inside the bubble */
  const extra = callOn ? {} : await tools.extra(c.msgs.slice(0, at + 2));
  if (app.lite()) delete (extra as Record<string, string>).previmg;   /* Data Saver: the last picture is not uploaded again */
  /* if not a single word has arrived after 90 s, stop waiting and offer Retry instead of an empty bubble */
  let slow = false; const slowT = setTimeout(() => { if (!out.content.trim() && !out.img) { slow = true; abort?.abort(); } }, 90000);
  let spoken = 0, raf = 0, reached = false;
  const paint = () => { raf = 0; body.innerHTML = md(out.content) + '<span class="caret"></span>'; tools.decorate(body, out); tl.keep(); wireCode(body); if (shown() && list.scrollHeight - list.scrollTop - list.clientHeight < 160) list.scrollTop = list.scrollHeight; };
  const voiceFeed = (final: boolean) => {      /* in voice mode, speak finished sentences while the rest is still arriving */
    if (queued || !(vs.mode || callOn) || !('speechSynthesis' in window || ttsOn)) return;
    const plain = speakable(out.content, T('ai.codeomit'));
    /* the Gemini voice is limited to a few clips a day, so it gets the whole answer as one clip */
    if (engine() === 'natural') { if (final && plain.trim()) for (const c of chunks(plain, 380)) enqueue(c); return; }
    const parts = quickStart(chunks(plain));
    const ready = final ? parts.length : Math.max(0, parts.length - 1);
    for (; spoken < ready; spoken++) enqueue(parts[spoken]);
  };
  let result: Sent = 'ok';
  try {
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: abort.signal,
      body: JSON.stringify({ messages: msgs, lang: I18N.lang, memory: mem.items, call: mem.call, files, voice: callOn ? vs.lang : '', cid: target.cid, lite: app.lite() ? 1 : 0, ...extra }) });
    reached = true; app.markUp();
    if (!res.ok || !(res.headers.get('content-type') || '').includes('event-stream')) {
      let code = 'other'; try { code = (await res.json()).code || code; } catch { /* not JSON */ }
      throw new Error(code);
    }
    const rd = res.body!.getReader(), dec = new TextDecoder(); let buf = '', ev = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i; while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2); ev = 'delta'; let data = '';
        for (const line of block.split('\n')) { if (line.startsWith('event:')) ev = line.slice(6).trim(); else if (line.startsWith('data:')) data += line.slice(5).trim(); }
        if (!data) continue;
        const j = JSON.parse(data);
        if (ev === 'delta') { if (!j.t) continue; out.content += j.t; if (callOn) callText(out.content); if (state === 'think' && !speaking()) setState('idle'); if (!raf) { const w = callOn ? 0 : tType + 1100 - performance.now(); if (w > 0) raf = window.setTimeout(() => { if (out.content) chime('recv'); paint(); }, w); else { if (out.content.length === j.t.length && !callOn) chime('recv'); raf = requestAnimationFrame(paint); } } voiceFeed(false); }
        else if (ev === 'error') throw new Error(j.code === 'img' ? 'img.' + (j.why || 'other') : (j.code || 'other'));
        else await tl.event(ev, j);
      }
    }
    if (!out.content.trim() && !out.img) throw new Error('empty');
    voiceFeed(true);
  } catch (e) {
    const code = slow ? 'down' : (e as Error).name === 'AbortError' ? 'stopped' : (e as Error).message;
    const netFail = !reached && code !== 'stopped' && !slow;          /* the request never reached the server */
    if (netFail && !callOn && !out.content && !out.img) { result = 'net'; app.markDown(); }
    else if (!out.content && !out.img && (code === 'dup' || (queued && ['wait', 'cap', 'quota'].includes(code)))) result = 'hold';
    else if (code === 'stopped') { if (!out.content) out.content = T('ai.stopped'); }
    else if (!out.content && noServer) out.err = 'preview';
    else if (code.startsWith('img.')) { out.err = tools.imgErr(code); out.content = ''; }
    else if (!out.content) { out.err = ['notready', 'wait', 'cap', 'quota', 'key', 'down', 'offline', 'files', 'big'].includes(code) ? code : (code === 'Failed to fetch' || code === 'network' ? 'net' : 'other'); }
    if (out.err) result = 'fail';
  } finally {
    clearTimeout(slowT); if (raf) { cancelAnimationFrame(raf); clearTimeout(raf); } tl.end();
    abort = null; setBusy(false); if (!speaking()) setState('idle');
    if (result === 'net' || result === 'hold') {
      /* nothing was answered: the message waits (it is saved, so a refresh or closing the app loses nothing) */
      const k = c.msgs.indexOf(out); if (k >= 0) c.msgs.splice(k, 1);
      target.q = 'p'; target.qt = target.qt || Date.now();
      if (result === 'net' && !queued && files.length) { sent.delete(target); delete target.files; flash(T('ai.q.files')); }
      else if (result === 'net' && !queued) flash(T('ai.q.net'));
    } else { delete target.q; delete target.qt; }
    c.ts = Date.now(); saveChats(); renderList(); if (shown()) renderChat();
    if (callOn) callAfter(out);
    showNet();
  }
  return result;
}
/* ---------- offline queue: messages written without internet wait in their chat and go out in order ---------- */
const waiting = () => chats.reduce((n, c) => n + c.msgs.filter((m) => m.q).length, 0);
let syncing = false, retryT = 0, backoff = 0;
function showNet() { app.status(waiting(), syncing); }
function nextWaiting(): [Chat, number] | null {
  let best: [Chat, number] | null = null, bt = Infinity;
  for (const c of chats) { const i = c.msgs.findIndex((m) => m.q); if (i >= 0 && (c.msgs[i].qt || 0) < bt) { bt = c.msgs[i].qt || 0; best = [c, i]; } }
  return best;
}
function retryLater(sec: number) { clearTimeout(retryT); if (!app.lite() || sec > 60) retryT = window.setTimeout(() => void sync(), sec * 1000); }
async function sync() {
  if (syncing || busy || !navigator.onLine || !nextWaiting()) { showNet(); return; }
  const run = async () => {
    syncing = true; showNet();
    try {
      for (;;) {
        if (!navigator.onLine) break;
        const nx = nextWaiting(); if (!nx) { backoff = 0; break; }
        const [c, i] = nx; c.msgs[i].q = 's'; saveChats(); if (c === cur) renderChat();
        const r = await ask(c, i, true);
        if (r === 'net') { backoff = Math.min(300, backoff ? backoff * 2 : 15); retryLater(backoff); break; }
        if (r === 'hold') { retryLater(60); break; }
        backoff = 0;
      }
    } finally { syncing = false; showNet(); }
  };
  const locks = (navigator as any).locks;
  /* two open tabs never send the same waiting message: only the tab holding the lock sends */
  if (locks?.request) await locks.request('abidora-ai-sync', { ifAvailable: true }, async (l: unknown) => { if (l) await run(); });
  else await run();
}
function submit(text: string) {
  text = text.trim(); if ((busy && !syncing) || (!text && !pend.length)) return;
  const offline = !callOn && (!app.online() || syncing || !!cur?.msgs.some((m) => m.q));
  if (offline && pend.length) { flash(T('ai.q.files')); return; }
  if (!text) text = T('ai.fileask');
  if (!cur) { cur = { id: uid(), title: text.replace(/\s+/g, ' ').slice(0, 48), ts: Date.now(), msgs: [] }; chats.unshift(cur); }
  cur.msgs = cur.msgs.filter((m) => !m.err);
  const um: Msg = { role: 'user', content: text.slice(0, 6000), cid: uid() + uid() };
  if (pend.length) { um.files = pend.map(({ n, k, th }) => (th ? { n, k, th } : { n, k })); sent.set(um, pend); pend = []; renderPend(); }
  cur.msgs.push(um); input.value = ''; grow();
  stopSpeak();
  if (offline) { um.q = 'p'; um.qt = Date.now(); cur.ts = Date.now(); saveChats(); renderChat(); renderList(); showNet(); void sync(); return; }
  renderChat(); renderList(); void ask(cur, cur.msgs.length - 1);
}
function cancelWaiting(m: Msg) {
  const c = chats.find((x) => x.msgs.includes(m)); if (!c || m.q !== 'p') return;
  c.msgs.splice(c.msgs.indexOf(m), 1); if (!input.value.trim()) { input.value = m.content; grow(); }
  if (!c.msgs.length) { chats = chats.filter((x) => x !== c); if (cur === c) cur = null; }
  saveChats(); renderList(); renderChat(); showNet();
}
function regenerate() { if (!cur || busy) return; while (cur.msgs.length && cur.msgs[cur.msgs.length - 1].role === 'assistant') cur.msgs.pop(); stopSpeak(); renderChat(); void ask(cur, cur.msgs.length - 1); }

/* ---------- attached files (sent once to the server, never stored there; only names and small thumbnails stay in history) ---------- */
const sent = new WeakMap<Msg, Att[]>();
let pend: Att[] = [];
const fileIn = $<HTMLInputElement>('#aifile'), pendEl = $('#aipend');
function renderPend() { pendEl.replaceChildren(); pendEl.hidden = !pend.length; if (pend.length) pendEl.append(fileRow(pend, (i) => { pend.splice(i, 1); renderPend(); })); }
const b64 = (buf: ArrayBuffer) => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const TEXT = /\.(txt|md|markdown|csv|tsv|json|xml|html?|css|js|mjs|ts|tsx|jsx|py|php|java|c|cc|cpp|h|cs|go|rs|rb|swift|kt|sql|sh|ya?ml|ini|log|srt|vtt)$/i;
async function shrink(file: File, max: number, q: number): Promise<string> {     /* image -> JPEG data URL, longest side <= max */
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height)); const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  return cv.toDataURL('image/jpeg', q);
}
async function addFiles(fl: FileList | File[]) {
  for (const f of Array.from(fl)) {
    if (pend.length >= 4) { flash(T('ai.f.many')); break; }
    try {
      if (/^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(f.type)) {
        if (f.size > 20e6) { flash(T('ai.f.big')); continue; }
        const full = await shrink(f, 1600, .86), th = await shrink(f, 96, .7);
        pend.push({ n: f.name, k: 'image', th, mime: 'image/jpeg', data: full.slice(full.indexOf(',') + 1) });
      } else if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        if (f.size > 4e6) { flash(T('ai.f.big')); continue; }
        pend.push({ n: f.name, k: 'pdf', mime: 'application/pdf', data: b64(await f.arrayBuffer()) });
      } else if (f.type.startsWith('text/') || TEXT.test(f.name) || f.type === 'application/json') {
        if (f.size > 200e3) { flash(T('ai.f.big')); continue; }
        const text = await f.text(); if (text.includes('\u0000')) { flash(T('ai.f.type')); continue; }
        pend.push({ n: f.name, k: 'text', mime: 'text/plain', text });
      } else flash(T('ai.f.type'));
    } catch { flash(T('ai.f.read')); }
  }
  renderPend();
}
$('#aiatt').onclick = () => fileIn.click();
fileIn.onchange = () => { if (fileIn.files) void addFiles(fileIn.files); fileIn.value = ''; };
const comp = $('#aicomp');
comp.addEventListener('dragover', (e) => { e.preventDefault(); comp.classList.add('drop'); });
comp.addEventListener('dragleave', () => comp.classList.remove('drop'));
comp.addEventListener('drop', (e) => { e.preventDefault(); comp.classList.remove('drop'); if (e.dataTransfer?.files.length) void addFiles(e.dataTransfer.files); });
input.addEventListener('paste', (e) => { const fs = Array.from(e.clipboardData?.files || []); if (fs.length) { e.preventDefault(); void addFiles(fs); } });

/* ---------- composer ---------- */
const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(200, input.scrollHeight) + 'px'; };
input.addEventListener('input', grow);
/* 0.9.19 (owner: "while typing, a message suddenly goes into the chat"). Root cause: on phones the keyboard's Enter key
   sent the half-typed message (Bengali keyboards also send Enter while still composing, keyCode 229). On touch phones
   Enter now makes a new line and only the send button sends, like WhatsApp; on a PC Enter still sends. */
const touchKb = matchMedia('(hover: none) and (pointer: coarse)');
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !touchKb.matches) { e.preventDefault(); submit(input.value); } });
send.onclick = () => { handsFree = false; if (busy) { abort?.abort(); stopSpeak(); } else submit(input.value); };
$('#ainew').onclick = newChat;
$('#aimenu').onclick = () => side.classList.toggle('open');
/* closing the chat list on a phone: the back button, a tap beside the panel, or a swipe back towards the edge */
const closeSide = () => side.classList.remove('open');
$('#aiback').onclick = closeSide; $('#aiscrim').onclick = closeSide;
{ let x0 = 0, y0 = 0; const rtl = document.dir === 'rtl';
  side.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  side.addEventListener('touchend', (e) => { const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && (rtl ? dx > 0 : dx < 0)) closeSide(); }, { passive: true }); }
document.querySelectorAll<HTMLButtonElement>('.aisug').forEach((b) => { b.onclick = () => submit(b.textContent || ''); });
$('#aidelall').onclick = () => { if (!confirm(T('ai.delallq'))) return; chats = []; cur = null; saveChats(); renderList(); renderChat(); showNet(); };

/* ---------- memory (this browser only) ---------- */
const memList = $('#aimeml'), callIn = $<HTMLInputElement>('#aicall'), memIn = $<HTMLInputElement>('#aimemin');
function renderMem() {
  memList.replaceChildren(); callIn.value = mem.call;
  if (!mem.items.length) { const p = document.createElement('li'); p.className = 'mono aiempty'; say(p, 'ai.memnone'); memList.append(p); }
  mem.items.forEach((x, i) => { const li = document.createElement('li'); const s = document.createElement('span'); s.textContent = x; const d = document.createElement('button'); d.type = 'button'; d.className = 'aidel'; d.textContent = '×'; d.setAttribute('aria-label', T('ai.del') + ': ' + x); d.onclick = () => { mem.items.splice(i, 1); store.set(K.mem, mem); renderMem(); }; li.append(s, d); memList.append(li); });
}
callIn.addEventListener('change', () => { mem.call = callIn.value.trim().slice(0, 40); store.set(K.mem, mem); });
$('#aimemf').addEventListener('submit', (e) => { e.preventDefault(); const v = memIn.value.trim().slice(0, 200); if (!v || mem.items.length >= 12) return; mem.items.push(v); memIn.value = ''; store.set(K.mem, mem); renderMem(); });

/* ---------- voice out ----------
   Two engines behind one queue of sentences:
   - "cloud": the owner's AI-cloned voice, made on the server (api/tts.php, ElevenLabs). Used when the site owner has
     turned it on. Each sentence is fetched while the previous one plays, so speech starts after the first sentence.
   - "browser": speechSynthesis, free, on the device. Used when the cloud voice is off, fails or runs out. */
const synth: SpeechSynthesis | null = 'speechSynthesis' in window ? speechSynthesis : null;
const TTS = I18N.root + 'api/tts.php';
let voices: SpeechSynthesisVoice[] = [], queue: string[] = [], qi = 0, lastText = '', paused = false, noBn = false;
let cloud = { ready: false, name: '', failed: false };
/* "natural": a free Google Gemini voice made on the server with the site's own Gemini key. Much better Bengali than most
   device voices (many phones and computers have none), but each sentence takes about 2-3 s to make. */
let nat = { ready: false, failed: false };
type Eng = 'clone' | 'natural' | '';
function engine(): Eng {
  const v = vs.voice;
  if (cloud.ready && !cloud.failed && (v === '' || v === '@clone')) return 'clone';
  /* the free Gemini voice: when chosen, or as the fallback when this device has no voice for the language */
  if (nat.ready && !nat.failed && (v === '@natural' || ((v === '' || v === '@clone' || v === '@auto') && !bestVoice(vs.lang)))) return 'natural';
  return '';
}
const au = new Audio(); au.preload = 'auto';
const pre = new Map<number, Promise<string | null>>();       // sentence index -> object URL of its audio
let gen = 0;                                                   // bumps on stop, so late audio is dropped
const useCloud = () => engine() !== '';
const canSpeak = () => !!synth || cloud.ready || nat.ready;
const speaking = () => (!!synth && synth.speaking) || !au.paused || queue.length > qi;
function bestVoice(lang: string): SpeechSynthesisVoice | null {
  const want = (LOC[lang] || lang).toLowerCase(), base = want.split('-')[0];
  const cand = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith(base));
  if (!cand.length) return null;
  const score = (v: SpeechSynthesisVoice) => (v.lang.toLowerCase().replace('_', '-') === want ? 4 : 0) + (/natural|neural|online|enhanced|premium|wavenet/i.test(v.name) ? 6 : 0) + (/google/i.test(v.name) ? 3 : 0) + (v.localService ? 0 : 1) + (v.default ? 1 : 0);
  return cand.sort((a, b) => score(b) - score(a))[0];
}
function pickVoice(): SpeechSynthesisVoice | null { return voices.find((v) => v.voiceURI === vs.voice && v.lang.toLowerCase().startsWith(vs.lang)) || bestVoice(vs.lang); }
/* Hard failures (credits, daily limit, key, switched off) turn the clone off for this visit. A slow or broken single
   clip only sends that one sentence to the browser voice; two in a row turn the clone off too. */
const HARD = ['cap', 'quota', 'wait', 'key', 'notready', 'origin'];
let soft = 0;
function clipReq(i: number, ms: number, e: Eng) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), e === 'natural' ? ms + 6000 : ms);
  const r = fetch(TTS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ text: queue[i], lang: vs.lang, voice: e === 'natural' ? 'natural' : 'clone' }) })
    .then(async (res) => { clearTimeout(timer); if (!res.ok || !(res.headers.get('content-type') || '').includes('audio')) { let c = 'other'; try { c = (await res.json()).code || c; } catch { /* */ } throw new Error(c); } return res; });
  r.catch(() => clearTimeout(timer));
  return { r, ctl };
}
function clipFailed(code: string, e: Eng) {
  if (HARD.includes(code)) { cloudFail(code, e); return; }
  if (++soft >= 2) cloudFail(code, e);
}
function fetchClip(i: number): Promise<string | null> {
  if (!pre.has(i)) {
    const g = gen, en = engine(), { r } = clipReq(i, 9000, en);
    pre.set(i, r.then((res) => res.blob()).then((b) => { soft = 0; return g === gen ? URL.createObjectURL(b) : null; })
      .catch((e: Error) => { if (g === gen) clipFailed(e.name === 'AbortError' ? 'slow' : e.message, en); return null; }));
  }
  return pre.get(i)!;
}
/* the clip that has to play right now is streamed: playback starts with the first audio bytes instead of the whole file */
const canStream = typeof MediaSource !== 'undefined' && MediaSource.isTypeSupported?.('audio/mpeg');
function streamClip(i: number, g: number): Promise<string | null> {
  const { r, ctl } = clipReq(i, 6000, 'clone');
  return r.then((res) => {
    if (g !== gen) { ctl.abort(); return null; }
    const ms = new MediaSource(), url = URL.createObjectURL(ms), rd = res.body!.getReader();
    ms.addEventListener('sourceopen', async () => {
      try {
        const sb = ms.addSourceBuffer('audio/mpeg');
        for (;;) {
          const { value, done } = await rd.read();
          if (done || g !== gen) break;
          sb.appendBuffer(value); await new Promise((ok) => sb.addEventListener('updateend', ok, { once: true }));
        }
        if (ms.readyState === 'open') ms.endOfStream();
      } catch { try { if (ms.readyState === 'open') ms.endOfStream(); } catch { /* */ } }
    }, { once: true });
    soft = 0; return url;
  }).catch((e: Error) => { if (g === gen) clipFailed(e.name === 'AbortError' ? 'slow' : e.message, 'clone'); return null; });
}
function cloudFail(code: string, e: Eng = 'clone') {
  const o = e === 'natural' ? nat : cloud;
  if (o.failed) return; o.failed = true;
  if (e === 'natural') flash(T('ai.tts.natfail'));
  else flash(T(code === 'cap' || code === 'quota' || code === 'wait' ? 'ai.tts.limit' : 'ai.tts.fail'));
  renderVoiceName(); voiceLabel();
}
function speakNext() {
  if (qi >= queue.length) {
    if (!busy) { setState('idle'); if (callOn && queue.length) { setTimeout(() => { if (callOn && !busy && !speaking()) startListening(); }, 350); } else if (handsFree && vs.mode && queue.length) { handsFree = false; setTimeout(() => { if (!busy && !speaking()) startListening(); }, 600); } }
    renderPlayer(); return;
  }
  if (useCloud()) {
    const i = qi, g = gen;
    const clip = !pre.has(i) && canStream && engine() === 'clone' ? streamClip(i, g) : fetchClip(i);
    if (!pre.has(i)) pre.set(i, clip);
    setState('think');
    clip.then((url) => {
      if (g !== gen) return;
      if (!url) { pre.delete(i); playBrowser(); return; }          // this sentence goes to the browser voice
      au.src = url; au.playbackRate = vs.rate; au.volume = vs.vol; void outCtx?.resume().catch(() => {});
      au.onended = () => { URL.revokeObjectURL(url); pre.delete(i); if (g === gen) { qi++; speakNext(); } };
      au.play().then(() => { setState('speak'); renderPlayer(); }).catch(() => { cloudFail('play', engine()); pre.delete(i); playBrowser(); });
      for (let k = i + 1; k <= i + 2 && k < queue.length; k++) void fetchClip(k);   // fetch the next two while this one plays
    });
    return;
  }
  playBrowser();
}
function playBrowser() {
  if (!synth) { qi++; speakNext(); return; }
  const u = new SpeechSynthesisUtterance(queue[qi]); let v = pickVoice();
  /* never read Bengali script with an English voice (it comes out as silence or nonsense) */
  if (/\p{Script=Bengali}/u.test(queue[qi]) && !v?.lang.toLowerCase().startsWith('bn')) {
    v = bestVoice('bn');
    if (!v) { if (!noBn) { noBn = true; flash(T('ai.vnone')); } qi++; speakNext(); return; }
  }
  if (v) u.voice = v; u.lang = v?.lang || LOC[vs.lang] || vs.lang; u.rate = vs.rate; u.pitch = vs.pitch; u.volume = vs.vol;
  u.onstart = () => { setState('speak'); renderPlayer(); };
  u.onboundary = () => { pulse = 1; };
  u.onend = () => { qi++; speakNext(); };
  u.onerror = (e) => { if ((e as SpeechSynthesisErrorEvent).error !== 'interrupted' && (e as SpeechSynthesisErrorEvent).error !== 'canceled') { qi++; speakNext(); } };
  synth.speak(u);
}
function idleNow() { return au.paused && !(synth && (synth.speaking || synth.pending)) && pre.size === 0; }
function enqueue(piece: string) {
  queue.push(piece);
  if (qi === queue.length - 1 && idleNow()) speakNext();
  else if (useCloud() && queue.length - 1 <= qi + 2) void fetchClip(queue.length - 1);
  renderPlayer();
}
function speak(text: string, fromStart = true) {
  if (!canSpeak()) return; stopSpeak(); lastText = text;
  const plain = speakable(text, T('ai.codeomit')); queue = quickStart(chunks(plain)); qi = 0; void fromStart;
  if (!useCloud() && !pickVoice()) { flash(T('ai.vnone')); }
  speakNext();
}
function stopSpeak() {
  gen++; queue = []; qi = 0; paused = false;
  au.pause(); au.removeAttribute('src'); pre.forEach((p) => p.then((u) => u && URL.revokeObjectURL(u))); pre.clear();
  synth?.cancel(); if (!busy) setState('idle'); renderPlayer();
}
const player = $('#aiplay');
function renderPlayer() {
  const on = (!!synth && (synth.speaking || synth.paused)) || !au.paused || queue.length > qi || paused;
  player.hidden = !on && !lastText;
  $<HTMLButtonElement>('#aipp').textContent = T(paused ? 'ai.resume' : 'ai.pause');
  $<HTMLButtonElement>('#aipp').disabled = !on; $<HTMLButtonElement>('#aist').disabled = !on;
}
$('#aipp').onclick = () => {
  const c = !!au.src && (!au.paused || paused) && !(synth?.speaking);
  if (paused) { if (c) void au.play(); else synth?.resume(); paused = false; setState('speak'); }
  else { if (c) au.pause(); else synth?.pause(); paused = true; setState('idle'); }
  renderPlayer();
};
$('#aist').onclick = stopSpeak;
$('#airp').onclick = () => { const last = cur?.msgs.filter((m) => m.role === 'assistant' && !m.err).pop(); if (last) speak(last.content); else if (lastText) speak(lastText); };
addEventListener('pagehide', () => { synth?.cancel(); au.pause(); });
if (synth) { const load = () => { voices = synth.getVoices(); fillVoices(); }; load(); synth.addEventListener?.('voiceschanged', load); }
else if (!cloud.ready) $('#aivset').hidden = true;

/* voice settings panel */
vLang.innerHTML = Object.keys(LOC).map((l) => `<option value="${l}">${LNAME[l]}</option>`).join(''); vLang.value = vs.lang;
function renderVoiceName() { const n = $('#aivname'), e = engine(); n.hidden = !e; if (e) n.textContent = e === 'clone' ? T('ai.tts.label').split('{name}').join(cloud.name) : T('ai.tts.natlabel'); }
function fillVoices() {
  const base = vs.lang; const opts = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  vSel.replaceChildren();
  const srv = cloud.ready || nat.ready;
  if (cloud.ready) vSel.append(new Option(T('ai.tts.opt').split('{name}').join(cloud.name), '@clone'));
  if (nat.ready) vSel.append(new Option(T('ai.tts.natopt'), '@natural'));
  vSel.append(new Option(T('ai.vauto') + (bestVoice(base) ? ' · ' + bestVoice(base)!.name : ''), srv ? '@auto' : ''));
  opts.forEach((v) => vSel.append(new Option(`${v.name} (${v.lang})`, v.voiceURI)));
  vSel.value = cloud.ready && (vs.voice === '' || vs.voice === '@clone') ? '@clone'
    : nat.ready && (vs.voice === '' || vs.voice === '@natural' || vs.voice === '@clone') ? '@natural'
    : opts.some((v) => v.voiceURI === vs.voice) ? vs.voice : (srv ? '@auto' : '');
  $('#aivnone').hidden = opts.length > 0 || srv;
  renderVoiceName();
}
const saveV = () => store.set(K.voice, vs);
vLang.onchange = () => { vs.lang = vLang.value; vs.langSet = true; if (vs.voice !== '@clone' && vs.voice !== '@auto') vs.voice = ''; saveV(); fillVoices(); if (rec) rec.lang = LOC[vs.lang]; };
vSel.onchange = () => { vs.voice = vSel.value; cloud.failed = false; nat.failed = false; saveV(); renderVoiceName(); };
(['rate', 'pitch', 'vol'] as const).forEach((k) => { const r = $<HTMLInputElement>('#ai' + k); r.value = String(vs[k]); const o = r.nextElementSibling as HTMLOutputElement; o.value = (+r.value).toFixed(1); r.oninput = () => { vs[k] = +r.value; o.value = (+r.value).toFixed(1); saveV(); if (k === 'rate') au.playbackRate = vs.rate; if (k === 'vol') au.volume = vs.vol; }; });
$('#aivtest').onclick = () => speak(T(engine() === 'clone' ? 'ai.tts.testline' : 'ai.vtestline').split('{name}').join(cloud.name));
vs.mode = false;   /* voice-mode switch and mic button hidden at the owner's request (20 Nov): the call button does voice now */
const vmode = $<HTMLInputElement>('#aivmode'); vmode.checked = vs.mode; vmode.onchange = () => { vs.mode = vmode.checked; saveV(); if (!vs.mode) stopSpeak(); };
/* is the owner's cloned voice switched on for this site? */
fetch(TTS, { headers: { Accept: 'application/json' } }).then((r) => r.json()).then((j) => {
  if (j.ready) cloud = { ready: true, name: j.name || 'Abid Islam', failed: false };
  if (j.natural) nat = { ready: true, failed: false };
  if (j.ready || j.natural) { ttsOn = true; $('#aivset').hidden = false; fillVoices(); if (!busy) renderChat(); }
}).catch(() => { /* no server or switched off: browser voice only */ });

/* ---------- voice in: Web Speech API ---------- */
type SR = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; onstart: (() => void) | null };
const SRC = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
let rec: SR | null = null, listening = false, finalText = '', baseText = '';
const flashEl = $('#aiflash');
function flash(msg: string) { flashEl.textContent = msg; flashEl.hidden = false; clearTimeout((flash as any).t); (flash as any).t = setTimeout(() => { flashEl.hidden = true; }, 7000); }
if (!SRC) { micB.disabled = true; micB.title = T('ai.nomic'); }
function startListening() {
  if (!SRC || listening) return;
  stopSpeak(); meterOff();
  rec = new SRC() as SR; rec.lang = LOC[vs.lang] || 'en-US'; rec.interimResults = true; rec.continuous = false;
  baseText = input.value ? input.value.trim() + ' ' : ''; finalText = '';
  rec.onstart = () => { listening = true; micB.setAttribute('aria-pressed', 'true'); say(micB.querySelector('span')!, 'ai.micstop'); setState('listen'); if (callOn && listenMeter) meterOn(true); };
  rec.onresult = (e: any) => {
    let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; }
    input.value = baseText + finalText + interim; input.classList.toggle('interim', !!interim); grow();
    if (callOn) { callText(finalText + interim, true); pulse = 1; }
  };
  rec.onerror = (e: any) => {
    const m: Record<string, string> = { 'not-allowed': 'ai.e.denied', 'service-not-allowed': 'ai.e.denied', 'audio-capture': 'ai.e.nomic', 'no-speech': 'ai.e.nospeech', network: 'ai.e.net', 'language-not-supported': 'ai.e.lang' };
    if (callOn && e.error === 'no-speech') return;                    /* in a call, silence just means: listen again */
    if (callOn && (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture')) { endCall(); }
    if (e.error !== 'aborted') flash(T(m[e.error] || 'ai.e.other'));
  };
  rec.onend = () => {
    listening = false; micB.setAttribute('aria-pressed', 'false'); say(micB.querySelector('span')!, 'ai.mic'); input.classList.remove('interim');
    if (state === 'listen') setState('idle');
    if (callOn) { if (muted) return; if (finalText.trim()) { quiet = 0; logTurn('me', finalText.trim()); submit(input.value); } else if (++quiet < 6) setTimeout(() => { if (callOn && !busy && !speaking()) startListening(); }, 250); else callPause(); return; }
    if (vs.mode && finalText.trim()) { handsFree = true; submit(input.value); }     /* voice mode: send what was said */
  };
  try { rec.start(); } catch { flash(T('ai.e.other')); }
}
const ask1 = $('#aimicask');
micB.onclick = () => {
  if (listening) { rec?.stop(); return; }
  let ok = false; try { ok = localStorage.getItem('abidora.ai.micok') === '1'; } catch { /* blocked */ }
  if (ok) startListening(); else { ask1.hidden = false; ($('#aimicyes') as HTMLButtonElement).focus(); }
};
$('#aimicyes').onclick = () => { ask1.hidden = true; try { localStorage.setItem('abidora.ai.micok', '1'); } catch { /* blocked */ } if (callWant) { callWant = false; startCall(); } else startListening(); };
$('#aimicno').onclick = () => { ask1.hidden = true; callWant = false; micB.focus(); };

/* ---------- voice call: talk hands-free like a phone call ----------
   listen -> send what was said -> speak the answer while it streams -> listen again. Speaking (or tapping the circle)
   while Abidora AI talks stops it and listens. The microphone is only open while the call screen is open: speech
   recognition for the words, and during the answer a level meter (nothing recorded) to notice that you started talking. */
const callV = $('#aicallv'), callB = $<HTMLButtonElement>('#aicallb'), cOrb = $<HTMLButtonElement>('#aivcorb'), cSt = $('#aivcst'), cTx = $('#aivctx'), cLang = $<HTMLSelectElement>('#aivclang');
let quiet = 0, callWant = false, paused2 = false, muted = false, av: ReturnType<typeof avatar> | null = null;
const cLog = $('#aivclog'), cLogW = $('#aivclogw'), cVoice = $('#aivcvoice'), cVSel = $<HTMLSelectElement>('#aivcvsel');
/* sharing the microphone between speech recognition and a level meter is fine on computers, not on Android phones */
const listenMeter = !/Android/i.test(navigator.userAgent);
cLang.innerHTML = vLang.innerHTML;
function callState() {
  if (!callOn) return;
  cSt.textContent = T(muted ? 'ai.vc.muted' : paused2 ? 'ai.vc.paused' : state === 'listen' ? 'ai.vc.listen' : state === 'think' ? 'ai.vc.think' : state === 'speak' ? 'ai.vc.speak' : 'ai.vc.listen');
  av?.set(muted && state !== 'speak' ? 'muted' : paused2 && state === 'idle' ? 'idle' : state === 'idle' ? 'listen' : state);
  if (live) return;                                    // the live call hears interruptions itself
  if (state === 'speak' && !muted) { if (micAn && !mBarge) meterOff(); meterOn(); } else if (!(state === 'listen' && listenMeter)) meterOff();
}
function callText(t: string, mine = false) { cTx.textContent = mine ? t : speakable(t, ''); cTx.style.opacity = mine ? '.75' : '1'; cTx.scrollTop = cTx.scrollHeight; }   // full text; the box scrolls to the newest words
function callPause() { paused2 = true; quiet = 0; callState(); }
function logTurn(who: 'me' | 'ai', text: string) {
  const li = document.createElement('li'); li.className = 'lg-' + who; const b = document.createElement('b'); b.textContent = who === 'me' ? T('ai.vc.you') : 'Abidora AI';
  li.append(b, document.createTextNode(text)); cLog.append(li); while (cLog.children.length > 40) cLog.firstChild?.remove(); cLogW.scrollTop = cLogW.scrollHeight;
}
function voiceLabel() { const e = engine(); cVoice.textContent = e === 'clone' ? T('ai.tts.label').split('{name}').join(cloud.name) : e === 'natural' ? T('ai.tts.natlabel') : bestVoice(vs.lang) ? T('ai.vc.dev') : T('ai.vnone'); }
function callListen() { if (muted) return; paused2 = false; quiet = 0; if (busy) abort?.abort(); stopSpeak(); meterOff(); startListening(); callState(); }
function callAfter(out: Msg) {
  if (out.err) { cSt.textContent = T('ai.err.' + out.err); paused2 = true; av?.set('idle'); logTurn('ai', T('ai.err.' + out.err)); return; }
  const said = speakable(out.content, T('ai.codeomit')).trim(); if (said) logTurn('ai', said + (out.content === T('ai.stopped') ? '' : ''));
  if (!speaking() && !muted) setTimeout(() => { if (callOn && !muted && !busy && !speaking() && !listening) startListening(); }, 350);
}
/* the language the call listens in. Speech recognition needs one fixed language: Bengali speech heard as English becomes
   nonsense (owner test, 20 Nov). Until the visitor picks one, guess from this chat, the browser languages and the time zone. */
const BANGLISH = /\b(ami|amar|tumi|tomar|apni|apnar|ki|kemon|keno|kothay|kivabe|acho|achen|ache|korbo|korte|koro|kore|chai|bolo|bolen|ekta|ekhon|bhalo|valo|hobe|theke|jonno|kintu|onek|kichu|nai|nei)\b/gi;
function guessCallLang(): string {
  if (vs.lang === 'bn') return 'bn';
  const mine = (cur?.msgs || []).filter((m) => m.role === 'user').slice(-4).map((m) => m.content).join(' ');
  if (/\p{Script=Bengali}/u.test(mine) || (mine.match(BANGLISH) || []).length >= 2) return 'bn';
  const nav = (navigator.languages || [navigator.language]).map((l) => (l || '').toLowerCase());
  if (nav.some((l) => l.startsWith('bn'))) return 'bn';
  let tz = ''; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* */ }
  if (tz === 'Asia/Dhaka') return 'bn';
  return vs.lang;
}
/* ---------- live call (speech to speech, Gemini Live), used when the site offers it; otherwise the call above ---------- */
const LIVE = I18N.root + 'api/live.php';
/* remember which Google live model last worked (for an hour), so the next call starts on it straight away
   instead of first waiting for a used-up one to fail */
let handoff = false;   // the next live session starts as a handed-over call
let liveAlt = (() => { try { const v = JSON.parse(localStorage.getItem('abidora.ai.livealt') || 'null'); return v && Date.now() - v.t < 3600e3 ? Math.min(3, Math.max(0, v.a | 0)) : 0; } catch { return 0; } })();
const keepAlt = () => { try { localStorage.setItem('abidora.ai.livealt', JSON.stringify({ a: liveAlt, t: Date.now() })); } catch { /* */ } };
let liveAlt0 = 0;   // which Google live model to use: 0 = main, 1..3 = backups with their own free limits
let live: Live | null = null, liveOk = true, liveFail = false, liveGen = 0, liveDrop = false, hidAt = 0;   // tried until the server says it is not offered
fetch(LIVE, { headers: { Accept: 'application/json' } }).then((r) => r.json()).then((j) => { liveOk = !!j.ready; }).catch(() => { liveOk = false; });
function pushTurn(role: 'user' | 'assistant', text: string) {
  text = text.trim(); if (!text) return;
  if (!cur) { cur = { id: uid(), title: text.replace(/\s+/g, ' ').slice(0, 48), ts: Date.now(), msgs: [] }; chats.unshift(cur); }
  cur.msgs.push({ role, content: text }); cur.ts = Date.now(); saveChats(); renderList(); renderChat();
}
/* the two live voices each have a face: the founder's own photo for the male voice and, with her permission, a
   portrait for the female voice. The label still says plainly that the voice is an AI, not that person. */
const FACES: Record<'m' | 'f', { src: string; x: number; y: number; w: number }> = {
  m: { src: I18N.root + 'assets/call/voice-m2.webp', x: .5, y: .71, w: .2 },   // owner's own photo (masked), chosen by him on 20 Nov
  f: { src: I18N.root + 'assets/call/voice-f.webp', x: .49, y: .686, w: .19 },
};
function goLive() {
  const g = ++liveGen; setState('think'); cVoice.textContent = T('ai.vc.livelabel'); av?.photo(FACES[vs.live]);
  /* two fixed voices, the same on every device: male or female */
  cVSel.replaceChildren(new Option(T('ai.vc.male'), 'm'), new Option(T('ai.vc.female'), 'f')); cVSel.value = vs.live;
  /* what the call should know: the visitor's saved memory, their name, and the last turns of this chat */
  const recent = (cur?.msgs || []).slice(-10).map((m) => ({ role: m.role, content: String(m.content).slice(0, 400) }));
  const ho = handoff; handoff = false;
  void startLive(LIVE, vs.lang, vs.live, { memory: mem.items, call: mem.call, recent, alt: liveAlt, handoff: ho }, {
    state: (st) => { if (g === liveGen && callOn) setState(st); },
    heard: (t, fin) => { if (g !== liveGen) return; callText(t, true); if (fin) { logTurn('me', t); pushTurn('user', t); } },
    said: (t, fin) => { if (g !== liveGen) return; callText(t); if (fin) { logTurn('ai', t); pushTurn('assistant', t); } },
    name: (n) => { if (g !== liveGen) return; mem.call = n; store.set(K.mem, mem); },
    /* "give me the girl" / "give me the boy": switch voice and photo, and the new voice greets the visitor */
    bye: () => { if (g !== liveGen || !callOn) return; endCall(); },
    handover: (to) => { if (g !== liveGen || !callOn) return; vs.live = to; saveV(); cVSel.value = to; handoff = true; stopLive(); goLive(); },
    fail: (code) => {
      if (g !== liveGen) return; live = null; if (!callOn) return;
      if (code === 'mic') { cSt.textContent = T('ai.vc.nomic'); paused2 = true; av?.set('idle'); return; }
      /* 0.9.19 (owner: "chrome theke bair hoileo sona jabe"): a phone stops the microphone and the connection when the
         visitor leaves the browser. That is not a broken model, so do not switch to a backup voice: wait, and pick the
         call up again by itself the moment the visitor comes back (see visibilitychange below). */
      if (document.hidden || Date.now() - hidAt < 4000) { liveDrop = true; setState('idle'); cSt.textContent = T('ai.vc.bgnote'); return; }
      /* no silent fallback to the old device-voice call: say plainly why the live voice could not start, keep the
         photo, and let a tap on the circle try again (owner, 20 Nov: the call "suddenly" lost its voice and photo) */
      /* "keep another way" (owner, 20 Nov): if this Google model is used up or down, switch to the next one by itself */
      if (!['wait', 'notready', 'origin'].includes(code) && liveAlt < 3) { liveAlt++; cSt.textContent = T('ai.vc.lf.switch'); goLive(); return; }
      liveFail = true; setState('idle');
      const why = ['wait', 'quota', 'notready', 'network', 'down', 'origin'].includes(code) ? code : 'down';
      cSt.textContent = T('ai.vc.lf.' + why); cTx.textContent = T('ai.vc.lf.retry') + ' (' + code + ')'; cTx.style.opacity = '.8';
    },
  }).then((l) => { if (!l) return; keepAlt(); if (g !== liveGen || !callOn) { l.stop(); return; } live = l; if (muted) l.mute(true); });
}
/* sound test: a short beep through a plain <audio> element (not the call's audio path), so the visitor can tell
   a device/volume problem from a call problem */
function beepWav(): string {
  const sr = 22050, n = Math.round(sr * 0.5), b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, f = t < 0.22 ? 660 : 880, e = Math.min(1, t * 60) * Math.min(1, (0.5 - t) * 20); v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * e * 0.4 * 32767, true); }
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
}
let beepUrl = '';
$<HTMLButtonElement>('#aivctest').onclick = () => {
  beepUrl ||= beepWav(); const a = new Audio(beepUrl); a.volume = 1;
  cSt.textContent = T('ai.vc.testq');
  void a.play().catch(() => { cSt.textContent = T('ai.vc.testq') + ' (blocked)'; });
};
function stopLive() { liveGen++; live?.stop(); live = null; }
function startCall() {
  if (!SRC && !liveOk) { flash(T('ai.vc.nosr')); return; }
  let ok = false; try { ok = localStorage.getItem('abidora.ai.micok') === '1'; } catch { /* blocked */ }
  if (!ok) { callWant = true; ask1.hidden = false; ($('#aimicyes') as HTMLButtonElement).focus(); return; }
  if (!vs.langSet) { const g = guessCallLang(); if (g !== vs.lang) { vs.lang = g; vLang.value = g; saveV(); fillVoices(); } cLang.classList.add('hint'); }
  callOn = true; paused2 = false; muted = false; quiet = 0; cLang.value = vs.lang; callV.hidden = false; document.body.classList.add('incall');
  cTx.textContent = ''; cLog.replaceChildren(); setMute(false);
  cVSel.innerHTML = vSel.innerHTML; cVSel.value = vSel.value; voiceLabel();
  av ??= avatar($<HTMLCanvasElement>('#aivcav')); outMeter(); levelLoop();
  $<HTMLButtonElement>('#aivcend').focus({ preventScroll: true });
  if (liveOk && !liveFail) goLive(); else callListen();
}
function endCall() {
  if (!callOn) return; callOn = false; paused2 = false; stopLive(); liveFail = false; liveDrop = false; av?.photo(null);   // the next call tries the live voice again
  if (busy) abort?.abort(); stopSpeak(); meterOff(); try { rec?.abort(); } catch { /* not running */ }
  callV.hidden = true; document.body.classList.remove('incall'); setState('idle'); cancelAnimationFrame(lvRaf); callB.focus({ preventScroll: true });
}
function setMute(m: boolean) {
  live?.mute(m);
  muted = m; const b = $<HTMLButtonElement>('#aivcmute'); b.setAttribute('aria-pressed', String(m)); say(b.querySelector('span')!, m ? 'ai.vc.unmute' : 'ai.vc.mute');
  if (m) { try { rec?.abort(); } catch { /* */ } meterOff(); } callState();
}
$('#aivcmute').onclick = () => { if (!callOn) return; setMute(!muted); if (!live && !muted && !speaking() && !busy) callListen(); };
$('#aivclogb').onclick = () => { const o = cLogW.hidden; cLogW.hidden = !o; $('#aivclogb').setAttribute('aria-expanded', String(o)); if (o) cLogW.scrollTop = cLogW.scrollHeight; };
cVSel.onchange = () => {
  if (live || (callOn && liveOk && !liveFail)) { vs.live = cVSel.value === 'f' ? 'f' : 'm'; saveV(); stopLive(); goLive(); return; }
  vs.voice = cVSel.value; vSel.value = vs.voice; cloud.failed = false; nat.failed = false; saveV(); renderVoiceName(); voiceLabel(); };

/* live level for the avatar: the real loudness of the cloned voice (Web Audio), the microphone level while you speak
   (where the phone allows the microphone to be shared with speech recognition), or word-by-word pulses from the device voice */
let outCtx: AudioContext | null = null, outAn: AnalyserNode | null = null, lvRaf = 0, pulse = 0;
const lvBuf = new Float32Array(1024);
function outMeter() {
  if (outCtx) { void outCtx.resume().catch(() => {}); return; }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    outCtx = new AC(); outAn = outCtx.createAnalyser(); outAn.fftSize = 1024;
    const src = outCtx.createMediaElementSource(au); src.connect(outAn); outAn.connect(outCtx.destination);
  } catch { outCtx = null; outAn = null; }
}
const rmsOf = (an: AnalyserNode) => { an.getFloatTimeDomainData(lvBuf); let q = 0; for (let i = 0; i < lvBuf.length; i++) q += lvBuf[i] * lvBuf[i]; return Math.sqrt(q / lvBuf.length); };
function levelLoop() {
  cancelAnimationFrame(lvRaf);
  const tick = () => {
    if (!callOn) return;
    let v = 0;
    if (live) v = state === 'speak' ? live.level() : state === 'listen' ? .12 : .05;
    else if (state === 'speak') { if (!au.paused && outAn) v = Math.min(1, rmsOf(outAn) * 5); else { pulse *= .9; v = pulse * .8; } }
    else if (state === 'listen') { if (micAn) v = Math.min(1, rmsOf(micAn) * 7); else { pulse *= .92; v = .12 + pulse * .6; } }
    av?.level(v); lvRaf = requestAnimationFrame(tick);
  };
  lvRaf = requestAnimationFrame(tick);
}
callB.onclick = () => startCall();
$('#aivcend').onclick = endCall;
cOrb.onclick = () => { if (!callOn) return; if (liveFail && liveOk) { liveFail = false; liveAlt = 0; goLive(); return; } if (live) { live.hush(); return; } if (listening) { rec?.stop(); return; } callListen(); };
cLang.onchange = () => { vs.lang = cLang.value; vs.langSet = true; cLang.classList.remove('hint'); if (live) { stopLive(); saveV(); goLive(); return; } vLang.value = vs.lang; saveV(); fillVoices(); if (listening) { try { rec?.abort(); } catch { /* */ } setTimeout(callListen, 200); } };
addEventListener('keydown', (e) => { if (e.key === 'Escape' && callOn) endCall(); });
addEventListener('pagehide', endCall);
/* 0.9.19: back from another app or tab during a call: if the phone stopped the microphone or the connection,
   start the live voice again by itself (no greeting, it was open moments ago) and say so in one line */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hidAt = Date.now(); return; }
  hidAt = Date.now();   // the socket may report its close a moment after we are visible again
  if (!callOn || paused2) return;
  const back = () => { cSt.textContent = T('ai.vc.resumed'); };
  if (live) { if (!live.alive()) { stopLive(); liveDrop = false; goLive(); back(); } return; }
  if (liveDrop) { liveDrop = false; liveFail = false; goLive(); back(); return; }
  if (!liveFail && !muted && !busy && !speaking() && !listening) { callListen(); back(); }   // the device-voice call
});

/* barge-in: while the answer plays, a level meter (echo cancelled) notices when you start talking */
let mStream: MediaStream | null = null, mCtx: AudioContext | null = null, mRaf = 0, mGen = 0;
let micAn: AnalyserNode | null = null, mBarge = false;
function meterOn(listenOnly = false) {
  if (!callOn || muted || mStream || !navigator.mediaDevices?.getUserMedia) return;
  const my = ++mGen;
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then((st) => {
    if (my !== mGen || !callOn || state !== (listenOnly ? 'listen' : 'speak')) { st.getTracks().forEach((t) => t.stop()); return; }
    mStream = st; const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    mCtx = new AC(); void mCtx.resume().catch(() => {}); const an = mCtx.createAnalyser(); an.fftSize = 1024; mCtx.createMediaStreamSource(st).connect(an); micAn = an;
    mBarge = !listenOnly; if (listenOnly) return;   /* while you talk the meter only feeds the avatar */
    const buf = new Float32Array(an.fftSize); const t0 = performance.now(); let base = 0, n = 0, loud = 0;
    const tick = () => {
      if (!mStream) return; an.getFloatTimeDomainData(buf); let sum = 0; for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length), el = performance.now() - t0;
      if (el < 700) { base += rms; n++; }                                   /* learn how loud the room and the echo are */
      else { const thr = Math.max(.045, (base / Math.max(1, n)) * 3); loud = rms > thr ? loud + 1 : Math.max(0, loud - 1); if (loud > 12) { callListen(); return; } }
      mRaf = requestAnimationFrame(tick);
    };
    mRaf = requestAnimationFrame(tick);
  }).catch(() => { /* no meter: tapping the circle still interrupts */ });
}
function meterOff() { micAn = null; mBarge = false; mGen++; cancelAnimationFrame(mRaf); mStream?.getTracks().forEach((t) => t.stop()); mStream = null; void mCtx?.close().catch(() => {}); mCtx = null; }

/* ---------- panels ---------- */
document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach((b) => {
  const p = document.getElementById(b.dataset.panel!)!;
  b.onclick = () => { const o = p.hidden; document.querySelectorAll<HTMLElement>('.aipanel').forEach((x) => { x.hidden = true; }); p.hidden = !o; if (o) side.classList.remove('open');   /* on a phone the chat list would cover the panel */ b.setAttribute('aria-expanded', String(o)); if (o) { if (b.dataset.panel === 'aimem') renderMem(); (p.querySelector('input,select,button') as HTMLElement | null)?.focus(); } };
});
document.querySelectorAll<HTMLButtonElement>('.aiclose').forEach((b) => { b.onclick = () => { (b.closest('.aipanel') as HTMLElement).hidden = true; }; });
addEventListener('keydown', (e) => { if (e.key === 'Escape') { document.querySelectorAll<HTMLElement>('.aipanel').forEach((x) => { x.hidden = true; }); side.classList.remove('open'); } });

/* phones: keep the chat exactly as tall as the visible screen, also while the keyboard is open */
{
  const vv = window.visualViewport;
  const fit = () => { if (vv) document.documentElement.style.setProperty('--vvh', Math.round(vv.height) + 'px'); };
  if (vv) { vv.addEventListener('resize', fit); fit(); }
  const note = document.getElementById('ainotem');
  if (note) { const t = () => note.classList.toggle('open'); note.addEventListener('click', t); note.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } }); }
}

/* ---------- start ---------- */
setState('idle'); renderList(); renderChat(); renderPlayer(); grow();
/* no server behind this page (the design preview, or a broken upload): say so plainly instead of pretending */
/* offline: no check now (the offline bar says it); a network failure is not "no server" */
function checkServer() {
  fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' }).then((r) => { app.markUp(); return r.json().catch(() => { throw new Error('nojson'); }); })
    .then((j) => { noServer = false; if (!j.ready) { banner.hidden = false; say(banner, 'ai.err.notready'); } else if (banner.dataset.k === 'preview') banner.hidden = true; })
    .catch((e) => { if ((e as Error).message === 'nojson') { noServer = true; banner.hidden = false; banner.dataset.k = 'preview'; say(banner, 'ai.err.preview'); } else app.markDown(); });
}
if (navigator.onLine) checkServer();

/* ---------- app: install, offline queue, Data Saver, delete this device's data ---------- */
initApp({ chats: () => chats.length, beforeWipe: () => { abort?.abort(); clearTimeout(retryT); } });
app.onNet(() => { showNet(); if (navigator.onLine) { if (noServer || !banner.hidden) checkServer(); void sync(); } });
addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void sync(); });
/* another tab changed the chats (or sent waiting messages): show the newest copy */
addEventListener('storage', (e) => {
  if (e.key !== K.chats || busy) return;
  const id = cur?.id; chats = store.get<Chat[]>(K.chats, []).filter((c) => c && Array.isArray(c.msgs)); cur = id ? chats.find((c) => c.id === id) || null : null;
  renderList(); renderChat(); showNet();
});
showNet(); void sync();

/* 0.9.17 (owner): phone only (CSS limits it): hide attach + shape buttons while the visitor is typing; they come back when the box is empty or loses focus */
{
  const comp = document.getElementById('aicomp');
  const sync = () => comp?.classList.toggle('typing', document.activeElement === input && input.value.trim() !== '');
  ['input', 'focus', 'blur'].forEach((ev) => input.addEventListener(ev, sync));
  send.addEventListener('click', () => setTimeout(sync, 0));
}

/* 0.9.17 (owner): soft Messenger-like sounds, made in the browser (no file to download): a light "pop" when a message is sent and a soft "tick" when the reply arrives */
let chimeCtx: AudioContext | null = null;
function chime(kind: 'send' | 'recv') {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext; if (!AC) return;
    chimeCtx ||= new AC(); const ctx = chimeCtx; if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    if (kind === 'send') { o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(880, t + .09); }
    else { o.frequency.setValueAtTime(990, t); o.frequency.exponentialRampToValueAtTime(740, t + .12); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === 'send' ? .07 : .05, t + .015); g.gain.exponentialRampToValueAtTime(0.0001, t + .18);
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + .2);
  } catch { /* sound is optional */ }
}
