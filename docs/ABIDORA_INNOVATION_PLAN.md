# Abidora innovation plan (from the 15-site benchmark)

Version 1.0 · 20 Nov 2026. Source research: REFERENCE_ANALYSIS.md (sections 3b and 5). Status of every item below: **PLANNED** until the build thread implements and tests it.
Rules: original Abidora versions only, nothing copied; approved stack only (Astro + TypeScript, Three.js/WebGL/GLSL, GSAP, Lenis, PHP 8, MySQL); no completed work removed; every effect off under Studio "Calm" and `prefers-reduced-motion`; phone first; pinch-zoom always allowed; every visual has a text equivalent.

## Fit with the 25-day plan
Current position: worlds 1–70 and 74 are TESTED, Studio days 2–4 done, next is world 071.
This plan adds one **"Wave A" block of about 3 build days now** (owner asked for real implementation of his 8 priorities), then folds the rest into days that already exist. No existing day or requirement is removed. Total plan may grow by about 3 days; that is stated openly, per the owner's "quality before deadline" rule.

| Block | When | Items |
|---|---|---|
| **Wave A** | now, before world 071 | I-1 to I-8 below (owner's priorities 1–8 at their core) |
| Worlds 71–112 | existing days 12–14 | every new world uses I-5, I-6, I-10 from day one; flagship 3D worlds use I-11 |
| Discovery | existing day 15 | I-12 to I-15 |
| Accounts / community | existing days 16–17 | I-16, I-17 |
| Abidora AI | existing days 18–22 | I-18, I-19 |
| Polish / QA | existing days 23–25 | I-20 to I-22, plus retro-fit I-5/I-6 to worlds 1–70 if not done in Wave A |

## Wave A: the owner's 8 priorities (implement now)

| ID | Owner priority | What to build (original Abidora version) | Reference principle | How (stack) | Perf budget | Effort | Acceptance test |
|---|---|---|---|---|---|---|---|
| I-1 | 1. Interactive 3D Universe homepage | **Universe home**: the ora ring at the centre, the 12 categories as orbiting systems (instanced points + labels), each world a star. Drag/scroll to orbit, tap a system to fly in, tap a star to open its card, "Enter" to go. Visited worlds glow (device storage). Below it, the existing editorial home continues unchanged. | Bruno (explore by moving), Active Theory (persistent object), REFERENCE_ANALYSIS T1 | Reuse world-074 Three.js engine; one InstancedMesh; labels as DOM (translatable, RTL-safe); load after first paint via `requestIdleCallback`; static SVG/AVIF poster on low tier and with reduced motion; accessible list link always visible | ≤ 160 KB gz JS on home, ≤ 3 ms/frame mid phone, 30 fps cap on low tier | 1.5 days | Phone Lighthouse home ≥ 80 (now 59), CLS ≤ 0.05; keyboard can reach every system via the list; works in en/bn/ar |
| I-2 | 2. Smooth cinematic navigation | **Ring portal page transitions**: Astro View Transitions; the clicked ring/card morphs into a circular mask that reveals the next page; back reverses it. Lenis kept for scroll. | Igloo, Active Theory, T2 | `astro:transitions` with `transition:name` on the ring; CSS `clip-path: circle()` fallback; no transition when reduced motion | ~0 KB extra (native API) | 0.5 day | Navigation between home → atlas → world → back with no flash and no layout jump; Safari/Firefox fall back to normal navigation without errors |
| I-3 | 3. Unique world-entry animations | **12 category entry shaders**, 500–700 ms each: Fashion = fabric fold, Automotive = speed streak, Architecture = blueprint draw, Nature = leaf ripple, Space = warp, Art = ink bleed, Tech = scan-line, Travel = map unfold, Interactive = particle gather, Tools = grid snap, Experimental = glitch, Originals = ring iris. One GLSL file, uniform switch. | Igloo designed transitions, T3 | One fullscreen quad, shader compiled during page idle; CSS-only fallback per category | ≤ 12 KB, ~1 ms/frame for < 0.7 s | 1 day | Each of 12 categories plays its own entry on desktop and phone; skipped instantly on tap/key; never blocks input |
| I-4 | 4. Interactive 3D objects and environments | **Category emblems in 3D**: each system in I-1 has one small procedural 3D emblem (no downloaded models) that reacts to pointer/tilt. Reused as the hero object on the category's atlas filter. | Lusion precompute, Bruno baked light, T4 | Procedural geometry + matcap shading, no textures to license | shares I-1 budget | 0.5 day | 12 emblems render on mid phone ≥ 30 fps; static image on low tier |
| I-5 | 5 + 7. Premium typography / mobile interactions | **World bar** on every world: Quality (auto/battery/full), Sound, Reset, "I'm stuck" (shows how-to), Backstage, Share. Bottom bar on phones (thumb zone, 44 px targets), top-right on desktop. | Bruno options, Lusion mute, T13 | One Astro component reading Studio prefs; i18n keys in 10 languages | < 4 KB | 0.5 day | Present on worlds 1–70 and 74; keyboard reachable; never covers world controls at 360 px width |
| I-6 | 5. Premium scrolling experience | **Pinned statements + velocity type** on home and Founder: a headline pins while its image/scene changes; display headings stretch ≤ 3 % with scroll speed. Founder becomes a vertical 4-chapter journey (Explore / Build / Learn / Next) with the centred cutout. | Apple pinned moments, Lando vertical drive, Resn, T5/T6/T14 | GSAP ScrollTrigger + Lenis velocity → CSS variable; `position: sticky` fallback | < 2 ms/frame | 0.5 day | No horizontal scroll at 320–1440 px; reduced motion = plain sections; Arabic RTL correct |
| I-7 | 6. Advanced visual discovery (first slice) | **Discovery strip** on home and atlas: World of the day (date-seeded, same for everyone), "Guide me" (2 questions → 1 world), "Surprise me" (never repeats until all seen), "Your input" filter. Full hub stays on day 15. | Arts & Culture, NASA, Stripe, Pudding, T7/T9/T10/T11 | experiences.json + new fields `mood`, `minutes`, `action`, `input` | < 6 KB | 0.5 day | Same world of the day across browsers on the same date; Guide me always returns a live world |
| I-8 | 8. Performance-optimised effects | **Quality tiers + budgets** for all effects: auto tier from `deviceMemory`, `hardwareConcurrency`, a 1-second frame-time probe and Save-Data; Studio override; animations pause off-screen/hidden tab (already done in worlds). Write the budgets into PERFORMANCE_REPORT.md. | Bruno Quality, Active Theory tiers | small `tier.ts` in kit | ~1 KB | 0.25 day | Low tier on a throttled phone profile keeps home ≥ 80 Lighthouse; full tier on desktop ≥ 90 |

Wave A also delivers: before/after screenshots of home, atlas, one world and Founder at 390 / 768 / 1440 px; IMPLEMENTATION_REPORT.md; UPDATED_FEATURE_STATUS.md; backup zip before starting.

## Later items (inside existing days)

| ID | Item | Day | Effort | Notes |
|---|---|---|---|---|
| I-9 | Backstage text for each world (80–150 words: technique, sources, what is simulated, limits) | written as each world is built; worlds 1–70 retro-fit on day 23 | S per world | FWA critique / Immersive Garden backstage |
| I-10 | Live text twin (aria-live status) on every canvas world | each new world; audit 1–70 on day 23 | S | Linear text UI; backlog idea 8 |
| I-11 | Precomputed (baked) simulation textures for flagship 3D worlds 73, 77, 78, 80, 101–112 | days 12–14 | M each | Lusion 2019 |
| I-12 | Discovery hub: doors by mood/colour, time, action, place, your input | 15 | M | Arts & Culture |
| I-13 | Suggested searches per language | 15 | S | NASA |
| I-14 | Universe map as search results view (reuses I-1) | 15 | S | |
| I-15 | Client search index per language (≈20 KB) | 15 | S | |
| I-16 | Passport hall: stamps for doing, one design per category | 16–17 | M | Bruno achievements, Lando hall of fame |
| I-17 | Moderated visitor notes inside worlds (off by default) | 17 | M | Bruno whispers |
| I-18 | AI as guide: knows current world, reads its Backstage, opens worlds by deep link | 18–22 | M | needs API key |
| I-19 | AI answers show sources and dates | 20 | S | needs search API |
| I-20 | "Now" page from CHANGELOG.md | 23 | S | Linear |
| I-21 | Self-review score (Design, Usability, Creativity, Content, Performance, Accessibility); < 7 in any = not TESTED | 23–25 and each world | S | Awwwards / FWA |
| I-22 | Honest numbers band from experiences.json | 23 | S | Stripe, Figma dated claims |

## Things deliberately not adopted
- Physics engine in the browser (Rapier/WASM ~400 KB) — our worlds use own small physics.
- Single-page WebGL site (Active Theory style) — breaks static HTML, SEO and 10-language pages.
- Disabling pinch-zoom (seen on 4 of 15 references) — accessibility failure.
- Any copied layout, font pairing, colour or asset from the 15 sites.

## Test matrix for every item
Desktop 1440, tablet 768 (portrait + landscape), phone 390 and 360; Chromium headless on the build server (Safari/Firefox real-device testing still listed as NOT STARTED in FEATURE_STATUS); Lighthouse phone + desktop; keyboard-only pass; reduced motion; languages en, bn, ar (RTL); console errors = 0.
