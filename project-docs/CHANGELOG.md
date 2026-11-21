# Changelog

## 0.5.1 · 2026-11-20 · quality audit release · not deployed (staging zip only)
No new worlds or features. Fixes found by the full audit:
- Sneaker World (003) finished on the showroom design: runner, court and high-top; outer side, inner side, above and behind; turn, zoom, light moods, stitching, spec sheet (42/42 tests).
- Abidora AI voice: ElevenLabs clone is the default; it switches itself off on credit or key errors (6 h / until fixed) and after the daily limit, and the page then uses the browser voice. Audio is streamed, the first sentence is kept short, and a slow clip (6 s) goes to the browser voice. Daily limit 300 characters, 200 per visitor.
- Abidora AI chat: the reply follows the script of the visitor's latest message (Banglish gets Banglish); "Abidora" stays in Latin letters.
- SEO: every world page now has its own title, description, canonical link, 10 hreflang links and structured data in the HTML (world-page.php), so link previews and crawlers see the real world name.
- A missing page under /bn/, /ar/ … shows the "not found" page in that language.
- Top bar: a soft band of the page colour appears behind the logo and menu after scrolling, so they never sit on top of text.
- Phones: finger-sized tap areas for the language and menu buttons, footer links and universe labels; compact round AI button; bottom world bar labels no longer cut off on 360 px screens; Sneaker World zoom buttons moved off the shoe.
- World 008: colour codes no longer cut off on phones; lock/copy/edit buttons 30 px.
- Homepage: the floating preview stopped running every frame when nothing moves.

## 0.5.0 · 2026-11-20 · not deployed (zip and private preview only)
### Wave A (20 Nov, afternoon)
- Homepage 3D Universe: the 12 categories as orbiting systems around the Abidora ring and every world as a star; visited worlds glow; list view and no-WebGL fallback; en/bn/ar tested.
- Cinematic page change from the click point on every page, and a portal in the category's style when you enter a world (12 designs).
- Discovery strip: world of the day, Guide me (5 moods), Surprise me, visited progress.
- World bar on every world: how-to, share, reset, back to the universe (bottom bar on phones).
- Pinned manifesto, velocity headings, Founder chapter bar.
- Three.js now loads only when you scroll to the universe; a phone layout jump from the new world bar fixed.
- Founder section: photo upright and fully visible on one screen; ring lowered.
- Contact: owner copy with Reply-To, designed auto-reply in 10 languages, limits (1 per address per day, 30 per hour), SMTP settings in Admin.
- World 071 Global Food Universe.
### Days 7–8 (earlier sessions)
- Worlds 021–052 live, each with its own design and working tools (see EXPERIENCE_ROADMAP.md for the list).
### Night mission (00:20–07:20 UTC)
- Worlds 053–065 live: Vibration Machines (Chladni plate, harmonograph), Infinite Zoom Gallery (Mandelbrot deep zoom, Droste painter), AI Universe (n-gram text, perceptron, A*, minimax, all local), Robotics World (IK arm, PID line follower), Future Technology (5-qubit quantum circuit simulator), Web Innovation Lab (page-load simulator), Creative Coding Lab (Turtle Studio with its own safe Logo language), Machine Learning Explorer (own neural network with Adam, doodle trainer), Interactive Data World (Anscombe's quartet, dice, page timings, your CSV), Blockchain Learning Space (own SHA-256, mining, peers), Digital Innovation Museum (gate adder, 8-bit computer with assembler, Hamming, Huffman).
- World 065 World Explorer: real coastlines (Natural Earth 1:110m), globe / Mercator / Equal Earth, live day and night, great-circle routes with local clocks and day length, Tissot distortion circles.
- World 066 Global Architecture: star patterns by Hankin's method on square, hexagonal, octagon-square, tri-hex and rhombi tilings (SVG/PNG export); arch studio with seven arch families, rise and voussoirs.
- World 067 Cultural Discovery: 11 calendars side by side (revised Bangladesh Bengali calendar computed in code, the rest via Intl), year rings, next new year; numbers in many digit systems, Chinese, Roman, Maya and Babylonian.
- World 068 Travel Photography: Sun-based light planner for 40 cities (golden and blue hours, sunrise and sunset, light direction, local time zones including daylight saving); composition desk for a local photo with guides, crop ratios, straightening, histogram and export. Shared geography code moved to src/worlds/geo.ts (world 65 tests still pass).
- World 070 World Heritage: 40 UNESCO World Heritage properties (3 in Bangladesh) on an Equal Earth map with real coastlines; type and region filters, a year slider and "play the years" from 1978; a 10-round "Where is it?" game scored by great-circle distance, best score kept on the device.
- Founder page: portrait centred, ring sized from the portrait and placed just above the head, portrait scales with screen height, floor light; homepage founder portrait stands on the section edge.
- World 069 Famous Landmarks: 15 landmarks at true height with a person for scale (metres/feet, year finished); view from the top with Earth-curve horizon, refraction option, tip visibility and great-circle distance from 40 cities.
- World 064 Future Interfaces: gesture commands with the $1 Unistroke Recognizer (teach your own gestures) and a Fitts's law pointing test with throughput per device.
- World pages no longer jump on phones while the title loads (Lighthouse CLS 0.59 → about 0.02).
- Shared canvas toolkit keeps the picture when a panel resizes (no black flashes).
- Accessibility: contrast in world 19, list markup in world 1, 22 px checkboxes in all worlds, heading order in worlds 2, 6, 10, 12, 14, 18, 22 and 62.
- Version set to 0.5.0 (package.json and boot.php).

## Unreleased · 25-day sprint (in progress, not yet deployed)
### Day 1
- Founder portrait: Abidora branding in place of third-party marks (wordmark, neon sign, sofa ring); face, colours and composition unchanged.
### Days 2–3
- 100+ themes and 100+ cursors with live preview, saved per visitor on their own device.
### Day 4
- Personal Universe Studio: combine theme, cursor, type scale and motion; save, share by link or code, import, reset. Shared codes are validated before use.
### Day 5
- World page system (`worlds/w/?w=<id>`) with favourites, full screen, previous/next, planned and not-found states, 10-language shell.
- Worlds 001–010 live (weave studio, capsule wardrobe with dress-up rail, sneaker configurator, watch atelier with time-of-day scene, gem light lab, tote pattern maker, streetwear graphics, palette lab, fabric physics, century of silhouettes).
- Video references 1, 3 and 9 built into worlds 004 and 002.
### Day 6
- Worlds 011–020 live: performance lab, EV trip planner, lean-angle lab, automotive history timeline and ordering game, concept-car wind tunnel (lattice-Boltzmann), aircraft explorer (NACA + ISA), orbit sandbox with Hohmann planner, commute compare, architecture in three chapters (facade, sun and shadow, hanging-chain arch), room planner with door and fog-wipe intro.
- Video references 2, 5 and 6 built into worlds 019, 011/012 and 020.
- World descriptions and how-to text for 011–020 in all 10 languages (AI drafts, need native review).
- Functional checks: 29/29 (worlds 1–10) and 37/37 (worlds 11–20).

## 0.4.1 · 2026-11-19
- Founder portrait now shows the full photo (no crop); only the three third-party marks are blended out.
- Homepage index hover preview: full-resolution images (were 720 px), larger frame with caption, smooth reveal; images preload when the index comes near.
- 120/120 matrix tests pass again.

## 0.4.0 · 2026-11-19 · Milestone 1
### Added
- Astro + TypeScript build rendered into 10 languages by a PHP renderer; works from any subfolder.
- Web installer (`/install/`) and admin (messages, translations, founder, worlds, users, audit, backup, settings, publish).
- Contact form API with spam protection and rate limit.
- Worlds atlas for all 112 planned worlds with search and filters.
- World 074 **Digital Galaxy** (Three.js, four galaxy shapes, fly-in, fallbacks).
- Founder portrait (owner's photo, trademarks cropped out, AVIF/WebP/JPG).
- Cinematic founder section on the homepage.
- Founder page rebuilt in the owner's five sections: Founder & Vision, Technology & Innovation, Creative Direction, Building & Projects, Future Exploration. Interests are labelled as exploration; real projects are kept separate.
- New founder tagline: "Exploring the possibilities of intelligence, technology and imagination to build what comes next."
- Credits generated from the asset register, including owner-provided images.
- Knowledge files for the future Abidora AI.
- Docs set in `docs/`.
### Changed
- Homepage preloader animation no longer causes layout shift.
- Contact section is now (06); founder section is (05).
### Removed
- "Skills & Interests" heading (owner request). The old skills list remains as neutral "Focus areas".

## 0.3 · 2026-11-19
v3 single-page prototype, reference board, asset board, Abidora rebrand (from AbidNova).

## 0.2 · earlier
Phase 1 generic version (rejected by the owner as too generic).

## 0.5.1 hotfix (2026-11-20): mouse on the AI page
- Bug: on Abidora AI, Credits and 404 pages the mouse pointer was invisible. The site hid the system pointer (custom cursor on) but those pages have no custom cursor element.
- Fix: studio-core.ts only hides the system pointer when the page has #cur. Shipped as patches/mousefix-0.5.1/abidora-mousefix.zip (replaces _astro/common.95H9ieUB.js in place). Tested on the local staging copy: AI/Credits/404 show the normal pointer, clicks and typing work; other pages keep the custom cursor.
