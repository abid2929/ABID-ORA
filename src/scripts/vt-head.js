/* Cinematic page change (Wave A, I-2/I-3). Runs in <head> so it can catch the first frame of the new page.
   Old page: remember where the visitor clicked (and which world, if any). New page: open from that point as a
   growing circle; a world link also gets a short portal in its category's style. Reduced motion or Studio "Calm"
   skip it. Browsers without cross-document View Transitions simply navigate as before. */
(function () {
  var d = document.documentElement, K = 'ab.vt';
  function calm() { try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 1; return JSON.parse(localStorage.getItem('abidora.studio') || '{}').motion === 'calm'; } catch (e) { return 0; } }
  addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.target || a.hasAttribute('download') || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
    var x = e.clientX, y = e.clientY;
    if (!e.detail) { var r = a.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; } /* keyboard */
    var m = /[?&]w=(\d+)/.exec(u.search), w = m ? +m[1] : (/digital-galaxy/.test(u.pathname) ? 74 : 0);
    try { sessionStorage.setItem(K, JSON.stringify({ x: x / innerWidth, y: y / innerHeight, w: w, t: Date.now() })); } catch (x2) { /* private mode */ }
  }, true);
  addEventListener('pagereveal', function (e) {
    var vt = e.viewTransition; if (!vt) return;
    if (calm()) { vt.skipTransition(); return; }
    var v = {}; try { v = JSON.parse(sessionStorage.getItem(K) || '{}'); sessionStorage.removeItem(K); } catch (x) { /* ignore */ }
    if (!v.t || Date.now() - v.t > 8000) v = { x: .5, y: .5, w: 0 }; /* back/forward or typed address: open from the centre */
    d.style.setProperty('--vx', (v.x * 100).toFixed(2) + '%'); d.style.setProperty('--vy', (v.y * 100).toFixed(2) + '%');
    if (v.w > 0 && v.w < 200) { var B = [10, 18, 26, 35, 44, 54, 64, 72, 82, 90, 100, 112], L = 'ABCDEFGHIJKX', i = 0; while (i < 11 && v.w > B[i]) i++; d.setAttribute('data-portal', L[i]); }
    d.classList.add('vt');
    vt.finished.finally(function () { d.classList.remove('vt'); d.removeAttribute('data-portal'); d.style.removeProperty('--vx'); d.style.removeProperty('--vy'); });
  });
})();
