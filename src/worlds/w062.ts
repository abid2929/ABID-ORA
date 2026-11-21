/* 062 Blockchain Learning Space. How a blockchain actually works, with real SHA-256 written for this world
   (checked against the standard test vectors) and nothing pretend:
   · Hash lab: type or open a file and see its SHA-256 fingerprint; change one letter and see about half
     of the 256 bits flip (the avalanche effect).
   · Chain: blocks that each hold data, the previous block's hash and a nonce. Mining searches for a
     nonce that makes the hash start with enough zeros. Edit any block and it, and every block after
     it, breaks until re-mined.
   · Peers: three copies of the same chain. Tamper with one, re-mine it, and see the others still agree;
     then let the tampering peer out-mine everyone and see why "most work wins" is both the rule and the risk.
   No coins, wallets, accounts or network: it is a model that runs only in this page. */
import { type Ctx, h, layout, heading, note, range, seg, stats, buttons } from './kit';

/* ---------- SHA-256 (FIPS 180-4) ---------- */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
const Wbuf = new Uint32Array(64);
export function sha256Bytes(msg: Uint8Array): Uint8Array {
  const l = msg.length, nb = ((l + 9 + 63) >> 6) << 6, b = new Uint8Array(nb); b.set(msg); b[l] = 0x80;
  const bits = l * 8, dv = new DataView(b.buffer); dv.setUint32(nb - 4, bits >>> 0); dv.setUint32(nb - 8, Math.floor(bits / 0x100000000));
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a, h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19; const W = Wbuf;
  for (let o = 0; o < nb; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const a = W[i - 15], c = W[i - 2]; const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((c >>> 17) | (c << 15)) ^ ((c >>> 19) | (c << 13)) ^ (c >>> 10); W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0; }
    let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g), t1 = (hh + S1 + ch + K[i] + W[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10)), mj = (a & bb) ^ (a & c) ^ (bb & c), t2 = (S0 + mj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + bb) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer); [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => ov.setUint32(i * 4, v >>> 0)); return out;
}
const enc = new TextEncoder();
export const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export const sha256 = (s: string) => hex(sha256Bytes(enc.encode(s)));
export function bitDiff(a: string, b: string) { let n = 0; for (let i = 0; i < a.length; i += 2) { let x = parseInt(a.slice(i, i + 2), 16) ^ parseInt(b.slice(i, i + 2), 16); while (x) { n += x & 1; x >>= 1; } } return n; }

/* ---------- blocks ---------- */
export interface Block { i: number; data: string; prev: string; nonce: number; hash: string }
export const ZERO = '0'.repeat(64);
export const blockHash = (b: Pick<Block, 'i' | 'data' | 'prev' | 'nonce'>) => sha256(`${b.i}|${b.prev}|${b.data}|${b.nonce}`);
export const meets = (hash: string, diff: number) => hash.startsWith('0'.repeat(diff));
/** a block is valid when its stored hash is its real hash, meets the difficulty, and links to the block before */
export function validity(chain: Block[], diff: number) {
  const ok: boolean[] = []; let broken = false;
  chain.forEach((b, k) => { const real = blockHash(b), good = !broken && real === b.hash && meets(b.hash, diff) && b.prev === (k ? chain[k - 1].hash : ZERO); if (!good) broken = true; ok.push(good); });
  return ok;
}
/** search nonces from `from` for at most `budget` tries; returns the found nonce or -1 */
export function mineSome(b: Block, diff: number, from: number, budget: number) {
  const z = '0'.repeat(diff), pre = `${b.i}|${b.prev}|${b.data}|`;
  for (let n = from; n < from + budget; n++) { const hs = sha256(pre + n); if (hs.startsWith(z)) return { nonce: n, hash: hs, tried: n - from + 1 }; }
  return { nonce: -1, hash: '', tried: budget };
}
export function mineNow(b: Block, diff: number) { let n = 0; for (;;) { const r = mineSome(b, diff, n, 50000); if (r.nonce >= 0) { b.nonce = r.nonce; b.hash = r.hash; return n + r.tried; } n += 50000; } }
export function relink(chain: Block[], from: number) { for (let k = Math.max(0, from); k < chain.length; k++) { chain[k].prev = k ? chain[k - 1].hash : ZERO; chain[k].hash = blockHash(chain[k]); } }

export default function (ctx: Ctx) {
  const t = ctx.t;
  const L = layout(ctx); L.view.classList.add('flow', 'w62');
  const stage = h('div', { class: 'w62-stage' }); L.view.append(stage);
  type Cfg = { mode: 'hash' | 'chain' | 'peers'; diff: number };
  const cfg: Cfg = { mode: 'hash', diff: 3 };
  heading(L.panel, t('h', 'Blockchain lab'));
  seg(L.panel, t('mode', 'Part'), [['hash', t('m.hash', 'Hash lab')], ['chain', t('m.chain', 'Chain')], ['peers', t('m.peers', 'Peers')]], cfg.mode, (v) => { cfg.mode = v as Cfg['mode']; stopAll(); build(); });
  const about = note(L.panel, '');
  const box = h('div', { style: { display: 'grid', gap: '12px' } }); L.panel.append(box);
  const out = stats(L.panel, [['a', '—'], ['b', '—'], ['c', '—']]);
  const dts = Array.from(L.panel.querySelectorAll('.wk-stat dt')) as HTMLElement[];
  const lab = (a: string, b: string, c: string) => { dts[0].textContent = a; dts[1].textContent = b; dts[2].textContent = c; };
  note(L.panel, t('honest', 'This is a teaching model in your browser: no coins, wallets or network. Real blockchains add digital signatures, transaction rules and thousands of computers, but the hashing and linking shown here work the same way.'));

  /* ---------- background mining, a slice per frame so the page stays responsive ---------- */
  let jobs: { b: Block; diff: number; from: number; tried: number; t0: number; done: (n: number) => void }[] = [], raf = 0;
  const pump = () => {
    raf = 0; const end = performance.now() + 10;
    while (jobs.length && performance.now() < end) {
      const j = jobs[0], r = mineSome(j.b, j.diff, j.from, 400); j.tried += r.tried; j.from += r.tried;
      if (r.nonce >= 0) { j.b.nonce = r.nonce; j.b.hash = r.hash; jobs.shift(); lastRate = j.tried / Math.max(.001, (performance.now() - j.t0) / 1000); lastTries = j.tried; j.done(j.tried); }
    }
    progress();
    if (jobs.length) raf = requestAnimationFrame(pump);
  };
  const mine = (b: Block, done: (n: number) => void, diff = cfg.diff) => { jobs.push({ b, diff, from: 0, tried: 0, t0: performance.now(), done }); if (!raf) raf = requestAnimationFrame(pump); };
  const stopAll = () => { jobs = []; cancelAnimationFrame(raf); raf = 0; };
  ctx.onDispose(stopAll);
  let lastRate = 0, lastTries = 0, progress = () => {};
  const fmtInt = (n: number) => Math.round(n).toLocaleString(ctx.lang === 'ar' ? 'ar' : ctx.lang);

  /* ---------- hash lab ---------- */
  let prevHash = '', curText = t('sample', 'Hello, Abidora!');
  function hashLab() {
    about.textContent = t('a.hash', 'A hash is a fixed-length fingerprint of any data. The same input always gives the same 64 characters, a tiny change gives a completely different one, and there is no practical way to go backwards from the fingerprint to the data.');
    lab(t('st.len', 'Input bytes'), t('st.bits', 'Bits changed'), t('st.same', 'Same as before'));
    const ta = h('textarea', { rows: 4, class: 'w62-in', 'aria-label': t('input', 'Text to hash'), spellcheck: false }) as HTMLTextAreaElement; ta.value = curText;
    const outEl = h('div', { class: 'w62-hash', 'aria-live': 'polite' }), grid = h('div', { class: 'w62-bits', 'aria-hidden': 'true' });
    const cmp = h('p', { class: 'w62-small' });
    stage.replaceChildren(h('h2', { class: 'w62-t', text: t('input', 'Text to hash') }), ta, h('h2', { class: 'w62-t', text: 'SHA-256' }), outEl, grid, cmp);
    const show = (hs: string, bytes: number) => {
      outEl.replaceChildren(...hs.split('').map((ch, i) => h('span', { text: ch, class: prevHash && prevHash[i] !== ch ? 'ch' : '' })));
      grid.replaceChildren(...Array.from({ length: 256 }, (_, i) => { const bit = (parseInt(hs[i >> 2], 16) >> (3 - (i & 3))) & 1, pb = prevHash ? (parseInt(prevHash[i >> 2], 16) >> (3 - (i & 3))) & 1 : bit; return h('i', { class: `${bit ? 'w62-1' : ''}${pb !== bit ? ' w62-x' : ''}` }); }));
      const d = prevHash ? bitDiff(prevHash, hs) : 0;
      out('a', fmtInt(bytes)); out('b', prevHash ? `${d} / 256` : '—'); out('c', prevHash ? (d === 0 ? t('yes', 'yes') : t('no', 'no')) : '—');
      cmp.textContent = prevHash ? t('cmp', 'Highlighted: what changed compared with the previous version. On average about 128 of the 256 bits flip, whatever you change.') : t('cmp0', 'Now change a single character.');
    };
    let cur = sha256(curText); show(cur, enc.encode(curText).length);
    ta.addEventListener('input', () => { curText = ta.value; const n = sha256(ta.value); if (n !== cur) { prevHash = cur; cur = n; } show(cur, enc.encode(ta.value).length); });
    const file = h('input', { type: 'file', 'aria-label': t('file', 'Fingerprint a file') }) as HTMLInputElement;
    file.addEventListener('change', async () => { const f = file.files?.[0]; file.value = ''; if (!f) return; if (f.size > 50e6) { L.hud.textContent = t('big', 'Please choose a file under 50 MB.'); return; } const buf = new Uint8Array(await f.arrayBuffer()); const n = hex(sha256Bytes(buf)); prevHash = cur; cur = n; show(cur, buf.length); L.hud.textContent = `${f.name}: ${t('filehint', 'compare this with the SHA-256 a download page publishes to check the file is untouched.')}`; });
    buttons(box, [[t('file', 'Fingerprint a file'), () => file.click()], [t('flip', 'Change one letter'), () => { const s = ta.value || 'a', k = Math.floor(s.length / 2); ta.value = s.slice(0, k) + String.fromCharCode(s.charCodeAt(k) ^ 1) + s.slice(k + 1); ta.dispatchEvent(new Event('input')); }]]);
    note(box, t('filenote', 'Files are read only inside this page and never uploaded.'));
  }

  /* ---------- chain ---------- */
  const samples = [t('g0', 'Genesis block'), t('d1', 'Rumi pays Tara 5'), t('d2', 'Tara pays Ayan 2'), t('d3', 'Ayan pays Rumi 1'), t('d4', 'Mila pays Tara 3')];
  /** small difficulties are mined at once; harder ones are left for the frame-by-frame miner */
  const makeChain = (n: number, diff: number) => { const c: Block[] = []; for (let k = 0; k < n; k++) { const b: Block = { i: k, data: samples[k % samples.length], prev: k ? c[k - 1].hash : ZERO, nonce: 0, hash: '' }; if (diff <= 3) mineNow(b, diff); else b.hash = blockHash(b); c.push(b); } return c; };
  const PEER_DIFF = 3;
  let chain: Block[] = [];
  const cardRefs: { el: HTMLElement; prevEl: HTMLElement; hashEl: HTMLElement; nonceEl: HTMLElement; st: HTMLElement; btn: HTMLButtonElement }[] = [];
  const colourHash = (s: string) => { const z = s.match(/^0*/)![0].length; return [h('b', { text: s.slice(0, z) }), s.slice(z)]; };
  function paintChain() {
    const ok = validity(chain, cfg.diff);
    chain.forEach((b, k) => { const r = cardRefs[k]; if (!r) return; r.el.classList.toggle('bad', !ok[k]); r.prevEl.replaceChildren(...colourHash(b.prev)); r.hashEl.replaceChildren(...colourHash(b.hash)); r.nonceEl.textContent = String(b.nonce); r.st.textContent = ok[k] ? t('valid', 'valid') : t('broken', 'broken'); r.btn.disabled = jobs.some((j) => j.b === b); });
    out('a', String(chain.length)); out('b', `${ok.filter(Boolean).length} / ${chain.length}`); out('c', lastTries ? `${fmtInt(lastTries)} · ${fmtInt(lastRate)}/s` : '—');
  }
  function chainView() {
    about.textContent = t('a.chain', 'Each block stores its data, the hash of the block before it and a number called the nonce. Mining tries nonce after nonce until the block’s hash starts with enough zeros. Change the data in any block: its hash changes, so it and every block after it break. Fixing them means mining them all again.');
    lab(t('st.blocks', 'Blocks'), t('st.valid', 'Valid'), t('st.work', 'Last mining: tries · speed'));
    range(box, t('diff', 'Difficulty (leading zeros)'), { min: 1, max: 5, value: cfg.diff }, (v) => { cfg.diff = v; stopAll(); paintChain(); L.hud.textContent = t('diffnote', 'The rule changed: blocks mined for the old difficulty may now be broken. Each extra zero needs about 16 times more tries.'); });
    buttons(box, [[t('add', 'Add a block'), () => { const p = chain[chain.length - 1]; const b: Block = { i: chain.length, data: samples[chain.length % samples.length], prev: p ? p.hash : ZERO, nonce: 0, hash: '' }; b.hash = blockHash(b); chain.push(b); renderChain(); mineBlock(chain.length - 1); }, true], [t('fixall', 'Re-mine everything broken'), () => { const ok = validity(chain, cfg.diff); const k = ok.indexOf(false); if (k >= 0) mineFrom(k); }], [t('reset', 'Start a new chain'), () => { stopAll(); chain = makeChain(4, cfg.diff); renderChain(); if (cfg.diff > 3) mineFrom(0); }]]);
    const fresh = !chain.length; if (fresh) chain = makeChain(4, cfg.diff);
    renderChain(); if (fresh && cfg.diff > 3) mineFrom(0);
  }
  function mineBlock(k: number) { const b = chain[k]; if (!b) return; relink(chain, k); mine(b, () => { relink(chain, k + 1); paintChain(); }); paintChain(); }
  function mineFrom(k: number) { relink(chain, k); const step = (j: number) => { if (j >= chain.length) { paintChain(); return; } chain[j].prev = j ? chain[j - 1].hash : ZERO; mine(chain[j], () => step(j + 1)); paintChain(); }; step(k); }
  function renderChain() {
    cardRefs.length = 0;
    const wrap = h('div', { class: 'w62-chain' });
    chain.forEach((b, k) => {
      const ta = h('textarea', { rows: 2, 'aria-label': `${t('data', 'Data')} #${k}`, spellcheck: false }) as HTMLTextAreaElement; ta.value = b.data;
      ta.addEventListener('input', () => { b.data = ta.value.slice(0, 200); b.hash = blockHash(b); relink(chain, k + 1); jobs = jobs.filter((j) => j.b !== b); paintChain(); });
      const prevEl = h('code', {}), hashEl = h('code', {}), nonceEl = h('code', {}), st = h('span', { class: 'w62-st' });
      const btn = h('button', { type: 'button', class: 'wk-b pri', text: t('mine', 'Mine'), onclick: () => mineBlock(k) }) as HTMLButtonElement;
      const el = h('article', { class: 'w62-blk' }, h('header', {}, h('strong', { text: `${t('block', 'Block')} #${k}` }), st), h('label', {}, h('span', { text: t('data', 'Data') }), ta), h('div', { class: 'w62-kv' }, h('span', { text: t('prev', 'Previous hash') }), prevEl), h('div', { class: 'w62-kv' }, h('span', { text: 'Nonce' }), nonceEl), h('div', { class: 'w62-kv' }, h('span', { text: t('hash', 'Hash') }), hashEl), btn);
      cardRefs.push({ el, prevEl, hashEl, nonceEl, st, btn }); wrap.append(el);
    });
    stage.replaceChildren(wrap); paintChain();
  }
  progress = () => { if (cfg.mode === 'chain') { paintChain(); const j = jobs[0]; if (j) { L.hud.textContent = `${t('mining', 'Mining block')} #${j.b.i}: ${fmtInt(j.tried)} ${t('tries', 'tries')}…`; hudMining = true; } else if (hudMining) { L.hud.textContent = ''; hudMining = false; } } if (cfg.mode === 'peers') paintPeers(); };

  /* ---------- peers ---------- */
  type Peer = { name: string; chain: Block[]; note: string };
  let peers: Peer[] = [], hudMining = false;
  const clone = (c: Block[]) => c.map((b) => ({ ...b }));
  const work = (c: Block[]) => { const ok = validity(c, PEER_DIFF); let n = 0; for (const v of ok) { if (!v) break; n++; } return n; }; /* valid blocks in a row = work done, as every block here has the same difficulty */
  function resetPeers() { const base = makeChain(4, PEER_DIFF); peers = ['A', 'B', 'C'].map((n) => ({ name: n, chain: clone(base), note: '' })); }
  function paintPeers() {
    const tips = peers.map((p) => p.chain[p.chain.length - 1]?.hash || ''), count = (s: string) => tips.filter((x) => x === s).length;
    const cols = peers.map((p, k) => {
      const ok = validity(p.chain, PEER_DIFF), agree = count(tips[k]) >= 2;
      return h('section', { class: `w62-peer${agree ? '' : ' odd'}` }, h('h2', { text: `${t('peer', 'Peer')} ${p.name}` }), h('p', { class: 'w62-small', text: `${t('validrun', 'valid blocks')}: ${work(p.chain)} · ${t('tip', 'tip')} …${tips[k].slice(-6)}` }),
        h('div', { class: 'w62-mini' }, ...p.chain.map((b, i) => h('div', { class: ok[i] ? '' : 'bad', title: b.hash }, h('b', { text: `#${i}` }), h('span', { text: b.data.length > 22 ? b.data.slice(0, 21) + '…' : b.data }), h('code', { text: b.hash.slice(0, 8) })))),
        h('p', { class: 'w62-small', text: p.note || (agree ? t('agrees', 'Agrees with the majority.') : t('disagrees', 'Its copy differs from the others.')) }));
    });
    stage.replaceChildren(h('div', { class: 'w62-peers' }, ...cols));
    const j = jobs[0]; if (j) L.hud.textContent = `${t('peer', 'Peer')} B ${t('mining', 'Mining block')} #${j.b.i}: ${fmtInt(j.tried)} ${t('tries', 'tries')}…`;
    out('a', String(new Set(tips).size)); out('b', peers.map((p) => work(p.chain)).join(' · ')); out('c', lastTries ? `${fmtInt(lastTries)} · ${fmtInt(lastRate)}/s` : '—');
  }
  function peersView() {
    about.textContent = t('a.peers', 'Three computers keep their own copy of the same chain. Try to cheat on peer B: change an old payment, then re-mine B so its chain is valid again. The other two still hold the original, so B is outnumbered. Real networks follow the valid chain with the most mining work, so B only wins if it can out-mine everyone else together.');
    lab(t('st.versions', 'Different versions'), t('st.runs', 'Valid blocks A · B · C'), t('st.work', 'Last mining: tries · speed'));
    if (!peers.length) resetPeers();
    const B = () => peers[1];
    buttons(box, [[t('p1', '1. Change block 1 on B'), () => { const c = B().chain; c[1].data = t('cheat', 'Rumi pays Tara 500'); c[1].hash = blockHash(c[1]); relink(c, 2); B().note = t('n1', 'Block 1 changed: its hash no longer meets the rule and every later block points to a hash that is gone.'); L.hud.textContent = ''; paintPeers(); }],
      [t('p2', '2. Re-mine B from block 1'), () => { const c = B().chain, ok = validity(c, PEER_DIFF), k = ok.indexOf(false); if (k < 0) { B().note = t('n2b', 'B has nothing broken to re-mine.'); paintPeers(); return; } const step = (j: number) => { if (j >= c.length) { B().note = t('n2', 'B is valid again, but its tip differs from A and C and its chain is not longer than theirs, so they keep their own.'); L.hud.textContent = ''; paintPeers(); return; } c[j].prev = j ? c[j - 1].hash : ZERO; c[j].hash = blockHash(c[j]); mine(c[j], () => step(j + 1), PEER_DIFF); }; step(k); }],
      [t('p3', '3. B mines one block ahead'), () => { const c = B().chain; if (work(c) < c.length) { B().note = t('n3b', 'Fix B first (step 2).'); paintPeers(); return; } const p = c[c.length - 1]; const b: Block = { i: c.length, data: t('extra', 'B’s extra block'), prev: p.hash, nonce: 0, hash: '' }; c.push(b); mine(b, () => { B().note = t('n3', 'B now has the most work. If A and C follow the rule, they switch to B’s version, cheat included. This is why an attacker needs more mining power than everyone else.'); L.hud.textContent = ''; paintPeers(); }, PEER_DIFF); paintPeers(); }],
      [t('p4', '4. Peers follow most work'), () => { let best = peers[0]; for (const p of peers) if (work(p.chain) > work(best.chain)) best = p; for (const p of peers) if (p !== best && work(best.chain) > work(p.chain)) { p.chain = clone(best.chain); p.note = `${t('switched', 'Switched to the chain of peer')} ${best.name}.`; } else if (p !== best) p.note = t('kept', 'Kept its own chain: no valid chain has more work.'); paintPeers(); }],
      [t('preset', 'Start again'), () => { stopAll(); resetPeers(); L.hud.textContent = ''; paintPeers(); }]]);
    paintPeers();
  }

  function build() {
    box.replaceChildren(); L.hud.textContent = '';
    if (cfg.mode === 'hash') hashLab(); else if (cfg.mode === 'chain') chainView(); else peersView();
  }
  build();
}
