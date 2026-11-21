# Abidora: complete project audit

20 November 2026, about 16:00 Dhaka time. Version 0.5.0, Preview v20. **Nothing has been uploaded to the live site.**

## How this audit was made
I read the actual source (`src/`, `public/_abidora/`, `experiences.json`, the 10 language files) and the existing reports. I also ran new tests today, listed in Part 4.

Counting rules:
- **COMPLETED = 0.** Nothing counts as completed until you sign it off.
- Planned, placeholder or half-built work is never counted as done.
- Everything below was checked on the build server only. I have not tested on a real phone, Safari, Firefox or your live host. The reason is not lack of effort: the build server simply has none of these.

Evidence files:
- `abid-site/audit/audit-worlds-2026-11-20.json`: today's raw results for all worlds.
- `abid-site/audit/before-fashion/`: screenshots of the current fashion worlds.
- `abid-site/waveA/after/`: Wave A screenshots.
- `staging-v20/STAGING_TEST_REPORT.md`.
- `docs/TEST_REPORT.md` and `docs/PERFORMANCE_REPORT.md`.

---

# PART 1: Development history (chronological)

### 0.2: Phase 1 generic version (before 19 Nov)
1. **Objective:** a first personal site.
2. **Built:** a generic single page.
3. **Result:** you rejected it as too generic. It is not part of the current code.

### 0.3: v3 prototype and rebrand (19 Nov)
1. **Objective:** find a visual identity.
2. **Built:**
   - A single-page prototype.
   - A reference board and an asset board.
   - The rebrand from AbidNova to Abidora.
3. **Files:** `abidora-prototype-01.zip`, `docs/archive-v3/`, `REFERENCE_BOARD.md`.
4. **Status:** kept as an archive only.

### 0.4.0: Milestone 1, the real platform (19 Nov)
1. **Objective:** the approved stack (Astro + TypeScript, PHP 8, MySQL, JSON i18n), 10 languages, an installer and admin, cPanel-ready.
2. **Built:**
   - Astro builds page *templates*.
   - A PHP renderer (`_abidora/lib/render.php`) turns them into static HTML for 10 languages, both at build time and when you press Publish in admin.
   - Installer (`/install/`) and admin (`/admin/`).
   - Contact API (`/api/contact.php`).
   - Worlds atlas listing all 112 worlds, with search and filters.
   - World 074 Digital Galaxy (Three.js).
   - Founder page in your 5 approved sections.
   - Credits page generated from the asset register.
   - Knowledge files for the future AI.
3. **Technology:** Astro 7, TypeScript, Three.js, GSAP, Lenis, PHP 8.1+, PDO (MySQL, with SQLite as a fallback).
4. **Design decisions:**
   - No Node on the host, so it runs on cPanel.
   - Works from any subfolder (`/abidora/`).
   - Secrets only in `storage/config.php`, which the web cannot reach.
5. **Tests:** page matrix 120/120, build check of 60 pages, installer/admin/contact on real Apache + PHP + MariaDB.
6. **Problems fixed:** a layout jump from the preloader (CLS 0.28 → 0.01–0.05); third-party marks removed from the founder photo, face unchanged.

### 0.4.1 (19 Nov)
- Founder portrait shown in full.
- Hover previews at full resolution.
- Matrix 120/120.

### Sprint days 1–6 (19–20 Nov)
1. **Objective:** your 25-day plan.
2. **Built:**
   - **Day 1:** founder photo branding fixes.
   - **Days 2–3:** 104 themes and 104 cursors (`src/data/themes.ts`, `cursors.ts`).
   - **Day 4:** Personal Universe Studio (save, share by link or code, import, reset; shared codes are validated).
   - **Day 5:** the world page system (`worlds/w/?w=N`) and worlds 001–010.
   - **Day 6:** worlds 011–020.
3. **Tests:** functional checks 29/29 (worlds 1–10) and 37/37 (worlds 11–20).

### Days 7–8 and the night mission (20 Nov)
1. **Objective:** worlds 21 onward, each with its own design and real tools.
2. **Built:**
   - Worlds 021–071, one TypeScript file each (`src/worlds/w0NN.ts`, 92–492 lines).
   - Shared code: `kit.ts` (canvas toolkit), `geo.ts` and `land110.ts` (real coastlines).
3. **Design decision:** each world is a real working tool or simulation, computed in the browser. Nothing is faked, and no API key is needed.
4. **Tests:**
   - 314 unit tests on worlds 53–70, all pass, plus unit tests for 32, 35, 38, 39 and 47–52, 71.
   - Interaction scripts at desktop and phone size for 40–44 and 46–71.
5. **Problems fixed:**
   - World pages jumped on phones (CLS 0.59 → 0.02).
   - Black flashes when canvases resized.
   - Contrast and heading-order accessibility issues.

### Wave A, v0.5.0, Preview v20 (20 Nov afternoon)
1. **Objective:** turn the reference research into real features.
2. **Built:**
   - 3D Universe on the homepage.
   - Cinematic page change.
   - 12 world portals.
   - World bar (save, full screen, how-to, share, reset, back to universe).
   - Pinned manifesto and headings that respond to scroll speed.
   - Founder chapter bar.
   - Discovery strip: World of the day, Guide me, Surprise me.
   - Quality tiers.
   - Contact auto-reply email in 10 languages.
   - Founder ring lowered (your request).
3. **Files:** see `docs/IMPLEMENTATION_REPORT.md` §5.
4. **Problems fixed:**
   - 3D crash ("reading 'center'").
   - Phone camera clipping.
   - A CSS class collision.
   - Lighthouse blocking time exploding to 13 s.
   - Three.js loading too early on phones (blocking time about 590 → 316 ms).
   - World bar layout jump (CLS 0.085 → 0.021).
5. **Incomplete:**
   - Quality tiers are used only by the universe.
   - Discovery is not yet on the atlas.
   - Phone homepage Lighthouse is still below 80.

### Staging package v20 (20 Nov, today)
1. **Objective:** a safe staging package, not on `public_html`.
2. **Built:**
   - `staging-v20/abidora-v20-staging.zip` (with noindex).
   - `abidora-v20.zip` and `abidora-v20-source.zip`.
   - The Bengali cPanel guide with rollback.
   - A staging test report.
3. **Tests:**
   - Clean `npm ci` and build.
   - PHP and MySQL requirement check.
   - Secrets scan.
   - Clean install on a separate staging host.
   - Crawl of 852 URLs with 0 broken.
   - All worlds, contact, admin and lockout.
   - Lighthouse.

### Waiting on you
- **Your real photo**, for a new founder cutout (the hair looked AI-made).

---

# PART 2: Feature-by-feature status

Status words used below:
- **TESTED:** built and checked automatically on the build server.
- **IMPLEMENTED:** built but not fully tested.
- **PARTIAL:** some of it is built.
- **NOT STARTED:** nothing built yet.

## A. Homepage and 3D Universe
| Feature | Status | Evidence / notes |
|---|---|---|
| 3D universe | TESTED | `universe.ts`, `universe-scene.ts`. Desktop and phone, en/bn/ar; no JavaScript errors |
| 12 category portals | TESTED (Chromium) | 12 CSS portal designs in `abidora.css`; frames captured. Firefox navigates without the animation |
| 112-world navigation | TESTED | Every world is a star (72 bright, 40 faint); list view gives the same links |
| Interactive objects | TESTED | Category emblems, stars, panel with "Enter" |
| Drag and touch | TESTED (emulated) | Mouse and emulated touch only; no real phone |
| Cinematic transitions | TESTED (Chromium) | View Transitions; skipped in Calm or reduced motion |
| Portal animations | TESTED (Chromium) | as above |
| Daily World | TESTED | Same world for everyone on a date (`discover.ts`) |
| Guided discovery | PARTIAL | 5 moods → 3 worlds. The plan asked for 2 questions; only 1 is built |
| Surprise discovery | TESTED | 12 in a row were all different |
| Mobile homepage performance | **NOT MET** | Lighthouse phone 44–66 (target 80) |

## B. All 112 worlds, one by one
Summary:
- 72 are live: 001–071 and 074.
- 40 are planned: 072, 073 and 075–112.
- Today's test opened every live world at desktop 1280 px and phone 390 px: **144 of 144 runs** with 0 page errors, 0 console errors (apart from the test browser's software-GPU warning), no sideways scrolling, and working controls present.

Test labels in the table:
- "functional check" = the day 5–6 scripted checks.
- "interaction script" = a script that uses the world's tools at both sizes.
- "unit tests" = Node tests on the world's maths.
- "langs" = languages opened automatically.

| # | World | Category | Status | Design | Working features | Content | Images / media | Mobile | Testing | Remaining |
|---|---|---|---|---|---|---|---|---|---|---|
| 001 | Fashion Universe | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A real weave simulator | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 002 | Clothing Gallery | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A capsule wardrobe planner | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 003 | Sneaker World | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A sneaker configurator for an original Abidora shoe | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 004 | Luxury Watch Gallery | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A watch atelier | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 005 | Jewelry Universe | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A gem light lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 006 | Bags & Accessories | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A tote bag pattern maker | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 007 | Streetwear Culture | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A streetwear graphic maker in the screen-print tradition: stacked outlines, arcs, waves and repeats, two-ink misregistration an… | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 008 | Fashion Trends | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A palette lab built on colour theory | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn; can read your own photo | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 009 | Digital Fashion Lab | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | Fabric physics: a cloth made of particles and springs, with silk, cotton, denim, wool and chiffon each moving, stretching and t… | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 010 | Virtual Style Gallery | Fashion & Lifestyle | live | Own tool design in the shared dark world shell. **Owner judged the look unsatisfactory: full redesign planned (M2).** | A century of silhouettes, 1900 to 1999 | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Redesign to chosen direction; product imagery; real-device test; native review |
| 011 | Supercar Universe | Automotive & Transportation | live | Own interactive design in the shared world shell | A performance lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 012 | Electric Vehicle World | Automotive & Transportation | live | Own interactive design in the shared world shell | An electric road-trip planner | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 013 | Motorcycle Gallery | Automotive & Transportation | live | Own interactive design in the shared world shell | A lean-angle lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 014 | Automotive History | Automotive & Transportation | live | Own interactive design in the shared world shell | The history of the car as a printed archive | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 015 | Concept Car Lab | Automotive & Transportation | live | Own interactive design in the shared world shell | A concept-car wind tunnel | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 016 | Aircraft Explorer | Automotive & Transportation | live | Own interactive design in the shared world shell | An aircraft explorer | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 017 | Spacecraft Gallery | Automotive & Transportation | live | Own interactive design in the shared world shell | An orbit sandbox | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 018 | Transportation Innovation | Automotive & Transportation | live | Own interactive design in the shared world shell | Commute compare | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 019 | Architecture Universe | Architecture & Design | live | Own interactive design in the shared world shell | Architecture in three chapters | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 020 | Interior Design World | Architecture & Design | live | Own interactive design in the shared world shell | A room planner | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), functional check (day 5–6), langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 021 | Futuristic Cities | Architecture & Design | live | Own interactive design in the shared world shell | A 15-minute city planner | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 022 | Sustainable Architecture | Architecture & Design | live | Own interactive design in the shared world shell | An envelope and energy studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 023 | Furniture Design | Architecture & Design | live | Own interactive design in the shared world shell | A bookcase studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 024 | Industrial Design | Architecture & Design | live | Own interactive design in the shared world shell | A gear train studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 025 | Product Design Lab | Architecture & Design | live | Own interactive design in the shared world shell | A box dieline maker | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 026 | Architectural Photography | Architecture & Design | live | Own interactive design in the shared world shell | A keystone studio | EN + 9 languages (AI draft, not native-reviewed) | 1 Unsplash photo (licensed) + your own photo | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 027 | Nature Universe | Nature & Wildlife | live | Own interactive design in the shared world shell | Living type | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 028 | Ocean Explorer | Nature & Wildlife | live | Own interactive design in the shared world shell | A wave lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 029 | Forest World | Nature & Wildlife | live | Own interactive design in the shared world shell | Forest succession | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 030 | Wildlife Kingdom | Nature & Wildlife | live | Own interactive design in the shared world shell | Predator and prey | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 031 | Bird Universe | Nature & Wildlife | live | Own interactive design in the shared world shell | Murmuration and song | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 032 | Mountain Explorer | Nature & Wildlife | live | Own interactive design in the shared world shell | A mountain route planner | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), unit tests, langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 033 | Underwater World | Nature & Wildlife | live | Own interactive design in the shared world shell | The colour of depth | EN + 9 languages (AI draft, not native-reviewed) | 2 Unsplash photos (licensed) + your own photo | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 034 | Natural Wonders | Nature & Wildlife | live | Own interactive design in the shared world shell | Aurora watch | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 035 | Environmental Discovery | Nature & Wildlife | live | Own interactive design in the shared world shell | A carbon budget lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), unit tests, langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 036 | Space Explorer | Space & Science | live | Own interactive design in the shared world shell | The long way out | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 037 | Galaxy Gallery | Space & Science | live | Own interactive design in the shared world shell | Galaxy forge | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 038 | Planet Universe | Space & Science | live | Own interactive design in the shared world shell | Planet lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), unit tests, langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 039 | Astronomy Observatory | Space & Science | live | Own interactive design in the shared world shell | Tonight's sky | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), unit tests, langs: en | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 040 | Scientific Discoveries | Space & Science | live | Own interactive design in the shared world shell | Discovery lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 041 | Physics Playground | Space & Science | live | Own interactive design in the shared world shell | Physics playground | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 042 | Chemistry Visual Lab | Space & Science | live | Own interactive design in the shared world shell | Reaction workbench | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 043 | Human Biology Explorer | Space & Science | live | Own interactive design in the shared world shell | Heartbeat lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 044 | Future Science | Space & Science | live | Own interactive design in the shared world shell | Fusion lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 045 | Digital Art Museum | Art & Creativity | live | Own interactive design in the shared world shell | A museum where every painting is new | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en bn | Unit/interaction tests; Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 046 | Photography Universe | Art & Creativity | live | Own interactive design in the shared world shell | Camera school | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, langs: en bn | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 047 | Illustration Gallery | Art & Creativity | live | Own interactive design in the shared world shell | Ink & Light Studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 048 | Generative Art Lab | Art & Creativity | live | Own interactive design in the shared world shell | Systems that draw | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 049 | Typography Playground | Art & Creativity | live | Own interactive design in the shared world shell | Letter Foundry | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 050 | Color Universe | Art & Creativity | live | Own interactive design in the shared world shell | Colour Vision Lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 051 | Creative Canvas | Art & Creativity | live | Own interactive design in the shared world shell | Wet Paper Studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 052 | Visual Storytelling | Art & Creativity | live | Own interactive design in the shared world shell | Storyboard Studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 053 | Experimental Art | Art & Creativity | live | Own interactive design in the shared world shell | Vibration Machines | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 054 | Infinite Zoom Gallery | Art & Creativity | live | Own interactive design in the shared world shell | Infinite Zoom Gallery | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 055 | AI Universe | Technology & AI | live | Own interactive design in the shared world shell | AI Universe | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 056 | Robotics World | Technology & AI | live | Own interactive design in the shared world shell | Robotics World | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 057 | Future Technology | Technology & AI | live | Own interactive design in the shared world shell | Quantum Circuit Lab | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 058 | Web Innovation Lab | Technology & AI | live | Own interactive design in the shared world shell | Page-Load Simulator | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 059 | Creative Coding Lab | Technology & AI | live | Own interactive design in the shared world shell | Turtle Studio | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 060 | Machine Learning Explorer | Technology & AI | live | Own interactive design in the shared world shell | Machine Learning Explorer | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 061 | Interactive Data World | Technology & AI | live | Own interactive design in the shared world shell | Interactive Data World | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 062 | Blockchain Learning Space | Technology & AI | live | Own interactive design in the shared world shell | Blockchain Learning Space | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 063 | Digital Innovation Museum | Technology & AI | live | Own interactive design in the shared world shell | Digital Innovation Museum | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 064 | Future Interfaces | Technology & AI | live | Own interactive design in the shared world shell | Future Interfaces | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 065 | World Explorer | Travel & Culture | live | Own interactive design in the shared world shell | World Explorer | EN + 9 languages (AI draft, not native-reviewed) | Natural Earth map data (public domain) | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 066 | Global Architecture | Travel & Culture | live | Own interactive design in the shared world shell | Global Architecture | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 067 | Cultural Discovery | Travel & Culture | live | Own interactive design in the shared world shell | Cultural Discovery | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 068 | Travel Photography | Travel & Culture | live | Own interactive design in the shared world shell | Travel Photography | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 069 | Famous Landmarks | Travel & Culture | live | Own interactive design in the shared world shell | Famous Landmarks | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 070 | World Heritage | Travel & Culture | live | Own interactive design in the shared world shell | World Heritage | EN + 9 languages (AI draft, not native-reviewed) | Natural Earth map data (public domain) | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 071 | Global Food Universe | Travel & Culture | live | Own interactive design in the shared world shell | Global Food Universe | EN + 9 languages (AI draft, not native-reviewed) | Code-drawn (canvas/SVG), no photos | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), interaction script, unit tests, langs: en bn ar | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 072 | Historical Civilizations | Travel & Culture | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 073 | Interactive 3D Earth | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 074 | Digital Galaxy | Interactive Experiences | live | Own page (Three.js galaxy, 4 shapes) | Explore 4 galaxy shapes, fly-in, fallbacks | EN + 9 languages (AI draft, not native-reviewed) | Three.js point cloud, image fallback | Pass at 390 px (0 errors, no sideways scroll) | Render d+m (today), langs: en, galaxy visual checks | Real-device + Safari/Firefox test; native translation review; quality-tier hook |
| 075 | Virtual Showroom | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 076 | Interactive Story Universe | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 077 | Particle Playground | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 078 | Fluid Simulation Lab | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 079 | Sound Universe | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 080 | Interactive Physics | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 081 | Digital Twin Explorer | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 082 | Spatial Navigation | Interactive Experiences | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 083 | Wallpaper Universe | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 084 | Creative Inspiration | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 085 | Logo Playground | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 086 | Design Resource Explorer | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 087 | Moodboard Studio | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 088 | Digital Collection Builder | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 089 | Visual Search | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 090 | Random Discovery | Creative Tools & Discovery | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 091 | Future City Simulator | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 092 | Dream Generator | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 093 | Immersive Digital Museum | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 094 | Virtual Library | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 095 | Digital Fashion Show | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 096 | Interactive Music Visualizer | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 097 | Future Living Lab | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 098 | Seasonal Worlds | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 099 | Hidden Dimensions | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 100 | Experimental Universe | Experimental & Future Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 101 | Event Horizon | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 102 | Neon Nights | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 103 | Abyss | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 104 | Wildwood | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 105 | Chronos Atelier | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 106 | Fortress of Mist | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 107 | Falls | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 108 | Drift | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 109 | Sentient | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 110 | Mesa | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 111 | Ember | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |
| 112 | Omakase | Original Worlds | planned | Not started (page says "planned") | None | Name and category only (10 languages) | None | n/a | n/a | Everything: definition, design, tools, 10-language text, tests |


## C. Fashion and luxury worlds
Current state, from today's screenshots (`audit/before-fashion/sheet-d.png` and `sheet-m.png`):

| Area | World now | What works | Why it is unsatisfactory |
|---|---|---|---|
| Shoes / luxury shoes | none dedicated (only 003, sneakers) | n/a | There is no luxury shoe world at all |
| Sneakers | 003 Sneaker World | Configurator: colour and material per part, save, export | Flat vector shoe on a dark panel. Looks like a tool, not a product. No gallery, no product page, no lighting |
| Clothing | 002 Clothing Gallery, 010 Virtual Style Gallery | Capsule-wardrobe maths; silhouettes 1900–1999 | Clip-art garments. No editorial fashion imagery, no model or product photography |
| Streetwear | 007 Streetwear Culture | Screen-print graphic maker on a tee | Single flat tee mockup; no drop or collection feel |
| Luxury fashion | 001, 008, 009 | Weave simulator, palette lab, cloth physics | Strong science, but none of the quiet, spacious luxury presentation |
| Watches | 004 Luxury Watch Gallery | Real-time watch atelier: moon phase, GMT, chronograph, dive bezel | The best of the group, but still a lab panel; no collection, no product detail, no macro detail |
| Bags | 006 Bags & Accessories | Tote pattern maker with a cut list | A cardboard-looking tote; nothing luxurious |
| Jewelry | 005 Jewelry Universe | Gem light ray-tracer | Grey low-poly gem; nothing desirable |
| Accessories | 006 (bags only) | as above | No eyewear, belts or small leather goods |

Root causes:
1. All 10 worlds share the same dark "lab" shell: the same header, hero and side panel.
2. Graphics are flat illustrations, and there is no photography.
3. There is no collection page, product gallery or product detail page.
4. Typography and colour are the same as the science worlds.

What will be redesigned (M2):
- A real fashion presentation layer in the chosen direction: hero, collection grid, product gallery with zoom, a product detail page with specifications (unavailable fields marked unavailable), and mobile layouts.
- The existing working tools are **kept** inside the new design, not deleted.

**The three concepts (A Quiet Luxury, B Modern Fashion Editorial, C Futuristic Luxury Showroom): NOT STARTED.** There are no previews yet, not even design descriptions. They are the next task (Milestone 1).

## D. Global languages (EN, BN, ES, FR, DE, AR, ZH, JA, KO, HI)
| Item | Status | Evidence |
|---|---|---|
| Translation completeness | 2,089 / 2,089 keys present in all 10 files (counted today) | `_abidora/i18n/*.json` |
| Quality | **9 languages are AI drafts.** No native speaker has reviewed them | |
| Arabic RTL | TESTED | `dir=rtl` in the matrix; universe, world bar and chapters flip |
| Localised navigation | TESTED | URLs `/<lang>/…`; menu in every language |
| Search | PARTIAL | Atlas search works in every language. There is no site-wide search |
| Forms | TESTED (bn and en) | Contact form messages in 10 languages |
| Notifications | IMPLEMENTED | Auto-reply email in 10 languages. Unit-tested; real sending not tested |
| SEO metadata | TESTED | title, description, canonical, hreflang, JSON-LD; sitemap 790 URLs |
| Font support | Checked by eye | bn, ar, ja, hi screenshots. Fonts come from Google Fonts, not self-hosted |
| Mobile text layout | TESTED | 160/160 matrix, no sideways scroll at 390 px |

## E. Personalisation and discovery
| Feature | Status | Notes |
|---|---|---|
| Personal Universe Studio | TESTED | Save, share, import, reset |
| 100+ themes | TESTED | 104 (`src/data/themes.ts`) |
| 100+ cursors | TESTED | 104 in 13 families (`src/data/cursors.ts`) |
| User preferences | TESTED (device only) | Kept in the browser's localStorage. No account sync because accounts do not exist |
| Saved experiences | TESTED (device only) | Each world saves its own state on the device |
| Favourites | IMPLEMENTED (device only) | "Save world" button; no favourites page and no sync |
| Recommendations | PARTIAL | Guide me by mood plus "unvisited first". No personalised model |
| Search | PARTIAL | Atlas only |
| Random discovery | TESTED | Surprise me |
| Daily discovery | TESTED | World of the day |

## F. Voice Abid Assistant AI: technical report
**Connected AI model or provider: none.**
- A source search finds no AI API code: no `openai`, `anthropic`, `gemini` or `api_key`.
- There is no chat page.
- `api/` contains only `contact.php`.

| Capability | Status | Needs an external service or key? |
|---|---|---|
| Text chat | NOT STARTED | Yes: an LLM API (for example Claude or OpenAI) |
| Voice input / speech recognition | NOT STARTED | The browser Web Speech API is free but only in some browsers; a reliable one needs a speech-to-text API (for example Whisper or Deepgram) |
| Voice output | NOT STARTED | The browser's built-in voices are free; natural voices need a TTS API (for example ElevenLabs or OpenAI TTS) |
| Real-time voice conversation | NOT STARTED | A realtime voice API; this is the most expensive part |
| Conversation history | NOT STARTED | Our own MySQL (no key) |
| Contextual memory | NOT STARTED | MySQL plus the LLM |
| Web search | NOT STARTED | A search API (for example Brave, Bing or Tavily) |
| Source citations | NOT STARTED | Comes from the search API results |
| File uploads | NOT STARTED | Our PHP plus a secure upload area |
| PDF / document analysis | NOT STARTED | LLM with document input |
| Image understanding | NOT STARTED | Vision-capable LLM |
| Coding, writing, translation, research | NOT STARTED | LLM |
| Multilingual | NOT STARTED | LLM (all 10 languages) |
| Model selection | NOT STARTED | One or more provider keys |
| Backend integration | NOT STARTED | PHP proxy `api/ai.php`, server-side keys |
| API key security | DESIGNED, NOT BUILT | Keys go in `storage/config.php`, used only from PHP, never sent to the browser |
| Error handling | NOT STARTED | |

What exists today:
- On Publish, the site writes per-language knowledge files (`storage/knowledge/xx.json`) for the AI to read later. **This is preparation, not AI.**
- The full spec is in `docs/AI_ASSISTANT_PLAN.md`.

## G. Accounts, community and admin
| Item | Status | Notes |
|---|---|---|
| Registration, login, authentication (visitors) | NOT STARTED | No public auth API |
| User profiles, settings | NOT STARTED | Settings live on the device only |
| Favourites (synced) | NOT STARTED | Device-only favourites exist |
| Community | NOT STARTED | |
| Moderation, reporting | NOT STARTED | |
| Admin dashboard | TESTED (test server) | Overview, messages, translations, founder, worlds, users, audit, backup, settings (SMTP), publish |
| Content management | PARTIAL | Translations and founder editable. World content cannot be edited in admin |
| Translation management | TESTED | Edit with sanitising and a backup before each save |
| Roles and permissions | TESTED | owner / editor / translator |
| Database integration | TESTED | 5 tables: `ab_users`, `ab_messages`, `ab_audit`, `ab_throttle`, `ab_settings`. No tables yet for visitors, community or AI |

## H. Security, performance and SEO
| Item | Status | Evidence |
|---|---|---|
| API security | TESTED for contact | POST only, validation, honeypot, rate limit, prepared SQL |
| User data protection | TESTED | No analytics or cookies on public pages; IPs stored as keyed hashes |
| Input validation | TESTED | Contact and admin forms; translation HTML sanitiser |
| Authentication security (admin) | TESTED | bcrypt, CSRF, SameSite=Strict, session regeneration, lockout after 8 tries |
| Upload security | n/a | No uploads exist yet; required before AI files |
| Rate limiting | TESTED | Contact: 4/hour per IP, plus 1/day per address and 30/hour for auto-replies. Admin login: 8 per 15 minutes |
| Backup and recovery | TESTED | Admin backup zip; 52 project backups (Part 8) |
| Performance | PARTIAL | See Part 4 |
| Core Web Vitals | PARTIAL | CLS is fine (0.02). Phone blocking time on the homepage is too high |
| Accessibility | PARTIAL | Lighthouse accessibility 100 on tested pages. No screen-reader test by a person |
| SEO | TESTED | Lighthouse SEO 100 |
| Sitemap | TESTED | 790 URLs |
| Structured data | IMPLEMENTED | JSON-LD (`render.php`, founder). Not validated in Google's tool (no internet access to it) |
| Broken links | TESTED | 852 URLs crawled, 0 broken |
| Console errors | TESTED | 0 across 144 world runs today and the 160-page matrix |
| Mobile compatibility | TESTED (emulated) | 390 px; no real devices |
| cPanel compatibility | TESTED (simulated) | Apache + PHP 8.3 + MariaDB, root and subfolder. A real cPanel host is not tested |

---

# PART 3: Technical architecture

```
abidora/ (source)
├─ src/
│  ├─ pages/tpl/      10 Astro templates: home, worlds (atlas), world (shell), galaxy, founder, studio, themes, cursors, credits, notfound
│  ├─ worlds/         w001–w071.ts (one per world) + kit.ts, geo.ts, land110.ts
│  ├─ scripts/        21 page scripts (universe, discover, world-page, studio-core, i18n, …)
│  ├─ data/           themes.ts (104), cursors.ts (104)
│  ├─ styles/ layouts/ components/ lib/
├─ public/
│  ├─ _abidora/       PRIVATE (403): lib/boot.php, render.php, mail.php, ui.php; i18n/*.json; data/*.json; storage/
│  ├─ admin/index.php  api/contact.php  install/index.php
│  └─ assets/         images (owner photo, licensed Unsplash photos), fonts list, sky data
├─ tools/             publish.php, package.php, verify.mjs, sync-worlds
└─ dist/              build output → zip
```

- **Frontend:** Astro static templates plus TypeScript.
  - Each world is lazy-loaded from its own file.
  - Three.js for the universe and galaxy; GSAP and Lenis for motion.
  - Visitor state lives in localStorage.
- **Backend:** plain PHP 8.1+ with no framework.
  - `boot.php` handles config, PDO, schema and migrations, sessions, CSRF, throttle, audit and headers.
  - `render.php` renders 10 languages and writes the sitemap, robots and knowledge files.
- **Database:** 5 InnoDB tables (utf8mb4), with SQLite as a fallback.
- **API endpoints:** `/api/contact.php` (POST JSON), `/admin/` (session), `/install/` (locks itself after use).
- **AI architecture:** designed, not built. Browser → `api/ai.php` (PHP, holds keys) → provider APIs; MySQL for history and memory; a secure upload area outside the web root.
- **Authentication:** admin only (sessions plus roles). Visitor accounts are not built.
- **Assets:** register in `data/assets.json` with source and licence for each file; the Credits page is generated from it.
- **Translations:** one JSON per language (2,089 keys). PHP replaces tokens at publish time. JS strings use the `js.` prefix and are sent per page.
- **Deployment:** one zip, then upload and extract, then the `/install/` web installer. No Node or SSH needed on the host.

**Well implemented:**
- No secrets in the front end.
- Works from any subfolder.
- Real computation in worlds, and nothing faked.
- Strong test tooling (build verify, matrix, all-worlds, crawler).

**Needs improvement:**
- Self-host fonts.
- Add a CSP for static pages.
- Make the phone homepage lighter.
- The fashion presentation layer.
- No git history (see Part 8).
- Admin cannot edit world content.

---

# PART 4: Actual test results

| Test | Count | Passed | Failed | When |
|---|---|---|---|---|
| Live worlds opened, desktop 1280 + phone 390 | 72 worlds, 144 runs | 144 | 0 | today (`audit-worlds-2026-11-20.json`) |
| Page matrix: 10 languages × 8 pages × 2 sizes | 160 | 160 | 0 | today (Wave A) |
| Build verification | 100 pages | 100 | 0 | every build |
| Staging crawl (routes + assets) | 852 URLs | 852 | 0 | today |
| World unit tests | 314 counted in TEST_REPORT for 53–70, plus 32, 35, 38, 39, 47–52, 71 | all | 0 | night mission and Wave A |
| Contact mail unit tests | 28 | 28 | 0 | today |
| Admin on staging | login, all 9 tabs, lockout after 8 tries | all pass | 0 | today |
| Contact on staging (bn, phone) | 1 flow | pass | 0 | today; email not sent (no local mail server) |
| No-WebGL and reduced-motion fallback | 2 | 2 | 0 | today |
| Safari, Firefox, real phones, screen readers | 0 | — | — | **not tested** |
| AI integration | 0 | — | — | **nothing to test: not built** |

Languages tested automatically:
- All 10 in the page matrix.
- World pages: en for all 72; bn for 40–71; ar for 41 and 47–71.

Lighthouse (phone, headless, no GPU):

| Page | Score |
|---|---|
| Home en | 50 (earlier runs 42–66) |
| Home bn | 44 |
| World 65 | 92 |
| Atlas | 100 |

Accessibility, best practices and SEO were 100 on the pages measured.

Known bugs and limitations:
1. Phone homepage performance is below target (blocking time about 2.6 s on this server).
2. The world 19 "false alarm" in the old test script is a selector issue in the script; today's new test passes world 19.
3. Discovery is not on the atlas.
4. Quality tiers are not used by the worlds.
5. Google Fonts are external.

Screenshots:
- `audit/before-fashion/` (20 images + 2 sheets).
- `waveA/after/` (22).
- Many earlier per-world screenshots exist on the build server.

---

# PART 5: Complete remaining work

| # | Task | Priority | Depends on |
|---|---|---|---|
| 1 | Three interactive fashion concepts (A/B/C), 8 categories, desktop and mobile, with an evaluation | CRITICAL | nothing |
| 2 | Choose a direction (I recommend; you can override) | CRITICAL | 1 |
| 3 | Fashion image asset system: licensed or original or labelled concept imagery, with licence register | CRITICAL | 2. Real product photos need your decision on source |
| 4 | Redesign worlds 001–010 plus new luxury shoes and accessories coverage in the chosen direction (keep the tools) | CRITICAL | 2, 3 |
| 5 | Phone homepage speed to Lighthouse 80+ | HIGH | nothing (independent) |
| 6 | Self-hosted fonts and a CSP for static pages | HIGH | nothing |
| 7 | Per-world definitions for 72, 73, 75–112 grouped into experience families | HIGH | nothing |
| 8 | Build worlds 072, 073, 075–112 (40 worlds), each unique, with tests | HIGH | 7 |
| 9 | Quality tiers inside heavy worlds | MEDIUM | nothing |
| 10 | Site-wide search (worlds, tools, pages, 10 languages) | HIGH | 8 for full content, but can start now |
| 11 | Discovery on the atlas, second "Guide me" question, "your input" filter | MEDIUM | nothing |
| 12 | Visitor accounts: register, login, reset, verify email, profile, settings sync, favourites sync | HIGH | SMTP working (14) |
| 13 | Community: posts and sharing creations, reporting, moderation queue, admin tools | HIGH | 12 |
| 14 | Real email delivery: SMTP, SPF, DKIM | HIGH | your cPanel or mail access |
| 15 | Abidora AI backend: PHP proxy, key storage, rate and cost caps, history and memory tables | CRITICAL for AI | **your API key and provider choice** |
| 16 | AI chat UI, web search with citations, file and PDF and image analysis, voice in and out, real-time voice | CRITICAL for AI | 15 and paid keys (LLM, search, speech) |
| 17 | AI Creation Studio | HIGH | 15 and an image API key |
| 18 | Admin CMS for world content, AI settings and moderation | MEDIUM | 13, 15 |
| 19 | Native review of 9 languages | MEDIUM | native speakers (you, or people you choose) |
| 20 | New founder cutout from your real photo | MEDIUM | **your photo** |
| 21 | Safari, Firefox, real Android and iPhone tests; screen reader pass | HIGH | close to final; you or testers with devices |
| 22 | Staging on your real cPanel host | HIGH | your go-ahead (guide is ready) |
| 23 | Security review before AI and accounts go live | CRITICAL | 12, 13, 15 |
| 24 | Final build, live upload with your approval, monitoring | CRITICAL (last) | everything above |

**Can run in parallel now:** 1, 5, 6, 7, 9, 11, 14 (once access exists) and 22.

**Must wait:**
- 4 waits for 2.
- 8 waits for 7.
- 13 waits for 12.
- 16 and 17 wait for 15.
- 24 waits for everything.

No approved requirement has been removed. The 112-world scope stays.

---

# PART 6: Next development roadmap

### M1: three interactive fashion concepts
1. **Objective:** three working, clickable previews you can compare.
2. **Features:** for each concept, a hero, collection layout, product gallery, product detail page (unavailable fields labelled), and type/colour/motion examples, across the 8 categories (sneakers, luxury shoes, men's, women's, streetwear, watches, bags, jewelry).
3. **Design:** three distinct type, colour and motion systems:
   - A: quiet and spacious.
   - B: bold editorial.
   - C: 3D showroom.
4. **Technical:**
   - Standalone Astro or HTML previews under `concepts/`.
   - Original procedural or 3D product renders, clearly labelled "concept".
   - No brand assets.
5. **Files:** new `src/concepts/` (does not touch working worlds).
6. **Depends on:** nothing.
7. **Testing:** desktop and phone screenshots, interaction scripts, Lighthouse, no console errors.
8. **Deliverables:** three preview links, an evaluation report (11 criteria) with a recommendation, a backup.
9. **Done when:** all three are clickable on desktop and phone, the evaluation is written, and you have seen them.

### M2: fashion and luxury redesign
1. **Objective:** apply the chosen direction to worlds 001–010, plus new luxury shoes and accessories coverage, keeping every working tool.
2. **Features:** collection, gallery with zoom, product detail, the existing configurators and labs inside the new layout.
3. **Design:** the full system from the chosen concept.
4. **Technical:**
   - A new fashion shell (`world-fashion.css`/`.ts`).
   - Image pipeline (AVIF/WebP, sizes).
   - Asset register entries for every image.
5. **Files:** `src/worlds/w001–w010.ts`, `world.astro`, the new shell, `assets.json`, 10 language files.
6. **Depends on:** M1 choice; image source decision.
7. **Testing:** before/after screenshots, all-worlds, interaction scripts, unit tests on the tools, matrix, Lighthouse.
8. **Deliverables:** preview, zip, backup, before/after board, updated FEATURE_STATUS.
9. **Done when:** every fashion world passes the tests and the product pages show no invented specs.

### M3: worlds 072, 073, 075–112
1. **Objective:** 40 new, unique worlds.
2. **Features:** each its own interaction and real tools.
3. **Design:** experience families (interactive, creative tools, experimental, original).
4. **Technical:** `w072.ts` … `w112.ts`; heavy worlds use the quality tiers.
5. **Files:** `src/worlds/`, `experiences.json`, the language files.
6. **Depends on:** the world definitions document.
7. **Testing:** the same set as worlds 40–71.
8. **Deliverables:** about 5–8 worlds per checkpoint, each with a preview, zip and backup.
9. **Done when:** 112 out of 112 are live and pass the tests.

### M4: search, discovery and personalisation
1. **Objective:** site-wide search and better discovery.
2. **Features:**
   - A search index built at publish time (10 languages).
   - A search page and an overlay.
   - Discovery on the atlas.
   - Second Guide-me question.
   - Favourites page.
3. **Technical:** `render.php` writes `search-xx.json`; `search.ts`.
4. **Testing:** relevance checks per language, keyboard and screen-reader basics.
5. **Done when:** every world and page can be found in all 10 languages.

### M5: accounts, community, admin, AI
1. **Objective:** real accounts, community with moderation, and Abidora AI.
2. **Technical:**
   - New tables for users, profiles, favourites, posts, reports, AI conversations and AI memory.
   - New APIs: `api/auth.php`, `api/me.php`, `api/community.php`, `api/ai.php`.
   - Keys only in `storage/config.php`.
   - Cost caps.
3. **Depends on:** SMTP, and **your API keys**.
4. **Testing:** auth security tests, rate limits, upload scanning, the AI capability matrix (each feature tested with a real key, results recorded).
5. **Done when:** every AI capability in Part 2F is either working and tested, or clearly marked unavailable on the site.

### M6: translations, mobile, accessibility, SEO
- Native review.
- Self-hosted fonts.
- Screen-reader pass.
- Structured-data validation.

### M7: security, compatibility, performance
- Security review.
- Safari, Firefox and real devices.
- Phone Lighthouse 80+.

### M8: final build and cPanel package
- Staging on your host.
- Your approval.
- Live upload.
- Monitoring.

---

# PART 7: Completion scorecard (how each % is calculated)

| Area | % | Calculation |
|---|---|---|
| Design | 63% | 10 of 16 required surfaces have an approved-quality design: home, atlas, world shell, galaxy, founder, studio, themes, cursors, credits, 404. Missing: fashion direction, search, account pages, community, AI chat, AI Creation Studio |
| Frontend | 62% | 10 of 16 front-end surfaces built (same list) |
| Backend | 27% | 3 of 11 required server parts built: installer, admin, contact. Missing: auth, profile/favourites, community, moderation, search index API, AI chat proxy, AI files/voice |
| 112 worlds | 64% | 72 of 112 live (the 40 planned count 0) |
| Fashion and luxury | 10% | 1 of 10 work units: the working tools exist. Missing: 3 concepts, choice, image system, 8 category redesigns |
| AI assistant | 0% | 0 of 17 capabilities in Part 2F built |
| Voice features | 0% | 0 of 4 (input, recognition, output, real-time) |
| Languages | 55% | 50% weight for key coverage (100%) plus 50% weight for native review (only English verified, 1 of 10 = 10%) |
| Accounts | 0% | 0 of 7 (register, login, reset, verify, profile, settings sync, favourites sync) |
| Community | 0% | 0 of 4 (posting, sharing, reporting, moderation) |
| Admin | 69% | 9 of 13 required modules: the 9 existing; missing world CMS, moderation, AI settings, visitor management |
| Security | 59% | 10 of 17 checklist items done (Part 2H plus `SECURITY.md` open items) |
| Performance | 50% | 2 of 4 key pages meet phone Lighthouse 80 (world 65 and atlas yes; home en and bn no) |
| Testing | 50% | 6 of 12 test layers done (build, worlds, unit, matrix, backend local, Lighthouse). Missing: Safari, Firefox, real devices, screen reader, live host, user testing |
| Deployment readiness | 44% | 4 of 9 steps (build, installer, staging package, secrets scan). Missing: staging on real host, email DNS, live HTTPS, your approval, monitoring |
| **Whole roadmap (25-day plan, by day weight)** | **about 40–45%** | unchanged from this morning's report |
| **COMPLETED (your sign-off)** | **0%** | |

---

# PART 8: Backup and version control

**Versions:**
- **Current working version:** 0.5.0, Preview v20 (private Artifact preview, Version 20).
- **Previous stable zips:**
  - `abid-site/abidora-v0.4.1.zip`
  - `abid-site/abidora-v0.4.0.zip`
  - `abid-site/abidora-v0.5.0.zip` (rebuilt this afternoon)

**Backups:**
- `abid-site/backups/`: 52 files, 746 MB.
- Latest: `abidora-day08waveA.zip` and `abidora-day08preWaveA.zip`.
- Source mirror: `abid-site/abidora/`.
- Full source zip: `staging-v20/abidora-v20-source.zip`.

**Git: there is none.**
- The project is not in a git repository, and no GitHub repository is connected to this work.
- So there is no commit history and no "uncommitted changes" count. Every change is protected instead by a backup file before editing, plus a dated zip at each milestone.
- If you want real version control, create an empty private GitHub repository and tell me its name; I will push the source there.

**Uncommitted changes:** none since the v20 backup. The staging work only added files to `staging-v20/`.

**Recovery procedure:**
1. Unzip the newest `backups/abidora-dayNN*.zip` (or the source zip).
2. Run `npm ci && npm run build`.
3. Upload the `dist` zip.

On a host: Admin → Backup before any update; rollback steps are in `staging-v20/STAGING_GUIDE_BN.md`.

The working copy on the build server is temporary, so every milestone is mirrored to project files. **There is never only one copy.**

---

# PART 9: My next 10 tasks, in order

| # | What I will do | How you verify it |
|---|---|---|
| 1 | Write a short "why the fashion worlds fall short" analysis using today's screenshots | Read `audit/before-fashion/` and the analysis |
| 2 | Build Concept A, Quiet Luxury: hero, collection, gallery, product detail; 8 categories; desktop and phone | Open the preview link; click a product; try it on your phone |
| 3 | Build Concept B, Modern Fashion Editorial (same scope) | Same |
| 4 | Build Concept C, Futuristic Luxury Showroom, with 3D (same scope) | Same; rotate the product |
| 5 | Evaluation report: 11 criteria, scores with reasons, recommendation | Read the report; you can override the choice |
| 6 | Backup, zip and screenshots for M1 | Files in `abid-site/concepts-m1/` |
| 7 | Start M2 with the recommended direction: the new fashion shell plus the redesigned Sneaker (003) and Watch (004) worlds, keeping their tools | Before/after board; the old tools still work |
| 8 | Redesign the rest of the fashion family (001, 002, 005–010), plus new luxury shoes and accessories coverage | Preview, before/after board |
| 9 | Fashion tests: all-worlds, interaction scripts, matrix, Lighthouse | Test report with numbers |
| 10 | In parallel when possible: phone homepage speed work toward 80 | Lighthouse numbers before and after |

**Blockers that genuinely need you:**
1. **AI keys and provider choice**, and your monthly budget cap. Without them, Abidora AI cannot be built for real. I will not fake it.
2. **Your real photo** for the founder cutout.
3. **Product imagery source.**
   - I cannot use Nike, Rolex or other brand photos.
   - The concepts will use original, labelled concept renders.
   - If you want real photographs later, the options are your own product photos or paid licensed stock. Tell me if you have a preference or a budget.
4. **cPanel access** (later) to put the staging copy on your host and set up SMTP, SPF and DKIM. The guide is ready, so you can also do it yourself.
5. **Native speakers** (optional, later) for the 9 AI-drafted languages.

Everything else I decide professionally and keep moving.
