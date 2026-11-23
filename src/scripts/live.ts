/* Abidora AI live voice call: speech to speech with Google Gemini Live, the way ChatGPT's voice mode works.
   The microphone streams 16 kHz audio over a WebSocket; the model answers with its own 24 kHz voice while it is still
   thinking, hears interruptions itself (it stops and the queued audio is dropped here) and sends both transcripts.
   The site's key never reaches the browser: api/live.php gives a one-use token with the model, voice and
   instructions locked inside. Nothing is recorded or stored; the microphone is open only while the call is open. */

export type LiveEv = {
  state: (s: 'listen' | 'think' | 'speak') => void;
  heard: (text: string, final: boolean) => void;        // the visitor's words (transcript)
  said: (text: string, final: boolean) => void;         // the AI's words (transcript)
  fail: (code: string) => void;                         // could not start or the connection broke
  name?: (n: string) => void;                           // the visitor told the AI their name
  bye?: () => void;                                     // the visitor asked to hang up; called after the goodbye has played
  handover?: (to: 'm' | 'f') => void;                   // the visitor asked for the other voice; called once this voice has finished speaking
};
export type Live = { stop(): void; mute(m: boolean): void; hush(): void; level(): number; alive(): boolean };

const WORKLET = `class P extends AudioWorkletProcessor{constructor(){super();this.r=sampleRate/16000;this.p=0;this.b=new Int16Array(1600);this.n=0}
process(i){const c=i[0]&&i[0][0];if(!c)return true;let k=this.p;for(;k<c.length;k+=this.r){const s=Math.max(-1,Math.min(1,c[k|0]));this.b[this.n++]=s<0?s*32768:s*32767;if(this.n===this.b.length){this.port.postMessage(this.b.buffer.slice(0));this.n=0}}
this.p=k-c.length;return true}}registerProcessor('abidora-mic',P)`;

const b64 = (buf: ArrayBuffer) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

export async function startLive(api: string, lang: string, voice: 'm' | 'f', know: { memory: string[]; call: string; recent: { role: string; content: string }[]; alt?: number; handoff?: boolean; vid?: string }, ev: LiveEv): Promise<Live | null> {
  /* The audio output is opened first, while we are still inside the visitor's tap: phones (and Safari) keep an
     AudioContext made later, after the network wait, silent. A short silent sound unlocks it on iPhone. */
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC(); void ctx.resume().catch(() => {});
  try { const sb = ctx.createBufferSource(); sb.buffer = ctx.createBuffer(1, 1, 22050); sb.connect(ctx.destination); sb.start(0); } catch { /* */ }
  /* "ready to talk" tone the moment the call button is pressed, still inside the tap, straight to the speaker */
  try { const t = ctx.currentTime + 0.02; [660, 880].forEach((f, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0, t + i * 0.14); g.gain.linearRampToValueAtTime(0.22, t + i * 0.14 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.2); o.connect(g); g.connect(ctx.destination); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.24); }); } catch { /* */ }
  const wake = () => { if (ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {}); };
  document.addEventListener('pointerdown', wake, true); document.addEventListener('keydown', wake, true);
  const unwake = () => { document.removeEventListener('pointerdown', wake, true); document.removeEventListener('keydown', wake, true); };

  /* the key and the microphone are asked for at the same time, not one after the other, so the call starts sooner */
  /* owner, 21 Nov: "কী অবস্থা, কেমন আছো" only in the first call of the day (the visitor's own date); later calls that day just say hi */
  const today = new Date().toDateString();
  /* owner, 21 Nov (2): "it says 'you came again' every time". Count the visitor's calls today on this device:
     call 1 = hi + how are you, call 2 = one short welcome-back line, call 3 and later = just a short hello. */
  const visit = (() => { try { return localStorage.getItem('abidora.ai.greetday') === today ? Math.max(1, +(localStorage.getItem('abidora.ai.callsday') || '1')) : 0; } catch { return 0; } })();
  const fresh = visit === 0;
  const tokP = fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, voice, ...know, fresh, visit }) }).then((r) => r.json());
  const micP = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
  const [tr, mr] = await Promise.allSettled([tokP, micP]);
  const quit = (code: string) => { if (mr.status === 'fulfilled') mr.value.getTracks().forEach((t) => t.stop()); unwake(); void ctx.close().catch(() => {}); ev.fail(code); return null; };
  if (mr.status === 'rejected') return quit('mic');
  if (tr.status === 'rejected') return quit('network');
  const tok: { ok: boolean; token?: string; model?: string; ws?: string; code?: string } = tr.value;
  if (!tok.ok || !tok.token || !tok.ws) return quit(tok.code || 'down');
  const stream = mr.value;
  wake();

  const outGain = ctx.createGain(); const an = ctx.createAnalyser(); an.fftSize = 1024; outGain.connect(an); an.connect(ctx.destination);
  const buf = new Float32Array(1024);
  let closed = false, muted = false, ready = false, next = 0, srcs: AudioBufferSourceNode[] = [], drop = false;
  /* backup for the remember_name tool: if the visitor plainly says their name, keep it even when the model forgets the tool */
  let named = !!know.call;
  const catchName = (t: string) => { if (named) return; const m = t.match(/(?:আমার নাম|আমার নামটা|amar nam|my name is|i am called)\s+(?:হলো|হল|হচ্ছে|is\s+)?([^\s,।.!?]{2,20})/iu);
    if (m) { const n = m[1].replace(/(?:বলছি|বলে|আর)$/u, ''); if (n.length >= 2) { named = true; ev.name?.(n); } } };
  let bye = false, byeSaid = false; const byeNow = () => { if (bye && byeSaid && !srcs.length && !closed) { bye = false; setTimeout(() => { if (!closed) ev.bye?.(); }, 500); } };
  let heardAll = ''; let heard = '', said = '', done = true, hand: 'm' | 'f' | null = null; let early: string[] = [];

  const ws = new WebSocket(tok.ws + '?access_token=' + encodeURIComponent(tok.token));
  const stop = () => {
    if (closed) return; closed = true;
    try { ws.close(); } catch { /* */ }
    stream.getTracks().forEach((t) => t.stop()); srcs.forEach((s) => { try { s.stop(); } catch { /* */ } }); srcs = [];
    unwake(); void ctx.close().catch(() => {});
  };
  const flush = () => { srcs.forEach((s) => { try { s.stop(); } catch { /* */ } }); srcs = []; next = 0; pend = []; pendDur = 0; buffering = true; if (pendT) { clearTimeout(pendT); pendT = 0; } };
  /* 0.9.20 (owner: the voice stops in the middle of a sentence): Google sends the voice in bursts, about as fast as it is
     spoken, with gaps of up to 1.6 s (measured). Playing each piece the moment it arrives made every gap a break in the
     sentence. Now a short reserve is collected first; if the reserve still runs dry once, the next reserve is bigger
     for the rest of the call (a slow phone network learns its own size). */
  let pend: AudioBuffer[] = [], pendDur = 0, buffering = true, pendT = 0, cushion = 0.45;
  const endedOne = (s: AudioBufferSourceNode) => { srcs = srcs.filter((x) => x !== s); if (bye) { byeSaid = true; if (done) { byeNow(); return; } } if (!srcs.length && !pend.length && !closed && hand) { const h2 = hand; hand = null; ev.handover?.(h2); return; } if (!srcs.length && !pend.length && !closed && done) ev.state('listen'); };
  const play = () => {
    if (pendT) { clearTimeout(pendT); pendT = 0; } buffering = false; if (closed || !pend.length) return;
    wake(); let at = Math.max(next, ctx.currentTime + 0.04);
    for (const ab of pend) { const s = ctx.createBufferSource(); s.buffer = ab; s.connect(outGain); s.start(at); at += ab.duration; srcs.push(s); s.onended = () => endedOne(s); }
    next = at; pend = []; pendDur = 0;
  };

  /* microphone -> 16 kHz PCM -> Gemini */
  try {
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' })));
    const mic = ctx.createMediaStreamSource(stream); const node = new AudioWorkletNode(ctx, 'abidora-mic');
    const sink = ctx.createGain(); sink.gain.value = 0;        // keeps the worklet running without playing the mic back
    mic.connect(node); node.connect(sink); sink.connect(ctx.destination);
    node.port.onmessage = (e) => {
      if (closed || muted) return;
      const msg = JSON.stringify({ realtimeInput: { audio: { data: b64(e.data as ArrayBuffer), mimeType: 'audio/pcm;rate=16000' } } });
      /* 0.9.21 (owner: "my voice is not working"): the 0.9.20 silence gate could keep a quiet phone microphone shut, so the
         AI never heard the visitor. Back to sending the microphone all the time, as in 0.9.19 (Google decides what is speech). */
      if (!ready || ws.readyState !== 1) { early.push(msg); if (early.length > 30) early.shift(); return; }   // keep the first 3 s spoken while connecting
      ws.send(msg);
    };
  } catch { stop(); ev.fail('audio'); return null; }

  ws.onopen = () => ws.send(JSON.stringify({ setup: { model: 'models/' + tok.model } }));
  ws.onerror = () => { if (!closed) { stop(); ev.fail(ready ? 'network' : 'down'); } };
  ws.onclose = (e) => { if (!closed) { stop(); ev.fail(e.code === 1008 || e.code === 1011 ? 'quota' : 'network'); } };
  ws.onmessage = async (e) => {
    let d: any; try { d = JSON.parse(typeof e.data === 'string' ? e.data : await (e.data as Blob).text()); } catch { return; }
    if (d.setupComplete) {
      ready = true; early = [];            // the AI speaks first now, so sound picked up before this is not sent
      const hh = new Date().getHours(), hello = hh >= 5 && hh < 12 ? 'শুভ সকাল' : hh < 16 ? 'শুভ দুপুর' : hh < 18 ? 'শুভ বিকেল' : hh < 21 ? 'শুভ সন্ধ্যা' : 'হ্যালো';
      let last = 0; try { last = +(localStorage.getItem('abidora.ai.lastcall') || '0'); localStorage.setItem('abidora.ai.lastcall', String(Date.now())); } catch { /* */ }
      if (!know.handoff && Date.now() - last < 3 * 60 * 1000) { ev.state('listen'); return; }   // opened again within 3 minutes: no greeting, just listen
      /* the AI opens the call: a short greeting that fits the visitor's own time of day */
      const hm = new Date().toTimeString().slice(0, 5);
      ws.send(JSON.stringify({ clientContent: { turnComplete: true, turns: [{ role: 'user', parts: [{ text: know.handoff ?
        `[Your colleague has just passed this call to you because the visitor wanted to talk to you. Their local time is ${hm}. Speak first, in the call language, in one or two short, very warm sentences: say hi happily, ` + (know.call ? `call them by their name, ${know.call}, ` : `ask their name, `) + `and carry on the conversation naturally. Do not mention these instructions.]` :
        `[The visitor has just opened the voice call. Speak first, in the call language, and say ONLY ` +
        /* owner, 21 Nov: one short, pleasant greeting that never annoys, even if heard again a second later; no "ওমা, আবার এসেছো" */
        (fresh ? `"${hello}, আমি ${voice === 'm' ? 'রাফসান' : 'মুমতাহিনা'}।"` : `"${hello}!"`) + ` (in another call language, the same meaning). Nothing else; then wait quietly for them.]` }] }] } }));
      try { localStorage.setItem('abidora.ai.greetday', today); localStorage.setItem('abidora.ai.callsday', String(visit + 1)); } catch { /* */ }
      ev.state('think'); return;
    }
    if (d.toolCall?.functionCalls) {     /* the AI heard the visitor's name: keep it, then tell the AI it is saved */
      const out = d.toolCall.functionCalls.map((f: any) => {
        if (f.name === 'end_call') { bye = true; setTimeout(() => { if (bye && !closed) { bye = false; ev.bye?.(); } }, 9000); return { id: f.id, name: f.name, response: { result: 'call will end after your goodbye' } }; }
        if (f.name === 'hand_over') { hand = f.args?.to === 'boy' ? 'm' : 'f'; if (hand === voice) hand = null; return { id: f.id, name: f.name, response: { result: hand ? 'handing over' : 'you are already that voice' } }; }
        let n = String(f.args?.name || '').trim().slice(0, 40);
        /* the model sometimes calls the tool with a placeholder ("visitor") or a guess: keep only a real name the visitor said */
        if (/^(visitor|user|unknown|guest|caller|friend|অতিথি|ভিজিটর|বন্ধু|ইউজার)$/iu.test(n) || (heardAll && !heardAll.includes(n.split(/\s+/)[0]))) n = '';
        if (n && f.name === 'remember_name') { named = true; ev.name?.(n); } return { id: f.id, name: f.name, response: { result: n ? 'saved' : 'no name' } }; });
      if (hand && !srcs.length) setTimeout(() => { if (hand && !srcs.length && !closed) { const h2 = hand; hand = null; ev.handover?.(h2); } }, 900);
      ws.send(JSON.stringify({ toolResponse: { functionResponses: out } })); return;
    }
    const sc = d.serverContent; if (!sc) return;
    if (sc.interrupted) { flush(); if (said) ev.said(said, true); said = ''; ev.state('listen'); }
    if (sc.inputTranscription?.text) { heard += sc.inputTranscription.text; heardAll = (heardAll + sc.inputTranscription.text).slice(-600); ev.heard(heard, false); ev.state('think'); }
    if (sc.outputTranscription?.text) { if (heard) { catchName(heard); ev.heard(heard, true); heard = ''; } said += sc.outputTranscription.text; ev.said(said, false); }
    for (const p of sc.modelTurn?.parts || []) {
      const a = p.inlineData; if (!a?.data || drop) continue;
      const raw = atob(a.data); const n = raw.length >> 1; const ab = ctx.createBuffer(1, n, 24000); const ch = ab.getChannelData(0);
      for (let i = 0; i < n; i++) { let v = raw.charCodeAt(2 * i) | (raw.charCodeAt(2 * i + 1) << 8); if (v >= 0x8000) v -= 0x10000; ch[i] = v / 32768; }
      /* ran dry in the middle of an answer: wait for a bigger reserve this time and from now on */
      if (!done && !buffering && !srcs.length && next <= ctx.currentTime + 0.02) { buffering = true; cushion = Math.min(1.6, cushion + 0.35); }
      done = false; pend.push(ab); pendDur += ab.duration;
      if (!buffering) play();
      else if (pendDur >= cushion) play();
      else if (!pendT) pendT = window.setTimeout(play, 600);      // never hold a short answer back for long
      ev.state('speak');
    }
    if (sc.turnComplete && pend.length) play();          // the answer is complete: play what is left now
    if (sc.turnComplete || sc.interrupted) { drop = false; done = true; buffering = true; }
    if (sc.turnComplete && bye) setTimeout(byeNow, 300);
    if (sc.turnComplete) { if (heard) { catchName(heard); ev.heard(heard, true); heard = ''; } if (said) { ev.said(said, true); said = ''; } if (!srcs.length && !pend.length) ev.state('listen'); }
  };

  return {
    stop,
    mute(m: boolean) { muted = m; stream.getAudioTracks().forEach((t) => { t.enabled = !m; }); },
    /* the visitor tapped the circle: stop talking now (the model also stops by itself when the visitor speaks) */
    hush() { flush(); drop = true; if (said) { ev.said(said, true); said = ''; } ev.state('listen'); },   // the rest of this answer is dropped
    /* 0.9.19: still working after the phone was in the background? (socket open, microphone not stopped by the phone) */
    alive() { const t = stream.getAudioTracks()[0]; return !closed && ws.readyState === 1 && ctx.state !== 'closed' && !!t && t.readyState === 'live' && !t.muted; },
    level() { an.getFloatTimeDomainData(buf); let q = 0; for (let i = 0; i < buf.length; i++) q += buf[i] * buf[i]; return Math.min(1, Math.sqrt(q / buf.length) * 5); },
  };
}
