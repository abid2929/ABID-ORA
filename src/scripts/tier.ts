/* Quality tiers for heavy effects (Wave A, I-8).
   'low'  : static picture, no continuous animation (Save-Data, ≤ 2 GB memory, ≤ 2 cores, or a slow frame probe)
   'mid'  : animation capped at 30 fps, fewer particles
   'full' : everything at the display rate
   Reduced motion or Studio "Calm" never animate, whatever the tier. A Studio override ('ab.tier' = low|mid|full)
   wins over the automatic choice. The probe measures real frame times for one second, after first paint. */
export type Tier = 'low' | 'mid' | 'full';
const KEY = 'ab.tier';
const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

export function tierOverride(): Tier | null { try { const v = localStorage.getItem(KEY); return v === 'low' || v === 'mid' || v === 'full' ? v : null; } catch { return null; } }
export function setTierOverride(t: Tier | null) { try { if (t) localStorage.setItem(KEY, t); else localStorage.removeItem(KEY); } catch { /* private mode */ } }

/** quick guess from the device, no measuring */
export function guessTier(): Tier {
  const o = tierOverride(); if (o) return o;
  if (nav.connection?.saveData) return 'low';
  const mem = nav.deviceMemory ?? 8, cores = nav.hardwareConcurrency ?? 8;
  if (mem <= 2 || cores <= 2) return 'low';
  if (mem <= 4 || cores <= 4 || innerWidth < 820) return 'mid';
  return 'full';
}

/** guess, then confirm with a one-second frame probe (median frame time). Never upgrades past the guess. */
export function measureTier(): Promise<Tier> {
  const g = guessTier(); if (tierOverride() || g === 'low') return Promise.resolve(g);
  return new Promise((res) => {
    const ts: number[] = []; let last = 0; const t0 = performance.now();
    const step = (t: number) => {
      if (last) ts.push(t - last); last = t;
      if (t - t0 < 1000 && document.visibilityState === 'visible') requestAnimationFrame(step);
      else { ts.sort((a, b) => a - b); const med = ts.length ? ts[ts.length >> 1] : 16; res(med > 40 ? 'low' : med > 24 && g === 'full' ? 'mid' : g); }
    };
    requestAnimationFrame(step);
  });
}

export const stillMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'calm';
