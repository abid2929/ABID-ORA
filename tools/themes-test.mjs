// Contrast test for every Theme Studio theme (WCAG 2): text >= 7 (AAA body), secondary >= 4.5 (AA), accent >= 3 (AA large/UI).
import { THEMES, theme, contrast } from '../src/data/themes.ts';
let fail = 0; const ids = new Set();
for (const r of THEMES) {
  const t = theme(r[0]); if (ids.has(t.id)) { console.log('DUP', t.id); fail++; } ids.add(t.id);
  const a = contrast(t.bone, t.ink), b = contrast(t.mute, t.ink), c = contrast(t.signal, t.ink), d = contrast(t.bone, t.ink2);
  const bad = [a < 7 && 'text ' + a.toFixed(2), b < 4.5 && 'mute ' + b.toFixed(2), c < 3 && 'signal ' + c.toFixed(2), d < 4.5 && 'text/surface ' + d.toFixed(2)].filter(Boolean);
  if (bad.length) { fail++; console.log('FAIL', t.id, bad.join(', ')); }
}
console.log(`${THEMES.length - fail}/${THEMES.length} themes pass contrast`); process.exit(fail ? 1 : 0);
