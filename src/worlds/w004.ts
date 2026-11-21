/* 004 Luxury Watch Gallery: Watch Atelier. Compose a watch and wear it: it keeps real time,
   shows the real moon phase and date, a second time zone on a GMT hand, a working chronograph
   and a rotating dive bezel. Mechanical, quartz or smooth seconds. */
import { type Ctx, h, layout, canvas, heading, note, select, seg, buttons, stats, store, loop, download, shade } from './kit';

interface Cfg { case: string; dial: string; idx: string; hands: string; bezel: string; secs: string; tz: string; strap: string }
const CASES: Record<string, [string, string, string]> = { steel: ['#f4f5f6', '#8e959c', 'Steel'], gold: ['#fff1b8', '#b8892b', 'Yellow gold'], rose: ['#ffd9c9', '#b06a4e', 'Rose gold'], black: ['#5a5d63', '#141518', 'Black DLC'], titanium: ['#d6d8d4', '#6d716c', 'Titanium'] };
const DIALS: Record<string, [string, string, string]> = { black: ['#1b1c1f', '#e9e5da', 'Black'], white: ['#f3f0e8', '#1b1b1d', 'Opaline white'], blue: ['#183a73', '#eef1f6', 'Sunburst blue'], green: ['#1f4a37', '#f0eadb', 'Racing green'], salmon: ['#e8a98f', '#2a1d18', 'Salmon'], meteor: ['#4b4d55', '#f3f3f3', 'Slate grey'] };
const ZONES = ['UTC', 'Asia/Dhaka', 'Asia/Tokyo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Seoul', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'America/Sao_Paulo', 'Australia/Sydney', 'Africa/Cairo'];
const DEF: Cfg = { case: 'steel', dial: 'blue', idx: 'baton', hands: 'dauphine', bezel: 'dive', secs: 'mech', tz: 'UTC', strap: '#2a2420' };
const SYN = 29.530588853, NEW = Date.UTC(2000, 0, 6, 18, 14) / 864e5;

function tzParts(d: Date, tz: string) {
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(d); return { h: +p.find((x) => x.type === 'hour')!.value, m: +p.find((x) => x.type === 'minute')!.value }; } catch { return { h: d.getUTCHours(), m: d.getUTCMinutes() }; }
}

/* owner, 21 Nov: "remove the first, keep the 2nd": the code-built 3D watch is retired; the big live dial atelier stays */
export default function (ctx: Ctx) { return atelier(ctx); }
export function atelier(ctx: Ctx) {
  const t = ctx.t, st = store<Cfg>(ctx.id, 'cfg', DEF, (v) => !!v && (v as Cfg).case in CASES && (v as Cfg).dial in DIALS && ZONES.includes((v as Cfg).tz));
  const C: Cfg = { ...DEF, ...st.get() };
  const L = layout(ctx);
  const S = canvas(L.view, t('watch', 'Watch showing the current time'));
  let bezel = 0, chrono = 0, chronoOn = false, chronoT0 = 0;
  const info = stats(L.panel, [['local', t('local', 'Local time')], ['gmt', t('gmt', 'GMT hand')], ['moon', t('moon', 'Moon')], ['lit', t('lit', 'Illuminated')]]);

  function hand(g: CanvasRenderingContext2D, a: number, len: number, w: number, col: string, style: string, tail = .16) {
    g.save(); g.rotate(a); g.fillStyle = col; g.strokeStyle = shade(col, -.35); g.lineWidth = .8;
    g.beginPath();
    if (style === 'dauphine') { g.moveTo(0, len * tail); g.lineTo(-w, 0); g.lineTo(0, -len); g.lineTo(w, 0); }
    else if (style === 'sword') { g.moveTo(-w * .5, len * tail); g.lineTo(-w, -len * .75); g.lineTo(0, -len); g.lineTo(w, -len * .75); g.lineTo(w * .5, len * tail); }
    else { g.rect(-w * .55, -len, w * 1.1, len * (1 + tail)); }
    g.closePath(); g.fill(); g.stroke();
    if (style !== 'baton') { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.lineTo(-w, style === 'sword' ? -len * .75 : 0); g.closePath(); g.fill(); }
    g.restore();
  }
  function draw() {
    const g = S.g, W = S.w, H = S.h; g.clearRect(0, 0, W, H);
    const R = Math.min(W, H) * .36, cx = W / 2, cy = H / 2;
    const now = new Date(), [c1, c2] = CASES[C.case], [d1, d2] = DIALS[C.dial];
    /* time-of-day scene behind the watch: the light follows the visitor's own clock */
    const hrNow = now.getHours() + now.getMinutes() / 60, band = mood === 'live' ? (hrNow >= 5 && hrNow < 10 ? 'dawn' : hrNow < 15.5 ? 'noon' : hrNow < 19 ? 'golden' : 'night') : mood;
    const SC: Record<string, [string, string, string, string]> = { dawn: ['#f6d3c4', '#f9e6da', '#e9a98f', '#3a2a24'], noon: ['#dfe9f2', '#f4f7fa', '#ffffff', '#1f2a33'], golden: ['#e9b97a', '#f5dcb2', '#ffcf7a', '#3a2814'], night: ['#0b1328', '#1a2747', '#f2e6b8', '#eef1f6'] };
    const [b1, b2, orb, ink] = SC[band];
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, b1); bg.addColorStop(.7, b2); bg.addColorStop(1, shade(b1, -.15)); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const ox = band === 'dawn' ? W * .18 : band === 'noon' ? W * .78 : band === 'golden' ? W * .84 : W * .8, oy = band === 'noon' ? H * .16 : band === 'night' ? H * .18 : H * .3;
    if (band === 'night') { for (let i = 0; i < 70; i++) { const sx = (i * 137.5) % W, sy = (i * 71.3) % (H * .7); g.fillStyle = `rgba(255,255,240,${.25 + ((i * 13) % 7) / 10})`; g.fillRect(sx, sy, 1.4, 1.4); } }
    const og = g.createRadialGradient(ox, oy, 0, ox, oy, R * (band === 'night' ? .42 : 1.6)); og.addColorStop(0, orb); og.addColorStop(.18, orb); og.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = band === 'noon' ? .7 : band === 'night' ? .45 : .9; g.fillStyle = og; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    if (band === 'night') { g.fillStyle = '#f2e6b8'; g.beginPath(); g.arc(ox, oy, R * .1, 0, Math.PI * 2); g.fill(); g.fillStyle = b1; g.beginPath(); g.arc(ox + R * .06, oy - R * .03, R * .085, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = shade(b2, band === 'night' ? .05 : -.08); g.globalAlpha = .55; g.fillRect(0, H * .82, W, H * .18); g.globalAlpha = 1;
    const heads: Record<string, string> = { dawn: t('hd.dawn', 'Morning, made precise.'), noon: t('hd.noon', 'High sun, clean lines.'), golden: t('hd.golden', 'The golden hour, worn.'), night: t('hd.night', 'Night shift, still on time.') };
    if (W > 520) { g.fillStyle = ink; g.font = `400 ${Math.min(46, W * .04)}px "Instrument Serif", Georgia, serif`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; const words = heads[band].split(' '), mid = Math.ceil(words.length / 2); g.fillText(words.slice(0, mid).join(' '), 28, H * .16); g.fillText(words.slice(mid).join(' '), 28, H * .16 + Math.min(48, W * .042));
      g.font = `500 11px "JetBrains Mono", ui-monospace, monospace`; g.globalAlpha = .7; g.fillText(t('band.' + band, { dawn: 'DAWN', noon: 'NOON', golden: 'GOLDEN HOUR', night: 'NIGHT' }[band]!) + (mood === 'live' ? ' · ' + t('live', 'LIVE, FROM YOUR CLOCK') : ' · ' + t('preview', 'PREVIEW')), 30, H * .16 + Math.min(48, W * .042) + 26); g.globalAlpha = 1; }
    /* strap */
    g.fillStyle = C.strap; const sw = R * .82;
    const sg = g.createLinearGradient(0, cy - R * 2.4, 0, cy + R * 2.4); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(.18, C.strap); sg.addColorStop(.82, C.strap); sg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sg;
    g.fillRect(cx - sw / 2, cy - R * 2.4, sw, R * 4.8);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.setLineDash([3, 4]); g.lineWidth = 1;
    [[-1, 0], [1, 0]].forEach(([k]) => { g.beginPath(); g.moveTo(cx + k * (sw / 2 - 8), cy - R * 2); g.lineTo(cx + k * (sw / 2 - 8), cy + R * 2); g.stroke(); }); g.setLineDash([]);
    /* lugs + case + crown */
    g.save(); g.translate(cx, cy);
    const cg = g.createLinearGradient(-R, -R, R, R); cg.addColorStop(0, c1); cg.addColorStop(.5, c2); cg.addColorStop(1, c1);
    g.fillStyle = cg;
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.ellipse(x * R * .5, y * R * 1.05, R * .12, R * .3, 0, 0, Math.PI * 2); g.fill(); }
    g.fillRect(R * 1.08, -R * .1, R * .14, R * .2);
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = R * .18; g.shadowOffsetY = R * .05;
    g.beginPath(); g.arc(0, 0, R * 1.12, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent';
    /* bezel */
    if (C.bezel !== 'none') {
      g.save(); g.rotate(bezel * Math.PI / 30);
      g.fillStyle = C.bezel === 'dive' ? '#121316' : shade(c2, -.2); g.beginPath(); g.arc(0, 0, R * 1.08, 0, Math.PI * 2); g.arc(0, 0, R * .9, 0, Math.PI * 2, true); g.fill();
      g.fillStyle = C.bezel === 'dive' ? '#e9e5da' : '#fff'; g.font = `600 ${R * .085}px ui-sans-serif,system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < 60; i++) {
        g.save(); g.rotate(i * Math.PI / 30);
        if (C.bezel === 'dive') {
          if (i === 0) { g.beginPath(); g.moveTo(0, -R * .93); g.lineTo(-R * .05, -R * 1.03); g.lineTo(R * .05, -R * 1.03); g.closePath(); g.fillStyle = '#e8b46a'; g.fill(); g.fillStyle = '#e9e5da'; }
          else if (i % 10 === 0) g.fillText(String(i), 0, -R * .99);
          else if (i % 5 === 0) g.fillRect(-R * .012, -R * 1.04, R * .024, R * .1);
          else if (i < 15) g.fillRect(-R * .005, -R * 1.03, R * .01, R * .06);
        } else if (i % 5 === 0 && (i === 0 || i >= 10)) g.fillText(i === 0 ? '60' : String(Math.round(3600 / i)), 0, -R * .99);
        g.restore();
      }
      g.restore();
    }
    /* dial */
    const dg = g.createRadialGradient(-R * .2, -R * .3, R * .05, 0, 0, R * .9); dg.addColorStop(0, shade(d1, .25)); dg.addColorStop(1, shade(d1, -.25));
    g.fillStyle = dg; g.beginPath(); g.arc(0, 0, R * .9, 0, Math.PI * 2); g.fill();
    if (C.dial === 'blue' || C.dial === 'meteor') { for (let i = 0; i < 90; i++) { g.save(); g.rotate(i * Math.PI / 45); g.strokeStyle = `rgba(255,255,255,${i % 2 ? .03 : .06})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -R * .9); g.stroke(); g.restore(); } }
    /* minute track + indices */
    g.strokeStyle = d2; g.fillStyle = d2;
    for (let i = 0; i < 60; i++) { g.save(); g.rotate(i * Math.PI / 30); g.globalAlpha = .6; g.fillRect(-R * .004, -R * .86, R * .008, i % 5 ? R * .03 : R * .05); g.restore(); }
    g.globalAlpha = 1;
    const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    g.font = `${C.idx === 'roman' ? 500 : 600} ${R * (C.idx === 'roman' ? .11 : .14)}px ${C.idx === 'roman' ? 'Georgia,serif' : 'ui-sans-serif,system-ui'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < 12; i++) {
      if (i === 3) continue; // date window
      const a = i * Math.PI / 6;
      if (C.idx === 'baton') { g.save(); g.rotate(a); const lw = i === 0 ? R * .07 : R * .035; const lg = g.createLinearGradient(-lw, 0, lw, 0); lg.addColorStop(0, c1); lg.addColorStop(1, c2); g.fillStyle = lg; g.fillRect(-lw / 2, -R * .8, lw, R * .17); g.fillStyle = 'rgba(230,255,220,.85)'; g.fillRect(-lw / 4, -R * .78, lw / 2, R * .12); g.restore(); }
      else if (C.idx === 'dots') { g.beginPath(); g.arc(Math.sin(a) * R * .72, -Math.cos(a) * R * .72, i % 3 ? R * .03 : R * .055, 0, Math.PI * 2); g.fillStyle = 'rgba(230,255,220,.9)'; g.fill(); g.strokeStyle = c2; g.stroke(); }
      else { g.fillStyle = d2; g.save(); g.translate(Math.sin(a) * R * .7, -Math.cos(a) * R * .7); if (C.idx === 'roman') g.rotate(a); g.fillText(C.idx === 'roman' ? roman[i] : String(i || 12), 0, 0); g.restore(); }
    }
    /* brand + text */
    g.fillStyle = d2; g.font = `500 ${R * .075}px Georgia,serif`; g.fillText('ABIDORA', 0, -R * .42);
    g.font = `${R * .045}px ui-monospace,monospace`; g.globalAlpha = .7; g.fillText(C.secs === 'quartz' ? 'QUARTZ' : 'AUTOMATIC', 0, -R * .33); g.globalAlpha = 1;
    /* date window at 3 */
    g.fillStyle = '#f7f5ee'; g.fillRect(R * .58, -R * .07, R * .17, R * .14); g.strokeStyle = c2; g.lineWidth = 1.5; g.strokeRect(R * .58, -R * .07, R * .17, R * .14);
    g.fillStyle = '#111'; g.font = `600 ${R * .1}px ui-sans-serif,system-ui`; g.fillText(String(now.getDate()), R * .665, R * .005);
    /* moon phase at 6 */
    const age = ((now.getTime() / 864e5 - NEW) % SYN + SYN) % SYN, ph = age / SYN, lit = (1 - Math.cos(ph * Math.PI * 2)) / 2;
    const mx = 0, my = R * .45, mr = R * .12;
    g.fillStyle = '#0c1430'; g.beginPath(); g.arc(mx, my, mr * 1.25, Math.PI, 0); g.lineTo(mx + mr * 1.25, my + mr * .2); g.lineTo(mx - mr * 1.25, my + mr * .2); g.fill();
    for (let i = 0; i < 9; i++) { g.fillStyle = 'rgba(255,255,230,.7)'; g.fillRect(mx - mr + ((i * 37) % (mr * 2)), my - mr * 1.1 + ((i * 53) % mr), 1.2, 1.2); }
    g.save(); g.beginPath(); g.arc(mx, my, mr, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#20263a'; g.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    g.fillStyle = '#f2e6b8'; g.beginPath();
    const waxing = ph < .5, k = Math.cos(ph * Math.PI * 2);
    g.arc(mx, my, mr, -Math.PI / 2, Math.PI / 2, !waxing);
    g.ellipse(mx, my, mr * Math.abs(k), mr, 0, Math.PI / 2, -Math.PI / 2, (waxing ? k > 0 : k < 0));
    g.fill(); g.restore();
    g.strokeStyle = c2; g.lineWidth = 1.2; g.beginPath(); g.arc(mx, my, mr * 1.25, Math.PI, 0); g.stroke();
    /* chronograph subdial at 9: minutes counted */
    const sx = -R * .45, sr = R * .15; g.strokeStyle = d2; g.globalAlpha = .55; g.beginPath(); g.arc(sx, 0, sr, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 30; i++) { g.save(); g.translate(sx, 0); g.rotate(i * Math.PI / 15); g.fillStyle = d2; g.fillRect(-.5, -sr, 1, i % 5 ? sr * .12 : sr * .22); g.restore(); }
    g.globalAlpha = 1;
    const ch = chronoOn ? chrono + (performance.now() - chronoT0) / 1000 : chrono;
    g.save(); g.translate(sx, 0); hand(g, (ch / 60) % 30 / 30 * Math.PI * 2, sr * .9, sr * .06, '#d6452f', 'baton', .1); g.restore();
    /* hands */
    const ms = now.getMilliseconds(), sec = now.getSeconds() + (C.secs === 'quartz' ? 0 : C.secs === 'mech' ? Math.floor(ms / 125) / 8 : ms / 1000);
    const min = now.getMinutes() + sec / 60, hr = (now.getHours() % 12) + min / 60;
    const z = tzParts(now, C.tz), gmtA = ((z.h + z.m / 60) / 24) * Math.PI * 2;
    hand(g, gmtA, R * .74, R * .02, '#e8b46a', 'baton', .05);
    g.save(); g.rotate(gmtA); g.fillStyle = '#e8b46a'; g.beginPath(); g.moveTo(0, -R * .8); g.lineTo(-R * .04, -R * .7); g.lineTo(R * .04, -R * .7); g.fill(); g.restore();
    const hc = C.dial === 'white' || C.dial === 'salmon' ? '#1a1a1c' : c1;
    hand(g, hr * Math.PI / 6, R * .5, R * .05, hc, C.hands);
    hand(g, min * Math.PI / 30, R * .76, R * .04, hc, C.hands);
    hand(g, (chronoOn || chrono ? (ch % 60) : sec) * Math.PI / 30, R * .84, R * .012, chronoOn || chrono ? '#d6452f' : '#e04b36', 'baton', .22);
    g.fillStyle = c2; g.beginPath(); g.arc(0, 0, R * .035, 0, Math.PI * 2); g.fill();
    /* crystal reflection */
    const cr = g.createLinearGradient(-R, -R, R * .2, R * .2); cr.addColorStop(0, 'rgba(255,255,255,.14)'); cr.addColorStop(.5, 'rgba(255,255,255,0)');
    g.fillStyle = cr; g.beginPath(); g.arc(0, 0, R * .9, 0, Math.PI * 2); g.fill();
    g.restore();
    /* readouts, once a second is plenty */
    if (now.getSeconds() !== last) {
      last = now.getSeconds();
      info('local', now.toLocaleTimeString(ctx.lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      info('gmt', `${String(z.h).padStart(2, '0')}:${String(z.m).padStart(2, '0')} ${C.tz.split('/').pop()!.replace('_', ' ')}`);
      const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
      const n = Math.floor(((ph + 1 / 16) % 1) * 8);
      info('moon', t('mp' + n, names[n])); info('lit', Math.round(lit * 100) + '%');
      const toFull = ((.5 - ph + 1) % 1) * SYN; nextFull.textContent = `${t('full', 'Next full moon')}: ${new Date(now.getTime() + toFull * 864e5).toLocaleDateString(ctx.lang, { day: 'numeric', month: 'long', year: 'numeric' })}`;
      S.cv.setAttribute('aria-label', `${t('watch', 'Watch showing the current time')}: ${now.toLocaleTimeString(ctx.lang)}`);
    }
  }
  let last = -1, mood = 'live';
  const nextFull = note(L.panel, '');
  seg(L.panel, t('light', 'Light'), [['live', t('m.live', 'Live')], ['dawn', t('m.dawn', 'Dawn')], ['noon', t('m.noon', 'Noon')], ['golden', t('m.golden', 'Golden')], ['night', t('m.night', 'Night')]], 'live', (v) => { mood = v; });
  heading(L.panel, t('make', 'Make it yours'));
  select(L.panel, t('case', 'Case'), Object.entries(CASES).map(([k, v]) => [k, t('c.' + k, v[2])]), C.case, (v) => { C.case = v; save(); });
  select(L.panel, t('dial', 'Dial'), Object.entries(DIALS).map(([k, v]) => [k, t('d.' + k, v[2])]), C.dial, (v) => { C.dial = v; save(); });
  seg(L.panel, t('idx', 'Hour markers'), [['baton', t('i.baton', 'Batons')], ['roman', t('i.roman', 'Roman')], ['arabic', t('i.arabic', 'Arabic')], ['dots', t('i.dots', 'Dots')]], C.idx, (v) => { C.idx = v; save(); });
  seg(L.panel, t('hands', 'Hands'), [['dauphine', t('h.dauphine', 'Dauphine')], ['sword', t('h.sword', 'Sword')], ['baton', t('h.baton', 'Baton')]], C.hands, (v) => { C.hands = v; save(); });
  seg(L.panel, t('bezel', 'Bezel'), [['dive', t('b.dive', 'Dive')], ['tachy', t('b.tachy', 'Tachymeter')], ['none', t('b.none', 'Plain')]], C.bezel, (v) => { C.bezel = v; save(); });
  seg(L.panel, t('secs', 'Seconds'), [['mech', t('s.mech', '8 beats/s')], ['quartz', t('s.quartz', 'Quartz tick')], ['smooth', t('s.smooth', 'Smooth')]], C.secs, (v) => { C.secs = v; save(); });
  select(L.panel, t('tz', 'Second time zone'), ZONES.map((z) => [z, z.replace('_', ' ')]), C.tz, (v) => { C.tz = v; save(); });
  const straps: [string, string][] = [['#2a2420', 'Dark leather'], ['#6b4a2b', 'Tan leather'], ['#1d2a3d', 'Navy rubber'], ['#9aa0a6', 'Steel mesh'], ['#3f4a2f', 'Olive canvas']];
  select(L.panel, t('strap', 'Strap'), straps.map(([c, n]) => [c, t('st' + c.slice(1), n)]), C.strap, (v) => { C.strap = v; save(); });
  heading(L.panel, t('chrono', 'Chronograph'));
  const cb = buttons(L.panel, [[t('start', 'Start'), () => { if (chronoOn) { chrono += (performance.now() - chronoT0) / 1000; chronoOn = false; } else { chronoT0 = performance.now(); chronoOn = true; } cb[0].textContent = chronoOn ? t('stop', 'Stop') : t('start', 'Start'); }, true], [t('reset', 'Reset'), () => { chrono = 0; chronoOn = false; cb[0].textContent = t('start', 'Start'); }]]);
  heading(L.panel, t('bez', 'Dive bezel'));
  buttons(L.panel, [['↺ 1 min', () => { bezel = (bezel + 59) % 60; }], ['↻ 1 min', () => { bezel = (bezel + 1) % 60; }], [t('align', 'Set to minute hand'), () => { bezel = new Date().getMinutes(); }]]);
  buttons(L.panel, [[t('png', 'Download watch (PNG)'), () => download(S.cv, 'abidora-watch.png')]]);
  note(L.panel, t('how', 'The moon phase is calculated from the mean synodic month (29.53 days) counted from the new moon of 6 January 2000, so it can be off by up to about a day. A diver sets the bezel’s triangle on the minute hand to time a dive.'));
  function save() { st.set(C); }
  S.cv.addEventListener('wheel', (e) => { if (C.bezel !== 'dive') return; e.preventDefault(); bezel = (bezel + (e.deltaY > 0 ? 1 : 59)) % 60; }, { passive: false });
  loop(ctx, S.cv, draw);
  L.hud.textContent = t('hud', 'Scroll over the watch to turn the dive bezel');
}
