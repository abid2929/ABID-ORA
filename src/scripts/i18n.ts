/* Abidora i18n runtime: translated strings for scripts, number formats, text segmentation,
   the language menu and keeping the visitor's place when they switch language.
   The data comes from window.I18N_BOOT, written into each page by the PHP renderer.
   (The "remembered language" redirect runs earlier, as a tiny inline script in <head>.) */
export interface Boot {
  lang: string; loc: string; rtl: boolean; root: string; page: string;
  alts: Record<string, string>; brand: string; owner: string;
  dict: Record<string, string>; langs: string[]; urls: Record<string, string>;
}
declare global { interface Window { I18N_BOOT?: Boot } }

const B: Boot = window.I18N_BOOT ?? { lang: 'en', loc: 'en', rtl: false, root: '', page: 'home', alts: {}, brand: 'Abidora', owner: 'Abid Islam', dict: {}, langs: ['en'], urls: {} };
const KEY = 'abidora.lang', KEEP = 'abidora.keep';

function sess(k: string, v?: string | null): string | null {
  try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* storage blocked */ }
  return null;
}
let keep: { page: string; y: number } | null = null;
try { keep = JSON.parse(sess(KEEP) ?? 'null'); } catch { keep = null; }
if (keep && keep.page !== B.page) keep = null;
sess(KEEP, null);

const segs: Record<string, Intl.Segmenter> = {};
function segmenter(g: 'grapheme' | 'word'): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || !('Segmenter' in Intl)) return null;
  return segs[g] ??= new Intl.Segmenter(B.loc, { granularity: g });
}
const nfs: Record<number, Intl.NumberFormat> = {};

export const I18N = {
  lang: B.lang, loc: B.loc, rtl: !!B.rtl, root: B.root, page: B.page, brand: B.brand, owner: B.owner, keep,
  /** translated script string (keys without the "js." prefix) */
  t(k: string): string { return Object.prototype.hasOwnProperty.call(B.dict, k) ? B.dict[k] : k; },
  /** relative URL of another page in the current language */
  url(page: string): string { return B.urls[page] ?? B.root; },
  /** numbers; Arabic keeps Latin digits (decided for consistency with the brand numerals) */
  n(v: number, pad = 1): string {
    try { return (nfs[pad] ??= new Intl.NumberFormat(B.lang === 'ar' ? 'ar-u-nu-latn' : B.loc, { minimumIntegerDigits: pad, useGrouping: false })).format(v); } catch { return String(v); }
  },
  /** grouped numbers, e.g. 160,000 */
  ng(v: number): string { try { return new Intl.NumberFormat(B.lang === 'ar' ? 'ar-u-nu-latn' : B.loc).format(v); } catch { return String(v); } },
  /** letters for title animations; Arabic letters must stay joined, so the whole word animates */
  chars(t: string): string[] {
    if (B.lang === 'ar') return [t];
    const s = segmenter('grapheme'); if (s) return Array.from(s.segment(t), (x) => x.segment);
    return Array.from(t);
  },
  /** words for reveal effects; Chinese and Japanese have no spaces, so use the word segmenter */
  words(t: string): string[] {
    const s = segmenter('word'); if (s && /^(zh|ja)/.test(B.loc)) return Array.from(s.segment(t), (x) => x.segment);
    return t.split(/(\s+)/);
  },
};

function ready(f: () => void) { if (document.readyState !== 'loading') f(); else document.addEventListener('DOMContentLoaded', f); }
ready(() => {
  const btn = document.getElementById('lgb'), panel = document.getElementById('lgm');
  if (btn && panel) {
    const open = (on: boolean) => {
      panel.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) (panel.querySelector<HTMLElement>('[aria-current]') ?? panel.querySelector<HTMLElement>('a'))?.focus();
    };
    btn.addEventListener('click', () => open(!!panel.hidden));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { open(false); btn.focus(); } });
    document.addEventListener('click', (e) => { const el = e.target as Node; if (!panel.hidden && !panel.contains(el) && el !== btn) open(false); });
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const L = Array.from(panel.querySelectorAll<HTMLElement>('a')), i = L.indexOf(document.activeElement as HTMLElement);
      e.preventDefault(); L[(i + (e.key === 'ArrowDown' ? 1 : -1) + L.length) % L.length].focus();
    });
    panel.addEventListener('click', (e) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-l]'); if (!a) return;
      try { localStorage.setItem(KEY, a.dataset.l ?? 'en'); } catch { /* ignore */ }
      const h = document.documentElement.scrollHeight - innerHeight;
      sess(KEEP, JSON.stringify({ page: B.page, y: h > 0 ? scrollY / h : 0 }));
      if (location.hash || location.search) { e.preventDefault(); location.href = (a.getAttribute('href') ?? '') + location.search + location.hash; }
    });
  }
  if (keep && keep.y > 0) {
    const y = keep.y;
    const go = () => { const h = document.documentElement.scrollHeight - innerHeight; window.scrollTo(0, y * h); };
    if (document.readyState === 'complete') setTimeout(go, 60); else addEventListener('load', () => setTimeout(go, 60));
  }
});
