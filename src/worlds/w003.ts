/* 003 Shoes: the Abidora 3D shoe studio. Original shoe models built in Blender (tools/blender/shoe.py), each part a
   separate editable zone, a library of designs to open and customise, and a 3D gallery with a licensed scanned shoe.
   Owner, 21 Nov: "remove old and duplicate designs". The older flat 2D sneaker designer was replaced by this 3D
   studio; its useful functions (colour and material per part, presets, saved designs, image export) live on here.
   A backup of the old file is kept outside the build. */
import { sneakerShow } from './sneaker3d';
import { scanStudio, SCAN_SHOES } from './scanstudio';
import { I18N } from '../scripts/i18n';
import { type Ctx, h } from './kit';

export default function (ctx: Ctx) {
  const t = ctx.t;
  if (!document.getElementById('w003css')) { const st = document.createElement('style'); st.id = 'w003css'; st.textContent = '.fx-gal{margin:0 0 40px}.fx-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:6px 20px;margin-bottom:14px}.fx-h{margin:0;font:400 clamp(28px,4vw,44px)/1.05 var(--serif,Georgia,serif);color:var(--bone,#ece6dc)}.fx-lead{margin:0;color:var(--mute,#a49d91);font-size:14px;max-width:60ch}.fx-edit{border:0;border-radius:999px;padding:10px 18px;background:var(--bone,#ece6dc);color:var(--ink,#111);font:600 14px var(--sans,sans-serif);cursor:pointer;min-height:44px}'; document.head.append(st); }
  /* owner, 21 Nov: the code-made sneaker configurator and its design library are retired; only real scanned shoes stay */
  /* 3D gallery: a real product scan with its factory colourways, loaded only when opened */
  const gal = h('section', { class: 'fx-gal' });
  const head = h('div', { class: 'fx-head' }, h('h2', { class: 'fx-h', text: t('gal.h', '3D gallery') }),
    h('p', { class: 'fx-lead', text: t('gal.p', 'A scanned shoe with its three factory colourways, shown at true size. More licensed scans join here as they are added.') }));
  const open = h('button', { type: 'button', class: 'fx-edit', text: t('gal.open', 'Open the 3D gallery') });
  const host = h('div');
  open.onclick = () => { open.remove(); sneakerShow({ ...ctx, root: host }, I18N.root); };
  gal.append(head, open, host);
  /* real scanned shoes (owner's Sketchfab picks, CC BY 4.0): every part recolourable, loaded when scrolled into view */
  const sc = h('section', { class: 'fx-gal' });
  sc.append(h('div', { class: 'fx-head' }, h('h2', { class: 'fx-h', text: t('scan.h', 'Real scanned shoes') }),
    h('p', { class: 'fx-lead', text: t('scan.p', 'Photographed, real-world shoes in 3D: the leather creases, scuffs and stitching are the real thing. Pick a part and give it a new colour or finish; the scan’s own texture stays.') })));
  const sHost = h('div'); sc.append(sHost);
  ctx.root.append(sc, gal);
  scanStudio({ ...ctx, root: sHost }, I18N.root, SCAN_SHOES, { title: 'shoes', acc: '#d9c7a8' });
}
