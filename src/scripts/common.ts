/* Runs on every page: wordmark, year, mobile menu, and the visitor's saved Studio settings. */
import { I18N } from './i18n';
import { studio, applyStudio } from './studio-core';

export const ORA = '<svg class="ora" viewBox="0 0 100 100" aria-hidden="true"><circle class="rg" cx="50" cy="50" r="38"/><g class="od"><circle cx="77" cy="23" r="9"/></g></svg>';
/** brand name with the ora ring in place of its last "o" */
export function wordmark(): string {
  const b = I18N.brand, i = b.toLowerCase().lastIndexOf('o');
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  return i > 0 ? esc(b.slice(0, i)) + '<span class="oc">' + esc(b[i]) + ORA + '</span>' + esc(b.slice(i + 1)) : esc(b);
}
document.querySelectorAll('.brand-w').forEach((e) => { e.innerHTML = wordmark(); });
document.querySelectorAll('.yr').forEach((e) => { e.textContent = I18N.n(new Date().getFullYear()); });

/* mobile menu: a dialog-like overlay, focus kept inside, Escape closes */
const mb = document.getElementById('mnb'), mn = document.getElementById('mnu'), mc = document.getElementById('mnc');
if (mb && mn && mc) {
  const set = (on: boolean) => {
    mn.hidden = !on; mb.setAttribute('aria-expanded', String(on)); document.documentElement.classList.toggle('menu-open', on);
    if (on) mn.querySelector<HTMLElement>('a')?.focus(); else mb.focus();
  };
  mb.addEventListener('click', () => set(!!mn.hidden));
  mc.addEventListener('click', () => set(false));
  mn.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a')) { mn.hidden = true; mb.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('menu-open'); } });
  document.addEventListener('keydown', (e) => {
    if (mn.hidden) return;
    if (e.key === 'Escape') set(false);
    if (e.key === 'Tab') {
      const f = Array.from(mn.querySelectorAll<HTMLElement>('a,button')); const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}
applyStudio(studio);
import './future';
