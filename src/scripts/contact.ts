/* Contact form: validates in the browser, then posts to api/contact.php (validated again there). */
import { I18N } from './i18n';
export function contactForm() {
  const f = document.getElementById('cf') as HTMLFormElement | null, st = document.getElementById('cf-s');
  if (!f || !st) return;
  const T = I18N.t;
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = (id: string) => (document.getElementById(id) as HTMLInputElement).value.trim();
    if (!v('cf-n') || !v('cf-m') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('cf-e'))) { st.textContent = T('ct.invalid'); return; }
    st.textContent = T('ct.sending');
    const btn = f.querySelector('button'); if (btn) btn.disabled = true;
    fetch(I18N.root + 'api/contact.php', { method: 'POST', body: new FormData(f), headers: { Accept: 'application/json' } })
      .then((r) => r.json().catch(() => ({ ok: false, code: 'offline' }))) // no JSON means no PHP behind the page (a static preview)
      .then((j: { ok: boolean; code?: string }) => {
        if (j.ok) { st.textContent = T('ct.ok'); f.reset(); }
        else st.textContent = T(j.code === 'wait' ? 'ct.wait' : j.code === 'invalid' ? 'ct.invalid' : j.code === 'offline' ? 'ct.offline' : 'ct.fail');
      })
      .catch(() => { st.textContent = T('ct.offline'); })
      .finally(() => { if (btn) btn.disabled = false; });
  });
}
