# Test report

Version 0.4.0 · 2026-11-19 · Tested by the build pipeline and headless Chromium (Playwright). No human user testing yet.

## Wave A re-test (20 Nov 2026 afternoon, v0.5.0)
- Full page matrix: **160 / 160 passed**. 10 languages × 8 pages (home, atlas, galaxy, founder, credits, 404, world 65, studio) × 2 sizes (1440×900, 390×844). Checks: HTTP status, lang/dir, no horizontal scroll, no leftover template tokens, no JavaScript or console errors, no failed requests.
- Build: 0 errors, 100 pages verified.
- All-worlds check (72 worlds): pass except the known false alarm on world 19.
- Feature tests for the universe, page change, discovery strip, world bar and founder chapters: see IMPLEMENTATION_REPORT.md §2.
- Not tested: Safari, Firefox, real phones, the live host.

## 1. Full page matrix: 120 / 120 passed
10 languages × 6 pages × 2 viewports (desktop 1440×900, mobile 390×844).
Each page must: return HTTP 200 (404 page excepted), have the right `lang` and `dir` (Arabic rtl), have no horizontal scroll, contain no unrendered template tokens, and produce no JavaScript errors, console errors or failed requests (Google Fonts excluded).

## 2. Build verification: 60 / 60 pages
`tools/verify.mjs` checks every generated page for leftover tokens and that every local `src`, `href` and `srcset` file exists.

## 3. Type check
`astro check`: 0 errors, 0 warnings.

## 4. Founder portrait (this milestone)
| Check | Result |
|---|---|
| Trademarks removed (GTA VI logo, Vice City sign, VI emblem) | Pass, checked by eye on the crop |
| Face unaltered, no filters | Pass (crop and resize only) |
| Right image size served | Desktop 800w AVIF; tablet and mobile 480w AVIF |
| Layout shift from the photo | 0.000 on the Founder page (desktop, tablet, mobile, Arabic) |
| Homepage layout shift (whole page) | Fell from 0.28 to 0.01–0.05 after fixing the preloader animation |
| Parallax and reveal off in calm mode / reduced motion | Pass |
| Screenshots by eye | Desktop, tablet (820×1180), mobile; English, Arabic, Japanese, Bengali |

## 5. Hosting and backend (real Apache 2.4 + PHP 8 + MariaDB 10.11, in a subfolder /abidora/)
| Check | Result |
|---|---|
| Installer: checks, DB tables, admin user, publish, lock | Pass |
| .htaccess active; `_abidora/` and storage return 403 | Pass |
| Localised 404 via ErrorDocument | Pass |
| Admin login, wrong password, throttle | Pass |
| Messages, translations edit + sanitising, founder skills, users, audit, backup zip, settings, publish | Pass |
| Contact API: valid, invalid, honeypot, rate limit | Pass |
| canonical / hreflang / sitemap absolute once site address is set | Pass |

## 6. Visual checks done earlier this milestone
Galaxy (all 4 shapes, fly-in), worlds atlas (en, ja), Arabic mobile galaxy and search, Hindi galaxy, German credits, Bengali mobile menu.

## Not tested yet
- Real email sending (`mail()`) on the live host.
- HTTPS and LiteSpeed specifically (tested on Apache).
- Safari and Firefox (Chromium only), real phones.
- Lighthouse scores, screen reader pass.

---

# Night mission tests · v0.5.0 · 20 Nov 2026
All run by the build pipeline, Node and headless Chromium (Playwright) on the build server. No human or real-device testing.

| Test | Result |
|---|---|
| Type check + build (`npm run build`) | 0 errors, 100 pages verified, after every change |
| Unit tests on world code (Node) | 53: 10, 54: 24, 55: 19, 56: 11, 57: 15, 58: 13, 59: 23, 60: 12, 61: 18, 62: 11, 63: 21, 64: 18, 65: 26, 66: 18, 67: 20, 68: 25, 69: 16, 70: 14. All pass (314) |
| SHA-256 (world 62) | Matches official test vectors and Node's crypto |
| Anscombe data (world 61) | Correlation 0.816 for all four sets, as published |
| Interaction scripts per new world, desktop 1440×900 and phone 390×844 | 0 page errors; screenshots checked by eye |
| All-worlds check (70 worlds × en/bn/ar) | All render; world 19 shows one known false alarm |
| World page edge cases (`?w=999`, `?w=100` planned, `?w=abc`) | Page becomes visible with the right message |
| Gesture recogniser (world 64) | 360/360 synthetic hand-drawn shapes recognised (rotated, scaled, jittered, both directions) |
| Geography (world 65) | Distances (London–New York 5,570 km), solstice declination 23.44°, polar day/night at Longyearbyen, Equal Earth round trip error < 1e-12 |
| Sun times (world 68) | Sunrise/sunset within a few minutes of published times: Dhaka 20 Nov 06:16 / 17:11, London 21 Jun 04:43 / 21:22 BST, Sydney 21 Dec 05:41 / 20:05; polar night and midnight sun at Tromsø; local midnight correct on a daylight-saving change day |
| Horizon (world 69) | Eye at 1.7 m sees 4.65 km (5.0 km with refraction); Burj Khalifa tip 102.7 km; an object 30 km away hides about 50 m below the horizon; a 100 m object is exactly at the horizon at the computed distance |
| Patterns and calendars (worlds 66, 67) | Every tiling edge shared by exactly two tiles; Bengali calendar dates (14 April = 1 Boishakh, 21 February = 8 Falgun, 26 March = 12 Chaitra, 16 December = 1 Poush, 2023 to 2028); Roman, Chinese, Maya and Babylonian conversions |
| Lighthouse (16 runs) | See PERFORMANCE_REPORT.md |

Still not tested: Safari, Firefox, real phones, the live host, screen readers.
