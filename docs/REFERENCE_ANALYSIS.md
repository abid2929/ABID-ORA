# Reference analysis: 15 benchmark websites

Version 1.0 · 20 Nov 2026 · Research only. Status: **IMPLEMENTED (research)**, principles **PLANNED** for the build.
Companion docs: REFERENCE_BOARD.md (earlier case-study notes), DESIGN_REFERENCE_NOTES.md (GetLayers recordings), INNOVATION_BACKLOG.md, EXPERIENCE_ROADMAP.md.

## 1. How this was studied (read this first)

| Method | Result |
|---|---|
| Direct download from the build server (curl, headless Chromium) | **Blocked** for all 15 hosts by the server's network policy (HTTP 403 at the proxy). So no screenshots, no Lighthouse runs, no computed styles, no live animation review. |
| Text fetch of each homepage (a fetch tool that returns the page as extracted text plus meta tags) | **All 15 answered HTTP 200.** 3 returned almost nothing because the site is rendered by JavaScript: Active Theory ("Please enable javascript"), Igloo Inc (meta tags only), Awwwards (short plain-text rendering). FWA came back thin (headings, no feed). |
| Published facts | Case studies and award pages already recorded in REFERENCE_BOARD.md, plus well-known public facts (open-source code, published talks). |

Every finding below is labelled:
- **Observed**: seen in the fetched page text or meta tags today (20 Nov 2026).
- **Public**: from the site's own published case study, credits, or source code.
- **Inferred**: our reasoning; not verified visually.

What we could **not** do for any site: watch the animations, measure load time, test on a real phone, or audit contrast. Those columns are marked "not measured" rather than guessed. Nothing was copied: no code, images, text or layouts were taken.

## 2. Summary table

| # | Site | Fetch | Core lesson for Abidora |
|---|---|---|---|
| 1 | Bruno Simon | Rich | Explanation is part of the world: controls, quality, "I'm stuck", reset and "behind the scene" sit next to the 3D. |
| 2 | Active Theory | JS shell | Immersion with zero fallback is invisible to crawlers and no-JS users. Abidora must not do this. |
| 3 | Lusion | Good | Quiet interface, loud motion; a public Labs space for experiments. |
| 4 | Igloo Inc | Meta only | A short site where every transition is designed; shader compile spread over loading. |
| 5 | Lando Norris | Rich | A personal brand told through chapters (On Track / Off Track), one signature accent colour, collectible "hall of fame". |
| 6 | Apple | Rich | One idea per screen, descriptive alt text, zoom allowed. |
| 7 | Stripe | Rich | Precision, proof in numbers, a "Guide me" route for people who don't know where to start. |
| 8 | Linear | Rich | UI shown as real HTML, not screenshots; skip link; one dark theme colour. |
| 9 | Figma | Rich | Mega-menu by role ("who are you?"), skip link, templates as an entry point. |
| 10 | Google Arts & Culture | Rich | Many doors into the same content: explore, play, nearby, colour, achievements, artwork of the day. |
| 11 | NASA | Rich | Deep taxonomy, "Image of the Day", suggested searches, education resources. |
| 12 | The Pudding | Rich | Numbered visual essays, filter chips including "Your Input", skip link. |
| 13 | Awwwards | Thin | Judging criteria (design, usability, creativity, content) as our quality bar. |
| 14 | FWA | Thin | Written critique per entry, independent human jury; yellow single accent. |
| 15 | Immersive Garden | Good | Luxury pacing, case studies tagged by type, sound toggle; but disables zoom. |

## 3. Site-by-site findings

Each site uses the same headings: first impression · layout and hierarchy · type and colour · navigation · motion, 3D and scroll · mobile · performance · accessibility · unique features and tech.

### 1. Bruno Simon (bruno-simon.com)
- **First impression (observed):** "Welcome!" plus one line of who he is, then you drive a vehicle around a 3D world to explore. Playful and self-explanatory.
- **Layout:** the whole page is a 3D world; the DOM holds the overlays (options, controls, achievements, leaderboard). (inferred from the structure)
- **Type and colour (observed):** credits name Amatic SC and Nunito (Google Fonts). Colours not measured.
- **Navigation (observed):** Options (Audio, Quality, "I'm stuck!", Reset, renderer WebGPU, Server), Controls (mouse/keyboard, mobile/tablet, gamepad), Achievements, Circuit leaderboard, "Leave a whisper", Behind the scene.
- **Motion and 3D (observed/public):** Three.js with TSL shaders, Rapier physics, Howler.js audio; WebGPU renderer. Earlier version is public and known for baked lighting so it runs on phones (REFERENCE_BOARD #12).
- **Mobile (observed):** a separate mobile/tablet control scheme is documented.
- **Performance (observed):** a user-facing Quality option. Load time not measured.
- **Accessibility (observed/inferred):** the controls table and copy are real text, readable without the scene. Some icon images had empty alt text in the extraction.
- **Unique:** achievements, a race leaderboard, visitor "whispers" left in the world, source code public under MIT.

### 2. Active Theory (activetheory.net)
- **Fetch:** JavaScript-only shell. The body text is only "Please enable javascript".
- **Observed:** title "Active Theory · Creative Digital Experiences"; description "Founded in 2012. We blend story, art & technology"; black theme colour; viewport sets `user-scalable=no`.
- **Public (REFERENCE_BOARD #9–11):** one persistent object carries the visitor through many worlds; device-tier quality presets; the cursor used as a light; personalised museum exhibits (Xbox).
- **Accessibility:** pinch-zoom disabled (fails WCAG 1.4.4) and no meaningful no-JS content. Layout, type, motion, mobile and performance: not measured.
- **Lesson:** the immersive idea is strong, but Abidora keeps static HTML content for every page (it already does), so search engines, screen readers and slow phones still get the content.

### 3. Lusion (lusion.co)
- **First impression (observed):** H1 "We create 3D visual storytelling and interactive web experiences…" with a "scroll to explore" prompt.
- **Layout (observed):** Featured Work grid of 12 projects tagged (web, 3d, animation), Our Approach, Play Reel, manifesto block, a big closing CTA, footer with studio address.
- **Navigation (observed):** Home, About us, Projects, Contact, Labs (separate labs site), "Let's talk".
- **Motion and 3D (public):** jury notes say a clean interface carries over-the-top animation; the 2019 site precomputed cloth simulation into textures (~220 KB) and baked lighting. Reel has PLAY / MUTE controls (observed).
- **Accessibility (observed):** zoom disabled; several icon-only links with no text label.
- **Unique:** Labs as a public playground separate from client work.

### 4. Igloo Inc (igloo.inc)
- **Fetch:** meta tags only (client-rendered). Description states a crypto community mission.
- **Public (REFERENCE_BOARD #1, Awwwards case study):** three-section landing; real-time shader intro; transitions mixing chromatic aberration, displacement and frost; procedural ice; particles from volume data; WebGL text with scramble; Three.js + Svelte + GSAP; shader compilation spread across loading so it stays smooth.
- **Not measured:** everything visual and mobile.
- **Lesson:** a small number of moments, each crafted, beats many average ones. Preparing heavy GPU work during the loader is a technique Abidora can reuse for world 074 and other 3D worlds.

### 5. Lando Norris (landonorris.com)
- **First impression (observed):** H1 "Lando Norris", H2 driver role, next-race link.
- **Layout (observed):** Message from Lando, captioned photo gallery, "Helmets Hall of Fame" (2019–2025, hover swaps), store, partners grid, socials, footer.
- **Type and colour (observed):** alt text mentions his signature in lime: one signature accent.
- **Navigation (observed):** Home, On Track, Off Track, Calendar, Partnerships, Store.
- **Motion and mobile (observed):** phone text "Please rotate your device, This is a vertical drive", "tap to lock", "Back to scroll": a scroll-driven drive sequence with a phone-specific mode.
- **Performance (inferred):** dozens of WebP images and hover pairs; likely heavy. Built on Webflow with Rive animations (inferred from asset hosts).
- **Accessibility (observed):** zoom allowed (max-scale 5); many good alt texts but also empty ones; a "Sign Up" link pointing to "#"; two different store domains.
- **Lesson:** a personal brand split into two clear chapters (work / life) and a collectible archive (helmets) gives a founder page a story, not a CV.

### 6. Apple (apple.com)
- **First impression (observed):** one product hero, one sentence, two actions. Then one product per band.
- **Layout (observed):** long stack of full-width bands (iPhone, Mac, Watch, gifts, iPad, TV, Card), an "Endless entertainment" gallery, a large organised footer.
- **Navigation (observed):** flat product nav of 11 items plus search and bag.
- **Accessibility (observed):** descriptive alt text on hero images; zoom allowed.
- **Performance (inferred):** responsive duplicate image markup per breakpoint.
- **Lesson:** each section says one thing. Abidora's world cards and the home page should keep one sentence per idea.

### 7. Stripe (stripe.com)
- **First impression (observed):** H1 "Financial infrastructure to grow your revenue."
- **Layout (observed):** bento grid of product cards, a stats band (currencies, volume, uptime, subscriptions), customer stories, developer paths, newsroom.
- **Navigation (observed):** Products, Solutions, Developers, Resources, Pricing, **"Guide me"**, Sign in.
- **Tech (observed):** Next.js assets; several edge experiment tags, so the homepage is A/B tested.
- **Accessibility:** images had empty alt in the extraction (may be an extraction artifact).
- **Lesson:** proof through real numbers, and a guided path for undecided visitors. Abidora's equivalent: real counts (worlds live, languages) and a "Guide me" that asks two questions and opens a world. Never invent numbers.

### 8. Linear (linear.app)
- **First impression (observed):** H1 "The product development system for teams and agents."
- **Layout (observed):** chapters that follow the user's workflow (Intake, Plan, AI, Build/Review) then Changelog.
- **Type and colour (observed):** theme colour #08090a (near-black); other values not measured.
- **Navigation (observed):** Product, Resources, Customers, Pricing, Now, Contact, Docs, Open app.
- **Accessibility (observed):** "Skip to content" link present.
- **Unique (observed):** product interface rendered as real HTML text, not screenshots, so it is sharp, translatable and readable by assistive tech. Public changelog.
- **Lesson:** sections ordered by the user's journey; a public changelog. Both fit Abidora (CHANGELOG.md already exists and could be shown as a "What's new" page).

### 9. Figma (figma.com)
- **First impression (observed):** H1 "The full-stack creative canvas."
- **Navigation (observed):** mega-menu by Products, Solutions, **Roles**, Organizations, Community, Resources; skip link to main.
- **Layout (observed):** AI agent, workspace, precision tools, Make, a quote, logo wall with a dated source note ("data from March 2025"), template carousel.
- **Lesson:** claims carry their source and date; templates/community as a starting point. For Abidora: "start from a preset" buttons inside creative worlds, and dated, sourced facts in educational worlds.

### 10. Google Arts & Culture (artsandculture.google.com)
- **First impression (observed):** many entry points at once; "Celebrating 15!".
- **Navigation (observed):** Home, Explore, Play, Nearby, Profile, The Lab, Achievements; browse by Artists, Mediums, Art movements, Historical events, Figures, Places.
- **Layout (observed):** online exhibits, artwork of the day, Street View, **browse by colour**, games and experiments, newsletter.
- **Accessibility (observed):** zoom disabled; "Loading…" placeholder in static HTML.
- **Lesson:** the same content reachable through many doors (time, place, colour, play, nearby, daily pick). This is the clearest model for Abidora's day-15 search and discovery.

### 11. NASA (nasa.gov)
- **First impression (observed):** news portal; Featured, Missions, Highlights, a live deadline countdown, Image of the Day.
- **Navigation (observed):** Explore (search), News & Events, Multimedia, NASA+; mega-menu with Missions, Humans in Space, Earth, Solar System, Universe, Science, Aeronautics, Technology, **Learning Resources**, Spanish site. **Suggested searches** block.
- **Tech (observed):** WordPress; images with face-aware crop parameters.
- **Accessibility (observed):** several empty alt texts in extraction; no skip link seen.
- **Lesson:** education needs structure: topic tree, learning resources, suggested searches, a daily item. Abidora's science worlds (36–44, 55–64) can share one "Learn more" structure.

### 12. The Pudding (pudding.cool)
- **First impression (observed):** "The Pudding explains ideas with visual essays."
- **Layout (observed):** numbered feed (#229 down) with date, bold keyword and a one-line teaser; "Load more".
- **Navigation (observed):** filter chips All, Our Faves, Popular, Updating, **Your Input**, Video, Audio. Sticker-style icons with alt text.
- **Accessibility (observed):** skip link present.
- **Lesson:** the reader's own data inside the story ("Your Input") is what makes it memorable. Many Abidora worlds already do this (own measurement in world 40, own CSV in 61, own photo in 68); make it a labelled feature.

### 13. Awwwards (awwwards.com)
- **Fetch:** short plain-text rendering only (Latest, Nominees, Collections, Directory, Market).
- **Public:** sites are scored on Design, Usability, Creativity and Content, with a separate developer award.
- **Lesson:** use those four as Abidora's per-world self-review score (see section 5), plus our own performance and accessibility checks.

### 14. FWA (thefwa.com)
- **Fetch:** thin; feeds load by JavaScript.
- **Observed:** "Digital design awards since 2000"; every entry gets a written critique; awards decided by an independent human jury; yellow theme colour #FFCC00; nav includes Live judging and Editorials.
- **Lesson:** a written critique is more useful than a score. Each Abidora world can get a short "Making of" note (already planned from REFERENCE_BOARD #4).

### 15. Immersive Garden (immersive-g.com)
- **First impression (observed):** stacked tagline "Innovative / digital / experiences / studio", "Scroll down" cue, H1 about unparalleled experiences.
- **Layout (observed):** Our approach, Our mission, ~17 case studies tagged Web Experience, E-Shop or Corporate; footer with address and newsletter.
- **Motion and sound (observed/public):** an Off/On control (likely sound); public case study: bas-relief 3D, 3D numerals menu, hidden Backstage with technical breakdowns, KTX texture compression, Three.js + Nuxt + GSAP + Lenis.
- **Accessibility (observed):** zoom disabled.
- **Lesson:** luxury pacing and a "Backstage" layer; compressed GPU textures.

## 3b. Technical analysis of the most useful experiences

For each experience: what makes it special, how it is (or can be) built, whether our approved stack (Astro + TypeScript, Three.js/WebGL/GLSL, GSAP, Lenis, PHP 8, MySQL) supports it, the cost, and the original Abidora version. "How built" is **public** when the studio published it and **inferred** otherwise. Costs: performance = extra JS/GPU on the page that uses it; time = build-thread days.

| # | Experience (site) | What makes it special | How it is built | Our stack? | Perf cost | Time | Original Abidora version |
|---|---|---|---|---|---|---|---|
| T1 | Explorable 3D world as the homepage (Bruno Simon) | You learn the site by moving, not reading; a world feels discovered | Public: Three.js + TSL shaders, Rapier physics, baked lighting, Howler audio, DOM overlay for UI | Yes: Three.js already ships in world 074 (≈140 KB gz). No physics engine needed for us | Medium: one WebGL scene; must be deferred after first paint, static poster on low-power | 2–3 days | **Universe home**: the 12 categories as orbiting "systems" around the ora ring; drag/scroll to orbit, tap a system to fly to it, tap a world to enter. Same data as the atlas list. |
| T2 | One persistent object across pages (Active Theory) | Continuity: the visitor never feels a page reload | Inferred: single-page WebGL app with a shared object between scenes | Partly: Astro is multi-page. Use the **View Transitions API** (supported by Astro) to morph a shared element between pages; CSS fallback elsewhere | Low: CSS/DOM only | 1 day | **Ring portal**: the ora ring expands from the clicked card into a circular mask that reveals the world; reverse on back. |
| T3 | Designed scene transitions + shader warm-up (Igloo Inc) | Every cut is a crafted moment; no stutter on first frame | Public: GLSL transitions (displacement, chromatic aberration, frost), shader compile spread over loading, Three.js + GSAP | Yes: GLSL + GSAP approved; `renderer.compile()` during loader | Low–medium (one fullscreen pass, ~1 ms/frame) | 1 day | **Per-category entry shader**: each of the 12 categories gets its own 600 ms reveal (ink bleed for Art, scan-line for Tech, ripple for Nature…), one shared GLSL file with a uniform switch. |
| T4 | Precomputed simulation (Lusion 2019) | Looks like heavy real-time physics but runs on phones | Public: Houdini cloth baked to PNG textures (~220 KB), vertex animation from textures, matcaps | Yes: Three.js ShaderMaterial reads a data texture; baking done once offline in a Node/Python script | Low at runtime | 1–2 days per effect | Use for flagship 3D worlds (77, 78, 101–112); also for the home universe's idle motion. |
| T5 | Scroll-driven drive sequence with phone mode (Lando Norris) | Scroll becomes a journey; phones get a vertical version, not a squashed desktop one | Inferred: Webflow + Rive/scroll-scrubbed animation; separate mobile copy ("vertical drive", "tap to lock") | Yes: GSAP ScrollTrigger + Lenis (already approved) | Low–medium | 1 day | **Founder journey**: the Founder page becomes a short vertical "flight" through 4 chapters (Explore / Build / Learn / Next) with the cutout portrait staying centred. |
| T6 | One idea per screen, pinned product moments (Apple) | Calm, premium pacing | Inferred: sticky sections, scroll-linked image sequences/video, responsive images | Yes: CSS `position: sticky` + GSAP | Low | 0.5 day | Home statement sections: pinned headline while the image under it changes with scroll. |
| T7 | Stats band + "Guide me" (Stripe) | Proof and guidance for undecided visitors | Observed: Next.js, A/B tests at the edge | Yes: build-time numbers from experiences.json; guide = small TS dialog | None | 0.5 day | **Honest numbers** + **Guide me** (2 questions → 1 world). |
| T8 | UI as real HTML text (Linear) | Crisp, translatable, accessible | Observed: product mockups are DOM text | Yes | None | ongoing rule | Every canvas world has a live text twin (status line, aria-live). |
| T9 | Many doors + browse by colour (Google Arts & Culture) | Discovery without knowing what to search | Inferred: tagged collection, colour index from images | Yes: tags in experiences.json; colour from each world's palette; client-side search index (≈20 KB JSON per language) | Low | 1–2 days (day 15) | **Discovery hub**: doors by mood/colour, time, action, place, "your input", world of the day. |
| T10 | Image of the Day + suggested searches (NASA) | A reason to come back daily | Observed: CMS feature + search suggestions | Yes: date-seeded pick, no server | None | 0.25 day | **World of the day** on home and search. |
| T11 | Reader's own input in the story (The Pudding) | The visitor becomes part of the result | Public: custom Svelte/D3 essays | Yes: many worlds already do it | None | 0.25 day (badge) | "Your input" badge + filter. |
| T12 | Backstage / behind the scene (Immersive Garden, Bruno) | Trust and craft; the "how" is content | Public: separate section with technical breakdowns | Yes: one drawer component + per-world text keys | None | 0.5 day + text per world | **Backstage drawer** in the world bar. |
| T13 | Quality / sound toggles (Bruno, Lusion, Immersive Garden) | User stays in control of battery and noise | Public/observed | Yes: Studio already stores prefs | None | 0.5 day | **World bar**: Quality, Sound, Reset, I'm stuck, Backstage, Share. |
| T14 | Velocity-aware typography (Resn for Getty, REFERENCE_BOARD #8) | Type feels physical | Inferred: scroll velocity → CSS transform/skew or shader | Yes: Lenis exposes velocity; CSS variable on headings | Very low | 0.25 day | Display headings stretch ≤3% with scroll speed; off under Calm. |

**Not suitable for us:** Bruno's physics car (Rapier adds ~400 KB and needs WASM; our worlds already use own lightweight physics), full single-page WebGL apps like Active Theory (breaks static HTML, SEO and 10-language pages), disabling zoom (seen on 4 sites; accessibility failure).

**Screenshots and recordings:** none could be taken; the build server cannot open these hosts. If the owner records the sites on his phone or PC (like the GetLayers videos), the build thread can review them frame by frame and add visual notes here.

## 4. Patterns across all 15

**What the best ones share**
1. One idea per screen, one accent colour (Lando lime, FWA yellow, Linear near-black, Abidora signal amber).
2. Real text beside the spectacle: Bruno's controls, Linear's HTML mockups, Pudding's numbered teasers.
3. A way to see how it was made: Behind the scene (Bruno), Labs (Lusion), Backstage (Immersive Garden), Changelog (Linear), critiques (FWA).
4. Many doors into content: Arts & Culture (colour, place, play, nearby, daily), NASA (topic tree, suggested searches), Pudding (filters incl. Your Input).
5. Quality controls exposed to the user: Bruno's Quality and Audio, Lusion's Mute, Immersive Garden's Off/On.
6. Reward and return: achievements (Bruno, Arts & Culture), hall of fame (Lando), artwork/image of the day.

**Repeated mistakes to avoid**
- Pinch-zoom disabled on 4 of 15 (Active Theory, Lusion, Arts & Culture, Immersive Garden).
- No useful content without JavaScript (Active Theory, Igloo, FWA feeds).
- Icon-only links with no label (Lusion), links to "#" (Lando, FWA), empty alt on meaningful images.
Abidora already passes these: zoom allowed, static HTML for every page, Lighthouse accessibility 100 on tested pages (PERFORMANCE_REPORT.md). Keep it that way.

## 5. Original principles for Abidora

Rules for all of these: keep Abidora's identity (ink / bone / signal, Instrument Serif + Inter Tight + JetBrains Mono, the ora ring); no new heavy libraries; everything decorative off under Studio "Calm" or reduced motion; phones first; nothing copied. Each item says where it fits in the existing roadmap and whether it reuses something already built, so nothing is duplicated.

### 5.1 Homepage and shell (day 23 polish; home already exists)
| # | Principle | Concrete Abidora implementation | Inspired by | Reuses |
|---|---|---|---|---|
| H1 | **The ora ring is the persistent object.** | The ring from the logo is the one element that travels: loader → hero → it becomes the "portal" when you open a world (a short ring-wipe transition), and the 404. One object, one meaning: "you are entering". | Active Theory (one persistent object), Igloo (designed transitions) | existing ring mark, loader |
| H2 | **Living sky, true data.** | The hero background shows the real Sun/Moon position for the visitor's time zone (backlog idea 6). Quiet, true, no fake data. | NASA (real science), Bruno (world as interface) | geo.ts from worlds 65/68 |
| H3 | **Honest numbers band.** | One mono row: worlds live, languages, experiments you can run, all read from experiences.json at build time. Never invented. | Stripe stats band, Figma dated sources | experiences.json |
| H4 | **"Guide me" in two questions.** | A small dialog: "What are you in the mood for? (make / learn / wander / play)" and "How much time? (1 min / 10 min / an evening)". It opens one world. No account, no tracking. | Stripe "Guide me", Figma roles | world categories |
| H5 | **One idea per screen on the home page.** | Keep each home section to one heading + one sentence + one action. Audit the current home against this. | Apple | existing home |
| H6 | **Phone home performance.** | Home phone Lighthouse is 59 (only weak score). Apply Igloo's lesson: spread WebGL shader compile across the loader, defer the hero 3D until after first paint, and serve a static poster on low-power devices. Target 85+. | Igloo, Bruno Quality | existing hero |

### 5.2 Worlds (days 5–14, worlds 71–112 and retro-fit)
| # | Principle | Concrete Abidora implementation | Inspired by | Reuses |
|---|---|---|---|---|
| W1 | **Every world has the same small "world bar".** | One consistent strip: Quality (auto/low/high), Sound (on/off), Reset, "I'm stuck" (shows the how-to text), Share. Same place on every world so learning one teaches all. | Bruno options, Lusion mute | kit.ts, wh.N how-to keys |
| W2 | **Backstage panel per world.** | A "Making of" drawer: what technique it uses, real sources, what is simulated vs real, limits. Written critique style, 80–150 words. | Immersive Garden Backstage, Bruno Behind the scene, FWA critiques | REFERENCE_BOARD #4 plan |
| W3 | **"Your input" badge.** | Worlds where the visitor's own data drives the result (own measurement, own photo, own CSV, own drawing) get a visible badge and a filter in search. | The Pudding "Your Input" | worlds 40, 61, 68 already qualify |
| W4 | **Chapters, not walls.** | Larger worlds split into 2–4 numbered chapters (01 Try · 02 Understand · 03 Make · 04 Go further), each ending with a small reward (a result, a stamp). | Linear workflow chapters, Lando chapters, Orano (REFERENCE_BOARD #6) | world page template |
| W5 | **Precompute the expensive, animate the cheap.** | For 3D/fluid/cloth worlds (73, 77, 78, 80, 101–112): bake light, store animation in textures, compress textures, ship a low tier for phones by design. | Lusion 2019, Bruno, Immersive Garden KTX | Three.js already in 074 |
| W6 | **Text twin of every canvas.** | Each world keeps a live status sentence describing what is on screen (backlog idea 8), so the world works with a screen reader. | Linear (UI as real text), Bruno controls text | existing status lines |
| W7 | **Self-review score before TESTED.** | Each world is scored 1–10 on Design, Usability, Creativity, Content plus our Performance and Accessibility, written into TEST_REPORT.md. A world under 7 in any column is not marked TESTED. | Awwwards criteria, FWA critique | TEST_REPORT.md |

### 5.3 Search and discovery (day 15)
| # | Principle | Concrete Abidora implementation | Inspired by | Reuses |
|---|---|---|---|---|
| S1 | **Many doors to one universe.** | Search page offers doors: by category, by **mood/colour** (each world already has a palette), by **time it takes**, by **what you do** (make / learn / play / watch), by **place** (worlds with a map), "Your input" worlds. | Google Arts & Culture, Pudding filters | experiences.json + small new fields |
| S2 | **World of the day.** | One world featured per day, chosen by date so it is the same for everyone and needs no server. | Arts & Culture artwork of the day, NASA Image of the Day | experiences.json |
| S3 | **Suggested searches.** | Under the search box, 6 real example queries in the visitor's language that are known to return good results. | NASA suggested searches | i18n files |
| S4 | **Universe map as navigation, list as twin.** | Backlog idea 1. The constellation is the visual door; the accessible list is always one click away and is the default with reduced motion. | Bruno (explore by moving), Arts & Culture | 074 galaxy code |
| S5 | **Surprise me that never repeats.** | Backlog idea 3, weighted by themes the visitor liked, device-only. | Pudding, Arts & Culture | passport (planned) |

### 5.4 Abidora AI (days 18–22; needs paid API keys)
| # | Principle | Concrete Abidora implementation | Inspired by | Reuses |
|---|---|---|---|---|
| A1 | **The AI is a guide, not a chatbot bolted on.** | Same quiet button on every page (already in EXPERIENCE_ROADMAP). It knows the current world, can explain it using that world's Backstage text, and can open worlds with settings via deep links (backlog idea 4). | Stripe "Guide me", NASA learning resources | world deep links, W2 text |
| A2 | **Answers show their source.** | When it uses web search, it shows the links and date, like Figma's dated claims. If no key is configured it says so plainly. | Figma dated data, FWA honesty | AI_ASSISTANT_PLAN.md |
| A3 | **Interface as real text.** | Chat panel is plain HTML with live-region updates; works with keyboard and screen readers; bottom sheet on phones. | Linear | existing panel plan |

### 5.5 Personalization (Studio exists; accounts days 16–17)
| # | Principle | Concrete Abidora implementation | Inspired by | Reuses |
|---|---|---|---|---|
| P1 | **Quality is a user choice.** | Studio gets a global "3D quality" (auto / battery saver / full) that every world's W1 bar reads by default. | Bruno Quality, Active Theory device tiers | Studio |
| P2 | **Passport with stamps for doing, not visiting.** | Backlog idea 2, shown as a "hall" of earned stamps on the profile, one design per category. | Bruno achievements, Lando helmets hall, Arts & Culture achievements | planned |
| P3 | **Leave a note in a world.** | After accounts and moderation exist: a short visitor note pinned in a world (moderated, report button, off by default for minors). | Bruno "whispers" | community plan (days 16–17) |
| P4 | **What's new.** | A public "Now" page generated from CHANGELOG.md so returning visitors see new worlds. | Linear Now/Changelog | CHANGELOG.md |

## 6. Abidora's own identity (what makes it recognisable)

Not one reference has all of these together; this combination is Abidora's:
1. **Editorial calm shell + wildly different worlds.** The shell is always ink/bone/signal with serif display and mono labels; each world has its own palette inside a ring-shaped "portal".
2. **The ora ring** as the single recurring object (logo, loader, portal, passport stamp shape, AI button).
3. **Real, not fake.** Real Sun position, real simulations, real numbers, sources shown. The "Your input" principle makes the visitor part of the result.
4. **Global by default.** 10 languages with RTL, so every text layer (W6 text twin, Backstage, AI) must stay translatable; no text baked into images or canvas.

## 7. What was done, tested and left incomplete

| Item | Status |
|---|---|
| Studied all 15 homepages by text fetch (12 with useful content, 3 nearly empty) | DONE |
| Visual review, animation review, phone testing, Lighthouse on these 15 sites | **NOT DONE**: blocked by the build server's network policy. Can be done if the owner shares screen recordings (like the GetLayers videos) or if network access to these hosts is enabled. |
| REFERENCE_ANALYSIS.md written | DONE |
| Principles applied to the Abidora source | **NOT DONE in this thread, by design.** The Abidora build thread owns the code. These items are PLANNED and should be scheduled inside the existing days (homepage → day 23, worlds → days 5–14, discovery → day 15, accounts → 16–17, AI → 18–22). Suggested to add H1, H4, W1, W2, W3, W7, S1, S2, S3, P1, P4 to INNOVATION_BACKLOG.md as new rows. |
| Testing of implemented changes | Not applicable yet; each item is tested by the build thread when built (W7 gives the scoring rule). |

Quick wins the build thread can do first (each S effort, high value): W1 world bar, W3 "Your input" badge, S2 world of the day, H3 honest numbers band, W7 self-review score.
