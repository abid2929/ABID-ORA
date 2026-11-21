/* Fashion (0.9.6, owner 21 Nov: "do each thing once, keep it simple"): one world with four tabs, each the real 3D models
   with the part-colour editor. The old fashion worlds (2-10) open the matching tab here. The earlier code-made tools
   (weave simulator, outfit planner, dress form, procedural shoes, 2D bag maker) are retired; backups are kept outside the site. */
import { scanStudio, SCAN_CLOTHES, SCAN_SHOES, SCAN_BAGS, SCAN_JEWEL } from './scanstudio';
import { I18N } from '../scripts/i18n';
import { type Ctx, h } from './kit';
import { watchShow } from './watch3d';

export const FASHION_TABS = ['clothes', 'shoes', 'bags', 'watches'] as const;
type Tab = (typeof FASHION_TABS)[number];
const CSS = `.fz-tabs{position:relative;z-index:20;display:flex;gap:8px;margin:0;padding:12px 14px;background:var(--ink,#0f0e0c);overflow-x:auto;scrollbar-width:none}
.fz-tabs::-webkit-scrollbar{display:none}
.fz-tab{flex:none;display:flex;align-items:center;gap:8px;min-height:48px;padding:0 20px;border-radius:999px;border:1px solid var(--line,rgba(236,230,220,.2));background:none;color:var(--bone,#ece6dc);font:600 15px var(--sans,sans-serif);cursor:pointer}
.fz-tab[aria-selected=true]{background:var(--bone,#ece6dc);color:#111;border-color:var(--bone,#ece6dc)}
.fz-tab span{font:500 11px var(--mono,monospace);opacity:.6}
.fz-sub{margin:34px 0 12px;font:400 clamp(24px,3vw,34px)/1.1 var(--serif,Georgia,serif);color:var(--bone,#ece6dc)}
@media (max-width:760px){.fz-tabs{padding:8px 10px}.fz-tab{min-height:46px;padding:0 16px;font-size:14px}}`;

/* world strings: this world first, then the worlds the pieces came from (their translations stay valid) */
function tFrom(ids: number[]) {
  return (k: string, en: string) => { for (const id of ids) { const key = `wi.${id}.${k}`, v = I18N.t(key); if (v !== key) return v; } return en; };
}

export default function (ctx: Ctx) {
  if (!document.getElementById('fzcss')) { const st = document.createElement('style'); st.id = 'fzcss'; st.textContent = CSS; document.head.append(st); }
  const t = tFrom([1, 2, 3, 7]);
  const label: Record<Tab, string> = { clothes: t('tab.clothes', 'Clothes'), shoes: t('tab.shoes', 'Shoes'), bags: t('tab.bags', 'Bags'), watches: t('tab.watches', 'Watches & jewellery') };
  const count: Record<Tab, number> = { clothes: SCAN_CLOTHES.length, shoes: SCAN_SHOES.length, bags: SCAN_BAGS.length, watches: SCAN_JEWEL.length + 1 };
  const bar = h('div', { class: 'fz-tabs', role: 'tablist', 'aria-label': t('tabs', 'Fashion') });
  const panes = {} as Record<Tab, HTMLElement>, made = new Set<Tab>();
  const btns = FASHION_TABS.map((k) => { const b = h('button', { type: 'button', class: 'fz-tab', role: 'tab', 'aria-selected': 'false', id: 'fzt-' + k }, document.createTextNode(label[k] + ' '), h('span', { text: String(count[k]) }));
    b.onclick = () => open(k, true); bar.append(b); return b; });
  ctx.root.append(bar);
  for (const k of FASHION_TABS) { const p = h('div', { role: 'tabpanel', 'aria-labelledby': 'fzt-' + k, hidden: true }); panes[k] = p; ctx.root.append(p); }

  function build(k: Tab) {
    const p = panes[k], c = { ...ctx, root: p, t };
    if (k === 'clothes') scanStudio(c, I18N.root, SCAN_CLOTHES, { title: 'clothes', acc: '#d9c7a8' });
    if (k === 'shoes') scanStudio(c, I18N.root, SCAN_SHOES, { title: 'shoes', acc: '#9fc3e8' });
    if (k === 'bags') scanStudio(c, I18N.root, SCAN_BAGS, { title: 'bags', acc: '#c8834a' });
    if (k === 'watches') {
      /* the real watch and jewellery models first (owner, 21 Nov: show the real collection), then nothing drawn */
      if (SCAN_JEWEL.length) { const jHost = h('div'); p.append(jHost);
        scanStudio({ ...c, root: jHost }, I18N.root, SCAN_JEWEL, { title: 'jewellery', acc: '#e9c873' }); }
      /* owner, 21 Nov 20:56: the drawn live watch is gone; the 3D Abidora watch built for him earlier comes back in its place */
      const wHost = h('div'); p.append(h('h2', { class: 'fz-sub', text: t('sub.w3d', 'Abidora 3D watch: it keeps your real time') }), wHost);
      watchShow({ ...ctx, id: 1, root: wHost, t: tFrom([1, 4]) });
    }
  }
  function open(k: Tab, push: boolean) {
    FASHION_TABS.forEach((x, i) => { panes[x].hidden = x !== k; btns[i].setAttribute('aria-selected', String(x === k)); });
    if (!made.has(k)) { made.add(k); build(k); }
    if (push) history.replaceState(null, '', location.pathname + location.search + '#' + k);
    dispatchEvent(new Event('resize'));
  }
  const fromHash = () => { const k = location.hash.slice(1) as Tab; return (FASHION_TABS as readonly string[]).includes(k) ? k : 'clothes'; };
  open(fromHash(), false);
  const onHash = () => open(fromHash(), false); addEventListener('hashchange', onHash); ctx.onDispose(() => removeEventListener('hashchange', onHash));
}
