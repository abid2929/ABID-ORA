/* 0.9.13 picture quality by device. Runs first in <head>.
   Choice (localStorage abidora.q): "auto" (default), "high", "low".
   Auto = low on weak devices (few CPU cores, little memory, Data Saver) or when an earlier visit measured slow frames.
   Low: every 3D view renders at 1x pixels (devicePixelRatio capped for scripts only; text and photos stay sharp),
   and the heavy glass blur, film grain and moving glow are switched off. High: full sharpness on every device. */
(function () {
  var d = document.documentElement, q = 'auto', slow = '0';
  try { q = localStorage.getItem('abidora.q') || 'auto'; slow = localStorage.getItem('abidora.q.slow') || '0'; } catch (e) {}
  var n = navigator, c = n.connection || {}, cores = n.hardwareConcurrency || 8, mem = n.deviceMemory || 8;
  var weak = cores <= 4 || mem <= 3 || !!c.saveData || slow === '1';
  var low = q === 'low' || (q === 'auto' && weak);
  d.setAttribute('data-q', low ? 'low' : 'high'); d.setAttribute('data-qc', q);
  if (low) {
    var real = window.devicePixelRatio || 1;
    try { Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: function () { return Math.min(real, 1); } }); } catch (e) {}
  }
  /* Auto only: watch the first seconds; if frames are slow, remember it so the next page opens light */
  if (q === 'auto' && !low && window.requestAnimationFrame) {
    addEventListener('load', function () {
      var f = 0, t0 = 0, done = false;
      function tick(t) { if (!t0) t0 = t; f++; if (t - t0 < 5000) requestAnimationFrame(tick); else if (!done) { done = true;
        var fps = f * 1000 / (t - t0); if (fps < 38 && !document.hidden) { try { localStorage.setItem('abidora.q.slow', '1'); } catch (e) {} d.setAttribute('data-q', 'low'); } } }
      setTimeout(function () { requestAnimationFrame(tick); }, 1500);
    });
  }
})();
