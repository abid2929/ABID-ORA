/* Lists the visible English text in the 3D game worlds (src/worlds/games/*.js) with the translation keys
   that src/worlds/games/host.ts looks up (wi.<world>.g<hash>). Usage: node tools/game-strings.mjs > strings.json */
import { readFileSync } from 'node:fs';
const NUM = /\d+(?:[.,:]\d+)*(?![A-Za-z\d])|—/g;
export function gkey(text) {
  const s = text.replace(/\s+/g, ' ').trim().replace(NUM, '{n}');
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 'g' + (h >>> 0).toString(36);
}
const GAMES = { racing: 11, space: 36, sim: 41, explore: 82, puzzle: 99 };
const skip = /^(touch|gk-|rc-|ex-|pz-|sp-|sm-|Key|Arrow|Shift|Control|Space$|Escape|Mesh|sine|square|sawtooth|triangle|#|sunPosition$|INPUT$|SELECT$|ABIDORA$|Abidora Demolition Lab$)/;
const out = {};
for (const [f, id] of Object.entries(GAMES)) {
  const src = readFileSync(new URL(`../src/worlds/games/${f}.js`, import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../src/worlds/games/gkit.js', import.meta.url), 'utf8');
  const set = new Set();
  const add = (s) => {
    for (let frag of s.split(/<[^>]*>/)) {
      frag = frag.replace(/\s+/g, ' ').trim();
      if (!frag || !/[A-Za-z]{2}/.test(frag) || skip.test(frag)) continue;
      if (/^[a-z0-9_.\-/]+$/.test(frag)) continue;                              // identifiers, paths
      const bare = frag.replace(/\{n\}/g, ''), prose = frag.split(' ').length >= 5 && /[.:]$/.test(frag);
      if ((!prose && /[;{}=\[\]]/.test(bare)) || /=>|\(\)|\d+px|rgba?\(|var\(|\.js$|^[.(]|\(px/.test(bare)) continue;   // code, css, selectors
      if (!/[a-z]/.test(frag) && frag.length < 3) continue;
      set.add(frag);
    }
  };
  /* template literals: text with ${…} replaced by {n}; the code inside ${…} is scanned again */
  const tpl = (body) => {
    let o = '', i = 0;
    while (i < body.length) {
      if (body[i] === '\\') { o += body[i + 1] ?? ''; i += 2; continue; }
      if (body[i] === '$' && body[i + 1] === '{') {
        let d = 1, j = i + 2; while (j < body.length && d) { if (body[j] === '{') d++; else if (body[j] === '}') d--; j++; }
        code(body.slice(i + 2, j - 1)); o += '{n}'; i = j; continue;
      }
      o += body[i++];
    }
    add(o);
  };
  const code = (c) => {
    let i = 0;
    while (i < c.length) {
      const ch = c[i];
      if (ch === '/' && c[i + 1] === '/') { while (i < c.length && c[i] !== '\n') i++; continue; }
      if (ch === '/' && c[i + 1] === '*') { i = c.indexOf('*/', i + 2) + 2; if (i < 2) break; continue; }
      if (ch === "'" || ch === '"') { let j = i + 1, v = ''; while (j < c.length && c[j] !== ch && c[j] !== '\n') { if (c[j] === '\\') { v += c[j + 1]; j += 2; } else v += c[j++]; } add(v); i = j + 1; continue; }
      if (ch === '`') { let j = i + 1, d = 0; while (j < c.length) { if (c[j] === '\\') { j += 2; continue; } if (c[j] === '$' && c[j + 1] === '{') { d++; j += 2; continue; } if (d && c[j] === '}') { d--; j++; continue; } if (!d && c[j] === '`') break; j++; } tpl(c.slice(i + 1, j)); i = j + 1; continue; }
      i++;
    }
  };
  code(src);
  out[id] = [...set].map((en) => [gkey(en), en]);
}
console.log(JSON.stringify(out, null, 1));
