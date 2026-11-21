# Innovation backlog

Started on 20 Nov 2026, after the owner's vision statement. Ideas are listed here before anything is built. Each idea has a value, feasibility, effort and roadmap phase. Nothing here changes the approved architecture (Astro + TypeScript, PHP 8 API, MySQL, one zip with a web installer) or the 25-day order. An idea moves into FEATURE_STATUS.md only when it is scheduled. It is marked done only after it has been built and tested.

**Scales**
- **Value:** how much it changes a first-time visitor's or a returning user's experience (High, Medium or Low).
- **Effort:** S is under half a day, M is about 1 day, L is 2 to 3 days.

## Status: proposed (not built)

| # | Idea | Why it matters (value) | Feasibility on our stack | Effort | Phase |
|---|---|---|---|---|---|
| 1 | **Universe map as the home navigation.** The 112 worlds appear as one explorable constellation, grouped by theme. Visited worlds glow, and the ones you haven't visited stay dim. | High. Exploring becomes the reason to return ("discover something new"). | Three.js is already used for the Digital Galaxy. Instanced points keep it light, and a plain list remains for accessibility. | M | Day 15 (search and discovery) |
| 2 | **Personal "passport".** Each world gives a stamp when you actually use it, not just open it (for example, finish a game or export a creation). The passport is saved on the device, and on the account when logged in. | High. A real reason to explore more worlds, with no dark patterns. | Small event API in kit.ts. Local storage first, MySQL after accounts. | M | Days 16–17 (accounts) |
| 3 | **"Surprise me" that learns.** Random discovery weighted toward themes you liked but haven't fully explored. It never repeats until all worlds have been seen. | Medium–High | Runs on the device only, no tracking. Uses the world categories and the passport. | S | Day 15 |
| 4 | **Abidora AI as a guide to the worlds.** The AI can open a world with settings ("show me London's golden hour on 21 June"), using real deep links that each world already reads. | High. Joins the AI and the worlds into one product. | Needs URL parameters per world (some already exist) and a tool list for the AI. Requires an AI API key. | M | Days 18–22 (AI) |
| 5 | **Share cards.** Any creation (star pattern, crop, gesture, chart) can be exported as a branded image with a link back to its world. | Medium–High (growth) | Canvas export already exists in many worlds. Add one shared "card" helper. | S | Day 23 (polish) |
| 6 | **Living homepage with real data.** The hero sky shows the real Sun and Moon position for the visitor's time zone (code already exists in world 65 and world 68). | Medium. It is memorable and true, not fake. | Reuse geo.ts. No location permission needed, because the time zone is enough. | S | Day 23 |
| 7 | **Sound design system.** One quiet, original audio palette shared by the site and worlds (respects "Sound off" and reduced motion). | Medium | Web Audio synthesis, so no audio files to license. | M | Day 23 |
| 8 | **Accessibility mode per world.** Each world describes what is on the canvas in text (for example "3 sites shown, Sundarbans selected"), not only visually. | High (inclusion and quality) | Most worlds already write a status line. Make it a live region everywhere and audit the rest. | M | Days 23–25 (QA) |
| 9 | **Offline install (PWA).** Most worlds work without a network, so Abidora can be installed and used offline. | Medium | Service worker plus manifest. Must not cache admin or API responses. | S–M | Day 24 |
| 10 | **Creator mode.** Users publish what they made in a world (pattern, palette, route) to the community, with moderation. | High (community) | Depends on accounts and moderation (days 16–17). Image and JSON uploads only, checked on the server. | L | Days 16–17 |

## Rules kept
- Quality over feature count: an idea is only scheduled if it can be finished, tested and maintained.
- Nothing is copied from other brands or sites. References are for quality only.
- No fake capabilities. Anything that needs a paid API is marked as such until real keys exist.
