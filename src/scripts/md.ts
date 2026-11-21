/* A small, safe Markdown renderer for Abidora AI answers.
   Everything is HTML-escaped first; only the markup below is produced. Links must be http(s). */
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');


/* Digit tidy-up. Small models sometimes put Bengali (or Devanagari) digits inside code or chemical formulas,
   e.g. "C₆H₁২O₆" or "x = ১০" in Python. Code must use 0-9, formulas use 0-9 and subscripts, and a single number
   must not mix two digit scripts. Ordinary Bengali prose keeps its own digits. */
const NAT = /[০-৯०-९]/g;
const toAscii = (s: string) => s.replace(NAT, (d) => String((d.charCodeAt(0) - (d >= '০' && d <= '৯' ? 0x09e6 : 0x0966))));
/** code: native digits become 0-9, except inside quoted strings (a program may print Bengali digits on purpose) */
export const codeDigits = (s: string) => s.split(/("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/).map((x, i) => i % 2 ? x : toAscii(x)).join('');
const SUB = '₀₁₂₃₄₅₆₇₈₉';
export function tidyDigits(s: string): string {
  // 1) a number written with two digit scripts, e.g. "1২3": use the script of its first digit
  s = s.replace(/[0-9০-৯]*(?:[0-9][০-৯]|[০-৯][0-9])[0-9০-৯]*/g, (n) => /^[0-9]/.test(n) ? toAscii(n) : n.replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]));
  // 2) formulas: a run of Latin letters, digits and subscripts that has both a Latin letter and a native digit
  s = s.replace(/[A-Za-z0-9০-৯०-९₀-₉()[\]]{2,}/g, (t) => {
    if (!/[A-Za-z]/.test(t) || !/[০-৯०-९]/.test(t)) return t;
    let o = '';
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (/[০-৯०-९]/.test(c)) { const a = +toAscii(c); o += i > 0 && /[A-Za-z)\]₀-₉]/.test(o[o.length - 1]) ? SUB[a] : String(a); } else o += c;
    }
    return o;
  });
  // 3) numbers (2+ digits, or a digit touching a Latin letter) in a script the text does not use at all
  //    (Persian digits in Banglish, Bengali digits in an English answer) become 0-9; a lone digit is left alone
  const num = (re: string) => new RegExp(`[${re}]{2,}|[${re}](?=[A-Za-z])|(?<=[A-Za-z])[${re}]`, 'g');
  if (!/(?=\p{Script=Arabic})\p{L}/u.test(s)) s = s.replace(num('٠-٩۰-۹'), (n) => n.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)));
  if (!/(?=\p{Script=Bengali})\p{L}/u.test(s)) s = s.replace(num('০-৯'), toAscii);
  if (!/(?=\p{Script=Devanagari})\p{L}/u.test(s)) s = s.replace(num('०-९'), toAscii);
  return s;
}

function inline(s: string): string {
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_, c) => { codes.push(codeDigits(c)); return `\u0000${codes.length - 1}\u0000`; });
  s = esc(s);
  s = s.replace(/\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]{1,500})\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${t}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]{3,300})/g, (_, a, u) => `${a}<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`);
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

function table(rows: string[]): string {
  const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]); const body = rows.slice(2).map(cells);
  return `<div class="mdt"><table><thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${head.map((_, i) => `<td>${inline(r[i] ?? '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function blocks(text: string): string {
  const L = text.split('\n'); let out = ''; let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,4})\s+(.+)/))) { const n = Math.min(4, m[1].length + 2); out += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { out += '<hr>'; i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < L.length && /^\s*\|?\s*:?-{2,}/.test(L[i + 1])) { const rows: string[] = []; while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(L[i++]); out += table(rows); continue; }
    if (/^\s*>/.test(l)) { const q: string[] = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*>\s?/, '')); out += `<blockquote>${blocks(q.join('\n'))}</blockquote>`; continue; }
    if (/^\s*([-*+]|[0-9০-৯०-९٠-٩]+[.)])\s+/.test(l)) {
      const ord = /^\s*[0-9০-৯०-९٠-٩]/.test(l); const items: string[] = [];
      while (i < L.length && (/^\s*([-*+]|[0-9০-৯०-९٠-٩]+[.)])\s+/.test(L[i]) || (/^\s{2,}\S/.test(L[i]) && items.length))) {
        if (/^\s*([-*+]|[0-9০-৯०-९٠-٩]+[.)])\s+/.test(L[i])) items.push(L[i].replace(/^\s*([-*+]|[0-9০-৯०-९٠-٩]+[.)])\s+/, '')); else items[items.length - 1] += ' ' + L[i].trim();
        i++;
      }
      out += `<${ord ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ord ? 'ol' : 'ul'}>`; continue;
    }
    const p: string[] = [];
    while (i < L.length && L[i].trim() && !/^(#{1,4}\s|\s*>|\s*([-*+]|[0-9০-৯०-९٠-٩]+[.)])\s+|\s*\|.*\|\s*$)/.test(L[i])) p.push(L[i++]);
    if (!p.length) { out += `<p>${inline(L[i++])}</p>`; continue; }
    out += `<p>${p.map(inline).join('<br>')}</p>`;
  }
  return out;
}

/** Markdown -> safe HTML. Code fences become <pre> with a copy button (wired by the page). */
export function md(src: string): string {
  const parts = src.split(/^```/m); let out = '';
  parts.forEach((part, k) => {
    if (k % 2 === 0) { out += blocks(tidyDigits(part)); return; }
    const nl = part.indexOf('\n'); const lang = (nl < 0 ? '' : part.slice(0, nl)).trim().slice(0, 20); const code = codeDigits(nl < 0 ? '' : part.slice(nl + 1).replace(/\n$/, ''));
    out += `<div class="code"><div class="codeb"><span>${esc(lang || 'code')}</span><button type="button" class="cpy" data-cpy></button></div><pre><code>${esc(code)}</code></pre></div>`;
  });
  return out;
}

/** plain text for speaking: no markup, code blocks replaced by a short phrase */
export function speakable(src: string, codePhrase: string): string {
  return src.replace(/```[\s\S]*?(```|$)/g, ` ${codePhrase} `).replace(/`([^`]+)`/g, '$1').replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '').replace(/^\s*[-*+]\s+/gm, '').replace(/^\s*\|?[-:\s|]{3,}\|?\s*$/gm, '').replace(/\|/g, ', ')
    .replace(/[*_~>#]+/g, '').replace(/https?:\/\/\S+/g, '').replace(/[ \t]+/g, ' ').trim();
}

/** split text into speech pieces of at most ~max characters at sentence (then comma, then space) boundaries */
export function chunks(text: string, max = 180): string[] {
  const sents = text.replace(/\n+/g, '. ').split(/(?<=[.!?।॥؟。！？])\s+/).map((s) => s.trim()).filter((s) => s && /[\p{L}\p{N}]/u.test(s));
  const out: string[] = [];
  for (let s of sents) {
    while (s.length > max) {
      let cut = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('، ', max), s.lastIndexOf('、', max), s.lastIndexOf('，', max));
      if (cut < max * .4) cut = s.lastIndexOf(' ', max);
      if (cut < max * .4) cut = max;
      out.push(s.slice(0, cut + 1).trim()); s = s.slice(cut + 1).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

/** speech starts sooner when the first piece is short: split a long first piece once, at a comma or space near 70 characters */
export function quickStart(parts: string[], first = 90): string[] {
  const a = parts[0]; if (!a || a.length <= first) return parts;
  let cut = Math.max(a.lastIndexOf(', ', first), a.lastIndexOf('، ', first), a.lastIndexOf('，', first), a.lastIndexOf('、', first));
  if (cut < 30) cut = a.lastIndexOf(' ', 70);
  if (cut < 30) return parts;
  return [a.slice(0, cut + 1).trim(), a.slice(cut + 1).trim(), ...parts.slice(1)];
}
