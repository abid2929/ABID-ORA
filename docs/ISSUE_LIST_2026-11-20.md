# Abidora issue list (20 Nov 2026, staging phase)

Priorities:
- **P1:** breaks a feature, or the owner reported it.
- **P2:** quality.
- **P3:** polish.

Status values:
- **FIXED + TESTED (local):** fixed and tested on the build server's copy of the site.
- **FIXED, needs device test:** fixed, but it can only be checked on a real phone or on the staging host.
- **OPEN:** not fixed yet.

| # | Page | Problem | Root cause | Fix | P | Test method | Status |
|---|---|---|---|---|---|---|---|
| 1 | AI page | Mouse pointer invisible | `cursor:none` was set on pages that have no custom cursor element | Hide the system cursor only when the custom cursor exists | P1 | Playwright pointer check on ai, credits and 404 | FIXED + TESTED (patch 0.5.1/0.5.2) |
| 2 | Admin > AI | ElevenLabs check gave 401, then 400 | The saved key was not the owner's real key (browser autofill); errors had no detail | Key must start with `sk_`; autofill off; ElevenLabs' real error is shown | P1 | Admin e2e with a fake server | FIXED + TESTED; owner must paste the key again |
| 3 | AI page | Empty reply bubble after the first message | No loading state; host may buffer the stream (gzip/LiteSpeed); empty pieces counted as text | Typing dots, a 40 s no-text timeout with Retry, empty pieces ignored, no-gzip headers | P1 | Multi-turn chat test with real Gemini | FIXED + TESTED locally; host buffering needs `stream-test.php` on staging |
| 4 | AI page | Slow replies | Buffering (see 3); only one model, so Google "busy" meant waiting or an error | Streaming headers; chain of 4 free Gemini models; a stuck model is dropped after 18 s | P1 | 55-conversation run (median 0.9 s to first words) | FIXED + TESTED locally |
| 5 | AI page | AI speaks poor Bengali (tumi/apni mixed, broken sentences, answers in Banglish when asked for Bangla) | Small model plus long prompt; no per-message language, politeness or style rules | `ab_ai_turn_hints`: script, Banglish, "speak Bangla", tumi/apni, Bengali style | P1 | 55 conversations before/after: flags 18 → 3; owner rating pending | FIXED + TESTED (automatic); native rating OPEN |
| 6 | AI page | Voice should work "like a call" | Only push-to-talk existed | Full-screen voice call: listen → think → speak → listen again, barge-in, mute, transcript, end | P1 | `call.js` / `natcall2.js` with fake speech + real Gemini | FIXED + TESTED locally; real mic/echo needs a phone |
| 7 | Voice call | No avatar, no sound animation | Not built in v1 | Canvas avatar (blinks, mouth moves with the real voice level), 64-bar sound ring, 5 states | P2 | Screenshots plus a state test | FIXED + TESTED locally |
| 8 | AI page (phone) | Page needs scrolling; input box goes off screen | Page height used 100vh; the header was too tall | Visual-viewport height, compact header, shrinking welcome screen | P1 | Pixel 7, iPhone 12 and Galaxy S8 emulation: page height = screen height | FIXED + TESTED (emulated) |
| 9 | Home (phone) | Text runs over the logo and menu when scrolling | Top bar was transparent | Frosted solid bar after scroll | P1 | Phone screenshots | FIXED + TESTED (emulated) |
| 10 | Home (phone) | Hero does not react to touch like the mouse on PC | Only mouse events were wired | Touch drag and phone tilt move the lens and parallax | P2 | Touch emulation | FIXED; tilt needs a real phone |
| 11 | Home (phone) | Blurry photos (Mesa) | Phones loaded the small image | Phones load the 1600 px image, and the extra-large one on sharp screens | P1 | Network log of image sizes | FIXED + TESTED |
| 12 | Home | Neon slide should change | Owner request | New high-resolution neon street photo (Unsplash licence, credited) | P2 | Screenshot | FIXED + TESTED |
| 13 | Home (phone) | Universe section looks broken after tapping a system | The card opened below the screen | Page scrolls so the card is fully visible | P2 | `uni2.js` | FIXED + TESTED (emulated) |
| 14 | All pages | AI button too low, plain | Owner request | Raised; dark glass with a slowly turning gold ring | P3 | Screenshot | FIXED + TESTED |
| 15 | AI page | No search or rename in chat history | Not built | Search box (titles and messages) and rename (Enter saves, Escape cancels) | P2 | `hist.js`: search, Bengali search, rename, reload, delete | FIXED + TESTED |
| 16 | AI page | Bengali speech depends on the device; many have no Bengali voice | Browser voices vary | Voice order: clone → (optional Gemini voice) → device; honest labels | P2 | `natcall2.js`; Gemini TTS measured | PARTLY: the Gemini voice is free for only 10 clips/day, so it is off |
| 17 | AI page (Bengali) | "Draft translation, not reviewed" notice | AI translations are not reviewed by a native speaker | Remove the notice only after the owner reviews the Bengali | P2 | Owner review | OPEN (waiting for the owner) |
| 18 | Fashion worlds (9) | Look like demos, not premium showrooms | Built as interactive tools, not product showcases | Showroom redesign | P2 | Before/after screenshots | OPEN, next |
| 19 | All 72 worlds | Some look alike | Shared template | Visual identity pass | P3 | Screenshot sheet | OPEN |
| 20 | Studio | Theme, cursor, motion and background controls must save and reset | Needs re-checking after the latest changes | Verify and fix | P2 | Playwright Studio test | OPEN |
| 21 | 10 languages | Missing keys and RTL layout | New keys were added today (all 10 languages filled) | Key audit and Arabic RTL screenshots | P2 | Key diff script plus screenshots | OPEN |
| 22 | Whole site | Final phone, tablet and desktop QA | — | Full pass | P1 | Screenshot matrix | OPEN |

Things that can only be tested on the owner's side:
- the real microphone
- iPhone audio
- echo during a call
- ElevenLabs on the staging host
- streaming on the host (`/api/stream-test.php`)
