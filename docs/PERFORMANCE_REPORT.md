# Performance report

Version 0.5.0 · 20 Nov 2026. Lighthouse actually run in headless Chromium against a local server (Apache-like static serving). Scores on the live host will differ.

## Lighthouse
| Page | Perf | A11y | Best practices | SEO | CLS |
|---|---|---|---|---|---|
| Home (phone) | 59 | 100 | 100 | 100 | 0 |
| Home (desktop) | 87 | 100 | 100 | 100 | 0.003 |
| Worlds atlas (phone) | 100 | 100 | 100 | 100 | 0.015 |
| Studio (phone) | 100 | 100 | 100 | 100 | 0.006 |
| Founder (phone) | 94 | 100 | 100 | 100 | 0.005 |
| World 1 | 100 | 97, then fixed (not re-run) | 100 | 100 | 0.001 |
| World 19 | 99 | 100 | 100 | 100 | 0.045 |
| World 60 | 77 → 99 | 96 → 100 | 100 | 100 | 0.59 → 0.019 |
| World 62 | 77 → 100 | 98 → 100 | 100 | 100 | 0.55 → 0.021 |
| Worlds 30 / 45 / 55 / 58 | 100 / 95 / 99 / 98 | 100 | 100 | 100 | ≤ 0.07 |
| World 64 (phone) | 100 | 100 | 100 | 100 | 0.014 |
| World 65 (phone) | 98 | 100 | 100 | 100 | 0.021 |
| World 66 (phone) | 99 | 100 | 100 | 100 | 0.045 |
| World 67 (phone) | 99 | 100 | 100 | 100 | 0.007 |
| World 68 (phone) | 99 | 100 | 100 | 100 | 0.061 |
| World 69 (phone) | 98 | 100 | 100 | 100 | 0.007 |
| World 70 (phone) | 97 | 100 | 100 | 100 | 0.008 |
| World 61 (desktop) | 100 | 97, then fixed (not re-run) | 100 | 100 | 0.001 |

Home on phone: the preloader and WebGL hero give about 1.1 s total blocking time. Not changed, because the hero is an approved feature.

## Wave A (20 Nov 2026 afternoon)
| Page | Perf | A11y | Best practices | SEO | CLS |
|---|---|---|---|---|---|
| Home (phone) | 42–66 across 6 runs | 100 | 100 | 100 | 0–0.001 |
| Home (desktop) | 86 | 100 | 100 | 100 | 0.003 |
| Founder (phone) | 87 | 100 | 100 | 100 | 0.005 |
| Worlds atlas (phone) | 100 | 100 | 100 | 100 | 0.018 |
| World 65 (phone) | 87–95 | 100 | 100 | 100 | 0.085 → 0.021 after fix |
| World 1 (phone) | 98 | 100 | 100 | 100 | 0.071 (before the fix) |

Why the homepage number moves so much: the test server has no graphics card, so every animated frame (grain, marquee, hero) is drawn by the processor and Lighthouse counts it as blocking time. A steadier measure, the browser's own long-task log with the CPU slowed 4×, gives about 590 ms blocking before and **about 316 ms** after Three.js was deferred until the visitor scrolls to the universe. The target of 80 on phone is not met and stays open for day 23 (preloader and hero cost).

Budgets now in place:
- Universe: Three.js (about 134 KB gzipped) loads only when the 3D stage is about to be seen, after the page has loaded and the browser is idle. Low tier = one still frame; mid tier = 30 fps; rendering pauses off screen and in hidden tabs.
- Page change script: 1.6 KB inline. Portals: CSS only, no images.
- Discovery strip: about 6 KB script; world descriptions add about 20 KB (English) to the homepage strings.
- Velocity headings: write to 5 headings only, and only while the value changes (an earlier version restyled the whole page every frame and was caught by Lighthouse and fixed).

## Payload
| Item | Size |
|---|---|
| Upload zip | 16.3 MB, 336 files |
| Each world | its own lazy chunk; only the world you open is downloaded |
| Galaxy engine (Three.js) | about 560 KB minified, about 140 KB gzipped, galaxy page only |

## What keeps it fast
- Static HTML, no server work per visit; each world is a separate script chunk.
- World stage is hidden until the header text is filled, so nothing jumps (CLS ≤ 0.05 on tested worlds).
- Animations pause when off-screen or the tab is hidden; heavy work (mining, training) is sliced per frame.
- Responsive AVIF images with fixed sizes; long cache headers for hashed files.

## To do
- Lighthouse on the live host; home page phone score.
- Serve 1600 px photos as AVIF/WebP; self-host fonts.
