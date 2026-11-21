# Asset sources and licences

Version 0.5.0 · 2026-11-20. Source of truth: `public/_abidora/data/assets.json`; the public Credits page (all 10 languages) is generated from it.

## Rules we follow
- Only media we have a licence or the owner's permission for. No watermarks removed, no hotlinking, nothing assumed free just because it is public.
- Every file is recorded with subject, source, licence, sizes and the pages it is used on.

## Data used in worlds (v0.5.0)
- World 61 uses Anscombe's quartet (F. J. Anscombe, "Graphs in Statistical Analysis", The American Statistician, 1973), a published dataset of 44 numbers.
- Dated facts in world 63: ASCII (1963), Hamming code (1950), Huffman coding (1952).
- World 65 uses coastlines from Natural Earth 1:110m (public domain, naturalearthdata.com), taken from the world-atlas package 2.0.2 (ISC licence, © Michael Bostock), converted at build time and bundled; nothing is fetched at run time.
- World 70 site list: names, countries and first inscription years as published on the UNESCO World Heritage List (whc.unesco.org), coordinates rounded to 0.01°, entered by hand; map coastlines as in world 65.
- Worlds 68 and 69 use no images from anywhere: the sample photo in world 68 and all landmark outlines in world 69 are drawn in code. Sun positions are computed with standard astronomical formulas; landmark heights, years and coordinates are widely published public facts (heights to the tip), entered by hand.
- No new photos, video or audio were added in v0.5.0; worlds 053–065 draw everything in code.

## Known gaps (honest)
- **Photographer names are not recorded** for the 26 Unsplash photos. From this build server only images.unsplash.com is reachable; unsplash.com itself shows a bot check, which we did not bypass. The Credits page says “Not recorded”. Fill the `creator` field in assets.json (or ask us to) once the names are looked up in a normal browser.
- Four photos show brand logos (sneaker, watch, car, etc.). Replace them before a public launch to avoid any trademark question.
- Fonts (Instrument Serif, Inter Tight, JetBrains Mono, Noto families for non-Latin scripts) load from Google Fonts under the SIL Open Font License.

## Register
| File | Subject | Source | Licence | Sizes | Used on |
|---|---|---|---|---|---|
| `assets/home/cosmos-nebula.jpg (+ cosmos-nebula-s.jpg)` | Nebula in deep space | https://images.unsplash.com/photo-1462331940025-496dfbfc7564 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home, galaxy |
| `assets/home/earth-orbit.jpg (+ earth-orbit-s.jpg)` | Earth from orbit at night | https://images.unsplash.com/photo-1446776811953-b23d57bd21aa | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/aurora.jpg (+ aurora-s.jpg)` | Aurora over mountains | https://images.unsplash.com/photo-1531366936337-7c912a4589a7 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/castle-mist.jpg (+ castle-mist-s.jpg)` | Stone bridge and castle in mist | https://images.unsplash.com/photo-1518709268805-4e9042af9f23 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/city-dawn.jpg (+ city-dawn-s.jpg)` | City skyline at dawn | https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/desert.jpg (+ desert-s.jpg)` | Desert canyon light | https://images.unsplash.com/photo-1509316785289-025f5b846b35 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/tokyo-neon.jpg (+ tokyo-neon-s.jpg)` | Neon street at night | https://images.unsplash.com/photo-1540959733332-eab4deabeeaf | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/octopus.jpg (+ octopus-s.jpg)` | Octopus underwater | https://images.unsplash.com/photo-1545671913-b89ac1b4ac10 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/forest-mist.jpg (+ forest-mist-s.jpg)` | Misty forest | https://images.unsplash.com/photo-1448375240586-882707db888b | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/star-sea.jpg (+ star-sea-s.jpg)` | Stars over the sea | https://images.unsplash.com/photo-1534447677768-be436bb09401 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/sneaker-red.jpg (+ sneaker-red-s.jpg)` | Red running shoe | https://images.unsplash.com/photo-1542291026-7eec264c27ff | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/car-night.jpg (+ car-night-s.jpg)` | Sports car at night | https://images.unsplash.com/photo-1503376780353-7e6692767b70 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/watch.jpg (+ watch-s.jpg)` | Chronograph wristwatch | https://images.unsplash.com/photo-1523170335258-f5ed11844a49 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/fashion.jpg (+ fashion-s.jpg)` | Fashion portrait in yellow | https://images.unsplash.com/photo-1515886657613-9f3515b0c78f | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/food.jpg (+ food-s.jpg)` | Plated food | https://images.unsplash.com/photo-1504674900247-0877df9cc836 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/robot.jpg (+ robot-s.jpg)` | Humanoid robot | https://images.unsplash.com/photo-1485827404703-89b55fcc595e | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/art-abstract.jpg (+ art-abstract-s.jpg)` | Abstract painting | https://images.unsplash.com/photo-1544967082-d9d25d867d66 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/architecture.jpg (+ architecture-s.jpg)` | Modern architecture | https://images.unsplash.com/photo-1487958449943-2429e8be8625 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | — |
| `assets/home/diver.jpg (+ diver-s.jpg)` | Diver with fish school | https://images.unsplash.com/photo-1544551763-46a013bb70d5 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/waterfall.jpg (+ waterfall-s.jpg)` | Waterfall | https://images.unsplash.com/photo-1432405972618-c60b0225b8f9 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/milkyway.jpg (+ milkyway-s.jpg)` | Milky Way over mountains | https://images.unsplash.com/photo-1519681393784-d120267933ba | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/coast.jpg (+ coast-s.jpg)` | Coastline | https://images.unsplash.com/photo-1505118380757-91f5f5632de0 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | — |
| `assets/home/interior.jpg (+ interior-s.jpg)` | Interior living space | https://images.unsplash.com/photo-1600210492486-724fe5c67fb0 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | home |
| `assets/home/headphones.jpg (+ headphones-s.jpg)` | Headphones product shot | https://images.unsplash.com/photo-1505740420928-5e560c06d30e | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | — |
| `assets/home/valley.jpg (+ valley-s.jpg)` | Mountain valley | https://images.unsplash.com/photo-1464822759023-fed622ff2c3b | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | — |
| `assets/home/coffee.jpg (+ coffee-s.jpg)` | Coffee cup | https://images.unsplash.com/photo-1495474472287-4d71bcdd2085 | Unsplash License (free commercial use, no attribution required, credit given anyway) | 1600px, 720px | — |
| `assets/founder/abid-islam-founder-*.avif|webp|jpg (640/1100/1600 widths)` | Portrait of the founder, Abid Islam | Owner-provided | Provided by the owner for use on the site. Cropped to remove third-party trademarks; face unaltered. Untouched original kept outside the public site. | 1600px, 1100px, 640px | home, founder |

## Founder portrait
Owner-provided image (uploaded 2026-11-19). The site shows the FULL image. Per the owner's final instruction (19 Nov, 22:25 UTC) the three third-party marks (the GTA VI logo, the Vice City sign and the VI palm emblem) are replaced by Abidora branding: the Abidora wordmark with "A universe without limits" top left, an "Abidora" neon sign on the building, and the ora ring on the sofa. Face, people, colours and composition are unchanged. Untouched original: `abid-site/originals/founder-portrait-original.png` (not public). Master used for the site: `abid-site/originals/founder-portrait-abidora-master.png` (made by `scratchpad`-style script from the earlier masked master; fonts Instrument Serif/Sans, OFL).


**Pending (2026-11-19 23:38 UTC):** a new owner-chosen "Abidora Dream City VII" portrait is being finalised in the logo thread. The site keeps the current portrait until the owner confirms the final file.
