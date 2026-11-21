# Implementation report: Wave A (research → real features)

Version 0.5.0 · 20 Nov 2026 · Built and tested on the build server only. **Not deployed.** Nothing here is COMPLETED until the owner signs off.

Research basis: REFERENCE_ANALYSIS.md (15 sites). The build server could not open those sites in a browser (blocked by its network policy), so no reference was visually inspected; principles came from each site's fetched text and published case studies. Nothing was copied.

## 1. What was built

| ID | Feature | Where | What it really does | Status |
|---|---|---|---|---|
| I-1 | 3D Universe | Homepage, after the hero | Three.js scene: the gold Abidora ring in the centre, 12 category "systems" (each with its own emblem shape and colour), and every one of the 112 worlds as a star (one draw call). Bright star = open, faint = planned, white core = you visited it (kept on this device only). Drag to turn, tap a system to fly in, tap a star for its card and "Enter". Category labels are real buttons; "Show as a list" gives the same content as plain links; Esc goes back. No WebGL → the list appears automatically. Reduced motion / Studio Calm → still picture, no spin. | TESTED |
| I-2 | Cinematic page change | Every page | Cross-document View Transitions: the next page opens as a growing circle from the exact point you clicked (keyboard: from the link's centre); the old page dims and sinks slightly. Browsers without support just navigate normally. Reduced motion and Calm skip it. | TESTED (Chromium) |
| I-3 | World portals | Any link into a world | During the page change a short portal appears in the world's category style: 12 different designs (silk folds, rev-counter ticks, blueprint grid, leaves, star ring, paint wheel, data rings, compass rose, double pulse, dashed tool ring, split signal, the ora ring with its moon). Pure CSS, no extra download. | TESTED (Chromium) |
| I-4 | 3D emblems | Part of I-1 | 12 procedural emblems with a soft rim light, one per category. | TESTED |
| I-5 | World bar | All 72 open worlds | Save, Full screen, How to (shows the world's instructions; folded on phones), Share (phone share sheet, or copies the link), Reset (only appears when the world has saved something; asks first, then clears only that world's data), and Universe (back to the map). On phones it is a bottom bar in thumb reach with 48 px targets. | TESTED |
| I-6 | Editorial scrolling | Homepage, Founder | The manifesto now stays pinned on wide screens while its words light up. Section headings stretch very slightly (max 3 %) with scroll speed and settle when you stop (only with smooth scrolling on). Founder page: a chapter bar for the five approved sections shows where you are and jumps to any chapter. The approved section order and wording were not changed. | TESTED |
| I-7 | Discovery strip | Homepage, after the universe | World of the day (same for everyone on the same date), Guide me (5 moods → 3 worlds, unvisited first, "Three more"), Surprise me (an unopened world; never repeats in a visit until all have been shown), and a "x of 72 visited" progress line. Hidden entirely if it cannot work. | TESTED |
| I-8 | Quality tiers | Universe | low / mid / full from device memory, cores, Save-Data and a 1-second frame probe; Studio override key `ab.tier`. 30 fps cap on mid. Three.js now loads only when you scroll to the universe. | IMPLEMENTED (only the universe uses it so far) |

Also done in this wave (owner requests): founder section photo upright and fully visible on one screen, founder ring lowered; contact form sends the owner a copy and the visitor a designed "message from the universe" reply in their language, with anti-spam limits (EMAIL_SETUP_BN.md); world 071 Global Food Universe.

## 2. Tests actually run
- Build: 0 errors, 100 pages verified, after every change.
- Universe: desktop 1440 and phone 390, English, Bengali, Arabic: labels, panel, star pick, drag, Esc, list toggle; no JavaScript errors (only the software-GPU "ReadPixels" warning of the test browser). No-WebGL: list shown with all 72 links. Reduced motion: no movement, panel still works.
- Page change: frames captured at 8 % speed into worlds 36, 27 and 65; Calm mode verified to skip (transition "ready" rejects).
- Discovery: 3 sizes, English and Bengali; 12 surprises in a row were all different.
- World bar: desktop, 360 px phone, Arabic; Reset cleared only that world's keys; all 72 worlds still render (all-worlds check: only the known false alarm on world 19).
- Founder chapters: desktop, phone, Arabic (order and progress run right-to-left).
- Full page matrix (10 languages × 8 pages × 2 sizes): 160 / 160 passed.

## 3. Measured performance (headless Chromium on the build server)
- Homepage phone blocking time with 4× CPU slowdown: about 590 ms → about 316 ms after deferring Three.js until the visitor scrolls to the universe.
- Lighthouse on this server swings widely between runs for the homepage on phone (42–66 today; 55–59 before Wave A), because the test machine has no GPU. The target of 80 is **not met**; see PERFORMANCE_REPORT.md.
- A layout jump caused by the new world bar on phones was found and fixed (CLS 0.085 → 0.021).

## 4. Not done / honest limitations
- Discovery strip is on the homepage only, not yet on the atlas. "Guide me" asks 1 question, not the 2 in the plan, and the "Your input" filter is not built.
- View Transitions only animate in Chromium-based browsers and recent Safari; Firefox navigates normally.
- Portals are CSS, not the per-category GLSL shader in the plan (chosen for weak phones; reconsider on day 23).
- Quality tiers are not yet used by the individual worlds.
- Velocity headings only run when Lenis smooth scrolling is on (full motion).
- The founder photo's hair comes from the illustrated original; the owner will send a real photo for a new cutout.
- Non-English text for the new features is an AI draft (needs native review).

## 5. Files
New: src/scripts/universe.ts, universe-scene.ts, tier.ts, discover.ts, chapters.ts, vt-head.js (+ .min.js). Changed: home.astro, world.astro, founder.astro, Base.astro, home.ts, world-page.ts, galaxy-page.ts, abidora.css, world.css, founder.css, render.php (UNIVERSE_LIST, home strings), 10 language files (new keys for these features). Backups of every changed file were kept before editing, plus full zips in abid-site/backups/.
Screenshots: abid-site/waveA/before/ and abid-site/waveA/after/.
