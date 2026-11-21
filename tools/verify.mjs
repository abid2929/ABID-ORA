// Post-build checks: every page rendered, no template tokens left, every local src/href exists.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
const dist = resolve(process.argv[2] || 'dist');
const html = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!['_abidora', 'node_modules'].includes(f)) walk(p); } else if (f === 'index.html') html.push(p); } })(dist);
let bad = 0;
const fail = (m) => { bad++; console.error('✗ ' + m); };
if (html.length < 60) fail(`expected 60 pages, found ${html.length}`);
for (const p of html) {
  const s = readFileSync(p, 'utf8'), rel = p.slice(dist.length + 1);
  if (/\{\{[A-Za-z:._-]+\}\}/.test(s)) fail(`${rel}: unrendered {{token}}`);
  if (/\{(brand|owner|p[1-4])\}/.test(s)) fail(`${rel}: unreplaced {brand}/{owner}`);
  for (const m of s.matchAll(/(?:src|href|srcset)="([^"]+)"/g)) {
    if (/^(data:|https?:|mailto:|javascript:)/.test(m[1])) continue;
    for (const part of m[1].split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (!u || /^(https?:|mailto:|tel:|#|data:|javascript:)/.test(u)) continue;
      const clean = u.split(/[?#]/)[0]; if (!clean) continue;
      let t = resolve(dirname(p), clean); if (clean.endsWith('/')) t = join(t, 'index.html');
      if (!existsSync(t) && !clean.endsWith('.php') && !clean.endsWith('/admin/') && !clean.endsWith('/install/')) fail(`${rel}: missing ${u}`);
    }
  }
}
console.log(bad ? `${bad} problem(s) in ${html.length} pages` : `✓ ${html.length} pages verified`);
process.exit(bad ? 1 : 0);
